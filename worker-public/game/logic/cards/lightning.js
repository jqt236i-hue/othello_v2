/**
 * @file lightning.js
 * @description Lightning Will effect helpers
 */

(function (root, factory) {
    if (typeof module === 'object' && module.exports) {
        module.exports = factory(require('../../../shared-constants'), require('../board_ops'));
    } else {
        root.CardLightning = factory(root.SharedConstants, root.BoardOps || null);
    }
}(typeof self !== 'undefined' ? self : this, function (SharedConstants, BoardOpsModule) {
    'use strict';

    const { BLACK, WHITE, EMPTY } = SharedConstants || {};

    if (BLACK === undefined || WHITE === undefined || EMPTY === undefined) {
        throw new Error('SharedConstants missing required values');
    }

    function normalizeExpansionOwner(owner) {
        return (owner === BLACK || owner === WHITE) ? owner : EMPTY;
    }

    function isMainBoardCell(row, col) {
        return Number.isInteger(row) && row >= 0 && row < 8 && Number.isInteger(col) && col >= 0 && col < 8;
    }

    function resolveExpansionSide(side, row, col) {
        if (side === 'left' || side === 'right' || side === 'top' || side === 'bottom') return side;
        if (col === -1) return 'left';
        if (col === 8) return 'right';
        if (row === -1) return 'top';
        if (row === 8) return 'bottom';
        return null;
    }

    function isExpansionCoordinate(row, col) {
        if (!Number.isInteger(row) || !Number.isInteger(col)) return false;
        if (row < -1 || row > 8 || col < -1 || col > 8) return false;
        if (isMainBoardCell(row, col)) return false;
        return true;
    }

    function syncLegacyExpansionFields(expansion) {
        if (!expansion || typeof expansion !== 'object') return;
        if (!Array.isArray(expansion.cells)) expansion.cells = [];
        const latest = expansion.cells.length > 0 ? expansion.cells[expansion.cells.length - 1] : null;
        expansion.active = !!latest;
        expansion.side = latest ? resolveExpansionSide(latest.side, latest.row, latest.col) : null;
        expansion.row = latest ? latest.row : null;
        expansion.owner = latest ? normalizeExpansionOwner(latest.owner) : EMPTY;
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

            if (!isExpansionCoordinate(row, col)) return;
            if (cells.some((cell) => cell && cell.row === row && cell.col === col)) return;
            cells.push({
                side: resolveExpansionSide(side, row, col),
                row,
                col,
                owner: normalizeExpansionOwner(owner)
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

    function ensureExpansionStateMutable(gameState) {
        if (!gameState.boardExpansion || typeof gameState.boardExpansion !== 'object') {
            gameState.boardExpansion = {
                active: false,
                side: null,
                row: null,
                owner: EMPTY,
                usedByPlayer: { black: false, white: false },
                cells: []
            };
            return gameState.boardExpansion;
        }
        const expansion = gameState.boardExpansion;
        const cells = getExpansionCells(gameState);
        expansion.cells = cells.map((cell) => ({
            side: cell.side,
            row: cell.row,
            col: cell.col,
            owner: normalizeExpansionOwner(cell.owner)
        }));
        syncLegacyExpansionFields(expansion);
        return expansion;
    }

    function getCellValue(gameState, row, col) {
        if (BoardOpsModule && typeof BoardOpsModule.getCellValue === 'function') {
            return BoardOpsModule.getCellValue(gameState, row, col);
        }
        if (isMainBoardCell(row, col)) return gameState.board[row][col];
        const expansionCells = getExpansionCells(gameState);
        for (const expansion of expansionCells) {
            if (!expansion) continue;
            if (expansion.row === row && expansion.col === col) return expansion.owner;
        }
        return null;
    }

    function setCellValue(gameState, row, col, value) {
        if (BoardOpsModule && typeof BoardOpsModule.setCellValue === 'function') {
            return BoardOpsModule.setCellValue(gameState, row, col, value);
        }
        if (row >= 0 && row < 8 && col >= 0 && col < 8) {
            gameState.board[row][col] = value;
            return true;
        }
        const expansionState = ensureExpansionStateMutable(gameState);
        if (!Array.isArray(expansionState.cells)) return false;
        const normalizedOwner = normalizeExpansionOwner(value);
        for (let i = 0; i < expansionState.cells.length; i++) {
            const cell = expansionState.cells[i];
            if (!cell) continue;
            const cellCol = Number.isInteger(cell.col)
                ? cell.col
                : (cell.side === 'left' ? -1 : (cell.side === 'right' ? 8 : null));
            if (cellCol === null) continue;
            if (cell.row === row && cellCol === col) {
                expansionState.cells[i] = {
                    side: resolveExpansionSide(cell.side, cell.row, cellCol),
                    row: cell.row,
                    col: cellCol,
                    owner: normalizedOwner
                };
                syncLegacyExpansionFields(expansionState);
                return true;
            }
        }
        return false;
    }

    function resolveRandomFn(randomLike) {
        if (typeof randomLike === 'function') return randomLike;
        if (randomLike && typeof randomLike.random === 'function') {
            return function () { return randomLike.random(); };
        }
        return Math.random;
    }

    function pickRandomEnemyTarget(gameState, enemyValue, randomFn) {
        const candidates = [];

        for (let row = 0; row < 8; row++) {
            for (let col = 0; col < 8; col++) {
                if (gameState.board[row][col] !== enemyValue) continue;
                candidates.push({ row, col });
            }
        }

        const expansionCells = getExpansionCells(gameState);
        for (const cell of expansionCells) {
            if (!cell || cell.owner !== enemyValue) continue;
            candidates.push({ row: cell.row, col: cell.col });
        }

        if (!candidates.length) return null;
        const raw = Number(randomFn());
        const normalized = Number.isFinite(raw) ? raw : Math.random();
        const idx = Math.max(0, Math.min(candidates.length - 1, Math.floor(normalized * candidates.length)));
        return candidates[idx] || null;
    }

    function cleanupExpiredLightningStones(cardState) {
        if (!Array.isArray(cardState && cardState.markers)) return;
        cardState.markers = cardState.markers.filter((m) => (
            m.kind !== 'specialStone' ||
            !m.data ||
            m.data.type !== 'LIGHTNING' ||
            (Number.isFinite(Number(m.data.remainingOwnerTurns)) && Number(m.data.remainingOwnerTurns) >= 0)
        ));
    }

    function destroyRandomEnemyStone(cardState, gameState, playerKey, sourceRow, sourceCol, enemyValue, deps, randomFn, destroyAt) {
        const target = pickRandomEnemyTarget(gameState, enemyValue, randomFn);
        if (!target) return null;

        const destroyMeta = {
            sourceRow,
            sourceCol,
            projectileOwner: playerKey,
            projectileStone: 'lightning_will'
        };

        let destroyedRes = false;
        if (deps.BoardOps && typeof deps.BoardOps.destroyAt === 'function') {
            const res = deps.BoardOps.destroyAt(
                cardState,
                gameState,
                target.row,
                target.col,
                'LIGHTNING_WILL',
                'lightning_destroyed',
                destroyMeta
            );
            destroyedRes = !!(res && res.destroyed);
        } else {
            destroyedRes = destroyAt(cardState, gameState, target.row, target.col);
        }
        if (!destroyedRes) return null;

        return {
            row: target.row,
            col: target.col,
            sourceRow,
            sourceCol
        };
    }

    function processLightningWillEffects(cardState, gameState, playerKey, deps = {}) {
        const destroyed = [];
        const anchors = [];
        const expired = [];

        const randomFn = resolveRandomFn(deps.random);
        const player = playerKey === 'black' ? (BLACK || 1) : (WHITE || -1);
        const enemy = -player;

        const destroyAt = deps.destroyAt || ((cs, gs, row, col) => {
            const current = getCellValue(gs, row, col);
            if (current === null || current === EMPTY) return false;
            if (cs.markers) cs.markers = cs.markers.filter((m) => !(m.row === row && m.col === col));
            setCellValue(gs, row, col, EMPTY);
            return true;
        });

        const lightningStones = (cardState.markers || []).filter((m) => (
            m.kind === 'specialStone' &&
            m.data &&
            m.data.type === 'LIGHTNING' &&
            m.owner === playerKey
        ));
        if (!lightningStones.length) return { destroyed, anchors, expired };

        for (const lightning of lightningStones) {
            if (getCellValue(gameState, lightning.row, lightning.col) !== player) {
                if (lightning.data) lightning.data.remainingOwnerTurns = -1;
                continue;
            }

            const oneDestroyed = destroyRandomEnemyStone(
                cardState,
                gameState,
                playerKey,
                lightning.row,
                lightning.col,
                enemy,
                deps,
                randomFn,
                destroyAt
            );
            if (oneDestroyed) destroyed.push(oneDestroyed);

            const before = (lightning.data && Number.isFinite(Number(lightning.data.remainingOwnerTurns)))
                ? Number(lightning.data.remainingOwnerTurns)
                : 0;
            const afterDec = before - 1;
            if (lightning.data) lightning.data.remainingOwnerTurns = afterDec;
            if (afterDec < 0) continue;

            anchors.push({ row: lightning.row, col: lightning.col, remainingNow: afterDec });

            if (afterDec === 0) {
                let destroyedRes = false;
                if (deps.BoardOps && typeof deps.BoardOps.destroyAt === 'function') {
                    const res = deps.BoardOps.destroyAt(cardState, gameState, lightning.row, lightning.col, 'LIGHTNING_WILL', 'anchor_expired');
                    destroyedRes = !!(res && res.destroyed);
                } else {
                    destroyedRes = destroyAt(cardState, gameState, lightning.row, lightning.col);
                }
                if (destroyedRes) {
                    expired.push({ row: lightning.row, col: lightning.col });
                }
                if (lightning.data) lightning.data.remainingOwnerTurns = -1;
            }
        }

        cleanupExpiredLightningStones(cardState);
        return { destroyed, anchors, expired };
    }

    function processLightningWillEffectsAtAnchor(cardState, gameState, playerKey, row, col, deps = {}) {
        const destroyed = [];
        const expired = [];

        const randomFn = resolveRandomFn(deps.random);
        const player = playerKey === 'black' ? (BLACK || 1) : (WHITE || -1);
        const enemy = -player;

        const destroyAt = deps.destroyAt || ((cs, gs, targetRow, targetCol) => {
            const current = getCellValue(gs, targetRow, targetCol);
            if (current === null || current === EMPTY) return false;
            if (cs.markers) cs.markers = cs.markers.filter((m) => !(m.row === targetRow && m.col === targetCol));
            setCellValue(gs, targetRow, targetCol, EMPTY);
            return true;
        });

        const lightning = (cardState.markers || []).find((m) => (
            m.kind === 'specialStone' &&
            m.data &&
            m.data.type === 'LIGHTNING' &&
            m.owner === playerKey &&
            m.row === row &&
            m.col === col
        ));
        if (!lightning) return { destroyed, expired };

        if (getCellValue(gameState, row, col) !== player) {
            if (lightning.data) lightning.data.remainingOwnerTurns = -1;
            cleanupExpiredLightningStones(cardState);
            return { destroyed, expired };
        }

        const oneDestroyed = destroyRandomEnemyStone(
            cardState,
            gameState,
            playerKey,
            row,
            col,
            enemy,
            deps,
            randomFn,
            destroyAt
        );
        if (oneDestroyed) destroyed.push(oneDestroyed);

        const shouldDecrement = deps.decrementRemainingOwnerTurns !== false;
        const before = (lightning.data && Number.isFinite(Number(lightning.data.remainingOwnerTurns)))
            ? Number(lightning.data.remainingOwnerTurns)
            : 0;
        const afterDec = shouldDecrement ? (before - 1) : before;

        if (lightning.data) lightning.data.remainingOwnerTurns = afterDec;

        if (shouldDecrement && afterDec === 0) {
            let destroyedRes = false;
            if (deps.BoardOps && typeof deps.BoardOps.destroyAt === 'function') {
                const res = deps.BoardOps.destroyAt(cardState, gameState, row, col, 'LIGHTNING_WILL', 'anchor_expired');
                destroyedRes = !!(res && res.destroyed);
            } else {
                destroyedRes = destroyAt(cardState, gameState, row, col);
            }
            if (destroyedRes) {
                expired.push({ row, col });
            }
            if (lightning.data) lightning.data.remainingOwnerTurns = -1;
        }

        if (shouldDecrement && afterDec < 0) {
            if (lightning.data) lightning.data.remainingOwnerTurns = -1;
        }

        cleanupExpiredLightningStones(cardState);
        return { destroyed, expired };
    }

    function processLightningWillEffectsAtTurnStartAnchor(cardState, gameState, playerKey, row, col, deps = {}) {
        return processLightningWillEffectsAtAnchor(cardState, gameState, playerKey, row, col, deps);
    }

    return {
        processLightningWillEffects,
        processLightningWillEffectsAtAnchor,
        processLightningWillEffectsAtTurnStartAnchor
    };
}));
