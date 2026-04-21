(function (root, factory) {
    if (typeof module === 'object' && module.exports) {
        let CardExpansionModule = null;
        let CardMarkersModule = null;
        let SharedBoardUtilsModule = null;
        try {
            CardExpansionModule = require('./cards/expansion');
        } catch (e) { /* ignore */ }
        try {
            CardMarkersModule = require('./cards/markers');
        } catch (e) { /* ignore */ }
        try {
            SharedBoardUtilsModule = require('../../shared/shared-board-utils');
        } catch (e) { /* ignore */ }
        module.exports = factory(require('../../shared-constants'), CardExpansionModule, CardMarkersModule, SharedBoardUtilsModule);
    } else {
        root.BoardOps = factory(root.SharedConstants, root.CardExpansion || null, root.CardMarkers || null, root.SharedBoardUtils || null);
    }
}(typeof self !== 'undefined' ? self : this, function (SharedConstants, CardExpansionModule, CardMarkersModule, SharedBoardUtils) {
    'use strict';

    const { EMPTY } = SharedConstants || {};
    const BoardUtils = SharedBoardUtils || null;
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

    function getSpecialStoneRegistryModule() {
        if (typeof require === 'function') {
            try {
                return require('../../shared/special-stone-registry');
            } catch (e) { /* ignore */ }
        }
        const globalScope = getGlobalScope();
        return globalScope.SpecialStoneRegistry || null;
    }

    function isOverlayOnlySpecialStoneType(type) {
        const registry = getSpecialStoneRegistryModule();
        if (registry && typeof registry.isOverlayOnlySpecialStoneType === 'function') {
            return registry.isOverlayOnlySpecialStoneType(type);
        }
        const typeUpper = String(type || '').toUpperCase();
        return typeUpper === 'GUARD' || typeUpper === 'INHERITED_HYPERACTIVE' || typeUpper === 'LIVING_WILL';
    }

    function getCardRegenModule() {
        if (typeof require === 'function') {
            try {
                return require('./cards/regen');
            } catch (e) {
                // Browser globals are checked below.
            }
        }
        const globalScope = getGlobalScope();
        return globalScope.CardRegen || null;
    }

    function getCardLivingWillModule() {
        if (typeof require === 'function') {
            try {
                return require('./cards/living_will');
            } catch (e) {
                // Browser globals are checked below.
            }
        }
        const globalScope = getGlobalScope();
        return globalScope.CardLivingWill || null;
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
    const DestroyOutcomeContract = (() => {
        if (typeof require === 'function') {
            try {
                return require('../../shared/destroy-outcome-contract');
            } catch (e) {
                return null;
            }
        }
        const globalScope = getGlobalScope();
        return globalScope.DestroyOutcomeContract || null;
    })();
    const StoneStatusSnapshot = (() => {
        if (typeof require === 'function') {
            try {
                return require('../../shared/stone-status-snapshot');
            } catch (e) {
                return null;
            }
        }
        const globalScope = getGlobalScope();
        return globalScope.StoneStatusSnapshot || null;
    })();
    const DESTROY_OUTCOME_KINDS = (DestroyOutcomeContract && DestroyOutcomeContract.DESTROY_OUTCOME_KINDS)
        || Object.freeze({
            DESTROYED: 'destroyed',
            REGENERATED: 'regenerated',
            LIVING_WILL_RESTORED: 'living_will_restored',
            GHOST_BLOCKED: 'ghost_blocked',
            PROLIFERATED: 'proliferated',
            EVADED_MOVE: 'evaded_move'
        });

    function getDestroyOutcomeKind(result) {
        if (DestroyOutcomeContract && typeof DestroyOutcomeContract.getDestroyOutcomeKind === 'function') {
            return DestroyOutcomeContract.getDestroyOutcomeKind(result);
        }
        if (!result || typeof result !== 'object') return null;
        if (result.livingWillRevived === true) return DESTROY_OUTCOME_KINDS.LIVING_WILL_RESTORED;
        if (result.regenerated === true) return DESTROY_OUTCOME_KINDS.REGENERATED;
        if (result.proliferated === true) return DESTROY_OUTCOME_KINDS.PROLIFERATED;
        if (result.blockedByGhost === true) return DESTROY_OUTCOME_KINDS.GHOST_BLOCKED;
        if (result.evaded === true) return DESTROY_OUTCOME_KINDS.EVADED_MOVE;
        if (result.destroyed === true) return DESTROY_OUTCOME_KINDS.DESTROYED;
        return null;
    }

    function createDestroyOutcome(kindOrResult, details) {
        if (DestroyOutcomeContract && typeof DestroyOutcomeContract.createDestroyOutcome === 'function') {
            return DestroyOutcomeContract.createDestroyOutcome(kindOrResult, details);
        }
        const source = (typeof kindOrResult === 'string')
            ? Object.assign({}, (details && typeof details === 'object') ? details : {}, { kind: kindOrResult })
            : Object.assign({}, (kindOrResult && typeof kindOrResult === 'object') ? kindOrResult : {});
        const kind = getDestroyOutcomeKind(source) || (typeof kindOrResult === 'string' ? kindOrResult : null);
        const outcome = Object.assign({}, source, {
            destroyed: kind === DESTROY_OUTCOME_KINDS.DESTROYED || source.destroyed === true,
            regenerated: kind === DESTROY_OUTCOME_KINDS.REGENERATED || source.regenerated === true,
            livingWillRevived: kind === DESTROY_OUTCOME_KINDS.LIVING_WILL_RESTORED || source.livingWillRevived === true,
            evaded: kind === DESTROY_OUTCOME_KINDS.EVADED_MOVE || source.evaded === true,
            blockedByGhost: kind === DESTROY_OUTCOME_KINDS.GHOST_BLOCKED || source.blockedByGhost === true,
            proliferated: kind === DESTROY_OUTCOME_KINDS.PROLIFERATED || source.proliferated === true
        });
        if (kind) outcome.kind = kind;
        if (outcome.to && typeof outcome.destination === 'undefined') outcome.destination = outcome.to;
        return outcome;
    }

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

    function resolveBoardDims(gameState, cardState) {
        const boardSource = (gameState && Array.isArray(gameState.board))
            ? gameState
            : (cardState && Array.isArray(cardState.stoneIdMap) ? cardState : (gameState || cardState));
        if (BoardUtils && typeof BoardUtils.resolveBoardConfig === 'function') {
            const config = BoardUtils.resolveBoardConfig(boardSource);
            return { rows: config.rows, cols: config.cols };
        }
        const board = (gameState && Array.isArray(gameState.board))
            ? gameState.board
            : (cardState && Array.isArray(cardState.stoneIdMap) ? cardState.stoneIdMap : null);
        const rows = Array.isArray(board) && board.length > 0 ? board.length : 8;
        const cols = Array.isArray(board) && Array.isArray(board[0]) && board[0].length > 0 ? board[0].length : rows;
        return { rows, cols };
    }

    function isMainBoardCell(row, col, boardOrState) {
        const cardExpansion = getCardExpansionModule();
        if (cardExpansion && typeof cardExpansion.isMainBoardCellForCard === 'function') {
            return cardExpansion.isMainBoardCellForCard(row, col, boardOrState);
        }
        const dims = resolveBoardDims(boardOrState, boardOrState);
        return Number.isInteger(row) && Number.isInteger(col) && row >= 0 && row < dims.rows && col >= 0 && col < dims.cols;
    }

    function resolveExpansionSide(side, row, col, boardOrState) {
        const cardExpansion = getCardExpansionModule();
        if (cardExpansion && typeof cardExpansion.resolveExpansionSideForCard === 'function') {
            return cardExpansion.resolveExpansionSideForCard(side, row, col, boardOrState);
        }
        if (side === 'left' || side === 'right' || side === 'top' || side === 'bottom') return side;
        const dims = resolveBoardDims(boardOrState, boardOrState);
        if (col === -1) return 'left';
        if (col === dims.cols) return 'right';
        if (row === -1) return 'top';
        if (row === dims.rows) return 'bottom';
        return null;
    }

    function isExpansionCoordinate(row, col, boardOrState) {
        const cardExpansion = getCardExpansionModule();
        if (cardExpansion && typeof cardExpansion.isExpansionCoordinateForCard === 'function') {
            return cardExpansion.isExpansionCoordinateForCard(row, col, boardOrState);
        }
        if (!Number.isInteger(row) || !Number.isInteger(col)) return false;
        const dims = resolveBoardDims(boardOrState, boardOrState);
        if (row < -1 || row > dims.rows || col < -1 || col > dims.cols) return false;
        if (isMainBoardCell(row, col, boardOrState)) return false;
        return true;
    }

    function isMainBoardCorner(row, col, boardOrState) {
        const dims = resolveBoardDims(boardOrState, boardOrState);
        return isMainBoardCell(row, col, boardOrState) && (row === 0 || row === dims.rows - 1) && (col === 0 || col === dims.cols - 1);
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
        if (BoardUtils && typeof BoardUtils.normalizeOwner === 'function') {
            const normalizedOwner = BoardUtils.normalizeOwner(owner);
            return (normalizedOwner === SharedConstants.BLACK || normalizedOwner === SharedConstants.WHITE)
                ? normalizedOwner
                : EMPTY;
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
                if (!Number.isInteger(col) && side === 'right') col = resolveBoardDims(gameState, null).cols;
            } else {
                side = source;
                row = legacyRow;
                if (side === 'left') col = -1;
                if (side === 'right') col = resolveBoardDims(gameState, null).cols;
            }

            if (!isExpansionCoordinate(row, col, gameState)) return;
            if (out.some((desc) => desc && desc.row === row && desc.col === col)) return;
            out.push({
                side: resolveExpansionSide(side, row, col, gameState),
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

    function syncLegacyExpansionFields(expansion, gameState) {
        const cardExpansion = getCardExpansionModule();
        if (cardExpansion && typeof cardExpansion.syncLegacyExpansionFieldsForCard === 'function') {
            cardExpansion.syncLegacyExpansionFieldsForCard(expansion, gameState);
            return;
        }
        if (!expansion || typeof expansion !== 'object') return;
        if (!Array.isArray(expansion.cells)) expansion.cells = [];
        const latest = expansion.cells.length > 0 ? expansion.cells[expansion.cells.length - 1] : null;
        expansion.active = !!latest;
        expansion.side = latest ? resolveExpansionSide(latest.side, latest.row, latest.col, gameState) : null;
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
        syncLegacyExpansionFields(expansion, gameState);
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
        if (isMainBoardCell(row, col, gameState)) return gameState.board[row][col];
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
        if (isMainBoardCell(row, col, gameState)) {
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
                : (cell.side === 'left' ? -1 : (cell.side === 'right' ? resolveBoardDims(gameState, null).cols : null));
            if (!Number.isInteger(cellCol)) continue;
            if (cell.row === row && cellCol === col) {
                expansion.cells[i] = {
                    side: resolveExpansionSide(cell.side, cell.row, cellCol, gameState),
                    row: cell.row,
                    col: cellCol,
                    owner: normalizedOwner
                };
                syncLegacyExpansionFields(expansion, gameState);
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
        if (isMainBoardCell(row, col, gameState)) {
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
        if (isMainBoardCell(row, col, gameState || cardState)) {
            const dims = resolveBoardDims(gameState, cardState);
            if (!cardState.stoneIdMap) {
                cardState.stoneIdMap = Array.from({ length: dims.rows }, () => Array.from({ length: dims.cols }, () => null));
            }
            if (!Array.isArray(cardState.stoneIdMap[row])) {
                cardState.stoneIdMap[row] = Array.from({ length: dims.cols }, () => null);
            }
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

    function _isAbsoluteProtectedCell(cardState, row, col) {
        const cardMarkers = getCardMarkersModule();
        if (cardMarkers && typeof cardMarkers.isAbsoluteProtectedCell === 'function') {
            return !!cardMarkers.isAbsoluteProtectedCell(cardState, row, col);
        }
        const markers = _getSpecialMarkersAt(cardState, row, col);
        return markers.some((marker) => String(marker && marker.data && marker.data.type ? marker.data.type : '').toUpperCase() === 'ABSOLUTE_PROTECTED');
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

    function _getProliferationMarkerAt(cardState, row, col) {
        const markersAtCell = _getSpecialMarkersAt(cardState, row, col);
        return markersAtCell.find((marker) => (
            String(marker && marker.data && marker.data.type ? marker.data.type : '').toUpperCase() === 'PROLIFERATION'
        )) || null;
    }

    function _consumeProliferationMarkerOnNormalFlip(cardState, row, col) {
        if (!cardState || !Array.isArray(cardState.markers)) return null;
        const markerKind = MARKER_KINDS ? MARKER_KINDS.SPECIAL_STONE : 'specialStone';
        let removed = null;
        cardState.markers = cardState.markers.filter((entry) => {
            const shouldRemove = !!(
                entry &&
                entry.kind === markerKind &&
                entry.row === row &&
                entry.col === col &&
                entry.data &&
                String(entry.data.type || '').toUpperCase() === 'PROLIFERATION'
            );
            if (shouldRemove && !removed) removed = entry;
            return !shouldRemove;
        });
        return removed;
    }

    function _clonePresentationMeta(meta) {
        const out = (meta && typeof meta === 'object') ? Object.assign({}, meta) : {};
        delete out.randomSource;
        delete out.prng;
        return out;
    }

    function _resolveBoardOpsRandomSource(cardState, meta) {
        if (meta && meta.randomSource && typeof meta.randomSource.random === 'function') return meta.randomSource;
        if (meta && meta.prng && typeof meta.prng.random === 'function') return meta.prng;
        if (cardState && cardState._boardOpsRandomSource && typeof cardState._boardOpsRandomSource.random === 'function') {
            return cardState._boardOpsRandomSource;
        }
        if (cardState && cardState._currentActionMeta && cardState._currentActionMeta.randomSource && typeof cardState._currentActionMeta.randomSource.random === 'function') {
            return cardState._currentActionMeta.randomSource;
        }
        return { random: () => 0 };
    }

    function _resolveRandomIndex(randomSource, length) {
        if (!Number.isInteger(length) || length <= 0) return 0;
        const raw = Math.floor(Number(randomSource.random()) * length);
        if (!Number.isInteger(raw)) return 0;
        return Math.max(0, Math.min(length - 1, raw));
    }

    function _getProliferationOwnerTurns() {
        const raw = Number(SharedConstants && SharedConstants.PROLIFERATION_WILL_TURNS);
        return Number.isFinite(raw) ? Math.max(1, Math.trunc(raw)) : 10;
    }

    function _collectAdjacentEmptyCells(cardState, gameState, row, col) {
        const out = [];
        for (let rowOffset = -1; rowOffset <= 1; rowOffset++) {
            for (let colOffset = -1; colOffset <= 1; colOffset++) {
                if (rowOffset === 0 && colOffset === 0) continue;
                const pos = _normalizeCellPosition(row + rowOffset, col + colOffset);
                if (!pos) continue;
                if (pos.row === row && pos.col === col) continue;
                if (out.some((entry) => entry.row === pos.row && entry.col === pos.col)) continue;
                if (getCellValue(gameState, pos.row, pos.col) !== EMPTY) continue;
                if (_isBlockedDestinationCell(cardState, pos.row, pos.col)) continue;
                out.push(pos);
            }
        }
        return out;
    }

    function _findProliferationDestination(cardState, gameState, row, col, meta) {
        const candidates = _collectAdjacentEmptyCells(cardState, gameState, row, col);
        if (!candidates.length) return null;
        const randomSource = _resolveBoardOpsRandomSource(cardState, meta);
        return candidates[_resolveRandomIndex(randomSource, candidates.length)] || candidates[0] || null;
    }

    function _addSpecialStoneMarker(cardState, row, col, owner, data) {
        _ensureCardState(cardState);
        const markerKind = MARKER_KINDS ? MARKER_KINDS.SPECIAL_STONE : 'specialStone';
        const cardMarkers = getCardMarkersModule();
        if (cardMarkers && typeof cardMarkers.addMarker === 'function') {
            return cardMarkers.addMarker(cardState, markerKind, row, col, owner, data);
        }
        if (MarkersAdapter && typeof MarkersAdapter.addMarker === 'function') {
            return MarkersAdapter.addMarker(cardState, markerKind, row, col, owner, data);
        }
        const id = cardState._nextMarkerId || 1;
        cardState._nextMarkerId = id + 1;
        if (typeof cardState._nextCreatedSeq === 'undefined') cardState._nextCreatedSeq = 1;
        const createdSeq = cardState._nextCreatedSeq++;
        const marker = {
            id,
            row,
            col,
            kind: markerKind,
            owner,
            createdSeq,
            data: Object.assign({}, data)
        };
        cardState.markers.push(marker);
        return marker;
    }

    function _pruneAfterimageMarkerIfDepleted(cardState, marker) {
        if (!cardState || !Array.isArray(cardState.markers) || !marker || !marker.data) return;
        const typeUpper = String(marker.data.type || '').toUpperCase();
        if (typeUpper !== 'AFTERIMAGE_WILL') return;
        const flipRemaining = _normalizeCounterValue(marker.data && marker.data.flipEvadeRemaining) || 0;
        const destroyRemaining = _normalizeCounterValue(marker.data && marker.data.destroyEvadeRemaining) || 0;
        if (flipRemaining > 0 || destroyRemaining > 0) return;
        cardState.markers = cardState.markers.filter((entry) => entry !== marker);
    }

    function _consumeAfterimageMarkerOnNormalChange(cardState, row, col) {
        if (!cardState || !Array.isArray(cardState.markers)) return null;
        const marker = cardState.markers.find((entry) => (
            entry &&
            entry.kind === (MARKER_KINDS ? MARKER_KINDS.SPECIAL_STONE : 'specialStone') &&
            entry.row === row &&
            entry.col === col &&
            entry.data &&
            String(entry.data.type || '').toUpperCase() === 'AFTERIMAGE_WILL'
        ));
        if (!marker || !marker.data) return null;
        const flipRemaining = _normalizeCounterValue(marker.data && marker.data.flipEvadeRemaining) || 0;
        if (flipRemaining > 0) return null;
        cardState.markers = cardState.markers.filter((entry) => entry !== marker);
        return marker;
    }

    function _collectAllBoardCoordinates(gameState) {
        const coords = [];
        const dims = resolveBoardDims(gameState, null);
        for (let row = 0; row < dims.rows; row++) {
            for (let col = 0; col < dims.cols; col++) {
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
        if (StoneStatusSnapshot && typeof StoneStatusSnapshot.resolveDisplayTimerValue === 'function') {
            return StoneStatusSnapshot.resolveDisplayTimerValue({
                type: markerData && markerData.type,
                remainingOwnerTurns: markerData && markerData.remainingOwnerTurns,
                regenRemaining: markerData && markerData.regenRemaining
            });
        }
        const primaryTimer = _normalizeCounterValue(markerData && markerData.remainingOwnerTurns);
        if (primaryTimer !== null) return primaryTimer;
        if (String(markerData && markerData.type ? markerData.type : '').toUpperCase() === 'REGEN') {
            return _normalizeCounterValue(markerData && markerData.regenRemaining);
        }
        return null;
    }

    function _getSpecialVisualMeta(cardState, row, col) {
        if (cardState && Array.isArray(cardState.markers)) {
            const markersAtCell = _getSpecialMarkersAt(cardState, row, col);
            const cardMarkers = getCardMarkersModule();
            const b = cardMarkers && typeof cardMarkers.findBombMarkerAt === 'function'
                ? cardMarkers.findBombMarkerAt(cardState, row, col)
                : (MarkersAdapter && typeof MarkersAdapter.findBombMarkerAt === 'function'
                    ? MarkersAdapter.findBombMarkerAt(cardState, row, col)
                    : cardState.markers.find(m => m.kind === (MARKER_KINDS ? MARKER_KINDS.SPECIAL_STONE : 'specialStone') && m.data && m.data.category === 'bomb' && m.row === row && m.col === col))
                ;
            if (StoneStatusSnapshot && typeof StoneStatusSnapshot.resolveStoneVisualStatusFromMarkers === 'function') {
                return StoneStatusSnapshot.resolveStoneVisualStatusFromMarkers(markersAtCell, {
                    bombMarker: b,
                    mode: 'raw'
                });
            }

            let inheritedTimer = null;
            let inheritedOwner = null;
            let flipEvadeRemaining = null;
            let inheritedFlipEvadeRemaining = null;
            let destroyEvadeRemaining = null;
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
                return !isOverlayOnlySpecialStoneType(typeUpper);
            });
            if (visualSpecial) {
                flipEvadeRemaining = _normalizeCounterValue(visualSpecial.data && visualSpecial.data.flipEvadeRemaining);
                return {
                    special: (visualSpecial.data && visualSpecial.data.type) || null,
                    timer: _resolveSpecialDisplayTimerValue(visualSpecial.data),
                    owner: (visualSpecial.owner !== undefined && visualSpecial.owner !== null) ? visualSpecial.owner : null,
                    inheritedTimer,
                    inheritedOwner,
                    flipEvadeRemaining,
                    inheritedFlipEvadeRemaining,
                    destroyEvadeRemaining
                };
            }

            if (b) {
                return {
                    special: 'TIME_BOMB',
                    timer: (b.data && typeof b.data.remainingTurns === 'number') ? b.data.remainingTurns : null,
                    owner: (b.owner !== undefined && b.owner !== null) ? b.owner : null,
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
            inheritedTimer: null,
            inheritedOwner: null,
            flipEvadeRemaining: null,
            inheritedFlipEvadeRemaining: null,
            destroyEvadeRemaining: null
        };
    }

    function _getGhostMarkerAt(cardState, row, col) {
        const markersAtCell = _getSpecialMarkersAt(cardState, row, col);
        return markersAtCell.find((marker) => String(marker && marker.data && marker.data.type ? marker.data.type : '').toUpperCase() === 'GHOST') || null;
    }

    function _shouldBlockGhostChange(cause, reason) {
        const causeUpper = String(cause || '').toUpperCase();
        const reasonLower = String(reason || '').toLowerCase();
        if (reasonLower === 'tempt_applied') return false;
        if (causeUpper === 'SWAP') return true;
        if (reasonLower === 'regen_triggered') return true;
        if (reasonLower.includes('flip')) return true;
        if (reasonLower.includes('convert')) return true;
        return false;
    }

    function _shouldBlockGhostDestroy(reason, meta) {
        const reasonLower = String(reason || '').toLowerCase();
        if (meta && meta.allowGhostDestroy === true) return false;
        if (reasonLower === 'meteor_cell_destroy') return false;
        return true;
    }

    function _populateSpecialVisualMeta(cardState, row, col, meta) {
        const metaOut = _clonePresentationMeta(meta);
        if (metaOut.special !== undefined && metaOut.special !== null) return metaOut;
        const visual = _getSpecialVisualMeta(cardState, row, col);
        if (visual.special !== null) metaOut.special = visual.special;
        if (visual.timer !== null) metaOut.timer = visual.timer;
        if (visual.owner !== null) metaOut.owner = visual.owner;
        if (visual.inheritedTimer !== null) metaOut.inheritedTimer = visual.inheritedTimer;
        if (visual.inheritedOwner !== null) metaOut.inheritedOwner = visual.inheritedOwner;
        if (visual.flipEvadeRemaining !== null) metaOut.flipEvadeRemaining = visual.flipEvadeRemaining;
        if (visual.inheritedFlipEvadeRemaining !== null) metaOut.inheritedFlipEvadeRemaining = visual.inheritedFlipEvadeRemaining;
        if (visual.destroyEvadeRemaining !== null) metaOut.destroyEvadeRemaining = visual.destroyEvadeRemaining;
        return metaOut;
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

    function _findSpecialMarkerAt(cardState, row, col, type) {
        const cardMarkers = getCardMarkersModule();
        if (cardMarkers && typeof cardMarkers.findSpecialMarkerAt === 'function') {
            return cardMarkers.findSpecialMarkerAt(cardState, row, col, type) || null;
        }
        const markers = (cardState && Array.isArray(cardState.markers)) ? cardState.markers : [];
        return markers.find((marker) => (
            marker &&
            marker.kind === (MARKER_KINDS ? MARKER_KINDS.SPECIAL_STONE : 'specialStone') &&
            marker.row === row &&
            marker.col === col &&
            marker.data &&
            marker.data.type === type
        )) || null;
    }

    function _removeSpecialMarkersAt(cardState, row, col, options) {
        const cardMarkers = getCardMarkersModule();
        if (cardMarkers && typeof cardMarkers.removeMarkersAt === 'function') {
            cardMarkers.removeMarkersAt(cardState, row, col, options);
            return;
        }
        if (MarkersAdapter && typeof MarkersAdapter.removeMarkersAt === 'function') {
            MarkersAdapter.removeMarkersAt(cardState, row, col, options);
            return;
        }
        if (!cardState || !Array.isArray(cardState.markers)) return;
        const opts = options || {};
        cardState.markers = cardState.markers.filter((marker) => {
            if (!marker || marker.row !== row || marker.col !== col) return true;
            if (opts.kind && marker.kind !== opts.kind) return true;
            if (opts.type && (!marker.data || marker.data.type !== opts.type)) return true;
            if (opts.owner && marker.owner !== opts.owner) return true;
            return false;
        });
    }

    function _invalidateSeedMarkerAt(cardState, row, col, cause, reason) {
        const seedMarker = _findSpecialMarkerAt(cardState, row, col, 'SEED');
        if (!seedMarker) return false;
        emitPresentationEvent(cardState, {
            type: 'STATUS_REMOVED',
            row,
            col,
            cause: cause || null,
            reason: 'seed_invalidated',
            meta: {
                special: 'SEED',
                owner: seedMarker.owner || null,
                reason: 'seed_invalidated',
                invalidatedByCause: cause || null,
                invalidatedByReason: reason || null
            }
        });
        _removeSpecialMarkersAt(cardState, row, col, {
            kind: MARKER_KINDS ? MARKER_KINDS.SPECIAL_STONE : 'specialStone',
            type: 'SEED'
        });
        return true;
    }

    function spawnAt(cardState, gameState, row, col, ownerKey, cause, reason, meta = {}) {
        _ensureCardState(cardState);
        const pos = _normalizeCellPosition(row, col);
        if (!pos) return { spawned: false, reason: 'out_of_board' };
        row = pos.row;
        col = pos.col;
        if (_isBlockedDestinationCell(cardState, row, col)) return { spawned: false, reason: 'blocked_destination' };
        _invalidateSeedMarkerAt(cardState, row, col, cause, reason);
        const ownerVal = ownerKey === 'black' ? (SharedConstants.BLACK || 1) : (SharedConstants.WHITE || -1);
        if (!setCellValue(gameState, row, col, ownerVal)) return { spawned: false };
        const stoneId = allocateStoneId(cardState);

        // Track stoneId in map
        setStoneIdAt(cardState, gameState, row, col, stoneId);

        const metaOut = _clonePresentationMeta(meta);
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
        if (_isAbsoluteProtectedCell(cardState, row, col)) return { destroyed: false, reason: 'absolute_protected' };
        const ignoreGuard = !!(meta && meta.ignoreGuard === true);
        const ignoreRegen = !!(meta && meta.ignoreRegen === true);
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
        const ghostMarker = _getGhostMarkerAt(cardState, row, col);
        if (ghostMarker && _shouldBlockGhostDestroy(reason, meta)) {
            const stoneId = getStoneIdAt(cardState, gameState, row, col);
            const metaOut = _populateSpecialVisualMeta(cardState, row, col, _clonePresentationMeta(meta));
            metaOut.blockedByGhost = true;
            emitPresentationEvent(cardState, {
                type: 'DESTROY',
                stoneId,
                row,
                col,
                ownerBefore: (prev === (SharedConstants.BLACK || 1)) ? 'black' : 'white',
                cause: cause || null,
                reason: reason || null,
                meta: metaOut
            });
            return createDestroyOutcome(DESTROY_OUTCOME_KINDS.GHOST_BLOCKED, {
                reason: 'ghost_protected'
            });
        }

        const destroyEvadeMarker = _shouldSkipDestroyEvade(cause, reason, meta)
            ? null
            : _getDestroyEvadeMarkerAt(cardState, row, col);
        if (destroyEvadeMarker) {
            const destination = _findDestroyEvadeDestination(cardState, gameState, row, col, meta);
            if (destination) {
                const beforeRemaining = _normalizeCounterValue(destroyEvadeMarker.data && destroyEvadeMarker.data.destroyEvadeRemaining) || 0;
                const afterRemaining = Math.max(0, beforeRemaining - 1);
                destroyEvadeMarker.data.destroyEvadeRemaining = afterRemaining;
                const afterimageWillDepleted = (
                    String(destroyEvadeMarker.data && destroyEvadeMarker.data.type ? destroyEvadeMarker.data.type : '').toUpperCase() === 'AFTERIMAGE_WILL' &&
                    afterRemaining <= 0 &&
                    (_normalizeCounterValue(destroyEvadeMarker.data && destroyEvadeMarker.data.flipEvadeRemaining) || 0) <= 0
                );
                const visual = _getSpecialVisualMeta(cardState, row, col);
                const moveMeta = Object.assign({}, meta, {
                    special: afterimageWillDepleted
                        ? null
                        : (visual.special !== null ? visual.special : ((destroyEvadeMarker.data && destroyEvadeMarker.data.type) || null)),
                    timer: afterimageWillDepleted ? null : (visual.timer !== null ? visual.timer : null),
                    owner: afterimageWillDepleted
                        ? null
                        : (visual.owner !== null ? visual.owner : ((destroyEvadeMarker.owner !== undefined && destroyEvadeMarker.owner !== null) ? destroyEvadeMarker.owner : null)),
                    inheritedTimer: visual.inheritedTimer !== null ? visual.inheritedTimer : null,
                    inheritedOwner: visual.inheritedOwner !== null ? visual.inheritedOwner : null,
                    flipEvadeRemaining: afterimageWillDepleted
                        ? null
                        : (visual.flipEvadeRemaining !== null ? visual.flipEvadeRemaining : null),
                    inheritedFlipEvadeRemaining: visual.inheritedFlipEvadeRemaining !== null ? visual.inheritedFlipEvadeRemaining : null,
                    destroyEvadeRemaining: afterimageWillDepleted ? null : afterRemaining,
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
                    _pruneAfterimageMarkerIfDepleted(cardState, destroyEvadeMarker);
                    return createDestroyOutcome(DESTROY_OUTCOME_KINDS.EVADED_MOVE, {
                        reason: 'destroy_evaded',
                        from: { row, col },
                        to: { row: destination.row, col: destination.col }
                    });
                }
                destroyEvadeMarker.data.destroyEvadeRemaining = beforeRemaining;
            }
        }

        const proliferationMarker = _getProliferationMarkerAt(cardState, row, col);
        if (proliferationMarker) {
            const destination = _findProliferationDestination(cardState, gameState, row, col, meta);
            if (destination) {
                const ownerBeforeKey = (prev === (SharedConstants.BLACK || 1)) ? 'black' : 'white';
                const proliferationOwnerTurns = _getProliferationOwnerTurns();
                const stoneId = getStoneIdAt(cardState, gameState, row, col);
                const destroyMeta = _populateSpecialVisualMeta(cardState, row, col, _clonePresentationMeta(meta));
                destroyMeta.proliferated = true;
                destroyMeta.proliferationOriginRow = row;
                destroyMeta.proliferationOriginCol = col;
                destroyMeta.proliferationDestinationRow = destination.row;
                destroyMeta.proliferationDestinationCol = destination.col;
                destroyMeta.proliferationTriggeredBy = cause || null;
                destroyMeta.proliferationTriggerReason = reason || null;
                emitPresentationEvent(cardState, {
                    type: 'DESTROY',
                    stoneId,
                    row,
                    col,
                    ownerBefore: ownerBeforeKey,
                    cause: cause || null,
                    reason: reason || null,
                    meta: destroyMeta
                });
                const spawnMeta = Object.assign(_clonePresentationMeta(meta), {
                    special: 'PROLIFERATION',
                    timer: proliferationOwnerTurns,
                    owner: ownerBeforeKey,
                    fromRow: row,
                    fromCol: col,
                    cloneVisual: true,
                    proliferationOriginRow: row,
                    proliferationOriginCol: col,
                    proliferationTriggeredBy: cause || null,
                    proliferationTriggerReason: reason || null
                });
                const spawnResult = spawnAt(
                    cardState,
                    gameState,
                    destination.row,
                    destination.col,
                    ownerBeforeKey,
                    'PROLIFERATION_WILL',
                    'proliferation_spawn',
                    spawnMeta
                );
                if (spawnResult && spawnResult.spawned) {
                    _addSpecialStoneMarker(cardState, destination.row, destination.col, ownerBeforeKey, {
                        type: 'PROLIFERATION',
                        remainingOwnerTurns: proliferationOwnerTurns
                    });
                    return createDestroyOutcome(DESTROY_OUTCOME_KINDS.PROLIFERATED, {
                        reason: 'proliferation_triggered',
                        from: { row, col },
                        to: { row: destination.row, col: destination.col }
                    });
                }
            }
        }

        const cardRegenModule = getCardRegenModule();
        const activeRegenMarker = cardRegenModule && typeof cardRegenModule.findActiveRegenMarkerAt === 'function'
            ? cardRegenModule.findActiveRegenMarkerAt(cardState, row, col)
            : null;
        if (!ignoreRegen && activeRegenMarker && typeof cardRegenModule.applyRegenAfterDestroy === 'function') {
            const ownerBeforeKeyForRegen = (prev === (SharedConstants.BLACK || 1)) ? 'black' : 'white';
            const stoneId = getStoneIdAt(cardState, gameState, row, col);
            const destroyMeta = _populateSpecialVisualMeta(cardState, row, col, _clonePresentationMeta(meta));
            destroyMeta.regenerated = true;
            destroyMeta.regenTriggeredBy = cause || null;
            destroyMeta.regenTriggerReason = reason || null;
            emitPresentationEvent(cardState, {
                type: 'DESTROY',
                stoneId,
                row,
                col,
                ownerBefore: ownerBeforeKeyForRegen,
                cause: cause || null,
                reason: reason || null,
                meta: destroyMeta
            });
            const regenResult = cardRegenModule.applyRegenAfterDestroy(cardState, gameState, row, col, {
                destroyCause: cause || null,
                destroyReason: reason || null
            }, {
                BoardOps: {
                    changeAt,
                    emitPresentationEvent
                }
            });
            if (regenResult && regenResult.regenerated) {
                return createDestroyOutcome(DESTROY_OUTCOME_KINDS.REGENERATED, {
                    reason: 'regen_triggered',
                    row,
                    col,
                    owner: regenResult.owner || ownerBeforeKeyForRegen,
                    remaining: regenResult.remaining,
                    captureFlips: Array.isArray(regenResult.captureFlips) ? regenResult.captureFlips.slice() : []
                });
            }
        }

        const specialKindForSalvation = MARKER_KINDS ? MARKER_KINDS.SPECIAL_STONE : 'specialStone';
        const wasSpecialStoneForSalvation = !!(Array.isArray(cardState.markers) && cardState.markers.some(
            m => m && m.kind === specialKindForSalvation && m.row === row && m.col === col
        ));
        const ownerBeforeKeyForDestroy = (prev === (SharedConstants.BLACK || 1)) ? 'black' : 'white';
        const recordSalvationDestroy = () => {
            const activeTurnPlayer = cardState._activeTurnPlayer;
            const beneficiaryPlayer = activeTurnPlayer === 'black'
                ? 'white'
                : (activeTurnPlayer === 'white' ? 'black' : null);
            if (beneficiaryPlayer) {
                if (!cardState.prevOpponentTurnDestroyedStonesByPlayer) {
                    cardState.prevOpponentTurnDestroyedStonesByPlayer = { black: [], white: [] };
                }
                if (!Array.isArray(cardState.prevOpponentTurnDestroyedStonesByPlayer[beneficiaryPlayer])) {
                    cardState.prevOpponentTurnDestroyedStonesByPlayer[beneficiaryPlayer] = [];
                }
                cardState.prevOpponentTurnDestroyedStonesByPlayer[beneficiaryPlayer].push({
                    row,
                    col,
                    owner: ownerBeforeKeyForDestroy,
                    wasSpecial: wasSpecialStoneForSalvation
                });
            }
        };

        const cardLivingWillModule = getCardLivingWillModule();
        const livingWillMarker = cardLivingWillModule && typeof cardLivingWillModule.findLivingWillMarkerAt === 'function'
            ? cardLivingWillModule.findLivingWillMarkerAt(cardState, row, col)
            : null;
        if (livingWillMarker && cardLivingWillModule && typeof cardLivingWillModule.restoreFromLivingWillSnapshot === 'function') {
            const livingStoneId = getStoneIdAt(cardState, gameState, row, col);
            setStoneIdAt(cardState, gameState, row, col, null);
            setCellValue(gameState, row, col, EMPTY);
            if (cardMarkers && typeof cardMarkers.removeMarkersAt === 'function') {
                cardMarkers.removeMarkersAt(cardState, row, col);
            } else if (MarkersAdapter && typeof MarkersAdapter.removeMarkersAt === 'function') {
                MarkersAdapter.removeMarkersAt(cardState, row, col);
            } else if (Array.isArray(cardState.markers)) {
                cardState.markers = cardState.markers.filter(m => !(m.row === row && m.col === col));
            }
            const destroyMeta = _clonePresentationMeta(meta);
            destroyMeta.livingWillTriggered = true;
            emitPresentationEvent(cardState, {
                type: 'DESTROY',
                stoneId: livingStoneId,
                row,
                col,
                ownerBefore: ownerBeforeKeyForDestroy,
                cause: cause || null,
                reason: reason || null,
                meta: destroyMeta
            });
            const livingWillResult = cardLivingWillModule.restoreFromLivingWillSnapshot(
                cardState,
                gameState,
                livingWillMarker,
                {
                    triggerKind: 'destroy',
                    sourceRow: row,
                    sourceCol: col,
                    cause: cause || null,
                    reason: reason || null
                },
                {
                    BoardOps: {
                        spawnAt,
                        changeAt,
                        getCellValue,
                        getExpansionDescriptors,
                        emitPresentationEvent
                    },
                    random: meta && meta.random
                }
            );
            if (livingWillResult && livingWillResult.restored) {
                return createDestroyOutcome(DESTROY_OUTCOME_KINDS.LIVING_WILL_RESTORED, {
                    reason: 'living_will_restored',
                    from: { row, col },
                    to: livingWillResult.destination || { row, col },
                    owner: livingWillResult.owner || ownerBeforeKeyForDestroy,
                    livingWillRevived: true,
                    relocated: !!livingWillResult.relocated
                });
            }
            recordSalvationDestroy();
            return createDestroyOutcome(DESTROY_OUTCOME_KINDS.DESTROYED);
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
            ownerBefore: ownerBeforeKeyForDestroy,
            cause: cause || null,
            reason: reason || null,
            meta: _clonePresentationMeta(meta)
        });

        recordSalvationDestroy();

        return createDestroyOutcome(DESTROY_OUTCOME_KINDS.DESTROYED);
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
        const forcePresentation = !!(meta && meta.forcePresentation === true);
        const allowGhostFlip = !!(meta && meta.allowGhostFlip === true);
        if (prev === ownerAfterVal) {
            if (!forcePresentation) return { changed: false };
            const stoneIdForced = getStoneIdAt(cardState, gameState, row, col);
            const forcedMetaInput = _clonePresentationMeta(meta);
            delete forcedMetaInput.forcePresentation;
            delete forcedMetaInput.allowGhostFlip;
            const forcedMeta = _populateSpecialVisualMeta(cardState, row, col, forcedMetaInput);
            emitPresentationEvent(cardState, {
                type: 'CHANGE',
                stoneId: stoneIdForced,
                row,
                col,
                ownerBefore: ownerAfterKey,
                ownerAfter: ownerAfterKey,
                cause: cause || null,
                reason: reason || null,
                meta: forcedMeta
            });
            return { changed: false, presented: true };
        }
        if (_isFrozenCell(cardState, row, col)) return { changed: false, reason: 'frozen_protected' };
        if (_isAbsoluteProtectedCell(cardState, row, col)) return { changed: false, reason: 'absolute_protected' };
        const ownerBeforeKey = (prev === (SharedConstants.BLACK || 1))
            ? 'black'
            : ((prev === (SharedConstants.WHITE || -1)) ? 'white' : null);
        const ghostMarker = _getGhostMarkerAt(cardState, row, col);
        if (ghostMarker && _shouldBlockGhostChange(cause, reason) && !allowGhostFlip) {
            const stoneIdBlocked = getStoneIdAt(cardState, gameState, row, col);
            const metaBlockedInput = _clonePresentationMeta(meta);
            delete metaBlockedInput.allowGhostFlip;
            const metaBlocked = _populateSpecialVisualMeta(cardState, row, col, metaBlockedInput);
            metaBlocked.blockedByGhost = true;
            emitPresentationEvent(cardState, {
                type: 'CHANGE',
                stoneId: stoneIdBlocked,
                row,
                col,
                ownerBefore: ownerBeforeKey,
                ownerAfter: ownerAfterKey,
                cause: cause || null,
                reason: reason || null,
                meta: metaBlocked
            });
            return { changed: false, blockedByGhost: true, reason: 'ghost_protected' };
        }

        if (String(reason || '').toLowerCase().indexOf('flip') >= 0) {
            _consumeProliferationMarkerOnNormalFlip(cardState, row, col);
        }
        _consumeAfterimageMarkerOnNormalChange(cardState, row, col);
        const stoneId = getStoneIdAt(cardState, gameState, row, col);

        setCellValue(gameState, row, col, ownerAfterVal);
        if (ownerBeforeKey !== null) {
            ensureResultTotals(cardState);
            cardState.totalFlipCountByPlayer[ownerAfterKey] = (cardState.totalFlipCountByPlayer[ownerAfterKey] || 0) + 1;
            if (ownerBeforeKey !== ownerAfterKey && isMainBoardCorner(row, col, gameState)) {
                cardState.cornerCaptureCountByPlayer[ownerAfterKey] = (cardState.cornerCaptureCountByPlayer[ownerAfterKey] || 0) + 1;
            }
        }
        const metaOutInput = _clonePresentationMeta(meta);
        delete metaOutInput.allowGhostFlip;
        const metaOut = _populateSpecialVisualMeta(cardState, row, col, metaOutInput);

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

    function revertSpecialStoneAt(cardState, gameState, row, col, specialType, ownerKey, cause, reason, meta = {}) {
        _ensureCardState(cardState);
        const pos = _normalizeCellPosition(row, col);
        if (!pos) return { reverted: false, reason: 'out_of_board' };
        row = pos.row;
        col = pos.col;

        const prev = getCellValue(gameState, row, col);
        if (prev === null) return { reverted: false, reason: 'out_of_board' };
        if (prev === EMPTY) return { reverted: false, reason: 'empty_cell' };

        const targetTypeUpper = String(specialType || '').toUpperCase();
        if (!targetTypeUpper) return { reverted: false, reason: 'missing_special_type' };

        const matchesAtCell = _getSpecialMarkersAt(cardState, row, col).filter((marker) => {
            const markerTypeUpper = String(marker && marker.data && marker.data.type ? marker.data.type : '').toUpperCase();
            if (markerTypeUpper !== targetTypeUpper) return false;
            if (ownerKey !== undefined && ownerKey !== null && ownerKey !== '' && marker.owner !== ownerKey) return false;
            return true;
        });
        if (!matchesAtCell.length) return { reverted: false, reason: 'marker_not_found' };
        const cardLivingWillModule = getCardLivingWillModule();
        const livingWillMarker = cardLivingWillModule && typeof cardLivingWillModule.findLivingWillMarkerAt === 'function'
            ? cardLivingWillModule.findLivingWillMarkerAt(cardState, row, col)
            : null;
        const shouldRestoreLivingWill = !!(
            livingWillMarker &&
            cardLivingWillModule &&
            typeof cardLivingWillModule.shouldTriggerForSpecialLoss === 'function' &&
            cardLivingWillModule.shouldTriggerForSpecialLoss(livingWillMarker, specialType)
        );

        const markerKind = MARKER_KINDS ? MARKER_KINDS.SPECIAL_STONE : 'specialStone';
        const cardMarkers = getCardMarkersModule();
        const removeOptions = {
            kind: markerKind,
            type: specialType
        };
        if (ownerKey !== undefined && ownerKey !== null && ownerKey !== '') {
            removeOptions.owner = ownerKey;
        }

        if (cardMarkers && typeof cardMarkers.removeMarkersAt === 'function') {
            cardMarkers.removeMarkersAt(cardState, row, col, removeOptions);
        } else if (MarkersAdapter && typeof MarkersAdapter.removeMarkersAt === 'function') {
            MarkersAdapter.removeMarkersAt(cardState, row, col, removeOptions);
        } else if (Array.isArray(cardState.markers)) {
            cardState.markers = cardState.markers.filter((marker) => {
                if (!marker || marker.row !== row || marker.col !== col) return true;
                if (marker.kind !== markerKind) return true;
                if (String(marker && marker.data && marker.data.type ? marker.data.type : '').toUpperCase() !== targetTypeUpper) return true;
                if (removeOptions.owner && marker.owner !== removeOptions.owner) return true;
                return false;
            });
        }

        const remainingMatches = _getSpecialMarkersAt(cardState, row, col).filter((marker) => {
            const markerTypeUpper = String(marker && marker.data && marker.data.type ? marker.data.type : '').toUpperCase();
            if (markerTypeUpper !== targetTypeUpper) return false;
            if (removeOptions.owner && marker.owner !== removeOptions.owner) return false;
            return true;
        });
        if (remainingMatches.length >= matchesAtCell.length) {
            return { reverted: false, reason: 'marker_not_removed' };
        }

        const metaOut = _clonePresentationMeta(meta);
        metaOut.special = specialType;
        if ((metaOut.owner === undefined || metaOut.owner === null) && ownerKey !== undefined && ownerKey !== null && ownerKey !== '') {
            metaOut.owner = ownerKey;
        }
        metaOut.reason = reason || null;
        metaOut.reverted = true;

        emitPresentationEvent(cardState, {
            type: 'STATUS_REMOVED',
            row,
            col,
            cause: cause || null,
            reason: reason || null,
            meta: metaOut
        });

        const result = {
            reverted: true,
            removedCount: matchesAtCell.length - remainingMatches.length
        };
        if (shouldRestoreLivingWill && cardLivingWillModule && typeof cardLivingWillModule.restoreFromLivingWillSnapshot === 'function') {
            result.livingWillRestore = cardLivingWillModule.restoreFromLivingWillSnapshot(
                cardState,
                gameState,
                livingWillMarker,
                {
                    triggerKind: 'special_loss',
                    sourceRow: row,
                    sourceCol: col,
                    cause: cause || null,
                    reason: reason || null,
                    removedSpecialType: specialType
                },
                {
                    BoardOps: {
                        spawnAt,
                        changeAt,
                        getCellValue,
                        getExpansionDescriptors,
                        emitPresentationEvent
                    },
                    random: meta && meta.random
                }
            );
        }
        return result;
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
        if (_isAbsoluteProtectedCell(cardState, fromRow, fromCol)) return { moved: false, reason: 'absolute_protected_source' };
        // If dest occupied, we consider it invalid for now
        const destVal = getCellValue(gameState, toRow, toCol);
        if (destVal === null) return { moved: false, reason: 'to_out_of_board' };
        if (destVal !== EMPTY) return { moved: false, reason: 'dest_not_empty' };
        if (_isBlockedDestinationCell(cardState, toRow, toCol)) return { moved: false, reason: 'blocked_destination' };
        _invalidateSeedMarkerAt(cardState, toRow, toCol, cause, reason);

        const stoneId = getStoneIdAt(cardState, gameState, fromRow, fromCol);
        setStoneIdAt(cardState, gameState, fromRow, fromCol, null);
        setStoneIdAt(cardState, gameState, toRow, toCol, stoneId);

        setCellValue(gameState, fromRow, fromCol, EMPTY);
        setCellValue(gameState, toRow, toCol, prev);
        const metaOut = _clonePresentationMeta(meta);
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
        revertSpecialStoneAt,
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
