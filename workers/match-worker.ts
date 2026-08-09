import { WORKER_RUNTIME_GLOBAL_KEYS } from './match-worker-runtime-preload.js';
import type {
    DurableObjectStateLike,
    MatchWorkerCardLogicModule,
    MatchWorkerCoreModule,
    MatchRoomDurableObjectApi,
    MatchWorkerEntrypoint,
    MatchWorkerDeckGlobals,
    MatchWorkerDeckSelection,
    MatchWorkerEnv,
    MatchWorkerLeaderboardStore,
    MatchWorkerRatingStore,
    MatchWorkerPlaybackAdapter,
    MatchWorkerPlaybackAssembly,
    MatchWorkerPlaybackDiagnostics,
    MatchWorkerPreparedSnapshotBroadcast,
    MatchWorkerPrng,
    MatchWorkerPublicSnapshot,
    MatchWorkerPublishPayloadOptions,
    MatchWorkerPresencePayloadMeta,
    MatchWorkerPublicSeatState,
    MatchWorkerRoomState,
    MatchWorkerRoomCreateOptions,
    MatchWorkerRuntimeModule,
    MatchWorkerSeededPrngModule,
    MatchWorkerSeatValueMap,
    MatchWorkerSseStreamInfo,
    MatchWorkerTurnPipelinePhasesModule,
    MatchWorkerTurnPipelineModule,
    MatchWorkerTurnPipelineModules,
    MatchWorkerSnapshotPayloadMeta,
    MatchWorkerTurnTimeoutResult,
    MatchWorkerTurnTimerOptions,
    MatchWorkerTurnStartModules,
    MatchWorkerRoomDeckMetadata
} from './match-worker-types';

const ModuleExportUtils = require('../shared/module-export-utils');
const MatchRoomLobby = require('../shared/match-room-lobby');
const PlayerIdentityContract = require('../shared/player-identity-contract');
const RatedMatchmaking = require('../shared/rated-matchmaking');
const TurnPipelineFactory = require('../game/turn/turn_pipeline_factory');
import type {
    MatchAuthorityAcceptedOperationsBySeat,
    MatchAuthorityBufferedSseEventRecord,
    MatchAuthorityBufferedSseEventRecordInput,
    MatchAuthorityRoomState,
    MatchAuthoritySeatKey,
    MatchAuthorityViewer
} from '../utils/match-authority-types';
import type { GameState } from '../src/types';
import {
    assertMatchRoomDurableObjectConstructor,
    assertMatchWorkerEntrypoint
} from './match-worker-contract';
import { createMatchWorkerApiController } from './match-worker-api';
import { createMatchWorkerBroadcastController } from './match-worker-broadcast-controller';
import { createMatchWorkerChatController } from './match-worker-chat-controller';
import { createMatchWorkerLeaderboardHelpers } from './match-worker-leaderboard';
import { buildMatchWorkerLeaderboardProof } from './match-worker-leaderboard-proof';
import { createMatchWorkerLeaderboardRoomController } from './match-worker-leaderboard-room';
import { createMatchWorkerPlayerIdentityController } from './match-worker-player-identity';
import { createMatchWorkerRatingHelpers } from './match-worker-rating';
import {
    createMatchWorkerStreamController,
    MATCH_WORKER_SSE_WRITE_TIMEOUT_MS
} from './match-worker-stream-controller';
import { createMatchWorkerStreamRouteController } from './match-worker-stream-route-controller';
import { createMatchWorkerStreamSessionController } from './match-worker-stream-session-controller';
import { createMatchWorkerTimeoutController } from './match-worker-timeout-controller';
import { createMatchWorkerTurnTimerController } from './match-worker-turn-timer-controller';
import { createMatchWorkerTurnTimerHelpers } from './match-worker-turn-timer';
import { createMatchWorkerPublishController } from './match-worker-publish-controller';
import { createMatchSpectateController } from '../utils/match-spectate-controller';
import { createMatchJoinController } from '../utils/match-join-controller';
import { createMatchLeaveController } from '../utils/match-leave-controller';
import { createMatchRoomPreferencesController } from '../utils/match-room-preferences-controller';
import { createMatchRematchController } from '../utils/match-rematch-controller';
import { createMatchStateController } from '../utils/match-state-controller';
import {
    executeMatchCommand
} from '../utils/match-command-runtime';
import type {
    MatchCommandAuthorityContext,
    MatchCommandExecutionCapabilities
} from '../utils/match-runtime-ports';
import {
    buildInitialDeckSnapshotOptions as buildCanonicalInitialDeckSnapshotOptions,
    buildRoomDeckSelectionPatch,
    cloneRoomDeckCardIdsByPlayer,
    cloneRoomDeckSpecByPlayer,
    createAllCardsRoomDeckMetadata as createCanonicalAllCardsRoomDeckMetadata,
    isAllCardsDeckRoom as classifyAllCardsDeckRoom,
    normalizeRoomDeckSize,
    projectPublicRoomDeck,
    type MatchRoomDeckSelectionSuccess
} from '../utils/match-room-deck';
import {
    isMatchAutoTurnPublishBody,
    resolveMatchAutoTurnPublishBody
} from '../utils/match-auto-command';
import deepClone from '../utils/deepClone.js';
import matchAuthority from '../utils/match-authority.js';

const MatchAuthority = matchAuthority;
type MatchWorkerCryptoLike = {
    getRandomValues(array: Uint8Array): Uint8Array;
};
const ROOM_STORAGE_KEY = 'match_room_state_v1';
const LOBBY_STORAGE_KEY = 'match_room_lobby_v1';
const RATED_QUEUE_STORAGE_KEY = 'rated_match_queue_v1';
const RATING_POOL_CARD_RANKED_ROOM_ID = '__rating_pool_card_ranked_v1__';
const RATING_POOL_STORAGE_KEY = 'rating_pool_card_ranked_v1_store_v1';
const CHAT_MAX_LENGTH = Number(MatchAuthority.CHAT_MAX_LENGTH);
const CHAT_HISTORY_LIMIT = Number(MatchAuthority.CHAT_HISTORY_LIMIT);
const NETWORK_PLAYER_NAME_MAX = Number.isFinite(Number(MatchAuthority.NETWORK_PLAYER_NAME_MAX))
    ? Number(MatchAuthority.NETWORK_PLAYER_NAME_MAX)
    : 7;
const LEGACY_LEADERBOARD_STORAGE_KEY = 'global_score_leaderboard_v3';
const LEGACY_TIME_ATTACK_LEADERBOARD_STORAGE_KEY = 'global_time_attack_leaderboard_v1';
const LEGACY_TIME_DEFENSE_LEADERBOARD_STORAGE_KEY = 'global_time_defense_leaderboard_v1';
const LEGACY_SHORTEST_TURNS_LEADERBOARD_STORAGE_KEY = 'global_shortest_turns_leaderboard_v1';
const LEADERBOARD_STORAGE_KEY = 'global_score_leaderboard_v4';
const TIME_ATTACK_LEADERBOARD_STORAGE_KEY = 'global_time_attack_leaderboard_v2';
const TIME_DEFENSE_LEADERBOARD_STORAGE_KEY = 'global_time_defense_leaderboard_v2';
const SHORTEST_TURNS_LEADERBOARD_STORAGE_KEY = 'global_shortest_turns_leaderboard_v2';
const LEADERBOARD_STORAGE_VERSION = 4;
const MATCH_LOBBY_ROOM_ID = '__match_lobby__';
const LEADERBOARD_ROOM_ID = '__leaderboard__';
const PLAYER_IDENTITY_ROOM_ID = '__player_identity__';
const PLAYER_IDENTITY_STORAGE_KEY = 'player_identity_store_v1';
const LEADERBOARD_PLAYER_NAME_MAX = NETWORK_PLAYER_NAME_MAX;
const LEADERBOARD_DEFAULT_LIMIT = 10;
const LEADERBOARD_MAX_LIMIT = 100;
const LEADERBOARD_MAX_STORED_PLAYERS = 200;
const LEADERBOARD_PLAYER_ID_RE = /^[A-Za-z0-9_-]{8,80}$/;
const NETWORK_TURN_LIMIT_SECONDS = Number(MatchAuthority.NETWORK_TURN_LIMIT_SECONDS);
const NETWORK_TURN_LIMIT_MS = Number(MatchAuthority.NETWORK_TURN_LIMIT_MS);
const SSE_HEARTBEAT_INTERVAL_MS = Number(MatchAuthority.SSE_HEARTBEAT_INTERVAL_MS);
const NETWORK_DEBUG_FILL_HAND_ACTION = MatchAuthority.NETWORK_DEBUG_FILL_HAND_ACTION || 'debug_fill_hand';
let coreLogicModulePromise: Promise<MatchWorkerCoreModule> | null = null;
let deckModulesPromise: Promise<MatchWorkerDeckGlobals> | null = null;
let turnStartModulesPromise: Promise<MatchWorkerTurnStartModules> | null = null;
let turnPipelineModulesPromise: Promise<MatchWorkerTurnPipelineModules> | null = null;
let debugActionsModulePromise: Promise<MatchWorkerRuntimeModule> | null = null;
let workerDeckGlobalsPromise: Promise<unknown> | null = null;
let workerRuntimeGlobalsPromise: Promise<void> | null = null;


const CORS_HEADERS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
};

const MatchWorkerLeaderboardHelpers = createMatchWorkerLeaderboardHelpers({
    storageVersion: LEADERBOARD_STORAGE_VERSION,
    playerNameMax: LEADERBOARD_PLAYER_NAME_MAX,
    playerIdPattern: LEADERBOARD_PLAYER_ID_RE,
    defaultLimit: LEADERBOARD_DEFAULT_LIMIT,
    maxLimit: LEADERBOARD_MAX_LIMIT,
    maxStoredPlayers: LEADERBOARD_MAX_STORED_PLAYERS
});

const MatchWorkerTurnTimerHelpers = createMatchWorkerTurnTimerHelpers({
    limitSeconds: NETWORK_TURN_LIMIT_SECONDS,
    limitMs: NETWORK_TURN_LIMIT_MS,
    resolveTurnSeatKey,
    parseSeatKeyOptional,
    asRecord
});

function asRecord(value: unknown): Record<string, unknown> {
    return value && typeof value === 'object' ? value as Record<string, unknown> : {};
}

function asRuntimeModule(value: unknown): MatchWorkerRuntimeModule {
    return value && typeof value === 'object' ? value as MatchWorkerRuntimeModule : {};
}

function unwrapRuntimeModule(value: unknown, depth = 0): unknown {
    if (depth === 0 && ModuleExportUtils && typeof ModuleExportUtils.unwrapModuleExport === 'function') {
        value = ModuleExportUtils.unwrapModuleExport(value);
    }
    if (!value || typeof value !== 'object' || depth > 5) return value;
    const source = asRecord(value);
    const moduleExports = source['module.exports'];
    if (moduleExports && moduleExports !== value) {
        return unwrapRuntimeModule(moduleExports, depth + 1);
    }
    const defaultExport = source.default;
    if (defaultExport && defaultExport !== value) {
        return unwrapRuntimeModule(defaultExport, depth + 1);
    }
    return value;
}

function hasUsableRuntimeModule(value: unknown): boolean {
    if (ModuleExportUtils && typeof ModuleExportUtils.hasUsableModuleExport === 'function') {
        return ModuleExportUtils.hasUsableModuleExport(value);
    }
    if (!value) return false;
    if (typeof value === 'function') return true;
    if (typeof value !== 'object') return true;
    return Object.keys(value as Record<string, unknown>).some((key) => key !== '__esModule');
}

function resolveModuleDefault(mod: unknown): MatchWorkerRuntimeModule {
    return asRuntimeModule(unwrapRuntimeModule(mod));
}

function getNetworkActionSchemaModule(): MatchWorkerRuntimeModule {
    return resolveModuleDefault(requireWorkerRuntimeGlobal('NetworkActionSchema'));
}

function getPlaybackEventHelpersModule(): MatchWorkerRuntimeModule {
    return resolveModuleDefault(requireWorkerRuntimeGlobal('PlaybackEventHelpers'));
}

function getSubPlacementContinuationModule(): MatchWorkerRuntimeModule {
    return resolveModuleDefault(requireWorkerRuntimeGlobal('TurnSubPlacementContinuation'));
}

function withCORS(response: Response): Response {
    const headers = new Headers(response.headers);
    Object.entries(CORS_HEADERS).forEach(([key, value]) => {
        headers.set(key, value);
    });
    return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers
    });
}

function jsonResponse(statusCode: number, payload: unknown): Response {
    return new Response(JSON.stringify(payload || {}), {
        status: statusCode,
        headers: {
            'Content-Type': 'application/json; charset=utf-8',
            ...CORS_HEADERS
        }
    });
}

function normalizePlayerKey(value: unknown): MatchAuthoritySeatKey {
    return MatchAuthority.normalizePlayerKey(value, 'black');
}

function parseSeatKeyOptional(value: unknown): MatchAuthoritySeatKey | null {
    return MatchAuthority.parseSeatKeyOptional(value);
}

function getCurrentPlayerKey(gameState: unknown): MatchAuthoritySeatKey {
    return MatchAuthority.getCurrentPlayerKey(gameState as Partial<GameState> | null | undefined);
}

function normalizeSeatHandSkinId(value: unknown): string {
    return MatchAuthority.normalizeSeatHandSkinId(value);
}

function getOpponentKey(playerKey: unknown): MatchAuthoritySeatKey {
    return MatchAuthority.getOpponentKey(parseSeatKeyOptional(playerKey));
}

function resolveAuthenticatedSeatKey(room: unknown, seatKeyValue: unknown, seatTokenValue: unknown): MatchAuthoritySeatKey | null {
    return MatchAuthority.resolveAuthenticatedSeatKey(room as never, seatKeyValue, seatTokenValue);
}

function resolveAuthenticatedViewer(room: unknown, options: Record<string, unknown> | null | undefined): MatchAuthorityViewer | null {
    return MatchAuthority.resolveAuthenticatedViewer(room as never, options);
}

function classifySeatTokenRejectionReason(seatTokenValue: unknown): string {
    return MatchAuthority.classifySeatTokenRejectionReason(seatTokenValue);
}

function classifyViewerTokenRejectionReason(searchParams: URLSearchParams): string {
    const viewerRole = String(searchParams.get('viewerRole') || '').trim().toLowerCase();
    if (viewerRole === 'spectator') {
        return String(searchParams.get('spectatorToken') || '').trim()
            ? 'SPECTATOR_TOKEN_MISMATCH'
            : 'SPECTATOR_TOKEN_REQUIRED';
    }
    return classifySeatTokenRejectionReason(searchParams.get('seatToken') || '');
}

function buildNetworkActionEffectLogs(
    action: unknown,
    playerKey: unknown,
    cardLogic: unknown,
    rawEvents: unknown,
    presentationEvents: unknown,
    playbackAdapter: unknown
): string[] {
    return MatchAuthority.buildNetworkActionEffectLogs(
        action,
        playerKey,
        cardLogic as { getCardDef?: (cardId: string) => { name?: unknown } | null | undefined },
        rawEvents,
        presentationEvents,
        playbackAdapter as { mapEffectLogsFromPipeline?: (rawEvents: unknown, presentationEvents: unknown, playerKey: unknown) => unknown }
    );
}

function makeRoomId(): string {
    return MatchAuthority.makeRoomId(crypto as unknown as { getRandomValues(array: Uint8Array): Uint8Array });
}

function makeSeatToken(): string {
    return MatchAuthority.makeSeatToken(crypto as unknown as { getRandomValues(array: Uint8Array): Uint8Array });
}

function makeSpectatorToken(): string {
    return MatchAuthority.makeSpectatorToken(makeSeatToken);
}

function makeSpectatorId(): string {
    return MatchAuthority.makeSpectatorId(makeSeatToken);
}

function makeRematchRequestId(): string {
    return MatchAuthority.makeRematchRequestId(makeSeatToken, Date.now);
}

function getRuntimeGlobalScopes(): Record<string, unknown>[] {
    const scopes: Record<string, unknown>[] = [];
    if (typeof globalThis !== 'undefined' && globalThis) {
        scopes.push(globalThis as Record<string, unknown>);
    }
    if (typeof self !== 'undefined' && self) {
        const selfScope = self as Record<string, unknown>;
        if (!scopes.includes(selfScope)) {
            scopes.push(selfScope);
        }
    }
    return scopes;
}

function readRuntimeGlobalValue(key: string): unknown {
    if (!key) return null;
    const scopes = getRuntimeGlobalScopes();
    for (const scope of scopes) {
        if (Object.prototype.hasOwnProperty.call(scope, key) && typeof scope[key] !== 'undefined') {
            return scope[key];
        }
    }
    return null;
}

function setRuntimeGlobalValue(key: string, value: unknown): unknown {
    const scopes = getRuntimeGlobalScopes();
    if (!key || scopes.length <= 0) return value;
    for (const scope of scopes) {
        scope[key] = value;
    }
    return value;
}

function requireWorkerRuntimeGlobal(globalKey: string): unknown {
    const value = readRuntimeGlobalValue(globalKey);
    if (!hasUsableRuntimeModule(value)) {
        throw new Error(`Worker runtime global unavailable: ${globalKey}`);
    }
    return value;
}

function ensureWorkerRuntimeGlobals(): Promise<void> {
    if (!workerRuntimeGlobalsPromise) {
        workerRuntimeGlobalsPromise = Promise.resolve().then(() => {
            const missingGlobals = WORKER_RUNTIME_GLOBAL_KEYS.filter(
                (globalKey) => !hasUsableRuntimeModule(readRuntimeGlobalValue(globalKey))
            );
            if (missingGlobals.length > 0) {
                throw new Error(`Worker runtime globals unavailable: ${missingGlobals.join(', ')}`);
            }
        });
    }
    return workerRuntimeGlobalsPromise;
}

function ensureWorkerSharedConstants(): Promise<unknown> {
    return ensureWorkerRuntimeGlobals().then(() => requireWorkerRuntimeGlobal('SharedConstants'));
}

function ensureWorkerSharedBoardUtils(): Promise<unknown> {
    return ensureWorkerRuntimeGlobals().then(() => requireWorkerRuntimeGlobal('SharedBoardUtils'));
}

function ensureWorkerDeckGlobals(): Promise<MatchWorkerDeckGlobals> {
    if (!workerDeckGlobalsPromise) {
        workerDeckGlobalsPromise = ensureWorkerRuntimeGlobals().then(() => ({
            deckSpecHelpers: asRuntimeModule(requireWorkerRuntimeGlobal('DeckSpecHelpers')) as MatchWorkerDeckGlobals['deckSpecHelpers'],
            deckCodecModule: asRuntimeModule(requireWorkerRuntimeGlobal('DeckCodecModule')) as MatchWorkerDeckGlobals['deckCodecModule']
        }));
    }
    return workerDeckGlobalsPromise as Promise<MatchWorkerDeckGlobals>;
}

function ensureWorkerCardGlobals(): Promise<void> {
    return ensureWorkerRuntimeGlobals();
}

function ensureWorkerTurnPipelinePhaseGlobals(): Promise<void> {
    return ensureWorkerRuntimeGlobals();
}

function ensureWorkerPipelineUIAdapterGlobals(): Promise<void> {
    return ensureWorkerRuntimeGlobals();
}

function normalizeWorkerTurnPipelinePlayer(Core: MatchWorkerRuntimeModule | null | undefined, player: unknown): MatchAuthoritySeatKey | null {
    const blackValue = Core && Number.isFinite(Number(Core.BLACK)) ? Number(Core.BLACK) : 1;
    const whiteValue = Core && Number.isFinite(Number(Core.WHITE)) ? Number(Core.WHITE) : -1;
    if (player === blackValue || player === 'black') return 'black';
    if (player === whiteValue || player === 'white') return 'white';
    return null;
}

export function createWorkerTurnPipelineModule(
    CardLogic: MatchWorkerCardLogicModule,
    Core: MatchWorkerCoreModule,
    TurnPipelinePhases: MatchWorkerTurnPipelinePhasesModule,
    BoardOps: MatchWorkerRuntimeModule
): MatchWorkerTurnPipelineModule {
    return TurnPipelineFactory.createTurnPipelineModule({
        CardLogic,
        Core,
        TurnPipelinePhases,
        BoardOps,
        SubPlacementContinuation: getSubPlacementContinuationModule(),
        deepClone,
        normalizePlayerKey: (player: unknown, runtimeCore: MatchWorkerCoreModule) => (
            normalizeWorkerTurnPipelinePlayer(runtimeCore || Core, player)
        )
    }) as MatchWorkerTurnPipelineModule;
}

function loadCoreLogicModule(): Promise<MatchWorkerCoreModule> {
    if (!coreLogicModulePromise) {
        coreLogicModulePromise = Promise.all([
            ensureWorkerSharedConstants(),
            ensureWorkerSharedBoardUtils()
        ]).then(() => import('../game/logic/core.js').then((mod) => {
            const resolved = resolveModuleDefault(mod);
            setRuntimeGlobalValue('Core', resolved);
            return resolved as MatchWorkerCoreModule;
        }));
    }
    return coreLogicModulePromise;
}

function loadDeckModules(): Promise<MatchWorkerDeckGlobals> {
    if (!deckModulesPromise) {
        deckModulesPromise = ensureWorkerDeckGlobals();
    }
    return deckModulesPromise;
}

function loadTurnStartModules(): Promise<MatchWorkerTurnStartModules> {
    if (!turnStartModulesPromise) {
        turnStartModulesPromise = Promise.all([
            loadCoreLogicModule(),
            ensureWorkerCardGlobals().then(() => import('../game/logic/cards.js').then((mod) => resolveModuleDefault(mod) as MatchWorkerCardLogicModule)),
            ensureWorkerTurnPipelinePhaseGlobals().then(() => import('../game/turn/turn_pipeline_phases.js').then((mod) => resolveModuleDefault(mod) as MatchWorkerTurnPipelinePhasesModule)),
            import('../game/schema/prng.js').then((mod) => resolveModuleDefault(mod) as MatchWorkerSeededPrngModule)
        ]).then(([Core, CardLogic, TurnPipelinePhases, SeededPRNG]) => ({
            Core,
            CardLogic,
            TurnPipelinePhases,
            SeededPRNG
        }));
    }
    return turnStartModulesPromise;
}

function loadTurnPipelineModules(): Promise<MatchWorkerTurnPipelineModules> {
    if (!turnPipelineModulesPromise) {
        turnPipelineModulesPromise = Promise.all([
            ensureWorkerCardGlobals(),
            loadCoreLogicModule(),
            import('../game/logic/cards.js').then((mod) => resolveModuleDefault(mod) as MatchWorkerCardLogicModule),
            ensureWorkerTurnPipelinePhaseGlobals().then(() => import('../game/turn/turn_pipeline_phases.js').then((mod) => resolveModuleDefault(mod) as MatchWorkerTurnPipelinePhasesModule)),
            ensureWorkerPipelineUIAdapterGlobals().then(() => import('../game/turn/pipeline_ui_adapter.js').then(resolveModuleDefault)),
            import('../game/logic/board_ops.js').then(resolveModuleDefault),
            import('../game/schema/prng.js').then((mod) => resolveModuleDefault(mod) as MatchWorkerSeededPrngModule)
        ]).then(([, Core, CardLogic, TurnPipelinePhases, TurnPipelineUIAdapter, BoardOps, SeededPRNG]) => ({
            TurnPipeline: createWorkerTurnPipelineModule(CardLogic, Core, TurnPipelinePhases, BoardOps),
            SeededPRNG,
            TurnPipelineUIAdapter,
            CardLogic
        }));
    }
    return turnPipelineModulesPromise;
}

function loadDebugActionsModule(): Promise<MatchWorkerRuntimeModule> {
    if (!debugActionsModulePromise) {
        debugActionsModulePromise = import('../game/debug/debug-actions.js').then(resolveModuleDefault);
    }
    return debugActionsModulePromise;
}

function parseJsonBody(raw: string | null | undefined): Record<string, unknown> | null {
    if (!raw) return {};
    try {
        const parsed = JSON.parse(raw);
        return asRecord(parsed);
    } catch (e) {
        return null;
    }
}

function normalizeRoomId(value: unknown): string {
    return MatchAuthority.normalizeNetworkRoomId(value);
}

function isNetworkDebugFillHandAction(value: unknown): boolean {
    return MatchAuthority.isNetworkDebugFillHandAction(value);
}

function isNetworkDebugFillHandPayload(value: unknown): boolean {
    return MatchAuthority.isNetworkDebugFillHandPayload(value);
}

function resolveNetworkDebugFillHandOptions(value: unknown): Record<string, unknown> {
    return MatchAuthority.resolveNetworkDebugFillHandOptions(value);
}

function normalizeNetworkPlayerName(value: unknown): string {
    return MatchAuthority.normalizeNetworkPlayerName(value);
}

function normalizeOperationId(value: unknown): string {
    return MatchAuthority.normalizeOperationId(value);
}

function ensureAcceptedOperationsBySeat(room: MatchAuthorityRoomState | null | undefined): MatchAuthorityAcceptedOperationsBySeat {
    return MatchAuthority.ensureAcceptedOperationsBySeat(room);
}

async function makeInitialSnapshot(seed: unknown, options: unknown): Promise<MatchAuthorityRoomState> {
    const { Core, CardLogic, TurnPipelinePhases, SeededPRNG } = await loadTurnStartModules();
    const opts = buildInitialDeckSnapshotOptions(options);
    const gameState = Core.createGameState(opts.boardConfig);
    const prng = SeededPRNG.createPRNG(seed);
    const cardInitOptions = buildInitialDeckSnapshotOptions(opts);
    const cardState = CardLogic.createCardState(prng, cardInitOptions);

    const startupEvents: unknown[] = [];
    TurnPipelinePhases.applyTurnStartPhase(
        CardLogic,
        Core,
        cardState,
        gameState,
        'black',
        startupEvents,
        prng
    );
    persistTurnStartPrngState(asRecord(cardState), prng);

    return {
        gameState,
        cardState,
        stateVersion: 0,
        updatedAt: Date.now()
    };
}

function persistTurnStartPrngState(cardState: Record<string, unknown> | null | undefined, prng: MatchWorkerPrng | null | undefined): void {
    if (!cardState || !prng || typeof prng.getState !== 'function') return;
    cardState.prngState = prng.getState();
}

function asPlaybackAdapter(value: unknown): MatchWorkerPlaybackAdapter | null {
    return value && typeof asRecord(value).mapToPlaybackEvents === 'function'
        ? value as MatchWorkerPlaybackAdapter
        : null;
}

function asWorkerSnapshot(value: unknown): MatchWorkerPublicSnapshot {
    return value && typeof value === 'object' ? value as MatchWorkerPublicSnapshot : {};
}


function buildPublishPayload(room: MatchWorkerRoomState | null | undefined, viewerSeatKey: unknown, options: MatchWorkerPublishPayloadOptions = {}) {
    const serverTime = Number.isFinite(Number(options.serverTime)) ? Number(options.serverTime) : Date.now();
    const presentationCursor = buildPresentationCursor(room);
    if (MatchAuthority.shouldUseAckOnlyPublishResponse(room, options)) {
        return MatchAuthority.buildPublishAckPayloadFromRoom(room, {
            ok: true,
            stateVersion: room && Number.isFinite(Number(room.stateVersion)) ? Number(room.stateVersion) : null,
            presentationCursor,
            serverTime,
            idempotentReplay: options.idempotentReplay === true,
            publishMeta: options.publishMeta || null
        });
    }
    const networkDebugEnabled = toPublicNetworkDebugEnabled(room);
    const networkAutoEnabled = toPublicNetworkAutoEnabled(room);
    const snapshot = Object.prototype.hasOwnProperty.call(options, 'snapshot')
        ? options.snapshot
        : toPublicSnapshot(room, viewerSeatKey);
    const payloadOptions: MatchWorkerPublishPayloadOptions = {
        ok: options.ok === true,
        snapshot,
        roomDeck: toPublicRoomDeck(room),
        roomBoardConfig: toPublicRoomBoardConfig(room),
        networkDebugEnabled,
        networkAutoEnabled,
        turnTimer: toPublicTurnTimer(room, serverTime),
        playbackEvents: Array.isArray(options.playbackEvents) ? options.playbackEvents : [],
        effectLogs: MatchAuthority.normalizeEffectLogMessages(options.effectLogs),
        presentationCursor,
        presentationFrames: buildPresentationFramesForViewer(room, viewerFromSeatKey(viewerSeatKey), options),
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
        payloadOptions.playbackDiagnostics = MatchAuthority.toDebugPlaybackDiagnostics(options.playbackDiagnostics, networkDebugEnabled) as MatchWorkerPlaybackDiagnostics | null;
    }
    if (Object.prototype.hasOwnProperty.call(options, 'autoPassNotice')) {
        payloadOptions.autoPassNotice = options.autoPassNotice || null;
    }
    return withPublicRatedMatchMetadata(MatchAuthority.buildPublishPayloadFromRoom(room, payloadOptions), room);
}


type MatchWorkerCommandCapabilityResolution =
    | {
        ok: true;
        capabilities: MatchCommandExecutionCapabilities;
    }
    | {
        ok: false;
        rejectedReason: string;
        errorMessage?: string | null;
    };

function buildWorkerMatchCommandCapabilities(options: {
    NetworkActionSchema: MatchWorkerRuntimeModule;
    PlaybackEventHelpers?: MatchWorkerRuntimeModule | null;
    SubPlacementContinuation?: MatchWorkerRuntimeModule | null;
    pipelineModules?: MatchWorkerTurnPipelineModules | null;
    turnStartModules?: MatchWorkerTurnStartModules | null;
    DebugActions?: MatchWorkerRuntimeModule | null;
    CpuNetworkCommandPlanner?: MatchWorkerRuntimeModule | null;
    PendingCoordinator?: MatchWorkerRuntimeModule | null;
    PendingSelectionRegistry?: MatchWorkerRuntimeModule | null;
}): MatchCommandExecutionCapabilities {
    const pipelineModules = options.pipelineModules || null;
    const turnStartModules = options.turnStartModules || null;
    const playbackHelpers = options.PlaybackEventHelpers || null;
    const playbackAdapter = pipelineModules
        ? asPlaybackAdapter(pipelineModules.TurnPipelineUIAdapter)
        : null;
    const capabilities: any = {
        snapshot: {
            cloneSnapshot: (snapshot: unknown) => deepClone(snapshot),
            stripTransientChargeDeltaState: (snapshot: unknown) => MatchAuthority.stripTransientChargeDeltaState(snapshot),
            stripTransientPresentationState: (snapshot: unknown) => MatchAuthority.stripTransientPresentationState(snapshot),
            restoreMissingChargeDeltaEvents: (previousSnapshot: unknown, nextSnapshot: unknown) => (
                MatchAuthority.restoreMissingChargeDeltaEvents(previousSnapshot, nextSnapshot)
            )
        },
        schema: {
            buildAction: (input: unknown, fallbackActor: unknown, fallbackTurnIndex: unknown) => (
                options.NetworkActionSchema.buildAction as (
                    commandInput: unknown,
                    actor: unknown,
                    turnIndex: unknown
                ) => unknown
            )(input, fallbackActor, fallbackTurnIndex)
        },
        authority: {
            normalizePlayerKey,
            parsePlayerKeyOptional: parseSeatKeyOptional,
            getCurrentPlayerKey,
            parseHiddenHandToken: (value: unknown) => MatchAuthority.parseHiddenHandToken(value),
            validatePendingSelectionPublish: (
                snapshot: unknown,
                commandPlayerKey: unknown,
                action: unknown
            ) => MatchAuthority.validatePendingSelectionPublish(snapshot, commandPlayerKey, action),
            sanitizePendingSelectionActionForAuthority: (
                snapshot: unknown,
                commandPlayerKey: unknown,
                action: unknown
            ) => MatchAuthority.sanitizePendingSelectionActionForAuthority(snapshot, commandPlayerKey, action),
            validateAuthoritativePendingSelectionResult: MatchAuthority.validateAuthoritativePendingSelectionResult,
            isSubPlacementTurnActive: (
                cardState: unknown,
                commandPlayerKey: unknown
            ) => options.SubPlacementContinuation
                && typeof options.SubPlacementContinuation.isSubPlacementTurnActive === 'function'
                ? options.SubPlacementContinuation.isSubPlacementTurnActive(cardState, commandPlayerKey)
                : false
        }
    };

    if (options.DebugActions) {
        capabilities.debug = {
            isDebugFillHandPayload: (body: unknown) => isNetworkDebugFillHandPayload(body),
            resolveDebugFillHandOptions: (body: unknown) => resolveNetworkDebugFillHandOptions(body),
            fillDebugHand: (cardState: unknown, debugOptions: unknown) => (
                options.DebugActions!.fillDebugHand as (
                    currentCardState: unknown,
                    fillOptions: unknown
                ) => unknown
            )(cardState, debugOptions)
        };
    }

    if (
        options.CpuNetworkCommandPlanner
        && options.PendingCoordinator
        && options.PendingSelectionRegistry
        && pipelineModules
        && turnStartModules
    ) {
        capabilities.autoCommand = {
            isAutoTurnPublishBody: (body: unknown) => isMatchAutoTurnPublishBody(body),
            resolveAutoTurnPublishBody: (autoOptions: any) => resolveMatchAutoTurnPublishBody({
                body: autoOptions.body,
                snapshot: autoOptions.snapshot,
                playerKey: autoOptions.playerKey,
                planningPlayerKey: autoOptions.planningPlayerKey,
                CpuNetworkCommandPlanner: options.CpuNetworkCommandPlanner,
                CoreLogic: turnStartModules.Core,
                CardLogic: pipelineModules.CardLogic,
                PendingCoordinator: options.PendingCoordinator,
                PendingSelectionRegistry: options.PendingSelectionRegistry,
                SubPlacementContinuation: options.SubPlacementContinuation
            })
        };
    }

    if (pipelineModules && turnStartModules && playbackHelpers) {
        const SeededPRNG = pipelineModules.SeededPRNG;
        const TurnPipeline = pipelineModules.TurnPipeline;
        capabilities.random = {
            fromState: (state: unknown) => {
                if (typeof SeededPRNG.fromState !== 'function') {
                    throw new Error('PRNG_STATE_RESTORE_UNAVAILABLE');
                }
                return SeededPRNG.fromState(state);
            },
            createPrng: (seed: unknown) => SeededPRNG.createPRNG(seed),
            deriveSeed: (context: MatchCommandAuthorityContext, snapshot: unknown, commandPlayerKey: unknown) => (
                MatchAuthority.createTurnStartSeed(
                    { seed: context.roomSeed },
                    snapshot,
                    commandPlayerKey
                )
            )
        };
        capabilities.pipeline = {
            applyTurnSafe: TurnPipeline.applyTurnSafe.bind(TurnPipeline)
        };
        capabilities.turnStart = {
            isGameOver: (gameState: unknown) => turnStartModules.Core.isGameOver(gameState),
            createCardState: (prng: unknown, initialDeckOptions: unknown) => (
                turnStartModules.CardLogic.createCardState(prng, initialDeckOptions)
            ),
            mergeWithDefaultShape: (defaultValue: unknown, overrideValue: unknown) => (
                MatchAuthority.mergeWithDefaultShape(defaultValue, overrideValue)
            ),
            applyTurnStartPhase: (
                cardLogic: MatchWorkerCardLogicModule,
                coreLogic: MatchWorkerCoreModule,
                cardState: unknown,
                gameState: unknown,
                commandPlayerKey: unknown,
                events: unknown[],
                prng: unknown
            ) => turnStartModules.TurnPipelinePhases.applyTurnStartPhase(
                cardLogic,
                coreLogic,
                cardState,
                gameState,
                commandPlayerKey,
                events,
                prng
            ),
            cardLogic: turnStartModules.CardLogic,
            coreLogic: turnStartModules.Core
        };
        capabilities.presentation = {
            collectActionPlaybackEvents: (presentationOptions: any) => (
                playbackHelpers.collectActionPlaybackEvents as (value: unknown) => MatchWorkerPlaybackAssembly
            )({
                result: presentationOptions.result,
                rawEvents: presentationOptions.rawEvents,
                snapshot: presentationOptions.snapshot,
                playerKey: presentationOptions.playerKey,
                fallbackPlayerKey: presentationOptions.playerKey,
                adapter: playbackAdapter,
                normalizePlayerKey
            }),
            collectTurnStartPlaybackEvents: (presentationOptions: any) => (
                playbackHelpers.collectServerPlaybackEvents as (value: unknown) => MatchWorkerPlaybackAssembly
            )({
                rawEvents: presentationOptions.rawEvents,
                snapshot: presentationOptions.snapshot,
                playerKey: presentationOptions.playerKey,
                fallbackPlayerKey: presentationOptions.playerKey,
                adapter: playbackAdapter,
                normalizePlayerKey
            }),
            buildActionEffectLogs: (
                action: unknown,
                commandPlayerKey: unknown,
                rawEvents: unknown,
                presentationEvents: unknown
            ) => buildNetworkActionEffectLogs(
                action,
                commandPlayerKey,
                pipelineModules.CardLogic,
                rawEvents,
                presentationEvents,
                pipelineModules.TurnPipelineUIAdapter
            ),
            collectTurnStartEffectLogs: (
                rawEvents: unknown,
                presentationEvents: unknown,
                commandPlayerKey: unknown
            ) => MatchAuthority.collectPipelineEffectLogMessages(
                rawEvents,
                presentationEvents,
                commandPlayerKey,
                playbackAdapter as {
                    mapEffectLogsFromPipeline?: (
                        rawEvents: unknown,
                        presentationEvents: unknown,
                        playerKey: unknown
                    ) => unknown;
                } | null
            ),
            appendTurnStartDrawPlaybackEvents: (drawOptions: any) => (
                playbackHelpers.appendTurnStartDrawPlaybackEvents as (value: unknown) => MatchWorkerPlaybackAssembly
            )({
                playbackAssembly: drawOptions.playbackAssembly,
                snapshot: drawOptions.snapshot,
                handState: drawOptions.handState,
                adapter: playbackAdapter,
                normalizePlayerKey
            }),
            appendPlaybackEventsAfter: (first: unknown, second: unknown) => (
                playbackHelpers.appendPlaybackEventsAfter as (
                    baseEvents: unknown,
                    appendedEvents: unknown
                ) => unknown[]
            )(first, second),
            appendEffectLogMessages: (first: unknown, second: unknown) => (
                MatchAuthority.appendEffectLogMessages(first, second)
            ),
            reportPlaybackAssemblyDiagnostics: (
                context: unknown,
                diagnostics: unknown,
                reportOptions: unknown
            ) => MatchAuthority.reportPlaybackAssemblyDiagnostics(
                context,
                diagnostics,
                reportOptions
            ),
            toDebugPlaybackDiagnostics: (
                diagnostics: unknown,
                networkDebugEnabled: unknown
            ) => MatchAuthority.toDebugPlaybackDiagnostics(
                diagnostics,
                networkDebugEnabled
            )
        };
    }
    return capabilities as MatchCommandExecutionCapabilities;
}

async function resolveWorkerMatchCommandCapabilities(
    room: MatchWorkerRoomState | null | undefined,
    body: Record<string, unknown>
): Promise<MatchWorkerCommandCapabilityResolution> {
    let NetworkActionSchema: MatchWorkerRuntimeModule;
    try {
        NetworkActionSchema = getNetworkActionSchemaModule();
    } catch (_error) {
        return { ok: false, rejectedReason: 'COMMAND_SCHEMA_UNAVAILABLE' };
    }
    if (!NetworkActionSchema || typeof NetworkActionSchema.buildAction !== 'function') {
        return { ok: false, rejectedReason: 'COMMAND_SCHEMA_UNAVAILABLE' };
    }

    if (isNetworkDebugFillHandPayload(body)) {
        if (!toPublicNetworkDebugEnabled(room)) {
            return { ok: false, rejectedReason: 'NETWORK_DEBUG_DISABLED' };
        }
        try {
            const DebugActions = await loadDebugActionsModule();
            if (!DebugActions || typeof DebugActions.fillDebugHand !== 'function') {
                return { ok: false, rejectedReason: 'DEBUG_ACTIONS_UNAVAILABLE' };
            }
            return {
                ok: true,
                capabilities: buildWorkerMatchCommandCapabilities({
                    NetworkActionSchema,
                    DebugActions
                })
            };
        } catch (_error) {
            return { ok: false, rejectedReason: 'DEBUG_ACTIONS_UNAVAILABLE' };
        }
    }

    if (isMatchAutoTurnPublishBody(body) && room?.networkAutoEnabled !== true) {
        return { ok: false, rejectedReason: 'AUTO_COMMAND_DISABLED' };
    }

    let pipelineModules: MatchWorkerTurnPipelineModules;
    let turnStartModules: MatchWorkerTurnStartModules;
    let PlaybackEventHelpers: MatchWorkerRuntimeModule;
    let SubPlacementContinuation: MatchWorkerRuntimeModule;
    try {
        [pipelineModules, turnStartModules] = await Promise.all([
            loadTurnPipelineModules(),
            loadTurnStartModules()
        ]);
        PlaybackEventHelpers = getPlaybackEventHelpersModule();
        SubPlacementContinuation = getSubPlacementContinuationModule();
        if (
            !pipelineModules.TurnPipeline
            || typeof pipelineModules.TurnPipeline.applyTurnSafe !== 'function'
            || !turnStartModules.TurnPipelinePhases
            || typeof turnStartModules.TurnPipelinePhases.applyTurnStartPhase !== 'function'
            || !PlaybackEventHelpers
            || typeof PlaybackEventHelpers.collectActionPlaybackEvents !== 'function'
        ) {
            return { ok: false, rejectedReason: 'COMMAND_PIPELINE_UNAVAILABLE' };
        }
    } catch (_error) {
        return { ok: false, rejectedReason: 'COMMAND_PIPELINE_UNAVAILABLE' };
    }

    if (!isMatchAutoTurnPublishBody(body)) {
        return {
            ok: true,
            capabilities: buildWorkerMatchCommandCapabilities({
                NetworkActionSchema,
                PlaybackEventHelpers,
                SubPlacementContinuation,
                pipelineModules,
                turnStartModules
            })
        };
    }

    try {
        const [
            CpuNetworkCommandPlanner,
            PendingCoordinator,
            PendingSelectionRegistry
        ] = await Promise.all([
            ensureWorkerRuntimeGlobals().then(() => import('../game/cpu-network-command-planner.js').then(resolveModuleDefault)),
            ensureWorkerRuntimeGlobals().then(() => import('../game/turn/pending-coordinator.js').then(resolveModuleDefault)),
            ensureWorkerRuntimeGlobals().then(() => import('../game/logic/cards-internal/pending-selection-registry.js').then(resolveModuleDefault))
        ]);
        return {
            ok: true,
            capabilities: buildWorkerMatchCommandCapabilities({
                NetworkActionSchema,
                PlaybackEventHelpers,
                SubPlacementContinuation,
                pipelineModules,
                turnStartModules,
                CpuNetworkCommandPlanner,
                PendingCoordinator,
                PendingSelectionRegistry
            })
        };
    } catch (error) {
        return {
            ok: false,
            rejectedReason: 'AUTO_COMMAND_PLANNER_UNAVAILABLE',
            errorMessage: error instanceof Error ? error.message : String(error || '')
        };
    }
}

async function applyCommandPublishToSnapshot(
    room: MatchWorkerRoomState | null | undefined,
    body: Record<string, unknown>,
    playerKey: MatchAuthoritySeatKey
): Promise<Record<string, unknown>> {
    const capabilityResolution = await resolveWorkerMatchCommandCapabilities(room, body);
    if (capabilityResolution.ok !== true) return capabilityResolution;

    const roomSnapshot = asWorkerSnapshot(room && room.snapshot);
    if (!roomSnapshot.gameState || !roomSnapshot.cardState) {
        return { ok: false, rejectedReason: 'INVALID_SNAPSHOT' };
    }
    const context: MatchCommandAuthorityContext = {
        snapshot: roomSnapshot as MatchCommandAuthorityContext['snapshot'],
        playerKey,
        roomSeed: room && Number.isFinite(Number(room.seed))
            ? Math.trunc(Number(room.seed))
            : 1,
        stateVersion: room && Number.isFinite(Number(room.stateVersion))
            ? Math.trunc(Number(room.stateVersion))
            : 0,
        initialDeckOptions: buildInitialDeckSnapshotOptions(room),
        networkDebugEnabled: room?.networkDebugEnabled === true,
        networkAutoEnabled: room?.networkAutoEnabled === true
    };
    const result = executeMatchCommand(
        context,
        body,
        capabilityResolution.capabilities
    );
    if (result.ok !== true) {
        const failure: Record<string, unknown> = {
            ok: false,
            rejectedReason: result.rejectedReason
        };
        if (Object.prototype.hasOwnProperty.call(result, 'errorMessage')) {
            failure.errorMessage = result.errorMessage;
        }
        if (Object.prototype.hasOwnProperty.call(result, 'rawEvents')) {
            failure.events = result.rawEvents;
        }
        return failure;
    }

    return {
        ok: true,
        snapshot: result.snapshot,
        playbackEvents: result.playbackEvents,
        playbackDiagnostics: result.playbackDiagnostics,
        effectLogs: result.effectLogs,
        action: isNetworkDebugFillHandPayload(body)
            ? { type: NETWORK_DEBUG_FILL_HAND_ACTION, playerKey }
            : result.action,
        pendingEffectId: result.pendingEffectId
    };
}

async function applyTimeoutPassToSnapshot(options: {
    room: MatchWorkerRoomState;
    playerKey: unknown;
    nowMs?: unknown;
}): Promise<Record<string, unknown>> {
    const room = options && options.room ? options.room : null;
    const playerKey = normalizePlayerKey(options && options.playerKey);
    const snapshot = asWorkerSnapshot(room && room.snapshot);
    const cardState = asRecord(snapshot.cardState);
    const turnIndex = Number.isFinite(Number(cardState.turnIndex))
        ? Math.trunc(Number(cardState.turnIndex))
        : 0;
    return applyCommandPublishToSnapshot(room, {
        actionType: 'pass',
        actor: playerKey,
        turnIndex,
        action: {
            type: 'pass',
            playerKey,
            turnIndex,
            forcePass: true,
            reason: 'timeout'
        }
    }, playerKey);
}

function toPublicSnapshot(room: MatchWorkerRoomState | null | undefined, viewerSeatKey: unknown): MatchWorkerPublicSnapshot {
    const viewer = parseSeatKeyOptional(viewerSeatKey);
    return MatchAuthority.buildPublicSnapshot(room, viewer) as MatchWorkerPublicSnapshot;
}

function toPublicSnapshotForViewer(room: MatchWorkerRoomState | null | undefined, viewerValue: unknown): MatchWorkerPublicSnapshot {
    return MatchAuthority.buildPublicSnapshotForViewer(room, viewerValue) as MatchWorkerPublicSnapshot;
}

function buildPresentationCursor(room: MatchWorkerRoomState | null | undefined): Record<string, number> {
    return {
        visualSeq: Number.isFinite(Number(room && room.visualSeq)) ? Math.max(0, Math.trunc(Number(room && room.visualSeq))) : 0,
        stateVersion: Number.isFinite(Number(room && room.stateVersion)) ? Math.max(0, Math.trunc(Number(room && room.stateVersion))) : 0
    };
}

function viewerFromSeatKey(viewerSeatKey: unknown): MatchAuthorityViewer {
    const seatKey = parseSeatKeyOptional(viewerSeatKey);
    return seatKey ? { role: 'seat', seatKey } : { role: 'spectator', spectatorId: '' };
}

function ensureInitialPresentationSnapshots(room: MatchWorkerRoomState | null | undefined): void {
    if (!room || room.initialSnapshotByViewer) return;
    room.initialSnapshotByViewer = {
        black: toPublicSnapshotForViewer(room, { role: 'seat', seatKey: 'black' }),
        white: toPublicSnapshotForViewer(room, { role: 'seat', seatKey: 'white' }),
        spectator: toPublicSnapshotForViewer(room, { role: 'spectator', spectatorId: '' })
    };
    if (!Number.isFinite(Number(room.visualSeq))) room.visualSeq = 0;
    if (!Array.isArray(room.presentationJournal)) room.presentationJournal = [];
}

function appendPresentationFrameForAcceptedPublish(room: MatchWorkerRoomState | null | undefined, options: Record<string, unknown>): unknown {
    if (!room) return null;
    ensureInitialPresentationSnapshots(room);
    const playbackEvents = Array.isArray(options.playbackEvents) ? options.playbackEvents : [];
    const effectLogs = MatchAuthority.normalizeEffectLogMessages(options.effectLogs);
    const playbackDiagnostics = options.playbackDiagnostics || null;
    const publishViewerArtifacts = asRecord(options.publishViewerArtifacts);
    const artifactSnapshots = asRecord(publishViewerArtifacts.projectedSnapshots);
    return MatchAuthority.appendPresentationFrame(room, {
        stateVersionFrom: options.previousStateVersion,
        stateVersionTo: options.nextStateVersion,
        operationId: options.operationId,
        actorSeatKey: options.actorSeatKey,
        actionType: options.actionType,
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
        createdAt: options.createdAt
    });
}

function buildPresentationFramesForViewer(
    room: MatchWorkerRoomState | null | undefined,
    viewerValue: unknown,
    options: Record<string, unknown>
): unknown[] {
    if (Array.isArray(options.presentationFrames)) return options.presentationFrames;
    const presentationFrameEntry = options.presentationFrameEntry;
    if (presentationFrameEntry && typeof presentationFrameEntry === 'object') {
        return [MatchAuthority.toPublicPresentationFrame(presentationFrameEntry, viewerValue, room)];
    }
    return [];
}

function buildPublicSeatState(room: MatchWorkerRoomState | null | undefined): MatchWorkerPublicSeatState {
    return MatchAuthority.buildPublicSeatMetadata(room) as MatchWorkerPublicSeatState;
}

function withPublicSeatState(room: MatchWorkerRoomState | null | undefined, payload: Record<string, unknown>): Record<string, unknown> {
    return Object.assign(payload, buildPublicSeatState(room));
}

function toPublicSeatHandSkins(room: MatchWorkerRoomState | null | undefined) {
    return buildPublicSeatState(room).seatHandSkins;
}

function cloneInitialDeckSpecByPlayer(value: unknown): MatchWorkerSeatValueMap<object | null> {
    const source = asRecord(value);
    return cloneRoomDeckSpecByPlayer({
        black: (source.black && typeof source.black === 'object') ? source.black : null,
        white: (source.white && typeof source.white === 'object') ? source.white : null
    });
}

function cloneInitialDeckCardIdsByPlayer(value: unknown): MatchWorkerSeatValueMap<string[] | null> {
    const source = asRecord(value);
    const cloneCards = (candidate: unknown): string[] | null => {
        if (!Array.isArray(candidate)) return null;
        const cardIds = candidate
            .map((cardId) => String(cardId || '').trim())
            .filter(Boolean);
        return cardIds.length > 0 ? cardIds : null;
    };
    return cloneRoomDeckCardIdsByPlayer({
        black: cloneCards(source.black),
        white: cloneCards(source.white)
    });
}

function createAllCardsRoomDeckMetadataFromRuntimeCardIds(cardIdsByPlayer: MatchWorkerSeatValueMap<string[] | null>): MatchWorkerRoomDeckMetadata {
    const black = Array.isArray(cardIdsByPlayer.black) ? cardIdsByPlayer.black : [];
    const white = Array.isArray(cardIdsByPlayer.white) ? cardIdsByPlayer.white : black;
    return createCanonicalAllCardsRoomDeckMetadata({ black, white });
}

function isAllCardsDeckRoom(room: MatchWorkerRoomState | null | undefined): boolean {
    const roomDeckSource = room && room.roomDeck
        ? String(asRecord(room.roomDeck).source || '')
        : null;
    return classifyAllCardsDeckRoom(!!(room && room.allCardsDeckEnabled === true), roomDeckSource);
}

function normalizeRoomDeckMetadata(value: unknown): MatchWorkerRoomDeckMetadata | null {
    const source = (value && typeof value === 'object') ? asRecord(value) : null;
    if (!source) return null;

    const mode = String(source.mode || '').trim();
    const sharedDeckCode = String(source.deckCode || '').trim();
    const sharedDeckSize = normalizeRoomDeckSize(source.deckSize);
    const deckCodeByPlayerSource = (source.deckCodeByPlayer && typeof source.deckCodeByPlayer === 'object')
        ? asRecord(source.deckCodeByPlayer)
        : null;
    const deckSizeByPlayerSource = (source.deckSizeByPlayer && typeof source.deckSizeByPlayer === 'object')
        ? asRecord(source.deckSizeByPlayer)
        : null;
    const hasExplicitPerPlayerData = !!(deckCodeByPlayerSource || deckSizeByPlayerSource);
    const deckCodeByPlayer = {
        black: deckCodeByPlayerSource
            ? String(deckCodeByPlayerSource.black || '').trim()
            : (mode === 'shared' ? sharedDeckCode : ''),
        white: deckCodeByPlayerSource
            ? String(deckCodeByPlayerSource.white || '').trim()
            : (mode === 'shared' ? sharedDeckCode : '')
    };
    const deckSizeByPlayer = {
        black: deckSizeByPlayerSource
            ? normalizeRoomDeckSize(deckSizeByPlayerSource.black)
            : (mode === 'shared' ? sharedDeckSize : null),
        white: deckSizeByPlayerSource
            ? normalizeRoomDeckSize(deckSizeByPlayerSource.white)
            : (mode === 'shared' ? sharedDeckSize : null)
    };
    const hasPerPlayerData = !!(
        deckCodeByPlayer.black ||
        deckCodeByPlayer.white ||
        deckSizeByPlayer.black !== null ||
        deckSizeByPlayer.white !== null
    );

    if (!hasPerPlayerData && !sharedDeckCode && sharedDeckSize === null) {
        return null;
    }

    return {
        mode: ((mode === 'shared' && (sharedDeckCode || sharedDeckSize !== null))
            ? 'shared'
            : ((mode === 'perPlayer' || hasExplicitPerPlayerData)
                ? 'perPlayer'
                : ((sharedDeckCode || sharedDeckSize !== null) ? 'shared' : 'perPlayer'))) as MatchWorkerRoomDeckMetadata['mode'],
        source: String(source.source || 'room').trim() || 'room',
        deckCode: sharedDeckCode,
        deckSize: sharedDeckSize,
        deckCodeByPlayer,
        deckSizeByPlayer
    };
}

function buildInitialDeckSnapshotOptions(value: unknown): Record<string, unknown> {
    const source = asRecord(value);
    const initialDeckCardIdsByPlayer = cloneInitialDeckCardIdsByPlayer(source.initialDeckCardIdsByPlayer);
    const initialDeckSpecByPlayer = cloneInitialDeckSpecByPlayer(source.initialDeckSpecByPlayer);
    const boardConfig = MatchAuthority.resolveRoomBoardConfig(source);
    const options = buildCanonicalInitialDeckSnapshotOptions({
        initialDeckCardIdsByPlayer,
        initialDeckSpecByPlayer,
        initialDeckSpec: (source.initialDeckSpec && typeof source.initialDeckSpec === 'object')
            ? source.initialDeckSpec
            : null
    }, boardConfig && typeof boardConfig === 'object' ? boardConfig : null);
    return { ...options };
}

function assignRoomDeckSelection(room: MatchWorkerRoomState | null | undefined, seatKey: unknown, deckSelection: MatchWorkerDeckSelection | null | undefined): boolean {
    if (!room || !deckSelection || deckSelection.ok !== true) return false;

    const normalizedSeatKey = normalizePlayerKey(seatKey);
    if (!normalizedSeatKey) return false;
    const currentInitialDeckSpecByPlayer = cloneInitialDeckSpecByPlayer(room.initialDeckSpecByPlayer);
    let normalizedSelection: MatchRoomDeckSelectionSuccess;
    if (deckSelection.hasCustomDeck === true) {
        const deckSpec = deckSelection.deckSpec;
        if (!deckSpec || typeof deckSpec !== 'object') {
            throw new TypeError('match-worker: successful custom deck selection requires deckSpec');
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
        initialDeckSpec: (room.initialDeckSpec && typeof room.initialDeckSpec === 'object')
            ? room.initialDeckSpec
            : null,
        initialDeckSpecByPlayer: (
            currentInitialDeckSpecByPlayer.black !== null || currentInitialDeckSpecByPlayer.white !== null
        ) ? currentInitialDeckSpecByPlayer : null,
        roomDeck: normalizeRoomDeckMetadata(room.roomDeck)
    }, normalizedSeatKey, normalizedSelection);
    room.initialDeckSpec = patch.initialDeckSpec;
    room.initialDeckSpecByPlayer = patch.initialDeckSpecByPlayer;
    room.roomDeck = patch.roomDeck;
    return true;
}

function toPublicRoomDeck(room: MatchWorkerRoomState | null | undefined): Record<string, unknown> | null {
    const metadata = normalizeRoomDeckMetadata(room && room.roomDeck);
    const snapshot = asWorkerSnapshot(room && room.snapshot);
    const cardState = asRecord(snapshot.cardState);
    const initialDeckSizeByPlayer = asRecord(cardState.initialDeckSizeByPlayer);
    const snapshotDeckSizes = {
        black: normalizeRoomDeckSize(
            initialDeckSizeByPlayer.black
        ),
        white: normalizeRoomDeckSize(
            initialDeckSizeByPlayer.white
        )
    };
    return projectPublicRoomDeck(metadata, {
        initialDeckSizeByPlayer: snapshotDeckSizes,
        initialDeckSize: normalizeRoomDeckSize(cardState.initialDeckSize)
    }) as Record<string, unknown> | null;
}

function toPublicRoomBoardConfig(room: MatchWorkerRoomState | null | undefined): unknown {
    return MatchAuthority.resolveRoomBoardConfig(room);
}

function toPublicNetworkDebugEnabled(room: MatchWorkerRoomState | null | undefined): boolean {
    return false;
}

function toPublicNetworkAutoEnabled(room: MatchWorkerRoomState | null | undefined): boolean {
    return !!(room && room.networkAutoEnabled === true);
}

function toPublicChatMessages(room: MatchWorkerRoomState | null | undefined): Array<Record<string, unknown>> {
    const messages: unknown[] = Array.isArray(room?.chatMessages) ? room.chatMessages : [];
    return messages.map((entry) => {
        const entryRecord = asRecord(entry);
        return {
            id: Number.isFinite(Number(entryRecord.id)) ? Number(entryRecord.id) : 0,
            seatKey: normalizePlayerKey(entryRecord.seatKey),
            text: String(entryRecord.text ? entryRecord.text : ''),
            serverTime: Number.isFinite(Number(entryRecord.serverTime)) ? Number(entryRecord.serverTime) : Date.now()
        };
    });
}

function hasTwoActiveSeats(room: MatchWorkerRoomState | null | undefined): boolean {
    return !!(room && room.seats && room.seats.black && room.seats.white);
}

function resolveTurnSeatKey(room: MatchWorkerRoomState | null | undefined): MatchAuthoritySeatKey {
    const snapshot = asWorkerSnapshot(room && room.snapshot);
    return getCurrentPlayerKey(snapshot.gameState);
}

function createPausedTurnTimer(room: MatchWorkerRoomState | null | undefined): Record<string, unknown> {
    return MatchWorkerTurnTimerHelpers.createPausedTurnTimer(room);
}

function createActiveTurnTimer(room: MatchWorkerRoomState | null | undefined, nowMs: unknown): Record<string, unknown> {
    return MatchWorkerTurnTimerHelpers.createActiveTurnTimer(room, nowMs);
}

function areTurnTimersEqual(a: unknown, b: unknown): boolean {
    return MatchWorkerTurnTimerHelpers.areTurnTimersEqual(a, b);
}

function toPublicTurnTimer(room: MatchWorkerRoomState | null | undefined, nowMs: unknown): Record<string, unknown> {
    return MatchWorkerTurnTimerHelpers.toPublicTurnTimer(room, nowMs);
}

function buildSnapshotPayload(room: MatchWorkerRoomState, meta: MatchWorkerSnapshotPayloadMeta | null | undefined, viewer: MatchAuthorityViewer): Record<string, unknown> {
    const serverTime = Date.now();
    const metaRecord = asRecord(meta);
    const viewerRole = viewer && viewer.role === 'spectator' ? 'spectator' : 'seat';
    const publishViewerArtifacts = asRecord(metaRecord.__publishViewerArtifacts);
    const artifactSnapshots = asRecord(publishViewerArtifacts.projectedSnapshots);
    const artifactSnapshot = artifactSnapshots[MatchAuthority.getPayloadKeyForViewer(viewer)];
    return withPublicRatedMatchMetadata(MatchAuthority.buildSnapshotPayloadFromRoom(room, {
        viewerRole,
        snapshot: artifactSnapshot && typeof artifactSnapshot === 'object'
            ? deepClone(artifactSnapshot)
            : toPublicSnapshotForViewer(room, viewer),
        roomDeck: toPublicRoomDeck(room),
        roomBoardConfig: toPublicRoomBoardConfig(room),
        networkDebugEnabled: toPublicNetworkDebugEnabled(room),
        networkAutoEnabled: toPublicNetworkAutoEnabled(room),
        turnTimer: toPublicTurnTimer(room, serverTime),
        playbackEvents: Array.isArray(metaRecord.playbackEvents) ? metaRecord.playbackEvents : [],
        effectLogs: MatchAuthority.normalizeEffectLogMessages(metaRecord.effectLogs),
        playbackDiagnostics: MatchAuthority.toDebugPlaybackDiagnostics(metaRecord.playbackDiagnostics, toPublicNetworkDebugEnabled(room)),
        autoPassNotice: metaRecord.autoPassNotice || null,
        presentationCursor: buildPresentationCursor(room),
        presentationFrames: buildPresentationFramesForViewer(room, viewer, metaRecord),
        operationId: metaRecord.operationId ? String(metaRecord.operationId) : null,
        playerKey: metaRecord.playerKey ? normalizePlayerKey(metaRecord.playerKey) : null,
        actionType: metaRecord.actionType ? String(metaRecord.actionType) : null,
        serverTime
    }), room);
}

function buildPresencePayload(room: MatchWorkerRoomState, meta: MatchWorkerPresencePayloadMeta | null | undefined): Record<string, unknown> {
    const serverTime = Date.now();
    const metaRecord = asRecord(meta);
    return MatchAuthority.buildPresencePayloadFromRoom(room, Object.assign({}, metaRecord, {
        roomDeck: toPublicRoomDeck(room),
        roomBoardConfig: toPublicRoomBoardConfig(room),
        networkDebugEnabled: toPublicNetworkDebugEnabled(room),
        networkAutoEnabled: toPublicNetworkAutoEnabled(room),
        turnTimer: toPublicTurnTimer(room, serverTime),
        serverTime
    }));
}

function buildHeartbeatPayload(room: MatchWorkerRoomState, serverTime: unknown): Record<string, unknown> {
    return MatchAuthority.buildHeartbeatPayloadFromRoom(room, {
        roomDeck: toPublicRoomDeck(room),
        roomBoardConfig: toPublicRoomBoardConfig(room),
        networkDebugEnabled: toPublicNetworkDebugEnabled(room),
        networkAutoEnabled: toPublicNetworkAutoEnabled(room),
        turnTimer: toPublicTurnTimer(room, serverTime),
        serverTime
    });
}

function resolveSeatForJoin(room: MatchWorkerRoomState, requestedSeatKey: unknown, providedToken: unknown): MatchAuthoritySeatKey | null {
    return MatchAuthority.resolveSeatForJoin(room, requestedSeatKey, providedToken);
}

function sseChunk(eventName: unknown, payload: unknown, eventId?: unknown): string {
    const data = JSON.stringify(payload || {});
    const hasEventId = !(eventId === null || typeof eventId === 'undefined' || String(eventId) === '');
    const idLine = hasEventId ? `id: ${String(eventId)}\n` : '';
    const eventLine = eventName ? `event: ${eventName}\n` : '';
    return `${idLine}${eventLine}data: ${data}\n\n`;
}

async function resolveDeckSelection(rawDeckCodeValue: unknown): Promise<MatchWorkerDeckSelection> {
    const rawDeckCode = String(rawDeckCodeValue || '').trim();
    if (!rawDeckCode) {
        return {
            ok: true,
            hasCustomDeck: false,
            deckSpec: null,
            deckCode: '',
            deckSize: null
        };
    }

    try {
        const { deckSpecHelpers, deckCodecModule } = await loadDeckModules();
        const decodedDeckSpec = deckCodecModule.decodeDeckCode(rawDeckCode);
        const normalizedDeckSpec = deckSpecHelpers.normalizeDeckSpec(decodedDeckSpec, { requireFullDeck: false });
        const summary = deckSpecHelpers.summarizeDeckSpec(normalizedDeckSpec);
        const canonicalDeckCode = deckCodecModule.encodeDeckSpec(normalizedDeckSpec);
        return {
            ok: true,
            hasCustomDeck: true,
            deckSpec: normalizedDeckSpec,
            deckCode: canonicalDeckCode,
            deckSize: Number.isFinite(Number(summary && summary.deckSize)) ? Number(summary.deckSize) : null
        };
    } catch (error) {
        const errorRecord = asRecord(error);
        return {
            ok: false,
            hasCustomDeck: false,
            deckSpec: null,
            deckCode: '',
            deckSize: null,
            reason: errorRecord.code ? String(errorRecord.code) : 'DECK_CODE_INVALID',
            error
        };
    }
}

async function resolveAllCardsDeckSelection(): Promise<{
    ok: boolean;
    initialDeckCardIdsByPlayer: MatchWorkerSeatValueMap<string[] | null>;
    roomDeck: MatchWorkerRoomDeckMetadata | null;
    reason?: string;
}> {
    try {
        const { deckSpecHelpers } = await loadDeckModules();
        const cardIds = typeof deckSpecHelpers.getCpuLv9EndingAshDeckCardIds === 'function'
            ? deckSpecHelpers.getCpuLv9EndingAshDeckCardIds()
            : [];
        if (!Array.isArray(cardIds) || cardIds.length === 0) {
            return {
                ok: false,
                initialDeckCardIdsByPlayer: { black: null, white: null },
                roomDeck: null,
                reason: 'ALL_CARDS_DECK_UNAVAILABLE'
            };
        }
        const initialDeckCardIdsByPlayer = {
            black: cardIds.slice(),
            white: cardIds.slice()
        };
        return {
            ok: true,
            initialDeckCardIdsByPlayer,
            roomDeck: createAllCardsRoomDeckMetadataFromRuntimeCardIds(initialDeckCardIdsByPlayer)
        };
    } catch (error) {
        return {
            ok: false,
            initialDeckCardIdsByPlayer: { black: null, white: null },
            roomDeck: null,
            reason: 'ALL_CARDS_DECK_UNAVAILABLE'
        };
    }
}

async function handleCreate(env: MatchWorkerEnv, options: unknown): Promise<Response> {
    const opts = asRecord(options);
    const networkDebugEnabled = false;
    const networkAutoEnabled = opts.networkAutoEnabled === true;
    const publishResponseMode = MatchAuthority.normalizePublishResponseMode(opts.publishResponseMode);
    const playerName = normalizeNetworkPlayerName(opts.playerName) || MatchRoomLobby.createRandomPlayerName();
    const roomName = MatchRoomLobby.resolveRoomName(opts.roomName);
    const roomPassword = MatchRoomLobby.normalizeRoomPassword(opts.roomPassword);
    const roomBoardConfig = MatchAuthority.normalizeRoomBoardConfig(opts.roomBoardConfig);
    const allCardsDeckEnabled = opts.allCardsDeckEnabled === true;
    const allCardsDeckSelection = allCardsDeckEnabled ? await resolveAllCardsDeckSelection() : null;
    if (allCardsDeckSelection && !allCardsDeckSelection.ok) {
        return jsonResponse(500, {
            ok: false,
            reason: allCardsDeckSelection.reason || 'ALL_CARDS_DECK_UNAVAILABLE'
        });
    }
    const deckSelection = allCardsDeckEnabled
        ? {
            ok: true,
            hasCustomDeck: false,
            deckSpec: null,
            deckCode: '',
            deckSize: null
        }
        : await resolveDeckSelection(opts.deckCode);
    if (!deckSelection.ok) {
        return jsonResponse(400, {
            ok: false,
            reason: deckSelection.reason || 'DECK_CODE_INVALID'
        });
    }

    const initialDeckCardIdsByPlayer = allCardsDeckSelection && allCardsDeckSelection.ok
        ? allCardsDeckSelection.initialDeckCardIdsByPlayer
        : null;
    const initialDeckSpecByPlayer = !allCardsDeckEnabled && deckSelection.hasCustomDeck
        ? { black: deckSelection.deckSpec }
        : null;
    const roomDeck = allCardsDeckSelection && allCardsDeckSelection.ok
        ? allCardsDeckSelection.roomDeck
        : (deckSelection.hasCustomDeck
        ? {
            mode: 'perPlayer',
            deckCode: '',
            deckSize: null,
            deckCodeByPlayer: {
                black: deckSelection.deckCode,
                white: ''
            },
            deckSizeByPlayer: {
                black: deckSelection.deckSize,
                white: null
            },
            source: 'room'
        }
        : null);

    for (let attempt = 0; attempt < 12; attempt += 1) {
        const roomId = makeRoomId();
        const seed = Date.now();
        const snapshot = await makeInitialSnapshot(seed, {
            initialDeckCardIdsByPlayer,
            initialDeckSpecByPlayer,
            roomBoardConfig
        });
        const stub = getRoomStub(env, roomId);
        const req = new Request('https://room/internal/create', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                roomId,
                seed,
                snapshot,
                playerName,
                selectedHandSkinId: opts.selectedHandSkinId,
                networkDebugEnabled,
                networkAutoEnabled,
                allCardsDeckEnabled,
                initialDeckCardIdsByPlayer,
                publishResponseMode,
                roomName,
                roomPassword,
                initialDeckSpecByPlayer,
                roomDeck,
                roomBoardConfig,
                playerId: opts.playerId
            })
        });
        const response = await stub.fetch(req);
        if (response.status === 409) {
            continue;
        }
        await syncLobbyFromResponse(env, roomId, response.clone());
        return withCORS(response);
    }
    return jsonResponse(500, { ok: false, reason: 'CREATE_RETRY_EXHAUSTED' });
}

const MatchWorkerApiController = createMatchWorkerApiController({
    corsHeaders: CORS_HEADERS,
    leaderboardRoomId: LEADERBOARD_ROOM_ID,
    ratingPoolRoomId: RATING_POOL_CARD_RANKED_ROOM_ID,
    lobbyRoomId: MATCH_LOBBY_ROOM_ID,
    playerIdentityRoomId: PLAYER_IDENTITY_ROOM_ID,
    normalizeRoomId,
    jsonResponse,
    withCORS,
    handleCreate,
    afterRoomMutation: async (env, pathname, roomId, response) => {
        if (pathname !== '/api/match/join' && pathname !== '/api/match/leave') return;
        await syncLobbyFromResponse(env, roomId, response);
    }
});

function getRoomStub(env: MatchWorkerEnv, roomId: string) {
    return MatchWorkerApiController.getRoomStub(env, roomId);
}

function withPublicRoomPasswordMetadata(payloadValue: unknown, roomValue: unknown): unknown {
    const payload = asRecord(payloadValue);
    payload.roomHasPassword = MatchRoomLobby.hasRoomPassword(roomValue);
    return payload;
}

function isRatedRoomRecord(value: unknown): boolean {
    const record = asRecord(value);
    if (String(record.matchType || '').trim().toLowerCase() === 'rated') return true;
    const ratedMatch = asRecord(record.ratedMatch);
    return ratedMatch.enabled === true;
}

function toPublicRatingSeatResult(value: unknown): Record<string, unknown> | null {
    const source = asRecord(value);
    const display = asRecord(source.display);
    return {
        playerId: String(source.playerId || '').trim(),
        display: {
            before: Number.isFinite(Number(display.before)) ? Math.round(Number(display.before)) : null,
            after: Number.isFinite(Number(display.after)) ? Math.round(Number(display.after)) : null,
            delta: Number.isFinite(Number(display.delta)) ? Math.trunc(Number(display.delta)) : null
        }
    };
}

function toPublicRatingResult(value: unknown): Record<string, unknown> | null {
    const source = asRecord(value);
    if (source.ok !== true) return null;
    return {
        ok: true,
        matchId: String(source.matchId || '').trim(),
        result: String(source.result || '').trim(),
        black: toPublicRatingSeatResult(source.black),
        white: toPublicRatingSeatResult(source.white)
    };
}

function toPublicRatedMatch(room: MatchWorkerRoomState | null | undefined): Record<string, unknown> | null {
    if (!isRatedRoomRecord(room)) return null;
    const source = asRecord(room && room.ratedMatch);
    const out: Record<string, unknown> = {
        enabled: source.enabled === true,
        pool: String(source.pool || 'card_ranked_v1'),
        systemVersion: Number.isFinite(Number(source.systemVersion)) ? Math.trunc(Number(source.systemVersion)) : 1,
        matchId: String(source.matchId || '').trim(),
        matchedAt: Number.isFinite(Number(source.matchedAt)) ? Math.trunc(Number(source.matchedAt)) : 0,
        startedAt: typeof source.startedAt === 'string' ? source.startedAt : '',
        finalizedAt: typeof source.finalizedAt === 'string' ? source.finalizedAt : '',
        finalResult: typeof source.finalResult === 'string' ? source.finalResult : '',
        finalReason: typeof source.finalReason === 'string' ? source.finalReason : '',
        ratingStatus: typeof source.ratingStatus === 'string' ? source.ratingStatus : 'pending'
    };
    const publicRatingResult = toPublicRatingResult(source.ratingResult);
    if (publicRatingResult) out.ratingResult = publicRatingResult;
    return out;
}

function withPublicRatedMatchMetadata<T extends Record<string, unknown>>(payload: T, room: MatchWorkerRoomState | null | undefined): T {
    const ratedMatch = toPublicRatedMatch(room);
    if (ratedMatch) {
        (payload as Record<string, unknown>).matchType = 'rated';
        (payload as Record<string, unknown>).ratedMatch = ratedMatch;
    }
    return payload;
}

function resolveRatedResultFromSnapshot(snapshotValue: unknown): 'BLACK_WIN' | 'WHITE_WIN' | 'DRAW' | null {
    const boardUtils = readRuntimeGlobalValue('SharedBoardUtils');
    const counts = MatchAuthority.countSnapshotBoardDiscs(
        snapshotValue,
        boardUtils && typeof boardUtils === 'object'
            ? boardUtils as Record<string, unknown>
            : null
    );
    if (!counts) return null;
    if (counts.black > counts.white) return 'BLACK_WIN';
    if (counts.white > counts.black) return 'WHITE_WIN';
    return 'DRAW';
}

function buildLobbyEntryFromPayload(payloadValue: unknown, fallbackRoomId: string): unknown | null {
    const payload = asRecord(payloadValue);
    if (isRatedRoomRecord(payload)) return null;
    const entry = MatchRoomLobby.toPublicRoomListEntry(Object.assign({}, payload, {
        roomId: payload.roomId || fallbackRoomId,
        roomHasPassword: payload.roomHasPassword === true
    }));
    return entry;
}

function buildLobbyEntryFromRoom(roomValue: unknown, fallbackRoomId: string, nowMs = Date.now()): unknown | null {
    const room = asRecord(roomValue);
    const roomId = normalizeRoomId(room.roomId || fallbackRoomId);
    if (!roomId) return null;
    if (isRatedRoomRecord(room)) return null;
    return MatchRoomLobby.toPublicRoomListEntry(Object.assign({}, room, {
        roomId,
        roomHasPassword: MatchRoomLobby.hasRoomPassword(room)
    }), { nowMs });
}

async function postLobbyUpdate(env: MatchWorkerEnv, pathname: string, body: unknown): Promise<void> {
    try {
        const stub = getRoomStub(env, MATCH_LOBBY_ROOM_ID);
        await stub.fetch(new Request(`https://room${pathname}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body || {})
        }));
    } catch (e) { /* lobby is best-effort; room authority remains canonical */ }
}

async function syncLobbyFromResponse(env: MatchWorkerEnv, fallbackRoomId: string, response: Response): Promise<void> {
    if (!response) return;
    let payload: unknown = null;
    try {
        payload = await response.json();
    } catch (e) {
        return;
    }
    const roomId = normalizeRoomId(asRecord(payload).roomId || fallbackRoomId);
    if (!roomId) return;
    if (response.status === 404 && asRecord(payload).reason === 'ROOM_NOT_FOUND') {
        await postLobbyUpdate(env, '/internal/lobby/remove', { roomId });
        return;
    }
    if (response.status < 200 || response.status >= 300) return;
    const entry = buildLobbyEntryFromPayload(payload, roomId);
    if (entry) {
        await postLobbyUpdate(env, '/internal/lobby/upsert', { entry });
    } else {
        await postLobbyUpdate(env, '/internal/lobby/remove', { roomId });
    }
}

function handleMatchApi(request: Request, env: MatchWorkerEnv): Promise<Response> {
    return MatchWorkerApiController.handleMatchApi(request, env);
}

function handleLeaderboardApi(request: Request, env: MatchWorkerEnv): Promise<Response> {
    return MatchWorkerApiController.handleLeaderboardApi(request, env);
}

function handleRatingApi(request: Request, env: MatchWorkerEnv): Promise<Response> {
    return MatchWorkerApiController.handleRatingApi(request, env);
}

export class MatchRoomDurableObject implements MatchRoomDurableObjectApi {
    state: DurableObjectStateLike;
    env: MatchWorkerEnv | null;
    room: MatchWorkerRoomState | null;
    roomLoaded: boolean;
    streams: Map<string, MatchWorkerSseStreamInfo>;
    encoder: TextEncoder;
    heartbeatTimerId: ReturnType<typeof setTimeout> | null;
    sseEventBuffer: MatchAuthorityBufferedSseEventRecord[];
    leaderboardRoomController: ReturnType<typeof createMatchWorkerLeaderboardRoomController> | null;
    playerIdentityController: ReturnType<typeof createMatchWorkerPlayerIdentityController> | null;
    ratingHelpers: ReturnType<typeof createMatchWorkerRatingHelpers> | null;
    broadcastController: ReturnType<typeof createMatchWorkerBroadcastController> | null;
    chatController: ReturnType<typeof createMatchWorkerChatController> | null;
    streamController: ReturnType<typeof createMatchWorkerStreamController> | null;
    streamRouteController: ReturnType<typeof createMatchWorkerStreamRouteController> | null;
    streamSessionController: ReturnType<typeof createMatchWorkerStreamSessionController> | null;
    turnTimerController: ReturnType<typeof createMatchWorkerTurnTimerController> | null;
    timeoutController: ReturnType<typeof createMatchWorkerTimeoutController> | null;
    publishController: ReturnType<typeof createMatchWorkerPublishController> | null;

    constructor(state: DurableObjectStateLike, env?: MatchWorkerEnv | null) {
        this.state = state;
        this.env = env && typeof env === 'object' ? env : null;
        this.room = null;
        this.roomLoaded = false;
        this.streams = new Map();
        this.encoder = new TextEncoder();
        this.heartbeatTimerId = null;
        this.sseEventBuffer = [];
        this.leaderboardRoomController = null;
        this.playerIdentityController = null;
        this.ratingHelpers = null;
        this.broadcastController = null;
        this.chatController = null;
        this.streamController = null;
        this.streamRouteController = null;
        this.streamSessionController = null;
        this.turnTimerController = null;
        this.timeoutController = null;
        this.publishController = null;
    }

    getLeaderboardRoomController() {
        if (!this.leaderboardRoomController) {
            this.leaderboardRoomController = createMatchWorkerLeaderboardRoomController({
                storage: this.state.storage,
                storageKey: LEADERBOARD_STORAGE_KEY,
                timeAttackStorageKey: TIME_ATTACK_LEADERBOARD_STORAGE_KEY,
                timeDefenseStorageKey: TIME_DEFENSE_LEADERBOARD_STORAGE_KEY,
                shortestTurnsStorageKey: SHORTEST_TURNS_LEADERBOARD_STORAGE_KEY,
                legacyStorageKey: LEGACY_LEADERBOARD_STORAGE_KEY,
                legacyTimeAttackStorageKey: LEGACY_TIME_ATTACK_LEADERBOARD_STORAGE_KEY,
                legacyTimeDefenseStorageKey: LEGACY_TIME_DEFENSE_LEADERBOARD_STORAGE_KEY,
                legacyShortestTurnsStorageKey: LEGACY_SHORTEST_TURNS_LEADERBOARD_STORAGE_KEY,
                defaultLimit: LEADERBOARD_DEFAULT_LIMIT,
                helpers: MatchWorkerLeaderboardHelpers,
                jsonResponse
            });
        }
        return this.leaderboardRoomController;
    }

    getPlayerIdentityController() {
        if (!this.playerIdentityController) {
            this.playerIdentityController = createMatchWorkerPlayerIdentityController({
                storage: this.state.storage,
                storageKey: PLAYER_IDENTITY_STORAGE_KEY,
                jsonResponse
            });
        }
        return this.playerIdentityController;
    }

    getRatingHelpers() {
        if (!this.ratingHelpers) {
            this.ratingHelpers = createMatchWorkerRatingHelpers();
        }
        return this.ratingHelpers;
    }

    getBroadcastController() {
        if (!this.broadcastController) {
            this.broadcastController = createMatchWorkerBroadcastController({
                getRoom: () => this.room,
                getStreams: () => this.streams,
                nextSseEventId: () => this.nextSseEventId(),
                rememberBufferedSseEvent: (record) => this.rememberBufferedSseEvent(record),
                saveRoom: () => this.saveRoom(),
                sendSse: (streamId, eventName, payload, options) => this.sendSse(streamId, eventName, payload, options),
                buildSnapshotPayload,
                buildPresencePayload
            });
        }
        return this.broadcastController;
    }

    getChatController() {
        if (!this.chatController) {
            this.chatController = createMatchWorkerChatController({
                getRoom: () => this.room,
                loadRoom: () => this.loadRoom(),
                saveRoom: () => this.saveRoom(),
                applyExpiredTurnTimeoutIfNeeded: () => this.applyExpiredTurnTimeoutIfNeeded(),
                normalizePlayerKey,
                buildPublicSeatState,
                toPublicTurnTimer,
                withPublicSeatState,
                toPublicNetworkDebugEnabled,
                classifySeatTokenRejectionReason,
                broadcastChat: (payload) => this.broadcastChat(payload),
                jsonResponse,
                chatMaxLength: CHAT_MAX_LENGTH,
                chatHistoryLimit: CHAT_HISTORY_LIMIT
            });
        }
        return this.chatController;
    }

    getStreamController() {
        if (!this.streamController) {
            this.streamController = createMatchWorkerStreamController({
                getRoom: () => this.room,
                getSseEventBuffer: () => this.sseEventBuffer,
                setSseEventBuffer: (buffer) => { this.sseEventBuffer = buffer; },
                getStreams: () => this.streams,
                getHeartbeatTimerId: () => this.heartbeatTimerId,
                setHeartbeatTimerId: (value) => { this.heartbeatTimerId = value; },
                encoder: this.encoder,
                normalizeRoomId,
                appendBufferedSseEvent: MatchAuthority.appendBufferedSseEvent,
                makeSseStreamId: MatchAuthority.makeSseStreamId,
                cryptoLike: crypto as unknown as MatchWorkerCryptoLike,
                buildHeartbeatPayload,
                saveRoom: () => this.saveRoom(),
                onStreamCountChanged: async () => { await this.markRoomInactiveIfIdle(); },
                onStreamClosed: async (stream) => { await this.markRatedStreamDisconnected(stream); },
                sseChunk,
                heartbeatIntervalMs: SSE_HEARTBEAT_INTERVAL_MS,
                writeTimeoutMs: MATCH_WORKER_SSE_WRITE_TIMEOUT_MS
            });
        }
        return this.streamController;
    }

    getStreamSessionController() {
        if (!this.streamSessionController) {
            this.streamSessionController = createMatchWorkerStreamSessionController({
                appendAuthorityLog: MatchAuthority.appendAuthorityLog,
                buildHeartbeatPayload,
                withPublicSeatState,
                toPublicRoomDeck,
                toPublicNetworkDebugEnabled,
                toPublicChatMessages,
                sendSse: (streamId, eventName, payload, options) => this.sendSse(streamId, eventName, payload, options),
                closeStream: (streamId) => this.closeStream(streamId)
            });
        }
        return this.streamSessionController;
    }

    getStreamRouteController() {
        if (!this.streamRouteController) {
            this.streamRouteController = createMatchWorkerStreamRouteController({
                getRoom: () => this.room,
                getStreams: () => this.streams,
                getSseEventBuffer: () => this.sseEventBuffer,
                loadRoom: () => this.loadRoom(),
                expireRoomIfNeeded: (nowMs) => this.expireRoomIfNeeded(nowMs),
                applyExpiredTurnTimeoutIfNeeded: () => this.applyExpiredTurnTimeoutIfNeeded(),
                parseSeatKeyOptional,
                resolveAuthenticatedViewer,
                classifyViewerTokenRejectionReason,
                getBufferedSseReplayEvents: MatchAuthority.getBufferedSseReplayEvents,
                makeSseStreamId: MatchAuthority.makeSseStreamId,
                buildSnapshotPayload,
                scheduleInitialStreamDelivery: (options) => this.getStreamSessionController().scheduleInitialStreamDelivery(options),
                closeStream: (streamId) => this.closeStream(streamId),
                ensureHeartbeatTimer: () => this.ensureHeartbeatTimer(),
                onStreamOpened: async (streamId) => {
                    await this.markRatedStreamConnected(streamId);
                    await this.markRoomActiveFromStream();
                },
                jsonResponse,
                corsHeaders: CORS_HEADERS,
                cryptoLike: crypto as unknown as MatchWorkerCryptoLike
            });
        }
        return this.streamRouteController;
    }

    getTurnTimerController() {
        if (!this.turnTimerController) {
            this.turnTimerController = createMatchWorkerTurnTimerController({
                getRoom: () => this.room,
                getStorage: () => this.state && this.state.storage ? this.state.storage : null,
                loadCoreLogicModule,
                hasTwoActiveSeats,
                resolveTurnSeatKey,
                parseSeatKeyOptional,
                createPausedTurnTimer,
                createActiveTurnTimer,
                areTurnTimersEqual
            });
        }
        return this.turnTimerController;
    }

    getTimeoutController() {
        if (!this.timeoutController) {
            this.timeoutController = createMatchWorkerTimeoutController({
                getRoom: () => this.room,
                parseSeatKeyOptional,
                resolveTurnSeatKey,
                refreshTurnTimer: (options) => this.refreshTurnTimer(options),
                saveRoom: () => this.saveRoom(),
                applyTimeoutPassToSnapshot,
                deepClone,
                computeAuthoritativeStateHash: MatchAuthority.computeAuthoritativeStateHash,
                stripTransientChargeDeltaState: MatchAuthority.stripTransientChargeDeltaState,
                normalizeSnapshotBoardContract: MatchAuthority.normalizeSnapshotBoardContract,
                appendAuthorityLog: MatchAuthority.appendAuthorityLog,
                ensureInitialPresentationSnapshots,
                buildPublishViewerArtifacts: (room: MatchWorkerRoomState, options?: Record<string, unknown>) => (
                    MatchAuthority.buildPublishViewerArtifacts(room, options)
                ),
                appendPresentationFrameForAcceptedPublish,
                broadcastSnapshot: (meta) => this.broadcastSnapshot(meta)
            });
        }
        return this.timeoutController;
    }

    getPublishController() {
        if (!this.publishController) {
            this.publishController = createMatchWorkerPublishController({
                loadRoom: () => this.loadRoom(),
                getRoom: () => this.room,
                applyExpiredTurnTimeoutIfNeeded: () => this.applyExpiredTurnTimeoutIfNeeded(),
                normalizePlayerKey,
                normalizeOperationId,
                resolveSeatKey: (body: Record<string, unknown>) => normalizePlayerKey(body.seatKey),
                resolvePlayerKey: (body: Record<string, unknown>) => normalizePlayerKey(body.playerKey),
                allowFateWillOwnerAction: true,
                isNetworkDebugFillHandPayload,
                resolveAuthenticatedSeatKey,
                ensureAcceptedOperationsBySeat,
                asRecord,
                MatchAuthority,
                buildPublishPayload,
                getCurrentPlayerKey,
                toPublicNetworkDebugEnabled,
                deepClone,
                makeInitialSnapshot,
                buildInitialDeckSnapshotOptions,
                applyCommandPublishToSnapshot,
                isSnapshotGameOver: (snapshot: MatchWorkerPublicSnapshot | null | undefined) => this.isSnapshotGameOver(snapshot),
                finalizeRatedMatchAfterAcceptedPublish: async () => {
                    const result = await this.resolveRatedNormalResult();
                    if (result) await this.finalizeRatedMatchIfNeeded(result, 'normal_end');
                },
                refreshTurnTimer: (options: MatchWorkerTurnTimerOptions | null | undefined) => this.refreshTurnTimer(options),
                buildPublishViewerArtifacts: (room: MatchWorkerRoomState, options: Record<string, unknown>) => (
                    MatchAuthority.buildPublishViewerArtifacts(room, options)
                ),
                prepareSnapshotBroadcast: (meta: MatchWorkerSnapshotPayloadMeta | null | undefined) => this.prepareSnapshotBroadcast(meta),
                stagePreparedSnapshotBroadcast: (preparedSnapshot: MatchWorkerPreparedSnapshotBroadcast) => (
                    this.getBroadcastController().stagePreparedSnapshotBroadcast(preparedSnapshot)
                ),
                ensureInitialPresentationSnapshots,
                appendPresentationFrameForAcceptedPublish,
                saveRoom: () => this.saveRoom(),
                broadcastSnapshot: (meta: MatchWorkerSnapshotPayloadMeta | null | undefined) => this.broadcastSnapshot(meta),
                jsonResponse
            });
        }
        return this.publishController;
    }

    getLeaveController() {
        return createMatchLeaveController({
            loadRoom: () => this.loadRoom(),
            awaitLoadRoom: true,
            getRoom: () => this.room,
            expireRoomIfNeeded: () => this.expireRoomIfNeeded(Date.now()),
            awaitExpireRoomIfNeeded: true,
            normalizePlayerKey,
            resolveAuthenticatedSeatKey,
            classifySeatTokenRejectionReason,
            makeSeatToken,
            MatchAuthority,
            refreshTurnTimer: (_room: MatchWorkerRoomState, options: MatchWorkerTurnTimerOptions | null | undefined) => this.refreshTurnTimer(options),
            awaitRefreshTurnTimer: true,
            closeStreamsForSeat: (_room: MatchWorkerRoomState, seatKey: MatchAuthoritySeatKey) => this.closeStreamsForSeat(seatKey),
            awaitCloseStreamsForSeat: true,
            broadcastPresence: (meta: MatchWorkerPresencePayloadMeta | null | undefined) => this.broadcastPresence(meta),
            awaitBroadcastPresence: true,
            getStreamCount: () => this.streams.size,
            removeRoom: () => this.removeRoom(),
            awaitRemoveRoom: true,
            saveRoom: () => this.saveRoom(),
            awaitSaveRoom: true,
            toPublicRoomBoardConfig,
            toPublicTurnTimer,
            decorateRoomPayload: withPublicRoomPasswordMetadata,
            jsonResponse
        });
    }

    getRoomPreferencesController() {
        return createMatchRoomPreferencesController({
            loadRoom: () => this.loadRoom(),
            awaitLoadRoom: true,
            getRoom: () => this.room,
            expireRoomIfNeeded: () => this.expireRoomIfNeeded(Date.now()),
            awaitExpireRoomIfNeeded: true,
            parseSeatKeyOptional,
            resolveAuthenticatedSeatKey,
            classifySeatTokenRejectionReason,
            isSeatJoined: (room: MatchWorkerRoomState, seatKey: MatchAuthoritySeatKey) => !!asRecord(room.seats)[seatKey],
            normalizeSeatHandSkinId,
            toPublicSeatHandSkins,
            saveRoom: () => this.saveRoom(),
            awaitSaveRoom: true,
            broadcastPresence: (meta: MatchWorkerPresencePayloadMeta | null | undefined) => this.broadcastPresence(meta),
            awaitBroadcastPresence: true,
            isAllCardsDeckRoom,
            resolveDeckSelection,
            awaitResolveDeckSelection: true,
            assignRoomDeckSelection,
            MatchAuthority,
            toPublicRoomDeck,
            toPublicRoomBoardConfig,
            toPublicNetworkDebugEnabled,
            toPublicNetworkAutoEnabled,
            includeNetworkAutoEnabledForHandSkin: true,
            includeNetworkAutoEnabledForDeck: true,
            toPublicTurnTimer,
            decorateRoomPayload: (payload: Record<string, unknown>) => payload,
            jsonResponse
        });
    }

    getRematchController() {
        return createMatchRematchController({
            loadRoom: () => this.loadRoom(),
            awaitLoadRoom: true,
            getRoom: () => this.room,
            expireRoomIfNeeded: () => this.expireRoomIfNeeded(Date.now()),
            awaitExpireRoomIfNeeded: true,
            validateSeat: (room: MatchWorkerRoomState, body: Record<string, unknown>) => {
                const requestedSeatKey = parseSeatKeyOptional(body.seatKey);
                const seatToken = String(body.seatToken || '').trim();
                const seatKey = resolveAuthenticatedSeatKey(room, requestedSeatKey, seatToken);
                if (!seatKey) {
                    return { ok: false, status: 403, reason: classifySeatTokenRejectionReason(seatToken) };
                }
                if (!asRecord(room.seats)[seatKey]) {
                    return { ok: false, status: 409, reason: 'SEAT_NOT_JOINED' };
                }
                return { ok: true, seatKey };
            },
            buildSeatFailurePayload: (_room: MatchWorkerRoomState, validation: any) => ({
                ok: false,
                reason: validation.reason
            }),
            hasOpponent: (room: MatchWorkerRoomState) => !!asRecord(room.seats).black && !!asRecord(room.seats).white,
            buildOpponentRequiredPayload: () => ({ ok: false, reason: 'OPPONENT_REQUIRED' }),
            makeRematchRequestId,
            touchRoom: () => undefined,
            broadcastPresence: (meta: MatchWorkerPresencePayloadMeta | null | undefined) => this.broadcastPresence(meta),
            awaitBroadcastPresence: true,
            buildRequestPayload: (room: MatchWorkerRoomState, value: any) => {
                const serverTime = Date.now();
                return MatchAuthority.buildRoomPayloadFromRoom(room, {
                    ok: true,
                    seatKey: value.seatKey,
                    requestId: value.requestId,
                    roomDeck: toPublicRoomDeck(room),
                    roomBoardConfig: toPublicRoomBoardConfig(room),
                    networkDebugEnabled: toPublicNetworkDebugEnabled(room),
                    networkAutoEnabled: toPublicNetworkAutoEnabled(room),
                    turnTimer: toPublicTurnTimer(room, serverTime),
                    serverTime
                });
            },
            buildResponsePayload: (room: MatchWorkerRoomState, value: any) => {
                const serverTime = Date.now();
                return MatchAuthority.buildRoomPayloadFromRoom(room, {
                    ok: true,
                    seatKey: value.seatKey,
                    requestId: value.requestId,
                    accepted: value.accepted,
                    roomDeck: toPublicRoomDeck(room),
                    roomBoardConfig: toPublicRoomBoardConfig(room),
                    networkDebugEnabled: toPublicNetworkDebugEnabled(room),
                    networkAutoEnabled: toPublicNetworkAutoEnabled(room),
                    turnTimer: toPublicTurnTimer(room, serverTime),
                    serverTime
                });
            },
            jsonResponse
        });
    }

    getStateController() {
        return createMatchStateController({
            loadRoom: () => this.loadRoom(),
            awaitLoadRoom: true,
            getRoom: () => this.room,
            expireRoomIfNeeded: () => this.expireRoomIfNeeded(Date.now()),
            awaitExpireRoomIfNeeded: true,
            applyExpiredTurnTimeoutIfNeeded: () => this.applyExpiredTurnTimeoutIfNeeded(),
            awaitApplyExpiredTurnTimeoutIfNeeded: true,
            applyTimeoutForState: true,
            applyTimeoutForJournal: false,
            getSearchParam: (urlObj: URL, key: string) => urlObj.searchParams.get(key),
            getSearchParams: (urlObj: URL) => urlObj.searchParams,
            parseSeatKeyOptional,
            resolveAuthenticatedViewer,
            classifyViewerTokenRejectionReason,
            asRecord,
            MatchAuthority,
            toPublicRoomDeck,
            toPublicRoomBoardConfig,
            toPublicNetworkDebugEnabled,
            toPublicNetworkAutoEnabled,
            toPublicSnapshotForViewer,
            toPublicTurnTimer,
            buildPresentationCursor,
            normalizePlayerKey,
            decorateStatePayload: withPublicRatedMatchMetadata,
            jsonResponse
        });
    }

    async loadRoom(): Promise<void> {
        if (this.roomLoaded) return;
        this.room = await this.state.storage.get(ROOM_STORAGE_KEY) as MatchWorkerRoomState | null || null;
        let boardContractMigrated = false;
        if (this.room && this.room.snapshot && typeof this.room.snapshot === 'object') {
            const boardContractInspection = MatchAuthority.normalizeSnapshotBoardContract(this.room.snapshot, {
                allowLegacy: true,
                requireFullSnapshot: true
            });
            if (!boardContractInspection || boardContractInspection.ok !== true) {
                throw new Error(`stored_snapshot_invalid_board_contract: ${(boardContractInspection && boardContractInspection.errors || []).join('; ')}`);
            }
            boardContractMigrated = boardContractInspection.migrated === true;
        }
        if (this.room && !Number.isFinite(Number(this.room.createdAt))) {
            this.room.createdAt = Number.isFinite(Number(this.room.updatedAt)) ? Number(this.room.updatedAt) : Date.now();
        }
        if (this.room && !Array.isArray(this.room.sseEventBuffer)) {
            this.room.sseEventBuffer = [];
        }
        if (this.room && !Array.isArray(this.room.authorityLog)) {
            this.room.authorityLog = [];
        }
        if (this.room && (boardContractMigrated || typeof this.room.authoritativeStateHash === 'undefined')) {
            this.room.authoritativeStateHash = MatchAuthority.computeAuthoritativeStateHash(this.room.snapshot);
        }
        this.sseEventBuffer = this.room && Array.isArray(this.room.sseEventBuffer)
            ? this.room.sseEventBuffer.slice()
            : [];
        this.roomLoaded = true;
        if (boardContractMigrated) {
            await this.saveRoom();
        }
    }

    async saveRoom(): Promise<void> {
        if (this.room && this.room.snapshot && typeof this.room.snapshot === 'object') {
            const boardContractInspection = MatchAuthority.normalizeSnapshotBoardContract(this.room.snapshot, {
                allowLegacy: true,
                requireFullSnapshot: true
            });
            if (!boardContractInspection || boardContractInspection.ok !== true) {
                throw new Error(`snapshot_invalid_board_contract: ${(boardContractInspection && boardContractInspection.errors || []).join('; ')}`);
            }
        }
        await this.state.storage.put(ROOM_STORAGE_KEY, deepClone(this.room));
    }

    async removeLobbyEntryForRoom(roomIdValue: unknown): Promise<void> {
        const roomId = normalizeRoomId(roomIdValue);
        if (!roomId || roomId === MATCH_LOBBY_ROOM_ID || !this.env || !this.env.MATCH_ROOM) return;
        await postLobbyUpdate(this.env, '/internal/lobby/remove', { roomId });
    }

    async removeRoom(options?: { syncLobby?: boolean } | null): Promise<void> {
        const removedRoomId = normalizeRoomId(this.room && this.room.roomId);
        this.room = null;
        this.sseEventBuffer = [];
        if (this.heartbeatTimerId !== null) {
            try { clearTimeout(this.heartbeatTimerId); } catch (e) { /* ignore */ }
            this.heartbeatTimerId = null;
        }
        if (this.state.storage && typeof this.state.storage.deleteAlarm === 'function') {
            await this.state.storage.deleteAlarm();
        }
        if (this.state.storage && typeof this.state.storage.deleteAll === 'function') {
            await this.state.storage.deleteAll();
        } else {
            await this.state.storage.delete(ROOM_STORAGE_KEY);
        }
        if (!options || options.syncLobby !== false) {
            await this.removeLobbyEntryForRoom(removedRoomId);
        }
    }

    async expireWaitingRoomIfNeeded(nowMs = Date.now(), options?: { syncLobby?: boolean } | null): Promise<boolean> {
        if (!this.room || !MatchRoomLobby.isWaitingRoomExpired(this.room, nowMs)) return false;
        await this.removeRoom(options);
        return true;
    }

    async expireInactiveRoomIfNeeded(nowMs = Date.now(), options?: { syncLobby?: boolean } | null): Promise<boolean> {
        if (!this.room || !MatchRoomLobby.isInactiveRoomExpired(this.room, nowMs)) return false;
        if (this.streams.size > 0) {
            if (MatchRoomLobby.clearRoomInactive(this.room)) {
                await this.saveRoom();
            }
            await this.syncTurnTimerAlarm();
            return false;
        }
        await this.removeRoom(options);
        return true;
    }

    async markStoredIdleRoomInactiveIfNeeded(nowMs = Date.now(), options?: { syncLobby?: boolean } | null): Promise<boolean> {
        if (!this.room || this.streams.size > 0 || MatchRoomLobby.readInactiveSince(this.room) > 0) return false;
        if (MatchRoomLobby.isWaitingRoom(this.room)) return false;
        if (MatchAuthority.shouldDisposeRoom(this.room, this.streams.size)) {
            await this.removeRoom(options);
            return true;
        }

        const roomRecord = asRecord(this.room);
        const updatedAt = Number.isFinite(Number(roomRecord.updatedAt)) ? Math.trunc(Number(roomRecord.updatedAt)) : 0;
        const createdAt = MatchRoomLobby.readCreatedAt(this.room);
        const inactiveStartMs = Math.min(
            updatedAt > 0 ? updatedAt : (createdAt > 0 ? createdAt : nowMs),
            nowMs
        );
        MatchRoomLobby.markRoomInactive(this.room, inactiveStartMs);
        if (MatchRoomLobby.isInactiveRoomExpired(this.room, nowMs)) {
            await this.removeRoom(options);
            return true;
        }
        await this.saveRoom();
        const expiresAt = MatchRoomLobby.getInactiveRoomExpiresAt(this.room);
        if (expiresAt > 0 && this.state.storage && typeof this.state.storage.setAlarm === 'function') {
            await this.state.storage.setAlarm(expiresAt);
        }
        return false;
    }

    async expireRoomIfNeeded(nowMs = Date.now(), options?: { syncLobby?: boolean } | null): Promise<boolean> {
        if (await this.expireWaitingRoomIfNeeded(nowMs, options)) return true;
        if (await this.markStoredIdleRoomInactiveIfNeeded(nowMs, options)) return true;
        if (await this.expireInactiveRoomIfNeeded(nowMs, options)) return true;
        return false;
    }

    async syncWaitingRoomExpiryAlarm(nowMs = Date.now()): Promise<boolean> {
        if (!this.room || !MatchRoomLobby.isWaitingRoom(this.room)) return false;
        if (await this.expireRoomIfNeeded(nowMs)) return true;
        const expiresAt = MatchRoomLobby.getWaitingRoomExpiresAt(this.room);
        if (expiresAt > 0 && this.state.storage && typeof this.state.storage.setAlarm === 'function') {
            await this.state.storage.setAlarm(expiresAt);
        }
        return false;
    }

    async syncInactiveRoomExpiryAlarm(nowMs = Date.now()): Promise<boolean> {
        if (!this.room) return false;
        if (await this.expireRoomIfNeeded(nowMs)) return true;
        const expiresAt = MatchRoomLobby.getInactiveRoomExpiresAt(this.room);
        if (expiresAt > 0 && this.streams.size === 0 && this.state.storage && typeof this.state.storage.setAlarm === 'function') {
            await this.state.storage.setAlarm(expiresAt);
        }
        return false;
    }

    async markRoomInactiveIfIdle(nowMs = Date.now()): Promise<boolean> {
        if (!this.room || this.streams.size > 0) return false;
        if (MatchAuthority.shouldDisposeRoom(this.room, this.streams.size)) {
            await this.removeRoom();
            return true;
        }
        const changed = MatchRoomLobby.markRoomInactive(this.room, nowMs);
        const expired = await this.syncInactiveRoomExpiryAlarm(nowMs);
        if (expired) return true;
        if (changed) {
            await this.saveRoom();
        }
        return changed;
    }

    async markRoomActiveFromStream(nowMs = Date.now()): Promise<boolean> {
        if (!this.room) return false;
        const changed = MatchRoomLobby.clearRoomInactive(this.room);
        if (changed) {
            await this.saveRoom();
        }
        if (MatchRoomLobby.isWaitingRoom(this.room)) {
            await this.syncWaitingRoomExpiryAlarm(nowMs);
        } else {
            await this.syncTurnTimerAlarm();
        }
        return changed;
    }

    ensureRatedPresence(): Record<string, unknown> {
        if (!this.room) return {};
        const existing = asRecord((this.room as Record<string, unknown>).ratedPresence);
        const next = {
            blackDisconnectedAt: Number.isFinite(Number(existing.blackDisconnectedAt)) ? Math.max(0, Math.trunc(Number(existing.blackDisconnectedAt))) : 0,
            whiteDisconnectedAt: Number.isFinite(Number(existing.whiteDisconnectedAt)) ? Math.max(0, Math.trunc(Number(existing.whiteDisconnectedAt))) : 0,
            disconnectGraceMs: Number.isFinite(Number(existing.disconnectGraceMs)) ? Math.max(1000, Math.trunc(Number(existing.disconnectGraceMs))) : 120000
        };
        (this.room as Record<string, unknown>).ratedPresence = next;
        return next;
    }

    async markRatedStreamConnected(streamId: string): Promise<void> {
        if (!this.room || !isRatedRoomRecord(this.room)) return;
        const stream = this.streams.get(streamId);
        const viewer = stream && stream.viewer;
        if (!viewer || viewer.role !== 'seat') return;
        const seatKey = parseSeatKeyOptional(viewer.seatKey);
        if (!seatKey) return;
        const presence = this.ensureRatedPresence();
        presence[seatKey === 'black' ? 'blackDisconnectedAt' : 'whiteDisconnectedAt'] = 0;
        await this.saveRoom();
    }

    async markRatedStreamDisconnected(stream: MatchWorkerSseStreamInfo | null | undefined, nowMs = Date.now()): Promise<void> {
        if (!this.room || !isRatedRoomRecord(this.room) || !stream || !stream.viewer || stream.viewer.role !== 'seat') return;
        const seatKey = parseSeatKeyOptional(stream.viewer.seatKey);
        if (!seatKey) return;
        const presence = this.ensureRatedPresence();
        presence[seatKey === 'black' ? 'blackDisconnectedAt' : 'whiteDisconnectedAt'] = nowMs;
        await this.saveRoom();
        const graceMs = Number(presence.disconnectGraceMs) || 120000;
        if (this.state.storage && typeof this.state.storage.setAlarm === 'function') {
            await this.state.storage.setAlarm(nowMs + graceMs);
        }
    }

    async readLobbyEntries(): Promise<Record<string, unknown>> {
        const store = await this.state.storage.get(LOBBY_STORAGE_KEY);
        const source = asRecord(store);
        return source.rooms && typeof source.rooms === 'object'
            ? Object.assign({}, source.rooms as Record<string, unknown>)
            : {};
    }

    async writeLobbyEntries(rooms: Record<string, unknown>): Promise<void> {
        await this.state.storage.put(LOBBY_STORAGE_KEY, {
            version: 1,
            rooms,
            updatedAt: Date.now()
        });
    }

    async readRatedQueueEntries(nowMs = Date.now()): Promise<Record<string, unknown>> {
        const store = await this.state.storage.get(RATED_QUEUE_STORAGE_KEY);
        return RatedMatchmaking.normalizeQueueStore(store, nowMs);
    }

    async writeRatedQueueEntries(entries: Record<string, unknown>, nowMs = Date.now()): Promise<void> {
        await this.state.storage.put(RATED_QUEUE_STORAGE_KEY, {
            version: 1,
            entries,
            updatedAt: nowMs
        });
        await this.syncRatedQueueAlarm(entries, nowMs);
    }

    async syncRatedQueueAlarm(entriesValue?: Record<string, unknown> | null, nowMs = Date.now()): Promise<void> {
        if (this.room) return;
        const entries = entriesValue || await this.readRatedQueueEntries(nowMs);
        const nextExpiresAt = Object.values(entries)
            .map((entry) => RatedMatchmaking.normalizeQueueEntry(entry))
            .filter((entry) => entry && entry.status === 'waiting')
            .map((entry) => Number(entry.expiresAt))
            .filter((expiresAt) => Number.isFinite(expiresAt) && expiresAt > nowMs)
            .sort((a, b) => a - b)[0] || 0;
        if (!this.state.storage) return;
        if (nextExpiresAt > 0 && typeof this.state.storage.setAlarm === 'function') {
            await this.state.storage.setAlarm(nextExpiresAt);
        } else if (typeof this.state.storage.deleteAlarm === 'function') {
            await this.state.storage.deleteAlarm();
        }
    }

    cleanupRatedQueueEntries(entriesValue: Record<string, unknown>, nowMs = Date.now()): Record<string, unknown> {
        return RatedMatchmaking.normalizeQueueStore(entriesValue, nowMs);
    }

    async postRatingPool(pathname: string, payload: Record<string, unknown>): Promise<Response> {
        if (!this.env || !this.env.MATCH_ROOM) {
            return jsonResponse(500, { ok: false, reason: 'MATCH_ROOM_BINDING_REQUIRED' });
        }
        const stub = getRoomStub(this.env, RATING_POOL_CARD_RANKED_ROOM_ID);
        return stub.fetch(new Request(`https://rating${pathname}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload || {})
        }));
    }

    async resolveRatedNormalResult(): Promise<'BLACK_WIN' | 'WHITE_WIN' | 'DRAW' | null> {
        if (!this.room || !isRatedRoomRecord(this.room)) return null;
        const snapshot = asRecord(this.room.snapshot);
        if (!await this.isSnapshotGameOver(snapshot as MatchWorkerPublicSnapshot)) return null;
        return resolveRatedResultFromSnapshot(snapshot);
    }

    async finalizeRatedMatchIfNeeded(
        result: 'BLACK_WIN' | 'WHITE_WIN' | 'DRAW' | 'NO_CONTEST',
        reason: string
    ): Promise<Record<string, unknown> | null> {
        if (!this.room || !isRatedRoomRecord(this.room)) return null;
        const ratedMatch = asRecord(this.room.ratedMatch);
        const matchId = String(ratedMatch.matchId || '').trim();
        if (!matchId) return null;
        if (ratedMatch.ratingStatus === 'applied' || ratedMatch.ratingStatus === 'no_contest') {
            return toPublicRatingResult(ratedMatch.ratingResult) || null;
        }
        const seatPlayerIds = PlayerIdentityContract.normalizeSeatPlayerIds(this.room.seatPlayerIds);
        const blackPlayerId = PlayerIdentityContract.normalizePlayerId(seatPlayerIds.black) || '';
        const whitePlayerId = PlayerIdentityContract.normalizePlayerId(seatPlayerIds.white) || '';
        if (!blackPlayerId || !whitePlayerId) return null;

        const response = await this.postRatingPool('/internal/rating/finalize', {
            matchId,
            pool: 'card_ranked_v1',
            blackPlayerId,
            whitePlayerId,
            result,
            rulesetVersion: 'card-ranked-v1',
            catalogVersion: 'catalog-current'
        });
        const body = asRecord(await response.json().catch(() => ({})));
        if (!response.ok || body.ok === false) {
            this.room.ratedMatch = {
                ...ratedMatch,
                finalReason: reason,
                ratingStatus: 'failed',
                ratingError: body.reason || 'RATING_FINALIZE_FAILED'
            };
            await this.saveRoom();
            return null;
        }

        this.room.ratedMatch = {
            ...ratedMatch,
            finalResult: result,
            finalReason: reason,
            finalizedAt: new Date().toISOString(),
            ratingStatus: result === 'NO_CONTEST' ? 'no_contest' : 'applied',
            ratingResult: body
        };
        this.room.updatedAt = Date.now();
        await this.saveRoom();
        return toPublicRatingResult(body) || body;
    }

    async finalizeRatedDisconnectIfExpired(nowMs: number): Promise<boolean> {
        if (!this.room || !isRatedRoomRecord(this.room)) return false;
        const ratedMatch = asRecord(this.room.ratedMatch);
        if (ratedMatch.ratingStatus === 'applied' || ratedMatch.ratingStatus === 'no_contest') return false;
        const presence = this.ensureRatedPresence();
        const graceMs = Number(presence.disconnectGraceMs) || 120000;
        const blackAt = Number(presence.blackDisconnectedAt) || 0;
        const whiteAt = Number(presence.whiteDisconnectedAt) || 0;
        const blackExpired = blackAt > 0 && nowMs - blackAt >= graceMs;
        const whiteExpired = whiteAt > 0 && nowMs - whiteAt >= graceMs;
        if (blackExpired && !whiteExpired) {
            await this.finalizeRatedMatchIfNeeded('WHITE_WIN', 'black_disconnect');
            await this.broadcastSnapshot({ actionType: 'rated_disconnect_loss', playbackEvents: [] });
            return true;
        }
        if (whiteExpired && !blackExpired) {
            await this.finalizeRatedMatchIfNeeded('BLACK_WIN', 'white_disconnect');
            await this.broadcastSnapshot({ actionType: 'rated_disconnect_loss', playbackEvents: [] });
            return true;
        }
        if (blackExpired && whiteExpired) {
            await this.finalizeRatedMatchIfNeeded('NO_CONTEST', 'both_disconnected');
            await this.broadcastSnapshot({ actionType: 'rated_no_contest', playbackEvents: [] });
            return true;
        }
        const nextExpiry = Math.min(
            ...[blackAt, whiteAt]
                .filter((value) => value > 0)
                .map((value) => value + graceMs)
        );
        if (Number.isFinite(nextExpiry) && nextExpiry > nowMs && this.state.storage && typeof this.state.storage.setAlarm === 'function') {
            await this.state.storage.setAlarm(nextExpiry);
        }
        return false;
    }

    async handleResign(body: Record<string, unknown>): Promise<Response> {
        if (!this.room && !this.roomLoaded) await this.loadRoom();
        const room = this.room;
        if (!room) return jsonResponse(404, { ok: false, reason: 'ROOM_NOT_FOUND' });
        const seatKey = resolveAuthenticatedSeatKey(room, parseSeatKeyOptional(body && body.seatKey), String(body && body.seatToken || '').trim());
        if (!seatKey) return jsonResponse(403, { ok: false, reason: 'SEAT_TOKEN_INVALID' });
        if (!isRatedRoomRecord(room)) return jsonResponse(400, { ok: false, reason: 'RESIGN_RATED_ONLY' });
        const result = seatKey === 'black' ? 'WHITE_WIN' : 'BLACK_WIN';
        const ratingResult = await this.finalizeRatedMatchIfNeeded(result, 'resign');
        await this.broadcastSnapshot({ actionType: 'rated_resign', playbackEvents: [] });
        return jsonResponse(200, { ok: true, result, ratingResult });
    }

    async createRatedRoomForPair(blackEntryValue: unknown, whiteEntryValue: unknown): Promise<Record<string, unknown>> {
        if (!this.env || !this.env.MATCH_ROOM) {
            return { ok: false, reason: 'MATCH_ROOM_BINDING_REQUIRED' };
        }
        const blackEntry = RatedMatchmaking.normalizeQueueEntry(blackEntryValue);
        const whiteEntry = RatedMatchmaking.normalizeQueueEntry(whiteEntryValue);
        if (!blackEntry || !whiteEntry) {
            return { ok: false, reason: 'RATED_QUEUE_ENTRY_INVALID' };
        }

        const blackDeckSelection = await resolveDeckSelection(blackEntry.deckCode);
        if (!blackDeckSelection.ok) {
            return { ok: false, reason: blackDeckSelection.reason || 'BLACK_DECK_CODE_INVALID' };
        }
        const whiteDeckSelection = await resolveDeckSelection(whiteEntry.deckCode);
        if (!whiteDeckSelection.ok) {
            return { ok: false, reason: whiteDeckSelection.reason || 'WHITE_DECK_CODE_INVALID' };
        }

        const roomBoardConfig = RatedMatchmaking.cloneRatedBoardConfig();
        const initialDeckSpecByPlayer = blackDeckSelection.hasCustomDeck
            ? { black: blackDeckSelection.deckSpec, white: null }
            : null;
        const roomDeck = blackDeckSelection.hasCustomDeck
            ? {
                mode: 'perPlayer',
                deckCode: '',
                deckSize: null,
                deckCodeByPlayer: {
                    black: blackDeckSelection.deckCode,
                    white: ''
                },
                deckSizeByPlayer: {
                    black: blackDeckSelection.deckSize,
                    white: null
                },
                source: 'room'
            }
            : null;

        for (let attempt = 0; attempt < 12; attempt += 1) {
            const roomId = makeRoomId();
            const seed = Date.now();
            const matchedAt = Date.now();
            const matchId = RatedMatchmaking.createRatedMatchId(matchedAt, blackEntry.playerId, whiteEntry.playerId);
            const startedAt = new Date(matchedAt).toISOString();
            const lockResponse = await this.postRatingPool('/internal/rating/active/claim', {
                matchId,
                roomId,
                blackPlayerId: blackEntry.playerId,
                whitePlayerId: whiteEntry.playerId,
                blackPlayerName: blackEntry.playerName,
                whitePlayerName: whiteEntry.playerName,
                blackAvatarStoneType: blackEntry.avatarStoneType,
                whiteAvatarStoneType: whiteEntry.avatarStoneType,
                blackBio: blackEntry.bio,
                whiteBio: whiteEntry.bio,
                startedAt
            });
            if (!lockResponse.ok) {
                const lockPayload = await lockResponse.json().catch(() => ({}));
                return {
                    ok: false,
                    reason: asRecord(lockPayload).reason || 'RATED_ACTIVE_MATCH_LOCK_FAILED'
                };
            }
            const snapshot = await makeInitialSnapshot(seed, {
                initialDeckSpecByPlayer,
                roomBoardConfig
            });
            const stub = getRoomStub(this.env, roomId);
            const createResponse = await stub.fetch(new Request('https://room/internal/create', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    roomId,
                    seed,
                    snapshot,
                    playerName: blackEntry.playerName,
                    selectedHandSkinId: blackEntry.selectedHandSkinId,
                    networkDebugEnabled: false,
                    networkAutoEnabled: false,
                    allCardsDeckEnabled: false,
                    publishResponseMode: '',
                    roomName: RatedMatchmaking.RATED_ROOM_NAME,
                    roomPassword: '',
                    initialDeckSpecByPlayer,
                    roomDeck,
                    roomBoardConfig,
                    playerId: blackEntry.playerId,
                    matchType: 'rated',
                    ratedMatch: {
                        enabled: true,
                        pool: 'card_ranked_v1',
                        systemVersion: 1,
                        matchId,
                        matchedAt,
                        startedAt,
                        finalizedAt: '',
                        finalResult: '',
                        ratingStatus: 'pending',
                        disconnectForfeitPolicy: 'grace'
                    }
                })
            }));
            if (createResponse.status === 409) {
                await this.postRatingPool('/internal/rating/active/release', { matchId });
                continue;
            }
            if (!createResponse.ok) {
                await this.postRatingPool('/internal/rating/active/release', { matchId });
                const createPayload = await createResponse.json().catch(() => ({}));
                return {
                    ok: false,
                    reason: asRecord(createPayload).reason || 'RATED_ROOM_CREATE_FAILED'
                };
            }
            const blackCreatedPayload = asRecord(await createResponse.json());
            const roomIdFromCreate = normalizeRoomId(blackCreatedPayload.roomId || roomId);
            const blackSeatToken = String(blackCreatedPayload.seatToken || '').trim();
            const whiteJoinResponse = await stub.fetch(new Request('https://room/api/match/join', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    roomId: roomIdFromCreate,
                    playerName: whiteEntry.playerName,
                    playerId: whiteEntry.playerId,
                    selectedHandSkinId: whiteEntry.selectedHandSkinId,
                    deckCode: whiteEntry.deckCode
                })
            }));
            if (!whiteJoinResponse.ok) {
                await this.postRatingPool('/internal/rating/active/release', { matchId });
                const whiteJoinPayload = await whiteJoinResponse.json().catch(() => ({}));
                return {
                    ok: false,
                    reason: asRecord(whiteJoinPayload).reason || 'RATED_ROOM_JOIN_FAILED'
                };
            }
            const whitePayload = await whiteJoinResponse.json();
            const blackRejoinResponse = await stub.fetch(new Request('https://room/api/match/join', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    roomId: roomIdFromCreate,
                    playerName: blackEntry.playerName,
                    playerId: blackEntry.playerId,
                    selectedHandSkinId: blackEntry.selectedHandSkinId,
                    deckCode: blackEntry.deckCode,
                    seatKey: 'black',
                    seatToken: blackSeatToken
                })
            }));
            if (!blackRejoinResponse.ok) {
                await this.postRatingPool('/internal/rating/active/release', { matchId });
                const blackRejoinPayload = await blackRejoinResponse.json().catch(() => ({}));
                return {
                    ok: false,
                    reason: asRecord(blackRejoinPayload).reason || 'RATED_ROOM_REJOIN_FAILED'
                };
            }
            const blackPayload = await blackRejoinResponse.json();
            return {
                ok: true,
                roomId: roomIdFromCreate,
                blackPayload,
                whitePayload
            };
        }
        return { ok: false, reason: 'RATED_ROOM_CREATE_RETRY_EXHAUSTED' };
    }

    async handleRatedQueueEnter(body: Record<string, unknown>): Promise<Response> {
        const playerId = RatedMatchmaking.normalizePlayerId(body.playerId);
        if (!playerId) return jsonResponse(403, { ok: false, reason: 'PLAYER_ID_TOKEN_INVALID' });
        const deckSelection = await resolveDeckSelection(body.deckCode);
        if (!deckSelection.ok) {
            return jsonResponse(400, { ok: false, reason: deckSelection.reason || 'DECK_CODE_INVALID' });
        }

        const nowMs = Date.now();
        const entries = await this.readRatedQueueEntries(nowMs);
        const existing = RatedMatchmaking.normalizeQueueEntry(entries[playerId]);
        if (existing && existing.status === 'matched') {
            return jsonResponse(200, RatedMatchmaking.toMatchedResponse(existing, nowMs));
        }
        if (existing && existing.status === 'waiting') {
            return jsonResponse(200, RatedMatchmaking.toWaitingResponse(existing, nowMs));
        }

        const entry = RatedMatchmaking.createQueueEntry(body, nowMs);
        if (!entry) return jsonResponse(403, { ok: false, reason: 'PLAYER_ID_TOKEN_INVALID' });
        const candidate = RatedMatchmaking.findWaitingCandidate(entries, entry.playerId, nowMs);
        if (!candidate) {
            entries[entry.playerId] = entry;
            await this.writeRatedQueueEntries(entries, nowMs);
            return jsonResponse(200, RatedMatchmaking.toWaitingResponse(entry, nowMs));
        }

        const match = await this.createRatedRoomForPair(candidate, entry);
        if (match.ok !== true) {
            delete entries[candidate.playerId];
            await this.writeRatedQueueEntries(entries, Date.now());
            return jsonResponse(400, { ok: false, reason: match.reason || 'RATED_MATCH_CREATE_FAILED' });
        }
        const matched = RatedMatchmaking.markEntriesMatched(candidate, entry, match, Date.now());
        if (!matched) return jsonResponse(500, { ok: false, reason: 'RATED_MATCH_PAYLOAD_FAILED' });
        entries[matched.black.playerId] = matched.black;
        entries[matched.white.playerId] = matched.white;
        await this.writeRatedQueueEntries(entries, Date.now());
        return jsonResponse(200, RatedMatchmaking.toMatchedResponse(matched.white, Date.now()));
    }

    async handleRatedQueuePoll(body: Record<string, unknown>): Promise<Response> {
        const playerId = RatedMatchmaking.normalizePlayerId(body.playerId);
        if (!playerId) return jsonResponse(403, { ok: false, reason: 'PLAYER_ID_TOKEN_INVALID' });
        const nowMs = Date.now();
        const entries = await this.readRatedQueueEntries(nowMs);
        const rawEntry = entries[playerId];
        const entry = RatedMatchmaking.normalizeQueueEntry(rawEntry);
        if (!entry) {
            return jsonResponse(200, RatedMatchmaking.toIdleResponse(playerId, nowMs));
        }
        if (RatedMatchmaking.isQueueEntryExpired(rawEntry, nowMs)) {
            delete entries[playerId];
            await this.writeRatedQueueEntries(entries, nowMs);
            return jsonResponse(200, RatedMatchmaking.toExpiredResponse(playerId, nowMs));
        }
        return jsonResponse(200, entry.status === 'matched'
            ? RatedMatchmaking.toMatchedResponse(entry, nowMs)
            : RatedMatchmaking.toWaitingResponse(entry, nowMs));
    }

    async handleRatedQueueCancel(body: Record<string, unknown>): Promise<Response> {
        const playerId = RatedMatchmaking.normalizePlayerId(body.playerId);
        if (!playerId) return jsonResponse(403, { ok: false, reason: 'PLAYER_ID_TOKEN_INVALID' });
        const nowMs = Date.now();
        const entries = await this.readRatedQueueEntries(nowMs);
        const entry = RatedMatchmaking.normalizeQueueEntry(entries[playerId]);
        if (entry && entry.status === 'matched') {
            return jsonResponse(200, RatedMatchmaking.toMatchedResponse(entry, nowMs));
        }
        delete entries[playerId];
        await this.writeRatedQueueEntries(entries, nowMs);
        return jsonResponse(200, Object.assign(RatedMatchmaking.toIdleResponse(playerId, nowMs), {
            status: 'cancelled',
            reason: String(body.reason || 'cancelled')
        }));
    }

    async handleLobbyUpsert(body: Record<string, unknown>): Promise<Response> {
        const entry = asRecord(body.entry || body);
        const roomId = normalizeRoomId(entry.roomId);
        if (!roomId) return jsonResponse(400, { ok: false, reason: 'ROOM_ID_REQUIRED' });
        if (isRatedRoomRecord(entry)) {
            return this.handleLobbyRemove({ roomId });
        }
        const publicEntry = MatchRoomLobby.toPublicRoomListEntry(Object.assign({}, entry, { roomId }), { nowMs: Date.now() });
        if (!publicEntry) {
            return this.handleLobbyRemove({ roomId });
        }
        const rooms = await this.readLobbyEntries();
        rooms[roomId] = publicEntry;
        await this.writeLobbyEntries(rooms);
        return jsonResponse(200, { ok: true, entry: publicEntry });
    }

    async handleLobbyRemove(body: Record<string, unknown>): Promise<Response> {
        const roomId = normalizeRoomId(body.roomId);
        if (!roomId) return jsonResponse(400, { ok: false, reason: 'ROOM_ID_REQUIRED' });
        const rooms = await this.readLobbyEntries();
        delete rooms[roomId];
        await this.writeLobbyEntries(rooms);
        return jsonResponse(200, { ok: true });
    }

    async readAuthoritativeLobbyEntry(roomIdValue: unknown, nowMs = Date.now()): Promise<unknown | null | undefined> {
        const roomId = normalizeRoomId(roomIdValue);
        if (!roomId || roomId === MATCH_LOBBY_ROOM_ID || !this.env || !this.env.MATCH_ROOM) return undefined;
        try {
            const stub = getRoomStub(this.env, roomId);
            const response = await stub.fetch(new Request(
                'https://room/internal/lobby-entry?roomId=' + encodeURIComponent(roomId)
                    + '&nowMs=' + encodeURIComponent(String(nowMs)),
                { method: 'GET' }
            ));
            if (response.status === 404) return null;
            if (response.status < 200 || response.status >= 300) return undefined;
            const payload = await response.json();
            const entry = asRecord(payload).entry;
            return entry && typeof entry === 'object' ? entry : null;
        } catch (e) {
            return undefined;
        }
    }

    async handleLobbyList(): Promise<Response> {
        const nowMs = Date.now();
        const rooms = await this.readLobbyEntries();
        const nextRooms: Record<string, unknown> = {};
        let changed = false;
        for (const [roomId, entry] of Object.entries(rooms)) {
            const authoritativeEntry = await this.readAuthoritativeLobbyEntry(roomId, nowMs);
            if (authoritativeEntry === null) {
                changed = true;
                continue;
            }
            const entrySource = authoritativeEntry === undefined ? entry : authoritativeEntry;
            const publicEntry = MatchRoomLobby.toPublicRoomListEntry(Object.assign({}, asRecord(entrySource), { roomId }), { nowMs });
            if (publicEntry) {
                nextRooms[roomId] = publicEntry;
                if (
                    authoritativeEntry !== undefined
                    && JSON.stringify(asRecord(entry)) !== JSON.stringify(publicEntry)
                ) {
                    changed = true;
                }
            } else {
                changed = true;
            }
        }
        if (changed) {
            await this.writeLobbyEntries(nextRooms);
        }
        return jsonResponse(200, {
            ok: true,
            rooms: MatchRoomLobby.sortRoomListEntries(Object.values(nextRooms))
        });
    }

    async handleInternalLobbyEntry(urlObj: URL): Promise<Response> {
        const requestedRoomId = normalizeRoomId(urlObj.searchParams.get('roomId'));
        const nowMs = Number.isFinite(Number(urlObj.searchParams.get('nowMs')))
            ? Math.trunc(Number(urlObj.searchParams.get('nowMs')))
            : Date.now();
        await this.loadRoom();
        const roomId = normalizeRoomId(this.room && this.room.roomId);
        if (!this.room || !roomId || (requestedRoomId && requestedRoomId !== roomId)) {
            return jsonResponse(404, { ok: false, reason: 'ROOM_NOT_FOUND' });
        }
        if (await this.expireRoomIfNeeded(nowMs, { syncLobby: false })) {
            return jsonResponse(404, { ok: false, reason: 'ROOM_NOT_FOUND' });
        }
        const entry = buildLobbyEntryFromRoom(this.room, roomId, nowMs);
        if (!entry) return jsonResponse(404, { ok: false, reason: 'ROOM_NOT_FOUND' });
        return jsonResponse(200, { ok: true, entry });
    }

    nextSseEventId(): string {
        return this.getStreamController().nextSseEventId();
    }

    rememberBufferedSseEvent(record: MatchAuthorityBufferedSseEventRecordInput): void {
        this.getStreamController().rememberBufferedSseEvent(record);
    }

    buildBufferedSnapshotEvent(meta: MatchWorkerSnapshotPayloadMeta | null | undefined, eventId: string): {
        record: MatchAuthorityBufferedSseEventRecordInput;
        payloadByViewer: Partial<Record<MatchAuthoritySeatKey | 'spectator', unknown>>;
    } {
        return this.getBroadcastController().buildBufferedSnapshotEvent(meta, eventId);
    }

    prepareSnapshotBroadcast(meta: MatchWorkerSnapshotPayloadMeta | null | undefined): MatchWorkerPreparedSnapshotBroadcast {
        return this.getBroadcastController().prepareSnapshotBroadcast(meta);
    }

    stagePreparedSnapshotBroadcast(preparedSnapshot: MatchWorkerPreparedSnapshotBroadcast): boolean {
        return this.getBroadcastController().stagePreparedSnapshotBroadcast(preparedSnapshot);
    }

    async broadcastPreparedSnapshot(preparedSnapshot: MatchWorkerPreparedSnapshotBroadcast | null | undefined): Promise<void> {
        await this.getBroadcastController().broadcastPreparedSnapshot(preparedSnapshot);
    }

    ensureHeartbeatTimer(): void {
        this.getStreamController().ensureHeartbeatTimer();
    }

    async broadcastHeartbeat(): Promise<void> {
        await this.getStreamController().broadcastHeartbeat();
    }

    async closeStream(streamId: string): Promise<void> {
        await this.getStreamController().closeStream(streamId);
    }

    async closeStreamsForSeat(seatKey: unknown): Promise<void> {
        await this.getStreamController().closeStreamsForSeat(seatKey);
    }

    async sendSse(streamId: string, eventName: string, payload: unknown, options?: Record<string, unknown> | null): Promise<void> {
        await this.getStreamController().sendSse(streamId, eventName, payload, options);
    }

    async broadcastSnapshot(meta: MatchWorkerSnapshotPayloadMeta | null | undefined): Promise<void> {
        await this.getBroadcastController().broadcastSnapshot(meta);
    }

    async broadcastPresence(meta: MatchWorkerPresencePayloadMeta | null | undefined): Promise<void> {
        await this.getBroadcastController().broadcastPresence(meta);
    }

    async broadcastChat(payload: unknown): Promise<void> {
        await this.getBroadcastController().broadcastChat(payload);
    }

    createRoomState(roomId: string, initOptions?: MatchWorkerRoomCreateOptions | null): MatchWorkerRoomState {
        const opts = asRecord(initOptions);
        const seed = Number.isFinite(Number(opts.seed)) ? Number(opts.seed) : Date.now();
        const snapshot = (opts.snapshot && typeof opts.snapshot === 'object') ? deepClone(opts.snapshot) as MatchWorkerPublicSnapshot : null;
        if (snapshot) {
            const boardContractInspection = MatchAuthority.normalizeSnapshotBoardContract(snapshot, {
                allowLegacy: true,
                requireFullSnapshot: true
            });
            if (!boardContractInspection || boardContractInspection.ok !== true) {
                throw new Error(`initial_snapshot_invalid_board_contract: ${(boardContractInspection && boardContractInspection.errors || []).join('; ')}`);
            }
        }
        const initialDeckCardIdsByPlayer = (opts.initialDeckCardIdsByPlayer && typeof opts.initialDeckCardIdsByPlayer === 'object')
            ? cloneInitialDeckCardIdsByPlayer(opts.initialDeckCardIdsByPlayer)
            : null;
        const initialDeckSpec = (opts.initialDeckSpec && typeof opts.initialDeckSpec === 'object') ? deepClone(opts.initialDeckSpec) : null;
        const initialDeckSpecByPlayer = (opts.initialDeckSpecByPlayer && typeof opts.initialDeckSpecByPlayer === 'object')
            ? cloneInitialDeckSpecByPlayer(opts.initialDeckSpecByPlayer)
            : null;
        const roomDeck = (opts.roomDeck && typeof opts.roomDeck === 'object') ? deepClone(opts.roomDeck) : null;
        const roomName = MatchRoomLobby.resolveRoomName(opts.roomName);
        const roomPassword = MatchRoomLobby.normalizeRoomPassword(opts.roomPassword);
        const roomBoardConfig = MatchAuthority.normalizeRoomBoardConfig(
            opts.roomBoardConfig,
            asRecord(snapshot && snapshot.gameState).board
        );
        const networkDebugEnabled = false;
        const allCardsDeckEnabled = opts.allCardsDeckEnabled === true;
        const networkAutoEnabled = opts.networkAutoEnabled === true;
        const publishResponseMode = MatchAuthority.normalizePublishResponseMode(opts.publishResponseMode);
        const matchType = String(opts.matchType || '').trim().toLowerCase() === 'rated' ? 'rated' : '';
        const ratedMatch = opts.ratedMatch && typeof opts.ratedMatch === 'object'
            ? deepClone(opts.ratedMatch)
            : null;
        const nowMs = Date.now();
        return {
            roomId,
            seed,
            snapshot,
            authoritativeStateHash: MatchAuthority.computeAuthoritativeStateHash(snapshot),
            initialDeckCardIdsByPlayer,
            initialDeckSpec,
            initialDeckSpecByPlayer,
            roomDeck,
            roomName,
            roomPassword,
            roomBoardConfig,
            networkDebugEnabled,
            allCardsDeckEnabled,
            networkAutoEnabled,
            matchType,
            ratedMatch,
            publishResponseMode,
            stateVersion: 0,
            seats: { black: false, white: false },
            seatNames: { black: '', white: '' },
            seatHandSkins: { black: '', white: '' },
            seatPlayerIds: { black: '', white: '' },
            seatTokens: { black: makeSeatToken(), white: makeSeatToken() },
            spectators: {},
            maxSpectators: MatchAuthority.MAX_SPECTATORS || 4,
            turnTimer: {
                limitSeconds: NETWORK_TURN_LIMIT_SECONDS,
                active: false,
                turnSeatKey: getCurrentPlayerKey(snapshot && snapshot.gameState),
                turnStartedAt: null,
                turnDeadlineAt: null
            },
            lastAcceptedOperationBySeat: {
                black: null,
                white: null
            },
            eventSeq: 0,
            sseEventBuffer: [],
            authorityLog: [],
            chatMessages: [],
            chatSeq: 0,
            createdAt: nowMs,
            updatedAt: nowMs
        };
    }

    async syncTurnTimerAlarm(): Promise<boolean> {
        return this.getTurnTimerController().syncTurnTimerAlarm();
    }

    async isSnapshotGameOver(snapshot: MatchWorkerPublicSnapshot | null | undefined): Promise<boolean> {
        return this.getTurnTimerController().isSnapshotGameOver(snapshot);
    }

    async refreshTurnTimer(options?: MatchWorkerTurnTimerOptions | null): Promise<boolean> {
        return this.getTurnTimerController().refreshTurnTimer(options);
    }

    async applyExpiredTurnTimeoutIfNeeded(options?: MatchWorkerTurnTimerOptions | null): Promise<MatchWorkerTurnTimeoutResult> {
        return this.getTimeoutController().applyExpiredTurnTimeoutIfNeeded(options);
    }

    async alarm() {
        await this.loadRoom();
        const nowMs = Date.now();
        if (!this.room) {
            const entries = await this.readRatedQueueEntries(nowMs);
            await this.writeRatedQueueEntries(entries, nowMs);
            return;
        }
        if (await this.expireRoomIfNeeded(nowMs)) return;
        const result = await this.applyExpiredTurnTimeoutIfNeeded({ nowMs });
        if (result && result.applied === true) return;
        if (await this.finalizeRatedDisconnectIfExpired(nowMs)) return;
        if (MatchRoomLobby.readInactiveSince(this.room) > 0 && this.streams.size === 0) {
            await this.syncInactiveRoomExpiryAlarm(nowMs);
            return;
        }
        const timerChanged = await this.refreshTurnTimer({ nowMs, forceRestart: false });
        if (timerChanged) {
            this.room.updatedAt = nowMs;
            await this.saveRoom();
        }
    }

    async handleInternalCreate(urlObj: URL, body: Record<string, unknown>): Promise<Response> {
        await this.loadRoom();
        await this.expireRoomIfNeeded(Date.now());
        if (this.room) {
            return jsonResponse(409, { ok: false, reason: 'ROOM_EXISTS' });
        }
        const payload = asRecord(body);
        const roomId = normalizeRoomId(payload.roomId || (urlObj && urlObj.searchParams ? urlObj.searchParams.get('roomId') : ''));
        const seed = Number.isFinite(Number(payload.seed)) ? Number(payload.seed) : Date.now();
        const snapshot = (payload.snapshot && typeof payload.snapshot === 'object')
            ? payload.snapshot as MatchWorkerPublicSnapshot
            : null;
        const playerName = normalizeNetworkPlayerName(payload.playerName) || MatchRoomLobby.createRandomPlayerName();
        const playerId = PlayerIdentityContract.normalizePlayerId(payload.playerId) || '';
        const selectedHandSkinId = normalizeSeatHandSkinId(payload.selectedHandSkinId);
        const initialDeckCardIdsByPlayer = (payload.initialDeckCardIdsByPlayer && typeof payload.initialDeckCardIdsByPlayer === 'object')
            ? cloneInitialDeckCardIdsByPlayer(payload.initialDeckCardIdsByPlayer)
            : null;
        const initialDeckSpec = (payload.initialDeckSpec && typeof payload.initialDeckSpec === 'object')
            ? deepClone(payload.initialDeckSpec)
            : null;
        const initialDeckSpecByPlayer = (payload.initialDeckSpecByPlayer && typeof payload.initialDeckSpecByPlayer === 'object')
            ? cloneInitialDeckSpecByPlayer(payload.initialDeckSpecByPlayer)
            : null;
        const roomDeck = (payload.roomDeck && typeof payload.roomDeck === 'object')
            ? deepClone(payload.roomDeck)
            : null;
        const roomBoardConfig = MatchAuthority.normalizeRoomBoardConfig(
            payload.roomBoardConfig,
            asRecord(snapshot && snapshot.gameState).board
        );
        const networkDebugEnabled = payload.networkDebugEnabled === true;
        const allCardsDeckEnabled = payload.allCardsDeckEnabled === true;
        const networkAutoEnabled = payload.networkAutoEnabled === true;
        const publishResponseMode = MatchAuthority.normalizePublishResponseMode(payload.publishResponseMode);
        const matchType = String(payload.matchType || '').trim().toLowerCase() === 'rated' ? 'rated' : '';
        const ratedMatch = payload.ratedMatch && typeof payload.ratedMatch === 'object'
            ? deepClone(payload.ratedMatch)
            : null;
        const roomName = MatchRoomLobby.resolveRoomName(payload.roomName);
        const roomPassword = MatchRoomLobby.normalizeRoomPassword(payload.roomPassword);

        if (!roomId) {
            return jsonResponse(400, { ok: false, reason: 'ROOM_ID_REQUIRED' });
        }
        if (!snapshot || !snapshot.gameState || !snapshot.cardState) {
            return jsonResponse(400, { ok: false, reason: 'SNAPSHOT_REQUIRED' });
        }
        const room = this.createRoomState(roomId, {
            seed,
            snapshot,
            initialDeckCardIdsByPlayer,
            initialDeckSpec,
            initialDeckSpecByPlayer,
            roomDeck,
            roomBoardConfig,
            networkDebugEnabled,
            allCardsDeckEnabled,
            networkAutoEnabled,
            matchType,
            ratedMatch,
            publishResponseMode,
            roomName,
            roomPassword
        });
        if (isRatedRoomRecord(room)) {
            (room as Record<string, unknown>).ratedPresence = {
                blackDisconnectedAt: 0,
                whiteDisconnectedAt: 0,
                disconnectGraceMs: 120000
            };
        }
        this.room = room;
        this.sseEventBuffer = [];
        const publicSeatState = buildPublicSeatState(room);
        publicSeatState.seats.black = true;
        publicSeatState.seatNames.black = playerName;
        publicSeatState.seatHandSkins.black = selectedHandSkinId;
        publicSeatState.seatPlayerIds.black = playerId;
        room.seats = publicSeatState.seats;
        room.seatNames = publicSeatState.seatNames;
        room.seatHandSkins = publicSeatState.seatHandSkins;
        room.seatPlayerIds = publicSeatState.seatPlayerIds;
        room.updatedAt = Date.now();
        await this.refreshTurnTimer({ nowMs: room.updatedAt, forceRestart: false });
        await this.syncWaitingRoomExpiryAlarm(room.updatedAt);
        await this.saveRoom();

        const serverTime = Date.now();

        const responsePayload = asRecord(withPublicRoomPasswordMetadata(MatchAuthority.buildRoomPayloadFromRoom(room, {
            ok: true,
            seatKey: 'black',
            playerName,
            seatToken: asRecord(room.seatTokens).black,
            roomDeck: toPublicRoomDeck(room),
            roomBoardConfig: toPublicRoomBoardConfig(room),
            networkDebugEnabled: toPublicNetworkDebugEnabled(room),
            networkAutoEnabled: toPublicNetworkAutoEnabled(room),
            stateVersion: room.stateVersion,
            snapshot: toPublicSnapshot(room, 'black'),
            turnTimer: toPublicTurnTimer(room, serverTime),
            serverTime
        }), room));
        withPublicRatedMatchMetadata(responsePayload, room);
        return jsonResponse(200, responsePayload);
    }

    async handleJoin(body: Record<string, unknown>): Promise<Response> {
        return createMatchJoinController({
            loadRoom: () => this.loadRoom(),
            awaitLoadRoom: true,
            getRoom: () => this.room,
            expireRoomIfNeeded: () => this.expireRoomIfNeeded(Date.now()),
            awaitExpireRoomIfNeeded: true,
            resolveDeckSelection,
            awaitResolveDeckSelection: true,
            normalizeNetworkPlayerName,
            resolvePlayerId: (incomingBody: Record<string, unknown>) => (
                PlayerIdentityContract.normalizePlayerId(incomingBody.playerId) || ''
            ),
            normalizeSeatHandSkinId,
            parseSeatKeyOptional,
            resolveAuthenticatedSeatKey,
            isJoinPasswordAccepted: MatchRoomLobby.isJoinPasswordAccepted,
            resolveSeatForJoin,
            makeSeatToken,
            hasTwoActiveSeats,
            setSeatJoined: (room: MatchWorkerRoomState, seatKey: MatchAuthoritySeatKey) => {
                asRecord(room.seats)[seatKey] = true;
            },
            setSeatName: (room: MatchWorkerRoomState, seatKey: MatchAuthoritySeatKey, playerName: string) => {
                room.seatNames = room.seatNames && typeof room.seatNames === 'object'
                    ? room.seatNames
                    : { black: '', white: '' };
                room.seatNames[seatKey] = playerName;
            },
            toPublicSeatHandSkins,
            normalizeSeatPlayerIds: PlayerIdentityContract.normalizeSeatPlayerIds,
            isAllCardsDeckRoom,
            assignRoomDeckSelection,
            makeInitialSnapshot,
            buildInitialDeckSnapshotOptions,
            awaitMakeInitialSnapshot: true,
            initialSnapshotFailureReason: 'JOIN_DECK_INIT_FAILED',
            refreshTurnTimer: (_room: MatchWorkerRoomState, options: any) => this.refreshTurnTimer(options),
            awaitRefreshTurnTimer: true,
            saveRoom: () => this.saveRoom(),
            awaitSaveRoom: true,
            broadcastSnapshot: (meta: MatchWorkerSnapshotPayloadMeta | null | undefined) => this.broadcastSnapshot(meta),
            awaitBroadcastSnapshot: true,
            broadcastPresence: (meta: MatchWorkerPresencePayloadMeta | null | undefined) => this.broadcastPresence(meta),
            awaitBroadcastPresence: true,
            MatchAuthority,
            toPublicRoomDeck,
            toPublicRoomBoardConfig,
            toPublicNetworkDebugEnabled,
            toPublicNetworkAutoEnabled,
            toPublicSnapshot,
            toPublicTurnTimer,
            decorateRoomPayload: (payload: Record<string, unknown>, room: MatchWorkerRoomState) => {
                const responsePayload = asRecord(withPublicRoomPasswordMetadata(payload, room));
                withPublicRatedMatchMetadata(responsePayload, room);
                return responsePayload;
            },
            jsonResponse
        }).handleJoin(body);
    }

    async handleLeave(body: Record<string, unknown>): Promise<Response> {
        return this.getLeaveController().handleLeave(body);
    }

    async handleSpectate(body: Record<string, unknown>): Promise<Response> {
        return createMatchSpectateController({
            loadRoom: () => this.loadRoom(),
            getRoom: () => this.room,
            expireRoomIfNeeded: () => this.expireRoomIfNeeded(Date.now()),
            isJoinPasswordAccepted: MatchRoomLobby.isJoinPasswordAccepted,
            MatchAuthority,
            makeSpectatorToken,
            makeSpectatorId,
            saveRoom: () => this.saveRoom(),
            broadcastPresence: (meta: MatchWorkerPresencePayloadMeta | null | undefined) => this.broadcastPresence(meta),
            toPublicSnapshotForViewer,
            toPublicRoomDeck,
            toPublicRoomBoardConfig,
            toPublicNetworkDebugEnabled,
            toPublicNetworkAutoEnabled,
            toPublicTurnTimer,
            decorateRoomPayload: withPublicRoomPasswordMetadata,
            jsonResponse
        }).handleSpectate(body);
    }

    async handleSpectatorLeave(body: Record<string, unknown>): Promise<Response> {
        return this.getLeaveController().handleSpectatorLeave(body);
    }

    async handleHandSkin(body: Record<string, unknown>): Promise<Response> {
        return this.getRoomPreferencesController().handleHandSkin(body);
    }

    async handleDeck(body: Record<string, unknown>): Promise<Response> {
        return this.getRoomPreferencesController().handleDeck(body);
    }

    async handlePublish(body: Record<string, unknown>): Promise<Response> {
        await this.loadRoom();
        if (await this.expireRoomIfNeeded(Date.now())) {
            return jsonResponse(404, { ok: false, rejectedReason: 'ROOM_NOT_FOUND' });
        }
        return this.getPublishController().handlePublish(body);
    }

    async handleRematchRequest(body: Record<string, unknown>): Promise<Response> {
        return this.getRematchController().handleRematchRequest(body);
    }

    async handleRematchResponse(body: Record<string, unknown>): Promise<Response> {
        return this.getRematchController().handleRematchResponse(body);
    }

    async handleState(urlObj: URL): Promise<Response> {
        return this.getStateController().handleState(urlObj);
    }

    async handlePresentationJournal(request: Request): Promise<Response> {
        const urlObj = new URL(request.url);
        return this.getStateController().handlePresentationJournal(urlObj);
    }

    async handleStream(request: Request): Promise<Response> {
        return this.getStreamRouteController().handleStream(request);
    }

    async loadLeaderboardStore(): Promise<MatchWorkerLeaderboardStore> {
        return this.getLeaderboardRoomController().loadLeaderboardStore();
    }

    async saveLeaderboardStore(store: MatchWorkerLeaderboardStore): Promise<void> {
        await this.getLeaderboardRoomController().saveLeaderboardStore(store);
    }

    listLeaderboardEntries(store: MatchWorkerLeaderboardStore, limit: unknown, mode?: unknown, cpuLevel?: unknown, category?: unknown): Array<Record<string, unknown>> {
        return this.getLeaderboardRoomController().listLeaderboardEntries(store, limit, mode, cpuLevel, category);
    }

    async handleLeaderboardSubmit(body: Record<string, unknown>): Promise<Response> {
        return this.getLeaderboardRoomController().handleLeaderboardSubmit(body);
    }

    async handleLeaderboardProfileUpdate(body: Record<string, unknown>): Promise<Response> {
        return this.getLeaderboardRoomController().handleLeaderboardProfileUpdate(body);
    }

    async handleLeaderboardList(urlObj: URL): Promise<Response> {
        return this.getLeaderboardRoomController().handleLeaderboardList(urlObj);
    }

    async handleInternalLeaderboardResult(body: Record<string, unknown>): Promise<Response> {
        if (!this.room && !this.roomLoaded) await this.loadRoom();
        if (!this.room) return jsonResponse(404, { ok: false, reason: 'ROOM_NOT_FOUND' });
        const terminal = await this.isSnapshotGameOver(this.room.snapshot as MatchWorkerPublicSnapshot);
        const result = buildMatchWorkerLeaderboardProof(this.room, body, {
            terminal,
            debugEnabled: toPublicNetworkDebugEnabled(this.room)
        });
        return jsonResponse(result.status, result.ok ? result.payload : { ok: false, reason: result.reason });
    }

    async loadRatingStore(): Promise<MatchWorkerRatingStore> {
        return this.getRatingHelpers().loadStore(await this.state.storage.get(RATING_POOL_STORAGE_KEY));
    }

    async saveRatingStore(store: MatchWorkerRatingStore): Promise<void> {
        await this.state.storage.put(RATING_POOL_STORAGE_KEY, store);
    }

    async handleRatingMe(urlObj: URL): Promise<Response> {
        const playerId = String(urlObj.searchParams.get('playerId') || '').trim();
        const store = await this.loadRatingStore();
        const rating = this.getRatingHelpers().getPlayerRating(store, playerId);
        if (!rating) return jsonResponse(403, { ok: false, reason: 'PLAYER_ID_REQUIRED' });
        return jsonResponse(200, {
            ok: true,
            pool: 'card_ranked_v1',
            rating,
            displayRating: Math.round(rating.rating)
        });
    }

    async handleRatingLeaderboard(urlObj: URL): Promise<Response> {
        const store = await this.loadRatingStore();
        return jsonResponse(200, this.getRatingHelpers().listLeaderboard(store, {
            limit: urlObj.searchParams.get('limit') || 50
        }));
    }

    async handleRatingHistory(urlObj: URL): Promise<Response> {
        const store = await this.loadRatingStore();
        const result = this.getRatingHelpers().listPlayerHistory(store, {
            playerId: urlObj.searchParams.get('playerId') || '',
            limit: urlObj.searchParams.get('limit') || 10
        });
        if (!result.ok) return jsonResponse(403, result);
        return jsonResponse(200, result);
    }

    async handleRatingProfileUpdate(body: Record<string, unknown>): Promise<Response> {
        const store = await this.loadRatingStore();
        const result = this.getRatingHelpers().updatePublicProfile(store, body as any);
        if (!result.ok) return jsonResponse(400, result);
        await this.saveRatingStore(result.store);
        return jsonResponse(200, result.payload);
    }

    async handleInternalRatingFinalize(body: Record<string, unknown>): Promise<Response> {
        const store = await this.loadRatingStore();
        const result = this.getRatingHelpers().applyRatedResult(store, body as any);
        if (!result.ok) return jsonResponse(400, result);
        await this.saveRatingStore(result.store);
        return jsonResponse(200, result.payload);
    }

    async handleInternalRatingActiveClaim(body: Record<string, unknown>): Promise<Response> {
        const store = await this.loadRatingStore();
        const result = this.getRatingHelpers().claimActiveRatedMatch(store, body as any);
        if (!result.ok) return jsonResponse(409, result);
        await this.saveRatingStore(result.store);
        return jsonResponse(200, { ok: true });
    }

    async handleInternalRatingActiveRelease(body: Record<string, unknown>): Promise<Response> {
        const store = await this.loadRatingStore();
        const result = this.getRatingHelpers().releaseActiveRatedMatch(store, body && body.matchId);
        await this.saveRatingStore(result.store);
        return jsonResponse(200, { ok: true });
    }

    async fetch(request: Request): Promise<Response> {
        const urlObj = new URL(request.url);
        const pathname = urlObj.pathname;

        if (request.method === 'OPTIONS') {
            return new Response(null, { status: 204, headers: CORS_HEADERS });
        }

        if (request.method === 'POST' && pathname === '/api/leaderboard/submit') {
            return jsonResponse(403, { ok: false, reason: 'LEADERBOARD_RESULT_PROOF_REQUIRED' });
        }

        if (request.method === 'POST' && pathname === '/internal/leaderboard/submit') {
            const parsed = parseJsonBody(await request.text());
            if (parsed === null) return jsonResponse(400, { ok: false, reason: 'INVALID_JSON' });
            if (
                parsed.authorityVerified !== true
                || parsed.authoritySource !== 'match_room'
                || parsed.category !== 'score'
                || parsed.mode !== 'network'
            ) {
                return jsonResponse(403, { ok: false, reason: 'LEADERBOARD_RESULT_PROOF_REQUIRED' });
            }
            return this.handleLeaderboardSubmit(parsed || {});
        }

        if (request.method === 'POST' && pathname === '/internal/leaderboard/result') {
            const parsed = parseJsonBody(await request.text());
            if (parsed === null) return jsonResponse(400, { ok: false, reason: 'INVALID_JSON' });
            return this.handleInternalLeaderboardResult(parsed || {});
        }

        if (request.method === 'POST' && pathname === '/api/leaderboard/profile') {
            const parsed = parseJsonBody(await request.text());
            if (parsed === null) return jsonResponse(400, { ok: false, reason: 'INVALID_JSON' });
            return this.handleLeaderboardProfileUpdate(parsed || {});
        }

        if (request.method === 'GET' && pathname === '/api/leaderboard/list') {
            return this.handleLeaderboardList(urlObj);
        }

        if (request.method === 'GET' && pathname === '/api/rating/me') {
            return this.handleRatingMe(urlObj);
        }

        if (request.method === 'GET' && pathname === '/api/rating/leaderboard') {
            return this.handleRatingLeaderboard(urlObj);
        }

        if (request.method === 'GET' && pathname === '/api/rating/history') {
            return this.handleRatingHistory(urlObj);
        }

        if (request.method === 'POST' && pathname === '/api/rating/profile') {
            const parsed = parseJsonBody(await request.text());
            if (parsed === null) return jsonResponse(400, { ok: false, reason: 'INVALID_JSON' });
            return this.handleRatingProfileUpdate(parsed || {});
        }

        if (request.method === 'POST' && pathname === '/internal/rating/finalize') {
            const parsed = parseJsonBody(await request.text());
            if (parsed === null) return jsonResponse(400, { ok: false, reason: 'INVALID_JSON' });
            return this.handleInternalRatingFinalize(parsed || {});
        }

        if (request.method === 'POST' && pathname === '/internal/rating/active/claim') {
            const parsed = parseJsonBody(await request.text());
            if (parsed === null) return jsonResponse(400, { ok: false, reason: 'INVALID_JSON' });
            return this.handleInternalRatingActiveClaim(parsed || {});
        }

        if (request.method === 'POST' && pathname === '/internal/rating/active/release') {
            const parsed = parseJsonBody(await request.text());
            if (parsed === null) return jsonResponse(400, { ok: false, reason: 'INVALID_JSON' });
            return this.handleInternalRatingActiveRelease(parsed || {});
        }

        if (request.method === 'POST' && pathname === '/api/player/identity/create') {
            return this.getPlayerIdentityController().handleCreate();
        }

        if (request.method === 'POST' && pathname === '/api/player/identity/verify') {
            const parsed = parseJsonBody(await request.text());
            if (parsed === null) return jsonResponse(400, { ok: false, reason: 'INVALID_JSON' });
            return this.getPlayerIdentityController().handleVerify(parsed || {});
        }

        if (request.method === 'POST' && pathname === '/api/player/identity/recover') {
            const parsed = parseJsonBody(await request.text());
            if (parsed === null) return jsonResponse(400, { ok: false, reason: 'INVALID_JSON' });
            return this.getPlayerIdentityController().handleRecover(parsed || {});
        }

        if (request.method === 'POST' && pathname === '/api/player/identity/recovery/regenerate') {
            const parsed = parseJsonBody(await request.text());
            if (parsed === null) return jsonResponse(400, { ok: false, reason: 'INVALID_JSON' });
            return this.getPlayerIdentityController().handleRegenerateRecovery(parsed || {});
        }

        if (request.method === 'POST' && pathname === '/internal/create') {
            const parsed = parseJsonBody(await request.text());
            if (parsed === null) return jsonResponse(400, { ok: false, reason: 'INVALID_JSON' });
            return this.handleInternalCreate(urlObj, parsed || {});
        }

        if (request.method === 'POST' && pathname === '/internal/lobby/upsert') {
            const parsed = parseJsonBody(await request.text());
            if (parsed === null) return jsonResponse(400, { ok: false, reason: 'INVALID_JSON' });
            return this.handleLobbyUpsert(parsed || {});
        }

        if (request.method === 'POST' && pathname === '/internal/lobby/remove') {
            const parsed = parseJsonBody(await request.text());
            if (parsed === null) return jsonResponse(400, { ok: false, reason: 'INVALID_JSON' });
            return this.handleLobbyRemove(parsed || {});
        }

        if (request.method === 'GET' && pathname === '/internal/lobby-entry') {
            return this.handleInternalLobbyEntry(urlObj);
        }

        if (request.method === 'POST' && pathname === '/api/match/rated/queue') {
            const parsed = parseJsonBody(await request.text());
            if (parsed === null) return jsonResponse(400, { ok: false, reason: 'INVALID_JSON' });
            return this.handleRatedQueueEnter(parsed || {});
        }

        if (request.method === 'POST' && pathname === '/api/match/rated/poll') {
            const parsed = parseJsonBody(await request.text());
            if (parsed === null) return jsonResponse(400, { ok: false, reason: 'INVALID_JSON' });
            return this.handleRatedQueuePoll(parsed || {});
        }

        if (request.method === 'POST' && pathname === '/api/match/rated/cancel') {
            const parsed = parseJsonBody(await request.text());
            if (parsed === null) return jsonResponse(400, { ok: false, reason: 'INVALID_JSON' });
            return this.handleRatedQueueCancel(parsed || {});
        }

        if (request.method === 'GET' && pathname === '/api/match/list') {
            return this.handleLobbyList();
        }

        if (request.method === 'POST' && pathname === '/api/match/join') {
            const parsed = parseJsonBody(await request.text());
            if (parsed === null) return jsonResponse(400, { ok: false, reason: 'INVALID_JSON' });
            return this.handleJoin(parsed || {});
        }

        if (request.method === 'POST' && pathname === '/api/match/leave') {
            const parsed = parseJsonBody(await request.text());
            if (parsed === null) return jsonResponse(400, { ok: false, reason: 'INVALID_JSON' });
            return this.handleLeave(parsed || {});
        }

        if (request.method === 'POST' && pathname === '/api/match/spectate') {
            const parsed = parseJsonBody(await request.text());
            if (parsed === null) return jsonResponse(400, { ok: false, reason: 'INVALID_JSON' });
            return this.handleSpectate(parsed || {});
        }

        if (request.method === 'POST' && pathname === '/api/match/spectator-leave') {
            const parsed = parseJsonBody(await request.text());
            if (parsed === null) return jsonResponse(400, { ok: false, reason: 'INVALID_JSON' });
            return this.handleSpectatorLeave(parsed || {});
        }

        if (request.method === 'POST' && pathname === '/api/match/publish') {
            const parsed = parseJsonBody(await request.text());
            if (parsed === null) return jsonResponse(400, { ok: false, reason: 'INVALID_JSON' });
            return this.handlePublish(parsed || {});
        }

        if (request.method === 'POST' && pathname === '/api/match/resign') {
            const parsed = parseJsonBody(await request.text());
            if (parsed === null) return jsonResponse(400, { ok: false, reason: 'INVALID_JSON' });
            return this.handleResign(parsed || {});
        }

        if (request.method === 'POST' && pathname === '/api/match/chat') {
            const parsed = parseJsonBody(await request.text());
            if (parsed === null) return jsonResponse(400, { ok: false, reason: 'INVALID_JSON' });
            return this.handleChat(parsed || {});
        }

        if (request.method === 'POST' && pathname === '/api/match/rematch-request') {
            const parsed = parseJsonBody(await request.text());
            if (parsed === null) return jsonResponse(400, { ok: false, reason: 'INVALID_JSON' });
            return this.handleRematchRequest(parsed || {});
        }

        if (request.method === 'POST' && pathname === '/api/match/rematch-response') {
            const parsed = parseJsonBody(await request.text());
            if (parsed === null) return jsonResponse(400, { ok: false, reason: 'INVALID_JSON' });
            return this.handleRematchResponse(parsed || {});
        }

        if (request.method === 'POST' && pathname === '/api/match/hand-skin') {
            const parsed = parseJsonBody(await request.text());
            if (parsed === null) return jsonResponse(400, { ok: false, reason: 'INVALID_JSON' });
            return this.handleHandSkin(parsed || {});
        }

        if (request.method === 'POST' && pathname === '/api/match/deck') {
            const parsed = parseJsonBody(await request.text());
            if (parsed === null) return jsonResponse(400, { ok: false, reason: 'INVALID_JSON' });
            return this.handleDeck(parsed || {});
        }

        if (request.method === 'GET' && pathname === '/api/match/state') {
            return this.handleState(urlObj);
        }

        if (request.method === 'GET' && pathname === '/api/match/presentation-journal') {
            return this.handlePresentationJournal(request);
        }

        if (request.method === 'GET' && pathname === '/api/match/stream') {
            return this.handleStream(request);
        }

        return jsonResponse(404, { ok: false, reason: 'NOT_FOUND' });
    }

    async handleChat(body: Record<string, unknown>): Promise<Response> {
        await this.loadRoom();
        if (await this.expireRoomIfNeeded(Date.now())) {
            return jsonResponse(404, { ok: false, reason: 'ROOM_NOT_FOUND' });
        }
        return this.getChatController().handleChat(body);
    }
}

assertMatchRoomDurableObjectConstructor(MatchRoomDurableObject);

const matchWorkerEntrypoint: MatchWorkerEntrypoint = assertMatchWorkerEntrypoint({
    async fetch(request, env) {
        const urlObj = new URL(request.url);

        if (urlObj.pathname.startsWith('/api/match/')) {
            return handleMatchApi(request, env);
        }

        if (urlObj.pathname.startsWith('/api/player/identity/') || urlObj.pathname === '/api/player/profile') {
            return handleMatchApi(request, env);
        }

        if (urlObj.pathname.startsWith('/api/leaderboard/')) {
            return handleLeaderboardApi(request, env);
        }

        if (urlObj.pathname.startsWith('/api/rating/')) {
            return handleRatingApi(request, env);
        }

        if (env.ASSETS && typeof env.ASSETS.fetch === 'function') {
            return env.ASSETS.fetch(request);
        }

        return new Response('Not Found', { status: 404 });
    }
});

export default matchWorkerEntrypoint;
