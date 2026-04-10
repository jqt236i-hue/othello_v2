(function (root, factory) {
    if (typeof module === 'object' && module.exports) {
        module.exports = factory(root);
    } else {
        root.BoardUpdateSyncRuntime = factory(root);
    }
}(typeof globalThis !== 'undefined' ? globalThis : (typeof self !== 'undefined' ? self : this), function (root) {
    'use strict';

    function cloneContext(context) {
        if (!context || typeof context !== 'object') return null;
        return Object.assign({}, context);
    }

    function normalizeContext(context) {
        if (!context || typeof context !== 'object') return null;
        const next = {};
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

    function getRoot() {
        if (root && root.window && typeof root.window === 'object') return root.window;
        try {
            if (typeof window !== 'undefined' && window) return window;
        } catch (e) { /* ignore */ }
        return root || {};
    }

    function armBoardUpdateSyncContext(context) {
        const normalized = normalizeContext(context);
        const target = getRoot();
        try {
            target.__boardUpdateSyncContext = normalized ? cloneContext(normalized) : null;
        } catch (e) { /* ignore */ }
        return peekBoardUpdateSyncContext();
    }

    function peekBoardUpdateSyncContext() {
        const target = getRoot();
        try {
            return cloneContext(target.__boardUpdateSyncContext);
        } catch (e) {
            return null;
        }
    }

    function clearBoardUpdateSyncContext() {
        const target = getRoot();
        try {
            target.__boardUpdateSyncContext = null;
        } catch (e) { /* ignore */ }
        return true;
    }

    function consumeBoardUpdateSyncContext() {
        const current = peekBoardUpdateSyncContext();
        clearBoardUpdateSyncContext();
        return current;
    }

    return {
        armBoardUpdateSyncContext,
        peekBoardUpdateSyncContext,
        consumeBoardUpdateSyncContext,
        clearBoardUpdateSyncContext
    };
}));
