declare const __non_webpack_require__: NodeRequire | undefined;

import type { BoardVisualCommitReceipt } from './types';

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

export interface AutoBoardWriterSettlementOptions {
  readonly abandonPresentationDrain?: boolean;
}

interface PostResetBoardRenderRecovery {
  readonly generation: number;
  pending: boolean;
  failed: boolean;
  error: unknown;
  promise: Promise<void>;
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
  applyCommittedFrame(token: any, receipt: BoardVisualCommitReceipt): Promise<boolean>;
  enterRecovery(token: any, error?: unknown): any;
  settleAutoWriter(options?: AutoBoardWriterSettlementOptions): Promise<boolean>;
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
  let BoardVisualControllerLifecycleGenerationForBoardRenderer = 0;
  let AutoBoardWriterDeferredRenderRequestedForBoardRenderer = false;
  let PresentationDrainReadinessRequestsForBoardRenderer = 0;
  let AutoBoardWriterReservedForPresentationDrainForBoardRenderer = false;
  let PostResetBoardRenderRecoveryForBoardRenderer: PostResetBoardRenderRecovery | null = null;
  let BoardVisualPageRuntimeDestroyedForBoardRenderer = false;
  const BoardVisualInvalidationAccumulatorForBoardRenderer = (() => {
    const module = _require('./invalidation-accumulator');
    return module.createBoardVisualInvalidationAccumulator();
  })();

  function _createBoardVisualPageRuntimeDestroyedError(): Error {
    return new Error('Board visual page runtime is destroyed');
  }

  function _isBoardVisualControllerSnapshotCurrent(
    controller: any,
    controllerGeneration: number
  ): boolean {
    return !BoardVisualPageRuntimeDestroyedForBoardRenderer
      && controllerGeneration === BoardVisualControllerLifecycleGenerationForBoardRenderer
      && dependencies.getController() === controller;
  }

  function _isBoardVisualReadinessSnapshotCurrent(
    controller: any,
    controllerGeneration: number,
    writerGeneration: number
  ): boolean {
    return _isBoardVisualControllerSnapshotCurrent(controller, controllerGeneration)
      && writerGeneration === AutoBoardWriterClaimGenerationForBoardRenderer;
  }

  function _schedulePostResetBoardRenderRecovery(
    settlement: Promise<unknown>,
    generation: number
  ): void {
    const recovery: PostResetBoardRenderRecovery = {
      generation,
      pending: true,
      failed: false,
      error: null,
      promise: Promise.resolve()
    };
    recovery.promise = settlement.then(
      () => undefined,
      () => undefined
    ).then(() => Promise.resolve()).then(() => {
      if (
        BoardVisualPageRuntimeDestroyedForBoardRenderer
        || generation !== AutoBoardWriterClaimGenerationForBoardRenderer
      ) return;
      dependencies.renderBoard();
    });
    PostResetBoardRenderRecoveryForBoardRenderer = recovery;
    void recovery.promise.then(
      () => { recovery.pending = false; },
      (error) => {
        recovery.pending = false;
        recovery.failed = true;
        recovery.error = error;
      }
    );
  }

  function _buildFinalBoardVisualFrameForWriter(controller: any, token: any) {
    BoardVisualInvalidationAccumulatorForBoardRenderer.recordFinalFrameBuild(token);
    return dependencies.buildFrame(controller);
  }

  function _requestAutoBoardVisualWriterForBoardRenderer(
      controller: any,
      requestFreshRender = false
  ): Promise<any> {
      if (BoardVisualPageRuntimeDestroyedForBoardRenderer) {
          return Promise.reject(_createBoardVisualPageRuntimeDestroyedError());
      }
      if (requestFreshRender) AutoBoardWriterDeferredRenderRequestedForBoardRenderer = true;
      if (AutoBoardWriterTokenForBoardRenderer) {
          return Promise.resolve(AutoBoardWriterTokenForBoardRenderer);
      }
      if (AutoBoardWriterClaimForBoardRenderer) return AutoBoardWriterClaimForBoardRenderer;
      const generation = AutoBoardWriterClaimGenerationForBoardRenderer;
      const claim = (async () => {
          if (typeof controller.waitForIdle === 'function') await controller.waitForIdle();
          if (
              BoardVisualPageRuntimeDestroyedForBoardRenderer
              || generation !== AutoBoardWriterClaimGenerationForBoardRenderer
          ) return null;
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
      while (true) {
          if (BoardVisualPageRuntimeDestroyedForBoardRenderer) {
              throw _createBoardVisualPageRuntimeDestroyedError();
          }
          const controller = dependencies.getController();
          if (!controller) throw new Error('Board visual controller is unavailable');
          const controllerGeneration = BoardVisualControllerLifecycleGenerationForBoardRenderer;
          const writerGeneration = AutoBoardWriterClaimGenerationForBoardRenderer;
          try {
              if (typeof controller.waitUntilReady === 'function') await controller.waitUntilReady();
              else await (controller.ready || Promise.resolve());
          } catch (error) {
              if (BoardVisualPageRuntimeDestroyedForBoardRenderer) {
                  throw _createBoardVisualPageRuntimeDestroyedError();
              }
              if (!_isBoardVisualReadinessSnapshotCurrent(controller, controllerGeneration, writerGeneration)) continue;
              throw error;
          }
          if (!_isBoardVisualReadinessSnapshotCurrent(controller, controllerGeneration, writerGeneration)) continue;
          // A forced canonical snapshot can leave a synthetic local writer settling
          // while its presentation frame is already queued for strict network
          // playback. Do not let the strict writer reclaim that token until the
          // asynchronous local settlement has released it; otherwise the stale
          // settlement can release the newly reclaimed network writer.
          if (AutoBoardWriterSettlementForBoardRenderer) {
              try {
                  await AutoBoardWriterSettlementForBoardRenderer;
              } catch (error) {
                  if (!_isBoardVisualReadinessSnapshotCurrent(controller, controllerGeneration, writerGeneration)) continue;
                  throw error;
              }
              if (!_isBoardVisualReadinessSnapshotCurrent(controller, controllerGeneration, writerGeneration)) continue;
          } else if (
              PresentationDrainReadinessRequestsForBoardRenderer === 0
              && !AutoBoardWriterReservedForPresentationDrainForBoardRenderer
              && (AutoBoardWriterTokenForBoardRenderer || AutoBoardWriterClaimForBoardRenderer)
          ) {
              try {
                  await settleAutoBoardVisualWriter();
              } catch (error) {
                  if (!_isBoardVisualReadinessSnapshotCurrent(controller, controllerGeneration, writerGeneration)) continue;
                  throw error;
              }
              if (!_isBoardVisualReadinessSnapshotCurrent(controller, controllerGeneration, writerGeneration)) continue;
          }
          const postResetRecovery = PostResetBoardRenderRecoveryForBoardRenderer;
          if (postResetRecovery && postResetRecovery.generation === writerGeneration) {
              try {
                  await postResetRecovery.promise;
              } catch (error) {
                  if (!_isBoardVisualReadinessSnapshotCurrent(controller, controllerGeneration, writerGeneration)) continue;
                  throw error;
              }
              if (!_isBoardVisualReadinessSnapshotCurrent(controller, controllerGeneration, writerGeneration)) continue;
              if (PostResetBoardRenderRecoveryForBoardRenderer === postResetRecovery) {
                  PostResetBoardRenderRecoveryForBoardRenderer = null;
              }
          }
          if (
              typeof controller.waitForIdle === 'function'
              && (typeof controller.getMode !== 'function' || controller.getMode() === 'idle')
          ) {
              try {
                  await controller.waitForIdle();
              } catch (error) {
                  if (BoardVisualPageRuntimeDestroyedForBoardRenderer) {
                      throw _createBoardVisualPageRuntimeDestroyedError();
                  }
                  if (!_isBoardVisualReadinessSnapshotCurrent(controller, controllerGeneration, writerGeneration)) continue;
                  throw error;
              }
              if (!_isBoardVisualReadinessSnapshotCurrent(controller, controllerGeneration, writerGeneration)) continue;
          }
          return;
      }
  }

  async function getBoardVisualControllerReadyForPresentationDrain() {
      PresentationDrainReadinessRequestsForBoardRenderer += 1;
      let preserveSyntheticWriter = false;
      try {
          while (true) {
              if (BoardVisualPageRuntimeDestroyedForBoardRenderer) {
                  throw _createBoardVisualPageRuntimeDestroyedError();
              }
              const controller = dependencies.getController();
              if (!controller) throw new Error('Board visual controller is unavailable');
              const controllerGeneration = BoardVisualControllerLifecycleGenerationForBoardRenderer;
              const writerGeneration = AutoBoardWriterClaimGenerationForBoardRenderer;
              try {
                  if (typeof controller.waitUntilReady === 'function') await controller.waitUntilReady();
                  else await (controller.ready || Promise.resolve());
              } catch (error) {
                  if (BoardVisualPageRuntimeDestroyedForBoardRenderer) {
                      throw _createBoardVisualPageRuntimeDestroyedError();
                  }
                  if (!_isBoardVisualReadinessSnapshotCurrent(controller, controllerGeneration, writerGeneration)) continue;
                  throw error;
              }
              if (!_isBoardVisualReadinessSnapshotCurrent(controller, controllerGeneration, writerGeneration)) continue;
              if (AutoBoardWriterSettlementForBoardRenderer) {
                  try {
                      await AutoBoardWriterSettlementForBoardRenderer;
                  } catch (error) {
                      if (!_isBoardVisualReadinessSnapshotCurrent(controller, controllerGeneration, writerGeneration)) continue;
                      throw error;
                  }
                  if (!_isBoardVisualReadinessSnapshotCurrent(controller, controllerGeneration, writerGeneration)) continue;
              }
              const postResetRecovery = PostResetBoardRenderRecoveryForBoardRenderer;
              if (postResetRecovery && postResetRecovery.generation === writerGeneration) {
                  try {
                      await postResetRecovery.promise;
                  } catch (error) {
                      if (!_isBoardVisualReadinessSnapshotCurrent(controller, controllerGeneration, writerGeneration)) continue;
                      throw error;
                  }
                  if (!_isBoardVisualReadinessSnapshotCurrent(controller, controllerGeneration, writerGeneration)) continue;
                  if (PostResetBoardRenderRecoveryForBoardRenderer === postResetRecovery) {
                      PostResetBoardRenderRecoveryForBoardRenderer = null;
                  }
              }
              // A render triggered by PLAYBACK_EVENTS may already own a synthetic local
              // writer. The presentation drain must reclaim that writer without first
              // applying the final canonical frame that it was created to defer.
              if (!AutoBoardWriterTokenForBoardRenderer && AutoBoardWriterClaimForBoardRenderer) {
                  try {
                      await AutoBoardWriterClaimForBoardRenderer;
                  } catch (error) {
                      if (!_isBoardVisualReadinessSnapshotCurrent(controller, controllerGeneration, writerGeneration)) continue;
                      throw error;
                  }
                  if (!_isBoardVisualReadinessSnapshotCurrent(controller, controllerGeneration, writerGeneration)) continue;
              }
              if (
                  !AutoBoardWriterTokenForBoardRenderer
                  && !AutoBoardWriterClaimForBoardRenderer
                  && typeof controller.waitForIdle === 'function'
                  && (typeof controller.getMode !== 'function' || controller.getMode() === 'idle')
              ) {
                  try {
                      await controller.waitForIdle();
                  } catch (error) {
                      if (BoardVisualPageRuntimeDestroyedForBoardRenderer) {
                          throw _createBoardVisualPageRuntimeDestroyedError();
                      }
                      if (!_isBoardVisualReadinessSnapshotCurrent(controller, controllerGeneration, writerGeneration)) continue;
                      throw error;
                  }
                  if (!_isBoardVisualReadinessSnapshotCurrent(controller, controllerGeneration, writerGeneration)) continue;
              }
              preserveSyntheticWriter = !!AutoBoardWriterTokenForBoardRenderer;
              if (preserveSyntheticWriter) {
                  AutoBoardWriterReservedForPresentationDrainForBoardRenderer = true;
              }
              return;
          }
      } finally {
          PresentationDrainReadinessRequestsForBoardRenderer = Math.max(
              0,
              PresentationDrainReadinessRequestsForBoardRenderer - 1
          );
      }
  }

  function claimBoardVisualWriter(frameToken: string, mode: 'local' | 'network' = 'local') {
      if (BoardVisualPageRuntimeDestroyedForBoardRenderer) {
          throw _createBoardVisualPageRuntimeDestroyedError();
      }
      if (AutoBoardWriterSettlementForBoardRenderer) {
          throw new Error('Cannot claim board visual writer while synthetic settlement is active');
      }
      const postResetRecovery = PostResetBoardRenderRecoveryForBoardRenderer;
      if (
          postResetRecovery
          && postResetRecovery.generation === AutoBoardWriterClaimGenerationForBoardRenderer
      ) {
          if (postResetRecovery.pending) {
              throw new Error('Cannot claim board visual writer before post-reset render recovery');
          }
          if (postResetRecovery.failed) throw postResetRecovery.error;
          PostResetBoardRenderRecoveryForBoardRenderer = null;
      }
      const controller = dependencies.getController();
      if (!controller) throw new Error('Board visual controller is unavailable');
      if (AutoBoardWriterTokenForBoardRenderer) {
          const previousToken = AutoBoardWriterTokenForBoardRenderer;
          if (typeof controller.reclaimWriter !== 'function') {
              throw new Error('Board visual controller cannot reclaim synthetic writer ownership');
          }
          const adopted = controller.reclaimWriter(previousToken, frameToken, mode);
          BoardVisualInvalidationAccumulatorForBoardRenderer.rebind(previousToken, adopted);
          AutoBoardWriterTokenForBoardRenderer = null;
          AutoBoardWriterReservedForPresentationDrainForBoardRenderer = false;
          return adopted;
      }
      const token = controller.claimWriter(frameToken, mode);
      AutoBoardWriterReservedForPresentationDrainForBoardRenderer = false;
      return token;
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

  async function applyCommittedBoardVisualFrame(token: any, receipt: BoardVisualCommitReceipt) {
      const controller = dependencies.getController();
      if (!controller) throw new Error('Board visual controller is unavailable');
      if (
          !receipt
          || receipt.kind !== 'network-visual-commit'
          || receipt.visualSeq !== Number(String(token && token.frameToken || '').split(':').pop())
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

  async function settleAutoBoardVisualWriter(
      options: AutoBoardWriterSettlementOptions = {}
  ): Promise<boolean> {
      if (AutoBoardWriterSettlementForBoardRenderer) return AutoBoardWriterSettlementForBoardRenderer;
      if (PresentationDrainReadinessRequestsForBoardRenderer > 0) return false;
      if (options.abandonPresentationDrain === true) {
          AutoBoardWriterReservedForPresentationDrainForBoardRenderer = false;
      } else if (AutoBoardWriterReservedForPresentationDrainForBoardRenderer) {
          return false;
      }
      if (BoardVisualPageRuntimeDestroyedForBoardRenderer) return false;
      const controller = dependencies.getController();
      if (!controller) return false;
      const controllerGeneration = BoardVisualControllerLifecycleGenerationForBoardRenderer;
      const writerGeneration = AutoBoardWriterClaimGenerationForBoardRenderer;
      const settlement = (async () => {
          if (!AutoBoardWriterTokenForBoardRenderer && AutoBoardWriterClaimForBoardRenderer) {
              await AutoBoardWriterClaimForBoardRenderer;
          }
          if (
              !_isBoardVisualReadinessSnapshotCurrent(
                  controller,
                  controllerGeneration,
                  writerGeneration
              )
          ) return false;
          if (!AutoBoardWriterTokenForBoardRenderer) return false;
          const token = AutoBoardWriterTokenForBoardRenderer;
          const finalFrame = _buildFinalBoardVisualFrameForWriter(controller, token);
          if (AutoBoardWriterTokenForBoardRenderer !== token) return true;
          BoardVisualInvalidationAccumulatorForBoardRenderer.recordFinalFrameSubmit(token);
          try {
              if (typeof controller.settleLocalWriter === 'function') {
                  await controller.settleLocalWriter(token, finalFrame);
              } else {
                  controller.releaseWriter(token, finalFrame);
              }
          } catch (error) {
              if (!_isBoardVisualControllerSnapshotCurrent(controller, controllerGeneration)) {
                  return false;
              }
              throw error;
          }
          if (!_isBoardVisualControllerSnapshotCurrent(controller, controllerGeneration)) return false;
          if (AutoBoardWriterTokenForBoardRenderer === token) {
              AutoBoardWriterTokenForBoardRenderer = null;
          }
          if (writerGeneration !== AutoBoardWriterClaimGenerationForBoardRenderer) {
              BoardVisualInvalidationAccumulatorForBoardRenderer.discard(token);
              return false;
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
    if (BoardVisualPageRuntimeDestroyedForBoardRenderer) {
      throw _createBoardVisualPageRuntimeDestroyedError();
    }
    if (playbackDeferred && typeof controller.getMode !== 'function') {
      throw new Error('Board visual controller cannot report writer mode for playback ownership');
    }
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
    if (BoardVisualPageRuntimeDestroyedForBoardRenderer) {
      throw _createBoardVisualPageRuntimeDestroyedError();
    }
    const activeWriterToken = typeof controller.getActiveWriterToken === 'function'
      ? controller.getActiveWriterToken()
      : AutoBoardWriterTokenForBoardRenderer;
    if (
      activeWriterToken
      && (typeof controller.getMode !== 'function' || controller.getMode() !== 'idle')
    ) {
      BoardVisualInvalidationAccumulatorForBoardRenderer.mark(activeWriterToken, 'render-request');
      return Object.freeze({ invalidated: true });
    }
    return Object.freeze({});
  }

  function resetSession(): void {
    const activeSettlement = AutoBoardWriterSettlementForBoardRenderer;
    const pendingPostResetRecovery = PostResetBoardRenderRecoveryForBoardRenderer;
    const recoveryBarrier = activeSettlement || (pendingPostResetRecovery && pendingPostResetRecovery.promise);
    AutoBoardWriterClaimGenerationForBoardRenderer += 1;
    const resetGeneration = AutoBoardWriterClaimGenerationForBoardRenderer;
    AutoBoardWriterClaimForBoardRenderer = null;
    AutoBoardWriterDeferredRenderRequestedForBoardRenderer = false;
    PostResetBoardRenderRecoveryForBoardRenderer = null;
    if (PresentationDrainReadinessRequestsForBoardRenderer === 0) {
      AutoBoardWriterReservedForPresentationDrainForBoardRenderer = false;
    }
    BoardVisualInvalidationAccumulatorForBoardRenderer.reset();
    if (recoveryBarrier) {
      _schedulePostResetBoardRenderRecovery(recoveryBarrier, resetGeneration);
    }
  }

  function replaceController(): void {
    AutoBoardWriterClaimGenerationForBoardRenderer += 1;
    BoardVisualControllerLifecycleGenerationForBoardRenderer += 1;
    AutoBoardWriterTokenForBoardRenderer = null;
    AutoBoardWriterClaimForBoardRenderer = null;
    AutoBoardWriterSettlementForBoardRenderer = null;
    AutoBoardWriterDeferredRenderRequestedForBoardRenderer = false;
    AutoBoardWriterReservedForPresentationDrainForBoardRenderer = false;
    PostResetBoardRenderRecoveryForBoardRenderer = null;
    BoardVisualInvalidationAccumulatorForBoardRenderer.reset();
  }

  function destroyPageRuntime(): void {
    BoardVisualPageRuntimeDestroyedForBoardRenderer = true;
    AutoBoardWriterClaimGenerationForBoardRenderer += 1;
    BoardVisualControllerLifecycleGenerationForBoardRenderer += 1;
    AutoBoardWriterTokenForBoardRenderer = null;
    AutoBoardWriterClaimForBoardRenderer = null;
    AutoBoardWriterSettlementForBoardRenderer = null;
    AutoBoardWriterDeferredRenderRequestedForBoardRenderer = false;
    AutoBoardWriterReservedForPresentationDrainForBoardRenderer = false;
    PostResetBoardRenderRecoveryForBoardRenderer = null;
    BoardVisualInvalidationAccumulatorForBoardRenderer.reset();
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
