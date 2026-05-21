/**
 * @file board-update-dispatch.ts
 * @description Board update dispatch utilities
 */

declare const __non_webpack_require__: NodeRequire | undefined;

const _require: NodeRequire = (typeof __non_webpack_require__ !== 'undefined')
  ? __non_webpack_require__
  : require;

interface BoardUpdateOptions {
  emitBoardUpdate?: ((payload: { source: string; reason: string }) => boolean) | null;
  renderBoard?: (() => void) | null;
  source?: string;
  reason?: string;
}

function getRoot(): Window {
  const base = (typeof globalThis !== 'undefined' ? globalThis : {}) as Window;
  if (base && base.window && typeof base.window === 'object') return base.window;
  try {
    if (typeof window !== 'undefined' && window) return window;
  } catch (e) { /* ignore */ }
  return base;
}

function resolveGlobalFunction(name: string, fallback: unknown): ((...args: unknown[]) => unknown) | null {
  if (typeof fallback === 'function') return fallback as (...args: unknown[]) => unknown;
  const target = getRoot();
  try {
    if (target && typeof (target as unknown as Record<string, unknown>)[name] === 'function') {
      return ((target as unknown as Record<string, unknown>)[name] as (...args: unknown[]) => unknown).bind(target);
    }
  } catch (e) { /* ignore */ }
  try {
    if (typeof globalThis !== 'undefined' && globalThis && typeof (globalThis as Record<string, unknown>)[name] === 'function') {
      return ((globalThis as Record<string, unknown>)[name] as (...args: unknown[]) => unknown).bind(globalThis);
    }
  } catch (e) { /* ignore */ }
  return null;
}

function warnDispatchFailure(message: string, error?: unknown): boolean {
  if (typeof console === 'undefined' || typeof console.warn !== 'function') return false;
  if (typeof error === 'undefined') {
    console.warn('[BoardUpdateDispatch] ' + message);
  } else {
    console.warn('[BoardUpdateDispatch] ' + message, error);
  }
  return false;
}

function requestBoardUpdate(options: BoardUpdateOptions): boolean {
  const config = (options && typeof options === 'object') ? options : {};
  const emitBoardUpdate = resolveGlobalFunction('emitBoardUpdate', config.emitBoardUpdate || null);
  if (emitBoardUpdate) {
    let emitted: unknown;
    try {
      emitted = emitBoardUpdate({
        source: (typeof config.source === 'string' && config.source.trim())
          ? config.source.trim()
          : 'ui.board-update-dispatch',
        reason: (typeof config.reason === 'string' && config.reason.trim())
          ? config.reason.trim()
          : 'requestBoardUpdate'
      });
    } catch (error) {
      return warnDispatchFailure('emitBoardUpdate threw', error);
    }
    if (emitted !== false) return true;
    return warnDispatchFailure('emitBoardUpdate reported failure');
  }

  const renderBoard = resolveGlobalFunction('renderBoard', config.renderBoard || null);
  if (renderBoard) {
    try {
      renderBoard();
      return true;
    } catch (error) {
      return warnDispatchFailure('renderBoard fallback failed', error);
    }
  }

  return warnDispatchFailure('no board update entrypoint available');
}

export = {
  requestBoardUpdate
};
