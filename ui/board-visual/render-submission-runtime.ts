export interface BoardRenderSubmissionRuntimeDependencies {
  getController(): any;
  shouldDeferRenderForPlayback(): boolean;
  writerRuntime: {
    preparePlaybackOwnership(controller: any, playbackDeferred: boolean): any;
    checkInvalidation(controller: any): any;
  };
  syncTimeStopClass(): void;
  buildFrame(controller: any): any;
  updateOccupancy(): void;
  getPerfBenchmarks?(): any;
}

export interface BoardRenderSubmissionRuntime {
  prepareUpdate(): any;
  render(preparedVisualUpdate?: any): void;
}

export function createBoardRenderSubmissionRuntime(
  dependencies: BoardRenderSubmissionRuntimeDependencies
): BoardRenderSubmissionRuntime {
  if (!dependencies || typeof dependencies.getController !== 'function'
    || typeof dependencies.shouldDeferRenderForPlayback !== 'function'
    || !dependencies.writerRuntime
    || typeof dependencies.writerRuntime.preparePlaybackOwnership !== 'function'
    || typeof dependencies.writerRuntime.checkInvalidation !== 'function'
    || typeof dependencies.syncTimeStopClass !== 'function'
    || typeof dependencies.buildFrame !== 'function'
    || typeof dependencies.updateOccupancy !== 'function') {
    throw new Error('Board render-submission runtime dependencies are incomplete');
  }

  const preparedUpdates = new WeakSet<object>();

  function retainPrepared(value: any): any {
    preparedUpdates.add(value);
    return value;
  }

  function prepareUpdate() {
    const controller = dependencies.getController();
    if (!controller) return null;
    const playbackDeferred = dependencies.shouldDeferRenderForPlayback();
    const ownership = dependencies.writerRuntime.preparePlaybackOwnership(
      controller,
      playbackDeferred
    );
    if (ownership?.deferredUntilAutoWriter === true) {
      return retainPrepared(Object.freeze({
        controller,
        playbackDeferred,
        deferredUntilAutoWriter: true
      }));
    }

    dependencies.syncTimeStopClass();
    const invalidation = dependencies.writerRuntime.checkInvalidation(controller);
    if (invalidation?.invalidated === true) {
      return retainPrepared(Object.freeze({
        controller,
        playbackDeferred,
        invalidated: true
      }));
    }

    return retainPrepared(Object.freeze({
      controller,
      playbackDeferred,
      frame: dependencies.buildFrame(controller)
    }));
  }

  function render(preparedVisualUpdate?: any): void {
    const perfBenchmarks = dependencies.getPerfBenchmarks?.();
    if (perfBenchmarks) perfBenchmarks.perfStart('renderBoard');
    try {
      const prepared = preparedVisualUpdate
        && preparedUpdates.has(preparedVisualUpdate)
        ? preparedVisualUpdate
        : prepareUpdate();
      if (prepared) preparedUpdates.delete(prepared);
      const controller = prepared && prepared.controller;
      if (!controller) {
        console.error('[Board Renderer] board visual controller unavailable; rendering skipped');
        return;
      }
      if (prepared.deferredUntilAutoWriter === true || prepared.invalidated === true) return;
      const playbackDeferred = prepared.playbackDeferred === true;
      const applied = controller.submitFrame(prepared.frame);
      if (
        applied === true
        || (
          !playbackDeferred
          && typeof controller.getMode === 'function'
          && controller.getMode() === 'idle'
        )
      ) {
        dependencies.updateOccupancy();
      }
    } finally {
      if (perfBenchmarks) perfBenchmarks.perfEnd('renderBoard');
    }
  }

  return Object.freeze({ prepareUpdate, render });
}
