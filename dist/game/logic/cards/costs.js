"use strict";
/**
 * @file costs.ts
 * @description Card cost helpers (Shared between Browser and Headless)
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
const { CARD_DEFS } = SharedConstants || {};
if (!CARD_DEFS) {
    throw new Error('SharedConstants not loaded');
}
function getCardDef(cardId) {
    return CARD_DEFS.find((c) => c.id === cardId) || null;
}
function getCardCost(cardId) {
    const def = getCardDef(cardId);
    return def ? def.cost : 0;
}
module.exports = {
    getCardCost
};
//# sourceMappingURL=costs.js.map