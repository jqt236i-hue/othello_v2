type RoundStateOptions = {
    Core: any;
    gameState: any;
};

type AdvanceRoundOptions = {
    Core: any;
    gameState: any;
    playerKey: any;
    options?: any;
    normalizePlayerKey: (player: any) => any;
};

type ApplyPendingRoundBonusOptions = {
    CardLogic: any;
    Core: any;
    cardState: any;
    gameState: any;
    events: any[];
    addChargeWithTotal: (cardState: any, playerKey: any, amount: any, options: any) => any;
};

function clonePendingRoundBonusPayload(value: any) {
    if (!value || typeof value !== 'object') return null;
    const roundNumber = Number.isFinite(Number(value.roundNumber))
        ? Math.max(1, Math.trunc(Number(value.roundNumber)))
        : 1;
    const amount = Number.isFinite(Number(value.amount))
        ? Math.max(0, Math.trunc(Number(value.amount)))
        : 0;
    if (!(amount > 0)) return null;
    return { roundNumber, amount };
}

function ensureGameRoundState(options: RoundStateOptions) {
    const opts = (options && typeof options === 'object') ? options : ({} as RoundStateOptions);
    const gameState = opts.gameState;
    if (!gameState || typeof gameState !== 'object') return gameState;
    if (opts.Core && typeof opts.Core.ensureRoundState === 'function') {
        return opts.Core.ensureRoundState(gameState);
    }
    const roundNumber = Number.isFinite(Number(gameState.roundNumber))
        ? Math.max(1, Math.trunc(Number(gameState.roundNumber)))
        : 1;
    const progress = (gameState.roundCompletionByPlayer && typeof gameState.roundCompletionByPlayer === 'object')
        ? gameState.roundCompletionByPlayer
        : {};
    gameState.roundNumber = roundNumber;
    gameState.roundCompletionByPlayer = {
        black: !!progress.black,
        white: !!progress.white
    };
    gameState.pendingRoundBonus = clonePendingRoundBonusPayload(gameState.pendingRoundBonus);
    return gameState;
}

function resolveRoundBonusAmountForGame(Core: any, roundNumber: any) {
    if (Core && typeof Core.resolveRoundBonusAmount === 'function') {
        return Core.resolveRoundBonusAmount(roundNumber);
    }
    const normalizedRound = Number.isFinite(Number(roundNumber))
        ? Math.max(1, Math.trunc(Number(roundNumber)))
        : 1;
    if (normalizedRound % 10 !== 0) return 0;
    return Math.max(0, Math.floor(normalizedRound / 2));
}

function advanceGameRoundAfterCompletedTurn(options: AdvanceRoundOptions) {
    const opts = (options && typeof options === 'object') ? options : ({} as AdvanceRoundOptions);
    if (opts.Core && typeof opts.Core.advanceRoundAfterCompletedTurn === 'function') {
        return opts.Core.advanceRoundAfterCompletedTurn(opts.gameState, opts.playerKey, opts.options);
    }
    const state = ensureGameRoundState({ Core: opts.Core, gameState: opts.gameState });
    const key = opts.normalizePlayerKey(opts.playerKey);
    const advanceOptions = (opts.options && typeof opts.options === 'object') ? opts.options : {};
    if (!state || !key) {
        return {
            advanced: false,
            roundNumber: state ? state.roundNumber : 1,
            pendingRoundBonus: clonePendingRoundBonusPayload(state && state.pendingRoundBonus)
        };
    }
    state.roundCompletionByPlayer[key] = true;
    if (!state.roundCompletionByPlayer.black || !state.roundCompletionByPlayer.white) {
        return {
            advanced: false,
            roundNumber: state.roundNumber,
            pendingRoundBonus: clonePendingRoundBonusPayload(state.pendingRoundBonus)
        };
    }
    state.roundNumber = Math.max(1, Math.trunc(Number(state.roundNumber || 1))) + 1;
    state.roundCompletionByPlayer = { black: false, white: false };
    if (advanceOptions.scheduleBonus !== false) {
        const amount = resolveRoundBonusAmountForGame(opts.Core, state.roundNumber);
        state.pendingRoundBonus = amount > 0
            ? { roundNumber: state.roundNumber, amount }
            : null;
    }
    return {
        advanced: true,
        roundNumber: state.roundNumber,
        pendingRoundBonus: clonePendingRoundBonusPayload(state.pendingRoundBonus)
    };
}

function consumePendingRoundBonusFromGame(Core: any, gameState: any) {
    if (Core && typeof Core.consumePendingRoundBonus === 'function') {
        return Core.consumePendingRoundBonus(gameState);
    }
    const state = ensureGameRoundState({ Core, gameState });
    if (!state) return null;
    const pending = clonePendingRoundBonusPayload(state.pendingRoundBonus);
    state.pendingRoundBonus = null;
    return pending;
}

function emitRoundBonusBannerPresentation(CardLogic: any, cardState: any, payload: any) {
    if (!CardLogic || typeof CardLogic.emitPresentationEvent !== 'function') return;
    const data = (payload && typeof payload === 'object') ? payload : null;
    const roundNumber = Number.isFinite(Number(data && data.roundNumber))
        ? Math.max(1, Math.trunc(Number(data.roundNumber)))
        : 0;
    const amount = Number.isFinite(Number(data && data.amount))
        ? Math.max(0, Math.trunc(Number(data.amount)))
        : 0;
    if (!(roundNumber > 0) || !(amount > 0)) return;
    CardLogic.emitPresentationEvent(cardState, {
        type: 'ROUND_BONUS_BANNER',
        roundNumber,
        amount,
        durationMs: 3000,
        text: `BONUS ROUND +${amount}`
    });
}

function applyPendingRoundBonusAtTurnStart(options: ApplyPendingRoundBonusOptions) {
    const opts = (options && typeof options === 'object') ? options : ({} as ApplyPendingRoundBonusOptions);
    ensureGameRoundState({ Core: opts.Core, gameState: opts.gameState });
    const pending = consumePendingRoundBonusFromGame(opts.Core, opts.gameState);
    if (!pending) return null;
    const amount = Number.isFinite(Number(pending.amount))
        ? Math.max(0, Math.trunc(Number(pending.amount)))
        : 0;
    const roundNumber = Number.isFinite(Number(pending.roundNumber))
        ? Math.max(1, Math.trunc(Number(pending.roundNumber)))
        : 1;
    if (!(amount > 0)) return null;

    const blackGained = opts.addChargeWithTotal(opts.cardState, 'black', amount, { reason: 'round_bonus' });
    const whiteGained = opts.addChargeWithTotal(opts.cardState, 'white', amount, { reason: 'round_bonus' });
    if (!(blackGained > 0) && !(whiteGained > 0)) {
        return {
            roundNumber,
            amount,
            gainedByPlayer: { black: 0, white: 0 }
        };
    }

    emitRoundBonusBannerPresentation(opts.CardLogic, opts.cardState, {
        roundNumber,
        amount
    });
    if (Array.isArray(opts.events)) {
        opts.events.push({
            type: 'round_bonus_gain',
            roundNumber,
            amount,
            gainedByPlayer: { black: blackGained, white: whiteGained }
        });
    }
    return {
        roundNumber,
        amount,
        gainedByPlayer: { black: blackGained, white: whiteGained }
    };
}

const TurnRoundStateModule = {
    ensureGameRoundState,
    advanceGameRoundAfterCompletedTurn,
    applyPendingRoundBonusAtTurnStart
};

export = TurnRoundStateModule;
