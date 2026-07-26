/**
 * Resolves the current browser runtime object before consulting a legacy
 * lexical binding. Vite loads entry-browser.js as ESM, so its module-local
 * bindings can outlive the object currently published on globalThis.
 */
function readRuntimeObject(rootRef: any, key: string): any {
    try {
        const value = rootRef && rootRef[key];
        return value && typeof value === 'object' ? value : null;
    } catch (e: any) {
        return null;
    }
}

function resolveCurrentRuntimeObject(
    key: string,
    resolveLegacyValue?: (() => any) | null
): any {
    const normalizedKey = String(key || '').trim();
    if (!normalizedKey) return null;

    try {
        if (typeof globalThis !== 'undefined') {
            const current = readRuntimeObject(globalThis as any, normalizedKey);
            if (current) return current;
        }
    } catch (e: any) { /* ignore unavailable runtime root */ }

    try {
        if (typeof window !== 'undefined' && window !== globalThis) {
            const current = readRuntimeObject(window as any, normalizedKey);
            if (current) return current;
        }
    } catch (e: any) { /* ignore unavailable browser root */ }

    if (typeof resolveLegacyValue !== 'function') return null;
    try {
        const legacyValue = resolveLegacyValue();
        return legacyValue && typeof legacyValue === 'object' ? legacyValue : null;
    } catch (e: any) {
        return null;
    }
}

export {
    resolveCurrentRuntimeObject
};
