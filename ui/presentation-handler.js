// Presentation event handler: subscribes to board updates and dispatches presentation events to UI
(function () {

    function scheduleDestroyFadeFallback(events) {
        try {
            const destroys = (events || []).filter(e => e && e.type === 'DESTROY');
            if (!destroys.length) return;
            const fadeMs = (typeof SharedConstants !== 'undefined' && SharedConstants.DESTROY_FADE_MS)
                ? SharedConstants.DESTROY_FADE_MS
                : ((typeof window !== 'undefined' && window.DESTROY_FADE_MS) ? window.DESTROY_FADE_MS : 500);

            setTimeout(() => {
                for (const ev of destroys) {
                    const cell = document.querySelector(`.cell[data-row="${ev.row}"][data-col="${ev.col}"]`);
                    if (!cell) continue;
                    if (cell.querySelector('.disc.destroy-fade')) continue;

                    let disc = cell.querySelector('.disc');
                    if (!disc) {
                        disc = document.createElement('div');
                        const isBlack = ev.ownerBefore === 'black';
                        disc.className = 'disc ' + (isBlack ? 'black' : 'white');
                        disc.style.pointerEvents = 'none';
                        cell.appendChild(disc);
                    }

                    disc.classList.add('destroy-fade');
                    setTimeout(() => {
                        try { cell.innerHTML = ''; } catch (e) { /* ignore */ }
                    }, fadeMs + 50);
                }
            }, 0);
        } catch (e) {
            // best-effort fallback only
        }
    }

    async function handlePresentationEvent(ev) {
        try {
            console.log('[PRESENTATION_DEBUG] handlePresentationEvent invoked', ev && ev.type, ev);
            if (!ev || !ev.type) return;

            // PLAYBACK_EVENTS / SCHEDULE_CPU_TURN are normally handled by PlaybackEngine.
            // Fallback only when AnimationEngine/PlaybackEngine is not available.
            if (ev.type === 'PLAYBACK_EVENTS' || ev.type === 'SCHEDULE_CPU_TURN') {
                const engine =
                    (typeof window !== 'undefined' && window.AnimationEngine && typeof window.AnimationEngine.play === 'function') ? window.AnimationEngine :
                    (typeof globalThis !== 'undefined' && globalThis.AnimationEngine && typeof globalThis.AnimationEngine.play === 'function') ? globalThis.AnimationEngine :
                    null;
                if (engine && ev.type === 'PLAYBACK_EVENTS') {
                    await engine.play(ev.events || []);
                    return;
                }
                if (ev.type === 'SCHEDULE_CPU_TURN') {
                    const delay = Number.isFinite(ev.delayMs) ? ev.delayMs : 0;
                    setTimeout(() => {
                        const tryInvokeCpu = (attemptsLeft = 5, waitMs = 100) => {
                            let cpuFn = null;
                            try {
                                const uiBootstrap = require('../ui/bootstrap');
                                if (uiBootstrap && typeof uiBootstrap.getRegisteredUIGlobals === 'function') {
                                    const g = uiBootstrap.getRegisteredUIGlobals() || {};
                                    if (typeof g.processCpuTurn === 'function') cpuFn = g.processCpuTurn;
                                }
                            } catch (e) { /* ignore */ }
                            if (!cpuFn) cpuFn = (typeof globalThis !== 'undefined' && typeof globalThis.processCpuTurn === 'function') ? globalThis.processCpuTurn : (typeof window !== 'undefined' && typeof window.processCpuTurn === 'function') ? window.processCpuTurn : null;
                            if (!cpuFn) {
                                try {
                                    const cpuHandler = require('../game/cpu-turn-handler');
                                    if (cpuHandler && typeof cpuHandler.processCpuTurn === 'function') cpuFn = cpuHandler.processCpuTurn;
                                } catch (e) { /* ignore */ }
                            }
                            if (cpuFn) {
                                try { cpuFn(); } catch (err) { console.error('[PresentationHandler] processCpuTurn invocation error', err); }
                                return;
                            }
                            if (attemptsLeft > 0) {
                                setTimeout(() => tryInvokeCpu(attemptsLeft - 1, waitMs), waitMs);
                                return;
                            }
                            try { if (typeof isDebugLogAvailable === 'function' && isDebugLogAvailable()) console.warn('[PresentationHandler] processCpuTurn not available for fallback SCHEDULE_CPU_TURN (after retries)', ev); } catch (e) { }
                        };
                        tryInvokeCpu();
                    }, delay);
                    return;
                }
            }
            // Handle cross-fade stone request
            if (ev.type === 'CROSSFADE_STONE') {
                const { row, col, effectKey, owner, newColor, durationMs, autoFadeOut, fadeWholeStone } = ev;
                // Robust application: attempt to apply visual multiple times until the renderer stabilizes.
                (function tryApply(retries) {
                    try {
                        const cell = document.querySelector(`.cell[data-row="${row}"][data-col="${col}"]`);
                        const disc = cell ? cell.querySelector('.disc') : null;
                        if (!disc) {
                            if (retries > 0) setTimeout(() => tryApply(retries - 1), 80);
                            return;
                        }

                        // Ensure disc DOM matches current state to avoid being overwritten by renderer later
                        try { if (typeof syncDiscVisualToCurrentState === 'function') syncDiscVisualToCurrentState(row, col); } catch (e) { }
                        // Prefer the crossfade helper if available (it delegates to applyStoneVisualEffect internally)
                        try { console.log('[PRESENTATION_DEBUG] tryApply invoking visual helper; hasCrossfade:', typeof crossfadeStoneVisual === 'function', 'hasApply:', typeof applyStoneVisualEffect === 'function'); } catch (e) {}
                        if (typeof crossfadeStoneVisual === 'function') {
                            try { crossfadeStoneVisual(disc, { effectKey, owner, newColor, durationMs, autoFadeOut, fadeWholeStone }).catch(() => {}); } catch (e) { console.warn('[PRESENTATION_DEBUG] crossfadeStoneVisual error', e); }
                        } else if (typeof applyStoneVisualEffect === 'function') {
                            try { applyStoneVisualEffect(disc, effectKey, { owner }); } catch (e) { console.warn('[PRESENTATION_DEBUG] applyStoneVisualEffect error', e); }
                        }

                        // Debug: log current classes after trying to apply
                        try { console.log('[PRESENTATION_DEBUG] tryApply classes after attempt:', disc && disc.className); } catch (e) {}

                        // If applied successfully (special-stone class present), stop retrying
                        try {
                            if (disc.classList && disc.classList.contains('special-stone')) return;
                        } catch (e) { }

                        // Otherwise retry a few more times to survive renderer overwrites
                        if (retries > 0) setTimeout(() => tryApply(retries - 1), 80);
                        else {
                            // Final fallback: forcibly apply classes and css var from STONE_VISUAL_EFFECTS to guarantee UI shows something
                            try {
                                const cellF = document.querySelector(`.cell[data-row="${row}"][data-col="${col}"]`);
                                const discF = cellF ? cellF.querySelector('.disc') : null;
                                if (discF) {
                                    const eff = (typeof window !== 'undefined' && window.STONE_VISUAL_EFFECTS) ? window.STONE_VISUAL_EFFECTS[effectKey] : null;
                                    if (eff) {
                                        try { discF.classList.add('special-stone'); } catch (e) {}
                                        try { discF.classList.add(eff.cssClass); } catch (e) {}
                                        if (eff.cssMethod === 'background') {
                                            let imagePath = eff.imagePath;
                                            if (eff.imagePathByOwner && owner !== undefined) {
                                                const ownerKey = (owner === 1) ? '1' : '-1';
                                                imagePath = eff.imagePathByOwner[ownerKey] || imagePath;
                                            }
                                            try { discF.style.setProperty('--special-stone-image', `url('${imagePath}')`); } catch (e) {}
                                            try { discF.style.backgroundImage = `url('${imagePath}')`; } catch (e) {}
                                        } else if (eff.cssMethod === 'pseudoElement' && eff.imagePathByOwner && owner !== undefined) {
                                            try { discF.classList.add(owner === 1 ? 'ud-black' : 'ud-white'); } catch (e) {}
                                            const ownerKey = owner === 1 ? '1' : '-1';
                                            const imagePath2 = eff.imagePathByOwner[ownerKey] || null;
                                            if (imagePath2) {
                                                try { discF.style.setProperty('--special-stone-image', `url('${imagePath2}')`); } catch (e) {}
                                            }
                                        }
                                    }
                                }
                            } catch (e) { }
                        }
                    } catch (e) {
                        if (retries > 0) setTimeout(() => tryApply(retries - 1), 80);
                    }
                })(5);
            }

            if (ev.type === 'PROTECTION_EXPIRE') {
                // UI can animate protection expiry; provide default no-op if not present
                if (typeof animateProtectionExpireAt === 'function') {
                    try { animateProtectionExpireAt(ev.row, ev.col); } catch (e) { }
                }
            }

        } catch (e) {
            console.error('[PresentationHandler] handlePresentationEvent error', e);
        }
    }

    async function onBoardUpdated() {
        try {
            // Collect presentation events
            let events = [];
            const persist = (cardState && Array.isArray(cardState._presentationEventsPersist)) ? cardState._presentationEventsPersist : [];

            // Pull from CardLogic flush first
            if (typeof CardLogic !== 'undefined' && typeof CardLogic.flushPresentationEvents === 'function') {
                try {
                    events = CardLogic.flushPresentationEvents(cardState) || [];
                } catch (e) { events = []; }
            }

            // Fallback: if flush returned nothing, consume persistent copy
            if ((!events || events.length === 0) && persist.length) {
                events = persist.slice();
            }

            console.log('[PRESENTATION_DEBUG] persistLen', persist.length);
            console.log('[PRESENTATION_DEBUG] onBoardUpdated invoked, events count', events.length);

            // Fallback: ensure DESTROY events create a visible fade even if playback misses
            scheduleDestroyFadeFallback(events);

            // If there are no events, ensure playback flags are cleared and force a render.
            if (!events || events.length === 0) {
                try { if (typeof window !== 'undefined') window.VisualPlaybackActive = false; } catch (e) { }
                try {
                    if (typeof renderBoard === 'function') renderBoard();
                } catch (e) { /* ignore */ }
                return;
            }

            // Always clear persisted buffers to avoid replays.
            if (persist.length) persist.length = 0;
            if (cardState && Array.isArray(cardState.presentationEvents)) cardState.presentationEvents.length = 0;

            // Primary path: PlaybackEngine (single consumer)
            const Playback = (typeof window !== 'undefined' && window.PlaybackEngine)
                ? window.PlaybackEngine
                : (typeof require === 'function' ? require('../ui/playback-engine') : null);
            if (Playback && typeof Playback.playPresentationEvents === 'function') {
                // If raw presentation events exist (e.g., DESTROY/CHANGE), map them to PlaybackEvents.
                try {
                    const hasPlaybackEvents = events.some(e => e && e.type === 'PLAYBACK_EVENTS');
                    const hasRawPresentation = events.some(e => e && e.type && e.type !== 'PLAYBACK_EVENTS' && e.type !== 'SCHEDULE_CPU_TURN' && e.type !== 'STATE_UPDATED');
                    if (!hasPlaybackEvents && hasRawPresentation) {
                        const Adapter = (typeof window !== 'undefined' && window.TurnPipelineUIAdapter)
                            ? window.TurnPipelineUIAdapter
                            : (typeof globalThis !== 'undefined' && globalThis.TurnPipelineUIAdapter ? globalThis.TurnPipelineUIAdapter : null);
                        const mapped = (Adapter && typeof Adapter.mapToPlaybackEvents === 'function')
                            ? (Adapter.mapToPlaybackEvents(events, cardState, gameState) || [])
                            : events.filter(e => e && e.type === 'DESTROY').map((e, idx) => ({
                                type: 'destroy',
                                phase: 1 + idx,
                                targets: [{ r: e.row, col: e.col, ownerBefore: e.ownerBefore, after: { color: 0, special: null, timer: null } }]
                            }));
                        const sched = events.filter(e => e && e.type === 'SCHEDULE_CPU_TURN');
                        const engine = (typeof window !== 'undefined' && window.AnimationEngine && typeof window.AnimationEngine.play === 'function')
                            ? window.AnimationEngine
                            : (typeof globalThis !== 'undefined' && globalThis.AnimationEngine && typeof globalThis.AnimationEngine.play === 'function' ? globalThis.AnimationEngine : null);
                        if (engine && mapped.length > 0) {
                            await engine.play(mapped);
                            // Process schedule events after playback
                            for (const ev of sched) {
                                await handlePresentationEvent(ev);
                            }
                            // Clear buffers to avoid replays
                            if (cardState && Array.isArray(cardState.presentationEvents)) cardState.presentationEvents.length = 0;
                            if (cardState && Array.isArray(cardState._presentationEventsPersist)) cardState._presentationEventsPersist.length = 0;
                            return;
                        }
                        events = [{ type: 'PLAYBACK_EVENTS', events: mapped }].concat(sched);
                    }
                } catch (e) { /* ignore mapping failures */ }
                if (cardState) {
                    cardState.presentationEvents = cardState.presentationEvents || [];
                    cardState.presentationEvents.push(...events);
                }
                await Playback.playPresentationEvents(cardState, {
                    AnimationEngine: (typeof window !== 'undefined' ? window.AnimationEngine : null),
                    scheduleCpuTurn: (delay, cb) => setTimeout(cb, delay),
                    onSchedule: (ev) => {
                        const tryInvokeCpu = (attemptsLeft = 5, waitMs = 100) => {
                            let cpuFn = null;
                            try {
                                const uiBootstrap = require('../ui/bootstrap');
                                if (uiBootstrap && typeof uiBootstrap.getRegisteredUIGlobals === 'function') {
                                    const g = uiBootstrap.getRegisteredUIGlobals() || {};
                                    if (typeof g.processCpuTurn === 'function') cpuFn = g.processCpuTurn;
                                }
                            } catch (e) { /* ignore */ }
                            if (!cpuFn) cpuFn = (typeof globalThis !== 'undefined' && typeof globalThis.processCpuTurn === 'function') ? globalThis.processCpuTurn : (typeof window !== 'undefined' && typeof window.processCpuTurn === 'function') ? window.processCpuTurn : null;
                            if (!cpuFn) {
                                try {
                                    const cpuHandler = require('../game/cpu-turn-handler');
                                    if (cpuHandler && typeof cpuHandler.processCpuTurn === 'function') cpuFn = cpuHandler.processCpuTurn;
                                } catch (e) { /* ignore */ }
                            }
                            if (cpuFn) {
                                try { cpuFn(); } catch (err) { console.error('[PresentationHandler] processCpuTurn invocation error', err); }
                                return;
                            }
                            if (attemptsLeft > 0) {
                                setTimeout(() => tryInvokeCpu(attemptsLeft - 1, waitMs), waitMs);
                                return;
                            }
                            try { if (typeof isDebugLogAvailable === 'function' && isDebugLogAvailable()) console.warn('[PresentationHandler] processCpuTurn not available for scheduled CPU turn (after retries)', ev); } catch (e) { }
                        };
                        tryInvokeCpu();
                    }
                });
                // PlaybackEngine consumes presentationEvents internally. Ensure buffers are empty.
                if (cardState && Array.isArray(cardState.presentationEvents)) cardState.presentationEvents.length = 0;
                if (cardState && Array.isArray(cardState._presentationEventsPersist)) cardState._presentationEventsPersist.length = 0;
                // Defensive: force a full render after playback to avoid stale/duplicated discs.
                try {
                    if (typeof window !== 'undefined' && typeof window.forceFullRender === 'function' && window.boardEl) {
                        window.forceFullRender(window.boardEl);
                    }
                } catch (e) { /* ignore */ }
                return;
            }

            // Fallback path: process events locally
            for (const ev of events) {
                await handlePresentationEvent(ev);
            }
        } catch (e) {
            console.error('[PresentationHandler] onBoardUpdated error', e);
        }
    }

    // Subscribe to board updates if event system available
    if (typeof GameEvents !== 'undefined' && GameEvents.gameEvents && GameEvents.EVENT_TYPES) {
        GameEvents.gameEvents.on(GameEvents.EVENT_TYPES.BOARD_UPDATED, onBoardUpdated);
    } else {
        try { console.warn('[PresentationHandler] GameEvents not available; presentation events will not auto-play.'); } catch (e) { }
    }

    // Export for tests
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = { onBoardUpdated, handlePresentationEvent };
    }
})();
