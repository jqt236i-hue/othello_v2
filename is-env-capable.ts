/**
 * @file is-env-capable.ts
 * @description Environment capability detection utilities
 * Provides unified checks for debug logging and other environment-dependent features
 */

// ===== Environment Detection =====

/**
 * Check if running in browser environment
 * @returns {boolean} True if browser environment
 */
declare const __non_webpack_require__: NodeRequire | undefined;

const _require: NodeRequire = (typeof __non_webpack_require__ !== 'undefined')
  ? __non_webpack_require__
  : require;


export function isBrowserEnv(): boolean {
    return typeof window !== 'undefined' && typeof document !== 'undefined';
}

/**
 * Check if running in Node.js environment
 * @returns {boolean} True if Node.js environment
 */
export function isNodeEnv(): boolean {
    return typeof process !== 'undefined' && 
           process.versions !== undefined && 
           process.versions.node !== undefined;
}

// ===== Feature Detection =====

/**
 * Check if debugLog function is available and callable
 * Use this instead of `typeof debugLog !== 'undefined'` throughout the codebase
 * @returns {boolean} True if debugLog is available
 */
export function isDebugLogAvailable(): boolean {
    // Check global scope based on environment
    if (isBrowserEnv()) {
        return typeof globalThis !== 'undefined' && typeof (globalThis as any).debugLog === 'function';
    } else if (isNodeEnv()) {
        return typeof (global as any).debugLog === 'function';
    }
    // Fallback: check in current scope
    try {
        return typeof globalThis !== 'undefined' && typeof (globalThis as any).debugLog === 'function';
    } catch (e) {
        return false;
    }
}

/**
 * Check if GameEvents system is available (browser only)
 * @returns {boolean} True if GameEvents is available
 */
export function isGameEventsAvailable(): boolean {
    if (!isBrowserEnv()) return false;
    return typeof (window as any).GameEvents !== 'undefined' && 
           (window as any).GameEvents.gameEvents !== undefined &&
           typeof (window as any).GameEvents.gameEvents.emit === 'function';
}

/**
 * Check if SoundEngine is available (browser only)
 * @returns {boolean} True if SoundEngine is available
 */
export function isSoundEngineAvailable(): boolean {
    if (!isBrowserEnv()) return false;
    return typeof (window as any).SoundEngine !== 'undefined' && 
           typeof (window as any).SoundEngine.init === 'function';
}

/**
 * Check if card animation system is available (browser only)
 * @returns {boolean} True if card animation is available
 */
export function isCardAnimationAvailable(): boolean {
    if (!isBrowserEnv()) return false;
    return typeof (window as any).isCardAnimating !== 'undefined';
}

/**
 * Safe debug log wrapper - calls debugLog if available, otherwise no-op
 * @param {string} message - Log message
 * @param {string} [level='debug'] - Log level
 * @param {Object|null} [meta=null] - Additional metadata
 */
export function safeDebugLog(message: string, level?: string, meta?: any): void {
    if (isDebugLogAvailable()) {
        if (isBrowserEnv()) {
            try { if (typeof globalThis !== 'undefined' && typeof (globalThis as any).debugLog === 'function') (globalThis as any).debugLog(message, level || 'debug', meta || null); } catch (e) { /* Intentionally empty: debugLog unavailable in this environment */ }
        } else if (isNodeEnv()) {
            (global as any).debugLog(message, level || 'debug', meta || null);
        } else {
            // Try direct call
            try {
                if (typeof globalThis !== 'undefined' && typeof (globalThis as any).debugLog === 'function') {
                    (globalThis as any).debugLog(message, level || 'debug', meta || null);
                }
            } catch (e) {
                // Silently ignore
            }
        }
    }
}

/**
 * Get debug logs if available
 * @param {number|null} [limit=null] - Maximum number to return
 * @param {string|null} [levelFilter=null] - Filter by level
 * @returns {Array} Array of log entries or empty array
 */
export function safeGetDebugLogs(limit?: number, levelFilter?: string): any[] {
    if (isBrowserEnv() && typeof globalThis !== 'undefined' && typeof (globalThis as any).getDebugLogs === 'function') {
        return (globalThis as any).getDebugLogs(limit, levelFilter);
    } else if (isNodeEnv() && typeof (global as any).getDebugLogs === 'function') {
        return (global as any).getDebugLogs(limit, levelFilter);
    }
    return [];
}

// ===== Public API =====
export default {
    isBrowserEnv,
    isNodeEnv,
    isDebugLogAvailable,
    isGameEventsAvailable,
    isSoundEngineAvailable,
    isCardAnimationAvailable,
    safeDebugLog,
    safeGetDebugLogs
};
