/**
 * Shared board utilities – geometry, bounds, cell queries, and canonicalisation.
 *
 * @fileoverview Pure helpers used by game logic, UI rendering, AI evaluation,
 *   and network serialisation.  All functions are side-effect free except
 *   `setBoardShapeMeta` / `attachBoardShape` which mutate the board array
 *   with a hidden metadata property.
 */

(function (root: any, factory) {
    if (typeof module === 'object' && module.exports) {
        module.exports = factory(require('../shared-constants'), require('./board-utils'), require('./othello-core'), require('./board/padded-coordinates'), require('./board/canonical-encoding'), require('./board/notation'), require('./board/dimensions'), require('./board/configuration'), require('./board/initial-layout'), require('./board/expansion-descriptors'), require('./board/legal-moves'), require('./board/control-counts'));
    } else if (root && root.SharedConstants) {
        root.SharedBoardUtils = factory(root.SharedConstants, root.BoardUtils || null, root.OthelloCore || null, root.PaddedBoardCoordinates || null, root.CanonicalBoardEncoding || null, root.BoardNotation || null, root.BoardDimensions || null, root.BoardConfiguration || null, root.InitialBoardLayout || null, root.BoardExpansionDescriptors || null, root.BoardLegalMoves || null, root.BoardControlCounts || null);
    } else {
        root.SharedBoardUtils = factory(root.SharedConstants, null, null, root.PaddedBoardCoordinates || null, root.CanonicalBoardEncoding || null, root.BoardNotation || null, root.BoardDimensions || null, root.BoardConfiguration || null, root.InitialBoardLayout || null, root.BoardExpansionDescriptors || null, root.BoardLegalMoves || null, root.BoardControlCounts || null);
    }
}(typeof globalThis !== 'undefined' ? globalThis : (typeof self !== 'undefined' ? self : this as unknown as Record<string, unknown>), function (SharedConstants: unknown, BoardUtilsModule: unknown, OthelloCoreModule: unknown, PaddedBoardCoordinatesModule: typeof import('./board/padded-coordinates') | null, CanonicalBoardEncodingModule: typeof import('./board/canonical-encoding') | null, BoardNotationModule: typeof import('./board/notation') | null, BoardDimensionsModule: typeof import('./board/dimensions') | null, BoardConfigurationModule: typeof import('./board/configuration') | null, InitialBoardLayoutModule: typeof import('./board/initial-layout') | null, BoardExpansionDescriptorsModule: typeof import('./board/expansion-descriptors') | null, BoardLegalMovesModule: typeof import('./board/legal-moves') | null, BoardControlCountsModule: typeof import('./board/control-counts') | null) {
    'use strict';

    interface BoardConfig {
        rows: number;
        cols: number;
        standard8x8: boolean;
        baseBounds: Bounds;
        outerBounds: Bounds;
    }

    interface Bounds {
        minRow: number;
        maxRow: number;
        minCol: number;
        maxCol: number;
    }

    interface CellCoord {
        row: number;
        col: number;
    }

    interface DiscCounts {
        black: number;
        white: number;
    }

    interface BoardShapeMeta {
        minRow: number;
        maxRow: number;
        minCol: number;
        maxCol: number;
        playableKeys: Set<string>;
        meteorHoleKeys: Set<string>;
        expansionCells: Array<{ side: string; row: number; col: number; owner: number }>;
        expansionOwnerByKey: Record<string, number>;
        standard8x8: boolean;
        coordinateCache: CellCoord[] | null;
        cornerKeyCache: Set<string> | null;
        xKeyCache: Set<string> | null;
        cKeyCache: Set<string> | null;
    }

    interface CornerEdgeLineDescriptor {
        key: string;
        canonicalKey: string;
        corner: CellCoord;
        direction: CellCoord;
        directionTarget: CellCoord;
        cells: CellCoord[];
    }

    interface EdgeRunSummary {
        totalLines: number;
        maxLineLength: number;
        totalLineCells: number;
        totalOwnedCells: number;
        chainStrength: number;
        longestRun: number;
        longestRunShare: number;
        completeLineCount: number;
        segmentCount: number;
        loneDiscCount: number;
    }

    interface CanonicalResult {
        boardKey: string;
        transformId: number;
        size: number;
        minRow: number;
        minCol: number;
    }

    const BoardUtils = BoardUtilsModule || null;
    const OthelloCore = OthelloCoreModule || null;
    if (!PaddedBoardCoordinatesModule) throw new Error('PaddedBoardCoordinates is required by SharedBoardUtils');
    const PaddedBoardCoordinates = PaddedBoardCoordinatesModule;
    if (!CanonicalBoardEncodingModule) throw new Error('CanonicalBoardEncoding is required by SharedBoardUtils');
    const CanonicalBoardEncoding = CanonicalBoardEncodingModule.createCanonicalBoardEncoding({ resolveBoardBounds, collectBoardCoordinates, getCellValue });
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
        clampBoardDimension
    });
    const buildBoardConfig = BoardConfiguration.buildBoardConfig;
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

    function isRawCellInBounds(board: unknown, row: number, col: number): boolean {
        return (
            Array.isArray(board) &&
            Number.isInteger(row) &&
            Number.isInteger(col) &&
            row >= 0 &&
            row < (board as unknown[][]).length &&
            Array.isArray((board as unknown[][])[row]) &&
            col >= 0 &&
            col < (board as unknown[][])[row].length
        );
    }

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
        isMainBoardCell,
        normalizeOwner
    });
    const isExpansionCoordinate = BoardExpansionDescriptors.isExpansionCoordinate;
    const resolveExpansionSide = BoardExpansionDescriptors.resolveExpansionSide;
    const collectExpansionDescriptors = BoardExpansionDescriptors.collectExpansionDescriptors;

    function resolveBoardShapeSource(boardOrConfig: unknown): { board: unknown[][] | null; boardExpansion: Record<string, unknown> | null } {
        if (Array.isArray(boardOrConfig)) {
            return {
                board: boardOrConfig as unknown[][],
                boardExpansion: null
            };
        }
        if (!boardOrConfig || typeof boardOrConfig !== 'object') {
            return {
                board: null,
                boardExpansion: null
            };
        }
        const obj = boardOrConfig as Record<string, unknown>;
        return {
            board: Array.isArray(obj.board) ? obj.board as unknown[][] : null,
            boardExpansion: (obj.boardExpansion && typeof obj.boardExpansion === 'object')
                ? obj.boardExpansion as Record<string, unknown>
                : null
        };
    }

    function getAttachedExpansionDescriptors(board: unknown): Array<{ side: string; row: number; col: number; owner: number }> {
        const meta = getBoardShapeMeta(board);
        if (!meta || !Array.isArray(meta.expansionCells)) return [];
        return meta.expansionCells.map((cell) => ({
            side: cell.side,
            row: cell.row,
            col: cell.col,
            owner: normalizeOwner(cell.owner)
        }));
    }

    function forEachBoardShapeCell(boardOrConfig: unknown, visitor: (row: number, col: number, value: unknown, side: string | null) => void): void {
        if (typeof visitor !== 'function') return;
        const source = resolveBoardShapeSource(boardOrConfig);
        const board = source.board;
        const config = resolveBoardConfig(boardOrConfig);
        for (let row = 0; row < config.rows; row += 1) {
            const boardRow = Array.isArray(board) && Array.isArray(board[row]) ? board[row] : [];
            for (let col = 0; col < config.cols; col += 1) {
                visitor(row, col, boardRow[col], null);
            }
        }

        const expansionDescriptors = source.boardExpansion
            ? collectExpansionDescriptors(source.boardExpansion, boardOrConfig)
            : getAttachedExpansionDescriptors(board);
        for (const cell of expansionDescriptors) {
            if (!cell) continue;
            visitor(cell.row, cell.col, Number(cell.owner), cell.side || null);
        }
    }

    function countDiscsByPlayer(boardOrConfig: unknown): DiscCounts {
        const counts: DiscCounts = { black: 0, white: 0 };
        forEachBoardShapeCell(boardOrConfig, function countOwnedCell(_row: number, _col: number, value: unknown) {
            if (Number(value) === BLACK) counts.black += 1;
            else if (Number(value) === WHITE) counts.white += 1;
        });
        return counts;
    }

    function countDiscs(boardOrConfig: unknown): DiscCounts {
        if (BoardUtils && typeof (BoardUtils as { countDiscs?: (b: unknown) => DiscCounts }).countDiscs === 'function') {
            return (BoardUtils as { countDiscs: (b: unknown) => DiscCounts }).countDiscs(boardOrConfig);
        }
        const board = Array.isArray(boardOrConfig) ? boardOrConfig as unknown[][] : (boardOrConfig && typeof boardOrConfig === 'object' && Array.isArray((boardOrConfig as Record<string, unknown>).board) ? (boardOrConfig as Record<string, unknown>).board as unknown[][] : null);
        if (!Array.isArray(board)) return { black: 0, white: 0 };
        let black = 0;
        let white = 0;
        for (let row = 0; row < board.length; row++) {
            const line = Array.isArray(board[row]) ? board[row] : [];
            for (let col = 0; col < line.length; col++) {
                const value = Number(line[col]);
                if (value === BLACK) black += 1;
                else if (value === WHITE) white += 1;
            }
        }
        return { black, white };
    }

    function collectMeteorHoleKeys(cardState: unknown): Set<string> {
        const out = new Set<string>();
        const obj = cardState as { markers?: unknown[] } | null;
        const markers = obj && Array.isArray(obj.markers) ? obj.markers : [];
        for (const marker of markers) {
            const m = marker as { kind?: string; data?: { type?: string }; row?: number; col?: number } | null;
            if (!m || m.kind !== 'specialStone') continue;
            if (!m.data || String(m.data.type || '').toUpperCase() !== 'METEOR_HOLE') continue;
            const row = Number(m.row);
            const col = Number(m.col);
            if (!Number.isInteger(row) || !Number.isInteger(col)) continue;
            out.add(toBoardCellKey(row, col));
        }
        return out;
    }

    function cloneMeta(meta: unknown): BoardShapeMeta | null {
        if (!meta || typeof meta !== 'object') return null;
        const obj = meta as BoardShapeMeta;
        return {
            minRow: Number.isInteger(obj.minRow) ? obj.minRow : 0,
            maxRow: Number.isInteger(obj.maxRow) ? obj.maxRow : -1,
            minCol: Number.isInteger(obj.minCol) ? obj.minCol : 0,
            maxCol: Number.isInteger(obj.maxCol) ? obj.maxCol : -1,
            playableKeys: new Set(obj.playableKeys instanceof Set ? Array.from(obj.playableKeys) : []),
            meteorHoleKeys: new Set(obj.meteorHoleKeys instanceof Set ? Array.from(obj.meteorHoleKeys) : []),
            expansionCells: Array.isArray(obj.expansionCells)
                ? obj.expansionCells.map((cell) => ({
                    side: cell.side,
                    row: cell.row,
                    col: cell.col,
                    owner: normalizeOwner(cell.owner)
                }))
                : [],
            expansionOwnerByKey: Object.assign(Object.create(null), obj.expansionOwnerByKey || null),
            standard8x8: obj.standard8x8 === true,
            coordinateCache: null,
            cornerKeyCache: null,
            xKeyCache: null,
            cKeyCache: null
        };
    }

    function setBoardShapeMeta(board: unknown, meta: unknown): unknown[][] {
        if (!Array.isArray(board)) return board as unknown[][];
        Object.defineProperty(board, BOARD_SHAPE_META_KEY, {
            value: meta,
            writable: true,
            configurable: true
        });
        return board as unknown[][];
    }

    function getBoardShapeMeta(board: unknown): BoardShapeMeta | null {
        if (!Array.isArray(board)) return null;
        const meta = (board as unknown as Record<string, unknown>)[BOARD_SHAPE_META_KEY];
        return meta && typeof meta === 'object' ? meta as BoardShapeMeta : null;
    }

    function buildShapeMeta(board: unknown, options?: unknown): BoardShapeMeta | null {
        if (!Array.isArray(board)) return null;
        const opts = options && typeof options === 'object' ? options as Record<string, unknown> : {};
        const boardConfig = resolveBoardConfig((opts.boardConfig) || board);
        const expansionCells = collectExpansionDescriptors(opts.boardExpansion, boardConfig);
        const meteorHoleKeys = collectMeteorHoleKeys(opts.cardState);
        const playableKeys = new Set<string>();
        let minRow = Infinity;
        let maxRow = -Infinity;
        let minCol = Infinity;
        let maxCol = -Infinity;

        const addCoord = (row: number, col: number): void => {
            const key = toBoardCellKey(row, col);
            if (meteorHoleKeys.has(key)) return;
            playableKeys.add(key);
            if (row < minRow) minRow = row;
            if (row > maxRow) maxRow = row;
            if (col < minCol) minCol = col;
            if (col > maxCol) maxCol = col;
        };

        for (let row = 0; row < (board as unknown[][]).length; row++) {
            const line = Array.isArray((board as unknown[][])[row]) ? (board as unknown[][])[row] : [];
            for (let col = 0; col < line.length; col++) {
                addCoord(row, col);
            }
        }
        for (const cell of expansionCells) addCoord(cell.row, cell.col);

        if (!Number.isFinite(minRow) || !Number.isFinite(maxRow) || !Number.isFinite(minCol) || !Number.isFinite(maxCol)) {
            minRow = 0;
            maxRow = -1;
            minCol = 0;
            maxCol = -1;
        }

        const expansionOwnerByKey: Record<string, number> = Object.create(null);
        for (const cell of expansionCells) {
            expansionOwnerByKey[toBoardCellKey(cell.row, cell.col)] = normalizeOwner(cell.owner);
        }

        const standard8x8 =
            (board as unknown[][]).length === DEFAULT_BOARD_ROWS &&
            (board as unknown[][]).every((row) => Array.isArray(row) && row.length === DEFAULT_BOARD_COLS) &&
            expansionCells.length === 0 &&
            meteorHoleKeys.size === 0;

        return {
            minRow,
            maxRow,
            minCol,
            maxCol,
            playableKeys,
            meteorHoleKeys,
            expansionCells,
            expansionOwnerByKey,
            standard8x8,
            coordinateCache: null,
            cornerKeyCache: null,
            xKeyCache: null,
            cKeyCache: null
        };
    }

    function attachBoardShape(board: unknown, options?: unknown): unknown[][] {
        if (!Array.isArray(board)) return board as unknown[][];
        if (!options && getBoardShapeMeta(board)) return board as unknown[][];
        return setBoardShapeMeta(board, buildShapeMeta(board, options || null));
    }

    function copyBoardShape(fromBoard: unknown, toBoard: unknown): unknown[][] {
        if (!Array.isArray(toBoard)) return toBoard as unknown[][];
        const meta = getBoardShapeMeta(fromBoard);
        if (!meta) return toBoard as unknown[][];
        return setBoardShapeMeta(toBoard, cloneMeta(meta));
    }

    function cloneBoard(board: unknown): unknown[][] {
        if (!Array.isArray(board)) return [];
        const cloned = (board as unknown[][]).map((row) => Array.isArray(row) ? row.slice() : []);
        return copyBoardShape(board, cloned);
    }

    function resolveBoardBounds(boardOrRows: unknown, maybeCols?: unknown): Bounds | null {
        if (Array.isArray(boardOrRows)) {
            const meta = getBoardShapeMeta(boardOrRows);
            if (meta) {
                return {
                    minRow: meta.minRow,
                    maxRow: meta.maxRow,
                    minCol: meta.minCol,
                    maxCol: meta.maxCol
                };
            }
            if (boardOrRows.length <= 0) return null;
            let maxCol = -1;
            for (const row of boardOrRows as unknown[][]) {
                if (Array.isArray(row) && row.length > 0) {
                    maxCol = Math.max(maxCol, row.length - 1);
                }
            }
            if (maxCol < 0) return null;
            return { minRow: 0, maxRow: boardOrRows.length - 1, minCol: 0, maxCol };
        }
        const config = resolveBoardConfig(boardOrRows, maybeCols);
        return {
            minRow: 0,
            maxRow: config.rows - 1,
            minCol: 0,
            maxCol: config.cols - 1
        };
    }

    function isStandardBoard8x8(board: unknown): boolean {
        const meta = getBoardShapeMeta(board);
        if (meta) return meta.standard8x8 === true;
        if (!Array.isArray(board) || board.length !== DEFAULT_BOARD_ROWS) return false;
        for (const row of board as unknown[][]) {
            if (!Array.isArray(row) || row.length !== DEFAULT_BOARD_COLS) return false;
        }
        return true;
    }

    function hasPlayableCell(board: unknown, row: number, col: number): boolean {
        if (!Array.isArray(board) || !Number.isInteger(row) || !Number.isInteger(col)) return false;
        const meta = getBoardShapeMeta(board);
        if (!meta) return isRawCellInBounds(board, row, col);
        return meta.playableKeys.has(toBoardCellKey(row, col));
    }

    function collectBoardCoordinates(board: unknown): CellCoord[] {
        if (!Array.isArray(board)) return [];
        const meta = getBoardShapeMeta(board);
        if (!meta) {
            const coords: CellCoord[] = [];
            for (let row = 0; row < (board as unknown[][]).length; row++) {
                const line = Array.isArray((board as unknown[][])[row]) ? (board as unknown[][])[row] : [];
                for (let col = 0; col < line.length; col++) {
                    coords.push({ row, col });
                }
            }
            return coords;
        }
        if (Array.isArray(meta.coordinateCache)) {
            return meta.coordinateCache.map((cell) => ({ row: cell.row, col: cell.col }));
        }
        const coords = Array.from(meta.playableKeys)
            .map((key) => {
                const parts = key.split(',');
                return { row: Number(parts[0]), col: Number(parts[1]) };
            })
            .filter((cell) => Number.isInteger(cell.row) && Number.isInteger(cell.col))
            .sort((a, b) => (a.row - b.row) || (a.col - b.col));
        meta.coordinateCache = coords.map((cell) => ({ row: cell.row, col: cell.col }));
        return coords;
    }

    function getCellValue(board: unknown, row: number, col: number): number | null {
        if (!Array.isArray(board) || !Number.isInteger(row) || !Number.isInteger(col)) return null;
        const meta = getBoardShapeMeta(board);
        if (meta && !meta.playableKeys.has(toBoardCellKey(row, col))) return null;
        if (isRawCellInBounds(board, row, col)) return (board as unknown[][])[row][col] as number;
        if (!meta) return null;
        const key = toBoardCellKey(row, col);
        if (!Object.prototype.hasOwnProperty.call(meta.expansionOwnerByKey, key)) return null;
        return normalizeOwner(meta.expansionOwnerByKey[key]);
    }

    function setCellValue(board: unknown, row: number, col: number, value: number): boolean {
        if (!Array.isArray(board) || !Number.isInteger(row) || !Number.isInteger(col)) return false;
        if (isRawCellInBounds(board, row, col)) {
            const meta = getBoardShapeMeta(board);
            if (meta && !meta.playableKeys.has(toBoardCellKey(row, col))) return false;
            (board as unknown[][])[row][col] = normalizeOwner(value);
            return true;
        }
        const meta = getBoardShapeMeta(board);
        if (!meta || !meta.playableKeys.has(toBoardCellKey(row, col))) return false;
        const owner = normalizeOwner(value);
        const key = toBoardCellKey(row, col);
        meta.expansionOwnerByKey[key] = owner;
        for (const cell of meta.expansionCells) {
            if (cell.row === row && cell.col === col) {
                cell.owner = owner;
                break;
            }
        }
        return true;
    }

    function countBoardEmpties(board: unknown): number {
        if (!Array.isArray(board)) return 0;
        let empties = 0;
        for (const cell of collectBoardCoordinates(board)) {
            if (getCellValue(board, cell.row, cell.col) === EMPTY) empties += 1;
        }
        return empties;
    }

    function buildCornerKeySet(board: unknown): Set<string> {
        const meta = getBoardShapeMeta(board);
        if (meta && meta.cornerKeyCache instanceof Set) return meta.cornerKeyCache;
        const coords = collectBoardCoordinates(board);
        const coordKeys = new Set(coords.map((cell) => toBoardCellKey(cell.row, cell.col)));
        const quadrants = [
            { vertical: -1, horizontal: -1 },
            { vertical: -1, horizontal: 1 },
            { vertical: 1, horizontal: -1 },
            { vertical: 1, horizontal: 1 }
        ];
        const corners = new Set<string>();
        for (const cell of coords) {
            for (const quadrant of quadrants) {
                const verticalKey = toBoardCellKey(cell.row + quadrant.vertical, cell.col);
                const horizontalKey = toBoardCellKey(cell.row, cell.col + quadrant.horizontal);
                if (!coordKeys.has(verticalKey) && !coordKeys.has(horizontalKey)) {
                    corners.add(toBoardCellKey(cell.row, cell.col));
                }
            }
        }
        if (meta) meta.cornerKeyCache = corners;
        return corners;
    }

    function getCornerCells(board: unknown): CellCoord[] {
        return collectBoardCoordinates(board).filter((cell) => buildCornerKeySet(board).has(toBoardCellKey(cell.row, cell.col)));
    }

    function getPerimeterCells(board: unknown): CellCoord[] {
        return collectBoardCoordinates(board).filter((cell) => isEdgeCell(cell.row, cell.col, board));
    }

    function getEffectiveCornerCells(board: unknown): CellCoord[] {
        return getCornerCells(board);
    }

    function getEffectiveEdgeCells(board: unknown): CellCoord[] {
        return getPerimeterCells(board);
    }

    function getCornerEdgeLineDescriptors(board: unknown): CornerEdgeLineDescriptor[] {
        if (!Array.isArray(board)) return [];
        const corners = getCornerCells(board);
        const lines: CornerEdgeLineDescriptor[] = [];
        const directions = [
            { row: -1, col: 0 },
            { row: 1, col: 0 },
            { row: 0, col: -1 },
            { row: 0, col: 1 }
        ];

        for (const corner of corners) {
            if (!corner || !Number.isInteger(corner.row) || !Number.isInteger(corner.col)) continue;
            for (const direction of directions) {
                const nextRow = corner.row + direction.row;
                const nextCol = corner.col + direction.col;
                if (!hasPlayableCell(board, nextRow, nextCol)) continue;
                if (!isEdgeCell(nextRow, nextCol, board)) continue;

                const cells: CellCoord[] = [{ row: corner.row, col: corner.col }];
                let currentRow = nextRow;
                let currentCol = nextCol;
                while (hasPlayableCell(board, currentRow, currentCol) && isEdgeCell(currentRow, currentCol, board)) {
                    cells.push({ row: currentRow, col: currentCol });
                    if (isCornerCell(currentRow, currentCol, board) && (currentRow !== corner.row || currentCol !== corner.col)) {
                        break;
                    }
                    currentRow += direction.row;
                    currentCol += direction.col;
                }

                if (cells.length <= 1) continue;
                const cellKeys = cells.map((cell) => toBoardCellKey(cell.row, cell.col));
                lines.push({
                    key: cellKeys.join('|'),
                    canonicalKey: cellKeys.slice().sort().join('|'),
                    corner: { row: corner.row, col: corner.col },
                    direction: { row: direction.row, col: direction.col },
                    directionTarget: { row: nextRow, col: nextCol },
                    cells
                });
            }
        }

        return lines;
    }

    function collectUniqueCornerEdgeLines(board: unknown): CornerEdgeLineDescriptor[] {
        if (!Array.isArray(board)) return [];
        const seen = new Set<string>();
        const lines: CornerEdgeLineDescriptor[] = [];
        for (const descriptor of getCornerEdgeLineDescriptors(board)) {
            if (!descriptor || !Array.isArray(descriptor.cells) || descriptor.cells.length <= 1) continue;
            const canonicalKey = typeof descriptor.canonicalKey === 'string' && descriptor.canonicalKey
                ? descriptor.canonicalKey
                : descriptor.cells.map((cell) => toBoardCellKey(cell.row, cell.col)).slice().sort().join('|');
            if (seen.has(canonicalKey)) continue;
            seen.add(canonicalKey);
            lines.push(descriptor);
        }
        return lines;
    }

    function summarizeEdgeRuns(board: unknown, playerValue: number): EdgeRunSummary {
        const out: EdgeRunSummary = {
            totalLines: 0,
            maxLineLength: 0,
            totalLineCells: 0,
            totalOwnedCells: 0,
            chainStrength: 0,
            longestRun: 0,
            longestRunShare: 0,
            completeLineCount: 0,
            segmentCount: 0,
            loneDiscCount: 0
        };
        if (!Array.isArray(board)) return out;
        const owner = normalizeOwner(playerValue);
        if (!owner) return out;
        const lines = collectUniqueCornerEdgeLines(board);
        out.totalLines = lines.length;

        for (const line of lines) {
            if (!line || !Array.isArray(line.cells) || line.cells.length <= 0) continue;
            const cells = line.cells;
            const lineLength = cells.length;
            out.maxLineLength = Math.max(out.maxLineLength, lineLength);
            out.totalLineCells += lineLength;

            let lineOwnedCells = 0;
            let currentRunLength = 0;
            let runStartIndex = -1;

            const finalizeRun = (): void => {
                if (currentRunLength <= 0) return;
                out.chainStrength += (currentRunLength * currentRunLength);
                out.segmentCount += 1;
                out.longestRun = Math.max(out.longestRun, currentRunLength);
                if (currentRunLength === lineLength) out.completeLineCount += 1;
                if (currentRunLength === 1) {
                    const loneCell = cells[runStartIndex];
                    if (loneCell && !isCornerCell(loneCell.row, loneCell.col, board)) {
                        out.loneDiscCount += 1;
                    }
                }
                currentRunLength = 0;
                runStartIndex = -1;
            };

            for (let i = 0; i < cells.length; i++) {
                const cell = cells[i];
                const value = getCellValue(board, cell.row, cell.col);
                if (value === owner) {
                    lineOwnedCells += 1;
                    if (currentRunLength <= 0) runStartIndex = i;
                    currentRunLength += 1;
                    continue;
                }
                finalizeRun();
            }
            finalizeRun();
            out.totalOwnedCells += lineOwnedCells;
        }

        out.longestRunShare = out.maxLineLength > 0
            ? Math.max(0, Math.min(1, out.longestRun / out.maxLineLength))
            : 0;
        return out;
    }

    function countAdjacentLoneEdgeDiscs(board: unknown, row: number, col: number, playerValue: number): number {
        if (!Array.isArray(board) || !Number.isInteger(row) || !Number.isInteger(col)) return 0;
        if (!isEdgeCell(row, col, board) || isCornerCell(row, col, board)) return 0;
        const owner = normalizeOwner(playerValue);
        if (!owner) return 0;

        const seen = new Set<string>();
        let count = 0;
        const lines = collectUniqueCornerEdgeLines(board);
        for (const line of lines) {
            if (!line || !Array.isArray(line.cells) || line.cells.length <= 0) continue;
            const targetIndex = line.cells.findIndex((cell) => cell && cell.row === row && cell.col === col);
            if (targetIndex < 0) continue;
            for (const adjacentIndex of [targetIndex - 1, targetIndex + 1]) {
                if (adjacentIndex < 0 || adjacentIndex >= line.cells.length) continue;
                const adjacentCell = line.cells[adjacentIndex];
                if (!adjacentCell || isCornerCell(adjacentCell.row, adjacentCell.col, board)) continue;
                if (getCellValue(board, adjacentCell.row, adjacentCell.col) !== owner) continue;
                const adjacentKey = toBoardCellKey(adjacentCell.row, adjacentCell.col);
                if (seen.has(adjacentKey)) continue;

                let hasSameNeighbor = false;
                for (const neighborIndex of [adjacentIndex - 1, adjacentIndex + 1]) {
                    if (neighborIndex < 0 || neighborIndex >= line.cells.length) continue;
                    const neighborCell = line.cells[neighborIndex];
                    if (!neighborCell) continue;
                    if (getCellValue(board, neighborCell.row, neighborCell.col) === owner) {
                        hasSameNeighbor = true;
                        break;
                    }
                }
                if (hasSameNeighbor) continue;
                seen.add(adjacentKey);
                count += 1;
            }
        }
        return count;
    }

    function isCornerCell(row: number, col: number, boardOrRows: unknown, maybeCols?: unknown): boolean {
        if (!Number.isInteger(row) || !Number.isInteger(col)) return false;
        if (Array.isArray(boardOrRows)) {
            if (!hasPlayableCell(boardOrRows, row, col)) return false;
            const meta = getBoardShapeMeta(boardOrRows);
            if (!meta) {
                const bounds = resolveBoardBounds(boardOrRows);
                if (!bounds) return false;
                return (
                    (row === bounds.minRow || row === bounds.maxRow) &&
                    (col === bounds.minCol || col === bounds.maxCol)
                );
            }
            return buildCornerKeySet(boardOrRows).has(toBoardCellKey(row, col));
        }
        const bounds = resolveBoardBounds(boardOrRows, maybeCols);
        if (!bounds) return false;
        return (
            (row === bounds.minRow || row === bounds.maxRow) &&
            (col === bounds.minCol || col === bounds.maxCol)
        );
    }

    function isEdgeCell(row: number, col: number, boardOrRows: unknown, maybeCols?: unknown): boolean {
        if (!Number.isInteger(row) || !Number.isInteger(col)) return false;
        if (Array.isArray(boardOrRows)) {
            if (!hasPlayableCell(boardOrRows, row, col)) return false;
            const meta = getBoardShapeMeta(boardOrRows);
            if (!meta) {
                const bounds = resolveBoardBounds(boardOrRows);
                if (!bounds) return false;
                return (
                    row === bounds.minRow ||
                    row === bounds.maxRow ||
                    col === bounds.minCol ||
                    col === bounds.maxCol
                );
            }
            const orthogonal = [
                [row - 1, col],
                [row + 1, col],
                [row, col - 1],
                [row, col + 1]
            ];
            return orthogonal.some((pos) => !hasPlayableCell(boardOrRows, pos[0], pos[1]));
        }
        const bounds = resolveBoardBounds(boardOrRows, maybeCols);
        if (!bounds) return false;
        return (
            row === bounds.minRow ||
            row === bounds.maxRow ||
            col === bounds.minCol ||
            col === bounds.maxCol
        );
    }

    function isEffectiveCornerCell(row: number, col: number, boardOrRows: unknown, maybeCols?: unknown): boolean {
        return isCornerCell(row, col, boardOrRows, maybeCols);
    }

    function isEffectiveEdgeCell(row: number, col: number, boardOrRows: unknown, maybeCols?: unknown): boolean {
        return isEdgeCell(row, col, boardOrRows, maybeCols);
    }

    function buildRiskCellSets(board: unknown): { xKeys: Set<string>; cKeys: Set<string> } {
        const meta = getBoardShapeMeta(board);
        if (meta && meta.xKeyCache instanceof Set && meta.cKeyCache instanceof Set) {
            return { xKeys: meta.xKeyCache, cKeys: meta.cKeyCache };
        }
        const coords = collectBoardCoordinates(board);
        const coordKeys = new Set(coords.map((cell) => toBoardCellKey(cell.row, cell.col)));
        const quadrants = [
            { vertical: -1, horizontal: -1 },
            { vertical: -1, horizontal: 1 },
            { vertical: 1, horizontal: -1 },
            { vertical: 1, horizontal: 1 }
        ];
        const xKeys = new Set<string>();
        const cKeys = new Set<string>();

        for (const cell of coords) {
            for (const quadrant of quadrants) {
                const verticalKey = toBoardCellKey(cell.row + quadrant.vertical, cell.col);
                const horizontalKey = toBoardCellKey(cell.row, cell.col + quadrant.horizontal);
                if (coordKeys.has(verticalKey) || coordKeys.has(horizontalKey)) continue;

                const inwardRow = cell.row - quadrant.vertical;
                const inwardCol = cell.col - quadrant.horizontal;
                const xKey = toBoardCellKey(inwardRow, inwardCol);
                const c1Key = toBoardCellKey(inwardRow, cell.col);
                const c2Key = toBoardCellKey(cell.row, inwardCol);

                if (coordKeys.has(xKey)) xKeys.add(xKey);
                if (coordKeys.has(c1Key)) cKeys.add(c1Key);
                if (coordKeys.has(c2Key)) cKeys.add(c2Key);
            }
        }

        if (meta) {
            meta.xKeyCache = xKeys;
            meta.cKeyCache = cKeys;
        }
        return { xKeys, cKeys };
    }

    function getCornerProximity(row: number, col: number, boardOrRows: unknown, maybeCols?: unknown): { kind: string; corner: [number, number] } | null {
        if (!Number.isInteger(row) || !Number.isInteger(col)) return null;
        if (Array.isArray(boardOrRows)) {
            if (!hasPlayableCell(boardOrRows, row, col)) return null;
            const isX = isXSquare(row, col, boardOrRows);
            const isC = !isX && isCSquare(row, col, boardOrRows);
            if (!isX && !isC) return null;
            const corners = getCornerCells(boardOrRows);
            for (const corner of corners) {
                if (!corner || !Number.isInteger(corner.row) || !Number.isInteger(corner.col)) continue;
                for (const vertical of [-1, 1]) {
                    for (const horizontal of [-1, 1]) {
                        if (
                            hasPlayableCell(boardOrRows, corner.row + vertical, corner.col) ||
                            hasPlayableCell(boardOrRows, corner.row, corner.col + horizontal)
                        ) {
                            continue;
                        }
                        const inwardRow = corner.row - vertical;
                        const inwardCol = corner.col - horizontal;
                        if (isX && inwardRow === row && inwardCol === col) {
                            return { kind: 'X', corner: [corner.row, corner.col] };
                        }
                        if (isC && (
                            (inwardRow === row && corner.col === col) ||
                            (corner.row === row && inwardCol === col)
                        )) {
                            return { kind: 'C', corner: [corner.row, corner.col] };
                        }
                    }
                }
            }
            return null;
        }

        const bounds = resolveBoardBounds(boardOrRows, maybeCols);
        if (!bounds) return null;
        const rowNearTop = row === (bounds.minRow + 1);
        const rowNearBottom = row === (bounds.maxRow - 1);
        const colNearLeft = col === (bounds.minCol + 1);
        const colNearRight = col === (bounds.maxCol - 1);

        if ((rowNearTop || rowNearBottom) && (colNearLeft || colNearRight)) {
            return {
                kind: 'X',
                corner: [
                    rowNearTop ? bounds.minRow : bounds.maxRow,
                    colNearLeft ? bounds.minCol : bounds.maxCol
                ]
            };
        }

        if ((row === bounds.minRow || row === bounds.maxRow) && (colNearLeft || colNearRight)) {
            return {
                kind: 'C',
                corner: [
                    row,
                    colNearLeft ? bounds.minCol : bounds.maxCol
                ]
            };
        }

        if ((col === bounds.minCol || col === bounds.maxCol) && (rowNearTop || rowNearBottom)) {
            return {
                kind: 'C',
                corner: [
                    rowNearTop ? bounds.minRow : bounds.maxRow,
                    col
                ]
            };
        }

        return null;
    }

    function isCorner(row: number, col: number, boardOrRows: unknown, maybeCols?: unknown): boolean {
        return isCornerCell(row, col, boardOrRows, maybeCols);
    }

    function isEdge(row: number, col: number, boardOrRows: unknown, maybeCols?: unknown): boolean {
        return isEdgeCell(row, col, boardOrRows, maybeCols);
    }

    function isXSquare(row: number, col: number, boardOrRows: unknown, maybeCols?: unknown): boolean {
        if (!Number.isInteger(row) || !Number.isInteger(col)) return false;
        if (Array.isArray(boardOrRows)) {
            if (!hasPlayableCell(boardOrRows, row, col)) return false;
            return buildRiskCellSets(boardOrRows).xKeys.has(toBoardCellKey(row, col));
        }
        const bounds = resolveBoardBounds(boardOrRows, maybeCols);
        if (!bounds) return false;
        return (
            (row === (bounds.minRow + 1) || row === (bounds.maxRow - 1)) &&
            (col === (bounds.minCol + 1) || col === (bounds.maxCol - 1))
        );
    }

    function isCSquare(row: number, col: number, boardOrRows: unknown, maybeCols?: unknown): boolean {
        if (!Number.isInteger(row) || !Number.isInteger(col)) return false;
        if (Array.isArray(boardOrRows)) {
            if (!hasPlayableCell(boardOrRows, row, col)) return false;
            return buildRiskCellSets(boardOrRows).cKeys.has(toBoardCellKey(row, col));
        }
        const bounds = resolveBoardBounds(boardOrRows, maybeCols);
        if (!bounds) return false;
        const nearTopBottom = (row === bounds.minRow || row === bounds.maxRow) &&
            (col === (bounds.minCol + 1) || col === (bounds.maxCol - 1));
        const nearLeftRight = (col === bounds.minCol || col === bounds.maxCol) &&
            (row === (bounds.minRow + 1) || row === (bounds.maxRow - 1));
        return nearTopBottom || nearLeftRight;
    }

    function getCellType(row: number, col: number, boardOrRows: unknown, maybeCols?: unknown): 'unknown' | 'corner' | 'x' | 'c' | 'edge' | 'inner' {
        if (!Number.isInteger(row) || !Number.isInteger(col)) return 'unknown';
        if (isCorner(row, col, boardOrRows, maybeCols)) return 'corner';
        if (isXSquare(row, col, boardOrRows, maybeCols)) return 'x';
        if (isCSquare(row, col, boardOrRows, maybeCols)) return 'c';
        if (isEdge(row, col, boardOrRows, maybeCols)) return 'edge';
        return 'inner';
    }

    if (!BoardLegalMovesModule) throw new Error('BoardLegalMoves is required by SharedBoardUtils');
    const BoardLegalMoves = BoardLegalMovesModule.createLegalMoves({
        empty: EMPTY,
        directions: DIRECTIONS,
        othelloCore: OthelloCore,
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
        DEFAULT_BOARD_ROWS,
        DEFAULT_BOARD_COLS,
        MIN_BOARD_ROWS,
        MAX_BOARD_ROWS,
        MIN_BOARD_COLS,
        MAX_BOARD_COLS,
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
