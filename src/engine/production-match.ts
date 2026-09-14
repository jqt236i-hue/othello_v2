import Core = require('../../game/logic/core');
import Pipeline = require('../../game/turn/turn_pipeline');
import { applyTurnStartAndCheckpoint } from '../../game/turn/turn-start-runtime';
import BoardOps = require('../../game/logic/board_ops');
import Startup = require('../../shared/cpu-opponent-startup-options');
import Presentation = require('../../shared/presentation-queue');
import StateHash = require('../../shared/state-hash');
import { cloneLv10, currentLv10Player, lv10DecisionPlayer, type Lv10Action, type Lv10Player, type Lv10Position } from '../../game/ai/cpu-lv10-position';
import { runLv10Turn, type Lv10TurnDeps, type Lv10TurnRecord } from '../../game/cpu-lv10-turn';

const Prng: any = require('../../game/schema/prng');
const Cards: any = require('../../game/logic/cards');

export type ProductionPosition = Lv10Position & { prngState: any };
export type ProductionTransition = {
    kind: 'turn_start' | 'action'; player: Lv10Player; action?: Lv10Action;
    before: ProductionPosition; after: ProductionPosition;
    ok: boolean; reason: string | null; events: any[]; stopAction?: boolean;
};

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
    const rng = Prng.createPRNG(seed);
    const options: any = { boardConfig, initialDeckCardIdsByPlayer: {}, initialChargeByPlayer: {}, chargeGainMultiplierByPlayer: {} };
    for (const player of ['black', 'white'] as const) {
        const startup = Startup.getCpuOpponentStartupOptions(profiles[player], player);
        if (!startup.deckCardIds) throw new Error(`Production selfplay requires an explicit deck recipe: ${profiles[player]}`);
        options.initialDeckCardIdsByPlayer[player] = startup.deckCardIds;
        if (startup.initialCharge !== null) options.initialChargeByPlayer[player] = startup.initialCharge;
        if (startup.chargeGainMultiplier !== null) options.chargeGainMultiplierByPlayer[player] = startup.chargeGainMultiplier;
    }
    const gameState = Core.createGameState(boardConfig);
    const cardState = Cards.createCardState(rng, options);
    return { gameState, cardState: cloneLv10(cardState), prngState: rng.getState() };
}

/** Real match authority for Node. Rendering is an optional consumer of emitted
 * events, not a dependency or a lock that this runner has to release. */
export class ProductionMatch {
    private position: ProductionPosition;
    constructor(initial: ProductionPosition, private readonly record?: (transition: ProductionTransition) => void) {
        if (!initial.prngState) throw new Error('Match requires its complete PRNG state');
        this.position = cloneLv10(initial);
    }
    snapshot(): ProductionPosition { return cloneLv10(this.position); }
    get owner(): Lv10Player { return currentLv10Player(this.position); }
    get controller(): Lv10Player { return lv10DecisionPlayer(this.position); }
    get terminal(): boolean { return Core.isGameOver(this.position.gameState); }
    result() {
        if (!this.terminal) throw new Error('Match has not reached the canonical terminal condition');
        const counts = Core.countDiscs(this.position.gameState, this.position.cardState);
        return { ...counts, winner: counts.black === counts.white ? 'draw' : counts.black > counts.white ? 'black' : 'white',
            endedBy: 'consecutive_passes', turnNumber: this.position.gameState.turnNumber };
    }
    startTurn(): ProductionTransition {
        if (this.terminal) throw new Error('Cannot start a terminal match');
        const before = this.snapshot(), next = this.snapshot(), player = this.owner;
        const rng = Prng.fromState(next.prngState), events: any[] = [];
        next.cardState._defaultRandomSource = rng;
        const result = applyTurnStartAndCheckpoint(Cards, Core, next.cardState, next.gameState, player, events, rng, BoardOps);
        next.prngState = rng.getState();
        this.install(next);
        const transition: ProductionTransition = { kind: 'turn_start', player, before, after: this.snapshot(), ok: true,
            reason: null, events: cloneLv10(events), stopAction: result?.stopAction === true };
        this.record?.(transition);
        return transition;
    }
    apply(action: Lv10Action, options: any = { skipTurnStart: true }, player = this.owner): ProductionTransition {
        if (this.terminal) throw new Error('Cannot act after the canonical terminal condition');
        const before = this.snapshot(), input = this.snapshot(), rng = Prng.fromState(input.prngState);
        input.cardState._defaultRandomSource = rng;
        const result = Pipeline.applyTurnSafe(input.cardState, input.gameState, player, cloneLv10(action), rng, options);
        // A rejected command is not installed by the browser adapter. Its RNG
        // calls still happened and must be preserved, recorded and replayed.
        this.install({ gameState: result.ok ? result.gameState : before.gameState,
            cardState: result.ok ? result.cardState : before.cardState, prngState: rng.getState() });
        const transition: ProductionTransition = { kind: 'action', player, action: cloneLv10(action), before, after: this.snapshot(),
            ok: result.ok === true, reason: result.ok ? null : `${result.rejectedReason}: ${result.errorMessage || ''}`,
            events: cloneLv10(result.events || []) };
        this.record?.(transition);
        if (result.rejectedReason === 'RUNTIME_UNAVAILABLE') throw new Error(transition.reason!);
        return transition;
    }
    private install(state: ProductionPosition): void {
        delete state.cardState._defaultRandomSource;
        delete state.cardState._boardOpsRandomSource;
        delete state.cardState._currentActionMeta;
        Presentation.clearPresentationQueues(state.cardState);
        state.cardState.chargeDeltaEvents = [];
        this.position = state;
    }
}

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
        isCurrent: () => !match.terminal && match.owner === owner && match.controller === player && match.snapshot().gameState.turnNumber === turn,
        apply: async action => match.apply(action)
    });
}
