/**
 * @file shinra-bansho-god.ts
 * @description Canonical fusion and 2x2 occupancy rules for 森羅万象神.
 */

type SeatKey = 'black' | 'white';
type Position = { row: number; col: number };

type ShinraDeps = {
    EMPTY: number;
    BLACK: number;
    WHITE: number;
    BoardOps: any;
    BoardUtils: any;
    SpecialStoneRegistry: any;
    addMarker: (cardState: any, kind: string, row: number, col: number, owner: SeatKey, data: any, options?: any) => any;
    isBlockedCell: (cardState: any, row: number, col: number, gameState: any) => boolean;
    isFrozenCell: (cardState: any, row: number, col: number) => boolean;
    isInviolableCell: (cardState: any, row: number, col: number) => boolean;
    getCellValue: (cardState: any, gameState: any, row: number, col: number) => number | null;
    getStoneIdAt: (cardState: any, gameState: any, row: number, col: number) => string | null;
    clearStoneIdAt: (cardState: any, gameState: any, row: number, col: number) => void;
};

const SHINRA_TYPE = 'SHINRA_BANSHO_GOD';
const FOOTPRINT_VERSION = 'square_2x2.v1';
const MATERIAL_TYPES = Object.freeze(['FIRE', 'WATER', 'GRASS', 'LIGHTNING']);
const BOARD_MARKER_FALLBACK = new Set([
    'BLOCKADE',
    'METEOR_HOLE',
    'FREEZE',
    'SEED',
    'POISON_CELL',
    'SCORCHED_CELL',
    'HEALING_CELL'
]);

function markerType(marker: any): string {
    return String(marker && marker.data && marker.data.type || '').trim().toUpperCase();
}

function markerIdentity(marker: any): string {
    const value = marker && (marker.markerId ?? marker.id);
    return value === undefined || value === null ? '' : String(value);
}

function compareMarkers(left: any, right: any): number {
    const seq = Number(left && left.createdSeq || 0) - Number(right && right.createdSeq || 0);
    if (seq !== 0) return seq;
    const row = Number(left && left.row || 0) - Number(right && right.row || 0);
    if (row !== 0) return row;
    const col = Number(left && left.col || 0) - Number(right && right.col || 0);
    if (col !== 0) return col;
    return markerIdentity(left).localeCompare(markerIdentity(right));
}

function positionKey(row: number, col: number): string {
    return `${row},${col}`;
}

function footprintAt(row: number, col: number): Position[] {
    return [
        { row, col },
        { row, col: col + 1 },
        { row: row + 1, col },
        { row: row + 1, col: col + 1 }
    ];
}

function isSpecialMarker(marker: any): boolean {
    return !!(marker && marker.kind === 'specialStone' && marker.data);
}

function isBoardMarker(marker: any, deps: ShinraDeps): boolean {
    const type = markerType(marker);
    if (deps.SpecialStoneRegistry && typeof deps.SpecialStoneRegistry.isBoardMarkerType === 'function') {
        return deps.SpecialStoneRegistry.isBoardMarkerType(type) === true;
    }
    return BOARD_MARKER_FALLBACK.has(type);
}

function markerOccupies(marker: any, row: number, col: number, deps: ShinraDeps): boolean {
    if (deps.SpecialStoneRegistry && typeof deps.SpecialStoneRegistry.markerOccupiesCell === 'function') {
        return deps.SpecialStoneRegistry.markerOccupiesCell(marker, row, col) === true;
    }
    return !!(marker && marker.row === row && marker.col === col);
}

function hasCompleteProtectionAt(cardState: any, row: number, col: number, deps: ShinraDeps): boolean {
    const markers = cardState && Array.isArray(cardState.markers) ? cardState.markers : [];
    return markers.some((marker: any) => {
        if (!isSpecialMarker(marker) || !markerOccupies(marker, row, col, deps)) return false;
        const type = markerType(marker);
        if (type === 'GUARD' || type === SHINRA_TYPE) return true;
        const info = deps.SpecialStoneRegistry && typeof deps.SpecialStoneRegistry.getSpecialStoneInfo === 'function'
            ? deps.SpecialStoneRegistry.getSpecialStoneInfo(type)
            : null;
        return !!(info && info.destroyProtected === true);
    });
}

function collectMaterialSet(cardState: any, owner: SeatKey): any[] | null {
    const markers = cardState && Array.isArray(cardState.markers) ? cardState.markers : [];
    const selected: any[] = [];
    for (const type of MATERIAL_TYPES) {
        const candidates = markers
            .filter((marker: any) => (
                isSpecialMarker(marker) &&
                marker.owner === owner &&
                markerType(marker) === type
            ))
            .sort(compareMarkers);
        if (candidates.length === 0) return null;
        selected.push(candidates[0]);
    }
    return selected;
}

function selectRandomIndex(length: number, randomSource: any): number {
    if (length <= 1) return 0;
    const randomFn = typeof randomSource === 'function'
        ? randomSource
        : (randomSource && typeof randomSource.random === 'function'
            ? () => randomSource.random()
            : null);
    if (!randomFn) throw new Error('Shinra Bansho God fusion requires an injected deterministic PRNG.');
    const raw = Number(randomFn());
    if (!Number.isFinite(raw)) throw new Error('Shinra Bansho God fusion received a non-finite PRNG value.');
    return Math.max(0, Math.min(length - 1, Math.floor(Math.max(0, Math.min(0.999999, raw)) * length)));
}

function collectSpawnCandidates(cardState: any, gameState: any, materials: any[], deps: ShinraDeps): any[] {
    const view = deps.BoardUtils.createBoardView(gameState, { cardState, strict: false });
    const playableKeys = new Set(view.coordinates.map((cell: Position) => positionKey(cell.row, cell.col)));
    const materialKeys = new Set(materials.map((marker) => positionKey(marker.row, marker.col)));
    const candidates: any[] = [];
    for (const anchor of view.coordinates) {
        const cells = footprintAt(anchor.row, anchor.col);
        if (!cells.every((cell) => playableKeys.has(positionKey(cell.row, cell.col)))) continue;
        if (cells.some((cell) => (
            deps.isBlockedCell(cardState, cell.row, cell.col, gameState) ||
            deps.isFrozenCell(cardState, cell.row, cell.col) ||
            deps.isInviolableCell(cardState, cell.row, cell.col) ||
            hasCompleteProtectionAt(cardState, cell.row, cell.col, deps)
        ))) continue;
        const emptyCount = cells.reduce((count, cell) => {
            const key = positionKey(cell.row, cell.col);
            const owner = deps.getCellValue(cardState, gameState, cell.row, cell.col);
            return count + ((materialKeys.has(key) || owner === deps.EMPTY) ? 1 : 0);
        }, 0);
        candidates.push({ row: anchor.row, col: anchor.col, cells, emptyCount });
    }
    candidates.sort((left, right) => left.row - right.row || left.col - right.col);
    if (candidates.length === 0) return [];
    const maxEmpty = Math.max(...candidates.map((candidate) => candidate.emptyCount));
    return candidates.filter((candidate) => candidate.emptyCount === maxEmpty);
}

function clearStoneAt(
    cardState: any,
    gameState: any,
    cell: Position,
    removalPolicy: 'fusion_consume' | 'summon_clear',
    groupId: string,
    deps: ShinraDeps
): void {
    const ownerValue = deps.getCellValue(cardState, gameState, cell.row, cell.col);
    if (ownerValue === null || ownerValue === deps.EMPTY) return;
    const stoneId = deps.getStoneIdAt(cardState, gameState, cell.row, cell.col);
    const ownerBefore = ownerValue === deps.WHITE ? 'white' : 'black';
    deps.BoardOps.emitPresentationEvent(cardState, {
        type: 'DESTROY',
        stoneId,
        row: cell.row,
        col: cell.col,
        ownerBefore,
        cause: SHINRA_TYPE,
        reason: removalPolicy,
        meta: {
            removalPolicy,
            summonGroupId: groupId,
            bypassNormalDestroyAccounting: true
        }
    });
    deps.clearStoneIdAt(cardState, gameState, cell.row, cell.col);
    deps.BoardOps.setCellValue(gameState, cell.row, cell.col, deps.EMPTY, cardState);
}

function removeStoneAttachedMarkers(cardState: any, cells: Position[], selectedMaterials: any[], deps: ShinraDeps): void {
    const selected = new Set(selectedMaterials);
    const cellKeys = new Set(cells.map((cell) => positionKey(cell.row, cell.col)));
    if (!Array.isArray(cardState.markers)) return;
    cardState.markers = cardState.markers.filter((marker: any) => {
        if (!marker) return false;
        if (selected.has(marker)) return false;
        if (!cellKeys.has(positionKey(Number(marker.row), Number(marker.col)))) return true;
        return isBoardMarker(marker, deps);
    });
}

function applyOneFusion(
    cardState: any,
    gameState: any,
    owner: SeatKey,
    materials: any[],
    candidate: any,
    deps: ShinraDeps
): any {
    const checkpoint = deps.BoardUtils.createBoardMutationCheckpoint(gameState, cardState);
    const groupId = `shinra:${owner}:${markerIdentity(materials[0])}:${markerIdentity(materials[1])}:${markerIdentity(materials[2])}:${markerIdentity(materials[3])}`;
    const materialCells = materials.map((marker) => ({ row: marker.row, col: marker.col }));
    const destinationCells = candidate.cells.map((cell: Position) => ({ row: cell.row, col: cell.col }));
    const materialCellKeys = new Set(materialCells.map((cell) => positionKey(cell.row, cell.col)));
    const clearedCount = destinationCells.filter((cell: Position) => (
        !materialCellKeys.has(positionKey(cell.row, cell.col))
        && deps.getCellValue(cardState, gameState, cell.row, cell.col) !== deps.EMPTY
    )).length;
    const allAffected = new Map<string, Position>();
    for (const cell of materialCells.concat(destinationCells)) {
        allAffected.set(positionKey(cell.row, cell.col), cell);
    }
    try {
        for (const cell of allAffected.values()) {
            const policy = materialCells.some((source) => source.row === cell.row && source.col === cell.col)
                ? 'fusion_consume'
                : 'summon_clear';
            clearStoneAt(cardState, gameState, cell, policy, groupId, deps);
        }
        removeStoneAttachedMarkers(cardState, Array.from(allAffected.values()), materials, deps);
        const marker = deps.addMarker(
            cardState,
            'specialStone',
            candidate.row,
            candidate.col,
            owner,
            {
                type: SHINRA_TYPE,
                footprint: FOOTPRINT_VERSION,
                permanent: true,
                fusionMaterialMarkerIds: materials.map(markerIdentity)
            },
            { emitStatusApplied: false }
        );
        if (!marker) throw new Error('Failed to create Shinra Bansho God marker.');
        const footprint = footprintAt(candidate.row, candidate.col);
        for (let index = 0; index < footprint.length; index += 1) {
            const cell = footprint[index];
            const spawn = deps.BoardOps.spawnAt(
                cardState,
                gameState,
                cell.row,
                cell.col,
                owner,
                SHINRA_TYPE,
                'shinra_summoned',
                {
                    special: SHINRA_TYPE,
                    owner,
                    groupMarkerId: marker.markerId ?? marker.id ?? null,
                    footprint,
                    footprintRole: index === 0 ? 'anchor' : 'member',
                    composite: true
                }
            );
            if (!spawn || !spawn.spawned) throw new Error(`Failed to occupy Shinra footprint at ${cell.row},${cell.col}.`);
        }
        deps.BoardOps.emitPresentationEvent(cardState, {
            type: 'STATUS_APPLIED',
            row: candidate.row,
            col: candidate.col,
            cause: SHINRA_TYPE,
            reason: 'shinra_summoned',
            meta: {
                special: SHINRA_TYPE,
                owner,
                groupMarkerId: marker.markerId ?? marker.id ?? null,
                footprint,
                composite: true
            }
        });
        return {
            summoned: true,
            owner,
            row: candidate.row,
            col: candidate.col,
            footprint,
            markerId: marker.markerId ?? marker.id ?? null,
            materialMarkerIds: materials.map(markerIdentity),
            clearedCount
        };
    } catch (error) {
        deps.BoardUtils.restoreBoardMutationCheckpoint(gameState, cardState, checkpoint);
        throw error;
    }
}

function resolveShinraBanshoGodFusions(
    cardState: any,
    gameState: any,
    randomSource: any,
    deps: ShinraDeps
): { summoned: any[]; deferredOwners: SeatKey[] } {
    const summoned: any[] = [];
    const deferredOwners = new Set<SeatKey>();
    const maximumFusions = Math.max(1, Math.floor(((cardState && cardState.markers || []).length + 4) / 4));
    for (let iteration = 0; iteration < maximumFusions; iteration += 1) {
        const sets = (['black', 'white'] as SeatKey[])
            .map((owner) => ({ owner, materials: collectMaterialSet(cardState, owner) }))
            .filter((entry) => !!entry.materials)
            .sort((left, right) => {
                const leftSeq = Math.max(...left.materials!.map((marker) => Number(marker.createdSeq || 0)));
                const rightSeq = Math.max(...right.materials!.map((marker) => Number(marker.createdSeq || 0)));
                return leftSeq - rightSeq || (left.owner === 'black' ? -1 : 1);
            });
        if (sets.length === 0) break;
        let changed = false;
        for (const entry of sets) {
            const materials = collectMaterialSet(cardState, entry.owner);
            if (!materials) continue;
            const candidates = collectSpawnCandidates(cardState, gameState, materials, deps);
            if (candidates.length === 0) {
                deferredOwners.add(entry.owner);
                continue;
            }
            const candidate = candidates[selectRandomIndex(candidates.length, randomSource)];
            const result = deps.BoardOps.runEffectBlock(cardState, gameState, {
                kind: 'shinra_fusion',
                cause: SHINRA_TYPE,
                reason: 'shinra_summoned',
                owner: entry.owner,
                randomSource: randomSource || null,
                rescueFlush: false
            }, () => applyOneFusion(cardState, gameState, entry.owner, materials, candidate, deps));
            summoned.push(result);
            deferredOwners.delete(entry.owner);
            changed = true;
            break;
        }
        if (!changed) break;
    }
    return { summoned, deferredOwners: Array.from(deferredOwners) };
}

const CardShinraBanshoGod = {
    SHINRA_TYPE,
    FOOTPRINT_VERSION,
    MATERIAL_TYPES,
    footprintAt,
    collectMaterialSet,
    collectSpawnCandidates,
    resolveShinraBanshoGodFusions
};

module.exports = CardShinraBanshoGod;
export = CardShinraBanshoGod;
