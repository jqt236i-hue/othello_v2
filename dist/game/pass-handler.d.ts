declare function setPassHandlerTimerService(service: any): void;
declare function hasUsableCardFor(playerKey: any): any;
declare function ensureCurrentPlayerCanActOrPass(options: any): boolean;
/**
 * Helper to apply pass via TurnPipeline with safe fallback.
 * @param {string} playerKey - 'black' or 'white'
 * @returns {{ ok: boolean, events: Array }}
 */
declare function applyPassViaPipeline(playerKey: any): {
    ok: boolean;
    events: any;
    gameState?: undefined;
    cardState?: undefined;
} | {
    ok: boolean;
    events: any;
    gameState: any;
    cardState: any;
};
declare function handleDoublePlaceNoSecondMove(move: any, passedPlayer: any): Promise<void>;
declare function handleBlackPassWhenNoMoves(): Promise<void>;
declare function processPassTurn(playerKey: any, autoMode: any): Promise<boolean>;
declare const _default: {
    applyPassViaPipeline: typeof applyPassViaPipeline;
    handleDoublePlaceNoSecondMove: typeof handleDoublePlaceNoSecondMove;
    handleBlackPassWhenNoMoves: typeof handleBlackPassWhenNoMoves;
    processPassTurn: typeof processPassTurn;
    hasUsableCardFor: typeof hasUsableCardFor;
    ensureCurrentPlayerCanActOrPass: typeof ensureCurrentPlayerCanActOrPass;
    setPassHandlerTimerService: typeof setPassHandlerTimerService;
};
export = _default;
//# sourceMappingURL=pass-handler.d.ts.map