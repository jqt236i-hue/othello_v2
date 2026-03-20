/**
 * @file selectors.js
 * @description Card selectable-target helpers (Shared between Browser and Headless)
 */

(function (root, factory) {
    if (typeof module === 'object' && module.exports) {
        module.exports = factory(require('../../../shared-constants'), require('./utils'));
    } else {
        root.CardSelectors = factory(root.SharedConstants, root.CardUtils);
    }
}(typeof self !== 'undefined' ? self : this, function (SharedConstants, CardUtils) {
    'use strict';

    const { EMPTY } = SharedConstants || {};

    if (EMPTY === undefined) {
        throw new Error('SharedConstants not loaded');
    }

    function isBlockingMarkerType(type) {
        return type === 'BLOCKADE' || type === 'METEOR_HOLE' || type === 'FREEZE';
    }

    function isBombCategoryMarker(marker) {
        return !!(
            marker &&
            marker.kind === 'specialStone' &&
            marker.data &&
            marker.data.category === 'bomb'
        );
    }

    function isFrozenCell(cardState, row, col) {
        if (CardUtils && typeof CardUtils.isFrozenCell === 'function') {
            return !!CardUtils.isFrozenCell(cardState, row, col);
        }
        const markers = (cardState && Array.isArray(cardState.markers)) ? cardState.markers : [];
        return markers.some(m => (
            m &&
            m.kind === 'specialStone' &&
            m.row === row &&
            m.col === col &&
            m.data &&
            m.data.type === 'FREEZE'
        ));
    }

    function isBlockedCell(cardState, row, col) {
        const markers = (cardState && Array.isArray(cardState.markers)) ? cardState.markers : [];
        return markers.some(m => (
            m &&
            m.kind === 'specialStone' &&
            m.row === row &&
            m.col === col &&
            m.data &&
            isBlockingMarkerType(m.data.type)
        ));
    }

    function isMeteorHoleCell(cardState, row, col) {
        const markers = (cardState && Array.isArray(cardState.markers)) ? cardState.markers : [];
        return markers.some(m => (
            m &&
            m.kind === 'specialStone' &&
            m.row === row &&
            m.col === col &&
            m.data &&
            m.data.type === 'METEOR_HOLE'
        ));
    }

    function isGuardProtectedCell(cardState, row, col) {
        const markers = (cardState && Array.isArray(cardState.markers)) ? cardState.markers : [];
        return markers.some(m => (
            m &&
            m.kind === 'specialStone' &&
            m.row === row &&
            m.col === col &&
            m.data &&
            m.data.type === 'GUARD'
        ));
    }

    function isAbsoluteProtectedCell(cardState, row, col) {
        const markers = (cardState && Array.isArray(cardState.markers)) ? cardState.markers : [];
        return markers.some(m => (
            m &&
            m.kind === 'specialStone' &&
            m.row === row &&
            m.col === col &&
            m.data &&
            m.data.type === 'ABSOLUTE_PROTECTED'
        ));
    }

    function isPositionSwapProtectedCell(cardState, row, col) {
        if (!CardUtils || typeof CardUtils.getSpecialMarkerAt !== 'function') return false;
        const entry = CardUtils.getSpecialMarkerAt(cardState, row, col);
        const marker = (entry && entry.kind === 'specialStone') ? entry.marker : null;
        return !!(marker && marker.data && marker.data.type === 'GLUTTONOUS');
    }

    function getCellValue(gameState, row, col) {
        if (isMainBoardCell(row, col)) {
            return (gameState && Array.isArray(gameState.board) && Array.isArray(gameState.board[row]))
                ? gameState.board[row][col]
                : null;
        }
        for (const expansion of getExpansionCells(gameState)) {
            if (!expansion) continue;
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
        if (typeof visitor !== 'function') return;
        if (!gameState || !Array.isArray(gameState.board) || gameState.board.length !== 8) return;

        for (let row = 0; row < 8; row++) {
            for (let col = 0; col < 8; col++) {
                visitor(row, col, gameState.board[row][col]);
            }
        }

        for (const expansion of getExpansionCells(gameState)) {
            if (!expansion) continue;
            visitor(expansion.row, expansion.col, Number(expansion.owner));
        }
    }

    // Return all non-empty cells (for DESTROY_ONE_STONE)
    function getDestroyTargets(cardState, gameState) {
        const res = [];
        const markers = (cardState && Array.isArray(cardState.markers)) ? cardState.markers : [];
        for (let r = 0; r < 8; r++) {
            for (let c = 0; c < 8; c++) {
                if (gameState.board[r][c] === EMPTY) continue;
                const guarded = markers.some(m =>
                    m &&
                    m.kind === 'specialStone' &&
                    m.row === r &&
                    m.col === c &&
                    m.data &&
                    m.data.type === 'GUARD'
                );
                if (guarded) continue;
                if (isFrozenCell(cardState, r, c)) continue;
                res.push({ row: r, col: c });
            }
        }

        for (const expansion of getExpansionCells(gameState)) {
            if (!expansion || Number(expansion.owner) === EMPTY) continue;
            const guarded = markers.some((m) => (
                m &&
                m.kind === 'specialStone' &&
                m.row === expansion.row &&
                m.col === expansion.col &&
                m.data &&
                m.data.type === 'GUARD'
            ));
            if (guarded) continue;
            if (isFrozenCell(cardState, expansion.row, expansion.col)) continue;
            res.push({ row: expansion.row, col: expansion.col });
        }

        return res;
    }

    // Return swap targets: opponent NORMAL stones only (no special markers, no bombs)
    function getSwapTargets(cardState, gameState, playerKey) {
        const res = [];
        const opVal = playerKey === 'black' ? SharedConstants.WHITE : SharedConstants.BLACK;
        const markers = (cardState && Array.isArray(cardState.markers)) ? cardState.markers : [];
        const isHiddenTrapForPlayer = (m) => (
            m &&
            m.kind === 'specialStone' &&
            m.data &&
            m.data.type === 'TRAP' &&
            m.owner &&
            m.owner !== playerKey
        );

        const canSwapCell = (row, col, ownerValue) => {
            if (ownerValue !== opVal) return;
            const hasSpecialOrBomb = markers.some(m => {
                if (!m || m.row !== row || m.col !== col) return false;
                if (m.kind !== 'specialStone') return false;
                if (isHiddenTrapForPlayer(m)) return false;
                const isExpiredUltimateHyperactive = !!(
                    m.data &&
                    m.data.type === 'ULTIMATE_HYPERACTIVE' &&
                    Number.isFinite(Number(m.data.remainingOwnerTurns)) &&
                    Number(m.data.remainingOwnerTurns) <= 0
                );
                if (isExpiredUltimateHyperactive) return false;
                return true;
            });
            if (hasSpecialOrBomb) return;
            res.push({ row, col });
        };

        for (let r = 0; r < 8; r++) {
            for (let c = 0; c < 8; c++) {
                canSwapCell(r, c, gameState.board[r][c]);
            }
        }

        for (const expansion of getExpansionCells(gameState)) {
            if (!expansion) continue;
            canSwapCell(expansion.row, expansion.col, Number(expansion.owner));
        }
        return res;
    }

    // Return position-swap targets: any occupied cell; if first target exists, exclude it.
    function getPositionSwapTargets(cardState, gameState, playerKey, pending) {
        const res = [];
        const first = pending && pending.firstTarget ? pending.firstTarget : null;

        const pushIfOccupied = (row, col, ownerValue) => {
            if (ownerValue === EMPTY) return;
            if (first && first.row === row && first.col === col) return;
            if (isPositionSwapProtectedCell(cardState, row, col)) return;
            res.push({ row, col });
        };

        for (let r = 0; r < 8; r++) {
            for (let c = 0; c < 8; c++) {
                pushIfOccupied(r, c, gameState.board[r][c]);
            }
        }

        for (const expansion of getExpansionCells(gameState)) {
            if (!expansion) continue;
            pushIfOccupied(expansion.row, expansion.col, Number(expansion.owner));
        }
        return res;
    }

    // Return sacrifice targets: own stones (normal/special both allowed)
    function getSacrificeTargets(cardState, gameState, playerKey) {
        const res = [];
        const playerVal = playerKey === 'black' ? SharedConstants.BLACK : SharedConstants.WHITE;
        const markers = (cardState && Array.isArray(cardState.markers)) ? cardState.markers : [];
        forEachBoardShapeCell(gameState, (r, c, owner) => {
            if (owner !== playerVal) return;
            const guarded = markers.some(m =>
                m &&
                m.kind === 'specialStone' &&
                m.row === r &&
                m.col === c &&
                m.data &&
                m.data.type === 'GUARD'
            );
            if (guarded) return;
            res.push({ row: r, col: c });
        });
        return res;
    }

    function _getStrongWindDirectionDestination(cardState, gameState, row, col, dr, dc) {
        const nr = row + dr;
        const nc = col + dc;
        if (!hasBoardShapeCell(gameState, nr, nc)) return null;
        if (getCellValue(gameState, nr, nc) !== EMPTY) return null;
        if (isBlockedCell(cardState, nr, nc)) return null;

        let tr = nr;
        let tc = nc;
        while (true) {
            const rr = tr + dr;
            const cc = tc + dc;
            if (!hasBoardShapeCell(gameState, rr, cc)) break;
            if (getCellValue(gameState, rr, cc) !== EMPTY) break;
            if (isBlockedCell(cardState, rr, cc)) break;
            tr = rr;
            tc = cc;
        }
        return { row: tr, col: tc };
    }

    // Return strong-wind targets: any non-empty stone that has at least one movable orthogonal direction.
    function getStrongWindTargets(cardState, gameState) {
        const dirs = [
            { dr: -1, dc: 0 },
            { dr: 1, dc: 0 },
            { dr: 0, dc: -1 },
            { dr: 0, dc: 1 }
        ];
        const res = [];
        forEachBoardShapeCell(gameState, (r, c, owner) => {
            if (owner === EMPTY) return;
            let movable = false;
            for (const d of dirs) {
                if (_getStrongWindDirectionDestination(cardState, gameState, r, c, d.dr, d.dc)) {
                    movable = true;
                    break;
                }
            }
            if (movable) res.push({ row: r, col: c });
        });
        return res;
    }

    function _collectVerticalCrushDestination(cardState, gameState, row, col, dr) {
        if (!Number.isInteger(row) || !Number.isInteger(col)) return null;
        if (dr !== -1 && dr !== 1) return null;

        const firstRow = row + dr;
        if (!hasBoardShapeCell(gameState, firstRow, col)) return null;

        let destination = null;
        for (let r = firstRow; hasBoardShapeCell(gameState, r, col); r += dr) {
            if (isBlockedCell(cardState, r, col)) break;
            if (getCellValue(gameState, r, col) !== EMPTY && isGuardProtectedCell(cardState, r, col)) break;
            destination = { row: r, col };
        }
        return destination;
    }

    function _getVerticalCrushTargets(cardState, gameState, dr) {
        const res = [];
        forEachBoardShapeCell(gameState, (r, c, owner) => {
            if (owner === EMPTY) return;
            const destination = _collectVerticalCrushDestination(cardState, gameState, r, c, dr);
            if (!destination) return;
            if (destination.row === r && destination.col === c) return;
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
        const markers = (cardState && Array.isArray(cardState.markers)) ? cardState.markers : [];

        forEachBoardShapeCell(gameState, (r, c, owner) => {
            if (owner !== playerVal) return;
            const hasBomb = markers.some(m => m && m.row === r && m.col === c && isBombCategoryMarker(m));
            if (hasBomb) return;
            if (isAbsoluteProtectedCell(cardState, r, c)) return;
            const hasOwnTrap = markers.some(m => (
                m &&
                m.row === r &&
                m.col === c &&
                m.kind === 'specialStone' &&
                m.owner === playerKey &&
                m.data &&
                m.data.type === 'TRAP'
            ));
            if (hasOwnTrap) return;
            res.push({ row: r, col: c });
        });
        return res;
    }

    // Return guard targets: own stones (normal/special both allowed), excluding bombs/absolute-protected.
    function getGuardTargets(cardState, gameState, playerKey) {
        const res = [];
        const playerVal = playerKey === 'black' ? SharedConstants.BLACK : SharedConstants.WHITE;
        const markers = (cardState && Array.isArray(cardState.markers)) ? cardState.markers : [];
        forEachBoardShapeCell(gameState, (r, c, owner) => {
            if (owner !== playerVal) return;
            const hasBomb = markers.some(m => m && m.row === r && m.col === c && isBombCategoryMarker(m));
            if (hasBomb) return;
            if (isAbsoluteProtectedCell(cardState, r, c)) return;
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
        if (!gameState || !Array.isArray(gameState.board) || gameState.board.length !== 8) return [];

        let hasDestination = false;
        forEachBoardShapeCell(gameState, (r, c, owner) => {
            if (hasDestination) return;
            if (owner !== EMPTY) return;
            if (isBlockedCell(cardState, r, c)) return;
            hasDestination = true;
        });
        if (!hasDestination) return [];

        const res = [];
        forEachBoardShapeCell(gameState, (r, c, owner) => {
            if (owner === EMPTY) return;
            res.push({ row: r, col: c });
        });
        return res;
    }

    function getBoardExpansionWillCellDescriptors() {
        const cells = [];
        for (let row = 0; row < 8; row++) {
            cells.push({ row, col: -1, side: 'left' });
            cells.push({ row, col: 8, side: 'right' });
        }
        return cells;
    }

    function hasCloneSpawnSpace(cardState, gameState, row, col) {
        for (let dr = -1; dr <= 1; dr++) {
            for (let dc = -1; dc <= 1; dc++) {
                if (dr === 0 && dc === 0) continue;
                const nr = row + dr;
                const nc = col + dc;
                if (!hasBoardShapeCell(gameState, nr, nc)) continue;
                if (getCellValue(gameState, nr, nc) !== EMPTY) continue;
                if (isBlockedCell(cardState, nr, nc)) continue;
                return true;
            }
        }
        return false;
    }

    function getCloneTargets(cardState, gameState, playerKey) {
        const res = [];
        const playerVal = playerKey === 'black' ? SharedConstants.BLACK : SharedConstants.WHITE;
        forEachBoardShapeCell(gameState, (r, c, owner) => {
            if (owner !== playerVal) return;
            if (!hasCloneSpawnSpace(cardState, gameState, r, c)) return;
            res.push({ row: r, col: c });
        });
        return res;
    }

    function getSplitTargets(cardState, gameState, playerKey) {
        return getCloneTargets(cardState, gameState, playerKey);
    }

    function isMainBoardCell(row, col) {
        return Number.isInteger(row) && Number.isInteger(col) && row >= 0 && row < 8 && col >= 0 && col < 8;
    }

    function resolveExpansionSide(side, row, col) {
        if (side === 'left' || side === 'right' || side === 'top' || side === 'bottom') return side;
        if (col === -1) return 'left';
        if (col === 8) return 'right';
        if (row === -1) return 'top';
        if (row === 8) return 'bottom';
        return null;
    }

    function getExpansionCells(gameState) {
        const expansion = (gameState && gameState.boardExpansion && typeof gameState.boardExpansion === 'object')
            ? gameState.boardExpansion
            : null;
        if (!expansion) return [];

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
                if (!Number.isInteger(col) && side === 'left') col = -1;
                if (!Number.isInteger(col) && side === 'right') col = 8;
            } else {
                side = source;
                row = legacyRow;
                if (side === 'left') col = -1;
                if (side === 'right') col = 8;
            }

            if (!Number.isInteger(row) || !Number.isInteger(col)) return;
            if (row < -1 || row > 8 || col < -1 || col > 8) return;
            if (isMainBoardCell(row, col)) return;
            if (cells.some((cell) => cell && cell.row === row && cell.col === col)) return;
            const normalizedOwner = (owner === SharedConstants.BLACK || owner === SharedConstants.WHITE)
                ? owner
                : EMPTY;
            cells.push({
                side: resolveExpansionSide(side, row, col),
                row,
                col,
                owner: normalizedOwner
            });
        };

        if (Array.isArray(expansion.cells)) {
            for (const cell of expansion.cells) {
                if (!cell || typeof cell !== 'object') continue;
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
        if (!gameState || !gameState.board || gameState.board.length !== 8) return [];

        const blockedEdgeTargets = new Set();
        const expansionCells = getExpansionCells(gameState);
        for (const cell of expansionCells) {
            if (!cell) continue;
            if (cell.col === -1 && Number.isInteger(cell.row) && cell.row >= 0 && cell.row < 8) {
                blockedEdgeTargets.add(`${cell.row},0`);
            }
            if (cell.col === 8 && Number.isInteger(cell.row) && cell.row >= 0 && cell.row < 8) {
                blockedEdgeTargets.add(`${cell.row},7`);
            }
        }

        const res = [];
        for (let r = 0; r < 8; r++) {
            if (!blockedEdgeTargets.has(`${r},0`)) {
                res.push({ row: r, col: 0, side: 'left' });
            }
            if (!blockedEdgeTargets.has(`${r},7`)) {
                res.push({ row: r, col: 7, side: 'right' });
            }
        }
        return res;
    }

    function getBoardExpansionGodCornerDescriptors() {
        return [
            {
                row: 0,
                col: 0,
                cells: [
                    { row: -1, col: 0 },
                    { row: -1, col: -1 },
                    { row: 0, col: -1 }
                ]
            },
            {
                row: 0,
                col: 7,
                cells: [
                    { row: -1, col: 7 },
                    { row: -1, col: 8 },
                    { row: 0, col: 8 }
                ]
            },
            {
                row: 7,
                col: 0,
                cells: [
                    { row: 8, col: 0 },
                    { row: 8, col: -1 },
                    { row: 7, col: -1 }
                ]
            },
            {
                row: 7,
                col: 7,
                cells: [
                    { row: 7, col: 8 },
                    { row: 8, col: 8 },
                    { row: 8, col: 7 }
                ]
            }
        ];
    }

    function getBoardExpansionGodTargets(cardState, gameState, playerKey) {
        if (!gameState || !gameState.board || gameState.board.length !== 8) return [];

        const expansionCells = getExpansionCells(gameState);
        const occupied = new Set(expansionCells.map((cell) => `${cell.row},${cell.col}`));
        const pending = cardState && cardState.pendingEffectByPlayer
            ? cardState.pendingEffectByPlayer[playerKey]
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
            if (!target || !Number.isInteger(target.row) || !Number.isInteger(target.col)) continue;
            selectedKeys.add(`${target.row},${target.col}`);
        }

        const res = [];
        for (const corner of getBoardExpansionGodCornerDescriptors()) {
            if (!corner || !Array.isArray(corner.cells)) continue;
            if (selectedKeys.has(`${corner.row},${corner.col}`)) continue;
            const hasOccupied = corner.cells.some((cell) => occupied.has(`${cell.row},${cell.col}`));
            if (hasOccupied) continue;
            res.push({ row: corner.row, col: corner.col });
        }
        return res;
    }

    function getCellTeleportDestinations(cardState, gameState) {
        if (!gameState || !gameState.board || gameState.board.length !== 8) return [];

        const activeExpansionCells = getExpansionCells(gameState);
        const activeByKey = new Map();
        for (const cell of activeExpansionCells) {
            if (!cell) continue;
            activeByKey.set(`${cell.row},${cell.col}`, cell);
        }

        const candidates = [];
        const seen = new Set();
        const pushCandidate = (row, col, side) => {
            const key = `${row},${col}`;
            if (seen.has(key)) return;
            seen.add(key);
            const activeCell = activeByKey.get(key) || null;
            const owner = activeCell ? Number(activeCell.owner) : EMPTY;
            if (owner !== EMPTY) return;
            if (isBlockedCell(cardState, row, col)) return;
            candidates.push({
                row,
                col,
                side: resolveExpansionSide(side, row, col),
                active: !!activeCell
            });
        };

        for (const cell of getBoardExpansionWillCellDescriptors()) {
            if (!cell) continue;
            pushCandidate(cell.row, cell.col, cell.side);
        }
        for (const corner of getBoardExpansionGodCornerDescriptors()) {
            if (!corner || !Array.isArray(corner.cells)) continue;
            for (const cell of corner.cells) {
                if (!cell) continue;
                pushCandidate(cell.row, cell.col, resolveExpansionSide(null, cell.row, cell.col));
            }
        }

        return candidates;
    }

    function getCellTeleportTargets(cardState, gameState) {
        if (!gameState || !gameState.board || gameState.board.length !== 8) return [];
        const destinations = getCellTeleportDestinations(cardState, gameState);
        if (!destinations.length) return [];

        const res = [];
        for (let r = 0; r < 8; r++) {
            for (let c = 0; c < 8; c++) {
                if (gameState.board[r][c] === EMPTY) continue;
                res.push({ row: r, col: c });
            }
        }

        for (const expansion of getExpansionCells(gameState)) {
            if (!expansion) continue;
            if (Number(expansion.owner) === EMPTY) continue;
            if (isMeteorHoleCell(cardState, expansion.row, expansion.col)) continue;
            res.push({ row: expansion.row, col: expansion.col });
        }

        return res;
    }

    // Return blockade targets: all empty cells (including active expansion cells), excluding already blocked cells.
    function getBlockadeTargets(cardState, gameState) {
        if (!gameState || !gameState.board || gameState.board.length !== 8) return [];
        const res = [];
        for (let r = 0; r < 8; r++) {
            for (let c = 0; c < 8; c++) {
                if (gameState.board[r][c] !== EMPTY) continue;
                if (isBlockedCell(cardState, r, c)) continue;
                res.push({ row: r, col: c });
            }
        }

        const expansionCells = getExpansionCells(gameState);
        for (const expansion of expansionCells) {
            if (!expansion || Number(expansion.owner) !== EMPTY) continue;
            if (isBlockedCell(cardState, expansion.row, expansion.col)) continue;
            res.push({ row: expansion.row, col: expansion.col });
        }

        return res;
    }

    // Return meteor targets: all board cells + active expansion cells, excluding already destroyed holes.
    function getMeteorTargets(cardState, gameState) {
        if (!gameState || !gameState.board || gameState.board.length !== 8) return [];
        const res = [];
        for (let r = 0; r < 8; r++) {
            for (let c = 0; c < 8; c++) {
                if (isMeteorHoleCell(cardState, r, c)) continue;
                if (isFrozenCell(cardState, r, c)) continue;
                res.push({ row: r, col: c });
            }
        }

        const expansionCells = getExpansionCells(gameState);
        for (const expansion of expansionCells) {
            if (!expansion) continue;
            if (isMeteorHoleCell(cardState, expansion.row, expansion.col)) continue;
            if (isFrozenCell(cardState, expansion.row, expansion.col)) continue;
            res.push({ row: expansion.row, col: expansion.col });
        }
        return res;
    }

    function getFreezeTargets(cardState, gameState) {
        if (!gameState || !gameState.board || gameState.board.length !== 8) return [];
        const res = [];
        for (let r = 0; r < 8; r++) {
            for (let c = 0; c < 8; c++) {
                if (isBlockedCell(cardState, r, c)) continue;
                res.push({ row: r, col: c });
            }
        }

        const expansionCells = getExpansionCells(gameState);
        for (const expansion of expansionCells) {
            if (!expansion) continue;
            if (isBlockedCell(cardState, expansion.row, expansion.col)) continue;
            res.push({ row: expansion.row, col: expansion.col });
        }
        return res;
    }

    return {
        getDestroyTargets,
        getSwapTargets,
        getPositionSwapTargets,
        getSacrificeTargets,
        getStrongWindTargets,
        getSuperBuoyancyTargets,
        getSuperGravityTargets,
        getTrapTargets,
        getGuardTargets,
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
        getFreezeTargets,
        isBlockedCell
    };
}));
