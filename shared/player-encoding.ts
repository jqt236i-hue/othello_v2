/**
 * @file player-encoding.ts
 * @description Centralized player key encoding/decoding utilities.
 * Provides canonical mappings between player string keys ('black'/'white')
 * and numeric values (1/-1), with normalization for various input types.
 */

import { PlayerKey, PlayerValue } from '../src/types';

declare const require: any;

(function (root: any, factory: (sharedConstants: any, playerSeatContract: any) => any) {
    if (typeof module === 'object' && module.exports) {
        let SharedConstantsModule = null;
        try {
            SharedConstantsModule = require('../shared-constants');
        } catch (e) { /* ignore */ }
        module.exports = factory(SharedConstantsModule, require('./player-seat-contract'));
    } else {
        const globalScope = (typeof globalThis !== 'undefined') ? globalThis
            : (typeof self !== 'undefined' ? self : (typeof window !== 'undefined' ? window : {}));
        const playerSeatContract = (globalScope as any).PlayerSeatContract
            || (typeof (globalScope as any).require === 'function'
                ? (globalScope as any).require('shared/player-seat-contract')
                : null);
        root.PlayerEncoding = factory((globalScope as any).SharedConstants || null, playerSeatContract);
    }
}(typeof self !== 'undefined' ? self : this, function (SharedConstants: any, PlayerSeatContract: any) {
    'use strict';

    if (!PlayerSeatContract) {
        throw new Error('PlayerSeatContract is required by PlayerEncoding');
    }

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
        return PlayerSeatContract.parsePlayerSeatKey(value) as PlayerKey | null;
    }

    /**
     * Normalize a player key value to 'black' or 'white'.
     */
    function normalizePlayerKey(value: unknown, fallbackValue?: unknown): PlayerKey {
        return PlayerSeatContract.normalizePlayerSeatKey(value, fallbackValue) as PlayerKey;
    }

    /**
     * Get the player string key from a numeric player value.
     */
    function getPlayerKey(playerValue: PlayerValue): PlayerKey {
        return PlayerSeatContract.playerSeatValueToKey(playerValue, BLACK) as PlayerKey;
    }

    /**
     * Get the numeric owner value from a player string key.
     */
    function getOwner(playerKey: PlayerKey): PlayerValue {
        return PlayerSeatContract.playerSeatKeyToValue(playerKey, BLACK, WHITE) as PlayerValue;
    }

    /**
     * Convert a player string key to a numeric player value.
     */
    function playerKeyToValue(playerKey: PlayerKey): PlayerValue {
        return PlayerSeatContract.playerSeatKeyToValue(playerKey, BLACK, WHITE) as PlayerValue;
    }

    /**
     * Convert a numeric player value to a player string key.
     */
    function playerValueToKey(playerValue: PlayerValue): PlayerKey {
        return PlayerSeatContract.playerSeatValueToKey(playerValue, BLACK) as PlayerKey;
    }

    /**
     * Check if a value is a valid player key.
     */
    function isValidPlayerKey(value: unknown): value is PlayerKey {
        return PlayerSeatContract.isCanonicalPlayerSeatKey(value);
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
