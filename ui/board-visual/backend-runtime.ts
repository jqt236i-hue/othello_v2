declare const __non_webpack_require__: NodeRequire | undefined;

const _require: NodeRequire = (typeof __non_webpack_require__ !== 'undefined')
  ? __non_webpack_require__
  : require;

export interface BoardBackendRuntimeDependencies {
  getRenderStateSource(): any;
  syncBoardPixelSizing(boardElement: any, shapeInput?: any): any;
  renderBoard(preparedVisualUpdate?: any): void;
  renderBoardFull(): void;
  getInputController(): any;
  applyTimeStopLegalEmphasis(cell: any, active: any): void;
  resolveBoardExpansionLayerElement(boardElement: any, createIfMissing?: any): any;
  playTopologyRevealSound(keys: readonly string[], frame: any): void;
  beginApplyFrame(frame: any, context: any): any;
  resolveHost(): any;
  subscribeSettledFrame(controller: any): (() => void) | null;
  beforeControllerReplace(previousRuntime: any): void;
  installHostResources(host: HTMLElement | null): void;
  afterControllerReplace(runtime: any): void;
}

export interface BoardBackendRuntime {
  configureForTest(options?: any): void;
  getController(): any;
  configureController(controller: any, options?: any): any;
  getRuntime(): any;
  resetSession(): void;
  destroyPageRuntime(): void;
}

export function createBoardBackendRuntime(dependencies: BoardBackendRuntimeDependencies): BoardBackendRuntime {
  if (!dependencies || typeof dependencies.getRenderStateSource !== 'function'
    || typeof dependencies.syncBoardPixelSizing !== 'function'
    || typeof dependencies.renderBoard !== 'function'
    || typeof dependencies.renderBoardFull !== 'function'
    || typeof dependencies.getInputController !== 'function'
    || typeof dependencies.beginApplyFrame !== 'function'
    || typeof dependencies.resolveHost !== 'function'
    || typeof dependencies.subscribeSettledFrame !== 'function'
    || typeof dependencies.beforeControllerReplace !== 'function'
    || typeof dependencies.installHostResources !== 'function'
    || typeof dependencies.afterControllerReplace !== 'function') {
    throw new Error('Board backend runtime dependencies are incomplete');
  }

  let BoardVisualRuntimeForBoardRenderer: any = null;
  let BoardVisualBackendTestConfigForBoardRenderer: any = null;
  let BoardVisualPageRuntimeDestroyedForBoardRenderer = false;
  let rejectBoardVisualPageRuntimeForBoardRenderer!: (reason?: unknown) => void;
  const BoardVisualPageRuntimeDestroyedPromiseForBoardRenderer = new Promise<never>((_resolve, reject) => {
      rejectBoardVisualPageRuntimeForBoardRenderer = reject;
  });
  void BoardVisualPageRuntimeDestroyedPromiseForBoardRenderer.catch(() => undefined);

  function _createBoardVisualPageRuntimeDestroyedErrorForBoardRenderer() {
      return new Error('Board visual backend runtime is destroyed');
  }

  function _throwIfBoardVisualPageRuntimeDestroyedForBoardRenderer(): void {
      if (BoardVisualPageRuntimeDestroyedForBoardRenderer) {
          throw _createBoardVisualPageRuntimeDestroyedErrorForBoardRenderer();
      }
  }

  function _awaitWhileBoardVisualPageRuntimeActiveForBoardRenderer<T>(
      value: T | PromiseLike<T>
  ): Promise<T> {
      _throwIfBoardVisualPageRuntimeDestroyedForBoardRenderer();
      return Promise.race([
          Promise.resolve(value),
          BoardVisualPageRuntimeDestroyedPromiseForBoardRenderer
      ]);
  }

  const PIXI_INITIAL_FALLBACK_ERROR_CODES_FOR_BOARD_RENDERER = new Set([
    'pixi_runtime_unavailable',
    'pixi_webgl_unavailable',
    'pixi_application_init_failed',
    'pixi_webgl_init_failed',
    'pixi_renderer_init_failed',
    'pixi_software_webgl_renderer'
  ]);

  function _createBoardVisualCapabilityErrorForBoardRenderer(
      code: string,
      message: string,
      stage?: string,
      cause?: unknown
  ) {
      const error: any = new Error(message);
      error.name = 'BoardVisualCapabilityError';
      error.code = code;
      if (stage) error.stage = stage;
      if (typeof cause !== 'undefined') error.cause = cause;
      return error;
  }

  function _isBoardVisualTestInjectionAllowedForBoardRenderer() {
      try {
          if (typeof process !== 'undefined' && process.env && process.env.NODE_ENV === 'test') return true;
      } catch (e: any) { /* ignore */ }
      try {
          if (typeof window !== 'undefined' && (window as any).__BOARD_VISUAL_TEST__ === true) return true;
      } catch (e: any) { /* ignore */ }
      return false;
  }

  function configureBoardVisualBackendForTest(options?: any) {
      if (BoardVisualPageRuntimeDestroyedForBoardRenderer) {
          throw new Error('Board visual backend runtime is destroyed');
      }
      if (!_isBoardVisualTestInjectionAllowedForBoardRenderer()) {
          throw new Error('Board visual backend injection is available only to an explicit test harness');
      }
      if (BoardVisualRuntimeForBoardRenderer) {
          throw new Error('Board visual backend selection is already fixed for this page');
      }
      if (options == null) {
          BoardVisualBackendTestConfigForBoardRenderer = null;
          return;
      }
      const selection = options.selection == null ? null : String(options.selection);
      if (selection !== null && selection !== 'dom' && selection !== 'pixi') {
          throw new Error('Board visual backend test selection must be dom or pixi');
      }
      if (options.createDomBackend != null && typeof options.createDomBackend !== 'function') {
          throw new Error('createDomBackend must be a function');
      }
      if (options.createPixiBackend != null && typeof options.createPixiBackend !== 'function') {
          throw new Error('createPixiBackend must be a function');
      }
      BoardVisualBackendTestConfigForBoardRenderer = Object.freeze({
          selection,
          noAnimation: typeof options.noAnimation === 'boolean' ? options.noAnimation : undefined,
          createDomBackend: options.createDomBackend || null,
          createPixiBackend: options.createPixiBackend || null
      });
  }

  function _readBoardVisualRendererQueryForBoardRenderer() {
      try {
          const activeLocation = typeof window !== 'undefined' && window.location
              ? window.location
              : (typeof location !== 'undefined' ? location : null);
          return new URLSearchParams(activeLocation ? String(activeLocation.search || '') : '');
      } catch (e: any) {
          return new URLSearchParams('');
      }
  }

  function _selectBoardVisualBackendForBoardRenderer() {
      const testConfig = BoardVisualBackendTestConfigForBoardRenderer;
      const params = _readBoardVisualRendererQueryForBoardRenderer();
      const queryRequestsDom = params.get('debug') === '1' && params.get('boardRenderer') === 'dom';
      const queryForcesPixi = params.get('debug') === '1' && params.get('boardRenderer') === 'pixi';
      const kind = testConfig && testConfig.selection
          ? testConfig.selection
          : (queryRequestsDom ? 'dom' : 'pixi');
      const noAnimation = kind === 'pixi'
          ? (testConfig && typeof testConfig.noAnimation === 'boolean'
              ? testConfig.noAnimation
              : params.get('noanim') === '1')
          : false;
      return Object.freeze({ kind, noAnimation, allowSoftwareRenderer: kind === 'pixi' && queryForcesPixi });
  }

  function _assertBoardVisualBackendShapeForBoardRenderer(backend: any, kind: 'dom' | 'pixi') {
      if (
          !backend
          || backend.kind !== kind
          || typeof backend.mount !== 'function'
          || typeof backend.applyFrame !== 'function'
          || typeof backend.playPhase !== 'function'
          || typeof backend.getCellClientRect !== 'function'
          || typeof backend.resize !== 'function'
          || typeof backend.restore !== 'function'
          || typeof backend.destroy !== 'function'
      ) {
          throw new Error(`${kind} board visual backend does not implement the backend port`);
      }
      return backend;
  }

  function _createFailedBoardVisualBackendForBoardRenderer(kind: 'dom' | 'pixi', error: Error) {
      return {
          kind,
          mount() { return Promise.reject(error); },
          applyFrame() { throw error; },
          playPhase() { return Promise.reject(error); },
          getCellClientRect() { return null; },
          resize() { throw error; },
          restore() { return Promise.reject(error); },
          destroy() { /* no resources were acquired */ }
      };
  }

  async function _ensureDomBoardVisualBackendModulesForBoardRenderer(): Promise<void> {
      let modulesReady = false;
      try {
          const renderer = _require('../board-dom-compat/renderer');
          const backend = _require('../board-dom-compat/backend');
          modulesReady = !!(renderer && backend);
      } catch (_error) { /* Vite compatibility payload may not be registered yet */ }
      if (!modulesReady) {
          const root: any = typeof window !== 'undefined' ? window : globalThis;
          const loadPayload = root && root.__CARD_REVERSI_LOAD_VITE_BOARD_PAYLOAD__;
          if (typeof loadPayload !== 'function') {
              throw new Error('DOM compatibility board payload loader is unavailable');
          }
          await _awaitWhileBoardVisualPageRuntimeActiveForBoardRenderer(
              loadPayload.call(root, 'compatibility')
          );
          _throwIfBoardVisualPageRuntimeDestroyedForBoardRenderer();
      }
      await _ensureDomBoardCompatibilityStylesheetForBoardRenderer(
          typeof document !== 'undefined' ? document : null
      );
      _throwIfBoardVisualPageRuntimeDestroyedForBoardRenderer();
  }

  async function _ensureDomBoardCompatibilityStylesheetForBoardRenderer(
      documentRef: Document | null
  ): Promise<void> {
      const loader = _require('../assets/feature-stylesheet-loader');
      if (!loader || typeof loader.ensureFeatureStylesheet !== 'function') {
          throw new Error('DOM compatibility board stylesheet loader is unavailable');
      }
      const result = await _awaitWhileBoardVisualPageRuntimeActiveForBoardRenderer(
          loader.ensureFeatureStylesheet('board-dom-compat', documentRef)
      );
      if (!result || result.ok !== true) {
          const error: any = new Error(
              String(result?.warning || 'DOM compatibility board stylesheet failed to load')
          );
          error.code = 'dom_compatibility_stylesheet_unavailable';
          error.stage = 'compatibility-stylesheet';
          throw error;
      }
  }

  function _createDomBoardVisualBackendForBoardRenderer() {
      const compatibilityRenderer = _require('../board-dom-compat/renderer');
      if (
          !compatibilityRenderer
          || typeof compatibilityRenderer.configureBoardRendererCapabilities !== 'function'
      ) {
          throw new Error('DOM compatibility board capability injection is unavailable');
      }
      compatibilityRenderer.configureBoardRendererCapabilities(Object.freeze({
          renderStateSource: dependencies.getRenderStateSource(),
          syncBoardPixelSizing: dependencies.syncBoardPixelSizing,
          renderBoard: dependencies.renderBoard,
          renderBoardFull: dependencies.renderBoardFull,
          getBoardInputController: dependencies.getInputController,
          applyTimeStopLegalEmphasis: dependencies.applyTimeStopLegalEmphasis,
          resolveBoardExpansionLayerElement: dependencies.resolveBoardExpansionLayerElement
      }));
      const options = {
          compatibilityRenderer,
          prepareStylesheet(documentRef: Document) {
              return _ensureDomBoardCompatibilityStylesheetForBoardRenderer(documentRef);
          },
          prepareStoneVisuals(documentRef: Document) {
              const preparation = _require('../board-dom-compat/stone-visual-preparation');
              if (
                  !preparation
                  || typeof preparation.prepareDomCompatibilityStoneVisuals !== 'function'
              ) {
                  throw new Error('DOM compatibility stone visual preparation is unavailable');
              }
              return preparation.prepareDomCompatibilityStoneVisuals(documentRef);
          },
          beforeApplyFrame(activeHost: any, frame: any) {
              const topology = frame && frame.model && frame.model.topology || {};
              dependencies.syncBoardPixelSizing(activeHost, {
                  rows: topology.renderRows,
                  cols: topology.renderCols,
                  baseRows: topology.baseRows,
                  baseCols: topology.baseCols,
                  minRow: topology.minRow,
                  minCol: topology.minCol
              });
          }
      };
      const testFactory = BoardVisualBackendTestConfigForBoardRenderer
          && BoardVisualBackendTestConfigForBoardRenderer.createDomBackend;
      const factory = testFactory || (() => {
          const DomBackendModule = _require('../board-dom-compat/backend');
          if (!DomBackendModule || typeof DomBackendModule.createDomBoardVisualBackend !== 'function') {
              throw new Error('DOM board visual backend factory is unavailable');
          }
          return DomBackendModule.createDomBoardVisualBackend(options);
      });
      return _assertBoardVisualBackendShapeForBoardRenderer(
          testFactory ? factory(options) : factory(),
          'dom'
      );
  }

  function _playPixiBoardExpansionRevealSoundForBoardRenderer(
      keys: readonly string[],
      frame: any
  ) {
      dependencies.playTopologyRevealSound(keys, frame);
  }

  function _createPixiBoardVisualBackendForBoardRenderer(
      noAnimation: boolean,
      contextRecovery?: any,
      allowSoftwareRenderer = false
  ) {
      const options = Object.freeze({
          noAnimation,
          allowSoftwareRenderer,
          // Backend mount precedes UI event activation. Resolve lazily so the
          // adapter can exist while BoardInputController remains disabled until
          // bootstrap finishes the visual-ready gate.
          getInputController: () => dependencies.getInputController(),
          onTopologyRevealStart: _playPixiBoardExpansionRevealSoundForBoardRenderer,
          ...(contextRecovery ? { contextRecovery } : {})
      });
      const testFactory = BoardVisualBackendTestConfigForBoardRenderer
          && BoardVisualBackendTestConfigForBoardRenderer.createPixiBackend;
      if (testFactory) {
          try {
              return _assertBoardVisualBackendShapeForBoardRenderer(testFactory(options), 'pixi');
          } catch (cause: any) {
              const error = cause instanceof Error
                  ? cause
                  : _createBoardVisualCapabilityErrorForBoardRenderer(
                      'pixi_backend_factory_failed',
                      'Pixi board visual backend factory failed',
                      'factory',
                      cause
                  );
              return _createFailedBoardVisualBackendForBoardRenderer('pixi', error);
          }
      }
      let PixiBackendModule: any;
      try {
          PixiBackendModule = _require('../pixi/board-backend');
      } catch (cause: any) {
          return _createFailedBoardVisualBackendForBoardRenderer(
              'pixi',
              _createBoardVisualCapabilityErrorForBoardRenderer(
                  'pixi_runtime_unavailable',
                  'Pixi board visual backend module is unavailable',
                  'runtime',
                  cause
              )
          );
      }
      if (!PixiBackendModule || typeof PixiBackendModule.createPixiBoardVisualBackend !== 'function') {
          return _createFailedBoardVisualBackendForBoardRenderer(
              'pixi',
              _createBoardVisualCapabilityErrorForBoardRenderer(
                  'pixi_runtime_unavailable',
                  'Pixi board visual backend factory is unavailable',
                  'runtime'
              )
          );
      }
      try {
          return _assertBoardVisualBackendShapeForBoardRenderer(
              PixiBackendModule.createPixiBoardVisualBackend(options),
              'pixi'
          );
      } catch (cause: any) {
          const error = cause instanceof Error
              ? cause
              : _createBoardVisualCapabilityErrorForBoardRenderer(
                  'pixi_backend_factory_failed',
                  'Pixi board visual backend factory failed',
                  'factory',
                  cause
              );
          return _createFailedBoardVisualBackendForBoardRenderer('pixi', error);
      }
  }

  function _showBoardVisualReloadRequiredForBoardRenderer(error: unknown, diagnostics?: any) {
      if (BoardVisualPageRuntimeDestroyedForBoardRenderer) return;
      const message = '盤面表示を復旧できませんでした。ページを再読み込みしてください。';
      diagnostics?.record?.('context-recovery:reload-required', {
          message: String((error as any)?.message || error || '')
      });
      try {
          const SurfaceModule = _require('../presentation/reload-required-surface');
          if (SurfaceModule && typeof SurfaceModule.showReloadRequiredSurface === 'function') {
              SurfaceModule.showReloadRequiredSurface({
                  root: typeof window !== 'undefined' ? window : null,
                  message
              });
          }
      } catch (_error) { /* the controller remains locked even without a DOM alert surface */ }
  }

  function _isPixiInitialFallbackErrorForBoardRenderer(error: unknown) {
      const visited = new Set<unknown>();
      let current: any = error;
      for (let depth = 0; current && depth < 6 && !visited.has(current); depth += 1) {
          visited.add(current);
          const code = String(current.code || '').trim().toLowerCase();
          if (PIXI_INITIAL_FALLBACK_ERROR_CODES_FOR_BOARD_RENDERER.has(code)) return true;
          current = current.cause || current.originalError || null;
      }
      return false;
  }

  function _isBoardVisualDiagnosticsEnabledForBoardRenderer() {
      try {
          if (typeof window !== 'undefined' && ((window as any).__BOARD_VISUAL_TEST__ === true || (window as any).__DEV__ === true)) return true;
          if (typeof location !== 'undefined') return /(?:^|[?&])debug=1(?:&|$)/.test(String(location.search || ''));
      } catch (e: any) { /* ignore */ }
      return false;
  }

  function _createBoardVisualRuntimeForBoardRenderer() {
      const host = dependencies.resolveHost();
      if (!host) return null;
      const ControllerModule = _require('./controller');
      const DiagnosticsModule = _require('./diagnostics');
      const diagnostics = DiagnosticsModule.createBoardVisualDiagnostics({
          enabled: _isBoardVisualDiagnosticsEnabledForBoardRenderer()
      });
      const selection = _selectBoardVisualBackendForBoardRenderer();
      let controller: any = null;
      let contextFallback: Promise<boolean> | null = null;
      const contextRecovery = selection.kind === 'pixi'
          ? Object.freeze({
              timeoutMs: 5000,
              onContextLost(error: Error) {
                  if (!controller || typeof controller.beginContextRecovery !== 'function') {
                      throw new Error('Board context recovery controller is unavailable');
                  }
                  // The controller owns and observes this promise. The backend
                  // must continue synchronously so it can interrupt Pixi work.
                  controller.beginContextRecovery(error);
              },
              onContextRestored() {
                  if (!controller || typeof controller.restoreContextRecovery !== 'function') return false;
                  return controller.restoreContextRecovery();
              },
              onFallbackRequired(error: Error) {
                  if (BoardVisualPageRuntimeDestroyedForBoardRenderer) {
                      return Promise.reject(_createBoardVisualPageRuntimeDestroyedErrorForBoardRenderer());
                  }
                  if (contextFallback) return contextFallback;
                  contextFallback = (async () => {
                      diagnostics.record('backend:context-compatibility-fallback-start', {
                          from: 'pixi', message: String(error && error.message || '')
                      });
                      try {
                          await _ensureDomBoardVisualBackendModulesForBoardRenderer();
                          _throwIfBoardVisualPageRuntimeDestroyedForBoardRenderer();
                          const compatibilityBackend = _createDomBoardVisualBackendForBoardRenderer();
                          await _awaitWhileBoardVisualPageRuntimeActiveForBoardRenderer(
                              controller.replaceBackend(compatibilityBackend, {
                                  preserveContextRecovery: true
                              })
                          );
                          _throwIfBoardVisualPageRuntimeDestroyedForBoardRenderer();
                          await _awaitWhileBoardVisualPageRuntimeActiveForBoardRenderer(
                              controller.restoreContextRecovery({ backendAlreadyRestored: true })
                          );
                          _throwIfBoardVisualPageRuntimeDestroyedForBoardRenderer();
                          diagnostics.record('backend:context-compatibility-fallback-ready', {
                              from: 'pixi', to: 'dom'
                          });
                          return true;
                      } catch (cause: any) {
                          if (BoardVisualPageRuntimeDestroyedForBoardRenderer) throw cause;
                          try { controller?.failContextRecovery?.(cause); } catch (_error) { /* preserve primary failure */ }
                          _showBoardVisualReloadRequiredForBoardRenderer(cause, diagnostics);
                          throw cause;
                      }
                  })();
                  contextFallback.catch(() => { /* surfaced through reload-required state */ });
                  return contextFallback;
              },
              onRecoveryFailed(error: Error) {
                  if (BoardVisualPageRuntimeDestroyedForBoardRenderer) return;
                  try { controller?.failContextRecovery?.(error); } catch (_error) { /* preserve recovery error */ }
                  _showBoardVisualReloadRequiredForBoardRenderer(error, diagnostics);
              }
          })
          : null;
      const backend = selection.kind === 'pixi'
          ? _createPixiBoardVisualBackendForBoardRenderer(
              selection.noAnimation,
              contextRecovery,
              selection.allowSoftwareRenderer
          )
          : _createDomBoardVisualBackendForBoardRenderer();
      controller = ControllerModule.createBoardVisualController({
          backend,
          diagnostics,
          beginApplyFrame: dependencies.beginApplyFrame
      });
      const settledFrameSubscription = dependencies.subscribeSettledFrame(controller);
      const mountPromise = _awaitWhileBoardVisualPageRuntimeActiveForBoardRenderer(
          controller.mount(host)
      );
      const initialReadyPromise = mountPromise.catch(async (error: any) => {
          _throwIfBoardVisualPageRuntimeDestroyedForBoardRenderer();
          diagnostics.record('controller:mount-error', { message: String(error && error.message || error || '') });
          if (selection.kind !== 'pixi' || !_isPixiInitialFallbackErrorForBoardRenderer(error)) throw error;
          diagnostics.record('backend:compatibility-fallback-start', {
              from: 'pixi',
              code: String(error && error.code || ''),
              stage: String(error && error.stage || '')
          });
          let compatibilityBackend: any;
          try {
              await _ensureDomBoardVisualBackendModulesForBoardRenderer();
              _throwIfBoardVisualPageRuntimeDestroyedForBoardRenderer();
              compatibilityBackend = _createDomBoardVisualBackendForBoardRenderer();
          } catch (cause: any) {
              if (BoardVisualPageRuntimeDestroyedForBoardRenderer) throw cause;
              compatibilityBackend = _createFailedBoardVisualBackendForBoardRenderer(
                  'dom',
                  _createBoardVisualCapabilityErrorForBoardRenderer(
                      'dom_compatibility_backend_unavailable',
                      'DOM compatibility board backend is unavailable',
                      'compatibility',
                      cause
                  )
              );
          }
          await _awaitWhileBoardVisualPageRuntimeActiveForBoardRenderer(
              controller.replaceBackend(compatibilityBackend)
          );
          _throwIfBoardVisualPageRuntimeDestroyedForBoardRenderer();
          diagnostics.record('backend:compatibility-fallback-ready', { from: 'pixi', to: 'dom' });
      });
      initialReadyPromise.catch(() => { /* readiness is observed by bootstrap or the caller */ });
      if (controller.ready && typeof controller.ready.catch === 'function') {
          controller.ready.catch(() => { /* readiness is observed through the runtime promise */ });
      }
      const controllerWaitUntilReady = typeof controller.waitUntilReady === 'function'
          ? controller.waitUntilReady.bind(controller)
          : null;
      if (controllerWaitUntilReady) {
          // The initial Pixi readiness cycle rejects before replaceBackend starts
          // its compatibility cycle. Bootstrap must observe the complete exclusive
          // mount transaction, then any later controller recovery cycle.
          controller.waitUntilReady = () => initialReadyPromise.then(() => controllerWaitUntilReady());
      }
      const runtime = { controller, diagnostics, host, ready: initialReadyPromise, settledFrameSubscription };
      if (diagnostics.enabled === true) {
          const root = typeof window !== 'undefined' ? window : globalThis;
          DiagnosticsModule.installBoardVisualDebugContract(root, diagnostics, controller);
      }
      dependencies.installHostResources(host);
      return runtime;
  }

  function getBoardVisualController() {
      if (BoardVisualPageRuntimeDestroyedForBoardRenderer) return null;
      if (!BoardVisualRuntimeForBoardRenderer) {
          BoardVisualRuntimeForBoardRenderer = _createBoardVisualRuntimeForBoardRenderer();
      }
      return BoardVisualRuntimeForBoardRenderer ? BoardVisualRuntimeForBoardRenderer.controller : null;
  }

  function configureBoardVisualController(controller: any, options?: any) {
      if (BoardVisualPageRuntimeDestroyedForBoardRenderer) {
          throw new Error('Board visual backend runtime is destroyed');
      }
      if (!controller || typeof controller.submitFrame !== 'function') {
          throw new Error('configureBoardVisualController requires a controller');
      }
      const previousRuntime = BoardVisualRuntimeForBoardRenderer;
      try { previousRuntime?.settledFrameSubscription?.(); } catch (_error) { /* controller teardown continues */ }
      dependencies.beforeControllerReplace(previousRuntime);
      if (
          previousRuntime
          && previousRuntime.controller
          && previousRuntime.controller !== controller
          && typeof previousRuntime.controller.destroy === 'function'
      ) {
          previousRuntime.controller.destroy();
      }
      const diagnostics = options && options.diagnostics || null;
      const host = options && options.host || dependencies.resolveHost();
      BoardVisualRuntimeForBoardRenderer = {
          controller,
          diagnostics,
          host,
          ready: controller.ready || Promise.resolve(),
          settledFrameSubscription: dependencies.subscribeSettledFrame(controller)
      };
      if (diagnostics && diagnostics.enabled === true) {
          const DiagnosticsModule = _require('./diagnostics');
          const root = typeof window !== 'undefined' ? window : globalThis;
          DiagnosticsModule.installBoardVisualDebugContract(root, diagnostics, controller);
      }
      dependencies.installHostResources(host);
      dependencies.afterControllerReplace(BoardVisualRuntimeForBoardRenderer);
      return controller;
  }

  function getRuntime() {
    return BoardVisualRuntimeForBoardRenderer;
  }

  function resetSession(): void {
    // Match resets retain the page-owned controller, backend, listeners, and host.
  }

  function destroyPageRuntime(): void {
    if (!BoardVisualPageRuntimeDestroyedForBoardRenderer) {
      BoardVisualPageRuntimeDestroyedForBoardRenderer = true;
      rejectBoardVisualPageRuntimeForBoardRenderer(
        _createBoardVisualPageRuntimeDestroyedErrorForBoardRenderer()
      );
    }
    const runtime = BoardVisualRuntimeForBoardRenderer;
    if (!runtime) {
      BoardVisualBackendTestConfigForBoardRenderer = null;
      return;
    }
    try { runtime.settledFrameSubscription?.(); } catch (error: any) { /* page teardown continues */ }
    dependencies.beforeControllerReplace(runtime);
    runtime.controller?.destroy?.();
    BoardVisualRuntimeForBoardRenderer = null;
    BoardVisualBackendTestConfigForBoardRenderer = null;
  }

  return Object.freeze({
    configureForTest: configureBoardVisualBackendForTest,
    getController: getBoardVisualController,
    configureController: configureBoardVisualController,
    getRuntime,
    resetSession,
    destroyPageRuntime
  });
}
