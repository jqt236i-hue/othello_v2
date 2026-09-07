const Cards: any = require('../logic/cards');
import Core = require('../logic/core');
import Pipeline = require('../turn/turn_pipeline');
import Phases = require('../turn/turn_pipeline_phases');
import Authority = require('../../utils/match-authority');
import Board = require('../../shared/shared-board-utils');
const Prng = require('../schema/prng');
const Registry = require('../logic/cards-internal/pending-selection-registry');
const Tempt = require('../cpu-decision-tempt-value');

type State = { gameState: any; cardState: any };
type Input = State & { playerKey: 'black' | 'white'; level: number };
type Assessment = { risk: number; material: number; replyMaterial: number; replyMobility: number; corners: number; valuable: number; charge: number; witness: any };
export const MAX_SAFETY_STEPS = 96;
const clone = (v: any) => JSON.parse(JSON.stringify(v));
const point = (m: any) => ({ row: m.row, col: m.col, ...(m.directionKey ? { directionKey: m.directionKey } : {}) });

/** Public-information, deterministic placement-reply checks. Unknown branches never justify a veto. */
function createProbe(input: Input) {
    const player = input.playerKey, opponent = player === 'black' ? 'white' : 'black', sign = player === 'black' ? 1 : -1;
    const view = Authority.projectSnapshotForViewer(clone({ gameState: input.gameState, cardState: input.cardState }), player) as State;
    for (const key of ['_defaultRandomSource', '_boardOpsRandomSource', '_currentActionMeta', 'presentationEvents', '_presentationEventsPersist', 'chargeDeltaEvents']) delete view.cardState[key];
    Cards.ensureCardCopyState(view.cardState);
    for (const owner of ['black', 'white']) (view.cardState.handCostAdjustmentsByPlayer?.[owner] || []).forEach((a: any, i: number) => {
        if (!a) return;
        const id = view.cardState._handCopyIdsByPlayer[owner][i];
        if (Number.isFinite(a.overrideCost)) view.cardState.cardCostOverridesByCopyId[id] = { cost: a.overrideCost };
        if (Number.isFinite(a.delta)) view.cardState.cardCostModifiersByCopyId[id] = [{ delta: a.delta }];
    });
    let steps = 0;
    const budget = () => { if (++steps > MAX_SAFETY_STEPS) throw Error('safety_budget'); };
    const apply = (s: State, action: any, owner = player): State | null => {
        budget();
        const rng = Prng.createPRNG(19077001), copy = clone(s);
        const r = Pipeline.applyTurnSafe(copy.cardState, copy.gameState, owner, action, rng, { skipTurnStart: true });
        return r.ok && rng.getState().calls === 0 ? { gameState: r.gameState, cardState: r.cardState } : null;
    };
    const moves = (s: State, value = sign) => Core.getLegalMoves(s.gameState, value, { ...Cards.getCardContext(s.cardState), cardState: s.cardState });
    const valuable = (s: State) => (s.cardState.markers || []).filter((m: any) => m.owner === player && Cards.getCardCost(m.data?.sourceCardId) >= 16)
        .reduce((sum: number, m: any) => sum + Cards.getCardCost(m.data.sourceCardId), 0);
    const corners = (s: State, value: number) => {
        const b = Board.createBoardContext(s.gameState, s.cardState);
        return Board.getCornerCells(b).filter((c: any) => Board.getCellValue(b, c.row, c.col) === value).length;
    };
    const material = (s: State) => { const c = Core.countDiscs(s.gameState, s.cardState); return player === 'black' ? c.black - c.white : c.white - c.black; };
    const initialOppCorners = corners(view, -sign), initialValue = valuable(view);
    const assess = (after: State | null): Assessment | null => {
        if (!after || after.cardState.pendingEffectByPlayer?.[player] || after.gameState.currentPlayer !== -sign) return null;
        // Hidden draws and opponent card choices are not predicted. Run public start effects only.
        // Any random start/placement effect makes this line unknown.
        budget();
        const next = clone(after), rng = Prng.createPRNG(19077001);
        Phases.applyTurnStartPhase({ ...Cards, drawForTurnStart: () => {} }, Core, next.cardState, next.gameState, opponent, [], rng);
        if (rng.getState().calls || next.gameState.currentPlayer !== -sign || next.cardState.pendingEffectByPlayer?.[opponent]) return null;
        const replies = moves(next, -sign);
        if (replies.length > 16) return null;
        let risk = 0, witness = null;
        let replyMaterial = material(next), replyMobility = moves(next, sign).length;
        if (replies.length) { replyMaterial = Infinity; replyMobility = Infinity; }
        for (const reply of replies) {
            const r = apply(next, { type: 'place', ...point(reply) }, opponent);
            if (!r || r.cardState.pendingEffectByPlayer?.[opponent]) return null;
            const loss = Math.max(0, corners(r, -sign) - initialOppCorners) * 100 + Math.max(0, initialValue - valuable(r));
            if (loss > risk) { risk = loss; witness = point(reply); }
            replyMaterial = Math.min(replyMaterial, material(r));
            replyMobility = Math.min(replyMobility, moves(r, sign).length);
        }
        return { risk, witness, material: material(after), replyMaterial, replyMobility, corners: corners(after, sign), valuable: valuable(after), charge: after.cardState.charge[player], };
    };
    const placements = (s: State) => {
        const legal = moves(s);
        if (!legal.length || legal.length > 8) return null;
        const results = legal.map((m: any) => ({ move: m, assessment: assess(apply(s, { type: 'place', ...point(m) })) }));
        return results.every((r: any) => r.assessment) ? results : null;
    };
    const targets = (s: State) => {
        const pending = s.cardState.pendingEffectByPlayer?.[player], entry = Registry.getPendingSelectionEntry(pending?.type);
        if (!pending) return [{ state: s, target: null }];
        if (['GOLD_STONE', 'SILVER_STONE', 'PLATINUM_STONE', 'PERMA_PROTECT_NEXT_STONE'].includes(pending.type)) return [{ state: s, target: null }];
        if (pending.stage !== 'selectTarget' || entry?.turnOutcome !== 'continue_turn' || !entry.target || !entry.action) return null;
        const args = [s.cardState, s.gameState];
        if (entry.target.argsKey !== 'board') args.push(player);
        if (entry.target.argsKey === 'player_pending') args.push(pending);
        let list = (Cards as any)[entry.target.method](...args);
        if (pending.type === 'TEMPT_WILL') list = Tempt.filterHighValueTemptTargetsForCpu(player, list, { cardLogic: Cards, cardState: s.cardState });
        if (!list.length || list.length > 8) return null;
        return list.map((t: any) => ({ target: t, state: apply(s, { type: 'place', [entry.action.field]: point(t) }) }));
    };
    return { view, apply, assess, placements, targets, steps: () => Math.min(steps, MAX_SAFETY_STEPS) };
}

const dominates = (safe: Assessment, bad: Assessment) => safe.risk === 0 && safe.material >= bad.material
    && safe.replyMaterial >= bad.replyMaterial && (bad.replyMobility === 0 || safe.replyMobility > 0)
    && safe.corners >= bad.corners && safe.valuable >= bad.valuable && safe.charge >= bad.charge;

export function avoidTacticalBlunder(input: Input & { selected: any; candidates: any[]; pendingType?: string }): any {
    const unchanged = (reason: string, steps = 0) => ({ selected: input.selected, changed: false, reason, steps });
    if (!(input.level >= 6) || !input.selected || !input.gameState?.board || !input.cardState?.hands) return unchanged('not_applicable');
    let readSteps = () => 0;
    try {
        const p = createProbe(input);
        readSteps = p.steps;
        const pending = input.cardState.pendingEffectByPlayer?.[input.playerKey];
        const entry = input.pendingType ? Registry.getPendingSelectionEntry(input.pendingType) : null;
        if (input.pendingType && (!entry?.action || entry.turnOutcome !== 'continue_turn')) return unchanged('unsupported_pending');
        const outcomes = (target: any) => {
            const s = p.apply(p.view, input.pendingType ? { type: 'place', [entry.action.field]: point(target) } : { type: 'place', ...point(target) });
            if (!s) return null;
            return input.pendingType ? p.placements(s)?.map((r: any) => r.assessment) : [p.assess(s)];
        };
        if (!input.pendingType && pending?.stage === 'selectTarget') return unchanged('target_pending');
        const base = outcomes(input.selected);
        if (!base?.length || base.some((r: any) => !r || r.risk === 0)) return unchanged('no_confirmed_blunder', p.steps());
        for (const alternative of input.candidates.slice(0, 8)) {
            if (JSON.stringify(point(alternative)) === JSON.stringify(point(input.selected))) continue;
            const tested = outcomes(alternative);
            // Every continuation must be safe: the existing placement policy remains free to choose.
            if (tested?.length && tested.every((safe: any) => safe && base.every((bad: any) => dominates(safe, bad))))
                return { selected: alternative, changed: true, reason: 'avoidable_public_reply_loss', witness: base[0].witness, steps: p.steps() };
        }
        return unchanged('no_dominating_alternative', p.steps());
    } catch (error) { return unchanged(String(error), readSteps()); }
}

export function shouldHoldTacticallyUnsafeCard(input: Input & { cardId: string; forceUseCard?: boolean }): any {
    const retain = (reason: string, steps = 0) => ({ hold: false, reason, steps });
    if (!(input.level >= 6) || input.forceUseCard || !input.gameState?.board || !input.cardState?.hands) return retain('not_applicable');
    let readSteps = () => 0;
    try {
        const p = createProbe(input);
        readSteps = p.steps;
        const used = p.apply(p.view, { type: 'use_card', useCardId: input.cardId, useCardOwnerKey: input.playerKey });
        if (!used) return retain('unknown_card_effect', p.steps());
        const branches = p.targets(used);
        if (!branches?.length) return retain('unsupported_card', p.steps());
        const bad: Assessment[] = [];
        for (const b of branches) {
            if (!b.state) return retain('unknown_target', p.steps());
            const continuations = p.placements(b.state);
            if (!continuations || continuations.some((r: any) => !r.assessment.risk)) return retain('card_has_safe_or_unknown_continuation', p.steps());
            bad.push(...continuations.map((r: any) => r.assessment));
        }
        const held = p.placements(p.view);
        // All possible normal placements must dominate: no unexecuted planned move is assumed.
        if (held?.length && held.every((r: any) => bad.every(b => dominates(r.assessment, b))))
            return { hold: true, reason: 'all_card_continuations_expose_public_reply_loss', witness: bad[0].witness, steps: p.steps() };
        return retain('no_safe_hold', p.steps());
    } catch (error) { return retain(String(error), readSteps()); }
}
