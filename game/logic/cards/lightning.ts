/**
 * @file lightning.ts
 * @description Lightning Will effect helpers
 */

declare const __non_webpack_require__: NodeRequire | undefined;

type LightningOwnerValue = number;
type LightningSeatKey = 'black' | 'white';
type LightningExpansionSide = 'left' | 'right' | 'top' | 'bottom';

interface LightningSharedConstants {
  BLACK: LightningOwnerValue;
  WHITE: LightningOwnerValue;
  EMPTY: LightningOwnerValue;
}

interface LightningBoardDims {
  rows: number;
  cols: number;
}

interface LightningExpansionCell {
  side: LightningExpansionSide | null;
  row: number;
  col: number;
  owner: LightningOwnerValue;
}

interface LightningExpansionState {
  active?: boolean;
  side?: LightningExpansionSide | null;
  row?: number | null;
  col?: number | null;
  owner?: LightningOwnerValue;
  usedByPlayer?: Record<string, boolean>;
  cells?: LightningExpansionCell[];
}

interface LightningGameState {
  board?: LightningOwnerValue[][];
  boardExpansion?: LightningExpansionState | null;
  [key: string]: unknown;
}

interface LightningMarkerData {
  type?: string;
  remainingOwnerTurns?: number;
  [key: string]: unknown;
}

interface LightningMarker {
  kind?: string;
  row: number;
  col: number;
  owner?: unknown;
  data?: LightningMarkerData | null;
  [key: string]: unknown;
}

interface LightningCardState {
  markers?: LightningMarker[];
  [key: string]: unknown;
}

interface LightningDestroyMeta {
  sourceRow: number;
  sourceCol: number;
  projectileOwner: LightningSeatKey;
  projectileStone: string;
}

interface LightningBoardOpsModule {
  getExpansionDescriptors?: (gameState: LightningGameState) => LightningExpansionCell[];
  getCellValue?: (gameState: LightningGameState, row: number, col: number) => LightningOwnerValue | null;
  setCellValue?: (gameState: LightningGameState, row: number, col: number, value: LightningOwnerValue) => boolean;
  destroyAt?: (
    cardState: LightningCardState,
    gameState: LightningGameState,
    row: number,
    col: number,
    cause: string,
    reason: string,
    meta: LightningDestroyMeta
  ) => { destroyed?: boolean } | null | undefined;
  revertSpecialStoneAt?: (
    cardState: LightningCardState,
    gameState: LightningGameState,
    row: number,
    col: number,
    specialType: string,
    playerKey: LightningSeatKey,
    cause: string,
    reason: string
  ) => { reverted?: boolean } | null | undefined;
  runEffectBlock?: <T>(cardState: LightningCardState, gameState: LightningGameState, meta: Record<string, unknown>, fn: () => T) => T;
}

interface LightningRandomSourceModule {
  resolveRandomFunction?: (randomLike: LightningRandomLike | null | undefined, fallback: unknown, label: string) => () => number;
  resolveRandomIndex?: (length: number, randomLike: LightningRandomLike | null | undefined, fallback: unknown, label: string) => number;
}

type LightningRandomLike = (() => number) | { random: () => number };
type LightningDestroyAt = (cardState: LightningCardState, gameState: LightningGameState, row: number, col: number) => boolean;

interface LightningProcessDeps {
  random?: LightningRandomLike | null;
  destroyAt?: LightningDestroyAt;
  BoardOps?: LightningBoardOpsModule | null;
  decrementRemainingOwnerTurns?: boolean;
}

interface LightningEffectPosition {
  row: number;
  col: number;
}

interface LightningDestroyedPosition extends LightningEffectPosition {
  sourceRow: number;
  sourceCol: number;
}

interface LightningExpiredPosition extends LightningEffectPosition {
  owner: LightningSeatKey;
  reason: string;
}

interface LightningProcessResult {
  destroyed: LightningDestroyedPosition[];
  anchors: Array<LightningEffectPosition & { remainingNow: number }>;
  expired: LightningExpiredPosition[];
}

interface LightningModuleApi {
  processLightningWillEffects(cardState: LightningCardState, gameState: LightningGameState, playerKey: LightningSeatKey, deps?: LightningProcessDeps): LightningProcessResult;
  processLightningWillEffectsAtAnchor(cardState: LightningCardState, gameState: LightningGameState, playerKey: LightningSeatKey, row: number, col: number, deps?: LightningProcessDeps): LightningProcessResult;
  processLightningWillEffectsAtTurnStartAnchor(cardState: LightningCardState, gameState: LightningGameState, playerKey: LightningSeatKey, row: number, col: number, deps?: LightningProcessDeps): LightningProcessResult;
}

interface LightningRoot {
  SharedConstants?: LightningSharedConstants;
  BoardOps?: LightningBoardOpsModule | null;
  CardRandomSource?: LightningRandomSourceModule | null;
}

const _require: NodeRequire = (typeof __non_webpack_require__ !== 'undefined')
  ? __non_webpack_require__
  : require;

function safeRequire<T>(id: string): T | null {
  try {
    return _require(id) as T;
  } catch (e) {
    return null;
  }
}

const root = typeof self !== 'undefined' ? self as unknown as LightningRoot : undefined;
const SharedConstants = safeRequire<LightningSharedConstants>('../../../shared-constants') || root?.SharedConstants;
const BoardOpsModule = safeRequire<LightningBoardOpsModule>('../board_ops') || root?.BoardOps || null;
const RandomSourceModule = safeRequire<LightningRandomSourceModule>('../cards-internal/random-source') || root?.CardRandomSource || null;

const { BLACK: RAW_BLACK, WHITE: RAW_WHITE, EMPTY: RAW_EMPTY } = SharedConstants || {};

if (RAW_BLACK === undefined || RAW_WHITE === undefined || RAW_EMPTY === undefined) {
  throw new Error('SharedConstants missing required values');
}

const BLACK: LightningOwnerValue = RAW_BLACK;
const WHITE: LightningOwnerValue = RAW_WHITE;
const EMPTY: LightningOwnerValue = RAW_EMPTY;

function normalizeExpansionOwner(owner: unknown): LightningOwnerValue {
  return (owner === BLACK || owner === WHITE) ? owner : EMPTY;
}

function resolveBoardDims(gameState: LightningGameState): LightningBoardDims {
  const board = gameState && Array.isArray(gameState.board) ? gameState.board : null;
  const rows = board && board.length > 0 ? board.length : 8;
  const cols = board && Array.isArray(board[0]) && board[0].length > 0 ? board[0].length : rows;
  return { rows, cols };
}

function isMainBoardCell(row: number, col: number, gameState: LightningGameState): boolean {
  const dims = resolveBoardDims(gameState);
  return Number.isInteger(row) && row >= 0 && row < dims.rows && Number.isInteger(col) && col >= 0 && col < dims.cols;
}

function resolveExpansionSide(side: unknown, row: number, col: number, gameState: LightningGameState): LightningExpansionSide | null {
  if (side === 'left' || side === 'right' || side === 'top' || side === 'bottom') return side;
  const dims = resolveBoardDims(gameState);
  if (col === -1) return 'left';
  if (col === dims.cols) return 'right';
  if (row === -1) return 'top';
  if (row === dims.rows) return 'bottom';
  return null;
}

function isExpansionCoordinate(row: unknown, col: unknown, gameState: LightningGameState): boolean {
  if (!Number.isInteger(row) || !Number.isInteger(col)) return false;
  const numericRow = Number(row);
  const numericCol = Number(col);
  const dims = resolveBoardDims(gameState);
  if (numericRow < -1 || numericRow > dims.rows || numericCol < -1 || numericCol > dims.cols) return false;
  if (isMainBoardCell(numericRow, numericCol, gameState)) return false;
  return true;
}

function syncLegacyExpansionFields(expansion: LightningExpansionState | null | undefined, gameState: LightningGameState): void {
  if (!expansion || typeof expansion !== 'object') return;
  if (!Array.isArray(expansion.cells)) expansion.cells = [];
  const latest = expansion.cells.length > 0 ? expansion.cells[expansion.cells.length - 1] : null;
  expansion.active = !!latest;
  expansion.side = latest ? resolveExpansionSide(latest.side, latest.row, latest.col, gameState) : null;
  expansion.row = latest ? latest.row : null;
  expansion.owner = latest ? normalizeExpansionOwner(latest.owner) : EMPTY;
}

function getExpansionCells(gameState: LightningGameState): LightningExpansionCell[] {
  if (BoardOpsModule && typeof BoardOpsModule.getExpansionDescriptors === 'function') {
    return BoardOpsModule.getExpansionDescriptors(gameState);
  }
  const expansion = (gameState && gameState.boardExpansion && typeof gameState.boardExpansion === 'object')
    ? gameState.boardExpansion
    : null;
  if (!expansion) return [];

  const cells: LightningExpansionCell[] = [];
  const pushCell = (
    source: LightningExpansionCell | LightningExpansionState | LightningExpansionSide | null | undefined,
    legacyRow?: number | null,
    legacyOwner?: unknown
  ): void => {
    let side: unknown = null;
    let row: number | null | undefined = null;
    let col: number | null | undefined = null;
    let owner = legacyOwner;

    if (source && typeof source === 'object') {
      side = source.side;
      row = source.row;
      col = source.col;
      owner = source.owner;
      if (!Number.isInteger(col) && side === 'left') col = -1;
      if (!Number.isInteger(col) && side === 'right') col = resolveBoardDims(gameState).cols;
    } else {
      side = source;
      row = legacyRow;
      if (side === 'left') col = -1;
      if (side === 'right') col = resolveBoardDims(gameState).cols;
    }

    if (!isExpansionCoordinate(row, col, gameState)) return;
    const normalizedRow = Number(row);
    const normalizedCol = Number(col);
    if (cells.some((cell) => cell && cell.row === normalizedRow && cell.col === normalizedCol)) return;
    cells.push({
      side: resolveExpansionSide(side, normalizedRow, normalizedCol, gameState),
      row: normalizedRow,
      col: normalizedCol,
      owner: normalizeExpansionOwner(owner)
    });
  };

  if (Array.isArray(expansion.cells)) {
    for (const cell of expansion.cells) {
      if (!cell || typeof cell !== 'object') continue;
      pushCell(cell);
    }
  }

  if (cells.length === 0 && expansion.active === true) {
    pushCell(expansion);
  }

  return cells;
}

function ensureExpansionStateMutable(gameState: LightningGameState): LightningExpansionState {
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
  const cells = getExpansionCells(gameState);
  expansion.cells = cells.map((cell) => ({
    side: cell.side,
    row: cell.row,
    col: cell.col,
    owner: normalizeExpansionOwner(cell.owner)
  }));
  syncLegacyExpansionFields(expansion, gameState);
  return expansion;
}

function getCellValue(gameState: LightningGameState, row: number, col: number): LightningOwnerValue | null {
  if (BoardOpsModule && typeof BoardOpsModule.getCellValue === 'function') {
    return BoardOpsModule.getCellValue(gameState, row, col);
  }
  if (isMainBoardCell(row, col, gameState) && gameState.board) return gameState.board[row][col];
  const expansionCells = getExpansionCells(gameState);
  for (const expansion of expansionCells) {
    if (!expansion) continue;
    if (expansion.row === row && expansion.col === col) return expansion.owner;
  }
  return null;
}

function setCellValue(gameState: LightningGameState, row: number, col: number, value: LightningOwnerValue): boolean {
  if (BoardOpsModule && typeof BoardOpsModule.setCellValue === 'function') {
    return BoardOpsModule.setCellValue(gameState, row, col, value);
  }
  if (isMainBoardCell(row, col, gameState) && gameState.board) {
    gameState.board[row][col] = value;
    return true;
  }
  const expansionState = ensureExpansionStateMutable(gameState);
  if (!Array.isArray(expansionState.cells)) return false;
  const normalizedOwner = normalizeExpansionOwner(value);
  for (let i = 0; i < expansionState.cells.length; i++) {
    const cell = expansionState.cells[i];
    if (!cell) continue;
    const cellCol = Number.isInteger(cell.col)
      ? cell.col
      : (cell.side === 'left' ? -1 : (cell.side === 'right' ? resolveBoardDims(gameState).cols : null));
    if (cellCol === null) continue;
    if (cell.row === row && cellCol === col) {
      expansionState.cells[i] = {
        side: resolveExpansionSide(cell.side, cell.row, cellCol, gameState),
        row: cell.row,
        col: cellCol,
        owner: normalizedOwner
      };
      syncLegacyExpansionFields(expansionState, gameState);
      return true;
    }
  }
  return false;
}

function cleanupExpiredLightning(cardState: LightningCardState): void {
  const markers = cardState.markers;
  if (!Array.isArray(markers)) return;
  cardState.markers = markers.filter((marker) => (
    marker.kind !== 'specialStone' ||
    !marker.data ||
    marker.data.type !== 'LIGHTNING' ||
    (Number.isFinite(Number(marker.data.remainingOwnerTurns)) && Number(marker.data.remainingOwnerTurns) >= 0)
  ));
}

function resolveRandomFn(randomLike: LightningRandomLike | null | undefined): () => number {
  if (RandomSourceModule && typeof RandomSourceModule.resolveRandomFunction === 'function') {
    return RandomSourceModule.resolveRandomFunction(randomLike, null, 'CardLightning');
  }
  if (typeof randomLike === 'function') return randomLike;
  if (randomLike && typeof randomLike.random === 'function') {
    return function (): number { return randomLike.random(); };
  }
  throw new Error('CardLightning requires an injected deterministic PRNG.');
}

function resolveRandomIndex(length: number, randomFn: () => number): number {
  if (length <= 0) return -1;
  if (RandomSourceModule && typeof RandomSourceModule.resolveRandomIndex === 'function') {
    return RandomSourceModule.resolveRandomIndex(length, { random: randomFn }, null, 'CardLightning');
  }
  const raw = Number(randomFn());
  if (!Number.isFinite(raw)) {
    throw new Error('CardLightning received a PRNG that returned a non-finite value.');
  }
  const normalized = Math.max(0, Math.min(0.999999, raw));
  return Math.max(0, Math.min(length - 1, Math.floor(normalized * length)));
}

function collectEnemyTargets(gameState: LightningGameState, enemyValue: LightningOwnerValue): LightningEffectPosition[] {
  const targets: LightningEffectPosition[] = [];
  const dims = resolveBoardDims(gameState);
  for (let row = 0; row < dims.rows; row++) {
    for (let col = 0; col < dims.cols; col++) {
      if (gameState.board && gameState.board[row][col] === enemyValue) targets.push({ row, col });
    }
  }
  for (const cell of getExpansionCells(gameState)) {
    if (cell && cell.owner === enemyValue) targets.push({ row: cell.row, col: cell.col });
  }
  return targets;
}

function removeMarkerAt(cardState: LightningCardState, row: number, col: number): void {
  const markers = cardState.markers;
  if (!Array.isArray(markers)) return;
  cardState.markers = markers.filter((marker) => !(marker && marker.row === row && marker.col === col));
}

function fallbackDestroyAt(cardState: LightningCardState, gameState: LightningGameState, row: number, col: number): boolean {
  const current = getCellValue(gameState, row, col);
  if (current === null || current === EMPTY) return false;
  removeMarkerAt(cardState, row, col);
  setCellValue(gameState, row, col, EMPTY);
  return true;
}

function expireAnchor(
  cardState: LightningCardState,
  gameState: LightningGameState,
  playerKey: LightningSeatKey,
  row: number,
  col: number,
  marker: LightningMarker,
  options: LightningProcessDeps,
  expired: LightningExpiredPosition[]
): void {
  let reverted = false;
  if (options.BoardOps && typeof options.BoardOps.revertSpecialStoneAt === 'function') {
    const res = options.BoardOps.revertSpecialStoneAt(cardState, gameState, row, col, 'LIGHTNING', playerKey, 'LIGHTNING_WILL', 'anchor_expired');
    reverted = !!(res && res.reverted);
  } else if (Array.isArray(cardState.markers)) {
    const markers = cardState.markers;
    cardState.markers = markers.filter((entry) => !(
      entry &&
      entry.kind === 'specialStone' &&
      entry.row === row &&
      entry.col === col &&
      entry.owner === playerKey &&
      entry.data &&
      entry.data.type === 'LIGHTNING'
    ));
    reverted = true;
  }
  if (reverted) expired.push({ row, col, owner: playerKey, reason: 'anchor_expired' });
  if (marker && marker.data) marker.data.remainingOwnerTurns = -1;
}

function processAnchor(cardState: LightningCardState, gameState: LightningGameState, playerKey: LightningSeatKey, row: number, col: number, options: LightningProcessDeps): LightningProcessResult {
  const randomFn = resolveRandomFn(options.random);
  const destroyed: LightningDestroyedPosition[] = [];
  const anchors: Array<LightningEffectPosition & { remainingNow: number }> = [];
  const expired: LightningExpiredPosition[] = [];
  const playerValue = playerKey === 'black' ? (BLACK || 1) : (WHITE || -1);
  const enemyValue = -playerValue;
  const shouldDecrement = options.decrementRemainingOwnerTurns !== false;
  const destroyAt: LightningDestroyAt = options.destroyAt || fallbackDestroyAt;

  const marker = (cardState.markers || []).find((entry) => (
    entry &&
    entry.kind === 'specialStone' &&
    entry.data &&
    entry.data.type === 'LIGHTNING' &&
    entry.owner === playerKey &&
    entry.row === row &&
    entry.col === col
  ));

  if (!marker) return { destroyed, anchors, expired };
  if (getCellValue(gameState, row, col) !== playerValue) {
    if (marker.data) marker.data.remainingOwnerTurns = -1;
    cleanupExpiredLightning(cardState);
    return { destroyed, anchors, expired };
  }

  const resolveAnchor = (): LightningProcessResult => {
  const targets = collectEnemyTargets(gameState, enemyValue);
  if (targets.length > 0) {
    const target = targets[resolveRandomIndex(targets.length, randomFn)];
    let destroyedRes = false;
    if (options.BoardOps && typeof options.BoardOps.destroyAt === 'function') {
      const res = options.BoardOps.destroyAt(cardState, gameState, target.row, target.col, 'LIGHTNING_WILL', 'lightning_destroyed', {
        sourceRow: row,
        sourceCol: col,
        projectileOwner: playerKey,
        projectileStone: 'normal'
      });
      destroyedRes = !!(res && res.destroyed);
    } else {
      destroyedRes = destroyAt(cardState, gameState, target.row, target.col);
    }
    if (destroyedRes) {
      destroyed.push({ row: target.row, col: target.col, sourceRow: row, sourceCol: col });
    }
  }

  const before = (marker.data && Number.isFinite(Number(marker.data.remainingOwnerTurns)))
    ? Number(marker.data.remainingOwnerTurns)
    : 0;
  const after = shouldDecrement ? (before - 1) : before;
  if (marker.data) marker.data.remainingOwnerTurns = after;

  if (shouldDecrement && after >= 0) anchors.push({ row, col, remainingNow: after });
  if (shouldDecrement && after === 0) expireAnchor(cardState, gameState, playerKey, row, col, marker, options, expired);
  if (shouldDecrement && after < 0 && marker.data) marker.data.remainingOwnerTurns = -1;

  cleanupExpiredLightning(cardState);
  return { destroyed, anchors, expired };
  };

  if (options.BoardOps && typeof options.BoardOps.runEffectBlock === 'function') {
    return options.BoardOps.runEffectBlock(cardState, gameState, {
      kind: 'anchor_effect',
      cause: 'LIGHTNING_WILL',
      reason: 'lightning_destroyed',
      owner: playerKey,
      sourceRow: row,
      sourceCol: col,
      randomSource: options.random || null
    }, resolveAnchor);
  }
  return resolveAnchor();
}

function processLightningWillEffects(cardState: LightningCardState, gameState: LightningGameState, playerKey: LightningSeatKey, deps?: LightningProcessDeps): LightningProcessResult {
  const options = deps || {};
  const destroyed: LightningDestroyedPosition[] = [];
  const anchors: Array<LightningEffectPosition & { remainingNow: number }> = [];
  const expired: LightningExpiredPosition[] = [];
  const markers = (cardState.markers || []).filter((entry) => (
    entry &&
    entry.kind === 'specialStone' &&
    entry.data &&
    entry.data.type === 'LIGHTNING' &&
    entry.owner === playerKey
  ));
  for (const marker of markers) {
    const result = processAnchor(cardState, gameState, playerKey, marker.row, marker.col, options);
    if (result.destroyed && result.destroyed.length) destroyed.push(...result.destroyed);
    if (result.anchors && result.anchors.length) anchors.push(...result.anchors);
    if (result.expired && result.expired.length) expired.push(...result.expired);
  }
  return { destroyed, anchors, expired };
}

function processLightningWillEffectsAtAnchor(cardState: LightningCardState, gameState: LightningGameState, playerKey: LightningSeatKey, row: number, col: number, deps?: LightningProcessDeps): LightningProcessResult {
  return processAnchor(cardState, gameState, playerKey, row, col, deps || {});
}

function processLightningWillEffectsAtTurnStartAnchor(cardState: LightningCardState, gameState: LightningGameState, playerKey: LightningSeatKey, row: number, col: number, deps?: LightningProcessDeps): LightningProcessResult {
  return processAnchor(cardState, gameState, playerKey, row, col, deps || {});
}

const LightningModule: LightningModuleApi = {
  processLightningWillEffects,
  processLightningWillEffectsAtAnchor,
  processLightningWillEffectsAtTurnStartAnchor
};

module.exports = LightningModule;

export = LightningModule;
