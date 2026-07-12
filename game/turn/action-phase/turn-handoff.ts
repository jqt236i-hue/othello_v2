type ConsumeTimeStopCompletedTurnOptions = {
    CardLogic: any;
    cardState: any;
    playerKey: any;
};

type HandOffCompletedTurnOptions = {
    Core: any;
    CardLogic: any;
    cardState: any;
    gameState: any;
    playerKey: any;
    turnNumberAfterCompletion: any;
    advanceGameRoundAfterCompletedTurn: (Core: any, gameState: any, playerKey: any, options: any) => any;
};

type HandOffTurnAfterSelectionOptions = {
    Core: any;
    CardLogic: any;
    cardState: any;
    gameState: any;
    playerKey: any;
    advanceGameRoundAfterCompletedTurn: (Core: any, gameState: any, playerKey: any, options: any) => any;
};

function consumeTimeStopCompletedTurn(options: ConsumeTimeStopCompletedTurnOptions): any {
    const opts = (options && typeof options === 'object') ? options : ({} as ConsumeTimeStopCompletedTurnOptions);
    if (!opts.CardLogic || typeof opts.CardLogic.consumeTimeStopConsecutiveTurn !== 'function') {
        return { consumed: false, remaining: 0, continueTurn: false };
    }
    return opts.CardLogic.consumeTimeStopConsecutiveTurn(opts.cardState, opts.playerKey) || { consumed: false, remaining: 0, continueTurn: false };
}

function handOffCompletedTurn(options: HandOffCompletedTurnOptions): any {
    const opts = (options && typeof options === 'object') ? options : ({} as HandOffCompletedTurnOptions);
    if (!opts.Core || !opts.gameState) return { continued: false, remaining: 0 };
    const playerValue = opts.playerKey === 'black' ? opts.Core.BLACK : opts.Core.WHITE;
    const turnNumber = Number.isFinite(Number(opts.turnNumberAfterCompletion))
        ? Number(opts.turnNumberAfterCompletion)
        : (Number(opts.gameState.turnNumber || 0) + 1);
    if (opts.CardLogic && typeof opts.CardLogic.processPoisonTurnEnd === 'function') {
        opts.CardLogic.processPoisonTurnEnd(opts.cardState, opts.gameState, Number(opts.gameState.turnNumber || 0));
    }
    opts.advanceGameRoundAfterCompletedTurn(opts.Core, opts.gameState, opts.playerKey, null);
    const timeStopRes = consumeTimeStopCompletedTurn({
        CardLogic: opts.CardLogic,
        cardState: opts.cardState,
        playerKey: opts.playerKey
    });
    if (timeStopRes.continueTurn === true) {
        opts.gameState.currentPlayer = playerValue;
        opts.gameState.consecutivePasses = 0;
        opts.gameState.turnNumber = turnNumber;
        if (opts.cardState) {
            opts.cardState.lastTurnStartedFor = null;
        }
        return { continued: true, remaining: Number(timeStopRes.remaining) || 0 };
    }
    opts.gameState.currentPlayer = -playerValue;
    opts.gameState.consecutivePasses = 0;
    opts.gameState.turnNumber = turnNumber;
    return { continued: false, remaining: 0 };
}

function handOffTurnAfterSelection(options: HandOffTurnAfterSelectionOptions): void {
    const opts = (options && typeof options === 'object') ? options : ({} as HandOffTurnAfterSelectionOptions);
    if (!opts.Core || !opts.gameState) return;
    const turnNumberBeforeAction = Number(opts.gameState.turnNumber || 0);
    handOffCompletedTurn({
        Core: opts.Core,
        CardLogic: opts.CardLogic,
        cardState: opts.cardState,
        gameState: opts.gameState,
        playerKey: opts.playerKey,
        turnNumberAfterCompletion: turnNumberBeforeAction + 1,
        advanceGameRoundAfterCompletedTurn: opts.advanceGameRoundAfterCompletedTurn
    });
}

const ActionPhaseTurnHandoffModule = {
    consumeTimeStopCompletedTurn,
    handOffCompletedTurn,
    handOffTurnAfterSelection
};

export = ActionPhaseTurnHandoffModule;
