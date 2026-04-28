import type { PlayerKey } from '../src/types';
declare function setCpuTurnTimerService(service: any): void;
declare function setTimers(t: any): void;
declare function getTimers(): any;
declare function resetCpuTurnHandlerState(): void;
declare function scheduleRetry(fn: any, delayMs?: any): void;
declare function getPendingTypeHandlers(playerKey: PlayerKey): {
    DESTROY_ONE_STONE: () => Promise<void>;
    STRONG_WIND_WILL: () => Promise<void>;
    SUPER_BUOYANCY_WILL: () => Promise<void>;
    SUPER_GRAVITY_WILL: () => Promise<void>;
    HEAVEN_BLESSING: () => Promise<void>;
    CONDEMN_WILL: () => Promise<void>;
    SWAP_WITH_ENEMY: () => Promise<void>;
    POSITION_SWAP_WILL: () => Promise<void>;
    TRAP_WILL: () => Promise<void>;
    GUARD_WILL: () => Promise<void>;
    GUARDIAN_GOD: () => Promise<void>;
    LIVING_WILL: () => Promise<void>;
    HYPERACTIVE_INHERIT_WILL: () => Promise<void>;
    EXTEND_LIFE_WILL: () => Promise<void>;
    EXTEND_LIFE_GOD: () => Promise<void>;
    CORROSION_WILL: () => Promise<void>;
    TELEPORT_WILL: () => Promise<void>;
    CELL_TELEPORT_WILL: () => Promise<void>;
    TEMPT_WILL: () => Promise<void>;
    CAPTURE_WILL: () => Promise<void>;
    TIME_BOMB: () => Promise<void>;
    BOARD_EXPANSION_WILL: () => Promise<void>;
    BOARD_EXPANSION_GOD: () => Promise<void>;
    BOARD_SHRINK_WILL: () => Promise<void>;
    BOARD_SHRINK_GOD: () => Promise<void>;
    BLOCKADE_WILL: () => Promise<void>;
    METEOR_WILL: () => Promise<void>;
    FREEZE_WILL: () => Promise<void>;
    SEED_WILL: () => Promise<void>;
    CLONE_WILL: () => Promise<void>;
    SPLIT_WILL: () => Promise<void>;
};
declare function processCpuTurn(): Promise<void>;
declare function processAutoBlackTurn(): Promise<void>;
declare function runCpuTurn(playerKey: PlayerKey, { autoMode }?: {
    autoMode?: boolean;
}): Promise<void>;
declare const _default: {
    processCpuTurn: typeof processCpuTurn;
    processAutoBlackTurn: typeof processAutoBlackTurn;
    setTimers: typeof setTimers;
    getTimers: typeof getTimers;
    setCpuTurnTimerService: typeof setCpuTurnTimerService;
    scheduleRetry: typeof scheduleRetry;
    getPendingTypeHandlers: typeof getPendingTypeHandlers;
    runCpuTurn: typeof runCpuTurn;
    resetCpuTurnHandlerState: typeof resetCpuTurnHandlerState;
    PresentationRuntime: {
        buildEnemyCardUsedEventFromPlayback: (playbackEvents: any) => {
            player: any;
            cardId: any;
            meta: {
                owner: any;
                cost: any;
                name: any;
            };
        } | null;
        requestEnemyCardCommentary: (ev: any, options: any) => Promise<any>;
        requestEnemyCardCommentaryFromPlayback: (playbackEvents: any, options: any) => Promise<any>;
        flushPendingPresentationEvents: (cardStateRef: any, options: any) => any[];
        createBoardUpdateDrainController: () => {
            requestDrain(runDrain: any): Promise<void>;
        };
        scheduleCpuTurn: (ev: any, options: any) => any;
    };
};
export = _default;
//# sourceMappingURL=cpu-turn-handler.d.ts.map