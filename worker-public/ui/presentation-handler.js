// Presentation event handler: subscribes to board updates and dispatches UI playback.
(function () {
    'use strict';

    let gamePresentationRuntime = null;
    let boardUpdateDrainController = null;
    const missingRuntimeWarnings = Object.create(null);
    let commentaryContextHelpers = null;
    let ownerHelpers = null;
    let commentaryBroker = null;
    let stoneVisuals = null;
    let presentationResolver = null;
    let playbackEngineModule = null;

    function resolvePresentationResolver() {
        if (presentationResolver) return presentationResolver;
        try {
            if (typeof globalThis !== 'undefined' && globalThis.AnimationResolver) {
                presentationResolver = globalThis.AnimationResolver;
                return presentationResolver;
            }
        } catch (e) { /* ignore */ }
        try {
            if (typeof window !== 'undefined' && window && window.AnimationResolver) {
                presentationResolver = window.AnimationResolver;
                return presentationResolver;
            }
        } catch (e) { /* ignore */ }
        if (presentationResolver) return presentationResolver;
        try {
            if (typeof require === 'function') {
                presentationResolver = require('./animation-resolver');
                if (presentationResolver) return presentationResolver;
            }
        } catch (e) { /* ignore */ }
        return null;
    }

    function resolveFromGlobal(name) {
        const resolver = presentationResolver || resolvePresentationResolver();
        if (resolver && typeof resolver.resolveGlobal === 'function') {
            const resolved = resolver.resolveGlobal(name);
            if (resolved) return resolved;
        }
        try {
            if (typeof globalThis !== 'undefined' && globalThis[name]) {
                return globalThis[name];
            }
        } catch (e) { /* ignore */ }
        try {
            if (typeof window !== 'undefined' && window && window[name]) {
                return window[name];
            }
        } catch (e) { /* ignore */ }
        return null;
    }

    function resolveModuleOrGlobal(modulePath, globalName) {
        const resolver = presentationResolver || resolvePresentationResolver();
        if (resolver && typeof resolver.resolveModuleOrGlobal === 'function') {
            const resolved = resolver.resolveModuleOrGlobal(modulePath, globalName);
            if (resolved) return resolved;
        }
        const globalResolved = resolveFromGlobal(globalName);
        if (globalResolved) return globalResolved;
        if (typeof require === 'function') {
            try {
                return require(modulePath);
            } catch (e) { /* ignore */ }
        }
        return null;
    }

    function resolveCommentaryContextHelpers() {
        if (commentaryContextHelpers) return commentaryContextHelpers;
        commentaryContextHelpers = resolveModuleOrGlobal('../shared/commentary-context-helpers', 'CommentaryContextHelpers');
        if (commentaryContextHelpers) return commentaryContextHelpers;
        return null;
    }

    function resolveCommentaryBroker() {
        if (commentaryBroker) return commentaryBroker;
        commentaryBroker = resolveModuleOrGlobal('./commentary-broker', 'CommentaryBroker');
        if (commentaryBroker) return commentaryBroker;
        return null;
    }

    function resolveStoneVisuals() {
        if (stoneVisuals) return stoneVisuals;
        stoneVisuals = resolveModuleOrGlobal('./stone-visuals', 'StoneVisuals');
        if (stoneVisuals) return stoneVisuals;
        return null;
    }

    function resolveCrossfadeStoneVisual() {
        const visuals = resolveStoneVisuals();
        if (visuals && typeof visuals.crossfadeStoneVisual === 'function') {
            return visuals.crossfadeStoneVisual.bind(visuals);
        }
        if (typeof crossfadeStoneVisual === 'function') return crossfadeStoneVisual;
        return null;
    }

    function resolveDiscVisualSync() {
        const visuals = resolveStoneVisuals();
        if (visuals && typeof visuals.syncDiscVisualToCurrentState === 'function') {
            return visuals.syncDiscVisualToCurrentState.bind(visuals);
        }
        if (typeof syncDiscVisualToCurrentState === 'function') return syncDiscVisualToCurrentState;
        return null;
    }

    function resolveApplyStoneVisualState() {
        const visuals = resolveStoneVisuals();
        if (visuals && typeof visuals.applyStoneVisualState === 'function') {
            return visuals.applyStoneVisualState.bind(visuals);
        }
        if (typeof applyStoneVisualState === 'function') return applyStoneVisualState;
        return null;
    }

    function ensureCommentaryBrokerInitialized() {
        const broker = resolveCommentaryBroker();
        if (!broker || typeof broker.initBroker !== 'function') return broker;
        try {
            broker.initBroker({
                root: (typeof globalThis !== 'undefined') ? globalThis : null,
                addLog: (typeof addLog === 'function') ? addLog : null,
                getShowHeroSpeechBubble: () => {
                    try {
                        if (typeof globalThis !== 'undefined' && typeof globalThis.showHeroSpeechBubble === 'function') {
                            return globalThis.showHeroSpeechBubble;
                        }
                    } catch (e) { /* ignore */ }
                    return null;
                },
                getShowCpuSpeechBubble: () => {
                    try {
                        if (typeof globalThis !== 'undefined' && typeof globalThis.showCpuSpeechBubble === 'function') {
                            return globalThis.showCpuSpeechBubble;
                        }
                    } catch (e) { /* ignore */ }
                    return null;
                }
            });
        } catch (e) { /* ignore */ }
        return broker;
    }

    function resolveOwnerHelpers() {
        if (ownerHelpers) return ownerHelpers;
        ownerHelpers = resolveModuleOrGlobal('../utils/owner-helpers', 'OwnerHelpers');
        if (ownerHelpers) return ownerHelpers;
        return null;
    }

    function resolvePlaybackEngine() {
        if (playbackEngineModule) return playbackEngineModule;
        playbackEngineModule = resolveModuleOrGlobal('./playback-engine', 'PlaybackEngine');
        return playbackEngineModule;
    }

    function normalizeCommentaryPlayerKey(value, fallbackKey) {
        const helpers = resolveCommentaryContextHelpers();
        if (helpers && typeof helpers.normalizePlayerKey === 'function') {
            return helpers.normalizePlayerKey(value, fallbackKey);
        }
        const normalized = String(value || '').trim().toLowerCase();
        if (value === -1 || normalized === 'white' || normalized === '-1') return 'white';
        if (value === 1 || normalized === 'black' || normalized === '1') return 'black';
        return fallbackKey === 'white' ? 'white' : 'black';
    }

    function countDiscsFromBoard(board) {
        const helpers = resolveCommentaryContextHelpers();
        if (helpers && typeof helpers.countDiscsFromBoard === 'function') {
            return helpers.countDiscsFromBoard(board);
        }
        const rows = Array.isArray(board) ? board : [];
        let black = 0;
        let white = 0;
        for (let row = 0; row < rows.length; row += 1) {
            const line = Array.isArray(rows[row]) ? rows[row] : [];
            for (let col = 0; col < line.length; col += 1) {
                const value = Number(line[col]);
                if (value === 1) black += 1;
                else if (value === -1) white += 1;
            }
        }
        return { black, white };
    }

    function getCurrentMatchMode() {
        try {
            if (typeof window !== 'undefined' && window && typeof window.getCurrentMatchMode === 'function') {
                return String(window.getCurrentMatchMode() || 'cpu').trim().toLowerCase() || 'cpu';
            }
        } catch (e) { /* ignore */ }
        try {
            if (typeof globalThis !== 'undefined' && typeof globalThis.getCurrentMatchMode === 'function') {
                return String(globalThis.getCurrentMatchMode() || 'cpu').trim().toLowerCase() || 'cpu';
            }
        } catch (e) { /* ignore */ }
        return 'cpu';
    }

    function resolveLocalHeroPlayerKey() {
        const helpers = resolveOwnerHelpers();
        if (helpers && typeof helpers.resolveLocalPlayerKey === 'function') {
            const rootRef = (typeof window !== 'undefined' && window)
                ? window
                : (typeof globalThis !== 'undefined' ? globalThis : null);
            const resolvedPlayerKey = helpers.resolveLocalPlayerKey(rootRef);
            if (resolvedPlayerKey === 'black' || resolvedPlayerKey === 'white') {
                return normalizeCommentaryPlayerKey(resolvedPlayerKey, 'black');
            }
        }

        const matchMode = getCurrentMatchMode();
        if (matchMode === 'network') {
            try {
                if (typeof window !== 'undefined'
                    && window
                    && window.NetworkMatchClient
                    && typeof window.NetworkMatchClient.getSeatKey === 'function') {
                    return normalizeCommentaryPlayerKey(window.NetworkMatchClient.getSeatKey(), 'black');
                }
            } catch (e) { /* ignore */ }
            return null;
        }
        return 'black';
    }

    function buildBoardSignature(board) {
        try {
            return JSON.stringify(Array.isArray(board) ? board : []);
        } catch (e) {
            return '';
        }
    }

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

    function queueCommentary(resultPromise) {
        if (!resultPromise || typeof resultPromise.then !== 'function') return;
        resultPromise.then((entry) => {
            const broker = ensureCommentaryBrokerInitialized();
            if (broker && typeof broker.showCommentaryEntry === 'function') {
                broker.showCommentaryEntry(entry);
            }
        }).catch(() => {
            // Keep presentation flow deterministic.
        });
    }

    function emitCpuReactionToEnemyCard(ev) {
        const runtime = resolveGamePresentationRuntime();
        if (!runtime || typeof runtime.requestEnemyCardCommentary !== 'function') return;
        queueCommentary(runtime.requestEnemyCardCommentary(ev));
    }

    function emitCpuReactionToEnemyCardFromPlayback(playbackEvents) {
        const runtime = resolveGamePresentationRuntime();
        if (!runtime || typeof runtime.requestEnemyCardCommentaryFromPlayback !== 'function') return false;
        queueCommentary(runtime.requestEnemyCardCommentaryFromPlayback(playbackEvents));
        return true;
    }

    function buildHeroCardEventFromPlayback(playbackEvents, localPlayerKey) {
        const events = Array.isArray(playbackEvents) ? playbackEvents : [];
        for (const ev of events) {
            if (!ev || ev.type !== 'card_use_animation') continue;
            const targets = Array.isArray(ev.targets) ? ev.targets : [];
            for (const target of targets) {
                if (!target || typeof target !== 'object') continue;
                const ownerKey = normalizeCommentaryPlayerKey(target.owner || target.player, localPlayerKey);
                return {
                    ownerKey,
                    localPlayerKey,
                    eventType: ownerKey === localPlayerKey ? 'card_used' : 'card_used_by_enemy',
                    cardId: target.cardId ? String(target.cardId) : null,
                    cardType: target.cardType ? String(target.cardType) : null
                };
            }
        }
        return null;
    }

    function buildHeroCardEventFromPresentationEvent(ev, localPlayerKey) {
        if (!ev || typeof ev !== 'object') return null;
        const ownerKey = normalizeCommentaryPlayerKey(
            (ev.meta && ev.meta.owner) ? ev.meta.owner : ev.player,
            localPlayerKey
        );
        return {
            ownerKey,
            localPlayerKey,
            eventType: ownerKey === localPlayerKey ? 'card_used' : 'card_used_by_enemy',
            cardId: ev.cardId ? String(ev.cardId) : null,
            cardType: ev.cardType
                ? String(ev.cardType)
                : ((ev.meta && (ev.meta.cardType || ev.meta.type))
                    ? String(ev.meta.cardType || ev.meta.type)
                    : null)
        };
    }

    function createHeroCardCommentaryRequest(cardEvent) {
        if (!cardEvent || !cardEvent.localPlayerKey) return null;
        const broker = ensureCommentaryBrokerInitialized();
        if (!broker || typeof broker.requestCommentaryAndShow !== 'function') return null;

        const state = (typeof gameState !== 'undefined' && gameState && typeof gameState === 'object')
            ? gameState
            : null;
        if (!state || !Array.isArray(state.board)) return null;

        const turnNumber = Number.isFinite(Number(state.turnNumber)) ? Number(state.turnNumber) : null;
        const commentaryKey = [
            getCurrentMatchMode(),
            cardEvent.localPlayerKey,
            cardEvent.eventType,
            turnNumber !== null ? turnNumber : '',
            cardEvent.cardId || '',
            buildBoardSignature(state.board)
        ].join('|');
        const counts = countDiscsFromBoard(state.board);
        return broker.requestCommentaryAndShow({
            eventType: cardEvent.eventType,
            playerKey: cardEvent.localPlayerKey,
            speakerRole: 'hero',
            turnNumber,
            counts,
            board: state.board,
            cardId: cardEvent.cardId,
            cardType: cardEvent.cardType,
            dedupeScope: 'hero-card',
            dedupeKey: commentaryKey,
            show: true
        });
    }

    function requestHeroCardCommentaryFromPlayback(playbackEvents) {
        const localPlayerKey = resolveLocalHeroPlayerKey();
        if (!localPlayerKey) return Promise.resolve(null);
        const cardEvent = buildHeroCardEventFromPlayback(playbackEvents, localPlayerKey);
        if (!cardEvent) return Promise.resolve(null);
        const request = createHeroCardCommentaryRequest(cardEvent);
        return request || Promise.resolve(null);
    }

    function emitHeroCardCommentaryFromPlayback(playbackEvents) {
        requestHeroCardCommentaryFromPlayback(playbackEvents);
    }

    function emitHeroCardCommentaryFromEvent(ev) {
        const localPlayerKey = resolveLocalHeroPlayerKey();
        if (!localPlayerKey) return false;
        const cardEvent = buildHeroCardEventFromPresentationEvent(ev, localPlayerKey);
        if (!cardEvent) return false;
        const request = createHeroCardCommentaryRequest(cardEvent);
        if (!request) return false;
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

    function getPlaybackDispatchDeps() {
        const deps = {};
        const animationEngine = resolveFromGlobal('AnimationEngine');
        if (animationEngine) deps.AnimationEngine = animationEngine;
        const scheduleRuntimeMethod = getPresentationRuntimeMethod('scheduleCpuTurn');
        if (scheduleRuntimeMethod.method) {
            deps.scheduleCpuTurnEvent = function (ev) {
                return scheduleRuntimeMethod.method.call(scheduleRuntimeMethod.runtime, ev);
            };
        }
        return deps;
    }

    async function playPlaybackEvents(ev, options) {
        const payload = normalizePlaybackEventsForUi(Array.isArray(ev && ev.events) ? ev.events : []);
        if (!payload.length) return;
        const suppressPlayback = !!(ev && ev.meta && ev.meta.suppressPlayback === true);

        const opts = options && typeof options === 'object' ? options : {};
        if (!suppressPlayback) {
            if (opts.emitEnemyCardReaction !== false) {
                emitCpuReactionToEnemyCardFromPlayback(payload);
            }
            if (opts.emitHeroCardReaction !== false) {
                emitHeroCardCommentaryFromPlayback(payload);
            }
        }
        if (suppressPlayback) return;

        const playbackDispatchDeps = getPlaybackDispatchDeps();
        const playbackEngine = resolvePlaybackEngine();
        try {
            if (playbackEngine && typeof playbackEngine.dispatchPresentationEvent === 'function') {
                await playbackEngine.dispatchPresentationEvent({
                    type: 'PLAYBACK_EVENTS',
                    events: payload
                }, playbackDispatchDeps);
                return;
            }
        } catch (e) { /* ignore */ }

        try {
            const animationEngine = playbackDispatchDeps.AnimationEngine;
            if (animationEngine && typeof animationEngine.play === 'function') {
                await animationEngine.play(payload);
                return;
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
                    const syncDiscVisual = resolveDiscVisualSync();
                    if (typeof syncDiscVisual === 'function') syncDiscVisual(row, col);
                } catch (e) { /* ignore */ }

                const applyStoneVisualState = resolveApplyStoneVisualState();
                const crossfadeStone = resolveCrossfadeStoneVisual();
                if (typeof crossfadeStone === 'function') {
                    crossfadeStone(disc, {
                        effectKey: ev.effectKey,
                        owner: ev.owner,
                        newColor: ev.newColor,
                        durationMs: ev.durationMs,
                        autoFadeOut: ev.autoFadeOut,
                        fadeWholeStone: ev.fadeWholeStone
                    }).catch(function () {});
                } else if (typeof applyStoneVisualState === 'function') {
                    applyStoneVisualState(disc, {
                        effectKey: ev.effectKey,
                        owner: ev.owner,
                        newColor: ev.newColor
                    });
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
                const emittedHeroCardReaction = emitHeroCardCommentaryFromEvent(ev);
                return playPlaybackEvents(
                    { events: playback },
                    {
                        emitEnemyCardReaction: false,
                        emitHeroCardReaction: !emittedHeroCardReaction
                    }
                );
            }

            if (ev.type === 'SCHEDULE_CPU_TURN') {
                const playbackEngine = resolvePlaybackEngine();
                const playbackDispatchDeps = getPlaybackDispatchDeps();
                if (playbackEngine && typeof playbackEngine.dispatchPresentationEvent === 'function') {
                    return playbackEngine.dispatchPresentationEvent(ev, playbackDispatchDeps);
                }
                if (playbackDispatchDeps.scheduleCpuTurnEvent) {
                    return playbackDispatchDeps.scheduleCpuTurnEvent(ev);
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
            try {
                const drainChargeDeltaPopups = (typeof window !== 'undefined' && typeof window.drainVisibleChargeDeltaPopups === 'function')
                    ? window.drainVisibleChargeDeltaPopups
                    : ((typeof drainVisibleChargeDeltaPopups === 'function') ? drainVisibleChargeDeltaPopups : null);
                if (drainChargeDeltaPopups) {
                    drainChargeDeltaPopups({ allowRawFallback: false });
                }
            } catch (e) { /* ignore */ }
            for (const ev of events) {
                await handlePresentationEvent(ev);
            }

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
