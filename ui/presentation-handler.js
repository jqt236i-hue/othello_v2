// Presentation event handler: subscribes to board updates and dispatches UI playback.
(function () {
    'use strict';

    function resolveCpuTurnFn() {
        try {
            if (typeof require === 'function') {
                const bootstrap = require('./bootstrap');
                if (bootstrap && typeof bootstrap.getRegisteredUIGlobals === 'function') {
                    const uiGlobals = bootstrap.getRegisteredUIGlobals() || {};
                    if (typeof uiGlobals.processCpuTurn === 'function') return uiGlobals.processCpuTurn;
                }
            }
        } catch (e) { /* ignore */ }

        try {
            if (typeof UIBootstrap !== 'undefined' && UIBootstrap && typeof UIBootstrap.getRegisteredUIGlobals === 'function') {
                const uiGlobals2 = UIBootstrap.getRegisteredUIGlobals() || {};
                if (typeof uiGlobals2.processCpuTurn === 'function') return uiGlobals2.processCpuTurn;
            }
        } catch (e) { /* ignore */ }

        try {
            if (typeof globalThis !== 'undefined' && typeof globalThis.processCpuTurn === 'function') return globalThis.processCpuTurn;
        } catch (e) { /* ignore */ }

        try {
            if (typeof window !== 'undefined' && typeof window.processCpuTurn === 'function') return window.processCpuTurn;
        } catch (e) { /* ignore */ }

        return null;
    }

    async function playPlaybackEvents(ev) {
        const payload = Array.isArray(ev && ev.events) ? ev.events : [];
        if (!payload.length) return;

        try {
            if (typeof AnimationEngine !== 'undefined' && AnimationEngine && typeof AnimationEngine.play === 'function') {
                await AnimationEngine.play(payload);
                return;
            }
        } catch (e) { /* ignore */ }

        try {
            if (typeof PlaybackEngine !== 'undefined' && PlaybackEngine && typeof PlaybackEngine.playPresentationEvents === 'function') {
                await PlaybackEngine.playPresentationEvents({
                    presentationEvents: [{ type: 'PLAYBACK_EVENTS', events: payload }]
                });
            }
        } catch (e) {
            try { console.warn('[PresentationHandler] playback failed', e); } catch (e2) { /* ignore */ }
        }
    }

    function applyCrossfadeStone(ev) {
        const row = ev && ev.row;
        const col = ev && ev.col;
        if (!Number.isFinite(row) || !Number.isFinite(col)) return;

        const tryApply = function (retries) {
            try {
                const cell = document.querySelector('.cell[data-row="' + row + '"][data-col="' + col + '"]');
                const disc = cell ? cell.querySelector('.disc') : null;
                if (!disc) {
                    if (retries > 0) setTimeout(function () { tryApply(retries - 1); }, 80);
                    return;
                }

                try {
                    if (typeof syncDiscVisualToCurrentState === 'function') syncDiscVisualToCurrentState(row, col);
                } catch (e) { /* ignore */ }

                if (typeof crossfadeStoneVisual === 'function') {
                    crossfadeStoneVisual(disc, {
                        effectKey: ev.effectKey,
                        owner: ev.owner,
                        newColor: ev.newColor,
                        durationMs: ev.durationMs,
                        autoFadeOut: ev.autoFadeOut,
                        fadeWholeStone: ev.fadeWholeStone
                    }).catch(function () {});
                } else if (typeof applyStoneVisualEffect === 'function') {
                    applyStoneVisualEffect(disc, ev.effectKey, { owner: ev.owner });
                }
            } catch (e) {
                if (retries > 0) setTimeout(function () { tryApply(retries - 1); }, 80);
            }
        };
        tryApply(5);
    }

    function handlePresentationEvent(ev) {
        try {
            if (!ev || !ev.type) return;

            if (ev.type === 'PLAYBACK_EVENTS') {
                return playPlaybackEvents(ev);
            }

            if (ev.type === 'CARD_USED') {
                const owner = (ev.meta && ev.meta.owner) ? ev.meta.owner : (ev.player || null);
                const playback = [{
                    type: 'card_use_animation',
                    phase: 1,
                    targets: [{
                        player: ev.player || null,
                        owner: owner,
                        cardId: ev.cardId || null,
                        cost: (ev.meta && Number.isFinite(ev.meta.cost)) ? ev.meta.cost : null,
                        name: (ev.meta && ev.meta.name) ? ev.meta.name : null
                    }]
                }];
                return playPlaybackEvents({ events: playback });
            }

            if (ev.type === 'SCHEDULE_CPU_TURN') {
                const delay = Number.isFinite(ev.delayMs) ? ev.delayMs : 0;
                setTimeout(function () {
                    const cpuFn = resolveCpuTurnFn();
                    if (cpuFn) cpuFn();
                    else console.warn('[PresentationHandler] processCpuTurn not available for fallback SCHEDULE_CPU_TURN');
                }, delay);
                return;
            }

            if (ev.type === 'CROSSFADE_STONE') {
                applyCrossfadeStone(ev);
                return;
            }

            if (ev.type === 'PROTECTION_EXPIRE') {
                if (typeof animateProtectionExpireAt === 'function') {
                    try { animateProtectionExpireAt(ev.row, ev.col); } catch (e) { /* ignore */ }
                }
            }
        } catch (e) {
            console.error('[PresentationHandler] handlePresentationEvent error', e);
        }
    }

    async function onBoardUpdated() {
        try {
            let events = [];
            if (typeof CardLogic !== 'undefined' && typeof CardLogic.flushPresentationEvents === 'function') {
                try {
                    events = CardLogic.flushPresentationEvents(cardState) || [];
                } catch (e) {
                    events = [];
                }
            }

            if (events && events.length > 0 && cardState && Array.isArray(cardState._presentationEventsPersist)) {
                // Prevent duplicate playback when BoardOps already persisted the same events.
                cardState._presentationEventsPersist.length = 0;
            }

            if ((!events || events.length === 0) && cardState && Array.isArray(cardState._presentationEventsPersist) && cardState._presentationEventsPersist.length) {
                events = cardState._presentationEventsPersist.slice();
                cardState._presentationEventsPersist.length = 0;
            }

            for (const ev of events) {
                await handlePresentationEvent(ev);
            }

            // Ensure UI interaction locks (clickable, usable) are recalculated 
            // after all presentation events (including animations) have finished.
            if (typeof renderCardUI === 'function') renderCardUI();
        } catch (e) {
            console.error('[PresentationHandler] onBoardUpdated error', e);
        }
    }

    try {
        if (typeof GameEvents !== 'undefined' && GameEvents && GameEvents.gameEvents && typeof GameEvents.gameEvents.on === 'function') {
            // Event name is emitted as `boardUpdated` in current UI; keep `BOARD_UPDATED` for backward compatibility.
            GameEvents.gameEvents.on('boardUpdated', onBoardUpdated);
            GameEvents.gameEvents.on('BOARD_UPDATED', onBoardUpdated);
        } else {
            try { console.warn('[PresentationHandler] GameEvents not available; presentation events will not auto-play.'); } catch (e) { /* ignore */ }
            setTimeout(function () {
                try {
                    const hasPending = !!(
                        cardState &&
                        ((Array.isArray(cardState.presentationEvents) && cardState.presentationEvents.length > 0) ||
                         (Array.isArray(cardState._presentationEventsPersist) && cardState._presentationEventsPersist.length > 0))
                    );
                    if (hasPending) onBoardUpdated();
                } catch (e) { /* ignore */ }
            }, 60);
        }
    } catch (e) {
        try { console.warn('[PresentationHandler] initialization failed', e); } catch (e2) { /* ignore */ }
    }

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = { onBoardUpdated, handlePresentationEvent };
    }
})();
