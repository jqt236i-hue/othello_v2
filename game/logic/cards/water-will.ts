/**
 * @file water-will.ts
 * @description Canonical WATER_WILL anchor lifecycle and deterministic healing-cell placement.
 * Healing cells avoid existing healing cells and prefer the owner's other special-stone bodies.
 */

import SharedConstantsImport = require('../../../shared-constants');
import BoardUtilsImport = require('../../../shared/shared-board-utils');
import RandomSourceImport = require('../cards-internal/random-source');

const SharedConstants: any = SharedConstantsImport;
const BoardUtils: any = BoardUtilsImport;
const RandomSourceModule: any = RandomSourceImport;

type WaterSeatKey = 'black' | 'white';
type WaterRandomLike = (() => number) | { random: () => number };

interface WaterMarker {
    id?: number;
    markerId?: string;
    createdSeq?: number;
    kind?: string;
    row: number;
    col: number;
    owner?: unknown;
    data?: {
        type?: string;
        remainingOwnerTurns?: number;
        [key: string]: unknown;
    } | null;
}

interface WaterCardState {
    markers?: WaterMarker[];
    [key: string]: unknown;
}

interface WaterGameState {
    board?: number[][];
    [key: string]: unknown;
}

interface WaterDeps {
    random?: WaterRandomLike | null;
    anchorType?: string;
    decrementRemainingOwnerTurns?: boolean;
    getHealingCellTargets?: (
        cardState: WaterCardState,
        gameState: WaterGameState,
        playerKey: WaterSeatKey
    ) => Array<{ row: number; col: number }>;
    isTrueSpecialStoneMarker?: (marker: WaterMarker) => boolean;
    applyHealingCell?: (
        cardState: WaterCardState,
        gameState: WaterGameState,
        playerKey: WaterSeatKey,
        row: number,
        col: number,
        sourceRow: number,
        sourceCol: number
    ) => Record<string, any>;
    BoardOps?: {
        revertSpecialStoneAt?: (
            cardState: WaterCardState,
            gameState: WaterGameState,
            row: number,
            col: number,
            specialType: string,
            playerKey: WaterSeatKey,
            cause: string,
            reason: string
        ) => { reverted?: boolean } | null | undefined;
        runEffectBlock?: <T>(
            cardState: WaterCardState,
            gameState: WaterGameState,
            meta: Record<string, unknown>,
            fn: () => T
        ) => T;
    } | null;
}

interface WaterResult {
    healingCells: Array<{
        row: number;
        col: number;
        sourceRow: number;
        sourceCol: number;
        removedTypes: string[];
    }>;
    anchors: Array<{ row: number; col: number; remainingNow: number }>;
    expired: Array<{ row: number; col: number; owner: WaterSeatKey; reason: string }>;
}

const BLACK = Number(SharedConstants && SharedConstants.BLACK);
const WHITE = Number(SharedConstants && SharedConstants.WHITE);

if (!Number.isFinite(BLACK) || !Number.isFinite(WHITE)) {
    throw new Error('SharedConstants missing required values for CardWaterWill');
}
if (!BoardUtils || typeof BoardUtils.createBoardContext !== 'function' || typeof BoardUtils.getCellValue !== 'function') {
    throw new Error('SharedBoardUtils BoardContext access is required by CardWaterWill');
}

function resolveRandomFunction(randomLike: WaterRandomLike | null | undefined): () => number {
    if (RandomSourceModule && typeof RandomSourceModule.resolveRandomFunction === 'function') {
        return RandomSourceModule.resolveRandomFunction(randomLike, null, 'CardWaterWill');
    }
    if (typeof randomLike === 'function') return randomLike;
    if (randomLike && typeof randomLike.random === 'function') return () => randomLike.random();
    throw new Error('CardWaterWill requires an injected deterministic PRNG.');
}

function resolveRandomIndex(length: number, randomFn: () => number): number {
    if (length <= 0) return -1;
    if (RandomSourceModule && typeof RandomSourceModule.resolveRandomIndex === 'function') {
        return RandomSourceModule.resolveRandomIndex(length, { random: randomFn }, null, 'CardWaterWill');
    }
    const raw = Number(randomFn());
    if (!Number.isFinite(raw)) throw new Error('CardWaterWill received a non-finite PRNG value.');
    return Math.max(0, Math.min(length - 1, Math.floor(Math.max(0, Math.min(0.999999, raw)) * length)));
}

function getCellValue(cardState: WaterCardState, gameState: WaterGameState, row: number, col: number): number | null {
    return BoardUtils.getCellValue(BoardUtils.createBoardContext(gameState, cardState), row, col);
}

function cleanupExpiredWater(cardState: WaterCardState): void {
    if (!Array.isArray(cardState.markers)) return;
    cardState.markers = cardState.markers.filter((marker) => (
        !marker ||
        marker.kind !== 'specialStone' ||
        !marker.data ||
        String(marker.data.type || '').toUpperCase() !== 'WATER' ||
        (Number.isFinite(Number(marker.data.remainingOwnerTurns)) && Number(marker.data.remainingOwnerTurns) >= 0)
    ));
}

function isActiveOwnSpecialStoneBody(
    cardState: WaterCardState,
    gameState: WaterGameState,
    playerKey: WaterSeatKey,
    marker: WaterMarker,
    isTrueSpecialStoneMarker: (marker: WaterMarker) => boolean
): boolean {
    if (!marker || marker.kind !== 'specialStone' || marker.owner !== playerKey || !marker.data) return false;
    if (!isTrueSpecialStoneMarker(marker)) return false;
    if (Object.prototype.hasOwnProperty.call(marker.data, 'remainingOwnerTurns')) {
        const remaining = Number(marker.data.remainingOwnerTurns);
        if (!Number.isFinite(remaining) || remaining <= 0) return false;
    }
    const playerValue = playerKey === 'black' ? BLACK : WHITE;
    return getCellValue(cardState, gameState, marker.row, marker.col) === playerValue;
}

function getHealingCellKeys(cardState: WaterCardState): Set<string> {
    return new Set(
        (cardState.markers || [])
            .filter((entry) => entry && entry.data && String(entry.data.type || '').toUpperCase() === 'HEALING_CELL')
            .map((entry) => `${entry.row},${entry.col}`)
    );
}

// Narrow the candidates, in order, to: the owner's special-stone bodies (excluding the emitting
// anchor) not yet on a healing cell; any cell not yet healing; otherwise every candidate.
function preferOwnSpecialStoneTargets(
    cardState: WaterCardState,
    gameState: WaterGameState,
    playerKey: WaterSeatKey,
    sourceMarker: WaterMarker,
    targets: Array<{ row: number; col: number }>,
    deps: WaterDeps
): Array<{ row: number; col: number }> {
    if (typeof deps.isTrueSpecialStoneMarker !== 'function') {
        throw new Error('CardWaterWill requires isTrueSpecialStoneMarker to prefer own special stones.');
    }
    const isTrueSpecialStoneMarker = deps.isTrueSpecialStoneMarker;
    const preferredKeys = new Set(
        (cardState.markers || [])
            .filter((entry) => (
                entry !== sourceMarker &&
                !(entry && entry.row === sourceMarker.row && entry.col === sourceMarker.col) &&
                isActiveOwnSpecialStoneBody(cardState, gameState, playerKey, entry, isTrueSpecialStoneMarker)
            ))
            .map((entry) => `${entry.row},${entry.col}`)
    );
    const healingKeys = getHealingCellKeys(cardState);
    const fresh = targets.filter((target) => !healingKeys.has(`${target.row},${target.col}`));
    const preferred = fresh.filter((target) => preferredKeys.has(`${target.row},${target.col}`));
    if (preferred.length > 0) return preferred;
    return fresh.length > 0 ? fresh : targets;
}

function emptyResult(): WaterResult {
    return { healingCells: [], anchors: [], expired: [] };
}

function expireAnchor(
    cardState: WaterCardState,
    gameState: WaterGameState,
    playerKey: WaterSeatKey,
    marker: WaterMarker,
    deps: WaterDeps,
    expired: WaterResult['expired']
): void {
    let reverted = false;
    if (deps.BoardOps && typeof deps.BoardOps.revertSpecialStoneAt === 'function') {
        const result = deps.BoardOps.revertSpecialStoneAt(
            cardState,
            gameState,
            marker.row,
            marker.col,
            'WATER',
            playerKey,
            'WATER_WILL',
            'anchor_expired'
        );
        reverted = !!(result && result.reverted);
    } else if (Array.isArray(cardState.markers)) {
        cardState.markers = cardState.markers.filter((entry) => entry !== marker);
        reverted = true;
    }
    if (reverted) expired.push({ row: marker.row, col: marker.col, owner: playerKey, reason: 'anchor_expired' });
    if (marker.data) marker.data.remainingOwnerTurns = -1;
}

function processAnchor(
    cardState: WaterCardState,
    gameState: WaterGameState,
    playerKey: WaterSeatKey,
    row: number,
    col: number,
    deps: WaterDeps
): WaterResult {
    const result = emptyResult();
    const anchorType = String(deps.anchorType || 'WATER').toUpperCase();
    const marker = (cardState.markers || []).find((entry) => (
        entry &&
        entry.kind === 'specialStone' &&
        entry.owner === playerKey &&
        entry.row === row &&
        entry.col === col &&
        entry.data &&
        String(entry.data.type || '').toUpperCase() === anchorType
    ));
    if (!marker) return result;

    const playerValue = playerKey === 'black' ? BLACK : WHITE;
    if (getCellValue(cardState, gameState, row, col) !== playerValue) {
        if (marker.data) marker.data.remainingOwnerTurns = -1;
        cleanupExpiredWater(cardState);
        return result;
    }
    if (typeof deps.getHealingCellTargets !== 'function' || typeof deps.applyHealingCell !== 'function') {
        throw new Error('CardWaterWill requires canonical healing-cell target and apply dependencies.');
    }

    const resolveEffect = (): WaterResult => {
        const allTargets = deps.getHealingCellTargets!(cardState, gameState, playerKey)
            .filter((target) => target && Number.isInteger(target.row) && Number.isInteger(target.col));
        const targets = preferOwnSpecialStoneTargets(cardState, gameState, playerKey, marker, allTargets, deps);
        if (targets.length > 0) {
            const randomFn = resolveRandomFunction(deps.random);
            const target = targets[resolveRandomIndex(targets.length, randomFn)];
            const applied = deps.applyHealingCell!(
                cardState,
                gameState,
                playerKey,
                target.row,
                target.col,
                row,
                col
            );
            if (applied && applied.applied) {
                result.healingCells.push({
                    row: target.row,
                    col: target.col,
                    sourceRow: row,
                    sourceCol: col,
                    removedTypes: Array.isArray(applied.removedTypes) ? applied.removedTypes.slice() : []
                });
            }
        }

        const before = marker.data && Number.isFinite(Number(marker.data.remainingOwnerTurns))
            ? Number(marker.data.remainingOwnerTurns)
            : 0;
        const shouldDecrement = deps.decrementRemainingOwnerTurns !== false;
        const after = shouldDecrement ? before - 1 : before;
        if (shouldDecrement && marker.data) marker.data.remainingOwnerTurns = after;
        if (shouldDecrement && after >= 0) result.anchors.push({ row, col, remainingNow: after });
        if (shouldDecrement && after === 0) expireAnchor(cardState, gameState, playerKey, marker, deps, result.expired);
        if (shouldDecrement && after < 0 && marker.data) marker.data.remainingOwnerTurns = -1;
        cleanupExpiredWater(cardState);
        return result;
    };

    if (deps.BoardOps && typeof deps.BoardOps.runEffectBlock === 'function') {
        return deps.BoardOps.runEffectBlock(cardState, gameState, {
            kind: 'anchor_effect',
            cause: 'WATER_WILL',
            reason: 'healing_cell_applied',
            owner: playerKey,
            sourceRow: row,
            sourceCol: col,
            randomSource: deps.random || null
        }, resolveEffect);
    }
    return resolveEffect();
}

function processWaterWillEffects(
    cardState: WaterCardState,
    gameState: WaterGameState,
    playerKey: WaterSeatKey,
    deps: WaterDeps = {}
): WaterResult {
    const aggregate = emptyResult();
    const markers = (cardState.markers || []).filter((marker) => (
        marker &&
        marker.kind === 'specialStone' &&
        marker.owner === playerKey &&
        marker.data &&
        String(marker.data.type || '').toUpperCase() === 'WATER'
    )).slice().sort((left, right) => (
        (Number(left.createdSeq) || 0) - (Number(right.createdSeq) || 0) ||
        left.row - right.row ||
        left.col - right.col
    ));
    for (const marker of markers) {
        const result = processAnchor(cardState, gameState, playerKey, marker.row, marker.col, deps);
        aggregate.healingCells.push(...result.healingCells);
        aggregate.anchors.push(...result.anchors);
        aggregate.expired.push(...result.expired);
    }
    return aggregate;
}

function processWaterWillEffectsAtAnchor(
    cardState: WaterCardState,
    gameState: WaterGameState,
    playerKey: WaterSeatKey,
    row: number,
    col: number,
    deps: WaterDeps = {}
): WaterResult {
    return processAnchor(cardState, gameState, playerKey, row, col, deps);
}

const CardWaterWill = {
    processWaterWillEffects,
    processWaterWillEffectsAtAnchor,
    processWaterWillEffectsAtTurnStartAnchor: processWaterWillEffectsAtAnchor
};

module.exports = CardWaterWill;

export = CardWaterWill;
