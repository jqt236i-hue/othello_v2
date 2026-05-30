interface ModuleResolverOptions {
    isValid?(value: unknown): boolean;
    label?: string;
    globalName?: string;
    requirePath?: string;
    requireFn?(path: string): unknown;
    readLocal?(): unknown;
    required?: boolean;
}

const ModuleExportUtils = require('../../../shared/module-export-utils');

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

function unwrapModule(value: unknown): unknown {
    if (ModuleExportUtils && typeof ModuleExportUtils.unwrapModuleExport === 'function') {
        return ModuleExportUtils.unwrapModuleExport(value);
    }
    if (!value || typeof value !== 'object') return value;
    if (!Object.prototype.hasOwnProperty.call(value, 'default')) return value;
    const defaultValue = (value as Record<string, unknown>).default;
    return defaultValue || value;
}

function isUsableResolvedModule(value: unknown): boolean {
    if (ModuleExportUtils && typeof ModuleExportUtils.hasUsableModuleExport === 'function') {
        return ModuleExportUtils.hasUsableModuleExport(value);
    }
    if (!value) return false;
    if (typeof value === 'function') return true;
    if (typeof value !== 'object') return true;
    return Object.keys(value as Record<string, unknown>).some((key) => key !== '__esModule');
}

function resolveModule(options: ModuleResolverOptions): unknown {
    const opts = (options && typeof options === 'object') ? options : {};
    const isValid = (typeof opts.isValid === 'function')
        ? opts.isValid
        : function isTruthy(value: unknown) { return isUsableResolvedModule(value); };
    const label = String(opts.label || opts.globalName || opts.requirePath || 'module').trim() || 'module';

    let resolvedModule: unknown = null;
    if (typeof opts.readLocal === 'function') {
        try {
            resolvedModule = unwrapModule(opts.readLocal());
        } catch (_error) {
            void _error;
        }
        if (isValid(resolvedModule)) return resolvedModule;
    }
    if (opts.requirePath && typeof opts.requireFn === 'function') {
        try {
            resolvedModule = unwrapModule(opts.requireFn(opts.requirePath));
        } catch (_error) {
            void _error;
        }
        if (isValid(resolvedModule)) return resolvedModule;
    }
    if (opts.globalName) {
        resolvedModule = unwrapModule(readGlobalModule(opts.globalName));
        if (isValid(resolvedModule)) return resolvedModule;
    }
    if (opts.required) {
        throw new Error(label + ' not loaded');
    }
    return null;
}

export = {
    resolveModule,
    isUsableResolvedModule
};
