declare function getCatalogItems(options?: any): any[];
declare function getObservationStoneBalance(rootRef: any, options?: any): number;
declare function commitPullTransaction(rootRef: any, pullCount: number, options?: any): any;
declare const GachaTransaction: {
    TRANSACTION_ERROR_CODES: Readonly<{
        INIT_UNAVAILABLE: "init-unavailable";
        CATALOG_EMPTY: "catalog-empty";
        INSUFFICIENT_OBSERVATION_STONES: "insufficient-observation-stones";
        ROLL_FAILED: "roll-failed";
    }>;
    getCatalogItems: typeof getCatalogItems;
    getObservationStoneBalance: typeof getObservationStoneBalance;
    commitPullTransaction: typeof commitPullTransaction;
};
export = GachaTransaction;
//# sourceMappingURL=gacha-transaction.d.ts.map