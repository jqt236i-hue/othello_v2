declare const __non_webpack_require__: NodeRequire | undefined;

import {
    measureCpuTurnSync,
    readCpuTurnPerformanceNowMs,
    recordCpuTurnPerformanceInterval,
    type CpuTurnPerformanceScope,
    type CpuTurnPerformanceStage
} from './cpu-turn-performance';

const _require: NodeRequire = (typeof __non_webpack_require__ !== 'undefined')
    ? __non_webpack_require__
    : require;

const root: any = (typeof globalThis !== 'undefined') ? globalThis : {};
let BoardUtils: any = null;
try {
    BoardUtils = _require('../shared/board-utils');
} catch (e: any) { /* optional board counter fallback */ }

    let networkActionSchema: any = null;
    let playbackEventHelpers: any = null;
    const BOARD_CHANGING_TURN_START_MARKER_TYPES = new Set([
        'ULTIMATE_DESTROY_GOD',
        'DESTROY_DRAGON',
        'SNIPER',
        'LIGHTNING',
        'METEOR_GOD',
        'DRAGON',
        'HYPERACTIVE',
        'ESCAPE_HYPERACTIVE',
        'EXTREME_HYPERACTIVE',
        'ROBOT_VACUUM',
        'GLUTTONOUS',
        'ULTIMATE_HYPERACTIVE'
    ]);

    function cloneData(value: any): any {
        try {
            if (root && typeof root.structuredClone === 'function') {
                return root.structuredClone(value);
            }
        } catch (e: any) { /* ignore */ }
        return JSON.parse(JSON.stringify(value));
    }

    function resolveNetworkActionSchema() {
        if (networkActionSchema && typeof networkActionSchema === 'object') {
            return networkActionSchema;
        }

        if (typeof require === 'function') {
            try { networkActionSchema = require('../shared/network-action-schema'); } catch (e) { /* ignore */ }
        }
        if (!networkActionSchema && root && root.NetworkActionSchema) {
            networkActionSchema = root.NetworkActionSchema;
        }
        return networkActionSchema;
    }

    function resolvePlaybackEventHelpers() {
        if (playbackEventHelpers && typeof playbackEventHelpers === 'object') {
            return playbackEventHelpers;
        }

        if (typeof require === 'function') {
            try { playbackEventHelpers = require('../shared/playback-event-helpers'); } catch (e) { /* ignore */ }
        }
        if (!playbackEventHelpers && root && root.PlaybackEventHelpers) {
            playbackEventHelpers = root.PlaybackEventHelpers;
        }
        return playbackEventHelpers;
    }

    function normalizeActionType(value: any, fallback: any): string {
        const normalized = String(value || '').trim().toLowerCase();
        if (normalized) return normalized;
        return String(fallback || '').trim().toLowerCase();
    }

    function shouldUseCommandPublish(meta: any): boolean {
        const payload = (meta && typeof meta === 'object') ? meta : {};
        const action = (payload.action && typeof payload.action === 'object') ? payload.action : null;
        const actionType = normalizeActionType(payload.actionType || (action && (action.type || action.actionType)), '');

        if (action) {
            const schema = resolveNetworkActionSchema();
            if (schema && typeof schema.shouldUseCommandPayload === 'function') {
                try {
                    return !!schema.shouldUseCommandPayload(action);
                } catch (e: any) { /* ignore */ }
            }
            return !!actionType && actionType !== 'action';
        }

        return actionType === 'reset_game' || actionType === 'rematch' || actionType === 'restart';
    }

    function buildPublishMeta(meta: any): any {
        const payload = (meta && typeof meta === 'object') ? Object.assign({}, meta) : {};
        const action = (payload.action && typeof payload.action === 'object') ? payload.action : null;
        const actionType = normalizeActionType(payload.actionType || (action && (action.type || action.actionType)), '');

        if (actionType) {
            payload.actionType = actionType;
        }
        if (shouldUseCommandPublish(payload)) {
            delete payload.snapshot;
        }
        return payload;
    }

    function captureNetworkPublishSnapshot(gameStateValue: any, cardStateValue: any): any {
        if (!gameStateValue || !cardStateValue) return null;
        try {
            return {
                gameState: cloneData(gameStateValue),
                cardState: cloneData(cardStateValue)
            };
        } catch (e: any) {
            return null;
        }
    }

    function publishNetworkSnapshot(meta: any): undefined {
        void meta;
        return undefined;
    }

    function toPublishFailureResult(publishResult: any): any {
        if (publishResult && typeof publishResult === 'object' && publishResult.ok === false) {
            return publishResult;
        }
        return {
            ok: false,
            reason: 'NETWORK_PUBLISH_FAILED'
        };
    }

    async function publishTurnHandoffSnapshot(publishSnapshotFn: any, meta: any, options: any): Promise<any> {
        var publishFn = (typeof publishSnapshotFn === 'function') ? publishSnapshotFn : null;
        var opts = (options && typeof options === 'object') ? options : {};
        var onPublishFailed = (typeof opts.onPublishFailed === 'function') ? opts.onPublishFailed : null;
        var awaitPublishResult = opts.awaitPublishResult === true;
        var payload = buildPublishMeta(meta);

        if (!publishFn) {
            return { ok: true, publishResult: undefined };
        }

        if (!awaitPublishResult) {
            try {
                var publishResult = publishFn(payload);
                if (publishResult && typeof publishResult.then === 'function') {
                    publishResult.then(function (resolvedPublishResult: any) {
                        if (resolvedPublishResult && typeof resolvedPublishResult === 'object' && resolvedPublishResult.ok === false && onPublishFailed) {
                            onPublishFailed({
                                reason: 'network_publish_failed',
                                publishResult: resolvedPublishResult
                            });
                        }
                    }).catch(function (error: any) {
                        if (onPublishFailed) {
                            onPublishFailed({
                                reason: 'network_publish_threw',
                                publishResult: {
                                    ok: false,
                                    reason: 'NETWORK_PUBLISH_THREW',
                                    errorMessage: error && error.message ? error.message : String(error || 'unknown_error')
                                }
                            });
                        }
                    });
                } else if (publishResult && typeof publishResult === 'object' && publishResult.ok === false && onPublishFailed) {
                    onPublishFailed({
                        reason: 'network_publish_failed',
                        publishResult: publishResult
                    });
                }
                return {
                    ok: !(publishResult && typeof publishResult === 'object' && publishResult.ok === false),
                    publishResult: publishResult
                };
            } catch (error: any) {
                var thrownPublishResult = {
                    ok: false,
                    reason: 'NETWORK_PUBLISH_THREW',
                    errorMessage: error && error.message ? error.message : String(error || 'unknown_error')
                };
                if (onPublishFailed) {
                    onPublishFailed({
                        reason: 'network_publish_threw',
                        publishResult: thrownPublishResult
                    });
                }
                return {
                    ok: false,
                    publishResult: thrownPublishResult
                };
            }
        }

        try {
            var awaitedPublishResult = await Promise.resolve(publishFn(payload));
            if (awaitedPublishResult && typeof awaitedPublishResult === 'object' && awaitedPublishResult.ok === false) {
                if (onPublishFailed) {
                    await Promise.resolve(onPublishFailed({
                        reason: 'network_publish_failed',
                        publishResult: awaitedPublishResult
                    }));
                }
                return {
                    ok: false,
                    publishResult: awaitedPublishResult
                };
            }
            return {
                ok: true,
                publishResult: awaitedPublishResult
            };
        } catch (error: any) {
            var awaitedThrownPublishResult = {
                ok: false,
                reason: 'NETWORK_PUBLISH_THREW',
                errorMessage: error && error.message ? error.message : String(error || 'unknown_error')
            };
            if (onPublishFailed) {
                await Promise.resolve(onPublishFailed({
                    reason: 'network_publish_threw',
                    publishResult: awaitedThrownPublishResult
                }));
            }
            return {
                ok: false,
                publishResult: awaitedThrownPublishResult
            };
        }
    }

    function resolvePlayerKeyFromTurnValue(value: any): string {
        const normalized = (value === null || typeof value === 'undefined')
            ? ''
            : String(value).trim().toLowerCase();
        if (normalized === 'white' || normalized === '-1') return 'white';
        if (normalized === 'black' || normalized === '1' || normalized === '+1') return 'black';
        if (value === -1) return 'white';
        if (value === 1) return 'black';
        return 'black';
    }

    function resolvePlayerKeyFromTurnValueOptional(value: any): string | null {
        const normalized = (value === null || typeof value === 'undefined')
            ? ''
            : String(value).trim().toLowerCase();
        if (normalized === 'white' || normalized === '-1') return 'white';
        if (normalized === 'black' || normalized === '1' || normalized === '+1') return 'black';
        if (value === -1) return 'white';
        if (value === 1) return 'black';
        return null;
    }

    function getFateWillControllerForTurnOwner(cardStateRef: any, turnOwnerKey: any): string | null {
        const ownerKey = resolvePlayerKeyFromTurnValueOptional(turnOwnerKey);
        if (!cardStateRef || typeof cardStateRef !== 'object') return null;
        const controllerMap = (cardStateRef.fateWillControllerByTurnOwner && typeof cardStateRef.fateWillControllerByTurnOwner === 'object')
            ? cardStateRef.fateWillControllerByTurnOwner
            : null;
        if (!controllerMap) return null;
        const controllerKey = ownerKey ? controllerMap[ownerKey] : null;
        if (!controllerKey) return null;
        return resolvePlayerKeyFromTurnValueOptional(controllerKey);
    }

    function resolveCpuTurnOwnerKey(gameStateRef: any, cardStateRef: any): string | null {
        const turnOwnerKey = resolvePlayerKeyFromTurnValueOptional(gameStateRef ? gameStateRef.currentPlayer : null);
        if (!turnOwnerKey) return null;
        const controllerKey = getFateWillControllerForTurnOwner(cardStateRef, turnOwnerKey);
        const effectiveOperatorKey = controllerKey || turnOwnerKey;
        return effectiveOperatorKey === 'white' ? turnOwnerKey : null;
    }

    async function waitForPlaybackIdleIfNeeded(playbackEvents: any): Promise<'skipped' | 'settled' | 'error'> {
        if (!Array.isArray(playbackEvents) || playbackEvents.length === 0) return 'skipped';

        const waitForPlaybackFn = (typeof root.waitForPlaybackIdle === 'function')
            ? root.waitForPlaybackIdle
            : null;

        if (typeof waitForPlaybackFn !== 'function') return 'skipped';

        try {
            await waitForPlaybackFn();
            return 'settled';
        } catch (e: any) {
            return 'error';
        }
    }

    async function invokeMeasuredHandoffAsync<T>(
        performanceScope: CpuTurnPerformanceScope | null,
        syncStage: CpuTurnPerformanceStage,
        waitStage: CpuTurnPerformanceStage,
        callback: () => T | PromiseLike<T>,
        resolveOutcome?: (result: T) => 'continue' | 'handled' | 'stale' | 'error'
    ): Promise<T> {
        if (!performanceScope) return await callback();
        const pending = measureCpuTurnSync(
            performanceScope,
            syncStage,
            () => Promise.resolve(callback())
        );
        const waitStartedAtMs = readCpuTurnPerformanceNowMs(performanceScope);
        try {
            const result = await pending;
            let outcome: 'continue' | 'handled' | 'stale' | 'error' = 'continue';
            if (typeof resolveOutcome === 'function') {
                try { outcome = resolveOutcome(result); } catch (_error) { outcome = 'error'; }
            }
            recordCpuTurnPerformanceInterval(
                performanceScope,
                waitStage,
                'wait',
                waitStartedAtMs,
                readCpuTurnPerformanceNowMs(performanceScope),
                outcome
            );
            return result;
        } catch (error) {
            recordCpuTurnPerformanceInterval(
                performanceScope,
                waitStage,
                'wait',
                waitStartedAtMs,
                readCpuTurnPerformanceNowMs(performanceScope),
                'error'
            );
            throw error;
        }
    }

    function readCurrentGameState() {
        return (root && root.gameState && typeof root.gameState === 'object') ? root.gameState : null;
    }

    function readCurrentCardState() {
        return (root && root.cardState && typeof root.cardState === 'object') ? root.cardState : null;
    }

    function readCurrentTurnNumber() {
        const gameStateRef = readCurrentGameState();
        return (gameStateRef && Number.isFinite(Number(gameStateRef.turnNumber)))
            ? Number(gameStateRef.turnNumber)
            : null;
    }

    function isEmptyOwner(value: any): boolean {
        return value === 0 || value === '0' || value === null || typeof value === 'undefined';
    }

    function getBoardOwnerAt(gameStateRef: any, row: any, col: any): any {
        if (!gameStateRef || !Number.isInteger(row) || !Number.isInteger(col)) return null;
        if (Array.isArray(gameStateRef.board) && row >= 0 && row < gameStateRef.board.length) {
            const rowData = gameStateRef.board[row];
            if (Array.isArray(rowData) && col >= 0 && col < rowData.length) {
                return rowData[col];
            }
        }
        const expansionCells = gameStateRef.boardExpansion && Array.isArray(gameStateRef.boardExpansion.cells)
            ? gameStateRef.boardExpansion.cells
            : [];
        const expansion = expansionCells.find((cell: any) => cell && cell.row === row && cell.col === col);
        return expansion ? expansion.owner : null;
    }

    function countBoardEmpties(gameStateRef: any): number {
        if (!gameStateRef || !Array.isArray(gameStateRef.board)) return 0;
        let emptyCount = 0;
        for (const row of gameStateRef.board) {
            if (!Array.isArray(row)) continue;
            for (const cell of row) {
                if (isEmptyOwner(cell)) emptyCount += 1;
            }
        }
        const expansionCells = gameStateRef.boardExpansion && Array.isArray(gameStateRef.boardExpansion.cells)
            ? gameStateRef.boardExpansion.cells
            : [];
        for (const cell of expansionCells) {
            if (cell && isEmptyOwner(cell.owner)) emptyCount += 1;
        }
        return emptyCount;
    }

    function countDiscs(gameStateRef: any): { black: number; white: number } {
        if (!gameStateRef || !Array.isArray(gameStateRef.board)) {
            return { black: 0, white: 0 };
        }
        let black = 0;
        let white = 0;
        if (BoardUtils && typeof BoardUtils.countDiscs === 'function') {
            const counts = BoardUtils.countDiscs(gameStateRef.board);
            black = counts.black;
            white = counts.white;
        } else {
            for (const row of gameStateRef.board) {
                if (!Array.isArray(row)) continue;
                for (const cell of row) {
                    if (cell === 1 || cell === '1') black += 1;
                    else if (cell === -1 || cell === '-1') white += 1;
                }
            }
        }
        const expansionCells = gameStateRef.boardExpansion && Array.isArray(gameStateRef.boardExpansion.cells)
            ? gameStateRef.boardExpansion.cells
            : [];
        for (const cell of expansionCells) {
            if (!cell) continue;
            if (cell.owner === 1 || cell.owner === '1') black += 1;
            else if (cell.owner === -1 || cell.owner === '-1') white += 1;
        }
        return { black, white };
    }

    function markerMayResolveBoardChangeAtTurnStart(marker: any, gameStateRef: any): boolean {
        if (!marker || typeof marker !== 'object') return false;
        const data = marker.data && typeof marker.data === 'object' ? marker.data : null;
        if (!data) return false;

        if (data.category === 'bomb') {
            const remainingTurns = Number(data.remainingTurns);
            const ownerAtCell = getBoardOwnerAt(gameStateRef, marker.row, marker.col);
            return Number.isFinite(remainingTurns) && remainingTurns <= 1 && !isEmptyOwner(ownerAtCell);
        }

        const type = String(data.type || '').trim().toUpperCase();
        if (!BOARD_CHANGING_TURN_START_MARKER_TYPES.has(type)) return false;
        const ownerAtCell = getBoardOwnerAt(gameStateRef, marker.row, marker.col);
        return !isEmptyOwner(ownerAtCell);
    }

    function shouldDeferGameOverUntilTurnStart(gameStateRef: any, cardStateRef: any): boolean {
        if (!gameStateRef || !cardStateRef) return false;
        if (Number(gameStateRef.consecutivePasses) >= 2) return false;
        const discs = countDiscs(gameStateRef);
        if ((discs.black + discs.white) > 0 && (discs.black === 0 || discs.white === 0)) return false;
        if (countBoardEmpties(gameStateRef) !== 0) return false;
        const markers = Array.isArray(cardStateRef.markers) ? cardStateRef.markers : [];
        return markers.some((marker: any) => markerMayResolveBoardChangeAtTurnStart(marker, gameStateRef));
    }

    function isGameOverNow(customIsGameOver: any, snapshotOverride: any): boolean {
        const gameStateRef = snapshotOverride && snapshotOverride.gameState ? snapshotOverride.gameState : readCurrentGameState();
        const cardStateRef = snapshotOverride && snapshotOverride.cardState ? snapshotOverride.cardState : readCurrentCardState();
        const isGameOverFn = (typeof customIsGameOver === 'function')
            ? customIsGameOver
            : ((root && typeof root.isGameOver === 'function') ? root.isGameOver : null);
        if (!gameStateRef || typeof isGameOverFn !== 'function') return false;
        try {
            const gameOver = !!isGameOverFn(gameStateRef);
            if (!gameOver) return false;
            if (shouldDeferGameOverUntilTurnStart(gameStateRef, cardStateRef)) return false;
            return true;
        } catch (e: any) {
            return false;
        }
    }

    function showResultIfAvailable(customShowResult: any): void {
        const showResultFn = (typeof customShowResult === 'function')
            ? customShowResult
            : ((root && typeof root.showResult === 'function') ? root.showResult : null);
        if (typeof showResultFn !== 'function') return;
        try {
            showResultFn();
        } catch (e: any) { /* ignore */ }
    }

    async function finalizeNetworkTurnHandoff(options: any): Promise<any> {
        const opts = (options && typeof options === 'object') ? options : {};
        const performanceScope = (opts.performanceScope || null) as CpuTurnPerformanceScope | null;
        const basePlaybackEvents = Array.isArray(opts.playbackEvents) ? opts.playbackEvents.slice() : [];
        const publishSnapshotFn = (typeof opts.publishSnapshot === 'function') ? opts.publishSnapshot : null;
        const setProcessing = (typeof opts.setProcessing === 'function') ? opts.setProcessing : null;
        const actionType = opts.actionType || 'place';
        const action = (opts.action && typeof opts.action === 'object') ? opts.action : null;
        const playerKey = opts.playerKey || 'black';
        const snapshotOverride = opts.snapshot || null;
        const resultOrder = opts.resultOrder === 'beforePublish' ? 'beforePublish' : 'afterPublish';
        const turnStartFn = (typeof opts.onTurnStart === 'function')
            ? opts.onTurnStart
            : ((root && typeof root.onTurnStart === 'function') ? root.onTurnStart : null);
        const resolveCurrentPlayerKey = (typeof opts.resolveCurrentPlayerKey === 'function')
            ? opts.resolveCurrentPlayerKey
            : function defaultResolveCurrentPlayerKey() {
                const gameStateRef = readCurrentGameState();
                return resolvePlayerKeyFromTurnValue(gameStateRef ? gameStateRef.currentPlayer : null);
            };
        const onHumanTurnReady = (typeof opts.onHumanTurnReady === 'function') ? opts.onHumanTurnReady : null;
        const onPublishFailed = (typeof opts.onPublishFailed === 'function') ? opts.onPublishFailed : null;
        const awaitPublishResult = opts.awaitPublishResult === true;
        const scheduleCpuTurn = (typeof opts.scheduleCpuTurn === 'function') ? opts.scheduleCpuTurn : null;
        const cpuDelayMs = Number.isFinite(Number(opts.cpuDelayMs))
            ? Math.max(0, Math.trunc(Number(opts.cpuDelayMs)))
            : ((root && Number.isFinite(Number(root.CPU_TURN_DELAY_MS))) ? Math.max(0, Math.trunc(Number(root.CPU_TURN_DELAY_MS))) : 200);

        if (isGameOverNow(opts.isGameOver, snapshotOverride)) {
            if (resultOrder === 'beforePublish') showResultIfAvailable(opts.showResult);
            const publishGameOver = () => publishTurnHandoffSnapshot(publishSnapshotFn, {
                    playerKey,
                    actionType,
                    action,
                    playbackEvents: basePlaybackEvents,
                    snapshot: snapshotOverride
                }, {
                    awaitPublishResult,
                    onPublishFailed
                });
            const gameOverPublish = performanceScope
                ? await invokeMeasuredHandoffAsync(
                    performanceScope,
                    'presentation-handoff',
                    'presentation-handoff',
                    publishGameOver
                )
                : await publishGameOver();
            if (!gameOverPublish.ok) {
                if (setProcessing) setProcessing(false);
                return {
                    ok: false,
                    reason: 'network_publish_failed',
                    result: toPublishFailureResult(gameOverPublish.publishResult),
                    gameOver: false,
                    scheduledCpu: false,
                    nextPlayerKey: resolveCurrentPlayerKey(),
                    playbackEvents: basePlaybackEvents,
                    turnStartPlaybackEvents: []
                };
            }
            if (resultOrder !== 'beforePublish') showResultIfAvailable(opts.showResult);
            if (setProcessing) setProcessing(false);
            return {
                ok: true,
                gameOver: true,
                scheduledCpu: false,
                nextPlayerKey: resolveCurrentPlayerKey(),
                playbackEvents: basePlaybackEvents,
                turnStartPlaybackEvents: []
            };
        }

        // Single Writer: network モードではローカル playback がないため wait 不要
        if (!opts.skipLocalPlaybackWait) {
            if (performanceScope) {
                await invokeMeasuredHandoffAsync(
                    performanceScope,
                    'presentation-handoff',
                    'presentation-handoff',
                    () => waitForPlaybackIdleIfNeeded(basePlaybackEvents),
                    (result) => result === 'error' ? 'error' : 'continue'
                );
            } else {
                await waitForPlaybackIdleIfNeeded(basePlaybackEvents);
            }
        }

        const playbackHelpers = resolvePlaybackEventHelpers();
        let turnStartPlaybackEvents: any[] = [];
        if (typeof turnStartFn === 'function') {
            const MAX_TURN_START_CHAIN = 8;
            for (let index = 0; index < MAX_TURN_START_CHAIN; index += 1) {
                const gameStateRef = readCurrentGameState();
                const beforePlayerKey = resolvePlayerKeyFromTurnValue(gameStateRef ? gameStateRef.currentPlayer : null);
                const invokeTurnStart = () => turnStartFn(gameStateRef ? gameStateRef.currentPlayer : null);
                const turnStartResult = performanceScope
                    ? await invokeMeasuredHandoffAsync(
                        performanceScope,
                        'canonical-commit',
                        'presentation-handoff',
                        invokeTurnStart
                    )
                    : await invokeTurnStart();
                if (turnStartResult && Array.isArray(turnStartResult.playbackEvents)) {
                    turnStartPlaybackEvents = (playbackHelpers && typeof playbackHelpers.appendPlaybackEventsAfter === 'function')
                        ? playbackHelpers.appendPlaybackEventsAfter(turnStartPlaybackEvents, turnStartResult.playbackEvents)
                        : turnStartPlaybackEvents.concat(turnStartResult.playbackEvents);
                }
                if (!(turnStartResult && turnStartResult.stopAction === true)) {
                    break;
                }
                const nextGameStateRef = readCurrentGameState();
                const afterPlayerKey = resolvePlayerKeyFromTurnValue(nextGameStateRef ? nextGameStateRef.currentPlayer : null);
                if (!afterPlayerKey || afterPlayerKey === beforePlayerKey) {
                    break;
                }
            }
        }

        const combinedPlaybackEvents = (playbackHelpers && typeof playbackHelpers.appendPlaybackEventsAfter === 'function')
            ? playbackHelpers.appendPlaybackEventsAfter(basePlaybackEvents, turnStartPlaybackEvents)
            : basePlaybackEvents.concat(turnStartPlaybackEvents);

        if (typeof opts.afterTurnStart === 'function') {
            const invokeAfterTurnStart = () => opts.afterTurnStart({
                    playbackEvents: combinedPlaybackEvents.slice(),
                    turnStartPlaybackEvents: turnStartPlaybackEvents.slice(),
                    snapshot: snapshotOverride
                });
            if (performanceScope) {
                await invokeMeasuredHandoffAsync(
                    performanceScope,
                    'presentation-handoff',
                    'presentation-handoff',
                    invokeAfterTurnStart
                );
            } else {
                await invokeAfterTurnStart();
            }
        }

        const publishCompletedTurn = () => publishTurnHandoffSnapshot(publishSnapshotFn, {
                playerKey,
                actionType,
                action,
                playbackEvents: combinedPlaybackEvents,
                snapshot: snapshotOverride
            }, {
                awaitPublishResult,
                onPublishFailed
            });
        const publishOutcome = performanceScope
            ? await invokeMeasuredHandoffAsync(
                performanceScope,
                'presentation-handoff',
                'presentation-handoff',
                publishCompletedTurn
            )
            : await publishCompletedTurn();
        if (!publishOutcome.ok) {
            if (setProcessing) setProcessing(false);
            return {
                ok: false,
                reason: 'network_publish_failed',
                result: toPublishFailureResult(publishOutcome.publishResult),
                gameOver: false,
                scheduledCpu: false,
                nextPlayerKey: resolveCurrentPlayerKey(),
                playbackEvents: combinedPlaybackEvents,
                turnStartPlaybackEvents
            };
        }

        if (opts.checkGameOverAfterTurnStart !== false && isGameOverNow(opts.isGameOver, snapshotOverride)) {
            showResultIfAvailable(opts.showResult);
            if (setProcessing) setProcessing(false);
            return {
                ok: true,
                gameOver: true,
                scheduledCpu: false,
                nextPlayerKey: resolveCurrentPlayerKey(),
                playbackEvents: combinedPlaybackEvents,
                turnStartPlaybackEvents
            };
        }

        const humanMode = !!opts.humanMode;
        const gameStateRef = readCurrentGameState();
        const cardStateRef = readCurrentCardState();
        const nextPlayerKey = resolveCurrentPlayerKey();
        const cpuTurnOwnerKey = (!humanMode)
            ? resolveCpuTurnOwnerKey(gameStateRef, cardStateRef)
            : null;
        if (cpuTurnOwnerKey && cpuTurnOwnerKey === nextPlayerKey && scheduleCpuTurn) {
            if (setProcessing) setProcessing(true);
            let scheduleAccepted = true;
            try {
                const scheduleCpu = () => scheduleCpuTurn({
                        delayMs: cpuDelayMs,
                        expectedTurnNumber: readCurrentTurnNumber(),
                        nextPlayerKey
                    });
                scheduleAccepted = performanceScope
                    ? measureCpuTurnSync(performanceScope, 'presentation-handoff', scheduleCpu)
                    : scheduleCpu();
            } catch (e) {
                if (setProcessing) setProcessing(false);
                throw e;
            }
            if (scheduleAccepted === false) {
                if (setProcessing) setProcessing(false);
                if (onHumanTurnReady) {
                    onHumanTurnReady({ nextPlayerKey, scheduledCpu: false });
                }
                return {
                    ok: true,
                    gameOver: false,
                    scheduledCpu: false,
                    nextPlayerKey,
                    playbackEvents: combinedPlaybackEvents,
                    turnStartPlaybackEvents
                };
            }
            return {
                ok: true,
                gameOver: false,
                scheduledCpu: true,
                nextPlayerKey,
                playbackEvents: combinedPlaybackEvents,
                turnStartPlaybackEvents
            };
        }

        if (setProcessing) setProcessing(false);
        if (onHumanTurnReady) {
            onHumanTurnReady({ nextPlayerKey, scheduledCpu: false });
        }

        return {
            ok: true,
            gameOver: false,
            scheduledCpu: false,
            nextPlayerKey,
            playbackEvents: combinedPlaybackEvents,
            turnStartPlaybackEvents
        };
    }

const NetworkTurnHandoff = {
    captureNetworkPublishSnapshot,
    publishNetworkSnapshot,
    waitForPlaybackIdleIfNeeded,
    finalizeNetworkTurnHandoff,
    resolvePlayerKeyFromTurnValue
};

export = NetworkTurnHandoff;
