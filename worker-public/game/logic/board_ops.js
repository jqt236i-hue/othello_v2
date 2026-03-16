(function (root, factory) {
    if (typeof module === 'object' && module.exports) {
        let CardExpansionModule = null;
        let CardMarkersModule = null;
        try {
            CardExpansionModule = require('./cards/expansion');
        } catch (e) { /* ignore */ }
        try {
            CardMarkersModule = require('./cards/markers');
        } catch (e) { /* ignore */ }
        module.exports = factory(require('../../shared-constants'), CardExpansionModule, CardMarkersModule);
    } else {
        root.BoardOps = factory(root.SharedConstants, root.CardExpansion || null, root.CardMarkers || null);
    }
}(typeof self !== 'undefined' ? self : this, function (SharedConstants, CardExpansionModule, CardMarkersModule) {
    'use strict';

    const { EMPTY } = SharedConstants || {};
    function getGlobalScope() {
        return (typeof globalThis !== 'undefined')
            ? globalThis
            : (typeof self !== 'undefined' ? self : (typeof global !== 'undefined' ? global : {}));
    }

    function getCardExpansionModule() {
        if (CardExpansionModule) return CardExpansionModule;
        const globalScope = getGlobalScope();
        return globalScope.CardExpansion || null;
    }

    function getCardMarkersModule() {
        if (CardMarkersModule) return CardMarkersModule;
        const globalScope = getGlobalScope();
        return globalScope.CardMarkers || null;
    }

    const MarkersAdapter = (() => {
        if (typeof require === 'function') {
            try {
                return require('./markers_adapter');
            } catch (e) {
                return null;
            }
        }
        const globalScope = getGlobalScope();
        return globalScope.MarkersAdapter || null;
    })();
    const MARKER_KINDS = (CardMarkersModule && CardMarkersModule.MARKER_KINDS)
        || (MarkersAdapter && MarkersAdapter.MARKER_KINDS);

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
        const cardMarkers = getCardMarkersModule();
        if (cardMarkers && typeof cardMarkers.ensureMarkers === 'function') {
            cardMarkers.ensureMarkers(cardState);
        } else if (MarkersAdapter && typeof MarkersAdapter.ensureMarkers === 'function') {
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
        const cardExpansion = getCardExpansionModule();
        if (cardExpansion && typeof cardExpansion.isMainBoardCellForCard === 'function') {
            return cardExpansion.isMainBoardCellForCard(row, col);
        }
        return Number.isInteger(row) && Number.isInteger(col) && row >= 0 && row < 8 && col >= 0 && col < 8;
    }

    function resolveExpansionSide(side, row, col) {
        const cardExpansion = getCardExpansionModule();
        if (cardExpansion && typeof cardExpansion.resolveExpansionSideForCard === 'function') {
            return cardExpansion.resolveExpansionSideForCard(side, row, col);
        }
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
        const cardExpansion = getCardExpansionModule();
        if (cardExpansion && typeof cardExpansion.normalizeExpansionOwnerForCard === 'function') {
            return cardExpansion.normalizeExpansionOwnerForCard(owner);
        }
        return (owner === SharedConstants.BLACK || owner === SharedConstants.WHITE) ? owner : EMPTY;
    }

    function getExpansionDescriptors(gameState) {
        const cardExpansion = getCardExpansionModule();
        if (cardExpansion && typeof cardExpansion.getExpansionDescriptorsForCard === 'function') {
            return cardExpansion.getExpansionDescriptorsForCard(gameState);
        }
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
        const cardExpansion = getCardExpansionModule();
        if (cardExpansion && typeof cardExpansion.syncLegacyExpansionFieldsForCard === 'function') {
            cardExpansion.syncLegacyExpansionFieldsForCard(expansion);
            return;
        }
        if (!expansion || typeof expansion !== 'object') return;
        if (!Array.isArray(expansion.cells)) expansion.cells = [];
        const latest = expansion.cells.length > 0 ? expansion.cells[expansion.cells.length - 1] : null;
        expansion.active = !!latest;
        expansion.side = latest ? resolveExpansionSide(latest.side, latest.row, latest.col) : null;
        expansion.row = latest ? latest.row : null;
        expansion.owner = latest ? normalizeExpansionOwner(latest.owner) : EMPTY;
    }

    function ensureExpansionStateMutable(gameState) {
        const cardExpansion = getCardExpansionModule();
        if (cardExpansion && typeof cardExpansion.ensureMutableBoardExpansionForCard === 'function') {
            return cardExpansion.ensureMutableBoardExpansionForCard(gameState);
        }
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
        const cardExpansion = getCardExpansionModule();
        if (cardExpansion && typeof cardExpansion.getCellValueForCard === 'function') {
            return cardExpansion.getCellValueForCard(gameState, row, col);
        }
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
        const cardExpansion = getCardExpansionModule();
        if (cardExpansion && typeof cardExpansion.setCellValueForCard === 'function') {
            return cardExpansion.setCellValueForCard(gameState, row, col, value);
        }
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
        const cardMarkers = getCardMarkersModule();
        if (cardMarkers && typeof cardMarkers.getStoneIdAtForCard === 'function') {
            return cardMarkers.getStoneIdAtForCard(cardState, gameState, row, col);
        }
        if (isMainBoardCell(row, col)) {
            return cardState.stoneIdMap ? cardState.stoneIdMap[row][col] : null;
        }
        if (isExpansionCell(gameState, row, col)) {
            return cardState.expansionStoneIdByCell ? cardState.expansionStoneIdByCell[getExpansionKey(row, col)] : null;
        }
        return null;
    }

    function setStoneIdAt(cardState, gameState, row, col, stoneId) {
        const cardMarkers = getCardMarkersModule();
        if (cardMarkers && typeof cardMarkers.setStoneIdAtForCard === 'function') {
            return cardMarkers.setStoneIdAtForCard(cardState, gameState, row, col, stoneId);
        }
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

    function _normalizeCounterValue(value) {
        if (value === null || value === undefined || value === '') return null;
        const numeric = Number(value);
        if (!Number.isFinite(numeric)) return null;
        return Math.max(0, Math.trunc(numeric));
    }

    function _normalizeBoardIndex(value) {
        if (value === null || value === undefined || value === '') return null;
        const numeric = Number(value);
        if (!Number.isFinite(numeric)) return null;
        return Math.trunc(numeric);
    }

    function _normalizeCellPosition(row, col) {
        const normalizedRow = _normalizeBoardIndex(row);
        const normalizedCol = _normalizeBoardIndex(col);
        if (normalizedRow === null || normalizedCol === null) return null;
        return { row: normalizedRow, col: normalizedCol };
    }

    function _getSpecialMarkersAt(cardState, row, col) {
        const pos = _normalizeCellPosition(row, col);
        if (!pos) return [];
        const cardMarkers = getCardMarkersModule();
        const markers = (cardMarkers && typeof cardMarkers.getSpecialMarkers === 'function')
            ? cardMarkers.getSpecialMarkers(cardState)
            : ((!cardState || !Array.isArray(cardState.markers))
                ? []
                : cardState.markers.filter((m) => (
                    m &&
                    m.kind === (MARKER_KINDS ? MARKER_KINDS.SPECIAL_STONE : 'specialStone')
                )));
        return markers.filter((m) => (
            m &&
            _normalizeBoardIndex(m.row) === pos.row &&
            _normalizeBoardIndex(m.col) === pos.col
        ));
    }

    function _isBlockingMarkerType(type) {
        const typeUpper = String(type || '').toUpperCase();
        return typeUpper === 'BLOCKADE' || typeUpper === 'METEOR_HOLE' || typeUpper === 'FREEZE';
    }

    function _isFrozenCell(cardState, row, col) {
        const cardMarkers = getCardMarkersModule();
        if (cardMarkers && typeof cardMarkers.isFrozenCellForCard === 'function') {
            return !!cardMarkers.isFrozenCellForCard(cardState, row, col);
        }
        const markers = _getSpecialMarkersAt(cardState, row, col);
        return markers.some((marker) => String(marker && marker.data && marker.data.type ? marker.data.type : '').toUpperCase() === 'FREEZE');
    }

    function _isBlockedDestinationCell(cardState, row, col) {
        const cardMarkers = getCardMarkersModule();
        if (cardMarkers && typeof cardMarkers.getBlockingMarkers === 'function') {
            return cardMarkers.getBlockingMarkers(cardState).some((marker) => (
                marker &&
                _normalizeBoardIndex(marker.row) === row &&
                _normalizeBoardIndex(marker.col) === col
            ));
        }
        const markers = _getSpecialMarkersAt(cardState, row, col);
        return markers.some((marker) => _isBlockingMarkerType(marker && marker.data && marker.data.type));
    }

    function _getDestroyEvadeMarkerAt(cardState, row, col) {
        const markersAtCell = _getSpecialMarkersAt(cardState, row, col);
        let bestMarker = null;
        let bestCreatedSeq = Number.POSITIVE_INFINITY;
        for (const marker of markersAtCell) {
            const remaining = _normalizeCounterValue(marker && marker.data && marker.data.destroyEvadeRemaining);
            if (remaining === null || remaining <= 0) continue;
            const createdSeq = Number.isFinite(Number(marker && marker.createdSeq))
                ? Number(marker.createdSeq)
                : Number.POSITIVE_INFINITY;
            if (bestMarker === null || createdSeq < bestCreatedSeq) {
                bestCreatedSeq = createdSeq;
                bestMarker = marker;
            }
        }
        return bestMarker;
    }

    function _collectAllBoardCoordinates(gameState) {
        const coords = [];
        for (let row = 0; row < 8; row++) {
            for (let col = 0; col < 8; col++) {
                coords.push({ row, col });
            }
        }
        const expansions = getExpansionDescriptors(gameState);
        for (const expansion of expansions) {
            if (!expansion) continue;
            coords.push({ row: expansion.row, col: expansion.col });
        }
        return coords;
    }

    function _getChebyshevDistance(fromRow, fromCol, toRow, toCol) {
        return Math.max(Math.abs(Number(fromRow) - Number(toRow)), Math.abs(Number(fromCol) - Number(toCol)));
    }

    function _getManhattanDistance(fromRow, fromCol, toRow, toCol) {
        return Math.abs(Number(fromRow) - Number(toRow)) + Math.abs(Number(fromCol) - Number(toCol));
    }

    function _getForbiddenDestroyEvadeCellSet(meta) {
        const out = new Set();
        const cells = meta && Array.isArray(meta.forbiddenEvadeCells) ? meta.forbiddenEvadeCells : [];
        for (const cell of cells) {
            if (!cell) continue;
            const pos = _normalizeCellPosition(cell.row, cell.col);
            if (!pos) continue;
            out.add(`${pos.row},${pos.col}`);
        }
        return out;
    }

    function _findDestroyEvadeDestination(cardState, gameState, row, col, meta) {
        const forbiddenCells = _getForbiddenDestroyEvadeCellSet(meta);
        const candidates = [];
        for (const cell of _collectAllBoardCoordinates(gameState)) {
            if (!cell) continue;
            if (cell.row === row && cell.col === col) continue;
            if (forbiddenCells.has(`${cell.row},${cell.col}`)) continue;
            const value = getCellValue(gameState, cell.row, cell.col);
            if (value !== EMPTY) continue;
            if (_isBlockedDestinationCell(cardState, cell.row, cell.col)) continue;
            candidates.push({
                row: cell.row,
                col: cell.col,
                chebyshev: _getChebyshevDistance(row, col, cell.row, cell.col),
                manhattan: _getManhattanDistance(row, col, cell.row, cell.col)
            });
        }
        if (!candidates.length) return null;
        candidates.sort((a, b) => {
            if (a.chebyshev !== b.chebyshev) return a.chebyshev - b.chebyshev;
            if (a.manhattan !== b.manhattan) return a.manhattan - b.manhattan;
            if (a.row !== b.row) return a.row - b.row;
            return a.col - b.col;
        });
        return { row: candidates[0].row, col: candidates[0].col };
    }

    function _moveCellMarkers(cardState, fromRow, fromCol, toRow, toCol) {
        if (!cardState || !Array.isArray(cardState.markers)) return;
        for (const marker of cardState.markers) {
            if (!marker || marker.row !== fromRow || marker.col !== fromCol) continue;
            if (_isBlockingMarkerType(marker && marker.data && marker.data.type)) continue;
            marker.row = toRow;
            marker.col = toCol;
        }
    }

    function _shouldSkipDestroyEvade(cause, reason, meta) {
        if (meta && (meta.ignoreDestroyEvade === true || meta.evade === true)) return true;
        const normalizedReason = String(reason || '').toLowerCase();
        return normalizedReason === 'anchor_expired'
            || normalizedReason === 'duration_end'
            || normalizedReason.indexOf('expire') >= 0;
    }

    function _resolveSpecialDisplayTimerValue(markerData) {
        const primaryTimer = _normalizeCounterValue(markerData && markerData.remainingOwnerTurns);
        if (primaryTimer !== null) return primaryTimer;
        if (String(markerData && markerData.type ? markerData.type : '').toUpperCase() === 'REGEN') {
            return _normalizeCounterValue(markerData && markerData.regenRemaining);
        }
        return null;
    }

    function _getSpecialVisualMeta(cardState, row, col) {
        let special = null;
        let timer = null;
        let owner = null;
        let inheritedTimer = null;
        let inheritedOwner = null;
        let flipEvadeRemaining = null;
        let inheritedFlipEvadeRemaining = null;
        let destroyEvadeRemaining = null;

        if (cardState && Array.isArray(cardState.markers)) {
            const markersAtCell = _getSpecialMarkersAt(cardState, row, col);
            const destroyEvadeTotal = markersAtCell.reduce((sum, marker) => {
                const remaining = _normalizeCounterValue(marker && marker.data && marker.data.destroyEvadeRemaining);
                return remaining === null ? sum : (sum + remaining);
            }, 0);
            if (destroyEvadeTotal > 0 || markersAtCell.some((marker) => _normalizeCounterValue(marker && marker.data && marker.data.destroyEvadeRemaining) === 0)) {
                destroyEvadeRemaining = destroyEvadeTotal;
            }

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
                inheritedFlipEvadeRemaining = _normalizeCounterValue(inherited.data && inherited.data.flipEvadeRemaining);
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
                timer = _resolveSpecialDisplayTimerValue(visualSpecial.data);
                owner = (visualSpecial.owner !== undefined && visualSpecial.owner !== null) ? visualSpecial.owner : null;
                flipEvadeRemaining = _normalizeCounterValue(visualSpecial.data && visualSpecial.data.flipEvadeRemaining);
                return {
                    special,
                    timer,
                    owner,
                    inheritedTimer,
                    inheritedOwner,
                    flipEvadeRemaining,
                    inheritedFlipEvadeRemaining,
                    destroyEvadeRemaining
                };
            }

            const cardMarkers = getCardMarkersModule();
            const b = cardMarkers && typeof cardMarkers.findBombMarkerAt === 'function'
                ? cardMarkers.findBombMarkerAt(cardState, row, col)
                : (MarkersAdapter && typeof MarkersAdapter.findBombMarkerAt === 'function'
                    ? MarkersAdapter.findBombMarkerAt(cardState, row, col)
                    : cardState.markers.find(m => m.kind === (MARKER_KINDS ? MARKER_KINDS.BOMB : 'bomb') && m.row === row && m.col === col))
                ;
            if (b) {
                special = 'TIME_BOMB';
                timer = (b.data && typeof b.data.remainingTurns === 'number') ? b.data.remainingTurns : null;
                owner = (b.owner !== undefined && b.owner !== null) ? b.owner : null;
                return {
                    special,
                    timer,
                    owner,
                    inheritedTimer,
                    inheritedOwner,
                    flipEvadeRemaining,
                    inheritedFlipEvadeRemaining,
                    destroyEvadeRemaining
                };
            }
        }

        return {
            special: null,
            timer: null,
            owner: null,
            inheritedTimer,
            inheritedOwner,
            flipEvadeRemaining,
            inheritedFlipEvadeRemaining,
            destroyEvadeRemaining
        };
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
        const pos = _normalizeCellPosition(row, col);
        if (!pos) return { spawned: false, reason: 'out_of_board' };
        row = pos.row;
        col = pos.col;
        if (_isBlockedDestinationCell(cardState, row, col)) return { spawned: false, reason: 'blocked_destination' };
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
            if (visual.flipEvadeRemaining !== null) metaOut.flipEvadeRemaining = visual.flipEvadeRemaining;
            if (visual.inheritedFlipEvadeRemaining !== null) metaOut.inheritedFlipEvadeRemaining = visual.inheritedFlipEvadeRemaining;
            if (visual.destroyEvadeRemaining !== null) metaOut.destroyEvadeRemaining = visual.destroyEvadeRemaining;
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
        const pos = _normalizeCellPosition(row, col);
        if (!pos) return { destroyed: false, reason: 'out_of_board' };
        row = pos.row;
        col = pos.col;
        const prev = getCellValue(gameState, row, col);
        if (prev === EMPTY) return { destroyed: false };
        if (prev === null) return { destroyed: false, reason: 'out_of_board' };
        const ignoreGuard = !!(meta && meta.ignoreGuard === true);
        const cardMarkers = getCardMarkersModule();

        const guardMarker = cardMarkers && typeof cardMarkers.findSpecialMarkerAt === 'function'
            ? cardMarkers.findSpecialMarkerAt(cardState, row, col, 'GUARD')
            : (Array.isArray(cardState.markers)
                ? cardState.markers.find(m => (
                    m &&
                    m.kind === (MARKER_KINDS ? MARKER_KINDS.SPECIAL_STONE : 'specialStone') &&
                    m.row === row &&
                    m.col === col &&
                    m.data &&
                    m.data.type === 'GUARD'
                ))
                : null)
            ;
        if (guardMarker && !ignoreGuard) return { destroyed: false, reason: 'guard_protected' };
        if (_isFrozenCell(cardState, row, col)) return { destroyed: false, reason: 'frozen_protected' };

        const destroyEvadeMarker = _shouldSkipDestroyEvade(cause, reason, meta)
            ? null
            : _getDestroyEvadeMarkerAt(cardState, row, col);
        if (destroyEvadeMarker) {
            const destination = _findDestroyEvadeDestination(cardState, gameState, row, col, meta);
            if (destination) {
                const beforeRemaining = _normalizeCounterValue(destroyEvadeMarker.data && destroyEvadeMarker.data.destroyEvadeRemaining) || 0;
                const afterRemaining = Math.max(0, beforeRemaining - 1);
                destroyEvadeMarker.data.destroyEvadeRemaining = afterRemaining;
                const visual = _getSpecialVisualMeta(cardState, row, col);
                const moveMeta = Object.assign({}, meta, {
                    special: visual.special !== null ? visual.special : ((destroyEvadeMarker.data && destroyEvadeMarker.data.type) || null),
                    timer: visual.timer !== null ? visual.timer : null,
                    owner: visual.owner !== null ? visual.owner : ((destroyEvadeMarker.owner !== undefined && destroyEvadeMarker.owner !== null) ? destroyEvadeMarker.owner : null),
                    inheritedTimer: visual.inheritedTimer !== null ? visual.inheritedTimer : null,
                    inheritedOwner: visual.inheritedOwner !== null ? visual.inheritedOwner : null,
                    flipEvadeRemaining: visual.flipEvadeRemaining !== null ? visual.flipEvadeRemaining : null,
                    inheritedFlipEvadeRemaining: visual.inheritedFlipEvadeRemaining !== null ? visual.inheritedFlipEvadeRemaining : null,
                    destroyEvadeRemaining: afterRemaining,
                    destroyEvadeTriggeredBy: cause || null,
                    destroyEvadeTriggerReason: reason || null,
                    destroyEvadeOriginRow: row,
                    destroyEvadeOriginCol: col
                });
                const moveResult = moveAt(
                    cardState,
                    gameState,
                    row,
                    col,
                    destination.row,
                    destination.col,
                    'DESTROY_EVADE',
                    'destroy_evade_move',
                    moveMeta
                );
                if (moveResult && moveResult.moved) {
                    _moveCellMarkers(cardState, row, col, destination.row, destination.col);
                    return {
                        destroyed: false,
                        evaded: true,
                        reason: 'destroy_evaded',
                        from: { row, col },
                        to: { row: destination.row, col: destination.col }
                    };
                }
                destroyEvadeMarker.data.destroyEvadeRemaining = beforeRemaining;
            }
        }

        let stoneId = null;
        stoneId = getStoneIdAt(cardState, gameState, row, col);
        setStoneIdAt(cardState, gameState, row, col, null);

        // clear board
        setCellValue(gameState, row, col, EMPTY);
        // remove markers/specials referring to this cell
        if (cardMarkers && typeof cardMarkers.removeMarkersAt === 'function') {
            cardMarkers.removeMarkersAt(cardState, row, col);
        } else if (MarkersAdapter && typeof MarkersAdapter.removeMarkersAt === 'function') {
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
        return { destroyed: true, evaded: false };
    }

    function changeAt(cardState, gameState, row, col, ownerAfterKey, cause, reason, meta = {}) {
        _ensureCardState(cardState);
        const pos = _normalizeCellPosition(row, col);
        if (!pos) return { changed: false, reason: 'out_of_board' };
        row = pos.row;
        col = pos.col;
        const prev = getCellValue(gameState, row, col);
        if (prev === null) return { changed: false, reason: 'out_of_board' };
        const ownerAfterVal = ownerAfterKey === 'black' ? (SharedConstants.BLACK || 1) : (SharedConstants.WHITE || -1);
        if (prev === ownerAfterVal) return { changed: false };
        if (_isFrozenCell(cardState, row, col)) return { changed: false, reason: 'frozen_protected' };
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
            if (visual.flipEvadeRemaining !== null) metaOut.flipEvadeRemaining = visual.flipEvadeRemaining;
            if (visual.inheritedFlipEvadeRemaining !== null) metaOut.inheritedFlipEvadeRemaining = visual.inheritedFlipEvadeRemaining;
            if (visual.destroyEvadeRemaining !== null) metaOut.destroyEvadeRemaining = visual.destroyEvadeRemaining;
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
        const fromPos = _normalizeCellPosition(fromRow, fromCol);
        const toPos = _normalizeCellPosition(toRow, toCol);
        if (!fromPos) return { moved: false, reason: 'from_out_of_board' };
        if (!toPos) return { moved: false, reason: 'to_out_of_board' };
        fromRow = fromPos.row;
        fromCol = fromPos.col;
        toRow = toPos.row;
        toCol = toPos.col;
        const prev = getCellValue(gameState, fromRow, fromCol);
        if (prev === EMPTY) return { moved: false };
        if (prev === null) return { moved: false, reason: 'from_out_of_board' };
        if (_isFrozenCell(cardState, fromRow, fromCol)) return { moved: false, reason: 'frozen_source' };
        // If dest occupied, we consider it invalid for now
        const destVal = getCellValue(gameState, toRow, toCol);
        if (destVal === null) return { moved: false, reason: 'to_out_of_board' };
        if (destVal !== EMPTY) return { moved: false, reason: 'dest_not_empty' };
        if (_isBlockedDestinationCell(cardState, toRow, toCol)) return { moved: false, reason: 'blocked_destination' };

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
            if (visual.flipEvadeRemaining !== null) metaOut.flipEvadeRemaining = visual.flipEvadeRemaining;
            if (visual.inheritedFlipEvadeRemaining !== null) metaOut.inheritedFlipEvadeRemaining = visual.inheritedFlipEvadeRemaining;
            if (visual.destroyEvadeRemaining !== null) metaOut.destroyEvadeRemaining = visual.destroyEvadeRemaining;
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
        getExpansionDescriptors,
        getCellValue,
        setCellValue,
        isExpansionCell,
        isMainBoardCell,
        allocateStoneId,
        emitPresentationEvent,
        setActionContext,
        clearActionContext
    };
}));
