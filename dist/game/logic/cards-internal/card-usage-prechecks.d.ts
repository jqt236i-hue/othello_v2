interface CardUsageContext {
    gameState?: any;
    cardState?: any;
    playerKey?: string;
    cardType?: string;
    cardId?: string;
    prng?: any;
    heavenSeedHint?: any;
    turnIndex?: number;
    riboUnlockTurnIndex?: number;
    [key: string]: any;
}
interface CardUsageResult {
    ok: boolean;
    heavenOffers: any[] | null;
    condemnOffers: any[] | null;
}
declare function validateCardUsagePreconditions(context: CardUsageContext): CardUsageResult;
declare const _default: {
    validateCardUsagePreconditions: typeof validateCardUsagePreconditions;
};
export = _default;
//# sourceMappingURL=card-usage-prechecks.d.ts.map