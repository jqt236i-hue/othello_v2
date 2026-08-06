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
  getExpansionDescriptors?: (gameState: MeteorGodGameState, cardState?: MeteorGodCardState | null) => MeteorGodExpansionCell[];
  getCellValue?: (gameState: MeteorGodGameState, row: number, col: number, cardState?: MeteorGodCardState | null) => MeteorGodOwnerValue | null;
  setCellValue?: (gameState: MeteorGodGameState, row: number, col: number, value: MeteorGodOwnerValue, cardState?: MeteorGodCardState | null) => boolean;
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
  isInviolableCell: (cardState: MeteorGodCardState, row: number, col: number) => boolean;
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

const SharedConstants = (safeRequire('../../../shared-constants')
  || (typeof self !== 'undefined' ? (self as any).SharedConstants : null)) as MeteorGodSharedConstants | null;
const BoardUtils = safeRequire('../../../shared/shared-board-utils')
  || (typeof self !== 'undefined' ? (self as any).SharedBoardUtils : null);
const BoardOpsModule: MeteorGodBoardOpsModule | null = safeRequire('../board_ops')
  || (typeof self !== 'undefined' ? (self as any).BoardOps : null);
const RandomSourceModule = safeRequire('./random-source');
const CardMarkersModule: MeteorGodCardMarkersModule | null = safeRequire('./markers');
const CardCellRemoval = ((typeof module === 'object' && module.exports)
  ? safeRequire('./cell-removal')
  : null) || (typeof self !== 'undefined' ? (self as any).CardCellRemoval : null);

if (!SharedConstants ||
    SharedConstants.BLACK === undefined ||
    SharedConstants.WHITE === undefined ||
    SharedConstants.EMPTY === undefined) {
  throw new Error('SharedConstants missing required values');
}

const BLACK = SharedConstants.BLACK;
const WHITE = SharedConstants.WHITE;

if (!BoardUtils ||
    typeof BoardUtils.createBoardContext !== 'function' ||
    typeof BoardUtils.collectBoardCellValues !== 'function' ||
    typeof BoardUtils.getCellValue !== 'function') {
  throw new Error('SharedBoardUtils BoardContext access is required by CardMeteorGod');
}

if (!CardMarkersModule || typeof CardMarkersModule.isInviolableCell !== 'function') {
  throw new Error('CardMarkers.isInviolableCell is required by CardMeteorGod');
}
const RequiredCardMarkersModule: MeteorGodCardMarkersModule = CardMarkersModule;

if (!CardCellRemoval ||
    typeof CardCellRemoval.applyHoleStyleCellRemoval !== 'function' ||
    typeof CardCellRemoval.runHoleStyleCellRemovalBlock !== 'function') {
  throw new Error('CardCellRemoval missing required helpers');
}

function createBoardContext(gameState: MeteorGodGameState, cardState: MeteorGodCardState): any {
  return BoardUtils.createBoardContext(gameState, cardState);
}

function getCellValue(gameState: MeteorGodGameState, row: number, col: number, cardState: MeteorGodCardState): MeteorGodOwnerValue | null {
  return BoardUtils.getCellValue(createBoardContext(gameState, cardState), row, col);
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

function collectEnemyTargets(cardState: MeteorGodCardState, gameState: MeteorGodGameState, enemyValue: MeteorGodOwnerValue): MeteorGodEffectPosition[] {
  const targets: MeteorGodEffectPosition[] = [];
  for (const cell of BoardUtils.collectBoardCellValues(createBoardContext(gameState, cardState))) {
    if (cell.owner !== enemyValue) continue;
    if (RequiredCardMarkersModule.isInviolableCell(cardState, cell.row, cell.col) === true) continue;
    targets.push({ row: cell.row, col: cell.col });
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
  const boardOps = options.BoardOps || BoardOpsModule;
  let reverted = false;
  if (boardOps && typeof boardOps.revertSpecialStoneAt === 'function') {
    const res = boardOps.revertSpecialStoneAt(cardState, gameState, row, col, 'METEOR_GOD', playerKey, 'METEOR_GOD', 'anchor_expired');
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
  if (getCellValue(gameState, row, col, cardState) !== playerValue) {
    if (marker.data) marker.data.remainingOwnerTurns = -1;
    cleanupExpiredMeteorGod(cardState);
    return { destroyed, anchors, expired };
  }

  const resolveAnchor = (): MeteorGodProcessResult => {
    const targets = collectEnemyTargets(cardState, gameState, enemyValue);
    if (targets.length > 0) {
      const target = targets[resolveRandomIndex(targets.length, randomFn)];
      const boardOps = options.BoardOps || BoardOpsModule;
      const cellRemovalDeps = {
        applyCellRemovalAt: options.applyCellRemovalAt || (boardOps && boardOps.applyCellRemovalAt),
        runCellRemovalBlock: options.runCellRemovalBlock || (boardOps && boardOps.runCellRemovalBlock)
      };
      if (typeof cellRemovalDeps.applyCellRemovalAt !== 'function') {
        throw new Error('BoardOps.applyCellRemovalAt is required by CardMeteorGod');
      }
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

  const boardOps = options.BoardOps || BoardOpsModule;
  const blockDeps = {
    runCellRemovalBlock: options.runCellRemovalBlock || (boardOps && boardOps.runCellRemovalBlock)
  };
  if (typeof blockDeps.runCellRemovalBlock !== 'function') {
    throw new Error('BoardOps.runCellRemovalBlock is required by CardMeteorGod');
  }
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
