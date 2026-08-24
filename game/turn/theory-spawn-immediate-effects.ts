import ImmediateEffectDispatcher = require('./immediate-effect-dispatcher');

type ResolveTheorySpawnImmediateEffectsOptions = {
    CardLogic: any;
    cardState: any;
    gameState: any;
    playerKey: any;
    events: any[];
    spawned: any;
    prng: any;
    awardBoardChargeGain?: (CardLogic: any, cardState: any, playerKey: any, amount: any, payload: any) => void;
};

function resolveTheorySpawnImmediateEffects(options: ResolveTheorySpawnImmediateEffectsOptions): void {
    const opts = (options && typeof options === 'object') ? options : ({} as ResolveTheorySpawnImmediateEffectsOptions);
    const spawned = opts.spawned || null;
    const row = Number(spawned && spawned.row);
    const col = Number(spawned && spawned.col);
    if (!Number.isInteger(row) || !Number.isInteger(col)) return;
    const typeKey = String(spawned.type || '').trim().toUpperCase();
    if (!typeKey) return;
    if (!ImmediateEffectDispatcher || typeof ImmediateEffectDispatcher.resolveImmediateEffects !== 'function') {
        throw new Error('ImmediateEffectDispatcher.resolveImmediateEffects is unavailable');
    }
    ImmediateEffectDispatcher.resolveImmediateEffects({
        CardLogic: opts.CardLogic,
        cardState: opts.cardState,
        gameState: opts.gameState,
        playerKey: opts.playerKey,
        events: opts.events,
        row,
        col,
        typeKey,
        randomSource: opts.prng,
        source: 'theory_spawn',
        awardBoardChargeGain: opts.awardBoardChargeGain
    });
}

export = {
    resolveTheorySpawnImmediateEffects
};
