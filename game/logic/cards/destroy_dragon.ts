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
  getExpansionDescriptors?: (gameState: DestroyDragonGameState, cardState?: DestroyDragonCardState | null) => DestroyDragonExpansionCell[];
  getCellValue?: (gameState: DestroyDragonGameState, row: number, col: number, cardState?: DestroyDragonCardState | null) => DestroyDragonOwnerValue | null;
  setCellValue?: (gameState: DestroyDragonGameState, row: number, col: number, value: DestroyDragonOwnerValue, cardState?: DestroyDragonCardState | null) => boolean;
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

interface DestroyDragonCardMarkersModule {
  isManifestStoneAt?: (cardState: DestroyDragonCardState, row: number, col: number) => boolean;
}

interface DestroyDragonBoardKernelModule {
  createBoardContext?: (gameState: DestroyDragonGameState, cardState?: DestroyDragonCardState | null) => unknown;
  getCellValue?: (context: unknown, row: number, col: number) => DestroyDragonOwnerValue | null;
  setCellValue?: (context: unknown, row: number, col: number, value: DestroyDragonOwnerValue) => boolean;
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
  SharedBoardUtils?: DestroyDragonBoardKernelModule | null;
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
const BoardKernelModule = safeRequire<DestroyDragonBoardKernelModule>('../../../shared/shared-board-utils') || root?.SharedBoardUtils || null;
const BoardOpsModule = safeRequire<DestroyDragonBoardOpsModule>('../board_ops') || root?.BoardOps || null;
const RandomSourceModule = safeRequire<DestroyDragonRandomSourceModule>('../cards-internal/random-source') || root?.CardRandomSource || null;
const CardMarkersModule = safeRequire<DestroyDragonCardMarkersModule>('./markers') || null;

const { BLACK: RAW_BLACK, WHITE: RAW_WHITE, EMPTY: RAW_EMPTY } = SharedConstants || {};

if (RAW_BLACK === undefined || RAW_WHITE === undefined || RAW_EMPTY === undefined) {
  throw new Error('SharedConstants missing required values');
}

const BLACK: DestroyDragonOwnerValue = RAW_BLACK;
const WHITE: DestroyDragonOwnerValue = RAW_WHITE;
const EMPTY: DestroyDragonOwnerValue = RAW_EMPTY;
const MANIFEST_STONE_TYPES = new Set(['THEORY_INCARNATION', 'BOARD_EXECUTOR', 'OBSERVER_WILL']);

if (!BoardKernelModule ||
    typeof BoardKernelModule.createBoardContext !== 'function' ||
    typeof BoardKernelModule.getCellValue !== 'function' ||
    typeof BoardKernelModule.setCellValue !== 'function') {
  throw new Error('SharedBoardUtils BoardContext APIs are required by CardDestroyDragon');
}
const RequiredBoardKernelModule = BoardKernelModule as Required<Pick<
  DestroyDragonBoardKernelModule,
  'createBoardContext' | 'getCellValue' | 'setCellValue'
>>;

function createDestroyDragonBoardContext(
  cardState: DestroyDragonCardState,
  gameState: DestroyDragonGameState
): unknown {
  return RequiredBoardKernelModule.createBoardContext(gameState, cardState);
}

function getCellValue(gameState: DestroyDragonGameState, row: number, col: number, cardState: DestroyDragonCardState): DestroyDragonOwnerValue | null {
  if (BoardOpsModule && typeof BoardOpsModule.getCellValue === 'function') {
    return BoardOpsModule.getCellValue(gameState, row, col, cardState);
  }
  return RequiredBoardKernelModule.getCellValue(createDestroyDragonBoardContext(cardState, gameState), row, col);
}

function setCellValue(gameState: DestroyDragonGameState, row: number, col: number, value: DestroyDragonOwnerValue, cardState: DestroyDragonCardState): boolean {
  if (BoardOpsModule && typeof BoardOpsModule.setCellValue === 'function') {
    return BoardOpsModule.setCellValue(gameState, row, col, value, cardState);
  }
  return RequiredBoardKernelModule.setCellValue(createDestroyDragonBoardContext(cardState, gameState), row, col, value);
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

function isManifestTarget(cardState: DestroyDragonCardState, row: number, col: number): boolean {
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

function collectAdjacentEnemyTargets(cardState: DestroyDragonCardState, gameState: DestroyDragonGameState, sourceRow: number, sourceCol: number, enemyValue: DestroyDragonOwnerValue): DestroyDragonEffectPosition[] {
  const targets: DestroyDragonEffectPosition[] = [];
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      if (dr === 0 && dc === 0) continue;
      const row = sourceRow + dr;
      const col = sourceCol + dc;
      if (getCellValue(gameState, row, col, cardState) === enemyValue && !isManifestTarget(cardState, row, col)) targets.push({ row, col });
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
  const current = getCellValue(gameState, row, col, cardState);
  if (current === null || current === EMPTY) return false;
  removeMarkerAt(cardState, row, col);
  setCellValue(gameState, row, col, EMPTY, cardState);
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
  if (getCellValue(gameState, row, col, cardState) !== playerValue) {
    if (marker.data) marker.data.remainingOwnerTurns = -1;
    cleanupExpiredDestroyDragons(cardState);
    return { destroyed, anchors, expired };
  }

  const resolveAnchor = (): DestroyDragonProcessResult => {
  const targets = collectAdjacentEnemyTargets(cardState, gameState, row, col, enemyValue);
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
