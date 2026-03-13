// Presentation event handler: subscribes to board updates and dispatches UI playback.
(function () {
    'use strict';

    let commentaryContextHelpers = null;
    let commentaryRuntimeHelpers = null;
    let boardUpdateDrainInProgress = false;
    let boardUpdateDrainPending = false;

    function resolveCommentaryContextHelpers() {
        if (commentaryContextHelpers) return commentaryContextHelpers;

        try {
            if (typeof require === 'function') {
                commentaryContextHelpers = require('../shared/commentary-context-helpers');
                if (commentaryContextHelpers) return commentaryContextHelpers;
            }
        } catch (e) { /* ignore */ }

        try {
            if (typeof globalThis !== 'undefined' && globalThis.CommentaryContextHelpers) {
                commentaryContextHelpers = globalThis.CommentaryContextHelpers;
                return commentaryContextHelpers;
            }
        } catch (e) { /* ignore */ }

        return null;
    }

    function resolveCommentaryRuntimeHelpers() {
        if (commentaryRuntimeHelpers) return commentaryRuntimeHelpers;

        try {
            if (typeof require === 'function') {
                commentaryRuntimeHelpers = require('../shared/commentary-runtime-helpers');
                if (commentaryRuntimeHelpers) return commentaryRuntimeHelpers;
            }
        } catch (e) { /* ignore */ }

        try {
            if (typeof globalThis !== 'undefined' && globalThis.CommentaryRuntimeHelpers) {
                commentaryRuntimeHelpers = globalThis.CommentaryRuntimeHelpers;
                return commentaryRuntimeHelpers;
            }
        } catch (e) { /* ignore */ }

        return null;
    }

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

    function resolveCpuCommentaryRuntime() {
        const helpers = resolveCommentaryRuntimeHelpers();
        if (helpers && typeof helpers.resolveCommentaryRuntimeByRequire === 'function' && typeof require === 'function') {
            const runtime = helpers.resolveCommentaryRuntimeByRequire(['../game/ai/cpu-commentary-runtime'], require);
            if (runtime) return runtime;
        }
        if (helpers && typeof helpers.resolveCommentaryRuntimeFromGlobal === 'function') {
            const runtime = helpers.resolveCommentaryRuntimeFromGlobal(typeof globalThis !== 'undefined' ? globalThis : null);
            if (runtime) return runtime;
        }
        try {
            if (typeof require === 'function') {
                const runtime = require('../game/ai/cpu-commentary-runtime');
                if (runtime && typeof runtime.requestCommentary === 'function') return runtime;
            }
        } catch (e) { /* ignore */ }

        try {
            if (typeof globalThis !== 'undefined' && globalThis.CpuCommentaryRuntime && typeof globalThis.CpuCommentaryRuntime.requestCommentary === 'function') {
                return globalThis.CpuCommentaryRuntime;
            }
        } catch (e) { /* ignore */ }

        return null;
    }

    function isHumanVsHumanModeEnabled() {
        const debugHvH = (typeof globalThis !== 'undefined' && globalThis.DEBUG_HUMAN_VS_HUMAN === true);
        let matchMode = null;
        try {
            matchMode = (typeof globalThis !== 'undefined' && typeof globalThis.getCurrentMatchMode === 'function')
                ? globalThis.getCurrentMatchMode()
                : (typeof globalThis !== 'undefined' ? globalThis.MATCH_MODE : null);
        } catch (e) { /* ignore */ }
        return debugHvH || matchMode === 'network';
    }

    function normalizePlayerKey(value) {
        const helpers = resolveCommentaryContextHelpers();
        if (helpers && typeof helpers.normalizePlayerKey === 'function') {
            return helpers.normalizePlayerKey(value, 'black');
        }
        return 'black';
    }

    function countDiscsFromBoard(board) {
        const helpers = resolveCommentaryContextHelpers();
        if (helpers && typeof helpers.countDiscsFromBoard === 'function') {
            return helpers.countDiscsFromBoard(board);
        }
        return { black: 0, white: 0 };
    }

    function resolvePhaseByTurn(turnNumber, occupiedCells) {
        const helpers = resolveCommentaryContextHelpers();
        if (helpers && typeof helpers.resolvePhaseByTurn === 'function') {
            return helpers.resolvePhaseByTurn(turnNumber, occupiedCells);
        }
        return 'middle';
    }

    function resolveAdvantageLabel(playerKey, counts) {
        const helpers = resolveCommentaryContextHelpers();
        if (helpers && typeof helpers.resolveAdvantageLabel === 'function') {
            return helpers.resolveAdvantageLabel(playerKey, counts);
        }
        return 'even';
    }

    function emitCpuReactionToEnemyCard(ev) {
        if (isHumanVsHumanModeEnabled()) return;
        if (typeof gameState === 'undefined' || !gameState || !Array.isArray(gameState.board)) return;
        if (typeof addLog !== 'function') return;

        const ownerKey = normalizePlayerKey((ev && ev.player) || (ev && ev.meta && ev.meta.owner));
        if (ownerKey !== 'black') return;

        const runtime = resolveCpuCommentaryRuntime();
        if (!runtime || typeof runtime.requestCommentary !== 'function') return;

        const speakerKey = 'white';
        const counts = countDiscsFromBoard(gameState.board);
        const turnNumber = Number.isFinite(gameState.turnNumber) ? gameState.turnNumber : null;
        const helpers = resolveCommentaryContextHelpers();
        const context = (helpers && typeof helpers.buildCommentaryContext === 'function')
            ? helpers.buildCommentaryContext({
                eventType: 'card_used_by_enemy',
                playerKey: speakerKey,
                turnNumber,
                counts,
                board: gameState.board,
                cardId: (ev && ev.cardId) ? String(ev.cardId) : null
            })
            : {
                eventType: 'card_used_by_enemy',
                playerKey: speakerKey,
                turnNumber,
                counts,
                board: gameState.board,
                phase: resolvePhaseByTurn(turnNumber, (counts.black || 0) + (counts.white || 0)),
                advantage: resolveAdvantageLabel(speakerKey, counts),
                cardId: (ev && ev.cardId) ? String(ev.cardId) : null
            };

        runtime.requestCommentary(context).then((text) => {
            const line = String(text || '').trim();
            if (!line) return;
            const runtimeHelpers = resolveCommentaryRuntimeHelpers();
            const prefix = (runtimeHelpers && typeof runtimeHelpers.getCpuSpeakerPrefix === 'function')
                ? runtimeHelpers.getCpuSpeakerPrefix(speakerKey)
                : '白CPU';
            addLog(`${prefix}: ${line}`);
        }).catch(() => {
            // Keep presentation flow deterministic.
        });
    }

    function buildEnemyCardUsedEventFromPlayback(payload) {
        const events = Array.isArray(payload) ? payload : [];
        for (const ev of events) {
            if (!ev || ev.type !== 'card_use_animation') continue;
            const targets = Array.isArray(ev.targets) ? ev.targets : [];
            for (const one of targets) {
                if (!one || typeof one !== 'object') continue;
                const ownerKey = normalizePlayerKey(one.owner || one.player);
                if (ownerKey !== 'black') continue;
                return {
                    player: ownerKey,
                    cardId: one.cardId || null,
                    meta: {
                        owner: ownerKey,
                        cost: Number.isFinite(one.cost) ? one.cost : null,
                        name: one.name || null
                    }
                };
            }
        }
        return null;
    }

    async function playPlaybackEvents(ev, options) {
        const payload = Array.isArray(ev && ev.events) ? ev.events : [];
        if (!payload.length) return;

        const opts = options && typeof options === 'object' ? options : {};
        if (opts.emitEnemyCardReaction !== false) {
            const enemyCardEvent = buildEnemyCardUsedEventFromPlayback(payload);
            if (enemyCardEvent) emitCpuReactionToEnemyCard(enemyCardEvent);
        }

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
                const delay = Number.isFinite(ev.delayMs) ? ev.delayMs : 0;
                setTimeout(function () {
                    try {
                        const currentPlayer = (typeof gameState !== 'undefined' && gameState) ? gameState.currentPlayer : null;
                        const currentPlayerKey = (currentPlayer === 'white' || (typeof WHITE !== 'undefined' && currentPlayer === WHITE))
                            ? 'white'
                            : ((currentPlayer === 'black' || (typeof BLACK !== 'undefined' && currentPlayer === BLACK)) ? 'black' : null);
                        const currentTurnNumber = (typeof gameState !== 'undefined' && gameState && Number.isFinite(gameState.turnNumber))
                            ? gameState.turnNumber
                            : null;
                        if (ev.expectedPlayerKey && ev.expectedPlayerKey !== currentPlayerKey) return;
                        if (Number.isFinite(ev.expectedTurnNumber) && ev.expectedTurnNumber !== currentTurnNumber) return;
                    } catch (e) { /* ignore */ }
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

    async function flushBoardPresentationEvents() {
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

    async function onBoardUpdated() {
        boardUpdateDrainPending = true;
        if (boardUpdateDrainInProgress) return;

        boardUpdateDrainInProgress = true;
        try {
            while (boardUpdateDrainPending) {
                boardUpdateDrainPending = false;
                await flushBoardPresentationEvents();
            }
        } finally {
            boardUpdateDrainInProgress = false;
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
