interface ModuleResolverOptions {
    isValid?(value: unknown): boolean;
    label?: string;
    globalName?: string;
    requirePath?: string;
    requireFn?(path: string): unknown;
    readLocal?(): unknown;
    required?: boolean;
}

function readGlobalModule(globalName: string): unknown {
    if (!globalName) return null;
    try {
        if (typeof self !== 'undefined' && (self as any)[globalName]) {
            return (self as any)[globalName];
        }
        if (typeof globalThis !== 'undefined' && (globalThis as any)[globalName]) {
            return (globalThis as any)[globalName];
        }
    } catch (_error) {
        void _error;
    }
    return null;
}

function resolveModule(options: ModuleResolverOptions): unknown {
    const opts = (options && typeof options === 'object') ? options : {};
    const isValid = (typeof opts.isValid === 'function')
        ? opts.isValid
        : function isTruthy(value: unknown) { return !!value; };
    const label = String(opts.label || opts.globalName || opts.requirePath || 'module').trim() || 'module';

    let resolvedModule: unknown = null;
    if (typeof opts.readLocal === 'function') {
        try {
            resolvedModule = opts.readLocal();
        } catch (_error) {
            void _error;
        }
        if (isValid(resolvedModule)) return resolvedModule;
    }
    if (opts.requirePath && typeof opts.requireFn === 'function') {
        try {
            resolvedModule = opts.requireFn(opts.requirePath);
        } catch (_error) {
            void _error;
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

export = {
    resolveModule
};
