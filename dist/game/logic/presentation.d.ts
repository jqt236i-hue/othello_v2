interface PresentationEvent {
    type: string;
    [key: string]: any;
}
interface CardState {
    _presentationEventsPersist?: PresentationEvent[];
    [key: string]: any;
}
declare function emitPresentationEvent(cardState: CardState | null, ev: PresentationEvent): boolean;
declare function flushPersistedEvents(): boolean;
declare const _default: {
    emitPresentationEvent: typeof emitPresentationEvent;
    flushPersistedEvents: typeof flushPersistedEvents;
};
export = _default;
//# sourceMappingURL=presentation.d.ts.map