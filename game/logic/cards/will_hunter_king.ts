'use strict';

import { GameState } from '../../../src/types';

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
    } catch (_e) {
        return null;
    }
}

const SharedConstants = ((typeof module === 'object' && module.exports)
    ? safeRequire('../../../shared-constants')
    : null) || (typeof self !== 'undefined' ? (self as any).SharedConstants : undefined);

const CardUtilsModule = ((typeof module === 'object' && module.exports)
    ? safeRequire('./utils')
    : null) || (typeof self !== 'undefined' ? (self as any).CardUtils : null);

const BoardOpsModule = ((typeof module === 'object' && module.exports)
    ? safeRequire('../board_ops')
    : null) || (typeof self !== 'undefined' ? (self as any).BoardOps : null);

const RandomSourceModule = ((typeof module === 'object' && module.exports)
    ? safeRequire('../cards-internal/random-source')
    : null) || (typeof self !== 'undefined' ? (self as any).CardRandomSource : null);

const { BLACK, WHITE, EMPTY } = SharedConstants || {};
const MANIFEST_STONE_TYPES = new Set(['THEORY_INCARNATION', 'BOARD_EXECUTOR', 'OBSERVER_WILL']);

if (BLACK === undefined || WHITE === undefined || EMPTY === undefined) {
    throw new Error('SharedConstants missing required values');
}

interface BoardDims { rows: number; cols: number }

function normalizeExpansionOwner(owner: number): number {
    return (owner === BLACK || owner === WHITE) ? owner : EMPTY;
}

function resolveBoardDims(gameState: GameState): BoardDims {
    const board = gameState && Array.isArray(gameState.board) ? gameState.board : null;
    const rows = board && board.length > 0 ? board.length : 8;
    const cols = board && Array.isArray(board[0]) && board[0].length > 0 ? board[0].length : rows;
    return { rows, cols };
}

function getExpansionCells(gameState: GameState): Array<{row: number; col: number; owner: number}> {
    if (BoardOpsModule && typeof BoardOpsModule.getExpansionDescriptors === 'function') {
        return BoardOpsModule.getExpansionDescriptors(gameState);
    }
    const expansion = (gameState && gameState.boardExpansion && typeof gameState.boardExpansion === 'object')
        ? gameState.boardExpansion as any
        : null;
    if (!expansion)
        return [];
    const cells: Array<{row: number; col: number; owner: number}> = [];
    const pushCell = (cell: any) => {
        if (!cell || typeof cell !== 'object')
            return;
        const row = Number.isInteger(cell.row) ? cell.row : null;
        let col: any = Number.isInteger(cell.col) ? cell.col : null;
        if (col === null && cell.side === 'left')
            col = -1;
        if (col === null && cell.side === 'right')
            col = resolveBoardDims(gameState).cols;
        if (!Number.isInteger(row) || !Number.isInteger(col))
            return;
        if (cells.some((one) => one.row === row && one.col === col))
            return;
        cells.push({
            row,
            col,
            owner: normalizeExpansionOwner(cell.owner)
        });
    };
    if (Array.isArray(expansion.cells)) {
        for (const cell of expansion.cells)
            pushCell(cell);
    }
    else if (expansion.active === true) {
        pushCell(expansion);
    }
    return cells;
}

function getCellValue(gameState: GameState, row: number, col: number): number | null {
    if (BoardOpsModule && typeof BoardOpsModule.getCellValue === 'function') {
        return BoardOpsModule.getCellValue(gameState, row, col);
    }
    const dims = resolveBoardDims(gameState);
    if (row >= 0 && row < dims.rows && col >= 0 && col < dims.cols)
        return gameState.board[row][col];
    const expansionCells = getExpansionCells(gameState);
    for (const cell of expansionCells) {
        if (!cell)
            continue;
        if (cell.row === row && cell.col === col)
            return cell.owner;
    }
    return null;
}

function resolveRandomSource(randomLike: any) {
    if (RandomSourceModule && typeof RandomSourceModule.resolveRandomSource === 'function') {
        return RandomSourceModule.resolveRandomSource(randomLike, null, 'CardWillHunterKing');
    }
    if (typeof randomLike === 'function')
        return { random: randomLike };
    if (randomLike && typeof randomLike.random === 'function')
        return randomLike;
    throw new Error('CardWillHunterKing requires an injected deterministic PRNG.');
}

function hasVisibleNonNormalStoneAt(cardState: any, row: number, col: number): boolean {
    if (!CardUtilsModule)
        return false;
    if (typeof CardUtilsModule.isNonNormalStoneVisualAt === 'function') {
        return CardUtilsModule.isNonNormalStoneVisualAt(cardState, row, col);
    }
    if (typeof CardUtilsModule.isSpecialStoneAt === 'function') {
        return CardUtilsModule.isSpecialStoneAt(cardState, row, col);
    }
    return false;
}

function isManifestTarget(cardState: any, row: number, col: number): boolean {
    if (CardUtilsModule && typeof CardUtilsModule.isManifestStoneAt === 'function') {
        return CardUtilsModule.isManifestStoneAt(cardState, row, col) === true;
    }
    const markers = (cardState && Array.isArray(cardState.markers)) ? cardState.markers : [];
    return markers.some((marker: any) => (
        marker &&
        marker.row === row &&
        marker.col === col &&
        (marker.kind === 'manifestStone' || marker.kind === 'specialStone') &&
        MANIFEST_STONE_TYPES.has(String(marker.data && marker.data.type || '').toUpperCase())
    ));
}

function collectEnemyTargets(cardState: any, gameState: GameState, enemyValue: number) {
    const specialTargets: Array<{row: number; col: number; isSpecial: boolean}> = [];
    const normalTargets: Array<{row: number; col: number; isSpecial: boolean}> = [];
    const dims = resolveBoardDims(gameState);
    for (let row = 0; row < dims.rows; row++) {
        for (let col = 0; col < dims.cols; col++) {
            if (gameState.board[row][col] !== enemyValue)
                continue;
            if (isManifestTarget(cardState, row, col))
                continue;
            const isSpecial = hasVisibleNonNormalStoneAt(cardState, row, col);
            const target = { row, col, isSpecial };
            if (isSpecial)
                specialTargets.push(target);
            else
                normalTargets.push(target);
        }
    }
    const expansionCells = getExpansionCells(gameState);
    for (const cell of expansionCells) {
        if (!cell || cell.owner !== enemyValue)
            continue;
        if (isManifestTarget(cardState, cell.row, cell.col))
            continue;
        const isSpecial = hasVisibleNonNormalStoneAt(cardState, cell.row, cell.col);
        const target = { row: cell.row, col: cell.col, isSpecial };
        if (isSpecial)
            specialTargets.push(target);
        else
            normalTargets.push(target);
    }
    return specialTargets.length > 0 ? specialTargets : normalTargets;
}

function pickRandomTarget(targets: any[], randomSource: any) {
    if (!Array.isArray(targets) || targets.length === 0)
        return null;
    const raw = Number(randomSource.random());
    const normalized = Number.isFinite(raw) ? Math.max(0, Math.min(0.999999, raw)) : 0;
    const index = Math.floor(normalized * targets.length);
    return targets[Math.max(0, Math.min(targets.length - 1, index))] || targets[0] || null;
}

function findAnchorMarker(cardState: any, playerKey: string, row: number, col: number) {
    const markers = (cardState && Array.isArray(cardState.markers)) ? cardState.markers : [];
    return markers.find((marker: any) => (marker &&
        marker.kind === 'specialStone' &&
        marker.owner === playerKey &&
        marker.row === row &&
        marker.col === col &&
        marker.data &&
        String(marker.data.type || '').toUpperCase() === 'WILL_HUNTER_KING')) || null;
}

function moveCoexistingMarkers(cardState: any, fromRow: number, fromCol: number, toRow: number, toCol: number) {
    if (!cardState || !Array.isArray(cardState.markers))
        return;
    for (const marker of cardState.markers) {
        if (!marker || marker.row !== fromRow || marker.col !== fromCol)
            continue;
        const typeUpper = String(marker && marker.data && marker.data.type ? marker.data.type : '').toUpperCase();
        if (typeUpper === 'BLOCKADE' || typeUpper === 'METEOR_HOLE' || typeUpper === 'FREEZE' || typeUpper === 'SEED')
            continue;
        marker.row = toRow;
        marker.col = toCol;
    }
}

function removeAnchorMarker(cardState: any, playerKey: string, row: number, col: number) {
    if (!cardState || !Array.isArray(cardState.markers))
        return;
    cardState.markers = cardState.markers.filter((marker: any) => !(marker &&
        marker.kind === 'specialStone' &&
        marker.owner === playerKey &&
        marker.row === row &&
        marker.col === col &&
        marker.data &&
        String(marker.data.type || '').toUpperCase() === 'WILL_HUNTER_KING'));
}

interface WillHunterKingResult {
    moved: Array<any>;
    destroyed: Array<any>;
    proliferated: Array<any>;
    expired: Array<any>;
}

function processWillHunterKingEffectsAtTurnStartAnchor(cardState: any, gameState: GameState, playerKey: string, row: number, col: number, deps: any): WillHunterKingResult {
    const options = deps || {};
    const randomSource = resolveRandomSource(options.random);
    const boardOps = options.BoardOps || null;
    const result: WillHunterKingResult = {
        moved: [],
        destroyed: [],
        proliferated: [],
        expired: []
    };
    const anchor = findAnchorMarker(cardState, playerKey, row, col);
    if (!anchor)
        return result;
    const ownerValue = playerKey === 'black' ? BLACK : WHITE;
    const enemyValue = -ownerValue;
    if (getCellValue(gameState, row, col) !== ownerValue) {
        removeAnchorMarker(cardState, playerKey, row, col);
        result.expired.push({ row, col, owner: playerKey, reason: 'anchor_lost' });
        return result;
    }
    const resolveAnchor = () => {
    const beforeTurns = Number.isFinite(Number(anchor.data && anchor.data.remainingOwnerTurns))
        ? Math.max(0, Math.trunc(Number(anchor.data.remainingOwnerTurns)))
        : 8;
    const shouldDecrement = options.decrementRemainingOwnerTurns !== false;
    const afterTurns = shouldDecrement ? Math.max(0, beforeTurns - 1) : beforeTurns;
    if (anchor.data)
        anchor.data.remainingOwnerTurns = afterTurns;
    const targets = collectEnemyTargets(cardState, gameState, enemyValue);
    const target = pickRandomTarget(targets, randomSource);
    if (target) {
        const destroyMeta = {
            sourceRow: row,
            sourceCol: col,
            projectileOwner: playerKey,
            projectileStone: 'will_hunter_king'
        };
        const previousBoardOpsRandomSource = cardState && cardState._boardOpsRandomSource;
        if (cardState && !previousBoardOpsRandomSource) cardState._boardOpsRandomSource = randomSource;
        const destroyResult = boardOps && typeof boardOps.destroyAt === 'function'
            ? boardOps.destroyAt(cardState, gameState, target.row, target.col, 'WILL_HUNTER_KING', 'will_hunter_king_slash', destroyMeta)
            : { destroyed: false };
        if (cardState) {
            if (previousBoardOpsRandomSource) cardState._boardOpsRandomSource = previousBoardOpsRandomSource;
            else delete cardState._boardOpsRandomSource;
        }
        if (destroyResult && destroyResult.destroyed) {
            result.destroyed.push({
                row: target.row,
                col: target.col,
                sourceRow: row,
                sourceCol: col,
                destroyedSpecial: target.isSpecial === true
            });
        }
        else if (destroyResult && destroyResult.proliferated) {
            result.proliferated.push({
                row: target.row,
                col: target.col,
                sourceRow: row,
                sourceCol: col
            });
        }
        if (getCellValue(gameState, target.row, target.col) === EMPTY && boardOps && typeof boardOps.moveAt === 'function') {
            const moveMeta = {
                special: 'WILL_HUNTER_KING',
                timer: afterTurns,
                owner: playerKey,
                flipEvadeRemaining: Number.isFinite(Number(anchor.data && anchor.data.flipEvadeRemaining))
                    ? Math.max(0, Math.trunc(Number(anchor.data.flipEvadeRemaining)))
                    : null,
                destroyEvadeRemaining: Number.isFinite(Number(anchor.data && anchor.data.destroyEvadeRemaining))
                    ? Math.max(0, Math.trunc(Number(anchor.data.destroyEvadeRemaining)))
                    : null
            };
            const moveResult = boardOps.moveAt(cardState, gameState, row, col, target.row, target.col, 'WILL_HUNTER_KING', 'will_hunter_king_slash_move', moveMeta);
            if (moveResult && moveResult.moved) {
                result.moved.push({
                    from: { row, col },
                    to: { row: target.row, col: target.col },
                    specialType: 'WILL_HUNTER_KING',
                    targetRow: target.row,
                    targetCol: target.col
                });
                row = target.row;
                col = target.col;
            }
        }
    }
    if (shouldDecrement && afterTurns <= 0) {
        const revertResult = boardOps && typeof boardOps.revertSpecialStoneAt === 'function'
            ? boardOps.revertSpecialStoneAt(cardState, gameState, row, col, 'WILL_HUNTER_KING', playerKey, 'WILL_HUNTER_KING', 'anchor_expired')
            : { reverted: false };
        if (revertResult && revertResult.reverted) {
            result.expired.push({ row, col, owner: playerKey, reason: 'anchor_expired' });
        }
        else if (!boardOps || typeof boardOps.revertSpecialStoneAt !== 'function') {
            cardState.markers = (cardState.markers || []).filter((entry: any) => !(entry &&
                entry.kind === 'specialStone' &&
                entry.row === row &&
                entry.col === col &&
                entry.owner === playerKey &&
                entry.data &&
                entry.data.type === 'WILL_HUNTER_KING'));
            result.expired.push({ row, col, owner: playerKey, reason: 'anchor_expired' });
        }
    }
    return result;
    };
    if (boardOps && typeof boardOps.runEffectBlock === 'function') {
        return boardOps.runEffectBlock(cardState, gameState, {
            kind: 'anchor_effect',
            cause: 'WILL_HUNTER_KING',
            reason: 'will_hunter_king_slash',
            owner: playerKey,
            sourceRow: row,
            sourceCol: col,
            randomSource
        }, resolveAnchor);
    }
    return resolveAnchor();
}

export = {
    processWillHunterKingEffectsAtTurnStartAnchor
};
