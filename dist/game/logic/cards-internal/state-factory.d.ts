/**
 * @file state-factory.ts
 * @description Card state factory shared between Browser and Headless.
 */
interface PRNG {
    shuffle: (array: any[]) => any[];
    random: () => number;
}
interface Context {
    constants?: any;
    defaultPrng?: PRNG;
    resolveCardBoardConfig?: (config?: any) => any;
    resolveInitialDeckCardIdsByPlayer?: (options?: any, prng?: PRNG) => Record<string, string[]>;
    buildInitialBoardBonusMap?: (prng: PRNG, boardConfig: any) => any;
    createStoneIdBoard?: (boardConfig: any) => string[][];
    getOpeningPlacementsForState?: (boardConfig: any) => {
        row: number;
        col: number;
    }[];
    ensureCardCopyState?: (cardState: any) => void;
    cloneSalvationDestroyedLedger?: (source: any) => any;
}
declare function createCardState(prng: PRNG | null, options: any, context: Context): any;
declare function copyCardState(cs: any, context: Context): any;
declare const _default: {
    createCardState: typeof createCardState;
    copyCardState: typeof copyCardState;
};
export = _default;
//# sourceMappingURL=state-factory.d.ts.map