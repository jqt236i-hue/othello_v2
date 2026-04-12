/**
 * @file regen.js
 * @description REGEN effect helpers (Shared between Browser and Headless)
 */

(function (root, factory) {
    if (typeof module === 'object' && module.exports) {
        let CardMarkersModule = null;
        try {
            CardMarkersModule = require('./markers');
        } catch (e) { /* ignore */ }
        module.exports = factory(
            require('../../../shared-constants'),
            require('../../../shared/shared-board-utils'),
            CardMarkersModule
        );
    } else {
        root.CardRegen = factory(root.SharedConstants, root.SharedBoardUtils || null, root.CardMarkers || null);
    }
}(typeof self !== 'undefined' ? self : this, function (SharedConstants, SharedBoardUtils, CardMarkersModule) {
    'use strict';

    const { BLACK, WHITE, DIRECTIONS, EMPTY } = SharedConstants || {};
    const REGEN_REVIVE_LIMIT = 3;

    function getGlobalScope() {
        return (typeof globalThis !== 'undefined')
            ? globalThis
            : (typeof self !== 'undefined' ? self : (typeof global !== 'undefined' ? global : {}));
    }

    function getCardMarkersModule() {
        if (CardMarkersModule) return CardMarkersModule;
        const globalScope = getGlobalScope();
        return globalScope.CardMarkers || null;
    }

    if (BLACK === undefined || WHITE === undefined || DIRECTIONS === undefined) {
        throw new Error('SharedConstants (BLACK/WHITE/DIRECTIONS) required');
    }

    function resolveBoardBounds(gameState) {
        if (SharedBoardUtils && typeof SharedBoardUtils.resolveBoardBounds === 'function') {
            return SharedBoardUtils.resolveBoardBounds(gameState && gameState.board);
        }
        const board = gameState && gameState.board;
        if (!Array.isArray(board) || board.length <= 0) return null;
        let maxCol = -1;
        for (const row of board) {
            if (Array.isArray(row) && row.length > 0) {
                maxCol = Math.max(maxCol, row.length - 1);
            }
        }
        if (maxCol < 0) return null;
        return { minRow: 0, maxRow: board.length - 1, minCol: 0, maxCol };
    }

    function isMainBoardCell(gameState, row, col) {
        const bounds = resolveBoardBounds(gameState);
        return !!(
            bounds &&
            Number.isInteger(row) &&
            Number.isInteger(col) &&
            row >= bounds.minRow &&
            row <= bounds.maxRow &&
            col >= bounds.minCol &&
            col <= bounds.maxCol
        );
    }

    function resolveExpansionSide(side, row, col, gameState) {
        const bounds = resolveBoardBounds(gameState);
        if (side === 'left' || side === 'right' || side === 'top' || side === 'bottom') return side;
        if (!bounds) return null;
        if (col === -1) return 'left';
        if (col === (bounds.maxCol + 1)) return 'right';
        if (row === -1) return 'top';
        if (row === (bounds.maxRow + 1)) return 'bottom';
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
                    : (cell.side === 'left' ? -1 : (cell.side === 'right' ? ((resolveBoardBounds(gameState) || {}).maxCol + 1) : null));
                if (!Number.isInteger(cellCol)) continue;
                if (cell.row === row && cellCol === col) {
                    return { expansion, index, cell, legacy: false };
                }
            }
        }

        if (expansion.active === true) {
            const legacyCol = Number.isInteger(expansion.col)
                ? expansion.col
                : (expansion.side === 'left' ? -1 : (expansion.side === 'right' ? ((resolveBoardBounds(gameState) || {}).maxCol + 1) : null));
            if (expansion.row === row && legacyCol === col) {
                return { expansion, index: -1, cell: expansion, legacy: true };
            }
        }

        return null;
    }

    function getCellValue(gameState, row, col) {
        if (isMainBoardCell(gameState, row, col)) {
            return (gameState && Array.isArray(gameState.board) && Array.isArray(gameState.board[row]))
                ? gameState.board[row][col]
                : null;
        }
        const ref = getExpansionCellRef(gameState, row, col);
        return ref ? Number(ref.cell.owner) : null;
    }

    function setCellValue(gameState, row, col, value) {
        if (isMainBoardCell(gameState, row, col)) {
            if (!gameState || !Array.isArray(gameState.board) || !Array.isArray(gameState.board[row])) return false;
            gameState.board[row][col] = value;
            return true;
        }

        const ref = getExpansionCellRef(gameState, row, col);
        if (!ref) return false;
        const normalizedOwner = (value === BLACK || value === WHITE) ? value : EMPTY;

        if (!ref.legacy) {
            ref.expansion.cells[ref.index] = {
                side: resolveExpansionSide(ref.cell.side, row, col, gameState),
                row,
                col,
                owner: normalizedOwner
            };
            return true;
        }

        ref.expansion.side = resolveExpansionSide(ref.cell.side, row, col, gameState);
        ref.expansion.row = row;
        ref.expansion.col = col;
        ref.expansion.owner = normalizedOwner;
        return true;
    }

    function applyRegenWill(cardState, playerKey, row, col, deps = {}) {
        const addMarker = deps.addMarker || ((cs, kind, r, c, owner, data) => {
            const cardMarkers = getCardMarkersModule();
            if (cardMarkers && typeof cardMarkers.addMarker === 'function') {
                cardMarkers.addMarker(cs, kind, r, c, owner, {
                    type: data.type,
                    regenRemaining: data.regenRemaining,
                    remainingOwnerTurns: data.remainingOwnerTurns,
                    ownerColor: data.ownerColor
                });
                return true;
            }
            if (!cs.markers) cs.markers = [];
            if (typeof cs._nextMarkerId !== 'number') cs._nextMarkerId = 1;
            const id = cs._nextMarkerId++;
            if (typeof cs._nextCreatedSeq !== 'number') cs._nextCreatedSeq = 1;
            const createdSeq = cs._nextCreatedSeq++;
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

    function findActiveRegenMarkerAt(cardState, row, col) {
        const markers = Array.isArray(cardState && cardState.markers) ? cardState.markers : [];
        for (const marker of markers) {
            if (!marker || marker.kind !== 'specialStone' || marker.row !== row || marker.col !== col) continue;
            if (!marker.data || marker.data.type !== 'REGEN') continue;
            if ((Number(marker.data.regenRemaining) || 0) <= 0) continue;
            return marker;
        }
        return null;
    }

    function _getRegenCardContext(cardState, deps = {}) {
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
        const clearBombAt = deps.clearBombAt || ((cs, r, c) => {
            const cardMarkers = getCardMarkersModule();
            if (cardMarkers && typeof cardMarkers.removeMarkersAt === 'function') {
                cardMarkers.removeMarkersAt(cs, r, c, { category: 'bomb' });
                return;
            }
            if (cs.markers) cs.markers = cs.markers.filter(m => !(m.kind === 'specialStone' && m.data && m.data.category === 'bomb' && m.row === r && m.col === c));
        });
        const context = getCardContext(cardState);
        const blockedSet = context.blockedCells ? new Set(context.blockedCells.map(p => `${p.row},${p.col}`)) : null;
        const protSet = context.protectedStones ? new Set(context.protectedStones.map(p => `${p.row},${p.col}`)) : null;
        const permaSet = context.permaProtectedStones ? new Set(context.permaProtectedStones.map(p => `${p.row},${p.col}`)) : null;
        return {
            clearBombAt,
            isBlocked(r, c) {
                const key = `${r},${c}`;
                if (blockedSet && blockedSet.has(key)) return true;
                if (protSet && protSet.has(key)) return true;
                if (permaSet && permaSet.has(key)) return true;
                return false;
            }
        };
    }

    function _removeConsumedRegenMarker(cardState, row, col, owner, deps = {}) {
        if (typeof deps.removeMarkersAt === 'function') {
            deps.removeMarkersAt(cardState, row, col, {
                kind: 'specialStone',
                type: 'REGEN',
                owner
            });
            return;
        }
        const cardMarkers = getCardMarkersModule();
        if (cardMarkers && typeof cardMarkers.removeMarkersAt === 'function') {
            cardMarkers.removeMarkersAt(cardState, row, col, {
                kind: 'specialStone',
                type: 'REGEN',
                owner
            });
            return;
        }
        if (Array.isArray(cardState.markers)) {
            cardState.markers = cardState.markers.filter(m => !(
                m &&
                m.kind === 'specialStone' &&
                m.row === row &&
                m.col === col &&
                m.data &&
                m.data.type === 'REGEN'
            ));
        }
    }

    function _emitRegenConsumedStatus(cardState, row, col, deps = {}) {
        const boardOps = deps.BoardOps || null;
        if (boardOps && typeof boardOps.emitPresentationEvent === 'function') {
            boardOps.emitPresentationEvent(cardState, {
                type: 'STATUS_REMOVED',
                row,
                col,
                cause: 'REGEN',
                reason: 'regen_consumed',
                meta: { special: 'REGEN', reason: 'regen_consumed' }
            });
        }
    }

    function _captureFromRegenOrigin(cardState, gameState, row, col, regenOwner, ownerColor, ctx, deps = {}) {
        const captureFlips = [];
        for (const [dr, dc] of DIRECTIONS) {
            const line = [];
            let r = row + dr;
            let c = col + dc;
            while (getCellValue(gameState, r, c) === -ownerColor) {
                if (ctx.isBlocked(r, c)) {
                    line.length = 0;
                    break;
                }
                line.push({ row: r, col: c });
                r += dr;
                c += dc;
            }
            if (line.length <= 0 || ctx.isBlocked(r, c) || getCellValue(gameState, r, c) !== ownerColor) continue;
            for (const point of line) {
                let changed = true;
                if (deps.BoardOps && typeof deps.BoardOps.changeAt === 'function') {
                    const changeRes = deps.BoardOps.changeAt(cardState, gameState, point.row, point.col, regenOwner, 'REGEN', 'regen_capture_flip');
                    changed = !!(changeRes && changeRes.changed);
                } else {
                    setCellValue(gameState, point.row, point.col, ownerColor);
                }
                if (!changed) continue;
                ctx.clearBombAt(cardState, point.row, point.col);
                captureFlips.push(point);
            }
        }
        return captureFlips;
    }

    function _emitForcedRegenChange(cardState, gameState, row, col, ownerKey, ownerColor, nextRemaining, deps = {}) {
        setCellValue(gameState, row, col, ownerColor);
        const boardOps = deps.BoardOps || null;
        if (boardOps && typeof boardOps.emitPresentationEvent === 'function') {
            boardOps.emitPresentationEvent(cardState, {
                type: 'CHANGE',
                row,
                col,
                ownerBefore: ownerKey,
                ownerAfter: ownerKey,
                cause: 'REGEN',
                reason: 'regen_triggered',
                meta: {
                    special: 'REGEN',
                    owner: ownerKey,
                    timer: nextRemaining,
                    regenRemaining: nextRemaining
                }
            });
        }
    }

    function _triggerRegenAtPosition(cardState, gameState, row, col, triggerKind, skipCapture, deps = {}, ctx, consumedRegenKeys) {
        const regen = findActiveRegenMarkerAt(cardState, row, col);
        if (!regen) return { triggered: false, regened: [], captureFlips: [] };
        const ownerColor = regen.owner === 'black' ? (BLACK || 1) : (WHITE || -1);
        const currentValue = getCellValue(gameState, row, col);
        if (triggerKind !== 'destroy' && currentValue === ownerColor) {
            return { triggered: false, regened: [], captureFlips: [] };
        }

        const nextRemaining = Math.max(0, Number(regen.data.regenRemaining || 0) - 1);
        regen.data.regenRemaining = nextRemaining;
        regen.data.remainingOwnerTurns = nextRemaining;

        if (deps.BoardOps && typeof deps.BoardOps.changeAt === 'function') {
            deps.BoardOps.changeAt(
                cardState,
                gameState,
                row,
                col,
                regen.owner,
                'REGEN',
                'regen_triggered',
                triggerKind === 'destroy' ? { forcePresentation: true } : {}
            );
        } else {
            _emitForcedRegenChange(cardState, gameState, row, col, regen.owner, ownerColor, nextRemaining, deps);
        }

        const regened = [{ row, col }];
        const captureFlips = skipCapture
            ? []
            : _captureFromRegenOrigin(cardState, gameState, row, col, regen.owner, ownerColor, ctx, deps);

        if ((regen.data.regenRemaining || 0) <= 0) {
            const key = `${row},${col}`;
            if (!consumedRegenKeys.has(key)) {
                consumedRegenKeys.add(key);
                _removeConsumedRegenMarker(cardState, row, col, regen.owner, deps);
                _emitRegenConsumedStatus(cardState, row, col, deps);
            }
        }

        return {
            triggered: true,
            regened,
            captureFlips,
            owner: regen.owner,
            remaining: nextRemaining
        };
    }

    function applyRegenAfterFlips(cardState, gameState, flips, flipperKey, skipCapture, deps = {}) {
        const regened = [];
        const captureFlips = [];
        if (!flips || !flips.length) return { regened, captureFlips };
        const consumedRegenKeys = new Set();
        const ctx = _getRegenCardContext(cardState, deps);
        const toObj = (p) => (typeof p.row === 'number' ? p : { row: p[0], col: p[1] });

        for (const raw of flips) {
            const pos = toObj(raw);
            const result = _triggerRegenAtPosition(
                cardState,
                gameState,
                pos.row,
                pos.col,
                'flip',
                !!skipCapture,
                deps,
                ctx,
                consumedRegenKeys
            );
            if (!result.triggered) continue;
            regened.push(...result.regened);
            captureFlips.push(...result.captureFlips);
        }

        return { regened, captureFlips };
    }

    function applyRegenAfterDestroy(cardState, gameState, row, col, triggerMeta, deps = {}) {
        const consumedRegenKeys = new Set();
        const ctx = _getRegenCardContext(cardState, deps);
        const result = _triggerRegenAtPosition(
            cardState,
            gameState,
            row,
            col,
            'destroy',
            false,
            deps,
            ctx,
            consumedRegenKeys
        );
        return {
            regenerated: !!result.triggered,
            regened: result.regened || [],
            captureFlips: result.captureFlips || [],
            owner: result.owner || null,
            remaining: result.remaining
        };
    }

    return {
        applyRegenWill,
        applyRegenAfterFlips,
        applyRegenAfterDestroy,
        findActiveRegenMarkerAt
    };
}));
