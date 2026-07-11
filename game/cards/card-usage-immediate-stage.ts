type CardUsageImmediateStageOptions = {
    cardState: any;
    gameState: any;
    playerKey: string;
    cardType: string;
    prng: any;
    applyTheoryIncarnationUsage?: (cardState: any, gameState: any, playerKey: string, prng: any) => any;
    applyChaosSummonUsage?: (cardState: any, gameState: any, playerKey: string, prng: any) => any;
    applyBoardExecutorUsage?: (cardState: any, gameState: any, playerKey: string, prng: any) => any;
};

function applyImmediateCardUsage(options: CardUsageImmediateStageOptions): any {
    let apply: any = null;
    if (options.cardType === 'THEORY_INCARNATION') apply = options.applyTheoryIncarnationUsage;
    if (options.cardType === 'CHAOS_SUMMON') apply = options.applyChaosSummonUsage;
    if (options.cardType === 'BOARD_EXECUTOR') apply = options.applyBoardExecutorUsage;
    if (!apply) {
        return { handled: false, ok: true };
    }
    const result = apply(options.cardState, options.gameState, options.playerKey, options.prng);
    return { handled: true, ok: !!(result && result.applied), result };
}

export = {
    applyImmediateCardUsage
};
