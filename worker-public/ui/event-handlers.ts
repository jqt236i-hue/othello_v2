/**
 * @file event-handlers.ts
 * @description Shim for split UI handlers
 */

declare const __non_webpack_require__: NodeRequire | undefined;

const _require: NodeRequire = (typeof __non_webpack_require__ !== 'undefined')
  ? __non_webpack_require__
  : require;

declare const isDebugLogAvailable: (() => boolean) | undefined;
declare const initializeUI: (() => void) | undefined;

if (typeof initializeUI === 'undefined') {
  try {
    if (typeof isDebugLogAvailable === 'function' && isDebugLogAvailable()) {
      console.warn('[UI] initializeUI not loaded (ui/handlers/init.js)');
    }
  } catch (e) { /* ignore */ }
}

export {};
