"use strict";
// Shared UI bootstrap helpers for game<->ui boundary and classic-script/runtime resolution.
(function () {
    'use strict';
    let _registry = {};
    function isObjectLike(value) {
        return !!value && (typeof value === 'object' || typeof value === 'function');
    }
    function collectKnownRoots(preferredRoot) {
        const roots = [];
        const pushUnique = (value) => {
            if (!isObjectLike(value))
                return;
            if (roots.indexOf(value) >= 0)
                return;
            roots.push(value);
        };
        pushUnique(preferredRoot);
        try {
            if (typeof window !== 'undefined')
                pushUnique(window);
        }
        catch (e) { /* ignore */ }
        try {
            if (typeof globalThis !== 'undefined')
                pushUnique(globalThis);
        }
        catch (e) { /* ignore */ }
        try {
            if (typeof self !== 'undefined')
                pushUnique(self);
        }
        catch (e) { /* ignore */ }
        return roots;
    }
    function resolveOptionalModule(options) {
        const opts = (options && typeof options === 'object') ? options : {};
        const globalName = typeof opts.globalName === 'string' ? opts.globalName.trim() : '';
        const requirePath = typeof opts.requirePath === 'string' ? opts.requirePath.trim() : '';
        const validate = typeof opts.validate === 'function' ? opts.validate : () => true;
        const roots = collectKnownRoots(opts.root);
        if (globalName) {
            for (let index = 0; index < roots.length; index += 1) {
                const scope = roots[index];
                try {
                    const candidate = scope[globalName];
                    if (candidate && validate(candidate))
                        return candidate;
                }
                catch (e) { /* ignore */ }
            }
        }
        if (requirePath && typeof require === 'function') {
            try {
                const candidate = require(requirePath);
                if (candidate && validate(candidate))
                    return candidate;
            }
            catch (e) { /* ignore */ }
        }
        return null;
    }
    function resolveUIBootstrap(root) {
        return resolveOptionalModule({
            root,
            globalName: 'UIBootstrap',
            requirePath: '../../ui/bootstrap',
            validate: (candidate) => !!candidate && (typeof candidate.installGameDI === 'function'
                || typeof candidate.registerUIGlobals === 'function'
                || typeof candidate.getRegisteredUIGlobals === 'function')
        });
    }
    function resolvePlaybackRuntime(root) {
        return resolveOptionalModule({
            root,
            globalName: 'PlaybackRuntime',
            requirePath: '../../ui/playback-runtime',
            validate: (candidate) => !!candidate && typeof candidate === 'object'
        });
    }
    function resolvePlaybackStateManager(root) {
        return resolveOptionalModule({
            root,
            globalName: 'PlaybackStateManager',
            requirePath: '../../ui/playback-state-manager',
            validate: (candidate) => !!candidate && typeof candidate === 'object'
        });
    }
    function toUIImplKey(key) {
        const normalized = String(key || '').trim();
        if (!normalized)
            return '__uiImpl';
        return normalized.indexOf('__uiImpl_') === 0 ? normalized : `__uiImpl_${normalized}`;
    }
    function readUIImpl(root, key) {
        const prop = toUIImplKey(key);
        const roots = collectKnownRoots(root);
        for (let index = 0; index < roots.length; index += 1) {
            const scope = roots[index];
            try {
                const candidate = scope[prop];
                if (candidate && typeof candidate === 'object')
                    return candidate;
            }
            catch (e) { /* ignore */ }
        }
        return {};
    }
    function writeUIImpl(root, key, value) {
        const prop = toUIImplKey(key);
        const nextValue = (value && typeof value === 'object') ? Object.assign({}, value) : {};
        const roots = collectKnownRoots(root);
        for (let index = 0; index < roots.length; index += 1) {
            try {
                roots[index][prop] = Object.assign({}, nextValue);
            }
            catch (e) { /* ignore */ }
        }
        return nextValue;
    }
    function mergeUIImpl(root, key, payload) {
        return writeUIImpl(root, key, Object.assign({}, readUIImpl(root, key), payload || {}));
    }
    function getRegisteredUIGlobals() {
        return Object.assign({}, _registry);
    }
    function registerUIGlobals(obj) {
        const payload = (obj && typeof obj === 'object') ? obj : {};
        _registry = Object.assign(_registry, payload);
        const uiBoot = resolveUIBootstrap(undefined);
        if (uiBoot && uiBoot !== api && typeof uiBoot.registerUIGlobals === 'function') {
            try {
                uiBoot.registerUIGlobals(payload);
            }
            catch (e) { /* ignore */ }
        }
        return getRegisteredUIGlobals();
    }
    const api = {
        registerUIGlobals,
        getRegisteredUIGlobals,
        resolveUIBootstrap,
        resolvePlaybackRuntime,
        resolvePlaybackStateManager,
        readUIImpl,
        writeUIImpl,
        mergeUIImpl
    };
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = api;
    }
    try {
        if (typeof globalThis !== 'undefined')
            globalThis.SharedUIBootstrap = api;
    }
    catch (e) { /* ignore */ }
})();
//# sourceMappingURL=ui-bootstrap-shared.js.map