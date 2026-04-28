export function applyTrapWill(cardState: any, gameState: any, playerKey: any, row: any, col: any, deps: any): {
    applied: boolean;
    reason: string;
    row?: undefined;
    col?: undefined;
} | {
    applied: boolean;
    row: any;
    col: any;
    reason?: undefined;
};
export function processTrapEffects(cardState: any, gameState: any, activePlayerKey: any, options: any, deps: any): {
    triggered: never[];
    expired: never[];
    disarmed: never[];
};
//# sourceMappingURL=trap.d.ts.map