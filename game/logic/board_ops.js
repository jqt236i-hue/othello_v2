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

    function _ensureCardState(cardState) {
        if (!cardState.presentationEvents) cardState.presentationEvents = [];
        if (cardState._nextStoneId === undefined || cardState._nextStoneId === null) cardState._nextStoneId = 1;
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

    function _getSpecialVisualMeta(cardState, row, col) {
        let special = null;
        let timer = null;
        let owner = null;

        if (cardState && Array.isArray(cardState.markers)) {
            const s = MarkersAdapter && typeof MarkersAdapter.findSpecialMarkerAt === 'function'
                ? MarkersAdapter.findSpecialMarkerAt(cardState, row, col)
                : cardState.markers.find(m => m.kind === (MARKER_KINDS ? MARKER_KINDS.SPECIAL_STONE : 'specialStone') && m.row === row && m.col === col);
            if (s) {
                special = (s.data && s.data.type) || null;
                timer = (s.data && typeof s.data.remainingOwnerTurns === 'number') ? s.data.remainingOwnerTurns : null;
                owner = (s.owner !== undefined && s.owner !== null) ? s.owner : null;
                return { special, timer, owner };
            }

            const b = MarkersAdapter && typeof MarkersAdapter.findBombMarkerAt === 'function'
                ? MarkersAdapter.findBombMarkerAt(cardState, row, col)
                : cardState.markers.find(m => m.kind === (MARKER_KINDS ? MARKER_KINDS.BOMB : 'bomb') && m.row === row && m.col === col);
            if (b) {
                special = 'TIME_BOMB';
                timer = (b.data && typeof b.data.remainingTurns === 'number') ? b.data.remainingTurns : null;
                owner = (b.owner !== undefined && b.owner !== null) ? b.owner : null;
                return { special, timer, owner };
            }
        }

        return { special: null, timer: null, owner: null };
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
        try { if (typeof console !== 'undefined' && console.log) console.log('[BOARDOPS] emitPresentationEvent pushed, persist len', cardState._presentationEventsPersist.length); } catch (e) {}

        // Advance the ply index if using metaSource
        if (metaSource && typeof metaSource.plyIndex === 'number') {
            metaSource.plyIndex = metaSource.plyIndex + 1;
        }

        // UI updates are handled by higher-level controllers (no direct UI calls here).
    }

    function spawnAt(cardState, gameState, row, col, ownerKey, cause, reason, meta = {}) {
        _ensureCardState(cardState);
        const ownerVal = ownerKey === 'black' ? (SharedConstants.BLACK || 1) : (SharedConstants.WHITE || -1);
        gameState.board[row][col] = ownerVal;
        const stoneId = allocateStoneId(cardState);

        // Track stoneId in map
        if (!cardState.stoneIdMap) cardState.stoneIdMap = Array(8).fill(null).map(() => Array(8).fill(null));
        cardState.stoneIdMap[row][col] = stoneId;

        const metaOut = Object.assign({}, meta);
        if (metaOut.special === undefined || metaOut.special === null) {
            const visual = _getSpecialVisualMeta(cardState, row, col);
            if (visual.special !== null) metaOut.special = visual.special;
            if (visual.timer !== null) metaOut.timer = visual.timer;
            if (visual.owner !== null) metaOut.owner = visual.owner;
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
        return { stoneId };
    }

    function destroyAt(cardState, gameState, row, col, cause, reason, meta = {}) {
        _ensureCardState(cardState);
        const prev = gameState.board[row][col];
        if (prev === EMPTY) return { destroyed: false };

        let stoneId = null;
        if (cardState.stoneIdMap) {
            stoneId = cardState.stoneIdMap[row][col];
            cardState.stoneIdMap[row][col] = null;
        }

        // clear board
        gameState.board[row][col] = EMPTY;
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
        const prev = gameState.board[row][col];
        const ownerAfterVal = ownerAfterKey === 'black' ? (SharedConstants.BLACK || 1) : (SharedConstants.WHITE || -1);
        if (prev === ownerAfterVal) return { changed: false };

        const stoneId = cardState.stoneIdMap ? cardState.stoneIdMap[row][col] : null;

        gameState.board[row][col] = ownerAfterVal;
        const metaOut = Object.assign({}, meta);
        if (metaOut.special === undefined || metaOut.special === null) {
            const visual = _getSpecialVisualMeta(cardState, row, col);
            if (visual.special !== null) metaOut.special = visual.special;
            if (visual.timer !== null) metaOut.timer = visual.timer;
            if (visual.owner !== null) metaOut.owner = visual.owner;
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
        const prev = gameState.board[fromRow][fromCol];
        if (prev === EMPTY) return { moved: false };
        // If dest occupied, we consider it invalid for now
        if (gameState.board[toRow][toCol] !== EMPTY) return { moved: false, reason: 'dest_not_empty' };

        const stoneId = cardState.stoneIdMap ? cardState.stoneIdMap[fromRow][fromCol] : null;
        if (cardState.stoneIdMap) {
            cardState.stoneIdMap[fromRow][fromCol] = null;
            cardState.stoneIdMap[toRow][toCol] = stoneId;
        }

        gameState.board[fromRow][fromCol] = EMPTY;
        gameState.board[toRow][toCol] = prev;
        const metaOut = Object.assign({}, meta);
        if (metaOut.special === undefined || metaOut.special === null) {
            const visual = _getSpecialVisualMeta(cardState, toRow, toCol);
            if (visual.special !== null) metaOut.special = visual.special;
            if (visual.timer !== null) metaOut.timer = visual.timer;
            if (visual.owner !== null) metaOut.owner = visual.owner;
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
