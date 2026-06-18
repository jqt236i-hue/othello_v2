/**
 * @file theory-incarnation.ts
 * @description Theory Incarnation card and manifestation stone resolution.
 */

import type { CardState, GameState, PlayerKey } from '../../../src/types';

const THEORY_MARKER_TYPE = 'THEORY_INCARNATION';
const THEORY_DURATION_OWNER_TURNS = 5;
const TheoryIncarnationState = require('./theory-incarnation-state');
const TheoryIncarnationSpawn = require('./theory-incarnation-spawn');

const {
    ownerKeyOf,
    cellKeyOf,
    ensureTheoryState,
    addNumberCellCollectedTotal,
    restoreTheoryNumberCells
} = TheoryIncarnationState;

function canUseTheoryIncarnation(cardState: CardState, playerKey: PlayerKey): boolean {
    ensureTheoryState(cardState as any);
    const ownerKey = ownerKeyOf(playerKey);
    return Number((cardState as any).numberCellCollectedTotalByPlayer[ownerKey] || 0) >= 42;
}

function isBlockedForTheory(cardState: any, gameState: GameState, row: number, col: number, deps: any): boolean {
    if (deps && typeof deps.isBlockedCell === 'function') {
        return deps.isBlockedCell(cardState, row, col, gameState) === true;
    }
    return false;
}

function getBoardCells(cardState: CardState, gameState: GameState, deps: any): Array<{ row: number; col: number }> {
    const board = gameState && Array.isArray((gameState as any).board) ? (gameState as any).board : [];
    const cells: Array<{ row: number; col: number }> = [];
    for (let row = 0; row < board.length; row += 1) {
        const line = Array.isArray(board[row]) ? board[row] : [];
        for (let col = 0; col < line.length; col += 1) {
            const value = typeof deps.getCellValueForCard === 'function'
                ? deps.getCellValueForCard(gameState, row, col)
                : line[col];
            if (!(value === deps.EMPTY || value === 0)) continue;
            if (isBlockedForTheory(cardState, gameState, row, col, deps)) continue;
            cells.push({ row, col });
        }
    }
    return cells;
}

function pickSpawnEntry(spawnTable: any[], prng: any): any | null {
    if (!Array.isArray(spawnTable) || spawnTable.length <= 0) return null;
    const source = prng && typeof prng.random === 'function' ? prng : null;
    let value = source ? Number(source.random()) : 0;
    if (!Number.isFinite(value)) value = 0;
    if (value < 0) value = 0;
    if (value >= 1) value = 0.999999;
    const index = Math.max(0, Math.min(spawnTable.length - 1, Math.floor(value * spawnTable.length)));
    return spawnTable[index] || null;
}

function buildSpawnTable(deps: any, ownerKey?: PlayerKey): any[] {
    const factory = deps && deps.SpecialStoneMarkerFactory;
    const cardDefs = deps && deps.CARD_DEFS;
    if (!factory || typeof factory.buildTheoryIncarnationSpawnTable !== 'function') return [];
    return factory.buildTheoryIncarnationSpawnTable(cardDefs, { ...deps, ownerKey });
}

function applyTheoryIncarnationUsage(cardState: CardState, gameState: GameState, playerKey: PlayerKey, prng: any, deps: any): Record<string, any> {
    const ownerKey = ownerKeyOf(playerKey);
    ensureTheoryState(cardState as any);
    if (!canUseTheoryIncarnation(cardState, ownerKey)) {
        return { applied: false, reason: 'not_enough_number_cell_total' };
    }
    const spawnTable = buildSpawnTable(deps, ownerKey);
    if (spawnTable.length <= 0) {
        return { applied: false, reason: 'no_spawn_candidates' };
    }
    const sessionSeq = Math.max(1, Math.floor(Number((cardState as any)._nextTheoryIncarnationSeq || 1)));
    (cardState as any)._nextTheoryIncarnationSeq = sessionSeq + 1;
    const sessionId = `theory_${ownerKey}_${sessionSeq}`;
    const boardBonus = ((cardState as any).boardBonusByCell && typeof (cardState as any).boardBonusByCell === 'object')
        ? (cardState as any).boardBonusByCell
        : ((cardState as any).boardBonusByCell = {});
    const consumed = ((cardState as any).boardBonusConsumedByCell && typeof (cardState as any).boardBonusConsumedByCell === 'object')
        ? (cardState as any).boardBonusConsumedByCell
        : ((cardState as any).boardBonusConsumedByCell = {});
    const session: any = { ownerKey, cells: {} };
    let rewrittenCount = 0;

    for (const cell of getBoardCells(cardState, gameState, deps)) {
        const key = cellKeyOf(cell.row, cell.col);
        const entry = pickSpawnEntry(spawnTable, prng);
        if (!entry) continue;
        session.cells[key] = {
            row: cell.row,
            col: cell.col,
            value: entry.cardCost,
            originalValue: Number(boardBonus[key] || 0),
            originalConsumed: consumed[key] === true,
            spawnType: entry.markerData.type,
            sourceCardId: entry.cardId,
            sourceCardType: entry.cardType,
            sourceCardCost: entry.cardCost,
            markerData: { ...entry.markerData }
        };
        boardBonus[key] = entry.cardCost;
        delete consumed[key];
        (cardState as any).theoryNumberCellByCell[key] = { sessionId, ownerKey };
        rewrittenCount += 1;
    }

    (cardState as any).theoryNumberCellsBySession[sessionId] = session;
    (cardState as any).theoryIncarnationStateByPlayer[ownerKey] = {
        sessionId,
        ownerKey,
        remainingSpawnCount: THEORY_DURATION_OWNER_TURNS,
        createdTurnIndex: Number((cardState as any).turnIndex || 0)
    };
    (cardState as any).nextTheoryIncarnationStoneByPlayer[ownerKey] = {
        sourceType: THEORY_MARKER_TYPE,
        sessionId
    };
    return { applied: true, sessionId, rewrittenCount };
}

function applyTheoryIncarnationStoneReservation(cardState: CardState, playerKey: PlayerKey, row: number, col: number, deps: any): Record<string, any> {
    const ownerKey = ownerKeyOf(playerKey);
    ensureTheoryState(cardState as any);
    const reservation = (cardState as any).nextTheoryIncarnationStoneByPlayer[ownerKey];
    if (!reservation || reservation.sourceType !== THEORY_MARKER_TYPE) {
        return { applied: false, reason: 'not_armed' };
    }
    const markerKinds = deps && deps.MARKER_KINDS;
    const manifestKind = markerKinds && markerKinds.MANIFEST_STONE ? markerKinds.MANIFEST_STONE : 'manifestStone';
    const registry = deps && deps.ManifestStoneRegistry;
    const markerData = registry && typeof registry.createManifestStoneMarkerData === 'function'
        ? registry.createManifestStoneMarkerData(THEORY_MARKER_TYPE, {
            sessionId: reservation.sessionId || null
        })
        : {
            type: THEORY_MARKER_TYPE,
            remainingOwnerTurns: THEORY_DURATION_OWNER_TURNS,
            absoluteProtected: true,
            sourceType: THEORY_MARKER_TYPE,
            sessionId: reservation.sessionId || null,
            visualEffectKey: 'theoryIncarnationStone'
        };
    const marker = deps.addMarker(cardState, manifestKind, row, col, ownerKey, markerData);
    const state = (cardState as any).theoryIncarnationStateByPlayer[ownerKey];
    if (state && typeof state === 'object') {
        state.markerId = marker && marker.id ? marker.id : null;
    }
    (cardState as any).nextTheoryIncarnationStoneByPlayer[ownerKey] = null;
    return { applied: true, marker };
}

function spawnTheorySpecialStone(cardState: any, gameState: GameState, state: any, prng: any, deps: any): any | null {
    return TheoryIncarnationSpawn.spawnTheorySpecialStone(cardState, gameState, state, prng, deps);
}

function findTheoryMarker(cardState: CardState, row: number, col: number, ownerKey: PlayerKey, deps: any): any {
    const getMarkers = deps && deps.getMarkers;
    const markers = typeof getMarkers === 'function' ? getMarkers(cardState) : ((cardState as any).markers || []);
    return markers.find((entry: any) => (
        entry &&
        entry.row === row &&
        entry.col === col &&
        entry.owner === ownerKey &&
        entry.data &&
        String(entry.data.type || '').toUpperCase() === THEORY_MARKER_TYPE
    )) || null;
}

function processTheoryIncarnationMarkerAtTurnStart(cardState: CardState, gameState: GameState, playerKey: PlayerKey, row: number, col: number, prng: any, deps: any): Record<string, any> {
    const ownerKey = ownerKeyOf(playerKey);
    ensureTheoryState(cardState as any);
    const marker = findTheoryMarker(cardState, row, col, ownerKey, deps);
    if (!marker || !marker.data) return { applied: false };
    const state = (cardState as any).theoryIncarnationStateByPlayer[ownerKey] || {
        sessionId: marker.data.sessionId || null,
        ownerKey,
        remainingSpawnCount: THEORY_DURATION_OWNER_TURNS
    };
    const spawned = Number(state.remainingSpawnCount || 0) > 0
        ? spawnTheorySpecialStone(cardState as any, gameState, state, prng, deps)
        : null;
    state.remainingSpawnCount = Math.max(0, Number(state.remainingSpawnCount || 0) - 1);
    (cardState as any).theoryIncarnationStateByPlayer[ownerKey] = state;

    const before = Number(marker.data.remainingOwnerTurns);
    const after = Number.isFinite(before) ? Math.max(0, Math.trunc(before) - 1) : 0;
    marker.data.remainingOwnerTurns = after;

    if (!(cardState as any)._theoryIncarnationAutoTurnEndByPlayer || typeof (cardState as any)._theoryIncarnationAutoTurnEndByPlayer !== 'object') {
        (cardState as any)._theoryIncarnationAutoTurnEndByPlayer = { black: false, white: false };
    }
    (cardState as any)._theoryIncarnationAutoTurnEndByPlayer[ownerKey] = true;

    if (after <= 0) {
        (cardState as any)._theoryIncarnationPendingAutoExpireByPlayer[ownerKey] = {
            row,
            col,
            owner: ownerKey,
            markerId: marker.id || null,
            sessionId: state.sessionId || marker.data.sessionId || null
        };
    }

    return {
        applied: true,
        spawned,
        expired: null,
        remainingOwnerTurns: after,
        remainingSpawnCount: state.remainingSpawnCount
    };
}

function processTheoryIncarnationMarkerAtPlacement(cardState: CardState, gameState: GameState, playerKey: PlayerKey, prng: any, deps: any): Record<string, any> {
    const ownerKey = ownerKeyOf(playerKey);
    ensureTheoryState(cardState as any);
    const state = (cardState as any).theoryIncarnationStateByPlayer[ownerKey];
    if (!state || typeof state !== 'object') {
        return { applied: false, spawned: null };
    }
    const spawned = spawnTheorySpecialStone(cardState as any, gameState, state, prng, deps);
    return {
        applied: !!spawned,
        spawned
    };
}

function finalizeTheoryIncarnationAutoTurnEndExpiration(cardState: CardState, gameState: GameState, playerKey: PlayerKey, prng: any, deps: any): Record<string, any> | null {
    const ownerKey = ownerKeyOf(playerKey);
    ensureTheoryState(cardState as any);
    const pendingByPlayer = (cardState as any)._theoryIncarnationPendingAutoExpireByPlayer;
    const pending = pendingByPlayer && pendingByPlayer[ownerKey];
    if (!pending) return null;
    pendingByPlayer[ownerKey] = null;

    const state = (cardState as any).theoryIncarnationStateByPlayer[ownerKey] || null;
    const sessionId = pending.sessionId || (state && state.sessionId) || null;
    const restoredCount = sessionId ? restoreTheoryNumberCells(cardState as any, sessionId) : 0;

    let row = Number(pending.row);
    let col = Number(pending.col);
    let markerId = pending.markerId || null;
    const getMarkers = deps && deps.getMarkers;
    const markers = typeof getMarkers === 'function' ? getMarkers(cardState) : ((cardState as any).markers || []);
    let marker = markerId
        ? markers.find((entry: any) => entry && entry.id === markerId)
        : null;
    if (!marker && Number.isFinite(row) && Number.isFinite(col)) {
        marker = findTheoryMarker(cardState, row, col, ownerKey, deps);
    }
    if (marker) {
        row = Number(marker.row);
        col = Number(marker.col);
        markerId = marker.id || markerId;
    }

    let reverted = false;
    if (Number.isFinite(row) && Number.isFinite(col) && deps && typeof deps.revertSpecialStoneWithPresentation === 'function') {
        const revertRes = deps.revertSpecialStoneWithPresentation(
            cardState,
            gameState,
            row,
            col,
            THEORY_MARKER_TYPE,
            ownerKey,
            'SYSTEM',
            'duration_end',
            {
                special: THEORY_MARKER_TYPE,
                owner: ownerKey,
                timer: 0,
                random: prng || null
            }
        );
        reverted = !!(revertRes && revertRes.reverted);
    }
    if (!reverted && markerId && deps && typeof deps.removeMarkerById === 'function') {
        deps.removeMarkerById(cardState, markerId);
    }
    (cardState as any).theoryIncarnationStateByPlayer[ownerKey] = null;

    return {
        row: Number.isFinite(row) ? row : null,
        col: Number.isFinite(col) ? col : null,
        owner: ownerKey,
        markerId: markerId || null,
        restoredCount
    };
}

function consumeTheoryIncarnationAutoTurnEnd(cardState: CardState, playerKey: PlayerKey): boolean {
    const ownerKey = ownerKeyOf(playerKey);
    const flags = (cardState as any)._theoryIncarnationAutoTurnEndByPlayer;
    if (!flags || flags[ownerKey] !== true) return false;
    flags[ownerKey] = false;
    return true;
}

export = {
    addNumberCellCollectedTotal,
    canUseTheoryIncarnation,
    applyTheoryIncarnationUsage,
    applyTheoryIncarnationStoneReservation,
    processTheoryIncarnationMarkerAtPlacement,
    processTheoryIncarnationMarkerAtTurnStart,
    finalizeTheoryIncarnationAutoTurnEndExpiration,
    consumeTheoryIncarnationAutoTurnEnd
};
