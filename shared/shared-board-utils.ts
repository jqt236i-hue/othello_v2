/**
 * Shared board utilities – geometry, bounds, cell queries, and canonicalisation.
 *
 * @fileoverview Pure helpers used by game logic, UI rendering, AI evaluation,
 *   and network serialisation. Raw board-array APIs are dense-only; topology
 *   aware callers must pass an explicit BoardContext.
 */

(function (root: any, factory) {
    if (typeof module === 'object' && module.exports) {
        module.exports = factory(require('../shared-constants'), require('./board-utils'), require('./board/padded-coordinates'), require('./board/canonical-encoding'), require('./board/notation'), require('./board/dimensions'), require('./board/configuration'), require('./board/initial-layout'), require('./board/expansion-descriptors'), require('./board/cell-access'), require('./board/corners'), require('./board/edge-runs'), require('./board/risk-cells'), require('./board/shape-iteration'), require('./board/legal-moves'), require('./board/control-counts'), require('./board/topology'), require('./board/expansion-sockets'), require('./board/state-kernel'));
    } else if (root && root.SharedConstants) {
        root.SharedBoardUtils = factory(root.SharedConstants, root.BoardUtils || null, root.PaddedBoardCoordinates || null, root.CanonicalBoardEncoding || null, root.BoardNotation || null, root.BoardDimensions || null, root.BoardConfiguration || null, root.InitialBoardLayout || null, root.BoardExpansionDescriptors || null, root.BoardCellAccess || null, root.BoardCorners || null, root.BoardEdgeRuns || null, root.BoardRiskCells || null, root.BoardShapeIteration || null, root.BoardLegalMoves || null, root.BoardControlCounts || null, root.BoardTopology || null, root.BoardExpansionSockets || null, root.BoardStateKernel || null);
    } else {
        root.SharedBoardUtils = factory(root.SharedConstants, null, root.PaddedBoardCoordinates || null, root.CanonicalBoardEncoding || null, root.BoardNotation || null, root.BoardDimensions || null, root.BoardConfiguration || null, root.InitialBoardLayout || null, root.BoardExpansionDescriptors || null, root.BoardCellAccess || null, root.BoardCorners || null, root.BoardEdgeRuns || null, root.BoardRiskCells || null, root.BoardShapeIteration || null, root.BoardLegalMoves || null, root.BoardControlCounts || null, root.BoardTopology || null, root.BoardExpansionSockets || null, root.BoardStateKernel || null);
    }
}(typeof globalThis !== 'undefined' ? globalThis : (typeof self !== 'undefined' ? self : this as unknown as Record<string, unknown>), function (SharedConstants: unknown, BoardUtilsModule: unknown, PaddedBoardCoordinatesModule: typeof import('./board/padded-coordinates') | null, CanonicalBoardEncodingModule: typeof import('./board/canonical-encoding') | null, BoardNotationModule: typeof import('./board/notation') | null, BoardDimensionsModule: typeof import('./board/dimensions') | null, BoardConfigurationModule: typeof import('./board/configuration') | null, InitialBoardLayoutModule: typeof import('./board/initial-layout') | null, BoardExpansionDescriptorsModule: typeof import('./board/expansion-descriptors') | null, BoardCellAccessModule: typeof import('./board/cell-access') | null, BoardCornersModule: typeof import('./board/corners') | null, BoardEdgeRunsModule: typeof import('./board/edge-runs') | null, BoardRiskCellsModule: typeof import('./board/risk-cells') | null, BoardShapeIterationModule: typeof import('./board/shape-iteration') | null, BoardLegalMovesModule: typeof import('./board/legal-moves') | null, BoardControlCountsModule: typeof import('./board/control-counts') | null, BoardTopologyModule: typeof import('./board/topology') | null, BoardExpansionSocketsModule: typeof import('./board/expansion-sockets') | null, BoardStateKernelModule: typeof import('./board/state-kernel') | null) {
    'use strict';

    interface CellCoord {
        row: number;
        col: number;
    }

    interface DiscCounts {
        black: number;
        white: number;
    }

    interface BoardContext {
        kind: typeof BOARD_CONTEXT_KIND;
        gameState: Record<string, unknown>;
        cardState: unknown;
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
    const BOARD_CONTEXT_KIND = 'board-context-v1';
    const NATIVE_OBJECT_CONSTRUCTOR_SOURCE = Function.prototype.toString.call(Object);
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

    function isRecord(value: unknown): value is Record<string, unknown> {
        return !!value && typeof value === 'object' && !Array.isArray(value);
    }

    function isBoardContext(value: unknown): value is BoardContext {
        if (!isRecord(value) || value.kind !== BOARD_CONTEXT_KIND) return false;
        return isRecord(value.gameState) && Array.isArray(value.gameState.board)
            && Object.prototype.hasOwnProperty.call(value, 'cardState');
    }

    function createBoardContext(gameState: unknown, cardState: unknown = null): BoardContext {
        if (!isRecord(gameState) || !Array.isArray(gameState.board)) {
            throw new Error('SharedBoardUtils.createBoardContext requires gameState.board');
        }
        return Object.freeze({
            kind: BOARD_CONTEXT_KIND,
            gameState,
            cardState: cardState === undefined ? null : cardState
        });
    }

    const isPlainObjectPrototype = (prototype: object | null): boolean => {
        if (prototype === null || prototype === Object.prototype) return true;
        const constructorDescriptor = Object.getOwnPropertyDescriptor(prototype, 'constructor');
        const constructor = constructorDescriptor && constructorDescriptor.value;
        return typeof constructor === 'function'
            && Function.prototype.toString.call(constructor) === NATIVE_OBJECT_CONSTRUCTOR_SOURCE;
    };

    function clonePlainValue(value: unknown, seen = new Map<object, unknown>()): unknown {
        if (!value || typeof value !== 'object') return value;
        const source = value as object;
        if (seen.has(source)) return seen.get(source);
        if (Array.isArray(value)) {
            const out: unknown[] = [];
            seen.set(source, out);
            for (const item of value) out.push(clonePlainValue(item, seen));
            return out;
        }
        const prototype = Object.getPrototypeOf(value);
        if (!isPlainObjectPrototype(prototype)) return value;
        const out: Record<string, unknown> = {};
        seen.set(source, out);
        for (const key of Object.keys(value as Record<string, unknown>)) {
            out[key] = clonePlainValue((value as Record<string, unknown>)[key], seen);
        }
        return out;
    }

    function cloneBoardContext(context: unknown): BoardContext {
        if (!isBoardContext(context)) {
            throw new Error('SharedBoardUtils.cloneBoardContext requires a BoardContext');
        }
        return createBoardContext(
            clonePlainValue(context.gameState),
            clonePlainValue(context.cardState)
        );
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
    const MAX_ABS_BOARD_COORDINATE =
        BoardExpansionDescriptorsModule.DEFAULT_BOARD_MAX_ABS_COORDINATE;
    const BoardExpansionDescriptors = BoardExpansionDescriptorsModule.createExpansionDescriptors({
        resolveOuterBounds,
        resolveBaseBounds: resolveBaseBoardBounds,
        isMainBoardCell,
        normalizeOwner,
        maxAbsCoordinate: MAX_ABS_BOARD_COORDINATE
    });
    const isExpansionCoordinate = BoardExpansionDescriptors.isExpansionCoordinate;
    const resolveExpansionSide = BoardExpansionDescriptors.resolveExpansionSide;
    const collectExpansionDescriptors = BoardExpansionDescriptors.collectExpansionDescriptors;

    function collectMeteorHoleKeys(cardState: unknown): Set<string> {
        const out = new Set<string>();
        const markers = isRecord(cardState) && Array.isArray(cardState.markers)
            ? cardState.markers
            : [];
        for (const marker of markers) {
            if (!isRecord(marker) || marker.kind !== 'specialStone' || !isRecord(marker.data)) continue;
            if (String(marker.data.type || '').toUpperCase() !== 'METEOR_HOLE') continue;
            const row = Number(marker.row);
            const col = Number(marker.col);
            if (Number.isInteger(row) && Number.isInteger(col)) {
                out.add(toBoardCellKey(row, col));
            }
        }
        return out;
    }

    if (!BoardShapeIterationModule) throw new Error('BoardShapeIteration is required by SharedBoardUtils');
    const BoardShapeIteration = BoardShapeIterationModule.createShapeIteration({
        black: BLACK,
        white: WHITE,
        resolveBoardConfig,
        collectExpansionDescriptors,
        countDiscsViaBoardUtils: BoardUtils && typeof (BoardUtils as { countDiscs?: unknown }).countDiscs === 'function'
            ? (BoardUtils as { countDiscs: (board: unknown) => DiscCounts }).countDiscs
            : null
    });
    const denseForEachBoardShapeCell = BoardShapeIteration.forEachBoardShapeCell;
    const denseCountDiscsByPlayer = BoardShapeIteration.countDiscsByPlayer;
    const denseCountDiscs = BoardShapeIteration.countDiscs;

    if (!BoardCellAccessModule) throw new Error('BoardCellAccess is required by SharedBoardUtils');
    const BoardCellAccess = BoardCellAccessModule.createCellAccess({
        defaultRows: DEFAULT_BOARD_ROWS,
        defaultCols: DEFAULT_BOARD_COLS,
        empty: EMPTY,
        normalizeOwner,
        resolveBoardConfig
    });
    const denseResolveBoardBounds = BoardCellAccess.resolveBoardBounds;
    const denseIsStandardBoard8x8 = BoardCellAccess.isStandardBoard8x8;
    const denseHasPlayableCell = BoardCellAccess.hasPlayableCell;
    const denseCollectBoardCoordinates = BoardCellAccess.collectBoardCoordinates;
    const denseGetCellValue = BoardCellAccess.getCellValue;
    const denseSetCellValue = BoardCellAccess.setCellValue;
    const denseCountBoardEmpties = BoardCellAccess.countBoardEmpties;

    if (!BoardTopologyModule) throw new Error('BoardTopology is required by SharedBoardUtils');
    const BoardTopology = BoardTopologyModule.createBoardTopology({
        maxAbsCoordinate: MAX_ABS_BOARD_COORDINATE,
        toBoardCellKey,
        resolveBoardConfig,
        isMainBoardCell,
        collectExpansionDescriptors,
        collectMeteorHoleKeys
    });
    const buildBoardTopologyFromSource = BoardTopology.buildBoardTopology;

    if (!BoardStateKernelModule) throw new Error('BoardStateKernel is required by SharedBoardUtils');
    const BoardStateKernel = BoardStateKernelModule.createStateKernel({
        empty: EMPTY,
        black: BLACK,
        white: WHITE,
        directions: DIRECTIONS,
        maxAbsCoordinate: MAX_ABS_BOARD_COORDINATE,
        toBoardCellKey,
        normalizeOwner,
        resolveBoardConfig,
        isMainBoardCell,
        resolveExpansionSide,
        collectExpansionDescriptors,
        collectMeteorHoleKeys,
        buildBoardTopology: buildBoardTopologyFromSource
    });
    const inspectBoardState = BoardStateKernel.inspectBoardState;
    const createBoardView = BoardStateKernel.createBoardView;
    const createDenseBoardView = BoardStateKernel.createDenseBoardView;
    const canonicalizeStateBoard = BoardStateKernel.canonicalizeStateBoard;
    const getStateCellValue = BoardStateKernel.getStateCellValue;
    const setStateCellValue = BoardStateKernel.setStateCellValue;
    const addStateExpansionCells = BoardStateKernel.addStateExpansionCells;
    const countStateDiscs = BoardStateKernel.countStateDiscs;
    const createBoardMutationCheckpoint = BoardStateKernel.createBoardMutationCheckpoint;
    const restoreBoardMutationCheckpoint = BoardStateKernel.restoreBoardMutationCheckpoint;

    function getContextView(value: unknown): import('./board/state-kernel').BoardView | null {
        if (!isBoardContext(value)) return null;
        return createBoardView(value.gameState, {
            cardState: value.cardState,
            strict: false
        });
    }

    function resolveBoardBounds(boardOrRows: unknown, maybeCols?: unknown) {
        const view = getContextView(boardOrRows);
        return view ? { ...view.topology.contentBounds } : denseResolveBoardBounds(boardOrRows, maybeCols);
    }

    function isStandardBoard8x8(board: unknown): boolean {
        const view = getContextView(board);
        if (!view) return denseIsStandardBoard8x8(board);
        return view.topology.baseRows === DEFAULT_BOARD_ROWS
            && view.topology.baseCols === DEFAULT_BOARD_COLS
            && view.topology.baseKeys.size === DEFAULT_BOARD_ROWS * DEFAULT_BOARD_COLS
            && view.topology.expansionKeys.size === 0
            && view.topology.holeKeys.size === 0;
    }

    function hasPlayableCell(board: unknown, row: number, col: number): boolean {
        const view = getContextView(board);
        return view ? view.isPlayable(row, col) : denseHasPlayableCell(board, row, col);
    }

    function collectBoardCoordinates(board: unknown): CellCoord[] {
        const view = getContextView(board);
        return view
            ? view.coordinates.map((cell) => ({ row: cell.row, col: cell.col }))
            : denseCollectBoardCoordinates(board);
    }

    function getCellValue(board: unknown, row: number, col: number): number | null {
        const view = getContextView(board);
        return view ? view.get(row, col) : denseGetCellValue(board, row, col);
    }

    function setCellValue(board: unknown, row: number, col: number, value: number): boolean {
        if (isBoardContext(board)) {
            return setStateCellValue(board.gameState, row, col, value, board.cardState);
        }
        return denseSetCellValue(board, row, col, value);
    }

    function cloneBoard(board: unknown): unknown {
        if (isBoardContext(board)) return cloneBoardContext(board);
        if (!Array.isArray(board)) return [];
        return board.map((row) => Array.isArray(row) ? row.slice() : []);
    }

    function countBoardEmpties(board: unknown): number {
        const view = getContextView(board);
        return view ? view.count().empty : denseCountBoardEmpties(board);
    }

    function forEachBoardShapeCell(
        boardOrConfig: unknown,
        visitor: (row: number, col: number, value: unknown, side: string | null) => void
    ): void {
        const view = getContextView(boardOrConfig);
        if (!view) {
            denseForEachBoardShapeCell(boardOrConfig, visitor);
            return;
        }
        for (const cell of view.coordinates) {
            visitor(
                cell.row,
                cell.col,
                view.get(cell.row, cell.col),
                view.topology.expansionSideByKey.get(toBoardCellKey(cell.row, cell.col)) || null
            );
        }
    }

    function countDiscsByPlayer(boardOrConfig: unknown): DiscCounts {
        const view = getContextView(boardOrConfig);
        if (!view) return denseCountDiscsByPlayer(boardOrConfig);
        const counts = view.count();
        return { black: counts.black, white: counts.white };
    }

    function countDiscs(boardOrConfig: unknown): DiscCounts {
        const view = getContextView(boardOrConfig);
        return view
            ? { black: view.count().black, white: view.count().white }
            : denseCountDiscs(boardOrConfig);
    }

    function buildBoardTopology(boardOrState: unknown, options?: unknown) {
        if (isBoardContext(boardOrState)) return getContextView(boardOrState)!.topology;
        return buildBoardTopologyFromSource(boardOrState, options);
    }

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
        BOARD_CONTEXT_KIND,
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
        createBoardContext,
        cloneBoardContext,
        isBoardContext,
        cloneBoard,
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
        createBoardMutationCheckpoint,
        restoreBoardMutationCheckpoint,
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
