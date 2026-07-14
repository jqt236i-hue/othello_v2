import type {
  BoardClientRect,
  BoardPlaybackContext,
  BoardVisualBackend,
  BoardVisualBackendDeps,
  BoardVisualFrame,
  BoardViewportLayout
} from './types';

declare const __non_webpack_require__: NodeRequire | undefined;
const _require: NodeRequire = typeof __non_webpack_require__ !== 'undefined' ? __non_webpack_require__ : require;

function createDomBoardVisualBackend(options?: {
  playPhase?: (events: readonly unknown[], context: BoardPlaybackContext) => Promise<void>;
  beforeApplyFrame?: (host: HTMLElement, frame: BoardVisualFrame) => void;
}): BoardVisualBackend & {
  invalidate: () => void;
  getRenderedCell: (row: number, col: number) => Readonly<Record<string, unknown>> | null;
} {
  const DiffRenderer = _require('../diff-renderer');
  const ModelBuilder = _require('./model-builder');
  const FramePresenter = _require('./frame-presenter');
  let host: HTMLElement | null = null;
  let diagnostics: BoardVisualBackendDeps['diagnostics'] = undefined;
  let lastFrame: BoardVisualFrame | null = null;

  const findRenderedCellElement = (row: number, col: number): HTMLElement | null => {
    if (!host) return null;
    const cells = host.querySelectorAll<HTMLElement>('.cell[data-row][data-col]');
    for (const cell of Array.from(cells)) {
      if (Number(cell.dataset.row) === row && Number(cell.dataset.col) === col) return cell;
    }
    return null;
  };

  const getRenderedCell = (row: number, col: number): Readonly<Record<string, unknown>> | null => {
    const frame = lastFrame;
    const topology = frame && frame.model && frame.model.topology;
    if (!frame || !topology) return null;
    if (
      row < topology.minRow || row > topology.maxRow
      || col < topology.minCol || col > topology.maxCol
    ) {
      return null;
    }
    const key = `${row},${col}`;
    const semanticCell = Array.isArray(frame.model.cells)
      ? frame.model.cells.find((cell) => cell.key === key) || null
      : null;
    const renderedElement = findRenderedCellElement(row, col);
    const semanticKind = semanticCell ? semanticCell.kind : 'void';
    if (!renderedElement) {
      return Object.freeze({
        key,
        row,
        col,
        kind: 'offscreen',
        semanticKind,
        rendered: false,
        ephemeral: semanticKind === 'void',
        visualSignature: semanticCell ? semanticCell.visualSignature : `void:${key}`
      });
    }
    if (semanticCell && !renderedElement.classList.contains('cell-void')) {
      return Object.freeze({
        ...semanticCell,
        kind: semanticCell.kind,
        semanticKind: semanticCell.kind,
        rendered: true,
        ephemeral: false
      });
    }
    return Object.freeze({
      key,
      row,
      col,
      kind: 'void',
      semanticKind,
      rendered: true,
      ephemeral: true,
      visualSignature: semanticCell ? semanticCell.visualSignature : `void:${key}`
    });
  };

  const applyFrame = (frame: BoardVisualFrame) => {
    if (!host) throw new Error('DOM board backend is not mounted');
    // Skin/layout is part of this controller-owned frame. Apply it before
    // pixel sizing so geometry and cell materialization use one snapshot.
    FramePresenter.presentBoardFrame(host, frame);
    if (options && typeof options.beforeApplyFrame === 'function') {
      options.beforeApplyFrame(host, frame);
    }
    const compatibilityState = ModelBuilder.buildDomCompatibilityRenderState(frame.model);
    DiffRenderer.renderBoardDiff(host, compatibilityState.renderProjection, compatibilityState.cellState, frame.model, {
      authorizedByBoardVisualController: true,
      viewportLayout: frame.layout
    });
    lastFrame = frame;
    diagnostics?.record('dom:frame-applied', { frameToken: frame.frameToken });
  };

  return {
    kind: 'dom' as const,
    mount(nextHost: HTMLElement, deps: BoardVisualBackendDeps) {
      if (host && host !== nextHost) throw new Error('DOM board backend cannot mount twice');
      host = nextHost;
      diagnostics = deps && deps.diagnostics;
      diagnostics?.record('dom:mounted');
    },
    applyFrame,
    async playPhase(events: readonly unknown[], context: BoardPlaybackContext) {
      if (!options || typeof options.playPhase !== 'function') {
        throw new Error('DOM board playback adapter is unavailable');
      }
      await options.playPhase(events, context);
    },
    getCellClientRect(row: number, col: number): BoardClientRect | null {
      if (!host) return null;
      const cells = host.querySelectorAll<HTMLElement>('.cell[data-row][data-col]');
      for (const cell of Array.from(cells)) {
        if (Number(cell.dataset.row) !== row || Number(cell.dataset.col) !== col) continue;
        const rect = cell.getBoundingClientRect();
        return Object.freeze({
          left: rect.left,
          top: rect.top,
          right: rect.right,
          bottom: rect.bottom,
          width: rect.width,
          height: rect.height,
          layoutRevision: 0
        });
      }
      return null;
    },
    getRenderedCell,
    resize(_layout: BoardViewportLayout) {
      // Existing DOM sizing remains in board-renderer during the parity phase.
    },
    restore(frame: BoardVisualFrame) {
      DiffRenderer.resetRenderStats();
      applyFrame(frame);
    },
    invalidate() {
      DiffRenderer.resetRenderStats();
    },
    destroy() {
      diagnostics?.record('dom:destroyed');
      host = null;
      diagnostics = undefined;
      lastFrame = null;
    }
  };
}

export = { createDomBoardVisualBackend };
