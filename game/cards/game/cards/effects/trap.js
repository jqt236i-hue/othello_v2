"use strict";
/**
 * @file trap.ts
 * @description Trap Will effects
 */
const SharedConstants = require('../../../shared-constants');
const { BLACK, WHITE, EMPTY } = SharedConstants || {};
const DEFAULT_TRAP_WILL_STEAL_MAX = 20;
function applyTrapWill(cardState, gameState, playerKey, row, col, deps) {
    const readCardPendingEffect = deps && deps.readCardPendingEffect;
    const getTrapTargets = deps && deps.getTrapTargets;
    const isAbsoluteProtectedCell = deps && deps.isAbsoluteProtectedCell;
    const removeMarkersAt = deps && deps.removeMarkersAt;
    const addMarker = deps && deps.addMarker;
    const clearCardPendingEffect = deps && deps.clearCardPendingEffect;
    const MARKER_KINDS = deps && deps.MARKER_KINDS;
    if (typeof readCardPendingEffect !== 'function' ||
        typeof getTrapTargets !== 'function' ||
        typeof removeMarkersAt !== 'function' ||
        typeof addMarker !== 'function' ||
        typeof clearCardPendingEffect !== 'function') {
        return { applied: false, reason: 'deps_missing' };
    }
    const pending = readCardPendingEffect(cardState, playerKey);
    if (!pending || pending.type !== 'TRAP_WILL' || pending.stage !== 'selectTarget') {
        return { applied: false, reason: 'not_pending' };
    }
    const targets = getTrapTargets(cardState, gameState, playerKey);
    const allowed = targets.some((t) => t.row === row && t.col === col);
    if (!allowed)
        return { applied: false, reason: 'invalid_target' };
    if (typeof isAbsoluteProtectedCell === 'function' && isAbsoluteProtectedCell(cardState, row, col)) {
        return { applied: false, reason: 'absolute_protected' };
    }
    removeMarkersAt(cardState, row, col, { kind: MARKER_KINDS ? MARKER_KINDS.SPECIAL_STONE : 'specialStone' });
    const opponentKey = playerKey === 'black' ? 'white' : 'black';
    addMarker(cardState, 'specialStone', row, col, playerKey, {
        type: 'TRAP',
        armedForPlayer: opponentKey,
        hidden: true
    });
    clearCardPendingEffect(cardState, playerKey);
    return { applied: true, row, col };
}
function processTrapEffects(cardState, gameState, activePlayerKey, options, deps) {
    const opts = options || {};
    const expireOnOwnerTurnStart = !!opts.expireOnOwnerTurnStart;
    const res = { triggered: [], expired: [], disarmed: [] };
    if (!cardState || !gameState || !gameState.board)
        return res;
    const getSpecialMarkers = deps && deps.getSpecialMarkers;
    const getCellValueForCard = deps && deps.getCellValueForCard;
    const setCellValueForCard = deps && deps.setCellValueForCard;
    const removeMarkersAt = deps && deps.removeMarkersAt;
    const setChargeValue = deps && deps.setChargeValue;
    const addChargeWithTotal = deps && deps.addChargeWithTotal;
    const clearHandToDiscard = deps && deps.clearHandToDiscard;
    const destroyAt = deps && deps.destroyAt;
    const emitPresentationEvent = deps && deps.emitPresentationEvent;
    const MARKER_KINDS = deps && deps.MARKER_KINDS;
    const TRAP_WILL_STEAL_MAX = deps && deps.TRAP_WILL_STEAL_MAX !== undefined ? deps.TRAP_WILL_STEAL_MAX : DEFAULT_TRAP_WILL_STEAL_MAX;
    const P_BLACK = (deps && deps.BLACK) || (BLACK || 1);
    const P_WHITE = (deps && deps.WHITE) || (WHITE || -1);
    const P_EMPTY = (deps && deps.EMPTY) || (EMPTY || 0);
    if (typeof getSpecialMarkers !== 'function' || typeof getCellValueForCard !== 'function') {
        return res;
    }
    const specials = getSpecialMarkers(cardState).filter((m) => m && m.data && m.data.type === 'TRAP');
    if (!specials.length)
        return res;
    for (const trap of specials) {
        const row = trap.row;
        const col = trap.col;
        const ownerKey = trap.owner === 'white' ? 'white' : 'black';
        const opponentKey = ownerKey === 'black' ? 'white' : 'black';
        const ownerVal = ownerKey === 'black' ? P_BLACK : P_WHITE;
        const activeVal = activePlayerKey === 'black' ? P_BLACK : P_WHITE;
        const cellVal = getCellValueForCard(gameState, row, col);
        if (cellVal === P_EMPTY) {
            if (typeof removeMarkersAt === 'function') {
                removeMarkersAt(cardState, row, col, { kind: MARKER_KINDS ? MARKER_KINDS.SPECIAL_STONE : 'specialStone', type: 'TRAP', owner: ownerKey });
            }
            res.disarmed.push({ row, col, owner: ownerKey, reason: 'empty' });
            continue;
        }
        if (cellVal === ownerVal) {
            if (expireOnOwnerTurnStart && activePlayerKey === ownerKey) {
                if (typeof emitPresentationEvent === 'function') {
                    emitPresentationEvent(cardState, {
                        type: 'STATUS_APPLIED',
                        row,
                        col,
                        meta: { special: 'TRAP_REVEAL', owner: ownerKey, reason: 'trap_expired_reveal' }
                    });
                }
                if (typeof destroyAt === 'function') {
                    destroyAt(cardState, gameState, row, col, 'TRAP_WILL', 'trap_expired', { special: 'TRAP_REVEAL', owner: ownerKey });
                }
                else if (typeof setCellValueForCard === 'function' && typeof removeMarkersAt === 'function') {
                    setCellValueForCard(gameState, row, col, P_EMPTY);
                    removeMarkersAt(cardState, row, col, { kind: MARKER_KINDS ? MARKER_KINDS.SPECIAL_STONE : 'specialStone', type: 'TRAP', owner: ownerKey });
                }
                res.expired.push({ row, col, owner: ownerKey });
            }
            continue;
        }
        if (activePlayerKey === opponentKey && cellVal === activeVal) {
            const victimKey = opponentKey;
            const charges = cardState.charge && typeof cardState.charge === 'object'
                ? cardState.charge
                : {};
            const victimCharge = Math.max(0, Number(charges[victimKey] || 0));
            const stolenCharge = Math.min(TRAP_WILL_STEAL_MAX, victimCharge);
            const remainingCharge = Math.max(0, victimCharge - stolenCharge);
            if (typeof setChargeValue === 'function') {
                setChargeValue(cardState, victimKey, remainingCharge, 'trap_stolen_charge');
            }
            const gainedCharge = typeof addChargeWithTotal === 'function'
                ? addChargeWithTotal(cardState, ownerKey, stolenCharge)
                : 0;
            const clearResult = typeof clearHandToDiscard === 'function'
                ? clearHandToDiscard(cardState, victimKey)
                : null;
            const destroyedCards = Array.isArray(clearResult && clearResult.destroyedCards)
                ? clearResult.destroyedCards
                : [];
            const destroyedCount = destroyedCards.length;
            if (typeof removeMarkersAt === 'function') {
                removeMarkersAt(cardState, row, col, { kind: MARKER_KINDS ? MARKER_KINDS.SPECIAL_STONE : 'specialStone', type: 'TRAP', owner: ownerKey });
            }
            res.triggered.push({
                row,
                col,
                owner: ownerKey,
                victim: victimKey,
                stolenCharge,
                gainedCharge,
                stolenHandCount: destroyedCount,
                destroyedHandCount: destroyedCount,
                destroyedCardIds: destroyedCards.slice(),
                toHandCount: 0,
                toDeckCount: 0
            });
            continue;
        }
        if (typeof removeMarkersAt === 'function') {
            removeMarkersAt(cardState, row, col, { kind: MARKER_KINDS ? MARKER_KINDS.SPECIAL_STONE : 'specialStone', type: 'TRAP', owner: ownerKey });
        }
        res.disarmed.push({ row, col, owner: ownerKey, reason: 'changed_without_trigger' });
    }
    return res;
}
module.exports = {
    applyTrapWill,
    processTrapEffects
};
