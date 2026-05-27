/* eslint-disable @typescript-eslint/no-explicit-any */

type SelfplayRetryHelpersConfig = {
    deepClone?: (value: any) => any;
    clonePrng?: (rng: any) => any;
    readSelfplayPendingEffect?: (cardState: any, playerKey: any) => any;
    buildPendingSelectionAction?: (
        gameState: any,
        cardState: any,
        playerKey: any,
        pendingType: any,
        rng: any,
        pending: any
    ) => any;
    getLegalMovesForAction?: (gameState: any, cardState: any, playerKey: any) => any[];
    resolveForcedPlacementCandidates?: (moves: any[], options: any, board: any) => any;
    getSelfplayBoard?: (gameState: any, cardState: any) => any;
    CardLogic?: any;
    Core?: any;
    toPlayerValue?: (playerKey: any) => any;
    getSafeCardContext?: (cardState: any) => any;
    toPlayerKey?: (playerValue: any) => any;
    createAction?: (decision: any, gameIndex: any, actionCounter: any, turnIndex: any) => any;
    applyActionSafe?: (state: any, playerKey: any, action: any) => any;
};

export function createSelfplayRetryHelpers(config?: SelfplayRetryHelpersConfig) {
    const cfg = (config && typeof config === 'object') ? config : {} as SelfplayRetryHelpersConfig;
    const deepClone = typeof cfg.deepClone === 'function' ? cfg.deepClone : ((value: any) => value);
    const clonePrng = typeof cfg.clonePrng === 'function' ? cfg.clonePrng : ((rng: any) => rng);
    const readSelfplayPendingEffect = typeof cfg.readSelfplayPendingEffect === 'function'
        ? cfg.readSelfplayPendingEffect
        : (() => null);
    const buildPendingSelectionAction = typeof cfg.buildPendingSelectionAction === 'function'
        ? cfg.buildPendingSelectionAction
        : (() => null);
    const getLegalMovesForAction = typeof cfg.getLegalMovesForAction === 'function'
        ? cfg.getLegalMovesForAction
        : (() => []);
    const resolveForcedPlacementCandidates = typeof cfg.resolveForcedPlacementCandidates === 'function'
        ? cfg.resolveForcedPlacementCandidates
        : ((moves: any[]) => ({ moves }));
    const getSelfplayBoard = typeof cfg.getSelfplayBoard === 'function'
        ? cfg.getSelfplayBoard
        : ((gameState: any) => gameState && gameState.board);
    const cardLogic = cfg.CardLogic || null;
    const core = cfg.Core || null;
    const toPlayerValue = typeof cfg.toPlayerValue === 'function'
        ? cfg.toPlayerValue
        : ((playerKey: any) => playerKey);
    const getSafeCardContext = typeof cfg.getSafeCardContext === 'function'
        ? cfg.getSafeCardContext
        : (() => null);
    const toPlayerKey = typeof cfg.toPlayerKey === 'function'
        ? cfg.toPlayerKey
        : ((playerValue: any) => playerValue);
    const createAction = typeof cfg.createAction === 'function'
        ? cfg.createAction
        : ((decision: any, gameIndex: any, actionCounter: any, turnIndex: any) => ({
            action: Object.assign({}, decision && decision.action, {
                actionId: `sp-${gameIndex}-${actionCounter}`,
                turnIndex
            }),
            actionType: decision && decision.action && decision.action.type
        }));
    const applyActionSafe = typeof cfg.applyActionSafe === 'function'
        ? cfg.applyActionSafe
        : (() => ({ ok: false }));

    function applyDecisionSnapshotBaseline(state: any, snapshot: any, stateVersion: any) {
        state.cardState = deepClone(snapshot.cardState);
        state.gameState = deepClone(snapshot.gameState);
        if (snapshot.prng) state.prng = clonePrng(snapshot.prng);
        if (state.prng && typeof state.prng.random === 'function' && state.cardState) {
            state.cardState._defaultRandomSource = state.prng;
        }
        state.stateVersion = stateVersion;
        state.skipTurnStartForNextAction = snapshot.turnStartApplied === true;
    }

    function applyRejectedTurnStartBaseline(state: any, rejectedResult: any) {
        if (!rejectedResult || !rejectedResult.gameState || !rejectedResult.cardState) return false;
        state.gameState = rejectedResult.gameState;
        state.cardState = rejectedResult.cardState;
        state.stateVersion = Number.isFinite(rejectedResult.nextStateVersion)
            ? rejectedResult.nextStateVersion
            : state.stateVersion;
        state.skipTurnStartForNextAction = true;
        return true;
    }

    function getPendingSelectionState(cardState: any, playerKey: any) {
        const pending = readSelfplayPendingEffect(cardState, playerKey);
        if (!pending || pending.stage !== 'selectTarget') return null;
        return pending;
    }

    function buildRetryFallbackDecision(gameState: any, cardState: any, playerKey: any, rng: any, options: any) {
        const pending = getPendingSelectionState(cardState, playerKey);
        if (pending) {
            const pendingAction = buildPendingSelectionAction(gameState, cardState, playerKey, pending.type, rng, pending);
            if (pendingAction) {
                return {
                    action: pendingAction,
                    legalMoves: getLegalMovesForAction(gameState, cardState, playerKey)
                };
            }
            return {
                action: { type: 'cancel_card', cancelOptions: { refundCost: false, resetUsage: true } },
                legalMoves: getLegalMovesForAction(gameState, cardState, playerKey)
            };
        }

        const fallbackLegalMoves = getLegalMovesForAction(gameState, cardState, playerKey);
        const sortedFallbackMoves = Array.isArray(fallbackLegalMoves)
            ? fallbackLegalMoves.slice().sort((a: any, b: any) => (a.row - b.row) || (a.col - b.col))
            : [];
        const forcedFallback = resolveForcedPlacementCandidates(sortedFallbackMoves, options, getSelfplayBoard(gameState, cardState));
        const fallbackMoves = Array.isArray(forcedFallback.moves) && forcedFallback.moves.length > 0
            ? forcedFallback.moves
            : sortedFallbackMoves;
        return {
            action: (fallbackMoves.length > 0)
                ? { type: 'place', row: fallbackMoves[0].row, col: fallbackMoves[0].col }
                : { type: 'pass' },
            legalMoves: sortedFallbackMoves
        };
    }

    function listFallbackPlacementActions(fallbackDecision: any) {
        const actions: any[] = [];
        const seen = new Set();
        const addMove = (move: any) => {
            if (!move || !Number.isInteger(move.row) || !Number.isInteger(move.col)) return;
            const key = `${move.row},${move.col}`;
            if (seen.has(key)) return;
            seen.add(key);
            actions.push({ type: 'place', row: move.row, col: move.col });
        };

        if (fallbackDecision && fallbackDecision.action && fallbackDecision.action.type === 'place') {
            addMove(fallbackDecision.action);
        }
        const legalMoves = fallbackDecision && Array.isArray(fallbackDecision.legalMoves)
            ? fallbackDecision.legalMoves
            : [];
        for (const move of legalMoves) addMove(move);
        return actions;
    }

    function getPlacementFlipsBeforeApply(gameState: any, cardState: any, playerKey: any, action: any) {
        if (!action || action.type !== 'place') return null;
        const pendingType = cardLogic.getPendingEffectType(cardState, playerKey) || null;
        if (cardLogic.isFreePlacementPendingType(pendingType)) return null;
        return core.getFlipsWithContext(
            gameState,
            action.row,
            action.col,
            toPlayerValue(playerKey),
            getSafeCardContext(cardState)
        ).length;
    }

    function tryFallbackPlacementsFromSnapshot(
        state: any,
        fallbackSnapshot: any,
        fallbackStateVersion: any,
        fallbackDecision: any,
        gameIndex: any,
        actionCounterRef: any,
        playerKey: any
    ) {
        const placementActions = listFallbackPlacementActions(fallbackDecision);
        let lastResult = null;
        let lastAction = null;
        let lastFlipsBefore = null;
        let skippedInvalidPlacements = 0;

        for (const placementAction of placementActions) {
            applyDecisionSnapshotBaseline(state, fallbackSnapshot, fallbackStateVersion);
            let flipsBefore = null;
            try {
                flipsBefore = getPlacementFlipsBeforeApply(state.gameState, state.cardState, playerKey, placementAction);
            } catch (err) {
                skippedInvalidPlacements += 1;
                continue;
            }
            if (Number.isFinite(flipsBefore) && flipsBefore <= 0) {
                skippedInvalidPlacements += 1;
                continue;
            }

            const placementDecision = Object.assign({}, fallbackDecision, {
                action: placementAction,
                skippedInvalidPlacements
            });
            actionCounterRef.value += 1;
            const placement = createAction(placementDecision, gameIndex, actionCounterRef.value, state.stateVersion);
            const placementResult = applyActionSafe(state, playerKey, placement.action);
            lastResult = placementResult;
            lastAction = placement.action;
            lastFlipsBefore = flipsBefore;
            if (placementResult.ok) {
                return {
                    ok: true,
                    decision: placementDecision,
                    action: placement.action,
                    result: placementResult,
                    flipsBefore,
                    skippedInvalidPlacements
                };
            }
        }

        return {
            ok: false,
            result: lastResult,
            action: lastAction,
            flipsBefore: lastFlipsBefore,
            skippedInvalidPlacements,
            attemptedPlacements: placementActions.length
        };
    }

    function buildIllegalMoveHardcase(payload: any) {
        const source = payload && typeof payload === 'object' ? payload : {};
        const fallbackSnapshot = source.fallbackSnapshot || {};
        const forced = source.forced || {};
        const placementFallback = source.placementFallback || {};
        const forcedResult = source.forcedResult || {};
        const retry = source.retry || {};
        const first = source.first || {};
        return {
            schemaVersion: 'selfplay_illegal_move_hardcase.v1',
            generatedAt: new Date().toISOString(),
            gameIndex: source.gameIndex,
            ply: source.ply,
            player: source.playerKey,
            stateVersion: source.fallbackStateVersion,
            firstActionType: first.actionType || null,
            firstAction: first.action ? deepClone(first.action) : null,
            retryActionType: retry.actionType || null,
            retryAction: retry.action ? deepClone(retry.action) : null,
            forcedAction: forced.action ? deepClone(forced.action) : null,
            forcedPendingBefore: source.forcedPendingBefore || null,
            forcedFlipsBefore: Number.isFinite(source.forcedFlipsBefore) ? source.forcedFlipsBefore : null,
            forcedRejectedReason: forcedResult.rejectedReason || null,
            forcedErrorMessage: forcedResult.errorMessage || null,
            prngState: fallbackSnapshot.prng && typeof fallbackSnapshot.prng.getState === 'function'
                ? fallbackSnapshot.prng.getState()
                : null,
            fallbackCurrentPlayer: fallbackSnapshot.gameState ? toPlayerKey(fallbackSnapshot.gameState.currentPlayer) : null,
            legalMoves: source.fallbackDecision && Array.isArray(source.fallbackDecision.legalMoves)
                ? deepClone(source.fallbackDecision.legalMoves)
                : [],
            attemptedPlacements: Number.isFinite(placementFallback.attemptedPlacements)
                ? placementFallback.attemptedPlacements
                : null,
            skippedInvalidPlacements: Number.isFinite(placementFallback.skippedInvalidPlacements)
                ? placementFallback.skippedInvalidPlacements
                : null,
            lastPlacementAction: placementFallback.action ? deepClone(placementFallback.action) : null,
            lastPlacementFlipsBefore: Number.isFinite(placementFallback.flipsBefore)
                ? placementFallback.flipsBefore
                : null,
            snapshot: {
                turnStartApplied: fallbackSnapshot.turnStartApplied === true,
                prngState: fallbackSnapshot.prng && typeof fallbackSnapshot.prng.getState === 'function'
                    ? fallbackSnapshot.prng.getState()
                    : null,
                gameState: fallbackSnapshot.gameState ? deepClone(fallbackSnapshot.gameState) : null,
                cardState: fallbackSnapshot.cardState ? deepClone(fallbackSnapshot.cardState) : null
            }
        };
    }

    function attachSelfplayHardcase(error: any, hardcase: any) {
        if (error && hardcase) {
            error.selfplayHardcase = hardcase;
        }
        return error;
    }

    return {
        applyDecisionSnapshotBaseline,
        applyRejectedTurnStartBaseline,
        getPendingSelectionState,
        buildRetryFallbackDecision,
        listFallbackPlacementActions,
        getPlacementFlipsBeforeApply,
        tryFallbackPlacementsFromSnapshot,
        buildIllegalMoveHardcase,
        attachSelfplayHardcase
    };
}
