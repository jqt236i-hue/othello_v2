import type {
  BoardPlaybackContext,
  BoardPlaybackPhaseScope,
  BoardVisualBackend,
  BoardVisualFrame,
  BoardWriterMode,
  BoardWriterToken
} from './types';

type ControllerDiagnostics = { record: (event: string, detail?: unknown) => void };
type IdleWaiter = Readonly<{ resolve: () => void; reject: (error: Error) => void }>;

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
  let initialLatest: BoardVisualFrame | null = null;
  let lastApplied: BoardVisualFrame | null = null;
  let writerCheckpoint: BoardVisualFrame | null = null;
  let pendingCommittedRecoveryFrame: BoardVisualFrame | null = null;
  let tokenSequence = 0;
  let recoveryReturnMode: BoardWriterMode = 'idle';
  let recoveryError: Error | null = null;
  let networkAwaitingStarted = false;
  let networkCommittedApplied = false;
  const hostLeaseOwner = Object.freeze({});
  const idleWaiters = new Set<IdleWaiter>();
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

  const flushIdleWaiters = () => {
    if (!ready || mode !== 'idle' || idleWaiters.size === 0) return;
    const waiters = Array.from(idleWaiters);
    idleWaiters.clear();
    for (const waiter of waiters) waiter.resolve();
  };

  const rejectIdleWaiters = (error: Error) => {
    if (idleWaiters.size === 0) return;
    const waiters = Array.from(idleWaiters);
    idleWaiters.clear();
    for (const waiter of waiters) waiter.reject(error);
  };

  const assertAlive = () => {
    if (mode === 'destroyed') throw new Error('BoardVisualController is destroyed');
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

  const enterFailureRecovery = (
    error: unknown,
    returnMode: BoardWriterMode,
    event: string
  ): Error => {
    const normalized = toError(error, 'Board visual backend failed');
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

  const applyReadyFrame = (frame: BoardVisualFrame) => {
    backend.applyFrame(frame);
    lastApplied = frame;
    diagnostics.record('frame:applied', { frameToken: frame.frameToken, revision: frame.model.visualRevision });
    return true;
  };

  const apply = (frame: BoardVisualFrame) => {
    if (!ready) {
      initialLatest = frame;
      diagnostics.record('frame:queued-before-ready', { frameToken: frame.frameToken });
      return false;
    }
    return applyReadyFrame(frame);
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
    target: BoardVisualFrame,
    returnMode: BoardWriterMode = recoveryReturnMode
  ) => {
    lastApplied = target;
    pendingLatest = null;
    initialLatest = null;
    ready = true;
    recoveryError = null;
    const nextMode = returnMode === 'recovering' ? (activeToken ? 'playback' : 'idle') : returnMode;
    recoveryReturnMode = nextMode;
    setMode(nextMode);
    settleReadySuccess();
    diagnostics.record('recovery:restored', { frameToken: target.frameToken });
  };

  return {
    async mount(nextHost: HTMLElement) {
      assertAlive();
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
      const completeMount = () => {
          backendMounted = true;
          const initial = initialLatest;
          if (initial) applyReadyFrame(initial);
          initialLatest = null;
          ready = true;
          recoveryError = null;
          settleReadySuccess();
          diagnostics.record('backend:ready', { kind: backend.kind });
          flushIdleWaiters();
      };
      const failMount = (error: unknown) => {
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
          completeMount();
          mountPromise = Promise.resolve();
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
    getActiveFrameToken() {
      return activeToken?.frameToken || null;
    },
    getActiveWriterToken() {
      return activeToken;
    },
    getBackendKind() {
      return backend.kind;
    },
    getVisualFrameDigest() {
      return computeVisualFrameDigest(lastApplied);
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
      if (ready && mode === 'idle') return Promise.resolve();
      return new Promise<void>((resolve, reject) => {
        idleWaiters.add(Object.freeze({ resolve, reject }));
      });
    },
    submitFrame(frame: BoardVisualFrame) {
      assertAlive();
      if (mode === 'recovering') {
        assertFrameMatchesActiveToken(frame);
        pendingLatest = frame;
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
          return apply(frame);
        } catch (error) {
          pendingLatest = frame;
          throw enterFailureRecovery(error, 'idle', 'frame:idle-apply-error');
        }
      }
      if (mode === 'playback') {
        if (!activeToken || frame.frameToken !== activeToken.frameToken) {
          throw new Error('Cannot coalesce a visual frame from a different playback token');
        }
        pendingLatest = frame;
        diagnostics.record('frame:coalesced', { frameToken: frame.frameToken });
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
      activeToken = Object.freeze({ id: ++tokenSequence, frameToken: String(frameToken), mode: writerMode });
      writerCheckpoint = lastApplied;
      pendingLatest = null;
      pendingCommittedRecoveryFrame = null;
      networkAwaitingStarted = false;
      networkCommittedApplied = false;
      setMode('playback');
      diagnostics.record('writer:claimed', { id: activeToken.id, frameToken: activeToken.frameToken, mode: writerMode });
      return activeToken;
    },
    reclaimWriter(token: BoardWriterToken, frameToken: string, writerMode: 'local' | 'network'): BoardWriterToken {
      assertToken(token);
      if (!ready) throw new Error('Cannot reclaim board visual writer before backend readiness');
      if (mode !== 'playback') throw new Error('Board writer reclaim requires playback mode');
      activeToken = Object.freeze({ id: ++tokenSequence, frameToken: String(frameToken), mode: writerMode });
      if (!writerCheckpoint) writerCheckpoint = lastApplied;
      pendingLatest = null;
      pendingCommittedRecoveryFrame = null;
      networkAwaitingStarted = false;
      networkCommittedApplied = false;
      diagnostics.record('writer:reclaimed', { id: activeToken.id, frameToken: activeToken.frameToken, mode: writerMode });
      return activeToken;
    },
    async playPhase(
      token: BoardWriterToken,
      events: readonly unknown[],
      providedScope?: BoardPlaybackPhaseScope
    ) {
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
      await backend.playPhase(events, context);
    },
    async abortWriterBeforeHandoff(token: BoardWriterToken, checkpoint?: BoardVisualFrame) {
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
        await backend.restore(target);
        lastApplied = target;
        pendingLatest = null;
        initialLatest = null;
        pendingCommittedRecoveryFrame = null;
        recoveryError = null;
        diagnostics.record('writer:aborted-before-handoff', { id: token.id, frameToken: token.frameToken });
        activeToken = null;
        writerCheckpoint = null;
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
        await backend.restore(target);
        lastApplied = target;
        pendingLatest = null;
        initialLatest = null;
        pendingCommittedRecoveryFrame = null;
        ready = true;
        recoveryError = null;
        diagnostics.record('writer:cancelled-after-handoff', { id: token.id, frameToken: token.frameToken });
        activeToken = null;
        writerCheckpoint = null;
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
      pendingLatest = null;
      pendingCommittedRecoveryFrame = null;
      networkAwaitingStarted = true;
      networkCommittedApplied = false;
      setMode('awaiting-frame-commit');
    },
    async applyCommittedFrame(token: BoardWriterToken, frame: BoardVisualFrame) {
      assertToken(token);
      if (mode !== 'awaiting-frame-commit') throw new Error('Committed frame apply requires awaiting-frame-commit');
      if (!networkAwaitingStarted) throw new Error('Committed frame apply requires beginAwaitingFrameCommit');
      if (frame.frameToken !== token.frameToken) throw new Error('Committed frame token mismatch');
      try {
        if (!ready) throw new Error('Committed frame apply requires backend readiness');
        if (!apply(frame)) throw new Error('Committed board frame was not applied');
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
          await backend.restore(target);
          lastApplied = target;
        } else {
          if (!ready) throw new Error('Committed frame restore requires backend readiness');
          applyReadyFrame(target);
        }
        pendingLatest = null;
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
    releaseWriter(token: BoardWriterToken, finalFrame?: BoardVisualFrame) {
      assertToken(token);
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
      if (frame) {
        if (frame.frameToken !== token.frameToken) throw new Error('Final visual frame token mismatch');
        try {
          if (!apply(frame)) throw new Error('Final board frame was not applied');
        } catch (error) {
          pendingLatest = frame;
          throw enterFailureRecovery(error, 'playback', 'frame:final-apply-error');
        }
      }
      pendingLatest = null;
      pendingCommittedRecoveryFrame = null;
      diagnostics.record('writer:released', { id: token.id, frameToken: token.frameToken });
      activeToken = null;
      writerCheckpoint = null;
      networkAwaitingStarted = false;
      networkCommittedApplied = false;
      setMode('idle');
      return true;
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
    async restore(frame?: BoardVisualFrame) {
      assertAlive();
      if (mode !== 'recovering') throw new Error('Board restore requires recovering mode');
      if (
        activeToken?.mode === 'network'
        && recoveryReturnMode === 'awaiting-frame-commit'
        && networkAwaitingStarted
        && !networkCommittedApplied
      ) {
        throw new Error('Strict-network committed recovery requires restoreCommittedFrame');
      }
      const target = frame || pendingLatest || lastApplied;
      if (!target) throw new Error('Board restore has no checkpoint frame');
      if (activeToken) assertFrameMatchesActiveToken(target);
      if (readySettled && !ready) beginReadyCycle();
      try {
        if (!backendMounted) throw new Error('Board restore requires a mounted backend');
        await backend.restore(target);
        finishSuccessfulRestore(target);
        return true;
      } catch (error) {
        throw enterFailureRecovery(error, recoveryReturnMode, 'recovery:restore-error');
      }
    },
    async replaceBackend(nextBackend: BoardVisualBackend) {
      assertAlive();
      if (!host) throw new Error('Cannot replace an unmounted board backend');
      if (!ready && mode !== 'recovering') {
        throw new Error('Cannot replace a board backend before the current mount settles');
      }
      if (HOST_BACKEND_LEASES.get(host) !== hostLeaseOwner) {
        throw new Error('Cannot replace backend without the active host lease');
      }
      beginReadyCycle();
      const checkpoint = pendingLatest || initialLatest || lastApplied;
      const returnMode = mode === 'recovering' ? recoveryReturnMode : mode;
      try {
        backend.destroy();
        backendMounted = false;
        ready = false;
        backend = nextBackend;
        setHostRendererAttribute(nextBackend.kind);
        await Promise.resolve(backend.mount(host, { diagnostics }));
        backendMounted = true;
        let restoreTarget = pendingLatest || initialLatest || checkpoint || lastApplied;
        if (restoreTarget) {
          await backend.restore(restoreTarget);
          const queuedAfterRestore = pendingLatest || initialLatest;
          if (queuedAfterRestore && queuedAfterRestore !== restoreTarget) {
            applyReadyFrame(queuedAfterRestore);
            restoreTarget = queuedAfterRestore;
          }
        }
        if (restoreTarget) finishSuccessfulRestore(restoreTarget, returnMode);
        else {
          ready = true;
          recoveryError = null;
          setMode(returnMode === 'recovering' ? (activeToken ? 'playback' : 'idle') : returnMode);
          settleReadySuccess();
        }
        diagnostics.record('backend:replaced', { kind: backend.kind });
        flushIdleWaiters();
      } catch (error) {
        if (!backendMounted) setHostRendererAttribute(null);
        throw enterFailureRecovery(error, returnMode, 'backend:replace-error');
      }
    },
    getCellClientRect(row: number, col: number) {
      return backend.getCellClientRect(row, col);
    },
    resize(layout: any) {
      assertAlive();
      backend.resize(layout);
    },
    invalidate() {
      const candidate = backend as any;
      if (typeof candidate.invalidate === 'function') candidate.invalidate();
    },
    getSnapshot() {
      return Object.freeze({
        mode,
        ready,
        backendKind: backend.kind,
        activeFrameToken: activeToken?.frameToken || null,
        pendingFrameToken: pendingLatest?.frameToken || initialLatest?.frameToken || null,
        lastAppliedFrameToken: lastApplied?.frameToken || null
      });
    },
    destroy() {
      if (mode === 'destroyed') return;
      let destroyError: Error | null = null;
      try {
        backend.destroy();
      } catch (error) {
        destroyError = toError(error, 'Board visual backend destroy failed');
        diagnostics.record('backend:destroy-error', { message: destroyError.message });
      }
      backendMounted = false;
      ready = false;
      activeToken = null;
      writerCheckpoint = null;
      pendingLatest = null;
      initialLatest = null;
      pendingCommittedRecoveryFrame = null;
      networkAwaitingStarted = false;
      networkCommittedApplied = false;
      recoveryError = null;
      releaseHostLease();
      setMode('destroyed');
      const error = new Error('BoardVisualController was destroyed before becoming idle');
      rejectIdleWaiters(error);
      settleReadyFailure(error);
      if (destroyError) throw destroyError;
    }
  };
}

export = { createBoardVisualController };
