declare const __non_webpack_require__: NodeRequire | undefined;

const _require: NodeRequire = (typeof __non_webpack_require__ !== 'undefined')
  ? __non_webpack_require__
  : require;

export interface BoardInputRuntimeDependencies {
  getVisualRuntime(): any;
  renderBoard(): void;
  getRenderStateSource(): any;
  resolveBoardElement(): any;
  handleCellClick(row: number, col: number, directionKey?: string): any;
}

export interface BoardInputRuntime {
  getController(): any;
  activate(options?: { isInputLocked?: () => boolean }): any;
  deactivate(): boolean;
  setPreviewHints(previewHints: unknown, options?: any): boolean;
  subscribeSettledFrame(controller: any): (() => void) | null;
  getFrameInputs(): Readonly<{ keyboardCursorKey: string | null; previewHints: readonly any[] }>;
  replaceController(): void;
  resetSession(): void;
  destroyPageRuntime(): void;
}

export function createBoardInputRuntime(dependencies: BoardInputRuntimeDependencies): BoardInputRuntime {
  if (!dependencies || typeof dependencies.getVisualRuntime !== 'function'
    || typeof dependencies.renderBoard !== 'function'
    || typeof dependencies.getRenderStateSource !== 'function'
    || typeof dependencies.resolveBoardElement !== 'function'
    || typeof dependencies.handleCellClick !== 'function') {
    throw new Error('Board input runtime dependencies are incomplete');
  }

  let BoardInputControllerForBoardRenderer: any = null;
  let BoardInputLockResolverForBoardRenderer: (() => boolean) | null = null;
  let BoardInputKeyboardCursorKeyForBoardRenderer: string | null = null;
  let BoardPresentationPreviewHintsForBoardRenderer: readonly any[] = Object.freeze([]);
  let BoardInputOverlayRenderSuppressedForBoardRenderer = false;
  let BoardInputDeferredOverlayRenderGenerationForBoardRenderer = 0;
  let BoardInputDeferredOverlayRenderForBoardRenderer: Promise<void> | null = null;
  let BoardAccessibilityLayerForBoardRenderer: any = null;

  function _recordBoardInputErrorForBoardRenderer(event: string, error: unknown) {
      const diagnostics = dependencies.getVisualRuntime() && dependencies.getVisualRuntime().diagnostics;
      if (!diagnostics || typeof diagnostics.record !== 'function') return;
      diagnostics.record(event, { message: String((error as any)?.message || error || '') });
  }

  function _requestBoardInputOverlayRenderForBoardRenderer() {
      if (BoardInputOverlayRenderSuppressedForBoardRenderer) return;
      const runtime = dependencies.getVisualRuntime();
      const controller = runtime && runtime.controller;
      if (!controller || (typeof controller.getMode === 'function' && controller.getMode() === 'destroyed')) return;
      const mode = typeof controller.getMode === 'function' ? controller.getMode() : 'idle';
      if (mode !== 'idle') {
          if (BoardInputDeferredOverlayRenderForBoardRenderer || typeof controller.waitForIdle !== 'function') return;
          const generation = ++BoardInputDeferredOverlayRenderGenerationForBoardRenderer;
          const pending = Promise.resolve(controller.waitForIdle()).then(() => new Promise<void>((resolve) => {
              setTimeout(() => {
                  try {
                      if (
                          generation === BoardInputDeferredOverlayRenderGenerationForBoardRenderer
                          && dependencies.getVisualRuntime() === runtime
                          && controller.getMode?.() === 'idle'
                      ) dependencies.renderBoard();
                  } catch (error) {
                      _recordBoardInputErrorForBoardRenderer('input:deferred-overlay-render-error', error);
                  } finally {
                      resolve();
                  }
              }, 0);
          })).catch((error) => {
              _recordBoardInputErrorForBoardRenderer('input:deferred-overlay-wait-error', error);
          }).finally(() => {
              if (BoardInputDeferredOverlayRenderForBoardRenderer === pending) {
                  BoardInputDeferredOverlayRenderForBoardRenderer = null;
              }
          });
          BoardInputDeferredOverlayRenderForBoardRenderer = pending;
          return;
      }
      try {
          dependencies.renderBoard();
      } catch (error) {
          _recordBoardInputErrorForBoardRenderer('input:overlay-render-error', error);
      }
  }

  function _setBoardInputKeyboardCursorKeyForBoardRenderer(rawKey: unknown): boolean {
      const next = rawKey == null ? null : String(rawKey);
      if (BoardInputKeyboardCursorKeyForBoardRenderer === next) return false;
      BoardInputKeyboardCursorKeyForBoardRenderer = next;
      _requestBoardInputOverlayRenderForBoardRenderer();
      return true;
  }

  function _areBoardPresentationPreviewHintsEqualForBoardRenderer(left: readonly any[], right: readonly any[]): boolean {
      if (left === right) return true;
      if (!Array.isArray(left) || !Array.isArray(right) || left.length !== right.length) return false;
      return left.every((hint, index) => (
          hint && right[index]
          && hint.cellKey === right[index].cellKey
          && hint.kind === right[index].kind
      ));
  }

  function setBoardPresentationPreviewHints(previewHints: unknown, options?: any): boolean {
      const BoardVisualModel = _require('./model');
      if (!BoardVisualModel || typeof BoardVisualModel.validateBoardPresentationOverlayState !== 'function') {
          throw new Error('Board visual overlay validation is unavailable');
      }
      const next = BoardVisualModel.validateBoardPresentationOverlayState({
          previewHints: Array.isArray(previewHints) ? previewHints : []
      }).previewHints;
      if (_areBoardPresentationPreviewHintsEqualForBoardRenderer(BoardPresentationPreviewHintsForBoardRenderer, next)) {
          return false;
      }
      BoardPresentationPreviewHintsForBoardRenderer = next;
      if (!(options && options.deferRender === true)) {
          _requestBoardInputOverlayRenderForBoardRenderer();
      }
      return true;
  }

  function _isBoardInputLockedForBoardRenderer(): boolean {
      const controller = dependencies.getVisualRuntime() && dependencies.getVisualRuntime().controller;
      if (controller && typeof controller.getMode === 'function' && controller.getMode() !== 'idle') return true;
      if (
          controller
          && typeof controller.isIdleSettlementPending === 'function'
          && controller.isIdleSettlementPending() === true
      ) return true;
      try {
          return BoardInputLockResolverForBoardRenderer?.() === true;
      } catch (_error) {
          return true;
      }
  }

  function _emitBoardInputBlockedForBoardRenderer(reason: string) {
      if (reason !== 'spectator') return;
      try {
          const root = typeof window !== 'undefined' ? window as any : null;
          if (root && typeof root.writeNetworkStatus === 'function') {
              root.writeNetworkStatus('観測中は操作できません', true);
          }
      } catch (_error) { /* status is presentation-only */ }
  }

  function getBoardInputController() {
      if (BoardInputControllerForBoardRenderer) return BoardInputControllerForBoardRenderer;
      const InputModule = _require('../board-input-controller');
      if (!InputModule || typeof InputModule.createBoardInputController !== 'function') {
          throw new Error('Board input controller capability is unavailable');
      }
      const StateAdapterModule = _require('./state-adapter');
      const input = InputModule.createBoardInputController({
          setHoveredCell: (row: number, col: number) => StateAdapterModule.setBoardVisualHoverCell(row, col),
          clearHoveredCell: () => StateAdapterModule.clearBoardVisualHoverPreview(),
          handleCellClick: (row: number, col: number, directionKey?: string) => {
              return dependencies.handleCellClick(row, col, directionKey);
          },
          getCellClientRect: (row: number, col: number) => {
              const visualController = dependencies.getVisualRuntime() && dependencies.getVisualRuntime().controller;
              return visualController && typeof visualController.getCellClientRect === 'function'
                  ? visualController.getCellClientRect(row, col)
                  : null;
          },
          setKeyboardCursorKey: _setBoardInputKeyboardCursorKeyForBoardRenderer,
          isInputLocked: _isBoardInputLockedForBoardRenderer,
          onBlocked: _emitBoardInputBlockedForBoardRenderer
      });
      BoardInputControllerForBoardRenderer = input;
      const visualController = dependencies.getVisualRuntime() && dependencies.getVisualRuntime().controller;
      const settledFrame = visualController && typeof visualController.getSettledFrame === 'function'
          ? visualController.getSettledFrame()
          : null;
      if (settledFrame && settledFrame.model && typeof input.syncModel === 'function') input.syncModel(settledFrame.model);
      return input;
  }

  function activateBoardInputController(options?: { isInputLocked?: () => boolean }) {
      if (options && Object.prototype.hasOwnProperty.call(options, 'isInputLocked')) {
          if (options.isInputLocked != null && typeof options.isInputLocked !== 'function') {
              throw new Error('Board input lock resolver must be a function');
          }
          BoardInputLockResolverForBoardRenderer = options.isInputLocked || null;
      }
      const input = getBoardInputController();
      input.activate?.();
      input.syncInputState?.();
      const visualController = dependencies.getVisualRuntime() && dependencies.getVisualRuntime().controller;
      const settledFrame = visualController?.getSettledFrame?.();
      if (settledFrame) _syncSettledBoardInputForBoardRenderer(settledFrame);
      return input;
  }

  function deactivateBoardInputController() {
      return BoardInputControllerForBoardRenderer?.deactivate?.() === true;
  }

  function _syncSettledBoardInputForBoardRenderer(frame: any) {
      if (!frame || !frame.model) return;
      try {
          const StoneInfoModule = _require('../presentation/stone-info-controller');
          StoneInfoModule?.configureBoardVisualRenderStateSource?.(
              dependencies.getRenderStateSource()
          );
          StoneInfoModule?.renderCurrentStoneInfoPanel?.(frame);
      } catch (error) {
          _recordBoardInputErrorForBoardRenderer('stone-info:frame-sync-error', error);
      }
      if (BoardInputControllerForBoardRenderer) {
          try {
              BoardInputControllerForBoardRenderer.syncModel?.(frame.model);
          } catch (error) {
              _recordBoardInputErrorForBoardRenderer('input:model-sync-error', error);
          }
      }
      const runtime = dependencies.getVisualRuntime();
      const controller = runtime && runtime.controller;
      const backendKind = controller && typeof controller.getBackendKind === 'function'
          ? controller.getBackendKind()
          : null;
      if (backendKind !== 'pixi') {
          BoardAccessibilityLayerForBoardRenderer?.destroy?.();
          BoardAccessibilityLayerForBoardRenderer = null;
          return;
      }
      try {
          const host = runtime.host || dependencies.resolveBoardElement();
          if (!host) return;
          if (!BoardAccessibilityLayerForBoardRenderer) {
              const AccessibilityModule = _require('../board-accessibility-layer');
              BoardAccessibilityLayerForBoardRenderer = AccessibilityModule.createBoardAccessibilityLayer({
                  document: host.ownerDocument,
                  onActivate: (row: number, col: number, directionKey: string, hint: any) => {
                      getBoardInputController().activateDirection?.(
                          row,
                          col,
                          directionKey,
                          hint && hint.id,
                          {
                              modelCommitId: hint && hint.modelCommitId,
                              boardDigest: hint && hint.boardDigest
                          }
                      );
                  },
                  onFocus: (cellKey: string) => {
                      getBoardInputController().focusDirectionHint?.(cellKey);
                  },
                  onBlur: (cellKey: string) => {
                      getBoardInputController().blurDirectionHint?.(cellKey);
                  }
              });
          }
          BoardAccessibilityLayerForBoardRenderer.mount(host, host.querySelector('canvas'));
          BoardAccessibilityLayerForBoardRenderer.sync({
              model: frame.model,
              getCellClientRect: (row: number, col: number) => controller.getCellClientRect(row, col)
          });
      } catch (error) {
          _recordBoardInputErrorForBoardRenderer('input:accessibility-sync-error', error);
      }
  }

  function _subscribeSettledBoardInputForBoardRenderer(controller: any) {
      if (!controller || typeof controller.subscribeSettledFrame !== 'function') return null;
      return controller.subscribeSettledFrame(_syncSettledBoardInputForBoardRenderer, true);
  }

  function getFrameInputs() {
    return Object.freeze({
      keyboardCursorKey: BoardInputKeyboardCursorKeyForBoardRenderer,
      previewHints: BoardPresentationPreviewHintsForBoardRenderer
    });
  }

  function replaceController(): void {
    BoardInputDeferredOverlayRenderGenerationForBoardRenderer += 1;
    BoardInputDeferredOverlayRenderForBoardRenderer = null;
    BoardAccessibilityLayerForBoardRenderer?.destroy?.();
    BoardAccessibilityLayerForBoardRenderer = null;
  }

  function resetSession(): void {
    BoardInputDeferredOverlayRenderGenerationForBoardRenderer += 1;
    BoardInputDeferredOverlayRenderForBoardRenderer = null;
    BoardInputOverlayRenderSuppressedForBoardRenderer = true;
    try {
      BoardInputKeyboardCursorKeyForBoardRenderer = null;
      BoardPresentationPreviewHintsForBoardRenderer = Object.freeze([]);
      BoardInputControllerForBoardRenderer?.reset?.();
      BoardAccessibilityLayerForBoardRenderer?.clear?.();
    } finally {
      BoardInputOverlayRenderSuppressedForBoardRenderer = false;
    }
  }

  function destroyPageRuntime(): void {
    replaceController();
    BoardInputControllerForBoardRenderer?.destroy?.();
    BoardInputControllerForBoardRenderer = null;
    BoardInputLockResolverForBoardRenderer = null;
    BoardInputKeyboardCursorKeyForBoardRenderer = null;
    BoardPresentationPreviewHintsForBoardRenderer = Object.freeze([]);
  }

  return Object.freeze({
    getController: getBoardInputController,
    activate: activateBoardInputController,
    deactivate: deactivateBoardInputController,
    setPreviewHints: setBoardPresentationPreviewHints,
    subscribeSettledFrame: _subscribeSettledBoardInputForBoardRenderer,
    getFrameInputs,
    replaceController,
    resetSession,
    destroyPageRuntime
  });
}
