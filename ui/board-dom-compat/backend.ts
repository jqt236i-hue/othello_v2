import type {
  BoardClientRect,
  BoardPlaybackContext,
  BoardVisualBackend,
  BoardVisualBackendDeps,
  BoardVisualFrame,
  BoardViewportLayout
} from '../board-visual/types';

declare const __non_webpack_require__: NodeRequire | undefined;
const _require: NodeRequire = typeof __non_webpack_require__ !== 'undefined' ? __non_webpack_require__ : require;
const DomPlayback = _require('./playback');
const DomRuntime = _require('./runtime');
const DomSourceTrajectory = _require('./source-trajectory');

function createDomBoardVisualBackend(options?: {
  playPhase?: (events: readonly unknown[], context: BoardPlaybackContext) => Promise<void>;
  beforeApplyFrame?: (host: HTMLElement, frame: BoardVisualFrame) => void;
  prepareStylesheet?: (documentRef: Document) => Promise<void>;
  prepareStoneVisuals?: (documentRef: Document) => Promise<{
    success: boolean;
    loaded: readonly string[];
    failed: readonly { src: string; reason: string }[];
  }>;
  compatibilityRenderer?: {
    renderBoardDiff: (...args: any[]) => unknown;
    resetRenderStats: () => unknown;
  };
}): BoardVisualBackend & {
  invalidate: () => void;
  getRenderedCell: (row: number, col: number) => Readonly<Record<string, unknown>> | null;
} {
  const ModelBuilder = _require('../board-visual/model-builder');
  let host: HTMLElement | null = null;
  let diagnostics: BoardVisualBackendDeps['diagnostics'] = undefined;
  let lastFrame: BoardVisualFrame | null = null;
  const runtimeHandlers = !options?.playPhase
    ? DomRuntime.createDomBoardPlaybackHandlers({
      getBoardElement: () => host,
      getBoardFrame: () => lastFrame,
      record: (event: string, detail?: unknown) => diagnostics?.record(event, detail)
    })
    : null;
  const playbackExecutor = runtimeHandlers
    ? DomPlayback.createDomBoardPlaybackExecutor(runtimeHandlers)
    : null;

  const requireCompatibilityRenderer = () => {
    const renderer = options && options.compatibilityRenderer;
    if (
      !renderer
      || typeof renderer.renderBoardDiff !== 'function'
      || typeof renderer.resetRenderStats !== 'function'
    ) {
      throw new Error('DOM compatibility renderer dependency is unavailable');
    }
    return renderer;
  };

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

  const getDomCellCount = (): number => host
    ? host.querySelectorAll('.cell[data-row][data-col]').length
    : 0;

  const isComputedStyleReady = (): boolean => {
    if (!host) return false;
    const firstCell = host.querySelector<HTMLElement>('.cell[data-row][data-col]');
    if (!firstCell) return false;
    const firstDisc = host.querySelector<HTMLElement>('.disc');
    const root = host.ownerDocument.defaultView;
    if (!root || typeof root.getComputedStyle !== 'function') return false;
    const cellStyle = root.getComputedStyle(firstCell);
    const discStyle = firstDisc ? root.getComputedStyle(firstDisc) : null;
    return Number.parseFloat(cellStyle.width) > 0
      && Number.parseFloat(cellStyle.height) > 0
      && cellStyle.display !== 'none'
      && (!firstDisc || !!discStyle && discStyle.display !== 'none');
  };

  const applyFrame = (frame: BoardVisualFrame) => {
    if (!host) throw new Error('DOM board backend is not mounted');
    if (options && typeof options.beforeApplyFrame === 'function') {
      options.beforeApplyFrame(host, frame);
    }
    const compatibilityRenderer = requireCompatibilityRenderer();
    const compatibilityState = ModelBuilder.buildDomCompatibilityRenderState(frame.model);
    compatibilityRenderer.renderBoardDiff(host, compatibilityState.renderProjection, compatibilityState.cellState, frame.model, {
      authorizedByBoardVisualController: true,
      viewportLayout: frame.layout
    });
    // The compatibility renderer owns the legacy frame/skin DOM updates.
    // Re-presenting them here changes Chromium's frame-art rasterization even
    // when the effective values are identical. Pixi uses the frame presenter;
    // the compatibility path deliberately preserves the legacy paint order.
    lastFrame = frame;
    diagnostics?.record('dom:frame-applied', { frameToken: frame.frameToken });
  };

  return {
    kind: 'dom' as const,
    async mount(nextHost: HTMLElement, deps: BoardVisualBackendDeps) {
      if (host && host !== nextHost) throw new Error('DOM board backend cannot mount twice');
      if (options && typeof options.prepareStylesheet === 'function') {
        await options.prepareStylesheet(nextHost.ownerDocument);
      }
      if (options && typeof options.prepareStoneVisuals === 'function') {
        const result = await options.prepareStoneVisuals(nextHost.ownerDocument);
        if (!result || result.success !== true) {
          const failedCount = Array.isArray(result?.failed) ? result.failed.length : 0;
          const error: any = new Error(
            `DOM compatibility stone visuals failed to prepare (${failedCount} failed assets)`
          );
          error.code = 'dom_compatibility_stone_visual_prepare_failed';
          error.stage = 'compatibility-assets';
          error.failedAssets = Object.freeze(
            Array.isArray(result?.failed)
              ? result.failed.map((failure) => Object.freeze({
                src: String(failure?.src || ''),
                reason: String(failure?.reason || '')
              }))
              : []
          );
          throw error;
        }
      }
      host = nextHost;
      const now = nextHost.ownerDocument.defaultView?.performance?.now;
      if (typeof now === 'function') {
        nextHost.dataset.cardReversiDomBackendMountedAt = String(
          now.call(nextHost.ownerDocument.defaultView?.performance)
        );
      }
      diagnostics = deps && deps.diagnostics;
      diagnostics?.record('dom:mounted', {
        stoneVisualsPrepared: typeof options?.prepareStoneVisuals === 'function'
      });
    },
    applyFrame,
    validatePhase(events, context) {
      if (!runtimeHandlers) return;
      const phaseEvents = Array.isArray(events) ? events as any[] : [];
      DomSourceTrajectory.validateDomBoardSourceTrajectoryPhase(phaseEvents, context, lastFrame);
    },
    async playPhase(events: readonly unknown[], context: BoardPlaybackContext) {
      const playPhase = options && typeof options.playPhase === 'function'
        ? options.playPhase
        : playbackExecutor && typeof playbackExecutor.playPhase === 'function'
          ? playbackExecutor.playPhase.bind(playbackExecutor)
          : null;
      if (!playPhase) throw new Error('DOM board playback adapter is unavailable');
      await playPhase(events, context);
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
    getDiagnostics() {
      return Object.freeze({
        canvasCount: 0,
        contextCount: 0,
        domCellCount: getDomCellCount(),
        computedStyleReady: isComputedStyleReady()
      });
    },
    getDisplayObjectCounts() {
      return Object.freeze({ total: getDomCellCount(), active: getDomCellCount(), pooled: 0 });
    },
    getTextureLeaseCounts() {
      return Object.freeze({ total: 0, active: 0, pooled: 0 });
    },
    resize(_layout: BoardViewportLayout) {
      // Existing DOM sizing remains in board-renderer during the parity phase.
    },
    restore(frame: BoardVisualFrame) {
      requireCompatibilityRenderer().resetRenderStats();
      applyFrame(frame);
    },
    invalidate() {
      requireCompatibilityRenderer().resetRenderStats();
    },
    destroy() {
      if (runtimeHandlers && typeof runtimeHandlers.destroy === 'function') runtimeHandlers.destroy();
      diagnostics?.record('dom:destroyed');
      host = null;
      diagnostics = undefined;
      lastFrame = null;
    }
  };
}

export = { createDomBoardVisualBackend };
