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
  getExpansionDescriptors?: (gameState: LightningGameState, cardState?: LightningCardState | null) => LightningExpansionCell[];
  getCellValue?: (gameState: LightningGameState, row: number, col: number, cardState?: LightningCardState | null) => LightningOwnerValue | null;
  setCellValue?: (gameState: LightningGameState, row: number, col: number, value: LightningOwnerValue, cardState?: LightningCardState | null) => boolean;
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

interface LightningCardMarkersModule {
  isManifestStoneAt?: (cardState: LightningCardState, row: number, col: number) => boolean;
}

type LightningRandomLike = (() => number) | { random: () => number };
type LightningDestroyAt = (cardState: LightningCardState, gameState: LightningGameState, row: number, col: number) => boolean;

interface LightningProcessDeps {
  random?: LightningRandomLike | null;
  anchorType?: string;
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
  SharedBoardUtils?: any;
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
const BoardUtils = safeRequire<any>('../../../shared/shared-board-utils') || root?.SharedBoardUtils || null;
const BoardOpsModule = safeRequire<LightningBoardOpsModule>('../board_ops') || root?.BoardOps || null;
const RandomSourceModule = safeRequire<LightningRandomSourceModule>('../cards-internal/random-source') || root?.CardRandomSource || null;
const CardMarkersModule = safeRequire<LightningCardMarkersModule>('./markers') || null;

const { BLACK: RAW_BLACK, WHITE: RAW_WHITE, EMPTY: RAW_EMPTY } = SharedConstants || {};

if (RAW_BLACK === undefined || RAW_WHITE === undefined || RAW_EMPTY === undefined) {
  throw new Error('SharedConstants missing required values');
}

const BLACK: LightningOwnerValue = RAW_BLACK;
const WHITE: LightningOwnerValue = RAW_WHITE;
const EMPTY: LightningOwnerValue = RAW_EMPTY;
const MANIFEST_STONE_TYPES = new Set(['THEORY_INCARNATION', 'BOARD_EXECUTOR', 'OBSERVER_WILL']);

if (!BoardUtils ||
    typeof BoardUtils.createBoardContext !== 'function' ||
    typeof BoardUtils.collectBoardCoordinates !== 'function' ||
    typeof BoardUtils.getCellValue !== 'function' ||
    typeof BoardUtils.setCellValue !== 'function') {
  throw new Error('SharedBoardUtils BoardContext access is required by CardLightning');
}

function createBoardContext(gameState: LightningGameState, cardState: LightningCardState): any {
  return BoardUtils.createBoardContext(gameState, cardState);
}

function collectBoardCells(gameState: LightningGameState, cardState: LightningCardState): Array<{ row: number; col: number; owner: LightningOwnerValue | null }> {
  const context = createBoardContext(gameState, cardState);
  return BoardUtils.collectBoardCoordinates(context).map((cell: { row: number; col: number }) => ({
    row: cell.row,
    col: cell.col,
    owner: BoardUtils.getCellValue(context, cell.row, cell.col)
  }));
}

function getCellValue(gameState: LightningGameState, row: number, col: number, cardState: LightningCardState): LightningOwnerValue | null {
  return BoardUtils.getCellValue(createBoardContext(gameState, cardState), row, col);
}

function setCellValue(gameState: LightningGameState, row: number, col: number, value: LightningOwnerValue, cardState: LightningCardState): boolean {
  return BoardUtils.setCellValue(createBoardContext(gameState, cardState), row, col, value);
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

function isManifestTarget(cardState: LightningCardState, row: number, col: number): boolean {
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

function collectEnemyTargets(cardState: LightningCardState, gameState: LightningGameState, enemyValue: LightningOwnerValue): LightningEffectPosition[] {
  const targets: LightningEffectPosition[] = [];
  for (const cell of collectBoardCells(gameState, cardState)) {
    if (cell.owner !== enemyValue) continue;
    if (isManifestTarget(cardState, cell.row, cell.col)) continue;
    targets.push({ row: cell.row, col: cell.col });
  }
  return targets;
}

function removeMarkerAt(cardState: LightningCardState, row: number, col: number): void {
  const markers = cardState.markers;
  if (!Array.isArray(markers)) return;
  cardState.markers = markers.filter((marker) => !(marker && marker.row === row && marker.col === col));
}

function fallbackDestroyAt(cardState: LightningCardState, gameState: LightningGameState, row: number, col: number): boolean {
  const current = getCellValue(gameState, row, col, cardState);
  if (current === null || current === EMPTY) return false;
  removeMarkerAt(cardState, row, col);
  setCellValue(gameState, row, col, EMPTY, cardState);
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

  const anchorType = String(options.anchorType || 'LIGHTNING').toUpperCase();
  const marker = (cardState.markers || []).find((entry) => (
    entry &&
    entry.kind === 'specialStone' &&
    entry.data &&
    String(entry.data.type || '').toUpperCase() === anchorType &&
    entry.owner === playerKey &&
    entry.row === row &&
    entry.col === col
  ));

  if (!marker) return { destroyed, anchors, expired };
  if (getCellValue(gameState, row, col, cardState) !== playerValue) {
    if (marker.data) marker.data.remainingOwnerTurns = -1;
    cleanupExpiredLightning(cardState);
    return { destroyed, anchors, expired };
  }

  const resolveAnchor = (): LightningProcessResult => {
  const targets = collectEnemyTargets(cardState, gameState, enemyValue);
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
  if (shouldDecrement && marker.data) marker.data.remainingOwnerTurns = after;

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
