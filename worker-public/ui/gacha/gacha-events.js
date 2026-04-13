(function (root, factory) {
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = factory();
    } else {
        root.GachaEventsModule = factory();
    }
}(typeof self !== 'undefined' ? self : this, function () {
    'use strict';

    const GACHA_INVENTORY_UPDATED_EVENT = 'gacha:inventory-updated';

    function resolveDocument(rootRef) {
        if (rootRef && rootRef.document) return rootRef.document;
        if (typeof document !== 'undefined') return document;
        return null;
    }

    function normalizeIdList(value) {
        return Array.isArray(value)
            ? value.map((entry) => String(entry || '').trim()).filter(Boolean)
            : [];
    }

    function buildGachaInventoryUpdatedDetail(detail) {
        const source = (detail && typeof detail === 'object') ? detail : {};
        return {
            pulls: Array.isArray(source.pulls) ? source.pulls.filter(Boolean) : [],
            newlyUnlockedIds: normalizeIdList(source.newlyUnlockedIds),
            alreadyOwnedIds: normalizeIdList(source.alreadyOwnedIds),
            state: source.state && typeof source.state === 'object' ? source.state : null
        };
    }

    function dispatchGachaInventoryUpdated(rootRef, detail) {
        const safeDetail = buildGachaInventoryUpdatedDetail(detail);
        try {
            if (!rootRef || typeof rootRef.dispatchEvent !== 'function') return false;
            if (typeof rootRef.CustomEvent === 'function') {
                rootRef.dispatchEvent(new rootRef.CustomEvent(GACHA_INVENTORY_UPDATED_EVENT, {
                    detail: safeDetail
                }));
                return true;
            }
            const docRef = resolveDocument(rootRef);
            if (!docRef || typeof docRef.createEvent !== 'function') return false;
            const event = docRef.createEvent('Event');
            event.initEvent(GACHA_INVENTORY_UPDATED_EVENT, false, false);
            event.detail = safeDetail;
            rootRef.dispatchEvent(event);
            return true;
        } catch (e) {
            return false;
        }
    }

    function addGachaInventoryUpdatedListener(rootRef, listener) {
        if (!rootRef || typeof rootRef.addEventListener !== 'function' || typeof listener !== 'function') {
            return function () {};
        }
        const handler = function (event) {
            listener(buildGachaInventoryUpdatedDetail(event && event.detail));
        };
        rootRef.addEventListener(GACHA_INVENTORY_UPDATED_EVENT, handler);
        return function () {
            try {
                rootRef.removeEventListener(GACHA_INVENTORY_UPDATED_EVENT, handler);
            } catch (e) { /* ignore */ }
        };
    }

    return {
        GACHA_INVENTORY_UPDATED_EVENT,
        buildGachaInventoryUpdatedDetail,
        dispatchGachaInventoryUpdated,
        addGachaInventoryUpdatedListener
    };
}));
