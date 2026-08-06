declare const __non_webpack_require__: NodeRequire | undefined;

const _require: NodeRequire = (typeof __non_webpack_require__ !== 'undefined')
  ? __non_webpack_require__
  : require;

export interface BoardWriterRuntimeDependencies {
  getController(): any;
  getNextFrameSerial(): number;
  shouldDeferRenderForPlayback(): boolean;
  renderBoard(): void;
  buildFrame(controller: any, baseVisualStateOverride?: any): any;
  getRenderStateSource(): any;
  updateOccupancy(): void;
}

export interface BoardWriterSubmissionDecision {
  readonly deferredUntilAutoWriter?: true;
  readonly invalidated?: true;
}

export interface BoardWriterRuntime {
  preparePlaybackOwnership(controller: any, playbackDeferred: boolean): BoardWriterSubmissionDecision;
  checkInvalidation(controller: any): BoardWriterSubmissionDecision;
  getControllerReady(): Promise<void>;
  getControllerReadyForPresentationDrain(): Promise<void>;
  claim(frameToken: string, mode?: 'local' | 'network'): any;
  release(token: any, finalFrame?: any): any;
  playPhase(token: any, events: readonly unknown[], phaseScope?: any): Promise<any>;
  validatePhase(events: readonly unknown[], phaseScope?: any, strictNetworkPlayback?: boolean): Promise<void>;
  getCellClientRect(row: number, col: number): any;
  abortBeforeHandoff(token: any, checkpoint?: any): Promise<any>;
  cancelAfterHandoff(token: any, checkpoint?: any): Promise<any>;
  settle(token: any): Promise<any>;
  beginFrameCommit(token: any): any;
  applyCommittedFrame(token: any, receipt?: any): Promise<boolean>;
  enterRecovery(token: any, error?: unknown): any;
  settleAutoWriter(): Promise<boolean>;
  getInvalidationDiagnostics(): any;
  resetSession(): void;
  replaceController(): void;
  destroyPageRuntime(): void;
}

export function createBoardWriterRuntime(dependencies: BoardWriterRuntimeDependencies): BoardWriterRuntime {
  if (!dependencies || typeof dependencies.getController !== 'function'
    || typeof dependencies.getNextFrameSerial !== 'function'
    || typeof dependencies.shouldDeferRenderForPlayback !== 'function'
    || typeof dependencies.renderBoard !== 'function'
    || typeof dependencies.buildFrame !== 'function'
    || typeof dependencies.getRenderStateSource !== 'function'
    || typeof dependencies.updateOccupancy !== 'function') {
    throw new Error('Board writer runtime dependencies are incomplete');
  }

  let AutoBoardWriterTokenForBoardRenderer: any = null;
  let AutoBoardWriterClaimForBoardRenderer: Promise<any> | null = null;
  let AutoBoardWriterSettlementForBoardRenderer: Promise<boolean> | null = null;
  let AutoBoardWriterClaimGenerationForBoardRenderer = 0;
  let AutoBoardWriterDeferredRenderRequestedForBoardRenderer = false;
  const BoardVisualInvalidationAccumulatorForBoardRenderer = (() => {
    const module = _require('./invalidation-accumulator');
    return module.createBoardVisualInvalidationAccumulator();
  })();

  function _buildFinalBoardVisualFrameForWriter(controller: any, token: any) {
    BoardVisualInvalidationAccumulatorForBoardRenderer.recordFinalFrameBuild(token);
    return dependencies.buildFrame(controller);
  }

  function _requestAutoBoardVisualWriterForBoardRenderer(
      controller: any,
      requestFreshRender = false
  ): Promise<any> {
      if (requestFreshRender) AutoBoardWriterDeferredRenderRequestedForBoardRenderer = true;
      if (AutoBoardWriterTokenForBoardRenderer) {
          return Promise.resolve(AutoBoardWriterTokenForBoardRenderer);
      }
      if (AutoBoardWriterClaimForBoardRenderer) return AutoBoardWriterClaimForBoardRenderer;
      const generation = AutoBoardWriterClaimGenerationForBoardRenderer;
      const claim = (async () => {
          if (typeof controller.waitForIdle === 'function') await controller.waitForIdle();
          if (generation !== AutoBoardWriterClaimGenerationForBoardRenderer) return null;
          if (dependencies.getController() !== controller) return null;
          let token = AutoBoardWriterTokenForBoardRenderer;
          if (
              !token
              && (typeof controller.getMode !== 'function' || controller.getMode() === 'idle')
              && dependencies.shouldDeferRenderForPlayback()
          ) {
              token = controller.claimWriter(
                  `legacy-playback:${dependencies.getNextFrameSerial()}`,
                  'local'
              );
              AutoBoardWriterTokenForBoardRenderer = token;
          }
          if (AutoBoardWriterDeferredRenderRequestedForBoardRenderer) {
              AutoBoardWriterDeferredRenderRequestedForBoardRenderer = false;
              // Re-read canonical presentation state only after ownership is
              // safe. Never retain or replay the pre-settlement prepared frame.
              dependencies.renderBoard();
          }
          return token;
      })();
      AutoBoardWriterClaimForBoardRenderer = claim;
      const clear = () => {
          if (AutoBoardWriterClaimForBoardRenderer === claim) {
              AutoBoardWriterClaimForBoardRenderer = null;
          }
      };
      const fail = () => {
          if (generation === AutoBoardWriterClaimGenerationForBoardRenderer) {
              AutoBoardWriterDeferredRenderRequestedForBoardRenderer = false;
          }
          clear();
      };
      void claim.then(clear, fail);
      return claim;
  }

  async function getBoardVisualControllerReady() {
      const controller = dependencies.getController();
      if (!controller) return Promise.reject(new Error('Board visual controller is unavailable'));
      if (typeof controller.waitUntilReady === 'function') await controller.waitUntilReady();
      else await (controller.ready || Promise.resolve());
      // A forced canonical snapshot can leave a synthetic local writer settling
      // while its presentation frame is already queued for strict network
      // playback. Do not let the strict writer reclaim that token until the
      // asynchronous local settlement has released it; otherwise the stale
      // settlement can release the newly reclaimed network writer.
      if (
          AutoBoardWriterSettlementForBoardRenderer
          || AutoBoardWriterTokenForBoardRenderer
          || AutoBoardWriterClaimForBoardRenderer
      ) {
          await settleAutoBoardVisualWriter();
      }
      if (
          typeof controller.waitForIdle === 'function'
          && (typeof controller.getMode !== 'function' || controller.getMode() === 'idle')
      ) {
          await controller.waitForIdle();
      }
  }

  async function getBoardVisualControllerReadyForPresentationDrain() {
      const controller = dependencies.getController();
      if (!controller) return Promise.reject(new Error('Board visual controller is unavailable'));
      if (typeof controller.waitUntilReady === 'function') await controller.waitUntilReady();
      else await (controller.ready || Promise.resolve());
      // A render triggered by PLAYBACK_EVENTS may already own a synthetic local
      // writer. The presentation drain must reclaim that writer without first
      // applying the final canonical frame that it was created to defer.
      if (!AutoBoardWriterTokenForBoardRenderer && AutoBoardWriterClaimForBoardRenderer) {
          await AutoBoardWriterClaimForBoardRenderer;
      }
      if (
          !AutoBoardWriterTokenForBoardRenderer
          && !AutoBoardWriterClaimForBoardRenderer
          && typeof controller.waitForIdle === 'function'
          && (typeof controller.getMode !== 'function' || controller.getMode() === 'idle')
      ) {
          await controller.waitForIdle();
      }
  }

  function claimBoardVisualWriter(frameToken: string, mode: 'local' | 'network' = 'local') {
      const controller = dependencies.getController();
      if (!controller) throw new Error('Board visual controller is unavailable');
      if (AutoBoardWriterTokenForBoardRenderer) {
          const previousToken = AutoBoardWriterTokenForBoardRenderer;
          const adopted = controller.reclaimWriter(previousToken, frameToken, mode);
          BoardVisualInvalidationAccumulatorForBoardRenderer.rebind(previousToken, adopted);
          AutoBoardWriterTokenForBoardRenderer = null;
          return adopted;
      }
      return controller.claimWriter(frameToken, mode);
  }

  function releaseBoardVisualWriter(token: any, finalFrame?: any) {
      const controller = dependencies.getController();
      if (!controller) throw new Error('Board visual controller is unavailable');
      const released = controller.releaseWriter(token, finalFrame);
      if (released === true) BoardVisualInvalidationAccumulatorForBoardRenderer.settle(token);
      return released;
  }

  async function playBoardVisualPhase(token: any, events: readonly unknown[], phaseScope?: any) {
      const controller = dependencies.getController();
      if (!controller || typeof controller.playPhase !== 'function') {
          throw new Error('Board visual controller cannot play a presentation phase');
      }
      return controller.playPhase(token, events, phaseScope);
  }

  async function validateBoardVisualPhase(
      events: readonly unknown[],
      phaseScope?: any,
      strictNetworkPlayback = false
  ) {
      const controller = dependencies.getController();
      if (!controller) throw new Error('Board visual controller is unavailable');
      if (typeof controller.waitUntilReady === 'function') await controller.waitUntilReady();
      else await (controller.ready || Promise.resolve());
      if (typeof controller.validatePhase !== 'function') return;
      await controller.validatePhase(events, strictNetworkPlayback === true, phaseScope);
  }

  function getBoardCellClientRect(row: number, col: number) {
      const controller = dependencies.getController();
      if (!controller || typeof controller.getCellClientRect !== 'function') return null;
      return controller.getCellClientRect(row, col);
  }

  async function abortBoardVisualWriterBeforeHandoff(token: any, checkpoint?: any) {
      const controller = dependencies.getController();
      if (!controller || typeof controller.abortWriterBeforeHandoff !== 'function') {
          throw new Error('Board visual controller cannot abort a writer before handoff');
      }
      const aborted = await controller.abortWriterBeforeHandoff(token, checkpoint);
      if (aborted === true) BoardVisualInvalidationAccumulatorForBoardRenderer.discard(token);
      return aborted;
  }

  async function cancelBoardVisualWriterAfterHandoff(token: any, checkpoint?: any) {
      const controller = dependencies.getController();
      if (!controller || typeof controller.cancelWriterAfterHandoff !== 'function') {
          throw new Error('Board visual controller cannot cancel a writer after handoff');
      }
      if (typeof controller.getActiveWriterToken !== 'function' || controller.getActiveWriterToken() !== token) {
          throw new Error('Board visual cancel token does not own the active frame');
      }
      const cancelled = await controller.cancelWriterAfterHandoff(token, checkpoint);
      if (cancelled === true) BoardVisualInvalidationAccumulatorForBoardRenderer.discard(token);
      return cancelled;
  }

  async function settleBoardVisualWriter(token: any) {
      const controller = dependencies.getController();
      if (!controller) throw new Error('Board visual controller is unavailable');
      if (typeof controller.settleLocalWriter === 'function') {
          const finalFrame = _buildFinalBoardVisualFrameForWriter(controller, token);
          BoardVisualInvalidationAccumulatorForBoardRenderer.recordFinalFrameSubmit(token);
          const settled = await controller.settleLocalWriter(token, finalFrame);
          if (settled === true) {
              BoardVisualInvalidationAccumulatorForBoardRenderer.settle(token);
              dependencies.updateOccupancy();
          }
          return settled;
      }
      // Compatibility for an injected/older controller. Runtime controllers
      // use the async path above so writer and PlaybackState ownership remain
      // claimed through resource preparation and visual settlement.
      if (controller.getMode && controller.getMode() === 'recovering') {
          await controller.restore();
      } else {
          const finalFrame = _buildFinalBoardVisualFrameForWriter(controller, token);
          BoardVisualInvalidationAccumulatorForBoardRenderer.recordFinalFrameSubmit(token);
          const released = controller.releaseWriter(token, finalFrame);
          if (released === true) {
              BoardVisualInvalidationAccumulatorForBoardRenderer.settle(token);
              dependencies.updateOccupancy();
          }
          return released;
      }
      const released = controller.releaseWriter(token);
      if (released === true) BoardVisualInvalidationAccumulatorForBoardRenderer.settle(token);
      return released;
  }

  function beginBoardVisualFrameCommit(token: any) {
      const controller = dependencies.getController();
      if (!controller) throw new Error('Board visual controller is unavailable');
      return controller.beginAwaitingFrameCommit(token);
  }

  async function applyCommittedBoardVisualFrame(token: any, receipt?: any) {
      const controller = dependencies.getController();
      if (!controller) throw new Error('Board visual controller is unavailable');
      if (
          receipt
          && (
              receipt.kind !== 'network-visual-commit'
              || receipt.visualSeq !== Number(String(token && token.frameToken || '').split(':').pop())
          )
      ) {
          throw new Error('Committed board visual receipt does not match the writer token');
      }
      const committedSnapshot = dependencies.getRenderStateSource()
          .resolveReceiptBoundPair(receipt);
      BoardVisualInvalidationAccumulatorForBoardRenderer.recordFinalFrameBuild(token);
      const frame = dependencies.buildFrame(controller, committedSnapshot);
      BoardVisualInvalidationAccumulatorForBoardRenderer.recordFinalFrameSubmit(token);
      let applied: boolean;
      if (controller.getMode && controller.getMode() === 'recovering') {
          if (typeof controller.restoreCommittedFrame !== 'function') {
              throw new Error('Board visual controller cannot restore a committed frame');
          }
          applied = await controller.restoreCommittedFrame(token, frame);
      } else {
          applied = await controller.applyCommittedFrame(token, frame);
      }
      if (applied === true) BoardVisualInvalidationAccumulatorForBoardRenderer.settle(token);
      return applied;
  }

  function enterBoardVisualRecovery(token: any, error?: unknown) {
      const controller = dependencies.getController();
      if (!controller) throw new Error('Board visual controller is unavailable');
      if (typeof controller.getActiveWriterToken !== 'function' || controller.getActiveWriterToken() !== token) {
          throw new Error('Board visual recovery token does not own the active frame');
      }
      if (
          typeof controller.getActiveFrameToken !== 'function'
          || controller.getActiveFrameToken() !== String(token && token.frameToken || '')
      ) {
          throw new Error('Board visual recovery frame token does not match the active frame');
      }
      return controller.enterRecovery(token, error);
  }

  async function settleAutoBoardVisualWriter(): Promise<boolean> {
      if (AutoBoardWriterSettlementForBoardRenderer) return AutoBoardWriterSettlementForBoardRenderer;
      const controller = dependencies.getController();
      if (!controller) return false;
      const settlement = (async () => {
          if (!AutoBoardWriterTokenForBoardRenderer && AutoBoardWriterClaimForBoardRenderer) {
              await AutoBoardWriterClaimForBoardRenderer;
          }
          if (!AutoBoardWriterTokenForBoardRenderer) return false;
          const token = AutoBoardWriterTokenForBoardRenderer;
          const finalFrame = _buildFinalBoardVisualFrameForWriter(controller, token);
          if (AutoBoardWriterTokenForBoardRenderer !== token) return true;
          BoardVisualInvalidationAccumulatorForBoardRenderer.recordFinalFrameSubmit(token);
          if (typeof controller.settleLocalWriter === 'function') {
              await controller.settleLocalWriter(token, finalFrame);
          } else {
              controller.releaseWriter(token, finalFrame);
          }
          if (AutoBoardWriterTokenForBoardRenderer === token) {
              AutoBoardWriterTokenForBoardRenderer = null;
          }
          BoardVisualInvalidationAccumulatorForBoardRenderer.settle(token);
          dependencies.updateOccupancy();
          return true;
      })();
      AutoBoardWriterSettlementForBoardRenderer = settlement;
      try {
          return await settlement;
      } finally {
          if (AutoBoardWriterSettlementForBoardRenderer === settlement) {
              AutoBoardWriterSettlementForBoardRenderer = null;
          }
      }
  }

  function preparePlaybackOwnership(
    controller: any,
    playbackDeferred: boolean
  ): BoardWriterSubmissionDecision {
    if (playbackDeferred && controller.getMode() === 'idle') {
      const idleSettlementPending = typeof controller.isIdleSettlementPending === 'function'
        && controller.isIdleSettlementPending() === true;
      if (idleSettlementPending) {
        void _requestAutoBoardVisualWriterForBoardRenderer(controller, true);
        return Object.freeze({ deferredUntilAutoWriter: true });
      }
      if (!AutoBoardWriterTokenForBoardRenderer) {
        AutoBoardWriterTokenForBoardRenderer = controller.claimWriter(
          `legacy-playback:${dependencies.getNextFrameSerial()}`,
          'local'
        );
      }
      AutoBoardWriterDeferredRenderRequestedForBoardRenderer = false;
    }
    return Object.freeze({});
  }

  function checkInvalidation(controller: any): BoardWriterSubmissionDecision {
    const activeWriterToken = typeof controller.getActiveWriterToken === 'function'
      ? controller.getActiveWriterToken()
      : AutoBoardWriterTokenForBoardRenderer;
    if (activeWriterToken && controller.getMode() !== 'idle') {
      BoardVisualInvalidationAccumulatorForBoardRenderer.mark(activeWriterToken, 'render-request');
      return Object.freeze({ invalidated: true });
    }
    return Object.freeze({});
  }

  function resetSession(): void {
    BoardVisualInvalidationAccumulatorForBoardRenderer.reset();
  }

  function replaceController(): void {
    AutoBoardWriterClaimGenerationForBoardRenderer += 1;
    AutoBoardWriterTokenForBoardRenderer = null;
    AutoBoardWriterClaimForBoardRenderer = null;
    AutoBoardWriterSettlementForBoardRenderer = null;
    AutoBoardWriterDeferredRenderRequestedForBoardRenderer = false;
    BoardVisualInvalidationAccumulatorForBoardRenderer.reset();
  }

  function destroyPageRuntime(): void {
    replaceController();
  }

  return Object.freeze({
    preparePlaybackOwnership,
    checkInvalidation,
    getControllerReady: getBoardVisualControllerReady,
    getControllerReadyForPresentationDrain: getBoardVisualControllerReadyForPresentationDrain,
    claim: claimBoardVisualWriter,
    release: releaseBoardVisualWriter,
    playPhase: playBoardVisualPhase,
    validatePhase: validateBoardVisualPhase,
    getCellClientRect: getBoardCellClientRect,
    abortBeforeHandoff: abortBoardVisualWriterBeforeHandoff,
    cancelAfterHandoff: cancelBoardVisualWriterAfterHandoff,
    settle: settleBoardVisualWriter,
    beginFrameCommit: beginBoardVisualFrameCommit,
    applyCommittedFrame: applyCommittedBoardVisualFrame,
    enterRecovery: enterBoardVisualRecovery,
    settleAutoWriter: settleAutoBoardVisualWriter,
    getInvalidationDiagnostics: () => BoardVisualInvalidationAccumulatorForBoardRenderer.getDiagnostics(),
    resetSession,
    replaceController,
    destroyPageRuntime
  });
}
