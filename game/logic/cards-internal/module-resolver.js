(function (root, factory) {
    if (typeof module === 'object' && module.exports) {
        module.exports = factory();
    } else {
        root.CardModuleResolver = factory();
    }
}(typeof globalThis !== 'undefined' ? globalThis : (typeof self !== 'undefined' ? self : this), function () {
    'use strict';

    function readGlobalModule(globalName) {
        if (!globalName) return null;
        try {
            if (typeof globalThis !== 'undefined' && globalThis && globalThis[globalName]) {
                return globalThis[globalName];
            }
        } catch (error) {
            void error;
        }
        return null;
    }

    function resolveModule(options) {
        const opts = (options && typeof options === 'object') ? options : {};
        const isValid = (typeof opts.isValid === 'function')
            ? opts.isValid
            : function isTruthy(value) { return !!value; };
        const label = String(opts.label || opts.globalName || opts.requirePath || 'module').trim() || 'module';

        let resolvedModule = null;
        if (typeof opts.readLocal === 'function') {
            try {
                resolvedModule = opts.readLocal();
            } catch (error) {
                void error;
            }
            if (isValid(resolvedModule)) return resolvedModule;
        }
        if (opts.requirePath && typeof opts.requireFn === 'function') {
            try {
                resolvedModule = opts.requireFn(opts.requirePath);
            } catch (error) {
                void error;
            }
            if (isValid(resolvedModule)) return resolvedModule;
        }
        if (opts.globalName) {
            resolvedModule = readGlobalModule(opts.globalName);
            if (isValid(resolvedModule)) return resolvedModule;
        }
        if (opts.required) {
            throw new Error(label + ' not loaded');
        }
        return null;
    }

    return {
        resolveModule
    };
}));