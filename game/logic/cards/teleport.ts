/**
 * @file teleport.ts
 * @description Teleport helpers (Shared between Browser and Headless)
 */

import { CardState, GameState } from '../../../src/types';

declare const __non_webpack_require__: NodeRequire | undefined;

function _require(id: string): any {
    if (typeof __non_webpack_require__ !== 'undefined') {
        return __non_webpack_require__(id);
    }
    if (typeof require === 'function') {
        return require(id);
    }
    throw new Error('Unable to require ' + id);
}

function safeRequire(id: string): any {
    try {
        return _require(id);
    } catch (e) {
        return null;
    }
}

const SharedConstants = ((typeof module === 'object' && module.exports)
    ? safeRequire('../../../shared-constants')
    : null) || (typeof self !== 'undefined' ? (self as any).SharedConstants : undefined);

const RandomSourceModule = ((typeof module === 'object' && module.exports)
    ? safeRequire('../cards-internal/random-source')
    : null) || (typeof self !== 'undefined' ? (self as any).CardRandomSource : null);

const CardCellRemoval = ((typeof module === 'object' && module.exports)
    ? safeRequire('./cell-removal')
    : null) || (typeof self !== 'undefined' ? (self as any).CardCellRemoval : null) || {
    applyHoleStyleCellRemoval: (_cardState: CardState, _gameState: GameState, targetRow: number, targetCol: number, _playerKey: string, cause: string) => ({
        applied: false,
        reason: 'cell_removal_dependency_missing',
        row: targetRow,
        col: targetCol,
        cause
    }),
    runHoleStyleCellRemovalBlock: (_cardState: CardState, _gameState: GameState, _blockDeps: any, fn: () => any) => fn()
};

const EMPTY = Number.isFinite(Number(SharedConstants && SharedConstants.EMPTY))
    ? Number(SharedConstants.EMPTY)
    : 0;

interface TeleportDeps {
    getCellValueForCard?(gameState: GameState, row: number, col: number): number | null;
    setCellValueForCard?(gameState: GameState, row: number, col: number, value: number): boolean;
    getTeleportTargets?(cardState: CardState, gameState: GameState): Array<{row: number; col: number}>;
    getTeleportDestinations?(cardState: CardState, gameState: GameState): Array<{row: number; col: number}>;
    moveAt?(cardState: CardState, gameState: GameState, fromRow: number, fromCol: number, toRow: number, toCol: number, source: string, tag: string): any;
    getMarkers?(cardState: CardState): any[];
    isBoardMarker?(marker: any): boolean;
    clearStoneIdAtForCard?(cardState: CardState, gameState: GameState, row: number, col: number): void;
    removeMarkersAt?(cardState: CardState, row: number, col: number): void;
    addMarker?(cardState: CardState, kind: string, row: number, col: number, playerKey: string, data: any): boolean;
    applyCellRemovalAt?(cardState: CardState, gameState: GameState, row: number, col: number, playerKey: string, cause: string, reason: string, options: any): any;
    runCellRemovalBlock?(cardState: CardState, gameState: GameState, fn: () => any, meta?: any): any;
    getCellTeleportTargets?(cardState: CardState, gameState: GameState): Array<{row: number; col: number}>;
    getCellTeleportDestinations?(cardState: CardState, gameState: GameState): Array<{row: number; col: number; active?: boolean}>;
    ensureExpansionCellForCard?(gameState: GameState, row: number, col: number, value: number): boolean;
    getStoneIdAtForCard?(cardState: CardState, gameState: GameState, row: number, col: number): string | null;
    setStoneIdAtForCard?(cardState: CardState, gameState: GameState, row: number, col: number, id: string | null): boolean;
}

interface TeleportResult {
    applied: boolean;
    reason?: string;
    from?: { row: number; col: number };
    to?: { row: number; col: number };
    createdDestination?: boolean;
}

function resolveRandomSource(prng?: { random(): number }) {
    if (RandomSourceModule && typeof RandomSourceModule.resolveRandomSource === 'function') {
        return RandomSourceModule.resolveRandomSource(prng, null, 'CardTeleport');
    }
    if (prng && typeof prng.random === 'function') return prng;
    throw new Error('CardTeleport requires an injected deterministic PRNG.');
}

function resolveRandomIndex(randomSource: { random(): number }, length: number): number {
    if (RandomSourceModule && typeof RandomSourceModule.resolveRandomIndex === 'function') {
        return RandomSourceModule.resolveRandomIndex(length, randomSource, null, 'CardTeleport');
    }
    if (!Number.isInteger(length) || length <= 0) return 0;
    const raw = Math.floor(randomSource.random() * length);
    if (!Number.isInteger(raw)) return 0;
    return Math.max(0, Math.min(length - 1, raw));
}

function getMarkers(cardState: CardState, deps: TeleportDeps): any[] {
    if (deps && typeof deps.getMarkers === 'function') {
        return deps.getMarkers(cardState);
    }
    return Array.isArray(cardState && cardState.markers) ? cardState.markers : [];
}

function moveMarkers(cardState: CardState, fromRow: number, fromCol: number, toRow: number, toCol: number, deps: TeleportDeps) {
    const markers = getMarkers(cardState, deps);
    for (const marker of markers) {
        if (!marker) continue;
        if (marker.row !== fromRow || marker.col !== fromCol) continue;
        const boardMarker = deps && typeof deps.isBoardMarker === 'function'
            ? deps.isBoardMarker(marker)
            : ['BLOCKADE', 'METEOR_HOLE', 'FREEZE', 'SEED', 'POISON_CELL', 'SCORCHED_CELL']
                .includes(String(marker && marker.data && marker.data.type ? marker.data.type : '').toUpperCase());
        if (boardMarker) continue;
        marker.row = toRow;
        marker.col = toCol;
    }
}

function applyTeleportWill(cardState: CardState, gameState: GameState, playerKey: string, row: number, col: number, prng?: { random(): number }, deps: TeleportDeps = {}): TeleportResult {
    const cs = cardState as any;
    const pending = cs && cs.pendingEffectByPlayer ? cs.pendingEffectByPlayer[playerKey] : null;
    if (!pending || pending.type !== 'TELEPORT_WILL' || pending.stage !== 'selectTarget') {
        return { applied: false, reason: 'not_pending' };
    }

    const getCellValueForCard = deps.getCellValueForCard || (() => null);
    const setCellValueForCard = deps.setCellValueForCard || (() => false);
    const getTeleportTargets = deps.getTeleportTargets || (() => []);
    const getTeleportDestinations = deps.getTeleportDestinations || (() => []);
    const moveAt = deps.moveAt || null;

    const cellValue = getCellValueForCard(gameState, row, col);
    if (cellValue === null) return { applied: false, reason: 'out_of_board' };
    if (cellValue === EMPTY) return { applied: false, reason: 'empty' };

    const targets = getTeleportTargets(cardState, gameState);
    const allowed = Array.isArray(targets) && targets.some((target) => target && target.row === row && target.col === col);
    if (!allowed) return { applied: false, reason: 'invalid_target' };

    const destinations = getTeleportDestinations(cardState, gameState);
    if (!Array.isArray(destinations) || !destinations.length) {
        return { applied: false, reason: 'no_destination' };
    }

    const randomSource = resolveRandomSource(prng);
    const to = destinations[resolveRandomIndex(randomSource, destinations.length)] || destinations[0];

    if (typeof moveAt === 'function') {
        const result = moveAt(cardState, gameState, row, col, to.row, to.col, 'TELEPORT_WILL', 'teleport_move');
        if (!result || !result.moved) {
            return { applied: false, reason: 'move_failed' };
        }
        if (result.markerHandled !== true) {
            moveMarkers(cardState, row, col, to.row, to.col, deps);
        }
    } else {
        const cleared = setCellValueForCard(gameState, row, col, EMPTY);
        const placed = setCellValueForCard(gameState, to.row, to.col, cellValue);
        if (!cleared || !placed) {
            return { applied: false, reason: 'move_failed' };
        }
        moveMarkers(cardState, row, col, to.row, to.col, deps);
    }

    cs.pendingEffectByPlayer[playerKey] = null;
    return { applied: true, from: { row, col }, to };
}

function applyCellTeleportWill(cardState: CardState, gameState: GameState, playerKey: string, row: number, col: number, prng?: { random(): number }, deps: TeleportDeps = {}): TeleportResult {
    const cs = cardState as any;
    const pending = cs && cs.pendingEffectByPlayer ? cs.pendingEffectByPlayer[playerKey] : null;
    if (!pending || pending.type !== 'CELL_TELEPORT_WILL' || pending.stage !== 'selectTarget') {
        return { applied: false, reason: 'not_pending' };
    }

    const getCellTeleportTargets = deps.getCellTeleportTargets || (() => []);
    const getCellTeleportDestinations = deps.getCellTeleportDestinations || (() => []);
    const getCellValueForCard = deps.getCellValueForCard || (() => null);
    const ensureExpansionCellForCard = deps.ensureExpansionCellForCard || (() => false);
    const moveAt = deps.moveAt || null;
    const setCellValueForCard = deps.setCellValueForCard || (() => false);
    const getStoneIdAtForCard = deps.getStoneIdAtForCard || (() => null);
    const clearStoneIdAtForCard = deps.clearStoneIdAtForCard || (() => {});
    const setStoneIdAtForCard = deps.setStoneIdAtForCard || (() => false);

    const targets = getCellTeleportTargets(cardState, gameState);
    const allowed = Array.isArray(targets) && targets.some((target) => target && target.row === row && target.col === col);
    if (!allowed) return { applied: false, reason: 'invalid_target' };

    const cellValue = getCellValueForCard(gameState, row, col);
    if (cellValue === null) return { applied: false, reason: 'out_of_board' };
    if (cellValue === EMPTY) return { applied: false, reason: 'empty' };

    const destinations = getCellTeleportDestinations(cardState, gameState)
        .filter((target) => !(target && target.row === row && target.col === col));
    if (!destinations.length) return { applied: false, reason: 'no_destination' };

    const randomSource = resolveRandomSource(prng);
    const to = destinations[resolveRandomIndex(randomSource, destinations.length)] || destinations[0];
    const createdDestination = !to.active;

    if (!ensureExpansionCellForCard(gameState, to.row, to.col, EMPTY)) {
        return { applied: false, reason: 'invalid_destination' };
    }

    let moved = false;
    let markerHandled = false;
    if (typeof moveAt === 'function') {
        const result = moveAt(cardState, gameState, row, col, to.row, to.col, 'CELL_TELEPORT_WILL', 'teleport_move');
        if (result && result.reason === 'out_of_board') {
            return { applied: false, reason: 'move_failed' };
        }
        if (result && result.reason === 'inviolable_source') {
            return { applied: false, reason: 'inviolable' };
        }
        moved = !!(result && result.moved);
        markerHandled = !!(result && result.markerHandled === true);
        if (!moved) {
            return { applied: false, reason: 'move_failed' };
        }
    }

    if (!moved) {
        const sourceStoneId = getStoneIdAtForCard(cardState, gameState, row, col);
        const cleared = setCellValueForCard(gameState, row, col, EMPTY);
        const placed = setCellValueForCard(gameState, to.row, to.col, cellValue);
        if (!cleared || !placed) {
            return { applied: false, reason: 'move_failed' };
        }
        clearStoneIdAtForCard(cardState, gameState, row, col);
        setStoneIdAtForCard(cardState, gameState, to.row, to.col, sourceStoneId);
    }

    if (!markerHandled) {
        moveMarkers(cardState, row, col, to.row, to.col, deps);
    }
    const holeResult = CardCellRemoval.applyHoleStyleCellRemoval(
        cardState,
        gameState,
        row,
        col,
        playerKey,
        'CELL_TELEPORT_WILL',
        'cell_teleport_source_cell_remove',
        deps,
        {}
    );
    if (!holeResult || !holeResult.applied) {
        return { applied: false, reason: (holeResult && holeResult.reason) || 'hole_failed' };
    }

    cs.pendingEffectByPlayer[playerKey] = null;
    return {
        applied: true,
        from: { row, col },
        to: { row: to.row, col: to.col },
        createdDestination
    };
}

export = {
    applyTeleportWill,
    applyCellTeleportWill
};
