/**
 * @file board-update-sync-runtime.ts
 * @description Runtime context for board update synchronization
 */

declare const __non_webpack_require__: NodeRequire | undefined;

const _require: NodeRequire = (typeof __non_webpack_require__ !== 'undefined')
  ? __non_webpack_require__
  : require;

interface BoardUpdateContext {
  allowBoardUpdateDuringPlayback?: boolean;
  source?: string;
  reason?: string;
}

interface RootWithWindow {
  window?: Window;
  __boardUpdateSyncContext?: BoardUpdateContext | null;
}

function cloneContext(context: BoardUpdateContext | null): BoardUpdateContext | null {
  if (!context || typeof context !== 'object') return null;
  return Object.assign({}, context);
}

function normalizeContext(context: BoardUpdateContext | null | undefined): BoardUpdateContext | null {
  if (!context || typeof context !== 'object') return null;
  const next: BoardUpdateContext = {};
  if (context.allowBoardUpdateDuringPlayback === true) {
    next.allowBoardUpdateDuringPlayback = true;
  }
  if (typeof context.source === 'string' && context.source.trim()) {
    next.source = context.source.trim();
  }
  if (typeof context.reason === 'string' && context.reason.trim()) {
    next.reason = context.reason.trim();
  }
  return Object.keys(next).length > 0 ? next : null;
}

function getRoot(): Window {
  const root = (typeof globalThis !== 'undefined' ? globalThis : {}) as RootWithWindow;
  if (root && root.window && typeof root.window === 'object') return root.window;
  try {
    if (typeof window !== 'undefined' && window) return window;
  } catch (e) { /* ignore */ }
  return (root || {}) as Window;
}

function armBoardUpdateSyncContext(context: BoardUpdateContext | null | undefined): BoardUpdateContext | null {
  const normalized = normalizeContext(context);
  const target = getRoot() as Window & { __boardUpdateSyncContext?: BoardUpdateContext | null };
  try {
    target.__boardUpdateSyncContext = normalized ? cloneContext(normalized) : null;
  } catch (e) { /* ignore */ }
  return peekBoardUpdateSyncContext();
}

function peekBoardUpdateSyncContext(): BoardUpdateContext | null {
  const target = getRoot() as Window & { __boardUpdateSyncContext?: BoardUpdateContext | null };
  try {
    return cloneContext(target.__boardUpdateSyncContext ?? null);
  } catch (e) {
    return null;
  }
}

function clearBoardUpdateSyncContext(): boolean {
  const target = getRoot() as Window & { __boardUpdateSyncContext?: BoardUpdateContext | null };
  try {
    target.__boardUpdateSyncContext = null;
  } catch (e) { /* ignore */ }
  return true;
}

function consumeBoardUpdateSyncContext(): BoardUpdateContext | null {
  const current = peekBoardUpdateSyncContext();
  clearBoardUpdateSyncContext();
  return current;
}

export = {
  armBoardUpdateSyncContext,
  peekBoardUpdateSyncContext,
  consumeBoardUpdateSyncContext,
  clearBoardUpdateSyncContext
};
