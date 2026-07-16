import { getMaxBoardLocalEffectGutterCells } from '../board-visual/effect-bounds';
import {
  getBoardViewportMaterializationWindow,
  materializeBoardViewport
} from '../board-visual/model';
import { worldToScene } from '../board-visual/layout';
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
  destroyPixiDisplayObject,
  drawPixiCircle,
  drawPixiRect,
  removePixiFromParent,
  resolvePixiStaticTexture,
  setPixiPosition,
  setPixiScale,
  type PixiCellView,
  type PixiStaticBoardTextureMode,
  type PixiStaticTextureSource,
  type PixiStaticViewContext,
  type PixiStaticViewRuntime,
  createPixiCellView
} from './cell-view';
import { createPixiHintView, type PixiHintView } from './hint-view';
import { createPixiStoneView, hasPixiStoneVisual, type PixiStoneView } from './stone-view';

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

export interface PixiBoardSceneOptions {
  readonly runtime: PixiStaticViewRuntime;
  readonly stage?: any;
  readonly effectGutterCells?: number;
  readonly maxRetainedViews?: number;
  readonly maxRetainedGhosts?: number;
}

export interface PixiBoardSceneApplyContext {
  readonly textures?: PixiStaticTextureSource | null;
  readonly textureRevision?: string | number | null;
  readonly canvasViewport?: Pick<PixiBoardCanvasViewport, 'sceneOffsetX' | 'sceneOffsetY'> | null;
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
  readonly stone: BoardStoneVisualState;
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
  readonly cumulativeSkippedViewCount: number;
  readonly cumulativeReleasedViewCount: number;
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
  readonly canvasCount: 0;
  readonly domNodeCount: 0;
  readonly layerOrder: readonly PixiBoardSceneLayerName[];
  readonly retainedKeys: readonly string[];
  readonly materializationWindow: BoardWorldWindow | null;
  readonly playbackScopeKey: string | null;
  readonly retainedStoneOverrideCount: number;
  readonly hiddenStoneCount: number;
  readonly activePlaybackGhostCount: number;
  readonly pooledPlaybackGhostCount: number;
  readonly createdPlaybackGhostCount: number;
  readonly destroyedPlaybackGhostCount: number;
  readonly activePlaybackHighlightLeaseCount: number;
  readonly renderedPlaybackHighlightCount: number;
  readonly pooledPlaybackHighlightCount: number;
}

export interface PixiBoardScene {
  readonly root: any;
  readonly layers: Readonly<Record<PixiBoardSceneLayerName, any>>;
  applyFrame(frame: BoardVisualFrame, context?: PixiBoardSceneApplyContext): PixiBoardSceneApplyResult;
  beginPlaybackScope(scopeKey: string | number): PixiPlaybackProjectionScope;
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
  getPlaybackGhost(handle: PixiPlaybackGhostHandle): PixiPlaybackGhostDiagnostics | null;
  resetPlaybackProjection(scope?: PixiPlaybackProjectionScope): void;
  getRenderedCell(row: number, col: number): PixiBoardSceneRenderedCell | null;
  getDiagnostics(): PixiBoardSceneDiagnostics;
  reset(): void;
  destroy(): void;
}

interface RetainedCellViews {
  readonly cell: PixiCellView;
  readonly stone: PixiStoneView;
  readonly hint: PixiHintView;
}

interface PlaybackGhostRecord {
  readonly handle: PixiPlaybackGhostHandle;
  readonly view: PixiStoneView;
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

function frameViewRevisionSignature(
  frame: BoardVisualFrame,
  textureIdentity: string,
  sceneOffsetX: number,
  sceneOffsetY: number,
  boardTextureMode: PixiStaticBoardTextureMode
): string {
  return JSON.stringify([
    frame.layout.revision,
    frame.layout.cellSize,
    frame.layout.orientation,
    frame.layout.camera.scrollLeft,
    frame.layout.camera.scrollTop,
    frame.layout.camera.viewportWidth,
    frame.layout.camera.viewportHeight,
    frame.appearance.revision,
    frame.appearance.boardSkinId,
    frame.appearance.stoneSkinId,
    frame.appearance.boardImageUrl,
    frame.appearance.blackStoneImageUrl,
    frame.appearance.whiteStoneImageUrl,
    frame.theme.revision,
    frame.theme.fontReadyEpoch,
    textureIdentity,
    boardTextureMode,
    sceneOffsetX,
    sceneOffsetY
  ]);
}

function resetRetainedViews(views: RetainedCellViews): void {
  views.cell.reset();
  views.stone.reset();
  views.hint.reset();
}

function destroyRetainedViews(views: RetainedCellViews): void {
  views.cell.destroy();
  views.stone.destroy();
  views.hint.destroy();
}

export function createPixiBoardScene(options: PixiBoardSceneOptions): PixiBoardScene {
  if (!options || !options.runtime) throw new Error('Pixi board scene runtime is required');
  const runtime = options.runtime;
  const effectGutterCells = normalizeEffectGutter(options.effectGutterCells);
  const maxRetainedViews = normalizeMaxRetainedViews(options.maxRetainedViews);
  const maxRetainedGhosts = normalizeMaxRetainedGhosts(options.maxRetainedGhosts);
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
  if (options.stage) addPixiChild(options.stage, root);
  const boardSurfaceFill = createPixiGraphics(runtime, 'pixi-board-surface-fill');
  const boardSurfaceTexture = createPixiSprite(runtime, 'pixi-board-surface-texture');
  const boardSurfaceOverlay = createPixiGraphics(runtime, 'pixi-board-surface-overlay');
  addPixiChild(layers.surface, boardSurfaceFill, boardSurfaceTexture, boardSurfaceOverlay);
  const starPoints = createPixiGraphics(runtime, 'pixi-board-star-points');
  addPixiChild(layers.marker, starPoints);
  const pool: ObjectPool<RetainedCellViews> = createObjectPool({
    create: () => Object.freeze({
      cell: createPixiCellView(runtime),
      stone: createPixiStoneView(runtime),
      hint: createPixiHintView(runtime)
    }),
    reset: resetRetainedViews,
    destroy: destroyRetainedViews,
    maxRetained: maxRetainedViews
  });
  const playbackGhostPool: ObjectPool<PixiStoneView> = createObjectPool({
    create: () => createPixiStoneView(runtime),
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
  const active = new Map<string, RetainedCellViews>();
  const materializedByKey = new Map<string, MaterializedBoardCellVisualState>();
  const retainedStoneBaseVisibility = new Map<string, boolean>();
  const retainedStoneOverrides = new Map<string, Required<PixiRetainedStoneOverride>>();
  const hiddenStoneKeys = new Set<string>();
  const playbackGhosts = new Map<number, PlaybackGhostRecord>();
  const playbackHighlightLeases = new Map<number, PlaybackHighlightLease>();
  const playbackHighlightsByKey = new Map<string, any>();
  const textureIds = new WeakMap<object, number>();
  let nextTextureId = 1;
  let nextPlaybackScopeId = 1;
  let nextPlaybackGhostId = 1;
  let nextPlaybackHighlightId = 1;
  let playbackScope: PixiPlaybackProjectionScope | null = null;
  let latestFrame: BoardVisualFrame | null = null;
  let latestViewContext: Omit<PixiStaticViewContext, 'sceneX' | 'sceneY'> | null = null;
  let destroyed = false;
  let applyCount = 0;
  let resetCount = 0;
  let cumulativeUpdatedViewCount = 0;
  let cumulativeSkippedViewCount = 0;
  let cumulativeReleasedViewCount = 0;
  let materializationWindow: BoardWorldWindow | null = null;
  let starPointCount = 0;
  let starPointSignature: string | null = null;
  let boardTextureMode: PixiStaticBoardTextureMode = 'none';

  function assertAlive(): void {
    if (destroyed) throw new Error('PixiBoardScene is destroyed');
  }

  function textureIdentity(context: PixiBoardSceneApplyContext): string {
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
      stone: options.stone,
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
      visualSignature: `playback-ghost:${handle.scopeId}:${handle.id}`
    });
  }

  function syncPlaybackGhost(record: PlaybackGhostRecord): void {
    const context = viewContextAt(record.row, record.col);
    record.view.update(record.cell, context);
    setPlaybackTransform(
      record.view.root,
      context.sceneX,
      context.sceneY,
      context.layout.cellSize,
      record.transform
    );
    record.view.root.visible = record.transform.visible
      && isGhostInsideMaterialization(record);
  }

  function syncPlaybackGhosts(): void {
    for (const record of playbackGhosts.values()) syncPlaybackGhost(record);
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
    const views = active.get(key);
    if (views && latestFrame) applyRetainedStoneProjection(key, views.stone, latestFrame.layout.cellSize);
  }

  function hideStone(scope: PixiPlaybackProjectionScope, row: number, col: number): void {
    assertPlaybackScope(scope);
    const key = integerWorldKey(row, col);
    hiddenStoneKeys.add(key);
    const views = active.get(key);
    if (views) views.stone.root.visible = false;
  }

  function acquirePlaybackGhost(
    scope: PixiPlaybackProjectionScope,
    options: PixiPlaybackGhostOptions
  ): PixiPlaybackGhostHandle {
    assertPlaybackScope(scope);
    if (!options || !options.stone) throw new Error('Pixi playback ghost stone is required');
    integerWorldKey(options.row, options.col);
    const handle = Object.freeze({ id: nextPlaybackGhostId++, scopeId: scope.id });
    const view = playbackGhostPool.acquire();
    const transform = normalizeGhostUpdate({
      row: Number(options.row),
      col: Number(options.col),
      visible: true
    });
    const record: PlaybackGhostRecord = {
      handle,
      view,
      cell: makePlaybackGhostCell(handle, options),
      row: transform.row,
      col: transform.col,
      transform
    };
    playbackGhosts.set(handle.id, record);
    addPixiChild(layers.playback, view.root);
    try {
      syncPlaybackGhost(record);
    } catch (error) {
      playbackGhosts.delete(handle.id);
      playbackGhostPool.release(view);
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
    playbackGhostPool.release(record.view);
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
    const context = viewContextAt(lease.row, lease.col);
    let view = playbackHighlightsByKey.get(key);
    if (!view) {
      view = playbackHighlightPool.acquire();
      playbackHighlightsByKey.set(key, view);
      addPixiChild(layers.effect, view);
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
    view.visible = isCoordinateInsideMaterialization(lease.row, lease.col);
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

  function getPlaybackGhost(handle: PixiPlaybackGhostHandle): PixiPlaybackGhostDiagnostics | null {
    const record = handle && playbackGhosts.get(handle.id);
    if (!record || record.handle.scopeId !== handle.scopeId || !latestFrame || !latestViewContext) return null;
    const scene = worldToScene(latestFrame.model.topology, latestFrame.layout, record.row, record.col);
    return Object.freeze({
      id: record.handle.id,
      scopeId: record.handle.scopeId,
      row: record.row,
      col: record.col,
      visible: !!record.view.root.visible,
      owner: record.view.getDiagnostics().owner,
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

  function resetPlaybackProjectionInternal(): void {
    for (const record of Array.from(playbackGhosts.values())) {
      playbackGhosts.delete(record.handle.id);
      playbackGhostPool.release(record.view);
    }
    playbackHighlightLeases.clear();
    for (const [key, view] of Array.from(playbackHighlightsByKey.entries())) {
      playbackHighlightsByKey.delete(key);
      playbackHighlightPool.release(view);
    }
    retainedStoneOverrides.clear();
    hiddenStoneKeys.clear();
    playbackScope = null;
    for (const [key, views] of active) restoreRetainedStoneRoot(key, views.stone);
  }

  function resetPlaybackProjection(scope?: PixiPlaybackProjectionScope): void {
    assertAlive();
    if (scope) assertPlaybackScope(scope);
    resetPlaybackProjectionInternal();
  }

  function attachViews(views: RetainedCellViews): void {
    addPixiChild(layers.surface, views.cell.surfaceRoot);
    addPixiChild(layers.cell, views.cell.cellRoot);
    addPixiChild(layers.marker, views.cell.markerRoot);
    addPixiChild(layers.stone, views.stone.root);
    addPixiChild(layers.hint, views.hint.root);
    addPixiChild(layers.interaction, views.hint.interactionRoot);
  }

  function releaseKey(key: string): boolean {
    const views = active.get(key);
    if (!views) return false;
    restoreRetainedStoneRoot(key, views.stone);
    active.delete(key);
    materializedByKey.delete(key);
    retainedStoneBaseVisibility.delete(key);
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
    boardTextureMode = !texture
      ? 'none'
      : hasBaseVoidCells
        ? 'per-cell'
        : boardSurfaceTexture
          ? 'single-surface'
          : 'none';
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
      const stageScale = (frame.layout.cellSize * Math.max(topology.baseRows, topology.baseCols)) / 496;
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
      frame.layout.revision,
      frame.layout.cellSize,
      frame.layout.orientation,
      frame.layout.camera.scrollLeft,
      frame.layout.camera.scrollTop,
      frame.theme.revision,
      frame.theme.markerColor,
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
    let skippedViews = 0;
    const revisionSignature = frameViewRevisionSignature(
      frame,
      textureIdentity(context),
      sceneOffsetX,
      sceneOffsetY,
      nextBoardTextureMode
    );
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
        revisionSignature,
        sceneOffsetX,
        sceneOffsetY,
        sceneX: scene.x + sceneOffsetX,
        sceneY: scene.y + sceneOffsetY,
        textures: context.textures,
        boardTextureMode: nextBoardTextureMode
      };
      const cellChanged = views.cell.update(cell, viewContext);
      const stoneChanged = views.stone.update(cell, viewContext);
      retainedStoneBaseVisibility.set(cell.key, hasPixiStoneVisual(cell));
      applyRetainedStoneProjection(cell.key, views.stone, frame.layout.cellSize);
      const hintChanged = views.hint.update(cell, viewContext);
      if (cellChanged || stoneChanged || hintChanged) updatedViews += 1;
      else skippedViews += 1;
    }
    updateStarPoints(frame, sceneOffsetX, sceneOffsetY);
    latestFrame = frame;
    latestViewContext = {
      layout: frame.layout,
      theme: frame.theme,
      revisionSignature,
      sceneOffsetX,
      sceneOffsetY,
      textures: context.textures,
      boardTextureMode: nextBoardTextureMode
    };
    if (playbackScope) {
      syncPlaybackGhosts();
      syncPlaybackHighlights();
      if (context.preservePlaybackProjection !== true) resetPlaybackProjectionInternal();
    }
    applyCount += 1;
    cumulativeUpdatedViewCount += updatedViews;
    cumulativeSkippedViewCount += skippedViews;
    return Object.freeze({
      materializedCount: materialized.length,
      createdViews: pool.getDiagnostics().created - createdBefore,
      reusedViews,
      updatedViews,
      skippedViews,
      releasedViews,
      materializationWindow
    });
  }

  function getRenderedCell(row: number, col: number): PixiBoardSceneRenderedCell | null {
    const key = `${Math.trunc(row)},${Math.trunc(col)}`;
    const views = active.get(key);
    if (!views) return null;
    const cell = views.cell.getDiagnostics();
    return Object.freeze({
      key,
      kind: materializedByKey.get(key)?.kind || null,
      position: cell.position,
      cell,
      stone: views.stone.getDiagnostics(),
      hint: views.hint.getDiagnostics(),
      playback: retainedPlaybackDiagnostics(key)
    });
  }

  function reset(): void {
    if (destroyed) return;
    resetPlaybackProjectionInternal();
    for (const key of Array.from(active.keys())) releaseKey(key);
    materializedByKey.clear();
    retainedStoneBaseVisibility.clear();
    clearPixiGraphics(starPoints);
    starPointCount = 0;
    starPointSignature = null;
    boardTextureMode = 'none';
    clearPixiGraphics(boardSurfaceFill);
    clearPixiGraphics(boardSurfaceOverlay);
    boardSurfaceFill.visible = false;
    boardSurfaceOverlay.visible = false;
    if (boardSurfaceTexture) boardSurfaceTexture.visible = false;
    layers.interaction.eventMode = 'none';
    layers.interaction.hitArea = null;
    materializationWindow = null;
    latestFrame = null;
    latestViewContext = null;
    resetCount += 1;
  }

  function destroy(): void {
    if (destroyed) return;
    reset();
    destroyed = true;
    pool.destroy();
    playbackGhostPool.destroy();
    playbackHighlightPool.destroy();
    removePixiFromParent(root);
    destroyPixiDisplayObject(root);
  }

  function getDiagnostics(): PixiBoardSceneDiagnostics {
    const poolDiagnostics = pool.getDiagnostics();
    const ghostPoolDiagnostics = playbackGhostPool.getDiagnostics();
    const highlightPoolDiagnostics = playbackHighlightPool.getDiagnostics();
    let textureBackedStoneCount = 0;
    let proceduralStoneCount = 0;
    let ephemeralVoidCount = 0;
    let holeCount = 0;
    let cellBoardTextureCount = 0;
    for (const [key, views] of active) {
      const materialized = materializedByKey.get(key);
      if (materialized?.kind === 'void') ephemeralVoidCount += 1;
      if (materialized?.kind === 'hole') holeCount += 1;
      if (views.cell.getDiagnostics().usesBoardTexture) cellBoardTextureCount += 1;
      const stone = views.stone.getDiagnostics();
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
      cumulativeSkippedViewCount,
      cumulativeReleasedViewCount,
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
      canvasCount: 0 as const,
      domNodeCount: 0 as const,
      layerOrder: PIXI_BOARD_SCENE_LAYER_ORDER,
      retainedKeys: Object.freeze(sortedWorldKeys(active.keys())),
      materializationWindow,
      playbackScopeKey: playbackScope?.key || null,
      retainedStoneOverrideCount: retainedStoneOverrides.size,
      hiddenStoneCount: hiddenStoneKeys.size,
      activePlaybackGhostCount: playbackGhosts.size,
      pooledPlaybackGhostCount: ghostPoolDiagnostics.available,
      createdPlaybackGhostCount: ghostPoolDiagnostics.created,
      destroyedPlaybackGhostCount: ghostPoolDiagnostics.destroyed,
      activePlaybackHighlightLeaseCount: playbackHighlightLeases.size,
      renderedPlaybackHighlightCount: playbackHighlightsByKey.size,
      pooledPlaybackHighlightCount: highlightPoolDiagnostics.available
    });
  }

  return Object.freeze({
    root,
    layers,
    applyFrame,
    beginPlaybackScope,
    retainStoneOverride,
    hideStone,
    acquirePlaybackGhost,
    updatePlaybackGhost,
    releasePlaybackGhost,
    acquirePlaybackCellHighlight,
    releasePlaybackCellHighlight,
    getPlaybackGhost,
    resetPlaybackProjection,
    getRenderedCell,
    getDiagnostics,
    reset,
    destroy
  });
}
