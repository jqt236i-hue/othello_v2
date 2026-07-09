/**
 * @file regen.js
 * @description REGEN effect helpers (Shared between Browser and Headless)
 */

const CardRegen = (function (root: any, factory: any) {
    if (typeof module === 'object' && module.exports) {
        let CardMarkersModule = null;
        let SpecialStoneRegistryModule = null;
        let ProtectionContextModule = null;
        try {
            CardMarkersModule = require('./markers');
        } catch (e) { /* ignore */ }
        try {
            SpecialStoneRegistryModule = require('../../../shared/special-stone-registry');
        } catch (e) { /* ignore */ }
        try {
            ProtectionContextModule = require('../cards-internal/protection-context');
        } catch (e) { /* ignore */ }
        return factory(
            require('../../../shared-constants'),
            require('../../../shared/shared-board-utils'),
            CardMarkersModule,
            SpecialStoneRegistryModule,
            ProtectionContextModule
        );
    }
    if (root && root.SharedConstants) {
        return (root.CardRegen = factory(
            root.SharedConstants,
            root.SharedBoardUtils || null,
            root.CardMarkers || null,
            root.SpecialStoneRegistry || null,
            root.CardProtectionContext || null
        ));
    } else {
        return (root.CardRegen = factory(
            root.SharedConstants,
            root.SharedBoardUtils || null,
            root.CardMarkers || null,
            root.SpecialStoneRegistry || null,
            root.CardProtectionContext || null
        ));
    }
}(typeof self !== 'undefined' ? self : this, function (
    SharedConstants: any,
    SharedBoardUtils: any,
    CardMarkersModule: any,
    SpecialStoneRegistryModule: any,
    ProtectionContextModule: any
) {
    'use strict';

    const { BLACK, WHITE, DIRECTIONS, EMPTY } = SharedConstants || {};
    const REGEN_REVIVE_LIMIT = 3;

    function getRuntimeGlobalValue(key: string): any {
        if (typeof self !== 'undefined' && (self as any)[key]) {
            return (self as any)[key];
        }
        return null;
    }

    function getCardMarkersModule() {
        if (CardMarkersModule) return CardMarkersModule;
        return getRuntimeGlobalValue('CardMarkers');
    }

    function getSpecialStoneRegistryModule() {
        if (SpecialStoneRegistryModule) return SpecialStoneRegistryModule;
        return getRuntimeGlobalValue('SpecialStoneRegistry');
    }

    function getProtectionContextModule() {
        if (ProtectionContextModule) return ProtectionContextModule;
        return getRuntimeGlobalValue('CardProtectionContext');
    }

    if (BLACK === undefined || WHITE === undefined || DIRECTIONS === undefined) {
        throw new Error('SharedConstants (BLACK/WHITE/DIRECTIONS) required');
    }

    function resolveBoardBounds(gameState: any) {
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

    function isMainBoardCell(gameState: any, row: any, col: any) {
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

    function resolveExpansionSide(side: any, row: any, col: any, gameState: any) {
        const bounds = resolveBoardBounds(gameState);
        if (side === 'left' || side === 'right' || side === 'top' || side === 'bottom') return side;
        if (!bounds) return null;
        if (col === -1) return 'left';
        if (col === (bounds.maxCol + 1)) return 'right';
        if (row === -1) return 'top';
        if (row === (bounds.maxRow + 1)) return 'bottom';
        return null;
    }

    function getExpansionCellRef(gameState: any, row: any, col: any) {
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

    function getCellValue(gameState: any, row: any, col: any) {
        if (isMainBoardCell(gameState, row, col)) {
            return (gameState && Array.isArray(gameState.board) && Array.isArray(gameState.board[row]))
                ? gameState.board[row][col]
                : null;
        }
        const ref = getExpansionCellRef(gameState, row, col);
        return ref ? Number(ref.cell.owner) : null;
    }

    function setCellValue(gameState: any, row: any, col: any, value: any) {
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

    function applyRegenWill(cardState: any, playerKey: any, row: any, col: any, deps: any = {}) {
        const addMarker = deps.addMarker || ((cs: any, kind: any, r: any, c: any, owner: any, data: any) => {
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

    function findActiveRegenMarkerAt(cardState: any, row: any, col: any) {
        const markers = Array.isArray(cardState && cardState.markers) ? cardState.markers : [];
        for (const marker of markers) {
            if (!marker || marker.kind !== 'specialStone' || marker.row !== row || marker.col !== col) continue;
            const type = String(marker.data && marker.data.type || '').toUpperCase();
            if (type !== 'REGEN' && type !== 'ZOMBIE') continue;
            if ((Number(marker.data.regenRemaining) || 0) <= 0) continue;
            return marker;
        }
        return null;
    }

    function _getRegenCardContext(cardState: any, deps: any = {}) {
        const getCardContext = typeof deps.getCardContext === 'function'
            ? deps.getCardContext
            : null;
        const buildFallbackCardContext = () => {
            const protectionContext = getProtectionContextModule();
            const specialStoneRegistry = getSpecialStoneRegistryModule();
            if (!protectionContext || typeof protectionContext.buildCardProtectionContext !== 'function') {
                throw new Error('[regen] CardProtectionContext.buildCardProtectionContext not available');
            }
            if (!specialStoneRegistry || typeof specialStoneRegistry.getSpecialStoneInfo !== 'function') {
                throw new Error('[regen] SpecialStoneRegistry.getSpecialStoneInfo not available');
            }
            return protectionContext.buildCardProtectionContext(cardState, {
                constants: SharedConstants,
                SpecialStoneRegistry: specialStoneRegistry,
                getManifestMarkers: () => [],
                getBombMarkers: () => [],
                isAdditionalPermaProtectedMarker(marker: any) {
                    if (!(marker && marker.data)) return false;
                    if (String(marker.data.type || '').toUpperCase() !== 'ULTIMATE_HYPERACTIVE') return false;
                    const remaining = Number(marker.data.remainingOwnerTurns);
                    return !Number.isFinite(remaining) || remaining > 0;
                }
            });
        };
        const clearBombAt = deps.clearBombAt || ((cs: any, r: any, c: any) => {
            const cardMarkers = getCardMarkersModule();
            if (cardMarkers && typeof cardMarkers.removeMarkersAt === 'function') {
                cardMarkers.removeMarkersAt(cs, r, c, { category: 'bomb' });
                return;
            }
            if (cs.markers) cs.markers = cs.markers.filter((m: any) => !(m.kind === 'specialStone' && m.data && m.data.category === 'bomb' && m.row === r && m.col === c));
        });
        const context = getCardContext ? getCardContext(cardState) : buildFallbackCardContext();
        const blockedSet = context.blockedCells ? new Set(context.blockedCells.map((p: any) => `${p.row},${p.col}`)) : null;
        const protSet = context.protectedStones ? new Set(context.protectedStones.map((p: any) => `${p.row},${p.col}`)) : null;
        const permaSet = context.permaProtectedStones ? new Set(context.permaProtectedStones.map((p: any) => `${p.row},${p.col}`)) : null;
        return {
            clearBombAt,
            isBlocked(r: any, c: any) {
                const key = `${r},${c}`;
                if (blockedSet && blockedSet.has(key)) return true;
                if (protSet && protSet.has(key)) return true;
                if (permaSet && permaSet.has(key)) return true;
                return false;
            }
        };
    }

    function _removeConsumedRegenMarker(cardState: any, row: any, col: any, owner: any, markerType: any, deps: any = {}) {
        if (typeof deps.removeMarkersAt === 'function') {
            deps.removeMarkersAt(cardState, row, col, {
                kind: 'specialStone',
                type: markerType,
                owner
            });
            return;
        }
        const cardMarkers = getCardMarkersModule();
        if (cardMarkers && typeof cardMarkers.removeMarkersAt === 'function') {
            cardMarkers.removeMarkersAt(cardState, row, col, {
                kind: 'specialStone',
                type: markerType,
                owner
            });
            return;
        }
        if (Array.isArray(cardState.markers)) {
            cardState.markers = cardState.markers.filter((m: any) => !(
                m &&
                m.kind === 'specialStone' &&
                m.row === row &&
                m.col === col &&
                m.data &&
                String(m.data.type || '').toUpperCase() === markerType
            ));
        }
    }

    function _emitRegenConsumedStatus(cardState: any, row: any, col: any, markerType: any, deps: any = {}) {
        const boardOps = deps.BoardOps || null;
        if (boardOps && typeof boardOps.emitPresentationEvent === 'function') {
            boardOps.emitPresentationEvent(cardState, {
                type: 'STATUS_REMOVED',
                row,
                col,
                cause: 'REGEN',
                reason: 'regen_consumed',
                meta: { special: markerType, reason: 'regen_consumed' }
            });
        }
    }

    function _captureFromRegenOrigin(cardState: any, gameState: any, row: any, col: any, regenOwner: any, ownerColor: any, ctx: any, deps: any = {}) {
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

    function _emitForcedRegenChange(cardState: any, gameState: any, row: any, col: any, ownerKey: any, ownerColor: any, nextRemaining: any, deps: any = {}) {
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

    function _triggerRegenAtPosition(cardState: any, gameState: any, row: any, col: any, triggerKind: any, skipCapture: any, deps: any = {}, ctx: any, consumedRegenKeys: any) {
        const regen = findActiveRegenMarkerAt(cardState, row, col);
        if (!regen) return { triggered: false, regened: [], captureFlips: [] };
        const markerType = String(regen.data && regen.data.type || 'REGEN').toUpperCase();
        const ownerColor = regen.owner === 'black' ? (BLACK || 1) : (WHITE || -1);
        const currentValue = getCellValue(gameState, row, col);
        if (triggerKind !== 'destroy' && currentValue === ownerColor) {
            return { triggered: false, regened: [], captureFlips: [] };
        }

        const nextRemaining = Math.max(0, Number(regen.data.regenRemaining || 0) - 1);
        regen.data.regenRemaining = nextRemaining;
        if (markerType === 'REGEN') {
            regen.data.remainingOwnerTurns = nextRemaining;
        } else if (markerType === 'ZOMBIE' && Array.isArray(cardState.markers)) {
            cardState.markers = cardState.markers.filter((marker: any) => {
                if (marker === regen) return true;
                if (!marker || marker.kind !== 'specialStone') return true;
                if (marker.row !== row || marker.col !== col || marker.owner !== regen.owner) return true;
                return String(marker.data && marker.data.type || '').toUpperCase() !== 'ZOMBIE';
            });
        }

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

        if ((regen.data.regenRemaining || 0) <= 0 && markerType === 'REGEN') {
            const key = `${row},${col}`;
            if (!consumedRegenKeys.has(key)) {
                consumedRegenKeys.add(key);
                _removeConsumedRegenMarker(cardState, row, col, regen.owner, markerType, deps);
                _emitRegenConsumedStatus(cardState, row, col, markerType, deps);
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

    function _removeDepletedZombieAt(cardState: any, gameState: any, row: any, col: any, ownerKey: any, deps: any = {}) {
        if (!cardState || !Array.isArray(cardState.markers)) return;
        const ownerColor = ownerKey === 'black' ? (BLACK || 1) : (WHITE || -1);
        if (getCellValue(gameState, row, col) !== ownerColor) return;
        const marker = cardState.markers.find((candidate: any) =>
            candidate &&
            candidate.kind === 'specialStone' &&
            candidate.row === row &&
            candidate.col === col &&
            String(candidate.data && candidate.data.type || '').toUpperCase() === 'ZOMBIE' &&
            (Number(candidate.data.regenRemaining) || 0) <= 0
        );
        if (!marker) return;
        _removeConsumedRegenMarker(cardState, row, col, marker.owner, 'ZOMBIE', deps);
        _emitRegenConsumedStatus(cardState, row, col, 'ZOMBIE', deps);
    }

    function applyRegenAfterFlips(cardState: any, gameState: any, flips: any, flipperKey: any, skipCapture: any, deps: any = {}) {
        const regened: Array<{row: number; col: number}> = [];
        const captureFlips: Array<{row: number; col: number}> = [];
        if (!flips || !flips.length) return { regened, captureFlips };
        const consumedRegenKeys = new Set();
        const ctx = _getRegenCardContext(cardState, deps);
        const toObj = (p: any) => (typeof p.row === 'number' ? p : { row: p[0], col: p[1] });

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
            if (!result.triggered) {
                _removeDepletedZombieAt(cardState, gameState, pos.row, pos.col, flipperKey, deps);
                continue;
            }
            regened.push(...result.regened);
            captureFlips.push(...result.captureFlips);
        }

        return { regened, captureFlips };
    }

    function applyRegenAfterDestroy(cardState: any, gameState: any, row: any, col: any, triggerMeta: any, deps: any = {}) {
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

export = CardRegen;
