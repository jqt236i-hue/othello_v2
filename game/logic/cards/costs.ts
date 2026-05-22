/**
 * @file costs.ts
 * @description Card cost helpers (Shared between Browser and Headless)
 */

import { CardDef } from '../../../src/types';

declare const __non_webpack_require__: NodeRequire | undefined;

function _require(id: string): any {
    if (typeof __non_webpack_require__ !== 'undefined') {
        return __non_webpack_require__(id);
    }
    if (typeof require === 'function') {
        return require(id);
    }
    throw new Error('Unable to require ' + id);
}

function safeRequire(id: string): any {
    try {
        return _require(id);
    } catch (e) {
        return null;
    }
}

const SharedConstants = ((typeof module === 'object' && module.exports)
    ? safeRequire('../../../shared-constants')
    : null) || (typeof self !== 'undefined' ? (self as any).SharedConstants : undefined);

const { CARD_DEFS } = SharedConstants || {};

if (!CARD_DEFS) {
    throw new Error('SharedConstants not loaded');
}

function getCardDef(cardId: string): CardDef | null {
    return CARD_DEFS.find((c: CardDef) => c.id === cardId) || null;
}

function getCardCost(cardId: string): number {
    const def = getCardDef(cardId);
    return def ? def.cost : 0;
}

export = {
    getCardCost
};
