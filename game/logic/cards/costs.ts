/**
 * @file costs.ts
 * @description Card cost helpers (Shared between Browser and Headless)
 */

import { CardDef } from '../../../src/types';
import SharedConstantsImport = require('../../../shared-constants');

const SharedConstants: any = SharedConstantsImport;

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
