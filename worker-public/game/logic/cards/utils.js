/**
 * @file utils.js
 * @description Card utility helpers (Shared between Browser and Headless)
 */

(function (root, factory) {
    if (typeof module === 'object' && module.exports) {
        let OwnerHelpersModule = null;
        let GameVisualEffectsMapModule = null;
        let BoardOpsModule = null;
        try {
            OwnerHelpersModule = require('../../../utils/owner-helpers');
        } catch (e) { /* ignore */ }
        try {
            GameVisualEffectsMapModule = require('../../visual-effects-map');
        } catch (e) { /* ignore */ }
        try {
            BoardOpsModule = require('../board_ops');
        } catch (e) { /* ignore */ }
        module.exports = factory(require('../../../shared-constants'), OwnerHelpersModule, GameVisualEffectsMapModule, BoardOpsModule);
    } else {
        root.CardUtils = factory(root.SharedConstants, root.OwnerHelpers || null, root.GameVisualEffectsMap || null, root.BoardOps || null);
    }
}(typeof self !== 'undefined' ? self : this, function (SharedConstants, OwnerHelpersModule, GameVisualEffectsMapModule, BoardOpsModule) {
    'use strict';

    const { BLACK, WHITE, EMPTY, CHARGE_MAX } = SharedConstants || {};
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
    const MARKER_CATEGORIES = (MarkersAdapter && MarkersAdapter.MARKER_CATEGORIES)
        ? MarkersAdapter.MARKER_CATEGORIES
        : { BOMB: 'bomb' };

    if (BLACK === undefined || WHITE === undefined || EMPTY === undefined) {
        throw new Error('SharedConstants not loaded');
    }

    function normalizeBoardIndex(value) {
        if (value === null || value === undefined || value === '') return null;
        const numeric = Number(value);
        if (!Number.isFinite(numeric)) return null;
        return Math.trunc(numeric);
    }

    function getMarkerCategory(marker) {
        if (MarkersAdapter && typeof MarkersAdapter.getMarkerCategory === 'function') {
            return MarkersAdapter.getMarkerCategory(marker);
        }
        if (!marker) return null;
        if (marker.data && typeof marker.data.category === 'string' && marker.data.category) {
            return marker.data.category;
        }
        if (marker.kind === MARKER_CATEGORIES.BOMB) return MARKER_CATEGORIES.BOMB;
        return (
            marker.kind === (MARKER_KINDS ? MARKER_KINDS.SPECIAL_STONE : 'specialStone') &&
            marker.data &&
            marker.data.category === MARKER_CATEGORIES.BOMB
        ) ? MARKER_CATEGORIES.BOMB : null;
    }

    function isBombCategoryMarker(marker) {
        if (MarkersAdapter && typeof MarkersAdapter.isBombCategoryMarker === 'function') {
            return MarkersAdapter.isBombCategoryMarker(marker);
        }
        return getMarkerCategory(marker) === MARKER_CATEGORIES.BOMB;
    }

    function isSpecialStoneMarker(marker) {
        if (MarkersAdapter && typeof MarkersAdapter.isSpecialStoneMarker === 'function') {
            return MarkersAdapter.isSpecialStoneMarker(marker);
        }
        return !!(
            marker &&
            marker.kind === (MARKER_KINDS ? MARKER_KINDS.SPECIAL_STONE : 'specialStone') &&
            !isBombCategoryMarker(marker)
        );
    }

    function getSpecialMarkerAt(cardState, row, col) {
        const targetRow = normalizeBoardIndex(row);
        const targetCol = normalizeBoardIndex(col);
        if (targetRow === null || targetCol === null) return null;
        const markers = (cardState && cardState.markers) ? cardState.markers : [];
        const marker = markers.find(m => (
            m &&
            (isSpecialStoneMarker(m) || isBombCategoryMarker(m)) &&
            normalizeBoardIndex(m.row) === targetRow &&
            normalizeBoardIndex(m.col) === targetCol
        ));
        if (marker) {
            return {
                kind: 'specialStone',
                category: getMarkerCategory(marker),
                marker
            };
        }
        return null;
    }

    function getGameVisualEffectsMap() {
        if (GameVisualEffectsMapModule && typeof GameVisualEffectsMapModule.getEffectKeyForSpecialType === 'function') {
            return GameVisualEffectsMapModule;
        }
        const globalScope = (typeof globalThis !== 'undefined')
            ? globalThis
            : (typeof self !== 'undefined' ? self : (typeof global !== 'undefined' ? global : {}));
        const globalMap = globalScope && globalScope.GameVisualEffectsMap;
        return (globalMap && typeof globalMap.getEffectKeyForSpecialType === 'function') ? globalMap : null;
    }

    function resolveSpecialEffectKey(type) {
        if (!type) return null;
        const visualEffectsMap = getGameVisualEffectsMap();
        if (visualEffectsMap) {
            return visualEffectsMap.getEffectKeyForSpecialType(type);
        }
        return null;
    }

    function isBoardHiddenTrapMarker(marker) {
        return !!(
            marker &&
            isSpecialStoneMarker(marker) &&
            marker.data &&
            String(marker.data.type || '').toUpperCase() === 'TRAP'
        );
    }

    function isBoardCellModifierMarker(marker) {
        if (!marker || !marker.data) return false;
        const typeUpper = String(marker.data.type || '').toUpperCase();
        return typeUpper === 'BLOCKADE' || typeUpper === 'METEOR_HOLE' || typeUpper === 'FREEZE';
    }

    function isFrozenCell(cardState, row, col) {
        const targetRow = normalizeBoardIndex(row);
        const targetCol = normalizeBoardIndex(col);
        const effectiveSet = cardState && cardState._frozenCellsActiveAtTurnStart;
        const effectiveKey = (targetRow === null || targetCol === null) ? null : `${targetRow},${targetCol}`;
        if (effectiveKey && effectiveSet) {
            if (effectiveSet instanceof Set && effectiveSet.has(effectiveKey)) {
                return true;
            }
            if (Array.isArray(effectiveSet) && effectiveSet.includes(effectiveKey)) {
                return true;
            }
        }
        const entry = getSpecialMarkerAt(cardState, row, col);
        const marker = entry ? entry.marker : null;
        return !!(
            marker &&
            marker.data &&
            String(marker.data.type || '').toUpperCase() === 'FREEZE'
        );
    }

    function isMarkerRenderedAsSpecialStone(entry) {
        if (!entry || !entry.marker) return false;
        if (isBombCategoryMarker(entry.marker) || entry.category === MARKER_CATEGORIES.BOMB) return true;
        if (!isSpecialStoneMarker(entry.marker)) return false;
        if (isBoardHiddenTrapMarker(entry.marker)) return false;
        if (isBoardCellModifierMarker(entry.marker)) return false;
        return true;
    }

    function getRenderedSpecialMarkerAt(cardState, row, col) {
        const entry = getSpecialMarkerAt(cardState, row, col);
        return isMarkerRenderedAsSpecialStone(entry) ? entry : null;
    }

    function getRenderedNonNormalStoneMarkerAt(cardState, row, col) {
        return getRenderedSpecialMarkerAt(cardState, row, col);
    }

    function isNonNormalStoneVisualAt(cardState, row, col) {
        return !!getRenderedNonNormalStoneMarkerAt(cardState, row, col);
    }

    function isSpecialStoneAt(cardState, row, col) {
        return isNonNormalStoneVisualAt(cardState, row, col);
    }

    function getSpecialOwnerAt(cardState, row, col) {
        const entry = getRenderedNonNormalStoneMarkerAt(cardState, row, col);
        if (!entry) return null;
        return entry.marker && entry.marker.owner ? entry.marker.owner : null;
    }

    function isNormalStoneForPlayer(cardState, gameState, playerKey, row, col) {
        const playerVal = playerKey === 'black' ? BLACK : WHITE;

        const cellValue = (BoardOpsModule && typeof BoardOpsModule.getCellValue === 'function')
            ? BoardOpsModule.getCellValue(gameState, row, col)
            : (gameState && gameState.board && gameState.board[row] ? gameState.board[row][col] : null);
        if (cellValue !== playerVal) return false;
        return !getRenderedSpecialMarkerAt(cardState, row, col);
    }

    function normalizePlayerKey(playerKey) {
        try {
            if (OwnerHelpersModule) {
                const normalized = (typeof OwnerHelpersModule.normalizePlayerKeyOptional === 'function')
                    ? OwnerHelpersModule.normalizePlayerKeyOptional(playerKey)
                    : (typeof OwnerHelpersModule.parseSeatKeyOptional === 'function'
                        ? OwnerHelpersModule.parseSeatKeyOptional(playerKey)
                        : null);
                if (normalized === 'black' || normalized === 'white') return normalized;
            }
        } catch (e) { /* ignore */ }

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
        const after = Math.max(0, Math.min(CHARGE_MAX || 99, safeRequested));

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
            getRenderedSpecialMarkerAt,
            getRenderedNonNormalStoneMarkerAt,
            isFrozenCell,
            isNonNormalStoneVisualAt,
            isSpecialStoneAt,
            getSpecialOwnerAt,
            getGameVisualEffectsMap,
        resolveSpecialEffectKey,
        isBoardHiddenTrapMarker,
        isBoardCellModifierMarker,
        isMarkerRenderedAsSpecialStone,
        isNormalStoneForPlayer,
        normalizePlayerKey,
        setChargeWithDelta,
        addChargeWithDelta
    };
}));
