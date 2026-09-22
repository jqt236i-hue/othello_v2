import Board = require('../shared-board-utils');
import { getBattleRuntimeCardDefinitions } from './content-version';
import Registry = require('../special-stone-registry-static');
import type { CompleteBattlePosition } from './types';

const MAX = Number.MAX_SAFE_INTEGER;
export const BATTLE_MARKER_TYPES = Object.freeze(Object.keys(Registry.STONE_EFFECT_RULES));
export const BATTLE_EFFECT_TYPES = Object.freeze([...new Set<string>(getBattleRuntimeCardDefinitions().map((card: any) => card.type))]);
export const BATTLE_PENDING_REQUIRED_FIELDS = Object.freeze({
    '*': ['type', 'cardId', 'stage'],
    BOARD_EXPANSION_GOD: ['selectedTargets', 'selectedCount', 'maxSelections'],
    BOARD_SHRINK_WILL: ['selectedTargets', 'selectedCount', 'maxSelections'],
    LAST_RESORT: ['placementsRemaining'], HEAVEN_BLESSING: ['offers'], OBSERVER_WILL: ['offers'], CONDEMN_WILL: ['offers']
});
const effectTypes = new Set(BATTLE_EFFECT_TYPES), markerTypes = new Set(BATTLE_MARKER_TYPES);
const cardsById = new Map<string, any>(getBattleRuntimeCardDefinitions().map((card: any) => [card.id, card]));
function fail(name: string): never { throw new Error(`Invalid saved ${name}`); }
function record(value: any, name: string): void {
    if (!value || typeof value !== 'object' || Array.isArray(value)) fail(name);
}
function integer(value: any, min: number, max: number, name: string): void {
    if (!Number.isSafeInteger(value) || value < min || value > max) fail(name);
}
function player(value: any, nullable: boolean, name: string): void {
    if (value !== 'black' && value !== 'white' && !(nullable && value === null)) fail(name);
}
function coordinate(value: any, name: string): void {
    record(value, name);
    integer(value.row, -256, 256, `${name}.row`); integer(value.col, -256, 256, `${name}.col`);
}
function cellKey(key: string, name: string): { row: number; col: number } {
    if (!/^-?(0|[1-9][0-9]*),-?(0|[1-9][0-9]*)$/.test(key)) fail(name);
    const [row, col] = key.split(',').map(Number);
    coordinate({ row, col }, name);
    if (`${row},${col}` !== key) fail(name);
    return { row, col };
}
function optionalCounters(value: any, keys: readonly string[], name: string): void {
    for (const key of keys) if (value[key] !== undefined) integer(value[key], 0, MAX, `${name}.${key}`);
}
export function validateSavedPending(pending: any): void {
    if (pending === null) return;
    record(pending, 'pending');
    if (!effectTypes.has(pending.type) || ![null, 'selectTarget'].includes(pending.stage)) fail('pending effect/stage');
    if (cardsById.get(pending.cardId)?.type !== pending.type) fail('pending card reference');
    if (pending.pendingEffectId !== undefined && (typeof pending.pendingEffectId !== 'string' || !pending.pendingEffectId || pending.pendingEffectId.length > 256)) fail('pending identity');
    optionalCounters(pending, ['sourceHandIndex', 'selectedCount', 'maxSelections', 'placementsRemaining'], 'pending');
    if (pending.type === 'BOARD_EXPANSION_GOD' || pending.type === 'BOARD_SHRINK_WILL') {
        if (!Array.isArray(pending.selectedTargets)) fail('pending selection progress');
        // Expansion asks for one choice if only one socket remains (pending-stage source).
        integer(pending.maxSelections, pending.type === 'BOARD_EXPANSION_GOD' ? 1 : 3,
            pending.type === 'BOARD_EXPANSION_GOD' ? 2 : 3, 'pending maximum selections');
        integer(pending.selectedCount, 0, pending.maxSelections - 1, 'pending selected count');
        if (pending.stage !== 'selectTarget') fail('pending selection stage');
    }
    if (pending.type === 'LAST_RESORT') integer(pending.placementsRemaining, 1, 3, 'pending remaining placements');
    if (['HEAVEN_BLESSING', 'OBSERVER_WILL', 'CONDEMN_WILL'].includes(pending.type)
        && (!Array.isArray(pending.offers) || !pending.offers.length || pending.stage !== 'selectTarget')) fail('pending offers');
    if (pending.firstTarget !== undefined && pending.firstTarget !== null) coordinate(pending.firstTarget, 'pending.firstTarget');
    if (pending.selectedTargets !== undefined) {
        if (!Array.isArray(pending.selectedTargets)) fail('pending targets');
        pending.selectedTargets.forEach((target: any) => coordinate(target, 'pending target'));
        if (pending.selectedCount !== pending.selectedTargets.length || pending.selectedCount > pending.maxSelections) fail('pending count');
        if (new Set(pending.selectedTargets.map((target: any) => `${target.row},${target.col}`)).size !== pending.selectedTargets.length) fail('duplicate pending target');
    }
    if (pending.offers !== undefined) {
        if (!Array.isArray(pending.offers)) fail('pending offers');
        for (const offer of pending.offers) {
            if (pending.type === 'OBSERVER_WILL' || pending.type === 'CONDEMN_WILL') {
                record(offer, 'pending hand offer'); integer(offer.handIndex, 0, 16383, 'pending hand index');
                if (!cardsById.has(offer.cardId)) fail('pending offered card');
                if (pending.type === 'OBSERVER_WILL') integer(offer.cardCopyId, 1, MAX, 'pending offered copy');
            } else if (!cardsById.has(offer)) fail('pending offers');
        }
    }
}

/** Structural invariants at a committed boundary. This does not invent gameplay
 * normalization: malformed input is rejected before the runtime can repair it. */
export function validateSavedRuleState(position: CompleteBattlePosition, stoneIds: Set<string>, copies: Set<number>): void {
    const gs = position.gameState, cs = position.cardState;
    integer(gs.roundNumber, 1, MAX, 'round number');
    record(gs.roundCompletionByPlayer, 'round completion');
    for (const owner of ['black', 'white']) if (typeof gs.roundCompletionByPlayer[owner] !== 'boolean') fail('round completion');
    if (gs.pendingRoundBonus !== null) {
        record(gs.pendingRoundBonus, 'round bonus');
        integer(gs.pendingRoundBonus.roundNumber, 1, gs.roundNumber, 'round bonus round');
        integer(gs.pendingRoundBonus.amount, 1, MAX, 'round bonus amount');
    }
    for (const field of ['_nextChargeDeltaSeq', '_nextObserverWillRepaymentSeq', '_nextTheoryIncarnationSeq']) integer(cs[field], 1, MAX, field);
    for (const field of ['hyperactiveSeqCounter', 'initialDeckSize']) integer(cs[field], 0, MAX, field);
    if (typeof cs.reshuffleRequiresFullCycle !== 'boolean') fail('reshuffle flag');
    if (cs.selectedCardId !== null && !cardsById.has(cs.selectedCardId)) fail('selected card');
    if (cs.selectedCardOwnerKey !== undefined) player(cs.selectedCardOwnerKey, true, 'selected card owner');
    const inspection = Board.inspectBoardState(gs, cs, { strict: true });
    if (!inspection.ok) fail(`board topology: ${inspection.errors.join('; ')}`);
    const view = Board.createBoardView(gs, { cardState: cs, strict: true });
    for (const entry of inspection.expansionCells) {
        const key = `${entry.row},${entry.col}`, id = cs.expansionStoneIdByCell[key];
        if (entry.owner === 0) { if (id !== undefined && id !== null) fail('stale expansion stone identity'); continue; }
        if (typeof id !== 'string' || !/^s[1-9][0-9]*$/.test(id) || stoneIds.has(id)) fail('expansion stone identity');
        stoneIds.add(id);
    }
    for (const key of Object.keys(cs.expansionStoneIdByCell)) {
        const cell = cellKey(key, 'expansion identity cell');
        if (!inspection.expansionCells.some((entry: any) => entry.row === cell.row && entry.col === cell.col && entry.owner !== 0)) fail('stale expansion stone identity');
    }
    integer(cs._nextStoneId, 1, MAX, 'stone sequence');
    for (const id of stoneIds) integer(Number(id.slice(1)), 1, cs._nextStoneId - 1, 'stone sequence reference');
    integer(cs._nextMarkerId, 1, MAX, 'marker sequence'); integer(cs._nextCreatedSeq, 1, MAX, 'creation sequence');
    const markerIds = new Set<number>(), created = new Set<number>();
    for (const marker of cs.markers) {
        record(marker, 'marker'); record(marker.data, 'marker data'); coordinate(marker, 'marker');
        if (!['specialStone', 'manifestStone'].includes(marker.kind) || !markerTypes.has(marker.data.type)) fail('marker kind/type');
        player(marker.owner, true, 'marker owner');
        integer(marker.id, 1, cs._nextMarkerId - 1, 'marker identity');
        integer(marker.createdSeq, 1, cs._nextCreatedSeq - 1, 'marker creation sequence');
        if (marker.markerId !== String(marker.id) || markerIds.has(marker.id) || created.has(marker.createdSeq)) fail('duplicate marker identity');
        markerIds.add(marker.id); created.add(marker.createdSeq);
        const subject = Registry.getMarkerSubjectKind(marker.data.type, marker.data);
        if (!view.has(marker.row, marker.col) && marker.data.type !== 'METEOR_HOLE') fail('marker cell');
        if ((subject === 'stone_body' || subject === 'stone_status') && !view.get(marker.row, marker.col)) fail('marker without stone');
        if (marker.data.category !== undefined && marker.data.category !== 'bomb') fail('marker category');
        if (marker.data.category === 'bomb' && marker.data.type !== 'TIME_BOMB') fail('bomb marker type');
        optionalCounters(marker.data, ['remainingOwnerTurns', 'remainingTurns', 'regenRemaining', 'flipEvadeRemaining', 'destroyEvadeRemaining', 'placedTurn', 'hyperactiveSeq', 'chainPriority'], 'marker');
        if (marker.data.expiresForPlayer !== undefined) player(marker.data.expiresForPlayer, false, 'marker expiration player');
        if (marker.data.stoneId !== undefined && !stoneIds.has(marker.data.stoneId)) fail('marker stone reference');
    }
    for (const owner of ['black', 'white']) {
        for (const field of ['turnCountByPlayer', 'extraPlaceRemainingByPlayer', 'timeStopConsecutiveTurnsRemainingByPlayer',
            'cardUseCountByPlayer', 'totalFlipCountByPlayer', 'cornerCaptureCountByPlayer', 'chargeGainedTotal', 'numberCellCollectedTotalByPlayer', 'initialDeckSizeByPlayer']) {
            integer(cs[field]?.[owner], 0, MAX, `${field}.${owner}`);
        }
        integer(cs.chargeGainMultiplierByPlayer[owner], 1, 100, 'charge multiplier');
        for (const field of ['hasUsedCardThisTurnByPlayer', 'hasDestroyedCardThisTurnByPlayer', 'infinitePlaceActiveByPlayer', 'workNextPlacementArmedByPlayer']) {
            if (typeof cs[field]?.[owner] !== 'boolean') fail(`${field}.${owner}`);
        }
        player(cs.fateWillControllerByTurnOwner[owner], true, 'fate controller');
        if (cs.lastUsedCardByPlayer[owner] !== null && !cardsById.has(cs.lastUsedCardByPlayer[owner])) fail('last-used card');
        validateSavedPending(cs.pendingEffectByPlayer[owner]);
        const pending = cs.pendingEffectByPlayer[owner];
        if (pending && ['OBSERVER_WILL', 'CONDEMN_WILL'].includes(pending.type)) {
            const opponent = owner === 'black' ? 'white' : 'black';
            for (const offer of pending.offers || []) {
                if (cs.hands[opponent][offer.handIndex] !== offer.cardId || (pending.type === 'OBSERVER_WILL'
                    && cs._handCopyIdsByPlayer[opponent][offer.handIndex] !== offer.cardCopyId)) fail('pending offered hand reference');
            }
        }
        if (!Array.isArray(cs.activeEffectsByPlayer[owner])) fail('active effects');
        for (const effect of cs.activeEffectsByPlayer[owner]) {
            record(effect, 'active effect'); if (!effectTypes.has(effect.type)) fail('active effect type');
            optionalCounters(effect, ['remainingOwnerTurns', 'remainingTurns'], 'active effect');
        }
        for (const field of ['riboRepaymentsByPlayer', 'observerWillRepaymentsByPlayer']) {
            if (!Array.isArray(cs[field][owner])) fail(field);
            for (const repayment of cs[field][owner]) {
                record(repayment, 'repayment');
                for (const key of ['remainingOwnerTurns', 'repaymentAmount', 'shortageDestroyCount']) integer(repayment[key], 0, MAX, `repayment.${key}`);
            }
        }
        const revealed = cs._revealedHandCopyIdsByViewer?.[owner];
        if (!Array.isArray(revealed) || revealed.some((id: any) => !copies.has(id))) fail('revealed card reference');
    }
    for (const field of ['lastTurnStartedFor', '_activeTurnPlayer']) player(cs[field], true, field);
    for (const field of ['cardCostOverridesByCopyId', 'cardCostModifiersByCopyId']) {
        for (const [key, value] of Object.entries(cs[field])) {
            if (!/^[1-9][0-9]*$/.test(key) || !copies.has(Number(key))) fail('card cost identity reference');
            const entries: any[] = field === 'cardCostModifiersByCopyId' ? value as any[] : [value];
            if (!Array.isArray(entries)) fail('card cost modifiers');
            for (const entry of entries) {
                record(entry, 'card cost entry');
                integer(entry[field === 'cardCostModifiersByCopyId' ? 'delta' : 'cost'], field === 'cardCostModifiersByCopyId' ? -MAX : 0, MAX, 'card cost');
                if (entry.sourceType !== null && !effectTypes.has(entry.sourceType)) fail('card cost source');
            }
        }
    }
    // Theory incarnation replaces number cells with sampled card costs, including 0 and costs above 10.
    for (const [key, value] of Object.entries(cs.boardBonusByCell)) { cellKey(key, 'bonus cell'); integer(value, 0, MAX, 'board bonus'); }
    for (const [key, value] of Object.entries(cs.boardBonusConsumedByCell)) { cellKey(key, 'consumed bonus cell'); if (value !== true) fail('consumed bonus'); }
}
