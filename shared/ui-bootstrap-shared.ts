// Shared UI bootstrap helpers for game<->ui boundary and classic-script/runtime resolution.
(function () {
    'use strict';

    interface UIImpl {
        [key: string]: unknown;
    }

    interface UIBootstrapAPI {
        installGameDI?: (di: unknown) => void;
        registerUIGlobals?: (obj: Record<string, unknown>) => void;
        getRegisteredUIGlobals?: () => Record<string, unknown>;
    }

    interface OptionalModuleOptions {
        globalName?: string;
        requirePath?: string;
        validate?: (candidate: unknown) => boolean;
        root?: unknown;
    }

    let _registry: Record<string, unknown> = {};

    function isObjectLike(value: unknown): boolean {
        return !!value && (typeof value === 'object' || typeof value === 'function');
    }

    function collectKnownRoots(preferredRoot: unknown): object[] {
        const roots: object[] = [];
        const pushUnique = (value: unknown): void => {
            if (!isObjectLike(value)) return;
            if (roots.indexOf(value as object) >= 0) return;
            roots.push(value as object);
        };
        pushUnique(preferredRoot);
        try { if (typeof window !== 'undefined') pushUnique(window); } catch (e) { /* ignore */ }
        try { if (typeof globalThis !== 'undefined') pushUnique(globalThis); } catch (e) { /* ignore */ }
        try { if (typeof self !== 'undefined') pushUnique(self); } catch (e) { /* ignore */ }
        return roots;
    }

    function resolveOptionalModule(options: OptionalModuleOptions): unknown | null {
        const opts = (options && typeof options === 'object') ? options : {};
        const globalName = typeof opts.globalName === 'string' ? opts.globalName.trim() : '';
        const requirePath = typeof opts.requirePath === 'string' ? opts.requirePath.trim() : '';
        const validate = typeof opts.validate === 'function' ? opts.validate : (): boolean => true;
        const roots = collectKnownRoots(opts.root);

        if (globalName) {
            for (let index = 0; index < roots.length; index += 1) {
                const scope = roots[index];
                try {
                    const candidate = (scope as Record<string, unknown>)[globalName];
                    if (candidate && validate(candidate)) return candidate;
                } catch (e) { /* ignore */ }
            }
        }

        if (requirePath && typeof require === 'function') {
            try {
                const candidate = require(requirePath);
                if (candidate && validate(candidate)) return candidate;
            } catch (e) { /* ignore */ }
        }

        return null;
    }

    function resolveUIBootstrap(root: unknown): UIBootstrapAPI | null {
        return resolveOptionalModule({
            root,
            globalName: 'UIBootstrap',
            requirePath: '../ui/bootstrap',
            validate: (candidate): boolean => !!candidate && (
                typeof (candidate as UIBootstrapAPI).installGameDI === 'function'
                || typeof (candidate as UIBootstrapAPI).registerUIGlobals === 'function'
                || typeof (candidate as UIBootstrapAPI).getRegisteredUIGlobals === 'function'
            )
        }) as UIBootstrapAPI | null;
    }

    function resolvePlaybackRuntime(root: unknown): object | null {
        return resolveOptionalModule({
            root,
            globalName: 'PlaybackRuntime',
            requirePath: '../ui/playback-runtime',
            validate: (candidate): boolean => !!candidate && typeof candidate === 'object'
        }) as object | null;
    }

    function resolvePlaybackStateManager(root: unknown): object | null {
        return resolveOptionalModule({
            root,
            globalName: 'PlaybackStateManager',
            requirePath: '../ui/playback-state-manager',
            validate: (candidate): boolean => !!candidate && typeof candidate === 'object'
        }) as object | null;
    }

    function toUIImplKey(key: unknown): string {
        const normalized = String(key || '').trim();
        if (!normalized) return '__uiImpl';
        return normalized.indexOf('__uiImpl_') === 0 ? normalized : `__uiImpl_${normalized}`;
    }

    function readUIImpl(root: unknown, key: unknown): UIImpl {
        const prop = toUIImplKey(key);
        const roots = collectKnownRoots(root);
        for (let index = 0; index < roots.length; index += 1) {
            const scope = roots[index];
            try {
                const candidate = (scope as Record<string, unknown>)[prop];
                if (candidate && typeof candidate === 'object') return candidate as UIImpl;
            } catch (e) { /* ignore */ }
        }
        return {};
    }

    function writeUIImpl(root: unknown, key: unknown, value: unknown): UIImpl {
        const prop = toUIImplKey(key);
        const nextValue = (value && typeof value === 'object') ? Object.assign({}, value as UIImpl) : {};
        const roots = collectKnownRoots(root);
        for (let index = 0; index < roots.length; index += 1) {
            try {
                roots[index][prop as keyof typeof roots[typeof index]] = Object.assign({}, nextValue) as never;
            } catch (e) { /* ignore */ }
        }
        return nextValue;
    }

    function mergeUIImpl(root: unknown, key: unknown, payload: unknown): UIImpl {
        return writeUIImpl(root, key, Object.assign({}, readUIImpl(root, key), payload || {}));
    }

    function getRegisteredUIGlobals(): Record<string, unknown> {
        return Object.assign({}, _registry);
    }

    function registerUIGlobals(obj: unknown): Record<string, unknown> {
        const payload = (obj && typeof obj === 'object') ? obj as Record<string, unknown> : {};
        _registry = Object.assign(_registry, payload);
        const uiBoot = resolveUIBootstrap(undefined);
        if (uiBoot && uiBoot !== api && typeof uiBoot.registerUIGlobals === 'function') {
            try { uiBoot.registerUIGlobals(payload); } catch (e) { /* ignore */ }
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
        if (typeof globalThis !== 'undefined') (globalThis as Record<string, unknown>).SharedUIBootstrap = api;
    } catch (e) { /* ignore */ }
})();
