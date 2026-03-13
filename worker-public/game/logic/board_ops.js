(function (root, factory) {
    if (typeof module === 'object' && module.exports) {
        module.exports = factory(require('../../shared-constants'));
    } else {
        root.BoardOps = factory(root.SharedConstants);
    }
}(typeof self !== 'undefined' ? self : this, function (SharedConstants) {
    'use strict';

    const { EMPTY } = SharedConstants || {};
    const MarkersAdapter = (() => {
        if (typeof require === 'function') {
            try {
                return require('./markers_adapter');
            } catch (e) {
                return null;
            }
        }
        const globalScope = (typeof globalThis !== 'undefined')
            ? globalThis
            : (typeof self !== 'undefined' ? self : (typeof global !== 'undefined' ? global : {}));
        return globalScope.MarkersAdapter || null;
    })();
    const MARKER_KINDS = MarkersAdapter && MarkersAdapter.MARKER_KINDS;

    function isBoardOpsDebugEnabled(cardState) {
        if (cardState && cardState.debugBoardOpsLog === true) return true;
        try {
            if (typeof globalThis !== 'undefined' && globalThis.DEBUG_BOARDOPS_LOG === true) return true;
        } catch (e) { /* ignore */ }
        return false;
    }

    function _ensureCardState(cardState) {
        if (!cardState.presentationEvents) cardState.presentationEvents = [];
        if (cardState._nextStoneId === undefined || cardState._nextStoneId === null) cardState._nextStoneId = 1;
        if (!cardState.expansionStoneIdByCell || typeof cardState.expansionStoneIdByCell !== 'object') cardState.expansionStoneIdByCell = {};
        if (MarkersAdapter && typeof MarkersAdapter.ensureMarkers === 'function') {
            MarkersAdapter.ensureMarkers(cardState);
        } else if (!Array.isArray(cardState.markers)) {
            cardState.markers = [];
        }
    }

    function allocateStoneId(cardState) {
        _ensureCardState(cardState);
        return 's' + String(cardState._nextStoneId++);
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

    function isExpansionCoordinate(row, col) {
        if (!Number.isInteger(row) || !Number.isInteger(col)) return false;
        if (row < -1 || row > 8 || col < -1 || col > 8) return false;
        if (isMainBoardCell(row, col)) return false;
        return true;
    }

    function isMainBoardCorner(row, col) {
        return isMainBoardCell(row, col) && (row === 0 || row === 7) && (col === 0 || col === 7);
    }

    function ensureResultTotals(cardState) {
        if (!cardState || typeof cardState !== 'object') return;
        if (!cardState.totalFlipCountByPlayer || typeof cardState.totalFlipCountByPlayer !== 'object') {
            cardState.totalFlipCountByPlayer = { black: 0, white: 0 };
        }
        if (!cardState.cornerCaptureCountByPlayer || typeof cardState.cornerCaptureCountByPlayer !== 'object') {
            cardState.cornerCaptureCountByPlayer = { black: 0, white: 0 };
        }
        if (!Number.isFinite(Number(cardState.totalFlipCountByPlayer.black))) cardState.totalFlipCountByPlayer.black = 0;
        if (!Number.isFinite(Number(cardState.totalFlipCountByPlayer.white))) cardState.totalFlipCountByPlayer.white = 0;
        if (!Number.isFinite(Number(cardState.cornerCaptureCountByPlayer.black))) cardState.cornerCaptureCountByPlayer.black = 0;
        if (!Number.isFinite(Number(cardState.cornerCaptureCountByPlayer.white))) cardState.cornerCaptureCountByPlayer.white = 0;
    }

    function getExpansionKey(row, col) {
        return `${row},${col}`;
    }

    function normalizeExpansionOwner(owner) {
        return (owner === SharedConstants.BLACK || owner === SharedConstants.WHITE) ? owner : EMPTY;
    }

    function getExpansionDescriptors(gameState) {
        const expansion = (gameState && gameState.boardExpansion && typeof gameState.boardExpansion === 'object')
            ? gameState.boardExpansion
            : null;
        if (!expansion) return [];

        const out = [];
        const pushDescriptor = (source, legacyRow, legacyOwner) => {
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
            if (out.some((desc) => desc && desc.row === row && desc.col === col)) return;
            out.push({
                side: resolveExpansionSide(side, row, col),
                row,
                col,
                owner: normalizeExpansionOwner(owner)
            });
        };

        if (Array.isArray(expansion.cells)) {
            for (const cell of expansion.cells) {
                if (!cell || typeof cell !== 'object') continue;
                pushDescriptor(cell);
            }
        }

        if (out.length === 0 && expansion.active === true) {
            pushDescriptor(expansion);
        }

        return out;
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
        if (!expansion.usedByPlayer || typeof expansion.usedByPlayer !== 'object') {
            expansion.usedByPlayer = { black: false, white: false };
        } else {
            expansion.usedByPlayer.black = !!expansion.usedByPlayer.black;
            expansion.usedByPlayer.white = !!expansion.usedByPlayer.white;
        }
        const descriptors = getExpansionDescriptors(gameState);
        expansion.cells = descriptors.map((desc) => ({
            side: desc.side,
            row: desc.row,
            col: desc.col,
            owner: normalizeExpansionOwner(desc.owner)
        }));
        syncLegacyExpansionFields(expansion);
        return expansion;
    }

    function getExpansionDescriptor(gameState) {
        const descriptors = getExpansionDescriptors(gameState);
        return descriptors.length > 0 ? descriptors[0] : null;
    }

    function isExpansionCell(gameState, row, col) {
        const descriptors = getExpansionDescriptors(gameState);
        return descriptors.some((desc) => desc && desc.row === row && desc.col === col);
    }

    function getCellValue(gameState, row, col) {
        if (isMainBoardCell(row, col)) return gameState.board[row][col];
        const descriptors = getExpansionDescriptors(gameState);
        for (const descriptor of descriptors) {
            if (!descriptor) continue;
            if (descriptor.row === row && descriptor.col === col) {
                return normalizeExpansionOwner(descriptor.owner);
            }
        }
        return null;
    }

    function setCellValue(gameState, row, col, value) {
        if (isMainBoardCell(row, col)) {
            gameState.board[row][col] = value;
            return true;
        }
        const expansion = ensureExpansionStateMutable(gameState);
        if (!Array.isArray(expansion.cells)) return false;
        const normalizedOwner = normalizeExpansionOwner(value);
        for (let i = 0; i < expansion.cells.length; i++) {
            const cell = expansion.cells[i];
            if (!cell) continue;
            const cellCol = Number.isInteger(cell.col)
                ? cell.col
                : (cell.side === 'left' ? -1 : (cell.side === 'right' ? 8 : null));
            if (!Number.isInteger(cellCol)) continue;
            if (cell.row === row && cellCol === col) {
                expansion.cells[i] = {
                    side: resolveExpansionSide(cell.side, cell.row, cellCol),
                    row: cell.row,
                    col: cellCol,
                    owner: normalizedOwner
                };
                syncLegacyExpansionFields(expansion);
                return true;
            }
        }
        return false;
    }

    function getStoneIdAt(cardState, gameState, row, col) {
        if (isMainBoardCell(row, col)) {
            return cardState.stoneIdMap ? cardState.stoneIdMap[row][col] : null;
        }
        if (isExpansionCell(gameState, row, col)) {
            return cardState.expansionStoneIdByCell ? cardState.expansionStoneIdByCell[getExpansionKey(row, col)] : null;
        }
        return null;
    }

    function setStoneIdAt(cardState, gameState, row, col, stoneId) {
        if (isMainBoardCell(row, col)) {
            if (!cardState.stoneIdMap) cardState.stoneIdMap = Array(8).fill(null).map(() => Array(8).fill(null));
            cardState.stoneIdMap[row][col] = stoneId;
            return true;
        }
        if (isExpansionCell(gameState, row, col)) {
            if (!cardState.expansionStoneIdByCell || typeof cardState.expansionStoneIdByCell !== 'object') {
                cardState.expansionStoneIdByCell = {};
            }
            const key = getExpansionKey(row, col);
            if (stoneId === null || stoneId === undefined) {
                delete cardState.expansionStoneIdByCell[key];
            } else {
                cardState.expansionStoneIdByCell[key] = stoneId;
            }
            return true;
        }
        return false;
    }

    function _getSpecialVisualMeta(cardState, row, col) {
        let special = null;
        let timer = null;
        let owner = null;
        let inheritedTimer = null;
        let inheritedOwner = null;

        if (cardState && Array.isArray(cardState.markers)) {
            const markersAtCell = cardState.markers.filter((m) => (
                m &&
                m.kind === (MARKER_KINDS ? MARKER_KINDS.SPECIAL_STONE : 'specialStone') &&
                m.row === row &&
                m.col === col
            ));

            const inherited = markersAtCell.find((m) => (
                m &&
                m.data &&
                String(m.data.type || '').toUpperCase() === 'INHERITED_HYPERACTIVE'
            ));
            if (inherited) {
                inheritedTimer = (inherited.data && typeof inherited.data.remainingOwnerTurns === 'number')
                    ? inherited.data.remainingOwnerTurns
                    : null;
                inheritedOwner = (inherited.owner !== undefined && inherited.owner !== null) ? inherited.owner : null;
            }

            const visualSpecial = markersAtCell.find((m) => {
                const typeUpper = String(m && m.data && m.data.type ? m.data.type : '').toUpperCase();
                if (!typeUpper) return false;
                if (typeUpper === 'GUARD') return false;
                if (typeUpper === 'INHERITED_HYPERACTIVE') return false;
                return true;
            });

            if (visualSpecial) {
                special = (visualSpecial.data && visualSpecial.data.type) || null;
                timer = (visualSpecial.data && typeof visualSpecial.data.remainingOwnerTurns === 'number')
                    ? visualSpecial.data.remainingOwnerTurns
                    : null;
                owner = (visualSpecial.owner !== undefined && visualSpecial.owner !== null) ? visualSpecial.owner : null;
                return { special, timer, owner, inheritedTimer, inheritedOwner };
            }

            const b = MarkersAdapter && typeof MarkersAdapter.findBombMarkerAt === 'function'
                ? MarkersAdapter.findBombMarkerAt(cardState, row, col)
                : cardState.markers.find(m => m.kind === (MARKER_KINDS ? MARKER_KINDS.BOMB : 'bomb') && m.row === row && m.col === col);
            if (b) {
                special = 'TIME_BOMB';
                timer = (b.data && typeof b.data.remainingTurns === 'number') ? b.data.remainingTurns : null;
                owner = (b.owner !== undefined && b.owner !== null) ? b.owner : null;
                return { special, timer, owner, inheritedTimer, inheritedOwner };
            }
        }

        return { special: null, timer: null, owner: null, inheritedTimer, inheritedOwner };
    }

    function emitPresentationEvent(cardState, ev) {
        _ensureCardState(cardState);
        // Populate action meta fields if available on cardState._currentActionMeta
        const metaSource = cardState._currentActionMeta || {};
        const actionId = (ev.actionId !== undefined && ev.actionId !== null) ? ev.actionId : (metaSource.actionId || null);
        const turnIndex = (ev.turnIndex !== undefined && ev.turnIndex !== null) ? ev.turnIndex : (typeof metaSource.turnIndex === 'number' ? metaSource.turnIndex : (cardState.turnIndex || 0));
        const plyIndex = (ev.plyIndex !== undefined && ev.plyIndex !== null) ? ev.plyIndex : (typeof metaSource.plyIndex === 'number' ? metaSource.plyIndex : null);

        const out = Object.assign({}, ev, { actionId, turnIndex, plyIndex });
        cardState.presentationEvents.push(out);
        // Also store a persistent copy for UI-level consumption to avoid races where
        // CardLogic.flushPresentationEvents may be called before the UI handler runs.
        if (!cardState._presentationEventsPersist) cardState._presentationEventsPersist = [];
        cardState._presentationEventsPersist.push(out);
        if (isBoardOpsDebugEnabled(cardState)) {
            try { if (typeof console !== 'undefined' && console.log) console.log('[BOARDOPS] emitPresentationEvent pushed, persist len', cardState._presentationEventsPersist.length); } catch (e) {}
        }

        // Advance the ply index if using metaSource
        if (metaSource && typeof metaSource.plyIndex === 'number') {
            metaSource.plyIndex = metaSource.plyIndex + 1;
        }

        // UI updates are handled by higher-level controllers (no direct UI calls here).
    }

    function spawnAt(cardState, gameState, row, col, ownerKey, cause, reason, meta = {}) {
        _ensureCardState(cardState);
        const ownerVal = ownerKey === 'black' ? (SharedConstants.BLACK || 1) : (SharedConstants.WHITE || -1);
        if (!setCellValue(gameState, row, col, ownerVal)) return { spawned: false };
        const stoneId = allocateStoneId(cardState);

        // Track stoneId in map
        setStoneIdAt(cardState, gameState, row, col, stoneId);

        const metaOut = Object.assign({}, meta);
        if (metaOut.special === undefined || metaOut.special === null) {
            const visual = _getSpecialVisualMeta(cardState, row, col);
            if (visual.special !== null) metaOut.special = visual.special;
            if (visual.timer !== null) metaOut.timer = visual.timer;
            if (visual.owner !== null) metaOut.owner = visual.owner;
            if (visual.inheritedTimer !== null) metaOut.inheritedTimer = visual.inheritedTimer;
            if (visual.inheritedOwner !== null) metaOut.inheritedOwner = visual.inheritedOwner;
        }
        emitPresentationEvent(cardState, {
            type: 'SPAWN',
            stoneId,
            row,
            col,
            ownerAfter: ownerKey,
            cause: cause || null,
            reason: reason || null,
            meta: metaOut
        });
        return { spawned: true, stoneId };
    }

    function destroyAt(cardState, gameState, row, col, cause, reason, meta = {}) {
        _ensureCardState(cardState);
        const prev = getCellValue(gameState, row, col);
        if (prev === EMPTY) return { destroyed: false };
        if (prev === null) return { destroyed: false, reason: 'out_of_board' };
        const ignoreGuard = !!(meta && meta.ignoreGuard === true);

        const guardMarker = Array.isArray(cardState.markers)
            ? cardState.markers.find(m => (
                m &&
                m.kind === (MARKER_KINDS ? MARKER_KINDS.SPECIAL_STONE : 'specialStone') &&
                m.row === row &&
                m.col === col &&
                m.data &&
                m.data.type === 'GUARD'
            ))
            : null;
        if (guardMarker && !ignoreGuard) return { destroyed: false, reason: 'guard_protected' };

        let stoneId = null;
        stoneId = getStoneIdAt(cardState, gameState, row, col);
        setStoneIdAt(cardState, gameState, row, col, null);

        // clear board
        setCellValue(gameState, row, col, EMPTY);
        // remove markers/specials referring to this cell
        if (MarkersAdapter && typeof MarkersAdapter.removeMarkersAt === 'function') {
            MarkersAdapter.removeMarkersAt(cardState, row, col);
        } else if (Array.isArray(cardState.markers)) {
            cardState.markers = cardState.markers.filter(m => !(m.row === row && m.col === col));
        }
        emitPresentationEvent(cardState, {
            type: 'DESTROY',
            stoneId,
            row,
            col,
            ownerBefore: (prev === (SharedConstants.BLACK || 1)) ? 'black' : 'white',
            cause: cause || null,
            reason: reason || null,
            meta
        });
        return { destroyed: true };
    }

    function changeAt(cardState, gameState, row, col, ownerAfterKey, cause, reason, meta = {}) {
        _ensureCardState(cardState);
        const prev = getCellValue(gameState, row, col);
        if (prev === null) return { changed: false, reason: 'out_of_board' };
        const ownerAfterVal = ownerAfterKey === 'black' ? (SharedConstants.BLACK || 1) : (SharedConstants.WHITE || -1);
        if (prev === ownerAfterVal) return { changed: false };
        const ownerBeforeKey = (prev === (SharedConstants.BLACK || 1))
            ? 'black'
            : ((prev === (SharedConstants.WHITE || -1)) ? 'white' : null);

        const stoneId = getStoneIdAt(cardState, gameState, row, col);

        setCellValue(gameState, row, col, ownerAfterVal);
        if (ownerBeforeKey !== null) {
            ensureResultTotals(cardState);
            cardState.totalFlipCountByPlayer[ownerAfterKey] = (cardState.totalFlipCountByPlayer[ownerAfterKey] || 0) + 1;
            if (ownerBeforeKey !== ownerAfterKey && isMainBoardCorner(row, col)) {
                cardState.cornerCaptureCountByPlayer[ownerAfterKey] = (cardState.cornerCaptureCountByPlayer[ownerAfterKey] || 0) + 1;
            }
        }
        const metaOut = Object.assign({}, meta);
        if (metaOut.special === undefined || metaOut.special === null) {
            const visual = _getSpecialVisualMeta(cardState, row, col);
            if (visual.special !== null) metaOut.special = visual.special;
            if (visual.timer !== null) metaOut.timer = visual.timer;
            if (visual.owner !== null) metaOut.owner = visual.owner;
            if (visual.inheritedTimer !== null) metaOut.inheritedTimer = visual.inheritedTimer;
            if (visual.inheritedOwner !== null) metaOut.inheritedOwner = visual.inheritedOwner;
        }

        emitPresentationEvent(cardState, {
            type: 'CHANGE',
            stoneId,
            row,
            col,
            ownerBefore: (prev === (SharedConstants.BLACK || 1)) ? 'black' : 'white',
            ownerAfter: ownerAfterKey,
            cause: cause || null,
            reason: reason || null,
            meta: metaOut
        });
        return { changed: true };
    }

    function moveAt(cardState, gameState, fromRow, fromCol, toRow, toCol, cause, reason, meta = {}) {
        _ensureCardState(cardState);
        const prev = getCellValue(gameState, fromRow, fromCol);
        if (prev === EMPTY) return { moved: false };
        if (prev === null) return { moved: false, reason: 'from_out_of_board' };
        // If dest occupied, we consider it invalid for now
        const destVal = getCellValue(gameState, toRow, toCol);
        if (destVal === null) return { moved: false, reason: 'to_out_of_board' };
        if (destVal !== EMPTY) return { moved: false, reason: 'dest_not_empty' };

        const stoneId = getStoneIdAt(cardState, gameState, fromRow, fromCol);
        setStoneIdAt(cardState, gameState, fromRow, fromCol, null);
        setStoneIdAt(cardState, gameState, toRow, toCol, stoneId);

        setCellValue(gameState, fromRow, fromCol, EMPTY);
        setCellValue(gameState, toRow, toCol, prev);
        const metaOut = Object.assign({}, meta);
        if (metaOut.special === undefined || metaOut.special === null) {
            const visual = _getSpecialVisualMeta(cardState, toRow, toCol);
            if (visual.special !== null) metaOut.special = visual.special;
            if (visual.timer !== null) metaOut.timer = visual.timer;
            if (visual.owner !== null) metaOut.owner = visual.owner;
            if (visual.inheritedTimer !== null) metaOut.inheritedTimer = visual.inheritedTimer;
            if (visual.inheritedOwner !== null) metaOut.inheritedOwner = visual.inheritedOwner;
        }
        emitPresentationEvent(cardState, {
            type: 'MOVE',
            stoneId,
            row: toRow,
            col: toCol,
            prevRow: fromRow,
            prevCol: fromCol,
            ownerBefore: (prev === (SharedConstants.BLACK || 1)) ? 'black' : 'white',
            ownerAfter: (prev === (SharedConstants.BLACK || 1)) ? 'black' : 'white',
            cause: cause || null,
            reason: reason || null,
            meta: metaOut
        });
        return { moved: true };
    }

    function setActionContext(cardState, meta) {
        _ensureCardState(cardState);
        cardState._currentActionMeta = meta;
    }

    function clearActionContext(cardState) {
        if (cardState && cardState._currentActionMeta !== undefined) delete cardState._currentActionMeta;
    }

    return {
        spawnAt,
        destroyAt,
        changeAt,
        moveAt,
        allocateStoneId,
        emitPresentationEvent,
        setActionContext,
        clearActionContext
    };
}));
