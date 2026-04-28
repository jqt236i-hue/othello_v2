interface ChargeDeltaResult {
    changed: boolean;
    before: number;
    after: number;
    delta: number;
}
interface ChargeContext {
    helpers?: {
        chargeMax?: number;
        setChargeWithDelta?(cardState: any, playerKey: string, nextValue: number, reason: string, meta?: any): ChargeDeltaResult;
        addChargeWithDelta?(cardState: any, playerKey: string, amount: number, reason: string, meta?: any): ChargeDeltaResult;
    };
}
declare function setChargeValue(cardState: any, playerKey: string, nextValue: number, reason: string, context?: ChargeContext, meta?: any): ChargeDeltaResult;
declare function addChargeValue(cardState: any, playerKey: string, amount: number, reason: string, context?: ChargeContext, meta?: any): ChargeDeltaResult;
declare function addChargeWithTotal(cardState: any, playerKey: string, amount: number, context?: ChargeContext, meta?: any): number;
declare const _default: {
    setChargeValue: typeof setChargeValue;
    addChargeValue: typeof addChargeValue;
    addChargeWithTotal: typeof addChargeWithTotal;
};
export = _default;
//# sourceMappingURL=charge-ledger.d.ts.map