"use strict";
/**
 * @file event-handlers.ts
 * @description Shim for split UI handlers
 */
Object.defineProperty(exports, "__esModule", { value: true });
const _require = (typeof __non_webpack_require__ !== 'undefined')
    ? __non_webpack_require__
    : require;
if (typeof initializeUI === 'undefined') {
    try {
        if (typeof isDebugLogAvailable === 'function' && isDebugLogAvailable()) {
            console.warn('[UI] initializeUI not loaded (ui/handlers/init.js)');
        }
    }
    catch (e) { /* ignore */ }
}
//# sourceMappingURL=event-handlers.js.map