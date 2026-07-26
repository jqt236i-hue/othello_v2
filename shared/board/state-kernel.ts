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
  signature: string;
  view: BoardView;
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
  if (value instanceof Set) return value;
  return new Set(Array.isArray(value) ? value : []);
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

export function createStateKernel(deps: StateKernelDependencies) {
  const viewCache = new WeakMap<object, ViewCacheEntry>();
  const maxAbsCoordinate = Number.isFinite(Number(deps.maxAbsCoordinate))
    ? Math.max(16, Math.trunc(Number(deps.maxAbsCoordinate)))
    : 256;

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

    const out: ExpansionDescriptor[] = [];
    const seen = new Set<string>();
    for (let index = 0; index < (boardExpansion.cells as unknown[]).length; index += 1) {
      const raw = (boardExpansion.cells as unknown[])[index];
      if (!isRecord(raw)) {
        errors.push(`boardExpansion.cells[${index}] must be an object`);
        continue;
      }
      const row = Number(raw.row);
      const col = Number(raw.col);
      if (!Number.isInteger(row) || !Number.isInteger(col)) {
        errors.push(`boardExpansion.cells[${index}] needs integer row/col`);
        continue;
      }
      if (Math.abs(row) > maxAbsCoordinate || Math.abs(col) > maxAbsCoordinate) {
        errors.push(`boardExpansion.cells[${index}] exceeds coordinate limit`);
        continue;
      }
      const key = deps.toBoardCellKey(row, col);
      if (seen.has(key)) {
        errors.push(`duplicate expansion coordinate ${key}`);
        continue;
      }
      seen.add(key);
      if (deps.isMainBoardCell(row, col, gameState)) {
        errors.push(`expansion coordinate ${key} overlaps a base playable cell`);
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
    if (!Array.isArray(gameState.board)) {
      return {
        ok: false,
        errors: ["gameState.board must be an array"],
        warnings,
        expansionCells: [],
        topology: null,
      };
    }
    for (let row = 0; row < gameState.board.length; row += 1) {
      if (!Array.isArray(gameState.board[row])) {
        errors.push(`gameState.board[${row}] must be an array`);
      }
    }

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
  ): string {
    const config = deps.resolveBoardConfig(gameState);
    const board = Array.isArray(gameState.board) ? gameState.board : [];
    const boardValues = board.map((row) =>
      Array.isArray(row) ? row.map((value) => deps.normalizeOwner(value)) : null,
    );
    const expansion = parseExpansionCells(gameState, false, [], []);
    const holes = Array.from(deps.collectMeteorHoleKeys(cardState)).sort();
    return JSON.stringify({
      config: {
        rows: config.rows,
        cols: config.cols,
        shape: typeof config.shape === "string" ? config.shape : null,
      },
      board: boardValues,
      expansion: expansion.map((cell) => [cell.row, cell.col, cell.owner]),
      holes,
    });
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
    const signature = buildSourceSignature(gameState, options.cardState);
    const cardStateKey = isRecord(options.cardState) ? options.cardState : null;
    const cached = viewCache.get(gameState);
    if (
      cached &&
      cached.cardState === cardStateKey &&
      cached.signature === signature
    ) {
      return cached.view;
    }

    const inspection = inspectBoardState(gameState, options.cardState, {
      strict: options.strict,
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
    viewCache.set(gameState, { cardState: cardStateKey, signature, view });
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

  function addStateExpansionCells(
    gameStateValue: unknown,
    additions: unknown[],
    cardState: unknown,
  ): { added: boolean; reason?: string; cells?: ExpansionDescriptor[] } {
    if (!isRecord(gameStateValue) || !Array.isArray(additions)) {
      return { added: false, reason: "invalid_args" };
    }
    const gameState = gameStateValue;
    const inspection = inspectBoardState(gameState, cardState, { strict: false });
    if (!inspection.ok || !inspection.topology) {
      return { added: false, reason: "invalid_state" };
    }
    const candidateExpansion = {
      cells: additions,
    };
    const normalized = deps.collectExpansionDescriptors(
      candidateExpansion,
      gameState,
    );
    if (normalized.length !== additions.length) {
      return { added: false, reason: "invalid_addition" };
    }
    const existing = inspection.topology.existingKeys;
    const additionKeys = new Set<string>();
    const canonicalAdditions: ExpansionDescriptor[] = [];
    for (const cell of normalized) {
      const key = deps.toBoardCellKey(cell.row, cell.col);
      if (existing.has(key) || additionKeys.has(key)) {
        return { added: false, reason: "coordinate_conflict" };
      }
      additionKeys.add(key);
      canonicalAdditions.push({
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
      });
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

  return {
    BOARD_CONTRACT_VERSION,
    BOARD_DIGEST_VERSION,
    inspectBoardState,
    createBoardView,
    createDenseBoardView,
    canonicalizeStateBoard,
    getStateCellValue,
    setStateCellValue,
    addStateExpansionCells,
    countStateDiscs,
  };
}
