// Presentation event handler: subscribes to board updates and dispatches UI playback.
(function () {
    'use strict';

    let gamePresentationRuntime = null;
    let boardUpdateDrainController = null;
    const missingRuntimeWarnings = Object.create(null);

    function resolveGamePresentationRuntime() {
        if (gamePresentationRuntime) return gamePresentationRuntime;

        try {
            if (typeof require === 'function') {
                const cpuTurnHandler = require('../game/cpu-turn-handler');
                if (cpuTurnHandler && cpuTurnHandler.PresentationRuntime) {
                    gamePresentationRuntime = cpuTurnHandler.PresentationRuntime;
                    return gamePresentationRuntime;
                }
            }
        } catch (e) { /* ignore */ }

        try {
            if (typeof globalThis !== 'undefined' && globalThis.GamePresentationRuntime) {
                gamePresentationRuntime = globalThis.GamePresentationRuntime;
                return gamePresentationRuntime;
            }
        } catch (e) { /* ignore */ }

        return null;
    }

    function getBoardUpdateDrainController() {
        if (boardUpdateDrainController) return boardUpdateDrainController;

        const runtime = resolveGamePresentationRuntime();
        if (runtime && typeof runtime.createBoardUpdateDrainController === 'function') {
            boardUpdateDrainController = runtime.createBoardUpdateDrainController();
            return boardUpdateDrainController;
        }

        let drainInProgress = false;
        let drainPending = false;
        boardUpdateDrainController = {
            async requestDrain(runDrain) {
                drainPending = true;
                if (drainInProgress) return;

                drainInProgress = true;
                try {
                    while (drainPending) {
                        drainPending = false;
                        if (typeof runDrain === 'function') {
                            await runDrain();
                        }
                    }
                } finally {
                    drainInProgress = false;
                }
            }
        };
        return boardUpdateDrainController;
    }

    function warnMissingPresentationRuntime(methodName) {
        const key = String(methodName || '').trim() || 'unknown';
        if (missingRuntimeWarnings[key] === true) return;
        missingRuntimeWarnings[key] = true;
        try {
            console.warn(`[PresentationHandler] GamePresentationRuntime.${key} not available`);
        } catch (e) { /* ignore */ }
    }

    function getPresentationRuntimeMethod(methodName) {
        const runtime = resolveGamePresentationRuntime();
        if (runtime && typeof runtime[methodName] === 'function') {
            return {
                runtime,
                method: runtime[methodName]
            };
        }
        warnMissingPresentationRuntime(methodName);
        return {
            runtime: null,
            method: null
        };
    }

    function appendCpuCommentary(entry) {
        if (!entry || typeof addLog !== 'function') return;
        const text = (entry && entry.text)
            ? String(entry.text)
            : ((entry && entry.prefix && entry.line) ? `${entry.prefix}: ${entry.line}` : '');
        if (!text) return;
        addLog(text);
    }

    function queueEnemyCardCommentary(resultPromise) {
        if (!resultPromise || typeof resultPromise.then !== 'function') return;
        resultPromise.then((entry) => {
            appendCpuCommentary(entry);
        }).catch(() => {
            // Keep presentation flow deterministic.
        });
    }

    function emitCpuReactionToEnemyCard(ev) {
        const runtime = resolveGamePresentationRuntime();
        if (!runtime || typeof runtime.requestEnemyCardCommentary !== 'function') return;
        queueEnemyCardCommentary(runtime.requestEnemyCardCommentary(ev));
    }

    function emitCpuReactionToEnemyCardFromPlayback(playbackEvents) {
        const runtime = resolveGamePresentationRuntime();
        if (!runtime || typeof runtime.requestEnemyCardCommentaryFromPlayback !== 'function') return false;
        queueEnemyCardCommentary(runtime.requestEnemyCardCommentaryFromPlayback(playbackEvents));
        return true;
    }

    function isRawPresentationPlaybackBatch(payload) {
        if (!Array.isArray(payload) || payload.length === 0) return false;
        for (let index = 0; index < payload.length; index += 1) {
            const ev = payload[index];
            const type = String(ev && ev.type || '').trim();
            if (!type || !/^[A-Z_]+$/.test(type)) {
                return false;
            }
        }
        return true;
    }

    function normalizePlaybackEventsForUi(payload) {
        if (!isRawPresentationPlaybackBatch(payload)) return payload;
        try {
            const adapter = (typeof require === 'function')
                ? require('../game/turn/pipeline_ui_adapter')
                : (typeof TurnPipelineUIAdapter !== 'undefined' ? TurnPipelineUIAdapter : null);
            if (!adapter || typeof adapter.mapToPlaybackEvents !== 'function') return payload;
            const mapped = adapter.mapToPlaybackEvents(
                payload,
                (typeof cardState !== 'undefined') ? cardState : null,
                (typeof gameState !== 'undefined') ? gameState : null
            );
            return Array.isArray(mapped) && mapped.length > 0 ? mapped : payload;
        } catch (e) {
            return payload;
        }
    }

    async function playPlaybackEvents(ev, options) {
        const payload = normalizePlaybackEventsForUi(Array.isArray(ev && ev.events) ? ev.events : []);
        if (!payload.length) return;
        const suppressPlayback = !!(ev && ev.meta && ev.meta.suppressPlayback === true);

        const opts = options && typeof options === 'object' ? options : {};
        if (!suppressPlayback && opts.emitEnemyCardReaction !== false) {
            emitCpuReactionToEnemyCardFromPlayback(payload);
        }
        if (suppressPlayback) return;

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
                emitCpuReactionToEnemyCard(ev);
                return playPlaybackEvents({ events: playback }, { emitEnemyCardReaction: false });
            }

            if (ev.type === 'SCHEDULE_CPU_TURN') {
                const runtimeMethod = getPresentationRuntimeMethod('scheduleCpuTurn');
                if (runtimeMethod.method) {
                    return runtimeMethod.method.call(runtimeMethod.runtime, ev);
                }
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

    function flushPendingPresentationEvents() {
        const runtimeMethod = getPresentationRuntimeMethod('flushPendingPresentationEvents');
        if (runtimeMethod.method) {
            return runtimeMethod.method.call(runtimeMethod.runtime);
        }
        return [];
    }

    async function flushBoardPresentationEvents() {
        try {
            const events = flushPendingPresentationEvents();
            for (const ev of events) {
                await handlePresentationEvent(ev);
            }

            if (typeof renderCardUI === 'function') renderCardUI();
        } catch (e) {
            console.error('[PresentationHandler] onBoardUpdated error', e);
        }
    }

    function onBoardUpdated() {
        return getBoardUpdateDrainController().requestDrain(flushBoardPresentationEvents);
    }

    try {
        if (typeof GameEvents !== 'undefined' && GameEvents && GameEvents.gameEvents && typeof GameEvents.gameEvents.on === 'function') {
            // Event name is emitted as `boardUpdated` in current UI; keep `BOARD_UPDATED` for backward compatibility.
            GameEvents.gameEvents.on('boardUpdated', onBoardUpdated);
            GameEvents.gameEvents.on('BOARD_UPDATED', onBoardUpdated);
        } else {
            try { console.warn('[PresentationHandler] GameEvents not available; presentation events will not auto-play.'); } catch (e) { /* ignore */ }
            const runtimeMethod = getPresentationRuntimeMethod('flushPendingPresentationEvents');
            if (runtimeMethod.method) {
                setTimeout(function () {
                    try { onBoardUpdated(); } catch (e) { /* ignore */ }
                }, 60);
            }
        }
    } catch (e) {
        try { console.warn('[PresentationHandler] initialization failed', e); } catch (e2) { /* ignore */ }
    }

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = { onBoardUpdated, handlePresentationEvent };
    }
})();
