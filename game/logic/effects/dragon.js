/**
 * @file dragon.js
 * @description DRAGON effect helper - UMD module for browser and Node.js
 */

(function (root, factory) {
    if (typeof module === 'object' && module.exports) {
        module.exports = factory(require('../../../shared-constants'));
    } else {
        root.DragonEffects = factory(root.SharedConstants);
    }
}(typeof self !== 'undefined' ? self : this, function (SharedConstants) {
    'use strict';

    const { BLACK, WHITE } = SharedConstants || {};
    const P_BLACK = BLACK || 1;
    const P_WHITE = WHITE || -1;

    function normalizeExpansionOwner(owner) {
        return (owner === P_BLACK || owner === P_WHITE) ? owner : 0;
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
        expansion.owner = latest ? normalizeExpansionOwner(latest.owner) : 0;
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
                owner: 0,
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
        if (isMainBoardCell(row, col)) return gameState.board[row][col];
        const expansionCells = getExpansionCells(gameState);
        for (const expansion of expansionCells) {
            if (!expansion) continue;
            if (expansion.row === row && expansion.col === col) return expansion.owner;
        }
        return null;
    }

    function setCellValue(gameState, row, col, value) {
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

    function forEachNeighborCell(gameState, row, col, handler) {
        for (let dr = -1; dr <= 1; dr++) {
            for (let dc = -1; dc <= 1; dc++) {
                if (dr === 0 && dc === 0) continue;
                const r = row + dr;
                const c = col + dc;
                const value = getCellValue(gameState, r, c);
                if (value === null) continue;
                handler(r, c, value);
            }
        }
    }

    function buildDragonFlipProtectedSet(cardState, deps = {}) {
        const markers = (cardState && Array.isArray(cardState.markers)) ? cardState.markers : [];
        const protectedSet = new Set();

        const addCells = (cells) => {
            if (!Array.isArray(cells)) return;
            for (const cell of cells) {
                if (!cell || !Number.isInteger(cell.row) || !Number.isInteger(cell.col)) continue;
                protectedSet.add(`${cell.row},${cell.col}`);
            }
        };

        if (deps && typeof deps.getCardContext === 'function') {
            try {
                const context = deps.getCardContext(cardState) || {};
                addCells(context.protectedStones);
                addCells(context.permaProtectedStones);
            } catch (e) {
                // ignore and fallback to marker-type list
            }
        }

        if (protectedSet.size === 0) {
            const fallbackProtectedTypes = new Set([
                'PROTECTED',
                'PERMA_PROTECTED',
                'DRAGON',
                'BREEDING',
                'DESTROY_DRAGON',
                'LIGHTNING',
                'GLUTTONOUS',
                'ULTIMATE_DESTROY_GOD',
                'GUARD'
            ]);
            for (const marker of markers) {
                if (!marker || marker.kind !== 'specialStone' || !marker.data) continue;
                if (!fallbackProtectedTypes.has(marker.data.type)) continue;
                protectedSet.add(`${marker.row},${marker.col}`);
            }
        }

        // ULTIMATE_HYPERACTIVE keeps existing DRAGON interaction behavior.
        for (const marker of markers) {
            if (!marker || marker.kind !== 'specialStone' || !marker.data) continue;
            if (marker.data.type !== 'ULTIMATE_HYPERACTIVE') continue;
            protectedSet.add(`${marker.row},${marker.col}`);
        }

        return protectedSet;
    }

    function processDragonEffects(cardState, gameState, playerKey, deps = {}) {
        const BoardOps = deps.BoardOps;
        const converted = [];
        const destroyed = [];
        const anchors = [];

        const player = playerKey === 'black' ? P_BLACK : P_WHITE;
        const opponent = -player;

        // Build protection sets for quick lookup
        const protectedSet = buildDragonFlipProtectedSet(cardState, deps);
        const dragons = (cardState.markers || []).filter(s => s.kind === 'specialStone' && s.data && s.data.type === 'DRAGON');

        const clearBombAt = (row, col) => {
            if (!cardState.markers || !cardState.markers.length) return;
            const b = cardState.markers.find(x => x.kind === 'bomb' && x.row === row && x.col === col);
            if (!b) return;
            cardState.markers = cardState.markers.filter(x => !(x.kind === 'bomb' && x.row === row && x.col === col));
        };

        for (const dragon of dragons) {
            if (dragon.owner !== playerKey) continue;

            // Anchor check
            if (getCellValue(gameState, dragon.row, dragon.col) !== player) {
                if (dragon.data) dragon.data.remainingOwnerTurns = -1;
                continue;
            }

            // Turn countdown: decrement first, then fire if >= 0 (0 fires too)
            const before = (dragon.data && (dragon.data.remainingOwnerTurns !== undefined && dragon.data.remainingOwnerTurns !== null))
                ? dragon.data.remainingOwnerTurns
                : 0;
            const afterDec = before - 1;
            if (dragon.data) dragon.data.remainingOwnerTurns = afterDec;
            if (afterDec < 0) continue;
            anchors.push({ row: dragon.row, col: dragon.col, remainingNow: afterDec });

            forEachNeighborCell(gameState, dragon.row, dragon.col, (r, c, value) => {
                    if (value === opponent) {
                        const key = `${r},${c}`;
                        if (protectedSet.has(key)) return;
                        if (BoardOps && typeof BoardOps.changeAt === 'function') {
                            BoardOps.changeAt(cardState, gameState, r, c, playerKey, 'DRAGON', 'dragon_convert');
                        } else {
                            setCellValue(gameState, r, c, player);
                        }
                        clearBombAt(r, c);
                        converted.push({ row: r, col: c });
                    }
            });

            // If countdown reached 0 this turn, destroy anchor after applying
            if (afterDec === 0) {
                destroyed.push({ row: dragon.row, col: dragon.col });
                if (BoardOps && typeof BoardOps.destroyAt === 'function') {
                    BoardOps.destroyAt(cardState, gameState, dragon.row, dragon.col, 'DRAGON', 'anchor_expired');
                } else {
                    setCellValue(gameState, dragon.row, dragon.col, 0);
                }
                if (dragon.data) dragon.data.remainingOwnerTurns = -1;
            }
        }

        // Remove expired dragon anchors from specialStones
        if (cardState.markers) {
            cardState.markers = cardState.markers.filter(s =>
                s.kind !== 'specialStone' ||
                !s.data ||
                s.data.type !== 'DRAGON' ||
                (s.data.remainingOwnerTurns !== undefined && s.data.remainingOwnerTurns !== null && s.data.remainingOwnerTurns >= 0)
            );
        }

        if (converted.length > 0 && cardState.markers) {
            const removeSet = new Set(converted.map(p => `${p.row},${p.col}`));
            cardState.markers = cardState.markers.filter(s =>
                s.kind !== 'specialStone' ||
                !s.data ||
                (s.data.type !== 'HYPERACTIVE' && s.data.type !== 'ESCAPE_HYPERACTIVE') ||
                !removeSet.has(`${s.row},${s.col}`)
            );
        }

        return { converted, destroyed, anchors };
    }

    function processDragonEffectsAtAnchor(cardState, gameState, playerKey, row, col, deps = {}) {
        const BoardOps = deps.BoardOps;
        const converted = [];
        const destroyed = [];

        const player = playerKey === 'black' ? P_BLACK : P_WHITE;
        const opponent = -player;

        const dragon = (cardState.markers || []).find(s =>
            s.kind === 'specialStone' && s.data && s.data.type === 'DRAGON' && s.owner === playerKey && s.row === row && s.col === col
        );
        if (!dragon) return { converted, destroyed };
        if (getCellValue(gameState, row, col) !== player) return { converted, destroyed };

        const protectedSet = buildDragonFlipProtectedSet(cardState, deps);
        const clearBombAt = (r, c) => {
            if (!cardState.markers || !cardState.markers.length) return;
            const b = cardState.markers.find(x => x.kind === 'bomb' && x.row === r && x.col === c);
            if (!b) return;
            cardState.markers = cardState.markers.filter(x => !(x.kind === 'bomb' && x.row === r && x.col === c));
        };

        forEachNeighborCell(gameState, row, col, (r, c, value) => {
                if (value !== opponent) return;
                const key = `${r},${c}`;
                if (protectedSet.has(key)) return;
                if (BoardOps && typeof BoardOps.changeAt === 'function') {
                    BoardOps.changeAt(cardState, gameState, r, c, playerKey, 'DRAGON', 'dragon_convert_immediate');
                } else {
                    setCellValue(gameState, r, c, player);
                }
                clearBombAt(r, c);
                converted.push({ row: r, col: c });
        });

        if (converted.length > 0 && cardState.markers) {
            const removeSet = new Set(converted.map(p => `${p.row},${p.col}`));
            cardState.markers = cardState.markers.filter(s =>
                s.kind !== 'specialStone' ||
                !s.data ||
                (s.data.type !== 'HYPERACTIVE' && s.data.type !== 'ESCAPE_HYPERACTIVE') ||
                !removeSet.has(`${s.row},${s.col}`)
            );
        }

        return { converted, destroyed };
    }

    function processDragonEffectsAtTurnStartAnchor(cardState, gameState, playerKey, row, col, deps = {}) {
        // Process a single dragon anchor at turn start: decrement counter and apply conversions/expiration
        const BoardOps = deps.BoardOps;
        const converted = [];
        const destroyed = [];
        const anchors = [];

        const player = playerKey === 'black' ? P_BLACK : P_WHITE;
        const opponent = -player;

        const dragon = (cardState.markers || []).find(s =>
            s.kind === 'specialStone' && s.data && s.data.type === 'DRAGON' && s.owner === playerKey && s.row === row && s.col === col
        );
        if (!dragon) return { converted, destroyed, anchors };

        // Anchor must still be owner's stone
        if (getCellValue(gameState, row, col) !== player) {
            if (dragon.data) dragon.data.remainingOwnerTurns = -1;
            return { converted, destroyed, anchors };
        }

        const before = (dragon.data && (dragon.data.remainingOwnerTurns !== undefined && dragon.data.remainingOwnerTurns !== null))
            ? dragon.data.remainingOwnerTurns
            : 0;
        const afterDec = before - 1;
        if (dragon.data) dragon.data.remainingOwnerTurns = afterDec;
        if (afterDec < 0) return { converted, destroyed, anchors };
        anchors.push({ row, col, remainingNow: afterDec });

        const protectedSet = buildDragonFlipProtectedSet(cardState, deps);
        const clearBombAt = (r, c) => {
            if (!cardState.markers || !cardState.markers.length) return;
            const b = cardState.markers.find(x => x.kind === 'bomb' && x.row === r && x.col === c);
            if (!b) return;
            cardState.markers = cardState.markers.filter(x => !(x.kind === 'bomb' && x.row === r && x.col === c));
        };

        forEachNeighborCell(gameState, row, col, (r, c, value) => {
                if (value === opponent) {
                    const key = `${r},${c}`;
                    if (protectedSet.has(key)) return;
                    if (BoardOps && typeof BoardOps.changeAt === 'function') {
                        BoardOps.changeAt(cardState, gameState, r, c, playerKey, 'DRAGON', 'dragon_convert');
                    } else {
                        setCellValue(gameState, r, c, player);
                    }
                    clearBombAt(r, c);
                    converted.push({ row: r, col: c });
                }
        });

        if (afterDec === 0) {
            destroyed.push({ row, col });
            if (BoardOps && typeof BoardOps.destroyAt === 'function') {
                BoardOps.destroyAt(cardState, gameState, row, col, 'DRAGON', 'anchor_expired');
            } else {
                setCellValue(gameState, row, col, 0);
            }
            if (dragon.data) dragon.data.remainingOwnerTurns = -1;
        }

        // Remove expired anchors if any
        if (cardState.markers) {
            cardState.markers = cardState.markers.filter(s =>
                s.kind !== 'specialStone' ||
                !s.data ||
                s.data.type !== 'DRAGON' ||
                (s.data.remainingOwnerTurns !== undefined && s.data.remainingOwnerTurns !== null && s.data.remainingOwnerTurns >= 0)
            );
        }

        if (converted.length > 0 && cardState.markers) {
            const removeSet = new Set(converted.map(p => `${p.row},${p.col}`));
            cardState.markers = cardState.markers.filter(s =>
                s.kind !== 'specialStone' ||
                !s.data ||
                (s.data.type !== 'HYPERACTIVE' && s.data.type !== 'ESCAPE_HYPERACTIVE') ||
                !removeSet.has(`${s.row},${s.col}`)
            );
        }

        return { converted, destroyed, anchors };
    }

    return {
        processDragonEffects,
        processDragonEffectsAtAnchor,
        processDragonEffectsAtTurnStartAnchor
    };
}));
