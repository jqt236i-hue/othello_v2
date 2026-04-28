declare function applyHeavenBlessingChoice(cardState: any, playerKey: string, selectedCardId: string, deps: any): any;
declare function applyRevealHandWill(cardState: any, playerKey: string, deps: any): any;
declare function parseHiddenHandToken(value: string): {
    owner: string;
    handIndex: number;
} | null;
declare function applyCondemnWill(cardState: any, playerKey: string, targetIndex: number, deps: any): any;
declare const HandEffects: {
    applyHeavenBlessingChoice: typeof applyHeavenBlessingChoice;
    applyRevealHandWill: typeof applyRevealHandWill;
    parseHiddenHandToken: typeof parseHiddenHandToken;
    applyCondemnWill: typeof applyCondemnWill;
};
export = HandEffects;
//# sourceMappingURL=hand-effects.d.ts.map