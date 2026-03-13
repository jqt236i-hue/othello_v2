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
        SPECIAL_STONE: 'specialStone',
        BOMB: 'bomb'
    };

    /**
     * Create a marker from a special stone
     * @param {Object} stone - Special stone object
     * @param {number} id - Unique marker ID
     * @returns {Object} Marker object
     */
    function fromSpecialStone(stone, id) {
        return {
            id,
            row: stone.row,
            col: stone.col,
            kind: MARKER_KINDS.SPECIAL_STONE,
            owner: stone.owner,
            createdSeq: (typeof stone.createdSeq === 'number') ? stone.createdSeq : id,
            data: {
                type: stone.type,
                remainingOwnerTurns: stone.remainingOwnerTurns,
                expiresForPlayer: stone.expiresForPlayer,
                autoRemove: stone.autoRemove,
                hyperactiveSeq: stone.hyperactiveSeq,
                regenRemaining: stone.regenRemaining,
                ownerColor: stone.ownerColor,
                chainPriority: stone.chainPriority
            }
        };
    }

    /**
     * Create a marker from a bomb
     * @param {Object} bomb - Bomb object
     * @param {number} id - Unique marker ID
     * @returns {Object} Marker object
     */
    function fromBomb(bomb, id) {
        return {
            id,
            row: bomb.row,
            col: bomb.col,
            kind: MARKER_KINDS.BOMB,
            owner: bomb.owner,
            createdSeq: (typeof bomb.createdSeq === 'number') ? bomb.createdSeq : id,
            data: {
                remainingTurns: bomb.remainingTurns,
                placedTurn: bomb.placedTurn
            }
        };
    }

    /**
     * Convert marker back to special stone format
     * @param {Object} marker
     * @returns {Object|null} Special stone or null if not a special stone marker
     */
    function toSpecialStone(marker) {
        if (marker.kind !== MARKER_KINDS.SPECIAL_STONE) return null;

        return {
            row: marker.row,
            col: marker.col,
            type: marker.data.type,
            owner: marker.owner,
            remainingOwnerTurns: marker.data.remainingOwnerTurns,
            expiresForPlayer: marker.data.expiresForPlayer,
            autoRemove: marker.data.autoRemove,
            hyperactiveSeq: marker.data.hyperactiveSeq,
            regenRemaining: marker.data.regenRemaining,
            ownerColor: marker.data.ownerColor,
            chainPriority: marker.data.chainPriority,
            createdSeq: marker.createdSeq
        };
    }

    /**
     * Convert marker back to bomb format
     * @param {Object} marker
     * @returns {Object|null} Bomb or null if not a bomb marker
     */
    function toBomb(marker) {
        if (marker.kind !== MARKER_KINDS.BOMB) return null;

        return {
            row: marker.row,
            col: marker.col,
            remainingTurns: marker.data.remainingTurns,
            owner: marker.owner,
            placedTurn: marker.data.placedTurn,
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
            .filter(m => m.kind === MARKER_KINDS.SPECIAL_STONE)
            .map(toSpecialStone);
    }

    /**
     * Convert markers array back to bombs array
     * @param {Array} markers
     * @returns {Array} bombs array
     */
    function markersToBombs(markers) {
        return markers
            .filter(m => m.kind === MARKER_KINDS.BOMB)
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
        return getMarkers(cardState).filter(m => m.kind === MARKER_KINDS.SPECIAL_STONE);
    }

    function getBombMarkers(cardState) {
        return getMarkers(cardState).filter(m => m.kind === MARKER_KINDS.BOMB);
    }

    function findSpecialMarkerAt(cardState, row, col, type, owner) {
        return getMarkers(cardState).find(m => (
            m.kind === MARKER_KINDS.SPECIAL_STONE &&
            m.row === row &&
            m.col === col &&
            (type ? (m.data && m.data.type === type) : true) &&
            (owner ? m.owner === owner : true)
        ));
    }

    function findBombMarkerAt(cardState, row, col) {
        return getMarkers(cardState).find(m => m.kind === MARKER_KINDS.BOMB && m.row === row && m.col === col);
    }

    function removeMarkers(cardState, predicate) {
        if (!cardState || !Array.isArray(cardState.markers)) return;
        cardState.markers = cardState.markers.filter(m => !predicate(m));
    }

    function removeMarkersAt(cardState, row, col, options) {
        const opts = options || {};
        removeMarkers(cardState, (m) => {
            if (m.row !== row || m.col !== col) return false;
            if (opts.kind && m.kind !== opts.kind) return false;
            if (opts.type && (!m.data || m.data.type !== opts.type)) return false;
            if (opts.owner && m.owner !== opts.owner) return false;
            return true;
        });
    }

    return {
        MARKER_KINDS,
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
        getSpecialMarkers,
        getBombMarkers,
        findSpecialMarkerAt,
        findBombMarkerAt,
        removeMarkers,
        removeMarkersAt
    };
}));
