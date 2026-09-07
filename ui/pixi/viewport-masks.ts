import type { BoardVisualFrame } from '../board-visual/types';
import { worldToScene } from '../board-visual/layout';
import {
    addPixiChild,
    clearPixiGraphics,
    createPixiContainer,
    createPixiGraphics,
    drawPixiRect,
    removePixiFromParent,
    destroyPixiDisplayObject,
    type PixiStaticViewRuntime
} from './cell-view';

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

/** Owns viewport clipping resources independently from scene playback and retained stones. */
export function createBoardViewportMasks(runtime: PixiStaticViewRuntime, layers: Readonly<Record<PixiBoardViewportClippedLayerName | 'interaction', any>>) {
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
  let viewportClipRect: PixiBoardViewportClipRect | null = null;
  function update(
    frame: BoardVisualFrame,
    sceneOffsetX: number,
    sceneOffsetY: number,
    canvasWidth?: number,
    canvasHeight?: number
  ): void {
    const fixedViewportClipRect = Object.freeze({
      x: sceneOffsetX,
      y: sceneOffsetY,
      width: frame.layout.camera.viewportWidth,
      height: frame.layout.camera.viewportHeight
    });
    viewportClipRect = fixedViewportClipRect;
    const viewportRight = fixedViewportClipRect.x + fixedViewportClipRect.width;
    const viewportBottom = fixedViewportClipRect.y + fixedViewportClipRect.height;
    const canvasRight = Number.isFinite(canvasWidth) && (canvasWidth as number) > 0
      ? canvasWidth as number
      : viewportRight + sceneOffsetX;
    const canvasBottom = Number.isFinite(canvasHeight) && (canvasHeight as number) > 0
      ? canvasHeight as number
      : viewportBottom + sceneOffsetY;
    const expansionRects = frame.model.cells.flatMap((cell) => {
      if (cell.expansionSide === null) return [];
      const scene = worldToScene(frame.model.topology, frame.layout, cell.row, cell.col);
      const x = scene.x + sceneOffsetX;
      const y = scene.y + sceneOffsetY;
      const right = x + frame.layout.cellSize;
      const bottom = y + frame.layout.cellSize;
      const outsideViewport = x < fixedViewportClipRect.x
        || y < fixedViewportClipRect.y
        || right > viewportRight
        || bottom > viewportBottom;
      const intersectsBoundedCanvas = right > 0
        && bottom > 0
        && x < canvasRight
        && y < canvasBottom;
      return outsideViewport && intersectsBoundedCanvas
        ? [{ x, y, width: frame.layout.cellSize, height: frame.layout.cellSize }]
        : [];
    });
    for (const name of PIXI_BOARD_VIEWPORT_CLIPPED_LAYER_NAMES) {
      const mask = viewportMasks[name];
      clearPixiGraphics(mask);
      drawPixiRect(
        mask,
        fixedViewportClipRect.x,
        fixedViewportClipRect.y,
        fixedViewportClipRect.width,
        fixedViewportClipRect.height,
        { color: '#ffffff', alpha: 1 }
      );
      // The original board viewport is immutable. Expansion cells are sparse
      // attachments painted through the already-bounded canvas gutter, so
      // union only their actual footprints into the mask instead of moving
      // the camera or widening the base-board clip over empty frame space.
      for (const rect of expansionRects) {
        drawPixiRect(mask, rect.x, rect.y, rect.width, rect.height, {
          color: '#ffffff',
          alpha: 1
        });
      }
    }
  }
  function reset(): void {
    for (const mask of Object.values(viewportMasks)) clearPixiGraphics(mask);
    viewportClipRect = null;
  }
  function destroy(): void {
    reset();
    for (const name of PIXI_BOARD_VIEWPORT_CLIPPED_LAYER_NAMES) layers[name].mask = null;
    removePixiFromParent(viewportMaskRoot);
    destroyPixiDisplayObject(viewportMaskRoot);
  }
  return { update, reset, destroy, getClipRect: () => viewportClipRect };
}
