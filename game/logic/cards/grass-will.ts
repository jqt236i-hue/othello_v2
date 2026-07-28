/**
 * @file grass-will.ts
 * @description Canonical GRASS_WILL anchor lifecycle and deterministic seed placement.
 */

declare const __non_webpack_require__: NodeRequire | undefined;

type GrassSeatKey = 'black' | 'white';
type GrassRandomLike = (() => number) | { random: () => number };

interface GrassMarker {
    id?: number;
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

interface GrassCardState {
    markers?: GrassMarker[];
    [key: string]: unknown;
}

interface GrassGameState {
    board?: number[][];
    [key: string]: unknown;
}

interface GrassDeps {
    random?: GrassRandomLike | null;
    decrementRemainingOwnerTurns?: boolean;
    getSeedTargets?: (
        cardState: GrassCardState,
        gameState: GrassGameState,
        playerKey: GrassSeatKey
    ) => Array<{ row: number; col: number }>;
    applySeedMarker?: (
        cardState: GrassCardState,
        gameState: GrassGameState,
        playerKey: GrassSeatKey,
        row: number,
        col: number,
        sourceCardType: string,
        sourceRow?: number,
        sourceCol?: number
    ) => Record<string, any>;
    BoardOps?: {
        getCellValue?: (
            gameState: GrassGameState,
            row: number,
            col: number,
            cardState?: GrassCardState | null
        ) => number | null;
        revertSpecialStoneAt?: (
            cardState: GrassCardState,
            gameState: GrassGameState,
            row: number,
            col: number,
            specialType: string,
            playerKey: GrassSeatKey,
            cause: string,
            reason: string
        ) => { reverted?: boolean } | null | undefined;
        runEffectBlock?: <T>(
            cardState: GrassCardState,
            gameState: GrassGameState,
            meta: Record<string, unknown>,
            fn: () => T
        ) => T;
    } | null;
}

interface GrassResult {
    seeded: Array<{
        row: number;
        col: number;
        sourceRow: number;
        sourceCol: number;
        removedTypes: string[];
    }>;
    anchors: Array<{ row: number; col: number; remainingNow: number }>;
    expired: Array<{ row: number; col: number; owner: GrassSeatKey; reason: string }>;
}

function _require(id: string): any {
    if (typeof __non_webpack_require__ !== 'undefined') return __non_webpack_require__(id);
    if (typeof require === 'function') return require(id);
    throw new Error(`Unable to require ${id}`);
}

function safeRequire(id: string): any {
    try {
        return _require(id);
    } catch (_error) {
        return null;
    }
}

function getRuntimeGlobal(key: string): any {
    if (typeof globalThis !== 'undefined' && (globalThis as any)[key]) return (globalThis as any)[key];
    if (typeof self !== 'undefined' && (self as any)[key]) return (self as any)[key];
    return null;
}

const SharedConstants = safeRequire('../../../shared-constants') || getRuntimeGlobal('SharedConstants');
const BoardUtils = safeRequire('../../../shared/shared-board-utils') || getRuntimeGlobal('SharedBoardUtils');
const RandomSourceModule = safeRequire('../cards-internal/random-source') || getRuntimeGlobal('CardRandomSource');

const BLACK = Number(SharedConstants && SharedConstants.BLACK);
const WHITE = Number(SharedConstants && SharedConstants.WHITE);

if (!Number.isFinite(BLACK) || !Number.isFinite(WHITE)) {
    throw new Error('SharedConstants missing required values for CardGrassWill');
}
if (!BoardUtils || typeof BoardUtils.createBoardContext !== 'function' || typeof BoardUtils.getCellValue !== 'function') {
    throw new Error('SharedBoardUtils BoardContext access is required by CardGrassWill');
}

function resolveRandomFunction(randomLike: GrassRandomLike | null | undefined): () => number {
    if (RandomSourceModule && typeof RandomSourceModule.resolveRandomFunction === 'function') {
        return RandomSourceModule.resolveRandomFunction(randomLike, null, 'CardGrassWill');
    }
    if (typeof randomLike === 'function') return randomLike;
    if (randomLike && typeof randomLike.random === 'function') return () => randomLike.random();
    throw new Error('CardGrassWill requires an injected deterministic PRNG.');
}

function resolveRandomIndex(length: number, randomFn: () => number): number {
    if (length <= 0) return -1;
    if (RandomSourceModule && typeof RandomSourceModule.resolveRandomIndex === 'function') {
        return RandomSourceModule.resolveRandomIndex(length, { random: randomFn }, null, 'CardGrassWill');
    }
    const raw = Number(randomFn());
    if (!Number.isFinite(raw)) throw new Error('CardGrassWill received a non-finite PRNG value.');
    return Math.max(0, Math.min(length - 1, Math.floor(Math.max(0, Math.min(0.999999, raw)) * length)));
}

function getCellValue(cardState: GrassCardState, gameState: GrassGameState, row: number, col: number): number | null {
    return BoardUtils.getCellValue(BoardUtils.createBoardContext(gameState, cardState), row, col);
}

function cleanupExpiredGrass(cardState: GrassCardState): void {
    if (!Array.isArray(cardState.markers)) return;
    cardState.markers = cardState.markers.filter((marker) => (
        !marker ||
        marker.kind !== 'specialStone' ||
        !marker.data ||
        String(marker.data.type || '').toUpperCase() !== 'GRASS' ||
        (Number.isFinite(Number(marker.data.remainingOwnerTurns)) && Number(marker.data.remainingOwnerTurns) >= 0)
    ));
}

function expireAnchor(
    cardState: GrassCardState,
    gameState: GrassGameState,
    playerKey: GrassSeatKey,
    marker: GrassMarker,
    deps: GrassDeps,
    expired: GrassResult['expired']
): void {
    let reverted = false;
    if (deps.BoardOps && typeof deps.BoardOps.revertSpecialStoneAt === 'function') {
        const result = deps.BoardOps.revertSpecialStoneAt(
            cardState,
            gameState,
            marker.row,
            marker.col,
            'GRASS',
            playerKey,
            'GRASS_WILL',
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

function emptyResult(): GrassResult {
    return { seeded: [], anchors: [], expired: [] };
}

function processAnchor(
    cardState: GrassCardState,
    gameState: GrassGameState,
    playerKey: GrassSeatKey,
    row: number,
    col: number,
    deps: GrassDeps
): GrassResult {
    const result = emptyResult();
    const marker = (cardState.markers || []).find((entry) => (
        entry &&
        entry.kind === 'specialStone' &&
        entry.owner === playerKey &&
        entry.row === row &&
        entry.col === col &&
        entry.data &&
        String(entry.data.type || '').toUpperCase() === 'GRASS'
    ));
    if (!marker) return result;

    const playerValue = playerKey === 'black' ? BLACK : WHITE;
    if (getCellValue(cardState, gameState, row, col) !== playerValue) {
        if (marker.data) marker.data.remainingOwnerTurns = -1;
        cleanupExpiredGrass(cardState);
        return result;
    }
    if (typeof deps.getSeedTargets !== 'function' || typeof deps.applySeedMarker !== 'function') {
        throw new Error('CardGrassWill requires canonical seed target and apply dependencies.');
    }

    const resolveEffect = (): GrassResult => {
        const targets = deps.getSeedTargets!(cardState, gameState, playerKey)
            .filter((target) => target && Number.isInteger(target.row) && Number.isInteger(target.col));
        if (targets.length > 0) {
            const randomFn = resolveRandomFunction(deps.random);
            const target = targets[resolveRandomIndex(targets.length, randomFn)];
            const applied = deps.applySeedMarker!(
                cardState,
                gameState,
                playerKey,
                target.row,
                target.col,
                'GRASS_WILL',
                row,
                col
            );
            if (applied && applied.applied) {
                result.seeded.push({
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
        if (marker.data) marker.data.remainingOwnerTurns = after;
        if (shouldDecrement && after >= 0) result.anchors.push({ row, col, remainingNow: after });
        if (shouldDecrement && after === 0) expireAnchor(cardState, gameState, playerKey, marker, deps, result.expired);
        if (shouldDecrement && after < 0 && marker.data) marker.data.remainingOwnerTurns = -1;
        cleanupExpiredGrass(cardState);
        return result;
    };

    if (deps.BoardOps && typeof deps.BoardOps.runEffectBlock === 'function') {
        return deps.BoardOps.runEffectBlock(cardState, gameState, {
            kind: 'anchor_effect',
            cause: 'GRASS_WILL',
            reason: 'grass_seeded',
            owner: playerKey,
            sourceRow: row,
            sourceCol: col,
            randomSource: deps.random || null
        }, resolveEffect);
    }
    return resolveEffect();
}

function processGrassWillEffects(
    cardState: GrassCardState,
    gameState: GrassGameState,
    playerKey: GrassSeatKey,
    deps: GrassDeps = {}
): GrassResult {
    const aggregate = emptyResult();
    const markers = (cardState.markers || []).filter((marker) => (
        marker &&
        marker.kind === 'specialStone' &&
        marker.owner === playerKey &&
        marker.data &&
        String(marker.data.type || '').toUpperCase() === 'GRASS'
    )).sort((left, right) => Number(left.createdSeq || 0) - Number(right.createdSeq || 0));
    for (const marker of markers) {
        const result = processAnchor(cardState, gameState, playerKey, marker.row, marker.col, deps);
        aggregate.seeded.push(...result.seeded);
        aggregate.anchors.push(...result.anchors);
        aggregate.expired.push(...result.expired);
    }
    return aggregate;
}

function processGrassWillEffectsAtAnchor(
    cardState: GrassCardState,
    gameState: GrassGameState,
    playerKey: GrassSeatKey,
    row: number,
    col: number,
    deps: GrassDeps = {}
): GrassResult {
    return processAnchor(cardState, gameState, playerKey, row, col, deps);
}

const CardGrassWill = {
    processGrassWillEffects,
    processGrassWillEffectsAtAnchor,
    processGrassWillEffectsAtTurnStartAnchor: processGrassWillEffectsAtAnchor
};

module.exports = CardGrassWill;

export = CardGrassWill;
