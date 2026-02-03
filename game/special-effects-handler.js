/**
 * @file special-effects-handler.js
 * @description Compatibility shim for split special-effect handlers.
 *
 * This project previously had a monolithic special-effects-handler.js.
 * It has been split into:
 * - game/special-effects/bombs.js
 * - game/special-effects/dragons.js
 * - game/special-effects/breeding.js
 * - game/special-effects/hyperactive.js
 * - game/special-effects/udg.js
 * - game/special-effects/protections.js
 *
 * The split modules attach the legacy global functions on the global scope
 * (e.g., processBombs), so this file intentionally does not implement
 * any effect logic. It only sanity-checks load order to avoid silent failures.
 */

(function () {
    const required = [
        'processBombs',
        'processUltimateReverseDragonsAtTurnStart',
        'processBreedingEffectsAtTurnStart',
        'processHyperactiveMovesAtTurnStart',
        'processUltimateDestroyGodsAtTurnStart'
    ];

    if (typeof CardLogic === 'undefined') {
        console.error('[special-effects-handler] CardLogic is not loaded. Include game/logic/cards.js before special-effects scripts.');
        return;
    }

    const missing = required.filter((k) => typeof globalThis !== 'undefined' && typeof globalThis[k] !== 'function');
    if (missing.length > 0) {
        console.warn('[special-effects-handler] Missing split effect globals (load order issue?):', missing);
    }
}());
