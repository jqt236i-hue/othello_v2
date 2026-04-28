"use strict";
/**
 * @file defs.ts
 * @description Card definition helpers (Shared between Browser and Headless)
 */
function _require(id) {
    if (typeof __non_webpack_require__ !== 'undefined') {
        return __non_webpack_require__(id);
    }
    if (typeof require === 'function') {
        return require(id);
    }
    throw new Error('Unable to require ' + id);
}
const SharedConstants = (typeof module === 'object' && module.exports)
    ? _require('../../../shared-constants')
    : (typeof self !== 'undefined' ? self.SharedConstants : undefined);
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
module.exports = {
    getCardDef,
    getCardType,
    getCardDisplayName,
    getCardCodeName
};
//# sourceMappingURL=defs.js.map