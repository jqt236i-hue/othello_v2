(function (root, factory) {
    if (typeof module === 'object' && module.exports) {
        module.exports = factory();
    } else {
        root.CardChargeLedger = factory();
    }
}(typeof globalThis !== 'undefined' ? globalThis : (typeof self !== 'undefined' ? self : this), function () {
    'use strict';

    function getHelpers(context) {
        return (context && context.helpers) || {};
    }

    function getChargeMax(context) {
        const helpers = getHelpers(context);
        const value = Number(helpers.chargeMax);
        return Number.isFinite(value) ? value : 99;
    }

    function ensureChargeState(cardState) {
        if (!cardState || typeof cardState !== 'object') return;
        if (!cardState.charge || typeof cardState.charge !== 'object') {
            cardState.charge = { black: 0, white: 0 };
            return;
        }
        if (!Object.prototype.hasOwnProperty.call(cardState.charge, 'black')) cardState.charge.black = 0;
        if (!Object.prototype.hasOwnProperty.call(cardState.charge, 'white')) cardState.charge.white = 0;
    }

    function ensureChargeGainedTotal(cardState) {
        if (!cardState || typeof cardState !== 'object') return;
        if (!cardState.chargeGainedTotal || typeof cardState.chargeGainedTotal !== 'object') {
            cardState.chargeGainedTotal = { black: 0, white: 0 };
            return;
        }
        if (!Object.prototype.hasOwnProperty.call(cardState.chargeGainedTotal, 'black')) {
            cardState.chargeGainedTotal.black = 0;
        }
        if (!Object.prototype.hasOwnProperty.call(cardState.chargeGainedTotal, 'white')) {
            cardState.chargeGainedTotal.white = 0;
        }
    }

    function setChargeValue(cardState, playerKey, nextValue, reason, context, meta) {
        const helpers = getHelpers(context);
        if (typeof helpers.setChargeWithDelta === 'function') {
            if (meta === undefined) {
                return helpers.setChargeWithDelta(cardState, playerKey, nextValue, reason);
            }
            return helpers.setChargeWithDelta(cardState, playerKey, nextValue, reason, meta);
        }
        if (!cardState) return { changed: false, before: 0, after: 0, delta: 0 };
        ensureChargeState(cardState);
        const before = Number(cardState.charge[playerKey] || 0);
        const safeBefore = Number.isFinite(before) ? before : 0;
        const requested = Number(nextValue);
        const safeRequested = Number.isFinite(requested) ? requested : safeBefore;
        const after = Math.max(0, Math.min(getChargeMax(context), safeRequested));
        cardState.charge[playerKey] = after;
        return { changed: after !== safeBefore, before: safeBefore, after, delta: after - safeBefore };
    }

    function addChargeValue(cardState, playerKey, amount, reason, context, meta) {
        const helpers = getHelpers(context);
        if (typeof helpers.addChargeWithDelta === 'function') {
            if (meta === undefined) {
                return helpers.addChargeWithDelta(cardState, playerKey, amount, reason);
            }
            return helpers.addChargeWithDelta(cardState, playerKey, amount, reason, meta);
        }
        if (!cardState) return { changed: false, before: 0, after: 0, delta: 0 };
        ensureChargeState(cardState);
        const before = Number(cardState.charge[playerKey] || 0);
        const safeBefore = Number.isFinite(before) ? before : 0;
        const add = Number(amount);
        const safeAdd = Number.isFinite(add) ? add : 0;
        return setChargeValue(cardState, playerKey, safeBefore + safeAdd, reason, context, meta);
    }

    function addChargeWithTotal(cardState, playerKey, amount, context, meta) {
        if (!cardState || !amount) return 0;
        ensureChargeState(cardState);
        ensureChargeGainedTotal(cardState);

        const deltaRes = addChargeValue(cardState, playerKey, amount, 'placement_or_effect_gain', context, meta);
        const added = Number(deltaRes.delta) || 0;
        if (added > 0) {
            cardState.chargeGainedTotal[playerKey] = (cardState.chargeGainedTotal[playerKey] || 0) + added;
        }

        return added;
    }

    return {
        setChargeValue,
        addChargeValue,
        addChargeWithTotal
    };
}));
