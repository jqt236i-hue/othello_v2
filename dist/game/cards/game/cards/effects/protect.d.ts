export function applyStrongWill(cardState: any, playerKey: any, row: any, col: any, deps: any): {
    applied: boolean;
    reason: string;
    alreadyAbsolute?: undefined;
} | {
    applied: boolean;
    alreadyAbsolute: boolean;
    reason?: undefined;
} | {
    applied: boolean;
    reason?: undefined;
    alreadyAbsolute?: undefined;
};
export function applyAbsoluteProtect(cardState: any, playerKey: any, row: any, col: any, deps: any): {
    applied: boolean;
    reason: string;
} | {
    applied: boolean;
    reason?: undefined;
};
export function applyGuardWill(cardState: any, gameState: any, playerKey: any, row: any, col: any, deps: any): {
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
//# sourceMappingURL=protect.d.ts.map