import type { BoardCellDirectionHint, MaterializedBoardCellVisualState } from '../board-visual/types';
import {
  addPixiChild,
  clearPixiGraphics,
  createPixiContainer,
  createPixiGraphics,
  createPixiText,
  destroyPixiDisplayObject,
  drawPixiCircle,
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
    drawPixiRect(interactionRoot, 0, 0, cellSize, cellSize, {
      color: '#000000',
      alpha: 0.001
    });
    if (interaction.previewKinds.length) {
      drawPixiRect(hints, cellSize * 0.06, cellSize * 0.06, cellSize * 0.88, cellSize * 0.88, {
        color: legalStyle.highlightColor,
        alpha: 0.62
      }, null, cellSize * 0.08);
    }
    if (interaction.legal || interaction.legalFree || interaction.tabooLegal) {
      drawPixiCircle(hints, center, center, cellSize * 0.15, {
        color: legalStyle.highlightColor,
        alpha: interaction.legalFree ? 0.78 : 0.48
      }, {
        color: interaction.tabooLegal ? context.theme.holeBoundaryColor : legalStyle.ringColor,
        alpha: 1,
        width: Math.max(1, cellSize * legalStyle.lineWidthRatio)
      });
    }
    if (interaction.selectable || interaction.selectionKinds.length) {
      drawPixiRect(hints, cellSize * 0.09, cellSize * 0.09, cellSize * 0.82, cellSize * 0.82, null, {
        color: legalStyle.ringColor,
        alpha: 0.82,
        width: Math.max(1.5, cellSize * 0.035)
      }, cellSize * 0.09);
    }
    if (interaction.selected) {
      drawPixiRect(hints, cellSize * 0.045, cellSize * 0.045, cellSize * 0.91, cellSize * 0.91, null, {
        color: context.theme.hintColor,
        alpha: 1,
        width: Math.max(2, cellSize * 0.055)
      }, cellSize * 0.1);
    }
    if (interaction.hovered) {
      drawPixiRect(hints, cellSize * 0.02, cellSize * 0.02, cellSize * 0.96, cellSize * 0.96, {
        color: legalStyle.glowColor,
        alpha: 0.5
      }, null, cellSize * 0.08);
    }
    if (interaction.keyboardCursor) {
      drawPixiRect(hints, cellSize * 0.13, cellSize * 0.13, cellSize * 0.74, cellSize * 0.74, null, {
        color: context.theme.directionHint.color,
        alpha: 1,
        width: Math.max(2, cellSize * 0.04)
      }, cellSize * 0.05);
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
