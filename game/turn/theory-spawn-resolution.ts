import TheorySpawnImmediateEffectsModule = require('./theory-spawn-immediate-effects');

type ResolveTheorySpawnTurnResultOptions = {
    CardLogic: any;
    cardState: any;
    gameState: any;
    playerKey: any;
    events: any[];
    spawned: any;
    prng: any;
    timing?: string | null;
    awardBoardChargeGain?: any;
};

function resolveTheorySpawnTurnResult(options: ResolveTheorySpawnTurnResultOptions): void {
    const opts = (options && typeof options === 'object') ? options : ({} as ResolveTheorySpawnTurnResultOptions);
    if (!opts.spawned || !Array.isArray(opts.events)) return;

    const event: any = {
        type: 'theory_incarnation_spawned',
        player: opts.playerKey,
        detail: opts.spawned
    };
    if (opts.timing) {
        event.timing = opts.timing;
    }
    opts.events.push(event);

    if (TheorySpawnImmediateEffectsModule && typeof TheorySpawnImmediateEffectsModule.resolveTheorySpawnImmediateEffects === 'function') {
        TheorySpawnImmediateEffectsModule.resolveTheorySpawnImmediateEffects({
            CardLogic: opts.CardLogic,
            cardState: opts.cardState,
            gameState: opts.gameState,
            playerKey: opts.playerKey,
            events: opts.events,
            spawned: opts.spawned,
            prng: opts.prng,
            awardBoardChargeGain: opts.awardBoardChargeGain
        });
    }
}

const TheorySpawnResolution = {
    resolveTheorySpawnTurnResult
};

export = TheorySpawnResolution;
