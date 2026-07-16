import { getMaxBoardLocalEffectGutterCells } from '../board-visual/effect-bounds';
import {
  getBoardViewportMaterializationWindow,
  materializeBoardViewport
} from '../board-visual/model';
import { worldToScene } from '../board-visual/layout';
import type {
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
  type PixiCellView,
  type PixiStaticBoardTextureMode,
  type PixiStaticTextureSource,
  type PixiStaticViewContext,
  type PixiStaticViewRuntime,
  createPixiCellView
} from './cell-view';
import { createPixiHintView, type PixiHintView } from './hint-view';
import { createPixiStoneView, type PixiStoneView } from './stone-view';

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
}

export interface PixiBoardSceneApplyContext {
  readonly textures?: PixiStaticTextureSource | null;
  readonly textureRevision?: string | number | null;
  readonly canvasViewport?: Pick<PixiBoardCanvasViewport, 'sceneOffsetX' | 'sceneOffsetY'> | null;
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
}

export interface PixiBoardScene {
  readonly root: any;
  readonly layers: Readonly<Record<PixiBoardSceneLayerName, any>>;
  applyFrame(frame: BoardVisualFrame, context?: PixiBoardSceneApplyContext): PixiBoardSceneApplyResult;
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
  const root = createPixiContainer(runtime, 'pixi-board-scene');
  root.eventMode = 'none';
  const mutableLayers = {} as Record<PixiBoardSceneLayerName, any>;
  for (const name of PIXI_BOARD_SCENE_LAYER_ORDER) {
    const layer = createPixiContainer(runtime, `pixi-board-layer:${name}`);
    layer.eventMode = 'none';
    layer.sortableChildren = false;
    mutableLayers[name] = layer;
    addPixiChild(root, layer);
  }
  const layers = Object.freeze(mutableLayers);
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
  const active = new Map<string, RetainedCellViews>();
  const materializedByKey = new Map<string, MaterializedBoardCellVisualState>();
  const textureIds = new WeakMap<object, number>();
  let nextTextureId = 1;
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
    active.delete(key);
    materializedByKey.delete(key);
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
      const hintChanged = views.hint.update(cell, viewContext);
      if (cellChanged || stoneChanged || hintChanged) updatedViews += 1;
      else skippedViews += 1;
    }
    updateStarPoints(frame, sceneOffsetX, sceneOffsetY);
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
      hint: views.hint.getDiagnostics()
    });
  }

  function reset(): void {
    if (destroyed) return;
    for (const key of Array.from(active.keys())) releaseKey(key);
    materializedByKey.clear();
    clearPixiGraphics(starPoints);
    starPointCount = 0;
    starPointSignature = null;
    boardTextureMode = 'none';
    clearPixiGraphics(boardSurfaceFill);
    clearPixiGraphics(boardSurfaceOverlay);
    boardSurfaceFill.visible = false;
    boardSurfaceOverlay.visible = false;
    if (boardSurfaceTexture) boardSurfaceTexture.visible = false;
    materializationWindow = null;
    resetCount += 1;
  }

  function destroy(): void {
    if (destroyed) return;
    reset();
    destroyed = true;
    pool.destroy();
    removePixiFromParent(root);
    destroyPixiDisplayObject(root);
  }

  function getDiagnostics(): PixiBoardSceneDiagnostics {
    const poolDiagnostics = pool.getDiagnostics();
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
      materializationWindow
    });
  }

  return Object.freeze({ root, layers, applyFrame, getRenderedCell, getDiagnostics, reset, destroy });
}
