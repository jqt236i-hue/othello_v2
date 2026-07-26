/**
 * Shared board utilities – geometry, bounds, cell queries, and canonicalisation.
 *
 * @fileoverview Pure helpers used by game logic, UI rendering, AI evaluation,
 *   and network serialisation. Shape attachment is a temporary compatibility
 *   facade backed by module-private caches; board arrays are never decorated.
 */

(function (root: any, factory) {
    if (typeof module === 'object' && module.exports) {
        module.exports = factory(require('../shared-constants'), require('./board-utils'), require('./board/padded-coordinates'), require('./board/canonical-encoding'), require('./board/notation'), require('./board/dimensions'), require('./board/configuration'), require('./board/initial-layout'), require('./board/expansion-descriptors'), require('./board/shape-metadata'), require('./board/cell-access'), require('./board/corners'), require('./board/edge-runs'), require('./board/risk-cells'), require('./board/shape-iteration'), require('./board/legal-moves'), require('./board/control-counts'), require('./board/topology'), require('./board/expansion-sockets'), require('./board/state-kernel'));
    } else if (root && root.SharedConstants) {
        root.SharedBoardUtils = factory(root.SharedConstants, root.BoardUtils || null, root.PaddedBoardCoordinates || null, root.CanonicalBoardEncoding || null, root.BoardNotation || null, root.BoardDimensions || null, root.BoardConfiguration || null, root.InitialBoardLayout || null, root.BoardExpansionDescriptors || null, root.BoardShapeMetadata || null, root.BoardCellAccess || null, root.BoardCorners || null, root.BoardEdgeRuns || null, root.BoardRiskCells || null, root.BoardShapeIteration || null, root.BoardLegalMoves || null, root.BoardControlCounts || null, root.BoardTopology || null, root.BoardExpansionSockets || null, root.BoardStateKernel || null);
    } else {
        root.SharedBoardUtils = factory(root.SharedConstants, null, root.PaddedBoardCoordinates || null, root.CanonicalBoardEncoding || null, root.BoardNotation || null, root.BoardDimensions || null, root.BoardConfiguration || null, root.InitialBoardLayout || null, root.BoardExpansionDescriptors || null, root.BoardShapeMetadata || null, root.BoardCellAccess || null, root.BoardCorners || null, root.BoardEdgeRuns || null, root.BoardRiskCells || null, root.BoardShapeIteration || null, root.BoardLegalMoves || null, root.BoardControlCounts || null, root.BoardTopology || null, root.BoardExpansionSockets || null, root.BoardStateKernel || null);
    }
}(typeof globalThis !== 'undefined' ? globalThis : (typeof self !== 'undefined' ? self : this as unknown as Record<string, unknown>), function (SharedConstants: unknown, BoardUtilsModule: unknown, PaddedBoardCoordinatesModule: typeof import('./board/padded-coordinates') | null, CanonicalBoardEncodingModule: typeof import('./board/canonical-encoding') | null, BoardNotationModule: typeof import('./board/notation') | null, BoardDimensionsModule: typeof import('./board/dimensions') | null, BoardConfigurationModule: typeof import('./board/configuration') | null, InitialBoardLayoutModule: typeof import('./board/initial-layout') | null, BoardExpansionDescriptorsModule: typeof import('./board/expansion-descriptors') | null, BoardShapeMetadataModule: typeof import('./board/shape-metadata') | null, BoardCellAccessModule: typeof import('./board/cell-access') | null, BoardCornersModule: typeof import('./board/corners') | null, BoardEdgeRunsModule: typeof import('./board/edge-runs') | null, BoardRiskCellsModule: typeof import('./board/risk-cells') | null, BoardShapeIterationModule: typeof import('./board/shape-iteration') | null, BoardLegalMovesModule: typeof import('./board/legal-moves') | null, BoardControlCountsModule: typeof import('./board/control-counts') | null, BoardTopologyModule: typeof import('./board/topology') | null, BoardExpansionSocketsModule: typeof import('./board/expansion-sockets') | null, BoardStateKernelModule: typeof import('./board/state-kernel') | null) {
    'use strict';

    interface CellCoord {
        row: number;
        col: number;
    }

    interface DiscCounts {
        black: number;
        white: number;
    }

    interface CanonicalResult {
        boardKey: string;
        transformId: number;
        size: number;
        minRow: number;
        minCol: number;
    }

    const BoardUtils = BoardUtilsModule || null;
    if (!PaddedBoardCoordinatesModule) throw new Error('PaddedBoardCoordinates is required by SharedBoardUtils');
    const PaddedBoardCoordinates = PaddedBoardCoordinatesModule;
    const BOARD_SHAPE_META_KEY = '__sharedBoardShapeMeta';
    const EMPTY: number = Number.isFinite(Number(SharedConstants && (SharedConstants as { EMPTY?: unknown }).EMPTY))
        ? Number((SharedConstants as { EMPTY?: unknown }).EMPTY)
        : 0;
    const BLACK: number = Number.isFinite(Number(SharedConstants && (SharedConstants as { BLACK?: unknown }).BLACK))
        ? Number((SharedConstants as { BLACK?: unknown }).BLACK)
        : 1;
    const WHITE: number = Number.isFinite(Number(SharedConstants && (SharedConstants as { WHITE?: unknown }).WHITE))
        ? Number((SharedConstants as { WHITE?: unknown }).WHITE)
        : -1;
    const DEFAULT_BOARD_ROWS: number = Number.isFinite(Number(SharedConstants && (SharedConstants as { DEFAULT_BOARD_ROWS?: unknown }).DEFAULT_BOARD_ROWS))
        ? Math.max(1, Math.floor(Number((SharedConstants as { DEFAULT_BOARD_ROWS?: unknown }).DEFAULT_BOARD_ROWS)))
        : 8;
    const DEFAULT_BOARD_COLS: number = Number.isFinite(Number(SharedConstants && (SharedConstants as { DEFAULT_BOARD_COLS?: unknown }).DEFAULT_BOARD_COLS))
        ? Math.max(1, Math.floor(Number((SharedConstants as { DEFAULT_BOARD_COLS?: unknown }).DEFAULT_BOARD_COLS)))
        : 8;
    const MIN_BOARD_ROWS: number = Number.isFinite(Number(SharedConstants && (SharedConstants as { MIN_BOARD_ROWS?: unknown }).MIN_BOARD_ROWS))
        ? Math.max(1, Math.floor(Number((SharedConstants as { MIN_BOARD_ROWS?: unknown }).MIN_BOARD_ROWS)))
        : 4;
    const MAX_BOARD_ROWS: number = Number.isFinite(Number(SharedConstants && (SharedConstants as { MAX_BOARD_ROWS?: unknown }).MAX_BOARD_ROWS))
        ? Math.max(MIN_BOARD_ROWS, Math.floor(Number((SharedConstants as { MAX_BOARD_ROWS?: unknown }).MAX_BOARD_ROWS)))
        : DEFAULT_BOARD_ROWS;
    const MIN_BOARD_COLS: number = Number.isFinite(Number(SharedConstants && (SharedConstants as { MIN_BOARD_COLS?: unknown }).MIN_BOARD_COLS))
        ? Math.max(1, Math.floor(Number((SharedConstants as { MIN_BOARD_COLS?: unknown }).MIN_BOARD_COLS)))
        : 4;
    const MAX_BOARD_COLS: number = Number.isFinite(Number(SharedConstants && (SharedConstants as { MAX_BOARD_COLS?: unknown }).MAX_BOARD_COLS))
        ? Math.max(MIN_BOARD_COLS, Math.floor(Number((SharedConstants as { MAX_BOARD_COLS?: unknown }).MAX_BOARD_COLS)))
        : Math.max(DEFAULT_BOARD_COLS, DEFAULT_BOARD_ROWS);
    const DEFAULT_CIRCLE_BOARD_SIZE: number = Number.isFinite(Number(SharedConstants && (SharedConstants as { DEFAULT_CIRCLE_BOARD_SIZE?: unknown }).DEFAULT_CIRCLE_BOARD_SIZE))
        ? Math.floor(Number((SharedConstants as { DEFAULT_CIRCLE_BOARD_SIZE?: unknown }).DEFAULT_CIRCLE_BOARD_SIZE))
        : 10;
    const MIN_CIRCLE_BOARD_SIZE: number = Number.isFinite(Number(SharedConstants && (SharedConstants as { MIN_CIRCLE_BOARD_SIZE?: unknown }).MIN_CIRCLE_BOARD_SIZE))
        ? Math.floor(Number((SharedConstants as { MIN_CIRCLE_BOARD_SIZE?: unknown }).MIN_CIRCLE_BOARD_SIZE))
        : 6;
    const MAX_CIRCLE_BOARD_SIZE: number = Number.isFinite(Number(SharedConstants && (SharedConstants as { MAX_CIRCLE_BOARD_SIZE?: unknown }).MAX_CIRCLE_BOARD_SIZE))
        ? Math.floor(Number((SharedConstants as { MAX_CIRCLE_BOARD_SIZE?: unknown }).MAX_CIRCLE_BOARD_SIZE))
        : 16;
    const CIRCLE_BOARD_SIZE_STEP: number = Number.isFinite(Number(SharedConstants && (SharedConstants as { CIRCLE_BOARD_SIZE_STEP?: unknown }).CIRCLE_BOARD_SIZE_STEP))
        ? Math.max(1, Math.floor(Number((SharedConstants as { CIRCLE_BOARD_SIZE_STEP?: unknown }).CIRCLE_BOARD_SIZE_STEP)))
        : 2;
    const MAIN_BOARD_SIZE = DEFAULT_BOARD_ROWS;
    const OUTER_MIN = -1;
    const OUTER_MAX = DEFAULT_BOARD_COLS;
    const PADDED_BOARD_MIN = OUTER_MIN;
    const PADDED_BOARD_MAX = OUTER_MAX;
    const PADDED_BOARD_SIZE = (PADDED_BOARD_MAX - PADDED_BOARD_MIN) + 1;
    const DIRECTIONS: number[][] = (SharedConstants && (SharedConstants as { DIRECTIONS?: number[][] }).DIRECTIONS)
        ? (SharedConstants as { DIRECTIONS: number[][] }).DIRECTIONS
        : [
            [-1, -1], [-1, 0], [-1, 1],
            [0, -1],           [0, 1],
            [1, -1],  [1, 0],  [1, 1]
        ];

    function toBoardCellKey(row: number, col: number): string {
        return `${row},${col}`;
    }

    function normalizeOwner(value: unknown): number {
        if (value === 1 || value === -1) return value as number;
        return EMPTY;
    }

    if (!BoardDimensionsModule) throw new Error('BoardDimensions is required by SharedBoardUtils');
    const BoardDimensions = BoardDimensionsModule.createBoardDimensions({
        defaultRows: DEFAULT_BOARD_ROWS,
        defaultCols: DEFAULT_BOARD_COLS,
        minRows: MIN_BOARD_ROWS,
        maxRows: MAX_BOARD_ROWS,
        minCols: MIN_BOARD_COLS,
        maxCols: MAX_BOARD_COLS
    });
    const clampBoardDimension = BoardDimensions.clampBoardDimension;
    const getBoardDimensionBounds = BoardDimensions.getBoardDimensionBounds;
    const normalizeBoardDimensionValue = BoardDimensions.normalizeBoardDimensionValue;
    const stepBoardDimensionValue = BoardDimensions.stepBoardDimensionValue;

    if (!BoardConfigurationModule) throw new Error('BoardConfiguration is required by SharedBoardUtils');
    const BoardConfiguration = BoardConfigurationModule.createBoardConfiguration({
        defaultRows: DEFAULT_BOARD_ROWS,
        defaultCols: DEFAULT_BOARD_COLS,
        minRows: MIN_BOARD_ROWS,
        maxRows: MAX_BOARD_ROWS,
        minCols: MIN_BOARD_COLS,
        maxCols: MAX_BOARD_COLS,
        outerMin: OUTER_MIN,
        defaultCircleSize: DEFAULT_CIRCLE_BOARD_SIZE,
        minCircleSize: MIN_CIRCLE_BOARD_SIZE,
        maxCircleSize: MAX_CIRCLE_BOARD_SIZE,
        circleSizeStep: CIRCLE_BOARD_SIZE_STEP,
        clampBoardDimension
    });
    const buildBoardConfig = BoardConfiguration.buildBoardConfig;
    const normalizeBoardShape = BoardConfiguration.normalizeBoardShape;
    const normalizeCircleBoardSize = BoardConfiguration.normalizeCircleBoardSize;
    const normalizeBoardConfig = BoardConfiguration.normalizeBoardConfig;
    const extractBoardConfigSource = BoardConfiguration.extractBoardConfigSource;
    const maybeResolveBoardConfig = BoardConfiguration.maybeResolveBoardConfig;
    const readBoardGeometry = BoardConfiguration.readBoardGeometry;
    const compareBoardGeometry = BoardConfiguration.compareBoardGeometry;
    const resolveBoardConfig = BoardConfiguration.resolveBoardConfig;
    const resolveBaseBoardBounds = BoardConfiguration.resolveBaseBoardBounds;
    const resolveOuterBounds = BoardConfiguration.resolveOuterBounds;
    const getBoardRows = BoardConfiguration.getBoardRows;
    const getBoardCols = BoardConfiguration.getBoardCols;

    if (!BoardNotationModule) throw new Error('BoardNotation is required by SharedBoardUtils');
    const BoardNotation = BoardNotationModule.createBoardNotation({ resolveBoardConfig });
    if (!InitialBoardLayoutModule) throw new Error('InitialBoardLayout is required by SharedBoardUtils');
    const InitialBoardLayout = InitialBoardLayoutModule.createInitialLayout({
        empty: EMPTY,
        black: BLACK,
        white: WHITE,
        resolveBoardConfig
    });
    const isMainBoardCell = InitialBoardLayout.isMainBoardCell;
    const collectMainBoardCoordinates = InitialBoardLayout.collectMainBoardCoordinates;
    const createEmptyBoard = InitialBoardLayout.createEmptyBoard;
    const getOpeningAnchor = InitialBoardLayout.getOpeningAnchor;
    const getOpeningPlacements = InitialBoardLayout.getOpeningPlacements;
    const getOpeningCells = InitialBoardLayout.getOpeningCells;

    function isPaddedBoardCoordinate(row: number, col: number): boolean {
        return PaddedBoardCoordinates.isPaddedBoardCoordinate(row, col, {
            min: PADDED_BOARD_MIN,
            max: PADDED_BOARD_MAX
        });
    }

    function toPaddedBoardIndex(row: number, col: number): number {
        return PaddedBoardCoordinates.toPaddedBoardIndex(row, col, {
            min: PADDED_BOARD_MIN,
            max: PADDED_BOARD_MAX
        });
    }

    function fromPaddedBoardIndex(index: number): CellCoord | null {
        return PaddedBoardCoordinates.fromPaddedBoardIndex(index, {
            min: PADDED_BOARD_MIN,
            max: PADDED_BOARD_MAX
        });
    }

    if (!BoardExpansionDescriptorsModule) throw new Error('BoardExpansionDescriptors is required by SharedBoardUtils');
    const BoardExpansionDescriptors = BoardExpansionDescriptorsModule.createExpansionDescriptors({
        resolveOuterBounds,
        resolveBaseBounds: resolveBaseBoardBounds,
        isMainBoardCell,
        normalizeOwner,
        maxAbsCoordinate: 256
    });
    const isExpansionCoordinate = BoardExpansionDescriptors.isExpansionCoordinate;
    const resolveExpansionSide = BoardExpansionDescriptors.resolveExpansionSide;
    const collectExpansionDescriptors = BoardExpansionDescriptors.collectExpansionDescriptors;

    if (!BoardShapeMetadataModule) throw new Error('BoardShapeMetadata is required by SharedBoardUtils');
    const BoardShapeMetadata = BoardShapeMetadataModule.createBoardShapeMetadata({
        metaKey: BOARD_SHAPE_META_KEY,
        defaultRows: DEFAULT_BOARD_ROWS,
        defaultCols: DEFAULT_BOARD_COLS,
        toBoardCellKey,
        normalizeOwner,
        resolveBoardConfig,
        isMainBoardCell,
        collectExpansionDescriptors
    });
    const getBoardShapeMeta = BoardShapeMetadata.getBoardShapeMeta;
    const collectMeteorHoleKeys = BoardShapeMetadata.collectMeteorHoleKeys;
    const attachBoardShape = BoardShapeMetadata.attachBoardShape;
    const copyBoardShape = BoardShapeMetadata.copyBoardShape;
    const cloneBoard = BoardShapeMetadata.cloneBoard;
    const setAttachedExpansionOwner = BoardShapeMetadata.setAttachedExpansionOwner;

    if (!BoardShapeIterationModule) throw new Error('BoardShapeIteration is required by SharedBoardUtils');
    const BoardShapeIteration = BoardShapeIterationModule.createShapeIteration({
        black: BLACK,
        white: WHITE,
        resolveBoardConfig,
        collectExpansionDescriptors,
        getBoardShapeMeta,
        countDiscsViaBoardUtils: BoardUtils && typeof (BoardUtils as { countDiscs?: unknown }).countDiscs === 'function'
            ? (BoardUtils as { countDiscs: (board: unknown) => DiscCounts }).countDiscs
            : null
    });
    const forEachBoardShapeCell = BoardShapeIteration.forEachBoardShapeCell;
    const countDiscsByPlayer = BoardShapeIteration.countDiscsByPlayer;
    const countDiscs = BoardShapeIteration.countDiscs;

    if (!BoardCellAccessModule) throw new Error('BoardCellAccess is required by SharedBoardUtils');
    const BoardCellAccess = BoardCellAccessModule.createCellAccess({
        defaultRows: DEFAULT_BOARD_ROWS,
        defaultCols: DEFAULT_BOARD_COLS,
        empty: EMPTY,
        toBoardCellKey,
        normalizeOwner,
        resolveBoardConfig,
        getBoardShapeMeta,
        setAttachedExpansionOwner
    });
    const resolveBoardBounds = BoardCellAccess.resolveBoardBounds;
    const isStandardBoard8x8 = BoardCellAccess.isStandardBoard8x8;
    const hasPlayableCell = BoardCellAccess.hasPlayableCell;
    const collectBoardCoordinates = BoardCellAccess.collectBoardCoordinates;
    const getCellValue = BoardCellAccess.getCellValue;
    const setCellValue = BoardCellAccess.setCellValue;
    const countBoardEmpties = BoardCellAccess.countBoardEmpties;

    if (!BoardTopologyModule) throw new Error('BoardTopology is required by SharedBoardUtils');
    const BoardTopology = BoardTopologyModule.createBoardTopology({
        toBoardCellKey,
        resolveBoardConfig,
        isMainBoardCell,
        collectExpansionDescriptors,
        getBoardShapeMeta,
        collectMeteorHoleKeys
    });
    const buildBoardTopology = BoardTopology.buildBoardTopology;

    if (!BoardStateKernelModule) throw new Error('BoardStateKernel is required by SharedBoardUtils');
    const BoardStateKernel = BoardStateKernelModule.createStateKernel({
        empty: EMPTY,
        black: BLACK,
        white: WHITE,
        directions: DIRECTIONS,
        maxAbsCoordinate: 256,
        toBoardCellKey,
        normalizeOwner,
        resolveBoardConfig,
        isMainBoardCell,
        resolveExpansionSide,
        collectExpansionDescriptors,
        collectMeteorHoleKeys,
        buildBoardTopology
    });
    const inspectBoardState = BoardStateKernel.inspectBoardState;
    const createBoardView = BoardStateKernel.createBoardView;
    const createDenseBoardView = BoardStateKernel.createDenseBoardView;
    const canonicalizeStateBoard = BoardStateKernel.canonicalizeStateBoard;
    const getStateCellValue = BoardStateKernel.getStateCellValue;
    const setStateCellValue = BoardStateKernel.setStateCellValue;
    const addStateExpansionCells = BoardStateKernel.addStateExpansionCells;
    const countStateDiscs = BoardStateKernel.countStateDiscs;

    if (!BoardExpansionSocketsModule) throw new Error('BoardExpansionSockets is required by SharedBoardUtils');
    const BoardExpansionSockets = BoardExpansionSocketsModule.createExpansionSockets({
        toBoardCellKey,
        buildBoardTopology
    });
    const getExteriorVoidKeys = BoardExpansionSockets.getExteriorVoidKeys;
    const getBoardExpansionEdgeSockets = BoardExpansionSockets.getBoardExpansionEdgeSockets;
    const getBoardExpansionCornerSockets = BoardExpansionSockets.getBoardExpansionCornerSockets;

    if (!CanonicalBoardEncodingModule) throw new Error('CanonicalBoardEncoding is required by SharedBoardUtils');
    const CanonicalBoardEncoding = CanonicalBoardEncodingModule.createCanonicalBoardEncoding({ resolveBoardBounds, collectBoardCoordinates, getCellValue });

    if (!BoardCornersModule) throw new Error('BoardCorners is required by SharedBoardUtils');
    const BoardCorners = BoardCornersModule.createBoardCorners({
        toBoardCellKey,
        getBoardShapeMeta,
        collectBoardCoordinates,
        hasPlayableCell,
        resolveBoardBounds
    });
    const buildCornerKeySet = BoardCorners.buildCornerKeySet;
    const getCornerCells = BoardCorners.getCornerCells;
    const getPerimeterCells = BoardCorners.getPerimeterCells;
    const getEffectiveCornerCells = BoardCorners.getEffectiveCornerCells;
    const getEffectiveEdgeCells = BoardCorners.getEffectiveEdgeCells;
    const isCornerCell = BoardCorners.isCornerCell;
    const isEdgeCell = BoardCorners.isEdgeCell;
    const isEffectiveCornerCell = BoardCorners.isEffectiveCornerCell;
    const isEffectiveEdgeCell = BoardCorners.isEffectiveEdgeCell;

    if (!BoardEdgeRunsModule) throw new Error('BoardEdgeRuns is required by SharedBoardUtils');
    const BoardEdgeRuns = BoardEdgeRunsModule.createEdgeRuns({
        toBoardCellKey,
        normalizeOwner,
        getCornerCells,
        hasPlayableCell,
        isCornerCell,
        isEdgeCell,
        getCellValue
    });
    const getCornerEdgeLineDescriptors = BoardEdgeRuns.getCornerEdgeLineDescriptors;
    const summarizeEdgeRuns = BoardEdgeRuns.summarizeEdgeRuns;
    const countAdjacentLoneEdgeDiscs = BoardEdgeRuns.countAdjacentLoneEdgeDiscs;

    if (!BoardRiskCellsModule) throw new Error('BoardRiskCells is required by SharedBoardUtils');
    const BoardRiskCells = BoardRiskCellsModule.createRiskCells({
        toBoardCellKey,
        getBoardShapeMeta,
        collectBoardCoordinates,
        hasPlayableCell,
        resolveBoardBounds,
        getCornerCells,
        isCornerCell,
        isEdgeCell
    });
    const getCornerProximity = BoardRiskCells.getCornerProximity;
    const isCorner = BoardRiskCells.isCorner;
    const isEdge = BoardRiskCells.isEdge;
    const isXSquare = BoardRiskCells.isXSquare;
    const isCSquare = BoardRiskCells.isCSquare;
    const getCellType = BoardRiskCells.getCellType;

    if (!BoardLegalMovesModule) throw new Error('BoardLegalMoves is required by SharedBoardUtils');
    const BoardLegalMoves = BoardLegalMovesModule.createLegalMoves({
        empty: EMPTY,
        directions: DIRECTIONS,
        hasPlayableCell,
        getCellValue,
        collectBoardCoordinates
    });
    const getFlipsBasic = BoardLegalMoves.getFlipsBasic;
    const getLegalMovesBasic = BoardLegalMoves.getLegalMovesBasic;

    if (!BoardControlCountsModule) throw new Error('BoardControlCounts is required by SharedBoardUtils');
    const BoardControlCounts = BoardControlCountsModule.createControlCounts({
        getCellValue,
        getCornerCells,
        collectBoardCoordinates,
        isEdgeCell,
        isCornerCell
    });
    const countCornerControl = BoardControlCounts.countCornerControl;
    const countEdgeControl = BoardControlCounts.countEdgeControl;

    function toCellChar(value: unknown): string {
        return CanonicalBoardEncoding.toCellChar(value);
    }

    function transformCoord(row: number, col: number, size: number, transformId: number): CellCoord {
        return CanonicalBoardEncoding.transformCoord(row, col, size, transformId);
    }

    function encodeBoard(board: unknown): string {
        return CanonicalBoardEncoding.encodeBoard(board);
    }

    function canonicalizeBoard(board: unknown): CanonicalResult {
        return CanonicalBoardEncoding.canonicalizeBoard(board);
    }

    function mapCoordToCanonical(row: number, col: number, board: unknown, transformId: number): CellCoord | null {
        return CanonicalBoardEncoding.mapCoordToCanonical(row, col, board, transformId);
    }

    function makeCanonicalActionKey(move: unknown, board: unknown, transformId: number): string {
        return CanonicalBoardEncoding.makeCanonicalActionKey(move, board, transformId);
    }

    function formatPosTextJa(posOrRow: unknown, maybeCol?: unknown, maybeBoardOrConfig?: unknown): string {
        return BoardNotation.formatPosTextJa(posOrRow, maybeCol, maybeBoardOrConfig);
    }

    function posToNotation(posOrRow: unknown, maybeCol?: unknown, maybeBoardOrConfig?: unknown): string {
        return BoardNotation.posToNotation(posOrRow, maybeCol, maybeBoardOrConfig);
    }

    return {
        BOARD_SHAPE_META_KEY,
        BOARD_CONTRACT_VERSION: BoardStateKernelModule.BOARD_CONTRACT_VERSION,
        BOARD_DIGEST_VERSION: BoardStateKernelModule.BOARD_DIGEST_VERSION,
        DEFAULT_BOARD_ROWS,
        DEFAULT_BOARD_COLS,
        MIN_BOARD_ROWS,
        MAX_BOARD_ROWS,
        MIN_BOARD_COLS,
        MAX_BOARD_COLS,
        DEFAULT_CIRCLE_BOARD_SIZE,
        MIN_CIRCLE_BOARD_SIZE,
        MAX_CIRCLE_BOARD_SIZE,
        CIRCLE_BOARD_SIZE_STEP,
        getBoardDimensionBounds,
        normalizeBoardDimensionValue,
        stepBoardDimensionValue,
        MAIN_BOARD_SIZE,
        OUTER_MIN,
        OUTER_MAX,
        PADDED_BOARD_MIN,
        PADDED_BOARD_MAX,
        PADDED_BOARD_SIZE,
        buildBoardConfig,
        normalizeBoardShape,
        normalizeCircleBoardSize,
        normalizeBoardConfig,
        extractBoardConfigSource,
        maybeResolveBoardConfig,
        readBoardGeometry,
        compareBoardGeometry,
        resolveBoardConfig,
        resolveBaseBoardBounds,
        resolveOuterBounds,
        getBoardRows,
        getBoardCols,
        attachBoardShape,
        copyBoardShape,
        cloneBoard,
        getBoardShapeMeta,
        resolveBoardBounds,
        isStandardBoard8x8,
        isPaddedBoardCoordinate,
        toPaddedBoardIndex,
        fromPaddedBoardIndex,
        isMainBoardCell,
        isExpansionCoordinate,
        resolveExpansionSide,
        collectExpansionDescriptors,
        buildBoardTopology,
        inspectBoardState,
        createBoardView,
        createDenseBoardView,
        canonicalizeStateBoard,
        getStateCellValue,
        setStateCellValue,
        addStateExpansionCells,
        countStateDiscs,
        getExteriorVoidKeys,
        getBoardExpansionEdgeSockets,
        getBoardExpansionCornerSockets,
        forEachBoardShapeCell,
        collectMainBoardCoordinates,
        createEmptyBoard,
        getOpeningAnchor,
        getOpeningPlacements,
        getOpeningCells,
        hasPlayableCell,
        collectBoardCoordinates,
        countDiscsByPlayer,
        countDiscs,
        getCellValue,
        setCellValue,
        countBoardEmpties,
        getCornerCells,
        getPerimeterCells,
        getEffectiveCornerCells,
        getEffectiveEdgeCells,
        getCornerEdgeLineDescriptors,
        getCornerProximity,
        isCornerCell,
        isEdgeCell,
        isEffectiveCornerCell,
        isEffectiveEdgeCell,
        isCorner,
        isEdge,
        isXSquare,
        isCSquare,
        getCellType,
        getFlipsBasic,
        getLegalMovesBasic,
        countCornerControl,
        countEdgeControl,
        summarizeEdgeRuns,
        countAdjacentLoneEdgeDiscs,
        transformCoord,
        encodeBoard,
        canonicalizeBoard,
        mapCoordToCanonical,
        makeCanonicalActionKey,
        formatPosTextJa,
        posToNotation,
        toBoardCellKey
    };
}));

export {};
