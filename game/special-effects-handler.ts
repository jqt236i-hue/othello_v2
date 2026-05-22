declare const __non_webpack_require__: NodeRequire | undefined;

const _require: NodeRequire = (typeof __non_webpack_require__ !== "undefined")
  ? __non_webpack_require__
  : require;

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
 * This file intentionally does not implement any effect logic. It only
 * sanity-checks split module exports to avoid silent failures.
 */

(function () {
    const requiredModules = [
        { id: './special-effects/bombs', name: 'processBombs' },
        { id: './special-effects/dragons', name: 'processUltimateReverseDragonsAtTurnStart' },
        { id: './special-effects/breeding', name: 'processBreedingEffectsAtTurnStart' },
        { id: './special-effects/hyperactive', name: 'processHyperactiveMovesAtTurnStart' },
        { id: './special-effects/udg', name: 'processUltimateDestroyGodsAtTurnStart' }
    ];

    let cardsModule: any = null;
    try {
        cardsModule = _require('./logic/cards');
    } catch (e) { /* ignore */ }
    if (!cardsModule) {
        console.error('[special-effects-handler] CardLogic is not loaded. Include game/logic/cards.js before special-effects scripts.');
        return;
    }

    const missing: string[] = [];
    for (const entry of requiredModules) {
        try {
            const mod = _require(entry.id);
            if (!mod || typeof mod[entry.name] !== 'function') {
                missing.push(entry.name);
            }
        } catch (e) {
            missing.push(entry.name);
        }
    }
    if (missing.length > 0) {
        console.warn('[special-effects-handler] Missing split effect exports:', missing);
    }
}());

export {};
