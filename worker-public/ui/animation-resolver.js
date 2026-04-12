// Lightweight resolver to safely provide AnimationHelpers and related helpers.
(function (root, factory) {
    if (typeof module === 'object' && module.exports) {
        module.exports = factory(root);
    } else {
        root.AnimationResolver = factory(root);
    }
}(typeof globalThis !== 'undefined' ? globalThis : (typeof self !== 'undefined' ? self : this), function (root) {
    'use strict';

    function getRoot() {
        if (root && root.window && typeof root.window === 'object') return root.window;
        return root || {};
    }

    function resolveGlobal(name) {
        if (!name) return null;
        const candidates = [getRoot()];
        try {
            if (typeof globalThis !== 'undefined' && globalThis && candidates.indexOf(globalThis) === -1) {
                candidates.push(globalThis);
            }
        } catch (e) { /* ignore */ }
        try {
            if (typeof window !== 'undefined' && window && candidates.indexOf(window) === -1) {
                candidates.push(window);
            }
        } catch (e) { /* ignore */ }
        for (let index = 0; index < candidates.length; index += 1) {
            const candidate = candidates[index];
            try {
                if (candidate && typeof candidate[name] !== 'undefined') {
                    return candidate[name];
                }
            } catch (e) { /* ignore */ }
        }
        return null;
    }

    function resolveModule(modulePath) {
        if (typeof require !== 'function' || !modulePath) return null;
        try {
            return require(modulePath);
        } catch (e) {
            return null;
        }
    }

    function resolveModuleOrGlobal(modulePath, globalName) {
        return resolveModule(modulePath) || resolveGlobal(globalName);
    }

    function resolveExport(modulePath, globalName, exportName) {
        const resolved = resolveModuleOrGlobal(modulePath, globalName);
        if (!resolved) {
            return exportName ? resolveGlobal(exportName) : null;
        }
        if (!exportName) return resolved;
        if (typeof resolved[exportName] !== 'undefined') return resolved[exportName];
        return resolveGlobal(exportName);
    }

    function resolveMethod(modulePath, globalName, methodName) {
        const owner = resolveModuleOrGlobal(modulePath, globalName);
        if (owner && typeof owner[methodName] === 'function') {
            return owner[methodName].bind(owner);
        }
        const globalFn = resolveGlobal(methodName);
        return typeof globalFn === 'function' ? globalFn : null;
    }

    function getAnimationShared() {
        return resolveModuleOrGlobal('./animation-helpers', 'AnimationHelpers')
            || resolveGlobal('AnimationShared')
            || null;
    }

    function isNoAnim() {
        const shared = getAnimationShared();
        return (shared && typeof shared.isNoAnim === 'function')
            ? shared.isNoAnim
            : function () { return false; };
    }

    function getTimer() {
        const shared = getAnimationShared();
        try {
            if (shared && typeof shared.getTimer === 'function') return shared.getTimer();
        } catch (e) { /* ignore */ }
        return {
            setTimeout: (fn, ms) => setTimeout(fn, ms),
            clearTimeout: (id) => clearTimeout(id),
            clearAll: () => {},
            pendingCount: () => 0,
            newScope: () => null,
            clearScope: () => {}
        };
    }

    return {
        getRoot,
        resolveGlobal,
        resolveModule,
        resolveModuleOrGlobal,
        resolveExport,
        resolveMethod,
        getAnimationShared,
        isNoAnim,
        getTimer
    };
}));
