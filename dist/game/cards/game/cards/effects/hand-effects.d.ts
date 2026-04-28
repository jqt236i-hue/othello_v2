/**
 * @file hand-effects.ts
 * @description Hand effects: Heaven Blessing, Reveal Hand, Condemn
 */
export function applyHeavenBlessingChoice(cardState: any, playerKey: any, selectedCardId: any, deps: any): {
    applied: boolean;
    reason: string;
    selectedCardId?: undefined;
    vanished?: undefined;
} | {
    applied: boolean;
    selectedCardId: any;
    vanished: any;
    reason?: undefined;
};
export function applyRevealHandWill(cardState: any, playerKey: any, deps: any): {
    applied: boolean;
    reason: string;
    opponentKey?: undefined;
    revealedCount?: undefined;
} | {
    applied: boolean;
    reason: string;
    opponentKey: string;
    revealedCount: number;
} | {
    applied: boolean;
    opponentKey: string;
    revealedCount: any;
    reason?: undefined;
};
export function parseHiddenHandToken(value: any): {
    owner: string;
    handIndex: number;
} | null;
export function applyCondemnWill(cardState: any, playerKey: any, targetIndex: any, deps: any): {
    applied: boolean;
    reason: string;
    destroyedCardId?: undefined;
} | {
    applied: boolean;
    destroyedCardId: any;
    reason?: undefined;
};
//# sourceMappingURL=hand-effects.d.ts.map