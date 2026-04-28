"use strict";
/**
 * @file selectors.ts
 * @description Card selectable-target helpers (Shared between Browser and Headless)
 */
function _require(id) {
    if (typeof __non_webpack_require__ !== 'undefined') {
        return __non_webpack_require__(id);
    }
    if (typeof require === 'function') {
        return require(id);
    }
    throw new Error('Unable to require ' + id);
}
const SharedConstants = (typeof module === 'object' && module.exports)
    ? _require('../../../shared-constants')
    : (typeof self !== 'undefined' ? self.SharedConstants : undefined);
const CardUtils = (typeof module === 'object' && module.exports)
    ? (() => { try {
        return _require('./utils');
    }
    catch (e) {
        return null;
    } })()
    : (typeof self !== 'undefined' ? self.CardUtils : null);
const SharedBoardUtils = (typeof module === 'object' && module.exports)
    ? (() => { try {
        return _require('../../../shared/shared-board-utils');
    }
    catch (e) {
        return null;
    } })()
    : (typeof self !== 'undefined' ? self.SharedBoardUtils : null);
const { EMPTY, ORTHOGONAL_DIRECTIONS } = SharedConstants || {};
if (EMPTY === undefined) {
    throw new Error('SharedConstants not loaded');
}
function isBlockingMarkerType(type) {
    return type === 'BLOCKADE' || type === 'METEOR_HOLE' || type === 'FREEZE';
}
function isBombCategoryMarker(marker) {
    return !!(marker &&
        marker.kind === 'specialStone' &&
        marker.data &&
        marker.data.category === 'bomb');
}
function isFrozenCell(cardState, row, col) {
    if (CardUtils && typeof CardUtils.isFrozenCell === 'function') {
        return !!CardUtils.isFrozenCell(cardState, row, col);
    }
    const cs = cardState;
    const markers = (cs && Array.isArray(cs.markers)) ? cs.markers : [];
    return markers.some((m) => (m &&
        m.kind === 'specialStone' &&
        m.row === row &&
        m.col === col &&
        m.data &&
        m.data.type === 'FREEZE'));
}
function hasSeedMarkerAt(cardState, row, col) {
    const cs = cardState;
    const markers = (cs && Array.isArray(cs.markers)) ? cs.markers : [];
    return markers.some((m) => (m &&
        m.kind === 'specialStone' &&
        m.row === row &&
        m.col === col &&
        m.data &&
        m.data.type === 'SEED'));
}
function isBlockedCell(cardState, row, col) {
    const cs = cardState;
    const markers = (cs && Array.isArray(cs.markers)) ? cs.markers : [];
    return markers.some((m) => (m &&
        m.kind === 'specialStone' &&
        m.row === row &&
        m.col === col &&
        m.data &&
        isBlockingMarkerType(m.data.type)));
}
function isMeteorHoleCell(cardState, row, col) {
    const cs = cardState;
    const markers = (cs && Array.isArray(cs.markers)) ? cs.markers : [];
    return markers.some((m) => (m &&
        m.kind === 'specialStone' &&
        m.row === row &&
        m.col === col &&
        m.data &&
        m.data.type === 'METEOR_HOLE'));
}
function isGuardProtectedCell(cardState, row, col) {
    const cs = cardState;
    const markers = (cs && Array.isArray(cs.markers)) ? cs.markers : [];
    return markers.some((m) => (m &&
        m.kind === 'specialStone' &&
        m.row === row &&
        m.col === col &&
        m.data &&
        m.data.type === 'GUARD'));
}
function isAbsoluteProtectedCell(cardState, row, col) {
    const cs = cardState;
    const markers = (cs && Array.isArray(cs.markers)) ? cs.markers : [];
    return markers.some((m) => (m &&
        m.kind === 'specialStone' &&
        m.row === row &&
        m.col === col &&
        m.data &&
        m.data.type === 'ABSOLUTE_PROTECTED'));
}
function resolveBoardConfig(gameState) {
    if (SharedBoardUtils && typeof SharedBoardUtils.resolveBoardConfig === 'function') {
        return SharedBoardUtils.resolveBoardConfig(gameState);
    }
    const gs = gameState;
    const board = gs && Array.isArray(gs.board) ? gs.board : null;
    const rows = Array.isArray(board) && board.length > 0 ? board.length : 8;
    const cols = Array.isArray(board) && Array.isArray(board[0]) && board[0].length > 0 ? board[0].length : rows;
    return {
        rows,
        cols,
        baseBounds: { minRow: 0, maxRow: rows - 1, minCol: 0, maxCol: cols - 1 },
        outerBounds: { minRow: -1, maxRow: rows, minCol: -1, maxCol: cols }
    };
}
function isPositionSwapProtectedCell(cardState, row, col) {
    if (!CardUtils || typeof CardUtils.getSpecialMarkerAt !== 'function')
        return false;
    const entry = CardUtils.getSpecialMarkerAt(cardState, row, col);
    const marker = (entry && entry.kind === 'specialStone') ? entry.marker : null;
    return !!(marker && marker.data && marker.data.type === 'GLUTTONOUS');
}
function getCellValue(gameState, row, col) {
    if (isMainBoardCell(row, col, gameState)) {
        const gs = gameState;
        return (gs && Array.isArray(gs.board) && Array.isArray(gs.board[row]))
            ? gs.board[row][col]
            : null;
    }
    for (const expansion of getExpansionCells(gameState)) {
        if (!expansion)
            continue;
        if (expansion.row === row && expansion.col === col) {
            return Number(expansion.owner);
        }
    }
    return null;
}
function hasBoardShapeCell(gameState, row, col) {
    return getCellValue(gameState, row, col) !== null;
}
function forEachBoardShapeCell(gameState, visitor) {
    if (typeof visitor !== 'function')
        return;
    if (SharedBoardUtils && typeof SharedBoardUtils.forEachBoardShapeCell === 'function') {
        SharedBoardUtils.forEachBoardShapeCell(gameState, visitor);
        return;
    }
    const gs = gameState;
    if (!gs || !Array.isArray(gs.board))
        return;
    const config = resolveBoardConfig(gameState);
    for (let row = 0; row < config.rows; row++) {
        for (let col = 0; col < config.cols; col++) {
            visitor(row, col, gs.board[row][col]);
        }
    }
    for (const expansion of getExpansionCells(gameState)) {
        if (!expansion)
            continue;
        visitor(expansion.row, expansion.col, Number(expansion.owner));
    }
}
function getPendingEffect(cardState, playerKey) {
    const cs = cardState;
    if (!cs || !cs.pendingEffectByPlayer || !playerKey)
        return null;
    return cs.pendingEffectByPlayer[playerKey] || null;
}
function toTargetKey(row, col) {
    return `${row},${col}`;
}
function getShapeAwareBoard(cardState, gameState) {
    if (!SharedBoardUtils || typeof SharedBoardUtils.attachBoardShape !== 'function')
        return null;
    const gs = gameState;
    if (!gs || !Array.isArray(gs.board))
        return null;
    return SharedBoardUtils.attachBoardShape(gs.board, {
        boardExpansion: gs.boardExpansion,
        cardState,
        boardConfig: gs.boardConfig
    });
}
function getBoardShrinkSelectedKeys(cardState, playerKey) {
    const pending = getPendingEffect(cardState, playerKey);
    if (!pending || pending.type !== 'BOARD_SHRINK_WILL' || !Array.isArray(pending.selectedTargets))
        return new Set();
    const selectedKeys = new Set();
    for (const target of pending.selectedTargets) {
        if (!target || !Number.isInteger(target.row) || !Number.isInteger(target.col))
            continue;
        selectedKeys.add(toTargetKey(target.row, target.col));
    }
    return selectedKeys;
}
function hasShrinkGodHoleCandidate(cardState, lineDescriptor) {
    if (!lineDescriptor || !Array.isArray(lineDescriptor.cells))
        return false;
    return lineDescriptor.cells.some((cell) => (cell &&
        Number.isInteger(cell.row) &&
        Number.isInteger(cell.col) &&
        !isFrozenCell(cardState, cell.row, cell.col) &&
        !isAbsoluteProtectedCell(cardState, cell.row, cell.col)));
}
function getBoardShrinkGodLineDescriptors(cardState, gameState, playerKey) {
    const board = getShapeAwareBoard(cardState, gameState);
    if (!board || !SharedBoardUtils || typeof SharedBoardUtils.getCornerEdgeLineDescriptors !== 'function')
        return [];
    const lines = SharedBoardUtils.getCornerEdgeLineDescriptors(board);
    const rawLineCountByCorner = new Map();
    for (const line of lines) {
        if (!line || !line.corner || !Number.isInteger(line.corner.row) || !Number.isInteger(line.corner.col))
            continue;
        const cornerKey = toTargetKey(line.corner.row, line.corner.col);
        rawLineCountByCorner.set(cornerKey, (rawLineCountByCorner.get(cornerKey) || 0) + 1);
    }
    const pending = getPendingEffect(cardState, playerKey);
    const firstTarget = pending && pending.type === 'BOARD_SHRINK_GOD' && pending.firstTarget
        ? pending.firstTarget
        : null;
    return lines.filter((line) => {
        if (!line || !line.corner || !line.directionTarget)
            return false;
        if (firstTarget && (line.corner.row !== firstTarget.row || line.corner.col !== firstTarget.col))
            return false;
        if (!firstTarget) {
            const cornerKey = toTargetKey(line.corner.row, line.corner.col);
            if ((rawLineCountByCorner.get(cornerKey) || 0) < 2)
                return false;
        }
        return hasShrinkGodHoleCandidate(cardState, line);
    });
}
// Return all non-empty cells (for DESTROY_ONE_STONE)
function getDestroyTargets(cardState, gameState) {
    const res = [];
    const cs = cardState;
    const markers = (cs && Array.isArray(cs.markers)) ? cs.markers : [];
    forEachBoardShapeCell(gameState, (r, c, owner) => {
        if (owner === EMPTY)
            return;
        const guarded = markers.some((m) => m &&
            m.kind === 'specialStone' &&
            m.row === r &&
            m.col === c &&
            m.data &&
            m.data.type === 'GUARD');
        if (guarded)
            return;
        if (isFrozenCell(cardState, r, c))
            return;
        res.push({ row: r, col: c });
    });
    return res;
}
// Return swap targets: opponent NORMAL stones only (no special markers, no bombs)
function getSwapTargets(cardState, gameState, playerKey) {
    const res = [];
    const opVal = playerKey === 'black' ? SharedConstants.WHITE : SharedConstants.BLACK;
    const cs = cardState;
    const markers = (cs && Array.isArray(cs.markers)) ? cs.markers : [];
    const isHiddenTrapForPlayer = (m) => (m &&
        m.kind === 'specialStone' &&
        m.data &&
        m.data.type === 'TRAP' &&
        m.owner &&
        m.owner !== playerKey);
    const canSwapCell = (row, col, ownerValue) => {
        if (ownerValue !== opVal)
            return;
        const hasSpecialOrBomb = markers.some((m) => {
            if (!m || m.row !== row || m.col !== col)
                return false;
            if (m.kind !== 'specialStone')
                return false;
            if (isHiddenTrapForPlayer(m))
                return false;
            const isExpiredUltimateHyperactive = !!(m.data &&
                m.data.type === 'ULTIMATE_HYPERACTIVE' &&
                Number.isFinite(Number(m.data.remainingOwnerTurns)) &&
                Number(m.data.remainingOwnerTurns) <= 0);
            if (isExpiredUltimateHyperactive)
                return false;
            return true;
        });
        if (hasSpecialOrBomb)
            return;
        res.push({ row, col });
    };
    forEachBoardShapeCell(gameState, (r, c, owner) => {
        canSwapCell(r, c, owner);
    });
    return res;
}
// Return position-swap targets: any occupied cell; if first target exists, exclude it.
function getPositionSwapTargets(cardState, gameState, playerKey, pending) {
    const res = [];
    const first = pending && pending.firstTarget ? pending.firstTarget : null;
    const pushIfOccupied = (row, col, ownerValue) => {
        if (ownerValue === EMPTY)
            return;
        if (first && first.row === row && first.col === col)
            return;
        if (isPositionSwapProtectedCell(cardState, row, col))
            return;
        res.push({ row, col });
    };
    forEachBoardShapeCell(gameState, (r, c, owner) => {
        pushIfOccupied(r, c, owner);
    });
    return res;
}
function _getStrongWindDirectionDestination(cardState, gameState, row, col, dr, dc) {
    const nr = row + dr;
    const nc = col + dc;
    if (!hasBoardShapeCell(gameState, nr, nc))
        return null;
    if (getCellValue(gameState, nr, nc) !== EMPTY)
        return null;
    if (isBlockedCell(cardState, nr, nc))
        return null;
    let tr = nr;
    let tc = nc;
    while (true) {
        const rr = tr + dr;
        const cc = tc + dc;
        if (!hasBoardShapeCell(gameState, rr, cc))
            break;
        if (getCellValue(gameState, rr, cc) !== EMPTY)
            break;
        if (isBlockedCell(cardState, rr, cc))
            break;
        tr = rr;
        tc = cc;
    }
    return { row: tr, col: tc };
}
// Return strong-wind targets: any non-empty stone that has at least one movable orthogonal direction.
function getStrongWindTargets(cardState, gameState) {
    const res = [];
    forEachBoardShapeCell(gameState, (r, c, owner) => {
        if (owner === EMPTY)
            return;
        let movable = false;
        for (const d of ORTHOGONAL_DIRECTIONS) {
            if (_getStrongWindDirectionDestination(cardState, gameState, r, c, d[0], d[1])) {
                movable = true;
                break;
            }
        }
        if (movable)
            res.push({ row: r, col: c });
    });
    return res;
}
function _collectVerticalCrushDestination(cardState, gameState, row, col, dr) {
    if (!Number.isInteger(row) || !Number.isInteger(col))
        return null;
    if (dr !== -1 && dr !== 1)
        return null;
    const firstRow = row + dr;
    if (!hasBoardShapeCell(gameState, firstRow, col))
        return null;
    let destination = null;
    for (let r = firstRow; hasBoardShapeCell(gameState, r, col); r += dr) {
        if (isBlockedCell(cardState, r, col))
            break;
        if (getCellValue(gameState, r, col) !== EMPTY && isGuardProtectedCell(cardState, r, col))
            break;
        destination = { row: r, col };
    }
    return destination;
}
function _getVerticalCrushTargets(cardState, gameState, dr) {
    const res = [];
    forEachBoardShapeCell(gameState, (r, c, owner) => {
        if (owner === EMPTY)
            return;
        const destination = _collectVerticalCrushDestination(cardState, gameState, r, c, dr);
        if (!destination)
            return;
        if (destination.row === r && destination.col === c)
            return;
        res.push({ row: r, col: c });
    });
    return res;
}
function getSuperBuoyancyTargets(cardState, gameState) {
    return _getVerticalCrushTargets(cardState, gameState, -1);
}
function getSuperGravityTargets(cardState, gameState) {
    return _getVerticalCrushTargets(cardState, gameState, 1);
}
// Return trap targets: own stones (including special stones), excluding bombs/own existing trap/absolute-protected.
function getTrapTargets(cardState, gameState, playerKey) {
    const res = [];
    const playerVal = playerKey === 'black' ? SharedConstants.BLACK : SharedConstants.WHITE;
    const cs = cardState;
    const markers = (cs && Array.isArray(cs.markers)) ? cs.markers : [];
    forEachBoardShapeCell(gameState, (r, c, owner) => {
        if (owner !== playerVal)
            return;
        const hasBomb = markers.some((m) => m && m.row === r && m.col === c && isBombCategoryMarker(m));
        if (hasBomb)
            return;
        if (isAbsoluteProtectedCell(cardState, r, c))
            return;
        const hasOwnTrap = markers.some((m) => (m &&
            m.row === r &&
            m.col === c &&
            m.kind === 'specialStone' &&
            m.owner === playerKey &&
            m.data &&
            m.data.type === 'TRAP'));
        if (hasOwnTrap)
            return;
        res.push({ row: r, col: c });
    });
    return res;
}
// Return guard targets: own stones (normal/special both allowed), excluding bombs/absolute-protected.
function getGuardTargets(cardState, gameState, playerKey) {
    const res = [];
    const playerVal = playerKey === 'black' ? SharedConstants.BLACK : SharedConstants.WHITE;
    const cs = cardState;
    const markers = (cs && Array.isArray(cs.markers)) ? cs.markers : [];
    forEachBoardShapeCell(gameState, (r, c, owner) => {
        if (owner !== playerVal)
            return;
        const hasBomb = markers.some((m) => m && m.row === r && m.col === c && isBombCategoryMarker(m));
        if (hasBomb)
            return;
        if (isAbsoluteProtectedCell(cardState, r, c))
            return;
        res.push({ row: r, col: c });
    });
    return res;
}
function getLivingWillTargets(cardState, gameState, playerKey) {
    const res = [];
    const playerVal = playerKey === 'black' ? SharedConstants.BLACK : SharedConstants.WHITE;
    const cs = cardState;
    const markers = (cs && Array.isArray(cs.markers)) ? cs.markers : [];
    forEachBoardShapeCell(gameState, (r, c, owner) => {
        if (owner !== playerVal)
            return;
        const hasBomb = markers.some((m) => m && m.row === r && m.col === c && isBombCategoryMarker(m));
        if (hasBomb)
            return;
        if (isAbsoluteProtectedCell(cardState, r, c))
            return;
        const hasLivingWill = markers.some((m) => (m &&
            m.kind === 'specialStone' &&
            m.row === r &&
            m.col === c &&
            m.data &&
            m.data.type === 'LIVING_WILL'));
        if (hasLivingWill)
            return;
        res.push({ row: r, col: c });
    });
    return res;
}
// Return hyperactive-inherit targets: own stones (normal/special both allowed), excluding bombs.
// This includes already-special stones like HYPERACTIVE / ROBOT_VACUUM / ULTIMATE_HYPERACTIVE.
function getHyperactiveInheritTargets(cardState, gameState, playerKey) {
    return getGuardTargets(cardState, gameState, playerKey);
}
// Return time-bomb targets: own stones (normal/special both allowed), excluding bombs.
function getTimeBombTargets(cardState, gameState, playerKey) {
    return getGuardTargets(cardState, gameState, playerKey);
}
// Return teleport targets: any occupied stone (owner/type unrestricted)
// when at least one non-blocked empty destination exists on board.
function getTeleportTargets(cardState, gameState) {
    const gs = gameState;
    if (!gs || !Array.isArray(gs.board))
        return [];
    let hasDestination = false;
    forEachBoardShapeCell(gameState, (r, c, owner) => {
        if (hasDestination)
            return;
        if (owner !== EMPTY)
            return;
        if (isBlockedCell(cardState, r, c))
            return;
        hasDestination = true;
    });
    if (!hasDestination)
        return [];
    const res = [];
    forEachBoardShapeCell(gameState, (r, c, owner) => {
        if (owner === EMPTY)
            return;
        res.push({ row: r, col: c });
    });
    return res;
}
function getBoardExpansionWillCellDescriptors(gameState) {
    const config = resolveBoardConfig(gameState);
    const cells = [];
    for (let row = 0; row < config.rows; row++) {
        cells.push({ row, col: config.outerBounds.minCol, side: 'left' });
        cells.push({ row, col: config.outerBounds.maxCol, side: 'right' });
    }
    return cells;
}
function hasCloneSpawnSpace(cardState, gameState, row, col) {
    for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
            if (dr === 0 && dc === 0)
                continue;
            const nr = row + dr;
            const nc = col + dc;
            if (!hasBoardShapeCell(gameState, nr, nc))
                continue;
            if (getCellValue(gameState, nr, nc) !== EMPTY)
                continue;
            if (isBlockedCell(cardState, nr, nc))
                continue;
            return true;
        }
    }
    return false;
}
function getCloneTargets(cardState, gameState, playerKey) {
    const res = [];
    const playerVal = playerKey === 'black' ? SharedConstants.BLACK : SharedConstants.WHITE;
    forEachBoardShapeCell(gameState, (r, c, owner) => {
        if (owner !== playerVal)
            return;
        if (!hasCloneSpawnSpace(cardState, gameState, r, c))
            return;
        res.push({ row: r, col: c });
    });
    return res;
}
function getSplitTargets(cardState, gameState, playerKey) {
    return getCloneTargets(cardState, gameState, playerKey);
}
function isMainBoardCell(row, col, gameState) {
    if (SharedBoardUtils && typeof SharedBoardUtils.isMainBoardCell === 'function') {
        return SharedBoardUtils.isMainBoardCell(row, col, gameState);
    }
    const config = resolveBoardConfig(gameState);
    return Number.isInteger(row) && Number.isInteger(col) && row >= 0 && row < config.rows && col >= 0 && col < config.cols;
}
function resolveExpansionSide(side, row, col, gameState) {
    if (SharedBoardUtils && typeof SharedBoardUtils.resolveExpansionSide === 'function') {
        return SharedBoardUtils.resolveExpansionSide(side, row, col, gameState);
    }
    if (side === 'left' || side === 'right' || side === 'top' || side === 'bottom')
        return side;
    const config = resolveBoardConfig(gameState);
    if (col === config.outerBounds.minCol)
        return 'left';
    if (col === config.outerBounds.maxCol)
        return 'right';
    if (row === config.outerBounds.minRow)
        return 'top';
    if (row === config.outerBounds.maxRow)
        return 'bottom';
    return null;
}
function getExpansionCells(gameState) {
    const gs = gameState;
    const expansion = (gs && gs.boardExpansion && typeof gs.boardExpansion === 'object')
        ? gs.boardExpansion
        : null;
    if (!expansion)
        return [];
    const config = resolveBoardConfig(gameState);
    const cells = [];
    const pushCell = (source, legacyRow, legacyOwner) => {
        let side = null;
        let row = null;
        let col = null;
        let owner = legacyOwner;
        if (source && typeof source === 'object') {
            side = source.side;
            row = source.row;
            col = source.col;
            owner = source.owner;
            if (!Number.isInteger(col) && side === 'left')
                col = config.outerBounds.minCol;
            if (!Number.isInteger(col) && side === 'right')
                col = config.outerBounds.maxCol;
        }
        else {
            side = source;
            row = legacyRow !== undefined ? legacyRow : null;
            if (side === 'left')
                col = config.outerBounds.minCol;
            if (side === 'right')
                col = config.outerBounds.maxCol;
        }
        if (!Number.isInteger(row) || !Number.isInteger(col))
            return;
        const r = row;
        const c = col;
        if (r < config.outerBounds.minRow || r > config.outerBounds.maxRow)
            return;
        if (c < config.outerBounds.minCol || c > config.outerBounds.maxCol)
            return;
        if (isMainBoardCell(r, c, gameState))
            return;
        if (cells.some((cell) => cell && cell.row === r && cell.col === c))
            return;
        const normalizedOwner = (owner === SharedConstants.BLACK || owner === SharedConstants.WHITE)
            ? owner
            : EMPTY;
        cells.push({
            side: resolveExpansionSide(side, r, c, gameState),
            row: r,
            col: c,
            owner: normalizedOwner
        });
    };
    if (Array.isArray(expansion.cells)) {
        for (const cell of expansion.cells) {
            if (!cell || typeof cell !== 'object')
                continue;
            pushCell(cell);
        }
    }
    if (cells.length === 0 && expansion.active === true) {
        pushCell(expansion);
    }
    return cells;
}
// Return board-expansion targets: left/right edge cells (same side+row cannot be duplicated).
function getBoardExpansionTargets(cardState, gameState, playerKey) {
    const gs = gameState;
    if (!gs || !gs.board)
        return [];
    const config = resolveBoardConfig(gameState);
    const blockedEdgeTargets = new Set();
    const expansionCells = getExpansionCells(gameState);
    for (const cell of expansionCells) {
        if (!cell)
            continue;
        if (cell.col === config.outerBounds.minCol && Number.isInteger(cell.row) && cell.row >= 0 && cell.row < config.rows) {
            blockedEdgeTargets.add(`${cell.row},0`);
        }
        if (cell.col === config.outerBounds.maxCol && Number.isInteger(cell.row) && cell.row >= 0 && cell.row < config.rows) {
            blockedEdgeTargets.add(`${cell.row},${config.baseBounds.maxCol}`);
        }
    }
    const res = [];
    for (let r = 0; r < config.rows; r++) {
        if (!blockedEdgeTargets.has(`${r},0`)) {
            res.push({ row: r, col: 0, side: 'left' });
        }
        if (!blockedEdgeTargets.has(`${r},${config.baseBounds.maxCol}`)) {
            res.push({ row: r, col: config.baseBounds.maxCol, side: 'right' });
        }
    }
    return res;
}
function getBoardExpansionGodCornerDescriptors(gameState) {
    const config = resolveBoardConfig(gameState);
    const lastRow = config.baseBounds.maxRow;
    const lastCol = config.baseBounds.maxCol;
    const outerMinRow = config.outerBounds.minRow;
    const outerMaxRow = config.outerBounds.maxRow;
    const outerMinCol = config.outerBounds.minCol;
    const outerMaxCol = config.outerBounds.maxCol;
    return [
        {
            row: 0,
            col: 0,
            cells: [
                { row: outerMinRow, col: 0 },
                { row: outerMinRow, col: outerMinCol },
                { row: 0, col: outerMinCol }
            ]
        },
        {
            row: 0,
            col: lastCol,
            cells: [
                { row: outerMinRow, col: lastCol },
                { row: outerMinRow, col: outerMaxCol },
                { row: 0, col: outerMaxCol }
            ]
        },
        {
            row: lastRow,
            col: 0,
            cells: [
                { row: outerMaxRow, col: 0 },
                { row: outerMaxRow, col: outerMinCol },
                { row: lastRow, col: outerMinCol }
            ]
        },
        {
            row: lastRow,
            col: lastCol,
            cells: [
                { row: lastRow, col: outerMaxCol },
                { row: outerMaxRow, col: outerMaxCol },
                { row: outerMaxRow, col: lastCol }
            ]
        }
    ];
}
function getBoardExpansionGodTargets(cardState, gameState, playerKey) {
    const gs = gameState;
    if (!gs || !gs.board)
        return [];
    const expansionCells = getExpansionCells(gameState);
    const occupied = new Set(expansionCells.map((cell) => `${cell.row},${cell.col}`));
    const cs = cardState;
    const pending = cs && cs.pendingEffectByPlayer
        ? cs.pendingEffectByPlayer[playerKey]
        : null;
    const selectedKeys = new Set();
    const selectedTargets = [];
    if (pending && pending.type === 'BOARD_EXPANSION_GOD') {
        if (pending.firstTarget && Number.isInteger(pending.firstTarget.row) && Number.isInteger(pending.firstTarget.col)) {
            selectedTargets.push(pending.firstTarget);
        }
        if (Array.isArray(pending.selectedTargets)) {
            selectedTargets.push(...pending.selectedTargets);
        }
    }
    for (const target of selectedTargets) {
        if (!target || !Number.isInteger(target.row) || !Number.isInteger(target.col))
            continue;
        selectedKeys.add(`${target.row},${target.col}`);
    }
    const res = [];
    for (const corner of getBoardExpansionGodCornerDescriptors(gameState)) {
        if (!corner || !Array.isArray(corner.cells))
            continue;
        if (selectedKeys.has(`${corner.row},${corner.col}`))
            continue;
        const hasOccupied = corner.cells.some((cell) => occupied.has(`${cell.row},${cell.col}`));
        if (hasOccupied)
            continue;
        res.push({ row: corner.row, col: corner.col });
    }
    return res;
}
function getCellTeleportDestinations(cardState, gameState) {
    const gs = gameState;
    if (!gs || !gs.board)
        return [];
    const activeExpansionCells = getExpansionCells(gameState);
    const activeByKey = new Map();
    for (const cell of activeExpansionCells) {
        if (!cell)
            continue;
        activeByKey.set(`${cell.row},${cell.col}`, cell);
    }
    const candidates = [];
    const seen = new Set();
    const pushCandidate = (row, col, side) => {
        const key = `${row},${col}`;
        if (seen.has(key))
            return;
        seen.add(key);
        const activeCell = activeByKey.get(key) || null;
        const owner = activeCell ? Number(activeCell.owner) : EMPTY;
        if (owner !== EMPTY)
            return;
        if (isBlockedCell(cardState, row, col))
            return;
        candidates.push({
            row,
            col,
            side: resolveExpansionSide(side, row, col, gameState),
            active: !!activeCell
        });
    };
    for (const cell of getBoardExpansionWillCellDescriptors(gameState)) {
        if (!cell)
            continue;
        pushCandidate(cell.row, cell.col, cell.side);
    }
    for (const corner of getBoardExpansionGodCornerDescriptors(gameState)) {
        if (!corner || !Array.isArray(corner.cells))
            continue;
        for (const cell of corner.cells) {
            if (!cell)
                continue;
            pushCandidate(cell.row, cell.col, resolveExpansionSide(null, cell.row, cell.col, gameState));
        }
    }
    return candidates;
}
function getCellTeleportTargets(cardState, gameState) {
    const gs = gameState;
    if (!gs || !gs.board)
        return [];
    const destinations = getCellTeleportDestinations(cardState, gameState);
    if (!destinations.length)
        return [];
    const res = [];
    forEachBoardShapeCell(gameState, (r, c, owner) => {
        if (owner === EMPTY)
            return;
        if (isMeteorHoleCell(cardState, r, c))
            return;
        res.push({ row: r, col: c });
    });
    return res;
}
// Return blockade targets: all empty cells (including active expansion cells), excluding already blocked cells.
function getBlockadeTargets(cardState, gameState) {
    const gs = gameState;
    if (!gs || !gs.board)
        return [];
    const res = [];
    forEachBoardShapeCell(gameState, (r, c, owner) => {
        if (owner !== EMPTY)
            return;
        if (isBlockedCell(cardState, r, c))
            return;
        if (hasSeedMarkerAt(cardState, r, c))
            return;
        res.push({ row: r, col: c });
    });
    return res;
}
// Return meteor targets: all board cells + active expansion cells, excluding already destroyed holes.
function getMeteorTargets(cardState, gameState) {
    const gs = gameState;
    if (!gs || !gs.board)
        return [];
    const res = [];
    forEachBoardShapeCell(gameState, (r, c) => {
        if (isMeteorHoleCell(cardState, r, c))
            return;
        if (isFrozenCell(cardState, r, c))
            return;
        res.push({ row: r, col: c });
    });
    return res;
}
function getBoardShrinkTargets(cardState, gameState, playerKey) {
    const board = getShapeAwareBoard(cardState, gameState);
    if (!board || !SharedBoardUtils || typeof SharedBoardUtils.getPerimeterCells !== 'function')
        return [];
    const selectedKeys = getBoardShrinkSelectedKeys(cardState, playerKey);
    return SharedBoardUtils.getPerimeterCells(board)
        .filter((cell) => {
        if (!cell || !Number.isInteger(cell.row) || !Number.isInteger(cell.col))
            return false;
        if (selectedKeys.has(toTargetKey(cell.row, cell.col)))
            return false;
        return !isFrozenCell(cardState, cell.row, cell.col);
    })
        .map((cell) => ({ row: cell.row, col: cell.col }));
}
function getBoardShrinkGodTargets(cardState, gameState, playerKey) {
    const lineDescriptors = getBoardShrinkGodLineDescriptors(cardState, gameState, playerKey);
    const pending = getPendingEffect(cardState, playerKey);
    if (pending && pending.type === 'BOARD_SHRINK_GOD' && pending.firstTarget) {
        return lineDescriptors.map((line) => ({
            row: line.directionTarget.row,
            col: line.directionTarget.col,
            corner: { row: line.corner.row, col: line.corner.col },
            direction: line.direction,
            lineCells: Array.isArray(line.cells)
                ? line.cells.map((cell) => ({ row: cell.row, col: cell.col }))
                : [],
            lineKey: line.canonicalKey || line.key || null
        }));
    }
    const cornerMap = new Map();
    for (const line of lineDescriptors) {
        const key = toTargetKey(line.corner.row, line.corner.col);
        const linePreview = {
            row: line.directionTarget.row,
            col: line.directionTarget.col,
            lineCells: Array.isArray(line.cells)
                ? line.cells.map((cell) => ({ row: cell.row, col: cell.col }))
                : [],
            lineKey: line.canonicalKey || line.key || null
        };
        if (cornerMap.has(key)) {
            cornerMap.get(key).lineTargets.push(linePreview);
            continue;
        }
        cornerMap.set(key, {
            row: line.corner.row,
            col: line.corner.col,
            lineTargets: [linePreview]
        });
    }
    return Array.from(cornerMap.values());
}
function getFreezeTargets(cardState, gameState) {
    const gs = gameState;
    if (!gs || !gs.board)
        return [];
    const res = [];
    forEachBoardShapeCell(gameState, (r, c) => {
        if (isBlockedCell(cardState, r, c))
            return;
        if (hasSeedMarkerAt(cardState, r, c))
            return;
        res.push({ row: r, col: c });
    });
    return res;
}
function getSeedTargets(cardState, gameState) {
    const gs = gameState;
    if (!gs || !gs.board)
        return [];
    const res = [];
    forEachBoardShapeCell(gameState, (r, c, owner) => {
        if (owner !== EMPTY)
            return;
        if (isBlockedCell(cardState, r, c))
            return;
        if (hasSeedMarkerAt(cardState, r, c))
            return;
        res.push({ row: r, col: c });
    });
    return res;
}
module.exports = {
    getDestroyTargets,
    getSwapTargets,
    getPositionSwapTargets,
    getStrongWindTargets,
    getSuperBuoyancyTargets,
    getSuperGravityTargets,
    getTrapTargets,
    getGuardTargets,
    getLivingWillTargets,
    getHyperactiveInheritTargets,
    getTimeBombTargets,
    getTeleportTargets,
    getCellTeleportTargets,
    getCellTeleportDestinations,
    getCloneTargets,
    getSplitTargets,
    getBoardExpansionTargets,
    getBoardExpansionGodTargets,
    getBlockadeTargets,
    getMeteorTargets,
    getBoardShrinkTargets,
    getBoardShrinkGodTargets,
    getFreezeTargets,
    getSeedTargets,
    isBlockedCell
};
//# sourceMappingURL=selectors.js.map