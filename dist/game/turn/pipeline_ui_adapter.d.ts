declare function clearDeferredGeneratedThrowChainPlayback(playerKey: any): void;
/**
 * Converts presentation events (BoardOps output) into PlaybackEvents.
 * This expects events to be JSON-safe presentationEvents as emitted by BoardOps.
 */
declare function mapToPlaybackEvents(presEvents: any, finalCardState: any, finalGameState: any): any[];
declare function normalizePlaybackEvents(playbackEvents: any): any[];
declare function appendSoundEffectPlaybackEvents(playbackEvents: any, rawEvents: any, presentationEvents: any): any[];
declare function mapEffectLogsFromPipeline(rawEvents: any, presEvents: any, playerKey: any): any[];
declare function mapNormalLogsFromPipeline(rawEvents: any, playerKey: any): string[];
/**
 * Minimal adapter to run a placement via TurnPipeline and return both state and PlaybackEvents.
 */
declare function runTurnWithAdapter(cardState: any, gameState: any, playerKey: any, action: any, turnPipeline: any): {
    ok: boolean;
    rejectedReason: any;
    events: any;
    nextCardState?: undefined;
    nextGameState?: undefined;
    playbackEvents?: undefined;
    playbackDiagnostics?: undefined;
    deferredGeneratedThrowChainHandAdd?: undefined;
    rawEvents?: undefined;
    presentationEvents?: undefined;
    effectLogMessages?: undefined;
} | {
    ok: boolean;
    nextCardState: any;
    nextGameState: any;
    playbackEvents: any;
    playbackDiagnostics: any;
    deferredGeneratedThrowChainHandAdd: {
        playerKey: any;
        count: any;
        reason: string;
    } | null;
    rawEvents: any;
    presentationEvents: any;
    effectLogMessages: any[];
    rejectedReason?: undefined;
    events?: undefined;
};
declare const _default: {
    mapToPlaybackEvents: typeof mapToPlaybackEvents;
    normalizePlaybackEvents: typeof normalizePlaybackEvents;
    appendSoundEffectPlaybackEvents: typeof appendSoundEffectPlaybackEvents;
    mapEffectLogsFromPipeline: typeof mapEffectLogsFromPipeline;
    mapNormalLogsFromPipeline: typeof mapNormalLogsFromPipeline;
    clearDeferredGeneratedThrowChainPlayback: typeof clearDeferredGeneratedThrowChainPlayback;
    runTurnWithAdapter: typeof runTurnWithAdapter;
};
export = _default;
//# sourceMappingURL=pipeline_ui_adapter.d.ts.map