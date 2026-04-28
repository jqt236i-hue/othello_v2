/**
 * @file defs.ts
 * @description Card definition helpers (Shared between Browser and Headless)
 */
import { CardDef } from '../../../src/types';
declare function getCardDef(cardId: string): CardDef | null;
declare function getCardType(cardId: string): string | null;
declare function getCardDisplayName(cardId: string): string;
declare function getCardCodeName(displayName: string): string | null;
declare const _default: {
    getCardDef: typeof getCardDef;
    getCardType: typeof getCardType;
    getCardDisplayName: typeof getCardDisplayName;
    getCardCodeName: typeof getCardCodeName;
};
export = _default;
//# sourceMappingURL=defs.d.ts.map