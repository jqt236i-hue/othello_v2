import type { CardState } from '../src/types';
interface AnimationEngine {
    play: (payload: PresentationEvent[]) => Promise<void>;
}
interface PresentationEvent {
    type: string;
    events?: PresentationEvent[];
    delayMs?: number;
    [key: string]: unknown;
}
interface UIImplPlayback {
    runMoveVisualSequence?: (payload: PresentationEvent[]) => Promise<void>;
    scheduleCpuTurn?: (delay: number, callback: () => void) => unknown;
    onUnhandledPresentationEvent?: (ev: PresentationEvent) => void;
}
interface PlaybackDeps {
    AnimationEngine?: AnimationEngine;
    scheduleCpuTurnEvent?: (ev: PresentationEvent) => unknown;
    scheduleCpuTurn?: (delay: number, callback: () => void) => unknown;
    onSchedule?: (callback: (() => void) | null) => void;
    onUnhandledPresentationEvent?: (ev: PresentationEvent) => void;
}
declare function setUIImpl(obj: UIImplPlayback): void;
declare function consumePresentationEventBuffer(cardState: CardState | null | undefined): PresentationEvent[];
declare function playPlaybackBatch(events: PresentationEvent[], deps: PlaybackDeps | null | undefined): Promise<void>;
declare function schedulePresentationCpuTurn(ev: PresentationEvent, deps: PlaybackDeps | null | undefined): unknown;
declare function dispatchPresentationEvent(ev: PresentationEvent | null | undefined, deps?: PlaybackDeps): Promise<unknown>;
declare function playPresentationEvents(cardState?: CardState | null, deps?: PlaybackDeps): Promise<void>;
declare const _default: {
    consumePresentationEventBuffer: typeof consumePresentationEventBuffer;
    playPlaybackBatch: typeof playPlaybackBatch;
    schedulePresentationCpuTurn: typeof schedulePresentationCpuTurn;
    dispatchPresentationEvent: typeof dispatchPresentationEvent;
    playPresentationEvents: typeof playPresentationEvents;
    setUIImpl: typeof setUIImpl;
};
export = _default;
//# sourceMappingURL=playback-engine.d.ts.map