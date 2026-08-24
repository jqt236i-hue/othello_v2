import type { GameState, PlayerKey } from '../../../src/types';

import TheoryIncarnationSpawn = require('./theory-incarnation-spawn');
import CardResolutionBoardView = require('./board-view-access');

const CHAOS_SUMMON_TYPE = 'CHAOS_SUMMON';
const CHAOS_SUMMON_SPAWN_REASON = 'chaos_summon_spawn';
const CHAOS_SUMMON_FLIP_REASON = 'chaos_summon_flip';

function ownerKeyOf(value: any): PlayerKey {
    return value === 'white' ? 'white' : 'black';
}

function cellKeyOf(row: number, col: number): string {
    return `${row},${col}`;
}

function isEmptyCellValue(value: any, deps: any): boolean {
    return value === 0 || value === (deps ? deps.EMPTY : undefined);
}

function isChaosSummonAvailableCellInView(cardState: any, gameState: GameState, row: number, col: number, deps: any, view: any): boolean {
    if (!Number.isInteger(row) || !Number.isInteger(col)) return false;
    if (!view.isPlayable(row, col)) return false;
    const value = view.get(row, col);
    if (!isEmptyCellValue(value, deps)) return false;
    if (deps && typeof deps.isBlockedCell === 'function' && deps.isBlockedCell(cardState, row, col, gameState) === true) {
        return false;
    }
    return true;
}

function isChaosSummonAvailableCell(cardState: any, gameState: GameState, row: number, col: number, deps: any): boolean {
    const view = CardResolutionBoardView.createCardResolutionBoardView(cardState, gameState);
    return isChaosSummonAvailableCellInView(cardState, gameState, row, col, deps, view);
}

function getChaosSummonAvailableCells(cardState: any, gameState: GameState, deps: any): Array<{ key: string; cell: any }> {
    const view = CardResolutionBoardView.createCardResolutionBoardView(cardState, gameState);
    const out: Array<{ key: string; cell: any }> = [];
    for (const cell of view.coordinates) {
        if (!isChaosSummonAvailableCellInView(cardState, gameState, cell.row, cell.col, deps, view)) continue;
        out.push({
            key: cellKeyOf(cell.row, cell.col),
            cell: { row: cell.row, col: cell.col }
        });
    }
    return out;
}

function buildChaosSummonEntries(cardDefs: any, deps: any = {}, ownerKey: PlayerKey = 'black'): any[] {
    const factory = deps && deps.SpecialStoneMarkerFactory;
    if (!factory || typeof factory.buildTheoryIncarnationSpawnTable !== 'function') return [];
    const entries = factory.buildTheoryIncarnationSpawnTable(cardDefs, {
        ...deps,
        ownerKey
    });
    return entries
        .map((entry: any) => {
            if (!entry || !entry.markerData || !entry.markerData.type) return null;
            return {
                ...entry,
                markerData: {
                    ...entry.markerData,
                    sourceType: CHAOS_SUMMON_TYPE,
                    sourceCardId: entry.cardId || entry.markerData.sourceCardId || null,
                    sourceCardType: entry.cardType || entry.markerData.sourceCardType || null
                }
            };
        })
        .filter(Boolean);
}

function sampleOne(items: any[], prng: any, deps: any): any | null {
    if (!Array.isArray(items) || items.length <= 0) return null;
    const pickedList = deps && typeof deps.sampleRandomPositions === 'function'
        ? deps.sampleRandomPositions(items, 1, prng)
        : [items[0]];
    return pickedList && pickedList[0] ? pickedList[0] : null;
}

function stripTheoryNumberValuesFromRoulette(roulette: any): any {
    if (!roulette || typeof roulette !== 'object') return roulette;
    if (Array.isArray(roulette.candidateCells)) {
        roulette.candidateCells = roulette.candidateCells
            .map((cell: any) => ({
                row: Number(cell && cell.row),
                col: Number(cell && cell.col)
            }))
            .filter((cell: any) => Number.isInteger(cell.row) && Number.isInteger(cell.col));
    }
    if (roulette.selectedCell && typeof roulette.selectedCell === 'object') {
        roulette.selectedCell = {
            row: Number(roulette.selectedCell.row),
            col: Number(roulette.selectedCell.col)
        };
    }
    return roulette;
}

function canUseChaosSummon(cardState: any, gameState: GameState, playerKey: any, deps: any): boolean {
    const ownerKey = ownerKeyOf(playerKey);
    return getChaosSummonAvailableCells(cardState, gameState, deps).length > 0
        && buildChaosSummonEntries(deps && deps.CARD_DEFS, deps, ownerKey).length > 0;
}

function applyChaosSummonUsage(cardState: any, gameState: GameState, playerKey: any, prng: any, deps: any): any {
    const ownerKey = ownerKeyOf(playerKey);
    const available = getChaosSummonAvailableCells(cardState, gameState, deps);
    if (available.length <= 0) {
        return { applied: false, reason: 'no_empty_cell' };
    }

    const entries = buildChaosSummonEntries(deps && deps.CARD_DEFS, deps, ownerKey);
    if (entries.length <= 0) {
        return { applied: false, reason: 'no_spawn_candidate' };
    }

    const pickedCell = sampleOne(available, prng, deps);
    const pickedEntry = sampleOne(entries, prng, deps);
    if (!pickedCell || !pickedEntry) {
        return { applied: false, reason: 'random_selection_failed' };
    }

    const markerData = TheoryIncarnationSpawn.prepareSpawnMarkerData(
        cardState,
        pickedEntry.markerData,
        ownerKey
    );
    const roulette = TheoryIncarnationSpawn.createTheorySpawnRoulettePayload(
        cardState,
        available,
        pickedCell,
        markerData
    );
    stripTheoryNumberValuesFromRoulette(roulette);
    roulette.sourceCardId = pickedEntry.cardId || markerData.sourceCardId || null;
    roulette.sourceCardType = pickedEntry.cardType || markerData.sourceCardType || null;

    const ownerValue = ownerKey === 'white' ? deps.WHITE : deps.BLACK;
    const boardPlacement = typeof deps.spawnAndFlipPlacement === 'function'
        ? deps.spawnAndFlipPlacement({
            cardState,
            gameState,
            playerKey: ownerKey,
            playerValue: ownerValue,
            row: pickedCell.cell.row,
            col: pickedCell.cell.col,
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
            spawnCause: CHAOS_SUMMON_TYPE,
            spawnReason: CHAOS_SUMMON_SPAWN_REASON,
            flipCause: CHAOS_SUMMON_TYPE,
            flipReason: CHAOS_SUMMON_FLIP_REASON,
            noFlip: true,
            spawnMeta: {
                special: markerData.type,
                owner: ownerKey,
                sourceCardId: pickedEntry.cardId || markerData.sourceCardId || null,
                sourceCardType: pickedEntry.cardType || markerData.sourceCardType || null,
                theorySpawnRoulette: roulette
            }
        })
        : null;
    if (!boardPlacement || boardPlacement.spawned !== true) {
        return { applied: false, reason: 'spawn_failed' };
    }

    const appliedFlips = Array.isArray(boardPlacement.appliedFlips)
        ? boardPlacement.appliedFlips.slice()
        : [];
    // The no-flip spawn contract never grants charge from bracketed flips.
    const chargeGained = 0;

    const markerKinds = deps && deps.MARKER_KINDS;
    const specialKind = markerKinds && markerKinds.SPECIAL_STONE ? markerKinds.SPECIAL_STONE : 'specialStone';
    const marker = typeof deps.addMarker === 'function'
        ? deps.addMarker(cardState, specialKind, pickedCell.cell.row, pickedCell.cell.col, ownerKey, {
            ...markerData,
            sourceType: CHAOS_SUMMON_TYPE,
            sourceCardId: pickedEntry.cardId || markerData.sourceCardId || null,
            sourceCardType: pickedEntry.cardType || markerData.sourceCardType || null
        })
        : null;

    return {
        applied: true,
        row: pickedCell.cell.row,
        col: pickedCell.cell.col,
        owner: ownerKey,
        type: markerData.type,
        sourceCardId: pickedEntry.cardId || null,
        sourceCardType: pickedEntry.cardType || null,
        markerId: marker && marker.id ? marker.id : null,
        roulette,
        flips: appliedFlips.map(([row, col]: [number, number]) => ({ row, col })),
        chargeGained
    };
}

export = {
    CHAOS_SUMMON_TYPE,
    CHAOS_SUMMON_SPAWN_REASON,
    CHAOS_SUMMON_FLIP_REASON,
    buildChaosSummonEntries,
    getChaosSummonAvailableCells,
    isChaosSummonAvailableCell,
    canUseChaosSummon,
    applyChaosSummonUsage
};
