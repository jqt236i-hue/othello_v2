export function processCpuTurn(): Promise<void>;
export function processAutoBlackTurn(): Promise<void>;
export function setTimers(t: any): void;
export function getTimers(): any;
export function setCpuTurnTimerService(service: any): void;
export function scheduleRetry(fn: any, delayMs?: any): void;
export function getPendingTypeHandlers(playerKey: any): {
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
export function runCpuTurn(playerKey: any, { autoMode }?: {
    autoMode?: boolean | undefined;
}): Promise<void>;
export function resetCpuTurnHandlerState(): void;
declare namespace presentationRuntime {
    export { buildEnemyCardUsedEventFromPlayback };
    export { requestEnemyCardCommentary };
    export { requestEnemyCardCommentaryFromPlayback };
    export { flushPendingPresentationEvents };
    export { createBoardUpdateDrainController };
    export { scheduleCpuTurn };
}
declare function buildEnemyCardUsedEventFromPlayback(playbackEvents: any): {
    player: any;
    cardId: any;
    meta: {
        owner: any;
        cost: any;
        name: any;
    };
} | null;
declare function requestEnemyCardCommentary(ev: any, options: any): Promise<any>;
declare function requestEnemyCardCommentaryFromPlayback(playbackEvents: any, options: any): Promise<any>;
declare function flushPendingPresentationEvents(cardStateRef: any, options: any): any[];
declare function createBoardUpdateDrainController(): {
    requestDrain(runDrain: any): Promise<void>;
};
declare function scheduleCpuTurn(ev: any, options: any): any;
export { presentationRuntime as PresentationRuntime };
//# sourceMappingURL=cpu-turn-handler.d.ts.map