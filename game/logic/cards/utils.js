/**
 * @file utils.js
 * @description Card utility helpers (Shared between Browser and Headless)
 */

(function (root, factory) {
    if (typeof module === 'object' && module.exports) {
        module.exports = factory(require('../../../shared-constants'));
    } else {
        root.CardUtils = factory(root.SharedConstants);
    }
}(typeof self !== 'undefined' ? self : this, function (SharedConstants) {
    'use strict';

    const { BLACK, WHITE, EMPTY } = SharedConstants || {};
    const MarkersAdapter = (() => {
        if (typeof require === 'function') {
            try {
                return require('../markers_adapter');
            } catch (e) {
                return null;
            }
        }
        const globalScope = (typeof globalThis !== 'undefined')
            ? globalThis
            : (typeof self !== 'undefined' ? self : (typeof global !== 'undefined' ? global : {}));
        return globalScope.MarkersAdapter || null;
    })();
    const MARKER_KINDS = MarkersAdapter && MarkersAdapter.MARKER_KINDS;

    if (BLACK === undefined || WHITE === undefined || EMPTY === undefined) {
        throw new Error('SharedConstants not loaded');
    }

    function getSpecialMarkerAt(cardState, row, col) {
        const markers = (cardState && cardState.markers) ? cardState.markers : [];
        const special = markers.find(m => m.kind === (MARKER_KINDS ? MARKER_KINDS.SPECIAL_STONE : 'specialStone') && m.row === row && m.col === col);
        if (special) return { kind: 'specialStone', marker: special };
        const bomb = markers.find(m => m.kind === (MARKER_KINDS ? MARKER_KINDS.BOMB : 'bomb') && m.row === row && m.col === col);
        if (bomb) return { kind: 'bomb', marker: bomb };
        return null;
    }

    function isSpecialStoneAt(cardState, row, col) {
        return !!getSpecialMarkerAt(cardState, row, col);
    }

    function getSpecialOwnerAt(cardState, row, col) {
        const entry = getSpecialMarkerAt(cardState, row, col);
        if (!entry) return null;
        return entry.marker && entry.marker.owner ? entry.marker.owner : null;
    }

    function isNormalStoneForPlayer(cardState, gameState, playerKey, row, col) {
        const playerVal = playerKey === 'black' ? BLACK : WHITE;

        if (gameState.board[row][col] !== playerVal) return false;

        const markers = (cardState && cardState.markers) ? cardState.markers : [];
        if (markers.some(m => m.row === row && m.col === col && m.kind === (MARKER_KINDS ? MARKER_KINDS.SPECIAL_STONE : 'specialStone'))) return false;
        if (markers.some(m => m.row === row && m.col === col && m.kind === (MARKER_KINDS ? MARKER_KINDS.BOMB : 'bomb'))) return false;

        return true;
    }

    function normalizePlayerKey(playerKey) {
        if (playerKey === 'black' || playerKey === BLACK || playerKey === 1 || playerKey === '1') return 'black';
        if (playerKey === 'white' || playerKey === WHITE || playerKey === -1 || playerKey === '-1') return 'white';
        return null;
    }

    function ensureChargeState(cardState) {
        if (!cardState) return;
        if (!cardState.charge) cardState.charge = { black: 0, white: 0 };
        if (!Array.isArray(cardState.chargeDeltaEvents)) cardState.chargeDeltaEvents = [];
        if (typeof cardState._nextChargeDeltaSeq !== 'number') cardState._nextChargeDeltaSeq = 1;
    }

    function enqueueChargeDelta(cardState, playerKey, before, after, reason) {
        if (!cardState) return;
        const normalized = normalizePlayerKey(playerKey);
        if (!normalized) return;
        const delta = after - before;
        if (!Number.isFinite(delta) || delta === 0) return;
        ensureChargeState(cardState);
        cardState.chargeDeltaEvents.push({
            seq: cardState._nextChargeDeltaSeq++,
            player: normalized,
            delta,
            before,
            after,
            reason: reason || null
        });
    }

    function setChargeWithDelta(cardState, playerKey, nextValue, reason) {
        const normalized = normalizePlayerKey(playerKey);
        if (!cardState || !normalized) return { changed: false, before: 0, after: 0, delta: 0 };

        ensureChargeState(cardState);

        const beforeRaw = Number(cardState.charge[normalized] || 0);
        const safeBefore = Number.isFinite(beforeRaw) ? beforeRaw : 0;
        const requested = Number(nextValue);
        const safeRequested = Number.isFinite(requested) ? requested : safeBefore;
        const after = Math.max(0, Math.min(30, safeRequested));

        cardState.charge[normalized] = after;
        enqueueChargeDelta(cardState, normalized, safeBefore, after, reason);

        return {
            changed: after !== safeBefore,
            before: safeBefore,
            after,
            delta: after - safeBefore
        };
    }

    function addChargeWithDelta(cardState, playerKey, amount, reason) {
        const normalized = normalizePlayerKey(playerKey);
        if (!cardState || !normalized) return { changed: false, before: 0, after: 0, delta: 0 };
        ensureChargeState(cardState);
        const beforeRaw = Number(cardState.charge[normalized] || 0);
        const safeBefore = Number.isFinite(beforeRaw) ? beforeRaw : 0;
        const add = Number(amount);
        const safeAdd = Number.isFinite(add) ? add : 0;
        return setChargeWithDelta(cardState, normalized, safeBefore + safeAdd, reason);
    }

    return {
        getSpecialMarkerAt,
        isSpecialStoneAt,
        getSpecialOwnerAt,
        isNormalStoneForPlayer,
        normalizePlayerKey,
        setChargeWithDelta,
        addChargeWithDelta
    };
}));
