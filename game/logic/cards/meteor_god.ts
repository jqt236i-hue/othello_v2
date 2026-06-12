/**
 * @file meteor_god.ts
 * @description Meteor God timed anchor effect helpers.
 */

declare const __non_webpack_require__: NodeRequire | undefined;

type MeteorGodOwnerValue = number;
type MeteorGodSeatKey = 'black' | 'white';
type MeteorGodExpansionSide = 'left' | 'right' | 'top' | 'bottom';

interface MeteorGodSharedConstants {
  BLACK: MeteorGodOwnerValue;
  WHITE: MeteorGodOwnerValue;
  EMPTY: MeteorGodOwnerValue;
}

interface MeteorGodBoardDims {
  rows: number;
  cols: number;
}

interface MeteorGodExpansionCell {
  side: MeteorGodExpansionSide | null;
  row: number;
  col: number;
  owner: MeteorGodOwnerValue;
}

interface MeteorGodExpansionState {
  active?: boolean;
  side?: MeteorGodExpansionSide | null;
  row?: number | null;
  col?: number | null;
  owner?: MeteorGodOwnerValue;
  usedByPlayer?: Record<string, boolean>;
  cells?: MeteorGodExpansionCell[];
}

interface MeteorGodGameState {
  board?: MeteorGodOwnerValue[][];
  boardExpansion?: MeteorGodExpansionState | null;
  [key: string]: unknown;
}

interface MeteorGodMarkerData {
  type?: string;
  remainingOwnerTurns?: number;
  [key: string]: unknown;
}

interface MeteorGodMarker {
  kind?: string;
  row: number;
  col: number;
  owner?: unknown;
  data?: MeteorGodMarkerData | null;
  [key: string]: unknown;
}

interface MeteorGodCardState {
  markers?: MeteorGodMarker[];
  [key: string]: unknown;
}

interface MeteorGodBoardOpsModule {
  getExpansionDescriptors?: (gameState: MeteorGodGameState) => MeteorGodExpansionCell[];
  getCellValue?: (gameState: MeteorGodGameState, row: number, col: number) => MeteorGodOwnerValue | null;
  setCellValue?: (gameState: MeteorGodGameState, row: number, col: number, value: MeteorGodOwnerValue) => boolean;
  revertSpecialStoneAt?: (
    cardState: MeteorGodCardState,
    gameState: MeteorGodGameState,
    row: number,
    col: number,
    markerType: string,
    ownerKey: MeteorGodSeatKey,
    cause: string,
    reason: string
  ) => { reverted?: boolean };
  applyCellRemovalAt?: (
    cardState: MeteorGodCardState,
    gameState: MeteorGodGameState,
    row: number,
    col: number,
    playerKey: string,
    cause: string,
    reason: string,
    options: any
  ) => any;
  runCellRemovalBlock?: (cardState: MeteorGodCardState, gameState: MeteorGodGameState, fn: () => any, meta?: any) => any;
  runEffectBlock?: (cardState: MeteorGodCardState, gameState: MeteorGodGameState, meta: any, fn: () => any) => any;
}

interface MeteorGodRandomLike {
  random?: () => number;
}

interface MeteorGodCardMarkersModule {
  isManifestStoneAt?: (cardState: MeteorGodCardState, row: number, col: number) => boolean;
}

interface MeteorGodProcessDeps {
  BoardOps?: MeteorGodBoardOpsModule;
  random?: MeteorGodRandomLike | (() => number) | null;
  decrementRemainingOwnerTurns?: boolean;
  applyCellRemovalAt?: MeteorGodBoardOpsModule['applyCellRemovalAt'];
  runCellRemovalBlock?: MeteorGodBoardOpsModule['runCellRemovalBlock'];
}

interface MeteorGodEffectPosition {
  row: number;
  col: number;
}

interface MeteorGodDestroyedPosition extends MeteorGodEffectPosition {
  sourceRow: number;
  sourceCol: number;
}

interface MeteorGodExpiredPosition extends MeteorGodEffectPosition {
  owner: MeteorGodSeatKey;
  reason: string;
}

interface MeteorGodProcessResult {
  destroyed: MeteorGodDestroyedPosition[];
  anchors: Array<MeteorGodEffectPosition & { remainingNow: number }>;
  expired: MeteorGodExpiredPosition[];
}

interface MeteorGodModuleApi {
  processMeteorGodEffects: (
    cardState: MeteorGodCardState,
    gameState: MeteorGodGameState,
    playerKey: MeteorGodSeatKey,
    deps?: MeteorGodProcessDeps
  ) => MeteorGodProcessResult;
  processMeteorGodEffectsAtAnchor: (
    cardState: MeteorGodCardState,
    gameState: MeteorGodGameState,
    playerKey: MeteorGodSeatKey,
    row: number,
    col: number,
    deps?: MeteorGodProcessDeps
  ) => MeteorGodProcessResult;
  processMeteorGodEffectsAtTurnStartAnchor: (
    cardState: MeteorGodCardState,
    gameState: MeteorGodGameState,
    playerKey: MeteorGodSeatKey,
    row: number,
    col: number,
    deps?: MeteorGodProcessDeps
  ) => MeteorGodProcessResult;
}

function _require(id: string): any {
  if (typeof __non_webpack_require__ !== 'undefined') {
    return __non_webpack_require__(id);
  }
  if (typeof require === 'function') {
    return require(id);
  }
  throw new Error('Unable to require ' + id);
}

function safeRequire(id: string): any {
  try {
    return _require(id);
  } catch (_error) {
    return null;
  }
}

const SharedConstants: MeteorGodSharedConstants = safeRequire('../../../shared-constants') || {
  BLACK: 1,
  WHITE: -1,
  EMPTY: 0
};
const BoardOpsModule: MeteorGodBoardOpsModule | null = safeRequire('../board_ops');
const ExpansionFallbackModule = safeRequire('./expansion');
const RandomSourceModule = safeRequire('./random-source');
const CardMarkersModule: MeteorGodCardMarkersModule | null = safeRequire('./markers');
const CardCellRemoval = safeRequire('./cell-removal') || {
  applyHoleStyleCellRemoval: (_cardState: MeteorGodCardState, _gameState: MeteorGodGameState, targetRow: number, targetCol: number, _playerKey: string, cause: string) => ({
    applied: false,
    reason: 'cell_removal_dependency_missing',
    row: targetRow,
    col: targetCol,
    cause
  }),
  runHoleStyleCellRemovalBlock: (_cardState: MeteorGodCardState, _gameState: MeteorGodGameState, _deps: any, fn: () => any) => fn()
};

const BLACK = SharedConstants.BLACK || 1;
const WHITE = SharedConstants.WHITE || -1;
const EMPTY = SharedConstants.EMPTY || 0;
const MANIFEST_STONE_TYPES = new Set(['THEORY_INCARNATION', 'BOARD_EXECUTOR', 'OBSERVER_WILL']);

function resolveBoardDims(gameState: MeteorGodGameState): MeteorGodBoardDims {
  const board = gameState && Array.isArray(gameState.board) ? gameState.board : null;
  const rows = board && board.length ? board.length : 8;
  const cols = board && Array.isArray(board[0]) && board[0].length ? board[0].length : rows;
  return { rows, cols };
}

function getExpansionCells(gameState: MeteorGodGameState): MeteorGodExpansionCell[] {
  if (BoardOpsModule && typeof BoardOpsModule.getExpansionDescriptors === 'function') {
    return BoardOpsModule.getExpansionDescriptors(gameState);
  }
  if (ExpansionFallbackModule && typeof ExpansionFallbackModule.getExpansionCells === 'function') {
    return ExpansionFallbackModule.getExpansionCells(gameState);
  }
  const expansion = gameState && gameState.boardExpansion;
  if (!expansion || !Array.isArray(expansion.cells)) return [];
  return expansion.cells.filter(Boolean) as MeteorGodExpansionCell[];
}

function getCellValue(gameState: MeteorGodGameState, row: number, col: number): MeteorGodOwnerValue | null {
  if (BoardOpsModule && typeof BoardOpsModule.getCellValue === 'function') {
    return BoardOpsModule.getCellValue(gameState, row, col);
  }
  if (ExpansionFallbackModule && typeof ExpansionFallbackModule.getCellValue === 'function') {
    return ExpansionFallbackModule.getCellValue(gameState, row, col);
  }
  if (gameState && Array.isArray(gameState.board) && Array.isArray(gameState.board[row]) && col >= 0 && col < gameState.board[row].length) {
    return gameState.board[row][col];
  }
  for (const cell of getExpansionCells(gameState)) {
    if (cell && cell.row === row && cell.col === col) return cell.owner;
  }
  return null;
}

function cleanupExpiredMeteorGod(cardState: MeteorGodCardState): void {
  const markers = cardState.markers;
  if (!Array.isArray(markers)) return;
  cardState.markers = markers.filter((marker) => (
    marker.kind !== 'specialStone' ||
    !marker.data ||
    marker.data.type !== 'METEOR_GOD' ||
    (Number.isFinite(Number(marker.data.remainingOwnerTurns)) && Number(marker.data.remainingOwnerTurns) >= 0)
  ));
}

function resolveRandomFn(randomLike: MeteorGodRandomLike | (() => number) | null | undefined): () => number {
  if (RandomSourceModule && typeof RandomSourceModule.resolveRandomFunction === 'function') {
    return RandomSourceModule.resolveRandomFunction(randomLike, null, 'CardMeteorGod');
  }
  if (typeof randomLike === 'function') return randomLike;
  if (randomLike && typeof randomLike.random === 'function') {
    return function (): number { return randomLike.random!(); };
  }
  throw new Error('CardMeteorGod requires an injected deterministic PRNG.');
}

function resolveRandomIndex(length: number, randomFn: () => number): number {
  if (length <= 0) return -1;
  if (RandomSourceModule && typeof RandomSourceModule.resolveRandomIndex === 'function') {
    return RandomSourceModule.resolveRandomIndex(length, { random: randomFn }, null, 'CardMeteorGod');
  }
  const raw = Number(randomFn());
  if (!Number.isFinite(raw)) {
    throw new Error('CardMeteorGod received a PRNG that returned a non-finite value.');
  }
  const normalized = Math.max(0, Math.min(0.999999, raw));
  return Math.max(0, Math.min(length - 1, Math.floor(normalized * length)));
}

function isManifestTarget(cardState: MeteorGodCardState, row: number, col: number): boolean {
  if (CardMarkersModule && typeof CardMarkersModule.isManifestStoneAt === 'function') {
    return CardMarkersModule.isManifestStoneAt(cardState, row, col) === true;
  }
  return (cardState.markers || []).some((marker) => (
    marker &&
    marker.row === row &&
    marker.col === col &&
    (marker.kind === 'manifestStone' || marker.kind === 'specialStone') &&
    MANIFEST_STONE_TYPES.has(String(marker.data && marker.data.type || '').toUpperCase())
  ));
}

function collectEnemyTargets(cardState: MeteorGodCardState, gameState: MeteorGodGameState, enemyValue: MeteorGodOwnerValue): MeteorGodEffectPosition[] {
  const targets: MeteorGodEffectPosition[] = [];
  const dims = resolveBoardDims(gameState);
  for (let row = 0; row < dims.rows; row += 1) {
    for (let col = 0; col < dims.cols; col += 1) {
      if (gameState.board && gameState.board[row][col] === enemyValue && !isManifestTarget(cardState, row, col)) targets.push({ row, col });
    }
  }
  for (const cell of getExpansionCells(gameState)) {
    if (cell && cell.owner === enemyValue && !isManifestTarget(cardState, cell.row, cell.col)) targets.push({ row: cell.row, col: cell.col });
  }
  return targets;
}

function expireAnchor(
  cardState: MeteorGodCardState,
  gameState: MeteorGodGameState,
  playerKey: MeteorGodSeatKey,
  row: number,
  col: number,
  marker: MeteorGodMarker,
  options: MeteorGodProcessDeps,
  expired: MeteorGodExpiredPosition[]
): void {
  let reverted = false;
  if (options.BoardOps && typeof options.BoardOps.revertSpecialStoneAt === 'function') {
    const res = options.BoardOps.revertSpecialStoneAt(cardState, gameState, row, col, 'METEOR_GOD', playerKey, 'METEOR_GOD', 'anchor_expired');
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
      entry.data.type === 'METEOR_GOD'
    ));
    reverted = true;
  }
  if (reverted) expired.push({ row, col, owner: playerKey, reason: 'anchor_expired' });
  if (marker && marker.data) marker.data.remainingOwnerTurns = -1;
}

function processAnchor(cardState: MeteorGodCardState, gameState: MeteorGodGameState, playerKey: MeteorGodSeatKey, row: number, col: number, options: MeteorGodProcessDeps): MeteorGodProcessResult {
  const randomFn = resolveRandomFn(options.random);
  const destroyed: MeteorGodDestroyedPosition[] = [];
  const anchors: Array<MeteorGodEffectPosition & { remainingNow: number }> = [];
  const expired: MeteorGodExpiredPosition[] = [];
  const playerValue = playerKey === 'black' ? BLACK : WHITE;
  const enemyValue = -playerValue;
  const shouldDecrement = options.decrementRemainingOwnerTurns !== false;

  const marker = (cardState.markers || []).find((entry) => (
    entry &&
    entry.kind === 'specialStone' &&
    entry.data &&
    entry.data.type === 'METEOR_GOD' &&
    entry.owner === playerKey &&
    entry.row === row &&
    entry.col === col
  ));

  if (!marker) return { destroyed, anchors, expired };
  if (getCellValue(gameState, row, col) !== playerValue) {
    if (marker.data) marker.data.remainingOwnerTurns = -1;
    cleanupExpiredMeteorGod(cardState);
    return { destroyed, anchors, expired };
  }

  const resolveAnchor = (): MeteorGodProcessResult => {
    const targets = collectEnemyTargets(cardState, gameState, enemyValue);
    if (targets.length > 0) {
      const target = targets[resolveRandomIndex(targets.length, randomFn)];
      const cellRemovalDeps = {
        applyCellRemovalAt: options.applyCellRemovalAt || (options.BoardOps && options.BoardOps.applyCellRemovalAt),
        runCellRemovalBlock: options.runCellRemovalBlock || (options.BoardOps && options.BoardOps.runCellRemovalBlock)
      };
      const result = CardCellRemoval.applyHoleStyleCellRemoval(
        cardState,
        gameState,
        target.row,
        target.col,
        playerKey,
        'METEOR_GOD',
        'meteor_god_cell_destroy',
        cellRemovalDeps,
        {
          random: options.random || null,
          randomSource: options.random || null,
          destroyMeta: {
            sourceRow: row,
            sourceCol: col,
            projectileOwner: playerKey,
            projectileStone: 'normal'
          },
          holeMeta: {
            sourceRow: row,
            sourceCol: col
          }
        }
      );
      if (result && result.applied && result.destroyed) {
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

    cleanupExpiredMeteorGod(cardState);
    return { destroyed, anchors, expired };
  };

  const blockDeps = {
    runCellRemovalBlock: options.runCellRemovalBlock || (options.BoardOps && options.BoardOps.runCellRemovalBlock)
  };
  return CardCellRemoval.runHoleStyleCellRemovalBlock(
    cardState,
    gameState,
    blockDeps,
    resolveAnchor,
    {
      cause: 'METEOR_GOD',
      reason: 'meteor_god_cell_destroy',
      owner: playerKey,
      sourceRow: row,
      sourceCol: col,
      randomSource: options.random || null
    }
  );
}

function processMeteorGodEffects(cardState: MeteorGodCardState, gameState: MeteorGodGameState, playerKey: MeteorGodSeatKey, deps?: MeteorGodProcessDeps): MeteorGodProcessResult {
  const options = deps || {};
  const destroyed: MeteorGodDestroyedPosition[] = [];
  const anchors: Array<MeteorGodEffectPosition & { remainingNow: number }> = [];
  const expired: MeteorGodExpiredPosition[] = [];
  const markers = (cardState.markers || []).filter((entry) => (
    entry &&
    entry.kind === 'specialStone' &&
    entry.data &&
    entry.data.type === 'METEOR_GOD' &&
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

function processMeteorGodEffectsAtAnchor(cardState: MeteorGodCardState, gameState: MeteorGodGameState, playerKey: MeteorGodSeatKey, row: number, col: number, deps?: MeteorGodProcessDeps): MeteorGodProcessResult {
  return processAnchor(cardState, gameState, playerKey, row, col, deps || {});
}

function processMeteorGodEffectsAtTurnStartAnchor(cardState: MeteorGodCardState, gameState: MeteorGodGameState, playerKey: MeteorGodSeatKey, row: number, col: number, deps?: MeteorGodProcessDeps): MeteorGodProcessResult {
  return processAnchor(cardState, gameState, playerKey, row, col, deps || {});
}

const MeteorGodModule: MeteorGodModuleApi = {
  processMeteorGodEffects,
  processMeteorGodEffectsAtAnchor,
  processMeteorGodEffectsAtTurnStartAnchor
};

module.exports = MeteorGodModule;

export = MeteorGodModule;
