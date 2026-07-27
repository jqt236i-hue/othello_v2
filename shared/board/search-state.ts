import { createLegalMoves } from "./legal-moves";
import {
  copyBoundedOwnArray,
  DEFAULT_BOARD_MAX_ABS_COORDINATE,
  DEFAULT_BOARD_MAX_MATRIX_DIMENSION,
  DEFAULT_BOARD_MAX_SHAPE_ENTRIES,
} from "./expansion-descriptors";
import {
  createReadonlyMapView,
  createReadonlySetView,
} from "./topology";

export const BOARD_SEARCH_CONTEXT_KIND = "board-search-context-v1";
const MAX_SEARCH_MATRIX_DIMENSION = DEFAULT_BOARD_MAX_MATRIX_DIMENSION;
const MAX_SEARCH_SHAPE_KEYS = DEFAULT_BOARD_MAX_SHAPE_ENTRIES;
const MAX_SEARCH_ENVELOPE_SPAN =
  (DEFAULT_BOARD_MAX_ABS_COORDINATE * 2) + 1;

export interface BoardSearchCell {
  row: number;
  col: number;
}

export interface BoardSearchCellUpdate extends BoardSearchCell {
  value: number;
}

export interface BoardSearchExpansionCell extends BoardSearchCell {
  side?: string;
  owner: number;
}

export interface BoardSearchShapeInput {
  minRow?: number;
  maxRow?: number;
  minCol?: number;
  maxCol?: number;
  baseRows?: number;
  baseCols?: number;
  baseKeys: ReadonlySet<string> | readonly string[];
  playableKeys?: ReadonlySet<string> | readonly string[];
  meteorHoleKeys?: ReadonlySet<string> | readonly string[];
  expansionCells?: readonly BoardSearchExpansionCell[];
  expansionOwnerByKey?: Readonly<Record<string, number>>;
  standard8x8?: boolean;
  topology?: unknown;
}

export interface BoardSearchShape {
  readonly minRow: number;
  readonly maxRow: number;
  readonly minCol: number;
  readonly maxCol: number;
  readonly baseRows: number;
  readonly baseCols: number;
  readonly baseKeys: ReadonlySet<string>;
  readonly playableKeys: ReadonlySet<string>;
  readonly meteorHoleKeys: ReadonlySet<string>;
  readonly coordinates: readonly BoardSearchCell[];
  readonly expansionCells: readonly Readonly<BoardSearchExpansionCell>[];
  readonly expansionOwnerByKey: Readonly<Record<string, number>>;
  readonly standard8x8: boolean;
  readonly topology: unknown;
}

export interface BoardSearchContext {
  readonly kind: typeof BOARD_SEARCH_CONTEXT_KIND;
  readonly board: ReadonlyArray<ReadonlyArray<number>>;
  readonly shape: BoardSearchShape;
}

export interface BoardSearchStateDependencies {
  empty: number;
  black: number;
  white: number;
  directions: ReadonlyArray<ReadonlyArray<number>>;
  toBoardCellKey: (row: number, col: number) => string;
}

interface BoardSearchInternalState {
  matrix: number[][];
  publicMatrix: ReadonlyArray<ReadonlyArray<number>>;
  playableKeys: Set<string>;
  meteorHoleKeys: Set<string>;
  playableKeyView: ReadonlySet<string>;
  meteorHoleKeyView: ReadonlySet<string>;
  coordinates: readonly Readonly<BoardSearchCell>[];
  expansionCells: BoardSearchExpansionCell[];
  expansionCellByKey: Map<string, BoardSearchExpansionCell>;
  expansionOwnerByKey: Record<string, number>;
  publicExpansionCells: readonly Readonly<BoardSearchExpansionCell>[];
  publicExpansionOwnerByKey: Readonly<Record<string, number>>;
  shape: BoardSearchShape;
  revision: number;
}

interface BoardSearchStaticShape {
  minRow: number;
  maxRow: number;
  minCol: number;
  maxCol: number;
  baseRows: number;
  baseCols: number;
  baseKeys: ReadonlySet<string>;
  baseKeyView?: ReadonlySet<string>;
  playableKeys: Set<string>;
  meteorHoleKeys: Set<string>;
  playableKeyView?: ReadonlySet<string>;
  meteorHoleKeyView?: ReadonlySet<string>;
  coordinates: readonly Readonly<BoardSearchCell>[];
  standard8x8: boolean;
  topology: unknown;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function toInteger(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isInteger(parsed) ? parsed : null;
}

function parseCanonicalKey(
  rawKey: unknown,
  label: string,
  toBoardCellKey: (row: number, col: number) => string,
): { key: string; row: number; col: number } {
  if (typeof rawKey !== "string") {
    throw new Error(`${label} must be a canonical string coordinate`);
  }
  const parts = rawKey.split(",");
  const row = parts.length === 2 ? toInteger(parts[0]) : null;
  const col = parts.length === 2 ? toInteger(parts[1]) : null;
  if (
    row === null ||
    col === null ||
    Math.abs(row) > DEFAULT_BOARD_MAX_ABS_COORDINATE ||
    Math.abs(col) > DEFAULT_BOARD_MAX_ABS_COORDINATE
  ) {
    throw new Error(`${label} is invalid: ${rawKey}`);
  }
  const key = toBoardCellKey(row, col);
  if (rawKey !== key) {
    throw new Error(`${label} is not canonical: ${rawKey}`);
  }
  return { key, row, col };
}

function toCanonicalKeySet(
  value: unknown,
  label: string,
  toBoardCellKey: (row: number, col: number) => string,
): Set<string> {
  const out = new Set<string>();
  const append = (rawKey: unknown): void => {
    const { key } = parseCanonicalKey(rawKey, label, toBoardCellKey);
    if (out.has(key)) throw new Error(`Duplicate ${label}: ${key}`);
    out.add(key);
  };
  if (Array.isArray(value)) {
    if (value.length > MAX_SEARCH_SHAPE_KEYS) {
      throw new Error(`${label} exceeds the bounded search shape size`);
    }
    for (let index = 0; index < value.length; index += 1) {
      if (!Object.prototype.hasOwnProperty.call(value, index)) {
        throw new Error(`${label} entry ${index} is missing`);
      }
      append(value[index]);
    }
    return out;
  }
  if (
    value &&
    typeof value === "object" &&
    typeof (value as { [Symbol.iterator]?: unknown })[Symbol.iterator] ===
      "function"
  ) {
    let iterator: Iterator<unknown>;
    try {
      iterator = (
        value as { [Symbol.iterator](): Iterator<unknown> }
      )[Symbol.iterator]();
    } catch {
      throw new Error(`${label} must be a readable iterable collection`);
    }
    for (let count = 0; ; count += 1) {
      let next: IteratorResult<unknown>;
      try {
        next = iterator.next();
      } catch {
        throw new Error(`${label} must be a readable iterable collection`);
      }
      if (!next || typeof next !== "object") {
        throw new Error(`${label} must be a readable iterable collection`);
      }
      if (next.done) return out;
      if (count >= MAX_SEARCH_SHAPE_KEYS) {
        throw new Error(`${label} exceeds the bounded search shape size`);
      }
      append(next.value);
    }
  }
  throw new Error(`${label} must be an array or iterable set`);
}

function createPublicMatrixSnapshot(
  matrix: number[][],
): ReadonlyArray<ReadonlyArray<number>> {
  return Object.freeze(
    matrix.map((row) => Object.freeze(row.slice())),
  );
}

function sortedCoordinatesFromKeys(
  keys: ReadonlySet<string>,
  toBoardCellKey: (row: number, col: number) => string,
): BoardSearchCell[] {
  const coordinates: BoardSearchCell[] = [];
  for (const key of keys) {
    const parsed = parseCanonicalKey(
      key,
      "search board coordinate key",
      toBoardCellKey,
    );
    coordinates.push({ row: parsed.row, col: parsed.col });
  }
  return coordinates.sort((left, right) =>
    left.row - right.row || left.col - right.col
  );
}

function boundsFromCoordinates(
  coordinates: readonly BoardSearchCell[],
  fallbackRows: number,
  fallbackCols: number,
) {
  if (coordinates.length === 0) {
    return {
      minRow: 0,
      maxRow: Math.max(0, fallbackRows - 1),
      minCol: 0,
      maxCol: Math.max(0, fallbackCols - 1),
    };
  }
  let minRow = Infinity;
  let maxRow = -Infinity;
  let minCol = Infinity;
  let maxCol = -Infinity;
  for (const cell of coordinates) {
    minRow = Math.min(minRow, cell.row);
    maxRow = Math.max(maxRow, cell.row);
    minCol = Math.min(minCol, cell.col);
    maxCol = Math.max(maxCol, cell.col);
  }
  return { minRow, maxRow, minCol, maxCol };
}

export function createBoardSearchStateTools(
  deps: BoardSearchStateDependencies,
) {
  const states = new WeakMap<object, BoardSearchInternalState>();

  const isOwner = (value: unknown): value is number =>
    value === deps.empty || value === deps.black || value === deps.white;

  const normalizeOwner = (value: unknown): number =>
    value === deps.black || value === deps.white ? Number(value) : deps.empty;

  function buildImmutableTopologySnapshot(input: {
    baseRows: number;
    baseCols: number;
    baseKeys: ReadonlySet<string>;
    baseKeyView: ReadonlySet<string>;
    playableKeys: Set<string>;
    meteorHoleKeys: Set<string>;
    playableKeyView: ReadonlySet<string>;
    meteorHoleKeyView: ReadonlySet<string>;
    expansionCells: readonly BoardSearchExpansionCell[];
  }): Readonly<Record<string, unknown>> {
    const expansionKeys = new Set(
      input.expansionCells.map((cell) =>
        deps.toBoardCellKey(cell.row, cell.col)
      ),
    );
    const existingKeys = new Set([
      ...input.playableKeys,
      ...input.meteorHoleKeys,
    ]);
    const freezeCoordinates = (keys: ReadonlySet<string>) =>
      Object.freeze(
        sortedCoordinatesFromKeys(keys, deps.toBoardCellKey)
          .map((cell) => Object.freeze({ ...cell })),
      );
    const baseCoordinates = freezeCoordinates(input.baseKeys);
    const expansionCoordinates = freezeCoordinates(expansionKeys);
    const existingCoordinates = freezeCoordinates(existingKeys);
    const playableCoordinates = freezeCoordinates(input.playableKeys);
    const holeCoordinates = freezeCoordinates(input.meteorHoleKeys);
    const baseBounds = {
      minRow: 0,
      maxRow: Math.max(0, input.baseRows - 1),
      minCol: 0,
      maxCol: Math.max(0, input.baseCols - 1),
    };
    const contentBoundsValue = boundsFromCoordinates(
      existingCoordinates,
      input.baseRows,
      input.baseCols,
    );
    const contentBounds = Object.freeze({ ...contentBoundsValue });
    const renderBounds = Object.freeze({
      minRow: Math.min(baseBounds.minRow, contentBounds.minRow),
      maxRow: Math.max(baseBounds.maxRow, contentBounds.maxRow),
      minCol: Math.min(baseBounds.minCol, contentBounds.minCol),
      maxCol: Math.max(baseBounds.maxCol, contentBounds.maxCol),
    });
    const candidateBounds = Object.freeze({
      minRow: contentBounds.minRow - 1,
      maxRow: contentBounds.maxRow + 1,
      minCol: contentBounds.minCol - 1,
      maxCol: contentBounds.maxCol + 1,
    });
    const expansionSideByKey = new Map<string, string | null>();
    for (const cell of input.expansionCells) {
      expansionSideByKey.set(
        deps.toBoardCellKey(cell.row, cell.col),
        typeof cell.side === "string" ? cell.side : null,
      );
    }
    const boundaryEdgesByKey = new Map<
      string,
      Readonly<Record<"top" | "right" | "bottom" | "left", string>>
    >();
    const directions = [
      ["top", -1, 0],
      ["right", 0, 1],
      ["bottom", 1, 0],
      ["left", 0, -1],
    ] as const;
    for (const key of existingKeys) {
      const parsed = parseCanonicalKey(
        key,
        "search topology key",
        deps.toBoardCellKey,
      );
      const currentIsHole = input.meteorHoleKeys.has(key);
      const edges: Record<"top" | "right" | "bottom" | "left", string> = {
        top: "none",
        right: "none",
        bottom: "none",
        left: "none",
      };
      for (const [edge, rowDelta, colDelta] of directions) {
        const neighborKey = deps.toBoardCellKey(
          parsed.row + rowDelta,
          parsed.col + colDelta,
        );
        if (!existingKeys.has(neighborKey)) {
          edges[edge] = "outer";
        } else if (currentIsHole !== input.meteorHoleKeys.has(neighborKey)) {
          edges[edge] = "hole";
        }
      }
      boundaryEdgesByKey.set(key, Object.freeze(edges));
    }

    return Object.freeze({
      baseRows: input.baseRows,
      baseCols: input.baseCols,
      baseKeys: input.baseKeyView,
      expansionKeys: createReadonlySetView(expansionKeys),
      existingKeys: createReadonlySetView(existingKeys),
      playableKeys: input.playableKeyView,
      holeKeys: input.meteorHoleKeyView,
      baseCoordinates,
      expansionCoordinates,
      existingCoordinates,
      playableCoordinates,
      holeCoordinates,
      expansionSideByKey: createReadonlyMapView(expansionSideByKey),
      renderRowOffset: renderBounds.minRow < 0 ? -renderBounds.minRow : 0,
      renderColOffset: renderBounds.minCol < 0 ? -renderBounds.minCol : 0,
      renderRows: renderBounds.maxRow - renderBounds.minRow + 1,
      renderCols: renderBounds.maxCol - renderBounds.minCol + 1,
      boundaryEdgesByKey: createReadonlyMapView(boundaryEdgesByKey),
      contentBounds,
      renderBounds,
      candidateBounds,
    });
  }

  function refreshPublicMatrix(state: BoardSearchInternalState): void {
    state.publicMatrix = createPublicMatrixSnapshot(state.matrix);
  }

  function refreshPublicExpansionState(state: BoardSearchInternalState): void {
    state.publicExpansionCells = Object.freeze(
      state.expansionCells.map((cell) => Object.freeze({ ...cell })),
    );
    state.publicExpansionOwnerByKey = Object.freeze({
      ...state.expansionOwnerByKey,
    });
  }

  function createContextFromParts(
    matrix: number[][],
    staticShape: BoardSearchStaticShape,
    expansionCellsValue: readonly BoardSearchExpansionCell[],
    revision = 0,
  ): BoardSearchContext {
    const expansionCells = expansionCellsValue.map((cell) => ({ ...cell }));
    const expansionOwnerByKey: Record<string, number> = {};
    const expansionCellByKey = new Map<string, BoardSearchExpansionCell>();
    for (const cell of expansionCells) {
      const key = deps.toBoardCellKey(cell.row, cell.col);
      expansionOwnerByKey[key] = cell.owner;
      expansionCellByKey.set(key, cell);
    }
    let state = null as unknown as BoardSearchInternalState;
    const shape = Object.freeze({
      minRow: staticShape.minRow,
      maxRow: staticShape.maxRow,
      minCol: staticShape.minCol,
      maxCol: staticShape.maxCol,
      baseRows: staticShape.baseRows,
      baseCols: staticShape.baseCols,
      baseKeys: staticShape.baseKeyView ||
        createReadonlySetView(staticShape.baseKeys),
      playableKeys: staticShape.playableKeyView ||
        createReadonlySetView(staticShape.playableKeys),
      meteorHoleKeys: staticShape.meteorHoleKeyView ||
        createReadonlySetView(staticShape.meteorHoleKeys),
      coordinates: staticShape.coordinates,
      get expansionCells() {
        return state.publicExpansionCells;
      },
      get expansionOwnerByKey() {
        return state.publicExpansionOwnerByKey;
      },
      standard8x8: staticShape.standard8x8,
      topology: staticShape.topology,
    }) as BoardSearchShape;
    state = {
      matrix,
      publicMatrix: Object.freeze([]),
      playableKeys: staticShape.playableKeys,
      meteorHoleKeys: staticShape.meteorHoleKeys,
      playableKeyView: shape.playableKeys,
      meteorHoleKeyView: shape.meteorHoleKeys,
      coordinates: staticShape.coordinates,
      expansionCells,
      expansionCellByKey,
      expansionOwnerByKey,
      publicExpansionCells: Object.freeze([]),
      publicExpansionOwnerByKey: Object.freeze({}),
      shape,
      revision,
    };
    refreshPublicMatrix(state);
    refreshPublicExpansionState(state);
    const context = Object.freeze({
      kind: BOARD_SEARCH_CONTEXT_KIND,
      get board() {
        return state.publicMatrix;
      },
      shape,
    }) as BoardSearchContext;
    states.set(context, state);
    return context;
  }

  function isBoardSearchContext(value: unknown): value is BoardSearchContext {
    if (!isRecord(value) || value.kind !== BOARD_SEARCH_CONTEXT_KIND) {
      return false;
    }
    const state = states.get(value);
    return !!state &&
      value.board === state.publicMatrix &&
      value.shape === state.shape;
  }

  function requireContext(value: unknown): BoardSearchContext {
    if (!isBoardSearchContext(value)) {
      throw new Error("Board search operation requires a branded context");
    }
    return value;
  }

  function requireState(value: unknown): BoardSearchInternalState {
    const context = requireContext(value);
    const state = states.get(context);
    if (!state) {
      throw new Error("Board search operation requires internal state");
    }
    return state;
  }

  function createBoardContext(
    boardValue: unknown,
    shapeValue: BoardSearchShapeInput,
  ): BoardSearchContext {
    if (
      !Array.isArray(boardValue) ||
      !shapeValue ||
      typeof shapeValue !== "object" ||
      Array.isArray(shapeValue)
    ) {
      throw new Error("Search board requires an explicit matrix and shape");
    }
    const board = boardValue as unknown[];
    if (
      board.length <= 0 ||
      board.length > MAX_SEARCH_MATRIX_DIMENSION
    ) {
      throw new Error("Search board must be a non-empty bounded matrix");
    }
    let matrixWidth: number | null = null;
    for (let rowIndex = 0; rowIndex < board.length; rowIndex += 1) {
      if (!Object.prototype.hasOwnProperty.call(board, rowIndex)) {
        throw new Error(`Search board row ${rowIndex} is missing`);
      }
      const row = board[rowIndex];
      if (
        !Array.isArray(row) ||
        row.length <= 0 ||
        row.length > MAX_SEARCH_MATRIX_DIMENSION
      ) {
        throw new Error(
          `Search board row ${rowIndex} must be a non-empty bounded array`,
        );
      }
      if (matrixWidth === null) {
        matrixWidth = row.length;
      } else if (row.length !== matrixWidth) {
        throw new Error("Search board matrix must be rectangular");
      }
      for (let colIndex = 0; colIndex < row.length; colIndex += 1) {
        if (!Object.prototype.hasOwnProperty.call(row, colIndex)) {
          throw new Error(
            `Search board cell ${rowIndex},${colIndex} is missing`,
          );
        }
        const value = row[colIndex];
        if (!isOwner(value)) {
          throw new Error(
            `Search board cell ${rowIndex},${colIndex} has invalid owner`,
          );
        }
      }
    }
    const matrix = (boardValue as number[][]).map((row) => row.slice());
    const playableKeys = toCanonicalKeySet(
      shapeValue.playableKeys,
      "search playable key",
      deps.toBoardCellKey,
    );
    const meteorHoleKeys = toCanonicalKeySet(
      shapeValue.meteorHoleKeys,
      "search meteor-hole key",
      deps.toBoardCellKey,
    );
    const baseKeys = toCanonicalKeySet(
      shapeValue.baseKeys,
      "search base key",
      deps.toBoardCellKey,
    );
    for (const key of meteorHoleKeys) {
      if (playableKeys.has(key)) {
        throw new Error(
          `Search playable and meteor-hole keys overlap at ${key}`,
        );
      }
    }
    if (playableKeys.size === 0 && meteorHoleKeys.size === 0) {
      throw new Error("Search board requires at least one existing key");
    }
    const coordinates = sortedCoordinatesFromKeys(
      playableKeys,
      deps.toBoardCellKey,
    );

    if (!Array.isArray(shapeValue.expansionCells)) {
      throw new Error("Search expansionCells must be an array");
    }
    if (shapeValue.expansionCells.length > MAX_SEARCH_SHAPE_KEYS) {
      throw new Error("Search expansionCells exceeds the bounded shape size");
    }
    const rawExpansionCells: BoardSearchExpansionCell[] = [];
    const rawExpansionCellByKey = new Map<string, BoardSearchExpansionCell>();
    for (
      let index = 0;
      index < shapeValue.expansionCells.length;
      index += 1
    ) {
        if (
          !Object.prototype.hasOwnProperty.call(
            shapeValue.expansionCells,
            index,
          )
        ) {
          throw new Error(`Search expansion cell ${index} is missing`);
        }
        const cell = shapeValue.expansionCells[index];
        if (
          !cell ||
          !Number.isInteger(cell.row) ||
          !Number.isInteger(cell.col) ||
          Math.abs(cell.row) > DEFAULT_BOARD_MAX_ABS_COORDINATE ||
          Math.abs(cell.col) > DEFAULT_BOARD_MAX_ABS_COORDINATE ||
          !isOwner(cell.owner)
        ) {
          throw new Error(`Search expansion cell ${index} is invalid`);
        }
        const normalized = {
          row: Number(cell.row),
          col: Number(cell.col),
          side: typeof cell.side === "string" ? cell.side : undefined,
          owner: normalizeOwner(cell.owner),
        };
        const key = deps.toBoardCellKey(normalized.row, normalized.col);
        if (rawExpansionCellByKey.has(key)) {
          throw new Error(`Duplicate search expansion cell: ${key}`);
        }
        rawExpansionCells.push(normalized);
        rawExpansionCellByKey.set(key, normalized);
      }

    if (!isRecord(shapeValue.expansionOwnerByKey)) {
      throw new Error("Search expansionOwnerByKey must be an object");
    }
    const rawExpansionOwners = new Map<string, number>();
    let expansionOwnerCount = 0;
    for (const rawKey in shapeValue.expansionOwnerByKey) {
      if (
        !Object.prototype.hasOwnProperty.call(
          shapeValue.expansionOwnerByKey,
          rawKey,
        )
      ) {
        continue;
      }
      expansionOwnerCount += 1;
      if (expansionOwnerCount > MAX_SEARCH_SHAPE_KEYS) {
        throw new Error(
          "Search expansionOwnerByKey exceeds the bounded shape size",
        );
      }
      const rawOwner = shapeValue.expansionOwnerByKey[rawKey];
        const { key } = parseCanonicalKey(
          rawKey,
          "search expansion owner key",
          deps.toBoardCellKey,
        );
        if (!isOwner(rawOwner)) {
          throw new Error(`Search expansion owner ${key} is invalid`);
        }
        rawExpansionOwners.set(key, normalizeOwner(rawOwner));
    }
    if (rawExpansionOwners.size !== rawExpansionCellByKey.size) {
      throw new Error(
        "Search expansion cells and expansionOwnerByKey must have identical keys",
      );
    }
    for (const [key, cell] of rawExpansionCellByKey) {
      if (!rawExpansionOwners.has(key)) {
        throw new Error(`Search expansion owner ${key} is missing`);
      }
      if (rawExpansionOwners.get(key) !== cell.owner) {
        throw new Error(`Search expansion owner ${key} is inconsistent`);
      }
    }

    const playableExpansionCells: BoardSearchExpansionCell[] = [];
    for (const cell of rawExpansionCells) {
      const key = deps.toBoardCellKey(cell.row, cell.col);
      if (playableKeys.has(key)) {
        playableExpansionCells.push(cell);
        continue;
      }
      if (!meteorHoleKeys.has(key)) {
        throw new Error(`Search expansion cell ${key} is not playable`);
      }
    }
    const expansionKeys = new Set(
      playableExpansionCells.map((cell) =>
        deps.toBoardCellKey(cell.row, cell.col)
      ),
    );
    for (const cell of coordinates) {
      const key = deps.toBoardCellKey(cell.row, cell.col);
      if (expansionKeys.has(key)) continue;
      if (
        cell.row < 0 ||
        cell.row >= matrix.length ||
        !Array.isArray(matrix[cell.row]) ||
        cell.col < 0 ||
        cell.col >= matrix[cell.row].length
      ) {
        throw new Error(`Search board owner is missing at ${key}`);
      }
    }

    const readBaseDimension = (
      value: unknown,
      fallback: number,
      name: string,
    ): number => {
      if (value === undefined) return fallback;
      if (
        !Number.isInteger(value) ||
        Number(value) <= 0 ||
        Number(value) > MAX_SEARCH_MATRIX_DIMENSION
      ) {
        throw new Error(`Search board ${name} must be a bounded integer`);
      }
      return Number(value);
    };
    const baseRows = readBaseDimension(
      shapeValue.baseRows,
      matrix.length,
      "baseRows",
    );
    const baseCols = readBaseDimension(
      shapeValue.baseCols,
      Number(matrixWidth),
      "baseCols",
    );
    if (baseRows !== matrix.length || baseCols !== matrixWidth) {
      throw new Error(
        "Search board base dimensions must match the dense matrix",
      );
    }
    const existingKeys = new Set([
      ...playableKeys,
      ...meteorHoleKeys,
    ]);
    for (const key of baseKeys) {
      const { row, col } = parseCanonicalKey(
        key,
        "search base key",
        deps.toBoardCellKey,
      );
      if (rawExpansionCellByKey.has(key)) {
        throw new Error(`Search base and expansion keys overlap at ${key}`);
      }
      if (
        row < 0 ||
        row >= baseRows ||
        col < 0 ||
        col >= baseCols
      ) {
        throw new Error(`Search base key ${key} is outside the dense matrix`);
      }
      if (!existingKeys.has(key)) {
        throw new Error(`Search base key ${key} is not an existing cell`);
      }
    }
    for (const key of playableKeys) {
      if (!rawExpansionCellByKey.has(key) && !baseKeys.has(key)) {
        throw new Error(
          `Search playable key ${key} has no base or expansion authority`,
        );
      }
    }
    const existingCoordinates = sortedCoordinatesFromKeys(
      existingKeys,
      deps.toBoardCellKey,
    );
    const inferredBounds = boundsFromCoordinates(
      existingCoordinates,
      baseRows,
      baseCols,
    );
    const readBound = (
      value: unknown,
      expected: number,
      name: string,
    ): number => {
      if (value === undefined) return expected;
      const parsed = (
        typeof value === "number" &&
        Number.isInteger(value)
      )
        ? value
        : null;
      if (
        parsed === null ||
        Math.abs(parsed) > DEFAULT_BOARD_MAX_ABS_COORDINATE
      ) {
        throw new Error(`Search board ${name} is outside the safe range`);
      }
      if (parsed !== expected) {
        throw new Error(
          `Search board ${name} must exactly match derived topology bounds`,
        );
      }
      return parsed;
    };
    const minRow = readBound(
      shapeValue.minRow,
      inferredBounds.minRow,
      "minRow",
    );
    const maxRow = readBound(
      shapeValue.maxRow,
      inferredBounds.maxRow,
      "maxRow",
    );
    const minCol = readBound(
      shapeValue.minCol,
      inferredBounds.minCol,
      "minCol",
    );
    const maxCol = readBound(
      shapeValue.maxCol,
      inferredBounds.maxCol,
      "maxCol",
    );
    const rowSpan = maxRow - minRow + 1;
    const colSpan = maxCol - minCol + 1;
    const envelopeSpan = Math.max(rowSpan, colSpan);
    if (
      rowSpan <= 0 ||
      colSpan <= 0 ||
      envelopeSpan > MAX_SEARCH_ENVELOPE_SPAN ||
      envelopeSpan * envelopeSpan >
        MAX_SEARCH_ENVELOPE_SPAN * MAX_SEARCH_ENVELOPE_SPAN
    ) {
      throw new Error("Search board envelope exceeds the safe encoding size");
    }
    const coordinatesFrozen = Object.freeze(
      coordinates.map((cell) => Object.freeze({ ...cell })),
    );
    const standard8x8 =
      baseRows === 8 &&
      baseCols === 8 &&
      rawExpansionCells.length === 0 &&
      meteorHoleKeys.size === 0 &&
      baseKeys.size === 64 &&
      playableKeys.size === 64 &&
      minRow === 0 &&
      maxRow === 7 &&
      minCol === 0 &&
      maxCol === 7 &&
      coordinates.every((cell) =>
        cell.row >= 0 &&
        cell.row < 8 &&
        cell.col >= 0 &&
        cell.col < 8
      );
    if (
      shapeValue.standard8x8 !== undefined &&
      shapeValue.standard8x8 !== standard8x8
    ) {
      throw new Error("Search board standard8x8 metadata is inconsistent");
    }
    const playableKeyView = createReadonlySetView(playableKeys);
    const meteorHoleKeyView = createReadonlySetView(meteorHoleKeys);
    const baseKeyView = createReadonlySetView(baseKeys);
    const topology = buildImmutableTopologySnapshot({
      baseRows,
      baseCols,
      baseKeys,
      baseKeyView,
      playableKeys,
      meteorHoleKeys,
      playableKeyView,
      meteorHoleKeyView,
      expansionCells: rawExpansionCells,
    });
    return createContextFromParts(
      matrix,
      {
        minRow,
        maxRow,
        minCol,
        maxCol,
        baseRows,
        baseCols,
        baseKeys,
        baseKeyView,
        playableKeys,
        meteorHoleKeys,
        playableKeyView,
        meteorHoleKeyView,
        coordinates: coordinatesFrozen,
        standard8x8,
        topology,
      },
      rawExpansionCells,
    );
  }

  function cloneBoardContext(value: unknown): BoardSearchContext {
    const context = requireContext(value);
    const state = requireState(context);
    return createContextFromParts(
      state.matrix.map((row) => row.slice()),
      {
        minRow: state.shape.minRow,
        maxRow: state.shape.maxRow,
        minCol: state.shape.minCol,
        maxCol: state.shape.maxCol,
        baseRows: state.shape.baseRows,
        baseCols: state.shape.baseCols,
        baseKeys: state.shape.baseKeys,
        baseKeyView: state.shape.baseKeys,
        playableKeys: state.playableKeys,
        meteorHoleKeys: state.meteorHoleKeys,
        playableKeyView: state.playableKeyView,
        meteorHoleKeyView: state.meteorHoleKeyView,
        coordinates: state.coordinates,
        standard8x8: state.shape.standard8x8,
        topology: state.shape.topology,
      },
      state.expansionCells,
      state.revision,
    );
  }

  function collectBoardCoordinates(value: unknown): BoardSearchCell[] {
    return requireState(value).coordinates.map((cell) => ({ ...cell }));
  }

  function hasPlayableCell(
    value: unknown,
    row: number,
    col: number,
  ): boolean {
    if (!Number.isInteger(row) || !Number.isInteger(col)) return false;
    return requireState(value).playableKeys.has(
      deps.toBoardCellKey(row, col),
    );
  }

  function readCellValue(
    state: BoardSearchInternalState,
    row: number,
    col: number,
  ): number | null {
    const key = deps.toBoardCellKey(row, col);
    if (!state.playableKeys.has(key)) return null;
    if (
      Object.prototype.hasOwnProperty.call(state.expansionOwnerByKey, key)
    ) {
      return state.expansionOwnerByKey[key];
    }
    return state.matrix[row][col];
  }

  function getCellValue(
    value: unknown,
    row: number,
    col: number,
  ): number | null {
    return readCellValue(requireState(value), row, col);
  }

  function setCellValues(value: unknown, updatesValue: unknown): boolean {
    const rawUpdates = copyBoundedOwnArray(updatesValue);
    if (!rawUpdates) return false;
    const state = requireState(value);
    if (rawUpdates.length > state.playableKeys.size) return false;
    const updates: BoardSearchCellUpdate[] = [];
    const seen = new Set<string>();
    for (const raw of rawUpdates) {
      if (
        !isRecord(raw) ||
        !Number.isInteger(raw.row) ||
        !Number.isInteger(raw.col) ||
        !isOwner(raw.value)
      ) {
        return false;
      }
      const row = Number(raw.row);
      const col = Number(raw.col);
      const key = deps.toBoardCellKey(row, col);
      if (seen.has(key) || !state.playableKeys.has(key)) return false;
      if (
        !Object.prototype.hasOwnProperty.call(
          state.expansionOwnerByKey,
          key,
        ) &&
        (
          row < 0 ||
          row >= state.matrix.length ||
          !Array.isArray(state.matrix[row]) ||
          col < 0 ||
          col >= state.matrix[row].length
        )
      ) {
        return false;
      }
      seen.add(key);
      updates.push({ row, col, value: normalizeOwner(raw.value) });
    }
    if (updates.length === 0) return true;
    let expansionChanged = false;
    let matrixChanged = false;
    for (const update of updates) {
      const key = deps.toBoardCellKey(update.row, update.col);
      if (
        Object.prototype.hasOwnProperty.call(
          state.expansionOwnerByKey,
          key,
        )
      ) {
        state.expansionOwnerByKey[key] = update.value;
        const expansionCell = state.expansionCellByKey.get(key);
        if (expansionCell) expansionCell.owner = update.value;
        expansionChanged = true;
      } else {
        state.matrix[update.row][update.col] = update.value;
        matrixChanged = true;
      }
    }
    if (matrixChanged) refreshPublicMatrix(state);
    if (expansionChanged) refreshPublicExpansionState(state);
    state.revision += 1;
    return true;
  }

  function setCellValue(
    value: unknown,
    row: number,
    col: number,
    owner: number,
  ): boolean {
    return setCellValues(value, [{ row, col, value: owner }]);
  }

  function count(value: unknown) {
    const state = requireState(value);
    let black = 0;
    let white = 0;
    let empty = 0;
    for (const cell of state.coordinates) {
      const owner = readCellValue(state, cell.row, cell.col);
      if (owner === deps.black) black += 1;
      else if (owner === deps.white) white += 1;
      else empty += 1;
    }
    return { black, white, empty };
  }

  const legalMoves = createLegalMoves({
    empty: deps.empty,
    directions: deps.directions.map((direction) => Array.from(direction)),
    hasPlayableCell,
    getCellValue,
    collectBoardCoordinates: (value) => (
      requireState(value).coordinates as BoardSearchCell[]
    ),
  });

  function getRevision(value: unknown): number {
    return requireState(value).revision;
  }

  return {
    BOARD_SEARCH_CONTEXT_KIND,
    createBoardContext,
    cloneBoardContext,
    isBoardSearchContext,
    collectBoardCoordinates,
    hasPlayableCell,
    getCellValue,
    setCellValue,
    setCellValues,
    count,
    getFlipsBasic: legalMoves.getFlipsBasic,
    getLegalMovesBasic: legalMoves.getLegalMovesBasic,
    getRevision,
  };
}
