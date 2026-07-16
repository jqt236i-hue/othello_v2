import type { BoardCellDirectionHint, MaterializedBoardCellVisualState } from '../board-visual/types';
import {
  addPixiChild,
  clearPixiGraphics,
  createPixiContainer,
  createPixiGraphics,
  createPixiText,
  destroyPixiDisplayObject,
  drawPixiCircle,
  drawPixiLine,
  drawPixiRect,
  removeAndDestroyPixiChildren,
  removePixiFromParent,
  setPixiAnchor,
  setPixiPosition,
  toPixiTextStyle,
  type PixiStaticViewContext,
  type PixiStaticViewRuntime
} from './cell-view';

export interface PixiHintViewDiagnostics {
  readonly updateCount: number;
  readonly resetCount: number;
  readonly destroyed: boolean;
  readonly key: string | null;
  readonly legal: boolean;
  readonly selectable: boolean;
  readonly selected: boolean;
  readonly keyboardCursor: boolean;
  readonly hovered: boolean;
  readonly interactionLocked: boolean;
  readonly previewKinds: readonly string[];
  readonly selectionKinds: readonly string[];
  readonly directionKeys: readonly string[];
  readonly position: Readonly<{ x: number; y: number }>;
}

export interface PixiHintView {
  readonly root: any;
  readonly interactionRoot: any;
  update(cell: MaterializedBoardCellVisualState, context: PixiStaticViewContext): boolean;
  reset(): void;
  destroy(): void;
  getDiagnostics(): PixiHintViewDiagnostics;
}

function directionPresentation(directionKey: string, cellSize: number): Readonly<{
  glyph: string;
  x: number;
  y: number;
}> {
  const normalized = String(directionKey || '').trim().toLowerCase();
  const low = cellSize * 0.2;
  const high = cellSize * 0.8;
  const center = cellSize * 0.5;
  const values: Readonly<Record<string, readonly [string, number, number]>> = Object.freeze({
    up: ['↑', center, low],
    top: ['↑', center, low],
    right: ['→', high, center],
    down: ['↓', center, high],
    bottom: ['↓', center, high],
    left: ['←', low, center],
    'up-left': ['↖', low, low],
    'up-right': ['↗', high, low],
    'down-right': ['↘', high, high],
    'down-left': ['↙', low, high]
  });
  const value = values[normalized] || ['•', center, center];
  return Object.freeze({ glyph: value[0], x: value[1], y: value[2] });
}

function renderDirectionHints(
  runtime: PixiStaticViewRuntime,
  root: any,
  hints: readonly BoardCellDirectionHint[],
  context: PixiStaticViewContext
): void {
  for (const hint of hints) {
    const presentation = directionPresentation(hint.directionKey, context.layout.cellSize);
    const text = createPixiText(
      runtime,
      `pixi-direction-hint:${hint.id}`,
      presentation.glyph,
      toPixiTextStyle(context.theme.directionHint, context.layout.cellSize, presentation.glyph)
    );
    if (!text) continue;
    text.eventMode = 'none';
    setPixiAnchor(text, 0.5);
    setPixiPosition(text, presentation.x, presentation.y);
    addPixiChild(root, text);
  }
}

export function createPixiHintView(runtime: PixiStaticViewRuntime): PixiHintView {
  const root = createPixiContainer(runtime, 'pixi-hint-view');
  const interactionRoot = createPixiGraphics(runtime, 'pixi-interaction-hit-area');
  const hints = createPixiGraphics(runtime, 'pixi-cell-hints');
  const directionRoot = createPixiContainer(runtime, 'pixi-direction-hints');
  addPixiChild(root, hints, directionRoot);
  let signature: string | null = null;
  let key: string | null = null;
  let updateCount = 0;
  let resetCount = 0;
  let destroyed = false;
  let position = { x: 0, y: 0 };
  let diagnosticsState = {
    legal: false,
    selectable: false,
    selected: false,
    keyboardCursor: false,
    hovered: false,
    interactionLocked: true,
    previewKinds: [] as string[],
    selectionKinds: [] as string[],
    directionKeys: [] as string[]
  };

  function assertAlive(): void {
    if (destroyed) throw new Error('PixiHintView is destroyed');
  }

  function update(cell: MaterializedBoardCellVisualState, context: PixiStaticViewContext): boolean {
    assertAlive();
    const nextSignature = `${context.revisionSignature}|${cell.visualSignature}`;
    if (signature === nextSignature) return false;
    signature = nextSignature;
    key = cell.key;
    updateCount += 1;
    position = { x: context.sceneX, y: context.sceneY };
    setPixiPosition(root, position.x, position.y);
    setPixiPosition(interactionRoot, position.x, position.y);
    clearPixiGraphics(hints);
    clearPixiGraphics(interactionRoot);
    removeAndDestroyPixiChildren(directionRoot);
    const interaction = cell.interaction;
    diagnosticsState = {
      legal: interaction.legal,
      selectable: interaction.selectable,
      selected: interaction.selected,
      keyboardCursor: interaction.keyboardCursor,
      hovered: interaction.hovered,
      interactionLocked: interaction.interactionLocked,
      previewKinds: Array.from(interaction.previewKinds),
      selectionKinds: Array.from(interaction.selectionKinds),
      directionKeys: interaction.directionHints.map((hint) => hint.directionKey)
    };
    const visible = cell.kind === 'playable';
    root.visible = visible;
    interactionRoot.visible = visible;
    interactionRoot.eventMode = 'none';
    interactionRoot.cursor = 'default';
    if (!visible) return true;

    const cellSize = context.layout.cellSize;
    const center = cellSize / 2;
    const legalStyle = context.theme.legalHint;
    const surfaceInset = Math.max(0.5, context.theme.gridLineWidth);
    const surfaceSize = Math.max(0, cellSize - surfaceInset * 2);
    const previewKinds = new Set(interaction.previewKinds);
    const selectionKinds = new Set(interaction.selectionKinds);
    const drawSurface = (color: string, alpha: number) => {
      drawPixiRect(hints, surfaceInset, surfaceInset, surfaceSize, surfaceSize, {
        color,
        alpha
      });
    };
    const drawInsetOutline = (
      insetRatio: number,
      color: string,
      alpha: number,
      widthRatio: number,
      radiusRatio = 0
    ) => {
      const inset = cellSize * insetRatio;
      drawPixiRect(
        hints,
        inset,
        inset,
        Math.max(0, cellSize - inset * 2),
        Math.max(0, cellSize - inset * 2),
        null,
        {
          color,
          alpha,
          width: Math.max(1, cellSize * widthRatio)
        },
        cellSize * radiusRatio
      );
    };
    drawPixiRect(interactionRoot, 0, 0, cellSize, cellSize, {
      color: '#000000',
      alpha: 0.001
    });
    if (previewKinds.has('selected-target')) {
      drawSurface('#ff4848', 0.42);
      drawInsetOutline(0.016, '#ff6c6c', 0.88, 0.032, 0.025);
      drawInsetOutline(0.045, '#ff6c6c', 0.74, 0.032, 0.025);
    }
    if (previewKinds.has('random-spawn')) {
      drawSurface('#7cb6ff', 0.18);
      drawInsetOutline(0.045, '#a2d2ff', 0.35, 0.023);
      const inset = 0;
      const low = inset;
      const high = cellSize - inset;
      // Chromium's one-pixel dashed outline resolves to a short 3px/2px
      // cadence at the Phase 0 44px cell size.
      const dash = cellSize * 0.068;
      const gap = cellSize * 0.045;
      const stroke = {
        color: '#badfff',
        alpha: 0.78,
        width: Math.max(1, cellSize * 0.023)
      };
      for (let start = low; start < high; start += dash + gap) {
        const end = Math.min(high, start + dash);
        drawPixiLine(hints, start, low, end, low, stroke);
        drawPixiLine(hints, start, high, end, high, stroke);
        drawPixiLine(hints, low, start, low, end, stroke);
        drawPixiLine(hints, high, start, high, end, stroke);
      }
    }
    if (previewKinds.has('super-attraction-path')) {
      drawSurface('#d270ff', 0.035);
      drawInsetOutline(0.025, '#d270ff', 0.42, 0.032);
    }
    if (previewKinds.has('super-attraction-destination')) {
      drawSurface('#d270ff', 0.06);
      drawInsetOutline(0.045, '#eea0ff', 0.78, 0.048);
      drawInsetOutline(0.075, '#d270ff', 0.25, 0.028);
    }
    const hasKnownPreview = previewKinds.has('selected-target')
      || previewKinds.has('random-spawn')
      || previewKinds.has('super-attraction-path')
      || previewKinds.has('super-attraction-destination');
    if (interaction.previewKinds.length && !hasKnownPreview) {
      drawPixiRect(hints, cellSize * 0.06, cellSize * 0.06, cellSize * 0.88, cellSize * 0.88, {
        color: legalStyle.highlightColor,
        alpha: 0.62
      }, null, cellSize * 0.08);
    }
    if (interaction.legal || interaction.legalFree) {
      // DOM's board-has-void-cells rule restores the per-cell board texture
      // after the legal class, so circle/hole boards keep only the ring.
      if (context.boardTextureMode !== 'per-cell') drawSurface('#146457', 0.72);
      const legalLineWidth = Math.max(1, cellSize * legalStyle.lineWidthRatio);
      drawPixiCircle(hints, center, center, Math.max(0, cellSize * 0.34 - legalLineWidth * 0.5), null, {
        color: legalStyle.ringColor,
        alpha: 0.72,
        width: legalLineWidth
      });
    }
    if (interaction.tabooLegal || selectionKinds.has('positive-target')) {
      drawSurface('#9858ee', 0.4);
      drawInsetOutline(0.016, '#d29aff', 0.9, 0.032, 0.025);
      drawInsetOutline(0.045, '#c68aff', 0.76, 0.032, 0.025);
    }
    if (selectionKinds.has('friendly')) {
      drawSurface('#0e7e6f', 0.84);
    }
    const hasKnownSelection = interaction.tabooLegal
      || selectionKinds.has('positive-target')
      || selectionKinds.has('friendly');
    if ((interaction.selectable || interaction.selectionKinds.length) && !hasKnownSelection) {
      drawInsetOutline(0.09, legalStyle.ringColor, 0.82, 0.035, 0.09);
    }
    if (interaction.selected && !previewKinds.has('selected-target')) {
      drawSurface('#ff4848', 0.42);
      drawInsetOutline(0.016, '#ff6c6c', 0.88, 0.032, 0.025);
      drawInsetOutline(0.045, '#ff6c6c', 0.74, 0.032, 0.025);
    }
    if (interaction.hovered) {
      drawPixiRect(hints, cellSize * 0.02, cellSize * 0.02, cellSize * 0.96, cellSize * 0.96, {
        color: legalStyle.glowColor,
        alpha: 0.5
      }, null, cellSize * 0.08);
    }
    if (interaction.keyboardCursor) {
      drawInsetOutline(0.032, '#ffc650', 0.08, 0.09, 0.075);
      drawInsetOutline(0.056, '#ffe178', 0.96, 0.032, 0.065);
      drawInsetOutline(0.075, '#ffeb96', 0.12, 0.018, 0.055);
    }
    renderDirectionHints(runtime, directionRoot, interaction.directionHints, context);
    return true;
  }

  function reset(): void {
    if (destroyed) return;
    signature = null;
    key = null;
    position = { x: 0, y: 0 };
    diagnosticsState = {
      legal: false,
      selectable: false,
      selected: false,
      keyboardCursor: false,
      hovered: false,
      interactionLocked: true,
      previewKinds: [],
      selectionKinds: [],
      directionKeys: []
    };
    root.visible = false;
    interactionRoot.visible = false;
    interactionRoot.eventMode = 'none';
    clearPixiGraphics(hints);
    clearPixiGraphics(interactionRoot);
    removeAndDestroyPixiChildren(directionRoot);
    removePixiFromParent(root);
    removePixiFromParent(interactionRoot);
    resetCount += 1;
  }

  function destroy(): void {
    if (destroyed) return;
    reset();
    destroyed = true;
    destroyPixiDisplayObject(root);
    destroyPixiDisplayObject(interactionRoot);
  }

  function getDiagnostics(): PixiHintViewDiagnostics {
    return Object.freeze({
      updateCount,
      resetCount,
      destroyed,
      key,
      legal: diagnosticsState.legal,
      selectable: diagnosticsState.selectable,
      selected: diagnosticsState.selected,
      keyboardCursor: diagnosticsState.keyboardCursor,
      hovered: diagnosticsState.hovered,
      interactionLocked: diagnosticsState.interactionLocked,
      previewKinds: Object.freeze(diagnosticsState.previewKinds.slice()),
      selectionKinds: Object.freeze(diagnosticsState.selectionKinds.slice()),
      directionKeys: Object.freeze(diagnosticsState.directionKeys.slice()),
      position: Object.freeze({ ...position })
    });
  }

  return Object.freeze({ root, interactionRoot, update, reset, destroy, getDiagnostics });
}
