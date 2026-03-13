/**
 * @file regen.js
 * @description REGEN effect helpers (Shared between Browser and Headless)
 */

(function (root, factory) {
    if (typeof module === 'object' && module.exports) {
        module.exports = factory(require('../../../shared-constants'));
    } else {
        root.CardRegen = factory(root.SharedConstants);
    }
}(typeof self !== 'undefined' ? self : this, function (SharedConstants) {
    'use strict';

    const { BLACK, WHITE, DIRECTIONS, EMPTY } = SharedConstants || {};
    const REGEN_REVIVE_LIMIT = 3;

    if (BLACK === undefined || WHITE === undefined || DIRECTIONS === undefined) {
        throw new Error('SharedConstants (BLACK/WHITE/DIRECTIONS) required');
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

    function getExpansionCellRef(gameState, row, col) {
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
                    : (cell.side === 'left' ? -1 : (cell.side === 'right' ? 8 : null));
                if (!Number.isInteger(cellCol)) continue;
                if (cell.row === row && cellCol === col) {
                    return { expansion, index, cell, legacy: false };
                }
            }
        }

        if (expansion.active === true) {
            const legacyCol = Number.isInteger(expansion.col)
                ? expansion.col
                : (expansion.side === 'left' ? -1 : (expansion.side === 'right' ? 8 : null));
            if (expansion.row === row && legacyCol === col) {
                return { expansion, index: -1, cell: expansion, legacy: true };
            }
        }

        return null;
    }

    function getCellValue(gameState, row, col) {
        if (isMainBoardCell(row, col)) {
            return (gameState && Array.isArray(gameState.board) && Array.isArray(gameState.board[row]))
                ? gameState.board[row][col]
                : null;
        }
        const ref = getExpansionCellRef(gameState, row, col);
        return ref ? Number(ref.cell.owner) : null;
    }

    function setCellValue(gameState, row, col, value) {
        if (isMainBoardCell(row, col)) {
            if (!gameState || !Array.isArray(gameState.board) || !Array.isArray(gameState.board[row])) return false;
            gameState.board[row][col] = value;
            return true;
        }

        const ref = getExpansionCellRef(gameState, row, col);
        if (!ref) return false;
        const normalizedOwner = (value === BLACK || value === WHITE) ? value : EMPTY;

        if (!ref.legacy) {
            ref.expansion.cells[ref.index] = {
                side: resolveExpansionSide(ref.cell.side, row, col),
                row,
                col,
                owner: normalizedOwner
            };
            return true;
        }

        ref.expansion.side = resolveExpansionSide(ref.cell.side, row, col);
        ref.expansion.row = row;
        ref.expansion.col = col;
        ref.expansion.owner = normalizedOwner;
        return true;
    }

    function applyRegenWill(cardState, playerKey, row, col, deps = {}) {
        const addMarker = deps.addMarker || ((cs, kind, r, c, owner, data) => {
            if (!cs.markers) cs.markers = [];
            const id = (typeof cs._nextMarkerId === 'number') ? cs._nextMarkerId++ : 1;
            const createdSeq = (typeof cs._nextCreatedSeq === 'number') ? cs._nextCreatedSeq++ : 1;
            cs.markers.push({
                id,
                row: r,
                col: c,
                kind: kind,
                owner,
                createdSeq,
                data: {
                    type: data.type,
                    regenRemaining: data.regenRemaining,
                    remainingOwnerTurns: data.remainingOwnerTurns,
                    ownerColor: data.ownerColor
                }
            });
            return true;
        });

        addMarker(cardState, 'specialStone', row, col, playerKey, {
            type: 'REGEN',
            regenRemaining: REGEN_REVIVE_LIMIT,
            remainingOwnerTurns: REGEN_REVIVE_LIMIT,
            ownerColor: playerKey === 'black' ? (BLACK || 1) : (WHITE || -1)
        });
        return { applied: true };
    }

    function applyRegenAfterFlips(cardState, gameState, flips, flipperKey, skipCapture, deps = {}) {
        const regened = [];
        const captureFlips = [];
        if (!flips || !flips.length) return { regened, captureFlips };
        const consumedRegenKeys = new Set();

        const getCardContext = deps.getCardContext || (() => ({
            protectedStones: (cardState.markers ? cardState.markers.filter(m => m.kind === 'specialStone' && m.data && m.data.type === 'PROTECTED').map(m => ({ row: m.row, col: m.col })) : []),
            permaProtectedStones: (cardState.markers ? cardState.markers.filter(m => {
                if (!(m && m.kind === 'specialStone' && m.data)) return false;
                if (m.data.type === 'PERMA_PROTECTED' || m.data.type === 'DRAGON' || m.data.type === 'BREEDING' || m.data.type === 'ULTIMATE_DESTROY_GOD' || m.data.type === 'GUARD') {
                    return true;
                }
                if (m.data.type !== 'ULTIMATE_HYPERACTIVE') return false;
                const remaining = Number(m.data.remainingOwnerTurns);
                return !Number.isFinite(remaining) || remaining > 0;
            }).map(m => ({ row: m.row, col: m.col })) : [])
        }));
        const clearBombAt = deps.clearBombAt || ((cs, r, c) => { if (cs.markers) cs.markers = cs.markers.filter(m => !(m.kind === 'bomb' && m.row === r && m.col === c)); });

        const specials = (cardState.markers || []).filter(m => m.kind === 'specialStone');
        const dirs = DIRECTIONS;

        const context = getCardContext(cardState);
        const blockedSet = context.blockedCells ? new Set(context.blockedCells.map(p => `${p.row},${p.col}`)) : null;
        const protSet = context.protectedStones ? new Set(context.protectedStones.map(p => `${p.row},${p.col}`)) : null;
        const permaSet = context.permaProtectedStones ? new Set(context.permaProtectedStones.map(p => `${p.row},${p.col}`)) : null;
        const isBlocked = (r, c) => {
            const key = `${r},${c}`;
            if (blockedSet && blockedSet.has(key)) return true;
            if (protSet && protSet.has(key)) return true;
            if (permaSet && permaSet.has(key)) return true;
            return false;
        };

        const toObj = (p) => (typeof p.row === 'number' ? p : { row: p[0], col: p[1] });

        for (const raw of flips) {
            const pos = toObj(raw);
            const idx = specials.findIndex(s => s.data && s.data.type === 'REGEN' && s.row === pos.row && s.col === pos.col && (s.data.regenRemaining || 0) > 0);
            if (idx === -1) continue;
            const regen = specials[idx];
            const ownerColor = regen.owner === 'black' ? (BLACK || 1) : (WHITE || -1);
            if (getCellValue(gameState, pos.row, pos.col) === ownerColor) continue; // not flipped against owner

            // consume regen and revert color
            const nextRemaining = Math.max(0, Number(regen.data.regenRemaining || 0) - 1);
            regen.data.regenRemaining = nextRemaining;
            regen.data.remainingOwnerTurns = nextRemaining;
            if (deps.BoardOps && typeof deps.BoardOps.changeAt === 'function') {
                deps.BoardOps.changeAt(cardState, gameState, pos.row, pos.col, regen.owner, 'REGEN', 'regen_triggered');
            } else {
                setCellValue(gameState, pos.row, pos.col, ownerColor);
            }
            regened.push({ row: pos.row, col: pos.col });

            if (skipCapture) continue;

            // single-origin capture from this cell
            for (const [dr, dc] of dirs) {
                const line = [];
                let r = pos.row + dr;
                let c = pos.col + dc;
                while (getCellValue(gameState, r, c) === -ownerColor) {
                    if (isBlocked(r, c)) {
                        line.length = 0;
                        break;
                    }
                    line.push({ row: r, col: c });
                    r += dr;
                    c += dc;
                }
                if (line.length > 0 && !isBlocked(r, c) && getCellValue(gameState, r, c) === ownerColor) {
                    for (const p of line) {
                        if (deps.BoardOps && typeof deps.BoardOps.changeAt === 'function') {
                            deps.BoardOps.changeAt(cardState, gameState, p.row, p.col, regen.owner, 'REGEN', 'regen_capture_flip');
                        } else {
                            setCellValue(gameState, p.row, p.col, ownerColor);
                        }
                        clearBombAt(cardState, p.row, p.col);
                        captureFlips.push(p);
                    }
                }
            }

            // REGEN is one-time use. Remove marker immediately and emit a status-removed event
            // so UI can run "regen visual -> normal stone" transition right after regen sequence.
            if ((regen.data.regenRemaining || 0) <= 0) {
                const k = `${pos.row},${pos.col}`;
                if (!consumedRegenKeys.has(k)) {
                    consumedRegenKeys.add(k);

                    if (typeof deps.removeMarkersAt === 'function') {
                        deps.removeMarkersAt(cardState, pos.row, pos.col, {
                            kind: 'specialStone',
                            type: 'REGEN',
                            owner: regen.owner
                        });
                    } else if (Array.isArray(cardState.markers)) {
                        cardState.markers = cardState.markers.filter(m => !(
                            m &&
                            m.kind === 'specialStone' &&
                            m.row === pos.row &&
                            m.col === pos.col &&
                            m.data &&
                            m.data.type === 'REGEN'
                        ));
                    }

                    if (deps.BoardOps && typeof deps.BoardOps.emitPresentationEvent === 'function') {
                        deps.BoardOps.emitPresentationEvent(cardState, {
                            type: 'STATUS_REMOVED',
                            row: pos.row,
                            col: pos.col,
                            cause: 'REGEN',
                            reason: 'regen_consumed',
                            meta: { special: 'REGEN', reason: 'regen_consumed' }
                        });
                    }
                }
            }
        }

        return { regened, captureFlips };
    }

    return {
        applyRegenWill,
        applyRegenAfterFlips
    };
}));
