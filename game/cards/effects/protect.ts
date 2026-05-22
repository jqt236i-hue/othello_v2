/**
 * @file protect.ts
 * @description Protection effects: Strong Will, Absolute Protect, Guard Will
 */

import type { CardState, GameState, PlayerKey } from '../../../src/types';

const SharedConstants = require('../../../shared-constants');
const { BLACK, WHITE } = SharedConstants || {};

const DEFAULT_STRONG_WILL_PROMOTION_OWNER_TURNS = 10;
const DEFAULT_GUARD_WILL_TURNS = 3;
const DEFAULT_GUARDIAN_GOD_TURNS = 10;

function applyStrongWill(cardState: CardState, playerKey: PlayerKey, row: number, col: number, deps: any): Record<string, any> {
    const getSpecialMarkers = deps && deps.getSpecialMarkers;
    const addMarker = deps && deps.addMarker;
    if (typeof getSpecialMarkers !== 'function' || typeof addMarker !== 'function') {
        return { applied: false, reason: 'deps_missing' };
    }

    const existingMarker = getSpecialMarkers(cardState).find((marker: any) => (
        marker &&
        marker.row === row &&
        marker.col === col &&
        marker.data &&
        (marker.data.type === 'PERMA_PROTECTED' || marker.data.type === 'ABSOLUTE_PROTECTED')
    ));
    if (existingMarker && existingMarker.data && existingMarker.data.type === 'ABSOLUTE_PROTECTED') {
        return { applied: true, alreadyAbsolute: true };
    }

    const markerData: any = existingMarker && existingMarker.data ? { ...existingMarker.data } : {};
    markerData.type = 'PERMA_PROTECTED';
    markerData.strongWillPromotionOwnerTurnStarts = Number.isFinite(Number(markerData.strongWillPromotionOwnerTurnStarts))
        ? Math.max(0, Math.trunc(Number(markerData.strongWillPromotionOwnerTurnStarts)))
        : 0;
    markerData.strongWillPromotionThreshold = deps.STRONG_WILL_PROMOTION_OWNER_TURNS || DEFAULT_STRONG_WILL_PROMOTION_OWNER_TURNS;

    if (existingMarker) {
        existingMarker.owner = playerKey;
        existingMarker.data = markerData;
        return { applied: true };
    }

    addMarker(cardState, 'specialStone', row, col, playerKey, markerData);
    return { applied: true };
}

function applyAbsoluteProtect(cardState: CardState, playerKey: PlayerKey, row: number, col: number, deps: any): Record<string, any> {
    const getSpecialMarkers = deps && deps.getSpecialMarkers;
    const addMarker = deps && deps.addMarker;
    if (typeof getSpecialMarkers !== 'function' || typeof addMarker !== 'function') {
        return { applied: false, reason: 'deps_missing' };
    }

    const existingMarker = getSpecialMarkers(cardState).find((marker: any) => (
        marker &&
        marker.row === row &&
        marker.col === col &&
        marker.data &&
        (marker.data.type === 'ABSOLUTE_PROTECTED' || marker.data.type === 'PERMA_PROTECTED')
    ));
    if (existingMarker) {
        const markerData: any = existingMarker.data ? { ...existingMarker.data } : {};
        markerData.type = 'ABSOLUTE_PROTECTED';
        delete markerData.strongWillPromotionOwnerTurnStarts;
        delete markerData.strongWillPromotionThreshold;
        existingMarker.owner = playerKey;
        existingMarker.data = markerData;
    } else {
        addMarker(cardState, 'specialStone', row, col, playerKey, {
            type: 'ABSOLUTE_PROTECTED'
        });
    }
    return { applied: true };
}

function applyGuardWill(cardState: CardState, gameState: GameState, playerKey: PlayerKey, row: number, col: number, deps: any): Record<string, any> {
    const readCardPendingEffect = deps && deps.readCardPendingEffect;
    const getGuardTargets = deps && deps.getGuardTargets;
    const removeMarkersAt = deps && deps.removeMarkersAt;
    const addMarker = deps && deps.addMarker;
    const clearCardPendingEffect = deps && deps.clearCardPendingEffect;
    const MARKER_KINDS = deps && deps.MARKER_KINDS;

    if (
        typeof readCardPendingEffect !== 'function' ||
        typeof getGuardTargets !== 'function' ||
        typeof removeMarkersAt !== 'function' ||
        typeof addMarker !== 'function' ||
        typeof clearCardPendingEffect !== 'function'
    ) {
        return { applied: false, reason: 'deps_missing' };
    }

    const pending = readCardPendingEffect(cardState, playerKey);
    if (!pending || (pending.type !== 'GUARD_WILL' && pending.type !== 'GUARDIAN_GOD') || pending.stage !== 'selectTarget') {
        return { applied: false, reason: 'not_pending' };
    }
    const targets = getGuardTargets(cardState, gameState, playerKey);
    const allowed = targets.some((t: any) => t.row === row && t.col === col);
    if (!allowed) return { applied: false, reason: 'invalid_target' };

    const remainingOwnerTurns = pending.type === 'GUARDIAN_GOD'
        ? (deps.GUARDIAN_GOD_TURNS || DEFAULT_GUARDIAN_GOD_TURNS)
        : (deps.GUARD_WILL_TURNS || DEFAULT_GUARD_WILL_TURNS);

    removeMarkersAt(cardState, row, col, {
        kind: MARKER_KINDS ? MARKER_KINDS.SPECIAL_STONE : 'specialStone',
        type: 'GUARD',
        owner: playerKey
    });
    addMarker(cardState, 'specialStone', row, col, playerKey, {
        type: 'GUARD',
        remainingOwnerTurns
    });
    clearCardPendingEffect(cardState, playerKey);
    return { applied: true, row, col };
}

export = {
    applyStrongWill,
    applyAbsoluteProtect,
    applyGuardWill
};
