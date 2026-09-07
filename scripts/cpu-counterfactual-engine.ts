/** Bounded diagnostic search. Its rollout estimates never authorize promotion. */
import Core = require('../game/logic/core');
const Cards: any = require('../game/logic/cards');
import Pipeline = require('../game/turn/turn_pipeline');
import Phases = require('../game/turn/turn_pipeline_phases');
import BoardOps = require('../game/logic/board_ops');
import Pending = require('../game/logic/cards-internal/pending-selection-registry');
import { decideAction, buildCardDecisionContext } from '../src/engine/selfplay-runner';
import { createSelfplayPolicySetup } from '../src/engine/selfplay-policy-setup';
import Othello = require('../game/ai/othello-onnx-runtime');
const Policy = require('../game/ai/cpu-policy-core');
const PresentationQueue = require('../shared/presentation-queue');
const Prng = require('../game/schema/prng');
const Authority = require('../utils/match-authority');
const DeckSpec = require('../shared/deck-spec');
const DeckCodec = require('../shared/deck-codec');
const Startup = require('../shared/cpu-opponent-startup-options');

export const clone = (value: any) => JSON.parse(JSON.stringify(value));
export const canonical = (value: any): string => JSON.stringify(value, (_key, item) =>
    item && typeof item === 'object' && !Array.isArray(item)
        ? Object.fromEntries(Object.keys(item).sort().map(key => [key, item[key]])) : item);

export function publicView(state: any, player: string) {
    const view = Authority.projectSnapshotForViewer(clone(state), player);
    for (const key of ['_defaultRandomSource', '_boardOpsRandomSource', '_currentActionMeta',
        'presentationEvents', '_presentationEventsPersist', 'chargeDeltaEvents']) delete view.cardState[key];
    return view;
}

/** The Lv6 recipe is public configuration. Actual hidden hands/order/RNG never enter sampling. */
export function materializeScenario(view: any, seed: number) {
    const state = clone(view), cs = state.cardState;
    const rng = Prng.createPRNG(seed);
    cs.decks = {};
    for (const player of ['black', 'white']) {
        const recipe = Startup.getCpuOpponentStartupOptions(6, player);
        const pool = DeckSpec.expandDeckSpec(DeckCodec.decodeDeckCode(recipe.deckCode));
        if (!Array.isArray(pool) || pool.length === 0) throw new Error('Missing public Lv6 deck recipe');
        const remaining = pool.slice();
        const hand = cs.hands[player];
        for (const card of hand.filter((id: string) => !id.startsWith('__hidden_hand__:'))) {
            const index = remaining.indexOf(card);
            if (index >= 0) remaining.splice(index, 1);
        }
        rng.shuffle(remaining);
        const draw = () => {
            if (remaining.length === 0) { remaining.push(...pool); rng.shuffle(remaining); }
            return remaining.pop();
        };
        cs.hands[player] = hand.map((id: string) => id.startsWith('__hidden_hand__:') ? draw() : id);
        cs.decks[player] = Array.from({ length: cs.deckRemainingByPlayer[player] }, draw);
    }
    cs.deck = cs.decks.black.slice();
    Cards.ensureCardCopyState(cs);
    // Visible costs are projected by hand slot; restore them onto the synthetic copy IDs.
    for (const player of ['black', 'white']) {
        (cs.handCostAdjustmentsByPlayer?.[player] || []).forEach((adjustment: any, index: number) => {
            if (!adjustment) return;
            const copyId = cs._handCopyIdsByPlayer[player][index];
            if (Number.isFinite(adjustment.overrideCost)) cs.cardCostOverridesByCopyId[copyId] = { cost: adjustment.overrideCost };
            if (Number.isFinite(adjustment.delta)) cs.cardCostModifiersByCopyId[copyId] = [{ delta: adjustment.delta }];
        });
    }
    cs._defaultRandomSource = rng;
    cs.prngState = rng.getState();
    state.prngState = rng.getState();
    return state;
}

export function cleanAction(action: any) {
    const result = clone(action);
    for (const key of ['turnIndex', 'actionId', 'player', 'deferNetworkPublish', 'pendingSelectionState']) delete result[key];
    if (Object.keys(result).some(key => key.endsWith('Target') && result[key] && typeof result[key] === 'object')) {
        delete result.row;
        delete result.col;
    }
    return result;
}

const options = createSelfplayPolicySetup({ SeededPRNG: Prng }).normalizeOptions({
    enableTacticalLookahead: false, cardUsageRate: 1, maxPlies: 160
});
const policyOptions = { ...options, allowHandDestroy: false };

export function resolveRolloutCardAction(cs: any, player: string, cardId: string) {
    const action: any = { type: 'use_card', useCardId: cardId, useCardOwnerKey: player };
    const hand = cs.hands[player];
    const costAt = (index: number) => Cards.getEffectiveCardCostForCopy(cs, cardId, cs._handCopyIdsByPlayer[player][index]);
    const first = hand.indexOf(cardId);
    // Keep successful legacy choices identical. A card ID may be usable because
    // a later discounted copy is affordable while the first copy is not.
    if (first >= 0 && costAt(first) <= cs.charge[player]) return action;
    const affordable = hand.findIndex((id: string, index: number) => id === cardId && costAt(index) <= cs.charge[player]);
    if (affordable < 0) throw new Error('No affordable card copy');
    action.useCardHandIndex = affordable;
    return action;
}

/** Every rollout chooser receives only that player's view. This is a shared-policy
 * continuation, not the complete browser CPU, and is labelled as such in reports. */
async function rolloutDecision(state: any, player: string, choiceSeed: number) {
    const view = publicView(state, player);
    // Restore visible copy/cost metadata without reading the opponent's real hidden state.
    const decisionState = materializeScenario(view, choiceSeed);
    const gs = decisionState.gameState, cs = decisionState.cardState;
    const pending = cs.pendingEffectByPlayer[player];
    if (pending?.stage === 'selectTarget') {
        const result = decideAction(gs, cs, player, Prng.createPRNG(choiceSeed), policyOptions, undefined);
        if (!result?.action || result.action.type === 'cancel_card') throw new Error('Unsupported rollout pending selection');
        return cleanAction(result.action);
    }
    const context = { ...Cards.getCardContext(cs), cardState: cs };
    const moves = pending && Cards.isFreePlacementPendingType(pending.type)
        ? Core.getFreePlacementMoves(gs, gs.currentPlayer, context) : Core.getLegalMoves(gs, gs.currentPlayer, context);
    if (!pending && !cs.hasUsedCardThisTurnByPlayer[player]) {
        const usable = Cards.getUsableCardIds(cs, gs, player);
        const cardContext = buildCardDecisionContext(gs, cs, player, moves.length, moves, usable);
        const cost = (id: string) => Cards.getEffectiveCardCostForCopy(cs, id,
            cs._handCopyIdsByPlayer[player][cs.hands[player].indexOf(id)]);
        const card = Policy.chooseCardWithRiskProfile(usable, cost, Cards.getCardDef, cardContext);
        if (card) return resolveRolloutCardAction(cs, player, card.cardId);
    }
    if (!moves.length) return { type: 'pass' };
    const move = await Othello.chooseMove(moves, { playerKey: player, level: 6, board: gs.board, legalMovesCount: moves.length });
    if (!move) throw new Error('Unsupported placement model input');
    return { type: 'place', row: move.row, col: move.col };
}

export function enumerateActions(view: any) {
    const state = materializeScenario(view, 71100001), gs = state.gameState, cs = state.cardState;
    const player = gs.currentPlayer === 1 ? 'black' : 'white';
    const pending = cs.pendingEffectByPlayer[player];
    const entry = Pending.getPendingSelectionEntry(pending?.type);
    if (pending?.stage === 'selectTarget') {
        if (!entry?.action || !entry?.target) return [];
        const args = [cs, gs];
        if (entry.target.argsKey !== 'board') args.push(player);
        if (entry.target.argsKey === 'player_pending') args.push(pending);
        const targets = (Cards as any)[entry.target.method](...args);
        return targets.map((target: any) => ({ type: 'place', [entry.action!.field]: clone(target) }));
    }
    const context = { ...Cards.getCardContext(cs), cardState: cs };
    const free = pending && Cards.isFreePlacementPendingType(pending.type);
    const moves = free ? Core.getFreePlacementMoves(gs, gs.currentPlayer, context)
        : Core.getLegalMoves(gs, gs.currentPlayer, context);
    const placements = moves.map((move: any) => ({ type: 'place', row: move.row, col: move.col }));
    const cards = pending ? [] : Cards.getUsableCardIds(cs, gs, player)
        .map((id: string) => ({ type: 'use_card', useCardId: id, useCardOwnerKey: player }));
    return [...cards, ...placements, ...(placements.length ? [] : [{ type: 'pass' }])];
}

export type Budget = { steps: number; maxSteps: number; deadline: number };
export function useStep(budget: Budget) {
    if (budget.steps >= budget.maxSteps || Date.now() >= budget.deadline) throw new Error('AUDIT_BUDGET_EXHAUSTED');
    budget.steps++;
}

export function applyStep(state: any, player: string, action: any, budget: Budget) {
    useStep(budget);
    const rng = Prng.fromState(state.prngState);
    const result = Pipeline.applyTurnSafe(state.cardState, state.gameState, player, cleanAction(action), rng,
        { skipTurnStart: true });
    if (!result.ok) throw new Error(`Rejected action: ${result.rejectedReason}: ${result.errorMessage || ''}`);
    // Browser playback drains both queues before the next decision. Retaining old
    // events changes speech deduplication/RNG consumption and makes rollouts grow.
    PresentationQueue.clearPresentationQueues(result.cardState);
    return { gameState: result.gameState, cardState: result.cardState, prngState: rng.getState() };
}

export async function rollout(initial: any, action: any, player: string, seed: number, budget: Budget, maxActions = 160) {
    try {
        let state = applyStep(initial, player, action, budget);
        for (let step = 0; step < maxActions; step++) {
            if (Core.isGameOver(state.gameState)) {
                const counts = Core.countDiscs(state.gameState, state.cardState);
                const diff = player === 'black' ? counts.black - counts.white : counts.white - counts.black;
                return { terminal: true, score: diff > 0 ? 1 : diff < 0 ? 0 : 0.5, diff, actions: step + 1 };
            }
            useStep(budget);
            const rng = Prng.fromState(state.prngState);
            const current = state.gameState.currentPlayer === 1 ? 'black' : 'white';
            state.cardState._defaultRandomSource = rng;
            const started: any = Phases.applyTurnStartPhase(Cards, Core, state.cardState, state.gameState, current, [], rng, BoardOps);
            state.prngState = rng.getState();
            PresentationQueue.clearPresentationQueues(state.cardState);
            if (started?.stopAction || Core.isGameOver(state.gameState)) continue;
            const next = await rolloutDecision(state, current, seed + step * 2 + (current === 'black' ? 0 : 1));
            state = applyStep(state, current, next, budget);
        }
        return { terminal: false, reason: 'action_limit' };
    } catch (error: any) {
        if (error.message === 'AUDIT_BUDGET_EXHAUSTED') throw error;
        return { terminal: false, reason: error.message };
    }
}

/** Prune using immediate full-rule effects only; this score is never win evidence. */
function quickScore(view: any, action: any, player: string, budget: Budget) {
    try {
        const result = applyStep(materializeScenario(view, 71200001), player, action, budget);
        const counts = Core.countDiscs(result.gameState, result.cardState);
        const diff = player === 'black' ? counts.black - counts.white : counts.white - counts.black;
        let score = diff;
        if (action.type === 'use_card') score += 2; // retain card branches in the small beam
        if (action.type === 'place' && Number.isInteger(action.row)) {
            const board = result.gameState.board;
            if ([0, board.length - 1].includes(action.row) && [0, board[0].length - 1].includes(action.col)) score += 50;
        }
        return score;
    } catch (error: any) {
        if (error.message === 'AUDIT_BUDGET_EXHAUSTED') throw error;
        return -Infinity;
    }
}

export async function auditPosition(record: any, id: number, budget: Budget) {
    const startedAt = Date.now();
    const view = publicView(record.before, record.player), baseline = cleanAction(record.action);
    const key = canonical(baseline);
    const alternatives = enumerateActions(view).filter((action: any) => canonical(action) !== key)
        .map((action: any) => ({ action, score: quickScore(view, action, record.player, budget) }))
        .filter((item: any) => Number.isFinite(item.score))
        .sort((a: any, b: any) => b.score - a.score || canonical(a.action).localeCompare(canonical(b.action)));
    const selected = alternatives.slice(0, 3);
    // Include both holding a card (placement) and spending one when both are legal.
    for (const type of ['use_card', 'place']) {
        if (baseline.type === type || selected.some((item: any) => item.action.type === type)) continue;
        const candidate = alternatives.find((item: any) => item.action.type === type);
        if (candidate) selected.splice(Math.max(0, selected.length - 1), 1, candidate);
    }
    const actions = [baseline, ...selected.map((item: any) => item.action)];
    const play = (action: any, scenario: number, confirmation: boolean) => {
        const seed = (confirmation ? 81300001 : 71300001) + id * 1009 + scenario * 101;
        return rollout(materializeScenario(view, seed), action, record.player, seed + 13, budget);
    };
    const trials: any[][] = [];
    for (const action of actions) trials.push([await play(action, 0, false), await play(action, 1, false)]);
    const score = (trial: any[]) => trial.every(item => item.terminal) ? trial.reduce((sum, item) => sum + item.score, 0) : null;
    const baseScore = score(trials[0]);
    let bestIndex = 0, bestScore = baseScore;
    if (baseScore !== null) trials.forEach((trial, index) => {
        const value = score(trial);
        if (value !== null && value > bestScore!) { bestScore = value; bestIndex = index; }
    });
    const confirmation: any[][] = [];
    if (bestIndex > 0) for (const action of [actions[0], actions[bestIndex]])
        confirmation.push([await play(action, 0, true), await play(action, 1, true)]);
    const confirmed = confirmation.length === 2 && score(confirmation[0]) !== null && score(confirmation[1]) !== null &&
        score(confirmation[1])! > score(confirmation[0])! && confirmation[1].every((item, index) => item.score! >= confirmation[0][index].score!);
    return { id, turn: record.before.gameState.turnNumber, player: record.player, pending: view.cardState.pendingEffectByPlayer[record.player]?.type || null,
        candidateCountBeforePruning: alternatives.length + 1, actions, trials, bestIndex, confirmation,
        promisingInIndependentScenarios: confirmed, elapsedMs: Date.now() - startedAt, promotionAllowed: false };
}
