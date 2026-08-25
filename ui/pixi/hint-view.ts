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
  removePixiFromParent,
  setPixiAnchor,
  setPixiPosition,
  toPixiTextStyle,
  type PixiStaticViewContext,
  type PixiStaticViewRuntime
} from './cell-view';

export interface PixiHintViewDiagnostics {
  readonly updateCount: number;
  readonly hintPaintCount: number;
  readonly hintInputSyncCount: number;
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

export interface PixiHintViewUpdateResult {
  readonly changed: boolean;
  readonly painted: boolean;
  readonly inputSynced: boolean;
}

export interface PixiHintView {
  readonly surfaceRoot: any;
  readonly root: any;
  readonly interactionRoot: any;
  update(cell: MaterializedBoardCellVisualState, context: PixiStaticViewContext): boolean;
  updateDetailed(
    cell: MaterializedBoardCellVisualState,
    context: PixiStaticViewContext
  ): PixiHintViewUpdateResult;
  invalidate(): void;
  reset(): void;
  destroy(): void;
  getDiagnostics(): PixiHintViewDiagnostics;
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
  const surfaceRoot = createPixiGraphics(runtime, 'pixi-cell-hint-surface');
  const root = createPixiContainer(runtime, 'pixi-hint-view');
  const foreground = createPixiGraphics(runtime, 'pixi-hint-foreground');
  const interactionRoot = createPixiGraphics(runtime, 'pixi-interaction-hit-area');
  addPixiChild(root, foreground);
  let paintSignature: string | null = null;
  let inputSignature: string | null = null;
  let key: string | null = null;
  let updateCount = 0;
  let hintPaintCount = 0;
  let hintInputSyncCount = 0;
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

  function clearDirectionHints(): void {
    for (const child of Array.from(root.children || []) as any[]) {
      if (child === foreground) continue;
      removePixiFromParent(child);
      destroyPixiDisplayObject(child);
    }
  }

  function updateDetailed(
    cell: MaterializedBoardCellVisualState,
    context: PixiStaticViewContext
  ): PixiHintViewUpdateResult {
    assertAlive();
    const interaction = cell.interaction;
    // Locking is global board state and is applied once by BoardScene's
    // interaction layer. Keep diagnostics current without invalidating every
    // retained cell hit area during placement/playback lock transitions.
    diagnosticsState.interactionLocked = interaction.interactionLocked;
    const nextPaintSignature = JSON.stringify([
      context.interactionRevisionSignature,
      context.sceneX,
      context.sceneY,
      cell.hintPaintSignature
    ]);
    const nextInputSignature = JSON.stringify([
      context.layout.cellSize,
      context.sceneX,
      context.sceneY,
      context.sceneOffsetX,
      context.sceneOffsetY,
      cell.hintInputSignature
    ]);
    const painted = paintSignature !== nextPaintSignature;
    const inputSynced = inputSignature !== nextInputSignature;
    if (!painted && !inputSynced) {
      return Object.freeze({ changed: false, painted: false, inputSynced: false });
    }
    paintSignature = nextPaintSignature;
    inputSignature = nextInputSignature;
    key = cell.key;
    updateCount += 1;
    position = { x: context.sceneX, y: context.sceneY };
    if (painted) {
      hintPaintCount += 1;
      setPixiPosition(surfaceRoot, position.x, position.y);
      setPixiPosition(root, position.x, position.y);
      clearPixiGraphics(surfaceRoot);
      clearPixiGraphics(foreground);
      clearDirectionHints();
    }
    if (inputSynced) {
      hintInputSyncCount += 1;
      // The renderer canvas includes an effect gutter around the fixed
      // viewport. Federated Events target the native scroll viewport instead,
      // so interaction objects live in viewport coordinates without that
      // visual-only gutter.
      setPixiPosition(
        interactionRoot,
        position.x - context.sceneOffsetX,
        position.y - context.sceneOffsetY
      );
      clearPixiGraphics(interactionRoot);
    }
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
    // Causal Replay can select an existing hole.  It is the sole hole case
    // that receives a target marker and pointer layer; ordinary holes remain
    // visually and interactively inert.
    const visible = cell.kind === 'playable'
      || (cell.kind === 'hole' && interaction.selectable === true);
    if (painted) {
      surfaceRoot.visible = visible;
      root.visible = visible;
    }
    if (inputSynced) {
      interactionRoot.visible = visible;
      // The transparent interaction layer mirrors model state only. Actual
      // commands still flow through BoardInputController and handleCellClick;
      // Pixi never computes legality or becomes gameplay authority.
      interactionRoot.eventMode = visible ? 'static' : 'none';
      // Per-cell cursors represent eligibility only. The scene's O(1) parent
      // lock suppresses all descendants and restores the default cursor while
      // playback owns the board.
      interactionRoot.cursor = (
        interaction.legal
        || interaction.legalFree
        || interaction.selectable
        || interaction.directionHints.length > 0
      ) ? 'pointer' : 'default';
      interactionRoot.hitArea = visible
        ? rectangularHitArea(context.layout.cellSize, context.layout.cellSize)
        : null;
    }
    if (!painted || !visible) {
      return Object.freeze({ changed: true, painted, inputSynced });
    }

    const cellSize = context.layout.cellSize;
    const center = cellSize / 2;
    const legalStyle = context.theme.legalHint;
    const surfaceInset = Math.max(0.5, context.theme.gridLineWidth);
    const surfaceSize = Math.max(0, cellSize - surfaceInset * 2);
    const previewKinds = new Set(interaction.previewKinds);
    const selectionKinds = new Set(interaction.selectionKinds);
    const drawSurface = (color: string, alpha: number) => {
      drawPixiRect(surfaceRoot, surfaceInset, surfaceInset, surfaceSize, surfaceSize, {
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
        foreground,
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
        drawPixiLine(foreground, start, low, end, low, stroke);
        drawPixiLine(foreground, start, high, end, high, stroke);
        drawPixiLine(foreground, low, start, low, end, stroke);
        drawPixiLine(foreground, high, start, high, end, stroke);
      }
    }
    if (previewKinds.has('network-pending-placement')) {
      drawSurface('#49d7ef', 0.09);
      drawInsetOutline(0.10, '#b5f8ff', 0.92, 0.04, 0.13);
      drawInsetOutline(0.18, '#42aecd', 0.58, 0.022, 0.10);
      drawPixiCircle(foreground, center, center, cellSize * 0.27, null, {
        color: '#d9fbff',
        alpha: 0.88,
        width: Math.max(1, cellSize * 0.025)
      });
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
      || previewKinds.has('network-pending-placement')
      || previewKinds.has('super-attraction-path')
      || previewKinds.has('super-attraction-destination');
    if (interaction.previewKinds.length && !hasKnownPreview) {
      drawPixiRect(surfaceRoot, cellSize * 0.06, cellSize * 0.06, cellSize * 0.88, cellSize * 0.88, {
        color: legalStyle.highlightColor,
        alpha: 0.62
      }, null, cellSize * 0.08);
    }
    if (interaction.legal || interaction.legalFree) {
      // DOM's board-has-void-cells rule restores the per-cell board texture
      // after the legal class, so circle/hole boards keep only the ring.
      if (context.boardTextureMode !== 'per-cell') drawSurface('#146457', 0.72);
      const legalLineWidth = Math.max(1, cellSize * legalStyle.lineWidthRatio);
      drawPixiCircle(foreground, center, center, Math.max(0, cellSize * 0.34 - legalLineWidth * 0.5), null, {
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
      drawSurface('#0e7e6f', 0.38);
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
      drawPixiRect(surfaceRoot, cellSize * 0.02, cellSize * 0.02, cellSize * 0.96, cellSize * 0.96, {
        color: legalStyle.glowColor,
        alpha: 0.5
      }, null, cellSize * 0.08);
    }
    if (interaction.keyboardCursor) {
      drawInsetOutline(0.032, '#ffc650', 0.08, 0.09, 0.075);
      drawInsetOutline(0.056, '#ffe178', 0.96, 0.032, 0.065);
      drawInsetOutline(0.075, '#ffeb96', 0.12, 0.018, 0.055);
    }
    renderDirectionHints(runtime, root, interaction.directionHints, context);
    return Object.freeze({ changed: true, painted, inputSynced });
  }

  function update(cell: MaterializedBoardCellVisualState, context: PixiStaticViewContext): boolean {
    return updateDetailed(cell, context).changed;
  }

  function invalidate(): void {
    if (destroyed) return;
    paintSignature = null;
    inputSignature = null;
  }

  function reset(): void {
    if (destroyed) return;
    paintSignature = null;
    inputSignature = null;
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
    surfaceRoot.visible = false;
    root.visible = false;
    interactionRoot.visible = false;
    interactionRoot.eventMode = 'none';
    interactionRoot.hitArea = null;
    clearPixiGraphics(surfaceRoot);
    clearPixiGraphics(foreground);
    clearPixiGraphics(interactionRoot);
    clearDirectionHints();
    removePixiFromParent(surfaceRoot);
    removePixiFromParent(root);
    removePixiFromParent(interactionRoot);
    resetCount += 1;
  }

  function destroy(): void {
    if (destroyed) return;
    reset();
    destroyed = true;
    destroyPixiDisplayObject(surfaceRoot);
    destroyPixiDisplayObject(root);
    destroyPixiDisplayObject(interactionRoot);
  }

  function getDiagnostics(): PixiHintViewDiagnostics {
    return Object.freeze({
      updateCount,
      hintPaintCount,
      hintInputSyncCount,
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

  return Object.freeze({
    surfaceRoot,
    root,
    interactionRoot,
    update,
    updateDetailed,
    invalidate,
    reset,
    destroy,
    getDiagnostics
  });
}
