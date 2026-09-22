/** Runtime-neutral battle contracts. No presentation or CPU-policy ownership. */
export type BattlePlayer = 'black' | 'white';
export type BattleAction = { type: string; [key: string]: any };
export type BattlePosition = { gameState: any; cardState: any; prngState?: any };
export type CompleteBattlePosition = BattlePosition & { prngState: { seed: number; calls: number } };
export type BattleTransition = {
    kind: 'turn_start' | 'action'; player: BattlePlayer; action?: BattleAction;
    before: CompleteBattlePosition; after: CompleteBattlePosition;
    ok: boolean; reason: string | null; events: any[]; stopAction?: boolean;
};
export type BattleResult = {
    black: number; white: number; winner: BattlePlayer | 'draw';
    endedBy: 'consecutive_passes'; turnNumber: number;
};
export function cloneBattle<T>(value: T): T { return JSON.parse(JSON.stringify(value)); }
export function currentBattlePlayer(state: BattlePosition): BattlePlayer {
    return state.gameState.currentPlayer === 1 || state.gameState.currentPlayer === 'black' ? 'black' : 'white';
}
export function battleDecisionPlayer(state: BattlePosition): BattlePlayer {
    const owner = currentBattlePlayer(state);
    return state.cardState.fateWillControllerByTurnOwner?.[owner] || owner;
}
