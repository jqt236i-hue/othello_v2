/**
 * Backend-neutral adapter from canonical/visual-store state to the sparse board render model.
 * DOM compatibility rendering must not be imported from this module.
 */

declare const __non_webpack_require__: NodeRequire | undefined;

const _require: NodeRequire = (typeof __non_webpack_require__ !== 'undefined')
  ? __non_webpack_require__
  : require;

const RuntimeStateAccessModule = _require('../runtime-state-access');

declare const gameState: any;

declare const cardState: any;

declare const MarkersAdapter: any;

declare const CardLogic: any;

declare const getPlayerKey: (...args: any[]) => any;

declare const getLegalMoves: (...args: any[]) => any;

declare const BLACK: number;

declare const WHITE: number;

declare const EMPTY: number;

const DiffRendererProjector = _require('./model-builder');

let superAttractionHoverPreview: any = null;

let activePreparedVisualStateForDiff: { gameState: any; cardState: any } | null = null;

let DiffRendererManifestStoneRegistryModule: any = null;

let BoardHintProjectionModule: any = null;

const FALLBACK_MANIFEST_STONE_TYPES_FOR_DIFF = Object.freeze([
    'THEORY_INCARNATION',
    'BOARD_EXECUTOR',
    'OBSERVER_WILL'
]);

function _getPlayerKeyForDiff(value: any): 'black' | 'white' | null {
    try {
        if (typeof getPlayerKey === 'function') return getPlayerKey(value);
    } catch (e: any) { /* classic global is optional in isolated/runtime tests */ }
    if (OwnerHelpersModule && typeof OwnerHelpersModule.normalizePlayerKeyOptional === 'function') {
        return OwnerHelpersModule.normalizePlayerKeyOptional(value);
    }
    if (value === 'black' || value === 1 || value === '1') return 'black';
    if (value === 'white' || value === -1 || value === '-1') return 'white';
    return null;
}

function _getBoardValueConstantsForDiff() {
    const shared = SharedConstantsModuleForDiff;
    return {
        BLACK: shared && Number.isFinite(Number(shared.BLACK))
            ? Number(shared.BLACK)
            : ((typeof BLACK !== 'undefined') ? BLACK : 1),
        WHITE: shared && Number.isFinite(Number(shared.WHITE))
            ? Number(shared.WHITE)
            : ((typeof WHITE !== 'undefined') ? WHITE : -1),
        EMPTY: shared && Number.isFinite(Number(shared.EMPTY))
            ? Number(shared.EMPTY)
            : ((typeof EMPTY !== 'undefined') ? EMPTY : 0)
    };
}

function _getManifestStoneRegistryForDiff() {
    if (DiffRendererManifestStoneRegistryModule) return DiffRendererManifestStoneRegistryModule;
    if (typeof require === 'function') {
        try {
            DiffRendererManifestStoneRegistryModule = require('../../shared/manifest-stone-registry');
            return DiffRendererManifestStoneRegistryModule;
        } catch (e: any) { /* ignore */ }
    }
    try {
        if (typeof window !== 'undefined' && (window as any).ManifestStoneRegistry) {
            DiffRendererManifestStoneRegistryModule = (window as any).ManifestStoneRegistry;
            return DiffRendererManifestStoneRegistryModule;
        }
    } catch (e: any) { /* ignore */ }
    try {
        if (typeof globalThis !== 'undefined' && (globalThis as any).ManifestStoneRegistry) {
            DiffRendererManifestStoneRegistryModule = (globalThis as any).ManifestStoneRegistry;
            return DiffRendererManifestStoneRegistryModule;
        }
    } catch (e: any) { /* ignore */ }
    return null;
}

function _isManifestStoneTypeForDiff(rawType: any) {
    const registry = _getManifestStoneRegistryForDiff();
    if (registry && typeof registry.isManifestStoneType === 'function') {
        return registry.isManifestStoneType(rawType) === true;
    }
    const typeKey = String(rawType || '').trim().toUpperCase();
    return FALLBACK_MANIFEST_STONE_TYPES_FOR_DIFF.includes(typeKey);
}

function _isActiveManifestAuraMarkerForDiff(marker: any, manifestMarkerKind: any, specialMarkerKind: any) {
    if (!marker || typeof marker !== 'object') return false;
    const data = marker.data && typeof marker.data === 'object' ? marker.data : marker;
    const typeKey = String((data && data.type) || (marker && marker.type) || '').trim().toUpperCase();
    if (!typeKey) return false;
    const kind = String((marker && marker.kind) || '').trim();
    const isManifestKind = kind === manifestMarkerKind || kind === 'manifestStone';
    const isLegacyManifestType = (kind === specialMarkerKind || !kind) && _isManifestStoneTypeForDiff(typeKey);
    if (!isManifestKind && !isLegacyManifestType) return false;
    const remainingRaw = data.remainingOwnerTurns ?? data.remainingTurns ?? marker.remainingOwnerTurns ?? marker.remainingTurns;
    if (remainingRaw == null) return true;
    const remaining = Number(remainingRaw);
    return !Number.isFinite(remaining) || remaining > 0;
}

function _getBoardShapeForDiff(gameState: any) {
    const config = _resolveBoardConfigForDiff(gameState);
    return { rows: config.rows, cols: config.cols };
}

function _normalizeBoardShapeInputForDiff(shapeOrGameState: any) {
    const rows = Number(shapeOrGameState && shapeOrGameState.rows);
    const cols = Number(shapeOrGameState && shapeOrGameState.cols);
    if (Number.isFinite(rows) && Number.isFinite(cols)) {
        return {
            rows: Math.max(1, Math.trunc(rows)),
            cols: Math.max(1, Math.trunc(cols))
        };
    }
    return _getBoardShapeForDiff(shapeOrGameState);
}

function _getStateBoardShapeForDiff(state: any) {
    if (state && state._boardShape) {
        return _normalizeBoardShapeInputForDiff(state._boardShape);
    }
    if (!Array.isArray(state)) {
        return { rows: 8, cols: 8 };
    }
    let cols = 0;
    for (const row of state) {
        if (Array.isArray(row)) cols = Math.max(cols, row.length);
    }
    return {
        rows: state.length > 0 ? state.length : 8,
        cols: cols > 0 ? cols : 8
    };
}

function _getBoardTopologyForDiff(gameState: any, cardStateOverride?: any) {
    return _createBoardViewForDiff(gameState, cardStateOverride).topology;
}

var SharedBoardUtilsModule: any = null;

if (typeof require === 'function') {
    try { SharedBoardUtilsModule = require('../../shared/shared-board-utils'); } catch (e: any) { /* ignore */ }
}

function _getGlobalScopeForDiff() {
    return (typeof globalThis !== 'undefined')
        ? globalThis
        : (typeof self !== 'undefined' ? self : (typeof window !== 'undefined' ? window : ({} as any)));
}

function _getSharedBoardUtilsForDiff() {
    if (SharedBoardUtilsModule) return SharedBoardUtilsModule;
    const globalScope = _getGlobalScopeForDiff();
    return globalScope.SharedBoardUtils || null;
}

function _requireSharedBoardUtilsForDiff() {
    const sharedBoardUtils = _getSharedBoardUtilsForDiff();
    if (
        !sharedBoardUtils
        || typeof sharedBoardUtils.createBoardView !== 'function'
        || typeof sharedBoardUtils.resolveBoardConfig !== 'function'
    ) {
        throw new Error('[BoardVisualStateAdapter] SharedBoardUtils board kernel unavailable');
    }
    return sharedBoardUtils;
}

function _resolveBoardConfigForDiff(value: any) {
    return _requireSharedBoardUtilsForDiff().resolveBoardConfig(value);
}

function _createBoardViewForDiff(gameState: any, cardStateOverride?: any) {
    const cardStateValue = typeof cardStateOverride === 'undefined'
        ? _resolveCardStateForDiffRender()
        : cardStateOverride;
    return _requireSharedBoardUtilsForDiff().createBoardView(gameState, {
        cardState: cardStateValue,
        strict: true
    });
}

function _getBoardHintProjectionForDiff() {
    if (BoardHintProjectionModule) return BoardHintProjectionModule;
    if (typeof require === 'function') {
        try {
            BoardHintProjectionModule = require('../../shared/board-hint-projection');
            return BoardHintProjectionModule;
        } catch (e: any) { /* ignore */ }
    }
    try {
        if (typeof globalThis !== 'undefined' && (globalThis as any).BoardHintProjection) {
            BoardHintProjectionModule = (globalThis as any).BoardHintProjection;
            return BoardHintProjectionModule;
        }
    } catch (e: any) { /* ignore */ }
    return null;
}

function _buildBoardHintProjectionForDiff(gameStateValue: any, cardStateValue: any, playerKey: any, boardShape: any, canControlCurrentTurn: boolean, isHumanTurn: boolean, expansions: any[], cardContext?: any, operationCounters?: any) {
    const projectionModule = _getBoardHintProjectionForDiff();
    if (!projectionModule || typeof projectionModule.buildBoardHintProjection !== 'function') return null;
    return projectionModule.buildBoardHintProjection({
        gameState: gameStateValue,
        cardState: cardStateValue,
        playerKey,
        boardShape,
        canControlCurrentTurn,
        isHumanTurn,
        expansions,
        cardContext,
        operationCounters,
        cardLogic: (typeof CardLogic !== 'undefined' ? CardLogic : null),
        getLegalMoves: (typeof getLegalMoves === 'function' ? getLegalMoves : null)
    });
}

function _isMainBoardCellForDiff(row: any, col: any, shapeOrGameState?: any) {
    const sharedBoardUtils = _requireSharedBoardUtilsForDiff();
    return !!sharedBoardUtils.isMainBoardCell(row, col, shapeOrGameState);
}

function _resolveExpansionSideForDiff(side: any, row: any, col: any, shapeOrGameState: any) {
    return _requireSharedBoardUtilsForDiff().resolveExpansionSide(
        side,
        row,
        col,
        shapeOrGameState
    );
}

function _isExpansionCoordinateForDiff(row: any, col: any, shapeOrGameState: any) {
    return !!_requireSharedBoardUtilsForDiff().isExpansionCoordinate(
        row,
        col,
        shapeOrGameState
    );
}

function _getExpansionDescriptorsForDiff(gameState: any): any[] {
    return Array.from(_createBoardViewForDiff(gameState).expansionCells);
}

function _getExpansionStateListForDiff(state: any): any[] {
    if (state && Array.isArray(state._expansionCells)) return state._expansionCells.filter(Boolean);
    if (state && state._expansionCell) return [state._expansionCell];
    return [];
}

function _isFiniteTimedLabelValueForDiff(value: any) {
    if (value === null || typeof value === 'undefined') return false;
    return Number.isFinite(Number(value));
}

function _resolveSpecialDisplayTurnsForDiff(data: any) {
    if (String(data && data.type ? data.type : '').toUpperCase() === 'REGEN') return undefined;
    const primary = Number(data && data.remainingOwnerTurns);
    if (Number.isFinite(primary)) return Math.max(0, Math.trunc(primary));
    const infection = Number(data && data.turnsUntilInfection);
    if (Number.isFinite(infection)) return Math.max(0, Math.trunc(infection));
    return undefined;
}

function _isBombCategoryMarkerForDiff(marker: any) {
    if (!marker || typeof marker !== 'object') return false;
    if (typeof MarkersAdapter !== 'undefined' && MarkersAdapter && typeof MarkersAdapter.isBombCategoryMarker === 'function') {
        return MarkersAdapter.isBombCategoryMarker(marker);
    }
    const data = (marker.data && typeof marker.data === 'object') ? marker.data : null;
    const category = String(data && data.category ? data.category : '').trim().toLowerCase();
    const type = String(data && data.type ? data.type : '').trim().toUpperCase();
    return marker.kind === 'bomb' || category === 'bomb' || type === 'TIME_BOMB';
}

var SharedConstantsModuleForDiff: any = null;

if (typeof _require === 'function') {
    try { SharedConstantsModuleForDiff = _require('../../shared-constants'); } catch (e: any) { /* ignore */ }
}

if (!SharedConstantsModuleForDiff) {
    try {
        if (typeof globalThis !== 'undefined' && (globalThis as any).SharedConstants) {
            SharedConstantsModuleForDiff = (globalThis as any).SharedConstants;
        }
    } catch (e: any) { /* ignore */ }
}

var OwnerHelpersModule: any = null;

if (typeof require === 'function') {
    try { OwnerHelpersModule = require('../../utils/owner-helpers'); } catch (e: any) { /* ignore */ }
}

if (!OwnerHelpersModule) {
    try {
        if (typeof globalThis !== 'undefined' && (globalThis as any).OwnerHelpers) OwnerHelpersModule = (globalThis as any).OwnerHelpers;
    } catch (e: any) { /* ignore */ }
}

var ViewerContextModule: any = null;

if (typeof require === 'function') {
    try { ViewerContextModule = require('./viewer-context'); } catch (e: any) { /* ignore */ }
}

var PlaybackStateModule: any = null;

if (typeof require === 'function') {
    try { PlaybackStateModule = require('../playback-state-manager'); } catch (e: any) { /* ignore */ }
}

if (!PlaybackStateModule) {
    try {
        if (typeof globalThis !== 'undefined' && (globalThis as any).PlaybackStateManager) PlaybackStateModule = (globalThis as any).PlaybackStateManager;
    } catch (e: any) { /* ignore */ }
}

function _resolveNetworkVisualStateStoreForDiff() {
    try {
        if (typeof window !== 'undefined' && (window as any).NetworkVisualStateStore) {
            return (window as any).NetworkVisualStateStore;
        }
    } catch (e: any) { /* ignore */ }
    try {
        if (typeof globalThis !== 'undefined' && (globalThis as any).NetworkVisualStateStore) {
            return (globalThis as any).NetworkVisualStateStore;
        }
    } catch (e: any) { /* ignore */ }
    return null;
}

function _resolveNetworkVisualRenderSnapshotForDiff() {
    const store = _resolveNetworkVisualStateStoreForDiff();
    try {
        const snapshot = store && typeof store.peekRenderSnapshot === 'function'
            ? store.peekRenderSnapshot()
            : (store && typeof store.getRenderSnapshot === 'function' ? store.getRenderSnapshot() : null);
        if (snapshot && snapshot.gameState && snapshot.cardState) return snapshot;
    } catch (e: any) { /* ignore */ }
    return null;
}

function _resolveLocalVisualRenderPairForDiff() {
    const currentGameState = RuntimeStateAccessModule.resolveCurrentRuntimeObject('gameState', () => {
        try { return (typeof gameState !== 'undefined') ? gameState : null; }
        catch (e: any) { return null; }
    });
    const currentCardState = RuntimeStateAccessModule.resolveCurrentRuntimeObject('cardState', () => {
        try { return (typeof cardState !== 'undefined') ? cardState : null; }
        catch (e: any) { return null; }
    });
    return {
        gameState: currentGameState,
        cardState: currentCardState || {}
    };
}

function _resolveVisualRenderPairForDiff() {
    if (activePreparedVisualStateForDiff) {
        return {
            gameState: activePreparedVisualStateForDiff.gameState,
            cardState: activePreparedVisualStateForDiff.cardState
        };
    }
    const visualSnapshot = _resolveNetworkVisualRenderSnapshotForDiff();
    if (visualSnapshot) {
        return {
            gameState: visualSnapshot.gameState,
            cardState: visualSnapshot.cardState
        };
    }
    return _resolveLocalVisualRenderPairForDiff();
}

function _resolveGameStateForDiffRender() {
    if (activePreparedVisualStateForDiff) return activePreparedVisualStateForDiff.gameState;
    const visualSnapshot = _resolveNetworkVisualRenderSnapshotForDiff();
    if (visualSnapshot && visualSnapshot.gameState) return visualSnapshot.gameState;
    return _resolveLocalVisualRenderPairForDiff().gameState;
}

function _resolveCardStateForDiffRender() {
    if (activePreparedVisualStateForDiff) return activePreparedVisualStateForDiff.cardState;
    const visualSnapshot = _resolveNetworkVisualRenderSnapshotForDiff();
    if (visualSnapshot && visualSnapshot.cardState) return visualSnapshot.cardState;
    return _resolveLocalVisualRenderPairForDiff().cardState;
}

function _normalizeSuperAttractionPreviewPoint(point: any) {
    const row = Number(point && point.row);
    const col = Number(point && point.col);
    if (!Number.isInteger(row) || !Number.isInteger(col)) return null;
    return { row, col };
}

function _getActiveSuperAttractionPreviewForDiff(pending: any) {
    if (!superAttractionHoverPreview || !pending || pending.type !== 'SUPER_ATTRACTION_WILL') return null;
    if (!pending.firstTarget) return null;
    const first = _normalizeSuperAttractionPreviewPoint(pending.firstTarget);
    const previewFirst = _normalizeSuperAttractionPreviewPoint(superAttractionHoverPreview.firstTarget);
    if (!first || !previewFirst || first.row !== previewFirst.row || first.col !== previewFirst.col) return null;
    return superAttractionHoverPreview;
}

function _collectSuperAttractionPreviewKeys(preview: any) {
    const pathKeys = new Set();
    const destinationKeys = new Set();
    if (!preview || !Array.isArray(preview.candidates)) {
        return { pathKeys, destinationKeys };
    }
    const target = _normalizeSuperAttractionPreviewPoint(preview.target);
    if (target) destinationKeys.add(`${target.row},${target.col}`);
    for (const candidate of preview.candidates) {
        const pathCells = Array.isArray(candidate && candidate.pathCells) ? candidate.pathCells : [];
        for (const point of pathCells) {
            const normalized = _normalizeSuperAttractionPreviewPoint(point);
            if (!normalized) continue;
            pathKeys.add(`${normalized.row},${normalized.col}`);
        }
    }
    return { pathKeys, destinationKeys };
}

function _buildEmptyCellStateForDiffRender(shapeOrGameState: any) {
    const boardShape = _normalizeBoardShapeInputForDiff(shapeOrGameState);
    const emptyVal = (typeof EMPTY !== 'undefined') ? EMPTY : 0;
    const state: any = [];
    for (let r = 0; r < boardShape.rows; r++) {
        state[r] = [];
        for (let c = 0; c < boardShape.cols; c++) {
            state[r][c] = {
                value: emptyVal,
                isLegal: false,
                isLegalFree: false,
                isTabooLegal: false,
                isRandomSpawnPreview: false,
                isSelectedTargetHighlighted: false,
                isSuperAttractionPathPreview: false,
                isSuperAttractionPreviewDestination: false,
                isSelectableFriendly: false,
                isExtendLifeTarget: false,
                breedingSprout: false,
                boardBonus: null,
                theoryNumberCell: false,
                special: null,
                inherited: null,
                guard: null,
                bomb: null,
                blockade: null,
                frozen: null,
                poisonCell: null,
                poisoned: null,
                destroyEvadeRemaining: null
            };
        }
    }
    state._expansionCells = [];
    state._expansionCell = null;
    state._boardShape = boardShape;
    return state;
}

function _resolveFlipEvadeDisplayForDiff(special: any) {
    const specialTypeUpper = String(special && special.type ? special.type : '').toUpperCase();
    const specialSupportsFlipEvade = (
        specialTypeUpper === 'HYPERACTIVE' ||
        specialTypeUpper === 'EXTREME_HYPERACTIVE' ||
        specialTypeUpper === 'ESCAPE_HYPERACTIVE' ||
        specialTypeUpper === 'ULTIMATE_HYPERACTIVE' ||
        specialTypeUpper === 'WILL_HUNTER_KING' ||
        specialTypeUpper === 'AFTERIMAGE_WILL'
    );
    return (
        special &&
        specialSupportsFlipEvade &&
        special.flipEvadeRemaining !== null &&
        typeof special.flipEvadeRemaining !== 'undefined' &&
        Number.isFinite(Number(special.flipEvadeRemaining))
    )
        ? Math.max(0, Math.trunc(Number(special.flipEvadeRemaining)))
        : null;
}

function _resolveDestroyEvadeDisplayForDiff(special: any) {
    const specialTypeUpper = String(special && special.type ? special.type : '').toUpperCase();
    const specialSupportsDestroyEvade = (
        specialTypeUpper === 'ULTIMATE_HYPERACTIVE' ||
        specialTypeUpper === 'EXTREME_HYPERACTIVE' ||
        specialTypeUpper === 'WILL_HUNTER_KING' ||
        specialTypeUpper === 'AFTERIMAGE_WILL'
    );
    return (
        special &&
        specialSupportsDestroyEvade &&
        special.destroyEvadeRemaining !== null &&
        typeof special.destroyEvadeRemaining !== 'undefined' &&
        Number.isFinite(Number(special.destroyEvadeRemaining))
    )
        ? Math.max(0, Math.trunc(Number(special.destroyEvadeRemaining)))
        : null;
}

function _isBoardHiddenTrap(marker: any) {
    if (!marker || !marker.data || marker.data.type !== 'TRAP') return false;
    // Hidden traps stay visually normal for both seats until reveal timing events.
    return true;
}

function _resolveViewerContextForDiff(preparedCardState?: any) {
    const root = typeof window !== 'undefined' ? window : null;
    try {
        if (ViewerContextModule && typeof ViewerContextModule.resolveDiffRendererViewerContext === 'function') {
            return ViewerContextModule.resolveDiffRendererViewerContext(root, OwnerHelpersModule, preparedCardState);
        }
    } catch (e: any) { /* fallback to local resolution */ }
    let localPlayerKey: any = null;
    let isNetworkMode = false;
    let isSpectator = false;
    try {
        const directKeys = [root && root.LOCAL_PLAYER_KEY, root && root.__LOCAL_PLAYER_KEY, root && root.BOARD_VIEWER_KEY];
        for (const key of directKeys) {
            if (key === 'white' || key === 'black') {
                localPlayerKey = key;
                break;
            }
        }
    } catch (e: any) { localPlayerKey = null; }
    try {
        isNetworkMode = !!(
            root &&
            (
                (typeof root.getCurrentMatchMode === 'function' && root.getCurrentMatchMode() === 'network') ||
                root.MATCH_MODE === 'network'
            )
        );
    } catch (e: any) { isNetworkMode = false; }
    try {
        isSpectator = !!(
            root
            && root.NetworkMatchClient
            && typeof root.NetworkMatchClient.isSpectator === 'function'
            && root.NetworkMatchClient.isSpectator() === true
        );
    } catch (e: any) { isSpectator = false; }
    return {
        seatKey: null,
        localPlayerKey,
        isNetworkMode,
        isSpectator,
        debugHumanVsHuman: !!(root && root.DEBUG_HUMAN_VS_HUMAN === true)
    };
}

function _resolveNetworkLocalPlayerKeyForDiff(preparedViewerContext?: any) {
    const viewerContext = preparedViewerContext || _resolveViewerContextForDiff();
    if (viewerContext.localPlayerKey === 'white' || viewerContext.localPlayerKey === 'black') {
        return viewerContext.localPlayerKey;
    }
    if (viewerContext.seatKey === 'white' || viewerContext.seatKey === 'black') {
        return viewerContext.seatKey;
    }
    return 'black';
}

function _canLocalPlayerControlCurrentTurnForDiff(
    preparedGameState?: any,
    preparedCardState?: any,
    preparedViewerContext?: any
) {
    const gameStateValue = preparedGameState || _resolveGameStateForDiffRender();
    const cardStateValue = preparedCardState || _resolveCardStateForDiffRender();
    const viewerContext = preparedViewerContext || _resolveViewerContextForDiff();
    if (viewerContext && viewerContext.isSpectator === true) return false;
    try {
        if (OwnerHelpersModule && typeof OwnerHelpersModule.resolveNetworkInputPermissions === 'function') {
            return OwnerHelpersModule.resolveNetworkInputPermissions({
                rootRef: typeof window !== 'undefined' ? window : null,
                cardState: cardStateValue,
                gameState: gameStateValue,
                currentPlayer: gameStateValue && gameStateValue.currentPlayer,
                localPlayerKey: _resolveNetworkLocalPlayerKeyForDiff(viewerContext),
                debugHumanVsHuman: viewerContext.debugHumanVsHuman === true
            }).canOperateBoard === true;
        }
    } catch (e: any) { /* fallback to legacy local checks */ }
    const isNetworkMode = viewerContext.isNetworkMode === true;
    const currentPlayerKey = gameStateValue
        && gameStateValue.currentPlayer === _getBoardValueConstantsForDiff().WHITE
        ? 'white'
        : 'black';
    const isHvH = viewerContext.debugHumanVsHuman === true;
    if (isNetworkMode || !isHvH) {
        const fwc = cardStateValue && cardStateValue.fateWillControllerByTurnOwner;
        const controller = fwc && fwc[currentPlayerKey];
        if (controller) {
            const localPlayerKey = _resolveNetworkLocalPlayerKeyForDiff(viewerContext);
            return controller === localPlayerKey;
        }
    }
    if (!isNetworkMode) return true;
    const localPlayerKey = _resolveNetworkLocalPlayerKeyForDiff(viewerContext);
    return currentPlayerKey === localPlayerKey;
}

function createBoardRenderInputs(presentationOverlayState?: unknown, baseVisualStateOverride?: any) {
    const BoardVisualModel = _require('./model');
    const override = baseVisualStateOverride && typeof baseVisualStateOverride === 'object'
        && baseVisualStateOverride.gameState && typeof baseVisualStateOverride.gameState === 'object'
        && baseVisualStateOverride.cardState && typeof baseVisualStateOverride.cardState === 'object'
        ? baseVisualStateOverride
        : null;
    const visualPair = override || _resolveVisualRenderPairForDiff();
    const viewerContext = _resolveViewerContextForDiff(visualPair.cardState);
    return Object.freeze({
        baseVisualState: Object.freeze({
            gameState: visualPair.gameState,
            cardState: visualPair.cardState,
            viewerContext: Object.freeze({ ...viewerContext }),
            canControlCurrentTurn: _canLocalPlayerControlCurrentTurnForDiff(
                visualPair.gameState,
                visualPair.cardState,
                viewerContext
            )
        }),
        presentationOverlayState: BoardVisualModel.validateBoardPresentationOverlayState(presentationOverlayState)
    });
}

function createBoardPresentationOverlayState(renderProjection: any, cellState: any, initialOverlay?: unknown) {
    const BoardVisualModel = _require('./model');
    const base = BoardVisualModel.validateBoardPresentationOverlayState(initialOverlay);
    const previewHints = Array.from(base.previewHints || []);
    const previewCellKeys = new Set(base.previewCellKeys || []);
    const selectedCellKeys = new Set(base.selectedCellKeys || []);
    const directionHints = Array.from(base.directionHints || []);
    const collect = (cell: any, row: number, col: number) => {
        if (!cell) return;
        const cellKey = `${row},${col}`;
        const addPreview = (kind: string, active: boolean) => {
            if (!active) return;
            previewCellKeys.add(cellKey);
            previewHints.push({ cellKey, kind });
        };
        addPreview('random-spawn', cell.isRandomSpawnPreview === true);
        addPreview('selected-target', cell.isSelectedTargetHighlighted === true);
        addPreview('super-attraction-path', cell.isSuperAttractionPathPreview === true);
        addPreview('super-attraction-destination', cell.isSuperAttractionPreviewDestination === true);
        if (cell.isSelectedTargetHighlighted === true) selectedCellKeys.add(cellKey);
    };
    const shape = _getStateBoardShapeForDiff(cellState);
    for (let row = 0; row < shape.rows; row += 1) {
        for (let col = 0; col < shape.cols; col += 1) collect(cellState && cellState[row] && cellState[row][col], row, col);
    }
    for (const expansion of _getExpansionStateListForDiff(cellState)) {
        collect(expansion, expansion.row, expansion.col);
    }
    const hintProjection = renderProjection && renderProjection.hintProjection && typeof renderProjection.hintProjection === 'object'
        ? renderProjection.hintProjection
        : {};
    const collectDirectionHints = (mapValue: any, kind: string) => {
        if (!(mapValue instanceof Map)) return;
        for (const [cellKey, rawDirections] of mapValue.entries()) {
            const directions = (Array.isArray(rawDirections) ? rawDirections : [rawDirections])
                .map((value: any) => String(value || '').trim())
                .filter((value: string) => !!value);
            for (const directionKey of directions) {
                directionHints.push({
                    id: `${kind}:${String(cellKey)}:${directionKey}`,
                    cellKey: String(cellKey),
                    directionKey,
                    kind
                });
            }
        }
    };
    const expansionKind = String(renderProjection && renderProjection.pending && renderProjection.pending.type || '').toUpperCase() === 'BOARD_EXPANSION_WILL'
        ? 'board-expansion-will'
        : 'board-expansion-god';
    collectDirectionHints(hintProjection.boardExpansionDirectionHintMap, expansionKind);
    collectDirectionHints(hintProjection.boardShrinkWillDirectionHintMap, 'board-shrink-will');
    collectDirectionHints(hintProjection.boardShrinkGodDirectionHintMap, 'board-shrink-god');
    const hoverTarget = superAttractionHoverPreview && superAttractionHoverPreview.target;
    const hoveredCellKey = hoverTarget && Number.isInteger(hoverTarget.row) && Number.isInteger(hoverTarget.col)
        ? `${hoverTarget.row},${hoverTarget.col}`
        : base.hoveredCellKey;
    const interactionLocked = base.interactionLocked === true || !!(
        PlaybackStateModule
        && typeof PlaybackStateModule.shouldDeferBoardUpdate === 'function'
        && PlaybackStateModule.shouldDeferBoardUpdate({ cardState: renderProjection && renderProjection.cardState }) === true
    );
    return BoardVisualModel.validateBoardPresentationOverlayState({
        ...base,
        hoveredCellKey,
        previewCellKeys: Array.from(previewCellKeys),
        previewHints,
        selectedCellKeys: Array.from(selectedCellKeys),
        directionHints,
        interactionLocked
    });
}

function _createCellStateProjectorContextForDiff(inputs?: any) {
    const base = inputs && inputs.baseVisualState && typeof inputs.baseVisualState === 'object'
        ? inputs.baseVisualState
        : null;
    const constants = _getBoardValueConstantsForDiff();
    return {
        state: {
            resolveGameState: base ? () => base.gameState : _resolveGameStateForDiffRender,
            resolveCardState: base ? () => base.cardState : _resolveCardStateForDiffRender,
            getBoardShape: _getBoardShapeForDiff,
            buildEmptyCellState: _buildEmptyCellStateForDiffRender,
            cardLogic: (typeof CardLogic !== 'undefined' ? CardLogic : undefined),
            getPlayerKey: _getPlayerKeyForDiff,
            resolveViewerContext: base && base.viewerContext
                ? () => base.viewerContext
                : _resolveViewerContextForDiff,
            normalizeViewerContext: (value: any) => (
                ViewerContextModule && typeof ViewerContextModule.toBoardViewerContext === 'function'
                    ? ViewerContextModule.toBoardViewerContext(value)
                    : (value === 'white' || value === 'spectator' ? value : 'black')
            ),
            canLocalPlayerControlCurrentTurn: base && typeof base.canControlCurrentTurn === 'boolean'
                ? () => base.canControlCurrentTurn
                : () => _canLocalPlayerControlCurrentTurnForDiff(
                    base && base.gameState,
                    base && base.cardState,
                    base && base.viewerContext
                ),
            resolveBoardConfig: _resolveBoardConfigForDiff,
            createBoardView: (gameStateValue: any, options?: any) => _createBoardViewForDiff(
                gameStateValue,
                base ? base.cardState : options && options.cardState
            ),
            constants
        },
        hints: {
            buildBoardHintProjection: _buildBoardHintProjectionForDiff,
            getActiveSuperAttractionPreview: _getActiveSuperAttractionPreviewForDiff,
            collectSuperAttractionPreviewKeys: _collectSuperAttractionPreviewKeys
        },
        markers: {
            adapter: (typeof MarkersAdapter !== 'undefined' ? MarkersAdapter : undefined),
            isReversiMode: _isReversiModeForDiffRenderer,
            isBombCategory: _isBombCategoryMarkerForDiff,
            isBoardHiddenTrap: _isBoardHiddenTrap,
            isActiveManifestAura: _isActiveManifestAuraMarkerForDiff,
            isManifestStoneType: _isManifestStoneTypeForDiff,
            resolveSpecialDisplayTurns: _resolveSpecialDisplayTurnsForDiff,
            isFiniteTimedLabelValue: _isFiniteTimedLabelValueForDiff,
            resolveFlipEvadeDisplay: _resolveFlipEvadeDisplayForDiff,
            resolveDestroyEvadeDisplay: _resolveDestroyEvadeDisplayForDiff
        },
        debug: {
            isDebugWorkVisuals: () => (typeof window !== 'undefined' && window.DEBUG_WORK_VISUALS === true),
            isDebugHumanVsHuman: () => (typeof window !== 'undefined' && window.DEBUG_HUMAN_VS_HUMAN),
            warn: (...args: any[]) => console.warn(...args),
            log: (...args: any[]) => console.log(...args)
        }
    };
}

/**
 * 現在のゲーム状態からセル状態を構築
 * Build cell state from current game state
 * @returns {Array<Array<CellState>>} 8x8セル状態配列
 */
function createBoardRenderProjection(operationCounters?: any, inputs?: any) {
    return DiffRendererProjector.createBoardRenderProjection(_createCellStateProjectorContextForDiff(inputs), operationCounters);
}

function buildCurrentCellState(renderProjection?: any, inputs?: any) {
    return DiffRendererProjector.buildCurrentCellState(_createCellStateProjectorContextForDiff(inputs), renderProjection);
}

function buildBoardRenderModel(renderProjection?: any, cellState?: any, options?: any) {
    return DiffRendererProjector.buildBoardRenderModel(
        _createCellStateProjectorContextForDiff(options && options.inputs),
        renderProjection,
        cellState,
        options
    );
}

function _isReversiModeForDiffRenderer() {
    const root = (typeof window !== 'undefined')
        ? window
        : (typeof globalThis !== 'undefined' ? globalThis : null);
    try {
        if (root && typeof (root as any).getCurrentMatchMode === 'function') {
            const mode = (root as any).getCurrentMatchMode();
            if (mode === 'reversi' || mode === 'othello') return true;
        }
    } catch (e) { /* ignore */ }
    try {
        if (root && (((root as any).REVERSI_MODE_ACTIVE === true) || ((root as any).__REVERSI_MODE_ACTIVE === true))) {
            return true;
        }
    } catch (e) { /* ignore */ }
    try {
        if (root && (((root as any).OTHELLO_MODE_ACTIVE === true) || ((root as any).__OTHELLO_MODE_ACTIVE === true))) {
            return true;
        }
    } catch (e) { /* ignore */ }
    return false;
}

function setBoardVisualPreparedState(value: { gameState: any; cardState: any } | null): { gameState: any; cardState: any } | null {
  const previous = activePreparedVisualStateForDiff;
  activePreparedVisualStateForDiff = value;
  return previous;
}

function setBoardVisualHoverPreview(value: any): void {
  superAttractionHoverPreview = value || null;
}

function getBoardVisualHoverPreview(): any {
  return superAttractionHoverPreview;
}

function clearBoardVisualHoverPreview(): boolean {
  if (!superAttractionHoverPreview) return false;
  superAttractionHoverPreview = null;
  return true;
}

function setBoardVisualHoverCell(row: any, col: any): boolean {
  const target = _normalizeSuperAttractionPreviewPoint({ row, col });
  const gameStateValue = _resolveGameStateForDiffRender();
  const cardStateValue = _resolveCardStateForDiffRender();
  const playerKey = gameStateValue ? _getPlayerKeyForDiff(gameStateValue.currentPlayer) : null;
  const pending = playerKey && cardStateValue?.pendingEffectByPlayer
    ? cardStateValue.pendingEffectByPlayer[playerKey]
    : null;
  const firstTarget = _normalizeSuperAttractionPreviewPoint(pending && pending.firstTarget);
  if (
    !target
    || !firstTarget
    || pending?.stage !== 'selectTarget'
    || pending?.type !== 'SUPER_ATTRACTION_WILL'
    || (target.row === firstTarget.row && target.col === firstTarget.col)
    || typeof CardLogic === 'undefined'
    || !CardLogic
    || typeof CardLogic.getSuperAttractionPathPreview !== 'function'
  ) {
    return clearBoardVisualHoverPreview();
  }
  const signature = [
    playerKey,
    pending.cardId || '',
    pending.pendingEffectId || '',
    firstTarget.row,
    firstTarget.col,
    target.row,
    target.col
  ].join('|');
  if (superAttractionHoverPreview?.signature === signature) return false;
  let candidates: any[] = [];
  try {
    const result = CardLogic.getSuperAttractionPathPreview(
      cardStateValue,
      gameStateValue,
      firstTarget,
      target
    );
    candidates = Array.isArray(result) ? result : [];
  } catch (_error) {
    candidates = [];
  }
  if (!candidates.length) return clearBoardVisualHoverPreview();
  superAttractionHoverPreview = { signature, firstTarget, target, candidates };
  return true;
}

const BoardVisualStateAdapter = {
  createBoardRenderInputs,
  createBoardPresentationOverlayState,
  createBoardRenderProjection,
  buildCurrentCellState,
  buildBoardRenderModel,
  setBoardVisualPreparedState,
  setBoardVisualHoverPreview,
  getBoardVisualHoverPreview,
  setBoardVisualHoverCell,
  clearBoardVisualHoverPreview
};

export = BoardVisualStateAdapter;
