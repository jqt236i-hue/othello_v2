import Core = require('../logic/core');
import Pipeline = require('../turn/turn_pipeline');
import { applyTurnStartAndCheckpoint } from '../turn/turn-start-runtime';
import BoardOps = require('../logic/board_ops');
import Presentation = require('../../shared/presentation-queue');
import {
    cloneBattle, currentBattlePlayer, battleDecisionPlayer,
    type CompleteBattlePosition, type BattleAction, type BattlePlayer,
    type BattleTransition, type BattleResult
} from '../../shared/battle/types';

const Prng: any = require('../schema/prng');
const Cards: any = require('../logic/cards');

/** Canonical headless transitions shared by product sessions and production selfplay.
 * startTurn remains explicit for compatibility with existing replay journals. */
export class BattleMatch {
    private position: CompleteBattlePosition;
    private disposed = false;
    constructor(initial: CompleteBattlePosition, private readonly record?: (transition: BattleTransition) => void) {
        if (!initial.prngState) throw new Error('Match requires its complete PRNG state');
        this.position = cloneBattle(initial);
    }
    snapshot(): CompleteBattlePosition { return cloneBattle(this.position); }
    get owner(): BattlePlayer { return currentBattlePlayer(this.position); }
    get controller(): BattlePlayer { return battleDecisionPlayer(this.position); }
    get terminal(): boolean { return Core.isGameOver(this.position.gameState); }
    get isDisposed(): boolean { return this.disposed; }
    dispose(): void { this.disposed = true; }
    result(): BattleResult {
        if (!this.terminal) throw new Error('Match has not reached the canonical terminal condition');
        const counts = Core.countDiscs(this.position.gameState, this.position.cardState);
        return { ...counts, winner: counts.black === counts.white ? 'draw' : counts.black > counts.white ? 'black' : 'white',
            endedBy: 'consecutive_passes', turnNumber: this.position.gameState.turnNumber };
    }
    private assertActive(): void {
        if (this.disposed) throw new Error('Battle has been disposed');
    }
    startTurn(): BattleTransition {
        this.assertActive();
        if (this.terminal) throw new Error('Cannot start a terminal match');
        const before = this.snapshot(), next = this.snapshot(), player = this.owner;
        const rng = Prng.fromState(next.prngState), events: any[] = [];
        next.cardState._defaultRandomSource = rng;
        const result = applyTurnStartAndCheckpoint(Cards, Core, next.cardState, next.gameState, player, events, rng, BoardOps);
        next.prngState = rng.getState();
        this.install(next);
        const transition: BattleTransition = { kind: 'turn_start', player, before, after: this.snapshot(), ok: true,
            reason: null, events: cloneBattle(events), stopAction: result?.stopAction === true };
        this.record?.(transition);
        return transition;
    }
    apply(action: BattleAction, options: any = { skipTurnStart: true }, player = this.owner): BattleTransition {
        this.assertActive();
        if (this.terminal) throw new Error('Cannot act after the canonical terminal condition');
        const before = this.snapshot(), input = this.snapshot(), rng = Prng.fromState(input.prngState);
        input.cardState._defaultRandomSource = rng;
        const result = Pipeline.applyTurnSafe(input.cardState, input.gameState, player, cloneBattle(action), rng, options);
        // Rejected commands preserve their consumed RNG, just as the existing replay runtime does.
        this.install({ gameState: result.ok ? result.gameState : before.gameState,
            cardState: result.ok ? result.cardState : before.cardState, prngState: rng.getState() });
        const transition: BattleTransition = { kind: 'action', player, action: cloneBattle(action), before, after: this.snapshot(),
            ok: result.ok === true, reason: result.ok ? null : `${result.rejectedReason}: ${result.errorMessage || ''}`,
            events: cloneBattle(result.events || []) };
        this.record?.(transition);
        if (result.rejectedReason === 'RUNTIME_UNAVAILABLE') throw new Error(transition.reason!);
        return transition;
    }
    private install(state: CompleteBattlePosition): void {
        delete state.cardState._defaultRandomSource;
        delete state.cardState._boardOpsRandomSource;
        delete state.cardState._currentActionMeta;
        Presentation.clearPresentationQueues(state.cardState);
        state.cardState.chargeDeltaEvents = [];
        this.position = state;
    }
}
