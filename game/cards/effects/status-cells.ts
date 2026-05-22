import type { CardState, GameState, PlayerKey } from '../../../src/types';

(function (root: any, factory: any) {
    if (typeof module === 'object' && module.exports) {
        module.exports = factory();
    } else {
        root.CardStatusCellsEffects = factory();
    }
}(typeof self !== 'undefined' ? self : this, function () {
    'use strict';

function applyStatusCellWill(cardState: CardState, gameState: GameState, playerKey: PlayerKey, row: number, col: number, config: any, deps: any): Record<string, any> {
    const readCardPendingEffect = deps && deps.readCardPendingEffect;
    const removeMarkersAt = deps && deps.removeMarkersAt;
    const addMarker = deps && deps.addMarker;
    const clearCardPendingEffect = deps && deps.clearCardPendingEffect;
    const MARKER_KINDS = deps && deps.MARKER_KINDS;
    const getTargets = config && config.getTargets;

    if (
        typeof readCardPendingEffect !== 'function' ||
        typeof getTargets !== 'function' ||
        typeof removeMarkersAt !== 'function' ||
        typeof addMarker !== 'function' ||
        typeof clearCardPendingEffect !== 'function'
    ) {
        return { applied: false, reason: 'deps_missing' };
    }

    const pending = readCardPendingEffect(cardState, playerKey);
    if (!pending || pending.type !== config.pendingType || pending.stage !== 'selectTarget') {
        return { applied: false, reason: 'not_pending' };
    }
    const targets = getTargets(cardState, gameState, playerKey);
    const allowed = targets.some((t: any) => t.row === row && t.col === col);
    if (!allowed) return { applied: false, reason: 'invalid_target' };

    removeMarkersAt(cardState, row, col, {
        kind: MARKER_KINDS ? MARKER_KINDS.SPECIAL_STONE : 'specialStone',
        type: config.markerType
    });
    addMarker(cardState, 'specialStone', row, col, playerKey, {
        type: config.markerType,
        remainingOwnerTurns: config.remainingOwnerTurns
    });

    clearCardPendingEffect(cardState, playerKey);
    return { applied: true, row, col };
}

function applyBlockadeWill(cardState: CardState, gameState: GameState, playerKey: PlayerKey, row: number, col: number, deps: any): Record<string, any> {
    return applyStatusCellWill(cardState, gameState, playerKey, row, col, {
        pendingType: 'BLOCKADE_WILL',
        markerType: 'BLOCKADE',
        remainingOwnerTurns: deps && deps.BLOCKADE_TURNS,
        getTargets: deps && deps.getBlockadeTargets
    }, deps);
}

function applyFreezeWill(cardState: CardState, gameState: GameState, playerKey: PlayerKey, row: number, col: number, deps: any): Record<string, any> {
    return applyStatusCellWill(cardState, gameState, playerKey, row, col, {
        pendingType: 'FREEZE_WILL',
        markerType: 'FREEZE',
        remainingOwnerTurns: deps && deps.FREEZE_TURNS,
        getTargets: deps && deps.getFreezeTargets
    }, deps);
}

function applySeedWill(cardState: CardState, gameState: GameState, playerKey: PlayerKey, row: number, col: number, deps: any): Record<string, any> {
    return applyStatusCellWill(cardState, gameState, playerKey, row, col, {
        pendingType: 'SEED_WILL',
        markerType: 'SEED',
        remainingOwnerTurns: deps && deps.SEED_WILL_TURNS,
        getTargets: deps && deps.getSeedTargets
    }, deps);
}

    return {
        applyBlockadeWill,
        applyFreezeWill,
        applySeedWill
    };
}));
