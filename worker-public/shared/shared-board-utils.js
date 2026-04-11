(function (root, factory) {
    if (typeof module === 'object' && module.exports) {
        module.exports = factory(require('../shared-constants'));
    } else {
        root.SharedBoardUtils = factory(root.SharedConstants);
    }
}(typeof globalThis !== 'undefined' ? globalThis : (typeof self !== 'undefined' ? self : this), function (SharedConstants) {
    'use strict';

    const BOARD_SHAPE_META_KEY = '__sharedBoardShapeMeta';
    const EMPTY = Number.isFinite(Number(SharedConstants && SharedConstants.EMPTY))
        ? Number(SharedConstants.EMPTY)
        : 0;
    const BLACK = Number.isFinite(Number(SharedConstants && SharedConstants.BLACK))
        ? Number(SharedConstants.BLACK)
        : 1;
    const WHITE = Number.isFinite(Number(SharedConstants && SharedConstants.WHITE))
        ? Number(SharedConstants.WHITE)
        : -1;
    const DEFAULT_BOARD_ROWS = Number.isFinite(Number(SharedConstants && SharedConstants.DEFAULT_BOARD_ROWS))
        ? Math.max(1, Math.floor(Number(SharedConstants.DEFAULT_BOARD_ROWS)))
        : 8;
    const DEFAULT_BOARD_COLS = Number.isFinite(Number(SharedConstants && SharedConstants.DEFAULT_BOARD_COLS))
        ? Math.max(1, Math.floor(Number(SharedConstants.DEFAULT_BOARD_COLS)))
        : 8;
    const MIN_BOARD_ROWS = Number.isFinite(Number(SharedConstants && SharedConstants.MIN_BOARD_ROWS))
        ? Math.max(1, Math.floor(Number(SharedConstants.MIN_BOARD_ROWS)))
        : 4;
    const MAX_BOARD_ROWS = Number.isFinite(Number(SharedConstants && SharedConstants.MAX_BOARD_ROWS))
        ? Math.max(MIN_BOARD_ROWS, Math.floor(Number(SharedConstants.MAX_BOARD_ROWS)))
        : DEFAULT_BOARD_ROWS;
    const MIN_BOARD_COLS = Number.isFinite(Number(SharedConstants && SharedConstants.MIN_BOARD_COLS))
        ? Math.max(1, Math.floor(Number(SharedConstants.MIN_BOARD_COLS)))
        : 4;
    const MAX_BOARD_COLS = Number.isFinite(Number(SharedConstants && SharedConstants.MAX_BOARD_COLS))
        ? Math.max(MIN_BOARD_COLS, Math.floor(Number(SharedConstants.MAX_BOARD_COLS)))
        : Math.max(DEFAULT_BOARD_COLS, DEFAULT_BOARD_ROWS);
    const MAIN_BOARD_SIZE = DEFAULT_BOARD_ROWS;
    const OUTER_MIN = -1;
    const OUTER_MAX = DEFAULT_BOARD_COLS;
    const PADDED_BOARD_MIN = OUTER_MIN;
    const PADDED_BOARD_MAX = OUTER_MAX;
    const PADDED_BOARD_SIZE = (PADDED_BOARD_MAX - PADDED_BOARD_MIN) + 1;

    function toBoardCellKey(row, col) {
        return `${row},${col}`;
    }

    function normalizeOwner(value) {
        if (value === 1 || value === -1) return value;
        return EMPTY;
    }

    function clampBoardDimension(value, fallbackValue, minValue, maxValue) {
        const fallback = Number.isFinite(Number(fallbackValue))
            ? Math.floor(Number(fallbackValue))
            : minValue;
        const numeric = Number.isFinite(Number(value))
            ? Math.floor(Number(value))
            : fallback;
        return Math.max(minValue, Math.min(maxValue, numeric));
    }

    function getBoardDimensionBounds(axis) {
        const normalizedAxis = axis === 'col' || axis === 'cols' || axis === 'column'
            ? 'col'
            : 'row';
        if (normalizedAxis === 'col') {
            return {
                min: MIN_BOARD_COLS,
                max: MAX_BOARD_COLS
            };
        }
        return {
            min: MIN_BOARD_ROWS,
            max: MAX_BOARD_ROWS
        };
    }

    function normalizeBoardDimensionValue(value, fallbackValue, axis) {
        const bounds = getBoardDimensionBounds(axis);
        const normalizedAxis = axis === 'col' || axis === 'cols' || axis === 'column'
            ? 'col'
            : 'row';
        const defaultValue = normalizedAxis === 'col'
            ? DEFAULT_BOARD_COLS
            : DEFAULT_BOARD_ROWS;
        const fallback = Number.isFinite(Number(fallbackValue))
            ? Number(fallbackValue)
            : defaultValue;
        return clampBoardDimension(value, fallback, bounds.min, bounds.max);
    }

    function stepBoardDimensionValue(value, direction, fallbackValue, axis) {
        const normalizedDirection = Number(direction);
        const baseValue = normalizeBoardDimensionValue(value, fallbackValue, axis);
        if (!Number.isFinite(normalizedDirection) || normalizedDirection === 0) {
            return baseValue;
        }
        const step = normalizedDirection > 0 ? 1 : -1;
        return normalizeBoardDimensionValue(baseValue + step, baseValue, axis);
    }

    function isNumericBoardDimensionArg(value) {
        if (value === null || typeof value === 'undefined') return false;
        if (Array.isArray(value)) return false;
        if (typeof value === 'object') return false;
        return Number.isFinite(Number(value));
    }

    function deriveBoardDimsFromBoard(board) {
        if (!Array.isArray(board) || board.length <= 0) return null;
        let cols = 0;
        for (const row of board) {
            if (Array.isArray(row)) cols = Math.max(cols, row.length);
        }
        if (cols <= 0) return null;
        return {
            rows: board.length,
            cols
        };
    }

    function readBoundsSpan(bounds, axis) {
        if (!bounds || typeof bounds !== 'object') return null;
        const minKey = axis === 'col' ? 'minCol' : 'minRow';
        const maxKey = axis === 'col' ? 'maxCol' : 'maxRow';
        const min = Number(bounds[minKey]);
        const max = Number(bounds[maxKey]);
        if (!Number.isFinite(min) || !Number.isFinite(max)) return null;
        return Math.max(1, Math.floor(max - min + 1));
    }

    function buildBoardConfig(rows, cols) {
        const normalizedRows = clampBoardDimension(rows, DEFAULT_BOARD_ROWS, MIN_BOARD_ROWS, MAX_BOARD_ROWS);
        const fallbackCols = Number.isFinite(Number(cols))
            ? Number(cols)
            : (Number.isFinite(Number(rows)) ? Number(rows) : DEFAULT_BOARD_COLS);
        const normalizedCols = clampBoardDimension(fallbackCols, DEFAULT_BOARD_COLS, MIN_BOARD_COLS, MAX_BOARD_COLS);
        return {
            rows: normalizedRows,
            cols: normalizedCols,
            standard8x8: normalizedRows === DEFAULT_BOARD_ROWS && normalizedCols === DEFAULT_BOARD_COLS,
            baseBounds: {
                minRow: 0,
                maxRow: normalizedRows - 1,
                minCol: 0,
                maxCol: normalizedCols - 1
            },
            outerBounds: {
                minRow: OUTER_MIN,
                maxRow: normalizedRows,
                minCol: OUTER_MIN,
                maxCol: normalizedCols
            }
        };
    }

    function normalizeBoardConfig(rawConfig, fallbackBoard) {
        let candidate = rawConfig;
        let board = Array.isArray(fallbackBoard) ? fallbackBoard : null;

        if (Array.isArray(candidate)) {
            board = candidate;
            candidate = null;
        }

        if (candidate && typeof candidate === 'object' && !Array.isArray(candidate)) {
            if (Array.isArray(candidate.board)) board = candidate.board;
            if (candidate.boardConfig && typeof candidate.boardConfig === 'object') {
                candidate = candidate.boardConfig;
            }
        }

        const derived = deriveBoardDimsFromBoard(board);
        let rows = null;
        let cols = null;

        if (candidate && typeof candidate === 'object' && !Array.isArray(candidate)) {
            rows = candidate.rows;
            cols = candidate.cols;
            if (!Number.isFinite(Number(rows))) rows = readBoundsSpan(candidate.baseBounds, 'row');
            if (!Number.isFinite(Number(cols))) cols = readBoundsSpan(candidate.baseBounds, 'col');
            if (!Number.isFinite(Number(rows)) && candidate.outerBounds) {
                const outerMinRow = Number(candidate.outerBounds.minRow);
                const outerMaxRow = Number(candidate.outerBounds.maxRow);
                if (Number.isFinite(outerMinRow) && Number.isFinite(outerMaxRow)) rows = Math.max(1, Math.floor(outerMaxRow - outerMinRow - 1));
            }
            if (!Number.isFinite(Number(cols)) && candidate.outerBounds) {
                const outerMinCol = Number(candidate.outerBounds.minCol);
                const outerMaxCol = Number(candidate.outerBounds.maxCol);
                if (Number.isFinite(outerMinCol) && Number.isFinite(outerMaxCol)) cols = Math.max(1, Math.floor(outerMaxCol - outerMinCol - 1));
            }
        }

        if (!Number.isFinite(Number(rows)) && derived) rows = derived.rows;
        if (!Number.isFinite(Number(cols)) && derived) cols = derived.cols;

        return buildBoardConfig(rows, cols);
    }

    function extractBoardConfigSource(value) {
        if (Array.isArray(value)) return value;
        if (!value || typeof value !== 'object') return null;
        if (value.roomBoardConfig && typeof value.roomBoardConfig === 'object') return value.roomBoardConfig;
        if (Array.isArray(value.board)) return value;
        if (value.boardConfig && typeof value.boardConfig === 'object') return value;
        if (
            isNumericBoardDimensionArg(value.rows)
            || isNumericBoardDimensionArg(value.cols)
            || (value.baseBounds && typeof value.baseBounds === 'object')
            || (value.outerBounds && typeof value.outerBounds === 'object')
        ) {
            return value;
        }
        return null;
    }

    function maybeResolveBoardConfig(value) {
        const source = extractBoardConfigSource(value);
        return source ? resolveBoardConfig(source) : null;
    }

    function readBoardGeometry(value) {
        const config = maybeResolveBoardConfig(value);
        if (!config) return null;
        const rows = Number(config.rows);
        const cols = Number(config.cols);
        if (!Number.isFinite(rows) || !Number.isFinite(cols)) return null;
        return {
            rows: Math.trunc(rows),
            cols: Math.trunc(cols)
        };
    }

    function compareBoardGeometry(previousValue, nextValue) {
        const previous = readBoardGeometry(previousValue);
        const next = readBoardGeometry(nextValue);
        return {
            previous,
            next,
            changed: !!(
                previous
                && next
                && (previous.rows !== next.rows || previous.cols !== next.cols)
            )
        };
    }

    function resolveBoardConfig(boardOrConfig, maybeCols) {
        if (typeof boardOrConfig === 'undefined' || boardOrConfig === null) {
            return buildBoardConfig(DEFAULT_BOARD_ROWS, DEFAULT_BOARD_COLS);
        }
        if (Array.isArray(boardOrConfig)) {
            const derived = deriveBoardDimsFromBoard(boardOrConfig);
            return derived
                ? buildBoardConfig(derived.rows, derived.cols)
                : buildBoardConfig(DEFAULT_BOARD_ROWS, DEFAULT_BOARD_COLS);
        }
        if (isNumericBoardDimensionArg(boardOrConfig) || isNumericBoardDimensionArg(maybeCols)) {
            return buildBoardConfig(boardOrConfig, maybeCols);
        }
        if (boardOrConfig && typeof boardOrConfig === 'object' && !Array.isArray(boardOrConfig)) {
            const candidate = (boardOrConfig.boardConfig && typeof boardOrConfig.boardConfig === 'object')
                ? boardOrConfig.boardConfig
                : boardOrConfig;
            const boardFallback = Array.isArray(boardOrConfig.board)
                ? boardOrConfig.board
                : (Array.isArray(candidate.board) ? candidate.board : null);
            const derived = deriveBoardDimsFromBoard(boardFallback);
            let rows = candidate.rows;
            let cols = candidate.cols;

            if (!isNumericBoardDimensionArg(rows)) rows = readBoundsSpan(candidate.baseBounds, 'row');
            if (!isNumericBoardDimensionArg(cols)) cols = readBoundsSpan(candidate.baseBounds, 'col');
            if (!isNumericBoardDimensionArg(rows) && candidate.outerBounds) {
                const outerMinRow = Number(candidate.outerBounds.minRow);
                const outerMaxRow = Number(candidate.outerBounds.maxRow);
                if (Number.isFinite(outerMinRow) && Number.isFinite(outerMaxRow)) {
                    rows = Math.max(1, Math.floor(outerMaxRow - outerMinRow - 1));
                }
            }
            if (!isNumericBoardDimensionArg(cols) && candidate.outerBounds) {
                const outerMinCol = Number(candidate.outerBounds.minCol);
                const outerMaxCol = Number(candidate.outerBounds.maxCol);
                if (Number.isFinite(outerMinCol) && Number.isFinite(outerMaxCol)) {
                    cols = Math.max(1, Math.floor(outerMaxCol - outerMinCol - 1));
                }
            }
            if (!isNumericBoardDimensionArg(rows) && derived) rows = derived.rows;
            if (!isNumericBoardDimensionArg(cols) && derived) cols = derived.cols;
            return buildBoardConfig(rows, cols);
        }
        return normalizeBoardConfig(boardOrConfig);
    }

    function resolveBaseBoardBounds(boardOrConfig, maybeCols) {
        return resolveBoardConfig(boardOrConfig, maybeCols).baseBounds;
    }

    function resolveOuterBounds(boardOrConfig, maybeCols) {
        return resolveBoardConfig(boardOrConfig, maybeCols).outerBounds;
    }

    function getBoardRows(boardOrConfig, maybeCols) {
        return resolveBoardConfig(boardOrConfig, maybeCols).rows;
    }

    function getBoardCols(boardOrConfig, maybeCols) {
        return resolveBoardConfig(boardOrConfig, maybeCols).cols;
    }

    function isMainBoardCell(row, col, boardOrConfig, maybeCols) {
        if (!Number.isInteger(row) || !Number.isInteger(col)) return false;
        const bounds = resolveBaseBoardBounds(boardOrConfig, maybeCols);
        return (
            row >= bounds.minRow &&
            row <= bounds.maxRow &&
            col >= bounds.minCol &&
            col <= bounds.maxCol
        );
    }

    function collectMainBoardCoordinates(boardOrConfig, maybeCols) {
        const config = resolveBoardConfig(boardOrConfig, maybeCols);
        const coords = [];
        for (let row = 0; row < config.rows; row++) {
            for (let col = 0; col < config.cols; col++) {
                coords.push({ row, col });
            }
        }
        return coords;
    }

    function createEmptyBoard(boardOrConfig, maybeCols, maybeFillValue) {
        const looksLikeConfigObject = !!(boardOrConfig && typeof boardOrConfig === 'object');
        const useNumericArgs = !looksLikeConfigObject
            && Number.isFinite(Number(boardOrConfig))
            && Number.isFinite(Number(maybeCols));
        const config = useNumericArgs
            ? resolveBoardConfig(boardOrConfig, maybeCols)
            : resolveBoardConfig(boardOrConfig);
        const fillValue = useNumericArgs ? maybeFillValue : maybeCols;
        const normalizedFillValue = (typeof fillValue === 'undefined') ? EMPTY : fillValue;
        return Array.from({ length: config.rows }, () => Array.from({ length: config.cols }, () => normalizedFillValue));
    }

    function getOpeningAnchor(boardOrConfig, maybeCols) {
        const config = resolveBoardConfig(boardOrConfig, maybeCols);
        return {
            row: Math.floor((config.rows - 2) / 2),
            col: Math.floor((config.cols - 2) / 2)
        };
    }

    function getOpeningPlacements(boardOrConfig, maybeCols) {
        const config = resolveBoardConfig(boardOrConfig, maybeCols);
        const anchor = getOpeningAnchor(config);
        if (config.rows === 7 && config.cols === 7) {
            const placements = [];
            for (let rowOffset = 0; rowOffset < 3; rowOffset += 1) {
                for (let colOffset = 0; colOffset < 3; colOffset += 1) {
                    if (rowOffset === 1 && colOffset === 1) continue;
                    placements.push({
                        row: anchor.row + rowOffset,
                        col: anchor.col + colOffset,
                        owner: ((rowOffset + colOffset) % 2 === 0) ? WHITE : BLACK
                    });
                }
            }
            return placements;
        }
        return [
            { row: anchor.row, col: anchor.col, owner: WHITE },
            { row: anchor.row, col: anchor.col + 1, owner: BLACK },
            { row: anchor.row + 1, col: anchor.col, owner: BLACK },
            { row: anchor.row + 1, col: anchor.col + 1, owner: WHITE }
        ];
    }

    function getOpeningCells(boardOrConfig, maybeCols) {
        return getOpeningPlacements(boardOrConfig, maybeCols).map((placement) => ({
            row: placement.row,
            col: placement.col
        }));
    }

    function isRawCellInBounds(board, row, col) {
        return (
            Array.isArray(board) &&
            Number.isInteger(row) &&
            Number.isInteger(col) &&
            row >= 0 &&
            row < board.length &&
            Array.isArray(board[row]) &&
            col >= 0 &&
            col < board[row].length
        );
    }

    function isExpansionCoordinate(row, col, boardOrConfig, maybeCols) {
        if (!Number.isInteger(row) || !Number.isInteger(col)) return false;
        const outerBounds = resolveOuterBounds(boardOrConfig, maybeCols);
        if (
            row < outerBounds.minRow ||
            row > outerBounds.maxRow ||
            col < outerBounds.minCol ||
            col > outerBounds.maxCol
        ) {
            return false;
        }
        return !isMainBoardCell(row, col, boardOrConfig, maybeCols);
    }

    function isPaddedBoardCoordinate(row, col) {
        return (
            Number.isInteger(row) &&
            Number.isInteger(col) &&
            row >= PADDED_BOARD_MIN &&
            row <= PADDED_BOARD_MAX &&
            col >= PADDED_BOARD_MIN &&
            col <= PADDED_BOARD_MAX
        );
    }

    function toPaddedBoardIndex(row, col) {
        if (!isPaddedBoardCoordinate(row, col)) return -1;
        return ((row - PADDED_BOARD_MIN) * PADDED_BOARD_SIZE) + (col - PADDED_BOARD_MIN);
    }

    function fromPaddedBoardIndex(index) {
        if (!Number.isInteger(index) || index < 0 || index >= (PADDED_BOARD_SIZE * PADDED_BOARD_SIZE)) return null;
        const rowOffset = Math.floor(index / PADDED_BOARD_SIZE);
        const colOffset = index % PADDED_BOARD_SIZE;
        return {
            row: PADDED_BOARD_MIN + rowOffset,
            col: PADDED_BOARD_MIN + colOffset
        };
    }

    function resolveExpansionSide(side, row, col, boardOrConfig, maybeCols) {
        if (side === 'left' || side === 'right' || side === 'top' || side === 'bottom') return side;
        const outerBounds = resolveOuterBounds(boardOrConfig, maybeCols);
        if (col === outerBounds.minCol) return 'left';
        if (col === outerBounds.maxCol) return 'right';
        if (row === outerBounds.minRow) return 'top';
        if (row === outerBounds.maxRow) return 'bottom';
        return null;
    }

    function normalizeExpansionCell(cell, boardOrConfig) {
        if (!cell || typeof cell !== 'object') return null;
        const row = Number(cell.row);
        let col = Number(cell.col);
        const side = resolveExpansionSide(cell.side, row, col, boardOrConfig);
        const outerBounds = resolveOuterBounds(boardOrConfig);
        if (!Number.isInteger(row)) return null;
        if (!Number.isInteger(col)) {
            if (side === 'left') col = outerBounds.minCol;
            else if (side === 'right') col = outerBounds.maxCol;
        }
        if (!Number.isInteger(col) || !isExpansionCoordinate(row, col, boardOrConfig)) return null;
        return {
            side: resolveExpansionSide(side, row, col, boardOrConfig),
            row,
            col,
            owner: normalizeOwner(cell.owner)
        };
    }

    function collectExpansionDescriptors(boardExpansion, boardOrConfig) {
        if (!boardExpansion || typeof boardExpansion !== 'object') return [];
        const out = [];
        const push = (raw) => {
            const normalized = normalizeExpansionCell(raw, boardOrConfig);
            if (!normalized) return;
            if (out.some((one) => one.row === normalized.row && one.col === normalized.col)) return;
            out.push(normalized);
        };
        if (Array.isArray(boardExpansion.cells)) {
            for (const cell of boardExpansion.cells) push(cell);
        } else if (boardExpansion.active === true) {
            push(boardExpansion);
        }
        return out;
    }

    function resolveBoardShapeSource(boardOrConfig) {
        if (Array.isArray(boardOrConfig)) {
            return {
                board: boardOrConfig,
                boardExpansion: null
            };
        }
        if (!boardOrConfig || typeof boardOrConfig !== 'object') {
            return {
                board: null,
                boardExpansion: null
            };
        }
        return {
            board: Array.isArray(boardOrConfig.board) ? boardOrConfig.board : null,
            boardExpansion: (boardOrConfig.boardExpansion && typeof boardOrConfig.boardExpansion === 'object')
                ? boardOrConfig.boardExpansion
                : null
        };
    }

    function getAttachedExpansionDescriptors(board) {
        const meta = getBoardShapeMeta(board);
        if (!meta || !Array.isArray(meta.expansionCells)) return [];
        return meta.expansionCells.map((cell) => ({
            side: cell.side,
            row: cell.row,
            col: cell.col,
            owner: normalizeOwner(cell.owner)
        }));
    }

    function forEachBoardShapeCell(boardOrConfig, visitor) {
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

    function countDiscsByPlayer(boardOrConfig) {
        const counts = { black: 0, white: 0 };
        forEachBoardShapeCell(boardOrConfig, function countOwnedCell(row, col, value) {
            if (Number(value) === BLACK) counts.black += 1;
            else if (Number(value) === WHITE) counts.white += 1;
        });
        return counts;
    }

    function collectMeteorHoleKeys(cardState) {
        const out = new Set();
        const markers = cardState && Array.isArray(cardState.markers) ? cardState.markers : [];
        for (const marker of markers) {
            if (!marker || marker.kind !== 'specialStone') continue;
            if (!marker.data || String(marker.data.type || '').toUpperCase() !== 'METEOR_HOLE') continue;
            const row = Number(marker.row);
            const col = Number(marker.col);
            if (!Number.isInteger(row) || !Number.isInteger(col)) continue;
            out.add(toBoardCellKey(row, col));
        }
        return out;
    }

    function cloneMeta(meta) {
        if (!meta || typeof meta !== 'object') return null;
        return {
            minRow: Number.isInteger(meta.minRow) ? meta.minRow : 0,
            maxRow: Number.isInteger(meta.maxRow) ? meta.maxRow : -1,
            minCol: Number.isInteger(meta.minCol) ? meta.minCol : 0,
            maxCol: Number.isInteger(meta.maxCol) ? meta.maxCol : -1,
            playableKeys: new Set(meta.playableKeys instanceof Set ? Array.from(meta.playableKeys) : []),
            meteorHoleKeys: new Set(meta.meteorHoleKeys instanceof Set ? Array.from(meta.meteorHoleKeys) : []),
            expansionCells: Array.isArray(meta.expansionCells)
                ? meta.expansionCells.map((cell) => ({
                    side: cell.side,
                    row: cell.row,
                    col: cell.col,
                    owner: normalizeOwner(cell.owner)
                }))
                : [],
            expansionOwnerByKey: Object.assign(Object.create(null), meta.expansionOwnerByKey || null),
            standard8x8: meta.standard8x8 === true,
            coordinateCache: null,
            cornerKeyCache: null,
            xKeyCache: null,
            cKeyCache: null
        };
    }

    function setBoardShapeMeta(board, meta) {
        if (!Array.isArray(board)) return board;
        Object.defineProperty(board, BOARD_SHAPE_META_KEY, {
            value: meta,
            writable: true,
            configurable: true
        });
        return board;
    }

    function getBoardShapeMeta(board) {
        if (!Array.isArray(board)) return null;
        const meta = board[BOARD_SHAPE_META_KEY];
        return meta && typeof meta === 'object' ? meta : null;
    }

    function buildShapeMeta(board, options) {
        if (!Array.isArray(board)) return null;
        const boardConfig = resolveBoardConfig((options && options.boardConfig) || board);
        const expansionCells = collectExpansionDescriptors(options && options.boardExpansion, boardConfig);
        const meteorHoleKeys = collectMeteorHoleKeys(options && options.cardState);
        const playableKeys = new Set();
        let minRow = Infinity;
        let maxRow = -Infinity;
        let minCol = Infinity;
        let maxCol = -Infinity;

        const addCoord = (row, col) => {
            const key = toBoardCellKey(row, col);
            if (meteorHoleKeys.has(key)) return;
            playableKeys.add(key);
            if (row < minRow) minRow = row;
            if (row > maxRow) maxRow = row;
            if (col < minCol) minCol = col;
            if (col > maxCol) maxCol = col;
        };

        for (let row = 0; row < board.length; row++) {
            const line = Array.isArray(board[row]) ? board[row] : [];
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

        const expansionOwnerByKey = Object.create(null);
        for (const cell of expansionCells) {
            expansionOwnerByKey[toBoardCellKey(cell.row, cell.col)] = normalizeOwner(cell.owner);
        }

        const standard8x8 =
            board.length === DEFAULT_BOARD_ROWS &&
            board.every((row) => Array.isArray(row) && row.length === DEFAULT_BOARD_COLS) &&
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

    function attachBoardShape(board, options) {
        if (!Array.isArray(board)) return board;
        if (!options && getBoardShapeMeta(board)) return board;
        return setBoardShapeMeta(board, buildShapeMeta(board, options || null));
    }

    function copyBoardShape(fromBoard, toBoard) {
        if (!Array.isArray(toBoard)) return toBoard;
        const meta = getBoardShapeMeta(fromBoard);
        if (!meta) return toBoard;
        return setBoardShapeMeta(toBoard, cloneMeta(meta));
    }

    function cloneBoard(board) {
        if (!Array.isArray(board)) return [];
        const cloned = board.map((row) => Array.isArray(row) ? row.slice() : []);
        return copyBoardShape(board, cloned);
    }

    function resolveBoardBounds(boardOrRows, maybeCols) {
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
            for (const row of boardOrRows) {
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

    function isStandardBoard8x8(board) {
        const meta = getBoardShapeMeta(board);
        if (meta) return meta.standard8x8 === true;
        if (!Array.isArray(board) || board.length !== DEFAULT_BOARD_ROWS) return false;
        for (const row of board) {
            if (!Array.isArray(row) || row.length !== DEFAULT_BOARD_COLS) return false;
        }
        return true;
    }

    function hasPlayableCell(board, row, col) {
        if (!Array.isArray(board) || !Number.isInteger(row) || !Number.isInteger(col)) return false;
        const meta = getBoardShapeMeta(board);
        if (!meta) return isRawCellInBounds(board, row, col);
        return meta.playableKeys.has(toBoardCellKey(row, col));
    }

    function collectBoardCoordinates(board) {
        if (!Array.isArray(board)) return [];
        const meta = getBoardShapeMeta(board);
        if (!meta) {
            const coords = [];
            for (let row = 0; row < board.length; row++) {
                const line = Array.isArray(board[row]) ? board[row] : [];
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

    function getCellValue(board, row, col) {
        if (!Array.isArray(board) || !Number.isInteger(row) || !Number.isInteger(col)) return null;
        const meta = getBoardShapeMeta(board);
        if (meta && !meta.playableKeys.has(toBoardCellKey(row, col))) return null;
        if (isRawCellInBounds(board, row, col)) return board[row][col];
        if (!meta) return null;
        const key = toBoardCellKey(row, col);
        if (!Object.prototype.hasOwnProperty.call(meta.expansionOwnerByKey, key)) return null;
        return normalizeOwner(meta.expansionOwnerByKey[key]);
    }

    function setCellValue(board, row, col, value) {
        if (!Array.isArray(board) || !Number.isInteger(row) || !Number.isInteger(col)) return false;
        if (isRawCellInBounds(board, row, col)) {
            const meta = getBoardShapeMeta(board);
            if (meta && !meta.playableKeys.has(toBoardCellKey(row, col))) return false;
            board[row][col] = normalizeOwner(value);
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

    function countBoardEmpties(board) {
        if (!Array.isArray(board)) return 0;
        let empties = 0;
        for (const cell of collectBoardCoordinates(board)) {
            if (getCellValue(board, cell.row, cell.col) === EMPTY) empties += 1;
        }
        return empties;
    }

    function buildCornerKeySet(board) {
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
        const corners = new Set();
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

    function getCornerCells(board) {
        return collectBoardCoordinates(board).filter((cell) => buildCornerKeySet(board).has(toBoardCellKey(cell.row, cell.col)));
    }

    function getPerimeterCells(board) {
        return collectBoardCoordinates(board).filter((cell) => isEdgeCell(cell.row, cell.col, board));
    }

    function getCornerEdgeLineDescriptors(board) {
        if (!Array.isArray(board)) return [];
        const corners = getCornerCells(board);
        const lines = [];
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

                const cells = [{ row: corner.row, col: corner.col }];
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

    function isCornerCell(row, col, boardOrRows, maybeCols) {
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

    function isEdgeCell(row, col, boardOrRows, maybeCols) {
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

    function buildRiskCellSets(board) {
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
        const xKeys = new Set();
        const cKeys = new Set();

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

    function getCornerProximity(row, col, boardOrRows, maybeCols) {
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

    function isCorner(row, col, boardOrRows, maybeCols) {
        return isCornerCell(row, col, boardOrRows, maybeCols);
    }

    function isEdge(row, col, boardOrRows, maybeCols) {
        return isEdgeCell(row, col, boardOrRows, maybeCols);
    }

    function isXSquare(row, col, boardOrRows, maybeCols) {
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

    function isCSquare(row, col, boardOrRows, maybeCols) {
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

    function getCellType(row, col, boardOrRows, maybeCols) {
        if (!Number.isInteger(row) || !Number.isInteger(col)) return 'unknown';
        if (isCorner(row, col, boardOrRows, maybeCols)) return 'corner';
        if (isXSquare(row, col, boardOrRows, maybeCols)) return 'x';
        if (isCSquare(row, col, boardOrRows, maybeCols)) return 'c';
        if (isEdge(row, col, boardOrRows, maybeCols)) return 'edge';
        return 'inner';
    }

    function getFlipsBasic(board, row, col, playerValue) {
        if (!hasPlayableCell(board, row, col)) return [];
        if (getCellValue(board, row, col) !== EMPTY) return [];
        const dirs = [
            [-1, -1], [-1, 0], [-1, 1],
            [0, -1],           [0, 1],
            [1, -1],  [1, 0],  [1, 1]
        ];
        const out = [];
        for (const dir of dirs) {
            const temp = [];
            let currentRow = row + dir[0];
            let currentCol = col + dir[1];
            while (hasPlayableCell(board, currentRow, currentCol) && getCellValue(board, currentRow, currentCol) === -playerValue) {
                temp.push({ row: currentRow, col: currentCol });
                currentRow += dir[0];
                currentCol += dir[1];
            }
            if (
                temp.length > 0 &&
                hasPlayableCell(board, currentRow, currentCol) &&
                getCellValue(board, currentRow, currentCol) === playerValue
            ) {
                out.push.apply(out, temp);
            }
        }
        return out;
    }

    function getLegalMovesBasic(board, playerValue) {
        if (!Array.isArray(board)) return [];
        const moves = [];
        for (const cell of collectBoardCoordinates(board)) {
            const flips = getFlipsBasic(board, cell.row, cell.col, playerValue);
            if (flips.length > 0) {
                moves.push({ row: cell.row, col: cell.col, flips });
            }
        }
        return moves;
    }

    function countCornerControl(board, playerValue) {
        if (!Array.isArray(board)) return { ownCorners: 0, oppCorners: 0 };
        let ownCorners = 0;
        let oppCorners = 0;
        for (const cell of getCornerCells(board)) {
            const value = getCellValue(board, cell.row, cell.col);
            if (value === playerValue) ownCorners += 1;
            else if (value === -playerValue) oppCorners += 1;
        }
        return { ownCorners, oppCorners };
    }

    function countEdgeControl(board, playerValue) {
        if (!Array.isArray(board)) return { ownEdges: 0, oppEdges: 0 };
        let ownEdges = 0;
        let oppEdges = 0;
        for (const cell of collectBoardCoordinates(board)) {
            if (!isEdgeCell(cell.row, cell.col, board) || isCornerCell(cell.row, cell.col, board)) continue;
            const value = getCellValue(board, cell.row, cell.col);
            if (value === playerValue) ownEdges += 1;
            else if (value === -playerValue) oppEdges += 1;
        }
        return { ownEdges, oppEdges };
    }

    function toCellChar(value) {
        if (value === 1) return 'B';
        if (value === -1) return 'W';
        if (value === 0) return '.';
        return '#';
    }

    function transformCoord(row, col, size, transformId) {
        if (transformId === 0) return { row, col };
        if (transformId === 1) return { row: col, col: size - 1 - row };
        if (transformId === 2) return { row: size - 1 - row, col: size - 1 - col };
        if (transformId === 3) return { row: size - 1 - col, col: row };
        if (transformId === 4) return { row, col: size - 1 - col };
        if (transformId === 5) return { row: size - 1 - col, col: size - 1 - row };
        if (transformId === 6) return { row: size - 1 - row, col };
        if (transformId === 7) return { row: col, col: row };
        return { row, col };
    }

    function buildEnvelopeMatrix(board) {
        const bounds = resolveBoardBounds(board);
        if (!bounds || bounds.maxRow < bounds.minRow || bounds.maxCol < bounds.minCol) {
            return { matrix: [], size: 0, minRow: 0, minCol: 0 };
        }
        const rowSpan = (bounds.maxRow - bounds.minRow) + 1;
        const colSpan = (bounds.maxCol - bounds.minCol) + 1;
        const size = Math.max(rowSpan, colSpan);
        const matrix = Array.from({ length: size }, () => Array.from({ length: size }, () => '#'));
        for (const cell of collectBoardCoordinates(board)) {
            const envelopeRow = cell.row - bounds.minRow;
            const envelopeCol = cell.col - bounds.minCol;
            matrix[envelopeRow][envelopeCol] = toCellChar(getCellValue(board, cell.row, cell.col));
        }
        return {
            matrix,
            size,
            minRow: bounds.minRow,
            minCol: bounds.minCol
        };
    }

    function encodeEnvelopeMatrix(matrix) {
        if (!Array.isArray(matrix) || matrix.length <= 0) return '';
        return matrix.map((row) => Array.isArray(row) ? row.join('') : '').join('/');
    }

    function transformMatrix(matrix, transformId) {
        if (!Array.isArray(matrix) || matrix.length <= 0) return [];
        const size = matrix.length;
        const out = Array.from({ length: size }, () => Array.from({ length: size }, () => '#'));
        for (let row = 0; row < size; row++) {
            for (let col = 0; col < size; col++) {
                const mapped = transformCoord(row, col, size, transformId);
                out[mapped.row][mapped.col] = matrix[row][col];
            }
        }
        return out;
    }

    function encodeBoard(board) {
        return encodeEnvelopeMatrix(buildEnvelopeMatrix(board).matrix);
    }

    function canonicalizeBoard(board) {
        const envelope = buildEnvelopeMatrix(board);
        const raw = encodeEnvelopeMatrix(envelope.matrix);
        if (!raw) {
            return {
                boardKey: raw,
                transformId: 0,
                size: envelope.size,
                minRow: envelope.minRow,
                minCol: envelope.minCol
            };
        }
        let best = null;
        let bestTransform = 0;
        for (let transformId = 0; transformId < 8; transformId++) {
            const encoded = encodeEnvelopeMatrix(transformMatrix(envelope.matrix, transformId));
            if (best === null || encoded < best) {
                best = encoded;
                bestTransform = transformId;
            }
        }
        return {
            boardKey: best || raw,
            transformId: bestTransform,
            size: envelope.size,
            minRow: envelope.minRow,
            minCol: envelope.minCol
        };
    }

    function mapCoordToCanonical(row, col, board, transformId) {
        if (!Number.isInteger(row) || !Number.isInteger(col)) return null;
        const envelope = buildEnvelopeMatrix(board);
        if (envelope.size <= 0) return null;
        const relativeRow = row - envelope.minRow;
        const relativeCol = col - envelope.minCol;
        if (
            relativeRow < 0 ||
            relativeCol < 0 ||
            relativeRow >= envelope.size ||
            relativeCol >= envelope.size
        ) {
            return null;
        }
        return transformCoord(relativeRow, relativeCol, envelope.size, transformId);
    }

    function makeCanonicalActionKey(move, board, transformId) {
        if (!move || !Number.isFinite(move.row) || !Number.isFinite(move.col)) return '';
        const mapped = mapCoordToCanonical(Number(move.row), Number(move.col), board, Number(transformId) || 0);
        if (!mapped) return '';
        return `place:${mapped.row}:${mapped.col}`;
    }

    function normalizePosArgs(posOrRow, maybeCol) {
        if (posOrRow && typeof posOrRow === 'object') {
            return {
                row: Number(posOrRow.row),
                col: Number(posOrRow.col)
            };
        }
        return {
            row: Number(posOrRow),
            col: Number(maybeCol)
        };
    }

    function resolveNotationArgs(posOrRow, maybeCol, maybeBoardOrConfig) {
        const objectPosWithBoardContext = !!(
            posOrRow &&
            typeof posOrRow === 'object' &&
            !Number.isFinite(Number(maybeCol))
        );
        return {
            pos: objectPosWithBoardContext
                ? normalizePosArgs(posOrRow)
                : normalizePosArgs(posOrRow, maybeCol),
            boardOrConfig: objectPosWithBoardContext ? maybeCol : maybeBoardOrConfig
        };
    }

    function formatPosTextJa(posOrRow, maybeCol, maybeBoardOrConfig) {
        const resolved = resolveNotationArgs(posOrRow, maybeCol, maybeBoardOrConfig);
        const pos = resolved.pos;
        const config = resolveBoardConfig(resolved.boardOrConfig);
        const baseBounds = config.baseBounds;
        const outerBounds = config.outerBounds;
        const row = pos.row;
        const col = pos.col;
        if (!Number.isInteger(row) || !Number.isInteger(col)) return '';
        if (row === outerBounds.minRow && col === outerBounds.minCol) return '左上外';
        if (row === outerBounds.minRow && col === outerBounds.maxCol) return '右上外';
        if (row === outerBounds.maxRow && col === outerBounds.minCol) return '左下外';
        if (row === outerBounds.maxRow && col === outerBounds.maxCol) return '右下外';
        if (row === outerBounds.minRow && col >= baseBounds.minCol && col <= baseBounds.maxCol) {
            return `上外${String.fromCharCode(65 + col)}`;
        }
        if (row === outerBounds.maxRow && col >= baseBounds.minCol && col <= baseBounds.maxCol) {
            return `下外${String.fromCharCode(65 + col)}`;
        }
        if (col === outerBounds.minCol && row >= baseBounds.minRow && row <= baseBounds.maxRow) return `左外${row + 1}`;
        if (col === outerBounds.maxCol && row >= baseBounds.minRow && row <= baseBounds.maxRow) return `右外${row + 1}`;
        if (row >= baseBounds.minRow && row <= baseBounds.maxRow && col >= baseBounds.minCol && col <= baseBounds.maxCol) {
            return `${String.fromCharCode(65 + col)}${row + 1}`;
        }
        return `(${row},${col})`;
    }

    function posToNotation(posOrRow, maybeCol, maybeBoardOrConfig) {
        const resolved = resolveNotationArgs(posOrRow, maybeCol, maybeBoardOrConfig);
        const pos = resolved.pos;
        const config = resolveBoardConfig(resolved.boardOrConfig);
        const baseBounds = config.baseBounds;
        const outerBounds = config.outerBounds;
        const row = pos.row;
        const col = pos.col;
        if (!Number.isInteger(row) || !Number.isInteger(col)) return '';
        if (row === outerBounds.minRow && col === outerBounds.minCol) return 'top-left';
        if (row === outerBounds.minRow && col === outerBounds.maxCol) return 'top-right';
        if (row === outerBounds.maxRow && col === outerBounds.minCol) return 'bottom-left';
        if (row === outerBounds.maxRow && col === outerBounds.maxCol) return 'bottom-right';
        if (row === outerBounds.minRow && col >= baseBounds.minCol && col <= baseBounds.maxCol) {
            return `top-${String.fromCharCode(97 + col)}`;
        }
        if (row === outerBounds.maxRow && col >= baseBounds.minCol && col <= baseBounds.maxCol) {
            return `bottom-${String.fromCharCode(97 + col)}`;
        }
        if (col === outerBounds.minCol && row >= baseBounds.minRow && row <= baseBounds.maxRow) return `left${row + 1}`;
        if (col === outerBounds.maxCol && row >= baseBounds.minRow && row <= baseBounds.maxRow) return `right${row + 1}`;
        if (row >= baseBounds.minRow && row <= baseBounds.maxRow && col >= baseBounds.minCol && col <= baseBounds.maxCol) {
            return `${String.fromCharCode(97 + col)}${row + 1}`;
        }
        return `r${row}c${col}`;
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
        getCellValue,
        setCellValue,
        countBoardEmpties,
        getCornerCells,
        getPerimeterCells,
        getCornerEdgeLineDescriptors,
        getCornerProximity,
        isCornerCell,
        isEdgeCell,
        isCorner,
        isEdge,
        isXSquare,
        isCSquare,
        getCellType,
        getFlipsBasic,
        getLegalMovesBasic,
        countCornerControl,
        countEdgeControl,
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
