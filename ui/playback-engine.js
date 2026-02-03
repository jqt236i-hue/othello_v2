/*
 * PlaybackEngine
 * Consumes `presentationEvents` emitted from game layer and executes UI-side playback.
 */

(function (root, factory) {
    if (typeof module === 'object' && module.exports) {
        module.exports = factory();
    } else {
        // Do not clobber if already installed (e.g., via bundler)
        if (!root.PlaybackEngine) root.PlaybackEngine = factory();
    }
}(typeof self !== 'undefined' ? self : this, function () {
    let __uiImpl_playback = {};
    function setUIImpl(obj) { __uiImpl_playback = obj || {}; }

    async function playPresentationEvents(cardState = {}, deps = {}) {
        const AnimationEngine = deps.AnimationEngine || (typeof globalThis !== 'undefined' && globalThis.AnimationEngine) || null;
        const scheduleCpuTurnFn = deps.scheduleCpuTurn || __uiImpl_playback.scheduleCpuTurn;
        const onScheduleCallback = deps.onSchedule || ((cb) => cb && cb());

        const events = (cardState.presentationEvents || []).slice();
        // Clear buffer to emulate consumption
        if (cardState.presentationEvents) cardState.presentationEvents.length = 0;

        for (const ev of events) {
            if (ev.type === 'PLAYBACK_EVENTS') {
                const payload = ev.events || [];
                if (AnimationEngine && typeof AnimationEngine.play === 'function') {
                    await AnimationEngine.play(payload);
                } else if (typeof __uiImpl_playback.runMoveVisualSequence === 'function') {
                    // backward-compat path: runMoveVisualSequence may accept payload
                    await __uiImpl_playback.runMoveVisualSequence(payload);
                } else {
                    try { if (typeof isDebugLogAvailable === 'function' && isDebugLogAvailable()) console.warn('[PlaybackEngine] No AnimationEngine or runMoveVisualSequence available to play payload'); } catch (e) { }
                }
            } else if (ev.type === 'SCHEDULE_CPU_TURN') {
                const delay = Number.isFinite(ev.delayMs) ? ev.delayMs : 0;
                if (typeof scheduleCpuTurnFn === 'function') {
                    scheduleCpuTurnFn(delay, () => onScheduleCallback(ev));
                } else {
                    // UI implementation fallback: use setTimeout in UI context
                    setTimeout(() => { try { onScheduleCallback(ev); } catch (e) { console.error(e); } }, delay);
                }
            } else {
                if (__uiImpl_playback.onUnhandledPresentationEvent) __uiImpl_playback.onUnhandledPresentationEvent(ev);
            }
        }
    }

    return { playPresentationEvents, setUIImpl };
}));
