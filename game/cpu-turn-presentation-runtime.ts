export function createPresentationRuntime(dependencies: any): any {
    const deps = (dependencies && typeof dependencies === 'object') ? dependencies : {};
    const normalizePlayerKey = typeof deps.normalizePlayerKey === 'function'
        ? deps.normalizePlayerKey
        : ((value: any, fallbackKey: any) => (value === 'white' ? 'white' : (fallbackKey === 'white' ? 'white' : 'black')));
    const resolveGameState = typeof deps.resolveGameState === 'function'
        ? deps.resolveGameState
        : (() => null);
    const resolveCardState = typeof deps.resolveCardState === 'function'
        ? deps.resolveCardState
        : ((value: any) => (value && typeof value === 'object') ? value : null);
    const getPlayerKeyFromState = typeof deps.getCurrentPlayerKeyFromState === 'function'
        ? deps.getCurrentPlayerKeyFromState
        : (() => null);
    const getTurnNumber = typeof deps.getTurnNumberFromState === 'function'
        ? deps.getTurnNumberFromState
        : (() => null);
    const countDiscs = typeof deps.countDiscs === 'function'
        ? deps.countDiscs
        : (() => ({ black: 0, white: 0 }));
    const resolveContextHelpers = typeof deps.resolveCommentaryContextHelpers === 'function'
        ? deps.resolveCommentaryContextHelpers
        : (() => null);
    const resolveCpuLevel = typeof deps.resolveCommentaryCpuLevel === 'function'
        ? deps.resolveCommentaryCpuLevel
        : (() => 1);
    const resolvePhase = typeof deps.resolvePhaseByTurn === 'function'
        ? deps.resolvePhaseByTurn
        : (() => 'middle');
    const resolveAdvantage = typeof deps.resolveAdvantageLabel === 'function'
        ? deps.resolveAdvantageLabel
        : (() => 'even');
    const resolveCommentaryRuntime = typeof deps.resolveCpuCommentaryRuntime === 'function'
        ? deps.resolveCpuCommentaryRuntime
        : (() => null);
    const formatCommentaryResult = typeof deps.formatCommentaryResult === 'function'
        ? deps.formatCommentaryResult
        : (() => null);
    const isHumanModeEnabled = typeof deps.isHumanVsHumanModeEnabled === 'function'
        ? deps.isHumanVsHumanModeEnabled
        : (() => false);
    const flushPresentationEvents = typeof deps.flushPresentationEvents === 'function'
        ? deps.flushPresentationEvents
        : null;
    const processScheduledCpuTurn = typeof deps.processCpuTurn === 'function'
        ? deps.processCpuTurn
        : null;
    const getTimerService = typeof deps.getTimerService === 'function'
        ? deps.getTimerService
        : (() => null);

    function buildEnemyCardUsedEventFromPlayback(playbackEvents: any) {
        const events = Array.isArray(playbackEvents) ? playbackEvents : [];
        for (const ev of events) {
            if (!ev || ev.type !== 'card_use_animation') continue;
            const targets = Array.isArray(ev.targets) ? ev.targets : [];
            for (const one of targets) {
                if (!one || typeof one !== 'object') continue;
                const ownerKey = normalizePlayerKey(one.owner || one.player, 'black');
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

    function buildEnemyCardCommentaryContext(ev: any, options: any) {
        const state = resolveGameState(options);
        if (!state || !Array.isArray(state.board)) return null;

        const ownerKey = normalizePlayerKey((ev && ev.player) || (ev && ev.meta && ev.meta.owner), 'black');
        if (ownerKey !== 'black') return null;

        const speakerKey = 'white';
        const counts = countDiscs(state);
        const turnNumber = getTurnNumber(state);
        const helpers = resolveContextHelpers();
        const preparedMetrics = options && typeof options === 'object'
            && options.preparedCommentaryMetrics
            && typeof options.preparedCommentaryMetrics === 'object'
            ? options.preparedCommentaryMetrics
            : null;
        const commentaryLevel = resolveCpuLevel(
            speakerKey,
            options && typeof options === 'object' ? options.level : null
        );
        if (helpers && typeof helpers.buildCommentaryContext === 'function') {
            return helpers.buildCommentaryContext({
                eventType: 'card_used_by_enemy',
                playerKey: speakerKey,
                turnNumber,
                counts,
                board: state.board,
                preparedMetrics,
                cardId: (ev && ev.cardId) ? String(ev.cardId) : null,
                extra: {
                    level: commentaryLevel,
                    cpuLevel: commentaryLevel,
                    difficultyLevel: commentaryLevel
                }
            });
        }

        return {
            eventType: 'card_used_by_enemy',
            playerKey: speakerKey,
            turnNumber,
            counts,
            board: state.board,
            phase: resolvePhase(turnNumber, (counts.black || 0) + (counts.white || 0)),
            advantage: resolveAdvantage(speakerKey, counts),
            cardId: (ev && ev.cardId) ? String(ev.cardId) : null,
            level: commentaryLevel,
            cpuLevel: commentaryLevel,
            difficultyLevel: commentaryLevel
        };
    }

    function requestEnemyCardCommentary(ev: any, options: any) {
        if (isHumanModeEnabled()) return Promise.resolve(null);

        const opts = (options && typeof options === 'object') ? options : {};
        const runtime = (opts.runtime && typeof opts.runtime.requestCommentary === 'function')
            ? opts.runtime
            : resolveCommentaryRuntime();
        if (!runtime || typeof runtime.requestCommentary !== 'function') return Promise.resolve(null);

        const context = buildEnemyCardCommentaryContext(ev, opts);
        if (!context) return Promise.resolve(null);

        return Promise.resolve(runtime.requestCommentary(context))
            .then((text) => formatCommentaryResult('white', text))
            .catch(() => null);
    }

    function requestEnemyCardCommentaryFromPlayback(playbackEvents: any, options: any) {
        const enemyCardEvent = buildEnemyCardUsedEventFromPlayback(playbackEvents);
        if (!enemyCardEvent) return Promise.resolve(null);
        return requestEnemyCardCommentary(enemyCardEvent, options);
    }

    function flushPendingPresentationEvents(cardStateRef: any, options: any) {
        const state = resolveCardState(cardStateRef);
        if (!state) return [];

        const opts = (options && typeof options === 'object') ? options : {};
        let events = [];
        const flushLiveEvents = (typeof opts.flushLiveEvents === 'function')
            ? opts.flushLiveEvents
            : flushPresentationEvents;
        if (typeof flushLiveEvents === 'function') {
            try {
                events = flushLiveEvents(state) || [];
            } catch (e) {
                events = [];
            }
        }

        if (events && events.length > 0 && Array.isArray(state._presentationEventsPersist)) {
            state._presentationEventsPersist.length = 0;
        }

        if ((!events || events.length === 0) && Array.isArray(state._presentationEventsPersist) && state._presentationEventsPersist.length) {
            events = state._presentationEventsPersist.slice();
            state._presentationEventsPersist.length = 0;
        }

        return Array.isArray(events) ? events : [];
    }

    function createBoardUpdateDrainController() {
        let drainInProgress = false;
        let drainPending = false;

        return {
            async requestDrain(runDrain: any) {
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
    }

    function scheduleCpuTurn(ev: any, options: any) {
        const payload = (ev && typeof ev === 'object') ? ev : {};
        const opts = (options && typeof options === 'object') ? options : {};
        const delay = Number.isFinite(payload.delayMs) ? payload.delayMs : 0;
        const timerService = getTimerService();
        const globalSetTimeout = (typeof setTimeout === 'function') ? setTimeout : null;
        const scheduleFn = (typeof opts.setTimeout === 'function')
            ? opts.setTimeout
            : (timerService && typeof timerService.setTimeout === 'function')
                ? timerService.setTimeout.bind(timerService)
                : globalSetTimeout;
        const cpuTurnFn = (typeof opts.processCpuTurn === 'function') ? opts.processCpuTurn : processScheduledCpuTurn;
        if (typeof scheduleFn !== 'function') return null;

        return scheduleFn(function () {
            try {
                const state = resolveGameState(opts);
                const currentPlayerKey = getPlayerKeyFromState(state);
                const currentTurnNumber = getTurnNumber(state);
                if (payload.expectedPlayerKey && payload.expectedPlayerKey !== currentPlayerKey) return;
                if (Number.isFinite(payload.expectedTurnNumber) && payload.expectedTurnNumber !== currentTurnNumber) return;
            } catch (e) { /* ignore */ }

            if (typeof cpuTurnFn === 'function') {
                cpuTurnFn();
            } else {
                console.warn('[GamePresentationRuntime] processCpuTurn not available for SCHEDULE_CPU_TURN');
            }
        }, delay);
    }

    return {
        buildEnemyCardUsedEventFromPlayback,
        requestEnemyCardCommentary,
        requestEnemyCardCommentaryFromPlayback,
        flushPendingPresentationEvents,
        createBoardUpdateDrainController,
        scheduleCpuTurn
    };
}

module.exports = {
    createPresentationRuntime
};
