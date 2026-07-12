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

    const result = applyStatusCellMarker(cardState, playerKey, row, col, config, deps);
    if (!result.applied) return result;

    clearCardPendingEffect(cardState, playerKey);
    return result;
}

function applyStatusCellMarker(cardState: CardState, playerKey: PlayerKey, row: number, col: number, config: any, deps: any): Record<string, any> {
    const removeMarkersAt = deps && deps.removeMarkersAt;
    const addMarker = deps && deps.addMarker;
    const emitPresentationEvent = deps && deps.emitPresentationEvent;
    const MARKER_KINDS = deps && deps.MARKER_KINDS;

    if (typeof removeMarkersAt !== 'function' || typeof addMarker !== 'function') {
        return { applied: false, reason: 'deps_missing' };
    }
    if (!Number.isInteger(row) || !Number.isInteger(col)) {
        return { applied: false, reason: 'invalid_target' };
    }

    removeMarkersAt(cardState, row, col, {
        kind: MARKER_KINDS ? MARKER_KINDS.SPECIAL_STONE : 'specialStone',
        type: config.markerType
    });
    addMarker(cardState, 'specialStone', row, col, playerKey, {
        type: config.markerType,
        remainingOwnerTurns: config.remainingOwnerTurns
    });
    if (typeof emitPresentationEvent === 'function') {
        emitPresentationEvent(cardState, {
            type: 'STATUS_APPLIED',
            row,
            col,
            meta: {
                special: config.markerType,
                owner: playerKey,
                timer: config.remainingOwnerTurns,
                reason: config.reason
            }
        });
    }
    return { applied: true, row, col };
}

function applyBlockadeWill(cardState: CardState, gameState: GameState, playerKey: PlayerKey, row: number, col: number, deps: any): Record<string, any> {
    return applyStatusCellWill(cardState, gameState, playerKey, row, col, {
        pendingType: 'BLOCKADE_WILL',
        markerType: 'BLOCKADE',
        reason: 'blockade_selected',
        remainingOwnerTurns: deps && deps.BLOCKADE_TURNS,
        getTargets: deps && deps.getBlockadeTargets
    }, deps);
}

function applyFreezeWill(cardState: CardState, gameState: GameState, playerKey: PlayerKey, row: number, col: number, deps: any): Record<string, any> {
    return applyStatusCellWill(cardState, gameState, playerKey, row, col, {
        pendingType: 'FREEZE_WILL',
        markerType: 'FREEZE',
        reason: 'freeze_selected',
        remainingOwnerTurns: deps && deps.FREEZE_TURNS,
        getTargets: deps && deps.getFreezeTargets
    }, deps);
}

function applyMassFreezeWill(cardState: CardState, gameState: GameState, playerKey: PlayerKey, deps: any): Record<string, any> {
    const readCardPendingEffect = deps && deps.readCardPendingEffect;
    const clearCardPendingEffect = deps && deps.clearCardPendingEffect;
    const collectTargets = deps && deps.collectMassFreezeWillTargets;
    const removeMarkersAt = deps && deps.removeMarkersAt;
    const addMarker = deps && deps.addMarker;
    if (
        typeof readCardPendingEffect !== 'function' ||
        typeof clearCardPendingEffect !== 'function' ||
        typeof collectTargets !== 'function' ||
        typeof removeMarkersAt !== 'function' ||
        typeof addMarker !== 'function'
    ) {
        return { applied: false, reason: 'deps_missing', frozenCount: 0, targets: [] };
    }

    const pending = readCardPendingEffect(cardState, playerKey);
    if (!pending || pending.type !== 'MASS_FREEZE_WILL') {
        return { applied: false, reason: 'not_pending', frozenCount: 0, targets: [] };
    }

    const targets = collectTargets(cardState, gameState, playerKey, { includeHiddenOpponentTraps: true });
    if (!Array.isArray(targets) || targets.length === 0) {
        return { applied: false, reason: 'no_targets', frozenCount: 0, targets: [] };
    }
    const seen = new Set<string>();
    const normalizedTargets: Array<{ row: number; col: number }> = [];
    for (const target of targets) {
        const row = target && target.row;
        const col = target && target.col;
        if (!Number.isInteger(row) || !Number.isInteger(col)) {
            return { applied: false, reason: 'invalid_target', frozenCount: 0, targets: [] };
        }
        const key = `${row},${col}`;
        if (seen.has(key)) continue;
        seen.add(key);
        normalizedTargets.push({ row, col });
    }
    if (normalizedTargets.length === 0) {
        return { applied: false, reason: 'no_targets', frozenCount: 0, targets: [] };
    }

    for (const target of normalizedTargets) {
        const result = applyStatusCellMarker(cardState, playerKey, target.row, target.col, {
            markerType: 'FREEZE',
            reason: 'mass_freeze_will',
            remainingOwnerTurns: deps && deps.FREEZE_TURNS
        }, deps);
        if (!result.applied) {
            throw new Error(`MASS_FREEZE_WILL marker apply failed at ${target.row},${target.col}: ${result.reason || 'unknown'}`);
        }
    }

    clearCardPendingEffect(cardState, playerKey);
    return {
        applied: true,
        frozenCount: normalizedTargets.length,
        targets: normalizedTargets
    };
}

function applySeedWill(cardState: CardState, gameState: GameState, playerKey: PlayerKey, row: number, col: number, deps: any): Record<string, any> {
    return applyStatusCellWill(cardState, gameState, playerKey, row, col, {
        pendingType: 'SEED_WILL',
        markerType: 'SEED',
        reason: 'seed_selected',
        remainingOwnerTurns: deps && deps.SEED_WILL_TURNS,
        getTargets: deps && deps.getSeedTargets
    }, deps);
}

function markerType(marker: any): string {
    return String(marker && marker.data && marker.data.type || '').trim().toUpperCase();
}

function syncPoisonContacts(cardState: CardState, gameState: GameState, appliedTurnNumber: number, deps: any): Record<string, any> {
    const getMarkers = deps && deps.getMarkers;
    const addMarker = deps && deps.addMarker;
    const removeMarkerById = deps && deps.removeMarkerById;
    const getCellValueForCard = deps && deps.getCellValueForCard;
    const isInviolableCell = deps && deps.isInviolableCell;
    const emitPresentationEvent = deps && deps.emitPresentationEvent;
    const empty = deps && deps.EMPTY;
    if (typeof getMarkers !== 'function' || typeof addMarker !== 'function' || typeof getCellValueForCard !== 'function') {
        return { applied: 0, removed: 0 };
    }
    const markers = getMarkers(cardState).slice();
    const poisonCells = markers.filter((marker: any) => markerType(marker) === 'POISON_CELL');
    const poisoned = markers.filter((marker: any) => markerType(marker) === 'POISONED');
    let applied = 0;
    let removed = 0;

    for (const status of poisoned) {
        const occupied = getCellValueForCard(gameState, status.row, status.col) !== empty;
        const guarded = markers.some((marker: any) => marker.row === status.row && marker.col === status.col && markerType(marker) === 'GUARD');
        const inviolable = typeof isInviolableCell === 'function' && isInviolableCell(cardState, status.row, status.col);
        if (occupied && !guarded && !inviolable) continue;
        if (typeof removeMarkerById === 'function' && removeMarkerById(cardState, status.id)) {
            removed += 1;
            if (typeof emitPresentationEvent === 'function') emitPresentationEvent(cardState, {
                type: 'STATUS_REMOVED', row: status.row, col: status.col,
                meta: { special: 'POISONED', reason: guarded ? 'full_guard' : (inviolable ? 'inviolable' : 'stone_absent') }
            });
        }
    }

    for (const cell of poisonCells) {
        const value = getCellValueForCard(gameState, cell.row, cell.col);
        if (value === empty) continue;
        const currentMarkers = getMarkers(cardState);
        const guarded = currentMarkers.some((marker: any) => marker.row === cell.row && marker.col === cell.col && markerType(marker) === 'GUARD');
        const inviolable = typeof isInviolableCell === 'function' && isInviolableCell(cardState, cell.row, cell.col);
        const exists = currentMarkers.some((marker: any) => marker.row === cell.row && marker.col === cell.col && markerType(marker) === 'POISONED');
        if (guarded || inviolable || exists) continue;
        const owner = value === deps.BLACK ? 'black' : 'white';
        addMarker(cardState, 'specialStone', cell.row, cell.col, owner, {
            type: 'POISONED',
            remainingTurns: deps.POISON_STONE_TURNS,
            appliedTurnNumber
        });
        applied += 1;
    }
    return { applied, removed };
}

function applyPoisonWill(cardState: CardState, gameState: GameState, playerKey: PlayerKey, row: number, col: number, deps: any): Record<string, any> {
    const pending = deps.readCardPendingEffect(cardState, playerKey);
    if (!pending || pending.type !== 'POISON_WILL' || pending.stage !== 'selectTarget') return { applied: false, reason: 'not_pending' };
    const targets = deps.getPoisonTargets(cardState, gameState, playerKey);
    if (!targets.some((target: any) => target.row === row && target.col === col)) return { applied: false, reason: 'invalid_target' };
    deps.addMarker(cardState, 'specialStone', row, col, playerKey, {
        type: 'POISON_CELL',
        remainingTurns: deps.POISON_CELL_TURNS,
        appliedTurnNumber: Number(gameState && (gameState as any).turnNumber || 0)
    });
    deps.clearCardPendingEffect(cardState, playerKey);
    syncPoisonContacts(cardState, gameState, Number(gameState && (gameState as any).turnNumber || 0), deps);
    return { applied: true, row, col };
}

function processPoisonTurnEnd(cardState: CardState, gameState: GameState, completedTurnNumber: number, deps: any): Record<string, any> {
    const getMarkers = deps && deps.getMarkers;
    const removeMarkerById = deps && deps.removeMarkerById;
    const emitPresentationEvent = deps && deps.emitPresentationEvent;
    if (typeof getMarkers !== 'function' || typeof removeMarkerById !== 'function') return { processed: false };
    syncPoisonContacts(cardState, gameState, completedTurnNumber, deps);
    let lethalCount = 0;
    let expiredCellCount = 0;
    const statuses = getMarkers(cardState).filter((marker: any) => markerType(marker) === 'POISONED').slice().sort((left: any, right: any) => (
        (Number(left.createdSeq) || 0) - (Number(right.createdSeq) || 0) ||
        (Number(left.row) || 0) - (Number(right.row) || 0) ||
        (Number(left.col) || 0) - (Number(right.col) || 0) ||
        (Number(left.id) || 0) - (Number(right.id) || 0)
    ));
    for (const marker of statuses) {
        if (Number(marker.data.appliedTurnNumber) === Number(completedTurnNumber)) continue;
        marker.data.remainingTurns = Math.max(0, Number(marker.data.remainingTurns || 0) - 1);
        if (marker.data.remainingTurns > 0) {
            if (typeof emitPresentationEvent === 'function') emitPresentationEvent(cardState, {
                type: 'STATUS_TICK', row: marker.row, col: marker.col,
                meta: { special: 'POISONED', timer: marker.data.remainingTurns, reason: 'poison_tick' }
            });
            continue;
        }
        lethalCount += 1;
        if (typeof deps.destroyAt === 'function') {
            deps.destroyAt(cardState, gameState, marker.row, marker.col, 'POISON_WILL', 'poison_lethal', { poison: true });
        }
        removeMarkerById(cardState, marker.id);
        if (typeof emitPresentationEvent === 'function') emitPresentationEvent(cardState, {
            type: 'STATUS_REMOVED', row: marker.row, col: marker.col,
            meta: { special: 'POISONED', timer: 0, reason: 'poison_resolved' }
        });
    }
    syncPoisonContacts(cardState, gameState, completedTurnNumber, deps);
    const cells = getMarkers(cardState).filter((marker: any) => markerType(marker) === 'POISON_CELL').slice();
    for (const marker of cells) {
        if (Number(marker.data.appliedTurnNumber) === Number(completedTurnNumber)) continue;
        marker.data.remainingTurns = Math.max(0, Number(marker.data.remainingTurns || 0) - 1);
        if (marker.data.remainingTurns > 0) {
            if (typeof emitPresentationEvent === 'function') emitPresentationEvent(cardState, {
                type: 'STATUS_TICK', row: marker.row, col: marker.col,
                meta: { special: 'POISON_CELL', timer: marker.data.remainingTurns, reason: 'poison_cell_tick' }
            });
            continue;
        }
        if (removeMarkerById(cardState, marker.id)) expiredCellCount += 1;
        if (typeof emitPresentationEvent === 'function') emitPresentationEvent(cardState, {
            type: 'STATUS_REMOVED', row: marker.row, col: marker.col,
            meta: { special: 'POISON_CELL', timer: 0, reason: 'duration_end' }
        });
    }
    return { processed: true, lethalCount, expiredCellCount };
}

    return {
        applyStatusCellMarker,
        applyBlockadeWill,
        applyFreezeWill,
        applyMassFreezeWill,
        applySeedWill,
        applyPoisonWill,
        syncPoisonContacts,
        processPoisonTurnEnd
    };
}));
