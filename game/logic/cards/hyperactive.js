/**
 * @file hyperactive.js
 * @description Hyperactive effect helpers (Shared between Browser and Headless)
 */

(function (root, factory) {
    if (typeof module === 'object' && module.exports) {
        module.exports = factory(
            require('../../../shared-constants'),
            require('../../../shared/shared-board-utils')
        );
    } else {
        root.CardHyperactive = factory(root.SharedConstants, root.SharedBoardUtils);
    }
}(typeof self !== 'undefined' ? self : this, function (SharedConstants, SharedBoardUtils) {
    'use strict';

    const { BLACK, WHITE, EMPTY } = SharedConstants || {};
    const BoardUtils = SharedBoardUtils || null;
    const EXTREME_HYPERACTIVE_FLIP_EVADE_LIMIT = 3;
    const ULTIMATE_HYPERACTIVE_FLIP_EVADE_LIMIT = 3;

    function resolveBoardConfigSource(gameState) {
        if (!gameState || typeof gameState !== 'object') return null;
        if (gameState.boardConfig && typeof gameState.boardConfig === 'object') return gameState.boardConfig;
        return Array.isArray(gameState.board) ? gameState.board : null;
    }

    function getBoardExtents(gameState) {
        const board = gameState && Array.isArray(gameState.board) ? gameState.board : [];
        const rows = board.length;
        let cols = 0;
        for (const row of board) {
            if (Array.isArray(row)) cols = Math.max(cols, row.length);
        }
        return { rows, cols };
    }

    function resolveBoardShapeBoard(gameState) {
        if (!gameState || !Array.isArray(gameState.board)) return null;
        if (!BoardUtils || typeof BoardUtils.attachBoardShape !== 'function') return gameState.board;
        return BoardUtils.attachBoardShape(gameState.board, {
            boardConfig: resolveBoardConfigSource(gameState) || gameState.board,
            boardExpansion: gameState.boardExpansion
        });
    }

    function isMainBoardCell(gameState, row, col) {
        if (!Number.isInteger(row) || !Number.isInteger(col)) return false;
        if (BoardUtils && typeof BoardUtils.isMainBoardCell === 'function') {
            return BoardUtils.isMainBoardCell(row, col, resolveBoardConfigSource(gameState));
        }
        const extents = getBoardExtents(gameState);
        return row >= 0 && row < extents.rows && col >= 0 && col < extents.cols;
    }

    function resolveExpansionSide(gameState, side, row, col) {
        if (BoardUtils && typeof BoardUtils.resolveExpansionSide === 'function') {
            return BoardUtils.resolveExpansionSide(side, row, col, resolveBoardConfigSource(gameState));
        }
        const extents = getBoardExtents(gameState);
        if (side === 'left' || side === 'right' || side === 'top' || side === 'bottom') return side;
        if (col === -1) return 'left';
        if (col === extents.cols) return 'right';
        if (row === -1) return 'top';
        if (row === extents.rows) return 'bottom';
        return null;
    }

    function getExpansionCellRef(gameState, row, col) {
        const extents = getBoardExtents(gameState);
        const expansion = (gameState && gameState.boardExpansion && typeof gameState.boardExpansion === 'object')
            ? gameState.boardExpansion
            : null;
        if (!expansion) return null;

        if (Array.isArray(expansion.cells)) {
            for (let index = 0; index < expansion.cells.length; index++) {
                const cell = expansion.cells[index];
                if (!cell || typeof cell !== 'object') continue;
                const cellCol = Number.isInteger(cell.col)
                    ? cell.col
                    : (cell.side === 'left' ? -1 : (cell.side === 'right' ? extents.cols : null));
                if (!Number.isInteger(cellCol)) continue;
                if (cell.row === row && cellCol === col) {
                    return { expansion, index, cell, legacy: false };
                }
            }
        }

        if (expansion.active === true) {
            const legacyCol = Number.isInteger(expansion.col)
                ? expansion.col
                : (expansion.side === 'left' ? -1 : (expansion.side === 'right' ? extents.cols : null));
            if (expansion.row === row && legacyCol === col) {
                return { expansion, index: -1, cell: expansion, legacy: true };
            }
        }

        return null;
    }

    function hasBoardShapeCell(gameState, row, col) {
        const board = resolveBoardShapeBoard(gameState);
        if (board && BoardUtils && typeof BoardUtils.hasPlayableCell === 'function') {
            return BoardUtils.hasPlayableCell(board, row, col);
        }
        return getBoardCell(gameState, row, col) !== null;
    }

    function forEachBoardShapeCell(gameState, visitor) {
        if (typeof visitor !== 'function') return;
        const board = resolveBoardShapeBoard(gameState);
        if (board && BoardUtils && typeof BoardUtils.collectBoardCoordinates === 'function' && typeof BoardUtils.getCellValue === 'function') {
            for (const cell of BoardUtils.collectBoardCoordinates(board)) {
                visitor(cell.row, cell.col, BoardUtils.getCellValue(board, cell.row, cell.col));
            }
            return;
        }
        if (!gameState || !Array.isArray(gameState.board)) return;

        for (let row = 0; row < gameState.board.length; row++) {
            const boardRow = Array.isArray(gameState.board[row]) ? gameState.board[row] : [];
            for (let col = 0; col < boardRow.length; col++) {
                visitor(row, col, boardRow[col]);
            }
        }

        const expansion = (gameState && gameState.boardExpansion && typeof gameState.boardExpansion === 'object')
            ? gameState.boardExpansion
            : null;
        if (!expansion) return;

        const extents = getBoardExtents(gameState);
        const seen = new Set();
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
                if (!Number.isInteger(col) && side === 'right') col = extents.cols;
            } else {
                side = source;
                row = legacyRow;
                if (side === 'left') col = -1;
                if (side === 'right') col = extents.cols;
            }

            if (!Number.isInteger(row) || !Number.isInteger(col)) return;
            if (row < -1 || row > extents.rows || col < -1 || col > extents.cols) return;
            if (isMainBoardCell(gameState, row, col)) return;
            const key = `${row},${col}`;
            if (seen.has(key)) return;
            seen.add(key);
            visitor(row, col, (owner === BLACK || owner === WHITE) ? owner : EMPTY, resolveExpansionSide(gameState, side, row, col));
        };

        if (Array.isArray(expansion.cells)) {
            for (const cell of expansion.cells) {
                if (!cell || typeof cell !== 'object') continue;
                pushCell(cell);
            }
        }

        if (seen.size === 0 && expansion.active === true) {
            pushCell(expansion);
        }
    }

    function getBoardCell(gameState, row, col) {
        const board = resolveBoardShapeBoard(gameState);
        if (board && BoardUtils && typeof BoardUtils.getCellValue === 'function') {
            return BoardUtils.getCellValue(board, row, col);
        }
        if (isMainBoardCell(gameState, row, col)) {
            if (!gameState || !Array.isArray(gameState.board)) return null;
            const boardRow = gameState.board[row];
            if (!Array.isArray(boardRow)) return null;
            return boardRow[col];
        }
        const ref = getExpansionCellRef(gameState, row, col);
        return ref ? Number(ref.cell.owner) : null;
    }

    function setBoardCell(gameState, row, col, value) {
        if (isMainBoardCell(gameState, row, col)) {
            if (!gameState || !Array.isArray(gameState.board)) return false;
            const boardRow = gameState.board[row];
            if (!Array.isArray(boardRow)) return false;
            boardRow[col] = value;
            return true;
        }

        const ref = getExpansionCellRef(gameState, row, col);
        if (!ref) return false;
        const normalizedOwner = (value === BLACK || value === WHITE) ? value : EMPTY;

        if (!ref.legacy) {
            ref.expansion.cells[ref.index] = {
                side: resolveExpansionSide(gameState, ref.cell.side, row, col),
                row,
                col,
                owner: normalizedOwner
            };
            return true;
        }

        ref.expansion.side = resolveExpansionSide(gameState, ref.cell.side, row, col);
        ref.expansion.row = row;
        ref.expansion.col = col;
        ref.expansion.owner = normalizedOwner;
        return true;
    }

    function clearUltimateHyperactiveAtPositions(cardState, positions) {
        if (!cardState || !Array.isArray(cardState.markers)) return;
        const removeSet = new Set((positions || []).map(p => `${p.row},${p.col}`));
        cardState.markers = cardState.markers.filter(m => {
            if (!m || m.kind !== 'specialStone') return true;
            if (!m.data || m.data.type !== 'ULTIMATE_HYPERACTIVE') return true;
            return !removeSet.has(`${m.row},${m.col}`);
        });
    }

    function getNeighborEmptyCandidates(cardState, gameState, row, col, deps, options = {}) {
        const emptyOut = [];
        const occupiedOut = [];
        const isBlockedCell = deps && typeof deps.isBlockedCell === 'function'
            ? deps.isBlockedCell
            : (() => false);
        const includeOccupied = options && options.includeOccupied === true;
        for (let dr = -1; dr <= 1; dr++) {
            for (let dc = -1; dc <= 1; dc++) {
                if (dr === 0 && dc === 0) continue;
                const r = row + dr;
                const c = col + dc;
                if (!hasBoardShapeCell(gameState, r, c)) continue;
                if (isBlockedCell(cardState, r, c, gameState)) continue;
                const occupied = getBoardCell(gameState, r, c) !== EMPTY;
                if (!occupied) {
                    emptyOut.push({ row: r, col: c, occupied: false });
                } else if (includeOccupied) {
                    occupiedOut.push({ row: r, col: c, occupied: true });
                }
            }
        }
        return includeOccupied ? emptyOut.concat(occupiedOut) : emptyOut;
    }

    function getStraightLineEmptyCandidates(cardState, gameState, row, col, deps, options = {}) {
        const out = [];
        const isBlockedCell = deps && typeof deps.isBlockedCell === 'function'
            ? deps.isBlockedCell
            : (() => false);
        const maxDistance = Number.isInteger(options.maxDistance) && options.maxDistance > 0
            ? options.maxDistance
            : 1;
        const allowJumpOverStones = options.allowJumpOverStones === true;

        for (let dr = -1; dr <= 1; dr++) {
            for (let dc = -1; dc <= 1; dc++) {
                if (dr === 0 && dc === 0) continue;

                for (let distance = 1; distance <= maxDistance; distance++) {
                    const targetRow = row + (dr * distance);
                    const targetCol = col + (dc * distance);
                    if (!hasBoardShapeCell(gameState, targetRow, targetCol)) break;

                    let blockedOnPath = false;
                    for (let step = 1; step <= distance; step++) {
                        const stepRow = row + (dr * step);
                        const stepCol = col + (dc * step);
                        if (!hasBoardShapeCell(gameState, stepRow, stepCol)) {
                            blockedOnPath = true;
                            break;
                        }
                        if (isBlockedCell(cardState, stepRow, stepCol, gameState)) {
                            blockedOnPath = true;
                            break;
                        }
                    }
                    if (blockedOnPath) break;

                    const occupied = getBoardCell(gameState, targetRow, targetCol) !== EMPTY;
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

    function getChebyshevDistance(from, to) {
        if (!from || !to) return 0;
        return Math.max(Math.abs(from.row - to.row), Math.abs(from.col - to.col));
    }

    function collectEscapeThreats(gameState, ownerVal, originRow, originCol) {
        const BLACK_VAL = BLACK || 1;
        const WHITE_VAL = WHITE || -1;
        const enemyVal = ownerVal === BLACK_VAL ? WHITE_VAL : BLACK_VAL;
        const enemies = [];
        const allStones = [];

        forEachBoardShapeCell(gameState, (r, c, value) => {
            if (value === EMPTY) return;
            if (r === originRow && c === originCol) return;
            const point = { row: r, col: c };
            allStones.push(point);
            if (value === enemyVal) enemies.push(point);
        });

        return enemies.length > 0 ? enemies : allStones;
    }

    function pickEscapeTarget(candidates, threats) {
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

    function collectRobotVacuumEnemies(gameState, ownerVal, originRow, originCol) {
        const BLACK_VAL = BLACK || 1;
        const WHITE_VAL = WHITE || -1;
        const enemyVal = ownerVal === BLACK_VAL ? WHITE_VAL : BLACK_VAL;
        const enemies = [];

        forEachBoardShapeCell(gameState, (r, c, value) => {
            if (r === originRow && c === originCol) return;
            if (value !== enemyVal) return;
            enemies.push({ row: r, col: c });
        });

        return enemies;
    }

    function pickRobotVacuumApproachTarget(candidates, enemyPoints, prng) {
        if (!Array.isArray(candidates) || candidates.length === 0) return null;
        const randomSource = (prng && typeof prng.random === 'function') ? prng : { random: () => 0 };
        const enemies = Array.isArray(enemyPoints) ? enemyPoints : [];

        if (enemies.length === 0) {
            const fallbackIndex = Math.floor(randomSource.random() * candidates.length);
            return candidates[fallbackIndex] || candidates[0] || null;
        }

        let bestScore = null;
        let bestCandidates = [];

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

    function moveCoexistingSpecialMarkers(cardState, anchorEntry, fromRow, fromCol, toRow, toCol) {
        if (!Array.isArray(cardState && cardState.markers)) return;
        for (const marker of cardState.markers) {
            if (!marker || marker === anchorEntry) continue;
            if (marker.row !== fromRow || marker.col !== fromCol) continue;
            if (marker.kind === 'specialStone') {
                const markerTypeUpper = String(marker && marker.data && marker.data.type ? marker.data.type : '').toUpperCase();
                if (markerTypeUpper === 'BLOCKADE' || markerTypeUpper === 'METEOR_HOLE') continue;
            }
            marker.row = toRow;
            marker.col = toCol;
        }
    }

    function selectExtremeRepelTarget(cardState, gameState, entry, fromRow, fromCol, dr, dc, isBlockedCell) {
        const origin = { row: entry.row, col: entry.col };
        const currentDistance = getChebyshevDistance({ row: fromRow, col: fromCol }, origin);
        const candidates = [];

        for (let moveDr = -1; moveDr <= 1; moveDr++) {
            for (let moveDc = -1; moveDc <= 1; moveDc++) {
                if (moveDr === 0 && moveDc === 0) continue;

                const toRow = fromRow + moveDr;
                const toCol = fromCol + moveDc;
                if (!hasBoardShapeCell(gameState, toRow, toCol)) continue;
                if (isBlockedCell(cardState, toRow, toCol, gameState)) continue;
                if (getBoardCell(gameState, toRow, toCol) !== EMPTY) continue;

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

    function canExtremeHyperactiveSwapCell(cardState, row, col, deps) {
        if (deps && typeof deps.isFrozenCell === 'function' && deps.isFrozenCell(cardState, row, col)) {
            return false;
        }
        if (deps && typeof deps.isAbsoluteProtectedCell === 'function' && deps.isAbsoluteProtectedCell(cardState, row, col)) {
            return false;
        }
        return true;
    }

    function applyExtremeHyperactiveRepel(cardState, gameState, entry, deps = {}) {
        if (!entry) return [];
        const isBlockedCell = typeof deps.isBlockedCell === 'function'
            ? deps.isBlockedCell
            : (() => false);
        const repelled = [];

        for (let dr = -1; dr <= 1; dr++) {
            for (let dc = -1; dc <= 1; dc++) {
                if (dr === 0 && dc === 0) continue;

                const fromRow = entry.row + dr;
                const fromCol = entry.col + dc;
                if (!hasBoardShapeCell(gameState, fromRow, fromCol)) continue;

                const sourceVal = getBoardCell(gameState, fromRow, fromCol);
                if (sourceVal === null || sourceVal === EMPTY) continue;

                const target = selectExtremeRepelTarget(cardState, gameState, entry, fromRow, fromCol, dr, dc, isBlockedCell);
                if (!target) continue;

                let movedRes = false;
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
                } else {
                    setBoardCell(gameState, fromRow, fromCol, EMPTY);
                    setBoardCell(gameState, target.row, target.col, sourceVal);
                    movedRes = true;
                }

                if (!movedRes) continue;

                moveCoexistingSpecialMarkers(cardState, null, fromRow, fromCol, target.row, target.col);
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

    function normalizeFlipCell(cell) {
        if (Array.isArray(cell) && Number.isInteger(cell[0]) && Number.isInteger(cell[1])) {
            return { row: cell[0], col: cell[1] };
        }
        if (cell && Number.isInteger(cell.row) && Number.isInteger(cell.col)) {
            return { row: cell.row, col: cell.col };
        }
        return null;
    }

    function getFlipEvadeMarkerType(entry) {
        const type = String(entry && entry.data && entry.data.type ? entry.data.type : '').toUpperCase();
        if (
            type === 'HYPERACTIVE' ||
            type === 'ESCAPE_HYPERACTIVE' ||
            type === 'INHERITED_HYPERACTIVE' ||
            type === 'EXTREME_HYPERACTIVE' ||
            type === 'ULTIMATE_HYPERACTIVE' ||
            type === 'WILL_HUNTER_KING' ||
            type === 'AFTERIMAGE_WILL'
        ) {
            return type;
        }
        return null;
    }

    function findFlipEvadeMarkersAt(cardState, row, col) {
        if (!cardState || !Array.isArray(cardState.markers)) return [];
        const out = [];
        for (const marker of cardState.markers) {
            if (!marker || marker.kind !== 'specialStone') continue;
            if (marker.row !== row || marker.col !== col) continue;
            if (!getFlipEvadeMarkerType(marker)) continue;
            out.push(marker);
        }
        return out;
    }

    function canUseFlipEvade(entry, markerTypeUpper) {
        if (!entry || !markerTypeUpper) return false;

        if (markerTypeUpper === 'ULTIMATE_HYPERACTIVE') {
            const remaining = Number(entry.data && entry.data.remainingOwnerTurns);
            if (Number.isFinite(remaining) && remaining <= 0) return false;
            const evadeRemainingRaw = Number(entry.data && entry.data.flipEvadeRemaining);
            const evadeRemaining = Number.isFinite(evadeRemainingRaw)
                ? Math.max(0, Math.trunc(evadeRemainingRaw))
                : ULTIMATE_HYPERACTIVE_FLIP_EVADE_LIMIT;
            return evadeRemaining > 0;
        }

        if (entry.data && entry.data.instantPlacementOnly === true) return false;

        const remaining = Number(entry.data && entry.data.flipEvadeRemaining);
        const normalized = Number.isFinite(remaining)
            ? remaining
            : (markerTypeUpper === 'AFTERIMAGE_WILL'
                ? 3
                : (markerTypeUpper === 'EXTREME_HYPERACTIVE' ? EXTREME_HYPERACTIVE_FLIP_EVADE_LIMIT : 1));
        return normalized > 0;
    }

    function consumeFlipEvade(entry, markerTypeUpper) {
        if (!entry || !markerTypeUpper) return;
        if (!entry.data || typeof entry.data !== 'object') entry.data = {};
        const remaining = Number(entry.data.flipEvadeRemaining);
        const normalized = Number.isFinite(remaining)
            ? remaining
            : (markerTypeUpper === 'ULTIMATE_HYPERACTIVE'
                ? ULTIMATE_HYPERACTIVE_FLIP_EVADE_LIMIT
                : (markerTypeUpper === 'AFTERIMAGE_WILL'
                    ? 3
                    : (markerTypeUpper === 'EXTREME_HYPERACTIVE' ? EXTREME_HYPERACTIVE_FLIP_EVADE_LIMIT : 1)));
        entry.data.flipEvadeRemaining = Math.max(0, normalized - 1);
    }

    function pruneAfterimageMarkerIfDepleted(cardState, entry) {
        if (!cardState || !Array.isArray(cardState.markers) || !entry || !entry.data) return;
        const typeUpper = String(entry.data.type || '').toUpperCase();
        if (typeUpper !== 'AFTERIMAGE_WILL') return;
        const flipRemaining = Number.isFinite(Number(entry.data.flipEvadeRemaining))
            ? Math.max(0, Math.trunc(Number(entry.data.flipEvadeRemaining)))
            : 0;
        const destroyRemaining = Number.isFinite(Number(entry.data.destroyEvadeRemaining))
            ? Math.max(0, Math.trunc(Number(entry.data.destroyEvadeRemaining)))
            : 0;
        if (flipRemaining > 0 || destroyRemaining > 0) return;
        cardState.markers = cardState.markers.filter((marker) => marker !== entry);
    }

    function removeFlipEvadeMarkerAt(cardState, row, col, deps = {}) {
        if (deps && typeof deps.clearHyperactiveAtPositions === 'function') {
            deps.clearHyperactiveAtPositions(cardState, [{ row, col }]);
            return;
        }
        if (!cardState || !Array.isArray(cardState.markers)) return;
        cardState.markers = cardState.markers.filter((marker) => {
            if (!marker || marker.kind !== 'specialStone') return true;
            if (marker.row !== row || marker.col !== col) return true;
            const markerType = getFlipEvadeMarkerType(marker);
            return !markerType;
        });
    }

    function getFlipEvadeCause(markerTypeUpper) {
        if (markerTypeUpper === 'WILL_HUNTER_KING') return 'WILL_HUNTER_KING';
        if (markerTypeUpper === 'AFTERIMAGE_WILL') return 'AFTERIMAGE_WILL';
        if (markerTypeUpper === 'ESCAPE_HYPERACTIVE') return 'ESCAPE_HYPERACTIVE';
        if (markerTypeUpper === 'INHERITED_HYPERACTIVE') return 'HYPERACTIVE_INHERIT_WILL';
        if (markerTypeUpper === 'EXTREME_HYPERACTIVE') return 'EXTREME_HYPERACTIVE_WILL';
        if (markerTypeUpper === 'ULTIMATE_HYPERACTIVE') return 'ULTIMATE_HYPERACTIVE_GOD';
        return 'HYPERACTIVE';
    }

    function getFlipEvadeMoveReason(markerTypeUpper) {
        if (markerTypeUpper === 'WILL_HUNTER_KING') return 'will_hunter_king_flip_evade_move';
        if (markerTypeUpper === 'AFTERIMAGE_WILL') return 'afterimage_will_flip_evade_move';
        if (markerTypeUpper === 'ESCAPE_HYPERACTIVE') return 'escape_hyperactive_flip_evade_move';
        if (markerTypeUpper === 'INHERITED_HYPERACTIVE') return 'inherited_hyperactive_flip_evade_move';
        if (markerTypeUpper === 'EXTREME_HYPERACTIVE') return 'extreme_hyperactive_flip_evade_move';
        if (markerTypeUpper === 'ULTIMATE_HYPERACTIVE') return 'ultimate_hyperactive_flip_evade_move';
        return 'hyperactive_flip_evade_move';
    }

    function getFlipEvadeNoCandidateReason(markerTypeUpper) {
        if (markerTypeUpper === 'WILL_HUNTER_KING') return 'will_hunter_king_flip_evade_no_candidates';
        if (markerTypeUpper === 'AFTERIMAGE_WILL') return 'afterimage_will_flip_evade_no_candidates';
        if (markerTypeUpper === 'ESCAPE_HYPERACTIVE') return 'escape_hyperactive_flip_evade_no_candidates';
        if (markerTypeUpper === 'INHERITED_HYPERACTIVE') return 'inherited_hyperactive_flip_evade_no_candidates';
        if (markerTypeUpper === 'EXTREME_HYPERACTIVE') return 'extreme_hyperactive_flip_evade_no_candidates';
        if (markerTypeUpper === 'ULTIMATE_HYPERACTIVE') return 'ultimate_hyperactive_flip_evade_no_candidates';
        return 'hyperactive_flip_evade_no_candidates';
    }

    function resolveHyperactiveFlipEvasion(cardState, gameState, flipCells, ownerAfterKey, prng, deps = {}) {
        const moved = [];
        const destroyed = [];
        const evadedSet = new Set();
        const parsedFlips = (Array.isArray(flipCells) ? flipCells : [])
            .map((cell) => normalizeFlipCell(cell))
            .filter((cell) => !!cell);

        if (parsedFlips.length === 0) {
            return { remainingFlips: [], moved, destroyed, evaded: [] };
        }

        const p = prng || (deps.defaultPrng || { random: () => 0 });
        const isBlockedCell = (deps && typeof deps.isBlockedCell === 'function')
            ? deps.isBlockedCell
            : (() => false);
        const destroyAt = deps.destroyAt || ((cs, gs, row, col) => {
            const cell = getBoardCell(gs, row, col);
            if (cell === null || cell === undefined || cell === EMPTY) return false;
            if (cs && Array.isArray(cs.markers)) {
                cs.markers = cs.markers.filter((m) => !(m && m.row === row && m.col === col));
            }
            setBoardCell(gs, row, col, EMPTY);
            return true;
        });

        const blackVal = BLACK || 1;
        const whiteVal = WHITE || -1;
        const ownerAfterNormalized = ownerAfterKey === 'white' ? 'white' : 'black';
        const ownerAfterVal = ownerAfterNormalized === 'black' ? blackVal : whiteVal;
        const ownerBeforeVal = ownerAfterVal === blackVal ? whiteVal : blackVal;
        const forbiddenTargets = new Set(parsedFlips.map((cell) => `${cell.row},${cell.col}`));
        const processed = new Set();

        for (const flip of parsedFlips) {
            const key = `${flip.row},${flip.col}`;
            if (processed.has(key)) continue;
            processed.add(key);

            if (getBoardCell(gameState, flip.row, flip.col) !== ownerBeforeVal) continue;

            const evadeMarkers = findFlipEvadeMarkersAt(cardState, flip.row, flip.col);
            if (!evadeMarkers.length) continue;
            let entry = null;
            let markerTypeUpper = null;
            for (const marker of evadeMarkers) {
                const t = getFlipEvadeMarkerType(marker);
                if (!t) continue;
                if (!canUseFlipEvade(marker, t)) continue;
                entry = marker;
                markerTypeUpper = t;
                break;
            }
            if (!entry || !markerTypeUpper) continue;

            const ownerKey = entry.owner === 'white' ? 'white' : 'black';
            const ownerVal = ownerKey === 'black' ? blackVal : whiteVal;
            if (getBoardCell(gameState, entry.row, entry.col) !== ownerVal) continue;

            const cause = getFlipEvadeCause(markerTypeUpper);
            const moveReason = getFlipEvadeMoveReason(markerTypeUpper);
            const noCandidateReason = getFlipEvadeNoCandidateReason(markerTypeUpper);

            let candidatePool = getNeighborEmptyCandidates(cardState, gameState, entry.row, entry.col, { isBlockedCell })
                .filter((candidate) => !forbiddenTargets.has(`${candidate.row},${candidate.col}`));

            let movedRes = false;
            while (candidatePool.length > 0) {
                let target = null;
                if (markerTypeUpper === 'ESCAPE_HYPERACTIVE') {
                    const threats = collectEscapeThreats(gameState, ownerVal, entry.row, entry.col);
                    target = pickEscapeTarget(candidatePool, threats);
                }
                if (!target) {
                    const index = Math.floor(p.random() * candidatePool.length);
                    target = candidatePool[index] || candidatePool[0] || null;
                }
                if (!target) break;

                const fromRow = entry.row;
                const fromCol = entry.col;

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
                        { evade: true }
                    );
                    movedRes = !!(res && res.moved);
                } else {
                    setBoardCell(gameState, fromRow, fromCol, EMPTY);
                    setBoardCell(gameState, target.row, target.col, ownerVal);
                    movedRes = true;
                }

                if (movedRes) {
                    moveCoexistingSpecialMarkers(cardState, entry, fromRow, fromCol, target.row, target.col);
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
                    break;
                }

                candidatePool = candidatePool.filter((candidate) => !(candidate.row === target.row && candidate.col === target.col));
            }

            if (movedRes) continue;

            if (markerTypeUpper === 'ESCAPE_HYPERACTIVE') {
                const blastTargets = [{ row: entry.row, col: entry.col }];
                for (let dr = -1; dr <= 1; dr++) {
                    for (let dc = -1; dc <= 1; dc++) {
                        if (dr === 0 && dc === 0) continue;
                        const row = entry.row + dr;
                        const col = entry.col + dc;
                        if (!hasBoardShapeCell(gameState, row, col)) continue;
                        blastTargets.push({ row, col });
                    }
                }

                for (const pos of blastTargets) {
                    let destroyedRes = false;
                    if (deps.BoardOps && typeof deps.BoardOps.destroyAt === 'function') {
                        const res = deps.BoardOps.destroyAt(cardState, gameState, pos.row, pos.col, cause, noCandidateReason, { evade: true });
                        destroyedRes = !!(res && res.destroyed);
                    } else {
                        destroyedRes = !!destroyAt(cardState, gameState, pos.row, pos.col);
                    }
                    if (destroyedRes) {
                        destroyed.push({ row: pos.row, col: pos.col, specialType: markerTypeUpper });
                    }
                }
                removeFlipEvadeMarkerAt(cardState, entry.row, entry.col, deps);
                evadedSet.add(key);
                continue;
            }

            let destroyedRes = false;
            if (deps.BoardOps && typeof deps.BoardOps.destroyAt === 'function') {
                const res = deps.BoardOps.destroyAt(cardState, gameState, entry.row, entry.col, cause, noCandidateReason, { evade: true });
                destroyedRes = !!(res && res.destroyed);
            } else {
                destroyedRes = !!destroyAt(cardState, gameState, entry.row, entry.col);
            }
            if (destroyedRes) {
                destroyed.push({ row: entry.row, col: entry.col, specialType: markerTypeUpper });
                evadedSet.add(key);
            }
        }

        const remainingFlips = [];
        for (const flip of parsedFlips) {
            const key = `${flip.row},${flip.col}`;
            if (evadedSet.has(key)) continue;
            if (getBoardCell(gameState, flip.row, flip.col) !== ownerBeforeVal) continue;
            remainingFlips.push([flip.row, flip.col]);
        }

        const evaded = Array.from(evadedSet).map((key) => {
            const parts = key.split(',');
            return { row: Number(parts[0]), col: Number(parts[1]) };
        });

        return { remainingFlips, moved, destroyed, evaded };
    }

    function applyFlipCellsWithEvasion(cardState, gameState, flipCells, ownerKey, ownerVal, prng, deps = {}, options = {}) {
        const parsedFlips = (Array.isArray(flipCells) ? flipCells : [])
            .map((cell) => normalizeFlipCell(cell))
            .filter((cell) => !!cell);
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
                destroyAt: deps.destroyAt
            }
        );

        const remainingFlips = (Array.isArray(evasionResult && evasionResult.remainingFlips)
            ? evasionResult.remainingFlips
            : [])
            .map((cell) => normalizeFlipCell(cell))
            .filter((cell) => !!cell);
        const flipped = [];

        for (const cell of remainingFlips) {
            let changed = true;
            if (deps.BoardOps && typeof deps.BoardOps.changeAt === 'function') {
                const changeRes = deps.BoardOps.changeAt(cardState, gameState, cell.row, cell.col, ownerKey, options.flipCause, options.flipReason);
                changed = !!(changeRes && changeRes.changed);
            } else {
                setBoardCell(gameState, cell.row, cell.col, ownerVal);
            }
            if (!changed) continue;

            flipped.push(typeof options.buildFlippedDetail === 'function'
                ? options.buildFlippedDetail(cell)
                : { row: cell.row, col: cell.col });
        }

        if (flipped.length > 0) {
            clearSpecialAtPositions(cardState, flipped.map((detail) => ({ row: detail.row, col: detail.col })));
        }

        return {
            flipped,
            moved: Array.isArray(evasionResult && evasionResult.moved) ? evasionResult.moved.slice() : [],
            destroyed: Array.isArray(evasionResult && evasionResult.destroyed) ? evasionResult.destroyed.slice() : []
        };
    }

    function revertTimedSpecialAt(cardState, gameState, row, col, ownerKey, specialType, deps = {}, cause, reason) {
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
        if (!Array.isArray(cardState.markers)) return false;
        const beforeLength = cardState.markers.length;
        cardState.markers = cardState.markers.filter((marker) => !(
            marker &&
            marker.kind === 'specialStone' &&
            marker.row === row &&
            marker.col === col &&
            marker.owner === ownerKey &&
            marker.data &&
            String(marker.data.type || '').toUpperCase() === String(specialType || '').toUpperCase()
        ));
        return cardState.markers.length !== beforeLength;
    }

    function destroyUltimateAnchor(cardState, gameState, entry, deps, destroyAt, reason) {
        const destroyReason = reason || 'no_candidates';
        const isDurationEnd = destroyReason === 'expired' || destroyReason === 'duration_end';
        if (isDurationEnd) {
            const reverted = revertTimedSpecialAt(
                cardState,
                gameState,
                entry.row,
                entry.col,
                entry.owner,
                'ULTIMATE_HYPERACTIVE',
                deps,
                'ULTIMATE_HYPERACTIVE_GOD',
                'duration_end'
            );
            return reverted
                ? [{ row: entry.row, col: entry.col, specialType: 'ULTIMATE_HYPERACTIVE', reason: 'duration_end', reverted: true }]
                : [];
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

    function moveHyperactiveOnce(cardState, gameState, entry, prng, deps = {}) {
        const p = prng || (deps.defaultPrng || { random: () => 0 });
        const destroyAt = deps.destroyAt || ((cs, gs, r, c) => {
            const cell = getBoardCell(gs, r, c);
            if (cell === null || cell === undefined || cell === EMPTY) return false;
            if (cs.markers) cs.markers = cs.markers.filter(m => !(m.row === r && m.col === c));
            setBoardCell(gs, r, c, EMPTY);
            return true;
        });
        const getFlipsWithContext = deps.getFlipsWithContext || (() => []);
        const clearHyperactiveAtPositions = deps.clearHyperactiveAtPositions || ((cs, positions) => {
            if (!cs.markers) return;
            cs.markers = cs.markers.filter(m => !(
                m.kind === 'specialStone' &&
                m.data &&
                (m.data.type === 'HYPERACTIVE' || m.data.type === 'ESCAPE_HYPERACTIVE' || m.data.type === 'INHERITED_HYPERACTIVE' || m.data.type === 'EXTREME_HYPERACTIVE' || m.data.type === 'ROBOT_VACUUM') &&
                positions.some(p => p.row === m.row && p.col === m.col)
            ));
        });
        const clearBombAt = deps.clearBombAt || ((cs, r, c) => { if (cs.markers) cs.markers = cs.markers.filter(m => !(m.kind === 'specialStone' && m.data && m.data.category === 'bomb' && m.row === r && m.col === c)); });
        const isBlockedCell = typeof deps.isBlockedCell === 'function'
            ? deps.isBlockedCell
            : (() => false);

        const moved = [];
        const destroyed = [];
        const flipped = [];
        const repelled = [];

        const ownerKey = entry.owner;
        const ownerVal = ownerKey === 'black' ? (BLACK || 1) : (WHITE || -1);
        const markerType = (entry && entry.data && entry.data.type) ? String(entry.data.type).toUpperCase() : 'HYPERACTIVE';
        const isEscapeHyperactive = markerType === 'ESCAPE_HYPERACTIVE';
        const isInheritedHyperactive = markerType === 'INHERITED_HYPERACTIVE';
        const isExtremeHyperactive = markerType === 'EXTREME_HYPERACTIVE';
        const moveCause = isEscapeHyperactive
            ? 'ESCAPE_HYPERACTIVE'
            : (isInheritedHyperactive
                ? 'HYPERACTIVE_INHERIT_WILL'
                : (isExtremeHyperactive ? 'EXTREME_HYPERACTIVE_WILL' : 'HYPERACTIVE'));
        const moveReason = isEscapeHyperactive
            ? 'escape_hyperactive_move'
            : (isInheritedHyperactive
                ? 'inherited_hyperactive_move'
                : (isExtremeHyperactive ? 'extreme_hyperactive_move' : 'hyperactive_move'));
        const flipReason = isEscapeHyperactive
            ? 'escape_hyperactive_flip'
            : (isInheritedHyperactive
                ? 'inherited_hyperactive_flip'
                : (isExtremeHyperactive ? 'extreme_hyperactive_flip' : 'hyperactive_flip'));
        const noCandidateReason = isEscapeHyperactive
            ? 'escape_no_candidates_explosion'
            : (isInheritedHyperactive
                ? 'inherited_no_candidates'
                : (isExtremeHyperactive ? 'extreme_no_candidates' : 'no_candidates'));

        // Anchor must still be owner's stone
        if (getBoardCell(gameState, entry.row, entry.col) !== ownerVal) {
            // remove the anchor
            clearHyperactiveAtPositions(cardState, [{ row: entry.row, col: entry.col }]);
            return { moved, destroyed, flipped, repelled, ownerKey };
        }

        const candidates = isExtremeHyperactive
            ? getNeighborEmptyCandidates(cardState, gameState, entry.row, entry.col, { isBlockedCell }, { includeOccupied: true })
            : getNeighborEmptyCandidates(cardState, gameState, entry.row, entry.col, { isBlockedCell });
        if (typeof console !== 'undefined' && console.log) console.log('[HYPERACTIVE] moveHyperactiveOnce candidates', candidates.length, 'at', { row: entry.row, col: entry.col, owner: entry.owner });

        if (candidates.length === 0) {
            if (isEscapeHyperactive) {
                const blastTargets = [{ row: entry.row, col: entry.col }];
                for (let dr = -1; dr <= 1; dr++) {
                    for (let dc = -1; dc <= 1; dc++) {
                        if (dr === 0 && dc === 0) continue;
                        const row = entry.row + dr;
                        const col = entry.col + dc;
                        if (!hasBoardShapeCell(gameState, row, col)) continue;
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
                let destroyedRes = false;
                if (deps.BoardOps && typeof deps.BoardOps.destroyAt === 'function') {
                    const res = deps.BoardOps.destroyAt(cardState, gameState, entry.row, entry.col, moveCause, noCandidateReason);
                    destroyedRes = !!(res && res.destroyed);
                } else {
                    destroyedRes = !!destroyAt(cardState, gameState, entry.row, entry.col);
                }
                if (destroyedRes) {
                    destroyed.push({ row: entry.row, col: entry.col, specialType: markerType });
                }
            }
            return { moved, destroyed, flipped, ownerKey };
        }

        let target = null;
        if (isEscapeHyperactive) {
            const threats = collectEscapeThreats(gameState, ownerVal, entry.row, entry.col);
            target = pickEscapeTarget(candidates, threats);
        }

        let usedExtremeSwapFallback = false;
        let swapSource = null;
        if (isExtremeHyperactive) {
            const candidatePool = candidates.slice();
            while (!target && candidatePool.length > 0) {
                const index = Math.floor(p.random() * candidatePool.length);
                const normalizedIndex = Number.isInteger(index) && index >= 0 && index < candidatePool.length ? index : 0;
                const picked = candidatePool[normalizedIndex] || candidatePool[0] || null;
                if (!picked) break;

                const targetVal = getBoardCell(gameState, picked.row, picked.col);
                if (targetVal === EMPTY) {
                    target = picked;
                    break;
                }

                const dr = picked.row - entry.row;
                const dc = picked.col - entry.col;
                const vacateTarget = selectExtremeRepelTarget(cardState, gameState, entry, picked.row, picked.col, dr, dc, isBlockedCell);
                if (!vacateTarget) {
                    const sourceBeforeSwap = { row: entry.row, col: entry.col };
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
                } else {
                    setBoardCell(gameState, picked.row, picked.col, EMPTY);
                    setBoardCell(gameState, vacateTarget.row, vacateTarget.col, targetVal);
                    vacated = true;
                }

                if (!vacated) {
                    candidatePool.splice(normalizedIndex, 1);
                    continue;
                }

                moveCoexistingSpecialMarkers(cardState, entry, picked.row, picked.col, vacateTarget.row, vacateTarget.col);
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
            let destroyedRes = false;
            if (deps.BoardOps && typeof deps.BoardOps.destroyAt === 'function') {
                const res = deps.BoardOps.destroyAt(cardState, gameState, entry.row, entry.col, moveCause, noCandidateReason);
                destroyedRes = !!(res && res.destroyed);
            } else {
                destroyedRes = !!destroyAt(cardState, gameState, entry.row, entry.col);
            }
            if (destroyedRes) {
                destroyed.push({ row: entry.row, col: entry.col, specialType: markerType });
            }
            return { moved, destroyed, flipped, repelled, ownerKey };
        }
        if (typeof console !== 'undefined' && console.log) console.log('[HYPERACTIVE] selected target', { target, candidatesLen: candidates.length, markerType });

        let flipCells = [];
        if (!isExtremeHyperactive) {
            flipCells = getFlipsWithContext(gameState, target.row, target.col, ownerVal, deps.getCardContext ? deps.getCardContext(cardState) : {});
        }

        const sourceRow = usedExtremeSwapFallback && swapSource ? swapSource.row : entry.row;
        const sourceCol = usedExtremeSwapFallback && swapSource ? swapSource.col : entry.col;

        let moveSucceeded = usedExtremeSwapFallback;
        if (!usedExtremeSwapFallback) {
            if (deps.BoardOps && typeof deps.BoardOps.moveAt === 'function') {
                const moveResult = deps.BoardOps.moveAt(
                    cardState,
                    gameState,
                    sourceRow,
                    sourceCol,
                    target.row,
                    target.col,
                    moveCause,
                    moveReason
                );
                moveSucceeded = !!(moveResult && moveResult.moved);
            } else {
                setBoardCell(gameState, sourceRow, sourceCol, EMPTY);
                setBoardCell(gameState, target.row, target.col, ownerVal);
                moveSucceeded = true;
            }
            if (!moveSucceeded) {
                return { moved, destroyed, flipped, repelled, ownerKey };
            }
            moveCoexistingSpecialMarkers(cardState, entry, sourceRow, sourceCol, target.row, target.col);
            entry.row = target.row;
            entry.col = target.col;
        }
        moved.push({ from: { row: sourceRow, col: sourceCol }, to: { row: target.row, col: target.col }, specialType: markerType });

        if (isExtremeHyperactive) {
            const repelResults = applyExtremeHyperactiveRepel(cardState, gameState, entry, deps);
            if (repelResults && repelResults.length) repelled.push(...repelResults);

            const targetCell = getBoardCell(gameState, target.row, target.col);
            if (targetCell === ownerVal) {
                setBoardCell(gameState, target.row, target.col, EMPTY);
                try {
                    flipCells = getFlipsWithContext(gameState, target.row, target.col, ownerVal, deps.getCardContext ? deps.getCardContext(cardState) : {});
                } finally {
                    setBoardCell(gameState, target.row, target.col, ownerVal);
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
                    buildFlippedDetail: (cell) => ({ row: cell.row, col: cell.col, specialType: markerType })
                }
            );
            if (flipResult.moved.length) moved.push(...flipResult.moved);
            if (flipResult.destroyed.length) destroyed.push(...flipResult.destroyed);
            if (flipResult.flipped.length) flipped.push(...flipResult.flipped);
        }

        return { moved, destroyed, flipped, repelled, ownerKey };
    }

    function applyInheritedHyperactiveCountdown(cardState, gameState, entry, deps = {}) {
        if (!entry || !entry.data || String(entry.data.type).toUpperCase() !== 'INHERITED_HYPERACTIVE') {
            return { destroyed: [] };
        }

        const ownerKey = entry.owner;
        const currentTurnPlayerKey = (typeof deps.currentTurnPlayerKey === 'string' && deps.currentTurnPlayerKey)
            ? deps.currentTurnPlayerKey
            : ownerKey;
        if (currentTurnPlayerKey !== ownerKey || deps.decrementRemainingOwnerTurns === false) {
            return { destroyed: [] };
        }

        const defaultRemainingTurns = Number.isInteger(deps.inheritedHyperactiveTurns)
            ? deps.inheritedHyperactiveTurns
            : 10;
        const before = Number.isFinite(Number(entry.data.remainingOwnerTurns))
            ? Number(entry.data.remainingOwnerTurns)
            : defaultRemainingTurns;
        const afterDec = Math.max(0, before - 1);
        entry.data.remainingOwnerTurns = afterDec;

        if (afterDec > 0) return { destroyed: [] };

        const reverted = revertTimedSpecialAt(
            cardState,
            gameState,
            entry.row,
            entry.col,
            ownerKey,
            'INHERITED_HYPERACTIVE',
            deps,
            'HYPERACTIVE_INHERIT_WILL',
            'duration_end'
        );
        return reverted
            ? { destroyed: [{ row: entry.row, col: entry.col, specialType: 'INHERITED_HYPERACTIVE', reason: 'duration_end', reverted: true }] }
            : { destroyed: [] };
    }

    function processHyperactiveMoves(cardState, gameState, prng, deps = {}) {
        const moved = [];
        const destroyed = [];
        const flipped = [];
        const flippedByOwner = { black: [], white: [] };

        const entries = (cardState.markers || [])
            .filter(s => (
                s.kind === 'specialStone' &&
                s.data &&
                (s.data.type === 'HYPERACTIVE' || s.data.type === 'ESCAPE_HYPERACTIVE' || s.data.type === 'INHERITED_HYPERACTIVE' || s.data.type === 'EXTREME_HYPERACTIVE')
            ))
            .slice()
            .sort((a, b) => (a.createdSeq || 0) - (b.createdSeq || 0));

        const repelled = [];

        for (const entry of entries) {
            if (!(cardState.markers || []).includes(entry)) continue;
            const res = moveHyperactiveOnce(cardState, gameState, entry, prng, deps);
            moved.push(...res.moved);
            destroyed.push(...res.destroyed);
            flipped.push(...res.flipped);
            if (res.repelled && res.repelled.length) repelled.push(...res.repelled);
            const markerStillExists = Array.isArray(cardState.markers) && cardState.markers.includes(entry);
            if (markerStillExists) {
                const tickRes = applyInheritedHyperactiveCountdown(cardState, gameState, entry, deps);
                if (tickRes && Array.isArray(tickRes.destroyed) && tickRes.destroyed.length) {
                    destroyed.push(...tickRes.destroyed);
                }
            }
            if (res.flipped.length > 0 && res.ownerKey && flippedByOwner[res.ownerKey]) {
                flippedByOwner[res.ownerKey].push(...res.flipped);
            }
        }

        return { moved, destroyed, flipped, repelled, flippedByOwner };
    }

    function processHyperactiveMoveAtAnchor(cardState, gameState, playerKey, row, col, prng, deps = {}) {
        const expectedSpecialType = String(deps && deps.expectedSpecialType ? deps.expectedSpecialType : '').toUpperCase();
        const entry = (cardState.markers || []).find(s => (
            s.kind === 'specialStone' &&
            s.data &&
            (expectedSpecialType
                ? (String(s.data.type || '').toUpperCase() === expectedSpecialType)
                : (s.data.type === 'HYPERACTIVE' || s.data.type === 'ESCAPE_HYPERACTIVE' || s.data.type === 'INHERITED_HYPERACTIVE' || s.data.type === 'EXTREME_HYPERACTIVE')) &&
            s.owner === playerKey &&
            s.row === row &&
            s.col === col
        ));
        if (!entry) return { moved: [], destroyed: [], flipped: [], repelled: [] };
        const res = moveHyperactiveOnce(cardState, gameState, entry, prng, deps);
        const destroyed = Array.isArray(res.destroyed) ? res.destroyed.slice() : [];
        const markerStillExists = Array.isArray(cardState.markers) && cardState.markers.includes(entry);
        if (markerStillExists) {
            const tickRes = applyInheritedHyperactiveCountdown(cardState, gameState, entry, deps);
            if (tickRes && Array.isArray(tickRes.destroyed) && tickRes.destroyed.length) {
                destroyed.push(...tickRes.destroyed);
            }
        }
        return {
            moved: Array.isArray(res.moved) ? res.moved : [],
            destroyed,
            flipped: Array.isArray(res.flipped) ? res.flipped : [],
            repelled: Array.isArray(res.repelled) ? res.repelled : [],
            ownerKey: res.ownerKey || playerKey
        };
    }

    function processInstantHyperactiveMoveAtAnchor(cardState, gameState, playerKey, row, col, prng, deps = {}) {
        const entry = (cardState.markers || []).find(s =>
            s &&
            s.kind === 'specialStone' &&
            s.data &&
            s.data.type === 'HYPERACTIVE' &&
            s.owner === playerKey &&
            s.row === row &&
            s.col === col
        );
        if (!entry) return { moved: [], destroyed: [], flipped: [], ownerKey: playerKey };

        const moved = [];
        const destroyed = [];
        const flipped = [];

        for (let step = 1; step <= 3; step++) {
            if (!(cardState.markers || []).includes(entry)) break;
            const res = moveHyperactiveOnce(cardState, gameState, entry, prng, deps);
            if (res.moved && res.moved.length) moved.push(...res.moved.map(m => ({ ...m, step })));
            if (res.flipped && res.flipped.length) flipped.push(...res.flipped);
            if (res.destroyed && res.destroyed.length) {
                destroyed.push(...res.destroyed);
                break;
            }
        }

        if (destroyed.length === 0) {
            let expired = false;
            if (deps.BoardOps && typeof deps.BoardOps.destroyAt === 'function') {
                const res = deps.BoardOps.destroyAt(cardState, gameState, entry.row, entry.col, 'HYPERACTIVE', 'instant_hyperactive_expired', { instant: true });
                expired = !!(res && res.destroyed);
            } else if (typeof deps.destroyAt === 'function') {
                expired = !!deps.destroyAt(cardState, gameState, entry.row, entry.col);
            }
            if (expired) {
                destroyed.push({ row: entry.row, col: entry.col });
            }
        }

        return { moved, destroyed, flipped, ownerKey: playerKey };
    }

    function processUltimateHyperactiveMoveAtAnchor(cardState, gameState, playerKey, row, col, prng, deps = {}) {
        const p = prng || (deps.defaultPrng || { random: () => 0 });
        const entry = (cardState.markers || []).find(s =>
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

        const ownerKey = entry.owner;
        const ownerVal = ownerKey === 'black' ? (BLACK || 1) : (WHITE || -1);
        const currentTurnPlayerKey = (typeof deps.currentTurnPlayerKey === 'string' && deps.currentTurnPlayerKey)
            ? deps.currentTurnPlayerKey
            : ownerKey;
        const shouldDecrementRemaining = currentTurnPlayerKey === ownerKey && deps.decrementRemainingOwnerTurns !== false;
        const defaultRemainingTurns = Number.isInteger(deps.ultimateHyperactiveTurns) ? deps.ultimateHyperactiveTurns : 10;
        const maxMoveDistance = Number.isInteger(deps.ultimateHyperactiveMaxDistance) && deps.ultimateHyperactiveMaxDistance > 0
            ? deps.ultimateHyperactiveMaxDistance
            : 5;
        const clearUltimateAtPositions = deps.clearUltimateAtPositions || clearUltimateHyperactiveAtPositions;
        const clearHyperactiveAtPositions = typeof deps.clearHyperactiveAtPositions === 'function'
            ? deps.clearHyperactiveAtPositions
            : (() => {});
        const getFlipsWithContext = deps.getFlipsWithContext || (() => []);
        const destroyAt = deps.destroyAt || ((cs, gs, r, c) => {
            const cell = getBoardCell(gs, r, c);
            if (cell === null || cell === undefined || cell === EMPTY) return false;
            if (cs.markers) cs.markers = cs.markers.filter(m => !(m.row === r && m.col === c));
            setBoardCell(gs, r, c, EMPTY);
            return true;
        });

        const moved = [];
        const destroyed = [];
        const flipped = [];

        // Anchor is removed if the board owner no longer matches marker owner.
        if (getBoardCell(gameState, entry.row, entry.col) !== ownerVal) {
            clearUltimateAtPositions(cardState, [{ row: entry.row, col: entry.col }]);
            return { moved, destroyed, flipped, ownerKey };
        }

        for (let step = 1; step <= 2; step++) {
            const candidates = getStraightLineEmptyCandidates(cardState, gameState, entry.row, entry.col, deps, {
                maxDistance: maxMoveDistance,
                allowJumpOverStones: true
            });
            if (!candidates.length) {
                destroyed.push(...destroyUltimateAnchor(cardState, gameState, entry, deps, destroyAt, 'no_candidates'));
                break;
            }

            const target = candidates[Math.floor(p.random() * candidates.length)];
            const sourceRow = entry.row;
            const sourceCol = entry.col;
            const from = { row: sourceRow, col: sourceCol };
            const flipCells = getFlipsWithContext(
                gameState,
                target.row,
                target.col,
                ownerVal,
                deps.getCardContext ? deps.getCardContext(cardState) : {}
            );
            let movedRes = false;
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
                    { step }
                );
                movedRes = !!(res && res.moved);
            } else {
                setBoardCell(gameState, sourceRow, sourceCol, EMPTY);
                setBoardCell(gameState, target.row, target.col, ownerVal);
                movedRes = true;
            }

            if (!movedRes) break;
            moveCoexistingSpecialMarkers(cardState, entry, sourceRow, sourceCol, target.row, target.col);
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

        const markerStillExists = Array.isArray(cardState.markers) && cardState.markers.includes(entry);
        if (shouldDecrementRemaining && markerStillExists) {
            const before = (entry.data && Number.isFinite(entry.data.remainingOwnerTurns))
                ? entry.data.remainingOwnerTurns
                : defaultRemainingTurns;
            const afterDec = Math.max(0, before - 1);
            if (entry.data) entry.data.remainingOwnerTurns = afterDec;
            if (afterDec <= 0) {
                destroyed.push(...destroyUltimateAnchor(cardState, gameState, entry, deps, destroyAt, 'expired'));
            }
        }

        return { moved, destroyed, flipped, ownerKey };
    }

    function collectRobotVacuumTargets(gameState, ownerVal, originRow, originCol) {
        const enemyVal = ownerVal === (BLACK || 1) ? (WHITE || -1) : (BLACK || 1);
        const targets = [];
        for (let dr = -1; dr <= 1; dr++) {
            for (let dc = -1; dc <= 1; dc++) {
                if (dr === 0 && dc === 0) continue;
                const row = originRow + dr;
                const col = originCol + dc;
                if (!hasBoardShapeCell(gameState, row, col)) continue;
                if (getBoardCell(gameState, row, col) !== enemyVal) continue;
                targets.push({ row, col });
            }
        }
        return targets;
    }

    function moveRobotVacuumOnce(cardState, gameState, entry, prng, deps = {}) {
        const p = prng || (deps.defaultPrng || { random: () => 0 });
        const destroyAt = deps.destroyAt || ((cs, gs, r, c) => {
            const cell = getBoardCell(gs, r, c);
            if (cell === null || cell === undefined || cell === EMPTY) return false;
            if (cs.markers) cs.markers = cs.markers.filter(m => !(m.row === r && m.col === c));
            setBoardCell(gs, r, c, EMPTY);
            return true;
        });
        const clearHyperactiveAtPositions = deps.clearHyperactiveAtPositions || ((cs, positions) => {
            if (!cs.markers) return;
            cs.markers = cs.markers.filter(m => !(
                m.kind === 'specialStone' &&
                m.data &&
                (m.data.type === 'HYPERACTIVE' || m.data.type === 'ESCAPE_HYPERACTIVE' || m.data.type === 'INHERITED_HYPERACTIVE' || m.data.type === 'EXTREME_HYPERACTIVE' || m.data.type === 'ROBOT_VACUUM') &&
                positions.some(p => p.row === m.row && p.col === m.col)
            ));
        });
        const isBlockedCell = typeof deps.isBlockedCell === 'function'
            ? deps.isBlockedCell
            : (() => false);

        const moved = [];
        const destroyed = [];
        const flipped = [];

        const ownerKey = entry.owner;
        const ownerVal = ownerKey === 'black' ? (BLACK || 1) : (WHITE || -1);

        if (getBoardCell(gameState, entry.row, entry.col) !== ownerVal) {
            clearHyperactiveAtPositions(cardState, [{ row: entry.row, col: entry.col }]);
            return { moved, destroyed, flipped, ownerKey };
        }

        const candidates = getNeighborEmptyCandidates(cardState, gameState, entry.row, entry.col, { isBlockedCell });
        if (!candidates.length) {
            let destroyedRes = false;
            if (deps.BoardOps && typeof deps.BoardOps.destroyAt === 'function') {
                const res = deps.BoardOps.destroyAt(cardState, gameState, entry.row, entry.col, 'ROBOT_VACUUM', 'robot_vacuum_no_candidates', {
                    sourceRow: entry.row,
                    sourceCol: entry.col,
                    projectileOwner: ownerKey,
                    projectileStone: 'robot_vacuum'
                });
                destroyedRes = !!(res && res.destroyed);
            } else {
                destroyedRes = !!destroyAt(cardState, gameState, entry.row, entry.col);
            }
            if (destroyedRes) destroyed.push({ row: entry.row, col: entry.col });
            return { moved, destroyed, flipped, ownerKey };
        }

        const enemies = collectRobotVacuumEnemies(gameState, ownerVal, entry.row, entry.col);
        const target = pickRobotVacuumApproachTarget(candidates, enemies, p);
        if (!target) return { moved, destroyed, flipped, ownerKey };
        const from = { row: entry.row, col: entry.col };

        let movedRes = false;
        if (deps.BoardOps && typeof deps.BoardOps.moveAt === 'function') {
            const res = deps.BoardOps.moveAt(
                cardState,
                gameState,
                entry.row,
                entry.col,
                target.row,
                target.col,
                'ROBOT_VACUUM',
                'robot_vacuum_move'
            );
            movedRes = !!(res && res.moved);
        } else {
            setBoardCell(gameState, entry.row, entry.col, EMPTY);
            setBoardCell(gameState, target.row, target.col, ownerVal);
            movedRes = true;
        }

        if (!movedRes) return { moved, destroyed, flipped, ownerKey };

        moveCoexistingSpecialMarkers(cardState, entry, from.row, from.col, target.row, target.col);
        entry.row = target.row;
        entry.col = target.col;
        moved.push({ from, to: { row: target.row, col: target.col }, specialType: 'ROBOT_VACUUM' });

        return { moved, destroyed, flipped, ownerKey };
    }

    function _destroyGluttonousTarget(cardState, gameState, ownerKey, sourceRow, sourceCol, targetRow, targetCol, deps = {}) {
        const destroyMeta = {
            sourceRow,
            sourceCol,
            projectileOwner: ownerKey,
            projectileStone: 'gluttonous',
            bite: true
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

        const guarded = (cardState.markers || []).some((m) => (
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

    function processGluttonousMoveAtAnchor(cardState, gameState, playerKey, row, col, prng, deps = {}) {
        const entry = (cardState.markers || []).find(s => (
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

        const p = (prng && typeof prng.random === 'function')
            ? prng
            : ((deps.defaultPrng && typeof deps.defaultPrng.random === 'function') ? deps.defaultPrng : { random: () => 0 });
        const clearHyperactiveAtPositions = deps.clearHyperactiveAtPositions || ((cs, positions) => {
            if (!cs.markers) return;
            cs.markers = cs.markers.filter(m => !(
                m.kind === 'specialStone' &&
                m.data &&
                (m.data.type === 'HYPERACTIVE' ||
                    m.data.type === 'ESCAPE_HYPERACTIVE' ||
                    m.data.type === 'INHERITED_HYPERACTIVE' ||
                    m.data.type === 'EXTREME_HYPERACTIVE' ||
                    m.data.type === 'ROBOT_VACUUM' ||
                    m.data.type === 'GLUTTONOUS') &&
                positions.some(pos => pos.row === m.row && pos.col === m.col)
            ));
        });
        const isBlockedCell = typeof deps.isBlockedCell === 'function'
            ? deps.isBlockedCell
            : (() => false);

        const moved = [];
        const destroyed = [];
        const flipped = [];
        const ate = [];

        const ownerKey = entry.owner;
        const ownerVal = ownerKey === 'black' ? (BLACK || 1) : (WHITE || -1);
        const rawMissStreak = Number(entry && entry.data ? entry.data.gluttonousMissStreak : 0);
        const missStreak = Number.isFinite(rawMissStreak) ? Math.max(0, Math.trunc(rawMissStreak)) : 0;

        if (getBoardCell(gameState, entry.row, entry.col) !== ownerVal) {
            clearHyperactiveAtPositions(cardState, [{ row: entry.row, col: entry.col }]);
            return { moved, destroyed, flipped, ownerKey, ate };
        }

        const adjacentEnemies = collectRobotVacuumTargets(gameState, ownerVal, entry.row, entry.col).slice();
        while (adjacentEnemies.length > 0) {
            const pickIndex = Math.floor(p.random() * adjacentEnemies.length);
            const index = Number.isInteger(pickIndex) && pickIndex >= 0 && pickIndex < adjacentEnemies.length ? pickIndex : 0;
            const target = adjacentEnemies.splice(index, 1)[0];
            if (!target) continue;

            const from = { row: entry.row, col: entry.col };
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
            if (!destroyResult || (!destroyResult.destroyed && !destroyResult.proliferated)) continue;

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
                return { moved, destroyed, flipped, ownerKey, ate };
            }

            let movedRes = false;
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
                    {
                        sourceRow: from.row,
                        sourceCol: from.col,
                        ate: true
                    }
                );
                movedRes = !!(res && res.moved);
            } else {
                setBoardCell(gameState, from.row, from.col, EMPTY);
                setBoardCell(gameState, target.row, target.col, ownerVal);
                movedRes = true;
            }

            if (!movedRes) {
                const eatDetail = { row: target.row, col: target.col, sourceRow: from.row, sourceCol: from.col };
                ate.push(eatDetail);
                destroyed.push({ ...eatDetail, specialType: 'GLUTTONOUS' });
                if (entry.data && typeof entry.data === 'object') {
                    entry.data.gluttonousMissStreak = 0;
                }
                return { moved, destroyed, flipped, ownerKey, ate };
            }

            moveCoexistingSpecialMarkers(cardState, entry, from.row, from.col, target.row, target.col);
            entry.row = target.row;
            entry.col = target.col;
            moved.push({ from, to: { row: target.row, col: target.col }, specialType: 'GLUTTONOUS' });
            const eatDetail = { row: target.row, col: target.col, sourceRow: from.row, sourceCol: from.col };
            ate.push(eatDetail);
            destroyed.push({ ...eatDetail, specialType: 'GLUTTONOUS' });
            if (entry.data && typeof entry.data === 'object') {
                entry.data.gluttonousMissStreak = 0;
            }

            return { moved, destroyed, flipped, ownerKey, ate };
        }

        const from = { row: entry.row, col: entry.col };
        let movedTo = null;
        const moveCandidates = getNeighborEmptyCandidates(cardState, gameState, entry.row, entry.col, { isBlockedCell });
        if (moveCandidates.length > 0) {
            const enemies = collectRobotVacuumEnemies(gameState, ownerVal, entry.row, entry.col);
            const target = pickRobotVacuumApproachTarget(moveCandidates, enemies, p);
            if (target) {
                let movedRes = false;
                if (deps.BoardOps && typeof deps.BoardOps.moveAt === 'function') {
                    const res = deps.BoardOps.moveAt(
                        cardState,
                        gameState,
                        entry.row,
                        entry.col,
                        target.row,
                        target.col,
                        'GLUTTONOUS_WILL',
                        'gluttonous_starve_move'
                    );
                    movedRes = !!(res && res.moved);
                } else {
                    setBoardCell(gameState, entry.row, entry.col, EMPTY);
                    setBoardCell(gameState, target.row, target.col, ownerVal);
                    movedRes = true;
                }

                if (movedRes) {
                    moveCoexistingSpecialMarkers(cardState, entry, entry.row, entry.col, target.row, target.col);
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

    function processRobotVacuumMoveAtAnchor(cardState, gameState, playerKey, row, col, prng, deps = {}) {
        const entry = (cardState.markers || []).find(s => (
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

        const ownerKey = entry.owner;
        const ownerVal = ownerKey === 'black' ? (BLACK || 1) : (WHITE || -1);
        const randomSource = (prng && typeof prng.random === 'function')
            ? prng
            : ((deps.defaultPrng && typeof deps.defaultPrng.random === 'function') ? deps.defaultPrng : { random: () => 0 });
        const currentTurnPlayerKey = (typeof deps.currentTurnPlayerKey === 'string' && deps.currentTurnPlayerKey)
            ? deps.currentTurnPlayerKey
            : playerKey;
        const defaultRemainingTurns = Number.isInteger(deps.robotVacuumTurns) ? deps.robotVacuumTurns : 5;

        const moveRes = moveRobotVacuumOnce(cardState, gameState, entry, prng, deps);
        const moved = Array.isArray(moveRes.moved) ? moveRes.moved.slice() : [];
        const destroyed = Array.isArray(moveRes.destroyed) ? moveRes.destroyed.slice() : [];
        const flipped = Array.isArray(moveRes.flipped) ? moveRes.flipped.slice() : [];
        const sucked = [];
        const expired = [];

        const markerStillExists = Array.isArray(cardState.markers) && cardState.markers.includes(entry);
        const anchorStillOwned = markerStillExists && getBoardCell(gameState, entry.row, entry.col) === ownerVal;

        if (anchorStillOwned) {
            const targets = collectRobotVacuumTargets(gameState, ownerVal, entry.row, entry.col).slice();
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
                    const guarded = (cardState.markers || []).some((m) => (
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

        const markerAfterSuction = Array.isArray(cardState.markers) && cardState.markers.includes(entry);
        if (markerAfterSuction && entry.data && sucked.length > 0) {
            const beforeExtend = Number.isFinite(Number(entry.data.remainingOwnerTurns))
                ? Number(entry.data.remainingOwnerTurns)
                : defaultRemainingTurns;
            entry.data.remainingOwnerTurns = beforeExtend + sucked.length;
        }
        if (markerAfterSuction && currentTurnPlayerKey === ownerKey) {
            const before = (entry.data && Number.isFinite(Number(entry.data.remainingOwnerTurns)))
                ? Number(entry.data.remainingOwnerTurns)
                : defaultRemainingTurns;
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
    }

    function applyHyperactiveInheritWill(cardState, gameState, playerKey, row, col, deps = {}) {
        const readCardPendingEffect = typeof deps.readCardPendingEffect === 'function'
            ? deps.readCardPendingEffect
            : null;
        const clearCardPendingEffect = typeof deps.clearCardPendingEffect === 'function'
            ? deps.clearCardPendingEffect
            : null;
        const getHyperactiveInheritTargets = typeof deps.getHyperactiveInheritTargets === 'function'
            ? deps.getHyperactiveInheritTargets
            : null;
        const removeMarkersAt = typeof deps.removeMarkersAt === 'function'
            ? deps.removeMarkersAt
            : null;
        const addMarker = typeof deps.addMarker === 'function'
            ? deps.addMarker
            : null;
        const markerKinds = (deps.MARKER_KINDS && typeof deps.MARKER_KINDS === 'object')
            ? deps.MARKER_KINDS
            : null;
        const inheritedTurns = Number.isFinite(Number(deps.inheritedHyperactiveTurns))
            ? Math.max(1, Math.trunc(Number(deps.inheritedHyperactiveTurns)))
            : 10;

        if (
            !readCardPendingEffect
            || !clearCardPendingEffect
            || !getHyperactiveInheritTargets
            || !removeMarkersAt
            || !addMarker
        ) {
            return { applied: false, reason: 'dependencies_unavailable' };
        }

        const pending = readCardPendingEffect(cardState, playerKey);
        if (!pending || pending.type !== 'HYPERACTIVE_INHERIT_WILL' || pending.stage !== 'selectTarget') {
            return { applied: false, reason: 'not_pending' };
        }

        const targets = getHyperactiveInheritTargets(cardState, gameState, playerKey);
        const allowed = Array.isArray(targets) && targets.some((target) => (
            target &&
            target.row === row &&
            target.col === col
        ));
        if (!allowed) return { applied: false, reason: 'invalid_target' };

        removeMarkersAt(cardState, row, col, {
            kind: markerKinds ? markerKinds.SPECIAL_STONE : 'specialStone',
            type: 'INHERITED_HYPERACTIVE',
            owner: playerKey
        });

        cardState.hyperactiveSeqCounter = (cardState.hyperactiveSeqCounter || 0) + 1;
        addMarker(cardState, 'specialStone', row, col, playerKey, {
            type: 'INHERITED_HYPERACTIVE',
            remainingOwnerTurns: inheritedTurns,
            flipEvadeRemaining: 1,
            destroyEvadeRemaining: 1,
            hyperactiveSeq: cardState.hyperactiveSeqCounter
        });

        clearCardPendingEffect(cardState, playerKey);
        return { applied: true, row, col, remainingOwnerTurns: inheritedTurns };
    }

    return {
        applyHyperactiveInheritWill,
        moveHyperactiveOnce,
        resolveHyperactiveFlipEvasion,
        processHyperactiveMoves,
        processHyperactiveMoveAtAnchor,
        processInstantHyperactiveMoveAtAnchor,
        processUltimateHyperactiveMoveAtAnchor,
        processGluttonousMoveAtAnchor,
        processRobotVacuumMoveAtAnchor
    };
}));
