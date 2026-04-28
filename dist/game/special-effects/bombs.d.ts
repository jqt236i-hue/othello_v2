declare function processBombs(precomputedEvents?: any): Promise<void>;
declare function explodeBombUI(row: number, col: number): Promise<void>;
declare const Bombs: {
    processBombs: typeof processBombs;
    explodeBombUI: typeof explodeBombUI;
};
export = Bombs;
//# sourceMappingURL=bombs.d.ts.map