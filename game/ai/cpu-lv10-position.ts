import { cloneBattle, currentBattlePlayer, battleDecisionPlayer, type BattlePlayer, type BattleAction, type BattlePosition } from '../../shared/battle/types';
import Core = require('../logic/core');
import Pipeline = require('../turn/turn_pipeline');
import Phases = require('../turn/turn_pipeline_phases');
import BoardOps = require('../logic/board_ops');
import DeckSpec = require('../../shared/deck-spec');
import Presentation = require('../../shared/presentation-queue');
import Registry = require('../logic/cards-internal/pending-selection-registry');
import SubPlacement = require('../turn/sub-placement-continuation');
import StateHash = require('../../shared/state-hash');

const Cards: any = require('../logic/cards');
const Prng: any = require('../schema/prng');

export type Lv10Player = BattlePlayer;
export type Lv10Action = BattleAction;
export function lv10ActionKey(action: Lv10Action): string {
    return StateHash.stableStringify(action);
}
export type Lv10Position = BattlePosition;
export type Lv10Observation = {
    schema: 'cpu_lv10_observation.v1';
    player: Lv10Player;
    gameState: any;
    cardState: any;
};
export const LV10_POSITION_LIMITS = Object.freeze({ maxSerializedChars: 524288, maxActions: 1024, maxHand: 64, maxDeck: 512 });

export function cloneLv10<T>(value: T): T {
    return cloneBattle(value);
}

function clearTransientState(cardState: any): void {
    Presentation.clearPresentationQueues(cardState);
    for (const key of ['_defaultRandomSource', '_boardOpsRandomSource', '_currentActionMeta', 'prngState']) delete cardState[key];
}

/** Public deck recipes are priors, never the private live deck. A sampled world
 * is one possible continuation, not a prediction of the actual future draw. */
export function sampleLv10Position(
    observation: Lv10Observation,
    seed: number,
    publicRecipes?: Partial<Record<Lv10Player, readonly string[]>>
): Lv10Position {
    if (observation.schema !== 'cpu_lv10_observation.v1') throw new Error('Invalid Lv10 observation schema');
    if (!Number.isInteger(seed)) throw new Error('Lv10 scenario requires an integer seed');
    const state: Lv10Position = cloneLv10({ gameState: observation.gameState, cardState: observation.cardState });
    const cs = state.cardState;
    const rng = Prng.createPRNG(seed);
    cs.decks = {};
    for (const player of ['black', 'white'] as const) {
        const pool = [...(publicRecipes?.[player] || DeckSpec.getEnabledCardIds())];
        if (!pool.length || pool.length > LV10_POSITION_LIMITS.maxDeck || pool.some(id => !Cards.getCardDef(id))) {
            throw new Error('Invalid public deck prior');
        }
        const hand: string[] = cs.hands?.[player]?.slice();
        const count = cs.deckRemainingByPlayer?.[player] ?? 0;
        if (!Array.isArray(hand) || hand.length > LV10_POSITION_LIMITS.maxHand
            || !Number.isInteger(count) || count < 0 || count > LV10_POSITION_LIMITS.maxDeck) {
            throw new Error('Lv10 hand/deck exceeds budget');
        }
        // A reveal/steal selection can expose offers before the hand itself is
        // marked observed. These public identities also constrain the scenario.
        const selectingPlayer = player === 'black' ? 'white' : 'black';
        const selection = cs.pendingEffectByPlayer?.[selectingPlayer];
        if (selection && ['CONDEMN_WILL', 'OBSERVER_WILL'].includes(selection.type)) {
            for (const offer of selection.offers || []) {
                if (Number.isInteger(offer.handIndex) && offer.handIndex >= 0 && offer.handIndex < hand.length
                    && typeof offer.cardId === 'string' && Cards.getCardDef(offer.cardId)) hand[offer.handIndex] = offer.cardId;
            }
        }
        const remaining = pool.slice();
        for (const id of hand) {
            const index = remaining.indexOf(id);
            if (index >= 0) remaining.splice(index, 1);
        }
        rng.shuffle(remaining);
        const draw = (): string => {
            if (!remaining.length) { remaining.push(...pool); rng.shuffle(remaining); }
            return remaining.pop()!;
        };
        cs.hands[player] = hand.map(id => String(id).startsWith('__hidden_hand__:') ? draw() : id);
        cs.decks[player] = Array.from({ length: count }, draw);
    }
    cs.deck = cs.decks.black.slice();
    // Reconstitute only visible per-copy cost adjustments on synthetic copy IDs.
    Cards.ensureCardCopyState(cs);
    for (const player of ['black', 'white'] as const) {
        (cs.handCostAdjustmentsByPlayer?.[player] || []).forEach((adjustment: any, index: number) => {
            if (!adjustment) return;
            const copyId = cs._handCopyIdsByPlayer[player][index];
            if (Number.isFinite(adjustment.overrideCost)) cs.cardCostOverridesByCopyId[copyId] = { cost: adjustment.overrideCost };
            if (Number.isFinite(adjustment.delta)) cs.cardCostModifiersByCopyId[copyId] = [{ delta: adjustment.delta }];
        });
    }
    state.prngState = rng.getState();
    return state;
}

export function currentLv10Player(state: Lv10Position): Lv10Player {
    return currentBattlePlayer(state);
}

export function lv10DecisionPlayer(state: Lv10Position): Lv10Player {
    return battleDecisionPlayer(state);
}

export function lv10PlacementMoves(state: Lv10Position, player = currentLv10Player(state)): any[] {
    const cs = state.cardState, gs = state.gameState;
    const pending = cs.pendingEffectByPlayer?.[player];
    const context = { ...Cards.getCardContext(cs), cardState: cs };
    const sign = player === 'black' ? 1 : -1;
    return pending && Cards.isFreePlacementPendingType(pending.type)
        ? Core.getFreePlacementMoves(gs, sign, context) : Core.getLegalMoves(gs, sign, context);
}

/** Generate the canonical action vocabulary. Legality is still decided by the
 * ordinary pipeline; a rejected search branch is recorded by its caller. */
export function enumerateLv10Actions(
    state: Lv10Position,
    options: { allowCards?: boolean; allowDestroy?: boolean; cardUnlockTurn?: number } = {}
): Lv10Action[] {
    if (Core.isGameOver(state.gameState)) return [];
    const player = currentLv10Player(state), cs = state.cardState, gs = state.gameState;
    const pending = cs.pendingEffectByPlayer?.[player];
    let actions: Lv10Action[];
    if (pending?.stage === 'selectTarget') {
        const offers: any[] = pending.offers || [];
        if (pending.type === 'HEAVEN_BLESSING') {
            actions = offers.map(offer => ({ type: 'place', heavenBlessingCardId: typeof offer === 'string' ? offer : offer.cardId }));
        } else if (pending.type === 'CONDEMN_WILL' || pending.type === 'OBSERVER_WILL') {
            const field = pending.type === 'CONDEMN_WILL' ? 'condemnTargetIndex' : 'observerWillTargetIndex';
            actions = offers.filter(offer => Number.isInteger(offer.handIndex)).map(offer => ({ type: 'place', [field]: offer.handIndex }));
        } else {
            const entry = Registry.getPendingSelectionEntry(pending.type);
            if (!entry?.target || !entry.action) throw new Error(`Lv10 missing pending contract: ${pending.type}`);
            const args: any[] = [cs, gs];
            if (entry.target.argsKey !== 'board') args.push(player);
            if (entry.target.argsKey === 'player_pending') args.push(pending);
            const targets: any[] = Cards[entry.target.method](...args);
            actions = targets
                // The public target list can include frozen stones, although
                // BoardOps refuses to move them. Skip this known impossibility
                // before spending the short emergency simulation budget.
                .filter(target => pending.type !== 'STRONG_WIND_WILL' || !Cards.isFrozenCell(cs, target.row, target.col))
                .map(target => ({ type: 'place', [entry.action!.field]: cloneLv10(target) }));
        }
    } else {
        const moves = lv10PlacementMoves(state, player);
        actions = moves.map(move => ({ type: 'place', row: move.row, col: move.col }));
        const subPlacement = SubPlacement.isSubPlacementTurnActive(cs, player);
        if (!moves.length && !subPlacement) actions.push({ type: 'pass' });
        if (!pending && !subPlacement && options.allowCards !== false
            && gs.turnNumber >= (options.cardUnlockTurn ?? 6) && !cs.hasUsedCardThisTurnByPlayer?.[player]) {
            const usable = new Set<string>(Cards.getUsableCardIds(cs, gs, player));
            (cs.hands[player] as string[]).forEach((id, index) => {
                const copyId = cs._handCopyIdsByPlayer?.[player]?.[index];
                if (usable.has(id) && Cards.getEffectiveCardCostForCopy(cs, id, copyId) <= cs.charge[player]) {
                    actions.push({ type: 'use_card', useCardId: id, useCardHandIndex: index, useCardOwnerKey: player });
                }
            });
        }
        if (!pending && !subPlacement && options.allowDestroy === true && gs.turnNumber >= (options.cardUnlockTurn ?? 6)
            && !cs.hasDestroyedCardThisTurnByPlayer?.[player]) {
            for (const id of new Set<string>(cs.hands[player])) actions.push({ type: 'destroy_hand_card', destroyCardId: id });
        }
    }
    if (actions.length > LV10_POSITION_LIMITS.maxActions) throw new Error('Lv10 action set exceeds budget');
    return actions;
}

export type Lv10Transition = { ok: true; state: Lv10Position; selectionFailed?: boolean } | { ok: false; reason: string };

/** Existing player cancellation, used only when an advisory selection cannot
 * make progress. The canonical action owns the normal refund and usage rules. */
export function lv10CancellationAction(state: Lv10Position): Lv10Action | null {
    const pending = state.cardState.pendingEffectByPlayer?.[currentLv10Player(state)];
    return pending?.stage === 'selectTarget' && Registry.getPendingSelectionEntry(pending.type)?.cancellable
        ? { type: 'cancel_card' } : null;
}

/** Input is already at a decision boundary. Real game/card state and real RNG
 * are never passed to this function by the browser advisor. */
export function applyLv10Action(state: Lv10Position, action: Lv10Action): Lv10Transition {
    const rng = Prng.fromState(state.prngState);
    const result = Pipeline.applyTurnSafe(state.cardState, state.gameState, currentLv10Player(state), cloneLv10(action), rng,
        { skipTurnStart: true });
    if (!result.ok) return { ok: false, reason: `${result.rejectedReason || 'rejected'}: ${result.errorMessage || ''}` };
    const player = currentLv10Player(state), pending = state.cardState.pendingEffectByPlayer?.[player];
    // An accepted command can report a failed movement (for example a frozen
    // stone) and leave selection pending. Do not mistake its RNG consumption
    // for a useful continuation. A real intermediate selection changes pending.
    const selectionFailed = pending?.stage === 'selectTarget'
        && JSON.stringify(pending) === JSON.stringify(result.cardState.pendingEffectByPlayer?.[player])
        && (result.events || []).some((event: any) => event.applied === false);
    clearTransientState(result.cardState);
    return { ok: true, state: { gameState: result.gameState, cardState: result.cardState, prngState: rng.getState() },
        ...(selectionFailed ? { selectionFailed: true } : {}) };
}

/** Real turn-start effects, draws, additional turns and forced passes are
 * settled before looking at the next player's actions. Every call is bounded. */
export function startLv10Turn(state: Lv10Position): Lv10Position {
    const next = cloneLv10(state);
    if (Core.isGameOver(next.gameState)) return next;
    const player = currentLv10Player(next);
    const rng = Prng.fromState(next.prngState);
    Phases.applyTurnStartPhase(Cards, Core, next.cardState, next.gameState, player, [], rng, BoardOps);
    clearTransientState(next.cardState);
    next.prngState = rng.getState();
    return next;
}
