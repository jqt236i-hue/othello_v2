import { BattleMatch } from './match';
import { prepareBattle } from './initial';
import { cloneBattle, type BattleAction, type BattleTransition } from '../../shared/battle/types';
import { type BattleConfig, type ResolvedBattleConfig } from '../../shared/battle/config';
import { createBattleSave, validateBattleSave, type BattleSave, type BattlePhase } from '../../shared/battle/save';

/** One headless session. A host owns scheduling, CPU policy and presentation. */
export class BattleSession {
    private readonly resolvedConfig: ResolvedBattleConfig;
    private readonly match: BattleMatch;
    private phase: BattlePhase;
    private cpuMemory: Record<string, any> = {};
    constructor(config: BattleConfig, saved?: BattleSave) {
        const prepared = saved ? validateBattleSave(saved) : prepareBattle(config);
        this.resolvedConfig = cloneBattle(prepared.config);
        this.match = new BattleMatch(prepared.position);
        this.phase = saved ? (prepared as BattleSave).phase : 'needs-turn-start';
        if (saved) this.cpuMemory = cloneBattle(saved.cpuMemory);
    }
    get isDisposed(): boolean { return this.match.isDisposed; }
    get config(): ResolvedBattleConfig { return cloneBattle(this.resolvedConfig); }
    get currentPhase(): BattlePhase { return this.phase; }
    get owner() { return this.match.owner; }
    get controller() { return this.match.controller; }
    snapshot() { return this.match.snapshot(); }
    result() { return this.match.terminal ? this.match.result() : null; }
    startTurn(): BattleTransition | null {
        if (this.isDisposed) throw new Error('Battle has been disposed');
        if (this.phase !== 'needs-turn-start') return null;
        const before = this.snapshot();
        const transition = this.match.startTurn();
        this.phase = this.match.terminal ? 'terminal' : transition.stopAction
            && (before.gameState.turnNumber !== transition.after.gameState.turnNumber || before.gameState.currentPlayer !== transition.after.gameState.currentPlayer)
            ? 'needs-turn-start' : 'action';
        return transition;
    }
    apply(action: BattleAction): BattleTransition {
        if (this.isDisposed) throw new Error('Battle has been disposed');
        if (this.phase !== 'action') throw new Error('Battle is not accepting an action');
        const before = this.snapshot();
        const transition = this.match.apply(action);
        if (transition.ok) {
            this.phase = this.match.terminal ? 'terminal'
                : before.gameState.turnNumber !== transition.after.gameState.turnNumber || before.gameState.currentPlayer !== transition.after.gameState.currentPlayer
                    ? 'needs-turn-start' : 'action';
        }
        return transition;
    }
    setCpuMemory(memory: Record<string, any>): void {
        if (this.isDisposed) throw new Error('Battle has been disposed');
        const validated = createBattleSave(this.config, this.snapshot(), this.phase, memory);
        this.cpuMemory = validated.cpuMemory;
    }
    exportSave(): BattleSave {
        if (this.isDisposed) throw new Error('Battle has been disposed');
        return createBattleSave(this.config, this.snapshot(), this.phase, this.cpuMemory);
    }
    dispose(): void { this.match.dispose(); }
}
export function createBattle(config: BattleConfig): BattleSession { return new BattleSession(config); }
export function restoreBattle(saved: BattleSave): BattleSession {
    const validated = validateBattleSave(saved);
    return new BattleSession(validated.config, validated);
}
