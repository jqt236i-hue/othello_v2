/**
 * Converts presentation events (BoardOps output) into PlaybackEvents.
 * This expects events to be JSON-safe presentationEvents as emitted by BoardOps.
 */
export function mapToPlaybackEvents(presEvents: any, finalCardState: any, finalGameState: any): any[];
export function normalizePlaybackEvents(playbackEvents: any): any[];
export function appendSoundEffectPlaybackEvents(playbackEvents: any, rawEvents: any, presentationEvents: any): any[];
export function mapEffectLogsFromPipeline(rawEvents: any, presEvents: any, playerKey: any): any[];
export function mapNormalLogsFromPipeline(rawEvents: any, playerKey: any): string[];
export function clearDeferredGeneratedThrowChainPlayback(playerKey: any): void;
/**
 * Minimal adapter to run a placement via TurnPipeline and return both state and PlaybackEvents.
 */
export function runTurnWithAdapter(cardState: any, gameState: any, playerKey: any, action: any, turnPipeline: any): {
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
//# sourceMappingURL=pipeline_ui_adapter.d.ts.map