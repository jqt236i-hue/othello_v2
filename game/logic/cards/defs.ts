/**
 * @file defs.ts
 * @description Card definition helpers (Shared between Browser and Headless)
 */

import { CardDef } from '../../../src/types';
import SharedConstantsImport = require('../../../shared-constants');

const SharedConstants: any = SharedConstantsImport;

const { CARD_DEFS, CARD_TYPE_BY_ID } = SharedConstants || {};

if (!CARD_DEFS) {
    throw new Error('SharedConstants not loaded');
}

const CARD_DEF_BY_ID: Record<string, CardDef> = CARD_DEFS.reduce((map: Record<string, CardDef>, def: CardDef) => {
    map[def.id] = def;
    return map;
}, {});

const CARD_ID_BY_NAME: Record<string, string> = CARD_DEFS.reduce((map: Record<string, string>, def: CardDef) => {
    if (def.name) {
        map[def.name] = def.id;
    }
    return map;
}, {});

function getCardDef(cardId: string): CardDef | null {
    return CARD_DEF_BY_ID[cardId] || null;
}

function getCardType(cardId: string): string | null {
    return CARD_TYPE_BY_ID[cardId] || null;
}

function getCardDisplayName(cardId: string): string {
    const def = getCardDef(cardId);
    return def ? def.name : '';
}

function getCardCodeName(displayName: string): string | null {
    return CARD_ID_BY_NAME[displayName] || null;
}

export = {
    getCardDef,
    getCardType,
    getCardDisplayName,
    getCardCodeName
};
