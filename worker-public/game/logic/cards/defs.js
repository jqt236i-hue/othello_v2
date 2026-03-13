/**
 * @file defs.js
 * @description Card definition helpers (Shared between Browser and Headless)
 */

(function (root, factory) {
    if (typeof module === 'object' && module.exports) {
        module.exports = factory(require('../../../shared-constants'));
    } else {
        root.CardDefs = factory(root.SharedConstants);
    }
}(typeof self !== 'undefined' ? self : this, function (SharedConstants) {
    'use strict';

    const { CARD_DEFS, CARD_TYPE_BY_ID } = SharedConstants || {};

    if (!CARD_DEFS) {
        throw new Error('SharedConstants not loaded');
    }

    const CARD_DEF_BY_ID = CARD_DEFS.reduce((map, def) => {
        map[def.id] = def;
        return map;
    }, {});

    const CARD_ID_BY_NAME = CARD_DEFS.reduce((map, def) => {
        if (def.name) {
            map[def.name] = def.id;
        }
        return map;
    }, {});

    function getCardDef(cardId) {
        return CARD_DEF_BY_ID[cardId] || null;
    }

    function getCardType(cardId) {
        return CARD_TYPE_BY_ID[cardId] || null;
    }

    function getCardDisplayName(cardId) {
        const def = getCardDef(cardId);
        return def ? def.name : '';
    }

    function getCardCodeName(displayName) {
        return CARD_ID_BY_NAME[displayName] || null;
    }

    return {
        getCardDef,
        getCardType,
        getCardDisplayName,
        getCardCodeName
    };
}));
