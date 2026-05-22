/**
 * @file destroy_dragon.ts
 * @description Destroy Dragon Will effect helpers
 */

declare const __non_webpack_require__: NodeRequire | undefined;

type DestroyDragonOwnerValue = number;
type DestroyDragonSeatKey = 'black' | 'white';
type DestroyDragonExpansionSide = 'left' | 'right' | 'top' | 'bottom';

interface DestroyDragonSharedConstants {
  BLACK: DestroyDragonOwnerValue;
  WHITE: DestroyDragonOwnerValue;
  EMPTY: DestroyDragonOwnerValue;
}

interface DestroyDragonBoardDims {
  rows: number;
  cols: number;
}

interface DestroyDragonExpansionCell {
  side: DestroyDragonExpansionSide | null;
  row: number;
  col: number;
  owner: DestroyDragonOwnerValue;
}

interface DestroyDragonExpansionState {
  active?: boolean;
  side?: DestroyDragonExpansionSide | null;
  row?: number | null;
  col?: number | null;
  owner?: DestroyDragonOwnerValue;
  usedByPlayer?: Record<string, boolean>;
  cells?: DestroyDragonExpansionCell[];
}

interface DestroyDragonGameState {
  board?: DestroyDragonOwnerValue[][];
  boardExpansion?: DestroyDragonExpansionState | null;
  [key: string]: unknown;
}

interface DestroyDragonMarkerData {
  type?: string;
  remainingOwnerTurns?: number;
  [key: string]: unknown;
}

interface DestroyDragonMarker {
  kind?: string;
  row: number;
  col: number;
  owner?: unknown;
  data?: DestroyDragonMarkerData | null;
  [key: string]: unknown;
}

interface DestroyDragonCardState {
  markers?: DestroyDragonMarker[];
  [key: string]: unknown;
}

interface DestroyDragonDestroyMeta {
  sourceRow: number;
  sourceCol: number;
  projectileOwner: DestroyDragonSeatKey;
  projectileStone: string;
}

interface DestroyDragonBoardOpsModule {
  getExpansionDescriptors?: (gameState: DestroyDragonGameState) => DestroyDragonExpansionCell[];
  getCellValue?: (gameState: DestroyDragonGameState, row: number, col: number) => DestroyDragonOwnerValue | null;
  setCellValue?: (gameState: DestroyDragonGameState, row: number, col: number, value: DestroyDragonOwnerValue) => boolean;
  destroyAt?: (
    cardState: DestroyDragonCardState,
    gameState: DestroyDragonGameState,
    row: number,
    col: number,
    cause: string,
    reason: string,
    meta: DestroyDragonDestroyMeta
  ) => { destroyed?: boolean } | null | undefined;
  revertSpecialStoneAt?: (
    cardState: DestroyDragonCardState,
    gameState: DestroyDragonGameState,
    row: number,
    col: number,
    specialType: string,
    playerKey: DestroyDragonSeatKey,
    cause: string,
    reason: string
  ) => { reverted?: boolean } | null | undefined;
  runEffectBlock?: <T>(cardState: DestroyDragonCardState, gameState: DestroyDragonGameState, meta: Record<string, unknown>, fn: () => T) => T;
}

interface DestroyDragonRandomSourceModule {
  resolveRandomFunction?: (randomLike: DestroyDragonRandomLike | null | undefined, fallback: unknown, label: string) => () => number;
  resolveRandomIndex?: (length: number, randomLike: DestroyDragonRandomLike | null | undefined, fallback: unknown, label: string) => number;
}

type DestroyDragonRandomLike = (() => number) | { random: () => number };
type DestroyDragonDestroyAt = (cardState: DestroyDragonCardState, gameState: DestroyDragonGameState, row: number, col: number) => boolean;

interface DestroyDragonProcessDeps {
  random?: DestroyDragonRandomLike | null;
  destroyAt?: DestroyDragonDestroyAt;
  BoardOps?: DestroyDragonBoardOpsModule | null;
  decrementRemainingOwnerTurns?: boolean;
}

interface DestroyDragonEffectPosition {
  row: number;
  col: number;
}

interface DestroyDragonDestroyedPosition extends DestroyDragonEffectPosition {
  sourceRow: number;
  sourceCol: number;
}

interface DestroyDragonExpiredPosition extends DestroyDragonEffectPosition {
  owner: DestroyDragonSeatKey;
  reason: string;
}

interface DestroyDragonProcessResult {
  destroyed: DestroyDragonDestroyedPosition[];
  anchors: Array<DestroyDragonEffectPosition & { remainingNow: number }>;
  expired: DestroyDragonExpiredPosition[];
}

interface DestroyDragonModuleApi {
  processDestroyDragonEffects(cardState: DestroyDragonCardState, gameState: DestroyDragonGameState, playerKey: DestroyDragonSeatKey, deps?: DestroyDragonProcessDeps): DestroyDragonProcessResult;
  processDestroyDragonEffectsAtAnchor(cardState: DestroyDragonCardState, gameState: DestroyDragonGameState, playerKey: DestroyDragonSeatKey, row: number, col: number, deps?: DestroyDragonProcessDeps): DestroyDragonProcessResult;
  processDestroyDragonEffectsAtTurnStartAnchor(cardState: DestroyDragonCardState, gameState: DestroyDragonGameState, playerKey: DestroyDragonSeatKey, row: number, col: number, deps?: DestroyDragonProcessDeps): DestroyDragonProcessResult;
}

interface DestroyDragonRoot {
  SharedConstants?: DestroyDragonSharedConstants;
  BoardOps?: DestroyDragonBoardOpsModule | null;
  CardRandomSource?: DestroyDragonRandomSourceModule | null;
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

const root = typeof self !== 'undefined' ? self as unknown as DestroyDragonRoot : undefined;
const SharedConstants = safeRequire<DestroyDragonSharedConstants>('../../../shared-constants') || root?.SharedConstants;
const BoardOpsModule = safeRequire<DestroyDragonBoardOpsModule>('../board_ops') || root?.BoardOps || null;
const RandomSourceModule = safeRequire<DestroyDragonRandomSourceModule>('../cards-internal/random-source') || root?.CardRandomSource || null;

const { BLACK: RAW_BLACK, WHITE: RAW_WHITE, EMPTY: RAW_EMPTY } = SharedConstants || {};

if (RAW_BLACK === undefined || RAW_WHITE === undefined || RAW_EMPTY === undefined) {
  throw new Error('SharedConstants missing required values');
}

const BLACK: DestroyDragonOwnerValue = RAW_BLACK;
const WHITE: DestroyDragonOwnerValue = RAW_WHITE;
const EMPTY: DestroyDragonOwnerValue = RAW_EMPTY;

function normalizeExpansionOwner(owner: unknown): DestroyDragonOwnerValue {
  return (owner === BLACK || owner === WHITE) ? owner : EMPTY;
}

function resolveBoardDims(gameState: DestroyDragonGameState): DestroyDragonBoardDims {
  const board = gameState && Array.isArray(gameState.board) ? gameState.board : null;
  const rows = board && board.length > 0 ? board.length : 8;
  const cols = board && Array.isArray(board[0]) && board[0].length > 0 ? board[0].length : rows;
  return { rows, cols };
}

function isMainBoardCell(row: number, col: number, gameState: DestroyDragonGameState): boolean {
  const dims = resolveBoardDims(gameState);
  return Number.isInteger(row) && row >= 0 && row < dims.rows && Number.isInteger(col) && col >= 0 && col < dims.cols;
}

function resolveExpansionSide(side: unknown, row: number, col: number, gameState: DestroyDragonGameState): DestroyDragonExpansionSide | null {
  if (side === 'left' || side === 'right' || side === 'top' || side === 'bottom') return side;
  const dims = resolveBoardDims(gameState);
  if (col === -1) return 'left';
  if (col === dims.cols) return 'right';
  if (row === -1) return 'top';
  if (row === dims.rows) return 'bottom';
  return null;
}

function isExpansionCoordinate(row: unknown, col: unknown, gameState: DestroyDragonGameState): boolean {
  if (!Number.isInteger(row) || !Number.isInteger(col)) return false;
  const numericRow = Number(row);
  const numericCol = Number(col);
  const dims = resolveBoardDims(gameState);
  if (numericRow < -1 || numericRow > dims.rows || numericCol < -1 || numericCol > dims.cols) return false;
  if (isMainBoardCell(numericRow, numericCol, gameState)) return false;
  return true;
}

function syncLegacyExpansionFields(expansion: DestroyDragonExpansionState | null | undefined, gameState: DestroyDragonGameState): void {
  if (!expansion || typeof expansion !== 'object') return;
  if (!Array.isArray(expansion.cells)) expansion.cells = [];
  const latest = expansion.cells.length > 0 ? expansion.cells[expansion.cells.length - 1] : null;
  expansion.active = !!latest;
  expansion.side = latest ? resolveExpansionSide(latest.side, latest.row, latest.col, gameState) : null;
  expansion.row = latest ? latest.row : null;
  expansion.owner = latest ? normalizeExpansionOwner(latest.owner) : EMPTY;
}

function getExpansionCells(gameState: DestroyDragonGameState): DestroyDragonExpansionCell[] {
  if (BoardOpsModule && typeof BoardOpsModule.getExpansionDescriptors === 'function') {
    return BoardOpsModule.getExpansionDescriptors(gameState);
  }
  const expansion = (gameState && gameState.boardExpansion && typeof gameState.boardExpansion === 'object')
    ? gameState.boardExpansion
    : null;
  if (!expansion) return [];

  const cells: DestroyDragonExpansionCell[] = [];
  const pushCell = (
    source: DestroyDragonExpansionCell | DestroyDragonExpansionState | DestroyDragonExpansionSide | null | undefined,
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

function ensureExpansionStateMutable(gameState: DestroyDragonGameState): DestroyDragonExpansionState {
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

function getCellValue(gameState: DestroyDragonGameState, row: number, col: number): DestroyDragonOwnerValue | null {
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

function setCellValue(gameState: DestroyDragonGameState, row: number, col: number, value: DestroyDragonOwnerValue): boolean {
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

function cleanupExpiredDestroyDragons(cardState: DestroyDragonCardState): void {
  const markers = cardState.markers;
  if (!Array.isArray(markers)) return;
  cardState.markers = markers.filter((marker) => (
    marker.kind !== 'specialStone' ||
    !marker.data ||
    marker.data.type !== 'DESTROY_DRAGON' ||
    (Number.isFinite(Number(marker.data.remainingOwnerTurns)) && Number(marker.data.remainingOwnerTurns) >= 0)
  ));
}

function resolveRandomFn(randomLike: DestroyDragonRandomLike | null | undefined): () => number {
  if (RandomSourceModule && typeof RandomSourceModule.resolveRandomFunction === 'function') {
    return RandomSourceModule.resolveRandomFunction(randomLike, null, 'CardDestroyDragon');
  }
  if (typeof randomLike === 'function') return randomLike;
  if (randomLike && typeof randomLike.random === 'function') {
    return function (): number { return randomLike.random(); };
  }
  throw new Error('CardDestroyDragon requires an injected deterministic PRNG.');
}

function resolveRandomIndex(length: number, randomFn: () => number): number {
  if (length <= 0) return -1;
  if (RandomSourceModule && typeof RandomSourceModule.resolveRandomIndex === 'function') {
    return RandomSourceModule.resolveRandomIndex(length, { random: randomFn }, null, 'CardDestroyDragon');
  }
  const raw = Number(randomFn());
  if (!Number.isFinite(raw)) {
    throw new Error('CardDestroyDragon received a PRNG that returned a non-finite value.');
  }
  const normalized = Math.max(0, Math.min(0.999999, raw));
  return Math.max(0, Math.min(length - 1, Math.floor(normalized * length)));
}

function collectAdjacentEnemyTargets(gameState: DestroyDragonGameState, sourceRow: number, sourceCol: number, enemyValue: DestroyDragonOwnerValue): DestroyDragonEffectPosition[] {
  const targets: DestroyDragonEffectPosition[] = [];
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      if (dr === 0 && dc === 0) continue;
      const row = sourceRow + dr;
      const col = sourceCol + dc;
      if (getCellValue(gameState, row, col) === enemyValue) targets.push({ row, col });
    }
  }
  return targets;
}

function removeMarkerAt(cardState: DestroyDragonCardState, row: number, col: number): void {
  const markers = cardState.markers;
  if (!Array.isArray(markers)) return;
  cardState.markers = markers.filter((marker) => !(marker && marker.row === row && marker.col === col));
}

function fallbackDestroyAt(cardState: DestroyDragonCardState, gameState: DestroyDragonGameState, row: number, col: number): boolean {
  const current = getCellValue(gameState, row, col);
  if (current === null || current === EMPTY) return false;
  removeMarkerAt(cardState, row, col);
  setCellValue(gameState, row, col, EMPTY);
  return true;
}

function expireAnchor(
  cardState: DestroyDragonCardState,
  gameState: DestroyDragonGameState,
  playerKey: DestroyDragonSeatKey,
  row: number,
  col: number,
  marker: DestroyDragonMarker,
  options: DestroyDragonProcessDeps,
  expired: DestroyDragonExpiredPosition[]
): void {
  let reverted = false;
  if (options.BoardOps && typeof options.BoardOps.revertSpecialStoneAt === 'function') {
    const res = options.BoardOps.revertSpecialStoneAt(cardState, gameState, row, col, 'DESTROY_DRAGON', playerKey, 'DESTROY_DRAGON_WILL', 'anchor_expired');
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
      entry.data.type === 'DESTROY_DRAGON'
    ));
    reverted = true;
  }
  if (reverted) expired.push({ row, col, owner: playerKey, reason: 'anchor_expired' });
  if (marker && marker.data) marker.data.remainingOwnerTurns = -1;
}

function processAnchor(cardState: DestroyDragonCardState, gameState: DestroyDragonGameState, playerKey: DestroyDragonSeatKey, row: number, col: number, options: DestroyDragonProcessDeps): DestroyDragonProcessResult {
  const randomFn = resolveRandomFn(options.random);
  const destroyed: DestroyDragonDestroyedPosition[] = [];
  const anchors: Array<DestroyDragonEffectPosition & { remainingNow: number }> = [];
  const expired: DestroyDragonExpiredPosition[] = [];
  const playerValue = playerKey === 'black' ? (BLACK || 1) : (WHITE || -1);
  const enemyValue = -playerValue;
  const shouldDecrement = options.decrementRemainingOwnerTurns !== false;
  const destroyAt: DestroyDragonDestroyAt = options.destroyAt || fallbackDestroyAt;

  const marker = (cardState.markers || []).find((entry) => (
    entry &&
    entry.kind === 'specialStone' &&
    entry.data &&
    entry.data.type === 'DESTROY_DRAGON' &&
    entry.owner === playerKey &&
    entry.row === row &&
    entry.col === col
  ));

  if (!marker) return { destroyed, anchors, expired };
  if (getCellValue(gameState, row, col) !== playerValue) {
    if (marker.data) marker.data.remainingOwnerTurns = -1;
    cleanupExpiredDestroyDragons(cardState);
    return { destroyed, anchors, expired };
  }

  const resolveAnchor = (): DestroyDragonProcessResult => {
  const targets = collectAdjacentEnemyTargets(gameState, row, col, enemyValue);
  if (targets.length > 0) {
    const target = targets[resolveRandomIndex(targets.length, randomFn)];
    let destroyedRes = false;
    if (options.BoardOps && typeof options.BoardOps.destroyAt === 'function') {
      const res = options.BoardOps.destroyAt(cardState, gameState, target.row, target.col, 'DESTROY_DRAGON_WILL', 'destroy_dragon_breath', {
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

  cleanupExpiredDestroyDragons(cardState);
  return { destroyed, anchors, expired };
  };

  if (options.BoardOps && typeof options.BoardOps.runEffectBlock === 'function') {
    return options.BoardOps.runEffectBlock(cardState, gameState, {
      kind: 'anchor_effect',
      cause: 'DESTROY_DRAGON_WILL',
      reason: 'destroy_dragon_breath',
      owner: playerKey,
      sourceRow: row,
      sourceCol: col,
      randomSource: options.random || null
    }, resolveAnchor);
  }
  return resolveAnchor();
}

function processDestroyDragonEffects(cardState: DestroyDragonCardState, gameState: DestroyDragonGameState, playerKey: DestroyDragonSeatKey, deps?: DestroyDragonProcessDeps): DestroyDragonProcessResult {
  const options = deps || {};
  const destroyed: DestroyDragonDestroyedPosition[] = [];
  const anchors: Array<DestroyDragonEffectPosition & { remainingNow: number }> = [];
  const expired: DestroyDragonExpiredPosition[] = [];
  const markers = (cardState.markers || []).filter((entry) => (
    entry &&
    entry.kind === 'specialStone' &&
    entry.data &&
    entry.data.type === 'DESTROY_DRAGON' &&
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

function processDestroyDragonEffectsAtAnchor(cardState: DestroyDragonCardState, gameState: DestroyDragonGameState, playerKey: DestroyDragonSeatKey, row: number, col: number, deps?: DestroyDragonProcessDeps): DestroyDragonProcessResult {
  return processAnchor(cardState, gameState, playerKey, row, col, deps || {});
}

function processDestroyDragonEffectsAtTurnStartAnchor(cardState: DestroyDragonCardState, gameState: DestroyDragonGameState, playerKey: DestroyDragonSeatKey, row: number, col: number, deps?: DestroyDragonProcessDeps): DestroyDragonProcessResult {
  return processAnchor(cardState, gameState, playerKey, row, col, deps || {});
}

const DestroyDragonModule: DestroyDragonModuleApi = {
  processDestroyDragonEffects,
  processDestroyDragonEffectsAtAnchor,
  processDestroyDragonEffectsAtTurnStartAnchor
};

module.exports = DestroyDragonModule;

export = DestroyDragonModule;
