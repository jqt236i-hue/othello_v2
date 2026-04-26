/**
 * @file player-encoding.js
 * @description Centralized player key encoding/decoding utilities.
 * Provides canonical mappings between player string keys ('black'/'white')
 * and numeric values (1/-1), with normalization for various input types.
 */

(function (root, factory) {
    if (typeof module === 'object' && module.exports) {
        let SharedConstantsModule = null;
        try {
            SharedConstantsModule = require('../shared-constants');
        } catch (e) { /* ignore */ }
        module.exports = factory(SharedConstantsModule);
    } else {
        const globalScope = (typeof globalThis !== 'undefined') ? globalThis
            : (typeof self !== 'undefined' ? self : (typeof window !== 'undefined' ? window : {}));
        root.PlayerEncoding = factory(globalScope.SharedConstants || null);
    }
}(typeof self !== 'undefined' ? self : this, function (SharedConstants) {
    'use strict';

    const BLACK = (SharedConstants && Number.isFinite(Number(SharedConstants.BLACK)))
        ? Number(SharedConstants.BLACK)
        : 1;
    const WHITE = (SharedConstants && Number.isFinite(Number(SharedConstants.WHITE)))
        ? Number(SharedConstants.WHITE)
        : -1;

    /**
     * Parse a seat key value to 'black' or 'white' if possible.
     * Handles numeric values (1, -1), string representations ('1', '-1'),
     * and direct color names ('black', 'white').
     * @param {*} value
     * @returns {string|null} 'black', 'white', or null
     */
    function parseSeatKeyOptional(value) {
        if (value === 1 || value === '1') return 'black';
        if (value === -1 || value === '-1') return 'white';

        const normalized = (value === null || typeof value === 'undefined')
            ? ''
            : String(value).trim().toLowerCase();

        if (normalized === 'black' || normalized === '1' || normalized === '+1') return 'black';
        if (normalized === 'white' || normalized === '-1') return 'white';
        return null;
    }

    /**
     * Normalize a player key value to 'black' or 'white'.
     * Falls back to the provided fallbackValue, defaulting to 'black'.
     * @param {*} value - The value to normalize
     * @param {*} fallbackValue - Fallback value if normalization fails
     * @returns {string} 'black' or 'white'
     */
    function normalizePlayerKey(value, fallbackValue) {
        const parsed = parseSeatKeyOptional(value);
        if (parsed) return parsed;
        const fallback = parseSeatKeyOptional(fallbackValue);
        return fallback || 'black';
    }

    /**
     * Get the player string key from a numeric player value.
     * @param {number} playerValue - BLACK (1) or WHITE (-1)
     * @returns {string} 'black' or 'white'
     */
    function getPlayerKey(playerValue) {
        return playerValue === BLACK ? 'black' : 'white';
    }

    /**
     * Get the numeric owner value from a player string key.
     * @param {string} playerKey - 'black' or 'white'
     * @returns {number} 1 for 'black', -1 for 'white'
     */
    function getOwner(playerKey) {
        return playerKey === 'black' ? BLACK : WHITE;
    }

    /**
     * Check if a value is a valid player key.
     * @param {*} value
     * @returns {boolean}
     */
    function isValidPlayerKey(value) {
        return value === 'black' || value === 'white';
    }

    return {
        parseSeatKeyOptional,
        normalizePlayerKey,
        getPlayerKey,
        getOwner,
        isValidPlayerKey
    };
}));
