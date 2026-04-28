declare function getCatalogItems(options?: any): any[];
declare function commitPullTransaction(rootRef: any, pullCount: number, options?: any): any;
declare function setupGachaControls(options?: any): any;
declare const GachaHandler: {
    commitPullTransaction: typeof commitPullTransaction;
    getCatalogItems: typeof getCatalogItems;
    setupGachaControls: typeof setupGachaControls;
};
export = GachaHandler;
//# sourceMappingURL=gacha.d.ts.map