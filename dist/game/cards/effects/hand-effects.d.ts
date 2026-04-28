/**
 * @file hand-effects.ts
 * @description Hand effects: Heaven Blessing, Reveal Hand, Condemn
 */
import type { CardState, PlayerKey } from '../../../src/types';
declare function applyHeavenBlessingChoice(cardState: CardState, playerKey: PlayerKey, selectedCardId: string, deps: any): Record<string, any>;
declare function applyRevealHandWill(cardState: CardState, playerKey: PlayerKey, deps: any): Record<string, any>;
declare function parseHiddenHandToken(value: any): {
    owner: PlayerKey;
    handIndex: number;
} | null;
declare function applyCondemnWill(cardState: CardState, playerKey: PlayerKey, targetIndex: number, deps: any): Record<string, any>;
declare const _default: {
    applyHeavenBlessingChoice: typeof applyHeavenBlessingChoice;
    applyRevealHandWill: typeof applyRevealHandWill;
    parseHiddenHandToken: typeof parseHiddenHandToken;
    applyCondemnWill: typeof applyCondemnWill;
};
export = _default;
//# sourceMappingURL=hand-effects.d.ts.map