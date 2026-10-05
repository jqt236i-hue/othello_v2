import {
  copyBoundedOwnArray,
  DEFAULT_BOARD_MAX_MATRIX_DIMENSION,
  DEFAULT_BOARD_MAX_SHAPE_ENTRIES,
  isBoardCoordinateWithinLimit,
  resolveBoardMaxAbsCoordinate,
} from "./expansion-descriptors";
import { inspectMultiCellSpecialStoneGroups } from "../multi-cell-stone";
import type { BoardTopology } from "./topology";

export const BOARD_CONTRACT_VERSION = 2;
export const BOARD_DIGEST_VERSION = 1;

export interface CellCoord {
  row: number;
  col: number;
}

export interface ExpansionDescriptor extends CellCoord {
  side: string;
  owner: number;
}

export interface BoardMove extends CellCoord {
  flips: CellCoord[];
}

export interface BoardCellUpdate extends CellCoord {
  value: number;
}

export interface FlipConstraints {
  blockedKeys?: ReadonlySet<string> | readonly string[];
  protectedKeys?: ReadonlySet<string> | readonly string[];
  permanentProtectedKeys?: ReadonlySet<string> | readonly string[];
}

export interface BoardInspection {
  ok: boolean;
  errors: string[];
  warnings: string[];
  expansionCells: ExpansionDescriptor[];
  topology: BoardTopology | null;
}

export interface BoardView {
  topology: BoardTopology;
  boardDigest: string;
  coordinates: readonly CellCoord[];
  expansionCells: readonly ExpansionDescriptor[];
  has: (row: number, col: number) => boolean;
  isPlayable: (row: number, col: number) => boolean;
  get: (row: number, col: number) => number | null;
  count: () => { black: number; white: number; empty: number };
  getFlips: (
    row: number,
    col: number,
    player: number,
    constraints?: FlipConstraints,
  ) => readonly CellCoord[];
  getLegalMoves: (
    player: number,
    constraints?: FlipConstraints,
  ) => readonly BoardMove[];
}

export interface StateKernelDependencies {
  empty: number;
  black: number;
  white: number;
  directions: ReadonlyArray<ReadonlyArray<number>>;
  maxAbsCoordinate?: number;
  toBoardCellKey: (row: number, col: number) => string;
  normalizeOwner: (value: unknown) => number;
  resolveBoardConfig: (value: unknown) => {
    rows: number;
    cols: number;
    shape?: string;
  };
  isMainBoardCell: (
    row: number,
    col: number,
    boardOrConfig: unknown,
  ) => boolean;
  resolveExpansionSide: (
    side: unknown,
    row: number,
    col: number,
    boardOrConfig: unknown,
  ) => string | null;
  collectExpansionDescriptors: (
    boardExpansion: unknown,
    boardOrConfig: unknown,
  ) => ExpansionDescriptor[];
  collectMeteorHoleKeys: (cardState: unknown) => Set<string>;
  buildBoardTopology: (
    boardOrState: unknown,
    options?: unknown,
  ) => BoardTopology;
}

interface ViewCacheEntry {
  cardState: object | null;
  strict: boolean;
  signature: string;
  view: BoardView;
}

export interface BoardMutationCheckpoint {
  gameStateSnapshot: Record<string, unknown>;
  cardStateSnapshot: Record<string, unknown>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function isOwner(value: unknown, empty: number, black: number, white: number): boolean {
  return value === empty || value === black || value === white;
}

function toKeySet(
  value: ReadonlySet<string> | readonly string[] | undefined,
): ReadonlySet<string> {
  if (Array.isArray(value)) {
    const keys = copyBoundedOwnArray<string>(
      value,
      DEFAULT_BOARD_MAX_SHAPE_ENTRIES,
    );
    if (!keys) {
      throw new Error("Flip constraint keys must be a bounded dense array");
    }
    return new Set(keys);
  }
  if (
    value &&
    typeof value === "object" &&
    typeof (value as ReadonlySet<string>).has === "function"
  ) {
    return value as ReadonlySet<string>;
  }
  return new Set();
}

function fnv1a32(value: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

function sortCells<T extends CellCoord>(cells: T[]): T[] {
  return cells.sort((left, right) => left.row - right.row || left.col - right.col);
}

function cloneMutationValue(value: unknown, seen = new Map<object, unknown>()): unknown {
  if (!value || typeof value !== "object") return value;
  const source = value as object;
  if (seen.has(source)) return seen.get(source);
  if (Array.isArray(value)) {
    const out: unknown[] = [];
    seen.set(source, out);
    for (const item of value) out.push(cloneMutationValue(item, seen));
    return out;
  }
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) return value;
  const out: Record<string, unknown> = {};
  seen.set(source, out);
  for (const key of Object.keys(value as Record<string, unknown>)) {
    out[key] = cloneMutationValue(
      (value as Record<string, unknown>)[key],
      seen,
    );
  }
  return out;
}

function restoreRecord(
  target: Record<string, unknown>,
  snapshot: Record<string, unknown>,
): void {
  for (const key of Object.keys(target)) {
    if (!Object.prototype.hasOwnProperty.call(snapshot, key)) delete target[key];
  }
  for (const key of Object.keys(snapshot)) {
    target[key] = cloneMutationValue(snapshot[key]);
  }
}

export function createStateKernel(deps: StateKernelDependencies) {
  const viewCache = new WeakMap<object, ViewCacheEntry>();
  const maxAbsCoordinate = resolveBoardMaxAbsCoordinate(
    deps.maxAbsCoordinate,
  );

  function preflightBoardSources(
    gameState: Record<string, unknown>,
    cardState: unknown,
    strict: boolean,
  ): string[] {
    const errors: string[] = [];
    const board = gameState.board;
    if (
      !Array.isArray(board) ||
      board.length <= 0 ||
      board.length > DEFAULT_BOARD_MAX_MATRIX_DIMENSION
    ) {
      return ["gameState.board must be a non-empty bounded matrix"];
    }
    let width: number | null = null;
    for (let rowIndex = 0; rowIndex < board.length; rowIndex += 1) {
      if (!Object.prototype.hasOwnProperty.call(board, rowIndex)) {
        errors.push(`gameState.board[${rowIndex}] is missing`);
        continue;
      }
      const row = board[rowIndex];
      if (
        !Array.isArray(row) ||
        row.length <= 0 ||
        row.length > DEFAULT_BOARD_MAX_MATRIX_DIMENSION
      ) {
        errors.push(
          `gameState.board[${rowIndex}] must be a non-empty bounded array`,
        );
        continue;
      }
      if (width === null) width = row.length;
      else if (row.length !== width) {
        errors.push("gameState.board must be rectangular");
      }
      for (let colIndex = 0; colIndex < row.length; colIndex += 1) {
        if (!Object.prototype.hasOwnProperty.call(row, colIndex)) {
          errors.push(`gameState.board cell ${rowIndex},${colIndex} is missing`);
          continue;
        }
        if (!isOwner(row[colIndex], deps.empty, deps.black, deps.white)) {
          errors.push(
            `gameState.board cell ${rowIndex},${colIndex} has invalid owner`,
          );
        }
      }
    }
    if (width !== null) {
      const config = deps.resolveBoardConfig(gameState);
      if (config.rows !== board.length || config.cols !== width) {
        errors.push(
          "gameState.board dimensions must exactly match boardConfig",
        );
      }
    }
    const hasExpansion = Object.prototype.hasOwnProperty.call(
      gameState,
      "boardExpansion",
    );
    if (
      strict &&
      hasExpansion &&
      gameState.boardExpansion != null &&
      !isRecord(gameState.boardExpansion)
    ) {
      errors.push("gameState.boardExpansion must be an object");
    }
    const expansion = isRecord(gameState.boardExpansion)
      ? gameState.boardExpansion
      : null;
    if (
      expansion &&
      Object.prototype.hasOwnProperty.call(expansion, "cells") &&
      Array.isArray(expansion.cells) &&
      !copyBoundedOwnArray(
        expansion.cells,
        DEFAULT_BOARD_MAX_SHAPE_ENTRIES,
      )
    ) {
      errors.push("boardExpansion.cells must be a bounded dense array");
    }
    const hasMarkers = isRecord(cardState) &&
      Object.prototype.hasOwnProperty.call(cardState, "markers");
    if (strict && hasMarkers && !Array.isArray(cardState.markers)) {
      errors.push("cardState.markers must be an array");
    }
    const markers = isRecord(cardState) && Array.isArray(cardState.markers)
      ? cardState.markers
      : null;
    if (
      markers &&
      !copyBoundedOwnArray(markers, DEFAULT_BOARD_MAX_SHAPE_ENTRIES)
    ) {
      errors.push("cardState.markers must be a bounded dense array");
    }
    if (strict && markers) {
      const boundedMarkers = copyBoundedOwnArray(
        markers,
        DEFAULT_BOARD_MAX_SHAPE_ENTRIES,
      );
      if (boundedMarkers) {
        for (let index = 0; index < boundedMarkers.length; index += 1) {
          const marker = boundedMarkers[index];
          if (
            !isRecord(marker) ||
            marker.kind !== "specialStone" ||
            !isRecord(marker.data) ||
            String(marker.data.type || "").toUpperCase() !== "METEOR_HOLE"
          ) {
            continue;
          }
          if (!Number.isInteger(marker.row) || !Number.isInteger(marker.col)) {
            errors.push(
              `cardState.markers[${index}] METEOR_HOLE needs exact integer row/col`,
            );
          }
        }
      }
    }
    return errors;
  }

  function collectBoundedMeteorHoleKeys(
    cardState: unknown,
    strict: boolean,
    errors: string[],
    warnings: string[],
  ): Set<string> {
    const out = new Set<string>();
    let sourceKeys: Set<string>;
    try {
      sourceKeys = deps.collectMeteorHoleKeys(cardState);
    } catch (error) {
      const message = `METEOR_HOLE collection failed: ${
        error instanceof Error ? error.message : String(error)
      }`;
      if (strict) errors.push(message);
      else warnings.push(message);
      return out;
    }
    if (sourceKeys.size > DEFAULT_BOARD_MAX_SHAPE_ENTRIES) {
      const message = "METEOR_HOLE entries exceed the bounded shape size";
      if (strict) errors.push(message);
      else warnings.push(message);
      return out;
    }
    for (const key of sourceKeys) {
      const parts = key.split(",");
      const row = parts.length === 2 ? Number(parts[0]) : NaN;
      const col = parts.length === 2 ? Number(parts[1]) : NaN;
      if (!isBoardCoordinateWithinLimit(row, col, maxAbsCoordinate)) {
        const message = `METEOR_HOLE coordinate ${key} exceeds coordinate limit`;
        if (strict) errors.push(message);
        else warnings.push(`${message} and was ignored`);
        continue;
      }
      out.add(deps.toBoardCellKey(row, col));
    }
    return out;
  }

  function parseExpansionCells(
    gameState: Record<string, unknown>,
    strict: boolean,
    errors: string[],
    warnings: string[],
  ): ExpansionDescriptor[] {
    const boardExpansion = isRecord(gameState.boardExpansion)
      ? gameState.boardExpansion
      : null;
    if (!boardExpansion) return [];
    const hasCells = Object.prototype.hasOwnProperty.call(boardExpansion, "cells");
    if (hasCells && !Array.isArray(boardExpansion.cells)) {
      errors.push("boardExpansion.cells must be an array");
      return [];
    }
    if (!hasCells) {
      if (boardExpansion.active === true) {
        warnings.push("legacy boardExpansion fields were normalized");
        return deps
          .collectExpansionDescriptors(boardExpansion, gameState)
          .map((cell) => ({
            row: cell.row,
            col: cell.col,
            side:
              deps.resolveExpansionSide(
                cell.side,
                cell.row,
                cell.col,
                gameState,
              ) || "top",
            owner: deps.normalizeOwner(cell.owner),
          }));
      }
      return [];
    }

    const rawCells = copyBoundedOwnArray(
      boardExpansion.cells,
      DEFAULT_BOARD_MAX_SHAPE_ENTRIES,
    );
    if (!rawCells) {
      errors.push("boardExpansion.cells must be a bounded dense array");
      return [];
    }
    const out: ExpansionDescriptor[] = [];
    const seen = new Set<string>();
    for (let index = 0; index < rawCells.length; index += 1) {
      const raw = rawCells[index];
      if (!isRecord(raw)) {
        errors.push(`boardExpansion.cells[${index}] must be an object`);
        continue;
      }
      let row = strict && !Number.isInteger(raw.row)
        ? NaN
        : Number(raw.row);
      let col = strict && !Number.isInteger(raw.col)
        ? NaN
        : Number(raw.col);
      if (!Number.isInteger(row) || !Number.isInteger(col)) {
        const legacyCell = !strict
          ? deps.collectExpansionDescriptors({ cells: [raw] }, gameState)[0]
          : null;
        if (!legacyCell) {
          errors.push(`boardExpansion.cells[${index}] needs integer row/col`);
          continue;
        }
        row = legacyCell.row;
        col = legacyCell.col;
        warnings.push(
          `boardExpansion.cells[${index}] legacy coordinate was normalized`,
        );
      }
      if (Math.abs(row) > maxAbsCoordinate || Math.abs(col) > maxAbsCoordinate) {
        errors.push(`boardExpansion.cells[${index}] exceeds coordinate limit`);
        continue;
      }
      const key = deps.toBoardCellKey(row, col);
      if (seen.has(key)) {
        if (strict) errors.push(`duplicate expansion coordinate ${key}`);
        else warnings.push(`duplicate expansion coordinate ${key} was ignored`);
        continue;
      }
      seen.add(key);
      if (deps.isMainBoardCell(row, col, gameState)) {
        if (strict) {
          errors.push(`expansion coordinate ${key} overlaps a base playable cell`);
        } else {
          warnings.push(
            `expansion coordinate ${key} overlapping a base playable cell was ignored`,
          );
        }
        continue;
      }
      if (!isOwner(raw.owner, deps.empty, deps.black, deps.white)) {
        if (strict) {
          errors.push(`boardExpansion.cells[${index}] has invalid owner`);
          continue;
        }
        warnings.push(`boardExpansion.cells[${index}] owner was normalized`);
      }
      out.push({
        row,
        col,
        side:
          deps.resolveExpansionSide(raw.side, row, col, gameState) || "top",
        owner: deps.normalizeOwner(raw.owner),
      });
    }
    return sortCells(out);
  }

  function inspectBoardState(
    gameStateValue: unknown,
    cardState: unknown,
    options?: { strict?: boolean },
  ): BoardInspection {
    const strict = options?.strict !== false;
    const errors: string[] = [];
    const warnings: string[] = [];
    if (!isRecord(gameStateValue)) {
      return {
        ok: false,
        errors: ["gameState must be an object"],
        warnings,
        expansionCells: [],
        topology: null,
      };
    }
    const gameState = gameStateValue;
    errors.push(...preflightBoardSources(gameState, cardState, strict));
    if (errors.length > 0) {
      return {
        ok: false,
        errors,
        warnings,
        expansionCells: [],
        topology: null,
      };
    }
    collectBoundedMeteorHoleKeys(
      cardState,
      strict,
      errors,
      warnings,
    );

    const expansionCells = parseExpansionCells(
      gameState,
      strict,
      errors,
      warnings,
    );
    const canonicalState = {
      ...gameState,
      boardExpansion: {
        ...(isRecord(gameState.boardExpansion) ? gameState.boardExpansion : {}),
        cells: expansionCells,
      },
    };
    let topology: BoardTopology | null = null;
    try {
      topology = deps.buildBoardTopology(canonicalState, { cardState });
    } catch (error) {
      errors.push(
        `board topology build failed: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
    if (topology) {
      const expansionByKey = new Map(
        expansionCells.map((cell) => [
          deps.toBoardCellKey(cell.row, cell.col),
          cell,
        ]),
      );
      for (const cell of topology.baseCoordinates) {
        const row = (gameState.board as unknown[])[cell.row];
        const value = Array.isArray(row) ? row[cell.col] : undefined;
        if (!isOwner(value, deps.empty, deps.black, deps.white)) {
          errors.push(`base cell ${cell.row},${cell.col} has invalid owner`);
        }
      }
      for (const key of topology.holeKeys) {
        const expansion = expansionByKey.get(key);
        if (strict && expansion && expansion.owner !== deps.empty) {
          errors.push(`hole expansion cell ${key} must be empty`);
        }
      }
      if (strict) {
        errors.push(...inspectMultiCellSpecialStoneGroups(cardState, {
          black: deps.black,
          white: deps.white,
          hasPlayableCell: (row, col) => (
            topology!.playableKeys.has(deps.toBoardCellKey(row, col))
          ),
          getCellOwner: (row, col) => {
            const key = deps.toBoardCellKey(row, col);
            const expansion = expansionByKey.get(key);
            if (expansion) return expansion.owner;
            const boardRow = (gameState.board as unknown[])[row];
            return Array.isArray(boardRow) ? boardRow[col] : undefined;
          },
        }));
      }
    }
    return {
      ok: errors.length === 0,
      errors,
      warnings,
      expansionCells,
      topology,
    };
  }

  function buildSourceSignature(
    gameState: Record<string, unknown>,
    cardState: unknown,
  ): { cacheable: boolean; signature: string } {
    const config = deps.resolveBoardConfig(gameState);
    const board = Array.isArray(gameState.board) ? gameState.board : [];
    // The signature is compared only for equality against this process's
    // cache. Encode each cell as a compact token (owner number or "x" for an
    // invalid value) instead of serializing one object per cell.
    const rowTokens: string[] = [];
    for (let rowIndex = 0; rowIndex < board.length; rowIndex += 1) {
      const row = board[rowIndex];
      if (!Array.isArray(row)) {
        rowTokens.push("~");
        continue;
      }
      let rowToken = "";
      for (let colIndex = 0; colIndex < row.length; colIndex += 1) {
        const value = row[colIndex];
        rowToken += isOwner(value, deps.empty, deps.black, deps.white)
          ? `${value as number},`
          : "x,";
      }
      rowTokens.push(rowToken);
    }
    const signatureErrors: string[] = [];
    const expansion = parseExpansionCells(
      gameState,
      false,
      signatureErrors,
      [],
    );
    const holes = Array.from(
      collectBoundedMeteorHoleKeys(cardState, false, [], []),
    ).sort();
    return {
      cacheable: signatureErrors.length === 0,
      signature: JSON.stringify([
        config.rows,
        config.cols,
        typeof config.shape === "string" ? config.shape : null,
        expansion.map((cell) => [
          cell.row,
          cell.col,
          cell.side,
          cell.owner,
        ]),
        holes,
      ]) + "|" + rowTokens.join("|"),
    };
  }

  function buildDigest(
    gameState: Record<string, unknown>,
    topology: BoardTopology,
    expansionCells: readonly ExpansionDescriptor[],
    ownerByKey: ReadonlyMap<string, number>,
  ): string {
    const config = deps.resolveBoardConfig(gameState);
    const expansionKeys = new Set(
      expansionCells.map((cell) => deps.toBoardCellKey(cell.row, cell.col)),
    );
    const records = topology.existingCoordinates.map((cell) => {
      const key = deps.toBoardCellKey(cell.row, cell.col);
      const origin = topology.holeKeys.has(key)
        ? "hole"
        : expansionKeys.has(key)
          ? "expansion"
          : "base";
      const owner = topology.holeKeys.has(key)
        ? "x"
        : String(ownerByKey.get(key) ?? deps.empty);
      return `${cell.row},${cell.col},${origin},${owner}`;
    });
    const canonical = [
      `contract=${BOARD_CONTRACT_VERSION}`,
      `digest=${BOARD_DIGEST_VERSION}`,
      `shape=${String(config.shape || "rectangle")}`,
      `rows=${config.rows}`,
      `cols=${config.cols}`,
      ...records,
    ].join("|");
    return `board.v${BOARD_DIGEST_VERSION}.${fnv1a32(canonical)}`;
  }

  function createBoardView(
    gameStateValue: unknown,
    options: { cardState: unknown; strict?: boolean },
  ): BoardView {
    if (!options || !Object.prototype.hasOwnProperty.call(options, "cardState")) {
      throw new Error("BoardView requires an explicit cardState source");
    }
    if (!isRecord(gameStateValue)) {
      throw new Error("BoardView requires a gameState object");
    }
    const gameState = gameStateValue;
    const strict = options.strict !== false;
    const preflightErrors = preflightBoardSources(
      gameState,
      options.cardState,
      strict,
    );
    if (preflightErrors.length > 0) {
      throw new Error(`Invalid board state: ${preflightErrors.join("; ")}`);
    }
    const sourceSignature = buildSourceSignature(gameState, options.cardState);
    const cardStateKey = isRecord(options.cardState) ? options.cardState : null;
    const cached = viewCache.get(gameState);
    if (
      !strict &&
      sourceSignature.cacheable &&
      cached &&
      cached.cardState === cardStateKey &&
      cached.strict === false &&
      cached.signature === sourceSignature.signature
    ) {
      return cached.view;
    }

    const inspection = inspectBoardState(gameState, options.cardState, {
      strict,
    });
    if (!inspection.ok || !inspection.topology) {
      throw new Error(`Invalid board state: ${inspection.errors.join("; ")}`);
    }
    const topology = inspection.topology;
    const expansionByKey = new Map(
      inspection.expansionCells.map((cell) => [
        deps.toBoardCellKey(cell.row, cell.col),
        cell.owner,
      ]),
    );
    const ownerByKey = new Map<string, number>();
    for (const cell of topology.playableCoordinates) {
      const key = deps.toBoardCellKey(cell.row, cell.col);
      if (topology.expansionKeys.has(key)) {
        const owner = expansionByKey.get(key);
        if (owner === undefined) {
          throw new Error(`Missing expansion owner at ${key}`);
        }
        ownerByKey.set(key, owner);
        continue;
      }
      const row = (gameState.board as unknown[])[cell.row];
      const value = Array.isArray(row) ? row[cell.col] : undefined;
      if (!isOwner(value, deps.empty, deps.black, deps.white)) {
        throw new Error(`Missing base owner at ${key}`);
      }
      ownerByKey.set(key, value as number);
    }

    const coordinates = Object.freeze(
      topology.playableCoordinates.map((cell) =>
        Object.freeze({ row: cell.row, col: cell.col }),
      ),
    );
    const expansionCells = Object.freeze(
      inspection.expansionCells.map((cell) =>
        Object.freeze({ ...cell }),
      ),
    );
    const get = (row: number, col: number): number | null => {
      const key = deps.toBoardCellKey(row, col);
      return topology.playableKeys.has(key)
        ? (ownerByKey.get(key) ?? null)
        : null;
    };
    const getFlips = (
      row: number,
      col: number,
      player: number,
      constraints?: FlipConstraints,
    ): readonly CellCoord[] => {
      const startKey = deps.toBoardCellKey(row, col);
      const blocked = toKeySet(constraints?.blockedKeys);
      const protectedKeys = toKeySet(constraints?.protectedKeys);
      const permanentProtected = toKeySet(
        constraints?.permanentProtectedKeys,
      );
      if (
        !topology.playableKeys.has(startKey) ||
        get(row, col) !== deps.empty ||
        blocked.has(startKey)
      ) {
        return [];
      }
      const flips: CellCoord[] = [];
      for (const direction of deps.directions) {
        const line: CellCoord[] = [];
        let currentRow = row + direction[0];
        let currentCol = col + direction[1];
        let key = deps.toBoardCellKey(currentRow, currentCol);
        while (
          topology.playableKeys.has(key) &&
          get(currentRow, currentCol) === -player
        ) {
          if (
            blocked.has(key) ||
            protectedKeys.has(key) ||
            permanentProtected.has(key)
          ) {
            line.length = 0;
            break;
          }
          line.push({ row: currentRow, col: currentCol });
          currentRow += direction[0];
          currentCol += direction[1];
          key = deps.toBoardCellKey(currentRow, currentCol);
        }
        if (
          line.length > 0 &&
          !blocked.has(key) &&
          topology.playableKeys.has(key) &&
          get(currentRow, currentCol) === player
        ) {
          flips.push(...line);
        }
      }
      return flips;
    };
    const getLegalMoves = (
      player: number,
      constraints?: FlipConstraints,
    ): readonly BoardMove[] => {
      const moves: BoardMove[] = [];
      for (const cell of coordinates) {
        const flips = getFlips(cell.row, cell.col, player, constraints);
        if (flips.length > 0) {
          moves.push({
            row: cell.row,
            col: cell.col,
            flips: flips.map((one) => ({ ...one })),
          });
        }
      }
      return moves;
    };
    const count = () => {
      let black = 0;
      let white = 0;
      let empty = 0;
      for (const value of ownerByKey.values()) {
        if (value === deps.black) black += 1;
        else if (value === deps.white) white += 1;
        else empty += 1;
      }
      return { black, white, empty };
    };
    const view: BoardView = Object.freeze({
      topology,
      boardDigest: buildDigest(
        gameState,
        topology,
        inspection.expansionCells,
        ownerByKey,
      ),
      coordinates,
      expansionCells,
      has: (row: number, col: number) =>
        topology.existingKeys.has(deps.toBoardCellKey(row, col)),
      isPlayable: (row: number, col: number) =>
        topology.playableKeys.has(deps.toBoardCellKey(row, col)),
      get,
      count,
      getFlips,
      getLegalMoves,
    });
    if (!strict && sourceSignature.cacheable) {
      viewCache.set(gameState, {
        cardState: cardStateKey,
        strict,
        signature: sourceSignature.signature,
        view,
      });
    }
    return view;
  }

  function createDenseBoardView(board: unknown): BoardView {
    if (!Array.isArray(board)) {
      throw new Error("Dense board must be an array");
    }
    return createBoardView(
      {
        board,
        boardConfig: {
          rows: board.length,
          cols: Array.isArray(board[0]) ? board[0].length : 0,
          shape: "rectangle",
        },
        boardExpansion: { cells: [] },
      },
      { cardState: { markers: [] }, strict: true },
    );
  }

  function syncLegacyExpansionFields(
    gameState: Record<string, unknown>,
    cells: readonly ExpansionDescriptor[],
  ): void {
    const expansion = isRecord(gameState.boardExpansion)
      ? gameState.boardExpansion
      : {};
    gameState.boardExpansion = expansion;
    const latest = cells.length > 0 ? cells[cells.length - 1] : null;
    expansion.active = latest !== null;
    expansion.side = latest ? latest.side : null;
    expansion.row = latest ? latest.row : null;
    expansion.col = latest ? latest.col : null;
    expansion.owner = latest ? latest.owner : deps.empty;
  }

  function canonicalizeStateBoard(
    gameStateValue: unknown,
    cardState: unknown,
    options?: { strict?: boolean },
  ): BoardInspection {
    const inspection = inspectBoardState(gameStateValue, cardState, options);
    if (!inspection.ok || !isRecord(gameStateValue)) return inspection;
    const gameState = gameStateValue;
    const expansion = isRecord(gameState.boardExpansion)
      ? gameState.boardExpansion
      : {};
    gameState.boardExpansion = expansion;
    expansion.cells = inspection.expansionCells.map((cell) => ({ ...cell }));
    syncLegacyExpansionFields(gameState, inspection.expansionCells);
    viewCache.delete(gameState);
    return inspection;
  }

  function getStateCellValue(
    gameState: unknown,
    row: number,
    col: number,
    cardState: unknown,
  ): number | null {
    return createBoardView(gameState, { cardState, strict: false }).get(row, col);
  }

  function setStateCellValue(
    gameStateValue: unknown,
    row: number,
    col: number,
    value: unknown,
    cardState: unknown,
  ): boolean {
    if (
      !isRecord(gameStateValue) ||
      !isOwner(value, deps.empty, deps.black, deps.white)
    ) {
      return false;
    }
    const gameState = gameStateValue;
    const view = createBoardView(gameState, { cardState, strict: false });
    const key = deps.toBoardCellKey(row, col);
    if (!view.topology.playableKeys.has(key)) return false;
    if (view.topology.expansionKeys.has(key)) {
      const normalized = canonicalizeStateBoard(gameState, cardState, {
        strict: false,
      });
      if (!normalized.ok || !isRecord(gameState.boardExpansion)) return false;
      const cells = gameState.boardExpansion.cells as Record<string, unknown>[];
      const cell = cells.find(
        (one) => Number(one.row) === row && Number(one.col) === col,
      );
      if (!cell) return false;
      cell.owner = deps.normalizeOwner(value);
      syncLegacyExpansionFields(
        gameState,
        cells.map((one) => ({
          row: Number(one.row),
          col: Number(one.col),
          side: String(one.side || "top"),
          owner: deps.normalizeOwner(one.owner),
        })),
      );
      viewCache.delete(gameState);
      return true;
    }
    if (
      !Array.isArray(gameState.board) ||
      !Array.isArray(gameState.board[row]) ||
      col < 0 ||
      col >= gameState.board[row].length
    ) {
      return false;
    }
    gameState.board[row][col] = deps.normalizeOwner(value);
    viewCache.delete(gameState);
    return true;
  }

  function setStateCellValues(
    gameStateValue: unknown,
    updatesValue: unknown,
    cardState: unknown,
  ): boolean {
    const rawUpdates = copyBoundedOwnArray(
      updatesValue,
      DEFAULT_BOARD_MAX_SHAPE_ENTRIES,
    );
    if (!isRecord(gameStateValue) || !rawUpdates) {
      return false;
    }
    const gameState = gameStateValue;
    const view = createBoardView(gameState, { cardState, strict: false });
    const updates: BoardCellUpdate[] = [];
    const seen = new Set<string>();
    let hasExpansionUpdate = false;
    if (rawUpdates.length > view.topology.playableKeys.size) return false;
    for (const raw of rawUpdates) {
      if (
        !isRecord(raw) ||
        !Number.isInteger(raw.row) ||
        !Number.isInteger(raw.col) ||
        !isOwner(raw.value, deps.empty, deps.black, deps.white)
      ) {
        return false;
      }
      const row = Number(raw.row);
      const col = Number(raw.col);
      const key = deps.toBoardCellKey(row, col);
      if (seen.has(key) || !view.topology.playableKeys.has(key)) return false;
      seen.add(key);
      hasExpansionUpdate ||= view.topology.expansionKeys.has(key);
      updates.push({
        row,
        col,
        value: deps.normalizeOwner(raw.value),
      });
    }
    if (updates.length === 0) return true;

    let expansionCells: Record<string, unknown>[] = [];
    let expansionByKey = new Map<string, Record<string, unknown>>();
    if (hasExpansionUpdate) {
      const normalized = canonicalizeStateBoard(gameState, cardState, {
        strict: false,
      });
      if (
        !normalized.ok ||
        !isRecord(gameState.boardExpansion) ||
        !Array.isArray(gameState.boardExpansion.cells)
      ) {
        return false;
      }
      expansionCells = gameState.boardExpansion.cells as Record<string, unknown>[];
      expansionByKey = new Map(
        expansionCells.map((cell) => [
          deps.toBoardCellKey(Number(cell.row), Number(cell.col)),
          cell,
        ]),
      );
    }

    const baseTargets: Array<{ row: unknown[]; col: number; value: number }> = [];
    const expansionTargets: Array<{ cell: Record<string, unknown>; value: number }> = [];
    for (const update of updates) {
      const key = deps.toBoardCellKey(update.row, update.col);
      if (view.topology.expansionKeys.has(key)) {
        const cell = expansionByKey.get(key);
        if (!cell) return false;
        expansionTargets.push({ cell, value: update.value });
        continue;
      }
      const row = Array.isArray(gameState.board)
        ? gameState.board[update.row]
        : null;
      if (!Array.isArray(row) || update.col < 0 || update.col >= row.length) {
        return false;
      }
      baseTargets.push({ row, col: update.col, value: update.value });
    }

    for (const target of baseTargets) target.row[target.col] = target.value;
    for (const target of expansionTargets) target.cell.owner = target.value;
    if (expansionTargets.length > 0) {
      syncLegacyExpansionFields(
        gameState,
        expansionCells.map((cell) => ({
          row: Number(cell.row),
          col: Number(cell.col),
          side: String(cell.side || "top"),
          owner: deps.normalizeOwner(cell.owner),
        })),
      );
    }
    viewCache.delete(gameState);
    return true;
  }

  function addStateExpansionCells(
    gameStateValue: unknown,
    additions: unknown[],
    cardState: unknown,
  ): { added: boolean; reason?: string; cells?: ExpansionDescriptor[] } {
    const rawAdditions = copyBoundedOwnArray(
      additions,
      DEFAULT_BOARD_MAX_SHAPE_ENTRIES,
    );
    if (!isRecord(gameStateValue) || !rawAdditions) {
      return { added: false, reason: "invalid_args" };
    }
    const gameState = gameStateValue;
    const inspection = inspectBoardState(gameState, cardState, { strict: false });
    if (!inspection.ok || !inspection.topology) {
      return { added: false, reason: "invalid_state" };
    }
    if (
      inspection.expansionCells.length + rawAdditions.length >
      DEFAULT_BOARD_MAX_SHAPE_ENTRIES
    ) {
      return { added: false, reason: "shape_limit_exceeded" };
    }
    const existing = inspection.topology.existingKeys;
    const additionKeys = new Set<string>();
    const canonicalAdditions: ExpansionDescriptor[] = [];
    for (const raw of rawAdditions) {
      if (
        !isRecord(raw) ||
        !Number.isInteger(raw.row) ||
        !Number.isInteger(raw.col) ||
        !isBoardCoordinateWithinLimit(
          Number(raw.row),
          Number(raw.col),
          maxAbsCoordinate,
        ) ||
        !isOwner(raw.owner, deps.empty, deps.black, deps.white) ||
        deps.isMainBoardCell(Number(raw.row), Number(raw.col), gameState)
      ) {
        return { added: false, reason: "invalid_addition" };
      }
      const cell: ExpansionDescriptor = {
        row: Number(raw.row),
        col: Number(raw.col),
        side:
          deps.resolveExpansionSide(
            raw.side,
            Number(raw.row),
            Number(raw.col),
            gameState,
          ) || "top",
        owner: Number(raw.owner),
      };
      const key = deps.toBoardCellKey(cell.row, cell.col);
      if (existing.has(key) || additionKeys.has(key)) {
        return { added: false, reason: "coordinate_conflict" };
      }
      additionKeys.add(key);
      canonicalAdditions.push(cell);
    }
    const cells = sortCells([
      ...inspection.expansionCells.map((cell) => ({ ...cell })),
      ...canonicalAdditions,
    ]);
    const expansion = isRecord(gameState.boardExpansion)
      ? gameState.boardExpansion
      : {};
    gameState.boardExpansion = expansion;
    expansion.cells = cells.map((cell) => ({ ...cell }));
    syncLegacyExpansionFields(gameState, cells);
    viewCache.delete(gameState);
    return { added: true, cells };
  }

  function countStateDiscs(
    gameState: unknown,
    cardState: unknown,
  ): { black: number; white: number } {
    const counts = createBoardView(gameState, {
      cardState,
      strict: false,
    }).count();
    return { black: counts.black, white: counts.white };
  }

  function createBoardMutationCheckpoint(
    gameState: unknown,
    cardState: unknown,
  ): BoardMutationCheckpoint {
    if (!isRecord(gameState) || !isRecord(cardState)) {
      throw new Error("Board mutation checkpoint requires gameState and cardState");
    }
    return {
      gameStateSnapshot: cloneMutationValue(gameState) as Record<string, unknown>,
      cardStateSnapshot: cloneMutationValue(cardState) as Record<string, unknown>,
    };
  }

  function restoreBoardMutationCheckpoint(
    gameState: unknown,
    cardState: unknown,
    checkpoint: BoardMutationCheckpoint,
  ): boolean {
    if (
      !isRecord(gameState) ||
      !isRecord(cardState) ||
      !checkpoint ||
      !isRecord(checkpoint.gameStateSnapshot) ||
      !isRecord(checkpoint.cardStateSnapshot)
    ) {
      return false;
    }
    restoreRecord(gameState, checkpoint.gameStateSnapshot);
    restoreRecord(cardState, checkpoint.cardStateSnapshot);
    viewCache.delete(gameState);
    return true;
  }

  return {
    BOARD_CONTRACT_VERSION,
    BOARD_DIGEST_VERSION,
    inspectBoardState,
    createBoardView,
    createDenseBoardView,
    canonicalizeStateBoard,
    getStateCellValue,
    setStateCellValue,
    setStateCellValues,
    addStateExpansionCells,
    countStateDiscs,
    createBoardMutationCheckpoint,
    restoreBoardMutationCheckpoint,
  };
}
