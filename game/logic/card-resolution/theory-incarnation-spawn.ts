import type { GameState, PlayerKey } from '../../../src/types';

import TheoryIncarnationState = require('./theory-incarnation-state');
import CardResolutionBoardView = require('./board-view-access');

const THEORY_MARKER_TYPE = 'THEORY_INCARNATION';
const THEORY_SPAWN_ROULETTE_MS = 2500;
const THEORY_SPAWN_MATERIALIZE_MS = 2000;

const {
    ownerKeyOf,
    cellKeyOf
} = TheoryIncarnationState;

function isBlockedForTheorySpawn(cardState: any, gameState: GameState, row: number, col: number, deps: any): boolean {
    if (deps && typeof deps.isBlockedCell === 'function') {
        return deps.isBlockedCell(cardState, row, col, gameState) === true;
    }
    return false;
}

function isCellAvailableForTheorySpawnInView(cardState: any, gameState: GameState, cell: any, deps: any, view: any): boolean {
    if (!cell) return false;
    const row = Number(cell.row);
    const col = Number(cell.col);
    if (!Number.isInteger(row) || !Number.isInteger(col)) return false;
    if (!view.isPlayable(row, col)) return false;
    const value = view.get(row, col);
    if (!(value === deps.EMPTY || value === 0)) return false;
    if (isBlockedForTheorySpawn(cardState, gameState, row, col, deps)) return false;
    const key = cellKeyOf(row, col);
    if (cardState.boardBonusConsumedByCell && cardState.boardBonusConsumedByCell[key] === true) return false;
    return true;
}

function isCellAvailableForTheorySpawn(cardState: any, gameState: GameState, cell: any, deps: any): boolean {
    const view = CardResolutionBoardView.createCardResolutionBoardView(cardState, gameState);
    return isCellAvailableForTheorySpawnInView(cardState, gameState, cell, deps, view);
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

function getTheorySpawnNumberValue(cardState: any, key: string, cell: any): number {
    const boardBonus = cardState && cardState.boardBonusByCell && typeof cardState.boardBonusByCell === 'object'
        ? cardState.boardBonusByCell
        : null;
    const visibleValue = boardBonus ? Number(boardBonus[key] || 0) : 0;
    if (Number.isFinite(visibleValue) && visibleValue > 0) return Math.floor(visibleValue);
    const cellValue = Number(cell && cell.value);
    if (Number.isFinite(cellValue) && cellValue > 0) return Math.floor(cellValue);
    const sourceCost = Number(cell && cell.sourceCardCost);
    return Number.isFinite(sourceCost) && sourceCost > 0 ? Math.floor(sourceCost) : 0;
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

function createTheorySpawnRoulettePayload(cardState: any, available: Array<{ key: string; cell: any }>, picked: { key: string; cell: any }, markerData: any): any {
    const candidateCells = available
        .map(({ key, cell }) => {
            const out: any = {
                row: Number(cell && cell.row),
                col: Number(cell && cell.col)
            };
            const value = getTheorySpawnNumberValue(cardState, key, cell);
            if (Number.isFinite(value) && value > 0) out.value = value;
            return out;
        })
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
    const view = CardResolutionBoardView.createCardResolutionBoardView(cardState, gameState);
    const available = cells.filter(({ cell }) => isCellAvailableForTheorySpawnInView(cardState, gameState, cell, deps, view));
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
    const roulette = createTheorySpawnRoulettePayload(cardState, available, picked, markerData);
    const ownerValue = ownerKey === 'white' ? deps.WHITE : deps.BLACK;
    const boardPlacement = typeof deps.spawnAndFlipPlacement === 'function'
        ? deps.spawnAndFlipPlacement({
            cardState,
            gameState,
            playerKey: ownerKey,
            playerValue: ownerValue,
            row: picked.cell.row,
            col: picked.cell.col,
            allowZeroFlips: true,
            BoardOps: deps.BoardOps,
            getCardContext: () => (
                typeof deps.resolveSafeCardContext === 'function'
                    ? deps.resolveSafeCardContext(cardState)
                    : { protectedStones: [], permaProtectedStones: [] }
            ),
            getFlipsWithContext: deps.Core && typeof deps.Core.getFlipsWithContext === 'function'
                ? deps.Core.getFlipsWithContext
                : (() => []),
            resolveFlipEvasion: (candidateFlips: any[]) => (
                candidateFlips.length > 0 && typeof deps.resolveHyperactiveFlipEvasion === 'function'
                    ? deps.resolveHyperactiveFlipEvasion(cardState, gameState, candidateFlips, ownerKey, prng)
                    : null
            ),
            clearBombAt: typeof deps.clearBombAt === 'function' ? deps.clearBombAt : undefined,
            clearHyperactiveAtPositions: typeof deps.clearHyperactiveAtPositions === 'function' ? deps.clearHyperactiveAtPositions : undefined,
            spawnCause: THEORY_MARKER_TYPE,
            spawnReason: 'theory_incarnation_spawn',
            flipCause: THEORY_MARKER_TYPE,
            flipReason: 'theory_incarnation_flip',
            noFlip: true,
            spawnMeta: {
                special: markerData.type,
                owner: ownerKey,
                sourceCardId: picked.cell.sourceCardId || null,
                sourceCardType: picked.cell.sourceCardType || null,
                theorySpawnRoulette: roulette
            }
        })
        : null;
    if (!boardPlacement || boardPlacement.spawned !== true) return null;
    const appliedFlips = Array.isArray(boardPlacement.appliedFlips)
        ? boardPlacement.appliedFlips.slice()
        : [];
    const theoryNumberValue = getTheorySpawnNumberValue(cardState, picked.key, picked.cell);
    // Theory spawns ignore the selected theory number value, and the no-flip spawn
    // contract never grants charge from bracketed flips either.
    const chargeGained = 0;
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
        roulette,
        flips: appliedFlips.map(([row, col]: [number, number]) => ({ row, col })),
        chargeGained,
        theoryNumberValue
    };
}

export = {
    isCellAvailableForTheorySpawn,
    markTheoryCellConsumed,
    getTheorySpawnNumberValue,
    prepareSpawnMarkerData,
    createTheorySpawnRoulettePayload,
    spawnTheorySpecialStone
};
