declare function applyTrapWill(cardState: any, gameState: any, playerKey: string, row: number, col: number, deps: any): any;
declare function processTrapEffects(cardState: any, gameState: any, activePlayerKey: string, options: any, deps: any): any;
declare const TrapEffects: {
    applyTrapWill: typeof applyTrapWill;
    processTrapEffects: typeof processTrapEffects;
};
export = TrapEffects;
//# sourceMappingURL=trap.d.ts.map