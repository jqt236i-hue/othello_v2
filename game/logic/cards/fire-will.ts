/**
 * @file fire-will.ts
 * @description Canonical FIRE_WILL anchor lifecycle and deterministic scorch-cell placement.
 */

declare const __non_webpack_require__: NodeRequire | undefined;

type FireSeatKey = 'black' | 'white';
type FireRandomLike = (() => number) | { random: () => number };

interface FireMarker {
    id?: number;
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

interface FireCardState {
    markers?: FireMarker[];
    [key: string]: unknown;
}

interface FireGameState {
    board?: number[][];
    [key: string]: unknown;
}

interface FireDeps {
    random?: FireRandomLike | null;
    decrementRemainingOwnerTurns?: boolean;
    getScorchTargets?: (cardState: FireCardState, gameState: FireGameState, playerKey: FireSeatKey) => Array<{ row: number; col: number }>;
    applyScorchedCell?: (
        cardState: FireCardState,
        gameState: FireGameState,
        playerKey: FireSeatKey,
        row: number,
        col: number,
        sourceRow: number,
        sourceCol: number
    ) => Record<string, any>;
    BoardOps?: {
        getCellValue?: (gameState: FireGameState, row: number, col: number, cardState?: FireCardState | null) => number | null;
        revertSpecialStoneAt?: (
            cardState: FireCardState,
            gameState: FireGameState,
            row: number,
            col: number,
            specialType: string,
            playerKey: FireSeatKey,
            cause: string,
            reason: string
        ) => { reverted?: boolean } | null | undefined;
        runEffectBlock?: <T>(
            cardState: FireCardState,
            gameState: FireGameState,
            meta: Record<string, unknown>,
            fn: () => T
        ) => T;
    } | null;
}

interface FireResult {
    scorched: Array<{
        row: number;
        col: number;
        sourceRow: number;
        sourceCol: number;
        removedTypes: string[];
    }>;
    anchors: Array<{ row: number; col: number; remainingNow: number }>;
    expired: Array<{ row: number; col: number; owner: FireSeatKey; reason: string }>;
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
    throw new Error('SharedConstants missing required values for CardFireWill');
}
if (!BoardUtils || typeof BoardUtils.createBoardContext !== 'function' || typeof BoardUtils.getCellValue !== 'function') {
    throw new Error('SharedBoardUtils BoardContext access is required by CardFireWill');
}

function resolveRandomFunction(randomLike: FireRandomLike | null | undefined): () => number {
    if (RandomSourceModule && typeof RandomSourceModule.resolveRandomFunction === 'function') {
        return RandomSourceModule.resolveRandomFunction(randomLike, null, 'CardFireWill');
    }
    if (typeof randomLike === 'function') return randomLike;
    if (randomLike && typeof randomLike.random === 'function') return () => randomLike.random();
    throw new Error('CardFireWill requires an injected deterministic PRNG.');
}

function resolveRandomIndex(length: number, randomFn: () => number): number {
    if (length <= 0) return -1;
    if (RandomSourceModule && typeof RandomSourceModule.resolveRandomIndex === 'function') {
        return RandomSourceModule.resolveRandomIndex(length, { random: randomFn }, null, 'CardFireWill');
    }
    const raw = Number(randomFn());
    if (!Number.isFinite(raw)) throw new Error('CardFireWill received a non-finite PRNG value.');
    return Math.max(0, Math.min(length - 1, Math.floor(Math.max(0, Math.min(0.999999, raw)) * length)));
}

function getCellValue(cardState: FireCardState, gameState: FireGameState, row: number, col: number): number | null {
    return BoardUtils.getCellValue(BoardUtils.createBoardContext(gameState, cardState), row, col);
}

function cleanupExpiredFire(cardState: FireCardState): void {
    if (!Array.isArray(cardState.markers)) return;
    cardState.markers = cardState.markers.filter((marker) => (
        !marker ||
        marker.kind !== 'specialStone' ||
        !marker.data ||
        String(marker.data.type || '').toUpperCase() !== 'FIRE' ||
        (Number.isFinite(Number(marker.data.remainingOwnerTurns)) && Number(marker.data.remainingOwnerTurns) >= 0)
    ));
}

function expireAnchor(
    cardState: FireCardState,
    gameState: FireGameState,
    playerKey: FireSeatKey,
    marker: FireMarker,
    deps: FireDeps,
    expired: FireResult['expired']
): void {
    let reverted = false;
    if (deps.BoardOps && typeof deps.BoardOps.revertSpecialStoneAt === 'function') {
        const result = deps.BoardOps.revertSpecialStoneAt(
            cardState,
            gameState,
            marker.row,
            marker.col,
            'FIRE',
            playerKey,
            'FIRE_WILL',
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

function emptyResult(): FireResult {
    return { scorched: [], anchors: [], expired: [] };
}

function processAnchor(
    cardState: FireCardState,
    gameState: FireGameState,
    playerKey: FireSeatKey,
    row: number,
    col: number,
    deps: FireDeps
): FireResult {
    const result = emptyResult();
    const marker = (cardState.markers || []).find((entry) => (
        entry &&
        entry.kind === 'specialStone' &&
        entry.owner === playerKey &&
        entry.row === row &&
        entry.col === col &&
        entry.data &&
        String(entry.data.type || '').toUpperCase() === 'FIRE'
    ));
    if (!marker) return result;

    const playerValue = playerKey === 'black' ? BLACK : WHITE;
    if (getCellValue(cardState, gameState, row, col) !== playerValue) {
        if (marker.data) marker.data.remainingOwnerTurns = -1;
        cleanupExpiredFire(cardState);
        return result;
    }
    if (typeof deps.getScorchTargets !== 'function' || typeof deps.applyScorchedCell !== 'function') {
        throw new Error('CardFireWill requires canonical scorch target and apply dependencies.');
    }

    const resolveEffect = (): FireResult => {
        const targets = deps.getScorchTargets!(cardState, gameState, playerKey)
            .filter((target) => target && Number.isInteger(target.row) && Number.isInteger(target.col));
        if (targets.length > 0) {
            const randomFn = resolveRandomFunction(deps.random);
            const target = targets[resolveRandomIndex(targets.length, randomFn)];
            const applied = deps.applyScorchedCell!(
                cardState,
                gameState,
                playerKey,
                target.row,
                target.col,
                row,
                col
            );
            if (applied && applied.applied) {
                result.scorched.push({
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
        cleanupExpiredFire(cardState);
        return result;
    };

    if (deps.BoardOps && typeof deps.BoardOps.runEffectBlock === 'function') {
        return deps.BoardOps.runEffectBlock(cardState, gameState, {
            kind: 'anchor_effect',
            cause: 'FIRE_WILL',
            reason: 'scorched_cell_applied',
            owner: playerKey,
            sourceRow: row,
            sourceCol: col,
            randomSource: deps.random || null
        }, resolveEffect);
    }
    return resolveEffect();
}

function processFireWillEffects(
    cardState: FireCardState,
    gameState: FireGameState,
    playerKey: FireSeatKey,
    deps: FireDeps = {}
): FireResult {
    const aggregate = emptyResult();
    const markers = (cardState.markers || []).filter((marker) => (
        marker &&
        marker.kind === 'specialStone' &&
        marker.owner === playerKey &&
        marker.data &&
        String(marker.data.type || '').toUpperCase() === 'FIRE'
    ));
    for (const marker of markers) {
        const result = processAnchor(cardState, gameState, playerKey, marker.row, marker.col, deps);
        aggregate.scorched.push(...result.scorched);
        aggregate.anchors.push(...result.anchors);
        aggregate.expired.push(...result.expired);
    }
    return aggregate;
}

function processFireWillEffectsAtAnchor(
    cardState: FireCardState,
    gameState: FireGameState,
    playerKey: FireSeatKey,
    row: number,
    col: number,
    deps: FireDeps = {}
): FireResult {
    return processAnchor(cardState, gameState, playerKey, row, col, deps);
}

const CardFireWill = {
    processFireWillEffects,
    processFireWillEffectsAtAnchor,
    processFireWillEffectsAtTurnStartAnchor: processFireWillEffectsAtAnchor
};

module.exports = CardFireWill;

export = CardFireWill;
