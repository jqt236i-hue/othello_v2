declare const __non_webpack_require__: NodeRequire | undefined;
const _require: NodeRequire = typeof __non_webpack_require__ !== 'undefined' ? __non_webpack_require__ : require;

const http = require('http');
const { URL } = require('url');

const Core = require('../game/logic/core');
const CardLogic = require('../game/logic/cards');
const TurnPipeline = require('../game/turn/turn_pipeline');
const TurnPipelinePhases = require('../game/turn/turn_pipeline_phases');
const TurnPipelineUIAdapter = require('../game/turn/pipeline_ui_adapter');
const SeededPRNG = require('../game/schema/prng');
const deepClone = require('../utils/deepClone');
const MatchAuthority = require('../utils/match-authority');
const NetworkActionSchema = require('../shared/network-action-schema');
const PlaybackEventHelpers = require('../shared/playback-event-helpers');
const DeckCodecModule = require('../shared/deck-codec');
const DeckSpecHelpers = require('../shared/deck-spec');

function readArgValue(name: any) {
    const key = `--${name}`;
    const idx = process.argv.indexOf(key);
    if (idx >= 0 && idx + 1 < process.argv.length) {
        return String(process.argv[idx + 1] || '').trim();
    }
    return '';
}

const argHost = readArgValue('host');
const argPort = readArgValue('port');
const HOST = argHost || process.env.MATCH_HOST || '127.0.0.1';
const parsedArgPort = argPort === '' ? Number.NaN : Number(argPort);
const envPortValue = String(process.env.MATCH_PORT || '').trim();
const parsedEnvPort = envPortValue === '' ? Number.NaN : Number(envPortValue);
const PORT = Number.isFinite(parsedArgPort)
    ? parsedArgPort
    : (Number.isFinite(parsedEnvPort) ? parsedEnvPort : 8787);

const CHAT_MAX_LENGTH = 20;
const CHAT_HISTORY_LIMIT = 40;
const NETWORK_TURN_LIMIT_SECONDS = 120;
const NETWORK_TURN_LIMIT_MS = NETWORK_TURN_LIMIT_SECONDS * 1000;
const SSE_HEARTBEAT_INTERVAL_MS = 10000;
const NETWORK_DEBUG_FILL_HAND_ACTION = MatchAuthority.NETWORK_DEBUG_FILL_HAND_ACTION || 'debug_fill_hand';

const rooms = new Map();
let heartbeatIntervalId: ReturnType<typeof setInterval> | null = null;

function parseSeatKeyOptional(value: any) {
    return MatchAuthority.parseSeatKeyOptional(value);
}

function normalizePlayerKey(value: any) {
    return MatchAuthority.normalizePlayerKey(value, 'black');
}

function getCurrentPlayerKey(gameState: any) {
    return MatchAuthority.getCurrentPlayerKey(gameState);
}

function normalizeOperationId(value: any) {
    return MatchAuthority.normalizeOperationId(value);
}

function normalizeSeatHandSkinId(value: any) {
    return MatchAuthority.normalizeSeatHandSkinId(value);
}

function ensureAcceptedOperationsBySeat(room: any) {
    return MatchAuthority.ensureAcceptedOperationsBySeat(room);
}

function resolveAuthenticatedSeatKey(room: any, seatKeyValue: any, seatTokenValue: any) {
    return MatchAuthority.resolveAuthenticatedSeatKey(room, seatKeyValue, seatTokenValue);
}

function classifySeatTokenRejectionReason(seatTokenValue: any) {
    return MatchAuthority.classifySeatTokenRejectionReason(seatTokenValue);
}

function toPublicSnapshot(room: any, viewerSeatKey: any) {
    return MatchAuthority.buildPublicSnapshot(room, viewerSeatKey || null);
}

function buildNetworkActionEffectLogs(action: any, playerKey: any, rawEvents: any, presentationEvents: any) {
    return MatchAuthority.buildNetworkActionEffectLogs(action, playerKey, CardLogic, rawEvents, presentationEvents, TurnPipelineUIAdapter);
}

function makeRoomId() {
    return MatchAuthority.makeRoomId();
}

function makeSeatToken() {
    return MatchAuthority.makeSeatToken();
}

function normalizeNetworkPlayerName(value: any) {
    return MatchAuthority.normalizeNetworkPlayerName(value);
}

function isNetworkDebugFillHandAction(value: any) {
    return MatchAuthority.isNetworkDebugFillHandAction(value);
}

function isNetworkDebugFillHandPayload(value: any) {
    return MatchAuthority.isNetworkDebugFillHandPayload(value);
}

function resolveNetworkDebugFillHandOptions(value: any) {
    return MatchAuthority.resolveNetworkDebugFillHandOptions(value);
}

function makeInitialSnapshot(seed: any, options: any) {
    const opts = buildInitialDeckSnapshotOptions(options);
    const gameState = Core.createGameState(opts.boardConfig);
    const prng = SeededPRNG.createPRNG(seed);
    const cardState = CardLogic.createCardState(prng, opts);

    const startupEvents: any[] = [];
    TurnPipelinePhases.applyTurnStartPhase(
        CardLogic,
        Core,
        cardState,
        gameState,
        'black',
        startupEvents,
        prng
    );
    persistTurnStartPrngState(cardState, prng);

    return {
        gameState,
        cardState,
        stateVersion: 0,
        updatedAt: Date.now()
    };
}

function resolveDeckSelection(rawDeckCodeValue: any) {
    const rawDeckCode = String(rawDeckCodeValue || '').trim();
    if (!rawDeckCode) {
        return { ok: true, hasCustomDeck: false, deckSpec: null, deckCode: '', deckSize: null };
    }
    try {
        const decoded = DeckCodecModule.decodeDeckCode(rawDeckCode);
        const normalized = DeckSpecHelpers.normalizeDeckSpec(decoded, { requireFullDeck: false });
        const summary = DeckSpecHelpers.summarizeDeckSpec(normalized);
        const canonical = DeckCodecModule.encodeDeckSpec(normalized);
        return {
            ok: true,
            hasCustomDeck: true,
            deckSpec: normalized,
            deckCode: canonical,
            deckSize: Number.isFinite(Number(summary && summary.deckSize)) ? Number(summary.deckSize) : null
        };
    } catch (error: any) {
        return { ok: false, reason: (error && error.code) ? String(error.code) : 'DECK_CODE_INVALID' };
    }
}

function buildInitialDeckSnapshotOptions(room: any) {
    const source: any = (room && typeof room === 'object') ? room : {};
    const options: any = {};
    const byPlayer = source.initialDeckSpecByPlayer;
    if (byPlayer && (byPlayer.black || byPlayer.white)) {
        options.initialDeckSpecByPlayer = deepClone(byPlayer);
    } else if (source.initialDeckSpec && typeof source.initialDeckSpec === 'object') {
        options.initialDeckSpec = deepClone(source.initialDeckSpec);
    }
    const boardConfig = MatchAuthority.resolveRoomBoardConfig(source);
    if (boardConfig) {
        options.boardConfig = boardConfig;
    }
    return options;
}

function assignRoomDeckSelection(room: any, seatKey: any, deckSelection: any) {
    if (!room || !deckSelection || deckSelection.hasCustomDeck !== true) return;
    if (!room.initialDeckSpecByPlayer) {
        room.initialDeckSpecByPlayer = { black: null, white: null };
    }
    room.initialDeckSpecByPlayer[seatKey] = deckSelection.deckSpec ? deepClone(deckSelection.deckSpec) : null;
    if (!room.roomDeck) {
        room.roomDeck = {
            mode: 'perPlayer',
            deckCode: '',
            deckSize: null,
            deckCodeByPlayer: { black: '', white: '' },
            deckSizeByPlayer: { black: null, white: null },
            source: 'room'
        };
    }
    room.roomDeck.deckCodeByPlayer[seatKey] = deckSelection.deckCode || '';
    room.roomDeck.deckSizeByPlayer[seatKey] = deckSelection.deckSize;
}

function mergeWithDefaultShape(defaultValue: any, overrideValue: any) {
    return MatchAuthority.mergeWithDefaultShape(defaultValue, overrideValue);
}

function createTurnStartSeed(room: any, snapshot: any, playerKey: any) {
    return MatchAuthority.createTurnStartSeed(room, snapshot, playerKey);
}

function createTurnStartPrng(room: any, snapshot: any, playerKey: any) {
    const savedState = snapshot && snapshot.cardState && snapshot.cardState.prngState;
    if (
        savedState
        && typeof savedState === 'object'
        && Number.isFinite(Number(savedState.seed))
        && Number.isFinite(Number(savedState.calls))
        && typeof SeededPRNG.fromState === 'function'
    ) {
        try {
            return SeededPRNG.fromState({
                seed: Math.trunc(Number(savedState.seed)),
                calls: Math.max(0, Math.trunc(Number(savedState.calls)))
            });
        } catch (e) {
            // Fall through to derived seed.
        }
    }
    return SeededPRNG.createPRNG(createTurnStartSeed(room, snapshot, playerKey));
}

function normalizeCardStateForTurnStart(room: any, snapshot: any) {
    if (!snapshot || typeof snapshot !== 'object') return null;
    const currentCardState = (snapshot.cardState && typeof snapshot.cardState === 'object')
        ? snapshot.cardState
        : {};
    const currentPlayerKey = getCurrentPlayerKey(snapshot.gameState);
    const baselinePrng = SeededPRNG.createPRNG(createTurnStartSeed(room, snapshot, currentPlayerKey));
    const baselineCardState = CardLogic.createCardState(baselinePrng, buildInitialDeckSnapshotOptions(room));
    snapshot.cardState = mergeWithDefaultShape(baselineCardState, currentCardState);
    if (!Array.isArray(snapshot.cardState.presentationEvents)) {
        snapshot.cardState.presentationEvents = [];
    }
    if (!Array.isArray(snapshot.cardState._presentationEventsPersist)) {
        snapshot.cardState._presentationEventsPersist = [];
    }
    return snapshot.cardState;
}

function persistTurnStartPrngState(cardState: any, prng: any) {
    if (!cardState || !prng || typeof prng.getState !== 'function') return;
    cardState.prngState = prng.getState();
}

function reconcileTurnStartIfNeeded(room: any, snapshot: any, options: any) {
    const opts = (options && typeof options === 'object') ? options : {};
    if (!snapshot || !snapshot.gameState || !snapshot.cardState) return opts.includeRawEvents ? [] : snapshot;

    const currentPlayerKey = getCurrentPlayerKey(snapshot.gameState);
    const lastTurnStartedFor = parseSeatKeyOptional(snapshot.cardState.lastTurnStartedFor);
    if (lastTurnStartedFor === currentPlayerKey) {
        return opts.includeRawEvents ? [] : snapshot;
    }
    if (Core.isGameOver(snapshot.gameState)) {
        return opts.includeRawEvents ? [] : snapshot;
    }

    normalizeCardStateForTurnStart(room, snapshot);
    const prng = createTurnStartPrng(room, snapshot, currentPlayerKey);
    const turnStartEvents: any[] = [];
    TurnPipelinePhases.applyTurnStartPhase(
        CardLogic,
        Core,
        snapshot.cardState,
        snapshot.gameState,
        currentPlayerKey,
        turnStartEvents,
        prng
    );
    persistTurnStartPrngState(snapshot.cardState, prng);
    return opts.includeRawEvents ? turnStartEvents : snapshot;
}

function collectServerPlaybackEvents(snapshot: any, rawEvents: any) {
    const playerKey = getCurrentPlayerKey(snapshot && snapshot.gameState);
    const assembly = PlaybackEventHelpers.collectServerPlaybackEvents({
        rawEvents,
        snapshot,
        playerKey,
        fallbackPlayerKey: playerKey,
        adapter: TurnPipelineUIAdapter,
        normalizePlayerKey
    });
    return Object.assign({}, assembly || {}, {
        playbackEvents: Array.isArray(assembly && assembly.playbackEvents) ? assembly.playbackEvents : [],
        diagnostics: assembly ? assembly.diagnostics || null : null,
        presentationEvents: Array.isArray(assembly && assembly.presentationEvents) ? assembly.presentationEvents : [],
        playerKey
    });
}

function buildPublishPayload(room: any, viewerSeatKey: any, options: any = {}) {
    const serverTime = Number.isFinite(Number(options.serverTime)) ? Number(options.serverTime) : Date.now();
    const networkDebugEnabled = toPublicNetworkDebugEnabled(room);
    const snapshot = Object.prototype.hasOwnProperty.call(options, 'snapshot')
        ? options.snapshot
        : toPublicSnapshot(room, viewerSeatKey);
    const publishMetaKind = options
        && options.publishMeta
        && typeof options.publishMeta === 'object'
        ? String(options.publishMeta.kind || '').trim().toLowerCase()
        : '';
    const shouldRestoreChargeDelta = publishMetaKind !== 'accepted';
    if (shouldRestoreChargeDelta && options.previousSnapshotForChargeDelta) {
        MatchAuthority.restoreMissingChargeDeltaEvents(options.previousSnapshotForChargeDelta, snapshot);
    }
    const payloadOptions: any = {
        ok: options.ok === true,
        snapshot,
        roomDeck: toPublicRoomDeck(room),
        roomBoardConfig: toPublicRoomBoardConfig(room),
        networkDebugEnabled,
        turnTimer: toPublicTurnTimer(room, serverTime),
        playbackEvents: Array.isArray(options.playbackEvents) ? options.playbackEvents : [],
        effectLogs: MatchAuthority.normalizeEffectLogMessages(options.effectLogs),
        serverTime,
        idempotentReplay: options.idempotentReplay === true,
        publishMeta: options.publishMeta || null
    };
    if (Object.prototype.hasOwnProperty.call(options, 'rejectedReason')) {
        payloadOptions.rejectedReason = options.rejectedReason || null;
    }
    if (Object.prototype.hasOwnProperty.call(options, 'errorMessage')) {
        payloadOptions.errorMessage = options.errorMessage || null;
    }
    if (Object.prototype.hasOwnProperty.call(options, 'playbackDiagnostics')) {
        payloadOptions.playbackDiagnostics = MatchAuthority.toDebugPlaybackDiagnostics(options.playbackDiagnostics, networkDebugEnabled);
    }
    return MatchAuthority.buildPublishPayloadFromRoom(room, payloadOptions);
}

function captureTurnStartHandState(snapshot: any) {
    const playerKey = getCurrentPlayerKey(snapshot && snapshot.gameState);
    const hands = (snapshot && snapshot.cardState && snapshot.cardState.hands && typeof snapshot.cardState.hands === 'object')
        ? snapshot.cardState.hands
        : {};
    return {
        playerKey,
        hand: playerKey && Array.isArray(hands[playerKey]) ? hands[playerKey].slice() : []
    };
}

function appendTurnStartDrawPlaybackEvents(playbackAssembly: any, snapshot: any, handState: any) {
    return PlaybackEventHelpers.appendTurnStartDrawPlaybackEvents({
        playbackAssembly,
        snapshot,
        handState,
        adapter: TurnPipelineUIAdapter,
        normalizePlayerKey
    });
}

function reconcileTurnStartAndCollectPlayback(room: any, snapshot: any) {
    const handState = captureTurnStartHandState(snapshot);
    MatchAuthority.stripTransientPresentationState(snapshot);
    const rawEvents = reconcileTurnStartIfNeeded(room, snapshot, { includeRawEvents: true });
    const playbackAssembly = collectServerPlaybackEvents(snapshot, rawEvents);
    const effectLogs = MatchAuthority.collectPipelineEffectLogMessages(
        rawEvents,
        playbackAssembly && Array.isArray(playbackAssembly.presentationEvents) ? playbackAssembly.presentationEvents : [],
        playbackAssembly && playbackAssembly.playerKey ? playbackAssembly.playerKey : getCurrentPlayerKey(snapshot && snapshot.gameState),
        TurnPipelineUIAdapter
    );
    return appendTurnStartDrawPlaybackEvents(
        Object.assign({}, playbackAssembly, { effectLogs }),
        snapshot,
        handState
    );
}

function createCommandActionPrng(room: any, snapshot: any) {
    const savedState = snapshot && snapshot.cardState && snapshot.cardState.prngState;
    if (
        savedState
        && typeof savedState === 'object'
        && Number.isFinite(Number(savedState.seed))
        && Number.isFinite(Number(savedState.calls))
        && typeof SeededPRNG.fromState === 'function'
    ) {
        try {
            return SeededPRNG.fromState({
                seed: Math.trunc(Number(savedState.seed)),
                calls: Math.max(0, Math.trunc(Number(savedState.calls)))
            });
        } catch (e) {
            // Fall through to derived seed.
        }
    }
    return SeededPRNG.createPRNG(createTurnStartSeed(room, snapshot, getCurrentPlayerKey(snapshot && snapshot.gameState)));
}

function applyCommandPublishToSnapshot(room: any, body: any, playerKey: any) {
    if (!NetworkActionSchema || typeof NetworkActionSchema.buildAction !== 'function') {
        return { ok: false, rejectedReason: 'COMMAND_SCHEMA_UNAVAILABLE' };
    }
    if (!TurnPipeline || typeof TurnPipeline.applyTurnSafe !== 'function') {
        return { ok: false, rejectedReason: 'COMMAND_PIPELINE_UNAVAILABLE' };
    }

    const currentSnapshot = (room && room.snapshot && room.snapshot.gameState && room.snapshot.cardState)
        ? deepClone(room.snapshot)
        : null;
    if (!currentSnapshot) {
        return { ok: false, rejectedReason: 'INVALID_SNAPSHOT' };
    }
    MatchAuthority.stripTransientChargeDeltaState(currentSnapshot);

    const currentTurnIndex = Number.isFinite(Number(currentSnapshot.cardState && currentSnapshot.cardState.turnIndex))
        ? Number(currentSnapshot.cardState.turnIndex)
        : 0;
    if (isNetworkDebugFillHandPayload(body)) {
        if (!toPublicNetworkDebugEnabled(room)) {
            return { ok: false, rejectedReason: 'NETWORK_DEBUG_DISABLED' };
        }
        const DebugActions = require('../game/debug/debug-actions');
        if (!DebugActions || typeof DebugActions.fillDebugHand !== 'function') {
            return { ok: false, rejectedReason: 'DEBUG_ACTIONS_UNAVAILABLE' };
        }

        const applied = DebugActions.fillDebugHand(
            currentSnapshot.cardState,
            Object.assign({ playerKey }, resolveNetworkDebugFillHandOptions(body))
        );
        if (!applied) {
            return { ok: false, rejectedReason: 'DEBUG_FILL_HAND_FAILED' };
        }

        MatchAuthority.stripTransientPresentationState(currentSnapshot);
        return {
            ok: true,
            snapshot: currentSnapshot,
            playbackEvents: [],
            playbackDiagnostics: null,
            effectLogs: []
        };
    }

    const builtAction = NetworkActionSchema.buildAction({
        actionType: body.actionType,
        actor: body.actor,
        params: body.params,
        actionId: body.actionId,
        turnIndex: body.turnIndex,
        action: body.action
    }, playerKey, currentTurnIndex);

    if (!builtAction || !builtAction.action) {
        return { ok: false, rejectedReason: 'COMMAND_REQUIRED' };
    }
    if (normalizePlayerKey(builtAction.actor) !== playerKey) {
        return { ok: false, rejectedReason: 'SEAT_MISMATCH' };
    }
    const pendingValidation = MatchAuthority.validatePendingSelectionPublish(currentSnapshot, playerKey, builtAction.action);
    if (!pendingValidation || pendingValidation.ok !== true) {
        return { ok: false, rejectedReason: pendingValidation && pendingValidation.rejectedReason ? pendingValidation.rejectedReason : 'STALE_PENDING_SELECTION' };
    }
    const resolvedAction = MatchAuthority.sanitizePendingSelectionActionForAuthority(currentSnapshot, playerKey, builtAction.action);

    const prng = createCommandActionPrng(room, currentSnapshot);
    const result = TurnPipeline.applyTurnSafe(
        currentSnapshot.cardState,
        currentSnapshot.gameState,
        playerKey,
        resolvedAction,
        prng,
        {
            currentStateVersion: currentTurnIndex,
            prngState: currentSnapshot.cardState && currentSnapshot.cardState.prngState
        }
    );

    if (!result || result.ok !== true) {
        return {
            ok: false,
            rejectedReason: (result && result.rejectedReason) || 'COMMAND_REJECTED',
            errorMessage: result && result.errorMessage ? String(result.errorMessage) : null
        };
    }

    const nextSnapshot = {
        gameState: result.gameState,
        cardState: result.cardState
    };
    MatchAuthority.restoreMissingChargeDeltaEvents(currentSnapshot, nextSnapshot);
    const actionChargeDeltaEvents = Array.isArray(nextSnapshot && nextSnapshot.cardState && nextSnapshot.cardState.chargeDeltaEvents)
        ? deepClone(nextSnapshot.cardState.chargeDeltaEvents)
        : [];
    const playbackAssembly = PlaybackEventHelpers.collectActionPlaybackEvents({
        result,
        rawEvents: result.events,
        snapshot: nextSnapshot,
        playerKey,
        fallbackPlayerKey: playerKey,
        adapter: TurnPipelineUIAdapter,
        normalizePlayerKey
    });
    MatchAuthority.reportPlaybackAssemblyDiagnostics('local-server-action', playbackAssembly && playbackAssembly.diagnostics, {
        networkDebugEnabled: toPublicNetworkDebugEnabled(room)
    });
    const playbackEvents = (playbackAssembly && Array.isArray(playbackAssembly.playbackEvents))
        ? playbackAssembly.playbackEvents
        : [];
    const actionPresentationEvents = (playbackAssembly && Array.isArray(playbackAssembly.presentationEvents))
        ? playbackAssembly.presentationEvents
        : [];
    const actionEffectLogs = buildNetworkActionEffectLogs(
        resolvedAction,
        playerKey,
        result.events,
        actionPresentationEvents
    );

    const turnStartPlaybackAssembly = reconcileTurnStartAndCollectPlayback(room, nextSnapshot);
    if (
        actionChargeDeltaEvents.length > 0
        && nextSnapshot
        && nextSnapshot.cardState
        && (!Array.isArray(nextSnapshot.cardState.chargeDeltaEvents) || nextSnapshot.cardState.chargeDeltaEvents.length === 0)
    ) {
        nextSnapshot.cardState.chargeDeltaEvents = deepClone(actionChargeDeltaEvents);
    }
    MatchAuthority.reportPlaybackAssemblyDiagnostics('local-server-turn-start', turnStartPlaybackAssembly && turnStartPlaybackAssembly.diagnostics, {
        networkDebugEnabled: toPublicNetworkDebugEnabled(room)
    });
    const turnStartPlaybackEvents = (turnStartPlaybackAssembly && Array.isArray(turnStartPlaybackAssembly.playbackEvents))
        ? turnStartPlaybackAssembly.playbackEvents
        : [];
    const turnStartEffectLogs = (turnStartPlaybackAssembly && Array.isArray(turnStartPlaybackAssembly.effectLogs))
        ? turnStartPlaybackAssembly.effectLogs
        : [];
    const combinedPlaybackEvents = PlaybackEventHelpers.appendPlaybackEventsAfter(playbackEvents, turnStartPlaybackEvents);
    const combinedEffectLogs = MatchAuthority.appendEffectLogMessages(actionEffectLogs, turnStartEffectLogs);
    MatchAuthority.stripTransientPresentationState(nextSnapshot);

    return {
        ok: true,
        snapshot: nextSnapshot,
        playbackEvents: combinedPlaybackEvents,
        playbackDiagnostics: MatchAuthority.toDebugPlaybackDiagnostics(playbackAssembly && playbackAssembly.diagnostics, toPublicNetworkDebugEnabled(room)),
        effectLogs: combinedEffectLogs,
        action: resolvedAction,
        pendingEffectId: pendingValidation && pendingValidation.pendingEffectId ? pendingValidation.pendingEffectId : null
    };
}

function hasTwoActiveSeats(room: any) {
    return !!(room && room.seats && room.seats.black && room.seats.white);
}

function resolveTurnSeatKey(room: any) {
    return getCurrentPlayerKey(room && room.snapshot && room.snapshot.gameState);
}

function createPausedTurnTimer(room: any) {
    return {
        limitSeconds: NETWORK_TURN_LIMIT_SECONDS,
        active: false,
        turnSeatKey: resolveTurnSeatKey(room),
        turnStartedAt: null,
        turnDeadlineAt: null
    };
}

function createActiveTurnTimer(room: any, nowMs: any) {
    const now = Number.isFinite(Number(nowMs)) ? Math.max(0, Math.trunc(Number(nowMs))) : Date.now();
    return {
        limitSeconds: NETWORK_TURN_LIMIT_SECONDS,
        active: true,
        turnSeatKey: resolveTurnSeatKey(room),
        turnStartedAt: now,
        turnDeadlineAt: now + NETWORK_TURN_LIMIT_MS
    };
}

function areTurnTimersEqual(a: any, b: any) {
    const left = (a && typeof a === 'object') ? a : {};
    const right = (b && typeof b === 'object') ? b : {};
    const leftSeat = parseSeatKeyOptional(left.turnSeatKey) || 'black';
    const rightSeat = parseSeatKeyOptional(right.turnSeatKey) || 'black';
    const leftStarted = Number.isFinite(Number(left.turnStartedAt)) ? Number(left.turnStartedAt) : null;
    const rightStarted = Number.isFinite(Number(right.turnStartedAt)) ? Number(right.turnStartedAt) : null;
    const leftDeadline = Number.isFinite(Number(left.turnDeadlineAt)) ? Number(left.turnDeadlineAt) : null;
    const rightDeadline = Number.isFinite(Number(right.turnDeadlineAt)) ? Number(right.turnDeadlineAt) : null;

    return (
        !!left.active === !!right.active
        && leftSeat === rightSeat
        && leftStarted === rightStarted
        && leftDeadline === rightDeadline
        && Number(left.limitSeconds) === Number(right.limitSeconds)
    );
}

function refreshTurnTimer(room: any, options: any) {
    const opts = (options && typeof options === 'object') ? options : {};
    const nowMs = Number.isFinite(Number(opts.nowMs)) ? Math.max(0, Math.trunc(Number(opts.nowMs))) : Date.now();
    const shouldRunBySeats = hasTwoActiveSeats(room);
    const isGameOver = shouldRunBySeats && Core.isGameOver(room && room.snapshot && room.snapshot.gameState);
    const shouldBeActive = shouldRunBySeats && !isGameOver;

    if (!shouldBeActive) {
        const pausedTimer = createPausedTurnTimer(room);
        const changed = !areTurnTimersEqual(room.turnTimer, pausedTimer);
        room.turnTimer = pausedTimer;
        return changed;
    }

    const timer = (room.turnTimer && typeof room.turnTimer === 'object') ? room.turnTimer : null;
    if (!opts.forceRestart && timer && timer.active === true) {
        const timerSeatKey = parseSeatKeyOptional(timer.turnSeatKey);
        const timerDeadline = Number(timer.turnDeadlineAt);
        if (timerSeatKey === resolveTurnSeatKey(room) && Number.isFinite(timerDeadline)) {
            timer.limitSeconds = NETWORK_TURN_LIMIT_SECONDS;
            return false;
        }
    }

    const activeTimer = createActiveTurnTimer(room, nowMs);
    const changed = !areTurnTimersEqual(room.turnTimer, activeTimer);
    room.turnTimer = activeTimer;
    return changed;
}

function toPublicTurnTimer(room: any, nowMs: any) {
    const timer = (room && room.turnTimer && typeof room.turnTimer === 'object') ? room.turnTimer : null;
    const serverNow = Number.isFinite(Number(nowMs)) ? Number(nowMs) : Date.now();
    const deadline = timer && Number.isFinite(Number(timer.turnDeadlineAt)) ? Number(timer.turnDeadlineAt) : null;
    const startedAt = timer && Number.isFinite(Number(timer.turnStartedAt)) ? Number(timer.turnStartedAt) : null;
    const active = !!(timer && timer.active === true && deadline !== null);

    return {
        limitSeconds: NETWORK_TURN_LIMIT_SECONDS,
        active,
        turnSeatKey: parseSeatKeyOptional(timer && timer.turnSeatKey) || resolveTurnSeatKey(room),
        turnStartedAt: active ? startedAt : null,
        turnDeadlineAt: active ? deadline : null,
        remainingMs: active && deadline !== null ? Math.max(0, Math.trunc(deadline - serverNow)) : null
    };
}

function buildPublicSeatState(room: any) {
    return MatchAuthority.buildPublicSeatMetadata(room);
}

function withPublicSeatState(room: any, payload: any) {
    return Object.assign(payload, buildPublicSeatState(room));
}

function toPublicSeats(room: any) {
    return buildPublicSeatState(room).seats;
}

function toPublicSeatHandSkins(room: any) {
    return buildPublicSeatState(room).seatHandSkins;
}

function normalizeDeckSizeValue(value: any) {
    if (value === null || typeof value === 'undefined' || value === '') return null;
    return Number.isFinite(Number(value))
        ? Math.max(0, Math.trunc(Number(value)))
        : null;
}

function toPublicRoomDeck(room: any) {
    const metadata = (room && room.roomDeck && typeof room.roomDeck === 'object')
        ? deepClone(room.roomDeck)
        : null;
    const snapshotDeckSizes = {
        black: normalizeDeckSizeValue(
            room
            && room.snapshot
            && room.snapshot.cardState
            && room.snapshot.cardState.initialDeckSizeByPlayer
            && room.snapshot.cardState.initialDeckSizeByPlayer.black
        ),
        white: normalizeDeckSizeValue(
            room
            && room.snapshot
            && room.snapshot.cardState
            && room.snapshot.cardState.initialDeckSizeByPlayer
            && room.snapshot.cardState.initialDeckSizeByPlayer.white
        )
    };
    const snapshotDeckSize = snapshotDeckSizes.black !== null
        ? snapshotDeckSizes.black
        : normalizeDeckSizeValue(room && room.snapshot && room.snapshot.cardState && room.snapshot.cardState.initialDeckSize);

    if (metadata && metadata.mode === 'perPlayer') {
        const deckCodeByPlayerSource = (metadata.deckCodeByPlayer && typeof metadata.deckCodeByPlayer === 'object')
            ? metadata.deckCodeByPlayer
            : {};
        const deckSizeByPlayerSource = (metadata.deckSizeByPlayer && typeof metadata.deckSizeByPlayer === 'object')
            ? metadata.deckSizeByPlayer
            : {};
        const deckCodeByPlayer = {
            black: String(deckCodeByPlayerSource.black || '').trim(),
            white: String(deckCodeByPlayerSource.white || '').trim()
        };
        const deckSizeByPlayer = {
            black: normalizeDeckSizeValue(deckSizeByPlayerSource.black) !== null
                ? normalizeDeckSizeValue(deckSizeByPlayerSource.black)
                : snapshotDeckSizes.black,
            white: normalizeDeckSizeValue(deckSizeByPlayerSource.white) !== null
                ? normalizeDeckSizeValue(deckSizeByPlayerSource.white)
                : snapshotDeckSizes.white
        };
        const sharedDeckCode = deckCodeByPlayer.black && deckCodeByPlayer.black === deckCodeByPlayer.white
            ? deckCodeByPlayer.black
            : '';
        const sharedDeckSize = sharedDeckCode && deckSizeByPlayer.black === deckSizeByPlayer.white
            ? deckSizeByPlayer.black
            : null;

        return {
            mode: 'perPlayer',
            deckCode: sharedDeckCode,
            deckSize: sharedDeckSize,
            deckCodeByPlayer,
            deckSizeByPlayer,
            source: metadata.source ? String(metadata.source) : 'room'
        };
    }

    if (!metadata && snapshotDeckSize === null) return null;

    return {
        mode: metadata && metadata.mode ? String(metadata.mode) : 'shared',
        deckCode: metadata && metadata.deckCode ? String(metadata.deckCode).trim() : '',
        deckSize: metadata && normalizeDeckSizeValue(metadata.deckSize) !== null
            ? normalizeDeckSizeValue(metadata.deckSize)
            : snapshotDeckSize,
        source: metadata && metadata.source ? String(metadata.source) : 'room'
    };
}

function toPublicRoomBoardConfig(room: any) {
    return MatchAuthority.resolveRoomBoardConfig(room);
}

function toPublicNetworkDebugEnabled(room: any) {
    return !!(room && room.networkDebugEnabled === true);
}

function toPublicChatMessages(room: any) {
    const messages = Array.isArray(room && room.chatMessages) ? room.chatMessages : [];
    return messages.map((entry: any) => ({
        id: Number.isFinite(Number(entry && entry.id)) ? Number(entry.id) : 0,
        seatKey: normalizePlayerKey(entry && entry.seatKey),
        text: String(entry && entry.text ? entry.text : ''),
        serverTime: Number.isFinite(Number(entry && entry.serverTime)) ? Number(entry.serverTime) : Date.now()
    }));
}

function parseChatMessageText(value: any) {
    const normalized = String(value || '').replace(/[\r\n]+/g, ' ').trim();
    if (!normalized) {
        return { ok: false, reason: 'MESSAGE_REQUIRED' };
    }
    const chars = Array.from(normalized);
    if (chars.length > CHAT_MAX_LENGTH) {
        return { ok: false, reason: 'MESSAGE_TOO_LONG' };
    }
    return { ok: true, text: chars.join('') };
}

function writeJson(res: any, statusCode: any, payload: any) {
    const body = JSON.stringify(payload || {});
    res.writeHead(statusCode, {
        'Content-Type': 'application/json; charset=utf-8',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type'
    });
    res.end(body);
}

function sseChunk(eventName: any, payload: any, eventId: any) {
    const data = JSON.stringify(payload || {});
    const hasEventId = !(eventId === null || typeof eventId === 'undefined' || String(eventId) === '');
    const idLine = hasEventId ? `id: ${String(eventId)}\n` : '';
    const eventLine = eventName ? `event: ${eventName}\n` : '';
    return `${idLine}${eventLine}data: ${data}\n\n`;
}

function writeSse(res: any, eventName: any, payload: any, eventId: any) {
    res.write(sseChunk(eventName, payload, eventId));
}

function parseBody(req: any): Promise<any> {
    return new Promise<any>((resolve: any, reject: any) => {
        let raw = '';
        req.on('data', (chunk: any) => {
            raw += chunk;
            if (raw.length > 5 * 1024 * 1024) {
                reject(new Error('payload_too_large'));
            }
        });
        req.on('end', () => {
            if (!raw) {
                resolve({});
                return;
            }
            try {
                resolve(JSON.parse(raw));
            } catch (e) {
                reject(new Error('invalid_json'));
            }
        });
        req.on('error', reject);
    });
}

function nextSseEventId(room: any) {
    const prevSeq = Number.isFinite(Number(room && room.eventSeq))
        ? Math.max(0, Math.trunc(Number(room.eventSeq)))
        : 0;
    const nextSeq = prevSeq + 1;
    if (room) room.eventSeq = nextSeq;
    const roomId = room && room.roomId ? String(room.roomId) : 'room';
    const stateVersion = Number.isFinite(Number(room && room.stateVersion))
        ? Math.max(0, Math.trunc(Number(room.stateVersion)))
        : 0;
    return `${roomId}_${stateVersion}_${nextSeq}`;
}

function buildHeartbeatPayload(room: any, serverTime: any) {
    return MatchAuthority.buildHeartbeatPayloadFromRoom(room, {
        roomDeck: toPublicRoomDeck(room),
        roomBoardConfig: toPublicRoomBoardConfig(room),
        networkDebugEnabled: toPublicNetworkDebugEnabled(room),
        turnTimer: toPublicTurnTimer(room, serverTime),
        serverTime
    });
}

function rememberBufferedRoomEvent(room: any, record: any) {
    if (!room) return;
    room.sseEventBuffer = MatchAuthority.appendBufferedSseEvent(room.sseEventBuffer, record);
}

function buildBufferedSnapshotRecord(room: any, meta: any, eventId: any) {
    const payloadByViewer = {
        black: buildSnapshotPayload(room, meta, 'black'),
        white: buildSnapshotPayload(room, meta, 'white')
    };
    return {
        record: {
            eventId,
            eventName: 'snapshot',
            payloadByViewer
        },
        payloadByViewer
    };
}

function prepareSnapshotBroadcast(room: any, meta: any) {
    const eventId = nextSseEventId(room);
    const { record, payloadByViewer } = buildBufferedSnapshotRecord(room, meta, eventId);
    return {
        eventId,
        record,
        payloadByViewer,
        fallbackPayload: buildSnapshotPayload(room, meta, null)
    };
}

function broadcastPreparedSnapshot(room: any, preparedSnapshot: any) {
    if (!room || !preparedSnapshot) return;
    rememberBufferedRoomEvent(room, preparedSnapshot.record);
    if (!room.streams || room.streams.size === 0) return;
    for (const [streamId, streamInfo] of room.streams.entries()) {
        const viewerSeatKey = streamInfo && streamInfo.seatKey ? streamInfo.seatKey : null;
        const payload = (viewerSeatKey && preparedSnapshot.payloadByViewer[viewerSeatKey])
            ? preparedSnapshot.payloadByViewer[viewerSeatKey]
            : preparedSnapshot.fallbackPayload;
        safeWriteToStream(room, streamId, 'snapshot', payload, preparedSnapshot.eventId);
    }
}

function roomHasStreams() {
    for (const room of rooms.values()) {
        if (room && room.streams && room.streams.size > 0) return true;
    }
    return false;
}

function stopHeartbeatLoopIfIdle() {
    if (roomHasStreams()) return;
    if (!heartbeatIntervalId) return;
    clearInterval(heartbeatIntervalId);
    heartbeatIntervalId = null;
}

function removeStream(room: any, streamId: any) {
    if (!room || !room.streams) return;
    room.streams.delete(streamId);
    if (!room.seats.black && !room.seats.white && room.streams.size === 0) {
        rooms.delete(room.roomId);
    }
    stopHeartbeatLoopIfIdle();
}

function safeWriteToStream(room: any, streamId: any, eventName: any, payload: any, eventId: any) {
    const streamInfo = room && room.streams ? room.streams.get(streamId) : null;
    if (!streamInfo || !streamInfo.res || streamInfo.res.writableEnded || streamInfo.res.destroyed) {
        removeStream(room, streamId);
        return;
    }
    try {
        writeSse(streamInfo.res, eventName, payload, eventId);
    } catch (e) {
        try { streamInfo.res.end(); } catch (endError) { /* ignore */ }
        removeStream(room, streamId);
    }
}

function ensureHeartbeatLoop() {
    if (heartbeatIntervalId) return;
    heartbeatIntervalId = setInterval(() => {
        for (const room of rooms.values()) {
            if (!room || !room.streams || room.streams.size === 0) continue;
            const serverTime = Date.now();
            const payload = buildHeartbeatPayload(room, serverTime);
            const eventId = nextSseEventId(room);
            rememberBufferedRoomEvent(room, {
                eventId,
                eventName: 'heartbeat',
                payload
            });
            for (const streamId of Array.from(room.streams.keys())) {
                safeWriteToStream(room, streamId, 'heartbeat', payload, eventId);
            }
        }
        stopHeartbeatLoopIfIdle();
    }, SSE_HEARTBEAT_INTERVAL_MS);
    if (heartbeatIntervalId && typeof heartbeatIntervalId.unref === 'function') {
        heartbeatIntervalId.unref();
    }
}

function buildSnapshotPayload(room: any, meta: any, viewerSeatKey: any) {
    const serverTime = Date.now();
    return MatchAuthority.buildSnapshotPayloadFromRoom(room, {
        snapshot: toPublicSnapshot(room, viewerSeatKey),
        roomDeck: toPublicRoomDeck(room),
        roomBoardConfig: toPublicRoomBoardConfig(room),
        networkDebugEnabled: toPublicNetworkDebugEnabled(room),
        turnTimer: toPublicTurnTimer(room, serverTime),
        playbackEvents: Array.isArray(meta && meta.playbackEvents) ? meta.playbackEvents : [],
        effectLogs: MatchAuthority.normalizeEffectLogMessages(meta && meta.effectLogs),
        playbackDiagnostics: MatchAuthority.toDebugPlaybackDiagnostics(meta && meta.playbackDiagnostics, toPublicNetworkDebugEnabled(room)),
        operationId: meta && meta.operationId ? String(meta.operationId) : null,
        playerKey: meta && meta.playerKey ? normalizePlayerKey(meta.playerKey) : null,
        actionType: meta && meta.actionType ? String(meta.actionType) : null,
        serverTime
    });
}

function buildPresencePayload(room: any, meta: any) {
    const serverTime = Date.now();
    const seatKey = meta && meta.seatKey ? normalizePlayerKey(meta.seatKey) : 'black';
    const publicSeatState = buildPublicSeatState(room);
    return MatchAuthority.buildPresencePayloadFromRoom(room, {
        type: meta && meta.type ? String(meta.type) : 'join',
        seatKey,
        playerName: normalizeNetworkPlayerName(publicSeatState.seatNames[seatKey]),
        rejoined: !!(meta && meta.rejoined),
        roomDeck: toPublicRoomDeck(room),
        roomBoardConfig: toPublicRoomBoardConfig(room),
        networkDebugEnabled: toPublicNetworkDebugEnabled(room),
        turnTimer: toPublicTurnTimer(room, serverTime),
        serverTime
    });
}

function broadcastSnapshot(room: any, meta: any) {
    if (!room) return;
    broadcastPreparedSnapshot(room, prepareSnapshotBroadcast(room, meta));
}

function broadcastPresence(room: any, meta: any) {
    if (!room) return;
    const payload = buildPresencePayload(room, meta || {});
    const eventId = nextSseEventId(room);
    rememberBufferedRoomEvent(room, {
        eventId,
        eventName: 'presence',
        payload
    });
    if (!room.streams || room.streams.size === 0) return;
    for (const streamId of Array.from(room.streams.keys())) {
        safeWriteToStream(room, streamId, 'presence', payload, eventId);
    }
}

function closeSeatStreams(room: any, seatKey: any) {
    if (!room || !room.streams || !seatKey) return;
    for (const [streamId, streamInfo] of Array.from(room.streams.entries()) as any[]) {
        if (!streamInfo || streamInfo.seatKey !== seatKey) continue;
        room.streams.delete(streamId);
        try { streamInfo.res.end(); } catch (e) { /* ignore */ }
    }
    stopHeartbeatLoopIfIdle();
}

function broadcastChat(room: any, payload: any) {
    if (!room) return;
    const eventId = nextSseEventId(room);
    rememberBufferedRoomEvent(room, {
        eventId,
        eventName: 'chat',
        payload
    });
    if (!room.streams || room.streams.size === 0) return;
    for (const streamId of Array.from(room.streams.keys())) {
        safeWriteToStream(room, streamId, 'chat', payload, eventId);
    }
}

function resolveSeatForJoin(room: any, requestedSeatKey: any, providedToken: any) {
    return MatchAuthority.resolveSeatForJoin(room, requestedSeatKey, providedToken);
}

function makeRoom(options: any) {
    const opts = (options && typeof options === 'object') ? options : {};
    let roomId = makeRoomId();
    while (rooms.has(roomId)) {
        roomId = makeRoomId();
    }

    const seed = Date.now();
    const initialSnapshotOptions: any = buildInitialDeckSnapshotOptions(opts);
    const snapshot = makeInitialSnapshot(seed, initialSnapshotOptions);
    const room = {
        roomId,
        seed,
        snapshot,
        authoritativeStateHash: MatchAuthority.computeAuthoritativeStateHash(snapshot),
        stateVersion: 0,
        seats: { black: false, white: false },
        seatNames: { black: '', white: '' },
        seatHandSkins: { black: '', white: '' },
        seatTokens: { black: makeSeatToken(), white: makeSeatToken() },
        roomDeck: null,
        roomBoardConfig: initialSnapshotOptions.boardConfig || MatchAuthority.normalizeRoomBoardConfig(null),
        networkDebugEnabled: opts.networkDebugEnabled === true,
        turnTimer: createPausedTurnTimer({ snapshot }),
        lastAcceptedOperationBySeat: { black: null, white: null },
        eventSeq: 0,
        sseEventBuffer: [],
        authorityLog: [],
        chatMessages: [],
        chatSeq: 0,
        streams: new Map(),
        updatedAt: Date.now()
    };
    rooms.set(roomId, room);
    return room;
}

function applyExpiredTurnTimeoutIfNeeded(room: any) {
    if (!room) return { applied: false };

    const nowMs = Date.now();
    refreshTurnTimer(room, { nowMs, forceRestart: false });

    const timer = (room.turnTimer && typeof room.turnTimer === 'object') ? room.turnTimer : null;
    if (!timer || timer.active !== true) return { applied: false };

    const deadline = Number(timer.turnDeadlineAt);
    if (!Number.isFinite(deadline) || deadline > nowMs) return { applied: false };

    const snapshot = room.snapshot && typeof room.snapshot === 'object' ? room.snapshot : null;
    if (!snapshot || !snapshot.gameState || !snapshot.cardState) return { applied: false };

    const timedOutSeatKey = parseSeatKeyOptional(timer.turnSeatKey) || resolveTurnSeatKey(room);
    const currentTurnSeatKey = resolveTurnSeatKey(room);
    if (timedOutSeatKey !== currentTurnSeatKey) {
        refreshTurnTimer(room, { nowMs, forceRestart: true });
        return { applied: false };
    }

    const nextSnapshot = deepClone(snapshot);
    nextSnapshot.gameState = Core.applyPass(nextSnapshot.gameState);
    MatchAuthority.stripTransientPresentationState(nextSnapshot);
    if (
        nextSnapshot.cardState
        && parseSeatKeyOptional(nextSnapshot.cardState.selectedCardOwnerKey) === timedOutSeatKey
    ) {
        nextSnapshot.cardState.selectedCardId = null;
        nextSnapshot.cardState.selectedCardOwnerKey = null;
    }
    if (nextSnapshot.cardState && nextSnapshot.cardState.pendingEffectByPlayer && typeof nextSnapshot.cardState.pendingEffectByPlayer === 'object') {
        nextSnapshot.cardState.pendingEffectByPlayer[timedOutSeatKey] = null;
    }
    const serverPlaybackAssembly = reconcileTurnStartAndCollectPlayback(room, nextSnapshot);
    MatchAuthority.reportPlaybackAssemblyDiagnostics('local-server-timeout-pass', serverPlaybackAssembly && serverPlaybackAssembly.diagnostics, {
        networkDebugEnabled: toPublicNetworkDebugEnabled(room)
    });
    const serverPlaybackEvents = (serverPlaybackAssembly && Array.isArray(serverPlaybackAssembly.playbackEvents))
        ? serverPlaybackAssembly.playbackEvents
        : [];
    const serverEffectLogs = (serverPlaybackAssembly && Array.isArray(serverPlaybackAssembly.effectLogs))
        ? serverPlaybackAssembly.effectLogs
        : [];

    room.stateVersion = Number.isFinite(Number(room.stateVersion))
        ? Math.max(0, Math.trunc(Number(room.stateVersion))) + 1
        : 1;
    nextSnapshot.stateVersion = room.stateVersion;
    nextSnapshot.updatedAt = nowMs;
    room.snapshot = nextSnapshot;
    room.updatedAt = nowMs;
    room.authoritativeStateHash = MatchAuthority.computeAuthoritativeStateHash(nextSnapshot);
    MatchAuthority.appendAuthorityLog(room, {
        kind: 'timeout_applied',
        actionType: 'timeout_pass',
        committedVersion: room.stateVersion,
        stateHashAfter: room.authoritativeStateHash,
        timeoutReason: 'turn_deadline_expired'
    });
    refreshTurnTimer(room, { nowMs, forceRestart: true });
    broadcastSnapshot(room, {
        playerKey: timedOutSeatKey,
        actionType: 'timeout_pass',
        playbackEvents: serverPlaybackEvents,
        effectLogs: serverEffectLogs,
        playbackDiagnostics: MatchAuthority.toDebugPlaybackDiagnostics(serverPlaybackAssembly && serverPlaybackAssembly.diagnostics, toPublicNetworkDebugEnabled(room)),
        operationId: `timeout_${room.stateVersion}_${nowMs}`
    });
    return { applied: true, stateVersion: room.stateVersion };
}

async function handleCreate(req: any, res: any) {
    const body = await parseBody(req);
    const playerName = normalizeNetworkPlayerName(body.playerName);
    const selectedHandSkinId = normalizeSeatHandSkinId(body.selectedHandSkinId);
    const networkDebugEnabled = body.networkDebugEnabled === true;
    const roomBoardConfig = MatchAuthority.normalizeRoomBoardConfig(body.roomBoardConfig);
    if (!playerName) {
        writeJson(res, 400, { ok: false, reason: 'PLAYER_NAME_REQUIRED' });
        return;
    }

    const deckSelection = resolveDeckSelection(body.deckCode);
    if (!deckSelection.ok) {
        writeJson(res, 400, { ok: false, reason: deckSelection.reason || 'DECK_CODE_INVALID' });
        return;
    }

    const room = makeRoom({ networkDebugEnabled, roomBoardConfig });
    room.seats.black = true;
    room.seatNames.black = playerName;
    room.seatHandSkins.black = selectedHandSkinId;
    if (deckSelection.hasCustomDeck) {
        assignRoomDeckSelection(room, 'black', deckSelection);
    }
    room.updatedAt = Date.now();
    refreshTurnTimer(room, { nowMs: room.updatedAt, forceRestart: false });

    const serverTime = Date.now();
    writeJson(res, 200, MatchAuthority.buildRoomPayloadFromRoom(room, {
        ok: true,
        seatKey: 'black',
        playerName,
        seatToken: room.seatTokens.black,
        roomDeck: toPublicRoomDeck(room),
        roomBoardConfig: toPublicRoomBoardConfig(room),
        networkDebugEnabled: toPublicNetworkDebugEnabled(room),
        stateVersion: room.stateVersion,
        snapshot: toPublicSnapshot(room, 'black'),
        turnTimer: toPublicTurnTimer(room, serverTime),
        serverTime
    }));
}

async function handleJoin(req: any, res: any) {
    const body = await parseBody(req);
    const roomId = String(body.roomId || '').trim().toUpperCase();
    const requestedSeatKey = parseSeatKeyOptional(body.seatKey);
    const providedToken = String(body.seatToken || '').trim();
    const playerName = normalizeNetworkPlayerName(body.playerName);
    const selectedHandSkinId = normalizeSeatHandSkinId(body.selectedHandSkinId);

    if (!playerName) {
        writeJson(res, 400, { ok: false, reason: 'PLAYER_NAME_REQUIRED' });
        return;
    }
    if (!roomId || !rooms.has(roomId)) {
        writeJson(res, 404, { ok: false, reason: 'ROOM_NOT_FOUND' });
        return;
    }

    const deckSelection = resolveDeckSelection(body.deckCode);
    if (!deckSelection.ok) {
        writeJson(res, 400, { ok: false, reason: deckSelection.reason || 'DECK_CODE_INVALID' });
        return;
    }

    const room = rooms.get(roomId);
    const seatKey = resolveSeatForJoin(room, requestedSeatKey, providedToken);
    if (!seatKey) {
        writeJson(res, 409, { ok: false, reason: 'ROOM_FULL' });
        return;
    }

    if (!room.seatTokens || !room.seatTokens[seatKey]) {
        room.seatTokens = room.seatTokens || {};
        room.seatTokens[seatKey] = makeSeatToken();
    }
    const seatToken = room.seatTokens[seatKey];
    const rejoined = providedToken && providedToken === seatToken;

    const hadTwoSeats = hasTwoActiveSeats(room);
    room.seats[seatKey] = true;
    room.seatNames[seatKey] = playerName;
    room.seatHandSkins = toPublicSeatHandSkins(room);
    room.seatHandSkins[seatKey] = selectedHandSkinId;
    if (deckSelection.hasCustomDeck) {
        assignRoomDeckSelection(room, seatKey, deckSelection);
    }

    const hasTwoSeatsNow = hasTwoActiveSeats(room);
    let rebasedInitialSnapshot = false;
    if (!hadTwoSeats && hasTwoSeatsNow && room.stateVersion === 0) {
        const nextSnapshot = makeInitialSnapshot(room.seed, buildInitialDeckSnapshotOptions(room));
        room.stateVersion = 1;
        nextSnapshot.stateVersion = room.stateVersion;
        nextSnapshot.updatedAt = Date.now();
        room.snapshot = nextSnapshot;
        room.updatedAt = nextSnapshot.updatedAt;
        rebasedInitialSnapshot = true;
    } else {
        room.updatedAt = Date.now();
    }

    refreshTurnTimer(room, {
        nowMs: room.updatedAt,
        forceRestart: !hadTwoSeats && hasTwoSeatsNow
    });

    if (rebasedInitialSnapshot) {
        broadcastSnapshot(room, {
            playerKey: seatKey,
            actionType: 'join_room',
            playbackEvents: [],
            operationId: `join_room_${room.stateVersion}`
        });
    }

    broadcastPresence(room, {
        type: 'join',
        seatKey,
        rejoined: !!rejoined
    });

    const serverTime = Date.now();
    writeJson(res, 200, MatchAuthority.buildRoomPayloadFromRoom(room, {
        ok: true,
        seatKey,
        playerName,
        seatToken,
        rejoined: !!rejoined,
        roomDeck: toPublicRoomDeck(room),
        roomBoardConfig: toPublicRoomBoardConfig(room),
        networkDebugEnabled: toPublicNetworkDebugEnabled(room),
        stateVersion: room.stateVersion,
        snapshot: toPublicSnapshot(room, seatKey),
        turnTimer: toPublicTurnTimer(room, serverTime),
        serverTime
    }));
}

async function handleLeave(req: any, res: any) {
    const body = await parseBody(req);
    const roomId = String(body.roomId || '').trim().toUpperCase();
    const seatKey = normalizePlayerKey(body.seatKey);
    const seatToken = String(body.seatToken || '').trim();
    const room = rooms.get(roomId);

    if (!room) {
        writeJson(res, 200, { ok: true });
        return;
    }

    if (resolveAuthenticatedSeatKey(room, seatKey, seatToken) !== seatKey) {
        writeJson(res, 403, { ok: false, reason: classifySeatTokenRejectionReason(seatToken) });
        return;
    }

    MatchAuthority.applySeatLeaveToRoom(room, seatKey, {
        makeSeatToken,
        now: Date.now()
    });
    refreshTurnTimer(room, { nowMs: room.updatedAt, forceRestart: false });
    closeSeatStreams(room, seatKey);

    broadcastPresence(room, {
        type: 'leave',
        seatKey,
        rejoined: false
    });

    if (MatchAuthority.shouldDisposeRoom(room, room.streams.size)) {
        rooms.delete(roomId);
    }

    const serverTime = Date.now();
    writeJson(res, 200, MatchAuthority.buildRoomPayloadFromRoom(room, {
        ok: true,
        roomBoardConfig: toPublicRoomBoardConfig(room),
        turnTimer: toPublicTurnTimer(room, serverTime),
        serverTime
    }));
}

async function handleHandSkin(req: any, res: any) {
    const body = await parseBody(req);
    const roomId = String(body.roomId || '').trim().toUpperCase();
    const requestedSeatKey = parseSeatKeyOptional(body.seatKey);
    const seatToken = String(body.seatToken || '').trim();
    const selectedHandSkinId = normalizeSeatHandSkinId(body.selectedHandSkinId);
    const room = rooms.get(roomId);

    if (!room) {
        writeJson(res, 404, { ok: false, reason: 'ROOM_NOT_FOUND' });
        return;
    }

    const seatKey = resolveAuthenticatedSeatKey(room, requestedSeatKey, seatToken);
    if (!seatKey) {
        writeJson(res, 403, { ok: false, reason: classifySeatTokenRejectionReason(seatToken) });
        return;
    }
    if (!room.seats[seatKey]) {
        writeJson(res, 409, { ok: false, reason: 'SEAT_NOT_JOINED' });
        return;
    }

    room.seatHandSkins = toPublicSeatHandSkins(room);
    const previousSkinId = room.seatHandSkins[seatKey] || '';
    room.seatHandSkins[seatKey] = selectedHandSkinId;
    room.updatedAt = Date.now();

    if (previousSkinId !== selectedHandSkinId) {
        broadcastPresence(room, {
            type: 'hand_skin',
            seatKey,
            rejoined: false
        });
    }

    const serverTime = Date.now();
    writeJson(res, 200, MatchAuthority.buildRoomPayloadFromRoom(room, {
        ok: true,
        seatKey,
        selectedHandSkinId,
        roomDeck: toPublicRoomDeck(room),
        roomBoardConfig: toPublicRoomBoardConfig(room),
        networkDebugEnabled: toPublicNetworkDebugEnabled(room),
        turnTimer: toPublicTurnTimer(room, serverTime),
        serverTime
    }));
}

async function handlePublish(req: any, res: any) {
    const body = await parseBody(req);
    const roomId = String(body.roomId || '').trim().toUpperCase();
    const seatKey = normalizePlayerKey(body.seatKey);
    const playerKey = normalizePlayerKey(body.playerKey || body.actor);
    const seatToken = String(body.seatToken || '').trim();
    const baseVersion = Number.isFinite(Number(body.baseVersion)) ? Number(body.baseVersion) : null;
    const actionType = String(body.actionType || '').trim().toLowerCase();
    const operationId = normalizeOperationId(body.operationId);
    const isRematchResetAction = actionType === 'reset_game' || actionType === 'rematch' || actionType === 'restart';
    const isNetworkDebugAction = isNetworkDebugFillHandPayload(body);

    const room = rooms.get(roomId);
    if (!room) {
        writeJson(res, 404, { ok: false, rejectedReason: 'ROOM_NOT_FOUND' });
        return;
    }

    applyExpiredTurnTimeoutIfNeeded(room);

    const viewerSeatKey = resolveAuthenticatedSeatKey(room, seatKey, seatToken);
    const acceptedOperationsBySeat = ensureAcceptedOperationsBySeat(room);
    if (!Array.isArray(room.authorityLog)) room.authorityLog = [];
    if (!Array.isArray(room.sseEventBuffer)) room.sseEventBuffer = [];
    if (typeof room.authoritativeStateHash === 'undefined') {
        room.authoritativeStateHash = MatchAuthority.computeAuthoritativeStateHash(room.snapshot);
    }

    if (!room.seats[seatKey]) {
        writeJson(res, 403, buildPublishPayload(room, viewerSeatKey, MatchAuthority.buildPublishResponseOptions({
            ok: false,
            rejectedReason: 'SEAT_NOT_JOINED',
            publishKind: 'rejected',
            operationId,
            actionType,
            receivedBaseVersion: baseVersion,
            authoritativeStateVersion: room.stateVersion
        })));
        return;
    }

    if (seatKey !== playerKey) {
        writeJson(res, 403, buildPublishPayload(room, viewerSeatKey, MatchAuthority.buildPublishResponseOptions({
            ok: false,
            rejectedReason: 'SEAT_MISMATCH',
            publishKind: 'rejected',
            operationId,
            actionType,
            receivedBaseVersion: baseVersion,
            authoritativeStateVersion: room.stateVersion
        })));
        return;
    }

    if (!seatToken || !room.seatTokens || room.seatTokens[seatKey] !== seatToken) {
        writeJson(res, 403, buildPublishPayload(room, null, MatchAuthority.buildPublishResponseOptions({
            ok: false,
            rejectedReason: 'SEAT_TOKEN_MISMATCH',
            publishKind: 'rejected',
            operationId,
            actionType,
            receivedBaseVersion: baseVersion,
            authoritativeStateVersion: room.stateVersion
        })));
        return;
    }

    if (!MatchAuthority.hasRequiredOperationId(operationId)) {
        writeJson(res, 409, buildPublishPayload(room, seatKey, MatchAuthority.buildPublishResponseOptions({
            ok: false,
            rejectedReason: 'OPERATION_ID_REQUIRED',
            publishKind: 'rejected',
            operationId,
            actionType,
            receivedBaseVersion: baseVersion,
            authoritativeStateVersion: room.stateVersion
        })));
        return;
    }

    const lastAcceptedOperation = MatchAuthority.resolveAcceptedOperation(room, seatKey, operationId, acceptedOperationsBySeat[seatKey]);
    if (
        operationId
        && lastAcceptedOperation
        && typeof lastAcceptedOperation === 'object'
    ) {
        const serverTime = Date.now();
        MatchAuthority.appendAuthorityLog(room, {
            kind: 'publish_idempotent_replay',
            operationId,
            actionType,
            baseVersion,
            committedVersion: room.stateVersion,
            stateHashBefore: room.authoritativeStateHash,
            dedupeOutcome: 'replay'
        });
        writeJson(res, 200, buildPublishPayload(room, seatKey, MatchAuthority.buildPublishResponseOptions({
            ok: true,
            serverTime,
            idempotentReplay: true,
            publishKind: 'idempotent_replay',
            operationId,
            actionType,
            receivedBaseVersion: baseVersion,
            authoritativeStateVersion: room.stateVersion,
            replayedStateVersion: lastAcceptedOperation.stateVersion
        })));
        return;
    }

    if (baseVersion === null || baseVersion !== room.stateVersion) {
        const versionRejectedOptions = MatchAuthority.buildVersionRejectedPublishResponseOptions(room, {
            operationId,
            actionType,
            receivedBaseVersion: baseVersion,
            authoritativeStateVersion: room.stateVersion
        });
        const rejectedReason = versionRejectedOptions && versionRejectedOptions.rejectedReason
            ? versionRejectedOptions.rejectedReason
            : 'VERSION_MISMATCH';
        MatchAuthority.appendAuthorityLog(room, {
            kind: 'publish_rejected',
            operationId,
            actionType,
            baseVersion,
            committedVersion: room.stateVersion,
            stateHashBefore: room.authoritativeStateHash,
            rejectedReason
        });
        writeJson(res, 409, buildPublishPayload(room, seatKey, versionRejectedOptions));
        return;
    }

    const expectedPlayerKey = getCurrentPlayerKey(room.snapshot && room.snapshot.gameState);
    if (playerKey !== expectedPlayerKey) {
        const allowOutOfTurnRematch = isRematchResetAction && Core.isGameOver(room.snapshot && room.snapshot.gameState);
        const allowOutOfTurnNetworkDebug = isNetworkDebugAction && toPublicNetworkDebugEnabled(room);
        const allowFateWillController = MatchAuthority.isFateWillControllerForCurrentTurn(room.snapshot, playerKey);
        if (!allowOutOfTurnRematch && !allowOutOfTurnNetworkDebug && !allowFateWillController) {
            writeJson(res, 409, buildPublishPayload(room, seatKey, MatchAuthority.buildPublishResponseOptions({
                ok: false,
                rejectedReason: 'OUT_OF_TURN',
                publishKind: 'rejected',
                operationId,
                actionType,
                receivedBaseVersion: baseVersion,
                authoritativeStateVersion: room.stateVersion
            })));
            return;
        }
    }

    const hasCommandPayload = !!(
        !isRematchResetAction
        && body
        && typeof body === 'object'
        && (
            (body.params && typeof body.params === 'object')
            || (body.actor && String(body.actor).trim())
            || (body.action && typeof body.action === 'object')
        )
    );

    const stateHashBefore = MatchAuthority.computeAuthoritativeStateHash(room.snapshot);
    let nextSnapshot;
    let serverPlaybackEvents = [];
    let serverEffectLogs = [];
    let serverPlaybackDiagnostics = null;
    let commandAction: any = null;
    let pendingEffectId = null;
    if (isRematchResetAction) {
        const rematchSeed = Date.now();
        nextSnapshot = makeInitialSnapshot(rematchSeed, buildInitialDeckSnapshotOptions(room));
        room.seed = rematchSeed;
    } else if (hasCommandPayload) {
        const commandResult = applyCommandPublishToSnapshot(room, body, playerKey);
        if (!commandResult.ok) {
            MatchAuthority.appendAuthorityLog(room, {
                kind: 'publish_rejected',
                operationId,
                actionType,
                baseVersion,
                committedVersion: room.stateVersion,
                stateHashBefore,
                pendingEffectId: commandResult.pendingEffectId || null,
                rejectedReason: commandResult.rejectedReason || 'COMMAND_REJECTED'
            });
            writeJson(res, 409, buildPublishPayload(room, seatKey, MatchAuthority.buildPublishResponseOptions({
                ok: false,
                rejectedReason: commandResult.rejectedReason || 'COMMAND_REJECTED',
                errorMessage: commandResult.errorMessage || null,
                publishKind: 'rejected',
                operationId,
                actionType,
                receivedBaseVersion: baseVersion,
                authoritativeStateVersion: room.stateVersion
            })));
            return;
        }
        nextSnapshot = commandResult.snapshot;
        serverPlaybackEvents = Array.isArray(commandResult.playbackEvents) ? commandResult.playbackEvents : [];
        serverEffectLogs = Array.isArray(commandResult.effectLogs) ? commandResult.effectLogs : [];
        serverPlaybackDiagnostics = commandResult.playbackDiagnostics || null;
        commandAction = commandResult.action || null;
        pendingEffectId = commandResult.pendingEffectId || null;
    } else {
        writeJson(res, 409, buildPublishPayload(room, seatKey, MatchAuthority.buildPublishResponseOptions({
            ok: false,
            rejectedReason: 'COMMAND_REQUIRED',
            publishKind: 'rejected',
            operationId,
            actionType,
            receivedBaseVersion: baseVersion,
            authoritativeStateVersion: room.stateVersion
        })));
        return;
    }

    const previousSnapshotForChargeDelta = deepClone(room.snapshot);

    room.stateVersion += 1;
    nextSnapshot.stateVersion = room.stateVersion;
    nextSnapshot.updatedAt = Date.now();
    room.snapshot = nextSnapshot;
    room.updatedAt = nextSnapshot.updatedAt;
    room.authoritativeStateHash = MatchAuthority.computeAuthoritativeStateHash(nextSnapshot);

    if (operationId) {
        const acceptedEntry = {
            operationId,
            stateVersion: room.stateVersion,
            updatedAt: room.updatedAt
        };
        MatchAuthority.rememberAcceptedOperationBySeat(room, seatKey, acceptedEntry);
    }

    refreshTurnTimer(room, { nowMs: room.updatedAt, forceRestart: !isNetworkDebugAction });

    const meta = {
        playerKey,
        actionType: body.actionType ? String(body.actionType) : null,
        playbackEvents: serverPlaybackEvents,
        effectLogs: serverEffectLogs,
        playbackDiagnostics: serverPlaybackDiagnostics,
        operationId: operationId || null
    };
    const serverTime = Date.now();
    const preparedSnapshot = prepareSnapshotBroadcast(room, meta);
    const responsePayload = buildPublishPayload(room, seatKey, MatchAuthority.buildPublishResponseOptions({
        ok: true,
        serverTime,
        playbackEvents: serverPlaybackEvents,
        effectLogs: serverEffectLogs,
        playbackDiagnostics: serverPlaybackDiagnostics,
        publishKind: 'accepted',
        operationId,
        actionType,
        receivedBaseVersion: baseVersion,
        authoritativeStateVersion: room.stateVersion
    }));
    MatchAuthority.appendAuthorityLog(room, {
        kind: 'publish_accepted',
        operationId,
        actionType: actionType || (commandAction && commandAction.type) || null,
        baseVersion,
        committedVersion: room.stateVersion,
        stateHashBefore,
        stateHashAfter: room.authoritativeStateHash,
        pendingEffectId,
        dedupeOutcome: 'accepted'
    });
    MatchAuthority.stripTransientChargeDeltaState(room.snapshot);
    broadcastPreparedSnapshot(room, preparedSnapshot);
    writeJson(res, 200, responsePayload);
}

async function handleChat(req: any, res: any) {
    const body = await parseBody(req);
    const roomId = String(body.roomId || '').trim().toUpperCase();
    const seatKey = normalizePlayerKey(body.seatKey);
    const seatToken = String(body.seatToken || '').trim();

    const room = rooms.get(roomId);
    if (!room) {
        writeJson(res, 404, { ok: false, reason: 'ROOM_NOT_FOUND' });
        return;
    }
    if (!room.seats[seatKey]) {
        writeJson(res, 403, { ok: false, reason: 'SEAT_NOT_JOINED', seats: toPublicSeats(room) });
        return;
    }
    if (!seatToken || !room.seatTokens || room.seatTokens[seatKey] !== seatToken) {
        writeJson(res, 403, { ok: false, reason: 'SEAT_TOKEN_MISMATCH', seats: toPublicSeats(room) });
        return;
    }
    if (!room.seats.black || !room.seats.white) {
        writeJson(res, 409, { ok: false, reason: 'CHAT_DISABLED', seats: toPublicSeats(room) });
        return;
    }

    const parsedText = parseChatMessageText(body.message);
    if (!parsedText.ok) {
        writeJson(res, 400, { ok: false, reason: parsedText.reason, seats: toPublicSeats(room), maxLength: CHAT_MAX_LENGTH });
        return;
    }

    room.chatSeq = Number.isFinite(Number(room.chatSeq)) ? Number(room.chatSeq) : 0;
    room.chatSeq += 1;
    const message = {
        id: room.chatSeq,
        seatKey,
        text: parsedText.text,
        serverTime: Date.now()
    };

    room.chatMessages = Array.isArray(room.chatMessages) ? room.chatMessages : [];
    room.chatMessages.push(message);
    if (room.chatMessages.length > CHAT_HISTORY_LIMIT) {
        room.chatMessages.splice(0, room.chatMessages.length - CHAT_HISTORY_LIMIT);
    }
    room.updatedAt = message.serverTime;

    const payload = withPublicSeatState(room, {
        ok: true,
        roomId: room.roomId,
        type: 'message',
        message,
        roomDeck: toPublicRoomDeck(room),
        networkDebugEnabled: toPublicNetworkDebugEnabled(room)
    });

    broadcastChat(room, payload);

    writeJson(res, 200, withPublicSeatState(room, {
        ok: true,
        roomId: room.roomId,
        message,
        roomDeck: toPublicRoomDeck(room),
        networkDebugEnabled: toPublicNetworkDebugEnabled(room),
        serverTime: Date.now()
    }));
}

function handleState(req: any, res: any, urlObj: any) {
    const roomId = String((urlObj.searchParams.get('roomId') || '')).trim().toUpperCase();
    if (!roomId || !rooms.has(roomId)) {
        writeJson(res, 404, { ok: false, reason: 'ROOM_NOT_FOUND' });
        return;
    }
    const room = rooms.get(roomId);
    applyExpiredTurnTimeoutIfNeeded(room);

    const seatKey = parseSeatKeyOptional(urlObj.searchParams.get('seatKey') || '');
    const seatToken = String(urlObj.searchParams.get('seatToken') || '').trim();
    const viewerSeatKey = resolveAuthenticatedSeatKey(room, seatKey, seatToken);
    if (!viewerSeatKey) {
        writeJson(res, 403, { ok: false, reason: classifySeatTokenRejectionReason(seatToken) });
        return;
    }

    const serverTime = Date.now();
    writeJson(res, 200, MatchAuthority.buildRoomPayloadFromRoom(room, {
        ok: true,
        stateVersion: room.stateVersion,
        roomDeck: toPublicRoomDeck(room),
        roomBoardConfig: toPublicRoomBoardConfig(room),
        networkDebugEnabled: toPublicNetworkDebugEnabled(room),
        snapshot: toPublicSnapshot(room, viewerSeatKey),
        turnTimer: toPublicTurnTimer(room, serverTime),
        serverTime
    }));
}

function handleStream(req: any, res: any, urlObj: any) {
    const roomId = String((urlObj.searchParams.get('roomId') || '')).trim().toUpperCase();
    if (!roomId || !rooms.has(roomId)) {
        writeJson(res, 404, { ok: false, reason: 'ROOM_NOT_FOUND' });
        return;
    }

    const room = rooms.get(roomId);
    applyExpiredTurnTimeoutIfNeeded(room);

    const seatKey = parseSeatKeyOptional(urlObj.searchParams.get('seatKey') || '');
    const seatToken = String(urlObj.searchParams.get('seatToken') || '').trim();
    const resumeEventId = String(urlObj.searchParams.get('lastEventId') || '').trim();
    const viewerSeatKey = resolveAuthenticatedSeatKey(room, seatKey, seatToken);
    if (!viewerSeatKey) {
        writeJson(res, 403, { ok: false, reason: classifySeatTokenRejectionReason(seatToken) });
        return;
    }

    res.writeHead(200, {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
        'Access-Control-Allow-Origin': '*'
    });

    const streamId = MatchAuthority.makeSseStreamId(Date.now());
    room.streams.set(streamId, { res, seatKey: viewerSeatKey });
    ensureHeartbeatLoop();

    const lastEventId = String((req && req.headers && req.headers['last-event-id']) || resumeEventId).trim();
    const replayEvents = MatchAuthority.getBufferedSseReplayEvents(room.sseEventBuffer, lastEventId, viewerSeatKey);

    if (Array.isArray(replayEvents)) {
        if (replayEvents.length > 0) {
            for (const event of replayEvents) {
                writeSse(res, event.eventName, event.payload, event.eventId);
            }
        } else {
            writeSse(res, 'heartbeat', buildHeartbeatPayload(room, Date.now()), null);
        }

        req.on('close', () => {
            removeStream(room, streamId);
        });
        return;
    }

    writeSse(res, 'snapshot', buildSnapshotPayload(room, {
        playbackEvents: [],
        operationId: null,
        playerKey: null,
        actionType: null
    }, viewerSeatKey), nextSseEventId(room));

    writeSse(res, 'chat', withPublicSeatState(room, {
        ok: true,
        roomId,
        type: 'history',
        roomDeck: toPublicRoomDeck(room),
        networkDebugEnabled: toPublicNetworkDebugEnabled(room),
        messages: toPublicChatMessages(room)
    }), nextSseEventId(room));

    req.on('close', () => {
        removeStream(room, streamId);
    });
}

function createLocalMatchServer() {
    return http.createServer(async (req: any, res: any) => {
        try {
            const urlObj = new URL(req.url || '/', `http://${req.headers.host || `${HOST}:${PORT}`}`);
            const pathname = urlObj.pathname;

            if (req.method === 'OPTIONS') {
                res.writeHead(204, {
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
                    'Access-Control-Allow-Headers': 'Content-Type'
                });
                res.end();
                return;
            }

            if (req.method === 'POST' && pathname === '/api/match/create') {
                await handleCreate(req, res);
                return;
            }

            if (req.method === 'POST' && pathname === '/api/match/join') {
                await handleJoin(req, res);
                return;
            }

            if (req.method === 'POST' && pathname === '/api/match/leave') {
                await handleLeave(req, res);
                return;
            }

            if (req.method === 'POST' && pathname === '/api/match/publish') {
                await handlePublish(req, res);
                return;
            }

            if (req.method === 'POST' && pathname === '/api/match/chat') {
                await handleChat(req, res);
                return;
            }

            if (req.method === 'POST' && pathname === '/api/match/hand-skin') {
                await handleHandSkin(req, res);
                return;
            }

            if (req.method === 'GET' && pathname === '/api/match/state') {
                handleState(req, res, urlObj);
                return;
            }

            if (req.method === 'GET' && pathname === '/api/match/stream') {
                handleStream(req, res, urlObj);
                return;
            }

            writeJson(res, 404, { ok: false, reason: 'NOT_FOUND' });
        } catch (error: any) {
            const message = error && error.message ? error.message : String(error);
            writeJson(res, 500, { ok: false, reason: 'SERVER_ERROR', message });
        }
    });
}

function resetRoomsForTests() {
    rooms.clear();
    stopHeartbeatLoopIfIdle();
}

function patchRoomSnapshotForTests(roomId: any, patchFn: any) {
    const room = rooms.get(String(roomId || '').toUpperCase());
    if (!room) return false;
    patchFn(room);
    return true;
}

function startLocalMatchServerFromCli() {
    const server = createLocalMatchServer();
    server.listen(PORT, HOST, () => {
        console.log(`LOCAL_MATCH_SERVER:${HOST}:${PORT}`);
    });
    return server;
}

export = {
    createLocalMatchServer,
    applyCommandPublishToSnapshot,
    makeInitialSnapshot,
    buildInitialDeckSnapshotOptions,
    resetRoomsForTests,
    patchRoomSnapshotForTests,
    startLocalMatchServerFromCli
};

if (require.main === module) {
    startLocalMatchServerFromCli();
}
