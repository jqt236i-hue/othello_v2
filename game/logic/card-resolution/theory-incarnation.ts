/**
 * @file theory-incarnation.ts
 * @description Theory Incarnation card and manifestation stone resolution.
 */

import type { CardState, GameState, PlayerKey } from '../../../src/types';

const THEORY_MARKER_TYPE = 'THEORY_INCARNATION';
const THEORY_DURATION_OWNER_TURNS = 3;
const THEORY_SPAWN_ROULETTE_MS = 2500;
const THEORY_SPAWN_MATERIALIZE_MS = 2000;

function ownerKeyOf(playerKey: any): PlayerKey {
    return playerKey === 'white' ? 'white' : 'black';
}

function cellKeyOf(row: number, col: number): string {
    return `${row},${col}`;
}

function ensureTheoryState(cardState: any): void {
    if (!cardState.theoryIncarnationStateByPlayer || typeof cardState.theoryIncarnationStateByPlayer !== 'object') {
        cardState.theoryIncarnationStateByPlayer = { black: null, white: null };
    }
    if (!cardState.nextTheoryIncarnationStoneByPlayer || typeof cardState.nextTheoryIncarnationStoneByPlayer !== 'object') {
        cardState.nextTheoryIncarnationStoneByPlayer = { black: null, white: null };
    }
    if (!cardState.theoryNumberCellsBySession || typeof cardState.theoryNumberCellsBySession !== 'object') {
        cardState.theoryNumberCellsBySession = {};
    }
    if (!cardState.theoryNumberCellByCell || typeof cardState.theoryNumberCellByCell !== 'object') {
        cardState.theoryNumberCellByCell = {};
    }
    if (!cardState.numberCellCollectedTotalByPlayer || typeof cardState.numberCellCollectedTotalByPlayer !== 'object') {
        cardState.numberCellCollectedTotalByPlayer = { black: 0, white: 0 };
    }
    if (!cardState._theoryIncarnationPendingAutoExpireByPlayer || typeof cardState._theoryIncarnationPendingAutoExpireByPlayer !== 'object') {
        cardState._theoryIncarnationPendingAutoExpireByPlayer = { black: null, white: null };
    }
    if (!Number.isFinite(Number(cardState._nextTheoryIncarnationSeq))) {
        cardState._nextTheoryIncarnationSeq = 1;
    }
}

function addNumberCellCollectedTotal(cardState: CardState, playerKey: PlayerKey, amount: any): number {
    const ownerKey = ownerKeyOf(playerKey);
    const n = Number(amount);
    if (!Number.isFinite(n) || n <= 0) return Number((cardState as any).numberCellCollectedTotalByPlayer && (cardState as any).numberCellCollectedTotalByPlayer[ownerKey] || 0);
    ensureTheoryState(cardState as any);
    const before = Number((cardState as any).numberCellCollectedTotalByPlayer[ownerKey] || 0);
    const after = before + Math.floor(n);
    (cardState as any).numberCellCollectedTotalByPlayer[ownerKey] = after;
    return after;
}

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

function isCellAvailableForTheorySpawn(cardState: any, gameState: GameState, cell: any, deps: any): boolean {
    if (!cell) return false;
    const row = Number(cell.row);
    const col = Number(cell.col);
    if (!Number.isInteger(row) || !Number.isInteger(col)) return false;
    const value = typeof deps.getCellValueForCard === 'function'
        ? deps.getCellValueForCard(gameState, row, col)
        : ((gameState as any).board && (gameState as any).board[row] ? (gameState as any).board[row][col] : null);
    if (!(value === deps.EMPTY || value === 0)) return false;
    if (isBlockedForTheory(cardState, gameState, row, col, deps)) return false;
    const key = cellKeyOf(row, col);
    if (cardState.boardBonusConsumedByCell && cardState.boardBonusConsumedByCell[key] === true) return false;
    return true;
}

function markTheoryCellConsumed(cardState: any, sessionId: string, key: string): void {
    if (!cardState.boardBonusConsumedByCell || typeof cardState.boardBonusConsumedByCell !== 'object') {
        cardState.boardBonusConsumedByCell = {};
    }
    cardState.boardBonusConsumedByCell[key] = true;
    if (cardState.theoryNumberCellByCell) {
        delete cardState.theoryNumberCellByCell[key];
    }
    const session = cardState.theoryNumberCellsBySession && cardState.theoryNumberCellsBySession[sessionId];
    if (session && session.cells && session.cells[key]) {
        session.cells[key].consumed = true;
    }
}

function prepareSpawnMarkerData(cardState: any, markerData: any, ownerKey: PlayerKey): any {
    const data = markerData && typeof markerData === 'object' ? { ...markerData } : {};
    const type = String(data.type || '').toUpperCase();
    if (type === 'PROTECTED' && !data.expiresForPlayer) {
        data.expiresForPlayer = ownerKey;
    }
    if (type === 'WORK' && !data.ownerColor) {
        data.ownerColor = ownerKey;
    }
    if (
        type === 'HYPERACTIVE' ||
        type === 'EXTREME_HYPERACTIVE' ||
        type === 'ESCAPE_HYPERACTIVE' ||
        type === 'ROBOT_VACUUM' ||
        type === 'GLUTTONOUS'
    ) {
        cardState.hyperactiveSeqCounter = Math.max(0, Math.floor(Number(cardState.hyperactiveSeqCounter || 0))) + 1;
        if (!Number.isFinite(Number(data.hyperactiveSeq))) {
            data.hyperactiveSeq = cardState.hyperactiveSeqCounter;
        }
    }
    return data;
}

function createTheorySpawnRoulettePayload(available: Array<{ key: string; cell: any }>, picked: { key: string; cell: any }, markerData: any): any {
    const candidateCells = available
        .map(({ cell }) => ({
            row: Number(cell && cell.row),
            col: Number(cell && cell.col)
        }))
        .filter((cell) => Number.isInteger(cell.row) && Number.isInteger(cell.col));
    const selectedCell = {
        row: Number(picked && picked.cell && picked.cell.row),
        col: Number(picked && picked.cell && picked.cell.col)
    };
    return {
        durationMs: THEORY_SPAWN_ROULETTE_MS,
        materializeMs: THEORY_SPAWN_MATERIALIZE_MS,
        candidateCells,
        selectedCell,
        spawnedMarkerType: markerData && markerData.type ? markerData.type : null,
        sourceCardId: picked && picked.cell ? (picked.cell.sourceCardId || null) : null,
        sourceCardType: picked && picked.cell ? (picked.cell.sourceCardType || null) : null
    };
}

function spawnTheorySpecialStone(cardState: any, gameState: GameState, state: any, prng: any, deps: any): any | null {
    const sessionId = state && state.sessionId;
    const session = sessionId && cardState.theoryNumberCellsBySession ? cardState.theoryNumberCellsBySession[sessionId] : null;
    const cells = session && session.cells ? Object.entries(session.cells).map(([key, cell]: [string, any]) => ({ key, cell })) : [];
    const available = cells.filter(({ cell }) => isCellAvailableForTheorySpawn(cardState, gameState, cell, deps));
    if (available.length <= 0) return null;
    const pickedList = typeof deps.sampleRandomPositions === 'function'
        ? deps.sampleRandomPositions(available, 1, prng)
        : [available[0]];
    const picked = pickedList[0];
    if (!picked || !picked.cell) return null;
    const markerDataBase = picked.cell.markerData && typeof picked.cell.markerData === 'object'
        ? { ...picked.cell.markerData }
        : {
            type: picked.cell.spawnType,
            sourceType: THEORY_MARKER_TYPE,
            sourceCardId: picked.cell.sourceCardId || null,
            sourceCardType: picked.cell.sourceCardType || null
        };
    const ownerKey = ownerKeyOf(state.ownerKey);
    const markerData = prepareSpawnMarkerData(cardState, markerDataBase, ownerKey);
    const roulette = createTheorySpawnRoulettePayload(available, picked, markerData);
    const spawnRes = deps.spawnAt(
        cardState,
        gameState,
        picked.cell.row,
        picked.cell.col,
        ownerKey,
        THEORY_MARKER_TYPE,
        'theory_incarnation_spawn',
        {
            special: markerData.type,
            owner: ownerKey,
            sourceCardId: picked.cell.sourceCardId || null,
            sourceCardType: picked.cell.sourceCardType || null,
            theorySpawnRoulette: roulette
        }
    );
    if (!spawnRes || !spawnRes.spawned) return null;
    const markerKinds = deps && deps.MARKER_KINDS;
    const specialKind = markerKinds && markerKinds.SPECIAL_STONE ? markerKinds.SPECIAL_STONE : 'specialStone';
    const marker = deps.addMarker(cardState, specialKind, picked.cell.row, picked.cell.col, ownerKey, {
        ...markerData,
        sourceType: THEORY_MARKER_TYPE,
        sourceCardId: picked.cell.sourceCardId || markerData.sourceCardId || null,
        sourceCardType: picked.cell.sourceCardType || markerData.sourceCardType || null
    });
    markTheoryCellConsumed(cardState, sessionId, picked.key);
    return {
        row: picked.cell.row,
        col: picked.cell.col,
        owner: ownerKey,
        type: markerData.type,
        sourceCardId: picked.cell.sourceCardId || null,
        sourceCardType: picked.cell.sourceCardType || null,
        markerId: marker && marker.id ? marker.id : null,
        roulette
    };
}

function restoreTheoryNumberCells(cardState: any, sessionId: string): number {
    const session = cardState.theoryNumberCellsBySession && cardState.theoryNumberCellsBySession[sessionId];
    if (!session || !session.cells) return 0;
    const boardBonus = (cardState.boardBonusByCell && typeof cardState.boardBonusByCell === 'object') ? cardState.boardBonusByCell : (cardState.boardBonusByCell = {});
    const consumed = (cardState.boardBonusConsumedByCell && typeof cardState.boardBonusConsumedByCell === 'object') ? cardState.boardBonusConsumedByCell : (cardState.boardBonusConsumedByCell = {});
    let restoredCount = 0;
    for (const [key, cell] of Object.entries(session.cells) as Array<[string, any]>) {
        if (cell && cell.consumed === true) {
            if (cardState.theoryNumberCellByCell) delete cardState.theoryNumberCellByCell[key];
            continue;
        }
        const originalValue = Number(cell && cell.originalValue || 0);
        if (originalValue > 0) boardBonus[key] = originalValue;
        else delete boardBonus[key];
        if (cell && cell.originalConsumed === true) consumed[key] = true;
        else delete consumed[key];
        if (cardState.theoryNumberCellByCell) delete cardState.theoryNumberCellByCell[key];
        restoredCount += 1;
    }
    delete cardState.theoryNumberCellsBySession[sessionId];
    return restoredCount;
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
