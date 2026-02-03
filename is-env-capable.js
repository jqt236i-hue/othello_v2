/**
 * @file is-env-capable.js
 * @description Environment capability detection utilities
 * Provides unified checks for debug logging and other environment-dependent features
 */

(function(root, factory) {
    // UMD pattern: support CommonJS, AMD, and browser globals
    if (typeof module !== 'undefined' && module.exports) {
        // Node.js / CommonJS
        module.exports = factory();
    } else if (typeof define === 'function' && define.amd) {
        // AMD
        define(factory);
    } else {
        // Browser global
        const exports = factory();
        root.EnvCapable = exports;
        // Also expose individual functions globally for convenience
        root.isDebugLogAvailable = exports.isDebugLogAvailable;
        root.isBrowserEnv = exports.isBrowserEnv;
        root.isNodeEnv = exports.isNodeEnv;
    }
})(typeof self !== 'undefined' ? self : this, function() {
    'use strict';

    // ===== Environment Detection =====
    
    /**
     * Check if running in browser environment
     * @returns {boolean} True if browser environment
     */
    function isBrowserEnv() {
        return typeof window !== 'undefined' && typeof document !== 'undefined';
    }

    /**
     * Check if running in Node.js environment
     * @returns {boolean} True if Node.js environment
     */
    function isNodeEnv() {
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
    function isDebugLogAvailable() {
        // Check global scope based on environment
        if (isBrowserEnv()) {
            return typeof globalThis !== 'undefined' && typeof globalThis.debugLog === 'function';
        } else if (isNodeEnv()) {
            return typeof global.debugLog === 'function';
        }
        // Fallback: check in current scope
        try {
            return typeof debugLog === 'function';
        } catch (e) {
            return false;
        }
    }

    /**
     * Check if GameEvents system is available (browser only)
     * @returns {boolean} True if GameEvents is available
     */
    function isGameEventsAvailable() {
        if (!isBrowserEnv()) return false;
        return typeof GameEvents !== 'undefined' && 
               GameEvents.gameEvents !== undefined &&
               typeof GameEvents.gameEvents.emit === 'function';
    }

    /**
     * Check if SoundEngine is available (browser only)
     * @returns {boolean} True if SoundEngine is available
     */
    function isSoundEngineAvailable() {
        if (!isBrowserEnv()) return false;
        return typeof SoundEngine !== 'undefined' && 
               typeof SoundEngine.init === 'function';
    }

    /**
     * Check if card animation system is available (browser only)
     * @returns {boolean} True if card animation is available
     */
    function isCardAnimationAvailable() {
        if (!isBrowserEnv()) return false;
        return typeof isCardAnimating !== 'undefined';
    }

    /**
     * Safe debug log wrapper - calls debugLog if available, otherwise no-op
     * @param {string} message - Log message
     * @param {string} [level='debug'] - Log level
     * @param {Object|null} [meta=null] - Additional metadata
     */
    function safeDebugLog(message, level, meta) {
        if (isDebugLogAvailable()) {
            if (isBrowserEnv()) {
                try { if (typeof globalThis !== 'undefined' && typeof globalThis.debugLog === 'function') globalThis.debugLog(message, level || 'debug', meta || null); } catch (e) {}
            } else if (isNodeEnv()) {
                global.debugLog(message, level || 'debug', meta || null);
            } else {
                // Try direct call
                try {
                    debugLog(message, level || 'debug', meta || null);
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
    function safeGetDebugLogs(limit, levelFilter) {
        if (isBrowserEnv() && typeof globalThis !== 'undefined' && typeof globalThis.getDebugLogs === 'function') {
            return globalThis.getDebugLogs(limit, levelFilter);
        } else if (isNodeEnv() && typeof global.getDebugLogs === 'function') {
            return global.getDebugLogs(limit, levelFilter);
        }
        return [];
    }

    // ===== Public API =====
    return {
        // Environment detection
        isBrowserEnv: isBrowserEnv,
        isNodeEnv: isNodeEnv,
        
        // Feature detection
        isDebugLogAvailable: isDebugLogAvailable,
        isGameEventsAvailable: isGameEventsAvailable,
        isSoundEngineAvailable: isSoundEngineAvailable,
        isCardAnimationAvailable: isCardAnimationAvailable,
        
        // Safe wrappers
        safeDebugLog: safeDebugLog,
        safeGetDebugLogs: safeGetDebugLogs
    };
});
