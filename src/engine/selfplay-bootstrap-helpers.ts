/* eslint-disable @typescript-eslint/no-explicit-any */

type SelfplayBootstrapHelpersConfig = {
    SeededPRNG?: any;
    deepClone?: (value: any) => any;
    TurnPipelinePhases?: any;
    CardLogic?: any;
    Core?: any;
};

export function createSelfplayBootstrapHelpers(config?: SelfplayBootstrapHelpersConfig) {
    const cfg = (config && typeof config === 'object') ? config : {} as SelfplayBootstrapHelpersConfig;
    const seededPRNG = cfg.SeededPRNG || null;
    const deepClone = typeof cfg.deepClone === 'function' ? cfg.deepClone : ((value: any) => value);
    const turnPipelinePhases = cfg.TurnPipelinePhases || null;
    const cardLogic = cfg.CardLogic || null;
    const core = cfg.Core || null;

    function clonePrng(rng: any) {
        if (!rng || typeof rng.getState !== 'function') return rng;
        try {
            return seededPRNG.fromState(rng.getState());
        } catch (e) {
            return rng;
        }
    }

    function buildDecisionSnapshot(gameState: any, cardState: any, playerKey: any, rng: any) {
        const clonedGameState = deepClone(gameState);
        const clonedCardState = deepClone(cardState);
        const previewEvents: any[] = [];
        const previewPrng = clonePrng(rng);
        if (previewPrng && typeof previewPrng.random === 'function') {
            clonedCardState._defaultRandomSource = previewPrng;
        }
        try {
            turnPipelinePhases.applyTurnStartPhase(
                cardLogic,
                core,
                clonedCardState,
                clonedGameState,
                playerKey,
                previewEvents,
                previewPrng
            );
        } catch (e) {
            return {
                gameState,
                cardState,
                prng: rng,
                turnStartApplied: false
            };
        }
        return {
            gameState: clonedGameState,
            cardState: clonedCardState,
            prng: previewPrng,
            turnStartApplied: true
        };
    }

    function cloneInitialDeckCardIdsByPlayer(initialDeckCardIdsByPlayer: any) {
        if (!initialDeckCardIdsByPlayer || typeof initialDeckCardIdsByPlayer !== 'object') return null;
        const cloned: Record<string, any> = {};
        let hasDeck = false;
        for (const playerKey of ['black', 'white']) {
            if (Array.isArray(initialDeckCardIdsByPlayer[playerKey])) {
                cloned[playerKey] = initialDeckCardIdsByPlayer[playerKey].slice();
                hasDeck = true;
            }
        }
        return hasDeck ? cloned : null;
    }

    function createInitialState(seed: any, options: any) {
        const prng = seededPRNG.createPRNG(seed);
        const initialDeckCardIdsByPlayer = cloneInitialDeckCardIdsByPlayer(
            options && options.initialDeckCardIdsByPlayer
        );
        const init = cardLogic.initGame(
            prng,
            initialDeckCardIdsByPlayer ? { initialDeckCardIdsByPlayer } : undefined
        );
        return {
            gameState: core.createGameState(),
            cardState: init.cardState,
            prng,
            stateVersion: 0
        };
    }

    return {
        clonePrng,
        buildDecisionSnapshot,
        cloneInitialDeckCardIdsByPlayer,
        createInitialState
    };
}
