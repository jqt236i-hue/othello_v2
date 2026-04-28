declare function applyTurnStartPhase(CardLogic: any, Core: any, cardState: any, gameState: any, playerKey: any, events: any, prng: any): void;
declare function applyCardUsagePhase(CardLogic: any, cardState: any, gameState: any, playerKey: any, action: any, events: any, prng: any): void;
declare function applyActionPhase(CardLogic: any, Core: any, cardState: any, gameState: any, playerKey: any, action: any, events: any, prng: any, BoardOps: any): void;
declare const _default: {
    applyTurnStartPhase: typeof applyTurnStartPhase;
    applyCardUsagePhase: typeof applyCardUsagePhase;
    applyActionPhase: typeof applyActionPhase;
};
export = _default;
//# sourceMappingURL=turn_pipeline_phases.d.ts.map