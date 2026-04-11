(function (root, factory) {
    if (typeof module === 'object' && module.exports) {
        module.exports = factory(root);
    } else {
        root.BoardUpdateDispatch = factory(root);
    }
}(typeof globalThis !== 'undefined' ? globalThis : (typeof self !== 'undefined' ? self : this), function (root) {
    'use strict';

    function getRoot() {
        const base = root || (typeof globalThis !== 'undefined' ? globalThis : {});
        if (base && base.window && typeof base.window === 'object') return base.window;
        try {
            if (typeof window !== 'undefined' && window) return window;
        } catch (e) { /* ignore */ }
        return base;
    }

    function resolveGlobalFunction(name, fallback) {
        if (typeof fallback === 'function') return fallback;
        const target = getRoot();
        try {
            if (target && typeof target[name] === 'function') return target[name].bind(target);
        } catch (e) { /* ignore */ }
        try {
            if (typeof globalThis !== 'undefined' && globalThis && typeof globalThis[name] === 'function') {
                return globalThis[name].bind(globalThis);
            }
        } catch (e) { /* ignore */ }
        return null;
    }

    function warnDispatchFailure(message, error) {
        if (typeof console === 'undefined' || typeof console.warn !== 'function') return false;
        if (typeof error === 'undefined') {
            console.warn('[BoardUpdateDispatch] ' + message);
        } else {
            console.warn('[BoardUpdateDispatch] ' + message, error);
        }
        return false;
    }

    function requestBoardUpdate(options) {
        const config = (options && typeof options === 'object') ? options : {};
        const emitBoardUpdate = resolveGlobalFunction('emitBoardUpdate', config.emitBoardUpdate);
        if (emitBoardUpdate) {
            let emitted;
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
            if (emitted === true) return true;
            return warnDispatchFailure('emitBoardUpdate reported failure');
        }

        const renderBoard = resolveGlobalFunction('renderBoard', config.renderBoard);
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

    return {
        requestBoardUpdate
    };
}));
