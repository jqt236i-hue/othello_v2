declare function captureNetworkPublishSnapshot(gameStateValue: any, cardStateValue: any): {
    gameState: any;
    cardState: any;
} | null;
declare function publishNetworkSnapshot(meta: any): any;
declare function resolvePlayerKeyFromTurnValue(value: any): "black" | "white";
declare function waitForPlaybackIdleIfNeeded(playbackEvents: any): Promise<void>;
declare function finalizeNetworkTurnHandoff(options: any): Promise<{
    ok: boolean;
    reason: string;
    result: any;
    gameOver: boolean;
    scheduledCpu: boolean;
    nextPlayerKey: any;
    playbackEvents: any;
    turnStartPlaybackEvents: any;
} | {
    ok: boolean;
    gameOver: boolean;
    scheduledCpu: boolean;
    nextPlayerKey: any;
    playbackEvents: any;
    turnStartPlaybackEvents: any;
    reason?: undefined;
    result?: undefined;
}>;
declare const _default: {
    captureNetworkPublishSnapshot: typeof captureNetworkPublishSnapshot;
    publishNetworkSnapshot: typeof publishNetworkSnapshot;
    waitForPlaybackIdleIfNeeded: typeof waitForPlaybackIdleIfNeeded;
    finalizeNetworkTurnHandoff: typeof finalizeNetworkTurnHandoff;
    resolvePlayerKeyFromTurnValue: typeof resolvePlayerKeyFromTurnValue;
};
export = _default;
//# sourceMappingURL=network-turn-handoff.d.ts.map