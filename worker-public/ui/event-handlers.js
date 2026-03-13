/**
 * @file event-handlers.js
 * @description Shim for split UI handlers
 */

if (typeof initializeUI === 'undefined') {
    try { if (typeof isDebugLogAvailable === 'function' && isDebugLogAvailable()) console.warn('[UI] initializeUI not loaded (ui/handlers/init.js)'); } catch (e) { }
}
