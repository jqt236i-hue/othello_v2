/**
 * @file player-encoding.ts
 * @description Centralized player key encoding/decoding utilities.
 * Provides canonical mappings between player string keys ('black'/'white')
 * and numeric values (1/-1), with normalization for various input types.
 */

import { PlayerKey, PlayerValue } from '../src/types';

declare const require: any;

(function (root: any, factory: (sharedConstants: any) => any) {
    if (typeof module === 'object' && module.exports) {
        let SharedConstantsModule = null;
        try {
            SharedConstantsModule = require('../shared-constants');
        } catch (e) { /* ignore */ }
        module.exports = factory(SharedConstantsModule);
    } else {
        const globalScope = (typeof globalThis !== 'undefined') ? globalThis
            : (typeof self !== 'undefined' ? self : (typeof window !== 'undefined' ? window : {}));
        root.PlayerEncoding = factory((globalScope as any).SharedConstants || null);
    }
}(typeof self !== 'undefined' ? self : this, function (SharedConstants: any) {
    'use strict';

    const BLACK: PlayerValue = (SharedConstants && Number.isFinite(Number(SharedConstants.BLACK)))
        ? Number(SharedConstants.BLACK) as PlayerValue
        : 1;
    const WHITE: PlayerValue = (SharedConstants && Number.isFinite(Number(SharedConstants.WHITE)))
        ? Number(SharedConstants.WHITE) as PlayerValue
        : -1;

    /**
     * Parse a seat key value to 'black' or 'white' if possible.
     */
    function parseSeatKeyOptional(value: unknown): PlayerKey | null {
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
     */
    function normalizePlayerKey(value: unknown, fallbackValue?: unknown): PlayerKey {
        const parsed = parseSeatKeyOptional(value);
        if (parsed) return parsed;
        const fallback = parseSeatKeyOptional(fallbackValue);
        return fallback || 'black';
    }

    /**
     * Get the player string key from a numeric player value.
     */
    function getPlayerKey(playerValue: PlayerValue): PlayerKey {
        return playerValue === BLACK ? 'black' : 'white';
    }

    /**
     * Get the numeric owner value from a player string key.
     */
    function getOwner(playerKey: PlayerKey): PlayerValue {
        return playerKey === 'black' ? BLACK : WHITE;
    }

    /**
     * Convert a player string key to a numeric player value.
     */
    function playerKeyToValue(playerKey: PlayerKey): PlayerValue {
        return playerKey === 'black' ? BLACK : WHITE;
    }

    /**
     * Convert a numeric player value to a player string key.
     */
    function playerValueToKey(playerValue: PlayerValue): PlayerKey {
        return playerValue === BLACK ? 'black' : 'white';
    }

    /**
     * Check if a value is a valid player key.
     */
    function isValidPlayerKey(value: unknown): value is PlayerKey {
        return value === 'black' || value === 'white';
    }

    return {
        parseSeatKeyOptional,
        normalizePlayerKey,
        getPlayerKey,
        getOwner,
        playerKeyToValue,
        playerValueToKey,
        isValidPlayerKey
    };
}));