/**
 * @file hyperactive.ts
 * @description Hyperactive effect helpers (Shared between Browser and Headless)
 */

import type { CardState, GameState, PlayerKey } from '../../../src/types';
import SharedConstantsImport = require('../../../shared-constants');
import BoardUtilsImport = require('../../../shared/shared-board-utils');
import RandomSourceImport = require('../cards-internal/random-source');
import StoneStatusSnapshotImport = require('../../../shared/stone-status-snapshot');
import EvasionStatusImport = require('../../../shared/evasion-status');
import EvasionDestinationImport = require('../cards-internal/evasion-destination');
import HyperactiveCoreUtilsImport = require('./hyperactive-core-utils');
import HyperactiveBoardShapeImport = require('./hyperactive-board-shape');
import CardMarkersImport = require('./markers');
import SpecialStoneRegistryImport = require('../../../shared/special-stone-registry-static');

const SharedConstants: any = SharedConstantsImport;
const BoardUtils: any = BoardUtilsImport;
const RandomSourceModule: any = RandomSourceImport;
const StoneStatusSnapshot: any = StoneStatusSnapshotImport;
const EvasionStatusModule: any = EvasionStatusImport;
const EvasionDestinationModule: any = EvasionDestinationImport;
const HyperactiveCoreUtils: any = HyperactiveCoreUtilsImport;
const HyperactiveBoardShape: any = HyperactiveBoardShapeImport;
const CardMarkersModule: any = CardMarkersImport;
const SpecialStoneRegistry: any = SpecialStoneRegistryImport;
const BLACK: any = SharedConstants.BLACK;
const WHITE: any = SharedConstants.WHITE;
const EMPTY: any = SharedConstants.EMPTY;

let hyperactiveRuntime: any = null;

function setHyperactiveRuntime(runtime: any): void {
    hyperactiveRuntime = (runtime && typeof runtime === 'object') ? runtime : null;
}

const MANIFEST_STONE_TYPES = new Set(['THEORY_INCARNATION', 'BOARD_EXECUTOR', 'OBSERVER_WILL']);

function logHyperactiveDebug(...args: any[]): void {
    try {
        if (
            !hyperactiveRuntime ||
            typeof hyperactiveRuntime.isDebugLogAvailable !== 'function' ||
            hyperactiveRuntime.isDebugLogAvailable() !== true
        ) {
            return;
        }
        if (typeof hyperactiveRuntime.debugLog === 'function') {
            hyperactiveRuntime.debugLog(args[0], 'debug', args.length > 1 ? args.slice(1) : undefined);
            return;
        }
        if (typeof console !== 'undefined' && typeof console.log === 'function') {
            console.log(...args);
        }
    } catch (e) { /* ignore */ }
}

function getBoardShapeDeps() {
    return {
        BoardUtils,
        BLACK,
        WHITE,
        EMPTY
    };
}

function resolveHyperactiveBoardShapeModule(): any {
    return HyperactiveBoardShape;
}

function invokeBoardShapeMethod(methodName: string, args: any[]): any {
    const boardShape = resolveHyperactiveBoardShapeModule();
    if (!boardShape || typeof boardShape[methodName] !== 'function') {
        throw new Error(`CardHyperactiveBoardShape.${methodName} is unavailable`);
    }
    return boardShape[methodName](...args, getBoardShapeDeps());
}

interface Position {
    row: number;
    col: number;
}

interface Candidate extends Position {
    occupied?: boolean;
    distance?: number;
    dr?: number;
    dc?: number;
}

interface BoardConfig {
    rows: number;
    cols: number;
    baseBounds: {
        minRow: number;
        maxRow: number;
        minCol: number;
        maxCol: number;
    };
    outerBounds: {
        minRow: number;
        maxRow: number;
        minCol: number;
        maxCol: number;
    };
}

interface MarkerEntry {
    kind?: string;
    row: number;
    col: number;
    owner?: PlayerKey;
    data?: any;
    createdSeq?: number;
}

interface MoveResult {
    from: Position;
    to: Position;
    specialType?: string;
    source?: Position;
    forcedSwap?: boolean;
    step?: number;
    distance?: number;
}

interface DestroyResult {
    row: number;
    col: number;
    specialType?: string;
    reason?: string;
    reverted?: boolean;
}

interface FlipEvasionResult {
    remainingFlips: Array<[number, number]>;
    moved: MoveResult[];
    destroyed: DestroyResult[];
    evaded: Position[];
    flipped: any[];
}

interface HyperactiveMoveResult {
    moved: MoveResult[];
    destroyed: DestroyResult[];
    flipped: any[];
    repelled?: MoveResult[];
    ownerKey?: PlayerKey;
}

interface GluttonousMoveResult {
    moved: MoveResult[];
    destroyed: DestroyResult[];
    flipped: any[];
    ownerKey: PlayerKey;
    ate: any[];
}

interface RobotVacuumMoveResult {
    moved: MoveResult[];
    destroyed: DestroyResult[];
    flipped: any[];
    ownerKey: PlayerKey;
    sucked: any[];
    expired: any[];
    suckedCount: number;
}

interface HyperactiveDeps {
    defaultPrng?: any;
    isBlockedCell?: (cardState: CardState, row: number, col: number, gameState: GameState) => boolean;
    BoardOps?: any;
    destroyAt?: (cardState: CardState, gameState: GameState, row: number, col: number, ...args: any[]) => boolean;
    isFrozenCell?: (cardState: CardState, row: number, col: number) => boolean;
    isInviolableCell?: (cardState: CardState, row: number, col: number) => boolean;
    isManifestStoneAt?: (cardState: CardState, row: number, col: number) => boolean;
    clearHyperactiveAtPositions?: (cardState: CardState, positions: Position[]) => void;
    clearBombAt?: (cardState: CardState, row: number, col: number) => void;
    getFlipsWithContext?: (gameState: GameState, row: number, col: number, ownerVal: number, ctx: any) => any[];
    getCardContext?: (cardState: CardState) => any;
    swapOccupiedCellsWithPresentation?: (cardState: CardState, gameState: GameState, source: Position, target: Position, meta: any) => any;
    currentTurnPlayerKey?: PlayerKey;
    randomSource?: any;
    decrementRemainingOwnerTurns?: boolean;
    ultimateHyperactiveTurns?: number;
    ultimateHyperactiveMaxDistance?: number;
    clearUltimateAtPositions?: (cardState: CardState, positions: Position[]) => void;
    robotVacuumTurns?: number;
    readCardPendingEffect?: (cardState: CardState, playerKey: PlayerKey) => any;
    clearCardPendingEffect?: (cardState: CardState, playerKey: PlayerKey) => void;
    removeMarkersAt?: (cardState: CardState, row: number, col: number, filter: any) => void;
    addMarker?: (cardState: CardState, kind: string, row: number, col: number, playerKey: PlayerKey, data: any) => any;
    emitPresentationEvent?: (cardState: CardState, event: any) => void;
    MARKER_KINDS?: any;
    expectedSpecialType?: string;
    moveCause?: string;
    moveReason?: string;
}

function resolveDeterministicPrng(prng: any, deps: HyperactiveDeps | undefined, label: string): any {
    if (HyperactiveCoreUtils && typeof HyperactiveCoreUtils.resolveDeterministicPrng === 'function') {
        return HyperactiveCoreUtils.resolveDeterministicPrng(prng, deps, label, RandomSourceModule);
    }
    const fallback = deps && deps.defaultPrng;
    if (RandomSourceModule && typeof RandomSourceModule.resolveRandomSource === 'function') {
        return RandomSourceModule.resolveRandomSource(prng, fallback, label);
    }
    if (prng && typeof prng.random === 'function') return prng;
    if (fallback && typeof fallback.random === 'function') return fallback;
    throw new Error(`${String(label || 'CardHyperactive').trim() || 'CardHyperactive'} requires an injected deterministic PRNG.`);
}

function toCounterOrNull(value: any): number | null {
    if (HyperactiveCoreUtils && typeof HyperactiveCoreUtils.toCounterOrNull === 'function') {
        return HyperactiveCoreUtils.toCounterOrNull(value);
    }
    if (value === null || value === undefined || value === '') return null;
    const n = Number(value);
    if (!Number.isFinite(n)) return null;
    return Math.max(0, Math.trunc(n));
}

function compactPresentationMeta(meta: any): any {
    if (HyperactiveCoreUtils && typeof HyperactiveCoreUtils.compactPresentationMeta === 'function') {
        return HyperactiveCoreUtils.compactPresentationMeta(meta);
    }
    if (!meta || typeof meta !== 'object') return undefined;
    const out: any = {};
    for (const [key, value] of Object.entries(meta)) {
        if (value !== null && value !== undefined) out[key] = value;
    }
    return Object.keys(out).length ? out : undefined;
}

function buildMovingStonePresentationMeta(cardState: CardState, row: number, col: number): any {
    const markersAtCell = Array.isArray(cardState && (cardState as any).markers)
        ? (cardState as any).markers.filter((marker: any) => (
            marker &&
            marker.kind === 'specialStone' &&
            marker.row === row &&
            marker.col === col
        ))
        : [];
    if (!markersAtCell.length) return undefined;

    if (!StoneStatusSnapshot || typeof StoneStatusSnapshot.resolveStoneVisualStatusFromMarkers !== 'function') {
        throw new Error('StoneStatusSnapshot.resolveStoneVisualStatusFromMarkers is required by CardHyperactive');
    }
    return compactPresentationMeta(StoneStatusSnapshot.resolveStoneVisualStatusFromMarkers(markersAtCell, {
        mode: 'raw'
    }));
}

function resolveBoardConfig(gameState: GameState): BoardConfig {
    return invokeBoardShapeMethod('resolveBoardConfig', [gameState]);
}

function isMainBoardCell(row: number, col: number, gameState: GameState): boolean {
    return invokeBoardShapeMethod('isMainBoardCell', [row, col, gameState]);
}

function resolveExpansionSide(side: string | null, row: number, col: number, gameState: GameState): string | null {
    return invokeBoardShapeMethod('resolveExpansionSide', [side, row, col, gameState]);
}

function hasBoardShapeCell(cardState: CardState, gameState: GameState, row: number, col: number): boolean {
    return invokeBoardShapeMethod('hasBoardShapeCell', [gameState, row, col, cardState]);
}

function forEachBoardShapeCell(cardState: CardState, gameState: GameState, visitor: (row: number, col: number, value: any, side?: string) => void): void {
    invokeBoardShapeMethod('forEachBoardShapeCell', [gameState, visitor, cardState]);
}

function getBoardCell(cardState: CardState, gameState: GameState, row: number, col: number): number | null {
    return invokeBoardShapeMethod('getBoardCell', [gameState, row, col, cardState]);
}

function setBoardCell(cardState: CardState, gameState: GameState, row: number, col: number, value: number): boolean {
    return invokeBoardShapeMethod('setBoardCell', [gameState, row, col, value, cardState]);
}

function getExplicitCardContext(cardState: CardState, deps: HyperactiveDeps): any {
    const context = deps && typeof deps.getCardContext === 'function'
        ? deps.getCardContext(cardState)
        : {};
    return { ...(context || {}), cardState };
}

function clearUltimateHyperactiveAtPositions(cardState: CardState, positions: Position[]): void {
    if (!cardState || !Array.isArray((cardState as any).markers)) return;
    const removeSet = new Set((positions || []).map(p => `${p.row},${p.col}`));
    (cardState as any).markers = (cardState as any).markers.filter((m: any) => {
        if (!m || m.kind !== 'specialStone') return true;
        if (!m.data || m.data.type !== 'ULTIMATE_HYPERACTIVE') return true;
        return !removeSet.has(`${m.row},${m.col}`);
    });
}

function getNeighborEmptyCandidates(
    cardState: CardState,
    gameState: GameState,
    row: number,
    col: number,
    deps: { isBlockedCell?: HyperactiveDeps['isBlockedCell'] },
    options: { includeOccupied?: boolean } = {}
): Candidate[] {
    const emptyOut: Candidate[] = [];
    const occupiedOut: Candidate[] = [];
    const isBlockedCell = deps && typeof deps.isBlockedCell === 'function'
        ? deps.isBlockedCell
        : (() => false);
    const includeOccupied = options && options.includeOccupied === true;
    for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
            if (dr === 0 && dc === 0) continue;
            const r = row + dr;
            const c = col + dc;
            if (!hasBoardShapeCell(cardState, gameState, r, c)) continue;
            if (isBlockedCell(cardState, r, c, gameState)) continue;
            const occupied = getBoardCell(cardState, gameState, r, c) !== EMPTY;
            if (!occupied) {
                emptyOut.push({ row: r, col: c, occupied: false });
            } else if (includeOccupied) {
                occupiedOut.push({ row: r, col: c, occupied: true });
            }
        }
    }
    return includeOccupied ? emptyOut.concat(occupiedOut) : emptyOut;
}

/**
 * Move one anchored special stone to a random adjacent empty cell without
 * applying the hyperactive-specific flip or no-candidate destruction rules.
 * Card-specific turn-start effects can use this to share the canonical
 * topology, PRNG, marker-transfer, and presentation path.
 */
function moveRandomAdjacentStoneAtAnchor(
    cardState: CardState,
    gameState: GameState,
    playerKey: PlayerKey,
    row: number,
    col: number,
    prng: any,
    deps: HyperactiveDeps = {}
): HyperactiveMoveResult {
    const expectedSpecialType = String(deps && deps.expectedSpecialType ? deps.expectedSpecialType : '').toUpperCase();
    const entry: MarkerEntry | undefined = ((cardState as any).markers || []).find((marker: any) => (
        marker &&
        marker.kind === 'specialStone' &&
        marker.data &&
        (!expectedSpecialType || String(marker.data.type || '').toUpperCase() === expectedSpecialType) &&
        marker.owner === playerKey &&
        marker.row === row &&
        marker.col === col
    ));
    const ownerKey = playerKey === 'white' ? 'white' : 'black';
    if (!entry) return { moved: [], destroyed: [], flipped: [], ownerKey };

    const ownerVal = ownerKey === 'black' ? (BLACK || 1) : (WHITE || -1);
    if (getBoardCell(cardState, gameState, row, col) !== ownerVal) {
        return { moved: [], destroyed: [], flipped: [], ownerKey };
    }

    const isBlockedCell = typeof deps.isBlockedCell === 'function'
        ? deps.isBlockedCell
        : (() => false);
    const candidates = getNeighborEmptyCandidates(
        cardState,
        gameState,
        row,
        col,
        { isBlockedCell }
    );
    if (candidates.length === 0) {
        return { moved: [], destroyed: [], flipped: [], ownerKey };
    }

    const p = resolveDeterministicPrng(prng, deps, 'CardHyperactive.moveRandomAdjacentStoneAtAnchor');
    const index = Math.floor(p.random() * candidates.length);
    const target = candidates[index] || candidates[0] || null;
    if (!target) return { moved: [], destroyed: [], flipped: [], ownerKey };

    const moveCause = String(deps.moveCause || 'HYPERACTIVE');
    const moveReason = String(deps.moveReason || 'hyperactive_move');
    let movedRes = false;
    let usedBoardOpsMove = false;
    if (deps.BoardOps && typeof deps.BoardOps.moveAt === 'function') {
        const result = deps.BoardOps.moveAt(
            cardState,
            gameState,
            row,
            col,
            target.row,
            target.col,
            moveCause,
            moveReason,
            Object.assign({}, buildMovingStonePresentationMeta(cardState, row, col), {
                moveIntent: 'hyperactive_move'
            })
        );
        movedRes = !!(result && result.moved);
        usedBoardOpsMove = !!(result && result.markerHandled === true);
    } else {
        setBoardCell(cardState, gameState, row, col, EMPTY);
        setBoardCell(cardState, gameState, target.row, target.col, ownerVal);
        movedRes = true;
    }
    if (!movedRes) return { moved: [], destroyed: [], flipped: [], ownerKey };

    if (!usedBoardOpsMove) {
        moveCoexistingSpecialMarkers(cardState, entry, row, col, target.row, target.col);
    }
    entry.row = target.row;
    entry.col = target.col;

    return {
        moved: [{
            from: { row, col },
            to: { row: target.row, col: target.col },
            specialType: String(entry.data && entry.data.type || expectedSpecialType || '').toUpperCase() || undefined
        }],
        destroyed: [],
        flipped: [],
        ownerKey
    };
}

function getBoardShapeEmptyCandidates(
    cardState: CardState,
    gameState: GameState,
    deps: { isBlockedCell?: HyperactiveDeps['isBlockedCell'] }
): Candidate[] {
    const out: Candidate[] = [];
    const seen = new Set<string>();
    const isBlockedCell = deps && typeof deps.isBlockedCell === 'function'
        ? deps.isBlockedCell
        : (() => false);
    forEachBoardShapeCell(cardState, gameState, (row, col, value) => {
        if (!Number.isInteger(row) || !Number.isInteger(col)) return;
        const key = `${row},${col}`;
        if (seen.has(key)) return;
        seen.add(key);
        if (value !== EMPTY) return;
        if (isBlockedCell(cardState, row, col, gameState)) return;
        out.push({ row, col, occupied: false });
    });
    return out;
}

function getStraightLineEmptyCandidates(
    cardState: CardState,
    gameState: GameState,
    row: number,
    col: number,
    deps: HyperactiveDeps,
    options: { maxDistance?: number; allowJumpOverStones?: boolean } = {}
): Candidate[] {
    const out: Candidate[] = [];
    const isBlockedCell = deps && typeof deps.isBlockedCell === 'function'
        ? deps.isBlockedCell
        : (() => false);
    const maxDistance = Number.isInteger(options.maxDistance) && (options.maxDistance as number) > 0
        ? options.maxDistance
        : 1;
    const allowJumpOverStones = options.allowJumpOverStones === true;

    for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
            if (dr === 0 && dc === 0) continue;

            for (let distance = 1; distance <= (maxDistance as number); distance++) {
                const targetRow = row + (dr * distance);
                const targetCol = col + (dc * distance);
                if (!hasBoardShapeCell(cardState, gameState, targetRow, targetCol)) break;

                let blockedOnPath = false;
                for (let step = 1; step <= distance; step++) {
                    const stepRow = row + (dr * step);
                    const stepCol = col + (dc * step);
                    if (!hasBoardShapeCell(cardState, gameState, stepRow, stepCol)) {
                        blockedOnPath = true;
                        break;
                    }
                    if (isBlockedCell(cardState, stepRow, stepCol, gameState)) {
                        blockedOnPath = true;
                        break;
                    }
                }
                if (blockedOnPath) break;

                const occupied = getBoardCell(cardState, gameState, targetRow, targetCol) !== EMPTY;
                if (occupied) {
                    if (!allowJumpOverStones) break;
                    continue;
                }

                out.push({ row: targetRow, col: targetCol, distance, dr, dc });
            }
        }
    }

    return out;
}

function getChebyshevDistance(from: Position | null, to: Position | null): number {
    if (!from || !to) return 0;
    return Math.max(Math.abs(from.row - to.row), Math.abs(from.col - to.col));
}

function collectEscapeThreats(cardState: CardState, gameState: GameState, ownerVal: number, originRow: number, originCol: number): Position[] {
    const BLACK_VAL = BLACK || 1;
    const WHITE_VAL = WHITE || -1;
    const enemyVal = ownerVal === BLACK_VAL ? WHITE_VAL : BLACK_VAL;
    const enemies: Position[] = [];
    const allStones: Position[] = [];

    forEachBoardShapeCell(cardState, gameState, (r, c, value) => {
        if (value === EMPTY) return;
        if (r === originRow && c === originCol) return;
        const point: Position = { row: r, col: c };
        allStones.push(point);
        if (value === enemyVal) enemies.push(point);
    });

    return enemies.length > 0 ? enemies : allStones;
}

function pickEscapeTarget(candidates: Candidate[], threats: Position[]): Candidate | null {
    if (!Array.isArray(candidates) || candidates.length === 0) return null;
    const threatPoints = Array.isArray(threats) ? threats : [];
    const scored = candidates.map((candidate) => {
        if (threatPoints.length === 0) {
            return {
                candidate,
                nearestDistance: Number.POSITIVE_INFINITY,
                totalDistance: Number.POSITIVE_INFINITY
            };
        }

        let nearestDistance = Number.POSITIVE_INFINITY;
        let totalDistance = 0;
        for (const threat of threatPoints) {
            const dist = getChebyshevDistance(candidate, threat);
            if (dist < nearestDistance) nearestDistance = dist;
            totalDistance += dist;
        }
        return { candidate, nearestDistance, totalDistance };
    });

    scored.sort((a, b) => {
        if (a.nearestDistance !== b.nearestDistance) return b.nearestDistance - a.nearestDistance;
        if (a.totalDistance !== b.totalDistance) return b.totalDistance - a.totalDistance;
        if (a.candidate.row !== b.candidate.row) return a.candidate.row - b.candidate.row;
        return a.candidate.col - b.candidate.col;
    });

    return scored[0] ? scored[0].candidate : null;
}

function collectRobotVacuumEnemies(cardState: CardState, gameState: GameState, ownerVal: number, originRow: number, originCol: number): Position[] {
    const BLACK_VAL = BLACK || 1;
    const WHITE_VAL = WHITE || -1;
    const enemyVal = ownerVal === BLACK_VAL ? WHITE_VAL : BLACK_VAL;
    const enemies: Position[] = [];

    forEachBoardShapeCell(cardState, gameState, (r, c, value) => {
        if (r === originRow && c === originCol) return;
        if (value !== enemyVal) return;
        enemies.push({ row: r, col: c });
    });

    return enemies;
}

function pickRobotVacuumApproachTarget(candidates: Candidate[], enemyPoints: Position[], prng: any): Candidate | null {
    if (!Array.isArray(candidates) || candidates.length === 0) return null;
    const randomSource = resolveDeterministicPrng(prng, undefined, 'CardHyperactive.pickRobotVacuumApproachTarget');
    const enemies = Array.isArray(enemyPoints) ? enemyPoints : [];

    if (enemies.length === 0) {
        const fallbackIndex = Math.floor(randomSource.random() * candidates.length);
        return candidates[fallbackIndex] || candidates[0] || null;
    }

    let bestScore: { nearestDistance: number; adjacentEnemyCount: number; totalDistance: number } | null = null;
    let bestCandidates: Candidate[] = [];

    for (const candidate of candidates) {
        let nearestDistance = Number.POSITIVE_INFINITY;
        let totalDistance = 0;
        let adjacentEnemyCount = 0;

        for (const enemy of enemies) {
            const dist = getChebyshevDistance(candidate, enemy);
            if (dist < nearestDistance) nearestDistance = dist;
            totalDistance += dist;
            if (dist === 1) adjacentEnemyCount += 1;
        }

        const score = { nearestDistance, adjacentEnemyCount, totalDistance };

        if (!bestScore) {
            bestScore = score;
            bestCandidates = [candidate];
            continue;
        }

        const isBetter = (
            score.nearestDistance < bestScore.nearestDistance ||
            (score.nearestDistance === bestScore.nearestDistance && score.adjacentEnemyCount > bestScore.adjacentEnemyCount) ||
            (score.nearestDistance === bestScore.nearestDistance &&
                score.adjacentEnemyCount === bestScore.adjacentEnemyCount &&
                score.totalDistance < bestScore.totalDistance)
        );

        if (isBetter) {
            bestScore = score;
            bestCandidates = [candidate];
            continue;
        }

        const isSameScore = (
            score.nearestDistance === bestScore.nearestDistance &&
            score.adjacentEnemyCount === bestScore.adjacentEnemyCount &&
            score.totalDistance === bestScore.totalDistance
        );

        if (isSameScore) bestCandidates.push(candidate);
    }

    if (bestCandidates.length <= 1) return bestCandidates[0] || candidates[0] || null;
    const pickIndex = Math.floor(randomSource.random() * bestCandidates.length);
    return bestCandidates[pickIndex] || bestCandidates[0] || candidates[0] || null;
}

function moveCoexistingSpecialMarkers(cardState: CardState, anchorEntry: any, fromRow: number, fromCol: number, toRow: number, toCol: number): void {
    if (!Array.isArray(cardState && (cardState as any).markers)) return;
    for (const marker of (cardState as any).markers) {
        if (!marker || marker === anchorEntry) continue;
        if (marker.row !== fromRow || marker.col !== fromCol) continue;
        if (!SpecialStoneRegistry || typeof SpecialStoneRegistry.isBoardMarker !== 'function') {
            throw new Error('SpecialStoneRegistry.isBoardMarker is required by CardHyperactive');
        }
        const boardMarker = SpecialStoneRegistry.isBoardMarker(marker);
        if (boardMarker) continue;
        marker.row = toRow;
        marker.col = toCol;
    }
}

function selectExtremeRepelTarget(
    cardState: CardState,
    gameState: GameState,
    entry: MarkerEntry,
    fromRow: number,
    fromCol: number,
    dr: number,
    dc: number,
    isBlockedCell: (cardState: CardState, row: number, col: number, gameState: GameState) => boolean
): Position | null {
    const origin: Position = { row: entry.row, col: entry.col };
    const currentDistance = getChebyshevDistance({ row: fromRow, col: fromCol }, origin);
    const candidates: Array<Position & { directMatch: number; nextDistance: number; awayScore: number }> = [];

    for (let moveDr = -1; moveDr <= 1; moveDr++) {
        for (let moveDc = -1; moveDc <= 1; moveDc++) {
            if (moveDr === 0 && moveDc === 0) continue;

            const toRow = fromRow + moveDr;
            const toCol = fromCol + moveDc;
            if (!hasBoardShapeCell(cardState, gameState, toRow, toCol)) continue;
            if (isBlockedCell(cardState, toRow, toCol, gameState)) continue;
            if (getBoardCell(cardState, gameState, toRow, toCol) !== EMPTY) continue;

            const nextDistance = getChebyshevDistance({ row: toRow, col: toCol }, origin);
            if (nextDistance <= currentDistance) continue;

            const directMatch = (moveDr === dr && moveDc === dc) ? 1 : 0;
            const awayScore = ((toRow - entry.row) * dr) + ((toCol - entry.col) * dc);
            candidates.push({ row: toRow, col: toCol, directMatch, nextDistance, awayScore });
        }
    }

    if (!candidates.length) return null;
    candidates.sort((a, b) => {
        if (b.directMatch !== a.directMatch) return b.directMatch - a.directMatch;
        if (b.nextDistance !== a.nextDistance) return b.nextDistance - a.nextDistance;
        if (b.awayScore !== a.awayScore) return b.awayScore - a.awayScore;
        if (a.row !== b.row) return a.row - b.row;
        return a.col - b.col;
    });
    return { row: candidates[0].row, col: candidates[0].col };
}

function canExtremeHyperactiveSwapCell(cardState: CardState, row: number, col: number, deps: HyperactiveDeps): boolean {
    if (deps && typeof deps.isFrozenCell === 'function' && deps.isFrozenCell(cardState, row, col)) {
        return false;
    }
    if (deps && typeof deps.isInviolableCell === 'function' && deps.isInviolableCell(cardState, row, col)) {
        return false;
    }
    return true;
}

function isUntargetableStone(cardState: CardState, row: number, col: number, deps: HyperactiveDeps = {}): boolean {
    if (deps && typeof deps.isInviolableCell === 'function') {
        return !!deps.isInviolableCell(cardState, row, col);
    }
    if (CardMarkersModule && typeof CardMarkersModule.isInviolableCell === 'function') {
        return !!CardMarkersModule.isInviolableCell(cardState, row, col);
    }
    if (deps && typeof deps.isManifestStoneAt === 'function') {
        return !!deps.isManifestStoneAt(cardState, row, col);
    }
    if (CardMarkersModule && typeof CardMarkersModule.isManifestStoneAt === 'function') {
        return !!CardMarkersModule.isManifestStoneAt(cardState, row, col);
    }
    const markers = (cardState && Array.isArray((cardState as any).markers)) ? (cardState as any).markers : [];
    return markers.some((marker: any) => (
        marker &&
        marker.row === row &&
        marker.col === col &&
        (marker.kind === 'manifestStone' || marker.kind === 'specialStone') &&
        MANIFEST_STONE_TYPES.has(String(marker.data && marker.data.type || '').toUpperCase())
    ));
}

function applyExtremeHyperactiveRepel(cardState: CardState, gameState: GameState, entry: MarkerEntry, deps: HyperactiveDeps = {}): MoveResult[] {
    if (!entry) return [];
    const isBlockedCell = typeof deps.isBlockedCell === 'function'
        ? deps.isBlockedCell
        : (() => false);
    const repelled: MoveResult[] = [];

    for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
            if (dr === 0 && dc === 0) continue;

            const fromRow = entry.row + dr;
            const fromCol = entry.col + dc;
            if (!hasBoardShapeCell(cardState, gameState, fromRow, fromCol)) continue;

            const sourceVal = getBoardCell(cardState, gameState, fromRow, fromCol);
            if (sourceVal === null || sourceVal === EMPTY) continue;

            const target = selectExtremeRepelTarget(cardState, gameState, entry, fromRow, fromCol, dr, dc, isBlockedCell);
            if (!target) continue;

            let movedRes = false;
            let usedBoardOpsMove = false;
            if (deps.BoardOps && typeof deps.BoardOps.moveAt === 'function') {
                const res = deps.BoardOps.moveAt(
                    cardState,
                    gameState,
                    fromRow,
                    fromCol,
                    target.row,
                    target.col,
                    'EXTREME_HYPERACTIVE_WILL',
                    'extreme_repel_push',
                    {
                        sourceRow: entry.row,
                        sourceCol: entry.col,
                        repelledBy: 'EXTREME_HYPERACTIVE'
                    }
                );
                movedRes = !!(res && res.moved);
                usedBoardOpsMove = !!(res && res.markerHandled === true);
            } else {
                setBoardCell(cardState, gameState, fromRow, fromCol, EMPTY);
                setBoardCell(cardState, gameState, target.row, target.col, sourceVal);
                movedRes = true;
            }

            if (!movedRes) continue;

            if (!usedBoardOpsMove) {
                moveCoexistingSpecialMarkers(cardState, null, fromRow, fromCol, target.row, target.col);
            }
            repelled.push({
                from: { row: fromRow, col: fromCol },
                to: { row: target.row, col: target.col },
                source: { row: entry.row, col: entry.col },
                specialType: 'EXTREME_HYPERACTIVE'
            });
        }
    }

    return repelled;
}

function normalizeFlipCell(cell: any): Position | null {
    if (Array.isArray(cell) && Number.isInteger(cell[0]) && Number.isInteger(cell[1])) {
        return { row: cell[0], col: cell[1] };
    }
    if (cell && Number.isInteger(cell.row) && Number.isInteger(cell.col)) {
        return { row: cell.row, col: cell.col };
    }
    return null;
}

type FlipEvadeProfile = {
    flipDefault?: number;
    destroyDefault?: number;
    visualFlipDefault?: number;
    flipCause?: string;
    flipMoveReason?: string;
    requiresActiveDuration?: boolean;
    pruneWhenBothDepleted?: boolean;
};

function getEvasionStatusModule(): any {
    return EvasionStatusModule;
}

function getFlipEvadeProfile(markerTypeUpper: string): FlipEvadeProfile | null {
    const evasionStatus = getEvasionStatusModule();
    if (!markerTypeUpper || !evasionStatus || typeof evasionStatus.getEvasionProfile !== 'function') return null;
    return evasionStatus.getEvasionProfile(markerTypeUpper) || null;
}

function getFlipEvadeMarkerType(entry: MarkerEntry): string | null {
    const evasionStatus = getEvasionStatusModule();
    const type = evasionStatus && typeof evasionStatus.normalizeEvasionType === 'function'
        ? evasionStatus.normalizeEvasionType(entry)
        : String(entry && entry.data && entry.data.type ? entry.data.type : '').toUpperCase();
    if (!type) return null;
    const profile = getFlipEvadeProfile(type);
    if (!profile) return null;
    if (
        profile.flipDefault === undefined &&
        !(evasionStatus && typeof evasionStatus.readFlipEvadeRemaining === 'function' && evasionStatus.readFlipEvadeRemaining(entry) !== null)
    ) {
        return null;
    }
    return type;
}

function findFlipEvadeMarkersAt(cardState: CardState, row: number, col: number): MarkerEntry[] {
    if (!cardState || !Array.isArray((cardState as any).markers)) return [];
    const out: MarkerEntry[] = [];
    for (const marker of (cardState as any).markers) {
        if (!marker || marker.kind !== 'specialStone') continue;
        if (marker.row !== row || marker.col !== col) continue;
        if (!getFlipEvadeMarkerType(marker)) continue;
        out.push(marker);
    }
    return out;
}

function canUseFlipEvade(entry: MarkerEntry, markerTypeUpper: string): boolean {
    const evasionStatus = getEvasionStatusModule();
    if (!entry || !markerTypeUpper || !evasionStatus || typeof evasionStatus.canUseFlipEvade !== 'function') return false;
    return !!evasionStatus.canUseFlipEvade(entry);
}

function consumeFlipEvade(entry: MarkerEntry, markerTypeUpper: string): void {
    const evasionStatus = getEvasionStatusModule();
    if (!entry || !markerTypeUpper || !evasionStatus || typeof evasionStatus.consumeFlipEvade !== 'function') return;
    evasionStatus.consumeFlipEvade(entry);
}

function pruneAfterimageMarkerIfDepleted(cardState: CardState, entry: MarkerEntry): void {
    if (!cardState || !Array.isArray((cardState as any).markers) || !entry || !entry.data) return;
    const evasionStatus = getEvasionStatusModule();
    if (!evasionStatus || typeof evasionStatus.shouldPruneEvasionMarker !== 'function') return;
    if (!evasionStatus.shouldPruneEvasionMarker(entry)) return;
    (cardState as any).markers = (cardState as any).markers.filter((marker: any) => marker !== entry);
}

function removeFlipEvadeMarkerAt(cardState: CardState, row: number, col: number, deps: HyperactiveDeps = {}): void {
    if (deps && typeof deps.clearHyperactiveAtPositions === 'function') {
        deps.clearHyperactiveAtPositions(cardState, [{ row, col }]);
        return;
    }
    if (!cardState || !Array.isArray((cardState as any).markers)) return;
    (cardState as any).markers = (cardState as any).markers.filter((marker: any) => {
        if (!marker || marker.kind !== 'specialStone') return true;
        if (marker.row !== row || marker.col !== col) return true;
        const markerType = getFlipEvadeMarkerType(marker);
        return !markerType;
    });
}

function getFlipEvadeCause(markerTypeUpper: string): string {
    const evasionStatus = getEvasionStatusModule();
    if (evasionStatus && typeof evasionStatus.getFlipEvadeCause === 'function') {
        return evasionStatus.getFlipEvadeCause(markerTypeUpper) || 'HYPERACTIVE';
    }
    return 'HYPERACTIVE';
}

function getFlipEvadeMoveReason(markerTypeUpper: string): string {
    const evasionStatus = getEvasionStatusModule();
    if (evasionStatus && typeof evasionStatus.getFlipEvadeMoveReason === 'function') {
        return evasionStatus.getFlipEvadeMoveReason(markerTypeUpper) || 'hyperactive_flip_evade_move';
    }
    return 'hyperactive_flip_evade_move';
}

function resolveOwnerFromBoardValue(value: any): { ownerKey: PlayerKey; ownerVal: number } | null {
    const blackVal = BLACK || 1;
    const whiteVal = WHITE || -1;
    if (value === blackVal) return { ownerKey: 'black', ownerVal: blackVal };
    if (value === whiteVal) return { ownerKey: 'white', ownerVal: whiteVal };
    return null;
}

function resolveEvasionMoveFlips(
    cardState: CardState,
    gameState: GameState,
    origin: Position,
    prng: any,
    deps: HyperactiveDeps = {},
    options: { flipCause?: string; flipReason?: string; buildFlippedDetail?: (cell: Position) => any } = {}
): { ownerKey: PlayerKey | null; flipped: any[]; moved: MoveResult[]; destroyed: DestroyResult[] } {
    if (!origin || !Number.isInteger(origin.row) || !Number.isInteger(origin.col)) {
        return { ownerKey: null, flipped: [], moved: [], destroyed: [] };
    }
    if (typeof deps.getFlipsWithContext !== 'function') {
        return { ownerKey: null, flipped: [], moved: [], destroyed: [] };
    }
    const owner = resolveOwnerFromBoardValue(getBoardCell(cardState, gameState, origin.row, origin.col));
    if (!owner) return { ownerKey: null, flipped: [], moved: [], destroyed: [] };

    let flipCells: any[] = [];
    setBoardCell(cardState, gameState, origin.row, origin.col, EMPTY);
    try {
        flipCells = deps.getFlipsWithContext(
            gameState,
            origin.row,
            origin.col,
            owner.ownerVal,
            getExplicitCardContext(cardState, deps)
        );
    } finally {
        setBoardCell(cardState, gameState, origin.row, origin.col, owner.ownerVal);
    }

    if (!Array.isArray(flipCells) || flipCells.length === 0) {
        return { ownerKey: owner.ownerKey, flipped: [], moved: [], destroyed: [] };
    }

    const flipResult = applyFlipCellsWithEvasion(
        cardState,
        gameState,
        flipCells,
        owner.ownerKey,
        owner.ownerVal,
        prng,
        deps,
        options
    );
    return {
        ownerKey: owner.ownerKey,
        flipped: flipResult.flipped,
        moved: flipResult.moved,
        destroyed: flipResult.destroyed
    };
}

function resolveHyperactiveFlipEvasion(
    cardState: CardState,
    gameState: GameState,
    flipCells: any[],
    ownerAfterKey: PlayerKey,
    prng: any,
    deps: HyperactiveDeps = {}
): FlipEvasionResult {
    const moved: MoveResult[] = [];
    const destroyed: DestroyResult[] = [];
    const flipped: any[] = [];
    const evadedSet = new Set<string>();
    const parsedFlips = (Array.isArray(flipCells) ? flipCells : [])
        .map((cell) => normalizeFlipCell(cell))
        .filter((cell): cell is Position => !!cell);

    if (parsedFlips.length === 0) {
        return { remainingFlips: [], moved, destroyed, evaded: [], flipped };
    }

    const p = resolveDeterministicPrng(prng, deps, 'CardHyperactive.consumeFlipEvadeMarkers');
    const isBlockedCell = (deps && typeof deps.isBlockedCell === 'function')
        ? deps.isBlockedCell
        : (() => false);

    const blackVal = BLACK || 1;
    const whiteVal = WHITE || -1;
    const ownerAfterNormalized = ownerAfterKey === 'white' ? 'white' : 'black';
    const ownerAfterVal = ownerAfterNormalized === 'black' ? blackVal : whiteVal;
    const ownerBeforeVal = ownerAfterVal === blackVal ? whiteVal : blackVal;
    const forbiddenTargets = new Set(parsedFlips.map((cell) => `${cell.row},${cell.col}`));
    const processed = new Set<string>();

    for (const flip of parsedFlips) {
        const key = `${flip.row},${flip.col}`;
        if (processed.has(key)) continue;
        processed.add(key);

        if (getBoardCell(cardState, gameState, flip.row, flip.col) !== ownerBeforeVal) continue;

        const evadeMarkers = findFlipEvadeMarkersAt(cardState, flip.row, flip.col);
        if (!evadeMarkers.length) continue;
        let entry: MarkerEntry | null = null;
        let markerTypeUpper: string | null = null;
        for (const marker of evadeMarkers) {
            const t = getFlipEvadeMarkerType(marker);
            if (!t) continue;
            if (!canUseFlipEvade(marker, t)) continue;
            entry = marker;
            markerTypeUpper = t;
            break;
        }
        if (!entry || !markerTypeUpper) continue;

        const sourceOwner = resolveOwnerFromBoardValue(getBoardCell(cardState, gameState, entry.row, entry.col));
        if (!sourceOwner || sourceOwner.ownerVal !== ownerBeforeVal) continue;
        const ownerVal = sourceOwner.ownerVal;

        const cause = getFlipEvadeCause(markerTypeUpper);
        const moveReason = getFlipEvadeMoveReason(markerTypeUpper);

        let candidatePool = getBoardShapeEmptyCandidates(cardState, gameState, { isBlockedCell })
            .filter((candidate) => !forbiddenTargets.has(`${candidate.row},${candidate.col}`));

        let movedRes = false;
        while (candidatePool.length > 0) {
            if (!EvasionDestinationModule || typeof EvasionDestinationModule.selectNearestEmptyEvasionDestination !== 'function') {
                throw new Error('CardEvasionDestination.selectNearestEmptyEvasionDestination is unavailable');
            }
            const target = EvasionDestinationModule.selectNearestEmptyEvasionDestination(
                { row: entry.row, col: entry.col },
                candidatePool,
                p,
                { forbiddenCells: Array.from(forbiddenTargets).map((forbiddenKey) => {
                    const [forbiddenRow, forbiddenCol] = forbiddenKey.split(',').map(Number);
                    return { row: forbiddenRow, col: forbiddenCol };
                }) }
            );
            if (!target) break;

            const fromRow = entry.row;
            const fromCol = entry.col;

            let usedBoardOpsMove = false;
            if (deps.BoardOps && typeof deps.BoardOps.moveAt === 'function') {
                const res = deps.BoardOps.moveAt(
                    cardState,
                    gameState,
                    fromRow,
                    fromCol,
                    target.row,
                    target.col,
                    cause,
                    moveReason,
                    Object.assign({}, buildMovingStonePresentationMeta(cardState, fromRow, fromCol), { evade: true })
                );
                movedRes = !!(res && res.moved);
                usedBoardOpsMove = !!(res && res.markerHandled === true);
            } else {
                setBoardCell(cardState, gameState, fromRow, fromCol, EMPTY);
                setBoardCell(cardState, gameState, target.row, target.col, ownerVal);
                movedRes = true;
            }

            if (movedRes) {
                if (!usedBoardOpsMove) {
                    moveCoexistingSpecialMarkers(cardState, entry, fromRow, fromCol, target.row, target.col);
                }
                entry.row = target.row;
                entry.col = target.col;
                consumeFlipEvade(entry, markerTypeUpper);
                pruneAfterimageMarkerIfDepleted(cardState, entry);
                moved.push({
                    from: { row: fromRow, col: fromCol },
                    to: { row: target.row, col: target.col },
                    specialType: markerTypeUpper
                });
                evadedSet.add(key);
                const evasionMoveFlipResult = resolveEvasionMoveFlips(
                    cardState,
                    gameState,
                    { row: target.row, col: target.col },
                    p,
                    deps,
                    {
                        flipCause: cause,
                        flipReason: `${moveReason}_flip`,
                        buildFlippedDetail: (cell: Position) => ({ row: cell.row, col: cell.col, specialType: markerTypeUpper })
                    }
                );
                if (evasionMoveFlipResult.moved.length) moved.push(...evasionMoveFlipResult.moved);
                if (evasionMoveFlipResult.destroyed.length) destroyed.push(...evasionMoveFlipResult.destroyed);
                if (evasionMoveFlipResult.flipped.length) flipped.push(...evasionMoveFlipResult.flipped);
                break;
            }

            candidatePool = candidatePool.filter((candidate) => !(candidate.row === target!.row && candidate.col === target!.col));
        }

        if (movedRes) continue;
    }

    const remainingFlips: Array<[number, number]> = [];
    for (const flip of parsedFlips) {
        const key = `${flip.row},${flip.col}`;
        if (evadedSet.has(key)) continue;
        if (getBoardCell(cardState, gameState, flip.row, flip.col) !== ownerBeforeVal) continue;
        remainingFlips.push([flip.row, flip.col]);
    }

    const evaded = Array.from(evadedSet).map((key) => {
        const parts = key.split(',');
        return { row: Number(parts[0]), col: Number(parts[1]) };
    });

    return { remainingFlips, moved, destroyed, evaded, flipped };
}

function applyFlipCellsWithEvasion(
    cardState: CardState,
    gameState: GameState,
    flipCells: any[],
    ownerKey: PlayerKey,
    ownerVal: number,
    prng: any,
    deps: HyperactiveDeps = {},
    options: { flipCause?: string; flipReason?: string; buildFlippedDetail?: (cell: Position) => any } = {}
): { flipped: any[]; moved: MoveResult[]; destroyed: DestroyResult[] } {
    const parsedFlips = (Array.isArray(flipCells) ? flipCells : [])
        .map((cell) => normalizeFlipCell(cell))
        .filter((cell): cell is Position => !!cell);
    if (parsedFlips.length === 0) {
        return { flipped: [], moved: [], destroyed: [] };
    }

    const clearSpecialAtPositions = typeof deps.clearHyperactiveAtPositions === 'function'
        ? deps.clearHyperactiveAtPositions
        : (() => {});
    const evasionResult = resolveHyperactiveFlipEvasion(
        cardState,
        gameState,
        parsedFlips,
        ownerKey,
        prng,
        {
            defaultPrng: deps.defaultPrng,
            clearHyperactiveAtPositions: clearSpecialAtPositions,
            isBlockedCell: deps.isBlockedCell,
            BoardOps: deps.BoardOps,
            destroyAt: deps.destroyAt,
            getCardContext: deps.getCardContext,
            getFlipsWithContext: deps.getFlipsWithContext
        }
    );

    const remainingFlips = (Array.isArray(evasionResult && evasionResult.remainingFlips)
        ? evasionResult.remainingFlips
        : [])
        .map((cell) => normalizeFlipCell(cell))
        .filter((cell): cell is Position => !!cell);
    const flipped: any[] = [];

    for (const cell of remainingFlips) {
        let changed = true;
        if (deps.BoardOps && typeof deps.BoardOps.changeAt === 'function') {
            const changeRes = deps.BoardOps.changeAt(cardState, gameState, cell.row, cell.col, ownerKey, options.flipCause, options.flipReason);
            changed = !!(changeRes && changeRes.changed);
        } else {
            changed = setBoardCell(cardState, gameState, cell.row, cell.col, ownerVal);
        }
        if (!changed) continue;

        flipped.push(typeof options.buildFlippedDetail === 'function'
            ? options.buildFlippedDetail(cell)
            : { row: cell.row, col: cell.col });
    }

    if (flipped.length > 0) {
        clearSpecialAtPositions(cardState, flipped.map((detail: any) => ({ row: detail.row, col: detail.col })));
    }

    return {
        flipped,
        moved: Array.isArray(evasionResult && evasionResult.moved) ? evasionResult.moved.slice() : [],
        destroyed: Array.isArray(evasionResult && evasionResult.destroyed) ? evasionResult.destroyed.slice() : []
    };
}

function revertTimedSpecialAt(
    cardState: CardState,
    gameState: GameState,
    row: number,
    col: number,
    ownerKey: PlayerKey,
    specialType: string,
    deps: HyperactiveDeps = {},
    cause?: string,
    reason?: string
): boolean {
    if (!Number.isInteger(row) || !Number.isInteger(col)) return false;
    if (deps.BoardOps && typeof deps.BoardOps.revertSpecialStoneAt === 'function') {
        const revertRes = deps.BoardOps.revertSpecialStoneAt(
            cardState,
            gameState,
            row,
            col,
            specialType,
            ownerKey,
            cause || 'SYSTEM',
            reason || 'duration_end'
        );
        return !!(revertRes && revertRes.reverted);
    }
    if (!Array.isArray((cardState as any).markers)) return false;
    const beforeLength = (cardState as any).markers.length;
    (cardState as any).markers = (cardState as any).markers.filter((marker: any) => !(
        marker &&
        marker.kind === 'specialStone' &&
        marker.row === row &&
        marker.col === col &&
        marker.owner === ownerKey &&
        marker.data &&
        String(marker.data.type || '').toUpperCase() === String(specialType || '').toUpperCase()
    ));
    return (cardState as any).markers.length !== beforeLength;
}

function revertNoCandidateSpecialAt(
    cardState: CardState,
    gameState: GameState,
    entry: MarkerEntry,
    specialType: string,
    deps: HyperactiveDeps,
    cause: string
): DestroyResult[] {
    const reverted = revertTimedSpecialAt(
        cardState,
        gameState,
        entry.row,
        entry.col,
        entry.owner as PlayerKey,
        specialType,
        deps,
        cause,
        'no_candidates_revert'
    );
    return reverted
        ? [{ row: entry.row, col: entry.col, specialType, reason: 'no_candidates_revert', reverted: true }]
        : [];
}

function destroyUltimateAnchor(
    cardState: CardState,
    gameState: GameState,
    entry: MarkerEntry,
    deps: HyperactiveDeps,
    destroyAt: (cs: CardState, gs: GameState, r: number, c: number) => boolean,
    reason?: string
): DestroyResult[] {
    const destroyReason = reason || 'no_candidates';
    const isDurationEnd = destroyReason === 'expired' || destroyReason === 'duration_end';
    if (isDurationEnd) {
        const reverted = revertTimedSpecialAt(
            cardState,
            gameState,
            entry.row,
            entry.col,
            entry.owner as PlayerKey,
            'ULTIMATE_HYPERACTIVE',
            deps,
            'ULTIMATE_HYPERACTIVE_GOD',
            'duration_end'
        );
        return reverted
            ? [{ row: entry.row, col: entry.col, specialType: 'ULTIMATE_HYPERACTIVE', reason: 'duration_end', reverted: true }]
            : [];
    }
    if (destroyReason === 'no_candidates') {
        return revertNoCandidateSpecialAt(
            cardState,
            gameState,
            entry,
            'ULTIMATE_HYPERACTIVE',
            deps,
            'ULTIMATE_HYPERACTIVE_GOD'
        );
    }

    let anchorDestroyed = false;
    if (deps.BoardOps && typeof deps.BoardOps.destroyAt === 'function') {
        const res = deps.BoardOps.destroyAt(cardState, gameState, entry.row, entry.col, 'ULTIMATE_HYPERACTIVE_GOD', destroyReason);
        anchorDestroyed = !!(res && res.destroyed);
    } else {
        anchorDestroyed = destroyAt(cardState, gameState, entry.row, entry.col);
    }
    return anchorDestroyed ? [{ row: entry.row, col: entry.col, specialType: 'ULTIMATE_HYPERACTIVE', reason: destroyReason }] : [];
}

function moveHyperactiveOnce(
    cardState: CardState,
    gameState: GameState,
    entry: MarkerEntry,
    prng: any,
    deps: HyperactiveDeps = {}
): HyperactiveMoveResult {
    const p = resolveDeterministicPrng(prng, deps, 'CardHyperactive.moveHyperactiveOnce');
    const destroyAt = deps.destroyAt || ((cs: CardState, gs: GameState, r: number, c: number) => {
        const cell = getBoardCell(cs, gs, r, c);
        if (cell === null || cell === undefined || cell === EMPTY) return false;
        if ((cs as any).markers) (cs as any).markers = (cs as any).markers.filter((m: any) => !(m.row === r && m.col === c));
        setBoardCell(cs, gs, r, c, EMPTY);
        return true;
    });
    const getFlipsWithContext = deps.getFlipsWithContext || (() => []);
    const clearHyperactiveAtPositions = deps.clearHyperactiveAtPositions || ((cs: CardState, positions: Position[]) => {
        if (!(cs as any).markers) return;
        (cs as any).markers = (cs as any).markers.filter((m: any) => !(
            m.kind === 'specialStone' &&
            m.data &&
            (m.data.type === 'HYPERACTIVE' || m.data.type === 'ESCAPE_HYPERACTIVE' || m.data.type === 'EXTREME_HYPERACTIVE' || m.data.type === 'ROBOT_VACUUM') &&
            positions.some((p: Position) => p.row === m.row && p.col === m.col)
        ));
    });
    const clearBombAt = deps.clearBombAt || ((cs: CardState, r: number, c: number) => { if ((cs as any).markers) (cs as any).markers = (cs as any).markers.filter((m: any) => !(m.kind === 'specialStone' && m.data && m.data.category === 'bomb' && m.row === r && m.col === c)); });
    const isBlockedCell = typeof deps.isBlockedCell === 'function'
        ? deps.isBlockedCell
        : (() => false);

    const moved: MoveResult[] = [];
    const destroyed: DestroyResult[] = [];
    const flipped: any[] = [];
    const repelled: MoveResult[] = [];

    const ownerKey = entry.owner as PlayerKey;
    const ownerVal = ownerKey === 'black' ? (BLACK || 1) : (WHITE || -1);
    const markerType = (entry && entry.data && entry.data.type) ? String(entry.data.type).toUpperCase() : 'HYPERACTIVE';
    const isEscapeHyperactive = markerType === 'ESCAPE_HYPERACTIVE';
    const isExtremeHyperactive = markerType === 'EXTREME_HYPERACTIVE';
    const moveCause = isEscapeHyperactive
        ? 'ESCAPE_HYPERACTIVE'
        : (isExtremeHyperactive ? 'EXTREME_HYPERACTIVE_WILL' : 'HYPERACTIVE');
    const moveReason = isEscapeHyperactive
        ? 'escape_hyperactive_move'
        : (isExtremeHyperactive ? 'extreme_hyperactive_move' : 'hyperactive_move');
    const flipReason = isEscapeHyperactive
        ? 'escape_hyperactive_flip'
        : (isExtremeHyperactive ? 'extreme_hyperactive_flip' : 'hyperactive_flip');
    const noCandidateReason = isEscapeHyperactive
        ? 'escape_no_candidates_explosion'
        : (isExtremeHyperactive ? 'extreme_no_candidates' : 'no_candidates');

    // Anchor must still be owner's stone
    if (getBoardCell(cardState, gameState, entry.row, entry.col) !== ownerVal) {
        // remove the anchor
        clearHyperactiveAtPositions(cardState, [{ row: entry.row, col: entry.col }]);
        return { moved, destroyed, flipped, repelled, ownerKey };
    }

    const candidates = isExtremeHyperactive
        ? getNeighborEmptyCandidates(cardState, gameState, entry.row, entry.col, { isBlockedCell }, { includeOccupied: true })
        : getNeighborEmptyCandidates(cardState, gameState, entry.row, entry.col, { isBlockedCell });
    logHyperactiveDebug('[HYPERACTIVE] moveHyperactiveOnce candidates', candidates.length, 'at', { row: entry.row, col: entry.col, owner: entry.owner });

    if (candidates.length === 0) {
        if (isEscapeHyperactive) {
            const blastTargets = [{ row: entry.row, col: entry.col }];
            for (let dr = -1; dr <= 1; dr++) {
                for (let dc = -1; dc <= 1; dc++) {
                    if (dr === 0 && dc === 0) continue;
                    const row = entry.row + dr;
                    const col = entry.col + dc;
                    if (!hasBoardShapeCell(cardState, gameState, row, col)) continue;
                    blastTargets.push({ row, col });
                }
            }

            for (const pos of blastTargets) {
                let destroyedRes = false;
                if (deps.BoardOps && typeof deps.BoardOps.destroyAt === 'function') {
                    const res = deps.BoardOps.destroyAt(cardState, gameState, pos.row, pos.col, moveCause, noCandidateReason);
                    destroyedRes = !!(res && res.destroyed);
                } else {
                    destroyedRes = !!destroyAt(cardState, gameState, pos.row, pos.col);
                }
                if (destroyedRes) {
                    destroyed.push({ row: pos.row, col: pos.col, specialType: markerType });
                }
            }

            clearHyperactiveAtPositions(cardState, [{ row: entry.row, col: entry.col }]);
        } else {
            destroyed.push(...revertNoCandidateSpecialAt(cardState, gameState, entry, markerType, deps, moveCause));
        }
        return { moved, destroyed, flipped, ownerKey };
    }

    let target: Candidate | null = null;
    if (isEscapeHyperactive) {
        const threats = collectEscapeThreats(cardState, gameState, ownerVal, entry.row, entry.col);
        target = pickEscapeTarget(candidates, threats);
    }

    let usedExtremeSwapFallback = false;
    let swapSource: Position | null = null;
    if (isExtremeHyperactive) {
        const candidatePool = candidates.slice();
        while (!target && candidatePool.length > 0) {
            const index = Math.floor(p.random() * candidatePool.length);
            const normalizedIndex = Number.isInteger(index) && index >= 0 && index < candidatePool.length ? index : 0;
            const picked = candidatePool[normalizedIndex] || candidatePool[0] || null;
            if (!picked) break;

            const targetVal = getBoardCell(cardState, gameState, picked.row, picked.col);
            if (targetVal === EMPTY) {
                target = picked;
                break;
            }

            const dr = picked.row - entry.row;
            const dc = picked.col - entry.col;
            const vacateTarget = selectExtremeRepelTarget(cardState, gameState, entry, picked.row, picked.col, dr, dc, isBlockedCell);
            if (!vacateTarget) {
                const sourceBeforeSwap: Position = { row: entry.row, col: entry.col };
                if (
                    typeof deps.swapOccupiedCellsWithPresentation !== 'function' ||
                    !canExtremeHyperactiveSwapCell(cardState, sourceBeforeSwap.row, sourceBeforeSwap.col, deps) ||
                    !canExtremeHyperactiveSwapCell(cardState, picked.row, picked.col, deps)
                ) {
                    candidatePool.splice(normalizedIndex, 1);
                    continue;
                }
                const swapResult = deps.swapOccupiedCellsWithPresentation(
                    cardState,
                    gameState,
                    sourceBeforeSwap,
                    { row: picked.row, col: picked.col },
                    {
                        cause: 'EXTREME_HYPERACTIVE_WILL',
                        reason: 'extreme_hyperactive_forced_swap'
                    }
                );
                if (!swapResult || !swapResult.swapped) {
                    candidatePool.splice(normalizedIndex, 1);
                    continue;
                }
                repelled.push({
                    from: { row: picked.row, col: picked.col },
                    to: { row: sourceBeforeSwap.row, col: sourceBeforeSwap.col },
                    source: sourceBeforeSwap,
                    specialType: 'EXTREME_HYPERACTIVE',
                    forcedSwap: true
                });
                usedExtremeSwapFallback = true;
                swapSource = sourceBeforeSwap;
                target = picked;
                break;
            }

            let vacated = false;
            let usedBoardOpsVacate = false;
            if (deps.BoardOps && typeof deps.BoardOps.moveAt === 'function') {
                const res = deps.BoardOps.moveAt(
                    cardState,
                    gameState,
                    picked.row,
                    picked.col,
                    vacateTarget.row,
                    vacateTarget.col,
                    'EXTREME_HYPERACTIVE_WILL',
                    'extreme_target_vacate',
                    {
                        sourceRow: entry.row,
                        sourceCol: entry.col,
                        vacatedBy: 'EXTREME_HYPERACTIVE'
                    }
                );
                vacated = !!(res && res.moved);
                usedBoardOpsVacate = !!(res && res.markerHandled === true);
            } else {
                setBoardCell(cardState, gameState, picked.row, picked.col, EMPTY);
                setBoardCell(cardState, gameState, vacateTarget.row, vacateTarget.col, targetVal as number);
                vacated = true;
            }

            if (!vacated) {
                candidatePool.splice(normalizedIndex, 1);
                continue;
            }

            if (!usedBoardOpsVacate) {
                moveCoexistingSpecialMarkers(cardState, entry, picked.row, picked.col, vacateTarget.row, vacateTarget.col);
            }
            repelled.push({
                from: { row: picked.row, col: picked.col },
                to: { row: vacateTarget.row, col: vacateTarget.col },
                source: { row: entry.row, col: entry.col },
                specialType: 'EXTREME_HYPERACTIVE'
            });
            target = picked;
        }
    }

    if (!target && !isExtremeHyperactive) {
        const index = Math.floor(p.random() * candidates.length);
        target = candidates[index] || null;
    }
    if (!target) {
        destroyed.push(...revertNoCandidateSpecialAt(cardState, gameState, entry, markerType, deps, moveCause));
        return { moved, destroyed, flipped, repelled, ownerKey };
    }
    logHyperactiveDebug('[HYPERACTIVE] selected target', { target, candidatesLen: candidates.length, markerType });

    let flipCells: any[] = [];
    if (!isExtremeHyperactive) {
        flipCells = getFlipsWithContext(gameState, target.row, target.col, ownerVal, getExplicitCardContext(cardState, deps));
    }

    const sourceRow = usedExtremeSwapFallback && swapSource ? swapSource.row : entry.row;
    const sourceCol = usedExtremeSwapFallback && swapSource ? swapSource.col : entry.col;

    let moveSucceeded = usedExtremeSwapFallback;
    if (!usedExtremeSwapFallback) {
        let usedBoardOpsMove = false;
        if (deps.BoardOps && typeof deps.BoardOps.moveAt === 'function') {
            const moveResult = deps.BoardOps.moveAt(
                cardState,
                gameState,
                sourceRow,
                sourceCol,
                target.row,
                target.col,
                moveCause,
                moveReason,
                buildMovingStonePresentationMeta(cardState, sourceRow, sourceCol)
            );
            moveSucceeded = !!(moveResult && moveResult.moved);
            usedBoardOpsMove = !!(moveResult && moveResult.markerHandled === true);
        } else {
            setBoardCell(cardState, gameState, sourceRow, sourceCol, EMPTY);
            setBoardCell(cardState, gameState, target.row, target.col, ownerVal);
            moveSucceeded = true;
        }
        if (!moveSucceeded) {
            return { moved, destroyed, flipped, repelled, ownerKey };
        }
        if (!usedBoardOpsMove) {
            moveCoexistingSpecialMarkers(cardState, entry, sourceRow, sourceCol, target.row, target.col);
        }
        entry.row = target.row;
        entry.col = target.col;
    }
    moved.push({ from: { row: sourceRow, col: sourceCol }, to: { row: target.row, col: target.col }, specialType: markerType });

    if (isExtremeHyperactive) {
        const repelResults = applyExtremeHyperactiveRepel(cardState, gameState, entry, deps);
        if (repelResults && repelResults.length) repelled.push(...repelResults);

        const targetCell = getBoardCell(cardState, gameState, target.row, target.col);
        if (targetCell === ownerVal) {
            setBoardCell(cardState, gameState, target.row, target.col, EMPTY);
            try {
                flipCells = getFlipsWithContext(gameState, target.row, target.col, ownerVal, getExplicitCardContext(cardState, deps));
            } finally {
                setBoardCell(cardState, gameState, target.row, target.col, ownerVal);
            }
        }
    }

    if (flipCells.length > 0) {
        const flipResult = applyFlipCellsWithEvasion(
            cardState,
            gameState,
            flipCells,
            ownerKey,
            ownerVal,
            p,
            Object.assign({}, deps, {
                clearHyperactiveAtPositions,
                isBlockedCell,
                destroyAt
            }),
            {
                flipCause: moveCause,
                flipReason,
                buildFlippedDetail: (cell: Position) => ({ row: cell.row, col: cell.col, specialType: markerType })
            }
        );
        if (flipResult.moved.length) moved.push(...flipResult.moved);
        if (flipResult.destroyed.length) destroyed.push(...flipResult.destroyed);
        if (flipResult.flipped.length) flipped.push(...flipResult.flipped);
    }

    return { moved, destroyed, flipped, repelled, ownerKey };
}

function processHyperactiveMoves(
    cardState: CardState,
    gameState: GameState,
    prng: any,
    deps: HyperactiveDeps = {}
): HyperactiveMoveResult & { flippedByOwner: { black: any[]; white: any[] } } {
    const moved: MoveResult[] = [];
    const destroyed: DestroyResult[] = [];
    const flipped: any[] = [];
    const flippedByOwner: { black: any[]; white: any[] } = { black: [], white: [] };

    const entries: MarkerEntry[] = ((cardState as any).markers || [])
        .filter((s: any) => (
            s.kind === 'specialStone' &&
            s.data &&
            (s.data.type === 'HYPERACTIVE' || s.data.type === 'ESCAPE_HYPERACTIVE' || s.data.type === 'EXTREME_HYPERACTIVE')
        ))
        .slice()
        .sort((a: MarkerEntry, b: MarkerEntry) => (a.createdSeq || 0) - (b.createdSeq || 0));

    const repelled: MoveResult[] = [];

    for (const entry of entries) {
        if (!((cardState as any).markers || []).includes(entry)) continue;
        const res = moveHyperactiveOnce(cardState, gameState, entry, prng, deps);
        moved.push(...res.moved);
        destroyed.push(...res.destroyed);
        flipped.push(...res.flipped);
        if (res.repelled && res.repelled.length) repelled.push(...res.repelled);
        if (res.flipped.length > 0 && res.ownerKey && flippedByOwner[res.ownerKey]) {
            flippedByOwner[res.ownerKey].push(...res.flipped);
        }
    }

    return { moved, destroyed, flipped, repelled, flippedByOwner };
}

function processHyperactiveMoveAtAnchor(
    cardState: CardState,
    gameState: GameState,
    playerKey: PlayerKey,
    row: number,
    col: number,
    prng: any,
    deps: HyperactiveDeps = {}
): HyperactiveMoveResult {
    const expectedSpecialType = String(deps && deps.expectedSpecialType ? deps.expectedSpecialType : '').toUpperCase();
    const entry: MarkerEntry | undefined = ((cardState as any).markers || []).find((s: any) => (
        s.kind === 'specialStone' &&
        s.data &&
        (expectedSpecialType
            ? (String(s.data.type || '').toUpperCase() === expectedSpecialType)
            : (s.data.type === 'HYPERACTIVE' || s.data.type === 'ESCAPE_HYPERACTIVE' || s.data.type === 'EXTREME_HYPERACTIVE')) &&
        s.owner === playerKey &&
        s.row === row &&
        s.col === col
    ));
    if (!entry) return { moved: [], destroyed: [], flipped: [], repelled: [] };
    const res = moveHyperactiveOnce(cardState, gameState, entry, prng, deps);
    const destroyed = Array.isArray(res.destroyed) ? res.destroyed.slice() : [];
    return {
        moved: Array.isArray(res.moved) ? res.moved : [],
        destroyed,
        flipped: Array.isArray(res.flipped) ? res.flipped : [],
        repelled: Array.isArray(res.repelled) ? res.repelled : [],
        ownerKey: res.ownerKey || playerKey
    };
}

function processInstantHyperactiveMoveAtAnchor(
    cardState: CardState,
    gameState: GameState,
    playerKey: PlayerKey,
    row: number,
    col: number,
    prng: any,
    deps: HyperactiveDeps = {}
): HyperactiveMoveResult {
    const entry: MarkerEntry | undefined = ((cardState as any).markers || []).find((s: any) =>
        s &&
        s.kind === 'specialStone' &&
        s.data &&
        s.data.type === 'HYPERACTIVE' &&
        s.owner === playerKey &&
        s.row === row &&
        s.col === col
    );
    if (!entry) return { moved: [], destroyed: [], flipped: [], ownerKey: playerKey };

    const moved: MoveResult[] = [];
    const destroyed: DestroyResult[] = [];
    const flipped: any[] = [];

    for (let step = 1; step <= 3; step++) {
        if (!((cardState as any).markers || []).includes(entry)) break;
        const res = moveHyperactiveOnce(cardState, gameState, entry, prng, deps);
        if (res.moved && res.moved.length) moved.push(...res.moved.map((m: MoveResult) => ({ ...m, step })));
        if (res.flipped && res.flipped.length) flipped.push(...res.flipped);
        if (res.destroyed && res.destroyed.length) {
            destroyed.push(...res.destroyed);
            break;
        }
    }

    if (destroyed.length === 0) {
        const reverted = revertTimedSpecialAt(
            cardState,
            gameState,
            entry.row,
            entry.col,
            playerKey,
            'HYPERACTIVE',
            deps,
            'HYPERACTIVE',
            'duration_end'
        );
        if (reverted) {
            destroyed.push({
                row: entry.row,
                col: entry.col,
                specialType: 'HYPERACTIVE',
                reverted: true,
                reason: 'duration_end'
            });
        }
    }

    return { moved, destroyed, flipped, ownerKey: playerKey };
}

function processUltimateHyperactiveMoveAtAnchor(
    cardState: CardState,
    gameState: GameState,
    playerKey: PlayerKey,
    row: number,
    col: number,
    prng: any,
    deps: HyperactiveDeps = {}
): HyperactiveMoveResult {
    const p = resolveDeterministicPrng(prng, deps, 'CardHyperactive.processUltimateHyperactiveMoveAtAnchor');
    const entry: MarkerEntry | undefined = ((cardState as any).markers || []).find((s: any) =>
        s &&
        s.kind === 'specialStone' &&
        s.data &&
        s.data.type === 'ULTIMATE_HYPERACTIVE' &&
        s.owner === playerKey &&
        s.row === row &&
        s.col === col
    );
    if (!entry) {
        return { moved: [], destroyed: [], flipped: [], ownerKey: playerKey };
    }

    const ownerKey = entry.owner as PlayerKey;
    const ownerVal = ownerKey === 'black' ? (BLACK || 1) : (WHITE || -1);
    const currentTurnPlayerKey = (typeof deps.currentTurnPlayerKey === 'string' && deps.currentTurnPlayerKey)
        ? deps.currentTurnPlayerKey
        : ownerKey;
    const shouldDecrementRemaining = currentTurnPlayerKey === ownerKey && deps.decrementRemainingOwnerTurns !== false;
    const defaultRemainingTurns = Number.isInteger(deps.ultimateHyperactiveTurns) ? deps.ultimateHyperactiveTurns : 10;
    const maxMoveDistance = Number.isInteger(deps.ultimateHyperactiveMaxDistance) && (deps.ultimateHyperactiveMaxDistance as number) > 0
        ? deps.ultimateHyperactiveMaxDistance
        : 5;
    const clearUltimateAtPositions = deps.clearUltimateAtPositions || clearUltimateHyperactiveAtPositions;
    const clearHyperactiveAtPositions = typeof deps.clearHyperactiveAtPositions === 'function'
        ? deps.clearHyperactiveAtPositions
        : (() => {});
    const getFlipsWithContext = deps.getFlipsWithContext || (() => []);
    const destroyAt = deps.destroyAt || ((cs: CardState, gs: GameState, r: number, c: number) => {
        const cell = getBoardCell(cs, gs, r, c);
        if (cell === null || cell === undefined || cell === EMPTY) return false;
        if ((cs as any).markers) (cs as any).markers = (cs as any).markers.filter((m: any) => !(m.row === r && m.col === c));
        setBoardCell(cs, gs, r, c, EMPTY);
        return true;
    });

    const moved: MoveResult[] = [];
    const destroyed: DestroyResult[] = [];
    const flipped: any[] = [];

    // Anchor is removed if the board owner no longer matches marker owner.
    if (getBoardCell(cardState, gameState, entry.row, entry.col) !== ownerVal) {
        clearUltimateAtPositions(cardState, [{ row: entry.row, col: entry.col }]);
        return { moved, destroyed, flipped, ownerKey };
    }

    for (let step = 1; step <= 2; step++) {
        const candidates = getStraightLineEmptyCandidates(cardState, gameState, entry.row, entry.col, deps, {
            maxDistance: maxMoveDistance as number,
            allowJumpOverStones: true
        });
        if (!candidates.length) {
            destroyed.push(...destroyUltimateAnchor(cardState, gameState, entry, deps, destroyAt, 'no_candidates'));
            break;
        }

        const target = candidates[Math.floor(p.random() * candidates.length)];
        const sourceRow = entry.row;
        const sourceCol = entry.col;
        const from: Position = { row: sourceRow, col: sourceCol };
        const flipCells = getFlipsWithContext(
            gameState,
            target.row,
            target.col,
            ownerVal,
            getExplicitCardContext(cardState, deps)
        );
        let movedRes = false;
        let usedBoardOpsMove = false;
        if (deps.BoardOps && typeof deps.BoardOps.moveAt === 'function') {
            const res = deps.BoardOps.moveAt(
                cardState,
                gameState,
                sourceRow,
                sourceCol,
                target.row,
                target.col,
                'ULTIMATE_HYPERACTIVE_GOD',
                'ultimate_hyperactive_step_move',
                Object.assign({}, buildMovingStonePresentationMeta(cardState, sourceRow, sourceCol), { step })
            );
            movedRes = !!(res && res.moved);
            usedBoardOpsMove = !!(res && res.markerHandled === true);
        } else {
            setBoardCell(cardState, gameState, sourceRow, sourceCol, EMPTY);
            setBoardCell(cardState, gameState, target.row, target.col, ownerVal);
            movedRes = true;
        }

        if (!movedRes) break;
        if (!usedBoardOpsMove) {
            moveCoexistingSpecialMarkers(cardState, entry, sourceRow, sourceCol, target.row, target.col);
        }
        entry.row = target.row;
        entry.col = target.col;
        moved.push({ from, to: { row: target.row, col: target.col }, step, distance: target.distance });

        if (flipCells.length > 0) {
            const flipResult = applyFlipCellsWithEvasion(
                cardState,
                gameState,
                flipCells,
                ownerKey,
                ownerVal,
                p,
                Object.assign({}, deps, {
                    clearHyperactiveAtPositions,
                    destroyAt
                }),
                {
                    flipCause: 'ULTIMATE_HYPERACTIVE_GOD',
                    flipReason: 'ultimate_hyperactive_flip'
                }
            );
            if (flipResult.moved.length) moved.push(...flipResult.moved);
            if (flipResult.destroyed.length) destroyed.push(...flipResult.destroyed);
            if (flipResult.flipped.length) flipped.push(...flipResult.flipped);
        }
    }

    const markerStillExists = Array.isArray((cardState as any).markers) && (cardState as any).markers.includes(entry);
    if (shouldDecrementRemaining && markerStillExists) {
        const before = (entry.data && Number.isFinite(entry.data.remainingOwnerTurns))
            ? entry.data.remainingOwnerTurns
            : defaultRemainingTurns as number;
        const afterDec = Math.max(0, before - 1);
        if (entry.data) entry.data.remainingOwnerTurns = afterDec;
        if (afterDec <= 0) {
            destroyed.push(...destroyUltimateAnchor(cardState, gameState, entry, deps, destroyAt, 'expired'));
        }
    }

    return { moved, destroyed, flipped, ownerKey };
}

function collectRobotVacuumTargets(cardState: CardState, gameState: GameState, ownerVal: number, originRow: number, originCol: number, deps: HyperactiveDeps = {}): Position[] {
    const enemyVal = ownerVal === (BLACK || 1) ? (WHITE || -1) : (BLACK || 1);
    const targets: Position[] = [];
    for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
            if (dr === 0 && dc === 0) continue;
            const row = originRow + dr;
            const col = originCol + dc;
            if (!hasBoardShapeCell(cardState, gameState, row, col)) continue;
            if (getBoardCell(cardState, gameState, row, col) !== enemyVal) continue;
            if (isUntargetableStone(cardState, row, col, deps)) continue;
            targets.push({ row, col });
        }
    }
    return targets;
}

function moveRobotVacuumOnce(
    cardState: CardState,
    gameState: GameState,
    entry: MarkerEntry,
    prng: any,
    deps: HyperactiveDeps = {}
): HyperactiveMoveResult {
    const p = resolveDeterministicPrng(prng, deps, 'CardHyperactive.moveRobotVacuumOnce');
    const clearHyperactiveAtPositions = deps.clearHyperactiveAtPositions || ((cs: CardState, positions: Position[]) => {
        if (!(cs as any).markers) return;
        (cs as any).markers = (cs as any).markers.filter((m: any) => !(
            m.kind === 'specialStone' &&
            m.data &&
            (m.data.type === 'HYPERACTIVE' || m.data.type === 'ESCAPE_HYPERACTIVE' || m.data.type === 'EXTREME_HYPERACTIVE' || m.data.type === 'ROBOT_VACUUM') &&
            positions.some((p: Position) => p.row === m.row && p.col === m.col)
        ));
    });
    const isBlockedCell = typeof deps.isBlockedCell === 'function'
        ? deps.isBlockedCell
        : (() => false);

    const moved: MoveResult[] = [];
    const destroyed: DestroyResult[] = [];
    const flipped: any[] = [];

    const ownerKey = entry.owner as PlayerKey;
    const ownerVal = ownerKey === 'black' ? (BLACK || 1) : (WHITE || -1);

    if (getBoardCell(cardState, gameState, entry.row, entry.col) !== ownerVal) {
        clearHyperactiveAtPositions(cardState, [{ row: entry.row, col: entry.col }]);
        return { moved, destroyed, flipped, ownerKey };
    }

    const candidates = getNeighborEmptyCandidates(cardState, gameState, entry.row, entry.col, { isBlockedCell });
    if (!candidates.length) {
        destroyed.push(...revertNoCandidateSpecialAt(cardState, gameState, entry, 'ROBOT_VACUUM', deps, 'ROBOT_VACUUM'));
        return { moved, destroyed, flipped, ownerKey };
    }

    const enemies = collectRobotVacuumEnemies(cardState, gameState, ownerVal, entry.row, entry.col);
    const target = pickRobotVacuumApproachTarget(candidates, enemies, p);
    if (!target) return { moved, destroyed, flipped, ownerKey };
    const from: Position = { row: entry.row, col: entry.col };

    let movedRes = false;
    let usedBoardOpsMove = false;
    if (deps.BoardOps && typeof deps.BoardOps.moveAt === 'function') {
        const res = deps.BoardOps.moveAt(
            cardState,
            gameState,
            entry.row,
            entry.col,
            target.row,
            target.col,
            'ROBOT_VACUUM',
            'robot_vacuum_move',
            buildMovingStonePresentationMeta(cardState, entry.row, entry.col)
        );
        movedRes = !!(res && res.moved);
        usedBoardOpsMove = !!(res && res.markerHandled === true);
    } else {
        setBoardCell(cardState, gameState, entry.row, entry.col, EMPTY);
        setBoardCell(cardState, gameState, target.row, target.col, ownerVal);
        movedRes = true;
    }

    if (!movedRes) return { moved, destroyed, flipped, ownerKey };

    if (!usedBoardOpsMove) {
        moveCoexistingSpecialMarkers(cardState, entry, from.row, from.col, target.row, target.col);
    }
    entry.row = target.row;
    entry.col = target.col;
    moved.push({ from, to: { row: target.row, col: target.col }, specialType: 'ROBOT_VACUUM' });

    return { moved, destroyed, flipped, ownerKey };
}

function _destroyGluttonousTarget(
    cardState: CardState,
    gameState: GameState,
    ownerKey: PlayerKey,
    sourceRow: number,
    sourceCol: number,
    targetRow: number,
    targetCol: number,
    deps: HyperactiveDeps = {}
): { destroyed?: boolean; proliferated?: boolean } {
    const destroyMeta = {
        sourceRow,
        sourceCol,
        projectileOwner: ownerKey,
        projectileStone: 'gluttonous',
        bite: true,
        randomSource: deps.randomSource || (cardState as { _boardOpsRandomSource?: any; _currentActionMeta?: any; _defaultRandomSource?: any })._boardOpsRandomSource || ((cardState as { _currentActionMeta?: any })._currentActionMeta && (cardState as { _currentActionMeta?: any })._currentActionMeta.randomSource) || (cardState as { _defaultRandomSource?: any })._defaultRandomSource || null
    };

    if (deps.BoardOps && typeof deps.BoardOps.destroyAt === 'function') {
        return deps.BoardOps.destroyAt(
            cardState,
            gameState,
            targetRow,
            targetCol,
            'GLUTTONOUS_WILL',
            'gluttonous_eat',
            destroyMeta
        );
    }

    const guarded = ((cardState as any).markers || []).some((m: any) => (
        m &&
        m.kind === 'specialStone' &&
        m.row === targetRow &&
        m.col === targetCol &&
        m.data &&
        m.data.type === 'GUARD'
    ));
    if (guarded) return { destroyed: false };

    if (typeof deps.destroyAt === 'function') {
        return { destroyed: !!deps.destroyAt(cardState, gameState, targetRow, targetCol) };
    }
    return { destroyed: false };
}

function processGluttonousMoveAtAnchor(
    cardState: CardState,
    gameState: GameState,
    playerKey: PlayerKey,
    row: number,
    col: number,
    prng: any,
    deps: HyperactiveDeps = {}
): GluttonousMoveResult {
    const entry: MarkerEntry | undefined = ((cardState as any).markers || []).find((s: any) => (
        s &&
        s.kind === 'specialStone' &&
        s.data &&
        s.data.type === 'GLUTTONOUS' &&
        s.owner === playerKey &&
        s.row === row &&
        s.col === col
    ));
    if (!entry) {
        return {
            moved: [],
            destroyed: [],
            flipped: [],
            ownerKey: playerKey,
            ate: []
        };
    }

    const p = resolveDeterministicPrng(prng, deps, 'CardHyperactive.processGluttonousMoveAtAnchor');
    const clearHyperactiveAtPositions = deps.clearHyperactiveAtPositions || ((cs: CardState, positions: Position[]) => {
        if (!(cs as any).markers) return;
        (cs as any).markers = (cs as any).markers.filter((m: any) => !(
            m.kind === 'specialStone' &&
            m.data &&
            (m.data.type === 'HYPERACTIVE' ||
                m.data.type === 'ESCAPE_HYPERACTIVE' ||
                m.data.type === 'EXTREME_HYPERACTIVE' ||
                m.data.type === 'ROBOT_VACUUM' ||
                m.data.type === 'GLUTTONOUS') &&
            positions.some((pos: Position) => pos.row === m.row && pos.col === m.col)
        ));
    });
    const isBlockedCell = typeof deps.isBlockedCell === 'function'
        ? deps.isBlockedCell
        : (() => false);

    const moved: MoveResult[] = [];
    const destroyed: DestroyResult[] = [];
    const flipped: any[] = [];
    const ate: any[] = [];

    const ownerKey = entry.owner as PlayerKey;
    const ownerVal = ownerKey === 'black' ? (BLACK || 1) : (WHITE || -1);
    const rawMissStreak = Number(entry && entry.data ? entry.data.gluttonousMissStreak : 0);
    const missStreak = Number.isFinite(rawMissStreak) ? Math.max(0, Math.trunc(rawMissStreak)) : 0;

    if (getBoardCell(cardState, gameState, entry.row, entry.col) !== ownerVal) {
        clearHyperactiveAtPositions(cardState, [{ row: entry.row, col: entry.col }]);
        return { moved, destroyed, flipped, ownerKey, ate };
    }

    const adjacentEnemies = collectRobotVacuumTargets(cardState, gameState, ownerVal, entry.row, entry.col, deps).slice();
    while (adjacentEnemies.length > 0) {
        const pickIndex = Math.floor(p.random() * adjacentEnemies.length);
        const index = Number.isInteger(pickIndex) && pickIndex >= 0 && pickIndex < adjacentEnemies.length ? pickIndex : 0;
        const target = adjacentEnemies.splice(index, 1)[0];
        if (!target) continue;

        let eatResult: GluttonousMoveResult | null = null;
        const resolveEat = () => {
            const from: Position = { row: entry.row, col: entry.col };
            const destroyResult = _destroyGluttonousTarget(
                cardState,
                gameState,
                ownerKey,
                from.row,
                from.col,
                target.row,
                target.col,
                deps
            );
            if (!destroyResult || (!destroyResult.destroyed && !destroyResult.proliferated)) return;

            if (destroyResult.proliferated) {
                const eatDetail = {
                    row: target.row,
                    col: target.col,
                    sourceRow: from.row,
                    sourceCol: from.col,
                    proliferated: true
                };
                ate.push(eatDetail);
                if (entry.data && typeof entry.data === 'object') {
                    entry.data.gluttonousMissStreak = 0;
                }
                eatResult = { moved, destroyed, flipped, ownerKey, ate };
                return;
            }

            let movedRes = false;
            let usedBoardOpsMove = false;
            if (deps.BoardOps && typeof deps.BoardOps.moveAt === 'function') {
                const res = deps.BoardOps.moveAt(
                    cardState,
                    gameState,
                    from.row,
                    from.col,
                    target.row,
                    target.col,
                    'GLUTTONOUS_WILL',
                    'gluttonous_eat_move',
                    Object.assign({}, buildMovingStonePresentationMeta(cardState, from.row, from.col), {
                        sourceRow: from.row,
                        sourceCol: from.col,
                        ate: true
                    })
                );
                movedRes = !!(res && res.moved);
                usedBoardOpsMove = !!(res && res.markerHandled === true);
            } else {
                setBoardCell(cardState, gameState, from.row, from.col, EMPTY);
                setBoardCell(cardState, gameState, target.row, target.col, ownerVal);
                movedRes = true;
            }

            if (!movedRes) {
                const eatDetail = { row: target.row, col: target.col, sourceRow: from.row, sourceCol: from.col };
                ate.push(eatDetail);
                destroyed.push({ ...eatDetail, specialType: 'GLUTTONOUS' });
                if (entry.data && typeof entry.data === 'object') {
                    entry.data.gluttonousMissStreak = 0;
                }
                eatResult = { moved, destroyed, flipped, ownerKey, ate };
                return;
            }

            if (!usedBoardOpsMove) {
                moveCoexistingSpecialMarkers(cardState, entry, from.row, from.col, target.row, target.col);
            }
            entry.row = target.row;
            entry.col = target.col;
            moved.push({ from, to: { row: target.row, col: target.col }, specialType: 'GLUTTONOUS' });
            const eatDetail = { row: target.row, col: target.col, sourceRow: from.row, sourceCol: from.col };
            ate.push(eatDetail);
            destroyed.push({ ...eatDetail, specialType: 'GLUTTONOUS' });
            if (entry.data && typeof entry.data === 'object') {
                entry.data.gluttonousMissStreak = 0;
            }

            eatResult = { moved, destroyed, flipped, ownerKey, ate };
        };

        if (deps.BoardOps && typeof deps.BoardOps.runEffectBlock === 'function') {
            deps.BoardOps.runEffectBlock(cardState, gameState, {
                kind: 'anchor_effect',
                randomSource: p,
                cause: 'GLUTTONOUS_WILL',
                reason: 'gluttonous_eat',
                owner: ownerKey,
                sourceRow: entry.row,
                sourceCol: entry.col
            }, resolveEat);
        } else if (deps.BoardOps && typeof deps.BoardOps.runDestroyBlock === 'function') {
            deps.BoardOps.runDestroyBlock(cardState, gameState, resolveEat, {
                randomSource: p,
                cause: 'GLUTTONOUS_WILL',
                reason: 'gluttonous_eat'
            });
        } else {
            resolveEat();
        }
        if (eatResult) return eatResult;
    }

    const from: Position = { row: entry.row, col: entry.col };
    let movedTo: Position | null = null;
    const moveCandidates = getNeighborEmptyCandidates(cardState, gameState, entry.row, entry.col, { isBlockedCell });
    if (moveCandidates.length > 0) {
        const enemies = collectRobotVacuumEnemies(cardState, gameState, ownerVal, entry.row, entry.col);
        const target = pickRobotVacuumApproachTarget(moveCandidates, enemies, p);
        if (target) {
            let movedRes = false;
            let usedBoardOpsMove = false;
            if (deps.BoardOps && typeof deps.BoardOps.moveAt === 'function') {
                const res = deps.BoardOps.moveAt(
                    cardState,
                    gameState,
                    entry.row,
                    entry.col,
                    target.row,
                    target.col,
                    'GLUTTONOUS_WILL',
                    'gluttonous_starve_move',
                    buildMovingStonePresentationMeta(cardState, entry.row, entry.col)
                );
                movedRes = !!(res && res.moved);
                usedBoardOpsMove = !!(res && res.markerHandled === true);
            } else {
                setBoardCell(cardState, gameState, entry.row, entry.col, EMPTY);
                setBoardCell(cardState, gameState, target.row, target.col, ownerVal);
                movedRes = true;
            }

            if (movedRes) {
                if (!usedBoardOpsMove) {
                    moveCoexistingSpecialMarkers(cardState, entry, entry.row, entry.col, target.row, target.col);
                }
                entry.row = target.row;
                entry.col = target.col;
                movedTo = { row: target.row, col: target.col };
                moved.push({ from, to: movedTo, specialType: 'GLUTTONOUS' });
            }
        }
    }

    const nextMissStreak = missStreak + 1;
    if (entry.data && typeof entry.data === 'object') {
        entry.data.gluttonousMissStreak = nextMissStreak;
    }

    if (nextMissStreak < 2) {
        return { moved, destroyed, flipped, ownerKey, ate };
    }

    const destroyRow = movedTo ? movedTo.row : entry.row;
    const destroyCol = movedTo ? movedTo.col : entry.col;
    const starveReason = movedTo ? 'gluttonous_starved_after_move' : 'gluttonous_starved_no_candidates';
    let selfDestroyed = false;
    if (deps.BoardOps && typeof deps.BoardOps.destroyAt === 'function') {
        const res = deps.BoardOps.destroyAt(
            cardState,
            gameState,
            destroyRow,
            destroyCol,
            'GLUTTONOUS_WILL',
            starveReason,
            {
                sourceRow: from.row,
                sourceCol: from.col,
                projectileOwner: ownerKey,
                projectileStone: 'gluttonous',
                hungry: true,
                gluttonousMissStreak: nextMissStreak,
                ignoreGuard: true
            }
        );
        selfDestroyed = !!(res && res.destroyed);
    } else if (typeof deps.destroyAt === 'function') {
        selfDestroyed = !!deps.destroyAt(cardState, gameState, destroyRow, destroyCol, { ignoreGuard: true });
    }
    if (selfDestroyed) {
        destroyed.push({ row: destroyRow, col: destroyCol, specialType: 'GLUTTONOUS' });
    }

    return { moved, destroyed, flipped, ownerKey, ate };
}

function processRobotVacuumMoveAtAnchor(
    cardState: CardState,
    gameState: GameState,
    playerKey: PlayerKey,
    row: number,
    col: number,
    prng: any,
    deps: HyperactiveDeps = {}
): RobotVacuumMoveResult {
    const entry: MarkerEntry | undefined = ((cardState as any).markers || []).find((s: any) => (
        s &&
        s.kind === 'specialStone' &&
        s.data &&
        s.data.type === 'ROBOT_VACUUM' &&
        s.owner === playerKey &&
        s.row === row &&
        s.col === col
    ));
    if (!entry) {
        return {
            moved: [],
            destroyed: [],
            flipped: [],
            ownerKey: playerKey,
            sucked: [],
            expired: [],
            suckedCount: 0
        };
    }

    const resolveAnchor = (): RobotVacuumMoveResult => {
    const ownerKey = entry.owner as PlayerKey;
    const ownerVal = ownerKey === 'black' ? (BLACK || 1) : (WHITE || -1);
    const randomSource = resolveDeterministicPrng(prng, deps, 'CardHyperactive.processRobotVacuumMoveAtAnchor');
    const currentTurnPlayerKey = (typeof deps.currentTurnPlayerKey === 'string' && deps.currentTurnPlayerKey)
        ? deps.currentTurnPlayerKey
        : playerKey;
    const defaultRemainingTurns = Number.isInteger(deps.robotVacuumTurns) ? deps.robotVacuumTurns : 5;

    const moveRes = moveRobotVacuumOnce(cardState, gameState, entry, prng, deps);
    const moved = Array.isArray(moveRes.moved) ? moveRes.moved.slice() : [];
    const moveDestroyed = Array.isArray(moveRes.destroyed) ? moveRes.destroyed.slice() : [];
    const destroyed = moveDestroyed.filter((detail: any) => !(detail && detail.reverted === true));
    const flipped = Array.isArray(moveRes.flipped) ? moveRes.flipped.slice() : [];
    const sucked: any[] = [];
    const expired: any[] = moveDestroyed.filter((detail: any) => detail && detail.reverted === true);

    const markerStillExists = Array.isArray((cardState as any).markers) && (cardState as any).markers.includes(entry);
    const anchorStillOwned = markerStillExists && getBoardCell(cardState, gameState, entry.row, entry.col) === ownerVal;

    if (anchorStillOwned) {
        const targets = collectRobotVacuumTargets(cardState, gameState, ownerVal, entry.row, entry.col, deps).slice();
        while (targets.length > 0) {
            const pickIndex = Math.floor(randomSource.random() * targets.length);
            const index = Number.isInteger(pickIndex) && pickIndex >= 0 && pickIndex < targets.length ? pickIndex : 0;
            const target = targets.splice(index, 1)[0];
            let destroyedRes = false;
            const destroyMeta = {
                sourceRow: entry.row,
                sourceCol: entry.col,
                projectileOwner: ownerKey,
                projectileStone: 'robot_vacuum',
                suction: true
            };
            if (deps.BoardOps && typeof deps.BoardOps.destroyAt === 'function') {
                const res = deps.BoardOps.destroyAt(cardState, gameState, target.row, target.col, 'ROBOT_VACUUM', 'robot_vacuum_suck', destroyMeta);
                destroyedRes = !!(res && res.destroyed);
            } else {
                const guarded = ((cardState as any).markers || []).some((m: any) => (
                    m &&
                    m.kind === 'specialStone' &&
                    m.row === target.row &&
                    m.col === target.col &&
                    m.data &&
                    m.data.type === 'GUARD'
                ));
                if (!guarded && typeof deps.destroyAt === 'function') {
                    destroyedRes = !!deps.destroyAt(cardState, gameState, target.row, target.col);
                }
            }

            if (destroyedRes) {
                const detail = {
                    row: target.row,
                    col: target.col,
                    sourceRow: entry.row,
                    sourceCol: entry.col
                };
                sucked.push(detail);
                destroyed.push(detail);
                break;
            }
        }
    }

    const markerAfterSuction = Array.isArray((cardState as any).markers) && (cardState as any).markers.includes(entry);
    if (markerAfterSuction && entry.data && sucked.length > 0) {
        const beforeExtend = Number.isFinite(Number(entry.data.remainingOwnerTurns))
            ? Number(entry.data.remainingOwnerTurns)
            : defaultRemainingTurns as number;
        entry.data.remainingOwnerTurns = beforeExtend + sucked.length;
    }
    if (markerAfterSuction && currentTurnPlayerKey === ownerKey) {
        const before = (entry.data && Number.isFinite(Number(entry.data.remainingOwnerTurns)))
            ? Number(entry.data.remainingOwnerTurns)
            : defaultRemainingTurns as number;
        const afterDec = Math.max(0, before - 1);
        if (entry.data) entry.data.remainingOwnerTurns = afterDec;
        if (afterDec <= 0) {
            const anchorReverted = revertTimedSpecialAt(
                cardState,
                gameState,
                entry.row,
                entry.col,
                ownerKey,
                'ROBOT_VACUUM',
                deps,
                'ROBOT_VACUUM',
                'anchor_expired'
            );

            if (anchorReverted) {
                expired.push({ row: entry.row, col: entry.col, specialType: 'ROBOT_VACUUM', owner: ownerKey, reason: 'anchor_expired', reverted: true });
            }
        }
    }

    return {
        moved,
        destroyed,
        flipped,
        ownerKey,
        sucked,
        expired,
        suckedCount: sucked.length
    };
    };

    if (deps.BoardOps && typeof deps.BoardOps.runEffectBlock === 'function') {
        return deps.BoardOps.runEffectBlock(cardState, gameState, {
            kind: 'anchor_effect',
            cause: 'ROBOT_VACUUM',
            reason: 'robot_vacuum_suck',
            owner: playerKey,
            sourceRow: row,
            sourceCol: col,
            randomSource: resolveDeterministicPrng(prng, deps, 'CardHyperactive.processRobotVacuumMoveAtAnchor')
        }, resolveAnchor);
    }
    return resolveAnchor();
}

const _exports: any = {
    setHyperactiveRuntime,
    moveHyperactiveOnce,
    moveRandomAdjacentStoneAtAnchor,
    resolveHyperactiveFlipEvasion,
    resolveEvasionMoveFlips,
    processHyperactiveMoves,
    processHyperactiveMoveAtAnchor,
    processInstantHyperactiveMoveAtAnchor,
    processUltimateHyperactiveMoveAtAnchor,
    processGluttonousMoveAtAnchor,
    processRobotVacuumMoveAtAnchor
};

export = _exports;
