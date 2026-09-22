import { createInitialBattlePosition } from '../../game/battle/initial';
import type { BattleTransition } from '../../shared/battle/types';
import { BattleMatch as ProductionMatch } from '../../game/battle/match';
import Startup = require('../../shared/cpu-opponent-startup-options');
import StateHash = require('../../shared/state-hash');
import { cloneLv10, type Lv10Player, type Lv10Position } from '../../game/ai/cpu-lv10-position';
import { runLv10Turn, type Lv10TurnDeps, type Lv10TurnRecord } from '../../game/cpu-lv10-turn';


export type ProductionPosition = Lv10Position & { prngState: any };
export type ProductionTransition = BattleTransition;

/** These fields carry presentation delivery or references to the separately
 * recorded PRNG, never game rules. All other fields, including cardState's
 * PRNG checkpoint, pending/copy IDs and effect counters, remain comparable. */
export const PRODUCTION_STATE_EXCLUSIONS = Object.freeze({
    presentationEvents: 'Presentation delivery queue',
    _presentationEventsPersist: 'Presentation delivery journal',
    chargeDeltaEvents: 'Charge display deltas; charge and the ledger remain compared',
    _defaultRandomSource: 'Runtime object; full PRNG state is recorded separately',
    _boardOpsRandomSource: 'Action-scoped runtime reference to the recorded PRNG',
    _currentActionMeta: 'Action-scoped runtime context, cleared by the pipeline'
});

export function comparableProductionState(state: Lv10Position): ProductionPosition {
    const copy = cloneLv10(state) as ProductionPosition;
    for (const key of Object.keys(PRODUCTION_STATE_EXCLUSIONS)) delete copy.cardState[key];
    return copy;
}

export function productionStateKey(state: Lv10Position): string {
    return StateHash.stableStringify(comparableProductionState(state));
}

export function createProductionPosition(seed: number, profiles: Record<Lv10Player, string | number>, boardConfig?: any): ProductionPosition {
    if (!Number.isInteger(seed) || seed < 0 || seed > 0xffffffff) throw new Error('Expected uint32 match seed');
    const options: any = { boardConfig, initialDeckCardIdsByPlayer: {}, initialChargeByPlayer: {}, chargeGainMultiplierByPlayer: {} };
    for (const player of ['black', 'white'] as const) {
        const startup = Startup.getCpuOpponentStartupOptions(profiles[player], player);
        if (!startup.deckCardIds) throw new Error(`Production selfplay requires an explicit deck recipe: ${profiles[player]}`);
        options.initialDeckCardIdsByPlayer[player] = startup.deckCardIds;
        if (startup.initialCharge !== null) options.initialChargeByPlayer[player] = startup.initialCharge;
        if (startup.chargeGainMultiplier !== null) options.chargeGainMultiplierByPlayer[player] = startup.chargeGainMultiplier;
    }
    return createInitialBattlePosition(seed, options);
}

export { BattleMatch as ProductionMatch } from '../../game/battle/match';

export type ProductionCpu = {
    advise: Lv10TurnDeps['advise'];
    /** A frozen CPU supplies its own unmodified turn policy as well as search. */
    runTurn?: typeof runLv10Turn;
    memory: NonNullable<Lv10TurnDeps['rejectedActions']>;
};

export function createProductionCpu(advise: ProductionCpu['advise'], runTurn = runLv10Turn): ProductionCpu {
    return { advise, runTurn, memory: { identity: null, actions: [] } };
}

/** Calls exactly the normal public-observation/rejection/cancellation policy.
 * The advisor only receives the public request assembled by that policy. */
export async function stepProductionCpu(match: ProductionMatch, cpu: ProductionCpu,
    publicRecipes: ReturnType<Lv10TurnDeps['getPublicRecipes']>): Promise<Lv10TurnRecord> {
    const owner = match.owner, player = match.controller, turn = match.snapshot().gameState.turnNumber;
    return (cpu.runTurn || runLv10Turn)(player, {
        getState: () => match.snapshot(), getPublicRecipes: () => publicRecipes,
        advise: cpu.advise, rejectedActions: cpu.memory,
        isCurrent: () => !match.isDisposed && !match.terminal && match.owner === owner && match.controller === player && match.snapshot().gameState.turnNumber === turn,
        apply: async action => match.apply(action)
    });
}
