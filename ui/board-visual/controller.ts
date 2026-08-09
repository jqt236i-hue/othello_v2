import type {
  BoardPlaybackContext,
  BoardPlaybackPhaseScope,
  BoardPlaybackValidationContext,
  BoardVisualBackend,
  BoardVisualFrame,
  BoardWriterMode,
  BoardWriterToken
} from './types';

type ControllerDiagnostics = {
  readonly enabled?: boolean;
  record: (event: string, detail?: unknown) => void;
};
type IdleWaiter = Readonly<{ resolve: () => void; reject: (error: Error) => void }>;
type PendingFramePreparation = Readonly<{
  frame: BoardVisualFrame;
  version: number;
  promise: Promise<void>;
}>;
type LocalWriterSettlement = Readonly<{
  token: BoardWriterToken;
  promise: Promise<boolean>;
}>;
type BoardFramePresentation = Readonly<{
  frame: BoardVisualFrame;
  commit?: () => void;
  rollback?: () => void;
}>;
type ActiveBoardFramePresentation = {
  sourceFrame: BoardVisualFrame;
  presentedFrame: BoardVisualFrame;
  previousFrame: BoardVisualFrame | null;
  commit?: () => void;
  rollback?: () => void;
  state: 'active' | 'committed' | 'rolled-back';
};
type IdleFrameSettlement = {
  sourceFrame: BoardVisualFrame;
  presentation: ActiveBoardFramePresentation;
  version: number;
  lifecycleEpoch: number;
  settled: boolean;
  promise: Promise<void>;
};
type RecoveryFrameSettlement = Readonly<{
  presentation: ActiveBoardFramePresentation;
  consumedPendingFrame: BoardVisualFrame | null;
  consumedPendingVersion: number;
  consumedInitialFrame: BoardVisualFrame | null;
}>;
type WriterPhaseLaunch = Readonly<{
  events: readonly unknown[];
  phaseScope: BoardPlaybackPhaseScope;
}>;
type WriterPhaseGroup = {
  readonly scopeIdentity: object;
  readonly launches: WriterPhaseLaunch[];
};
type ContextRecoveryCycle = Readonly<{
  generation: number;
  returnMode: BoardWriterMode;
  checkpoint: BoardVisualFrame | null;
  phaseGroups: readonly Readonly<{
    scopeIdentity: object;
    launches: readonly WriterPhaseLaunch[];
  }>[];
  promise: Promise<void>;
  resolve: () => void;
  reject: (error: Error) => void;
}>;

const HOST_BACKEND_LEASES = new WeakMap<HTMLElement, object>();

function toError(error: unknown, fallback: string): Error {
  if (error instanceof Error) return error;
  const message = String(error || '').trim();
  return new Error(message || fallback);
}

function computeVisualFrameDigest(frame: BoardVisualFrame | null): string | null {
  if (!frame || !frame.model) return null;
  const StateHash = require('../../shared/state-hash');
  if (!StateHash || typeof StateHash.computeStableHash !== 'function') {
    throw new Error('StateHash.computeStableHash is unavailable for board visual diagnostics');
  }
  const withoutRevision = (value: unknown) => {
    if (!value || typeof value !== 'object') return value;
    const copy: Record<string, unknown> = {};
    for (const key of Object.keys(value as Record<string, unknown>)) {
      if (key !== 'revision') copy[key] = (value as Record<string, unknown>)[key];
    }
    return copy;
  };
  const cells = Array.isArray(frame.model.cells)
    ? frame.model.cells.map((cell: any) => ({
      key: String(cell && cell.key || ''),
      visualSignature: typeof cell?.visualSignature === 'string' ? cell.visualSignature : cell
    })).sort((left, right) => left.key.localeCompare(right.key))
    : [];
  return StateHash.computeStableHash({
    model: {
      boardDigest: frame.model.boardDigest || null,
      topology: frame.model.topology || null,
      keyboardCursorKey: frame.model.keyboardCursorKey || null,
      viewerContext: frame.model.viewerContext || null,
      currentPlayer: frame.model.currentPlayer || null,
      canControlCurrentTurn: frame.model.canControlCurrentTurn === true,
      isHumanTurn: frame.model.isHumanTurn === true,
      cells
    },
    layout: withoutRevision(frame.layout),
    appearance: withoutRevision(frame.appearance),
    theme: withoutRevision(frame.theme)
  });
}

function hasEquivalentVisualFrameContent(
  left: BoardVisualFrame | null,
  right: BoardVisualFrame | null
): boolean {
  if (!left || !right) return false;
  const leftSession = String(left.renderSessionId || '');
  const rightSession = String(right.renderSessionId || '');
  if (!leftSession || leftSession !== rightSession) return false;
  const revisions = [
    [left.model?.visualRevision, right.model?.visualRevision],
    [left.layout?.revision, right.layout?.revision],
    [left.appearance?.revision, right.appearance?.revision],
    [left.theme?.revision, right.theme?.revision]
  ];
  return revisions.every(([leftRevision, rightRevision]) => (
    Number.isFinite(leftRevision)
    && Number.isFinite(rightRevision)
    && leftRevision === rightRevision
  ));
}

function readBackendCountSnapshot(backend: BoardVisualBackend, methodName: string): Readonly<Record<string, number>> {
  const candidate = (backend as any)[methodName];
  if (typeof candidate !== 'function') return Object.freeze({ total: 0 });
  const raw = candidate.call(backend);
  if (Number.isFinite(Number(raw))) {
    return Object.freeze({ total: Math.max(0, Math.trunc(Number(raw))) });
  }
  const counts: Record<string, number> = {};
  if (raw && typeof raw === 'object') {
    const rawRecord = raw as Record<string, unknown>;
    for (const key of Object.keys(rawRecord).sort()) {
      const value = Number(rawRecord[key]);
      if (Number.isFinite(value)) counts[key] = Math.max(0, Math.trunc(value));
    }
  }
  if (!Object.prototype.hasOwnProperty.call(counts, 'total')) counts.total = 0;
  return Object.freeze(counts);
}

function createBoardVisualController(options: {
  backend: BoardVisualBackend;
  diagnostics?: ControllerDiagnostics;
  beginApplyFrame?: (
    frame: BoardVisualFrame,
    context: Readonly<{
      backendKind: BoardVisualBackend['kind'];
      host: HTMLElement | null;
    }>
  ) => BoardFramePresentation | BoardVisualFrame;
}) {
  let backend = options.backend;
  const diagnostics = options.diagnostics || { record() {} };
  let mode: BoardWriterMode = 'idle';
  let ready = false;
  let backendMounted = false;
  let mountPromise: Promise<void> | null = null;
  let host: HTMLElement | null = null;
  let activeToken: BoardWriterToken | null = null;
  let pendingLatest: BoardVisualFrame | null = null;
  let pendingFrameVersion = 0;
  let pendingPreparation: PendingFramePreparation | null = null;
  let pendingPreparationScheduleTicket: object | null = null;
  let localWriterSettlement: LocalWriterSettlement | null = null;
  let initialLatest: BoardVisualFrame | null = null;
  let lastApplied: BoardVisualFrame | null = null;
  let lastSettled: BoardVisualFrame | null = null;
  let writerCheckpoint: BoardVisualFrame | null = null;
  let pendingCommittedRecoveryFrame: BoardVisualFrame | null = null;
  let tokenSequence = 0;
  let recoveryReturnMode: BoardWriterMode = 'idle';
  let recoveryError: Error | null = null;
  let networkAwaitingStarted = false;
  let networkCommittedApplied = false;
  let writerPhaseGroups: WriterPhaseGroup[] = [];
  let contextRecoveryGeneration = 0;
  let contextRecoveryAttemptSequence = 0;
  let contextRecoveryCycle: ContextRecoveryCycle | null = null;
  let latestContextRecoveryPromise: Promise<void> | null = null;
  let lifecycleEpoch = 0;
  let activePresentation: ActiveBoardFramePresentation | null = null;
  let idleFrameSettlement: IdleFrameSettlement | null = null;
  let pendingEquivalentIdleFrame: BoardVisualFrame | null = null;
  let idleFrameSettlementVersion = 0;
  let backendInvalidated = false;
  const hostLeaseOwner = Object.freeze({});
  const idleWaiters = new Set<IdleWaiter>();
  const settlingIdleWaiters = new Set<IdleWaiter>();
  const settledFrameListeners = new Set<(frame: BoardVisualFrame) => void>();
  let settledFrameNotificationVersion = 0;
  let idleSettlement: Promise<void> | null = null;
  let resolveReady!: () => void;
  let rejectReady!: (error: unknown) => void;
  let readySettled = false;
  let readyPromise!: Promise<void>;

  const beginReadyCycle = () => {
    readySettled = false;
    readyPromise = new Promise<void>((resolve, reject) => {
      resolveReady = resolve;
      rejectReady = reject;
    });
    // A readiness cycle may legitimately reject before a caller starts
    // awaiting the replacement/fallback cycle. Keep that rejection observed
    // without changing what callers receive from `ready`/`waitUntilReady()`.
    readyPromise.catch(() => { /* observed by the controller lifecycle */ });
    return readyPromise;
  };

  beginReadyCycle();

  const waitForBackendVisualSettlement = (frame?: BoardVisualFrame) => {
    const candidate = (backend as any).waitForVisualSettlement;
    if (typeof candidate !== 'function') return Promise.resolve();
    return Promise.resolve(candidate.call(backend, frame));
  };

  const waitForLatestIdleSettlement = async (): Promise<void> => {
    while (true) {
      const tracked = idleFrameSettlement;
      if (tracked) {
        await tracked.promise;
        if (idleFrameSettlement === tracked) {
          const epoch = lifecycleEpoch;
          try {
            await waitForBackendVisualSettlement(lastSettled || undefined);
            assertLifecycleCurrent(epoch);
          } catch (error) {
            if (mode === 'destroyed') throw toError(error, 'BoardVisualController is destroyed');
            throw enterFailureRecovery(error, 'idle', 'frame:idle-settlement-error');
          }
          if (idleFrameSettlement === tracked) return;
        }
        continue;
      }
      const epoch = lifecycleEpoch;
      try {
        await waitForBackendVisualSettlement();
        assertLifecycleCurrent(epoch);
      } catch (error) {
        if (mode === 'destroyed') throw toError(error, 'BoardVisualController is destroyed');
        throw enterFailureRecovery(error, 'idle', 'frame:idle-settlement-error');
      }
      if (!idleFrameSettlement) return;
    }
  };

  const flushIdleWaiters = () => {
    if (!ready || mode !== 'idle' || idleWaiters.size === 0) return;
    const waiters = Array.from(idleWaiters);
    for (const waiter of waiters) {
      idleWaiters.delete(waiter);
      settlingIdleWaiters.add(waiter);
    }
    if (!idleSettlement) {
      idleSettlement = waitForLatestIdleSettlement().then(
        () => {
          const settled = Array.from(settlingIdleWaiters);
          settlingIdleWaiters.clear();
          for (const waiter of settled) waiter.resolve();
        },
        (error) => {
          const normalized = toError(error, 'Board visual settlement failed');
          const settled = Array.from(settlingIdleWaiters);
          settlingIdleWaiters.clear();
          for (const waiter of settled) waiter.reject(normalized);
        }
      ).finally(() => {
        idleSettlement = null;
        flushIdleWaiters();
      });
    }
  };

  const rejectIdleWaiters = (error: Error) => {
    if (idleWaiters.size === 0 && settlingIdleWaiters.size === 0) return;
    const waiters = Array.from(new Set([...idleWaiters, ...settlingIdleWaiters]));
    idleWaiters.clear();
    settlingIdleWaiters.clear();
    for (const waiter of waiters) waiter.reject(error);
  };

  const assertAlive = () => {
    if (mode === 'destroyed') throw new Error('BoardVisualController is destroyed');
  };

  const assertLifecycleCurrent = (epoch: number) => {
    if (epoch !== lifecycleEpoch || mode === 'destroyed') {
      throw new Error('BoardVisualController is destroyed');
    }
  };

  const setHostRendererAttribute = (value: BoardVisualBackend['kind'] | null) => {
    if (!host) return;
    if (value && typeof host.setAttribute === 'function') host.setAttribute('data-board-renderer', value);
    else if (!value && typeof host.removeAttribute === 'function') host.removeAttribute('data-board-renderer');
  };

  const acquireHostLease = (nextHost: HTMLElement) => {
    const current = HOST_BACKEND_LEASES.get(nextHost);
    if (current && current !== hostLeaseOwner) {
      throw new Error('Board visual host already has an active backend lease');
    }
    if (!current && typeof nextHost.hasAttribute === 'function' && nextHost.hasAttribute('data-board-renderer')) {
      throw new Error('Board visual host already has an active renderer');
    }
    HOST_BACKEND_LEASES.set(nextHost, hostLeaseOwner);
  };

  const releaseHostLease = () => {
    if (!host || HOST_BACKEND_LEASES.get(host) !== hostLeaseOwner) return;
    HOST_BACKEND_LEASES.delete(host);
    setHostRendererAttribute(null);
  };

  const setMode = (next: BoardWriterMode) => {
    mode = next;
    diagnostics.record('controller:mode', { mode: next, frameToken: activeToken?.frameToken || null });
    flushIdleWaiters();
  };

  const settleReadySuccess = () => {
    if (readySettled) return;
    readySettled = true;
    resolveReady();
  };

  const settleReadyFailure = (error: Error) => {
    if (readySettled) return;
    readySettled = true;
    rejectReady(error);
  };

  const rollbackPresentation = (presentation: ActiveBoardFramePresentation | null) => {
    if (!presentation || presentation.state !== 'active') return;
    presentation.state = 'rolled-back';
    if (activePresentation === presentation) activePresentation = null;
    lastApplied = presentation.previousFrame;
    try {
      presentation.rollback?.();
    } catch (error) {
      diagnostics.record('frame:presentation-rollback-error', {
        frameToken: presentation.sourceFrame.frameToken,
        message: toError(error, 'Board frame presentation rollback failed').message
      });
    }
  };

  const scheduleSettledFrameNotification = (frame: BoardVisualFrame) => {
    const version = ++settledFrameNotificationVersion;
    Promise.resolve().then(() => {
      if (
        mode === 'destroyed'
        || version !== settledFrameNotificationVersion
        || lastSettled !== frame
      ) return;
      for (const listener of Array.from(settledFrameListeners)) {
        try {
          listener(frame);
        } catch (error) {
          diagnostics.record('frame:settled-listener-error', {
            frameToken: frame.frameToken,
            message: toError(error, 'Board settled-frame listener failed').message
          });
        }
      }
    });
  };

  const commitPresentation = (presentation: ActiveBoardFramePresentation | null) => {
    if (!presentation || presentation.state !== 'active') return;
    try {
      presentation.commit?.();
      presentation.state = 'committed';
      if (activePresentation === presentation) activePresentation = null;
      lastApplied = presentation.presentedFrame;
      lastSettled = presentation.presentedFrame;
      scheduleSettledFrameNotification(presentation.presentedFrame);
    } catch (error) {
      rollbackPresentation(presentation);
      throw error;
    }
  };

  const beginFramePresentation = (frame: BoardVisualFrame): ActiveBoardFramePresentation => {
    // A newer allowed apply supersedes an unsettled presentation. Restore the
    // last settled DOM frame first, then present the newer frame in the same
    // JavaScript transaction so no intermediate writer can paint.
    rollbackPresentation(activePresentation);
    const previousFrame = lastApplied;
    const result = typeof options.beginApplyFrame === 'function'
      ? options.beginApplyFrame(frame, Object.freeze({ backendKind: backend.kind, host }))
      : frame;
    const descriptor: BoardFramePresentation = result && typeof result === 'object' && 'frame' in result
      ? result as BoardFramePresentation
      : Object.freeze({ frame: result as BoardVisualFrame }) as BoardFramePresentation;
    const presentedFrame = descriptor.frame;
    if (!presentedFrame || presentedFrame.frameToken !== frame.frameToken) {
      try { descriptor.rollback?.(); } catch (_error) { /* retain the identity error */ }
      throw new Error('Presented board frame must preserve the source frame token');
    }
    if (
      presentedFrame.renderSessionId !== frame.renderSessionId
      || presentedFrame.model !== frame.model
      || presentedFrame.appearance !== frame.appearance
      || presentedFrame.theme !== frame.theme
    ) {
      try { descriptor.rollback?.(); } catch (_error) { /* retain the identity error */ }
      throw new Error('Presented board frame may only replace live viewport layout');
    }
    const presentation: ActiveBoardFramePresentation = {
      sourceFrame: frame,
      presentedFrame,
      previousFrame,
      commit: descriptor.commit,
      rollback: descriptor.rollback,
      state: 'active'
    };
    activePresentation = presentation;
    return presentation;
  };

  const enterFailureRecovery = (
    error: unknown,
    returnMode: BoardWriterMode,
    event: string
  ): Error => {
    const normalized = toError(error, 'Board visual backend failed');
    if (mode === 'destroyed') return normalized;
    rollbackPresentation(activePresentation);
    if (readySettled) beginReadyCycle();
    ready = false;
    recoveryReturnMode = returnMode === 'recovering'
      ? (activeToken ? 'playback' : 'idle')
      : returnMode;
    recoveryError = normalized;
    setMode('recovering');
    rejectIdleWaiters(normalized);
    diagnostics.record(event, { message: normalized.message, frameToken: activeToken?.frameToken || null });
    settleReadyFailure(normalized);
    return normalized;
  };

  const clearWriterPhaseHistory = () => {
    writerPhaseGroups = [];
  };

  const appendWriterPhaseLaunch = (
    events: readonly unknown[],
    phaseScope: BoardPlaybackPhaseScope
  ): WriterPhaseLaunch => {
    const launch = Object.freeze({
      events: Object.freeze(Array.from(events)),
      phaseScope
    });
    const scopeIdentity = phaseScope as object;
    const latestGroup = writerPhaseGroups[writerPhaseGroups.length - 1];
    if (latestGroup && latestGroup.scopeIdentity === scopeIdentity) {
      latestGroup.launches.push(launch);
    } else {
      writerPhaseGroups.push({ scopeIdentity, launches: [launch] });
    }
    return launch;
  };

  const snapshotWriterPhaseGroups = (): ContextRecoveryCycle['phaseGroups'] => Object.freeze(
    writerPhaseGroups.map((group) => Object.freeze({
      scopeIdentity: group.scopeIdentity,
      launches: Object.freeze(group.launches.slice())
    }))
  );

  const contextRecoveryTarget = (cycle: ContextRecoveryCycle): BoardVisualFrame | null => {
    if (cycle.returnMode === 'awaiting-frame-commit') {
      if (pendingCommittedRecoveryFrame) return pendingCommittedRecoveryFrame;
      if (networkCommittedApplied && lastApplied) return lastApplied;
      return cycle.checkpoint || writerCheckpoint || lastSettled || lastApplied;
    }
    if (cycle.returnMode === 'playback') {
      return cycle.checkpoint || writerCheckpoint || lastSettled || lastApplied;
    }
    return pendingEquivalentIdleFrame || pendingLatest || initialLatest || cycle.checkpoint || lastSettled || lastApplied;
  };

  const finishContextRecoveryCycle = (cycle: ContextRecoveryCycle) => {
    if (contextRecoveryCycle !== cycle) return;
    contextRecoveryCycle = null;
    cycle.resolve();
  };

  const rejectContextRecoveryCycle = (cycle: ContextRecoveryCycle, error: unknown) => {
    if (contextRecoveryCycle !== cycle) return;
    const normalized = toError(error, 'Board context recovery failed');
    contextRecoveryCycle = null;
    recoveryError = normalized;
    diagnostics.record('context-recovery:failed', { message: normalized.message });
    cycle.reject(normalized);
  };

  const applyReadyFrame = (frame: BoardVisualFrame): ActiveBoardFramePresentation => {
    const presentation = beginFramePresentation(frame);
    try {
      if (presentation.presentedFrame === frame) backend.applyFrame(frame);
      else (backend.applyFrame as any)(frame, presentation.presentedFrame);
      backendInvalidated = false;
    } catch (error) {
      rollbackPresentation(presentation);
      throw error;
    }
    lastApplied = presentation.presentedFrame;
    diagnostics.record('frame:applied', { frameToken: frame.frameToken, revision: frame.model.visualRevision });
    return presentation;
  };

  const settleReadyFramePresentation = async (
    frame: BoardVisualFrame,
    epoch: number,
    operation: 'apply' | 'restore'
  ): Promise<ActiveBoardFramePresentation> => {
    const presentation = beginFramePresentation(frame);
    try {
      const applyOperation = operation === 'restore' ? backend.restore : backend.applyFrame;
      if (presentation.presentedFrame === frame) {
        await Promise.resolve(applyOperation.call(backend, frame));
      } else {
        await Promise.resolve((applyOperation as any).call(backend, frame, presentation.presentedFrame));
      }
      if (operation === 'apply') {
        diagnostics.record('frame:applied', { frameToken: frame.frameToken, revision: frame.model.visualRevision });
      }
      assertLifecycleCurrent(epoch);
      await waitForBackendVisualSettlement(frame);
      assertLifecycleCurrent(epoch);
      backendInvalidated = false;
      return presentation;
    } catch (error) {
      rollbackPresentation(presentation);
      throw error;
    }
  };

  const restoreReadyFrame = async (
    frame: BoardVisualFrame,
    epoch: number
  ): Promise<ActiveBoardFramePresentation> => {
    const presentation = await settleReadyFramePresentation(frame, epoch, 'restore');
    commitPresentation(presentation);
    return presentation;
  };

  const apply = (frame: BoardVisualFrame) => {
    if (!ready) {
      initialLatest = frame;
      diagnostics.record('frame:queued-before-ready', { frameToken: frame.frameToken });
      return false;
    }
    return applyReadyFrame(frame);
  };

  const commitEquivalentIdleFrame = (frame: BoardVisualFrame): boolean => {
    if (
      !lastSettled
      || (idleFrameSettlement && !idleFrameSettlement.settled)
      || !hasEquivalentVisualFrameContent(lastSettled, frame)
    ) {
      return false;
    }
    const presentation = beginFramePresentation(frame);
    commitPresentation(presentation);
    diagnostics.record('frame:equivalent-committed', {
      frameToken: frame.frameToken,
      revision: frame.model.visualRevision
    });
    return true;
  };

  const queueEquivalentIdleFrameDuringSettlement = (frame: BoardVisualFrame): boolean => {
    const tracked = idleFrameSettlement;
    if (
      !tracked
      || tracked.settled
      || !hasEquivalentVisualFrameContent(tracked.sourceFrame, frame)
    ) {
      return false;
    }
    pendingEquivalentIdleFrame = frame;
    diagnostics.record('frame:equivalent-coalesced', {
      frameToken: frame.frameToken,
      revision: frame.model.visualRevision
    });
    return true;
  };

  const trackIdleFrameSettlement = (
    sourceFrame: BoardVisualFrame,
    presentation: ActiveBoardFramePresentation
  ): IdleFrameSettlement => {
    const version = ++idleFrameSettlementVersion;
    const epoch = lifecycleEpoch;
    const tracked: IdleFrameSettlement = {
      sourceFrame,
      presentation,
      version,
      lifecycleEpoch: epoch,
      settled: false,
      promise: Promise.resolve()
    };
    if (typeof (backend as any).waitForVisualSettlement !== 'function') {
      commitPresentation(presentation);
      tracked.settled = true;
      idleFrameSettlement = tracked;
      diagnostics.record('frame:idle-settled', { frameToken: sourceFrame.frameToken });
      return tracked;
    }
    const settlement = waitForBackendVisualSettlement(sourceFrame).then(
      () => {
        assertLifecycleCurrent(epoch);
        if (idleFrameSettlement !== tracked || version !== idleFrameSettlementVersion) {
          rollbackPresentation(presentation);
          return;
        }
        commitPresentation(presentation);
        tracked.settled = true;
        diagnostics.record('frame:idle-settled', { frameToken: sourceFrame.frameToken });
        if (idleFrameSettlement === tracked && pendingEquivalentIdleFrame) {
          const equivalent = pendingEquivalentIdleFrame;
          pendingEquivalentIdleFrame = null;
          commitEquivalentIdleFrame(equivalent);
        }
      },
      (error) => {
        assertLifecycleCurrent(epoch);
        if (idleFrameSettlement !== tracked || version !== idleFrameSettlementVersion) {
          rollbackPresentation(presentation);
          return;
        }
        tracked.settled = true;
        pendingLatest = pendingEquivalentIdleFrame || sourceFrame;
        pendingEquivalentIdleFrame = null;
        rollbackPresentation(presentation);
        throw enterFailureRecovery(error, 'idle', 'frame:idle-settlement-error');
      }
    );
    settlement.catch(() => { /* observed; waitForIdle receives the same promise */ });
    tracked.promise = settlement;
    idleFrameSettlement = tracked;
    return tracked;
  };

  const invalidatePendingPreparation = () => {
    pendingFrameVersion += 1;
    pendingPreparation = null;
  };

  const clearPendingLatestFrame = () => {
    pendingLatest = null;
    pendingPreparationScheduleTicket = null;
    invalidatePendingPreparation();
  };

  const clearPendingEquivalentIdleFrameIfConsumed = (
    ...frames: Array<BoardVisualFrame | null | undefined>
  ) => {
    if (
      pendingEquivalentIdleFrame
      && frames.some((frame) => frame === pendingEquivalentIdleFrame)
    ) {
      pendingEquivalentIdleFrame = null;
    }
  };

  const startPendingPreparation = (
    frame: BoardVisualFrame,
    version: number
  ): PendingFramePreparation => {
    const prepareFrame = (backend as any).prepareFrame;
    let preparation: Promise<void>;
    try {
      preparation = typeof prepareFrame === 'function'
        ? Promise.resolve(prepareFrame.call(backend, frame))
        : Promise.resolve();
    } catch (error) {
      preparation = Promise.reject(error);
    }
    const observed = preparation.then(
      () => {
        if (version === pendingFrameVersion && pendingLatest === frame) {
          diagnostics.record('frame:prepared', { frameToken: frame.frameToken, version });
        }
      },
      (error) => {
        if (version !== pendingFrameVersion || pendingLatest !== frame) {
          diagnostics.record('frame:stale-prepare-error', {
            frameToken: frame.frameToken,
            version,
            message: toError(error, 'Stale board frame preparation failed').message
          });
          return;
        }
        throw toError(error, 'Board frame preparation failed');
      }
    );
    // Preparation starts while playback still owns the visual writer. Its
    // latest failure is surfaced by settleLocalWriter; stale failures are
    // observed and deliberately ignored after a newer frame supersedes them.
    observed.catch(() => { /* observed by the pending preparation contract */ });
    const record = Object.freeze({ frame, version, promise: observed });
    pendingPreparation = record;
    return record;
  };

  const ensurePendingPreparation = (
    frame: BoardVisualFrame,
    version: number
  ): PendingFramePreparation => {
    if (
      pendingPreparation
      && pendingPreparation.frame === frame
      && pendingPreparation.version === version
    ) {
      return pendingPreparation;
    }
    return startPendingPreparation(frame, version);
  };

  const schedulePendingPreparation = () => {
    if (pendingPreparationScheduleTicket) return;
    const ticket = Object.freeze({});
    pendingPreparationScheduleTicket = ticket;
    void Promise.resolve().then(() => {
      if (pendingPreparationScheduleTicket !== ticket) return;
      pendingPreparationScheduleTicket = null;
      const frame = pendingLatest;
      if (!frame) return;
      ensurePendingPreparation(frame, pendingFrameVersion);
    });
  };

  const queuePendingLatestFrame = (frame: BoardVisualFrame, event: string) => {
    pendingLatest = frame;
    invalidatePendingPreparation();
    diagnostics.record(event, { frameToken: frame.frameToken, version: pendingFrameVersion });
    schedulePendingPreparation();
  };

  const settleLatestRecoveryFrame = async (
    initialTarget: BoardVisualFrame,
    epoch: number
  ): Promise<RecoveryFrameSettlement> => {
    let target = initialTarget;
    let operation: 'apply' | 'restore' = 'restore';
    while (true) {
      const pendingAtStart = pendingLatest;
      const pendingVersionAtStart = pendingFrameVersion;
      const initialAtStart = initialLatest;
      const presentation = await settleReadyFramePresentation(target, epoch, operation);
      const pendingStable = pendingLatest === pendingAtStart
        && pendingFrameVersion === pendingVersionAtStart;
      const consumedPending = pendingAtStart === target && pendingStable;

      if (pendingLatest && !consumedPending) {
        rollbackPresentation(presentation);
        target = pendingLatest;
        operation = 'apply';
        continue;
      }

      const initialStable = initialLatest === initialAtStart;
      const consumedInitial = !pendingLatest && initialAtStart === target && initialStable;
      if (!pendingLatest && initialLatest && !consumedInitial) {
        rollbackPresentation(presentation);
        target = initialLatest;
        operation = 'apply';
        continue;
      }

      commitPresentation(presentation);
      return Object.freeze({
        presentation,
        consumedPendingFrame: consumedPending ? target : null,
        consumedPendingVersion: pendingVersionAtStart,
        consumedInitialFrame: consumedInitial ? target : null
      });
    }
  };

  const assertToken = (token: BoardWriterToken) => {
    if (!activeToken || token !== activeToken) throw new Error('Board writer token does not own the active frame');
  };

  const assertFrameMatchesActiveToken = (frame: BoardVisualFrame) => {
    if (!activeToken || frame.frameToken !== activeToken.frameToken) {
      throw new Error('Board visual recovery frame does not match the active writer token');
    }
  };

  const finishSuccessfulRestore = (
    settlement: RecoveryFrameSettlement,
    returnMode: BoardWriterMode = recoveryReturnMode
  ) => {
    const target = settlement.presentation.presentedFrame;
    lastApplied = target;
    clearPendingEquivalentIdleFrameIfConsumed(
      settlement.presentation.sourceFrame,
      target
    );
    if (
      settlement.consumedPendingFrame
      && pendingLatest === settlement.consumedPendingFrame
      && pendingFrameVersion === settlement.consumedPendingVersion
    ) {
      clearPendingLatestFrame();
      // A recovery-time pending frame is newer than an initial frame retained
      // from the failed mount generation.
      initialLatest = null;
    } else if (
      settlement.consumedInitialFrame
      && initialLatest === settlement.consumedInitialFrame
    ) {
      initialLatest = null;
    }
    ready = true;
    recoveryError = null;
    const nextMode = returnMode === 'recovering' ? (activeToken ? 'playback' : 'idle') : returnMode;
    recoveryReturnMode = nextMode;
    setMode(nextMode);
    settleReadySuccess();
    diagnostics.record('recovery:restored', { frameToken: target.frameToken });
  };

  const finishWriterRelease = (token: BoardWriterToken) => {
    clearPendingLatestFrame();
    pendingCommittedRecoveryFrame = null;
    diagnostics.record('writer:released', { id: token.id, frameToken: token.frameToken });
    activeToken = null;
    writerCheckpoint = null;
    networkAwaitingStarted = false;
    networkCommittedApplied = false;
    clearWriterPhaseHistory();
    setMode('idle');
    return true;
  };

  const performLocalWriterSettlement = async (
    token: BoardWriterToken,
    finalFrame?: BoardVisualFrame
  ): Promise<boolean> => {
    const epoch = lifecycleEpoch;
    assertToken(token);
    if (token.mode !== 'local') throw new Error('Async local settlement requires a local board writer');
    if (mode !== 'playback' && mode !== 'recovering') {
      throw new Error(`Cannot settle local board writer while controller is ${mode}`);
    }
    if (finalFrame) {
      if (finalFrame.frameToken !== token.frameToken) throw new Error('Final visual frame token mismatch');
      queuePendingLatestFrame(finalFrame, 'frame:coalesced-for-local-settlement');
    }
    if (mode === 'recovering' && readySettled && !ready) beginReadyCycle();
    let target: BoardVisualFrame | null = null;
    try {
      while (pendingLatest) {
        target = pendingLatest;
        if (target.frameToken !== token.frameToken) throw new Error('Final visual frame token mismatch');
        const version = pendingFrameVersion;
        const preparation = ensurePendingPreparation(target, version);
        await preparation.promise;
        assertLifecycleCurrent(epoch);
        if (pendingLatest !== target || pendingFrameVersion !== version) continue;
        if (!backendMounted) throw new Error('Local board settlement requires a mounted backend');
        const presentation = applyReadyFrame(target);
        await waitForBackendVisualSettlement(target);
        assertLifecycleCurrent(epoch);
        if (pendingLatest !== target || pendingFrameVersion !== version) {
          rollbackPresentation(presentation);
          continue;
        }
        commitPresentation(presentation);
        break;
      }
      if (!target) {
        await waitForBackendVisualSettlement();
        assertLifecycleCurrent(epoch);
      }
      if (mode === 'recovering') {
        ready = true;
        recoveryError = null;
        recoveryReturnMode = 'playback';
        setMode('playback');
        settleReadySuccess();
      }
      return finishWriterRelease(token);
    } catch (error) {
      throw enterFailureRecovery(error, 'playback', 'frame:local-settlement-error');
    }
  };

  return {
    async mount(nextHost: HTMLElement) {
      assertAlive();
      const epoch = lifecycleEpoch;
      if (mountPromise) {
        if (host !== nextHost) throw new Error('BoardVisualController cannot mount a second host');
        return mountPromise;
      }
      try {
        acquireHostLease(nextHost);
        host = nextHost;
        setHostRendererAttribute(backend.kind);
      } catch (error) {
        const normalized = enterFailureRecovery(error, mode, 'backend:mount-error');
        settleReadyFailure(normalized);
        throw normalized;
      }
      const completeMount = async () => {
          assertLifecycleCurrent(epoch);
          backendMounted = true;
          let initial = initialLatest;
          while (initial) {
            initialLatest = null;
            const prepareFrame = (backend as any).prepareFrame;
            if (typeof prepareFrame === 'function') {
              try {
                await Promise.resolve(prepareFrame.call(backend, initial));
                assertLifecycleCurrent(epoch);
              } catch (error) {
                // A rejected preparation for a superseded initial frame must
                // not poison the newer initial frame's readiness cycle.
                if (initialLatest) {
                  diagnostics.record('frame:stale-initial-prepare-error', {
                    frameToken: initial.frameToken,
                    message: toError(error, 'Stale initial frame preparation failed').message
                  });
                  initial = initialLatest;
                  continue;
                }
                throw error;
              }
            }
            // A newer frame queued while resources were prepared supersedes
            // the stale frame without ever making it the visible writer.
            if (initialLatest) {
              initial = initialLatest;
              continue;
            }
            const presentation = applyReadyFrame(initial);
            await waitForBackendVisualSettlement(initial);
            assertLifecycleCurrent(epoch);
            if (initialLatest) rollbackPresentation(presentation);
            else commitPresentation(presentation);
            initial = initialLatest;
          }
          assertLifecycleCurrent(epoch);
          ready = true;
          recoveryError = null;
          settleReadySuccess();
          diagnostics.record('backend:ready', { kind: backend.kind });
          flushIdleWaiters();
      };
      const failMount = (error: unknown) => {
          if (mode === 'destroyed' || epoch !== lifecycleEpoch) {
            throw toError(error, 'BoardVisualController is destroyed');
          }
          if (!backendMounted) setHostRendererAttribute(null);
          const normalized = enterFailureRecovery(error, mode, 'backend:mount-error');
          settleReadyFailure(normalized);
          throw normalized;
      };
      try {
        const mountResult = backend.mount(nextHost, { diagnostics });
        if (mountResult && typeof (mountResult as any).then === 'function') {
          mountPromise = Promise.resolve(mountResult).then(completeMount).catch(failMount);
        } else {
          mountPromise = Promise.resolve().then(completeMount).catch(failMount);
        }
      } catch (error) {
        try {
          failMount(error);
        } catch (normalized) {
          mountPromise = Promise.reject(normalized);
        }
      }
      return mountPromise;
    },
    get ready() {
      return readyPromise;
    },
    waitUntilReady() {
      if (mode === 'destroyed') return Promise.reject(new Error('BoardVisualController is destroyed'));
      if (ready) return Promise.resolve();
      return readyPromise;
    },
    isReady() {
      return ready;
    },
    getMode() {
      return mode;
    },
    isIdleSettlementPending() {
      return !!(idleFrameSettlement && !idleFrameSettlement.settled);
    },
    getActiveFrameToken() {
      return activeToken?.frameToken || null;
    },
    getActiveWriterToken() {
      return activeToken;
    },
    getBackendKind() {
      return backend.kind;
    },
    getBackendDiagnostics() {
      const candidate = (backend as any).getDiagnostics;
      return typeof candidate === 'function' ? candidate.call(backend) : null;
    },
    captureDebugFramePngDataUrl() {
      assertAlive();
      if (diagnostics.enabled !== true) {
        throw new Error('Board visual frame capture requires gated diagnostics');
      }
      const candidate = (backend as any).captureDebugFramePngDataUrl;
      return typeof candidate === 'function' ? candidate.call(backend) : null;
    },
    captureDebugFrameAfterTickerElapsed(elapsedMs: number) {
      assertAlive();
      if (diagnostics.enabled !== true) {
        return Promise.reject(new Error('Board visual ticker frame capture requires gated diagnostics'));
      }
      const candidate = (backend as any).captureDebugFrameAfterTickerElapsed;
      if (typeof candidate !== 'function') {
        return Promise.reject(new Error('Active board backend does not support ticker frame capture'));
      }
      return Promise.resolve(candidate.call(backend, elapsedMs));
    },
    getVisualFrameDigest() {
      return computeVisualFrameDigest(lastSettled);
    },
    getSettledFrame() {
      return lastSettled;
    },
    subscribeSettledFrame(listener: (frame: BoardVisualFrame) => void, emitCurrent = false) {
      assertAlive();
      if (typeof listener !== 'function') {
        throw new Error('Board settled-frame listener must be a function');
      }
      settledFrameListeners.add(listener);
      if (emitCurrent && lastSettled) {
        const current = lastSettled;
        Promise.resolve().then(() => {
          if (mode !== 'destroyed' && settledFrameListeners.has(listener) && lastSettled === current) {
            try {
              listener(current);
            } catch (error) {
              diagnostics.record('frame:settled-listener-error', {
                frameToken: current.frameToken,
                message: toError(error, 'Board settled-frame listener failed').message
              });
            }
          }
        });
      }
      return () => {
        settledFrameListeners.delete(listener);
      };
    },
    getRenderedCell(row: number, col: number) {
      const candidate = (backend as any).getRenderedCell;
      if (typeof candidate !== 'function') return null;
      return candidate.call(backend, row, col);
    },
    getDisplayObjectCounts() {
      return readBackendCountSnapshot(backend, 'getDisplayObjectCounts');
    },
    getTextureLeaseCounts() {
      return readBackendCountSnapshot(backend, 'getTextureLeaseCounts');
    },
    waitForIdle() {
      if (mode === 'destroyed') return Promise.reject(new Error('BoardVisualController is destroyed'));
      if (mode === 'recovering') {
        return Promise.reject(recoveryError || new Error('BoardVisualController is recovering'));
      }
      if (ready && mode === 'idle') return waitForLatestIdleSettlement();
      return new Promise<void>((resolve, reject) => {
        idleWaiters.add(Object.freeze({ resolve, reject }));
      });
    },
    submitFrame(frame: BoardVisualFrame) {
      assertAlive();
      if (mode === 'recovering') {
        if (activeToken) assertFrameMatchesActiveToken(frame);
        queuePendingLatestFrame(frame, 'frame:coalesced-recovery');
        return false;
      }
      if (!ready) {
        if (mode !== 'idle') throw new Error(`Cannot queue a board frame while controller is ${mode}`);
        initialLatest = frame;
        diagnostics.record('frame:queued-before-ready', { frameToken: frame.frameToken });
        return false;
      }
      if (mode === 'idle') {
        try {
          if (!backendInvalidated && queueEquivalentIdleFrameDuringSettlement(frame)) return true;
          pendingEquivalentIdleFrame = null;
          if (!backendInvalidated && commitEquivalentIdleFrame(frame)) return true;
          const presentation = apply(frame);
          if (!presentation) return false;
          trackIdleFrameSettlement(frame, presentation);
          return true;
        } catch (error) {
          pendingLatest = frame;
          throw enterFailureRecovery(error, 'idle', 'frame:idle-apply-error');
        }
      }
      if (mode === 'playback') {
        if (!activeToken || frame.frameToken !== activeToken.frameToken) {
          throw new Error('Cannot coalesce a visual frame from a different playback token');
        }
        queuePendingLatestFrame(frame, 'frame:coalesced');
        return false;
      }
      if (mode === 'awaiting-frame-commit') {
        assertFrameMatchesActiveToken(frame);
        diagnostics.record('frame:ignored-awaiting-commit', { frameToken: frame.frameToken });
        return false;
      }
      return false;
    },
    claimWriter(frameToken: string, writerMode: 'local' | 'network'): BoardWriterToken {
      assertAlive();
      if (!ready) throw new Error('Cannot claim board visual writer before backend readiness');
      if (mode !== 'idle') throw new Error(`Cannot claim board visual writer while controller is ${mode}`);
      if (activeToken) throw new Error('Board visual writer is already claimed');
      if (idleFrameSettlement && !idleFrameSettlement.settled) {
        throw new Error('Cannot claim board visual writer before idle visual settlement completes');
      }
      activeToken = Object.freeze({ id: ++tokenSequence, frameToken: String(frameToken), mode: writerMode });
      writerCheckpoint = lastApplied;
      clearWriterPhaseHistory();
      clearPendingLatestFrame();
      pendingCommittedRecoveryFrame = null;
      networkAwaitingStarted = false;
      networkCommittedApplied = false;
      setMode('playback');
      diagnostics.record('writer:claimed', { id: activeToken.id, frameToken: activeToken.frameToken, mode: writerMode });
      return activeToken;
    },
    reclaimWriter(token: BoardWriterToken, frameToken: string, writerMode: 'local' | 'network'): BoardWriterToken {
      assertToken(token);
      if (localWriterSettlement) {
        throw new Error('Cannot reclaim a board writer during async local settlement');
      }
      if (!ready) throw new Error('Cannot reclaim board visual writer before backend readiness');
      if (mode !== 'playback') throw new Error('Board writer reclaim requires playback mode');
      activeToken = Object.freeze({ id: ++tokenSequence, frameToken: String(frameToken), mode: writerMode });
      if (!writerCheckpoint) writerCheckpoint = lastApplied;
      clearWriterPhaseHistory();
      clearPendingLatestFrame();
      pendingCommittedRecoveryFrame = null;
      networkAwaitingStarted = false;
      networkCommittedApplied = false;
      diagnostics.record('writer:reclaimed', { id: activeToken.id, frameToken: activeToken.frameToken, mode: writerMode });
      return activeToken;
    },
    async validatePhase(
      events: readonly unknown[],
      strictNetworkPlayback: boolean,
      providedScope?: BoardPlaybackPhaseScope
    ) {
      const epoch = lifecycleEpoch;
      assertAlive();
      if (!ready || !backendMounted) {
        throw new Error('Cannot validate a board phase before backend readiness');
      }
      const phaseScope: BoardPlaybackPhaseScope = providedScope || Object.freeze({
        events: Object.freeze(Array.from(events))
      });
      const context: BoardPlaybackValidationContext = Object.freeze({
        strictNetworkPlayback: strictNetworkPlayback === true,
        phaseScope
      });
      if (typeof backend.validatePhase === 'function') {
        await backend.validatePhase(events, context);
      } else if (backend.kind === 'pixi') {
        throw new Error('Pixi board backend capability preflight is unavailable');
      }
      assertLifecycleCurrent(epoch);
    },
    async playPhase(
      token: BoardWriterToken,
      events: readonly unknown[],
      providedScope?: BoardPlaybackPhaseScope
    ) {
      const epoch = lifecycleEpoch;
      assertToken(token);
      if (mode !== 'playback') throw new Error(`Cannot play a board phase while controller is ${mode}`);
      const phaseScope: BoardPlaybackPhaseScope = providedScope || Object.freeze({
        events: Object.freeze(Array.from(events))
      });
      const context: BoardPlaybackContext = Object.freeze({
        token,
        strictNetworkPlayback: token.mode === 'network',
        phaseScope
      });
      appendWriterPhaseLaunch(events, phaseScope);
      const recoveryGenerationAtStart = contextRecoveryGeneration;
      try {
        await backend.playPhase(events, context);
        assertLifecycleCurrent(epoch);
      } catch (error) {
        const recovery = contextRecoveryCycle;
        const recoveryPromise = recovery && recovery.generation > recoveryGenerationAtStart
          ? recovery.promise
          : (contextRecoveryGeneration > recoveryGenerationAtStart
            ? latestContextRecoveryPromise
            : null);
        if (!recoveryPromise) throw error;
        await recoveryPromise;
        assertLifecycleCurrent(epoch);
        return;
      }
      const recovery = contextRecoveryCycle;
      if (recovery && recovery.generation > recoveryGenerationAtStart) {
        await recovery.promise;
        assertLifecycleCurrent(epoch);
      }
    },
    async abortWriterBeforeHandoff(token: BoardWriterToken, checkpoint?: BoardVisualFrame) {
      const epoch = lifecycleEpoch;
      assertToken(token);
      if (token.mode !== 'network' || mode !== 'playback' || networkAwaitingStarted) {
        throw new Error('Writer abort before handoff requires active pre-handoff network playback');
      }
      const target = checkpoint || writerCheckpoint;
      if (!target) {
        throw enterFailureRecovery(
          new Error('Writer abort before handoff requires a visual checkpoint'),
          'playback',
          'writer:abort-before-handoff-error'
        );
      }
      try {
        if (!ready || !backendMounted) {
          throw new Error('Writer abort before handoff requires backend readiness');
        }
        await restoreReadyFrame(target, epoch);
        clearPendingLatestFrame();
        initialLatest = null;
        pendingCommittedRecoveryFrame = null;
        recoveryError = null;
        diagnostics.record('writer:aborted-before-handoff', { id: token.id, frameToken: token.frameToken });
        activeToken = null;
        writerCheckpoint = null;
        clearWriterPhaseHistory();
        networkAwaitingStarted = false;
        networkCommittedApplied = false;
        setMode('idle');
        return true;
      } catch (error) {
        pendingLatest = target;
        throw enterFailureRecovery(error, 'playback', 'writer:abort-before-handoff-error');
      }
    },
    async cancelWriterAfterHandoff(token: BoardWriterToken, checkpoint?: BoardVisualFrame) {
      const epoch = lifecycleEpoch;
      assertToken(token);
      const postHandoffMode = mode === 'awaiting-frame-commit'
        || mode === 'recovering'
        || (mode === 'playback' && networkCommittedApplied);
      if (token.mode !== 'network' || !networkAwaitingStarted || !postHandoffMode) {
        throw new Error('Writer cancel after handoff requires active post-handoff strict-network playback');
      }
      const target = checkpoint || writerCheckpoint;
      const failureReturnMode = mode === 'recovering' ? recoveryReturnMode : mode;
      if (!target) {
        throw enterFailureRecovery(
          new Error('Writer cancel after handoff requires a visual checkpoint'),
          failureReturnMode,
          'writer:cancel-after-handoff-error'
        );
      }
      if (readySettled && !ready) beginReadyCycle();
      try {
        if (!backendMounted) throw new Error('Writer cancel after handoff requires a mounted backend');
        await restoreReadyFrame(target, epoch);
        clearPendingLatestFrame();
        initialLatest = null;
        pendingCommittedRecoveryFrame = null;
        ready = true;
        recoveryError = null;
        diagnostics.record('writer:cancelled-after-handoff', { id: token.id, frameToken: token.frameToken });
        activeToken = null;
        writerCheckpoint = null;
        clearWriterPhaseHistory();
        networkAwaitingStarted = false;
        networkCommittedApplied = false;
        recoveryReturnMode = 'idle';
        setMode('idle');
        settleReadySuccess();
        return true;
      } catch (error) {
        writerCheckpoint = target;
        throw enterFailureRecovery(error, failureReturnMode, 'writer:cancel-after-handoff-error');
      }
    },
    beginAwaitingFrameCommit(token: BoardWriterToken) {
      assertToken(token);
      if (token.mode !== 'network' || mode !== 'playback') {
        throw new Error('Only active strict-network playback can await a committed frame');
      }
      clearPendingLatestFrame();
      pendingCommittedRecoveryFrame = null;
      networkAwaitingStarted = true;
      networkCommittedApplied = false;
      // From this point a context restore must not replay events. The timeline
      // owns the committed-store apply and retains the opaque settlement handle.
      clearWriterPhaseHistory();
      setMode('awaiting-frame-commit');
    },
    async applyCommittedFrame(token: BoardWriterToken, frame: BoardVisualFrame) {
      const epoch = lifecycleEpoch;
      assertToken(token);
      if (mode !== 'awaiting-frame-commit') throw new Error('Committed frame apply requires awaiting-frame-commit');
      if (!networkAwaitingStarted) throw new Error('Committed frame apply requires beginAwaitingFrameCommit');
      if (frame.frameToken !== token.frameToken) throw new Error('Committed frame token mismatch');
      try {
        if (!ready) throw new Error('Committed frame apply requires backend readiness');
        const presentation = apply(frame);
        if (!presentation) throw new Error('Committed board frame was not applied');
        await waitForBackendVisualSettlement(frame);
        assertLifecycleCurrent(epoch);
        commitPresentation(presentation);
        networkCommittedApplied = true;
        pendingCommittedRecoveryFrame = null;
        // Keep normal render submissions excluded until tracker/observer
        // settlement releases the strict-network writer. The committed frame
        // above is the single full-sync apply for this visual sequence.
        setMode('awaiting-frame-commit');
        diagnostics.record('frame:committed-applied', { frameToken: frame.frameToken });
        return true;
      } catch (error) {
        pendingLatest = frame;
        pendingCommittedRecoveryFrame = frame;
        networkCommittedApplied = false;
        throw enterFailureRecovery(error, 'awaiting-frame-commit', 'frame:committed-apply-error');
      }
    },
    async restoreCommittedFrame(token: BoardWriterToken, frame?: BoardVisualFrame) {
      const epoch = lifecycleEpoch;
      assertToken(token);
      if (token.mode !== 'network' || (mode !== 'recovering' && mode !== 'awaiting-frame-commit')) {
        throw new Error('Committed frame restore requires active network recovery or commit wait');
      }
      if (!networkAwaitingStarted) {
        throw new Error('Committed frame restore requires beginAwaitingFrameCommit');
      }
      const target = frame || pendingCommittedRecoveryFrame;
      if (!target) throw new Error('Committed frame restore has no saved committed frame');
      if (target.frameToken !== token.frameToken) throw new Error('Committed frame restore token mismatch');
      if (readySettled && !ready) beginReadyCycle();
      try {
        if (!backendMounted) throw new Error('Committed frame restore requires a mounted backend');
        if (mode === 'recovering') {
          await restoreReadyFrame(target, epoch);
        } else {
          if (!ready) throw new Error('Committed frame restore requires backend readiness');
          const presentation = applyReadyFrame(target);
          await waitForBackendVisualSettlement(target);
          assertLifecycleCurrent(epoch);
          commitPresentation(presentation);
        }
        clearPendingLatestFrame();
        initialLatest = null;
        pendingCommittedRecoveryFrame = null;
        ready = true;
        recoveryError = null;
        recoveryReturnMode = 'awaiting-frame-commit';
        networkCommittedApplied = true;
        setMode('awaiting-frame-commit');
        settleReadySuccess();
        diagnostics.record('frame:committed-restored', { frameToken: target.frameToken });
        return true;
      } catch (error) {
        pendingLatest = target;
        pendingCommittedRecoveryFrame = target;
        networkCommittedApplied = false;
        throw enterFailureRecovery(error, 'awaiting-frame-commit', 'frame:committed-restore-error');
      }
    },
    settleLocalWriter(token: BoardWriterToken, finalFrame?: BoardVisualFrame): Promise<boolean> {
      assertAlive();
      assertToken(token);
      if (localWriterSettlement) {
        if (localWriterSettlement.token === token && !finalFrame) return localWriterSettlement.promise;
        return Promise.reject(new Error('A local board writer settlement is already active'));
      }
      const promise = performLocalWriterSettlement(token, finalFrame);
      const settlement = Object.freeze({ token, promise });
      localWriterSettlement = settlement;
      const clear = () => {
        if (localWriterSettlement === settlement) localWriterSettlement = null;
      };
      void promise.then(clear, clear);
      return promise;
    },
    releaseWriter(token: BoardWriterToken, finalFrame?: BoardVisualFrame) {
      assertToken(token);
      if (localWriterSettlement?.token === token) {
        throw new Error('Cannot synchronously release a board writer during async local settlement');
      }
      const canReleaseCommittedNetworkFrame = token.mode === 'network'
        && mode === 'awaiting-frame-commit'
        && networkAwaitingStarted
        && networkCommittedApplied;
      if (mode !== 'playback' && !canReleaseCommittedNetworkFrame) {
        throw new Error(`Cannot release board writer while controller is ${mode}`);
      }
      if (!ready) throw new Error('Cannot release board writer before backend readiness');
      if (token.mode === 'network' && (!networkAwaitingStarted || !networkCommittedApplied)) {
        throw new Error('Cannot release strict-network writer before successful committed frame apply');
      }
      const frame = token.mode === 'network' ? null : (finalFrame || pendingLatest);
      let presentation: ActiveBoardFramePresentation | null = null;
      if (frame) {
        if (frame.frameToken !== token.frameToken) throw new Error('Final visual frame token mismatch');
        try {
          presentation = apply(frame) || null;
          if (!presentation) throw new Error('Final board frame was not applied');
        } catch (error) {
          pendingLatest = frame;
          throw enterFailureRecovery(error, 'playback', 'frame:final-apply-error');
        }
      }
      const released = finishWriterRelease(token);
      if (frame && presentation) trackIdleFrameSettlement(frame, presentation);
      return released;
    },
    enterRecovery(token: BoardWriterToken, error?: unknown) {
      assertAlive();
      assertToken(token);
      if (mode === 'recovering') return true;
      if (mode !== 'playback' && mode !== 'awaiting-frame-commit') {
        throw new Error(`Cannot enter writer recovery while controller is ${mode}`);
      }
      enterFailureRecovery(error || new Error('Board visual recovery requested'), mode, 'recovery:entered');
      return true;
    },
    beginContextRecovery(error?: unknown) {
      assertAlive();
      if (contextRecoveryCycle) return contextRecoveryCycle.promise;
      if (mode !== 'idle' && mode !== 'playback' && mode !== 'awaiting-frame-commit') {
        throw new Error(`Cannot begin context recovery while controller is ${mode}`);
      }
      const returnMode = mode;
      let resolve!: () => void;
      let reject!: (error: Error) => void;
      const promise = new Promise<void>((resolvePromise, rejectPromise) => {
        resolve = resolvePromise;
        reject = rejectPromise;
      });
      promise.catch(() => { /* observed by active phase and lifecycle owners */ });
      const cycle: ContextRecoveryCycle = Object.freeze({
        generation: ++contextRecoveryGeneration,
        returnMode,
        checkpoint: returnMode === 'playback'
          ? (writerCheckpoint || lastSettled || lastApplied)
          : (lastSettled || lastApplied),
        phaseGroups: returnMode === 'playback'
          ? snapshotWriterPhaseGroups()
          : Object.freeze([]),
        promise,
        resolve,
        reject
      });
      contextRecoveryCycle = cycle;
      latestContextRecoveryPromise = promise;
      enterFailureRecovery(error || new Error('Board WebGL context lost'), returnMode, 'context-recovery:entered');
      diagnostics.record('context-recovery:checkpointed', {
        generation: cycle.generation,
        returnMode,
        frameToken: cycle.checkpoint?.frameToken || null,
        phaseGroupCount: cycle.phaseGroups.length
      });
      return promise;
    },
    async restoreContextRecovery(options?: { backendAlreadyRestored?: boolean }) {
      assertAlive();
      const cycle = contextRecoveryCycle;
      if (!cycle) throw new Error('Board context recovery is not active');
      const epoch = lifecycleEpoch;
      const attempt = ++contextRecoveryAttemptSequence;
      const assertAttemptCurrent = () => {
        if (contextRecoveryCycle !== cycle || attempt !== contextRecoveryAttemptSequence) {
          throw new Error('Board context recovery attempt was superseded');
        }
      };
      if (readySettled && !ready) beginReadyCycle();
      try {
        if (!backendMounted) throw new Error('Board context recovery requires a mounted backend');
        const target = contextRecoveryTarget(cycle);
        if (target && options?.backendAlreadyRestored !== true) {
          await restoreReadyFrame(target, epoch);
          assertAttemptCurrent();
        }
        if (cycle.returnMode === 'playback') {
          for (const group of cycle.phaseGroups) {
            await Promise.all(group.launches.map((launch) => backend.playPhase(
              launch.events,
              Object.freeze({
                token: activeToken!,
                strictNetworkPlayback: activeToken?.mode === 'network',
                phaseScope: launch.phaseScope,
                recoveryReplay: true
              })
            )));
            assertAttemptCurrent();
            assertLifecycleCurrent(epoch);
          }
        }
        if (cycle.returnMode === 'awaiting-frame-commit') {
          const committedTarget = pendingCommittedRecoveryFrame;
          if (committedTarget && target === committedTarget) {
            clearPendingLatestFrame();
            pendingCommittedRecoveryFrame = null;
            networkCommittedApplied = true;
          }
        }
        clearPendingEquivalentIdleFrameIfConsumed(target);
        ready = true;
        recoveryError = null;
        recoveryReturnMode = cycle.returnMode;
        setMode(cycle.returnMode);
        settleReadySuccess();
        diagnostics.record('context-recovery:restored', {
          generation: cycle.generation,
          backendKind: backend.kind,
          returnMode: cycle.returnMode,
          frameToken: target?.frameToken || null,
          replayedPhaseGroupCount: cycle.phaseGroups.length
        });
        finishContextRecoveryCycle(cycle);
        return true;
      } catch (error) {
        if (contextRecoveryCycle !== cycle || attempt !== contextRecoveryAttemptSequence) {
          throw toError(error, 'Board context recovery attempt was superseded');
        }
        recoveryError = toError(error, 'Board context recovery failed');
        ready = false;
        setMode('recovering');
        diagnostics.record('context-recovery:restore-error', {
          generation: cycle.generation,
          message: recoveryError.message
        });
        throw recoveryError;
      }
    },
    failContextRecovery(error: unknown) {
      assertAlive();
      const cycle = contextRecoveryCycle;
      if (!cycle) return false;
      rejectContextRecoveryCycle(cycle, error);
      return true;
    },
    async restore(frame?: BoardVisualFrame) {
      assertAlive();
      const epoch = lifecycleEpoch;
      if (mode !== 'recovering') throw new Error('Board restore requires recovering mode');
      if (
        activeToken?.mode === 'network'
        && recoveryReturnMode === 'awaiting-frame-commit'
        && networkAwaitingStarted
        && !networkCommittedApplied
      ) {
        throw new Error('Strict-network committed recovery requires restoreCommittedFrame');
      }
      const target = frame || pendingLatest || initialLatest || lastApplied;
      if (!target) throw new Error('Board restore has no checkpoint frame');
      if (activeToken) assertFrameMatchesActiveToken(target);
      if (readySettled && !ready) beginReadyCycle();
      try {
        if (!backendMounted) throw new Error('Board restore requires a mounted backend');
        const settlement = await settleLatestRecoveryFrame(target, epoch);
        finishSuccessfulRestore(settlement);
        return true;
      } catch (error) {
        throw enterFailureRecovery(error, recoveryReturnMode, 'recovery:restore-error');
      }
    },
    async replaceBackend(
      nextBackend: BoardVisualBackend,
      replacementOptions?: { preserveContextRecovery?: boolean }
    ) {
      assertAlive();
      const epoch = lifecycleEpoch;
      if (!host) throw new Error('Cannot replace an unmounted board backend');
      if (!ready && mode !== 'recovering') {
        throw new Error('Cannot replace a board backend before the current mount settles');
      }
      if (HOST_BACKEND_LEASES.get(host) !== hostLeaseOwner) {
        throw new Error('Cannot replace backend without the active host lease');
      }
      beginReadyCycle();
      const preservedContextRecovery = replacementOptions?.preserveContextRecovery === true
        ? contextRecoveryCycle
        : null;
      if (preservedContextRecovery) contextRecoveryAttemptSequence += 1;
      const checkpoint = preservedContextRecovery
        ? contextRecoveryTarget(preservedContextRecovery)
        : (pendingEquivalentIdleFrame || pendingLatest || initialLatest || lastApplied);
      const returnMode = mode === 'recovering' ? recoveryReturnMode : mode;
      try {
        backend.destroy();
        backendMounted = false;
        ready = false;
        backend = nextBackend;
        setHostRendererAttribute(nextBackend.kind);
        await Promise.resolve(backend.mount(host, { diagnostics }));
        assertLifecycleCurrent(epoch);
        backendMounted = true;
        const restoreTarget = preservedContextRecovery
          ? checkpoint
          : (pendingEquivalentIdleFrame || pendingLatest || initialLatest || checkpoint || lastApplied);
        if (restoreTarget) {
          if (preservedContextRecovery) {
            await restoreReadyFrame(restoreTarget, epoch);
            ready = false;
            recoveryError = null;
            setMode('recovering');
          } else {
            const settlement = await settleLatestRecoveryFrame(restoreTarget, epoch);
            finishSuccessfulRestore(settlement, returnMode);
          }
        }
        else {
          if (preservedContextRecovery) {
            ready = false;
            recoveryError = null;
            setMode('recovering');
          } else {
            ready = true;
            recoveryError = null;
            setMode(returnMode === 'recovering' ? (activeToken ? 'playback' : 'idle') : returnMode);
            settleReadySuccess();
          }
        }
        diagnostics.record('backend:replaced', { kind: backend.kind });
        flushIdleWaiters();
      } catch (error) {
        if (
          checkpoint
          && !pendingLatest
          && !initialLatest
        ) {
          queuePendingLatestFrame(checkpoint, 'frame:retained-after-backend-replace-error');
        }
        if (!backendMounted) setHostRendererAttribute(null);
        throw enterFailureRecovery(error, returnMode, 'backend:replace-error');
      }
    },
    getCellClientRect(row: number, col: number) {
      if (!Number.isInteger(row) || !Number.isInteger(col) || !lastSettled) return null;
      const key = `${row},${col}`;
      if (!lastSettled.model.topology.existingKeys.includes(key)) return null;
      return backend.getCellClientRect(row, col);
    },
    resize(layout: any) {
      assertAlive();
      backend.resize(layout);
    },
    invalidate() {
      const candidate = backend as any;
      if (typeof candidate.invalidate === 'function') candidate.invalidate();
      backendInvalidated = true;
      diagnostics.record('backend:invalidated');
    },
    getSnapshot() {
      return Object.freeze({
        mode,
        ready,
        backendKind: backend.kind,
        activeFrameToken: activeToken?.frameToken || null,
        pendingFrameToken: pendingEquivalentIdleFrame?.frameToken || pendingLatest?.frameToken || initialLatest?.frameToken || null,
        lastAppliedFrameToken: lastApplied?.frameToken || null
      });
    },
    destroy() {
      if (mode === 'destroyed') return;
      lifecycleEpoch += 1;
      ready = false;
      setMode('destroyed');
      rollbackPresentation(activePresentation);
      const error = new Error('BoardVisualController was destroyed before becoming idle');
      rejectIdleWaiters(error);
      settleReadyFailure(error);
      let destroyError: Error | null = null;
      try {
        backend.destroy();
      } catch (error) {
        destroyError = toError(error, 'Board visual backend destroy failed');
        diagnostics.record('backend:destroy-error', { message: destroyError.message });
      }
      backendMounted = false;
      activeToken = null;
      writerCheckpoint = null;
      clearPendingLatestFrame();
      pendingEquivalentIdleFrame = null;
      initialLatest = null;
      pendingCommittedRecoveryFrame = null;
      localWriterSettlement = null;
      networkAwaitingStarted = false;
      networkCommittedApplied = false;
      clearWriterPhaseHistory();
      if (contextRecoveryCycle) {
        rejectContextRecoveryCycle(contextRecoveryCycle, error);
      }
      recoveryError = null;
      settledFrameNotificationVersion += 1;
      settledFrameListeners.clear();
      releaseHostLease();
      if (destroyError) throw destroyError;
    }
  };
}

export = { createBoardVisualController };
