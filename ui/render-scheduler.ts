type RenderReason = string | { reason?: string; source?: string };

type RenderSchedulerDeps = {
  requestAnimationFrame?: (callback: FrameRequestCallback) => number;
  cancelAnimationFrame?: (id: number) => void;
  setTimeout?: (callback: () => void, ms: number) => any;
  clearTimeout?: (id: any) => void;
  renderBoard?: (() => void) | null;
  renderCardUI?: (() => void) | null;
  updateStatus?: (() => void) | null;
  shouldDeferUiSync?: (() => boolean) | null;
};

type RenderSchedulerState = {
  boardQueued: boolean;
  cardUiQueued: boolean;
  statusQueued: boolean;
  scheduled: boolean;
  deferredUntilIdle: boolean;
  reasons: string[];
};

function normalizeReason(input?: RenderReason): string {
  if (!input) return '';
  if (typeof input === 'string') return input.trim();
  const reason = typeof input.reason === 'string' ? input.reason.trim() : '';
  const source = typeof input.source === 'string' ? input.source.trim() : '';
  return [source, reason].filter(Boolean).join(':');
}

function resolveRoot(): any {
  const base: any = typeof globalThis !== 'undefined' ? globalThis : {};
  if (base && base.window && typeof base.window === 'object') return base.window;
  try {
    if (typeof window !== 'undefined' && window) return window;
  } catch (e) { /* ignore */ }
  return base;
}

function resolveRuntimeFunction(name: string, fallback: any): (() => void) | null {
  if (typeof fallback === 'function') return fallback;
  const root = resolveRoot();
  try {
    if (root && typeof root[name] === 'function') return root[name].bind(root);
  } catch (e) { /* ignore */ }
  try {
    if (typeof globalThis !== 'undefined' && typeof (globalThis as any)[name] === 'function') {
      return (globalThis as any)[name].bind(globalThis);
    }
  } catch (e) { /* ignore */ }
  return null;
}

function createRenderScheduler(deps?: RenderSchedulerDeps) {
  let currentDeps: RenderSchedulerDeps = deps && typeof deps === 'object' ? Object.assign({}, deps) : {};
  const state: RenderSchedulerState = {
    boardQueued: false,
    cardUiQueued: false,
    statusQueued: false,
    scheduled: false,
    deferredUntilIdle: false,
    reasons: []
  };
  let frameId: any = null;

  const getRaf = () => currentDeps.requestAnimationFrame
    || ((callback: FrameRequestCallback) => {
      const setTimer = currentDeps.setTimeout || setTimeout;
      return setTimer(() => callback(Date.now()), 16) as any;
    });

  const getCancel = () => currentDeps.cancelAnimationFrame
    || ((id: any) => {
      const clearTimer = currentDeps.clearTimeout || clearTimeout;
      clearTimer(id);
    });

  const rememberReason = (reason?: RenderReason) => {
    const normalized = normalizeReason(reason);
    if (normalized) state.reasons.push(normalized);
  };

  const shouldDefer = (ignorePlayback?: boolean) => {
    if (ignorePlayback === true) return false;
    return typeof currentDeps.shouldDeferUiSync === 'function'
      ? currentDeps.shouldDeferUiSync() === true
      : false;
  };

  const schedule = () => {
    if (state.scheduled) return true;
    state.scheduled = true;
    const raf = getRaf();
    frameId = raf(() => {
      frameId = null;
      state.scheduled = false;
      flushNow();
    });
    return true;
  };

  const flushNow = (options?: { ignorePlayback?: boolean }) => {
    if (!state.boardQueued && !state.cardUiQueued && !state.statusQueued) return false;
    if (shouldDefer(options && options.ignorePlayback)) {
      state.deferredUntilIdle = true;
      schedule();
      return false;
    }

    const runBoard = state.boardQueued;
    const runCard = state.cardUiQueued;
    const runStatus = state.statusQueued;
    state.boardQueued = false;
    state.cardUiQueued = false;
    state.statusQueued = false;
    state.deferredUntilIdle = false;
    state.reasons = [];

    if (runBoard) {
      const renderBoard = resolveRuntimeFunction('renderBoard', currentDeps.renderBoard);
      if (renderBoard) renderBoard();
    }
    if (runCard) {
      const renderCardUI = resolveRuntimeFunction('renderCardUI', currentDeps.renderCardUI);
      if (renderCardUI) renderCardUI();
    }
    if (runStatus) {
      const updateStatus = resolveRuntimeFunction('updateStatus', currentDeps.updateStatus);
      if (updateStatus) updateStatus();
    }
    return true;
  };

  return {
    configure(nextDeps: RenderSchedulerDeps) {
      currentDeps = Object.assign({}, currentDeps, nextDeps || {});
      return true;
    },
    requestBoardRender(reason?: RenderReason) {
      state.boardQueued = true;
      rememberReason(reason);
      return schedule();
    },
    requestCardUiRender(reason?: RenderReason) {
      state.cardUiQueued = true;
      rememberReason(reason);
      return schedule();
    },
    requestStatusUpdate(reason?: RenderReason) {
      state.statusQueued = true;
      rememberReason(reason);
      return schedule();
    },
    flushNow,
    cancel() {
      if (state.scheduled && frameId !== null) getCancel()(frameId);
      frameId = null;
      state.scheduled = false;
      return true;
    },
    getState() {
      return Object.assign({}, state, { reasons: state.reasons.slice() });
    }
  };
}

const defaultScheduler = createRenderScheduler();

const RenderScheduler = {
  createRenderScheduler,
  configureRenderScheduler: defaultScheduler.configure,
  requestBoardRender: defaultScheduler.requestBoardRender,
  requestCardUiRender: defaultScheduler.requestCardUiRender,
  requestStatusUpdate: defaultScheduler.requestStatusUpdate,
  flushVisualUpdates: defaultScheduler.flushNow,
  cancelVisualUpdates: defaultScheduler.cancel,
  getVisualUpdateState: defaultScheduler.getState
};

try {
  const root = resolveRoot();
  if (root && typeof root === 'object') {
    root.RenderScheduler = root.RenderScheduler || RenderScheduler;
    root.requestBoardRender = root.requestBoardRender || RenderScheduler.requestBoardRender;
    root.requestCardUiRender = root.requestCardUiRender || RenderScheduler.requestCardUiRender;
  }
} catch (e) { /* ignore */ }

export = RenderScheduler;
