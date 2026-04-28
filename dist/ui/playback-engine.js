"use strict";
/*
 * PlaybackEngine
 * Consumes `presentationEvents` emitted from game layer and executes UI-side playback.
 */
const _require = (typeof __non_webpack_require__ !== 'undefined')
    ? __non_webpack_require__
    : require;
let __uiImpl_playback = {};
function setUIImpl(obj) {
    __uiImpl_playback = obj || {};
}
function resolveAnimationEngine(deps) {
    const config = (deps && typeof deps === 'object') ? deps : {};
    if (config.AnimationEngine) {
        return config.AnimationEngine;
    }
    try {
        if (typeof globalThis !== 'undefined' && globalThis.AnimationEngine) {
            return globalThis.AnimationEngine ?? null;
        }
    }
    catch (e) { /* ignore */ }
    try {
        const root = (typeof globalThis !== 'undefined' ? globalThis : {});
        if (root && root.AnimationEngine) {
            return root.AnimationEngine;
        }
    }
    catch (e) { /* ignore */ }
    return null;
}
function consumePresentationEventBuffer(cardState) {
    const state = (cardState && typeof cardState === 'object') ? cardState : {};
    const events = Array.isArray(state.presentationEvents) ? state.presentationEvents.slice() : [];
    if (Array.isArray(state.presentationEvents))
        state.presentationEvents.length = 0;
    return events;
}
async function playPlaybackBatch(events, deps) {
    const payload = Array.isArray(events) ? events : [];
    if (!payload.length)
        return;
    const AnimationEngine = resolveAnimationEngine(deps);
    if (AnimationEngine && typeof AnimationEngine.play === 'function') {
        await AnimationEngine.play(payload);
        return;
    }
    if (typeof __uiImpl_playback.runMoveVisualSequence === 'function') {
        await __uiImpl_playback.runMoveVisualSequence(payload);
        return;
    }
    try {
        const isDebugLogAvailable = (typeof globalThis.isDebugLogAvailable === 'function')
            ? globalThis.isDebugLogAvailable
            : () => false;
        if (isDebugLogAvailable()) {
            console.warn('[PlaybackEngine] No AnimationEngine or runMoveVisualSequence available to play payload');
        }
    }
    catch (e) { /* ignore */ }
}
function schedulePresentationCpuTurn(ev, deps) {
    const config = (deps && typeof deps === 'object') ? deps : {};
    const scheduleCpuTurnEvent = config.scheduleCpuTurnEvent;
    if (typeof scheduleCpuTurnEvent === 'function') {
        return scheduleCpuTurnEvent(ev);
    }
    const scheduleCpuTurnFn = config.scheduleCpuTurn || __uiImpl_playback.scheduleCpuTurn;
    const onScheduleCallback = config.onSchedule || ((cb) => cb && cb());
    const delay = Number.isFinite(ev && ev.delayMs) ? ev.delayMs : 0;
    if (typeof scheduleCpuTurnFn === 'function') {
        return scheduleCpuTurnFn(delay || 0, () => onScheduleCallback(() => { }));
    }
    return setTimeout(() => {
        try {
            onScheduleCallback(() => { });
        }
        catch (e) {
            console.error(e);
        }
    }, delay || 0);
}
async function dispatchPresentationEvent(ev, deps = {}) {
    if (!ev || !ev.type)
        return undefined;
    if (ev.type === 'PLAYBACK_EVENTS') {
        return playPlaybackBatch(ev.events || [], deps);
    }
    if (ev.type === 'SCHEDULE_CPU_TURN') {
        return schedulePresentationCpuTurn(ev, deps);
    }
    if (typeof deps.onUnhandledPresentationEvent === 'function') {
        return deps.onUnhandledPresentationEvent(ev);
    }
    if (typeof __uiImpl_playback.onUnhandledPresentationEvent === 'function') {
        return __uiImpl_playback.onUnhandledPresentationEvent(ev);
    }
    return undefined;
}
async function playPresentationEvents(cardState = null, deps = {}) {
    const events = consumePresentationEventBuffer(cardState);
    for (const ev of events) {
        await dispatchPresentationEvent(ev, deps);
    }
}
module.exports = {
    consumePresentationEventBuffer,
    playPlaybackBatch,
    schedulePresentationCpuTurn,
    dispatchPresentationEvent,
    playPresentationEvents,
    setUIImpl
};
//# sourceMappingURL=playback-engine.js.map