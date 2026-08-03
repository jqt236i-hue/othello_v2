import { getMaxBoardLocalEffectGutterCells } from '../board-visual/effect-bounds';
import {
  getBoardViewportMaterializationWindow,
  materializeBoardViewport
} from '../board-visual/model';
import { worldToScene } from '../board-visual/layout';
import type {
  BoardSourceTrajectoryDirection,
  BoardSourceTrajectoryPrimitive,
  BoardSourceTrajectoryProfileKey,
  BoardSourceTrajectoryRequest
} from '../board-visual/source-trajectory';
import type {
  BoardMarkerVisualState,
  BoardStoneVisualState,
  BoardVisualFrame,
  BoardWorldWindow,
  MaterializedBoardCellVisualState
} from '../board-visual/types';
import type { PixiBoardCanvasViewport } from './camera';
import { createObjectPool, type ObjectPool } from './pools';
import {
  addPixiChild,
  clearPixiGraphics,
  createPixiContainer,
  createPixiGraphics,
  createPixiSprite,
  createPixiText,
  destroyPixiDisplayObject,
  drawPixiBoardFrameHoleInnerEdges,
  drawPixiBoardFrameHoleSurface,
  drawPixiCircle,
  drawPixiLine,
  drawPixiPolygon,
  drawPixiRect,
  removePixiFromParent,
  resolvePixiStaticTexture,
  setPixiAnchor,
  setPixiPosition,
  setPixiScale,
  type PixiCellView,
  type BoardFrameInnerBoundaryEdge,
  type PixiStaticBoardTextureMode,
  type PixiStaticTextureSource,
  type PixiStaticViewContext,
  type PixiStaticViewRuntime,
  createPixiCellView
} from './cell-view';
import { createPixiHintView, type PixiHintView } from './hint-view';
import {
  createPixiStoneView,
  hasPixiStoneVisual,
  type PixiStoneView,
  type PixiStoneViewDiagnostics
} from './stone-view';
import {
  createPixiStaticBoardLayer,
  type PixiStaticBoardLayer
} from './static-board-layer';

export const PIXI_BOARD_SCENE_LAYER_ORDER = Object.freeze([
  'surface',
  'cell',
  'marker',
  'stone',
  'hint',
  'playback',
  'effect',
  'interaction'
] as const);

export const PIXI_BOARD_OBJECT_OVERSCAN_CELLS = 1;

export type PixiBoardSceneLayerName = typeof PIXI_BOARD_SCENE_LAYER_ORDER[number];

export const PIXI_BOARD_VIEWPORT_CLIPPED_LAYER_NAMES = Object.freeze([
  'surface',
  'cell',
  'marker',
  'stone',
  'hint'
] as const);

export type PixiBoardViewportClippedLayerName =
  typeof PIXI_BOARD_VIEWPORT_CLIPPED_LAYER_NAMES[number];

export interface PixiBoardViewportClipRect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export interface PixiBoardSceneOptions {
  readonly runtime: PixiStaticViewRuntime;
  readonly stage?: any;
  readonly renderer?: any;
  readonly effectGutterCells?: number;
  readonly maxRetainedViews?: number;
  readonly maxRetainedGhosts?: number;
  readonly maxRetainedEffects?: number;
}

export interface PixiSourceTrajectoryPoint {
  readonly x: number;
  readonly y: number;
}

export interface PixiSourceTrajectoryRect {
  readonly left: number;
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
  readonly width: number;
  readonly height: number;
}

export interface PixiSourceTrajectoryVisibleSegment {
  readonly start: PixiSourceTrajectoryPoint;
  readonly end: PixiSourceTrajectoryPoint;
  /** Parametric interval along movementStart -> movementEnd. */
  readonly startT: number;
  readonly endT: number;
}

/** Frozen at trajectory start; later reflow/skin frames must not move it. */
export interface PixiSourceTrajectoryGeometrySnapshot {
  readonly frameToken: string;
  readonly layoutRevision: number;
  readonly topologySignature: string;
  readonly direction: BoardSourceTrajectoryDirection;
  readonly cellSize: number;
  readonly sourceCenter: PixiSourceTrajectoryPoint;
  readonly targetCenter: PixiSourceTrajectoryPoint;
  readonly movementStart: PixiSourceTrajectoryPoint;
  readonly movementEnd: PixiSourceTrajectoryPoint;
  readonly distancePx: number;
  readonly angleRad: number;
  readonly visibleClip: PixiSourceTrajectoryRect;
  readonly paintedHaloClip: PixiSourceTrajectoryRect;
  readonly visibleSegment: PixiSourceTrajectoryVisibleSegment | null;
}

export interface PixiSourceTrajectorySpriteVisual {
  readonly x: number;
  readonly y: number;
  readonly size: number;
  readonly alpha: number;
  readonly scale?: number;
  readonly rotation?: number;
  readonly visible?: boolean;
}

export interface PixiSourceTrajectoryLineVisual {
  readonly points: readonly PixiSourceTrajectoryPoint[];
  readonly color: string | number;
  readonly alpha: number;
  readonly width: number;
}

export interface PixiSourceTrajectoryCircleVisual {
  readonly x: number;
  readonly y: number;
  readonly radius: number;
  readonly color: string | number;
  readonly alpha: number;
  readonly strokeColor?: string | number;
  readonly strokeAlpha?: number;
  readonly strokeWidth?: number;
}

export interface PixiSourceTrajectoryPolygonVisual {
  readonly points: readonly PixiSourceTrajectoryPoint[];
  readonly color: string | number;
  readonly alpha: number;
  readonly strokeColor?: string | number;
  readonly strokeAlpha?: number;
  readonly strokeWidth?: number;
}

export interface PixiSourceTrajectoryVisualState {
  readonly visible: boolean;
  readonly sprite?: PixiSourceTrajectorySpriteVisual | null;
  readonly lines?: readonly PixiSourceTrajectoryLineVisual[];
  readonly circles?: readonly PixiSourceTrajectoryCircleVisual[];
  readonly polygons?: readonly PixiSourceTrajectoryPolygonVisual[];
}

export interface PixiSourceTrajectoryOptions {
  readonly trajectoryId: string;
  readonly profileKey: BoardSourceTrajectoryProfileKey;
  readonly primitive: BoardSourceTrajectoryPrimitive;
  readonly geometry: PixiSourceTrajectoryGeometrySnapshot;
  /** Pixel mask only; logical source/target coordinates remain unchanged. */
  readonly clipRect?: PixiSourceTrajectoryRect | null;
  /** Ownership transfers to the scene record and is released exactly once. */
  readonly textureLease?: PixiSourceTrajectoryTextureLease | null;
}

export interface PixiSourceTrajectoryTextureLease {
  readonly texture: unknown;
  readonly released?: boolean;
  release(): boolean | void;
}

export interface PixiSourceTrajectoryHandle {
  readonly id: number;
  readonly scopeId: number;
}

export interface PixiSourceTrajectoryDiagnostics {
  readonly id: number;
  readonly scopeId: number;
  readonly trajectoryId: string;
  readonly profileKey: BoardSourceTrajectoryProfileKey;
  readonly primitive: BoardSourceTrajectoryPrimitive;
  readonly layoutRevision: number;
  readonly topologySignature: string;
  readonly visible: boolean;
  readonly spriteVisible: boolean;
  readonly lineCount: number;
  readonly circleCount: number;
  readonly polygonCount: number;
  readonly geometry: PixiSourceTrajectoryGeometrySnapshot;
}

export interface PixiSourceTrajectoryCounterDiagnostics {
  readonly started: number;
  readonly active: number;
  readonly released: number;
}

export interface PixiBoardSceneApplyContext {
  readonly textures?: PixiStaticTextureSource | null;
  /** Stable identity for board/surface texture resources only. */
  readonly surfaceTextureRevision?: string | number | null;
  /** Stable identity for stone texture resources only. */
  readonly stoneTextureRevision?: string | number | null;
  /** Compatibility fallback when callers cannot partition texture resources. */
  readonly textureRevision?: string | number | null;
  readonly canvasViewport?: Pick<PixiBoardCanvasViewport, 'sceneOffsetX' | 'sceneOffsetY'> | null;
  /** Added topology cells are baked into a separate alpha-controlled patch. */
  readonly topologyRevealKeys?: readonly string[];
  /** Resize/scroll reflow must not settle an in-flight playback projection. */
  readonly preservePlaybackProjection?: boolean;
}

export interface PixiPlaybackProjectionScope {
  readonly id: number;
  readonly key: string;
}

export interface PixiRetainedStoneOverride {
  readonly offsetX?: number;
  readonly offsetY?: number;
  readonly scaleX?: number;
  readonly scaleY?: number;
  /** Pixi rotation in radians. */
  readonly rotation?: number;
  readonly alpha?: number;
}

export interface PixiPlaybackGhostOptions {
  readonly row: number;
  readonly col: number;
  readonly stone?: BoardStoneVisualState | null;
  readonly markers?: readonly BoardMarkerVisualState[];
}

export interface PixiPlaybackGhostUpdate extends PixiRetainedStoneOverride {
  readonly row?: number;
  readonly col?: number;
  readonly visible?: boolean;
}

export interface PixiPlaybackGhostHandle {
  readonly id: number;
  readonly scopeId: number;
}

export type PixiPlaybackCellHighlightTone = 'placement' | 'positive' | 'negative';

export interface PixiPlaybackCellHighlightHandle {
  readonly id: number;
  readonly scopeId: number;
}

export type PixiPlaybackEffectKind =
  | 'aura'
  | 'impact'
  | 'pulse'
  | 'roulette'
  | 'topology';

export type PixiPlaybackEffectTone =
  | 'blue'
  | 'gold'
  | 'green'
  | 'purple'
  | 'red'
  | 'white';

export interface PixiPlaybackEffectOptions {
  readonly row: number;
  readonly col: number;
  readonly family: string;
  readonly kind: PixiPlaybackEffectKind;
  readonly tone?: PixiPlaybackEffectTone;
  readonly label?: string | number | null;
  /** BOARD_FRAME topology effect edges that border final playable cells. */
  readonly innerBoundaryEdges?: readonly BoardFrameInnerBoundaryEdge[];
}

export interface PixiPlaybackEffectUpdate {
  readonly alpha?: number;
  readonly scale?: number;
  readonly rotation?: number;
  readonly visible?: boolean;
}

export interface PixiPlaybackEffectHandle {
  readonly id: number;
  readonly scopeId: number;
}

export interface PixiTopologyRevealHandle {
  readonly id: number;
}

export interface PixiPlaybackEffectDiagnostics {
  readonly id: number;
  readonly scopeId: number;
  readonly row: number;
  readonly col: number;
  readonly family: string;
  readonly kind: PixiPlaybackEffectKind;
  readonly tone: PixiPlaybackEffectTone;
  readonly label: string | null;
  readonly innerBoundaryEdges: readonly BoardFrameInnerBoundaryEdge[];
  readonly visible: boolean;
  readonly alpha: number;
  readonly scale: number;
  readonly rotation: number;
  readonly position: Readonly<{ x: number; y: number }>;
}

export interface PixiPlaybackGhostDiagnostics {
  readonly id: number;
  readonly scopeId: number;
  readonly row: number;
  readonly col: number;
  readonly visible: boolean;
  readonly owner: 'black' | 'white' | null;
  readonly position: Readonly<{ x: number; y: number }>;
  readonly offset: Readonly<{ x: number; y: number }>;
  readonly scale: Readonly<{ x: number; y: number }>;
  readonly rotation: number;
  readonly alpha: number;
}

export interface PixiBoardSceneApplyResult {
  readonly materializedCount: number;
  readonly createdViews: number;
  readonly reusedViews: number;
  readonly updatedViews: number;
  readonly updatedCellViews: number;
  readonly updatedStoneViews: number;
  readonly updatedHintViews: number;
  readonly hintPaintCount: number;
  readonly hintInputSyncCount: number;
  readonly skippedViews: number;
  readonly releasedViews: number;
  readonly materializationWindow: BoardWorldWindow | null;
}

export interface PixiBoardSceneRenderedCell {
  readonly key: string;
  readonly kind: MaterializedBoardCellVisualState['kind'] | null;
  readonly position: Readonly<{ x: number; y: number }>;
  readonly cell: ReturnType<PixiCellView['getDiagnostics']>;
  readonly stone: ReturnType<PixiStoneView['getDiagnostics']>;
  readonly hint: ReturnType<PixiHintView['getDiagnostics']>;
  readonly topologyRevealAlpha: number;
  readonly playback: Readonly<{
    hidden: boolean;
    overridden: boolean;
    offset: Readonly<{ x: number; y: number }>;
    scale: Readonly<{ x: number; y: number }>;
    rotation: number;
    alpha: number;
  }>;
}

export interface PixiBoardSceneDiagnostics {
  readonly destroyed: boolean;
  readonly applyCount: number;
  readonly resetCount: number;
  readonly activeViewCount: number;
  readonly pooledViewCount: number;
  readonly createdViewCount: number;
  readonly destroyedViewCount: number;
  readonly cumulativeUpdatedViewCount: number;
  readonly cumulativeUpdatedCellViewCount: number;
  readonly cumulativeUpdatedStoneViewCount: number;
  readonly cumulativeUpdatedHintViewCount: number;
  readonly cumulativeHintPaintCount: number;
  readonly cumulativeHintInputSyncCount: number;
  readonly cumulativeSkippedViewCount: number;
  readonly cumulativeReleasedViewCount: number;
  readonly boardSurfaceUpdateCount: number;
  readonly boardSurfaceSkippedCount: number;
  readonly displayObjectCount: number;
  readonly textureBackedStoneCount: number;
  readonly proceduralStoneCount: number;
  readonly ephemeralVoidCount: number;
  readonly holeCount: number;
  readonly starPointCount: number;
  readonly boardTextureMode: PixiStaticBoardTextureMode;
  readonly surfaceBoardTextureCount: number;
  readonly cellBoardTextureCount: number;
  readonly objectOverscanCells: number;
  readonly effectGutterCells: number;
  readonly viewportClippedLayerNames: readonly PixiBoardViewportClippedLayerName[];
  readonly viewportClipRect: PixiBoardViewportClipRect | null;
  readonly canvasCount: 0;
  readonly domNodeCount: 0;
  readonly layerOrder: readonly PixiBoardSceneLayerName[];
  readonly retainedKeys: readonly string[];
  readonly materializationWindow: BoardWorldWindow | null;
  readonly playbackScopeKey: string | null;
  readonly retainedStoneOverrideCount: number;
  readonly hiddenStoneCount: number;
  readonly activePlaybackGhostCount: number;
  /** DisplayObject-backed ghosts inside the current viewport materialization window. */
  readonly materializedPlaybackGhostCount: number;
  /** Aggregate retained stone and marker ghost views. */
  readonly pooledPlaybackGhostCount: number;
  readonly createdPlaybackGhostCount: number;
  readonly destroyedPlaybackGhostCount: number;
  readonly pooledPlaybackStoneGhostCount: number;
  readonly createdPlaybackStoneGhostCount: number;
  readonly destroyedPlaybackStoneGhostCount: number;
  readonly pooledPlaybackMarkerGhostCount: number;
  readonly createdPlaybackMarkerGhostCount: number;
  readonly destroyedPlaybackMarkerGhostCount: number;
  readonly activePlaybackHighlightLeaseCount: number;
  readonly renderedPlaybackHighlightCount: number;
  readonly pooledPlaybackHighlightCount: number;
  readonly activePlaybackEffectCount: number;
  /** DisplayObject-backed effects inside the current viewport materialization window. */
  readonly materializedPlaybackEffectCount: number;
  readonly pooledPlaybackEffectCount: number;
  readonly createdPlaybackEffectCount: number;
  readonly destroyedPlaybackEffectCount: number;
  readonly activeSourceTrajectoryCount: number;
  readonly activeSourceTrajectoryTextureLeaseCount: number;
  readonly pooledSourceTrajectoryCount: number;
  readonly createdSourceTrajectoryViewCount: number;
  readonly destroyedSourceTrajectoryViewCount: number;
  readonly sourceTrajectoryByProfile: Readonly<Record<BoardSourceTrajectoryProfileKey, PixiSourceTrajectoryCounterDiagnostics>>;
  readonly sourceTrajectoryByPrimitive: Readonly<Record<BoardSourceTrajectoryPrimitive, PixiSourceTrajectoryCounterDiagnostics>>;
  readonly activeTopologyRevealCount: number;
  readonly topologyRevealKeys: readonly string[];
  readonly activeStoneViewCount: number;
  readonly pooledStoneViewCount: number;
  readonly staticBakeCount: number;
  readonly staticBakeSkipCount: number;
  readonly staticPatchBakeCount: number;
  readonly staticAttachedObjectCount: number;
  readonly staticTemporaryObjectCount: number;
  readonly staticTexturePhysicalWidth: number;
  readonly staticTexturePhysicalHeight: number;
}

export interface PixiBoardScene {
  readonly root: any;
  readonly layers: Readonly<Record<PixiBoardSceneLayerName, any>>;
  applyFrame(frame: BoardVisualFrame, context?: PixiBoardSceneApplyContext): PixiBoardSceneApplyResult;
  /** Force retained views to rebuild after the active WebGL context is restored. */
  invalidateStaticViews(): void;
  beginPlaybackScope(scopeKey: string | number): PixiPlaybackProjectionScope;
  /** O(1) normal-play scope check. Full scene diagnostics stay debug-only. */
  isPlaybackScopeActive(scopeKey: string): boolean;
  retainStoneOverride(
    scope: PixiPlaybackProjectionScope,
    row: number,
    col: number,
    override: PixiRetainedStoneOverride
  ): void;
  hideStone(scope: PixiPlaybackProjectionScope, row: number, col: number): void;
  acquirePlaybackGhost(
    scope: PixiPlaybackProjectionScope,
    options: PixiPlaybackGhostOptions
  ): PixiPlaybackGhostHandle;
  updatePlaybackGhost(
    scope: PixiPlaybackProjectionScope,
    handle: PixiPlaybackGhostHandle,
    update: PixiPlaybackGhostUpdate
  ): void;
  releasePlaybackGhost(
    scope: PixiPlaybackProjectionScope,
    handle: PixiPlaybackGhostHandle
  ): void;
  acquirePlaybackCellHighlight(
    scope: PixiPlaybackProjectionScope,
    row: number,
    col: number,
    tone: PixiPlaybackCellHighlightTone
  ): PixiPlaybackCellHighlightHandle;
  releasePlaybackCellHighlight(
    scope: PixiPlaybackProjectionScope,
    handle: PixiPlaybackCellHighlightHandle
  ): void;
  acquirePlaybackEffect(
    scope: PixiPlaybackProjectionScope,
    options: PixiPlaybackEffectOptions
  ): PixiPlaybackEffectHandle;
  updatePlaybackEffect(
    scope: PixiPlaybackProjectionScope,
    handle: PixiPlaybackEffectHandle,
    update: PixiPlaybackEffectUpdate
  ): void;
  releasePlaybackEffect(
    scope: PixiPlaybackProjectionScope,
    handle: PixiPlaybackEffectHandle
  ): void;
  snapshotSourceTrajectoryGeometry(
    request: Pick<BoardSourceTrajectoryRequest, 'source' | 'target' | 'direction'>
  ): PixiSourceTrajectoryGeometrySnapshot;
  acquireSourceTrajectory(
    scope: PixiPlaybackProjectionScope,
    options: PixiSourceTrajectoryOptions
  ): PixiSourceTrajectoryHandle;
  updateSourceTrajectory(
    scope: PixiPlaybackProjectionScope,
    handle: PixiSourceTrajectoryHandle,
    visual: PixiSourceTrajectoryVisualState
  ): void;
  releaseSourceTrajectory(
    scope: PixiPlaybackProjectionScope,
    handle: PixiSourceTrajectoryHandle
  ): void;
  getSourceTrajectory(handle: PixiSourceTrajectoryHandle): PixiSourceTrajectoryDiagnostics | null;
  getPlaybackGhost(handle: PixiPlaybackGhostHandle): PixiPlaybackGhostDiagnostics | null;
  getPlaybackEffect(handle: PixiPlaybackEffectHandle): PixiPlaybackEffectDiagnostics | null;
  beginTopologyReveal(keys: readonly string[], initialProgress?: number): PixiTopologyRevealHandle;
  updateTopologyReveal(handle: PixiTopologyRevealHandle, progress: number): void;
  endTopologyReveal(handle: PixiTopologyRevealHandle): void;
  resetPlaybackProjection(scope?: PixiPlaybackProjectionScope): void;
  getRenderedCell(row: number, col: number): PixiBoardSceneRenderedCell | null;
  getDiagnostics(): PixiBoardSceneDiagnostics;
  reset(): void;
  destroy(): void;
}

interface RetainedCellViews {
  readonly hint: PixiHintView;
}

type PlaybackGhostView =
  | Readonly<{ kind: 'stone'; view: PixiStoneView }>
  | Readonly<{ kind: 'marker'; view: PixiCellView }>;

interface PlaybackGhostRecord {
  readonly handle: PixiPlaybackGhostHandle;
  readonly visualKind: 'stone' | 'marker';
  view: PlaybackGhostView | null;
  readonly cell: MaterializedBoardCellVisualState;
  row: number;
  col: number;
  transform: Required<PixiPlaybackGhostUpdate>;
}

interface PlaybackHighlightLease {
  readonly handle: PixiPlaybackCellHighlightHandle;
  readonly key: string;
  readonly row: number;
  readonly col: number;
  readonly tone: PixiPlaybackCellHighlightTone;
}

interface PlaybackEffectView {
  readonly root: any;
  readonly graphics: any;
  readonly label: any | null;
}

interface PlaybackEffectRecord {
  readonly handle: PixiPlaybackEffectHandle;
  view: PlaybackEffectView | null;
  readonly options: Readonly<{
    row: number;
    col: number;
    family: string;
    kind: PixiPlaybackEffectKind;
    tone: PixiPlaybackEffectTone;
    label: string | null;
    innerBoundaryEdges: readonly BoardFrameInnerBoundaryEdge[];
  }>;
  transform: Required<PixiPlaybackEffectUpdate>;
}

interface SourceTrajectoryView {
  readonly root: any;
  readonly mask: any;
  readonly graphics: any;
  readonly sprite: any | null;
}

interface SourceTrajectoryRecord {
  readonly handle: PixiSourceTrajectoryHandle;
  readonly trajectoryId: string;
  readonly profileKey: BoardSourceTrajectoryProfileKey;
  readonly primitive: BoardSourceTrajectoryPrimitive;
  readonly geometry: PixiSourceTrajectoryGeometrySnapshot;
  readonly textureLease: PixiSourceTrajectoryTextureLease | null;
  view: SourceTrajectoryView | null;
  visual: PixiSourceTrajectoryVisualState;
  disposed: boolean;
}

interface TopologyRevealRecord {
  readonly handle: PixiTopologyRevealHandle;
  readonly keys: ReadonlySet<string>;
  progress: number;
}

const maximumGutter = getMaxBoardLocalEffectGutterCells();
const DEFAULT_EFFECT_GUTTER_CELLS = Math.max(
  maximumGutter.top,
  maximumGutter.right,
  maximumGutter.bottom,
  maximumGutter.left
);

function normalizeEffectGutter(value: unknown): number {
  if (typeof value === 'undefined') return DEFAULT_EFFECT_GUTTER_CELLS;
  const numeric = Number(value);
  if (!Number.isInteger(numeric) || numeric < 0 || numeric > DEFAULT_EFFECT_GUTTER_CELLS) {
    throw new Error(`Pixi board scene effect gutter must be an integer from 0 to ${DEFAULT_EFFECT_GUTTER_CELLS}`);
  }
  return numeric;
}

function normalizeMaxRetainedViews(value: unknown): number {
  if (typeof value === 'undefined') return 256;
  const numeric = Number(value);
  if (!Number.isInteger(numeric) || numeric < 0) {
    throw new Error('Pixi board scene maxRetainedViews must be a non-negative integer');
  }
  return numeric;
}

function normalizeMaxRetainedGhosts(value: unknown): number {
  if (typeof value === 'undefined') return 64;
  const numeric = Number(value);
  if (!Number.isInteger(numeric) || numeric < 0) {
    throw new Error('Pixi board scene maxRetainedGhosts must be a non-negative integer');
  }
  return numeric;
}

function normalizeMaxRetainedEffects(value: unknown): number {
  if (typeof value === 'undefined') return 96;
  const numeric = Number(value);
  if (!Number.isInteger(numeric) || numeric < 0) {
    throw new Error('Pixi board scene maxRetainedEffects must be a non-negative integer');
  }
  return numeric;
}

function finiteNumber(value: unknown, fallback: number): number {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function integerWorldKey(row: unknown, col: unknown): string {
  const numericRow = Number(row);
  const numericCol = Number(col);
  if (!Number.isInteger(numericRow) || !Number.isInteger(numericCol)) {
    throw new Error('Pixi playback retained stone coordinates must be integers');
  }
  return `${numericRow},${numericCol}`;
}

function normalizeRetainedOverride(
  value: PixiRetainedStoneOverride,
  previous?: PixiRetainedStoneOverride
): Required<PixiRetainedStoneOverride> {
  const source = value && typeof value === 'object' ? value : {};
  const prior = previous || {};
  return Object.freeze({
    offsetX: finiteNumber(source.offsetX, finiteNumber(prior.offsetX, 0)),
    offsetY: finiteNumber(source.offsetY, finiteNumber(prior.offsetY, 0)),
    scaleX: finiteNumber(source.scaleX, finiteNumber(prior.scaleX, 1)),
    scaleY: finiteNumber(source.scaleY, finiteNumber(prior.scaleY, 1)),
    rotation: finiteNumber(source.rotation, finiteNumber(prior.rotation, 0)),
    alpha: Math.max(0, Math.min(1, finiteNumber(source.alpha, finiteNumber(prior.alpha, 1))))
  });
}

function normalizeGhostUpdate(
  value: PixiPlaybackGhostUpdate,
  previous?: Required<PixiPlaybackGhostUpdate>
): Required<PixiPlaybackGhostUpdate> {
  const source = value && typeof value === 'object' ? value : {};
  const transform = normalizeRetainedOverride(source, previous);
  return Object.freeze({
    ...transform,
    row: finiteNumber(source.row, finiteNumber(previous?.row, 0)),
    col: finiteNumber(source.col, finiteNumber(previous?.col, 0)),
    visible: typeof source.visible === 'boolean' ? source.visible : previous?.visible !== false
  });
}

const PLAYBACK_EFFECT_KINDS = new Set<PixiPlaybackEffectKind>([
  'aura',
  'impact',
  'pulse',
  'roulette',
  'topology'
]);

const PLAYBACK_EFFECT_TONES = new Set<PixiPlaybackEffectTone>([
  'blue',
  'gold',
  'green',
  'purple',
  'red',
  'white'
]);

function normalizePlaybackEffectOptions(
  value: PixiPlaybackEffectOptions
): PlaybackEffectRecord['options'] {
  const source = value && typeof value === 'object' ? value : {} as PixiPlaybackEffectOptions;
  const row = Number(source.row);
  const col = Number(source.col);
  if (!Number.isInteger(row) || !Number.isInteger(col)) {
    throw new Error('Pixi playback effect coordinates must be integers');
  }
  const family = String(source.family || '').trim();
  if (!family) throw new Error('Pixi playback effect family is required');
  const kind = source.kind;
  if (!PLAYBACK_EFFECT_KINDS.has(kind)) {
    throw new Error(`Pixi playback effect kind is unsupported: ${String(kind)}`);
  }
  const tone = source.tone || 'white';
  if (!PLAYBACK_EFFECT_TONES.has(tone)) {
    throw new Error(`Pixi playback effect tone is unsupported: ${String(tone)}`);
  }
  const label = source.label === null || typeof source.label === 'undefined'
    ? null
    : String(source.label);
  const allowedEdges = new Set<BoardFrameInnerBoundaryEdge>(['top', 'right', 'bottom', 'left']);
  const seenEdges = new Set<BoardFrameInnerBoundaryEdge>();
  const innerBoundaryEdges: BoardFrameInnerBoundaryEdge[] = [];
  for (const rawEdge of Array.isArray(source.innerBoundaryEdges) ? source.innerBoundaryEdges : []) {
    const edge = String(rawEdge || '').trim().toLowerCase() as BoardFrameInnerBoundaryEdge;
    if (!allowedEdges.has(edge) || seenEdges.has(edge)) continue;
    seenEdges.add(edge);
    innerBoundaryEdges.push(edge);
  }
  return Object.freeze({
    row,
    col,
    family,
    kind,
    tone,
    label,
    innerBoundaryEdges: Object.freeze(innerBoundaryEdges)
  });
}

function normalizePlaybackEffectUpdate(
  value: PixiPlaybackEffectUpdate,
  previous?: Required<PixiPlaybackEffectUpdate>
): Required<PixiPlaybackEffectUpdate> {
  const source = value && typeof value === 'object' ? value : {};
  return Object.freeze({
    alpha: Math.max(0, Math.min(1, finiteNumber(source.alpha, finiteNumber(previous?.alpha, 1)))),
    scale: Math.max(0, finiteNumber(source.scale, finiteNumber(previous?.scale, 1))),
    rotation: finiteNumber(source.rotation, finiteNumber(previous?.rotation, 0)),
    visible: typeof source.visible === 'boolean' ? source.visible : previous?.visible !== false
  });
}

function setPixiPivot(target: any, x: number, y = x): void {
  if (!target) return;
  if (target.pivot && typeof target.pivot.set === 'function') target.pivot.set(x, y);
  else target.pivot = { x, y };
}

function sortedWorldKeys(keys: Iterable<string>): string[] {
  return Array.from(keys).sort((a, b) => {
    const [aRow, aCol] = a.split(',').map(Number);
    const [bRow, bCol] = b.split(',').map(Number);
    return aRow - bRow || aCol - bCol;
  });
}

function countDisplayObjects(root: any): number {
  if (!root) return 0;
  const children = Array.isArray(root.children) ? root.children : [];
  return 1 + children.reduce((total: number, child: any) => total + countDisplayObjects(child), 0);
}

function rectangularHitArea(width: number, height: number): Readonly<{
  x: number;
  y: number;
  width: number;
  height: number;
  contains(x: number, y: number): boolean;
}> {
  return Object.freeze({
    x: 0,
    y: 0,
    width,
    height,
    contains: (x: number, y: number) => x >= 0 && x < width && y >= 0 && y < height
  });
}

function frameSurfaceRevisionSignature(
  frame: BoardVisualFrame,
  textureIdentity: string,
  boardTextureMode: PixiStaticBoardTextureMode
): string {
  return JSON.stringify([
    frame.layout.cellSize,
    frame.layout.orientation,
    frame.appearance.boardSkinId,
    frame.appearance.boardImageUrl,
    frame.appearance.boardFrameSkinId,
    frame.appearance.boardFrameLayout,
    frame.theme.fontReadyEpoch,
    frame.theme.surfaceColor,
    frame.theme.outerBoundaryColor,
    frame.theme.markerColor,
    frame.theme.gridLineWidth,
    frame.theme.boardBonus,
    frame.theme.timer,
    textureIdentity,
    boardTextureMode
  ]);
}

function frameStoneRevisionSignature(frame: BoardVisualFrame, textureIdentity: string): string {
  return JSON.stringify([
    frame.layout.cellSize,
    frame.layout.stageScale,
    frame.layout.cellScale,
    frame.layout.orientation,
    frame.appearance.stoneSkinId,
    frame.appearance.blackStoneImageUrl,
    frame.appearance.whiteStoneImageUrl,
    frame.theme.fontReadyEpoch,
    frame.theme.directionHint,
    frame.theme.hintColor,
    frame.theme.timer,
    textureIdentity
  ]);
}

function frameInteractionRevisionSignature(
  frame: BoardVisualFrame,
  boardTextureMode: PixiStaticBoardTextureMode
): string {
  return JSON.stringify([
    frame.layout.cellSize,
    frame.layout.orientation,
    frame.theme.fontReadyEpoch,
    frame.theme.directionHint,
    frame.theme.gridLineWidth,
    frame.theme.legalHint,
    boardTextureMode
  ]);
}

function resetRetainedViews(views: RetainedCellViews): void {
  for (const target of [
    views.hint.surfaceRoot,
    views.hint.root,
    views.hint.interactionRoot
  ]) {
    if (target) target.alpha = 1;
  }
  views.hint.reset();
}

function destroyRetainedViews(views: RetainedCellViews): void {
  views.hint.destroy();
}

const SOURCE_TRAJECTORY_PROFILE_KEYS: readonly BoardSourceTrajectoryProfileKey[] = Object.freeze([
  'sniperShot',
  'robotVacuumSuck',
  'destroyDragonBreath',
  'meteorGodBlackBeam',
  'lightningDestroyed',
  'udgDestroyed',
  'fireWillFlameBeam',
  'waterWillHealingBeam',
  'grassWillSeedBeam',
  'zombieBite'
]);

const SOURCE_TRAJECTORY_PRIMITIVES: readonly BoardSourceTrajectoryPrimitive[] = Object.freeze([
  'projectile',
  'suction',
  'beam',
  'lightning',
  'bite'
]);

function trajectoryPoint(x: unknown, y: unknown): PixiSourceTrajectoryPoint {
  return Object.freeze({ x: finiteNumber(x, 0), y: finiteNumber(y, 0) });
}

function trajectoryRect(
  left: unknown,
  top: unknown,
  right: unknown,
  bottom: unknown
): PixiSourceTrajectoryRect {
  const normalizedLeft = finiteNumber(left, 0);
  const normalizedTop = finiteNumber(top, 0);
  const normalizedRight = Math.max(normalizedLeft, finiteNumber(right, normalizedLeft));
  const normalizedBottom = Math.max(normalizedTop, finiteNumber(bottom, normalizedTop));
  return Object.freeze({
    left: normalizedLeft,
    top: normalizedTop,
    right: normalizedRight,
    bottom: normalizedBottom,
    width: normalizedRight - normalizedLeft,
    height: normalizedBottom - normalizedTop
  });
}

function clipTrajectorySegment(
  start: PixiSourceTrajectoryPoint,
  end: PixiSourceTrajectoryPoint,
  rect: PixiSourceTrajectoryRect
): PixiSourceTrajectoryVisibleSegment | null {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  if (Math.abs(dx) < 1e-9 && Math.abs(dy) < 1e-9) {
    const inside = start.x >= rect.left && start.x <= rect.right
      && start.y >= rect.top && start.y <= rect.bottom;
    return inside
      ? Object.freeze({ start, end, startT: 0, endT: 1 })
      : null;
  }
  let startT = 0;
  let endT = 1;
  const boundaries = [
    [-dx, start.x - rect.left],
    [dx, rect.right - start.x],
    [-dy, start.y - rect.top],
    [dy, rect.bottom - start.y]
  ] as const;
  for (const [p, q] of boundaries) {
    if (Math.abs(p) < 1e-9) {
      if (q < 0) return null;
      continue;
    }
    const ratio = q / p;
    if (p < 0) startT = Math.max(startT, ratio);
    else endT = Math.min(endT, ratio);
    if (startT > endT) return null;
  }
  return Object.freeze({
    start: trajectoryPoint(start.x + dx * startT, start.y + dy * startT),
    end: trajectoryPoint(start.x + dx * endT, start.y + dy * endT),
    startT,
    endT
  });
}

function sourceTrajectoryTopologySignature(frame: BoardVisualFrame): string {
  const topology = frame.model.topology;
  return [
    topology.baseRows,
    topology.baseCols,
    topology.minRow,
    topology.maxRow,
    topology.minCol,
    topology.maxCol,
    topology.renderRowOffset,
    topology.renderColOffset,
    topology.renderRows,
    topology.renderCols,
    frame.layout.orientation
  ].join(':');
}

function makeTrajectoryCounterMap<K extends string>(keys: readonly K[]): Record<K, {
  started: number;
  active: number;
  released: number;
}> {
  return Object.fromEntries(keys.map((key) => [key, { started: 0, active: 0, released: 0 }])) as Record<K, {
    started: number;
    active: number;
    released: number;
  }>;
}

function freezeTrajectoryCounters<K extends string>(
  counters: Record<K, { started: number; active: number; released: number }>
): Readonly<Record<K, PixiSourceTrajectoryCounterDiagnostics>> {
  return Object.freeze(Object.fromEntries(Object.entries(counters).map(([key, value]) => [
    key,
    Object.freeze({ ...(value as PixiSourceTrajectoryCounterDiagnostics) })
  ]))) as Readonly<Record<K, PixiSourceTrajectoryCounterDiagnostics>>;
}

export function createPixiBoardScene(options: PixiBoardSceneOptions): PixiBoardScene {
  if (!options || !options.runtime) throw new Error('Pixi board scene runtime is required');
  const runtime = options.runtime;
  const effectGutterCells = normalizeEffectGutter(options.effectGutterCells);
  const maxRetainedViews = normalizeMaxRetainedViews(options.maxRetainedViews);
  const maxRetainedGhosts = normalizeMaxRetainedGhosts(options.maxRetainedGhosts);
  const maxRetainedEffects = normalizeMaxRetainedEffects(options.maxRetainedEffects);
  const root = createPixiContainer(runtime, 'pixi-board-scene');
  // Passive ancestors let Pixi traverse only the sparse materialized hit
  // objects while every visible pixel remains owned by the visual layers.
  root.eventMode = 'passive';
  const mutableLayers = {} as Record<PixiBoardSceneLayerName, any>;
  for (const name of PIXI_BOARD_SCENE_LAYER_ORDER) {
    const layer = createPixiContainer(runtime, `pixi-board-layer:${name}`);
    layer.eventMode = 'none';
    layer.sortableChildren = false;
    mutableLayers[name] = layer;
    addPixiChild(root, layer);
  }
  const layers = Object.freeze(mutableLayers);
  layers.interaction.eventMode = 'none';
  layers.interaction.cursor = 'default';
  layers.interaction.hitArea = null;
  const viewportMaskRoot = createPixiContainer(runtime, 'pixi-board-viewport-masks');
  viewportMaskRoot.eventMode = 'none';
  const mutableViewportMasks = {} as Record<PixiBoardViewportClippedLayerName, any>;
  for (const name of PIXI_BOARD_VIEWPORT_CLIPPED_LAYER_NAMES) {
    const mask = createPixiGraphics(runtime, `pixi-board-viewport-mask:${name}`);
    mask.eventMode = 'none';
    mutableViewportMasks[name] = mask;
    layers[name].mask = mask;
    addPixiChild(viewportMaskRoot, mask);
  }
  const viewportMasks = Object.freeze(mutableViewportMasks);
  addPixiChild(layers.interaction, viewportMaskRoot);
  if (options.stage) addPixiChild(options.stage, root);
  const staticBoardLayer: PixiStaticBoardLayer = createPixiStaticBoardLayer({
    runtime,
    renderer: options.renderer,
    parent: layers.surface
  });
  const boardSurfaceFill = createPixiGraphics(runtime, 'pixi-board-surface-fill');
  const boardSurfaceTexture = createPixiSprite(runtime, 'pixi-board-surface-texture');
  const boardSurfaceOverlay = createPixiGraphics(runtime, 'pixi-board-surface-overlay');
  const starPoints = createPixiGraphics(runtime, 'pixi-board-star-points');
  const pool: ObjectPool<RetainedCellViews> = createObjectPool({
    create: () => Object.freeze({
      hint: createPixiHintView(runtime)
    }),
    reset: resetRetainedViews,
    destroy: destroyRetainedViews,
    maxRetained: maxRetainedViews
  });
  const stonePool: ObjectPool<PixiStoneView> = createObjectPool({
    create: () => createPixiStoneView(runtime),
    reset: (view) => view.reset(),
    destroy: (view) => view.destroy(),
    maxRetained: maxRetainedViews
  });
  const playbackGhostPool: ObjectPool<PixiStoneView> = createObjectPool({
    create: () => createPixiStoneView(runtime),
    reset: (view) => view.reset(),
    destroy: (view) => view.destroy(),
    maxRetained: maxRetainedGhosts
  });
  const playbackMarkerGhostPool: ObjectPool<PixiCellView> = createObjectPool({
    create: () => createPixiCellView(runtime),
    reset: (view) => view.reset(),
    destroy: (view) => view.destroy(),
    maxRetained: maxRetainedGhosts
  });
  const playbackHighlightPool: ObjectPool<any> = createObjectPool({
    create: () => createPixiGraphics(runtime, 'pixi-playback-cell-highlight'),
    reset: (view) => {
      clearPixiGraphics(view);
      view.visible = false;
      removePixiFromParent(view);
    },
    destroy: destroyPixiDisplayObject,
    maxRetained: maxRetainedGhosts
  });
  const playbackEffectPool: ObjectPool<PlaybackEffectView> = createObjectPool({
    create: () => {
      const root = createPixiContainer(runtime, 'pixi-playback-effect');
      const graphics = createPixiGraphics(runtime, 'pixi-playback-effect-graphics');
      const label = createPixiText(runtime, 'pixi-playback-effect-label');
      addPixiChild(root, graphics, label);
      return Object.freeze({ root, graphics, label });
    },
    reset: (view) => {
      clearPixiGraphics(view.graphics);
      if (view.label) {
        view.label.text = '';
        view.label.visible = false;
      }
      setPixiPivot(view.root, 0, 0);
      setPixiPosition(view.root, 0, 0);
      setPixiScale(view.root, 1, 1);
      view.root.rotation = 0;
      view.root.alpha = 1;
      view.root.visible = false;
      removePixiFromParent(view.root);
    },
    destroy: (view) => destroyPixiDisplayObject(view.root),
    maxRetained: maxRetainedEffects
  });
  const sourceTrajectoryPool: ObjectPool<SourceTrajectoryView> = createObjectPool({
    create: () => {
      const root = createPixiContainer(runtime, 'pixi-source-trajectory');
      const mask = createPixiGraphics(runtime, 'pixi-source-trajectory-mask');
      const graphics = createPixiGraphics(runtime, 'pixi-source-trajectory-graphics');
      const sprite = createPixiSprite(runtime, 'pixi-source-trajectory-sprite');
      addPixiChild(root, graphics, sprite);
      root.eventMode = 'none';
      return Object.freeze({ root, mask, graphics, sprite });
    },
    reset: (view) => {
      view.root.mask = null;
      clearPixiGraphics(view.mask);
      clearPixiGraphics(view.graphics);
      if (view.sprite) {
        view.sprite.texture = runtime.Texture?.EMPTY || null;
        view.sprite.visible = false;
        view.sprite.alpha = 1;
        view.sprite.rotation = 0;
        setPixiPosition(view.sprite, 0, 0);
        setPixiScale(view.sprite, 1, 1);
      }
      setPixiPosition(view.root, 0, 0);
      setPixiScale(view.root, 1, 1);
      view.root.rotation = 0;
      view.root.alpha = 1;
      view.root.visible = false;
      removePixiFromParent(view.root);
      removePixiFromParent(view.mask);
    },
    destroy: (view) => {
      view.root.mask = null;
      destroyPixiDisplayObject(view.root);
      destroyPixiDisplayObject(view.mask);
    },
    maxRetained: maxRetainedEffects
  });
  const active = new Map<string, RetainedCellViews>();
  const activeStones = new Map<string, PixiStoneView>();
  const materializedByKey = new Map<string, MaterializedBoardCellVisualState>();
  const cellDiagnosticsByKey = new Map<string, ReturnType<PixiCellView['getDiagnostics']>>();
  const retainedStoneBaseVisibility = new Map<string, boolean>();
  const retainedStoneOverrides = new Map<string, Required<PixiRetainedStoneOverride>>();
  const hiddenStoneKeys = new Set<string>();
  const playbackGhosts = new Map<number, PlaybackGhostRecord>();
  const playbackHighlightLeases = new Map<number, PlaybackHighlightLease>();
  const playbackHighlightsByKey = new Map<string, any>();
  const playbackEffects = new Map<number, PlaybackEffectRecord>();
  const sourceTrajectories = new Map<number, SourceTrajectoryRecord>();
  const topologyReveals = new Map<number, TopologyRevealRecord>();
  const sourceTrajectoryByProfile = makeTrajectoryCounterMap(SOURCE_TRAJECTORY_PROFILE_KEYS);
  const sourceTrajectoryByPrimitive = makeTrajectoryCounterMap(SOURCE_TRAJECTORY_PRIMITIVES);
  const textureIds = new WeakMap<object, number>();
  let nextTextureId = 1;
  let nextPlaybackScopeId = 1;
  let nextPlaybackGhostId = 1;
  let nextPlaybackHighlightId = 1;
  let nextPlaybackEffectId = 1;
  let nextSourceTrajectoryId = 1;
  let nextTopologyRevealId = 1;
  let playbackScope: PixiPlaybackProjectionScope | null = null;
  let latestFrame: BoardVisualFrame | null = null;
  let latestViewContext: Omit<PixiStaticViewContext, 'sceneX' | 'sceneY'> | null = null;
  let latestApplyContext: PixiBoardSceneApplyContext | null = null;
  let latestSceneOffsetX = 0;
  let latestSceneOffsetY = 0;
  let viewportClipRect: PixiBoardViewportClipRect | null = null;
  let topologyPatchKeys = new Set<string>();
  let destroyed = false;
  let applyCount = 0;
  let resetCount = 0;
  let cumulativeUpdatedViewCount = 0;
  let cumulativeUpdatedCellViewCount = 0;
  let cumulativeUpdatedStoneViewCount = 0;
  let cumulativeUpdatedHintViewCount = 0;
  let cumulativeHintPaintCount = 0;
  let cumulativeHintInputSyncCount = 0;
  let cumulativeSkippedViewCount = 0;
  let cumulativeReleasedViewCount = 0;
  let materializationWindow: BoardWorldWindow | null = null;
  let starPointCount = 0;
  let starPointSignature: string | null = null;
  let boardTextureMode: PixiStaticBoardTextureMode = 'none';
  let boardSurfaceSignature: string | null = null;
  let boardSurfaceUpdateCount = 0;
  let boardSurfaceSkippedCount = 0;

  function assertAlive(): void {
    if (destroyed) throw new Error('PixiBoardScene is destroyed');
  }

  function updateViewportMasks(
    frame: BoardVisualFrame,
    sceneOffsetX: number,
    sceneOffsetY: number
  ): void {
    viewportClipRect = Object.freeze({
      x: sceneOffsetX,
      y: sceneOffsetY,
      width: frame.layout.camera.viewportWidth,
      height: frame.layout.camera.viewportHeight
    });
    for (const name of PIXI_BOARD_VIEWPORT_CLIPPED_LAYER_NAMES) {
      const mask = viewportMasks[name];
      clearPixiGraphics(mask);
      drawPixiRect(
        mask,
        viewportClipRect.x,
        viewportClipRect.y,
        viewportClipRect.width,
        viewportClipRect.height,
        { color: '#ffffff', alpha: 1 }
      );
    }
  }

  function textureIdentity(
    context: PixiBoardSceneApplyContext,
    lane: 'surface' | 'stone'
  ): string {
    const laneRevision = lane === 'surface'
      ? context.surfaceTextureRevision
      : context.stoneTextureRevision;
    if (laneRevision !== null && typeof laneRevision !== 'undefined') {
      return `${lane}-revision:${String(laneRevision)}`;
    }
    if (context.textureRevision !== null && typeof context.textureRevision !== 'undefined') {
      return `revision:${String(context.textureRevision)}`;
    }
    const source = context.textures;
    if (!source || (typeof source !== 'object' && typeof source !== 'function')) return 'textures:none';
    const key = source as object;
    let id = textureIds.get(key);
    if (!id) {
      id = nextTextureId++;
      textureIds.set(key, id);
    }
    return `textures:${id}`;
  }

  function assertPlaybackScope(scope: PixiPlaybackProjectionScope): PixiPlaybackProjectionScope {
    assertAlive();
    if (
      !scope
      || !playbackScope
      || scope.id !== playbackScope.id
      || scope.key !== playbackScope.key
    ) {
      throw new Error('Pixi playback projection scope is not active');
    }
    return playbackScope;
  }

  function beginPlaybackScope(scopeKey: string | number): PixiPlaybackProjectionScope {
    assertAlive();
    const key = String(scopeKey ?? '').trim();
    if (!key) throw new Error('Pixi playback projection scope key is required');
    if (playbackScope) {
      if (playbackScope.key === key) return playbackScope;
      throw new Error(`Pixi playback projection scope ${playbackScope.key} is still active`);
    }
    playbackScope = Object.freeze({ id: nextPlaybackScopeId++, key });
    return playbackScope;
  }

  function isPlaybackScopeActive(scopeKey: string): boolean {
    return !!playbackScope && playbackScope.key === String(scopeKey || '').trim();
  }

  function setPlaybackTransform(
    target: any,
    baseX: number,
    baseY: number,
    cellSize: number,
    transform: Required<PixiRetainedStoneOverride>
  ): void {
    const center = cellSize / 2;
    setPixiPivot(target, center, center);
    setPixiPosition(
      target,
      baseX + center + transform.offsetX,
      baseY + center + transform.offsetY
    );
    setPixiScale(target, transform.scaleX, transform.scaleY);
    target.rotation = transform.rotation;
    target.alpha = transform.alpha;
  }

  function restoreRetainedStoneRoot(key: string, view: PixiStoneView): void {
    const root = view.root;
    const diagnostics = view.getDiagnostics();
    setPixiPivot(root, 0, 0);
    setPixiPosition(root, diagnostics.position.x, diagnostics.position.y);
    setPixiScale(root, 1, 1);
    root.rotation = 0;
    root.alpha = 1;
    root.visible = retainedStoneBaseVisibility.get(key) === true;
  }

  function applyRetainedStoneProjection(key: string, view: PixiStoneView, cellSize: number): void {
    const override = retainedStoneOverrides.get(key);
    if (!override) {
      restoreRetainedStoneRoot(key, view);
    } else {
      const position = view.getDiagnostics().position;
      setPlaybackTransform(view.root, position.x, position.y, cellSize, override);
      view.root.visible = retainedStoneBaseVisibility.get(key) === true;
    }
    if (hiddenStoneKeys.has(key)) view.root.visible = false;
  }

  function retainedPlaybackDiagnostics(key: string): PixiBoardSceneRenderedCell['playback'] {
    const override = retainedStoneOverrides.get(key) || normalizeRetainedOverride({});
    return Object.freeze({
      hidden: hiddenStoneKeys.has(key),
      overridden: retainedStoneOverrides.has(key),
      offset: Object.freeze({ x: override.offsetX, y: override.offsetY }),
      scale: Object.freeze({ x: override.scaleX, y: override.scaleY }),
      rotation: override.rotation,
      alpha: override.alpha
    });
  }

  function viewContextAt(row: number, col: number): PixiStaticViewContext {
    if (!latestFrame || !latestViewContext) {
      throw new Error('Pixi playback projection requires an applied visual frame');
    }
    const scene = worldToScene(latestFrame.model.topology, latestFrame.layout, row, col);
    return {
      ...latestViewContext,
      sceneX: scene.x + latestViewContext.sceneOffsetX,
      sceneY: scene.y + latestViewContext.sceneOffsetY
    };
  }

  function isCoordinateInsideMaterialization(row: number, col: number): boolean {
    if (!materializationWindow) return false;
    return row >= materializationWindow.minRow
      && row <= materializationWindow.maxRow
      && col >= materializationWindow.minCol
      && col <= materializationWindow.maxCol;
  }

  function isGhostInsideMaterialization(record: PlaybackGhostRecord): boolean {
    if (!latestFrame || !latestViewContext || !materializationWindow) return false;
    const cellSize = latestFrame.layout.cellSize;
    const base = viewContextAt(record.row, record.col);
    const centerX = base.sceneX + (cellSize / 2) + record.transform.offsetX;
    const centerY = base.sceneY + (cellSize / 2) + record.transform.offsetY;
    const first = worldToScene(
      latestFrame.model.topology,
      latestFrame.layout,
      materializationWindow.minRow,
      materializationWindow.minCol
    );
    const last = worldToScene(
      latestFrame.model.topology,
      latestFrame.layout,
      materializationWindow.maxRow,
      materializationWindow.maxCol
    );
    const minX = Math.min(first.x, last.x) + latestViewContext.sceneOffsetX;
    const maxX = Math.max(first.x, last.x) + latestViewContext.sceneOffsetX + cellSize;
    const minY = Math.min(first.y, last.y) + latestViewContext.sceneOffsetY;
    const maxY = Math.max(first.y, last.y) + latestViewContext.sceneOffsetY + cellSize;
    const visualRadius = (cellSize / Math.SQRT2) * Math.max(
      Math.abs(record.transform.scaleX),
      Math.abs(record.transform.scaleY)
    );
    return centerX + visualRadius >= minX
      && centerX - visualRadius <= maxX
      && centerY + visualRadius >= minY
      && centerY - visualRadius <= maxY;
  }

  function makePlaybackGhostCell(
    handle: PixiPlaybackGhostHandle,
    options: PixiPlaybackGhostOptions
  ): MaterializedBoardCellVisualState {
    if (!latestFrame) throw new Error('Pixi playback ghost requires an applied visual frame');
    const key = integerWorldKey(options.row, options.col);
    if (!latestFrame.model.topology.playableKeys.includes(key)) {
      throw new Error(`Pixi playback ghost coordinate is not playable: ${key}`);
    }
    const existing = latestFrame.model.cells.find((cell) => cell.key === key);
    return Object.freeze({
      key,
      row: Number(options.row),
      col: Number(options.col),
      renderRow: existing?.renderRow ?? Number(options.row) + latestFrame.model.topology.renderRowOffset,
      renderCol: existing?.renderCol ?? Number(options.col) + latestFrame.model.topology.renderColOffset,
      kind: 'playable' as const,
      ephemeral: false,
      expansionSide: existing?.expansionSide || null,
      boundaryEdges: existing?.boundaryEdges || Object.freeze({
        top: 'none' as const,
        right: 'none' as const,
        bottom: 'none' as const,
        left: 'none' as const
      }),
      stone: options.stone || null,
      markers: Object.freeze(Array.from(options.markers || [])),
      interaction: existing?.interaction || Object.freeze({
        legal: false,
        legalFree: false,
        tabooLegal: false,
        selectable: false,
        interactionLocked: true,
        hovered: false,
        keyboardCursor: false,
        previewKinds: Object.freeze([]),
        selected: false,
        selectionKinds: Object.freeze([]),
        directionHints: Object.freeze([]),
        directionHintIds: Object.freeze([]),
        localPendingHintIds: Object.freeze([])
      }),
      visualSignature: `playback-ghost:${handle.scopeId}:${handle.id}`,
      surfaceSignature: `playback-ghost-surface:${handle.scopeId}:${handle.id}`,
      stoneSignature: `playback-ghost-stone:${handle.scopeId}:${handle.id}`,
      hintPaintSignature: existing?.hintPaintSignature
        || `playback-ghost-hint-paint:${handle.scopeId}:${handle.id}`,
      hintInputSignature: existing?.hintInputSignature
        || `playback-ghost-hint-input:${handle.scopeId}:${handle.id}`,
      interactionSignature: `playback-ghost-interaction:${handle.scopeId}:${handle.id}`
    });
  }

  function dematerializePlaybackGhost(record: PlaybackGhostRecord): void {
    const owned = record.view;
    if (!owned) return;
    record.view = null;
    if (owned.kind === 'marker') playbackMarkerGhostPool.release(owned.view);
    else playbackGhostPool.release(owned.view);
  }

  function shouldMaterializePlaybackGhost(record: PlaybackGhostRecord): boolean {
    return record.transform.visible && isGhostInsideMaterialization(record);
  }

  function syncPlaybackGhost(record: PlaybackGhostRecord): void {
    if (!shouldMaterializePlaybackGhost(record)) {
      dematerializePlaybackGhost(record);
      return;
    }
    let owned = record.view;
    const acquired = !owned;
    if (!owned) {
      owned = record.visualKind === 'marker'
        ? Object.freeze({ kind: 'marker' as const, view: playbackMarkerGhostPool.acquire() })
        : Object.freeze({ kind: 'stone' as const, view: playbackGhostPool.acquire() });
      record.view = owned;
    }
    try {
      const root = owned.kind === 'marker' ? owned.view.markerRoot : owned.view.root;
      if (acquired) addPixiChild(layers.playback, root);
      const context = viewContextAt(record.row, record.col);
      owned.view.update(record.cell, context);
      setPlaybackTransform(
        root,
        context.sceneX,
        context.sceneY,
        context.layout.cellSize,
        record.transform
      );
      root.visible = true;
    } catch (error) {
      dematerializePlaybackGhost(record);
      throw error;
    }
  }

  function syncPlaybackGhosts(): void {
    const records = Array.from(playbackGhosts.values());
    // Release the old viewport first so scroll/reflow never temporarily owns
    // DisplayObjects for both the old and new materialization windows.
    for (const record of records) {
      if (!shouldMaterializePlaybackGhost(record)) dematerializePlaybackGhost(record);
    }
    for (const record of records) {
      if (shouldMaterializePlaybackGhost(record)) syncPlaybackGhost(record);
    }
  }

  function retainStoneOverride(
    scope: PixiPlaybackProjectionScope,
    row: number,
    col: number,
    override: PixiRetainedStoneOverride
  ): void {
    assertPlaybackScope(scope);
    const key = integerWorldKey(row, col);
    retainedStoneOverrides.set(key, normalizeRetainedOverride(override, retainedStoneOverrides.get(key)));
    const stoneView = activeStones.get(key);
    const views = active.get(key);
    if (stoneView && latestFrame) {
      applyRetainedStoneProjection(key, stoneView, latestFrame.layout.cellSize);
      if (views) applyTopologyRevealAlpha(key, views);
    }
  }

  function hideStone(scope: PixiPlaybackProjectionScope, row: number, col: number): void {
    assertPlaybackScope(scope);
    const key = integerWorldKey(row, col);
    hiddenStoneKeys.add(key);
    const stoneView = activeStones.get(key);
    if (stoneView) stoneView.root.visible = false;
  }

  function acquirePlaybackGhost(
    scope: PixiPlaybackProjectionScope,
    options: PixiPlaybackGhostOptions
  ): PixiPlaybackGhostHandle {
    assertPlaybackScope(scope);
    if (!options || (!options.stone && !(options.markers || []).length)) {
      throw new Error('Pixi playback ghost visual is required');
    }
    integerWorldKey(options.row, options.col);
    const handle = Object.freeze({ id: nextPlaybackGhostId++, scopeId: scope.id });
    const transform = normalizeGhostUpdate({
      row: Number(options.row),
      col: Number(options.col),
      visible: true
    });
    const record: PlaybackGhostRecord = {
      handle,
      visualKind: options.stone ? 'stone' : 'marker',
      view: null,
      cell: makePlaybackGhostCell(handle, options),
      row: transform.row,
      col: transform.col,
      transform
    };
    playbackGhosts.set(handle.id, record);
    try {
      syncPlaybackGhost(record);
    } catch (error) {
      playbackGhosts.delete(handle.id);
      dematerializePlaybackGhost(record);
      throw error;
    }
    return handle;
  }

  function findPlaybackGhost(
    scope: PixiPlaybackProjectionScope,
    handle: PixiPlaybackGhostHandle
  ): PlaybackGhostRecord {
    assertPlaybackScope(scope);
    if (!handle || handle.scopeId !== scope.id) {
      throw new Error('Pixi playback ghost belongs to a different scope');
    }
    const record = playbackGhosts.get(handle.id);
    if (!record || record.handle.scopeId !== handle.scopeId) {
      throw new Error('Pixi playback ghost is not active');
    }
    return record;
  }

  function updatePlaybackGhost(
    scope: PixiPlaybackProjectionScope,
    handle: PixiPlaybackGhostHandle,
    update: PixiPlaybackGhostUpdate
  ): void {
    const record = findPlaybackGhost(scope, handle);
    const transform = normalizeGhostUpdate(update, record.transform);
    record.row = transform.row;
    record.col = transform.col;
    record.transform = transform;
    syncPlaybackGhost(record);
  }

  function releasePlaybackGhost(
    scope: PixiPlaybackProjectionScope,
    handle: PixiPlaybackGhostHandle
  ): void {
    const record = findPlaybackGhost(scope, handle);
    playbackGhosts.delete(handle.id);
    dematerializePlaybackGhost(record);
  }

  function renderPlaybackHighlight(key: string): void {
    const leases = Array.from(playbackHighlightLeases.values())
      .filter((lease) => lease.key === key)
      .sort((a, b) => a.handle.id - b.handle.id);
    if (!leases.length) {
      const released = playbackHighlightsByKey.get(key);
      if (released) {
        playbackHighlightsByKey.delete(key);
        playbackHighlightPool.release(released);
      }
      return;
    }
    const lease = leases[leases.length - 1];
    if (!isCoordinateInsideMaterialization(lease.row, lease.col)) {
      const released = playbackHighlightsByKey.get(key);
      if (released) {
        playbackHighlightsByKey.delete(key);
        playbackHighlightPool.release(released);
      }
      return;
    }
    const context = viewContextAt(lease.row, lease.col);
    let view = playbackHighlightsByKey.get(key);
    if (!view) {
      view = playbackHighlightPool.acquire();
      playbackHighlightsByKey.set(key, view);
      // Transient cell highlights tint the square itself. Keep them below
      // markers and stones so the red/blue/purple fill never paints over a
      // stone; higher playback effects continue to use the effect layer.
      addPixiChild(layers.cell, view);
    }
    const palette = {
      placement: { fill: '#66a4ff', fillAlpha: 0.38, stroke: '#9ac6ff' },
      positive: { fill: '#b466ff', fillAlpha: 0.38, stroke: '#d29aff' },
      negative: { fill: '#ff4848', fillAlpha: 0.42, stroke: '#ff6c6c' }
    }[lease.tone];
    clearPixiGraphics(view);
    drawPixiRect(
      view,
      0,
      0,
      context.layout.cellSize,
      context.layout.cellSize,
      { color: palette.fill, alpha: palette.fillAlpha },
      {
        color: palette.stroke,
        alpha: 0.9,
        width: Math.max(1, context.layout.cellSize * 0.032)
      }
    );
    setPixiPivot(view, 0, 0);
    setPixiPosition(view, context.sceneX, context.sceneY);
    setPixiScale(view, 1, 1);
    view.rotation = 0;
    view.alpha = 1;
    view.visible = true;
  }

  function syncPlaybackHighlights(): void {
    const keys = new Set<string>([
      ...playbackHighlightsByKey.keys(),
      ...Array.from(playbackHighlightLeases.values(), (lease) => lease.key)
    ]);
    for (const key of keys) renderPlaybackHighlight(key);
  }

  function acquirePlaybackCellHighlight(
    scope: PixiPlaybackProjectionScope,
    row: number,
    col: number,
    tone: PixiPlaybackCellHighlightTone
  ): PixiPlaybackCellHighlightHandle {
    assertPlaybackScope(scope);
    const key = integerWorldKey(row, col);
    if (!latestFrame || !latestFrame.model.topology.playableKeys.includes(key)) {
      throw new Error(`Pixi playback highlight coordinate is not playable: ${key}`);
    }
    if (tone !== 'placement' && tone !== 'positive' && tone !== 'negative') {
      throw new Error(`Pixi playback highlight tone is unsupported: ${String(tone)}`);
    }
    const handle = Object.freeze({ id: nextPlaybackHighlightId++, scopeId: scope.id });
    playbackHighlightLeases.set(handle.id, Object.freeze({
      handle,
      key,
      row: Number(row),
      col: Number(col),
      tone
    }));
    renderPlaybackHighlight(key);
    return handle;
  }

  function releasePlaybackCellHighlight(
    scope: PixiPlaybackProjectionScope,
    handle: PixiPlaybackCellHighlightHandle
  ): void {
    assertPlaybackScope(scope);
    if (!handle || handle.scopeId !== scope.id) {
      throw new Error('Pixi playback cell highlight belongs to a different scope');
    }
    const lease = playbackHighlightLeases.get(handle.id);
    if (!lease || lease.handle.scopeId !== handle.scopeId) {
      throw new Error('Pixi playback cell highlight is not active');
    }
    playbackHighlightLeases.delete(handle.id);
    renderPlaybackHighlight(lease.key);
  }

  const effectPalette: Readonly<Record<PixiPlaybackEffectTone, {
    readonly fill: string;
    readonly stroke: string;
  }>> = Object.freeze({
    blue: Object.freeze({ fill: '#63d8ff', stroke: '#d8f8ff' }),
    gold: Object.freeze({ fill: '#ffd45e', stroke: '#fff0b0' }),
    green: Object.freeze({ fill: '#65f29a', stroke: '#c8ffdc' }),
    purple: Object.freeze({ fill: '#b66cff', stroke: '#ead5ff' }),
    red: Object.freeze({ fill: '#ff5353', stroke: '#ffd0d0' }),
    white: Object.freeze({ fill: '#ffffff', stroke: '#ffffff' })
  });

  function drawPlaybackEffect(record: PlaybackEffectRecord): void {
    const view = record.view;
    if (!view) return;
    const context = viewContextAt(record.options.row, record.options.col);
    const cellSize = context.layout.cellSize;
    const center = cellSize / 2;
    const palette = effectPalette[record.options.tone];
    const graphics = view.graphics;
    clearPixiGraphics(graphics);
    if (record.options.kind === 'roulette') {
      const inset = Math.max(2, cellSize * 0.07);
      drawPixiRect(
        graphics,
        inset,
        inset,
        cellSize - (inset * 2),
        cellSize - (inset * 2),
        { color: palette.fill, alpha: 0.18 },
        { color: palette.stroke, alpha: 0.96, width: Math.max(2, cellSize * 0.055) },
        Math.max(3, cellSize * 0.12)
      );
    } else if (record.options.kind === 'topology') {
      drawPixiBoardFrameHoleSurface(graphics, cellSize);
      drawPixiBoardFrameHoleInnerEdges(
        graphics,
        cellSize,
        record.options.innerBoundaryEdges
      );
    } else {
      const radius = record.options.kind === 'impact'
        ? cellSize * 0.48
        : record.options.kind === 'pulse'
          ? cellSize * 0.53
          : cellSize * 0.44;
      drawPixiCircle(
        graphics,
        center,
        center,
        radius,
        { color: palette.fill, alpha: record.options.kind === 'impact' ? 0.28 : 0.14 },
        { color: palette.stroke, alpha: 0.94, width: Math.max(2, cellSize * 0.045) }
      );
      if (record.options.kind === 'impact') {
        drawPixiCircle(
          graphics,
          center,
          center,
          cellSize * 0.19,
          { color: palette.stroke, alpha: 0.76 },
          { color: palette.fill, alpha: 0.95, width: Math.max(1, cellSize * 0.025) }
        );
        for (let index = 0; index < 4; index += 1) {
          const angle = (Math.PI / 2) * index;
          drawPixiLine(
            graphics,
            center + Math.cos(angle) * cellSize * 0.2,
            center + Math.sin(angle) * cellSize * 0.2,
            center + Math.cos(angle) * cellSize * 0.62,
            center + Math.sin(angle) * cellSize * 0.62,
            { color: palette.stroke, alpha: 0.86, width: Math.max(1, cellSize * 0.03) }
          );
        }
      }
    }

    if (view.label) {
      const label = view.label;
      label.text = record.options.label || '';
      label.style = {
        fill: palette.stroke,
        fontFamily: context.theme.fontFamily,
        fontSize: Math.max(10, Math.round(cellSize * 0.3)),
        fontWeight: '800',
        stroke: { color: '#10151d', width: Math.max(1, cellSize * 0.035) }
      };
      setPixiAnchor(label, 0.5);
      setPixiPosition(label, center, center);
      label.visible = !!record.options.label;
    }

    setPixiPivot(view.root, center, center);
    setPixiPosition(view.root, context.sceneX + center, context.sceneY + center);
    setPixiScale(view.root, record.transform.scale, record.transform.scale);
    view.root.rotation = record.transform.rotation;
    view.root.alpha = record.transform.alpha;
    view.root.visible = true;
  }

  function dematerializePlaybackEffect(record: PlaybackEffectRecord): void {
    const view = record.view;
    if (!view) return;
    record.view = null;
    playbackEffectPool.release(view);
  }

  function shouldMaterializePlaybackEffect(record: PlaybackEffectRecord): boolean {
    return record.transform.visible
      && isCoordinateInsideMaterialization(record.options.row, record.options.col);
  }

  function syncPlaybackEffect(record: PlaybackEffectRecord): void {
    if (!shouldMaterializePlaybackEffect(record)) {
      dematerializePlaybackEffect(record);
      return;
    }
    let view = record.view;
    const acquired = !view;
    if (!view) {
      view = playbackEffectPool.acquire();
      record.view = view;
    }
    try {
      if (acquired) addPixiChild(layers.effect, view.root);
      drawPlaybackEffect(record);
    } catch (error) {
      dematerializePlaybackEffect(record);
      throw error;
    }
  }

  function syncPlaybackEffects(): void {
    const records = Array.from(playbackEffects.values());
    for (const record of records) {
      if (!shouldMaterializePlaybackEffect(record)) dematerializePlaybackEffect(record);
    }
    for (const record of records) {
      if (shouldMaterializePlaybackEffect(record)) syncPlaybackEffect(record);
    }
  }

  function findPlaybackEffect(
    scope: PixiPlaybackProjectionScope,
    handle: PixiPlaybackEffectHandle
  ): PlaybackEffectRecord {
    assertPlaybackScope(scope);
    if (!handle || handle.scopeId !== scope.id) {
      throw new Error('Pixi playback effect belongs to a different scope');
    }
    const record = playbackEffects.get(handle.id);
    if (!record || record.handle.scopeId !== handle.scopeId) {
      throw new Error('Pixi playback effect is not active');
    }
    return record;
  }

  function acquirePlaybackEffect(
    scope: PixiPlaybackProjectionScope,
    rawOptions: PixiPlaybackEffectOptions
  ): PixiPlaybackEffectHandle {
    assertPlaybackScope(scope);
    if (!latestFrame || !latestViewContext) {
      throw new Error('Pixi playback effect requires an applied visual frame');
    }
    const effectOptions = normalizePlaybackEffectOptions(rawOptions);
    const handle = Object.freeze({ id: nextPlaybackEffectId++, scopeId: scope.id });
    const record: PlaybackEffectRecord = {
      handle,
      view: null,
      options: effectOptions,
      transform: normalizePlaybackEffectUpdate({})
    };
    playbackEffects.set(handle.id, record);
    try {
      syncPlaybackEffect(record);
    } catch (error) {
      playbackEffects.delete(handle.id);
      dematerializePlaybackEffect(record);
      throw error;
    }
    return handle;
  }

  function updatePlaybackEffect(
    scope: PixiPlaybackProjectionScope,
    handle: PixiPlaybackEffectHandle,
    update: PixiPlaybackEffectUpdate
  ): void {
    const record = findPlaybackEffect(scope, handle);
    record.transform = normalizePlaybackEffectUpdate(update, record.transform);
    syncPlaybackEffect(record);
  }

  function releasePlaybackEffect(
    scope: PixiPlaybackProjectionScope,
    handle: PixiPlaybackEffectHandle
  ): void {
    const record = findPlaybackEffect(scope, handle);
    playbackEffects.delete(handle.id);
    dematerializePlaybackEffect(record);
  }

  function getPlaybackGhost(handle: PixiPlaybackGhostHandle): PixiPlaybackGhostDiagnostics | null {
    const record = handle && playbackGhosts.get(handle.id);
    if (!record || record.handle.scopeId !== handle.scopeId || !latestFrame || !latestViewContext) return null;
    const scene = worldToScene(latestFrame.model.topology, latestFrame.layout, record.row, record.col);
    const owned = record.view;
    const root = owned
      ? (owned.kind === 'marker' ? owned.view.markerRoot : owned.view.root)
      : null;
    const visualOwner = owned?.kind === 'stone'
      ? owned.view.getDiagnostics().owner
      : record.cell.markers.find((marker) => marker.owner)?.owner;
    return Object.freeze({
      id: record.handle.id,
      scopeId: record.handle.scopeId,
      row: record.row,
      col: record.col,
      visible: !!root?.visible,
      owner: visualOwner || record.cell.stone?.owner || null,
      position: Object.freeze({
        x: scene.x + latestViewContext.sceneOffsetX + record.transform.offsetX,
        y: scene.y + latestViewContext.sceneOffsetY + record.transform.offsetY
      }),
      offset: Object.freeze({ x: record.transform.offsetX, y: record.transform.offsetY }),
      scale: Object.freeze({ x: record.transform.scaleX, y: record.transform.scaleY }),
      rotation: record.transform.rotation,
      alpha: record.transform.alpha
    });
  }

  function getPlaybackEffect(handle: PixiPlaybackEffectHandle): PixiPlaybackEffectDiagnostics | null {
    const record = handle && playbackEffects.get(handle.id);
    if (!record || record.handle.scopeId !== handle.scopeId || !latestFrame || !latestViewContext) return null;
    const context = viewContextAt(record.options.row, record.options.col);
    return Object.freeze({
      id: record.handle.id,
      scopeId: record.handle.scopeId,
      row: record.options.row,
      col: record.options.col,
      family: record.options.family,
      kind: record.options.kind,
      tone: record.options.tone,
      label: record.options.label,
      innerBoundaryEdges: Object.freeze(record.options.innerBoundaryEdges.slice()),
      visible: !!record.view?.root.visible,
      alpha: record.transform.alpha,
      scale: record.transform.scale,
      rotation: record.transform.rotation,
      position: Object.freeze({ x: context.sceneX, y: context.sceneY })
    });
  }

  function snapshotSourceTrajectoryGeometry(
    request: Pick<BoardSourceTrajectoryRequest, 'source' | 'target' | 'direction'>
  ): PixiSourceTrajectoryGeometrySnapshot {
    assertAlive();
    if (!latestFrame || !latestViewContext) {
      throw new Error('Pixi source trajectory requires an applied visual frame');
    }
    const sourceRow = Number(request?.source?.row);
    const sourceCol = Number(request?.source?.col);
    const targetRow = Number(request?.target?.row);
    const targetCol = Number(request?.target?.col);
    if (![sourceRow, sourceCol, targetRow, targetCol].every(Number.isInteger)) {
      throw new Error('Pixi source trajectory coordinates must be integers');
    }
    const direction = request.direction === 'target-to-source'
      ? 'target-to-source'
      : 'source-to-target';
    const frame = latestFrame;
    const context = latestViewContext;
    const cellSize = frame.layout.cellSize;
    const sourceScene = worldToScene(frame.model.topology, frame.layout, sourceRow, sourceCol);
    const targetScene = worldToScene(frame.model.topology, frame.layout, targetRow, targetCol);
    const sourceCenter = trajectoryPoint(
      sourceScene.x + context.sceneOffsetX + cellSize / 2,
      sourceScene.y + context.sceneOffsetY + cellSize / 2
    );
    const targetCenter = trajectoryPoint(
      targetScene.x + context.sceneOffsetX + cellSize / 2,
      targetScene.y + context.sceneOffsetY + cellSize / 2
    );
    const movementStart = direction === 'source-to-target' ? sourceCenter : targetCenter;
    const movementEnd = direction === 'source-to-target' ? targetCenter : sourceCenter;
    const visibleClip = trajectoryRect(
      context.sceneOffsetX,
      context.sceneOffsetY,
      context.sceneOffsetX + frame.layout.camera.viewportWidth,
      context.sceneOffsetY + frame.layout.camera.viewportHeight
    );
    const maximumGutterPx = effectGutterCells * cellSize;
    const horizontalGutterPx = Math.min(maximumGutterPx, Math.max(0, context.sceneOffsetX));
    const verticalGutterPx = Math.min(maximumGutterPx, Math.max(0, context.sceneOffsetY));
    const paintedHaloClip = trajectoryRect(
      visibleClip.left - horizontalGutterPx,
      visibleClip.top - verticalGutterPx,
      visibleClip.right + horizontalGutterPx,
      visibleClip.bottom + verticalGutterPx
    );
    const dx = movementEnd.x - movementStart.x;
    const dy = movementEnd.y - movementStart.y;
    return Object.freeze({
      frameToken: frame.frameToken,
      layoutRevision: frame.layout.revision,
      topologySignature: sourceTrajectoryTopologySignature(frame),
      direction,
      cellSize,
      sourceCenter,
      targetCenter,
      movementStart,
      movementEnd,
      distancePx: Math.hypot(dx, dy),
      angleRad: Math.atan2(dy, dx),
      visibleClip,
      paintedHaloClip,
      visibleSegment: clipTrajectorySegment(movementStart, movementEnd, visibleClip)
    });
  }

  function drawSourceTrajectoryVisual(record: SourceTrajectoryRecord): void {
    const view = record.view;
    if (!view) return;
    const visual = record.visual;
    clearPixiGraphics(view.graphics);
    view.root.visible = visual.visible !== false;
    const lines = Array.isArray(visual.lines) ? visual.lines : [];
    for (const line of lines) {
      const points = Array.isArray(line.points) ? line.points : [];
      for (let index = 1; index < points.length; index += 1) {
        drawPixiLine(
          view.graphics,
          finiteNumber(points[index - 1]?.x, 0),
          finiteNumber(points[index - 1]?.y, 0),
          finiteNumber(points[index]?.x, 0),
          finiteNumber(points[index]?.y, 0),
          {
            color: line.color,
            alpha: Math.max(0, Math.min(1, finiteNumber(line.alpha, 1))),
            width: Math.max(0, finiteNumber(line.width, 0))
          }
        );
      }
    }
    const circles = Array.isArray(visual.circles) ? visual.circles : [];
    for (const circle of circles) {
      const strokeWidth = Math.max(0, finiteNumber(circle.strokeWidth, 0));
      drawPixiCircle(
        view.graphics,
        finiteNumber(circle.x, 0),
        finiteNumber(circle.y, 0),
        Math.max(0, finiteNumber(circle.radius, 0)),
        { color: circle.color, alpha: Math.max(0, Math.min(1, finiteNumber(circle.alpha, 1))) },
        strokeWidth > 0
          ? {
            color: circle.strokeColor ?? circle.color,
            alpha: Math.max(0, Math.min(1, finiteNumber(circle.strokeAlpha, circle.alpha))),
            width: strokeWidth
          }
          : null
      );
    }
    const polygons = Array.isArray(visual.polygons) ? visual.polygons : [];
    for (const polygon of polygons) {
      const strokeWidth = Math.max(0, finiteNumber(polygon.strokeWidth, 0));
      drawPixiPolygon(
        view.graphics,
        polygon.points,
        { color: polygon.color, alpha: Math.max(0, Math.min(1, finiteNumber(polygon.alpha, 1))) },
        strokeWidth > 0
          ? {
            color: polygon.strokeColor ?? polygon.color,
            alpha: Math.max(0, Math.min(1, finiteNumber(polygon.strokeAlpha, polygon.alpha))),
            width: strokeWidth
          }
          : null
      );
    }
    const spriteVisual = visual.sprite;
    if (view.sprite) {
      const showSprite = visual.visible !== false && !!spriteVisual && spriteVisual.visible !== false;
      view.sprite.visible = showSprite;
      if (showSprite && spriteVisual) {
        const size = Math.max(0, finiteNumber(spriteVisual.size, 0));
        setPixiAnchor(view.sprite, 0.5);
        setPixiPosition(view.sprite, finiteNumber(spriteVisual.x, 0), finiteNumber(spriteVisual.y, 0));
        const scale = Math.max(0, finiteNumber(spriteVisual.scale, 1));
        setPixiScale(view.sprite, 1, 1);
        view.sprite.width = size * scale;
        view.sprite.height = size * scale;
        view.sprite.alpha = Math.max(0, Math.min(1, finiteNumber(spriteVisual.alpha, 1)));
        view.sprite.rotation = finiteNumber(spriteVisual.rotation, 0);
      }
    }
  }

  function findSourceTrajectory(
    scope: PixiPlaybackProjectionScope,
    handle: PixiSourceTrajectoryHandle
  ): SourceTrajectoryRecord {
    assertPlaybackScope(scope);
    if (!handle || handle.scopeId !== scope.id) {
      throw new Error('Pixi source trajectory belongs to a different scope');
    }
    const record = sourceTrajectories.get(handle.id);
    if (!record || record.handle.scopeId !== handle.scopeId || record.disposed) {
      throw new Error('Pixi source trajectory is not active');
    }
    return record;
  }

  function releaseSourceTrajectoryRecord(record: SourceTrajectoryRecord): void {
    if (record.disposed) return;
    record.disposed = true;
    sourceTrajectories.delete(record.handle.id);
    const profileCounter = sourceTrajectoryByProfile[record.profileKey];
    const primitiveCounter = sourceTrajectoryByPrimitive[record.primitive];
    profileCounter.active = Math.max(0, profileCounter.active - 1);
    profileCounter.released += 1;
    primitiveCounter.active = Math.max(0, primitiveCounter.active - 1);
    primitiveCounter.released += 1;
    const view = record.view;
    record.view = null;
    try {
      if (view) sourceTrajectoryPool.release(view);
    } finally {
      try { record.textureLease?.release(); }
      catch (_error) { /* disposal remains terminal and idempotent */ }
    }
  }

  function acquireSourceTrajectory(
    scope: PixiPlaybackProjectionScope,
    rawOptions: PixiSourceTrajectoryOptions
  ): PixiSourceTrajectoryHandle {
    assertPlaybackScope(scope);
    const trajectoryId = String(rawOptions?.trajectoryId || '').trim();
    if (!trajectoryId) throw new Error('Pixi source trajectory id is required');
    if (!SOURCE_TRAJECTORY_PROFILE_KEYS.includes(rawOptions.profileKey)) {
      throw new Error(`Pixi source trajectory profile is unsupported: ${String(rawOptions?.profileKey)}`);
    }
    if (!SOURCE_TRAJECTORY_PRIMITIVES.includes(rawOptions.primitive)) {
      throw new Error(`Pixi source trajectory primitive is unsupported: ${String(rawOptions?.primitive)}`);
    }
    if (!rawOptions.geometry?.visibleSegment) {
      throw new Error('Pixi source trajectory requires a visible clipped segment');
    }
    const rawClipRect = rawOptions.clipRect || rawOptions.geometry.paintedHaloClip;
    const clipRect = trajectoryRect(
      rawClipRect?.left,
      rawClipRect?.top,
      rawClipRect?.right,
      rawClipRect?.bottom
    );
    const handle = Object.freeze({ id: nextSourceTrajectoryId++, scopeId: scope.id });
    const record: SourceTrajectoryRecord = {
      handle,
      trajectoryId,
      profileKey: rawOptions.profileKey,
      primitive: rawOptions.primitive,
      geometry: rawOptions.geometry,
      textureLease: rawOptions.textureLease || null,
      view: null,
      visual: Object.freeze({ visible: false }),
      disposed: false
    };
    try {
      const view = sourceTrajectoryPool.acquire();
      record.view = view;
      if (view.sprite) {
        view.sprite.texture = record.textureLease?.texture || runtime.Texture?.EMPTY || null;
        view.sprite.visible = false;
      }
      drawPixiRect(
        view.mask,
        clipRect.left,
        clipRect.top,
        clipRect.width,
        clipRect.height,
        { color: 0xffffff, alpha: 1 }
      );
      view.root.mask = view.mask;
      addPixiChild(layers.effect, view.mask, view.root);
      sourceTrajectories.set(handle.id, record);
      const profileCounter = sourceTrajectoryByProfile[record.profileKey];
      const primitiveCounter = sourceTrajectoryByPrimitive[record.primitive];
      profileCounter.started += 1;
      profileCounter.active += 1;
      primitiveCounter.started += 1;
      primitiveCounter.active += 1;
      return handle;
    } catch (error) {
      const view = record.view;
      record.view = null;
      try {
        if (view) sourceTrajectoryPool.release(view);
      } finally {
        try { record.textureLease?.release(); }
        catch (_releaseError) { /* acquisition error remains authoritative */ }
      }
      throw error;
    }
  }

  function updateSourceTrajectory(
    scope: PixiPlaybackProjectionScope,
    handle: PixiSourceTrajectoryHandle,
    visual: PixiSourceTrajectoryVisualState
  ): void {
    const record = findSourceTrajectory(scope, handle);
    record.visual = visual && typeof visual === 'object'
      ? visual
      : Object.freeze({ visible: false });
    drawSourceTrajectoryVisual(record);
  }

  function releaseSourceTrajectory(
    scope: PixiPlaybackProjectionScope,
    handle: PixiSourceTrajectoryHandle
  ): void {
    releaseSourceTrajectoryRecord(findSourceTrajectory(scope, handle));
  }

  function getSourceTrajectory(
    handle: PixiSourceTrajectoryHandle
  ): PixiSourceTrajectoryDiagnostics | null {
    const record = handle && sourceTrajectories.get(handle.id);
    if (!record || record.handle.scopeId !== handle.scopeId || record.disposed) return null;
    const visual = record.visual;
    return Object.freeze({
      id: record.handle.id,
      scopeId: record.handle.scopeId,
      trajectoryId: record.trajectoryId,
      profileKey: record.profileKey,
      primitive: record.primitive,
      layoutRevision: record.geometry.layoutRevision,
      topologySignature: record.geometry.topologySignature,
      visible: !!record.view?.root.visible,
      spriteVisible: !!record.view?.sprite?.visible,
      lineCount: Array.isArray(visual.lines) ? visual.lines.length : 0,
      circleCount: Array.isArray(visual.circles) ? visual.circles.length : 0,
      polygonCount: Array.isArray(visual.polygons) ? visual.polygons.length : 0,
      geometry: record.geometry
    });
  }

  function topologyRevealAlphaForKey(key: string): number {
    let alpha = 1;
    for (const reveal of topologyReveals.values()) {
      if (reveal.keys.has(key)) alpha = Math.min(alpha, reveal.progress);
    }
    return alpha;
  }

  function applyTopologyRevealAlpha(key: string, views: RetainedCellViews): void {
    const alpha = topologyRevealAlphaForKey(key);
    for (const target of [
      views.hint.surfaceRoot,
      views.hint.root,
      views.hint.interactionRoot
    ]) {
      if (target) target.alpha = alpha;
    }
    const stoneBaseAlpha = retainedStoneOverrides.get(key)?.alpha ?? 1;
    const stoneView = activeStones.get(key);
    if (stoneView) stoneView.root.alpha = stoneBaseAlpha * alpha;
  }

  function normalizedTopologyRevealKeys(keys: readonly string[]): readonly string[] {
    if (!Array.isArray(keys)) throw new Error('Pixi topology reveal keys must be an array');
    if (!latestFrame) throw new Error('Pixi topology reveal requires an applied visual frame');
    const existing = new Set(latestFrame.model.topology.existingKeys);
    const normalized = new Set<string>();
    for (const rawKey of keys) {
      const parts = String(rawKey || '').split(',');
      if (parts.length !== 2) throw new Error(`Pixi topology reveal key is invalid: ${String(rawKey)}`);
      const key = integerWorldKey(parts[0], parts[1]);
      if (existing.has(key)) normalized.add(key);
    }
    return Object.freeze(sortedWorldKeys(normalized));
  }

  function beginTopologyReveal(
    keys: readonly string[],
    initialProgress = 0
  ): PixiTopologyRevealHandle {
    assertAlive();
    const normalizedKeys = normalizedTopologyRevealKeys(keys);
    if (!normalizedKeys.length) throw new Error('Pixi topology reveal requires existing cell keys');
    const handle = Object.freeze({ id: nextTopologyRevealId++ });
    const progress = Math.max(0, Math.min(1, finiteNumber(initialProgress, 0)));
    topologyReveals.set(handle.id, {
      handle,
      keys: new Set(normalizedKeys),
      progress
    });
    const nextPatchKeys = new Set(Array.from(topologyReveals.values()).flatMap((value) => Array.from(value.keys)));
    if (sortedWorldKeys(nextPatchKeys).join('|') !== sortedWorldKeys(topologyPatchKeys).join('|')) {
      topologyPatchKeys = nextPatchKeys;
      rebakeLatestStaticSurface();
    }
    staticBoardLayer.setPatchAlpha(progress);
    for (const key of normalizedKeys) {
      const views = active.get(key);
      if (views) applyTopologyRevealAlpha(key, views);
    }
    return handle;
  }

  function updateTopologyReveal(handle: PixiTopologyRevealHandle, progress: number): void {
    if (destroyed) return;
    const reveal = handle && topologyReveals.get(handle.id);
    if (!reveal) throw new Error('Pixi topology reveal is not active');
    reveal.progress = Math.max(0, Math.min(1, finiteNumber(progress, reveal.progress)));
    for (const key of reveal.keys) {
      const views = active.get(key);
      if (views) applyTopologyRevealAlpha(key, views);
    }
    staticBoardLayer.setPatchAlpha(Math.min(...Array.from(topologyReveals.values()).map((value) => value.progress)));
  }

  function endTopologyReveal(handle: PixiTopologyRevealHandle): void {
    if (destroyed) return;
    const reveal = handle && topologyReveals.get(handle.id);
    if (!reveal) return;
    topologyReveals.delete(handle.id);
    for (const key of reveal.keys) {
      const views = active.get(key);
      if (views) applyTopologyRevealAlpha(key, views);
    }
    topologyPatchKeys = new Set(Array.from(topologyReveals.values()).flatMap((value) => Array.from(value.keys)));
    if (topologyReveals.size) {
      staticBoardLayer.setPatchAlpha(Math.min(...Array.from(topologyReveals.values()).map((value) => value.progress)));
    } else {
      rebakeLatestStaticSurface();
    }
  }

  function resetTopologyRevealsInternal(): void {
    if (!topologyReveals.size) return;
    const keys = new Set<string>();
    for (const reveal of topologyReveals.values()) {
      for (const key of reveal.keys) keys.add(key);
    }
    topologyReveals.clear();
    topologyPatchKeys.clear();
    rebakeLatestStaticSurface();
    for (const key of keys) {
      const views = active.get(key);
      if (views) applyTopologyRevealAlpha(key, views);
    }
  }

  function resetPlaybackProjectionInternal(): void {
    for (const record of Array.from(playbackGhosts.values())) {
      playbackGhosts.delete(record.handle.id);
      dematerializePlaybackGhost(record);
    }
    playbackHighlightLeases.clear();
    for (const [key, view] of Array.from(playbackHighlightsByKey.entries())) {
      playbackHighlightsByKey.delete(key);
      playbackHighlightPool.release(view);
    }
    for (const record of Array.from(playbackEffects.values())) {
      playbackEffects.delete(record.handle.id);
      dematerializePlaybackEffect(record);
    }
    for (const record of Array.from(sourceTrajectories.values())) {
      releaseSourceTrajectoryRecord(record);
    }
    retainedStoneOverrides.clear();
    hiddenStoneKeys.clear();
    playbackScope = null;
    for (const [key, stoneView] of activeStones) {
      restoreRetainedStoneRoot(key, stoneView);
      const views = active.get(key);
      if (views) applyTopologyRevealAlpha(key, views);
    }
  }

  function resetPlaybackProjection(scope?: PixiPlaybackProjectionScope): void {
    assertAlive();
    if (scope) assertPlaybackScope(scope);
    resetPlaybackProjectionInternal();
  }

  function attachViews(views: RetainedCellViews): void {
    addPixiChild(layers.cell, views.hint.surfaceRoot);
    addPixiChild(layers.hint, views.hint.root);
    addPixiChild(layers.interaction, views.hint.interactionRoot);
  }

  function releaseKey(key: string): boolean {
    const views = active.get(key);
    if (!views) return false;
    active.delete(key);
    materializedByKey.delete(key);
    cellDiagnosticsByKey.delete(key);
    retainedStoneBaseVisibility.delete(key);
    const stoneView = activeStones.get(key);
    if (stoneView) {
      restoreRetainedStoneRoot(key, stoneView);
      activeStones.delete(key);
      stonePool.release(stoneView);
    }
    const released = pool.release(views);
    if (released) cumulativeReleasedViewCount += 1;
    return released;
  }

  function updateBoardSurface(
    frame: BoardVisualFrame,
    context: PixiBoardSceneApplyContext,
    sceneOffsetX: number,
    sceneOffsetY: number
  ): PixiStaticBoardTextureMode {
    const topology = frame.model.topology;
    const existing = new Set(topology.existingKeys);
    let hasBaseVoidCells = false;
    for (let row = 0; row < topology.baseRows && !hasBaseVoidCells; row += 1) {
      for (let col = 0; col < topology.baseCols; col += 1) {
        if (!existing.has(`${row},${col}`)) {
          hasBaseVoidCells = true;
          break;
        }
      }
    }
    const texture = resolvePixiStaticTexture(context.textures, ['board']);
    const nextBoardTextureMode: PixiStaticBoardTextureMode = !texture
      ? 'none'
      : hasBaseVoidCells
        ? 'per-cell'
        : boardSurfaceTexture
          ? 'single-surface'
          : 'none';
    const nextSignature = JSON.stringify([
      topology.baseRows,
      topology.baseCols,
      topology.existingKeys,
      frame.layout.cellSize,
      frame.layout.stageScale,
      frame.layout.orientation,
      frame.layout.camera.scrollLeft,
      frame.layout.camera.scrollTop,
      frame.appearance.boardSkinId,
      frame.appearance.boardImageUrl,
      frame.appearance.boardFrameSkinId,
      frame.appearance.boardFrameLayout,
      frame.theme.surfaceColor,
      frame.theme.contourShadowColor,
      frame.theme.contourMetalColor,
      textureIdentity(context, 'surface'),
      nextBoardTextureMode,
      sceneOffsetX,
      sceneOffsetY
    ]);
    if (boardSurfaceSignature === nextSignature) {
      boardSurfaceSkippedCount += 1;
      return boardTextureMode;
    }
    boardSurfaceSignature = nextSignature;
    boardTextureMode = nextBoardTextureMode;
    boardSurfaceUpdateCount += 1;
    clearPixiGraphics(boardSurfaceFill);
    clearPixiGraphics(boardSurfaceOverlay);
    boardSurfaceFill.visible = boardTextureMode === 'single-surface';
    boardSurfaceOverlay.visible = boardTextureMode === 'single-surface';
    if (boardTextureMode === 'single-surface') {
      const baseCorners = [
        worldToScene(topology, frame.layout, 0, 0),
        worldToScene(topology, frame.layout, 0, topology.baseCols - 1),
        worldToScene(topology, frame.layout, topology.baseRows - 1, 0),
        worldToScene(topology, frame.layout, topology.baseRows - 1, topology.baseCols - 1)
      ];
      const left = sceneOffsetX + Math.min(...baseCorners.map((corner) => corner.x));
      const top = sceneOffsetY + Math.min(...baseCorners.map((corner) => corner.y));
      const width = topology.baseCols * frame.layout.cellSize;
      const height = topology.baseRows * frame.layout.cellSize;
      const stageScale = frame.layout.stageScale;
      const shadowOffsetY = 8 * stageScale;
      for (const [spread, alpha] of [[12, 0.03], [9, 0.05], [6, 0.07], [4, 0.1], [2, 0.14]] as const) {
        const scaledSpread = spread * stageScale;
        drawPixiRect(
          boardSurfaceFill,
          left - scaledSpread,
          top + shadowOffsetY - scaledSpread,
          width + scaledSpread * 2,
          height + scaledSpread * 2,
          { color: frame.theme.contourShadowColor, alpha }
        );
      }
      for (const [spread, alpha] of [[4, 0.12], [3, 0.15], [2, 0.18], [1, 0.22]] as const) {
        const scaledSpread = spread * stageScale;
        drawPixiRect(
          boardSurfaceFill,
          left - scaledSpread,
          top - scaledSpread,
          width + scaledSpread * 2,
          height + scaledSpread * 2,
          { color: frame.theme.contourMetalColor, alpha }
        );
      }
      drawPixiRect(
        boardSurfaceFill,
        left,
        top,
        width,
        height,
        { color: frame.theme.surfaceColor, alpha: 1 }
      );
      boardSurfaceTexture.texture = texture;
      boardSurfaceTexture.visible = true;
      setPixiPosition(boardSurfaceTexture, left, top);
      boardSurfaceTexture.width = width;
      boardSurfaceTexture.height = height;

      // Mirror #board::before. Keeping this as one retained Graphics object
      // preserves the DOM skin treatment without multiplying board textures
      // across materialized cells.
      const verticalBands = 20;
      for (let index = 0; index < verticalBands; index += 1) {
        const y = top + (height * index) / verticalBands;
        const bandHeight = height / verticalBands + 0.5;
        const t = (index + 0.5) / verticalBands;
        if (t < 0.14) {
          drawPixiRect(boardSurfaceOverlay, left, y, width, bandHeight, {
            color: '#fff8da', alpha: 0.035 * (1 - t / 0.14)
          });
        } else if (t > 0.7) {
          drawPixiRect(boardSurfaceOverlay, left, y, width, bandHeight, {
            color: '#000000', alpha: 0.3 * ((t - 0.7) / 0.3)
          });
        }
      }
      const radialRadius = Math.min(width, height) * 0.42;
      const radialSteps = 6;
      for (let index = radialSteps; index >= 1; index -= 1) {
        const ratio = index / radialSteps;
        drawPixiCircle(
          boardSurfaceOverlay,
          left + width * 0.5,
          top + height * 0.44,
          radialRadius * ratio,
          { color: '#68ffe5', alpha: 0.055 / radialSteps }
        );
        drawPixiCircle(
          boardSurfaceOverlay,
          left + width * 0.5,
          top + height * 0.5,
          radialRadius * 1.095 * ratio,
          { color: '#e0be6e', alpha: 0.032 / radialSteps }
        );
      }
      drawPixiRect(
        boardSurfaceOverlay,
        left + 1,
        top + 1,
        Math.max(0, width - 2),
        Math.max(0, height - 2),
        null,
        { color: '#d6b56a', alpha: 0.16, width: 1 }
      );
    } else if (boardSurfaceTexture) {
      boardSurfaceTexture.visible = false;
      boardSurfaceOverlay.visible = false;
    }
    return boardTextureMode;
  }

  function updateStarPoints(
    frame: BoardVisualFrame,
    sceneOffsetX: number,
    sceneOffsetY: number
  ): void {
    const topology = frame.model.topology;
    const existing = new Set(topology.existingKeys);
    let hasBaseVoid = false;
    if (topology.baseRows === 8 && topology.baseCols === 8) {
      for (let row = 0; row < 8 && !hasBaseVoid; row += 1) {
        for (let col = 0; col < 8; col += 1) {
          if (!existing.has(`${row},${col}`)) {
            hasBaseVoid = true;
            break;
          }
        }
      }
    }
    const cellsByKey = new Map(frame.model.cells.map((cell) => [cell.key, cell]));
    const theoryStarKeys = ['2,2', '2,6', '6,2', '6,6'].filter((key) => (
      cellsByKey.get(key)?.markers.some((marker) => marker.kind === 'theory-number-cell')
    ));
    const nextSignature = JSON.stringify([
      topology.baseRows,
      topology.baseCols,
      hasBaseVoid,
      theoryStarKeys,
      topology.renderRowOffset,
      topology.renderColOffset,
      topology.maxRow,
      topology.maxCol,
      frame.layout.cellSize,
      frame.layout.orientation,
      frame.layout.camera.scrollLeft,
      frame.layout.camera.scrollTop,
      frame.theme.surfaceColor,
      sceneOffsetX,
      sceneOffsetY
    ]);
    if (starPointSignature === nextSignature) return;
    starPointSignature = nextSignature;
    clearPixiGraphics(starPoints);
    starPointCount = 0;
    if (topology.baseRows !== 8 || topology.baseCols !== 8 || hasBaseVoid) return;
    const radius = Math.max(1.5, frame.layout.cellSize * 0.045);
    // Preserve the DOM baseline: the pseudo-element lived at the top-left
    // grid intersection of cells (2|6, 2|6), not at the cell centre.
    for (const row of [2, 6]) {
      for (const col of [2, 6]) {
        const starCell = cellsByKey.get(`${row},${col}`);
        if (starCell?.markers.some((marker) => marker.kind === 'theory-number-cell')) continue;
        const scene = worldToScene(topology, frame.layout, row, col);
        drawPixiCircle(
          starPoints,
          scene.x + sceneOffsetX,
          scene.y + sceneOffsetY,
          radius,
          { color: frame.theme.surfaceColor, alpha: 0.72 }
        );
        starPointCount += 1;
      }
    }
  }

  function staticSurfaceSignature(
    frame: BoardVisualFrame,
    materialized: readonly MaterializedBoardCellVisualState[],
    context: PixiBoardSceneApplyContext,
    textureMode: PixiStaticBoardTextureMode,
    sceneOffsetX: number,
    sceneOffsetY: number
  ): string {
    return JSON.stringify([
      frame.renderSessionId,
      frameSurfaceRevisionSignature(frame, textureIdentity(context, 'surface'), textureMode),
      frame.model.topology.existingKeys,
      frame.model.topology.playableKeys,
      frame.model.topology.holeKeys,
      frame.model.topology.renderRowOffset,
      frame.model.topology.renderColOffset,
      frame.layout.dpr,
      frame.layout.visibleWorldWindow,
      frame.layout.camera.scrollLeft,
      frame.layout.camera.scrollTop,
      frame.layout.camera.viewportWidth,
      frame.layout.camera.viewportHeight,
      sceneOffsetX,
      sceneOffsetY,
      materialized.map((cell) => [cell.key, cell.surfaceSignature]),
      sortedWorldKeys(topologyPatchKeys)
    ]);
  }

  function bakeStaticSurface(
    frame: BoardVisualFrame,
    context: PixiBoardSceneApplyContext,
    materialized: readonly MaterializedBoardCellVisualState[],
    textureMode: PixiStaticBoardTextureMode,
    sceneOffsetX: number,
    sceneOffsetY: number
  ): void {
    const signature = staticSurfaceSignature(
      frame,
      materialized,
      context,
      textureMode,
      sceneOffsetX,
      sceneOffsetY
    );
    const overscanPixels = PIXI_BOARD_OBJECT_OVERSCAN_CELLS * frame.layout.cellSize;
    const textureOriginX = sceneOffsetX - overscanPixels;
    const textureOriginY = sceneOffsetY - overscanPixels;
    const bakeOptions = {
      signature,
      width: frame.layout.camera.viewportWidth + overscanPixels * 2,
      height: frame.layout.camera.viewportHeight + overscanPixels * 2,
      resolution: frame.layout.dpr,
      sceneOffsetX: textureOriginX,
      sceneOffsetY: textureOriginY
    };
    if (staticBoardLayer.getDiagnostics().signature === signature) {
      staticBoardLayer.applyBase({ ...bakeOptions, source: null });
      return;
    }

    updateStarPoints(frame, sceneOffsetX, sceneOffsetY);
    const baseSource = createPixiContainer(runtime, 'pixi-static-board-bake-source');
    const patchSource = topologyPatchKeys.size
      ? createPixiContainer(runtime, 'pixi-static-board-patch-source')
      : null;
    const temporaryViews: PixiCellView[] = [];
    const nextDiagnostics = new Map<string, ReturnType<PixiCellView['getDiagnostics']>>();
    try {
      addPixiChild(baseSource, boardSurfaceFill, boardSurfaceTexture, boardSurfaceOverlay, starPoints);
      const surfaceRevisionSignature = frameSurfaceRevisionSignature(
        frame,
        textureIdentity(context, 'surface'),
        textureMode
      );
      const stoneRevisionSignature = frameStoneRevisionSignature(frame, textureIdentity(context, 'stone'));
      const interactionRevisionSignature = frameInteractionRevisionSignature(frame, textureMode);
      for (const cell of materialized) {
        const scene = worldToScene(frame.model.topology, frame.layout, cell.row, cell.col);
        const view = createPixiCellView(runtime);
        temporaryViews.push(view);
        view.update(cell, {
          layout: frame.layout,
          theme: frame.theme,
          surfaceRevisionSignature,
          stoneRevisionSignature,
          interactionRevisionSignature,
          sceneOffsetX,
          sceneOffsetY,
          sceneX: scene.x + sceneOffsetX,
          sceneY: scene.y + sceneOffsetY,
          textures: context.textures,
          boardTextureMode: textureMode
        });
        nextDiagnostics.set(cell.key, view.getDiagnostics());
        const target = patchSource && topologyPatchKeys.has(cell.key) ? patchSource : baseSource;
        addPixiChild(target, view.surfaceRoot, view.cellRoot, view.markerRoot);
      }
      staticBoardLayer.applyBase({ ...bakeOptions, source: baseSource });
      staticBoardLayer.applyPatch(patchSource
        ? { ...bakeOptions, source: patchSource, signature: `${signature}:patch` }
        : null);
      cellDiagnosticsByKey.clear();
      for (const [key, diagnostics] of nextDiagnostics) cellDiagnosticsByKey.set(key, diagnostics);
    } finally {
      removePixiFromParent(boardSurfaceFill);
      removePixiFromParent(boardSurfaceTexture);
      removePixiFromParent(boardSurfaceOverlay);
      removePixiFromParent(starPoints);
      for (const view of temporaryViews) view.destroy();
      destroyPixiDisplayObject(baseSource);
      if (patchSource) destroyPixiDisplayObject(patchSource);
    }
  }

  function rebakeLatestStaticSurface(): void {
    if (!latestFrame || !latestApplyContext) {
      staticBoardLayer.applyPatch(null);
      return;
    }
    const materialized = materializeBoardViewport({
      model: latestFrame.model,
      visibleWindow: latestFrame.layout.visibleWorldWindow,
      overscanCells: PIXI_BOARD_OBJECT_OVERSCAN_CELLS,
      effectGutterCells
    });
    bakeStaticSurface(
      latestFrame,
      latestApplyContext,
      materialized,
      boardTextureMode,
      latestSceneOffsetX,
      latestSceneOffsetY
    );
  }

  function emptyStoneDiagnostics(
    cell: MaterializedBoardCellVisualState,
    sceneX: number,
    sceneY: number
  ): PixiStoneViewDiagnostics {
    return Object.freeze({
      updateCount: 0,
      resetCount: 0,
      destroyed: false,
      key: cell.key,
      visible: false,
      owner: null,
      specialType: null,
      timerLabel: '',
      badgeLabel: '',
      flipProtectionBadgeVisible: false,
      statusLabels: Object.freeze([]),
      textureBacked: false,
      texturePurpose: null,
      renderedMarkerKinds: Object.freeze([]),
      position: Object.freeze({ x: sceneX, y: sceneY })
    });
  }

  function applyFrame(
    frame: BoardVisualFrame,
    context: PixiBoardSceneApplyContext = {}
  ): PixiBoardSceneApplyResult {
    assertAlive();
    if (!frame || !frame.model || !frame.layout || !frame.appearance || !frame.theme) {
      throw new Error('Pixi board scene requires a complete BoardVisualFrame');
    }
    const defaultOffset = effectGutterCells * frame.layout.cellSize;
    const sceneOffsetX = Number.isFinite(Number(context.canvasViewport?.sceneOffsetX))
      ? Number(context.canvasViewport!.sceneOffsetX)
      : defaultOffset;
    const sceneOffsetY = Number.isFinite(Number(context.canvasViewport?.sceneOffsetY))
      ? Number(context.canvasViewport!.sceneOffsetY)
      : defaultOffset;
    updateViewportMasks(frame, sceneOffsetX, sceneOffsetY);
    topologyPatchKeys = new Set(Array.isArray(context.topologyRevealKeys)
      ? context.topologyRevealKeys
      : Array.from(topologyReveals.values()).flatMap((value) => Array.from(value.keys)));
    // This one static parent receives Federated global moves and delegates
    // cell authority to the shared O(1) controller. Child hit areas exist
    // only for materialized sparse cells; no dense void model is allocated.
    layers.interaction.eventMode = 'static';
    layers.interaction.hitArea = rectangularHitArea(
      frame.layout.camera.viewportWidth,
      frame.layout.camera.viewportHeight
    );
    const nextBoardTextureMode = updateBoardSurface(frame, context, sceneOffsetX, sceneOffsetY);
    const materialized = materializeBoardViewport({
      model: frame.model,
      visibleWindow: frame.layout.visibleWorldWindow,
      overscanCells: PIXI_BOARD_OBJECT_OVERSCAN_CELLS,
      effectGutterCells
    });
    materializationWindow = getBoardViewportMaterializationWindow({
      model: frame.model,
      visibleWindow: frame.layout.visibleWorldWindow,
      overscanCells: PIXI_BOARD_OBJECT_OVERSCAN_CELLS,
      effectGutterCells
    });
    const desired = new Set(materialized.map((cell) => cell.key));
    let releasedViews = 0;
    for (const key of Array.from(active.keys())) {
      if (!desired.has(key) && releaseKey(key)) releasedViews += 1;
    }

    const createdBefore = pool.getDiagnostics().created;
    let reusedViews = 0;
    let updatedViews = 0;
    let updatedCellViews = 0;
    let updatedStoneViews = 0;
    let updatedHintViews = 0;
    let hintPaintCount = 0;
    let hintInputSyncCount = 0;
    let skippedViews = 0;
    const currentSurfaceTextureIdentity = textureIdentity(context, 'surface');
    const currentStoneTextureIdentity = textureIdentity(context, 'stone');
    const surfaceRevisionSignature = frameSurfaceRevisionSignature(
      frame,
      currentSurfaceTextureIdentity,
      nextBoardTextureMode
    );
    const stoneRevisionSignature = frameStoneRevisionSignature(frame, currentStoneTextureIdentity);
    const interactionRevisionSignature = frameInteractionRevisionSignature(frame, nextBoardTextureMode);
    const staticBakeCountBefore = staticBoardLayer.getDiagnostics().bakeCount;
    bakeStaticSurface(
      frame,
      context,
      materialized,
      nextBoardTextureMode,
      sceneOffsetX,
      sceneOffsetY
    );
    if (topologyReveals.size) {
      staticBoardLayer.setPatchAlpha(Math.min(...Array.from(topologyReveals.values()).map((value) => value.progress)));
    }
    const staticSurfaceChanged = staticBoardLayer.getDiagnostics().bakeCount !== staticBakeCountBefore;
    for (const cell of materialized) {
      let views = active.get(cell.key);
      if (!views) {
        const createdBeforeAcquire = pool.getDiagnostics().created;
        views = pool.acquire();
        if (pool.getDiagnostics().created === createdBeforeAcquire) reusedViews += 1;
        active.set(cell.key, views);
        attachViews(views);
      }
      materializedByKey.set(cell.key, cell);
      const scene = worldToScene(frame.model.topology, frame.layout, cell.row, cell.col);
      const viewContext: PixiStaticViewContext = {
        layout: frame.layout,
        theme: frame.theme,
        surfaceRevisionSignature,
        stoneRevisionSignature,
        interactionRevisionSignature,
        sceneOffsetX,
        sceneOffsetY,
        sceneX: scene.x + sceneOffsetX,
        sceneY: scene.y + sceneOffsetY,
        textures: context.textures,
        boardTextureMode: nextBoardTextureMode
      };
      const cellChanged = staticSurfaceChanged;
      let stoneChanged = false;
      if (hasPixiStoneVisual(cell)) {
        let stoneView = activeStones.get(cell.key);
        if (!stoneView) {
          stoneView = stonePool.acquire();
          activeStones.set(cell.key, stoneView);
          addPixiChild(layers.stone, stoneView.root);
          stoneChanged = true;
        }
        stoneChanged = stoneView.update(cell, viewContext) || stoneChanged;
        retainedStoneBaseVisibility.set(cell.key, true);
        applyRetainedStoneProjection(cell.key, stoneView, frame.layout.cellSize);
      } else {
        const stoneView = activeStones.get(cell.key);
        if (stoneView) {
          activeStones.delete(cell.key);
          stonePool.release(stoneView);
          stoneChanged = true;
        }
        retainedStoneBaseVisibility.delete(cell.key);
      }
      const hintUpdate = views.hint.updateDetailed(cell, viewContext);
      const hintChanged = hintUpdate.changed;
      if (cellChanged) updatedCellViews += 1;
      if (stoneChanged) updatedStoneViews += 1;
      if (hintChanged) updatedHintViews += 1;
      if (hintUpdate.painted) hintPaintCount += 1;
      if (hintUpdate.inputSynced) hintInputSyncCount += 1;
      applyTopologyRevealAlpha(cell.key, views);
      if (cellChanged || stoneChanged || hintChanged) updatedViews += 1;
      else skippedViews += 1;
    }
    latestFrame = frame;
    latestApplyContext = Object.freeze({ ...context });
    latestSceneOffsetX = sceneOffsetX;
    latestSceneOffsetY = sceneOffsetY;
    latestViewContext = {
      layout: frame.layout,
      theme: frame.theme,
      surfaceRevisionSignature,
      stoneRevisionSignature,
      interactionRevisionSignature,
      sceneOffsetX,
      sceneOffsetY,
      textures: context.textures,
      boardTextureMode: nextBoardTextureMode
    };
    if (playbackScope) {
      syncPlaybackGhosts();
      syncPlaybackHighlights();
      syncPlaybackEffects();
      if (context.preservePlaybackProjection !== true) resetPlaybackProjectionInternal();
    }
    applyCount += 1;
    cumulativeUpdatedViewCount += updatedViews;
    cumulativeUpdatedCellViewCount += updatedCellViews;
    cumulativeUpdatedStoneViewCount += updatedStoneViews;
    cumulativeUpdatedHintViewCount += updatedHintViews;
    cumulativeHintPaintCount += hintPaintCount;
    cumulativeHintInputSyncCount += hintInputSyncCount;
    cumulativeSkippedViewCount += skippedViews;
    return Object.freeze({
      materializedCount: materialized.length,
      createdViews: pool.getDiagnostics().created - createdBefore,
      reusedViews,
      updatedViews,
      updatedCellViews,
      updatedStoneViews,
      updatedHintViews,
      hintPaintCount,
      hintInputSyncCount,
      skippedViews,
      releasedViews,
      materializationWindow
    });
  }

  function getRenderedCell(row: number, col: number): PixiBoardSceneRenderedCell | null {
    const key = `${Math.trunc(row)},${Math.trunc(col)}`;
    const views = active.get(key);
    if (!views) return null;
    const cell = cellDiagnosticsByKey.get(key);
    const materialized = materializedByKey.get(key);
    if (!cell || !materialized) return null;
    const stone = activeStones.get(key)?.getDiagnostics() || emptyStoneDiagnostics(
      materialized,
      cell.position.x,
      cell.position.y
    );
    return Object.freeze({
      key,
      kind: materializedByKey.get(key)?.kind || null,
      position: cell.position,
      cell,
      stone,
      hint: views.hint.getDiagnostics(),
      topologyRevealAlpha: topologyRevealAlphaForKey(key),
      playback: retainedPlaybackDiagnostics(key)
    });
  }

  function invalidateStaticViews(): void {
    assertAlive();
    boardSurfaceSignature = null;
    starPointSignature = null;
    staticBoardLayer.invalidate();
    for (const views of active.values()) {
      views.hint.invalidate();
    }
    for (const stoneView of activeStones.values()) stoneView.invalidate();
  }

  function reset(): void {
    if (destroyed) return;
    latestApplyContext = null;
    resetTopologyRevealsInternal();
    resetPlaybackProjectionInternal();
    for (const key of Array.from(active.keys())) releaseKey(key);
    materializedByKey.clear();
    cellDiagnosticsByKey.clear();
    retainedStoneBaseVisibility.clear();
    clearPixiGraphics(starPoints);
    starPointCount = 0;
    starPointSignature = null;
    boardTextureMode = 'none';
    boardSurfaceSignature = null;
    clearPixiGraphics(boardSurfaceFill);
    clearPixiGraphics(boardSurfaceOverlay);
    boardSurfaceFill.visible = false;
    boardSurfaceOverlay.visible = false;
    if (boardSurfaceTexture) boardSurfaceTexture.visible = false;
    staticBoardLayer.reset();
    for (const mask of Object.values(viewportMasks)) clearPixiGraphics(mask);
    viewportClipRect = null;
    layers.interaction.eventMode = 'none';
    layers.interaction.hitArea = null;
    materializationWindow = null;
    latestFrame = null;
    latestViewContext = null;
    topologyPatchKeys.clear();
    resetCount += 1;
  }

  function destroy(): void {
    if (destroyed) return;
    reset();
    destroyed = true;
    pool.destroy();
    stonePool.destroy();
    playbackGhostPool.destroy();
    playbackMarkerGhostPool.destroy();
    playbackHighlightPool.destroy();
    playbackEffectPool.destroy();
    sourceTrajectoryPool.destroy();
    staticBoardLayer.destroy();
    destroyPixiDisplayObject(boardSurfaceFill);
    destroyPixiDisplayObject(boardSurfaceTexture);
    destroyPixiDisplayObject(boardSurfaceOverlay);
    destroyPixiDisplayObject(starPoints);
    for (const name of PIXI_BOARD_VIEWPORT_CLIPPED_LAYER_NAMES) layers[name].mask = null;
    removePixiFromParent(root);
    destroyPixiDisplayObject(root);
  }

  function getDiagnostics(): PixiBoardSceneDiagnostics {
    const poolDiagnostics = pool.getDiagnostics();
    const stonePoolDiagnostics = stonePool.getDiagnostics();
    const staticDiagnostics = staticBoardLayer.getDiagnostics();
    const ghostPoolDiagnostics = playbackGhostPool.getDiagnostics();
    const markerGhostPoolDiagnostics = playbackMarkerGhostPool.getDiagnostics();
    const highlightPoolDiagnostics = playbackHighlightPool.getDiagnostics();
    const effectPoolDiagnostics = playbackEffectPool.getDiagnostics();
    const sourceTrajectoryPoolDiagnostics = sourceTrajectoryPool.getDiagnostics();
    let textureBackedStoneCount = 0;
    let proceduralStoneCount = 0;
    let ephemeralVoidCount = 0;
    let holeCount = 0;
    let cellBoardTextureCount = 0;
    for (const key of active.keys()) {
      const materialized = materializedByKey.get(key);
      if (materialized?.kind === 'void') ephemeralVoidCount += 1;
      if (materialized?.kind === 'hole') holeCount += 1;
      if (cellDiagnosticsByKey.get(key)?.usesBoardTexture) cellBoardTextureCount += 1;
      const stone = activeStones.get(key)?.getDiagnostics();
      if (!stone) continue;
      if (stone.visible && stone.textureBacked) textureBackedStoneCount += 1;
      if (stone.visible && !stone.textureBacked) proceduralStoneCount += 1;
    }
    return Object.freeze({
      destroyed,
      applyCount,
      resetCount,
      activeViewCount: active.size,
      pooledViewCount: poolDiagnostics.available,
      createdViewCount: poolDiagnostics.created,
      destroyedViewCount: poolDiagnostics.destroyed,
      cumulativeUpdatedViewCount,
      cumulativeUpdatedCellViewCount,
      cumulativeUpdatedStoneViewCount,
      cumulativeUpdatedHintViewCount,
      cumulativeHintPaintCount,
      cumulativeHintInputSyncCount,
      cumulativeSkippedViewCount,
      cumulativeReleasedViewCount,
      boardSurfaceUpdateCount,
      boardSurfaceSkippedCount,
      displayObjectCount: destroyed ? 0 : countDisplayObjects(root),
      textureBackedStoneCount,
      proceduralStoneCount,
      ephemeralVoidCount,
      holeCount,
      starPointCount,
      boardTextureMode,
      surfaceBoardTextureCount: boardTextureMode === 'single-surface' ? 1 : 0,
      cellBoardTextureCount,
      objectOverscanCells: PIXI_BOARD_OBJECT_OVERSCAN_CELLS,
      effectGutterCells,
      viewportClippedLayerNames: PIXI_BOARD_VIEWPORT_CLIPPED_LAYER_NAMES,
      viewportClipRect,
      canvasCount: 0 as const,
      domNodeCount: 0 as const,
      layerOrder: PIXI_BOARD_SCENE_LAYER_ORDER,
      retainedKeys: Object.freeze(sortedWorldKeys(active.keys())),
      materializationWindow,
      playbackScopeKey: playbackScope?.key || null,
      retainedStoneOverrideCount: retainedStoneOverrides.size,
      hiddenStoneCount: hiddenStoneKeys.size,
      activePlaybackGhostCount: playbackGhosts.size,
      materializedPlaybackGhostCount: Array.from(playbackGhosts.values())
        .filter((record) => !!record.view).length,
      pooledPlaybackGhostCount: ghostPoolDiagnostics.available + markerGhostPoolDiagnostics.available,
      createdPlaybackGhostCount: ghostPoolDiagnostics.created + markerGhostPoolDiagnostics.created,
      destroyedPlaybackGhostCount: ghostPoolDiagnostics.destroyed + markerGhostPoolDiagnostics.destroyed,
      pooledPlaybackStoneGhostCount: ghostPoolDiagnostics.available,
      createdPlaybackStoneGhostCount: ghostPoolDiagnostics.created,
      destroyedPlaybackStoneGhostCount: ghostPoolDiagnostics.destroyed,
      pooledPlaybackMarkerGhostCount: markerGhostPoolDiagnostics.available,
      createdPlaybackMarkerGhostCount: markerGhostPoolDiagnostics.created,
      destroyedPlaybackMarkerGhostCount: markerGhostPoolDiagnostics.destroyed,
      activePlaybackHighlightLeaseCount: playbackHighlightLeases.size,
      renderedPlaybackHighlightCount: playbackHighlightsByKey.size,
      pooledPlaybackHighlightCount: highlightPoolDiagnostics.available,
      activePlaybackEffectCount: playbackEffects.size,
      materializedPlaybackEffectCount: Array.from(playbackEffects.values())
        .filter((record) => !!record.view).length,
      pooledPlaybackEffectCount: effectPoolDiagnostics.available,
      createdPlaybackEffectCount: effectPoolDiagnostics.created,
      destroyedPlaybackEffectCount: effectPoolDiagnostics.destroyed,
      activeSourceTrajectoryCount: sourceTrajectories.size,
      activeSourceTrajectoryTextureLeaseCount: Array.from(sourceTrajectories.values())
        .filter((record) => !!record.textureLease && record.textureLease.released !== true).length,
      pooledSourceTrajectoryCount: sourceTrajectoryPoolDiagnostics.available,
      createdSourceTrajectoryViewCount: sourceTrajectoryPoolDiagnostics.created,
      destroyedSourceTrajectoryViewCount: sourceTrajectoryPoolDiagnostics.destroyed,
      sourceTrajectoryByProfile: freezeTrajectoryCounters(sourceTrajectoryByProfile),
      sourceTrajectoryByPrimitive: freezeTrajectoryCounters(sourceTrajectoryByPrimitive),
      activeTopologyRevealCount: topologyReveals.size,
      topologyRevealKeys: Object.freeze(sortedWorldKeys(new Set(
        Array.from(topologyReveals.values()).flatMap((reveal) => Array.from(reveal.keys))
      ))),
      activeStoneViewCount: activeStones.size,
      pooledStoneViewCount: stonePoolDiagnostics.available,
      staticBakeCount: staticDiagnostics.bakeCount,
      staticBakeSkipCount: staticDiagnostics.bakeSkipCount,
      staticPatchBakeCount: staticDiagnostics.patchBakeCount,
      staticAttachedObjectCount: staticDiagnostics.attachedObjectCount,
      staticTemporaryObjectCount: staticDiagnostics.temporaryObjectCount,
      staticTexturePhysicalWidth: staticDiagnostics.texturePhysicalWidth,
      staticTexturePhysicalHeight: staticDiagnostics.texturePhysicalHeight
    });
  }

  return Object.freeze({
    root,
    layers,
    applyFrame,
    invalidateStaticViews,
    beginPlaybackScope,
    isPlaybackScopeActive,
    retainStoneOverride,
    hideStone,
    acquirePlaybackGhost,
    updatePlaybackGhost,
    releasePlaybackGhost,
    acquirePlaybackCellHighlight,
    releasePlaybackCellHighlight,
    acquirePlaybackEffect,
    updatePlaybackEffect,
    releasePlaybackEffect,
    snapshotSourceTrajectoryGeometry,
    acquireSourceTrajectory,
    updateSourceTrajectory,
    releaseSourceTrajectory,
    getSourceTrajectory,
    getPlaybackGhost,
    getPlaybackEffect,
    beginTopologyReveal,
    updateTopologyReveal,
    endTopologyReveal,
    resetPlaybackProjection,
    getRenderedCell,
    getDiagnostics,
    reset,
    destroy
  });
}
