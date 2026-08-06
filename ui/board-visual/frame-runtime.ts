declare const __non_webpack_require__: NodeRequire | undefined;

const _require: NodeRequire = (typeof __non_webpack_require__ !== 'undefined')
  ? __non_webpack_require__
  : require;

export interface BoardFrameRuntimeDependencies {
  getVisualRuntime(): any;
  renderBoard(): void;
  resolveSoundEngine(): any;
  getRenderStateSource(): any;
  getInputFrameInputs(): Readonly<{ keyboardCursorKey: string | null; previewHints: readonly any[] }>;
  resolveHost(): any;
  getBoardUpdateSyncRuntime(): any;
  peekBoardUpdateSyncContext(): any;
  playbackState: any;
  layoutRuntime: any;
}

export interface BoardFrameRuntime {
  buildFrame(controller: any, baseVisualStateOverride?: any): any;
  beginApplyFrame(frame: any, context: any): any;
  playTopologyRevealSound(keys: readonly string[], frame: any): void;
  installHostResources(host: HTMLElement | null): void;
  disposeHostResources(): void;
  getNextFrameSerial(): number;
  resetSession(): string;
  destroyPageRuntime(): void;
}

export function createBoardFrameRuntime(dependencies: BoardFrameRuntimeDependencies): BoardFrameRuntime {
  if (!dependencies || typeof dependencies.getVisualRuntime !== 'function'
    || typeof dependencies.renderBoard !== 'function'
    || typeof dependencies.resolveSoundEngine !== 'function'
    || typeof dependencies.getRenderStateSource !== 'function'
    || typeof dependencies.getInputFrameInputs !== 'function'
    || typeof dependencies.resolveHost !== 'function'
    || typeof dependencies.getBoardUpdateSyncRuntime !== 'function'
    || typeof dependencies.peekBoardUpdateSyncContext !== 'function'
    || !dependencies.layoutRuntime) {
    throw new Error('Board frame runtime dependencies are incomplete');
  }

  let BoardVisualFrameSerialForBoardRenderer = 0;
  let BoardVisualRenderSessionEpochForBoardRenderer = 0;
  let BoardVisualFrameRevisionComposerForBoardRenderer: any = null;
  let BoardVisualThemeFontObserverDisposeForBoardRenderer: (() => void) | null = null;
  const BoardVisualWorldStateByFrameForBoardRenderer = new WeakMap<object, any>();
  let LastPixiBoardExpansionRevealSoundKeyForBoardRenderer: string | null = null;

  function _playPixiBoardExpansionRevealSoundForBoardRenderer(
      keys: readonly string[],
      frame: any
  ) {
      if (!Array.isArray(keys) || keys.length === 0) return;
      const captured = frame && typeof frame === 'object'
          ? BoardVisualWorldStateByFrameForBoardRenderer.get(frame)
          : null;
      if (captured && captured.boardUpdateContext
          && captured.boardUpdateContext.suppressBoardExpansionRevealSound === true) {
          return;
      }
      const soundKey = `${String(frame && frame.frameToken || '')}:${keys.slice().sort().join('|')}`;
      if (soundKey === LastPixiBoardExpansionRevealSoundKeyForBoardRenderer) return;
      LastPixiBoardExpansionRevealSoundKeyForBoardRenderer = soundKey;
      const play = () => {
          try {
              const soundEngine = dependencies.resolveSoundEngine();
              if (!soundEngine || typeof soundEngine.playEffectByKey !== 'function') return;
              if (typeof soundEngine.init === 'function') soundEngine.init();
              soundEngine.playEffectByKey('board_expansion_reveal');
          } catch (e: any) { /* presentation sound must not fail board settlement */ }
      };
      try {
          const root = typeof window !== 'undefined' ? window : null;
          if (root && typeof root.requestAnimationFrame === 'function') {
              root.requestAnimationFrame(play);
              return;
          }
      } catch (e: any) { /* synchronous fallback */ }
      play();
  }

  function _disposeBoardVisualThemeFontObserverForBoardRenderer() {
      const dispose = BoardVisualThemeFontObserverDisposeForBoardRenderer;
      BoardVisualThemeFontObserverDisposeForBoardRenderer = null;
      if (typeof dispose === 'function') dispose();
  }

  function _requestBoardVisualThemeRefreshForBoardRenderer() {
      const runtime = dependencies.getVisualRuntime();
      const controller = runtime && runtime.controller;
      if (!controller) return;
      const mode = typeof controller.getMode === 'function' ? controller.getMode() : 'idle';
      if (mode === 'destroyed') return;
      if (
          mode === 'recovering'
          && (
              typeof controller.getActiveWriterToken !== 'function'
              || !controller.getActiveWriterToken()
          )
      ) {
          return;
      }
      try {
          // This is a normal visual-frame request. During playback it is
          // coalesced by the controller and can only apply at final/committed
          // settlement; while idle it changes the theme revision alone.
          dependencies.renderBoard();
      } catch (error: any) {
          if (runtime.diagnostics && typeof runtime.diagnostics.record === 'function') {
              runtime.diagnostics.record('theme:font-ready-refresh-error', {
                  message: String(error && error.message || error || '')
              });
          }
      }
  }

  function _installBoardVisualThemeFontObserverForBoardRenderer(host: HTMLElement | null) {
      _disposeBoardVisualThemeFontObserverForBoardRenderer();
      const ThemeModule = _require('./theme');
      if (!ThemeModule || typeof ThemeModule.observeBoardVisualThemeFonts !== 'function') return;
      BoardVisualThemeFontObserverDisposeForBoardRenderer = ThemeModule.observeBoardVisualThemeFonts(
          host,
          _requestBoardVisualThemeRefreshForBoardRenderer
      );
  }

  const BOARD_FRAME_LAYOUT_STYLE_PROPERTIES_FOR_TRANSACTION = Object.freeze([
      '--board-frame-padding-top',
      '--board-frame-padding-right',
      '--board-frame-padding-bottom',
      '--board-frame-padding-left',
      '--board-frame-art-overhang-top',
      '--board-frame-art-overhang-bottom',
      '--board-frame-art-offset-y'
  ]);

  function _captureBoardVisualApplyDomSnapshotForBoardRenderer(host: any) {
      const doc = host && host.ownerDocument
          ? host.ownerDocument
          : (typeof document !== 'undefined' ? document : null);
      const rootElement = doc && doc.documentElement;
      const boardFrame = host && typeof host.closest === 'function' ? host.closest('#board-frame') : null;
      const gameContainer = boardFrame && typeof boardFrame.closest === 'function'
          ? boardFrame.closest('#game-container')
          : (doc && doc.getElementById ? doc.getElementById('game-container') : null);
      const previousExpansionLayer = dependencies.layoutRuntime.resolveBoardExpansionLayerElement(host, false);
      const restorers: Array<() => void> = [];
      const captureAttribute = (element: any, name: string) => {
          if (!element || typeof element.getAttribute !== 'function') return;
          const value = element.getAttribute(name);
          restorers.push(() => {
              if (value == null) element.removeAttribute(name);
              else element.setAttribute(name, value);
          });
      };
      const captureClass = (element: any, name: string) => {
          if (!element || !element.classList) return;
          const enabled = element.classList.contains(name);
          restorers.push(() => element.classList.toggle(name, enabled));
      };
      const captureStyle = (element: any, properties: readonly string[]) => {
          if (!element || !element.style) return;
          for (const property of properties) {
              const value = element.style.getPropertyValue(property);
              const priority = element.style.getPropertyPriority(property);
              restorers.push(() => {
                  if (value) element.style.setProperty(property, value, priority);
                  else element.style.removeProperty(property);
              });
          }
      };

      captureAttribute(host, 'data-board-skin-id');
      captureClass(host, 'board-has-void-cells');
      captureStyle(host, [
          '--board-surface-texture-image',
          '--board-rows',
          '--board-cols',
          '--board-cell-size-px',
          '--board-cell-scale',
          '--board-disc-inset-px',
          '--board-disc-size-px',
          'width',
          'height',
          'left',
          'top',
          'transform'
      ]);
      captureAttribute(boardFrame, 'data-board-frame-skin-id');
      captureClass(boardFrame, 'board-has-void-cells');
      captureClass(boardFrame, 'board-has-base-void-cells');
      captureStyle(boardFrame, [
          ...BOARD_FRAME_LAYOUT_STYLE_PROPERTIES_FOR_TRANSACTION,
          '--board-frame-outer-width',
          '--board-frame-outer-height'
      ]);
      captureAttribute(rootElement, 'data-board-skin-id');
      captureAttribute(rootElement, 'data-board-frame-skin-id');
      captureAttribute(rootElement, 'data-stone-skin-id');
      captureStyle(rootElement, [
          '--board-surface-texture-image',
          '--normal-stone-black-image',
          '--normal-stone-white-image',
          ...BOARD_FRAME_LAYOUT_STYLE_PROPERTIES_FOR_TRANSACTION
      ]);
      captureClass(doc && doc.body, 'board-oversize-active');
      captureClass(gameContainer, 'board-oversize-active');
      captureStyle(previousExpansionLayer, [
          '--board-rows',
          '--board-cols',
          'left',
          'top',
          'width',
          'height'
      ]);

      let restored = false;
      return {
          rollback() {
              if (restored) return;
              restored = true;
              for (let index = restorers.length - 1; index >= 0; index -= 1) restorers[index]();
              if (!previousExpansionLayer) {
                  const createdExpansionLayer = dependencies.layoutRuntime.resolveBoardExpansionLayerElement(host, false);
                  if (createdExpansionLayer && createdExpansionLayer.parentNode) {
                      createdExpansionLayer.parentNode.removeChild(createdExpansionLayer);
                  }
              }
              dependencies.layoutRuntime.invalidateHost(host);
          }
      };
  }

  function _createBoardVisualFrameWithLiveLayoutForBoardRenderer(host: any, frame: any) {
      const LayoutModule = _require('./layout');
      const topology = frame.model.topology;
      const cellSize = _readBoardCellSizeForLayout(host, topology);
      const viewportElement = host && typeof host.querySelector === 'function'
          ? host.querySelector('#board-scroll-viewport')
          : null;
      const cameraElement = viewportElement || host;
      const cameraRect = cameraElement && typeof cameraElement.getBoundingClientRect === 'function'
          ? cameraElement.getBoundingClientRect()
          : null;
      const logicalWidth = topology.renderCols * cellSize;
      const logicalHeight = topology.renderRows * cellSize;
      const viewportWidth = Number(cameraElement && cameraElement.clientWidth)
          || Number(cameraRect && cameraRect.width)
          || logicalWidth;
      const viewportHeight = Number(cameraElement && cameraElement.clientHeight)
          || Number(cameraRect && cameraRect.height)
          || logicalHeight;
      const viewport = typeof window !== 'undefined' ? (window as any).visualViewport : null;
      const presentationScales = _readBoardPresentationScalesForBoardRenderer(host);
      const layout = LayoutModule.createBoardViewportLayout(topology, {
          revision: frame.layout.revision,
          cellSize,
          dpr: typeof window !== 'undefined' ? window.devicePixelRatio : frame.layout.dpr,
          stageScale: presentationScales.stageScale,
          cellScale: presentationScales.cellScale,
          orientation: frame.layout.orientation,
          // The Pixi camera is mounted directly inside the board viewport. Its
          // physical client rect is therefore the coordinate bridge origin;
          // applying the surrounding DOM frame inset here would count it twice.
          clientOrigin: {
              x: Number(cameraRect && cameraRect.left) || 0,
              y: Number(cameraRect && cameraRect.top) || 0
          },
          frameInset: { top: 0, right: 0, bottom: 0, left: 0 },
          visualViewport: {
              scale: viewport && Number(viewport.scale) || frame.layout.visualViewport.scale || 1,
              offsetLeft: viewport && Number(viewport.offsetLeft) || 0,
              offsetTop: viewport && Number(viewport.offsetTop) || 0
          },
          camera: {
              // Scroll belongs to the inner Pixi viewport. clientOrigin remains
              // the frame anchor, so the same offset is never applied twice.
              scrollLeft: Number(cameraElement && cameraElement.scrollLeft) || 0,
              scrollTop: Number(cameraElement && cameraElement.scrollTop) || 0,
              viewportWidth,
              viewportHeight
          }
      });
      return Object.freeze({ ...frame, layout });
  }

  function _readBoardPresentationScalesForBoardRenderer(host: any) {
      let stageScale = 1;
      let cellScale = 1;
      try {
          const rootStyle = document && document.documentElement && document.documentElement.style;
          const parsed = Number.parseFloat(String(rootStyle && rootStyle.getPropertyValue('--layout-stage-scale') || ''));
          if (Number.isFinite(parsed) && parsed > 0) stageScale = parsed;
      } catch (e: any) { /* use unit stage scale */ }
      try {
          const parsed = Number.parseFloat(String(host && host.style && host.style.getPropertyValue('--board-cell-scale') || ''));
          if (Number.isFinite(parsed) && parsed > 0) cellScale = parsed;
      } catch (e: any) { /* use unit cell scale */ }
      return Object.freeze({ stageScale, cellScale });
  }

  function _capPixiBoardViewportForBoardRenderer(host: any, topology: any) {
      return dependencies.layoutRuntime.capPixiBoardViewport(host, topology);
  }

  function _createCommittedWorldStateCallbackForBoardRenderer(frame: any, backendKind: unknown) {
      let committed = false;
      const captured = frame && typeof frame === 'object'
          ? BoardVisualWorldStateByFrameForBoardRenderer.get(frame)
          : null;
      const CommittedWorldStateModule = _require('../presentation/committed-world-state');
      const manifestPresentationState = captured
          && Object.prototype.hasOwnProperty.call(captured, 'manifestPresentationState')
          ? captured.manifestPresentationState
          : (
              CommittedWorldStateModule
              && typeof CommittedWorldStateModule.createCommittedManifestPresentationState === 'function'
                  ? CommittedWorldStateModule.createCommittedManifestPresentationState(
                      dependencies.getRenderStateSource().resolvePair().cardState
                  )
                  : null
          );
      return () => {
          if (committed) return;
          committed = true;
          if (!CommittedWorldStateModule || typeof CommittedWorldStateModule.presentCommittedWorldState !== 'function') return;
          CommittedWorldStateModule.presentCommittedWorldState(manifestPresentationState);
          if (backendKind === 'pixi') {
              if (captured && captured.boardUpdateSyncContext) {
                  const syncRuntime = dependencies.getBoardUpdateSyncRuntime();
                  if (syncRuntime && typeof syncRuntime.consumeBoardUpdateSyncContext === 'function') {
                      syncRuntime.consumeBoardUpdateSyncContext();
                  }
              }
              if (captured && captured.boardUpdateContext
                  && dependencies.playbackState
                  && typeof dependencies.playbackState.consumeBoardUpdateContext === 'function') {
                  dependencies.playbackState.consumeBoardUpdateContext();
              }
          }
      };
  }

  function _beginBoardVisualApplyTransactionForBoardRenderer(frame: any, context: any) {
      const commitWorldState = _createCommittedWorldStateCallbackForBoardRenderer(
          frame,
          context && context.backendKind
      );
      if (!context) {
          return Object.freeze({ frame, commit: commitWorldState });
      }
      const host = context.host || dependencies.resolveHost();
      if (!host) throw new Error('Board frame presentation host is unavailable');
      const FramePresenterModule = _require('./frame-presenter');
      if (!FramePresenterModule || typeof FramePresenterModule.presentBoardFrame !== 'function') {
          throw new Error('Board frame presenter is unavailable');
      }
      const snapshot = _captureBoardVisualApplyDomSnapshotForBoardRenderer(host);
      try {
          // These writes occur only after the controller authorizes this frame.
          FramePresenterModule.presentBoardFrame(host, frame);
          if (context.backendKind !== 'pixi') {
              return Object.freeze({
                  frame,
                  commit: commitWorldState,
                  rollback: snapshot.rollback
              });
          }
          const topology = frame.model.topology;
          dependencies.layoutRuntime.syncBoardPixelSizing(host, {
              rows: topology.renderRows,
              cols: topology.renderCols,
              baseRows: topology.baseRows,
              baseCols: topology.baseCols,
              minRow: topology.minRow,
              minCol: topology.minCol
          });
          _capPixiBoardViewportForBoardRenderer(host, topology);
          const presentedFrame = _createBoardVisualFrameWithLiveLayoutForBoardRenderer(host, frame);
          return Object.freeze({
              frame: presentedFrame,
              commit: commitWorldState,
              rollback: snapshot.rollback
          });
      } catch (error) {
          snapshot.rollback();
          throw error;
      }
  }

  function _readBoardCellSizeForLayout(host: any, topology?: any) {
      return dependencies.layoutRuntime.readBoardCellSize(host, topology);
  }

  function _readBoardFrameGeometryForLayout(host: any, appearance: any) {
      return dependencies.layoutRuntime.readBoardFrameGeometry(host, appearance);
  }

  function _buildBoardVisualFrameForBoardRenderer(controller: any, baseVisualStateOverride?: any) {
      const StateAdapterModule = _require('./state-adapter');
      StateAdapterModule.configureBoardVisualRenderStateSource?.(
          dependencies.getRenderStateSource()
      );
      const LayoutModule = _require('./layout');
      const ThemeModule = _require('./theme');
      const FramePresenterModule = _require('./frame-presenter');
      const baseInputs = StateAdapterModule.createBoardRenderInputs(
          dependencies.getInputFrameInputs(),
          baseVisualStateOverride
      );
      const projection = StateAdapterModule.createBoardRenderProjection(undefined, baseInputs);
      const cellState = StateAdapterModule.buildCurrentCellState(projection, baseInputs);
      const presentationOverlayState = StateAdapterModule.createBoardPresentationOverlayState(
          projection,
          cellState,
          baseInputs.presentationOverlayState
      );
      const inputs = Object.freeze({
          baseVisualState: baseInputs.baseVisualState,
          presentationOverlayState
      });
      const frameSerial = ++BoardVisualFrameSerialForBoardRenderer;
      const model = StateAdapterModule.buildBoardRenderModel(projection, cellState, {
          visualRevision: 0,
          overlay: inputs.presentationOverlayState,
          inputs
      });
      const host = dependencies.resolveHost();
      const appearance = FramePresenterModule.resolveBoardAppearanceDescriptor(host, 0);
      const frameGeometry = _readBoardFrameGeometryForLayout(host, appearance);
      const layoutCellSize = _readBoardCellSizeForLayout(host, model.topology);
      const presentationScales = _readBoardPresentationScalesForBoardRenderer(host);
      const viewport = typeof window !== 'undefined' ? (window as any).visualViewport : null;
      const layout = LayoutModule.createBoardViewportLayout(model.topology, {
          revision: 0,
          cellSize: layoutCellSize,
          dpr: typeof window !== 'undefined' ? window.devicePixelRatio : 1,
          stageScale: presentationScales.stageScale,
          cellScale: presentationScales.cellScale,
          clientOrigin: frameGeometry.clientOrigin,
          frameInset: frameGeometry.frameInset,
          visualViewport: {
              scale: viewport && Number(viewport.scale) || 1,
              offsetLeft: viewport && Number(viewport.offsetLeft) || 0,
              offsetTop: viewport && Number(viewport.offsetTop) || 0
          },
          camera: {
              scrollLeft: host && Number(host.scrollLeft) || 0,
              scrollTop: host && Number(host.scrollTop) || 0,
              // The DOM compatibility host is the logical board surface. Its
              // live rect still describes the previous topology until the
              // controller-owned frame presenter applies this frame, so using
              // that rect here would incorrectly clip a shape change. The Pixi
              // viewport supplies its scroll viewport dimensions separately.
              viewportWidth: model.topology.renderCols * layoutCellSize,
              viewportHeight: model.topology.renderRows * layoutCellSize
          }
      });
      const activeFrameToken = controller && typeof controller.getActiveFrameToken === 'function'
          ? controller.getActiveFrameToken()
          : (
              controller && typeof controller.getActiveWriterToken === 'function'
                  ? controller.getActiveWriterToken()?.frameToken || null
                  : null
          );
      const frameToken = activeFrameToken || `idle:${frameSerial}`;
      if (!BoardVisualFrameRevisionComposerForBoardRenderer) {
          BoardVisualFrameRevisionComposerForBoardRenderer = FramePresenterModule.createBoardVisualFrameRevisionComposer();
      }
      const frame = BoardVisualFrameRevisionComposerForBoardRenderer.compose(Object.freeze({
          model,
          layout,
          appearance,
          theme: ThemeModule.resolveBoardVisualThemeDescriptor(host, 0),
          frameToken,
          renderSessionId: `board-render-session:${BoardVisualRenderSessionEpochForBoardRenderer}`
      }));
      let boardUpdateContext: any = null;
      try {
          if (dependencies.playbackState && typeof dependencies.playbackState.getBoardUpdateContext === 'function') {
              const value = dependencies.playbackState.getBoardUpdateContext();
              if (value && typeof value === 'object') boardUpdateContext = Object.freeze({ ...value });
          }
      } catch (e: any) { /* absent context */ }
      const boardUpdateSyncContextValue = dependencies.peekBoardUpdateSyncContext();
      const CommittedWorldStateModule = _require('../presentation/committed-world-state');
      if (typeof CommittedWorldStateModule.createCommittedManifestPresentationState !== 'function') {
          throw new Error('Committed manifest presentation snapshot capability is unavailable');
      }
      BoardVisualWorldStateByFrameForBoardRenderer.set(frame, Object.freeze({
          manifestPresentationState: CommittedWorldStateModule.createCommittedManifestPresentationState(
              inputs.baseVisualState && (inputs.baseVisualState as any).cardState
          ),
          boardUpdateContext,
          boardUpdateSyncContext: boardUpdateSyncContextValue && typeof boardUpdateSyncContextValue === 'object'
              ? Object.freeze({ ...boardUpdateSyncContextValue })
              : null
      }));
      return frame;
  }

  function getNextFrameSerial(): number {
    return BoardVisualFrameSerialForBoardRenderer + 1;
  }

  function resetSession(): string {
    BoardVisualRenderSessionEpochForBoardRenderer = BoardVisualRenderSessionEpochForBoardRenderer >= Number.MAX_SAFE_INTEGER
      ? 1
      : BoardVisualRenderSessionEpochForBoardRenderer + 1;
    LastPixiBoardExpansionRevealSoundKeyForBoardRenderer = null;
    return `board-render-session:${BoardVisualRenderSessionEpochForBoardRenderer}`;
  }

  function destroyPageRuntime(): void {
    _disposeBoardVisualThemeFontObserverForBoardRenderer();
  }

  return Object.freeze({
    buildFrame: _buildBoardVisualFrameForBoardRenderer,
    beginApplyFrame: _beginBoardVisualApplyTransactionForBoardRenderer,
    playTopologyRevealSound: _playPixiBoardExpansionRevealSoundForBoardRenderer,
    installHostResources: _installBoardVisualThemeFontObserverForBoardRenderer,
    disposeHostResources: _disposeBoardVisualThemeFontObserverForBoardRenderer,
    getNextFrameSerial,
    resetSession,
    destroyPageRuntime
  });
}
