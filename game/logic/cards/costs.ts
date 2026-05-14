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

const RuntimeSharedConstants = (typeof globalThis !== 'undefined' && (globalThis as any).SharedConstants)
    ? (globalThis as any).SharedConstants
    : (typeof self !== 'undefined' ? (self as any).SharedConstants : undefined);
const SharedConstants = RuntimeSharedConstants || ((typeof module === 'object' && module.exports)
    ? _require('../../../shared-constants')
    : undefined);

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
