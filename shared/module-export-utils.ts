function unwrapModuleExport<T = unknown>(value: T): T {
    if (!value || typeof value !== 'object') return value;
    if (!Object.prototype.hasOwnProperty.call(value, 'default')) return value;
    const defaultValue = (value as Record<string, unknown>).default;
    return (defaultValue || value) as T;
}

function hasUsableModuleExport(value: unknown): boolean {
    if (!value) return false;
    if (typeof value === 'function') return true;
    if (typeof value !== 'object') return true;
    return Object.keys(value as Record<string, unknown>).some((key) => key !== '__esModule');
}

function preferUsableModuleExport(preferred: unknown, fallback: unknown): unknown {
    const resolvedPreferred = unwrapModuleExport(preferred);
    if (hasUsableModuleExport(resolvedPreferred)) return resolvedPreferred;
    const resolvedFallback = unwrapModuleExport(fallback);
    if (hasUsableModuleExport(resolvedFallback)) return resolvedFallback;
    return resolvedPreferred || resolvedFallback || null;
}

export = {
    unwrapModuleExport,
    hasUsableModuleExport,
    preferUsableModuleExport
};
