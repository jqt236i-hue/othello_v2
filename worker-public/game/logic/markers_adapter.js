/**
 * @file markers_adapter.js
 * @description Adapter layer for transitioning from specialStones/bombs to unified markers[].
 * Provides bidirectional conversion during the migration period.
 */

(function (root, factory) {
    if (typeof module === 'object' && module.exports) {
        module.exports = factory();
    } else {
        root.MarkersAdapter = factory();
    }
}(typeof self !== 'undefined' ? self : this, function () {
    'use strict';

    /**
     * Marker kinds
     */
    const MARKER_KINDS = {
        SPECIAL_STONE: 'specialStone'
    };
    const MARKER_CATEGORIES = {
        BOMB: 'bomb'
    };
    const DEFAULT_BOMB_TYPE = 'TIME_BOMB';
    const LEGACY_BOMB_KIND = 'bomb';

    function getMarkerData(marker) {
        return (marker && marker.data && typeof marker.data === 'object') ? marker.data : null;
    }

    function isLegacyBombMarker(marker) {
        return !!(marker && marker.kind === LEGACY_BOMB_KIND);
    }

    function getMarkerCategory(marker) {
        const data = getMarkerData(marker);
        const category = data && typeof data.category === 'string'
            ? String(data.category).trim()
            : '';
        if (category) return category;
        return isLegacyBombMarker(marker) ? MARKER_CATEGORIES.BOMB : null;
    }

    function isBombCategoryMarker(marker) {
        return getMarkerCategory(marker) === MARKER_CATEGORIES.BOMB;
    }

    function isSpecialStoneMarker(marker) {
        return !!(
            marker &&
            marker.kind === MARKER_KINDS.SPECIAL_STONE &&
            !isBombCategoryMarker(marker)
        );
    }

    function getBombMarkerType(marker) {
        if (!isBombCategoryMarker(marker)) return null;
        const data = getMarkerData(marker);
        return (data && data.type) ? String(data.type) : DEFAULT_BOMB_TYPE;
    }

    function normalizeMarkerInput(kind, data) {
        const requestedKind = (typeof kind === 'string' && kind) ? kind : MARKER_KINDS.SPECIAL_STONE;
        const normalizedData = (data && typeof data === 'object') ? { ...data } : {};
        const type = normalizedData && normalizedData.type ? String(normalizedData.type) : '';
        const isBombInput =
            requestedKind === LEGACY_BOMB_KIND ||
            getMarkerCategory({ kind: requestedKind, data: normalizedData }) === MARKER_CATEGORIES.BOMB ||
            type === DEFAULT_BOMB_TYPE;
        if (isBombInput) {
            normalizedData.category = MARKER_CATEGORIES.BOMB;
            if (!normalizedData.type) normalizedData.type = DEFAULT_BOMB_TYPE;
            return {
                kind: MARKER_KINDS.SPECIAL_STONE,
                data: normalizedData
            };
        }
        return {
            kind: requestedKind,
            data: normalizedData
        };
    }

    /**
     * Create a marker from a special stone
     * @param {Object} stone - Special stone object
     * @param {number} id - Unique marker ID
     * @returns {Object} Marker object
     */
    function fromSpecialStone(stone, id) {
        const normalized = normalizeMarkerInput(MARKER_KINDS.SPECIAL_STONE, {
            type: stone.type,
            category: stone.category,
            remainingOwnerTurns: stone.remainingOwnerTurns,
            expiresForPlayer: stone.expiresForPlayer,
            autoRemove: stone.autoRemove,
            hyperactiveSeq: stone.hyperactiveSeq,
            regenRemaining: stone.regenRemaining,
            ownerColor: stone.ownerColor,
            chainPriority: stone.chainPriority
        });
        return {
            id,
            row: stone.row,
            col: stone.col,
            kind: normalized.kind,
            owner: stone.owner,
            createdSeq: (typeof stone.createdSeq === 'number') ? stone.createdSeq : id,
            data: normalized.data
        };
    }

    /**
     * Create a marker from a bomb
     * @param {Object} bomb - Bomb object
     * @param {number} id - Unique marker ID
     * @returns {Object} Marker object
     */
    function fromBomb(bomb, id) {
        const normalized = normalizeMarkerInput(LEGACY_BOMB_KIND, {
            type: bomb.type,
            category: bomb.category,
            remainingTurns: bomb.remainingTurns,
            placedTurn: bomb.placedTurn
        });
        return {
            id,
            row: bomb.row,
            col: bomb.col,
            kind: normalized.kind,
            owner: bomb.owner,
            createdSeq: (typeof bomb.createdSeq === 'number') ? bomb.createdSeq : id,
            data: normalized.data
        };
    }

    /**
     * Convert marker back to special stone format
     * @param {Object} marker
     * @returns {Object|null} Special stone or null if not a special stone marker
     */
    function toSpecialStone(marker) {
        if (!isSpecialStoneMarker(marker)) return null;
        const data = getMarkerData(marker) || {};

        return {
            row: marker.row,
            col: marker.col,
            type: data.type,
            owner: marker.owner,
            remainingOwnerTurns: data.remainingOwnerTurns,
            expiresForPlayer: data.expiresForPlayer,
            autoRemove: data.autoRemove,
            hyperactiveSeq: data.hyperactiveSeq,
            regenRemaining: data.regenRemaining,
            ownerColor: data.ownerColor,
            chainPriority: data.chainPriority,
            createdSeq: marker.createdSeq
        };
    }

    /**
     * Convert marker back to bomb format
     * @param {Object} marker
     * @returns {Object|null} Bomb or null if not a bomb marker
     */
    function toBomb(marker) {
        if (!isBombCategoryMarker(marker)) return null;
        const data = getMarkerData(marker) || {};

        return {
            row: marker.row,
            col: marker.col,
            remainingTurns: data.remainingTurns,
            owner: marker.owner,
            placedTurn: data.placedTurn,
            createdSeq: marker.createdSeq
        };
    }

    /**
     * Convert markers array back to specialStones array
     * @param {Array} markers
     * @returns {Array} specialStones array
     */
    function markersToSpecialStones(markers) {
        return markers
            .filter(isSpecialStoneMarker)
            .map(toSpecialStone);
    }

    /**
     * Convert markers array back to bombs array
     * @param {Array} markers
     * @returns {Array} bombs array
     */
    function markersToBombs(markers) {
        return markers
            .filter(isBombCategoryMarker)
            .map(toBomb);
    }

    /**
     * Convert specialStones and bombs to unified markers
     * @param {Array} specialStones
     * @param {Array} bombs
     * @param {number} [startId=1] - Starting ID for markers
     * @returns {{ markers: Array, nextId: number }}
     */
    function toMarkers(specialStones, bombs, startId = 1) {
        let id = startId;
        const markers = [];

        for (const stone of (specialStones || [])) {
            markers.push(fromSpecialStone(stone, id++));
        }

        for (const bomb of (bombs || [])) {
            markers.push(fromBomb(bomb, id++));
        }

        return { markers, nextId: id };
    }

    /**
     * Sync markers to legacy arrays (for backward compatibility)
     * @param {Object} cardState - Card state with markers, specialStones, bombs
     */
    function syncMarkersToLegacy(cardState) {
        if (!cardState.markers) return;
        cardState.specialStones = markersToSpecialStones(cardState.markers);
        cardState.bombs = markersToBombs(cardState.markers);
    }

    /**
     * Sync legacy arrays to markers (for migration)
     * @param {Object} cardState - Card state with specialStones, bombs
     */
    function syncLegacyToMarkers(cardState) {
        const result = toMarkers(
            cardState.specialStones,
            cardState.bombs,
            cardState._nextMarkerId || 1
        );
        cardState.markers = result.markers;
        cardState._nextMarkerId = result.nextId;
    }

    /**
     * Ensure marker containers/counters exist.
     * @param {Object} cardState
     */
    function ensureMarkers(cardState) {
        if (!cardState) return;
        if (!Array.isArray(cardState.markers)) cardState.markers = [];
        if (typeof cardState._nextMarkerId !== 'number') cardState._nextMarkerId = 1;
        if (typeof cardState._nextCreatedSeq !== 'number') cardState._nextCreatedSeq = 1;
    }

    function getMarkers(cardState) {
        return (cardState && Array.isArray(cardState.markers)) ? cardState.markers : [];
    }

    function getSpecialMarkers(cardState) {
        return getMarkers(cardState).filter(isSpecialStoneMarker);
    }

    function getBombMarkers(cardState) {
        return getMarkers(cardState).filter(isBombCategoryMarker);
    }

    function findSpecialMarkerAt(cardState, row, col, type, owner) {
        return getMarkers(cardState).find(m => (
            isSpecialStoneMarker(m) &&
            m.row === row &&
            m.col === col &&
            (type ? (m.data && m.data.type === type) : true) &&
            (owner ? m.owner === owner : true)
        ));
    }

    function findBombMarkerAt(cardState, row, col) {
        return getMarkers(cardState).find(m => isBombCategoryMarker(m) && m.row === row && m.col === col);
    }

    function removeMarkers(cardState, predicate) {
        if (!cardState || !Array.isArray(cardState.markers)) return;
        cardState.markers = cardState.markers.filter(m => !predicate(m));
    }

    function removeMarkersAt(cardState, row, col, options) {
        const opts = options || {};
        removeMarkers(cardState, (m) => {
            if (m.row !== row || m.col !== col) return false;
            if (opts.kind === LEGACY_BOMB_KIND && !isBombCategoryMarker(m)) return false;
            if (opts.kind === MARKER_KINDS.SPECIAL_STONE && !isSpecialStoneMarker(m)) return false;
            if (opts.kind && opts.kind !== LEGACY_BOMB_KIND && opts.kind !== MARKER_KINDS.SPECIAL_STONE && m.kind !== opts.kind) return false;
            if (opts.category && getMarkerCategory(m) !== opts.category) return false;
            if (opts.type && (!m.data || m.data.type !== opts.type)) return false;
            if (opts.owner && m.owner !== opts.owner) return false;
            return true;
        });
    }

    return {
        MARKER_KINDS,
        MARKER_CATEGORIES,
        fromSpecialStone,
        fromBomb,
        toSpecialStone,
        toBomb,
        markersToSpecialStones,
        markersToBombs,
        toMarkers,
        syncMarkersToLegacy,
        syncLegacyToMarkers,
        ensureMarkers,
        getMarkers,
        getMarkerCategory,
        getBombMarkerType,
        isBombCategoryMarker,
        isSpecialStoneMarker,
        normalizeMarkerInput,
        getSpecialMarkers,
        getBombMarkers,
        findSpecialMarkerAt,
        findBombMarkerAt,
        removeMarkers,
        removeMarkersAt
    };
}));
