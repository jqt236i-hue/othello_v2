(function (root, factory) {
    if (typeof module === 'object' && module.exports) {
        let CardUtilsModule = null;
        let BoardOpsModule = null;
        try {
            CardUtilsModule = require('./utils');
        } catch (e) { /* ignore */ }
        try {
            BoardOpsModule = require('../board_ops');
        } catch (e) { /* ignore */ }
        module.exports = factory(require('../../../shared-constants'), CardUtilsModule, BoardOpsModule);
    } else {
        root.CardWillHunterKing = factory(root.SharedConstants, root.CardUtils || null, root.BoardOps || null);
    }
}(typeof self !== 'undefined' ? self : this, function (SharedConstants, CardUtilsModule, BoardOpsModule) {
    'use strict';

    const { BLACK, WHITE, EMPTY } = SharedConstants || {};

    if (BLACK === undefined || WHITE === undefined || EMPTY === undefined) {
        throw new Error('SharedConstants missing required values');
    }

    function normalizeExpansionOwner(owner) {
        return (owner === BLACK || owner === WHITE) ? owner : EMPTY;
    }

    function getExpansionCells(gameState) {
        if (BoardOpsModule && typeof BoardOpsModule.getExpansionDescriptors === 'function') {
            return BoardOpsModule.getExpansionDescriptors(gameState);
        }
        const expansion = (gameState && gameState.boardExpansion && typeof gameState.boardExpansion === 'object')
            ? gameState.boardExpansion
            : null;
        if (!expansion) return [];

        const cells = [];
        const pushCell = (cell) => {
            if (!cell || typeof cell !== 'object') return;
            const row = Number.isInteger(cell.row) ? cell.row : null;
            let col = Number.isInteger(cell.col) ? cell.col : null;
            if (col === null && cell.side === 'left') col = -1;
            if (col === null && cell.side === 'right') col = 8;
            if (!Number.isInteger(row) || !Number.isInteger(col)) return;
            if (cells.some((one) => one.row === row && one.col === col)) return;
            cells.push({
                row,
                col,
                owner: normalizeExpansionOwner(cell.owner)
            });
        };

        if (Array.isArray(expansion.cells)) {
            for (const cell of expansion.cells) pushCell(cell);
        } else if (expansion.active === true) {
            pushCell(expansion);
        }

        return cells;
    }

    function getCellValue(gameState, row, col) {
        if (BoardOpsModule && typeof BoardOpsModule.getCellValue === 'function') {
            return BoardOpsModule.getCellValue(gameState, row, col);
        }
        if (row >= 0 && row < 8 && col >= 0 && col < 8) return gameState.board[row][col];
        const expansionCells = getExpansionCells(gameState);
        for (const cell of expansionCells) {
            if (!cell) continue;
            if (cell.row === row && cell.col === col) return cell.owner;
        }
        return null;
    }

    function resolveRandomSource(randomLike) {
        if (typeof randomLike === 'function') return { random: randomLike };
        if (randomLike && typeof randomLike.random === 'function') return randomLike;
        return { random: Math.random };
    }

    function hasVisibleNonNormalStoneAt(cardState, row, col) {
        if (!CardUtilsModule) return false;
        if (typeof CardUtilsModule.isNonNormalStoneVisualAt === 'function') {
            return CardUtilsModule.isNonNormalStoneVisualAt(cardState, row, col);
        }
        if (typeof CardUtilsModule.isSpecialStoneAt === 'function') {
            return CardUtilsModule.isSpecialStoneAt(cardState, row, col);
        }
        return false;
    }

    function collectEnemyTargets(cardState, gameState, enemyValue) {
        const specialTargets = [];
        const normalTargets = [];
        for (let row = 0; row < 8; row++) {
            for (let col = 0; col < 8; col++) {
                if (gameState.board[row][col] !== enemyValue) continue;
                const target = { row, col };
                if (hasVisibleNonNormalStoneAt(cardState, row, col)) specialTargets.push(target);
                else normalTargets.push(target);
            }
        }

        const expansionCells = getExpansionCells(gameState);
        for (const cell of expansionCells) {
            if (!cell || cell.owner !== enemyValue) continue;
            const target = { row: cell.row, col: cell.col };
            if (hasVisibleNonNormalStoneAt(cardState, cell.row, cell.col)) specialTargets.push(target);
            else normalTargets.push(target);
        }

        return specialTargets.length > 0 ? specialTargets : normalTargets;
    }

    function pickRandomTarget(targets, randomSource) {
        if (!Array.isArray(targets) || targets.length === 0) return null;
        const raw = Number(randomSource.random());
        const normalized = Number.isFinite(raw) ? Math.max(0, Math.min(0.999999, raw)) : 0;
        const index = Math.floor(normalized * targets.length);
        return targets[Math.max(0, Math.min(targets.length - 1, index))] || targets[0] || null;
    }

    function findAnchorMarker(cardState, playerKey, row, col) {
        const markers = (cardState && Array.isArray(cardState.markers)) ? cardState.markers : [];
        return markers.find((marker) => (
            marker &&
            marker.kind === 'specialStone' &&
            marker.owner === playerKey &&
            marker.row === row &&
            marker.col === col &&
            marker.data &&
            String(marker.data.type || '').toUpperCase() === 'WILL_HUNTER_KING'
        )) || null;
    }

    function moveCoexistingMarkers(cardState, fromRow, fromCol, toRow, toCol) {
        if (!cardState || !Array.isArray(cardState.markers)) return;
        for (const marker of cardState.markers) {
            if (!marker || marker.row !== fromRow || marker.col !== fromCol) continue;
            const typeUpper = String(marker && marker.data && marker.data.type ? marker.data.type : '').toUpperCase();
            if (typeUpper === 'BLOCKADE' || typeUpper === 'METEOR_HOLE') continue;
            marker.row = toRow;
            marker.col = toCol;
        }
    }

    function removeAnchorMarker(cardState, playerKey, row, col) {
        if (!cardState || !Array.isArray(cardState.markers)) return;
        cardState.markers = cardState.markers.filter((marker) => !(
            marker &&
            marker.kind === 'specialStone' &&
            marker.owner === playerKey &&
            marker.row === row &&
            marker.col === col &&
            marker.data &&
            String(marker.data.type || '').toUpperCase() === 'WILL_HUNTER_KING'
        ));
    }

    function processWillHunterKingEffectsAtTurnStartAnchor(cardState, gameState, playerKey, row, col, deps) {
        const options = deps || {};
        const randomSource = resolveRandomSource(options.random);
        const boardOps = options.BoardOps || null;
        const result = {
            moved: [],
            destroyed: [],
            proliferated: [],
            expired: []
        };

        const anchor = findAnchorMarker(cardState, playerKey, row, col);
        if (!anchor) return result;

        const ownerValue = playerKey === 'black' ? BLACK : WHITE;
        const enemyValue = -ownerValue;
        if (getCellValue(gameState, row, col) !== ownerValue) {
            removeAnchorMarker(cardState, playerKey, row, col);
            result.expired.push({ row, col, owner: playerKey, reason: 'anchor_lost' });
            return result;
        }

        const beforeTurns = Number.isFinite(Number(anchor.data && anchor.data.remainingOwnerTurns))
            ? Math.max(0, Math.trunc(Number(anchor.data.remainingOwnerTurns)))
            : 8;
        const shouldDecrement = options.decrementRemainingOwnerTurns !== false;
        const afterTurns = shouldDecrement ? Math.max(0, beforeTurns - 1) : beforeTurns;
        if (anchor.data) anchor.data.remainingOwnerTurns = afterTurns;

        const targets = collectEnemyTargets(cardState, gameState, enemyValue);
        const target = pickRandomTarget(targets, randomSource);
        if (target) {
            const destroyMeta = {
                sourceRow: row,
                sourceCol: col,
                projectileOwner: playerKey,
                projectileStone: 'will_hunter_king'
            };
            const destroyResult = boardOps && typeof boardOps.destroyAt === 'function'
                ? boardOps.destroyAt(cardState, gameState, target.row, target.col, 'WILL_HUNTER_KING', 'will_hunter_king_slash', destroyMeta)
                : { destroyed: false };
            if (destroyResult && destroyResult.destroyed) {
                result.destroyed.push({
                    row: target.row,
                    col: target.col,
                    sourceRow: row,
                    sourceCol: col
                });
            } else if (destroyResult && destroyResult.proliferated) {
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
                const moveResult = boardOps.moveAt(
                    cardState,
                    gameState,
                    row,
                    col,
                    target.row,
                    target.col,
                    'WILL_HUNTER_KING',
                    'will_hunter_king_slash_move',
                    moveMeta
                );
                if (moveResult && moveResult.moved) {
                    moveCoexistingMarkers(cardState, row, col, target.row, target.col);
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
                ? boardOps.revertSpecialStoneAt(
                    cardState,
                    gameState,
                    row,
                    col,
                    'WILL_HUNTER_KING',
                    playerKey,
                    'WILL_HUNTER_KING',
                    'anchor_expired'
                )
                : { reverted: false };
            if (revertResult && revertResult.reverted) {
                result.expired.push({ row, col, owner: playerKey, reason: 'anchor_expired' });
            } else if (!boardOps || typeof boardOps.revertSpecialStoneAt !== 'function') {
                cardState.markers = (cardState.markers || []).filter((entry) => !(
                    entry &&
                    entry.kind === 'specialStone' &&
                    entry.row === row &&
                    entry.col === col &&
                    entry.owner === playerKey &&
                    entry.data &&
                    entry.data.type === 'WILL_HUNTER_KING'
                ));
                result.expired.push({ row, col, owner: playerKey, reason: 'anchor_expired' });
            }
        }

        return result;
    }

    return {
        processWillHunterKingEffectsAtTurnStartAnchor
    };
}));
