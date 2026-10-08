import { createMatchPublishPayloadBuilder } from '../utils/match-publish-payload';
declare const __non_webpack_require__: NodeRequire | undefined;
import type { MatchRoomDeckSelectionSuccess } from '../utils/match-room-deck';

const _require: NodeRequire = typeof __non_webpack_require__ !== 'undefined' ? __non_webpack_require__ : require;

const http = require('http');
const nodeCrypto = require('crypto');
const { URL } = require('url');

const Core = require('../game/logic/core');
const CardLogic = require('../game/logic/cards');
const { isCardRuntimeUnavailableError } = require('../game/logic/card-runtime-errors');
const TurnPipeline = require('../game/turn/turn_pipeline');
const TurnPipelinePhases = require('../game/turn/turn_pipeline_phases');
const TurnPipelineUIAdapter = require('../game/turn/pipeline_ui_adapter');
const SubPlacementContinuation = require('../game/turn/sub-placement-continuation');
const SeededPRNG = require('../game/schema/prng');
const deepClone = require('../utils/deepClone');
const MatchAuthority = require('../utils/match-authority');
const MatchCommandRuntime = require('../utils/match-command-runtime');
const MatchAutoCommand = require('../utils/match-auto-command');
const {
    buildInitialDeckSnapshotOptions: buildCanonicalInitialDeckSnapshotOptions,
    buildRoomDeckSelectionPatch,
    cloneRoomDeckCardIdsByPlayer,
    cloneRoomDeckSpecByPlayer,
    createAllCardsRoomDeckMetadata: createCanonicalAllCardsRoomDeckMetadata,
    isAllCardsDeckRoom: classifyAllCardsDeckRoom,
    normalizeRoomDeckSize,
    projectPublicRoomDeck
} = require('../utils/match-room-deck');
const CpuNetworkCommandPlanner = require('../game/cpu-network-command-planner');
const PendingCoordinator = require('../game/turn/pending-coordinator');
const PendingSelectionRegistry = require('../game/logic/cards-internal/pending-selection-registry');
const DebugActions = require('../game/debug/debug-actions');
const { createMatchJoinController } = require('../utils/match-join-controller');
const { createMatchLeaveController } = require('../utils/match-leave-controller');
const { createMatchPublishController } = require('../utils/match-publish-controller');
const { createMatchRoomPreferencesController } = require('../utils/match-room-preferences-controller');
const { createMatchRematchController } = require('../utils/match-rematch-controller');
const { createMatchStateController } = require('../utils/match-state-controller');
const { createMatchStreamPreparationController } = require('../utils/match-stream-preparation-controller');
const { createMatchSpectateController } = require('../utils/match-spectate-controller');
const MatchRoomLobby = require('../shared/match-room-lobby');
const NetworkActionSchema = require('../shared/network-action-schema');
const PlaybackEventHelpers = require('../shared/playback-event-helpers');
const DeckCodecModule = require('../shared/deck-codec');
const DeckSpecHelpers = require('../shared/deck-spec');
const PlayerIdentityContract = require('../shared/player-identity-contract');
const SharedBoardUtils = require('../shared/shared-board-utils');
const PresentationEnvelopeContract = require('../shared/network-presentation-envelope');

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

const CHAT_MAX_LENGTH = Number(MatchAuthority.CHAT_MAX_LENGTH);
const CHAT_HISTORY_LIMIT = Number(MatchAuthority.CHAT_HISTORY_LIMIT);
const SSE_HEARTBEAT_INTERVAL_MS = Number(MatchAuthority.SSE_HEARTBEAT_INTERVAL_MS);
const NETWORK_DEBUG_FILL_HAND_ACTION = MatchAuthority.NETWORK_DEBUG_FILL_HAND_ACTION || 'debug_fill_hand';

const rooms = new Map();
const playerIdentityRecords = new Map();
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

function resolveAuthenticatedViewer(room: any, options: any) {
    return MatchAuthority.resolveAuthenticatedViewer(room, options);
}

function classifySeatTokenRejectionReason(seatTokenValue: any) {
    return MatchAuthority.classifySeatTokenRejectionReason(seatTokenValue);
}

function classifyViewerTokenRejectionReason(searchParams: URLSearchParams) {
    const viewerRole = String(searchParams.get('viewerRole') || '').trim().toLowerCase();
    if (viewerRole === 'spectator') {
        return String(searchParams.get('spectatorToken') || '').trim()
            ? 'SPECTATOR_TOKEN_MISMATCH'
            : 'SPECTATOR_TOKEN_REQUIRED';
    }
    return classifySeatTokenRejectionReason(searchParams.get('seatToken') || '');
}

function toPublicSnapshot(room: any, viewerSeatKey: any) {
    return MatchAuthority.buildPublicSnapshot(room, viewerSeatKey || null);
}

function toPublicSnapshotForViewer(room: any, viewer: any) {
    return MatchAuthority.buildPublicSnapshotForViewer(room, viewer);
}

function buildPresentationCursor(room: any) {
    return {
        visualSeq: Number.isFinite(Number(room && room.visualSeq)) ? Math.max(0, Math.trunc(Number(room.visualSeq))) : 0,
        stateVersion: Number.isFinite(Number(room && room.stateVersion)) ? Math.max(0, Math.trunc(Number(room.stateVersion))) : 0
    };
}

function viewerFromSeatKey(viewerSeatKey: any) {
    const seatKey = parseSeatKeyOptional(viewerSeatKey);
    return seatKey ? { role: 'seat', seatKey } : { role: 'spectator', spectatorId: '' };
}

function ensureInitialPresentationSnapshots(room: any) {
    if (!room || room.initialSnapshotByViewer) return;
    room.initialSnapshotByViewer = {
        black: toPublicSnapshotForViewer(room, { role: 'seat', seatKey: 'black' }),
        white: toPublicSnapshotForViewer(room, { role: 'seat', seatKey: 'white' }),
        spectator: toPublicSnapshotForViewer(room, { role: 'spectator', spectatorId: '' })
    };
    if (!Number.isFinite(Number(room.visualSeq))) room.visualSeq = 0;
    if (!Array.isArray(room.presentationJournal)) room.presentationJournal = [];
}

function appendPresentationFrameForAcceptedPublish(room: any, options: any) {
    if (!room) return null;
    ensureInitialPresentationSnapshots(room);
    const playbackEvents = Array.isArray(options && options.playbackEvents) ? options.playbackEvents : [];
    const effectLogs = MatchAuthority.normalizeEffectLogMessages(options && options.effectLogs);
    const playbackDiagnostics = options && options.playbackDiagnostics ? options.playbackDiagnostics : null;
    const publishViewerArtifacts = options && options.publishViewerArtifacts && typeof options.publishViewerArtifacts === 'object'
        ? options.publishViewerArtifacts
        : {};
    const artifactSnapshots = publishViewerArtifacts.projectedSnapshots && typeof publishViewerArtifacts.projectedSnapshots === 'object'
        ? publishViewerArtifacts.projectedSnapshots
        : {};
    return MatchAuthority.appendPresentationFrame(room, {
        stateVersionFrom: options && options.previousStateVersion,
        stateVersionTo: options && options.nextStateVersion,
        operationId: options && options.operationId,
        actorSeatKey: options && options.actorSeatKey,
        actionType: options && options.actionType,
        payloadByViewer: {
            black: { playbackEvents, effectLogs, playbackDiagnostics },
            white: { playbackEvents, effectLogs, playbackDiagnostics },
            spectator: { playbackEvents, effectLogs, playbackDiagnostics }
        },
        snapshotAfterByViewer: {
            black: artifactSnapshots.black || toPublicSnapshotForViewer(room, { role: 'seat', seatKey: 'black' }),
            white: artifactSnapshots.white || toPublicSnapshotForViewer(room, { role: 'seat', seatKey: 'white' }),
            spectator: artifactSnapshots.spectator || toPublicSnapshotForViewer(room, { role: 'spectator', spectatorId: '' })
        },
        createdAt: options && options.createdAt
    });
}

function buildPresentationFramesForViewer(room: any, viewer: any, options: any) {
    if (Array.isArray(options && options.presentationFrames)) return options.presentationFrames;
    const presentationFrameEntry = options && options.presentationFrameEntry;
    if (presentationFrameEntry && typeof presentationFrameEntry === 'object') {
        return require('../utils/match-public-frame-cache').getPublishPresentationFrames(
            options, viewer && viewer.role === 'seat' ? viewer.seatKey : 'spectator',
            () => [MatchAuthority.toPublicPresentationFrame(presentationFrameEntry, viewer, room)]
        );
    }
    return [];
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

function makeSpectatorToken() {
    return MatchAuthority.makeSpectatorToken(makeSeatToken);
}

function makeSpectatorId() {
    return MatchAuthority.makeSpectatorId(makeSeatToken);
}

function makeRematchRequestId() {
    return MatchAuthority.makeRematchRequestId(makeSeatToken, Date.now);
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

function cloneInitialDeckCardIdsByPlayer(source: any) {
    const byPlayer = (source && typeof source === 'object') ? source : {};
    const cloneCards = (value: any) => Array.isArray(value)
        ? value.map((cardId) => String(cardId || '').trim()).filter(Boolean)
        : null;
    return cloneRoomDeckCardIdsByPlayer({
        black: cloneCards(byPlayer.black),
        white: cloneCards(byPlayer.white)
    });
}

function getAllCardsDeckCardIds() {
    if (DeckSpecHelpers && typeof DeckSpecHelpers.getCpuLv9EndingAshDeckCardIds === 'function') {
        const cardIds = DeckSpecHelpers.getCpuLv9EndingAshDeckCardIds();
        if (Array.isArray(cardIds) && cardIds.length > 0) {
            return cardIds.slice();
        }
    }
    return [];
}

function createAllCardsDeckCardIdsByPlayer() {
    const cardIds = getAllCardsDeckCardIds();
    return {
        black: cardIds.slice(),
        white: cardIds.slice()
    };
}

function createAllCardsRoomDeckMetadataFromRuntimeCardIds(cardIdsByPlayer: any) {
    const black = Array.isArray(cardIdsByPlayer && cardIdsByPlayer.black)
        ? cardIdsByPlayer.black
        : [];
    const white = Array.isArray(cardIdsByPlayer && cardIdsByPlayer.white)
        ? cardIdsByPlayer.white
        : black;
    return createCanonicalAllCardsRoomDeckMetadata({ black, white });
}

function isAllCardsDeckRoom(room: any) {
    const roomDeckSource = room && room.roomDeck
        ? String(room.roomDeck.source || '')
        : null;
    return classifyAllCardsDeckRoom(!!(room && room.allCardsDeckEnabled === true), roomDeckSource);
}

function buildInitialDeckSnapshotOptions(room: any) {
    const source: any = (room && typeof room === 'object') ? room : {};
    const cardIdsByPlayer = cloneInitialDeckCardIdsByPlayer(source.initialDeckCardIdsByPlayer);
    const byPlayer = (source.initialDeckSpecByPlayer && typeof source.initialDeckSpecByPlayer === 'object')
        ? source.initialDeckSpecByPlayer
        : {};
    const initialDeckSpecByPlayer = cloneRoomDeckSpecByPlayer({
        black: byPlayer.black && typeof byPlayer.black === 'object' ? byPlayer.black : null,
        white: byPlayer.white && typeof byPlayer.white === 'object' ? byPlayer.white : null
    });
    const boardConfig = MatchAuthority.resolveRoomBoardConfig(source);
    return buildCanonicalInitialDeckSnapshotOptions({
        initialDeckCardIdsByPlayer: cardIdsByPlayer,
        initialDeckSpecByPlayer,
        initialDeckSpec: source.initialDeckSpec && typeof source.initialDeckSpec === 'object'
            ? source.initialDeckSpec
            : null,
        stoneSupplyEnabled: source.stoneSupplyEnabled
    }, boardConfig && typeof boardConfig === 'object' ? boardConfig : null);
}

function cloneInitialDeckSpecByPlayer(source: any) {
    const byPlayer = (source && typeof source === 'object') ? source : {};
    return cloneRoomDeckSpecByPlayer({
        black: byPlayer.black && typeof byPlayer.black === 'object' ? byPlayer.black : null,
        white: byPlayer.white && typeof byPlayer.white === 'object' ? byPlayer.white : null
    });
}

function normalizeLocalRoomDeckMetadata(value: any) {
    if (!value || typeof value !== 'object') return null;
    const deckCodeByPlayerSource = value.deckCodeByPlayer && typeof value.deckCodeByPlayer === 'object'
        ? value.deckCodeByPlayer
        : {};
    const deckSizeByPlayerSource = value.deckSizeByPlayer && typeof value.deckSizeByPlayer === 'object'
        ? value.deckSizeByPlayer
        : {};
    return {
        mode: value.mode === 'perPlayer' ? 'perPlayer' : 'shared',
        source: value.source ? String(value.source) : 'room',
        deckCode: String(value.deckCode || '').trim(),
        deckSize: normalizeRoomDeckSize(value.deckSize),
        deckCodeByPlayer: {
            black: String(deckCodeByPlayerSource.black || '').trim(),
            white: String(deckCodeByPlayerSource.white || '').trim()
        },
        deckSizeByPlayer: {
            black: normalizeRoomDeckSize(deckSizeByPlayerSource.black),
            white: normalizeRoomDeckSize(deckSizeByPlayerSource.white)
        }
    };
}

function assignRoomDeckSelection(room: any, seatKey: any, deckSelection: any) {
    if (!room || !deckSelection || deckSelection.ok !== true) return false;
    const normalizedSeatKey = normalizePlayerKey(seatKey);
    if (!normalizedSeatKey) return false;
    const currentInitialDeckSpecByPlayer = cloneInitialDeckSpecByPlayer(room.initialDeckSpecByPlayer);
    let normalizedSelection: MatchRoomDeckSelectionSuccess;
    if (deckSelection.hasCustomDeck === true) {
        const deckSpec = deckSelection.deckSpec;
        if (!deckSpec || typeof deckSpec !== 'object') {
            throw new TypeError('local-match-server: successful custom deck selection requires deckSpec');
        }
        normalizedSelection = {
            ok: true,
            hasCustomDeck: true,
            deckSpec,
            deckCode: String(deckSelection.deckCode || '').trim(),
            deckSize: normalizeRoomDeckSize(deckSelection.deckSize)
        };
    } else {
        normalizedSelection = {
            ok: true,
            hasCustomDeck: false,
            deckSpec: null,
            deckCode: '',
            deckSize: null
        };
    }
    const patch = buildRoomDeckSelectionPatch({
        initialDeckSpec: room.initialDeckSpec && typeof room.initialDeckSpec === 'object'
            ? room.initialDeckSpec
            : null,
        initialDeckSpecByPlayer: (
            currentInitialDeckSpecByPlayer.black !== null || currentInitialDeckSpecByPlayer.white !== null
        ) ? currentInitialDeckSpecByPlayer : null,
        roomDeck: normalizeLocalRoomDeckMetadata(room.roomDeck)
    }, normalizedSeatKey, normalizedSelection);
    room.initialDeckSpec = patch.initialDeckSpec;
    room.initialDeckSpecByPlayer = patch.initialDeckSpecByPlayer;
    room.roomDeck = patch.roomDeck;
    return true;
}

function persistTurnStartPrngState(cardState: any, prng: any) {
    if (!cardState || !prng || typeof prng.getState !== 'function') return;
    cardState.prngState = prng.getState();
}

const buildPublishPayload = createMatchPublishPayloadBuilder({
    authority: MatchAuthority,
    buildPresentationCursor,
    toPublicSnapshot,
    toPublicRoomDeck,
    toPublicRoomBoardConfig,
    toPublicNetworkDebugEnabled,
    toPublicNetworkAutoEnabled,
    toPublicTurnTimer,
    buildPresentationFrames: (room, viewerSeatKey, options) => buildPresentationFramesForViewer(room, viewerFromSeatKey(viewerSeatKey), options),
});

function createLocalMatchCommandCapabilities() {
    return {
        snapshot: {
            cloneSnapshot: (snapshot: any) => deepClone(snapshot),
            stripTransientChargeDeltaState: (snapshot: any) => MatchAuthority.stripTransientChargeDeltaState(snapshot),
            stripTransientPresentationState: (snapshot: any) => MatchAuthority.stripTransientPresentationState(snapshot),
            restoreMissingChargeDeltaEvents: (previousSnapshot: any, nextSnapshot: any) => (
                MatchAuthority.restoreMissingChargeDeltaEvents(previousSnapshot, nextSnapshot)
            )
        },
        schema: {
            buildAction: (input: any, fallbackActor: any, fallbackTurnIndex: any) => (
                NetworkActionSchema.buildAction(input, fallbackActor, fallbackTurnIndex)
            )
        },
        runtimeFailure: {
            isRuntimeUnavailableError: (error: unknown) => isCardRuntimeUnavailableError(error)
        },
        autoCommand: {
            isAutoTurnPublishBody: (body: any) => MatchAutoCommand.isMatchAutoTurnPublishBody(body),
            resolveAutoTurnPublishBody: (options: any) => MatchAutoCommand.resolveMatchAutoTurnPublishBody({
                body: options.body,
                snapshot: options.snapshot,
                playerKey: options.playerKey,
                planningPlayerKey: options.planningPlayerKey,
                CpuNetworkCommandPlanner,
                CoreLogic: Core,
                CardLogic,
                PendingCoordinator,
                PendingSelectionRegistry,
                SubPlacementContinuation
            })
        },
        debug: {
            isDebugFillHandPayload: (body: any) => isNetworkDebugFillHandPayload(body),
            resolveDebugFillHandOptions: (body: any) => resolveNetworkDebugFillHandOptions(body),
            fillDebugHand: (cardState: any, options: any) => DebugActions.fillDebugHand(cardState, options)
        },
        random: {
            fromState: (state: any) => SeededPRNG.fromState(state),
            createPrng: (seed: any) => SeededPRNG.createPRNG(seed),
            deriveSeed: (context: any, snapshot: any, commandPlayerKey: any) => (
                MatchAuthority.createTurnStartSeed(
                    { seed: context.roomSeed },
                    snapshot,
                    commandPlayerKey
                )
            )
        },
        pipeline: {
            applyTurnSafe: TurnPipeline.applyTurnSafe.bind(TurnPipeline)
        },
        turnStart: {
            isGameOver: (gameState: any) => Core.isGameOver(gameState),
            createCardState: (prng: any, initialDeckOptions: any) => (
                CardLogic.createCardState(prng, initialDeckOptions)
            ),
            mergeWithDefaultShape: (defaultValue: any, overrideValue: any) => (
                MatchAuthority.mergeWithDefaultShape(defaultValue, overrideValue)
            ),
            applyTurnStartPhase: (
                cardLogic: any,
                coreLogic: any,
                cardState: any,
                gameState: any,
                commandPlayerKey: any,
                events: any,
                prng: any
            ) => TurnPipelinePhases.applyTurnStartPhase(
                cardLogic,
                coreLogic,
                cardState,
                gameState,
                commandPlayerKey,
                events,
                prng
            ),
            cardLogic: CardLogic,
            coreLogic: Core
        },
        authority: {
            normalizePlayerKey,
            parsePlayerKeyOptional: parseSeatKeyOptional,
            getCurrentPlayerKey,
            parseHiddenHandToken: (value: any) => MatchAuthority.parseHiddenHandToken(value),
            validatePendingSelectionPublish: (
                snapshot: any,
                commandPlayerKey: any,
                action: any
            ) => MatchAuthority.validatePendingSelectionPublish(snapshot, commandPlayerKey, action),
            sanitizePendingSelectionActionForAuthority: (
                snapshot: any,
                commandPlayerKey: any,
                action: any
            ) => MatchAuthority.sanitizePendingSelectionActionForAuthority(snapshot, commandPlayerKey, action),
            validateAuthoritativePendingSelectionResult: MatchAuthority.validateAuthoritativePendingSelectionResult,
            isSubPlacementTurnActive: (cardState: any, commandPlayerKey: any) => (
                SubPlacementContinuation.isSubPlacementTurnActive(cardState, commandPlayerKey)
            )
        },
        presentation: {
            collectActionPlaybackEvents: (options: any) => PlaybackEventHelpers.collectActionPlaybackEvents({
                result: options.result,
                rawEvents: options.rawEvents,
                snapshot: options.snapshot,
                playerKey: options.playerKey,
                fallbackPlayerKey: options.playerKey,
                adapter: TurnPipelineUIAdapter,
                normalizePlayerKey
            }),
            collectTurnStartPlaybackEvents: (options: any) => PlaybackEventHelpers.collectServerPlaybackEvents({
                rawEvents: options.rawEvents,
                snapshot: options.snapshot,
                playerKey: options.playerKey,
                fallbackPlayerKey: options.playerKey,
                adapter: TurnPipelineUIAdapter,
                normalizePlayerKey
            }),
            buildActionEffectLogs: (
                action: any,
                commandPlayerKey: any,
                rawEvents: any,
                presentationEvents: any
            ) => buildNetworkActionEffectLogs(
                action,
                commandPlayerKey,
                rawEvents,
                presentationEvents
            ),
            collectTurnStartEffectLogs: (
                rawEvents: any,
                presentationEvents: any,
                commandPlayerKey: any
            ) => MatchAuthority.collectPipelineEffectLogMessages(
                rawEvents,
                presentationEvents,
                commandPlayerKey,
                TurnPipelineUIAdapter
            ),
            appendTurnStartDrawPlaybackEvents: (options: any) => (
                PlaybackEventHelpers.appendTurnStartDrawPlaybackEvents({
                    playbackAssembly: options.playbackAssembly,
                    snapshot: options.snapshot,
                    handState: options.handState,
                    adapter: TurnPipelineUIAdapter,
                    normalizePlayerKey
                })
            ),
            appendPlaybackEventsAfter: (first: any, second: any) => (
                PlaybackEventHelpers.appendPlaybackEventsAfter(first, second)
            ),
            appendEffectLogMessages: (first: any, second: any) => (
                MatchAuthority.appendEffectLogMessages(first, second)
            ),
            reportPlaybackAssemblyDiagnostics: (context: any, diagnostics: any, options: any) => (
                MatchAuthority.reportPlaybackAssemblyDiagnostics(context, diagnostics, options)
            ),
            toDebugPlaybackDiagnostics: (diagnostics: any, networkDebugEnabled: any) => (
                MatchAuthority.toDebugPlaybackDiagnostics(diagnostics, networkDebugEnabled)
            )
        }
    };
}

function applyCommandPublishToSnapshot(room: any, body: any, playerKey: any) {
    if (!NetworkActionSchema || typeof NetworkActionSchema.buildAction !== 'function') {
        return { ok: false, rejectedReason: 'COMMAND_SCHEMA_UNAVAILABLE' };
    }
    if (!TurnPipeline || typeof TurnPipeline.applyTurnSafe !== 'function') {
        return { ok: false, rejectedReason: 'COMMAND_PIPELINE_UNAVAILABLE' };
    }
    if (isNetworkDebugFillHandPayload(body) && !toPublicNetworkDebugEnabled(room)) {
        return { ok: false, rejectedReason: 'NETWORK_DEBUG_DISABLED' };
    }

    if (!room || !room.snapshot || !room.snapshot.gameState || !room.snapshot.cardState) {
        return { ok: false, rejectedReason: 'INVALID_SNAPSHOT' };
    }
    const normalizedPlayerKey = normalizePlayerKey(playerKey);
    const result = MatchCommandRuntime.executeMatchCommand({
        snapshot: room.snapshot,
        playerKey: normalizedPlayerKey,
        roomSeed: Number.isFinite(Number(room.seed)) ? Math.trunc(Number(room.seed)) : 1,
        stateVersion: Number.isFinite(Number(room.stateVersion)) ? Math.trunc(Number(room.stateVersion)) : 0,
        initialDeckOptions: buildInitialDeckSnapshotOptions(room),
        networkDebugEnabled: room.networkDebugEnabled === true,
        networkAutoEnabled: room.networkAutoEnabled === true
    }, body, createLocalMatchCommandCapabilities());

    if (!result || result.ok !== true) {
        const failure: any = {
            ok: false,
            rejectedReason: (result && result.rejectedReason) || 'COMMAND_REJECTED'
        };
        if (result && Object.prototype.hasOwnProperty.call(result, 'errorMessage')) {
            failure.errorMessage = result.errorMessage;
        }
        return failure;
    }

    const success: any = {
        ok: true,
        snapshot: result.snapshot,
        playbackEvents: result.playbackEvents,
        playbackDiagnostics: result.playbackDiagnostics,
        effectLogs: result.effectLogs,
        pendingEffectId: result.pendingEffectId
    };
    if (!isNetworkDebugFillHandPayload(body)) {
        success.action = result.action;
    }
    return success;
}

function applyTimeoutPassToSnapshot(room: any, playerKey: any) {
    const normalizedPlayerKey = normalizePlayerKey(playerKey);
    const snapshot = room && room.snapshot && typeof room.snapshot === 'object' ? room.snapshot : null;
    const cardState = snapshot && snapshot.cardState && typeof snapshot.cardState === 'object'
        ? snapshot.cardState
        : {};
    const turnIndex = Number.isFinite(Number(cardState.turnIndex))
        ? Math.trunc(Number(cardState.turnIndex))
        : 0;
    return applyCommandPublishToSnapshot(room, {
        actionType: 'pass',
        actor: normalizedPlayerKey,
        turnIndex,
        action: {
            type: 'pass',
            playerKey: normalizedPlayerKey,
            turnIndex,
            forcePass: true,
            reason: 'timeout'
        }
    }, normalizedPlayerKey);
}

function hasTwoActiveSeats(room: any) {
    return !!(room && room.seats && room.seats.black && room.seats.white);
}

function resolveTurnSeatKey(room: any) {
    return getCurrentPlayerKey(room && room.snapshot && room.snapshot.gameState);
}

function resolveRoomTurnLimitSeconds(room: any) {
    const timer = room && room.turnTimer && typeof room.turnTimer === 'object' ? room.turnTimer : null;
    return MatchAuthority.normalizeNetworkTurnLimitSeconds(timer && timer.limitSeconds);
}

function createPausedTurnTimer(room: any) {
    const limitSeconds = resolveRoomTurnLimitSeconds(room);
    return {
        limitSeconds,
        active: false,
        turnSeatKey: resolveTurnSeatKey(room),
        turnStartedAt: null,
        turnDeadlineAt: null
    };
}

function createActiveTurnTimer(room: any, nowMs: any) {
    const now = Number.isFinite(Number(nowMs)) ? Math.max(0, Math.trunc(Number(nowMs))) : Date.now();
    const limitSeconds = resolveRoomTurnLimitSeconds(room);
    return {
        limitSeconds,
        active: true,
        turnSeatKey: resolveTurnSeatKey(room),
        turnStartedAt: now,
        turnDeadlineAt: now + (limitSeconds * 1000)
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
            timer.limitSeconds = resolveRoomTurnLimitSeconds(room);
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
        limitSeconds: resolveRoomTurnLimitSeconds(room),
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

function projectLegacyUnknownModeRoomDeck(metadata: any, snapshotSizes: any) {
    const rawMode = metadata && metadata.mode ? String(metadata.mode) : '';
    if (!rawMode || rawMode === 'shared' || rawMode === 'perPlayer') {
        throw new TypeError('projectLegacyUnknownModeRoomDeck requires a non-empty unsupported mode');
    }
    const snapshotDeckSize = snapshotSizes.initialDeckSizeByPlayer.black !== null
        ? snapshotSizes.initialDeckSizeByPlayer.black
        : snapshotSizes.initialDeckSize;
    const metadataDeckSize = normalizeRoomDeckSize(metadata.deckSize);
    return {
        mode: rawMode,
        deckSize: metadataDeckSize !== null ? metadataDeckSize : snapshotDeckSize,
        source: metadata.source ? String(metadata.source) : 'room'
    };
}

function toPublicRoomDeck(room: any) {
    const rawMetadata = (room && room.roomDeck && typeof room.roomDeck === 'object')
        ? room.roomDeck
        : null;
    const snapshotSizes = {
        initialDeckSizeByPlayer: {
            black: normalizeRoomDeckSize(
                room
                && room.snapshot
                && room.snapshot.cardState
                && room.snapshot.cardState.initialDeckSizeByPlayer
                && room.snapshot.cardState.initialDeckSizeByPlayer.black
            ),
            white: normalizeRoomDeckSize(
                room
                && room.snapshot
                && room.snapshot.cardState
                && room.snapshot.cardState.initialDeckSizeByPlayer
                && room.snapshot.cardState.initialDeckSizeByPlayer.white
            )
        },
        initialDeckSize: normalizeRoomDeckSize(
            room && room.snapshot && room.snapshot.cardState && room.snapshot.cardState.initialDeckSize
        )
    };
    const rawMode = rawMetadata && rawMetadata.mode ? String(rawMetadata.mode) : '';
    if (rawMode && rawMode !== 'shared' && rawMode !== 'perPlayer') {
        return projectLegacyUnknownModeRoomDeck(rawMetadata, snapshotSizes);
    }
    return projectPublicRoomDeck(normalizeLocalRoomDeckMetadata(rawMetadata), snapshotSizes);
}

function toPublicRoomBoardConfig(room: any) {
    return MatchAuthority.resolveRoomBoardConfig(room);
}

function toPublicNetworkDebugEnabled(room: any) {
    return false;
}

function toPublicNetworkAutoEnabled(room: any) {
    return !!(room && room.networkAutoEnabled === true);
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
    return MatchAuthority.parseNetworkChatMessage(value);
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
        let settled = false;
        req.on('data', (chunk: any) => {
            if (settled) return;
            raw += chunk;
            if (raw.length > 5 * 1024 * 1024) {
                settled = true;
                const error = new Error('payload_too_large');
                reject(error);
                if (req && typeof req.destroy === 'function') {
                    req.destroy(error);
                }
            }
        });
        req.on('end', () => {
            if (settled) return;
            settled = true;
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
        req.on('error', (error: any) => {
            if (settled) return;
            settled = true;
            reject(error);
        });
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
    const publishViewerArtifacts = meta && meta.__publishViewerArtifacts && typeof meta.__publishViewerArtifacts === 'object'
        ? meta.__publishViewerArtifacts
        : {};
    const cachedPayloads = publishViewerArtifacts.snapshotPayloads && typeof publishViewerArtifacts.snapshotPayloads === 'object'
        ? publishViewerArtifacts.snapshotPayloads
        : {};
    const hasPublishViewerArtifacts = Object.keys(publishViewerArtifacts).length > 0;
    const payloadByViewer = hasPublishViewerArtifacts ? cachedPayloads : {};
    if (!payloadByViewer.black) payloadByViewer.black = buildSnapshotPayload(room, meta, { role: 'seat', seatKey: 'black' });
    if (!payloadByViewer.white) payloadByViewer.white = buildSnapshotPayload(room, meta, { role: 'seat', seatKey: 'white' });
    if (!payloadByViewer.spectator) payloadByViewer.spectator = buildSnapshotPayload(room, meta, { role: 'spectator', spectatorId: '' });
    if (hasPublishViewerArtifacts) publishViewerArtifacts.snapshotPayloads = payloadByViewer;
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
        fallbackPayload: payloadByViewer.spectator
    };
}

function stagePreparedSnapshotBroadcast(room: any, preparedSnapshot: any) {
    if (!room || !preparedSnapshot || preparedSnapshot.stagedForPersistence === true) return false;
    rememberBufferedRoomEvent(room, preparedSnapshot.record);
    preparedSnapshot.stagedForPersistence = true;
    return true;
}

function broadcastPreparedSnapshot(room: any, preparedSnapshot: any) {
    if (!room || !preparedSnapshot) return;
    stagePreparedSnapshotBroadcast(room, preparedSnapshot);
    if (!room.streams || room.streams.size === 0) return;
    for (const [streamId, streamInfo] of room.streams.entries()) {
        const viewer = streamInfo && streamInfo.viewer
            ? streamInfo.viewer
            : (streamInfo && streamInfo.seatKey ? { role: 'seat', seatKey: streamInfo.seatKey } : { role: 'spectator', spectatorId: '' });
        const payloadKey = MatchAuthority.getPayloadKeyForViewer(viewer);
        const payload = preparedSnapshot.payloadByViewer[payloadKey]
            ? preparedSnapshot.payloadByViewer[payloadKey]
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
    } else if (room.streams.size === 0) {
        MatchRoomLobby.markRoomInactive(room, Date.now());
    }
    stopHeartbeatLoopIfIdle();
}

function pruneClosedRoomStreams(room: any) {
    if (!room || !room.streams) return;
    for (const [streamId, streamInfo] of Array.from(room.streams.entries()) as any[]) {
        const res = streamInfo && streamInfo.res;
        if (res && !res.writableEnded && !res.destroyed) continue;
        removeStream(room, streamId);
    }
}

function safeWriteToStream(room: any, streamId: any, eventName: any, payload: any, eventId: any) {
    const streamInfo = room && room.streams ? room.streams.get(streamId) : null;
    if (!streamInfo || !streamInfo.res || streamInfo.res.writableEnded || streamInfo.res.destroyed) {
        removeStream(room, streamId);
        return;
    }
    try {
        const wirePayload = String(eventName || '').trim().toLowerCase() === 'snapshot'
            ? PresentationEnvelopeContract.compactNetworkPresentationEnvelope(
                payload,
                streamInfo.presentationEnvelopeVersion
            )
            : payload;
        writeSse(streamInfo.res, eventName, wirePayload, eventId);
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
            for (const streamId of Array.from(room.streams.keys())) {
                safeWriteToStream(room, streamId, 'heartbeat', payload, null);
            }
        }
        stopHeartbeatLoopIfIdle();
    }, SSE_HEARTBEAT_INTERVAL_MS);
    if (heartbeatIntervalId && typeof heartbeatIntervalId.unref === 'function') {
        heartbeatIntervalId.unref();
    }
}

function buildSnapshotPayload(room: any, meta: any, viewer: any) {
    const serverTime = Date.now();
    const viewerRole = viewer && viewer.role === 'spectator' ? 'spectator' : 'seat';
    const publishViewerArtifacts = meta && meta.__publishViewerArtifacts && typeof meta.__publishViewerArtifacts === 'object'
        ? meta.__publishViewerArtifacts
        : {};
    const artifactSnapshots = publishViewerArtifacts.projectedSnapshots && typeof publishViewerArtifacts.projectedSnapshots === 'object'
        ? publishViewerArtifacts.projectedSnapshots
        : {};
    const artifactSnapshot = artifactSnapshots[MatchAuthority.getPayloadKeyForViewer(viewer)];
    return MatchAuthority.buildSnapshotPayloadFromRoom(room, {
        viewerRole,
        snapshot: artifactSnapshot && typeof artifactSnapshot === 'object'
            ? deepClone(artifactSnapshot)
            : toPublicSnapshotForViewer(room, viewer),
        roomDeck: toPublicRoomDeck(room),
        roomBoardConfig: toPublicRoomBoardConfig(room),
        networkDebugEnabled: toPublicNetworkDebugEnabled(room),
        turnTimer: toPublicTurnTimer(room, serverTime),
        playbackEvents: Array.isArray(meta && meta.playbackEvents) ? meta.playbackEvents : [],
        effectLogs: MatchAuthority.normalizeEffectLogMessages(meta && meta.effectLogs),
        playbackDiagnostics: MatchAuthority.toDebugPlaybackDiagnostics(meta && meta.playbackDiagnostics, toPublicNetworkDebugEnabled(room)),
        autoPassNotice: meta && meta.autoPassNotice ? meta.autoPassNotice : null,
        presentationCursor: buildPresentationCursor(room),
        presentationFrames: buildPresentationFramesForViewer(room, viewer, meta || {}),
        operationId: meta && meta.operationId ? String(meta.operationId) : null,
        playerKey: meta && meta.playerKey ? normalizePlayerKey(meta.playerKey) : null,
        actionType: meta && meta.actionType ? String(meta.actionType) : null,
        serverTime
    });
}

function resolveAutoPassNoticeForCommand(actionType: any, action: any, playerKey: any) {
    const actionRecord: any = (action && typeof action === 'object') ? action : {};
    const normalizedActionType = String(actionType || actionRecord.type || '').trim().toLowerCase();
    if (normalizedActionType !== 'pass' || actionRecord.autoNoActionPass !== true) return null;
    return {
        playerKey: normalizePlayerKey(actionRecord.playerKey || playerKey),
        reason: 'no_legal_moves_or_usable_cards'
    };
}

function resolveAutoPassNoticeForPublishBody(actionType: any, body: any, playerKey: any) {
    const source: any = (body && typeof body === 'object') ? body : {};
    const params: any = (source.params && typeof source.params === 'object') ? source.params : {};
    const action: any = (source.action && typeof source.action === 'object') ? source.action : {};
    const normalizedActionType = String(actionType || source.actionType || action.type || action.actionType || '').trim().toLowerCase();
    const autoNoActionPass = params.autoNoActionPass === true || action.autoNoActionPass === true || source.autoNoActionPass === true;
    if (normalizedActionType !== 'pass' || autoNoActionPass !== true) return null;
    return {
        playerKey: normalizePlayerKey(action.playerKey || source.playerKey || source.actor || playerKey),
        reason: 'no_legal_moves_or_usable_cards'
    };
}

function buildPresencePayload(room: any, meta: any) {
    const serverTime = Date.now();
    const metaRecord = meta && typeof meta === 'object' ? meta : {};
    return MatchAuthority.buildPresencePayloadFromRoom(room, Object.assign({}, metaRecord, {
        roomDeck: toPublicRoomDeck(room),
        roomBoardConfig: toPublicRoomBoardConfig(room),
        networkDebugEnabled: toPublicNetworkDebugEnabled(room),
        networkAutoEnabled: toPublicNetworkAutoEnabled(room),
        turnTimer: toPublicTurnTimer(room, serverTime),
        serverTime
    }));
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
        const viewer = streamInfo && streamInfo.viewer
            ? streamInfo.viewer
            : (streamInfo && streamInfo.seatKey ? { role: 'seat', seatKey: streamInfo.seatKey } : null);
        if (!viewer || viewer.role !== 'seat' || viewer.seatKey !== seatKey) continue;
        room.streams.delete(streamId);
        try { streamInfo.res.end(); } catch (e) { /* ignore */ }
    }
    if (room.streams.size === 0 && (room.seats.black || room.seats.white)) {
        MatchRoomLobby.markRoomInactive(room, Date.now());
    }
    stopHeartbeatLoopIfIdle();
}

function closeRoomStreams(room: any) {
    if (!room || !room.streams) return;
    for (const [streamId, streamInfo] of Array.from(room.streams.entries()) as any[]) {
        room.streams.delete(streamId);
        try { streamInfo.res.end(); } catch (e) { /* ignore */ }
    }
    stopHeartbeatLoopIfIdle();
}

function deleteRoom(roomId: string, room: any) {
    closeRoomStreams(room);
    rooms.delete(roomId);
}

function expireRoomIfNeeded(roomId: string, room: any, nowMs = Date.now()) {
    if (!room) return true;
    pruneClosedRoomStreams(room);
    if (MatchRoomLobby.isWaitingRoomExpired(room, nowMs)) {
        deleteRoom(roomId, room);
        return true;
    }
    if (room.streams && room.streams.size > 0) {
        MatchRoomLobby.clearRoomInactive(room);
        return false;
    }
    if (MatchRoomLobby.isInactiveRoomExpired(room, nowMs)) {
        deleteRoom(roomId, room);
        return true;
    }
    return false;
}

function disposeExpiredRooms(nowMs = Date.now()) {
    for (const [roomId, room] of Array.from(rooms.entries()) as any[]) {
        expireRoomIfNeeded(roomId, room, nowMs);
    }
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

    const nowMs = Date.now();
    const seed = nowMs;
    const initialSnapshotOptions: any = buildInitialDeckSnapshotOptions(opts);
    const snapshot = makeInitialSnapshot(seed, initialSnapshotOptions);
    const boardContractInspection = MatchAuthority.normalizeSnapshotBoardContract(snapshot, {
        allowLegacy: true,
        requireFullSnapshot: true
    });
    if (!boardContractInspection || boardContractInspection.ok !== true) {
        throw new Error(`initial_snapshot_invalid_board_contract: ${(boardContractInspection && boardContractInspection.errors || []).join('; ')}`);
    }
    const initialDeckCardIdsByPlayer = cloneInitialDeckCardIdsByPlayer(initialSnapshotOptions.initialDeckCardIdsByPlayer);
    const room = {
        roomId,
        seed,
        snapshot,
        authoritativeStateHash: MatchAuthority.computeAuthoritativeStateHash(snapshot),
        stateVersion: 0,
        seats: { black: false, white: false },
        seatNames: { black: '', white: '' },
        seatHandSkins: { black: '', white: '' },
        seatPlayerIds: { black: '', white: '' },
        seatTokens: { black: makeSeatToken(), white: makeSeatToken() },
        spectators: {},
        maxSpectators: MatchAuthority.MAX_SPECTATORS || 4,
        roomName: MatchRoomLobby.resolveRoomName(opts.roomName),
        roomPassword: MatchRoomLobby.normalizeRoomPassword(opts.roomPassword),
        initialDeckCardIdsByPlayer: (initialDeckCardIdsByPlayer.black || initialDeckCardIdsByPlayer.white)
            ? initialDeckCardIdsByPlayer
            : null,
        roomDeck: opts.roomDeck && typeof opts.roomDeck === 'object' ? deepClone(opts.roomDeck) : null,
        roomBoardConfig: initialSnapshotOptions.boardConfig || MatchAuthority.normalizeRoomBoardConfig(null),
        stoneSupplyEnabled: initialSnapshotOptions.stoneSupplyEnabled,
        networkDebugEnabled: false,
        networkAutoEnabled: opts.networkAutoEnabled === true,
        allCardsDeckEnabled: opts.allCardsDeckEnabled === true,
        publishResponseMode: MatchAuthority.normalizePublishResponseMode(opts.publishResponseMode),
        turnTimer: createPausedTurnTimer({
            snapshot,
            turnTimer: { limitSeconds: MatchAuthority.normalizeNetworkTurnLimitSeconds(opts.turnTimeSeconds) }
        }),
        lastAcceptedOperationBySeat: { black: null, white: null },
        eventSeq: 0,
        sseEventBuffer: [],
        authorityLog: [],
        chatMessages: [],
        chatSeq: 0,
        streams: new Map(),
        createdAt: nowMs,
        updatedAt: nowMs
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
    const previousStateVersion = Number.isFinite(Number(room.stateVersion))
        ? Math.max(0, Math.trunc(Number(room.stateVersion)))
        : 0;
    const previousUpdatedAt = room.updatedAt;
    const previousAuthoritativeStateHash = room.authoritativeStateHash;
    const expectedTurnDeadlineAt = deadline;

    const timeoutPassResult = applyTimeoutPassToSnapshot(room, timedOutSeatKey);
    if (!timeoutPassResult || timeoutPassResult.ok !== true || !timeoutPassResult.snapshot) {
        return { applied: false };
    }
    ensureInitialPresentationSnapshots(room);
    const nextSnapshot = deepClone(timeoutPassResult.snapshot);
    const serverPlaybackEvents = Array.isArray(timeoutPassResult.playbackEvents)
        ? timeoutPassResult.playbackEvents
        : [];
    const serverEffectLogs = Array.isArray(timeoutPassResult.effectLogs)
        ? timeoutPassResult.effectLogs
        : [];
    const serverPlaybackDiagnostics = timeoutPassResult.playbackDiagnostics || null;

    const latestTimer = room.turnTimer && typeof room.turnTimer === 'object' ? room.turnTimer : null;
    const latestDeadline = Number(latestTimer && latestTimer.turnDeadlineAt);
    const latestTimedOutSeatKey = parseSeatKeyOptional(latestTimer && latestTimer.turnSeatKey)
        || resolveTurnSeatKey(room);
    if (
        Number(room.stateVersion) !== previousStateVersion
        || resolveTurnSeatKey(room) !== currentTurnSeatKey
        || !latestTimer
        || latestTimer.active !== true
        || latestTimedOutSeatKey !== timedOutSeatKey
        || !Number.isFinite(latestDeadline)
        || latestDeadline !== expectedTurnDeadlineAt
    ) {
        return { applied: false };
    }

    room.stateVersion = previousStateVersion + 1;
    nextSnapshot.stateVersion = room.stateVersion;
    nextSnapshot.updatedAt = nowMs;
    const boardContractInspection = MatchAuthority.normalizeSnapshotBoardContract(nextSnapshot, {
        allowLegacy: true,
        requireFullSnapshot: true
    });
    if (!boardContractInspection || boardContractInspection.ok !== true) {
        room.stateVersion = previousStateVersion;
        throw new Error(`timeout_invalid_board_contract: ${(boardContractInspection && boardContractInspection.errors || []).join('; ')}`);
    }
    room.snapshot = nextSnapshot;
    room.updatedAt = nowMs;
    const publishViewerArtifacts = MatchAuthority.buildPublishViewerArtifacts(room, {});
    room.authoritativeStateHash = publishViewerArtifacts && publishViewerArtifacts.canonicalHash
        ? publishViewerArtifacts.canonicalHash
        : MatchAuthority.computeAuthoritativeStateHash(nextSnapshot);
    const operationId = `timeout_${room.stateVersion}_${nowMs}`;
    const presentationFrameEntry = appendPresentationFrameForAcceptedPublish(room, {
        previousStateVersion,
        nextStateVersion: room.stateVersion,
        operationId,
        actorSeatKey: timedOutSeatKey,
        actionType: 'timeout_pass',
        playbackEvents: serverPlaybackEvents,
        effectLogs: serverEffectLogs,
        playbackDiagnostics: serverPlaybackDiagnostics,
        publishViewerArtifacts,
        createdAt: nowMs
    });
    if (!presentationFrameEntry) {
        room.stateVersion = previousStateVersion;
        room.snapshot = snapshot;
        room.updatedAt = previousUpdatedAt;
        room.authoritativeStateHash = previousAuthoritativeStateHash;
        throw new Error('timeout_presentation_frame_required');
    }
    MatchAuthority.appendAuthorityLog(room, {
        kind: 'timeout_applied',
        actionType: 'timeout_pass',
        committedVersion: room.stateVersion,
        stateHashAfter: room.authoritativeStateHash,
        timeoutReason: 'turn_deadline_expired'
    });
    MatchAuthority.stripTransientChargeDeltaState(room.snapshot);
    refreshTurnTimer(room, { nowMs, forceRestart: true });
    broadcastSnapshot(room, {
        playerKey: timedOutSeatKey,
        actionType: 'timeout_pass',
        autoPassNotice: { playerKey: timedOutSeatKey, reason: 'timeout_pass' },
        playbackEvents: serverPlaybackEvents,
        effectLogs: serverEffectLogs,
        playbackDiagnostics: serverPlaybackDiagnostics,
        operationId,
        presentationFrameEntry,
        __publishViewerArtifacts: publishViewerArtifacts
    });
    return { applied: true, stateVersion: room.stateVersion };
}

const PLAYER_ID_TOKEN_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_-';
const RECOVERY_CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ234567';

function randomFromChars(chars: string, length: number) {
    if (!chars || !Number.isInteger(length) || length <= 0) return '';
    if (chars.length > 256) throw new Error('randomFromChars charset must contain at most 256 characters.');
    const maxUnbiasedByte = Math.floor(256 / chars.length) * chars.length;
    let out = '';
    while (out.length < length) {
        const bytes = nodeCrypto.randomBytes(Math.max(16, length - out.length));
        for (const byte of bytes) {
            if (byte >= maxUnbiasedByte) continue;
            out += chars[byte % chars.length];
            if (out.length >= length) break;
        }
    }
    return out;
}

function makeLocalPlayerId() {
    return `p_${randomFromChars(PLAYER_ID_TOKEN_CHARS, 26)}`;
}

function makeLocalPlayerToken() {
    return `pt_${randomFromChars(PLAYER_ID_TOKEN_CHARS, 43)}`;
}

function makeLocalRecoveryCode() {
    const raw = randomFromChars(RECOVERY_CODE_CHARS, 25);
    return `CR-${raw.slice(0, 5)}-${raw.slice(5, 10)}-${raw.slice(10, 15)}-${raw.slice(15, 20)}-${raw.slice(20, 25)}`;
}

function sha256HexLocal(value: string) {
    return nodeCrypto.createHash('sha256').update(value).digest('hex');
}

function equalHexLocal(left: string, right: string) {
    if (left.length !== right.length) return false;
    let diff = 0;
    for (let i = 0; i < left.length; i += 1) {
        diff |= left.charCodeAt(i) ^ right.charCodeAt(i);
    }
    return diff === 0;
}

function findLocalIdentityByRecoveryCode(recoveryCode: string) {
    const recoveryHash = sha256HexLocal(recoveryCode);
    for (const record of playerIdentityRecords.values()) {
        if (record && equalHexLocal(String(record.recoveryHash || ''), recoveryHash)) return record;
    }
    return null;
}

function verifyLocalPlayerIdentity(playerIdValue: any, playerTokenValue: any) {
    const playerId = PlayerIdentityContract.normalizePlayerId(playerIdValue);
    const playerToken = PlayerIdentityContract.normalizePlayerToken(playerTokenValue);
    if (!playerId || !playerToken) return null;
    const record = playerIdentityRecords.get(playerId);
    if (!record) return null;
    const tokenHash = sha256HexLocal(playerToken);
    if (!equalHexLocal(String(record.tokenHash || ''), tokenHash)) return null;
    const nowMs = Date.now();
    record.lastSeenAt = nowMs;
    record.updatedAt = nowMs;
    return playerId;
}

function verifyLocalPlayerIdentityFromBody(body: any) {
    const playerId = PlayerIdentityContract.normalizePlayerId(body && body.playerId);
    const playerToken = PlayerIdentityContract.normalizePlayerToken(body && body.playerToken);
    if (!playerId && !playerToken) return { ok: true, playerId: '' };
    if (!playerId || !playerToken) return { ok: false, reason: 'PLAYER_ID_TOKEN_INVALID' };
    const verifiedPlayerId = verifyLocalPlayerIdentity(playerId, playerToken);
    return verifiedPlayerId
        ? { ok: true, playerId: verifiedPlayerId }
        : { ok: false, reason: 'PLAYER_ID_TOKEN_INVALID' };
}

async function handlePlayerIdentityCreate(req: any, res: any) {
    await parseBody(req);
    let playerId = makeLocalPlayerId();
    while (playerIdentityRecords.has(playerId)) playerId = makeLocalPlayerId();
    const playerToken = makeLocalPlayerToken();
    const recoveryCode = makeLocalRecoveryCode();
    const nowMs = Date.now();
    playerIdentityRecords.set(playerId, {
        playerId,
        tokenHash: sha256HexLocal(playerToken),
        recoveryHash: sha256HexLocal(recoveryCode),
        createdAt: nowMs,
        updatedAt: nowMs,
        lastSeenAt: nowMs
    });
    writeJson(res, 200, { ok: true, playerId, playerToken, recoveryCode, serverTime: nowMs });
}

async function handlePlayerIdentityVerify(req: any, res: any) {
    const body = await parseBody(req);
    const playerId = verifyLocalPlayerIdentity(body.playerId, body.playerToken);
    if (!playerId) {
        writeJson(res, 403, { ok: false, reason: 'PLAYER_ID_TOKEN_INVALID' });
        return;
    }
    writeJson(res, 200, { ok: true, playerId, serverTime: Date.now() });
}

async function handlePlayerIdentityRecover(req: any, res: any) {
    const body = await parseBody(req);
    const recoveryCode = PlayerIdentityContract.normalizeRecoveryCode(body.recoveryCode);
    if (!recoveryCode) {
        writeJson(res, 403, { ok: false, reason: 'RECOVERY_CODE_INVALID' });
        return;
    }
    const record = findLocalIdentityByRecoveryCode(recoveryCode);
    if (!record) {
        writeJson(res, 403, { ok: false, reason: 'RECOVERY_CODE_INVALID' });
        return;
    }
    const playerToken = makeLocalPlayerToken();
    const nextRecoveryCode = makeLocalRecoveryCode();
    const nowMs = Date.now();
    record.tokenHash = sha256HexLocal(playerToken);
    record.recoveryHash = sha256HexLocal(nextRecoveryCode);
    record.updatedAt = nowMs;
    record.lastSeenAt = nowMs;
    writeJson(res, 200, {
        ok: true,
        playerId: record.playerId,
        playerToken,
        recoveryCode: nextRecoveryCode,
        serverTime: nowMs
    });
}

async function handlePlayerIdentityRegenerateRecovery(req: any, res: any) {
    const body = await parseBody(req);
    const playerId = PlayerIdentityContract.normalizePlayerId(body.playerId);
    const playerToken = PlayerIdentityContract.normalizePlayerToken(body.playerToken);
    if (!playerId || !playerToken) {
        writeJson(res, 403, { ok: false, reason: 'PLAYER_ID_TOKEN_INVALID' });
        return;
    }
    const record = playerIdentityRecords.get(playerId);
    const tokenHash = sha256HexLocal(playerToken);
    if (!record || !equalHexLocal(String(record.tokenHash || ''), tokenHash)) {
        writeJson(res, 403, { ok: false, reason: 'PLAYER_ID_TOKEN_INVALID' });
        return;
    }
    const recoveryCode = makeLocalRecoveryCode();
    const nowMs = Date.now();
    record.recoveryHash = sha256HexLocal(recoveryCode);
    record.updatedAt = nowMs;
    record.lastSeenAt = nowMs;
    writeJson(res, 200, { ok: true, playerId, recoveryCode, serverTime: nowMs });
}

async function handleCreate(req: any, res: any) {
    const body = await parseBody(req);
    const verifiedIdentity = verifyLocalPlayerIdentityFromBody(body);
    if (!verifiedIdentity.ok) {
        writeJson(res, 403, { ok: false, reason: verifiedIdentity.reason });
        return;
    }
    const playerName = normalizeNetworkPlayerName(body.playerName) || MatchRoomLobby.createRandomPlayerName();
    const selectedHandSkinId = normalizeSeatHandSkinId(body.selectedHandSkinId);
    const networkDebugEnabled = false;
    const roomName = MatchRoomLobby.resolveRoomName(body.roomName);
    const roomPassword = MatchRoomLobby.normalizeRoomPassword(body.roomPassword);
    const roomBoardConfig = MatchAuthority.normalizeRoomBoardConfig(body.roomBoardConfig);
    const publishResponseMode = MatchAuthority.normalizePublishResponseMode(body.publishResponseMode);
    const allCardsDeckEnabled = body.allCardsDeckEnabled === true;
    const allCardsDeckCardIdsByPlayer = allCardsDeckEnabled ? createAllCardsDeckCardIdsByPlayer() : null;
    const roomDeck = allCardsDeckEnabled
        ? createAllCardsRoomDeckMetadataFromRuntimeCardIds(allCardsDeckCardIdsByPlayer)
        : null;
    const deckSelection = allCardsDeckEnabled
        ? { ok: true, hasCustomDeck: false, deckSpec: null, deckCode: '', deckSize: null }
        : resolveDeckSelection(body.deckCode);
    if (!deckSelection.ok) {
        writeJson(res, 400, { ok: false, reason: deckSelection.reason || 'DECK_CODE_INVALID' });
        return;
    }

    if (allCardsDeckEnabled && (!allCardsDeckCardIdsByPlayer || !allCardsDeckCardIdsByPlayer.black.length)) {
        writeJson(res, 500, { ok: false, reason: 'ALL_CARDS_DECK_UNAVAILABLE' });
        return;
    }

    const room = makeRoom({
        networkDebugEnabled,
        allCardsDeckEnabled,
        initialDeckCardIdsByPlayer: allCardsDeckCardIdsByPlayer,
        roomDeck,
        roomBoardConfig,
        stoneSupplyEnabled: body.stoneSupplyEnabled,
        roomName,
        roomPassword,
        publishResponseMode,
        turnTimeSeconds: MatchAuthority.normalizeNetworkTurnLimitSeconds(body.turnTimeSeconds)
    });
    room.seats.black = true;
    room.seatNames.black = playerName;
    room.seatHandSkins.black = selectedHandSkinId;
    room.seatPlayerIds = PlayerIdentityContract.normalizeSeatPlayerIds(room.seatPlayerIds);
    room.seatPlayerIds.black = verifiedIdentity.playerId;
    if (!allCardsDeckEnabled && deckSelection.hasCustomDeck) {
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
        networkAutoEnabled: toPublicNetworkAutoEnabled(room),
        stateVersion: room.stateVersion,
        snapshot: toPublicSnapshot(room, 'black'),
        turnTimer: toPublicTurnTimer(room, serverTime),
        serverTime
    }));
}

async function handleJoin(req: any, res: any) {
    const body = await parseBody(req);
    let activeRoom: any = null;
    const controller = createMatchJoinController({
        verifyIdentity: verifyLocalPlayerIdentityFromBody,
        validatePlayerNameBeforeRoom: true,
        normalizeNetworkPlayerName,
        loadRoom: (incomingBody: any) => {
            const roomId = String((incomingBody && incomingBody.roomId) || '').trim().toUpperCase();
            if (!roomId || !rooms.has(roomId)) return;
            const existingRoom = rooms.get(roomId);
            if (expireRoomIfNeeded(roomId, existingRoom, Date.now())) return;
            activeRoom = rooms.get(roomId) || null;
        },
        getRoom: () => activeRoom,
        expireRoomIfNeeded: () => false,
        resolveDeckSelection,
        resolvePlayerId: (_incomingBody: any, verifiedIdentity: any) => verifiedIdentity.playerId,
        normalizeSeatHandSkinId,
        parseSeatKeyOptional,
        resolveAuthenticatedSeatKey,
        isJoinPasswordAccepted: MatchRoomLobby.isJoinPasswordAccepted,
        resolveSeatForJoin,
        makeSeatToken,
        hasTwoActiveSeats,
        setSeatJoined: (room: any, seatKey: any) => {
            room.seats[seatKey] = true;
        },
        setSeatName: (room: any, seatKey: any, playerName: any) => {
            room.seatNames[seatKey] = playerName;
        },
        toPublicSeatHandSkins,
        normalizeSeatPlayerIds: PlayerIdentityContract.normalizeSeatPlayerIds,
        isAllCardsDeckRoom,
        assignRoomDeckSelection,
        makeInitialSnapshot,
        buildInitialDeckSnapshotOptions,
        refreshTurnTimer,
        saveRoom: () => undefined,
        broadcastSnapshot: (meta: any) => broadcastSnapshot(activeRoom, meta),
        broadcastPresence: (meta: any) => broadcastPresence(activeRoom, meta),
        MatchAuthority,
        toPublicRoomDeck,
        toPublicRoomBoardConfig,
        toPublicNetworkDebugEnabled,
        toPublicNetworkAutoEnabled,
        toPublicSnapshot,
        toPublicTurnTimer,
        decorateRoomPayload: (payload: any) => payload,
        jsonResponse: (status: number, payload: any) => ({ status, payload })
    });
    const result = await controller.handleJoin(body);
    writeJson(res, result.status, result.payload);
}

function handleList(_req: any, res: any) {
    const nowMs = Date.now();
    disposeExpiredRooms(nowMs);
    const roomsList = MatchRoomLobby.sortRoomListEntries(
        Array.from(rooms.values())
            .map((room) => MatchRoomLobby.toPublicRoomListEntry(room, { nowMs }))
            .filter(Boolean)
    );
    writeJson(res, 200, { ok: true, rooms: roomsList });
}

function createLocalMatchLeaveController() {
    let activeRoom: any = null;
    let activeRoomId = '';
    return createMatchLeaveController({
        loadRoom: (body: any) => {
            activeRoomId = String((body && body.roomId) || '').trim().toUpperCase();
            activeRoom = rooms.get(activeRoomId) || null;
            if (activeRoom && expireRoomIfNeeded(activeRoomId, activeRoom, Date.now())) activeRoom = null;
        },
        getRoom: () => activeRoom,
        expireRoomIfNeeded: () => false,
        normalizePlayerKey,
        resolveAuthenticatedSeatKey,
        classifySeatTokenRejectionReason,
        makeSeatToken,
        MatchAuthority,
        refreshTurnTimer,
        closeStreamsForSeat: (room: any, seatKey: any) => closeSeatStreams(room, seatKey),
        broadcastPresence: (meta: any) => broadcastPresence(activeRoom, meta),
        getStreamCount: (room: any) => room.streams.size,
        removeRoom: () => rooms.delete(activeRoomId),
        saveRoom: () => undefined,
        toPublicRoomBoardConfig,
        toPublicTurnTimer,
        decorateRoomPayload: (payload: any) => payload,
        jsonResponse: (status: number, payload: any) => ({ status, payload })
    });
}

async function handleLeave(req: any, res: any) {
    const body = await parseBody(req);
    const result = await createLocalMatchLeaveController().handleLeave(body);
    writeJson(res, result.status, result.payload);
}

async function handleSpectate(req: any, res: any) {
    const body = await parseBody(req);
    let activeRoom: any = null;
    const controller = createMatchSpectateController({
        loadRoom: async (incomingBody: any) => {
            const roomId = String((incomingBody && incomingBody.roomId) || '').trim().toUpperCase();
            activeRoom = rooms.get(roomId) || null;
            if (activeRoom && expireRoomIfNeeded(roomId, activeRoom, Date.now())) activeRoom = null;
        },
        getRoom: () => activeRoom,
        expireRoomIfNeeded: () => false,
        isJoinPasswordAccepted: MatchRoomLobby.isJoinPasswordAccepted,
        MatchAuthority,
        makeSpectatorToken,
        makeSpectatorId,
        saveRoom: async () => undefined,
        broadcastPresence: (meta: any) => broadcastPresence(activeRoom, meta),
        toPublicSnapshotForViewer,
        toPublicRoomDeck,
        toPublicRoomBoardConfig,
        toPublicNetworkDebugEnabled,
        toPublicNetworkAutoEnabled,
        toPublicTurnTimer,
        decorateRoomPayload: (payload: any) => payload,
        jsonResponse: (status: number, payload: any) => ({ status, payload })
    });
    const result = await controller.handleSpectate(body);
    writeJson(res, result.status, result.payload);
}

async function handleSpectatorLeave(req: any, res: any) {
    const body = await parseBody(req);
    const result = await createLocalMatchLeaveController().handleSpectatorLeave(body);
    writeJson(res, result.status, result.payload);
}

function createLocalMatchRoomPreferencesController() {
    let activeRoom: any = null;
    let activeRoomId = '';
    return createMatchRoomPreferencesController({
        loadRoom: (body: any) => {
            activeRoomId = String((body && body.roomId) || '').trim().toUpperCase();
            activeRoom = rooms.get(activeRoomId) || null;
            if (activeRoom && expireRoomIfNeeded(activeRoomId, activeRoom, Date.now())) activeRoom = null;
        },
        getRoom: () => activeRoom,
        expireRoomIfNeeded: () => false,
        parseSeatKeyOptional,
        resolveAuthenticatedSeatKey,
        classifySeatTokenRejectionReason,
        isSeatJoined: (room: any, seatKey: any) => !!room.seats[seatKey],
        normalizeSeatHandSkinId,
        toPublicSeatHandSkins,
        saveRoom: () => undefined,
        broadcastPresence: (meta: any) => broadcastPresence(activeRoom, meta),
        isAllCardsDeckRoom,
        resolveDeckSelection,
        assignRoomDeckSelection,
        MatchAuthority,
        toPublicRoomDeck,
        toPublicRoomBoardConfig,
        toPublicNetworkDebugEnabled,
        toPublicNetworkAutoEnabled,
        includeNetworkAutoEnabledForHandSkin: true,
        includeNetworkAutoEnabledForDeck: false,
        toPublicTurnTimer,
        decorateRoomPayload: (payload: any) => payload,
        jsonResponse: (status: number, payload: any) => ({ status, payload })
    });
}

async function handleHandSkin(req: any, res: any) {
    const body = await parseBody(req);
    const result = await createLocalMatchRoomPreferencesController().handleHandSkin(body);
    writeJson(res, result.status, result.payload);
}

async function handleDeck(req: any, res: any) {
    const body = await parseBody(req);
    const result = await createLocalMatchRoomPreferencesController().handleDeck(body);
    writeJson(res, result.status, result.payload);
}

async function handlePublish(req: any, res: any) {
    const body = await parseBody(req);
    let activeRoom: any = null;

    const controller = createMatchPublishController({
        loadRoom: async (incomingBody: any) => {
            const roomId = String((incomingBody && incomingBody.roomId) || '').trim().toUpperCase();
            activeRoom = rooms.get(roomId) || null;
            if (activeRoom && expireRoomIfNeeded(roomId, activeRoom, Date.now())) {
                activeRoom = null;
            }
        },
        getRoom: () => activeRoom,
        applyExpiredTurnTimeoutIfNeeded: () => {
            if (activeRoom) applyExpiredTurnTimeoutIfNeeded(activeRoom);
        },
        normalizePlayerKey,
        normalizeOperationId,
        resolveSeatKey: (incomingBody: any) => normalizePlayerKey(incomingBody && incomingBody.seatKey),
        resolvePlayerKey: (incomingBody: any) => normalizePlayerKey(incomingBody && (incomingBody.playerKey || incomingBody.actor)),
        allowFateWillOwnerAction: true,
        isNetworkDebugFillHandPayload,
        resolveAuthenticatedSeatKey,
        ensureAcceptedOperationsBySeat,
        asRecord: (value: any) => value && typeof value === 'object' ? value : {},
        MatchAuthority,
        buildPublishPayload,
        getCurrentPlayerKey,
        toPublicNetworkDebugEnabled,
        isSnapshotGameOver: (snapshot: any) => !!(
            snapshot
            && snapshot.gameState
            && Core
            && typeof Core.isGameOver === 'function'
            && Core.isGameOver(snapshot.gameState) === true
        ),
        deepClone,
        catchRematchResetErrors: false,
        makeInitialSnapshot,
        buildInitialDeckSnapshotOptions,
        applyCommandPublishToSnapshot,
        refreshTurnTimer: (options: any) => refreshTurnTimer(activeRoom, options),
        buildPublishViewerArtifacts: (room: any, options: any) => MatchAuthority.buildPublishViewerArtifacts(room, options),
        prepareSnapshotBroadcast: (meta: any) => prepareSnapshotBroadcast(activeRoom, meta),
        stagePreparedSnapshotBroadcast: (preparedSnapshot: any) => stagePreparedSnapshotBroadcast(activeRoom, preparedSnapshot),
        ensureInitialPresentationSnapshots,
        appendPresentationFrameForAcceptedPublish,
        saveRoom: async () => undefined,
        broadcastSnapshot: async (meta: any) => {
            const prepared = meta && meta.__preparedSnapshot
                ? meta.__preparedSnapshot
                : prepareSnapshotBroadcast(activeRoom, meta);
            broadcastPreparedSnapshot(activeRoom, prepared);
        },
        deferSnapshotBroadcast: (broadcastPromise: Promise<unknown>, meta: any) => {
            void broadcastPromise.catch((error: any) => {
                console.error('[local-match] deferred snapshot broadcast failed', {
                    roomId: meta && meta.roomId ? meta.roomId : null,
                    operationId: meta && meta.operationId ? meta.operationId : null,
                    stateVersion: meta && meta.stateVersion ? meta.stateVersion : null,
                    message: error && error.message ? String(error.message) : String(error || '')
                });
            });
        },
        jsonResponse: (status: number, payload: any) => ({ status, payload })
    });

    const result = await controller.handlePublish(body);
    writeJson(res, result.status, result.payload);
}

function validateRematchSeat(room: any, seatKey: any, seatToken: any) {
    if (!room.seats[seatKey]) {
        return { ok: false, status: 403, reason: 'SEAT_NOT_JOINED' };
    }
    if (!seatToken || !room.seatTokens || room.seatTokens[seatKey] !== seatToken) {
        return { ok: false, status: 403, reason: 'SEAT_TOKEN_MISMATCH' };
    }
    return { ok: true, status: 200, reason: '' };
}

function createLocalMatchRematchController() {
    let activeRoom: any = null;
    let activeRoomId = '';
    return createMatchRematchController({
        loadRoom: (body: any) => {
            activeRoomId = String((body && body.roomId) || '').trim().toUpperCase();
            activeRoom = rooms.get(activeRoomId) || null;
            if (activeRoom && expireRoomIfNeeded(activeRoomId, activeRoom, Date.now())) activeRoom = null;
        },
        getRoom: () => activeRoom,
        expireRoomIfNeeded: () => false,
        validateSeat: (room: any, body: any) => {
            const seatKey = normalizePlayerKey(body && body.seatKey);
            const seatToken = String((body && body.seatToken) || '').trim();
            const validation = validateRematchSeat(room, seatKey, seatToken);
            return validation.ok ? { ok: true, seatKey } : validation;
        },
        buildSeatFailurePayload: (room: any, validation: any) => ({
            ok: false,
            reason: validation.reason,
            seats: toPublicSeats(room)
        }),
        hasOpponent: (room: any) => !!room.seats.black && !!room.seats.white,
        buildOpponentRequiredPayload: (room: any) => ({
            ok: false,
            reason: 'OPPONENT_REQUIRED',
            seats: toPublicSeats(room)
        }),
        makeRematchRequestId,
        touchRoom: (room: any) => {
            room.updatedAt = Date.now();
        },
        broadcastPresence: (meta: any) => broadcastPresence(activeRoom, meta),
        buildRequestPayload: (room: any, value: any) => withPublicSeatState(room, {
            ok: true,
            roomId: room.roomId,
            seatKey: value.seatKey,
            requestId: value.requestId,
            roomDeck: toPublicRoomDeck(room),
            roomBoardConfig: toPublicRoomBoardConfig(room),
            networkDebugEnabled: toPublicNetworkDebugEnabled(room),
            turnTimer: toPublicTurnTimer(room, Date.now()),
            serverTime: Date.now()
        }),
        buildResponsePayload: (room: any, value: any) => withPublicSeatState(room, {
            ok: true,
            roomId: room.roomId,
            seatKey: value.seatKey,
            requestId: value.requestId,
            accepted: value.accepted,
            roomDeck: toPublicRoomDeck(room),
            roomBoardConfig: toPublicRoomBoardConfig(room),
            networkDebugEnabled: toPublicNetworkDebugEnabled(room),
            turnTimer: toPublicTurnTimer(room, Date.now()),
            serverTime: Date.now()
        }),
        jsonResponse: (status: number, payload: any) => ({ status, payload })
    });
}

async function handleRematchRequest(req: any, res: any) {
    const body = await parseBody(req);
    const result = await createLocalMatchRematchController().handleRematchRequest(body);
    writeJson(res, result.status, result.payload);
}

async function handleRematchResponse(req: any, res: any) {
    const body = await parseBody(req);
    const result = await createLocalMatchRematchController().handleRematchResponse(body);
    writeJson(res, result.status, result.payload);
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
    if (expireRoomIfNeeded(roomId, room, Date.now())) {
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

function createLocalMatchStateController() {
    let activeRoom: any = null;
    let activeRoomId = '';
    return createMatchStateController({
        loadRoom: (urlObj: any) => {
            activeRoomId = String((urlObj && urlObj.searchParams.get('roomId')) || '').trim().toUpperCase();
            activeRoom = rooms.get(activeRoomId) || null;
            if (activeRoom && expireRoomIfNeeded(activeRoomId, activeRoom, Date.now())) activeRoom = null;
        },
        getRoom: () => activeRoom,
        expireRoomIfNeeded: () => false,
        applyExpiredTurnTimeoutIfNeeded: (room: any) => applyExpiredTurnTimeoutIfNeeded(room),
        applyTimeoutForState: true,
        applyTimeoutForJournal: true,
        getSearchParam: (urlObj: any, key: any) => urlObj.searchParams.get(key),
        getSearchParams: (urlObj: any) => urlObj.searchParams,
        parseSeatKeyOptional,
        resolveAuthenticatedViewer,
        classifyViewerTokenRejectionReason,
        asRecord: (value: any) => value && typeof value === 'object' ? value : {},
        MatchAuthority,
        toPublicRoomDeck,
        toPublicRoomBoardConfig,
        toPublicNetworkDebugEnabled,
        toPublicNetworkAutoEnabled,
        toPublicSnapshotForViewer,
        toPublicTurnTimer,
        buildPresentationCursor,
        normalizePlayerKey,
        jsonResponse: (status: number, payload: any) => ({ status, payload })
    });
}

async function handleState(req: any, res: any, urlObj: any) {
    const result = await createLocalMatchStateController().handleState(urlObj);
    writeJson(res, result.status, result.payload);
}

async function handlePresentationJournal(req: any, res: any, urlObj: any) {
    const result = await createLocalMatchStateController().handlePresentationJournal(urlObj);
    writeJson(res, result.status, result.payload);
}

function createLocalMatchStreamPreparationController() {
    let activeRoom: any = null;
    let activeRoomId = '';
    return createMatchStreamPreparationController({
        loadRoom: (urlObj: any) => {
            activeRoomId = String((urlObj && urlObj.searchParams.get('roomId')) || '').trim().toUpperCase();
            activeRoom = rooms.get(activeRoomId) || null;
            if (activeRoom && expireRoomIfNeeded(activeRoomId, activeRoom, Date.now())) activeRoom = null;
        },
        getRoom: () => activeRoom,
        expireRoomIfNeeded: () => false,
        applyExpiredTurnTimeoutIfNeeded: (room: any) => applyExpiredTurnTimeoutIfNeeded(room),
        getSearchParam: (urlObj: any, key: any) => urlObj.searchParams.get(key),
        getSearchParams: (urlObj: any) => urlObj.searchParams,
        parseSeatKeyOptional,
        resolveAuthenticatedViewer,
        classifyViewerTokenRejectionReason,
        getSseEventBuffer: () => undefined,
        getBufferedSseReplayEvents: MatchAuthority.getBufferedSseReplayEvents,
        jsonResponse: (status: number, payload: any) => ({ status, payload })
    });
}

async function handleStream(req: any, res: any, urlObj: any) {
    const prepared = await createLocalMatchStreamPreparationController().prepareStream(
        urlObj,
        req && req.headers && req.headers['last-event-id']
    );
    if (prepared.response) {
        writeJson(res, prepared.response.status, prepared.response.payload);
        return;
    }
    const { room, viewer, replayEvents } = prepared;
    const roomId = String((urlObj.searchParams.get('roomId') || '')).trim().toUpperCase();

    res.writeHead(200, {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
        'Access-Control-Allow-Origin': '*'
    });

    const streamId = MatchAuthority.makeSseStreamId(Date.now());
    room.streams.set(streamId, {
        res,
        viewer,
        presentationEnvelopeVersion: PresentationEnvelopeContract.normalizePresentationEnvelopeCapability(
            urlObj.searchParams.get('presentationEnvelopeVersion')
        )
    });
    MatchRoomLobby.clearRoomInactive(room);
    ensureHeartbeatLoop();
    const cleanupStream = () => {
        removeStream(room, streamId);
    };

    if (Array.isArray(replayEvents)) {
        if (replayEvents.length > 0) {
            for (const event of replayEvents) {
                safeWriteToStream(room, streamId, event.eventName, event.payload, event.eventId);
            }
        } else {
            safeWriteToStream(room, streamId, 'heartbeat', buildHeartbeatPayload(room, Date.now()), null);
        }

        req.on('close', cleanupStream);
        res.on('close', cleanupStream);
        return;
    }

    safeWriteToStream(room, streamId, 'snapshot', buildSnapshotPayload(room, {
        playbackEvents: [],
        operationId: null,
        playerKey: null,
        actionType: null
    }, viewer), nextSseEventId(room));

    safeWriteToStream(room, streamId, 'chat', withPublicSeatState(room, {
        ok: true,
        roomId,
        type: 'history',
        roomDeck: toPublicRoomDeck(room),
        networkDebugEnabled: toPublicNetworkDebugEnabled(room),
        messages: toPublicChatMessages(room)
    }), nextSseEventId(room));

    req.on('close', cleanupStream);
    res.on('close', cleanupStream);
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

            if (req.method === 'POST' && pathname === '/api/player/identity/create') {
                await handlePlayerIdentityCreate(req, res);
                return;
            }

            if (req.method === 'POST' && pathname === '/api/player/identity/verify') {
                await handlePlayerIdentityVerify(req, res);
                return;
            }

            if (req.method === 'POST' && pathname === '/api/player/identity/recover') {
                await handlePlayerIdentityRecover(req, res);
                return;
            }

            if (req.method === 'POST' && pathname === '/api/player/identity/recovery/regenerate') {
                await handlePlayerIdentityRegenerateRecovery(req, res);
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

            if (req.method === 'POST' && pathname === '/api/match/spectate') {
                await handleSpectate(req, res);
                return;
            }

            if (req.method === 'POST' && pathname === '/api/match/spectator-leave') {
                await handleSpectatorLeave(req, res);
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

            if (req.method === 'POST' && pathname === '/api/match/rematch-request') {
                await handleRematchRequest(req, res);
                return;
            }

            if (req.method === 'POST' && pathname === '/api/match/rematch-response') {
                await handleRematchResponse(req, res);
                return;
            }

            if (req.method === 'POST' && pathname === '/api/match/hand-skin') {
                await handleHandSkin(req, res);
                return;
            }

            if (req.method === 'POST' && pathname === '/api/match/deck') {
                await handleDeck(req, res);
                return;
            }

            if (req.method === 'GET' && pathname === '/api/match/state') {
                await handleState(req, res, urlObj);
                return;
            }

            if (req.method === 'GET' && pathname === '/api/match/presentation-journal') {
                await handlePresentationJournal(req, res, urlObj);
                return;
            }

            if (req.method === 'GET' && pathname === '/api/match/list') {
                handleList(req, res);
                return;
            }

            if (req.method === 'GET' && pathname === '/api/match/stream') {
                await handleStream(req, res, urlObj);
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
    playerIdentityRecords.clear();
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
    applyTimeoutPassToSnapshot,
    makeInitialSnapshot,
    buildInitialDeckSnapshotOptions,
    resetRoomsForTests,
    patchRoomSnapshotForTests,
    startLocalMatchServerFromCli
};

if (require.main === module) {
    startLocalMatchServerFromCli();
}
