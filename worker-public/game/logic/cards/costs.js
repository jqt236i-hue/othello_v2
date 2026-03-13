/**
 * @file costs.js
 * @description Card cost helpers (Shared between Browser and Headless)
 */

(function (root, factory) {
    if (typeof module === 'object' && module.exports) {
        module.exports = factory(require('../../../shared-constants'));
    } else {
        root.CardCosts = factory(root.SharedConstants);
    }
}(typeof self !== 'undefined' ? self : this, function (SharedConstants) {
    'use strict';

    const { CARD_DEFS } = SharedConstants || {};

    if (!CARD_DEFS) {
        throw new Error('SharedConstants not loaded');
    }

    function getCardDef(cardId) {
        return CARD_DEFS.find(c => c.id === cardId) || null;
    }

    function getCardCost(cardId) {
        const def = getCardDef(cardId);
        return def ? def.cost : 0;
    }

    return {
        getCardCost
    };
}));
