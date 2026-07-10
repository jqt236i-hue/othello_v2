import './match-worker-runtime-preload.js';
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
    MatchWorkerTurnStartOptions,
    MatchWorkerTurnStartHandState,
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
    MatchAuthorityAcceptedOperationEntry,
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
import { createMatchWorkerLeaderboardRoomController } from './match-worker-leaderboard-room';
import { createMatchWorkerPlayerIdentityController } from './match-worker-player-identity';
import { createMatchWorkerRatingHelpers } from './match-worker-rating';
import { createMatchWorkerStreamController } from './match-worker-stream-controller';
import { createMatchWorkerStreamRouteController } from './match-worker-stream-route-controller';
import { createMatchWorkerStreamSessionController } from './match-worker-stream-session-controller';
import { createMatchWorkerTimeoutController } from './match-worker-timeout-controller';
import { createMatchWorkerTurnTimerController } from './match-worker-turn-timer-controller';
import { createMatchWorkerTurnTimerHelpers } from './match-worker-turn-timer';
import { createMatchWorkerPublishController } from './match-worker-publish-controller';
import { createMatchSpectateController } from '../utils/match-spectate-controller';
import { createMatchJoinController } from '../utils/match-join-controller';
import { createMatchLeaveController } from '../utils/match-leave-controller';
import {
    prepareMatchCommandAction,
    shouldSkipMatchCommandTurnStart
} from '../utils/match-command-runtime';
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
const LEADERBOARD_STORAGE_KEY = 'global_score_leaderboard_v3';
const TIME_ATTACK_LEADERBOARD_STORAGE_KEY = 'global_time_attack_leaderboard_v1';
const TIME_DEFENSE_LEADERBOARD_STORAGE_KEY = 'global_time_defense_leaderboard_v1';
const SHORTEST_TURNS_LEADERBOARD_STORAGE_KEY = 'global_shortest_turns_leaderboard_v1';
const LEADERBOARD_STORAGE_VERSION = 3;
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
const SSE_WRITE_TIMEOUT_MS = 10000;
const NETWORK_DEBUG_FILL_HAND_ACTION = MatchAuthority.NETWORK_DEBUG_FILL_HAND_ACTION || 'debug_fill_hand';
let coreLogicModulePromise: Promise<MatchWorkerCoreModule> | null = null;
let deckModulesPromise: Promise<MatchWorkerDeckGlobals> | null = null;
let turnStartModulesPromise: Promise<MatchWorkerTurnStartModules> | null = null;
let turnPipelineModulesPromise: Promise<MatchWorkerTurnPipelineModules> | null = null;
let debugActionsModulePromise: Promise<MatchWorkerRuntimeModule> | null = null;
let workerSharedConstantsPromise: Promise<unknown> | null = null;
let workerSharedBoardUtilsPromise: Promise<unknown> | null = null;
let workerDeckGlobalsPromise: Promise<unknown> | null = null;
let workerCardGlobalsPromise: Promise<unknown> | null = null;
let workerTurnPipelinePhaseGlobalsPromise: Promise<unknown> | null = null;
let workerPipelineUIAdapterGlobalsPromise: Promise<unknown> | null = null;

type MatchWorkerModuleLoader = () => unknown;

const WORKER_PRELOAD_MODULE_LOADERS: Readonly<Record<string, MatchWorkerModuleLoader>> = Object.freeze({
    '../shared-constants.js': () => require('../shared-constants.js'),
    '../shared/shared-board-utils.js': () => require('../shared/shared-board-utils.js'),
    '../shared/deck-spec.js': () => require('../shared/deck-spec.js'),
    '../shared/deck-codec.js': () => require('../shared/deck-codec.js'),
    '../shared/player-encoding.js': () => require('../shared/player-encoding.js'),
    '../shared/destroy-outcome-contract.js': () => require('../shared/destroy-outcome-contract.js'),
    '../shared/evasion-status.js': () => require('../shared/evasion-status.js'),
    '../shared/manifest-stone-registry.js': () => require('../shared/manifest-stone-registry.js'),
    '../shared/stone-status-snapshot.js': () => require('../shared/stone-status-snapshot.js'),
    '../shared/special-card-registry.js': () => require('../shared/special-card-registry.js'),
    '../shared/special-stone-registry.js': () => require('../shared/special-stone-registry.js'),
    '../shared/presentation-effect-profiles.js': () => require('../shared/presentation-effect-profiles.js'),
    '../shared/network-action-schema.js': () => require('../shared/network-action-schema.js'),
    '../shared/playback-planner.js': () => require('../shared/playback-planner.js'),
    '../shared/playback-event-helpers.js': () => require('../shared/playback-event-helpers.js'),
    '../game/logic/cards-internal/random-source.js': () => require('../game/logic/cards-internal/random-source.js'),
    '../game/logic/cards-internal/evasion-destination.js': () => require('../game/logic/cards-internal/evasion-destination.js'),
    '../game/logic/cards-internal/state-factory.js': () => require('../game/logic/cards-internal/state-factory.js'),
    '../game/logic/cards-internal/module-resolver.js': () => require('../game/logic/cards-internal/module-resolver.js'),
    '../game/logic/cards-internal/protection-context.js': () => require('../game/logic/cards-internal/protection-context.js'),
    '../game/logic/cards-internal/presentation-helpers.js': () => require('../game/logic/cards-internal/presentation-helpers.js'),
    '../game/logic/cards-internal/capture-source.js': () => require('../game/logic/cards-internal/capture-source.js'),
    '../game/logic/cards-internal/progression.js': () => require('../game/logic/cards-internal/progression.js'),
    '../game/logic/cards-internal/random-board-spawn.js': () => require('../game/logic/cards-internal/random-board-spawn.js'),
    '../game/logic/cards-internal/spawn-and-flip.js': () => require('../game/logic/cards-internal/spawn-and-flip.js'),
    '../game/logic/cards-internal/ribo-time-stop.js': () => require('../game/logic/cards-internal/ribo-time-stop.js'),
    '../game/logic/cards-internal/target-access.js': () => require('../game/logic/cards-internal/target-access.js'),
    '../game/logic/cards-internal/context-builders.js': () => require('../game/logic/cards-internal/context-builders.js'),
    '../game/logic/cards-internal/theory-incarnation-bindings.js': () => require('../game/logic/cards-internal/theory-incarnation-bindings.js'),
    '../game/logic/cards-internal/deck-setup.js': () => require('../game/logic/cards-internal/deck-setup.js'),
    '../game/logic/cards-internal/hand-access.js': () => require('../game/logic/cards-internal/hand-access.js'),
    '../game/logic/cards-internal/card-availability.js': () => require('../game/logic/cards-internal/card-availability.js'),
    '../game/logic/cards-internal/offer-builders.js': () => require('../game/logic/cards-internal/offer-builders.js'),
    '../game/logic/cards-internal/effect-target-counts.js': () => require('../game/logic/cards-internal/effect-target-counts.js'),
    '../game/logic/cards-internal/salvation-effect.js': () => require('../game/logic/cards-internal/salvation-effect.js'),
    '../game/logic/cards-internal/loss-effect.js': () => require('../game/logic/cards-internal/loss-effect.js'),
    '../game/logic/cards-internal/fate-effect.js': () => require('../game/logic/cards-internal/fate-effect.js'),
    '../game/logic/cards-internal/board-shape-access.js': () => require('../game/logic/cards-internal/board-shape-access.js'),
    '../game/logic/cards-internal/expansion-fallback.js': () => require('../game/logic/cards-internal/expansion-fallback.js'),
    '../game/logic/cards-internal/hand-manager.js': () => require('../game/logic/cards-internal/hand-manager.js'),
    '../game/logic/cards-internal/charge-ledger.js': () => require('../game/logic/cards-internal/charge-ledger.js'),
    '../game/logic/cards-internal/pending-state-manager.js': () => require('../game/logic/cards-internal/pending-state-manager.js'),
    '../game/logic/cards-internal/card-usage-prechecks.js': () => require('../game/logic/cards-internal/card-usage-prechecks.js'),
    '../game/logic/cards-internal/effect-timing.js': () => require('../game/logic/cards-internal/effect-timing.js'),
    '../game/logic/cards/selectors-core-utils.js': () => require('../game/logic/cards/selectors-core-utils.js'),
    '../game/logic/cards/selectors-board-shape.js': () => require('../game/logic/cards/selectors-board-shape.js'),
    '../game/logic/cards/expansion.js': () => require('../game/logic/cards/expansion.js'),
    '../game/logic/cards/causal_replay.js': () => require('../game/logic/cards/causal_replay.js'),
    '../game/logic/cards/movement.js': () => require('../game/logic/cards/movement.js'),
    '../game/logic/cards/teleport.js': () => require('../game/logic/cards/teleport.js'),
    '../game/logic/cards/cell-removal.js': () => require('../game/logic/cards/cell-removal.js'),
    '../game/logic/cards/clone.js': () => require('../game/logic/cards/clone.js'),
    '../game/logic/cards/meteor.js': () => require('../game/logic/cards/meteor.js'),
    '../game/logic/cards/meteor_god.js': () => require('../game/logic/cards/meteor_god.js'),
    '../game/logic/cards/shrink.js': () => require('../game/logic/cards/shrink.js'),
    '../game/logic/cards/living_will.js': () => require('../game/logic/cards/living_will.js'),
    '../game/logic/cards/targets.js': () => require('../game/logic/cards/targets.js'),
    '../game/logic/cards/flips.js': () => require('../game/logic/cards/flips.js'),
    '../game/logic/cards/chain.js': () => require('../game/logic/cards/chain.js'),
    '../game/logic/cards/regen.js': () => require('../game/logic/cards/regen.js'),
    '../game/logic/cards/time_bomb.js': () => require('../game/logic/cards/time_bomb.js'),
    '../game/logic/cards/breeding.js': () => require('../game/logic/cards/breeding.js'),
    '../game/logic/effects/dragon.js': () => require('../game/logic/effects/dragon.js'),
    '../game/logic/cards/udg.js': () => require('../game/logic/cards/udg.js'),
    '../game/logic/cards/hyperactive.js': () => require('../game/logic/cards/hyperactive.js'),
    '../game/logic/cards/sniper.js': () => require('../game/logic/cards/sniper.js'),
    '../game/logic/cards/lightning.js': () => require('../game/logic/cards/lightning.js'),
    '../game/logic/cards/will_hunter_king.js': () => require('../game/logic/cards/will_hunter_king.js'),
    '../game/logic/cards/destroy_dragon.js': () => require('../game/logic/cards/destroy_dragon.js'),
    '../game/logic/cards/selectors.js': () => require('../game/logic/cards/selectors.js'),
    '../game/logic/cards/work_will.js': () => require('../game/logic/cards/work_will.js'),
    '../game/logic/cards/sacrifice_will.js': () => require('../game/logic/cards/sacrifice_will.js'),
    '../game/logic/cards/markers.js': () => require('../game/logic/cards/markers.js'),
    '../game/logic/board_ops.js': () => require('../game/logic/board_ops.js'),
    '../game/logic/effects/destroy_one_stone.js': () => require('../game/logic/effects/destroy_one_stone.js'),
    '../game/logic/effects/swap_with_enemy.js': () => require('../game/logic/effects/swap_with_enemy.js'),
    '../game/cards/state-manager.js': () => require('../game/cards/state-manager.js'),
    '../game/cards/effect-resolver.js': () => require('../game/cards/effect-resolver.js'),
    '../game/cards/timing-processor.js': () => require('../game/cards/timing-processor.js'),
    '../game/cards/target-resolver.js': () => require('../game/cards/target-resolver.js'),
    '../game/logic/card-resolution/protect': () => require('../game/logic/card-resolution/protect'),
    '../game/logic/card-resolution/trap': () => require('../game/logic/card-resolution/trap'),
    '../game/logic/card-resolution/ownership': () => require('../game/logic/card-resolution/ownership'),
    '../game/logic/card-resolution/board-expansion-apply': () => require('../game/logic/card-resolution/board-expansion-apply'),
    '../game/logic/card-resolution/status-cells': () => require('../game/logic/card-resolution/status-cells'),
    '../game/logic/card-resolution/hand-effects': () => require('../game/logic/card-resolution/hand-effects'),
    '../game/logic/card-resolution/observer-will': () => require('../game/logic/card-resolution/observer-will'),
    '../game/logic/card-resolution/theory-incarnation': () => require('../game/logic/card-resolution/theory-incarnation'),
    '../game/logic/card-resolution/chaos-summon': () => require('../game/logic/card-resolution/chaos-summon'),
    '../game/logic/card-resolution/board-executor': () => require('../game/logic/card-resolution/board-executor'),
    '../game/logic/card-resolution/special-stone-marker-factory': () => require('../game/logic/card-resolution/special-stone-marker-factory'),
    '../game/logic/card-resolution/position-swap': () => require('../game/logic/card-resolution/position-swap'),
    '../game/logic/markers_adapter.js': () => require('../game/logic/markers_adapter.js'),
    '../game/logic/context': () => require('../game/logic/context'),
    '../game/turn/turn_pipeline_phase_helpers.js': () => require('../game/turn/turn_pipeline_phase_helpers.js'),
    '../game/turn/pending-coordinator.js': () => require('../game/turn/pending-coordinator.js'),
    '../game/turn/action-phase/continuation.js': () => require('../game/turn/action-phase/continuation.js'),
    '../game/turn/action-phase/placement-effects.js': () => require('../game/turn/action-phase/placement-effects.js'),
    '../game/turn/card-usage/immediate-effects.js': () => require('../game/turn/card-usage/immediate-effects.js'),
    '../game/turn/board-charge.js': () => require('../game/turn/board-charge.js'),
    '../game/turn/presentation-helpers.js': () => require('../game/turn/presentation-helpers.js'),
    '../game/turn/round-state.js': () => require('../game/turn/round-state.js'),
    '../game/turn/action-phase/pre-placement-selection.js': () => require('../game/turn/action-phase/pre-placement-selection.js'),
    '../game/turn/action-phase/place-resolution.js': () => require('../game/turn/action-phase/place-resolution.js'),
    '../game/turn/action-phase/placement-immediate-effects.js': () => require('../game/turn/action-phase/placement-immediate-effects.js'),
    '../game/turn/action-phase/turn-handoff.js': () => require('../game/turn/action-phase/turn-handoff.js'),
    '../game/turn/phase-presentation-finalizer.js': () => require('../game/turn/phase-presentation-finalizer.js'),
    '../game/turn/turn-start/bomb-phase.js': () => require('../game/turn/turn-start/bomb-phase.js'),
    '../game/turn/turn-start/marker-phase.js': () => require('../game/turn/turn-start/marker-phase.js'),
    '../game/turn/turn-start/post-processing.js': () => require('../game/turn/turn-start/post-processing.js'),
    '../game/turn/turn-start/special-stone-phase.js': () => require('../game/turn/turn-start/special-stone-phase.js'),
    '../game/turn/turn-start/timer-phase.js': () => require('../game/turn/turn-start/timer-phase.js'),
    '../game/turn/pipeline-ui/board-event-playback.js': () => require('../game/turn/pipeline-ui/board-event-playback.js'),
    '../game/turn/pipeline-ui/board-event-mapper.js': () => require('../game/turn/pipeline-ui/board-event-mapper.js'),
    '../game/turn/pipeline-ui/passive-event-playback.js': () => require('../game/turn/pipeline-ui/passive-event-playback.js'),
    '../game/turn/pipeline-ui/playback-after-state.js': () => require('../game/turn/pipeline-ui/playback-after-state.js'),
    '../game/turn/pipeline-ui/log-mappers.js': () => require('../game/turn/pipeline-ui/log-mappers.js'),
    '../game/turn/pipeline-ui/playback-utils.js': () => require('../game/turn/pipeline-ui/playback-utils.js'),
    '../game/turn/pipeline-ui/generated-throw-chain-playback.js': () => require('../game/turn/pipeline-ui/generated-throw-chain-playback.js'),
    '../game/turn/pipeline-ui/sound-cue-assembler.js': () => require('../game/turn/pipeline-ui/sound-cue-assembler.js'),
    '../game/turn/pipeline-ui/card-economy-sound-cues.js': () => require('../game/turn/pipeline-ui/card-economy-sound-cues.js'),
    '../game/turn/pipeline-ui/core-sound-cues.js': () => require('../game/turn/pipeline-ui/core-sound-cues.js'),
    '../game/turn/pipeline-ui/destroy-sound-cues.js': () => require('../game/turn/pipeline-ui/destroy-sound-cues.js'),
    '../game/turn/pipeline-ui/selection-sound-cues.js': () => require('../game/turn/pipeline-ui/selection-sound-cues.js'),
    '../game/turn/pipeline-ui/sound-cue-helpers.js': () => require('../game/turn/pipeline-ui/sound-cue-helpers.js'),
    '../game/logic/cards/utils.js': () => require('../game/logic/cards/utils.js'),
    '../game/turn/sub-placement-continuation.js': () => require('../game/turn/sub-placement-continuation.js')
});
const WORKER_PRELOAD_MODULE_CACHE = new Map<string, unknown>();

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

function loadWorkerPreloadModule(importPath: string): unknown {
    if (WORKER_PRELOAD_MODULE_CACHE.has(importPath)) {
        return WORKER_PRELOAD_MODULE_CACHE.get(importPath);
    }
    const loader = Object.prototype.hasOwnProperty.call(WORKER_PRELOAD_MODULE_LOADERS, importPath)
        ? WORKER_PRELOAD_MODULE_LOADERS[importPath]
        : null;
    if (typeof loader !== 'function') {
        throw new Error(`Worker preload module missing: ${importPath}`);
    }
    const mod = loader();
    WORKER_PRELOAD_MODULE_CACHE.set(importPath, mod);
    return mod;
}

function getNetworkActionSchemaModule(): MatchWorkerRuntimeModule {
    return resolveModuleDefault(loadWorkerPreloadModule('../shared/network-action-schema.js'));
}

function getPlaybackEventHelpersModule(): MatchWorkerRuntimeModule {
    return resolveModuleDefault(loadWorkerPreloadModule('../shared/playback-event-helpers.js'));
}

function getSubPlacementContinuationModule(): MatchWorkerRuntimeModule {
    return resolveModuleDefault(loadWorkerPreloadModule('../game/turn/sub-placement-continuation.js'));
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

function importWorkerGlobal(importPath: string, globalKey: string): Promise<unknown> {
    const runtimeValue = readRuntimeGlobalValue(globalKey);
    if (hasUsableRuntimeModule(runtimeValue)) {
        return Promise.resolve(runtimeValue);
    }
    let mod: unknown;
    try {
        mod = loadWorkerPreloadModule(importPath);
    } catch (error) {
        return Promise.reject(error);
    }
    const resolved = unwrapRuntimeModule(mod);
    const globalAfterLoad = readRuntimeGlobalValue(globalKey);
    const preferredResolved = ModuleExportUtils && typeof ModuleExportUtils.preferUsableModuleExport === 'function'
        ? ModuleExportUtils.preferUsableModuleExport(resolved, globalAfterLoad)
        : (hasUsableRuntimeModule(resolved) ? resolved : globalAfterLoad);
    if (globalKey && hasUsableRuntimeModule(preferredResolved)) {
        setRuntimeGlobalValue(globalKey, preferredResolved);
    } else if (globalKey && resolved) {
        setRuntimeGlobalValue(globalKey, resolved);
    }
    return Promise.resolve(preferredResolved || resolved);
}

function ensureWorkerSharedConstants() {
    if (!workerSharedConstantsPromise) {
        workerSharedConstantsPromise = importWorkerGlobal('../shared-constants.js', 'SharedConstants');
    }
    return workerSharedConstantsPromise;
}

function ensureWorkerSharedBoardUtils() {
    if (!workerSharedBoardUtilsPromise) {
        workerSharedBoardUtilsPromise = ensureWorkerSharedConstants()
            .then(() => importWorkerGlobal('../shared/shared-board-utils.js', 'SharedBoardUtils'));
    }
    return workerSharedBoardUtilsPromise;
}

function ensureWorkerDeckGlobals(): Promise<MatchWorkerDeckGlobals> {
    if (!workerDeckGlobalsPromise) {
        workerDeckGlobalsPromise = Promise.all([
            ensureWorkerSharedConstants(),
            importWorkerGlobal('../shared/deck-spec.js', 'DeckSpecHelpers'),
            importWorkerGlobal('../shared/deck-codec.js', 'DeckCodecModule')
        ]).then(([, deckSpecHelpers, deckCodecModule]) => ({
            deckSpecHelpers: asRuntimeModule(deckSpecHelpers) as MatchWorkerDeckGlobals['deckSpecHelpers'],
            deckCodecModule: asRuntimeModule(deckCodecModule) as MatchWorkerDeckGlobals['deckCodecModule']
        }));
    }
    return workerDeckGlobalsPromise as Promise<MatchWorkerDeckGlobals>;
}

function ensureWorkerCardGlobals(): Promise<unknown> {
    if (!workerCardGlobalsPromise) {
        const requiredGlobals: Array<[string, string]> = [
            ['../shared/player-encoding.js', 'PlayerEncoding'],
            ['../shared/destroy-outcome-contract.js', 'DestroyOutcomeContract'],
            ['../shared/evasion-status.js', 'EvasionStatus'],
            ['../shared/manifest-stone-registry.js', 'ManifestStoneRegistry'],
            ['../shared/stone-status-snapshot.js', 'StoneStatusSnapshot'],
            ['../shared/special-card-registry.js', 'SpecialCardRegistry'],
            ['../shared/special-stone-registry.js', 'SpecialStoneRegistry'],
            ['../game/logic/cards-internal/random-source.js', 'CardRandomSource'],
            ['../game/logic/cards-internal/evasion-destination.js', 'CardEvasionDestination'],
            ['../game/logic/cards-internal/state-factory.js', 'CardStateFactory'],
            ['../game/logic/cards-internal/module-resolver.js', 'CardModuleResolver'],
            ['../game/logic/cards-internal/protection-context.js', 'CardProtectionContext'],
            ['../game/logic/cards-internal/presentation-helpers.js', 'CardPresentationHelpers'],
            ['../game/logic/cards-internal/capture-source.js', 'CardCaptureSource'],
            ['../game/logic/cards-internal/progression.js', 'CardProgression'],
            ['../game/logic/cards-internal/random-board-spawn.js', 'CardRandomBoardSpawn'],
            ['../game/logic/cards-internal/spawn-and-flip.js', 'CardSpawnAndFlip'],
            ['../game/logic/cards-internal/ribo-time-stop.js', 'CardRiboTimeStop'],
            ['../game/logic/cards-internal/target-access.js', 'CardTargetAccess'],
            ['../game/logic/cards-internal/context-builders.js', 'CardContextBuilders'],
            ['../game/logic/cards-internal/theory-incarnation-bindings.js', 'CardTheoryIncarnationBindings'],
            ['../game/logic/cards-internal/deck-setup.js', 'CardDeckSetup'],
            ['../game/logic/cards-internal/hand-access.js', 'CardHandAccess'],
            ['../game/logic/cards-internal/card-availability.js', 'CardAvailability'],
            ['../game/logic/cards-internal/offer-builders.js', 'CardOfferBuilders'],
            ['../game/logic/cards-internal/effect-target-counts.js', 'CardEffectTargetCounts'],
            ['../game/logic/cards-internal/salvation-effect.js', 'CardSalvationEffect'],
            ['../game/logic/cards-internal/loss-effect.js', 'CardLossEffect'],
            ['../game/logic/cards-internal/fate-effect.js', 'CardFateEffect'],
            ['../game/logic/cards-internal/board-shape-access.js', 'CardBoardShapeAccess'],
            ['../game/logic/cards-internal/expansion-fallback.js', 'CardExpansionFallback'],
            ['../game/logic/cards-internal/hand-manager.js', 'CardHandManager'],
            ['../game/logic/cards-internal/charge-ledger.js', 'CardChargeLedger'],
            ['../game/logic/cards-internal/pending-state-manager.js', 'CardPendingStateManager'],
            ['../game/logic/cards-internal/card-usage-prechecks.js', 'CardUsagePrechecks'],
            ['../game/logic/cards-internal/effect-timing.js', 'CardEffectTiming'],
            ['../game/logic/cards/selectors-core-utils.js', 'CardSelectorsCoreUtils'],
            ['../game/logic/cards/selectors-board-shape.js', 'CardSelectorsBoardShape'],
            ['../game/logic/cards/expansion.js', 'CardExpansion'],
            ['../game/logic/cards/cell-removal.js', 'CardCellRemoval'],
            ['../game/logic/cards/causal_replay.js', 'CardCausalReplay'],
            ['../game/logic/cards/movement.js', 'CardMovement'],
            ['../game/logic/cards/teleport.js', 'CardTeleport'],
            ['../game/logic/cards/clone.js', 'CardClone'],
            ['../game/logic/cards/meteor.js', 'CardMeteor'],
            ['../game/logic/cards/meteor_god.js', 'CardMeteorGod'],
            ['../game/logic/cards/shrink.js', 'CardShrink'],
            ['../game/logic/cards/living_will.js', 'CardLivingWill'],
            ['../game/logic/cards/targets.js', 'CardTargets'],
            ['../game/logic/cards/flips.js', 'CardFlips'],
            ['../game/logic/cards/chain.js', 'CardChain'],
            ['../game/logic/cards/regen.js', 'CardRegen'],
            ['../game/logic/cards/time_bomb.js', 'CardTimeBomb'],
            ['../game/logic/cards/breeding.js', 'CardBreeding'],
            ['../game/logic/effects/dragon.js', 'DragonEffects'],
            ['../game/logic/cards/udg.js', 'CardUdg'],
            ['../game/logic/cards/hyperactive.js', 'CardHyperactive'],
            ['../game/logic/cards/sniper.js', 'CardSniper'],
            ['../game/logic/cards/lightning.js', 'CardLightning'],
            ['../game/logic/cards/will_hunter_king.js', 'CardWillHunterKing'],
            ['../game/logic/cards/destroy_dragon.js', 'CardDestroyDragon'],
            ['../game/logic/cards/selectors.js', 'CardSelectors'],
            ['../game/logic/cards/work_will.js', 'CardWork'],
            ['../game/logic/cards/sacrifice_will.js', 'CardSacrificeWill'],
            ['../game/logic/cards/markers.js', 'CardMarkers'],
            ['../game/logic/board_ops.js', 'BoardOps'],
            ['../game/logic/effects/destroy_one_stone.js', 'DestroyOneStoneEffects'],
            ['../game/logic/effects/swap_with_enemy.js', 'SwapWithEnemyEffects'],
            ['../game/cards/state-manager.js', 'CardStateManager'],
            ['../game/cards/effect-resolver.js', 'CardEffectResolver'],
            ['../game/cards/timing-processor.js', 'CardTimingProcessor'],
            ['../game/cards/target-resolver.js', 'CardTargetResolver'],
            ['../game/logic/card-resolution/protect', 'CardProtectEffects'],
            ['../game/logic/card-resolution/trap', 'CardTrapEffects'],
            ['../game/logic/card-resolution/ownership', 'CardOwnershipEffects'],
            ['../game/logic/card-resolution/board-expansion-apply', 'CardBoardExpansionApply'],
            ['../game/logic/card-resolution/status-cells', 'CardStatusCellsEffects'],
            ['../game/logic/card-resolution/hand-effects', 'CardHandEffects'],
            ['../game/logic/card-resolution/observer-will', 'CardObserverWillResolution'],
            ['../game/logic/card-resolution/theory-incarnation', 'CardTheoryIncarnationResolution'],
            ['../game/logic/card-resolution/chaos-summon', 'CardChaosSummonResolution'],
            ['../game/logic/card-resolution/board-executor', 'CardBoardExecutorResolution'],
            ['../game/logic/card-resolution/special-stone-marker-factory', 'SpecialStoneMarkerFactory'],
            ['../game/logic/card-resolution/position-swap', 'CardPositionSwapEffects']
        ];
        const optionalGlobals: Array<[string, string]> = [
            ['../game/logic/cards/utils.js', 'CardUtils']
        ];
        workerCardGlobalsPromise = ensureWorkerDeckGlobals()
            .then(() => ensureWorkerSharedBoardUtils())
            .then(() => requiredGlobals.reduce(
                (promise, [importPath, globalKey]) => promise.then(() => importWorkerGlobal(importPath, globalKey)),
                Promise.resolve<unknown>(undefined)
            ))
            .then(() => optionalGlobals.reduce(
                (promise, [importPath, globalKey]) => promise.then(() => importWorkerGlobal(importPath, globalKey).catch(() => null)),
                Promise.resolve<unknown>(undefined)
            ));
    }
    return workerCardGlobalsPromise;
}

function ensureWorkerTurnPipelinePhaseGlobals(): Promise<unknown> {
    if (!workerTurnPipelinePhaseGlobalsPromise) {
        const requiredGlobals: Array<[string, string]> = [
            ['../game/logic/markers_adapter.js', 'MarkersAdapter'],
            ['../game/logic/cards/utils.js', 'CardUtils'],
            ['../game/logic/context', 'CardContext'],
            ['../shared-constants.js', 'SharedConstants'],
            ['../utils/owner-helpers.js', 'OwnerHelpers'],
            ['../shared/destroy-outcome-contract.js', 'DestroyOutcomeContract'],
            ['../game/turn/turn_pipeline_phase_helpers.js', 'TurnPipelinePhaseHelpers'],
            ['../game/turn/pending-coordinator.js', 'TurnPendingCoordinator'],
            ['../game/turn/sub-placement-continuation.js', 'TurnSubPlacementContinuation'],
            ['../game/turn/action-phase/continuation.js', 'TurnActionPhaseContinuation'],
            ['../game/turn/action-phase/placement-effects.js', 'TurnActionPhasePlacementEffects'],
            ['../game/turn/card-usage/immediate-effects.js', 'TurnCardUsageImmediateEffects'],
            ['../game/turn/board-charge.js', 'TurnBoardCharge'],
            ['../game/turn/presentation-helpers.js', 'TurnPresentationHelpers'],
            ['../game/turn/round-state.js', 'TurnRoundState'],
            ['../game/turn/action-phase/pre-placement-selection.js', 'TurnActionPhasePrePlacementSelection'],
            ['../game/turn/action-phase/place-resolution.js', 'TurnActionPhasePlaceResolution'],
            ['../game/turn/action-phase/placement-immediate-effects.js', 'TurnActionPhasePlacementImmediateEffects'],
            ['../game/turn/action-phase/turn-handoff.js', 'TurnActionPhaseTurnHandoff'],
            ['../game/turn/phase-presentation-finalizer.js', 'TurnPhasePresentationFinalizer'],
            ['../game/turn/turn-start/bomb-phase.js', 'TurnStartBombPhase'],
            ['../game/turn/turn-start/marker-phase.js', 'TurnStartMarkerPhase'],
            ['../game/turn/turn-start/post-processing.js', 'TurnStartPostProcessing'],
            ['../game/turn/turn-start/special-stone-phase.js', 'TurnStartSpecialStonePhase'],
            ['../game/turn/turn-start/timer-phase.js', 'TurnStartTimerPhase']
        ];
        workerTurnPipelinePhaseGlobalsPromise = requiredGlobals.reduce(
            (promise, [importPath, globalKey]) => promise.then(() => importWorkerGlobal(importPath, globalKey)),
            Promise.resolve<unknown>(undefined)
        );
    }
    return workerTurnPipelinePhaseGlobalsPromise;
}

function ensureWorkerPipelineUIAdapterGlobals(): Promise<unknown> {
    if (!workerPipelineUIAdapterGlobalsPromise) {
        const requiredGlobals: Array<[string, string]> = [
            ['../shared/playback-planner.js', 'PlaybackPlanner'],
            ['../game/turn/pipeline-ui/playback-utils.js', 'PipelineUIPlaybackUtils'],
            ['../game/turn/pipeline-ui/board-event-playback.js', 'PipelineUIBoardEventPlayback'],
            ['../game/turn/pipeline-ui/board-event-mapper.js', 'PipelineUIBoardEventMapper'],
            ['../game/turn/pipeline-ui/passive-event-playback.js', 'PipelineUIPassiveEventPlayback'],
            ['../game/turn/pipeline-ui/playback-after-state.js', 'PipelineUIPlaybackAfterState'],
            ['../game/turn/pipeline-ui/log-mappers.js', 'PipelineUILogMappers'],
            ['../game/turn/pipeline-ui/generated-throw-chain-playback.js', 'PipelineUIGeneratedThrowChainPlayback'],
            ['../game/turn/pipeline-ui/card-economy-sound-cues.js', 'PipelineUICardEconomySoundCues'],
            ['../game/turn/pipeline-ui/core-sound-cues.js', 'PipelineUICoreSoundCues'],
            ['../game/turn/pipeline-ui/destroy-sound-cues.js', 'PipelineUIDestroySoundCues'],
            ['../game/turn/pipeline-ui/selection-sound-cues.js', 'PipelineUISelectionSoundCues'],
            ['../game/turn/pipeline-ui/sound-cue-helpers.js', 'PipelineUISoundCueHelpers'],
            ['../game/turn/pipeline-ui/sound-cue-assembler.js', 'PipelineUISoundCueAssembler']
        ];
        workerPipelineUIAdapterGlobalsPromise = ensureWorkerTurnPipelinePhaseGlobals()
            .then(() => requiredGlobals.reduce(
                (promise, [importPath, globalKey]) => promise.then(() => importWorkerGlobal(importPath, globalKey)),
                Promise.resolve<unknown>(undefined)
            ));
    }
    return workerPipelineUIAdapterGlobalsPromise;
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

function mergeWithDefaultShape(defaultValue: unknown, overrideValue: unknown): unknown {
    return MatchAuthority.mergeWithDefaultShape(defaultValue, overrideValue);
}

function createWorkerTurnStartSeed(room: MatchWorkerRoomState | null | undefined, snapshot: unknown, playerKey: unknown): number {
    return MatchAuthority.createTurnStartSeed(room, snapshot, playerKey);
}

function createWorkerTurnStartPrng(room: MatchWorkerRoomState | null | undefined, snapshot: unknown, playerKey: unknown, SeededPRNG: MatchWorkerSeededPrngModule): MatchWorkerPrng {
    const snapshotRecord = asRecord(snapshot);
    const cardStateRecord = asRecord(snapshotRecord.cardState);
    const savedState = cardStateRecord.prngState;
    const savedStateRecord = asRecord(savedState);
    if (
        savedState
        && typeof savedState === 'object'
        && Number.isFinite(Number(savedStateRecord.seed))
        && Number.isFinite(Number(savedStateRecord.calls))
        && typeof SeededPRNG.fromState === 'function'
    ) {
        try {
            return SeededPRNG.fromState({
                seed: Math.trunc(Number(savedStateRecord.seed)),
                calls: Math.max(0, Math.trunc(Number(savedStateRecord.calls)))
            });
        } catch (e) {
            // Fall through to derived seed when the serialized state is unusable.
        }
    }
    return SeededPRNG.createPRNG(createWorkerTurnStartSeed(room, snapshot, playerKey));
}

function normalizeCardStateForWorkerTurnStart(
    room: MatchWorkerRoomState | null | undefined,
    snapshot: unknown,
    CardLogic: MatchWorkerCardLogicModule,
    SeededPRNG: MatchWorkerSeededPrngModule
): Record<string, unknown> | null {
    if (!snapshot || typeof snapshot !== 'object') return null;
    const snapshotRecord = snapshot as Record<string, unknown>;
    const currentCardState = (snapshotRecord.cardState && typeof snapshotRecord.cardState === 'object')
        ? snapshotRecord.cardState
        : {};
    const currentPlayerKey = getCurrentPlayerKey(snapshotRecord.gameState);
    const baselinePrng = SeededPRNG.createPRNG(createWorkerTurnStartSeed(room, snapshot, currentPlayerKey));
    const baselineCardState = CardLogic.createCardState(baselinePrng, buildInitialDeckSnapshotOptions(room));
    snapshotRecord.cardState = mergeWithDefaultShape(baselineCardState, currentCardState);
    const normalizedCardState = asRecord(snapshotRecord.cardState);
    if (!Array.isArray(normalizedCardState.presentationEvents)) {
        normalizedCardState.presentationEvents = [];
    }
    if (!Array.isArray(normalizedCardState._presentationEventsPersist)) {
        normalizedCardState._presentationEventsPersist = [];
    }
    return normalizedCardState;
}

function persistTurnStartPrngState(cardState: Record<string, unknown> | null | undefined, prng: MatchWorkerPrng | null | undefined): void {
    if (!cardState || !prng || typeof prng.getState !== 'function') return;
    cardState.prngState = prng.getState();
}

function createCommandActionPrng(room: MatchWorkerRoomState | null | undefined, snapshot: unknown, SeededPRNG: MatchWorkerSeededPrngModule): MatchWorkerPrng {
    const snapshotRecord = asRecord(snapshot);
    const cardStateRecord = asRecord(snapshotRecord.cardState);
    const savedState = cardStateRecord.prngState;
    const savedStateRecord = asRecord(savedState);
    if (
        savedState
        && typeof savedState === 'object'
        && Number.isFinite(Number(savedStateRecord.seed))
        && Number.isFinite(Number(savedStateRecord.calls))
        && typeof SeededPRNG.fromState === 'function'
    ) {
        try {
            return SeededPRNG.fromState({
                seed: Math.trunc(Number(savedStateRecord.seed)),
                calls: Math.max(0, Math.trunc(Number(savedStateRecord.calls)))
            });
        } catch (e) {
            // Fall through to derived seed.
        }
    }
    return SeededPRNG.createPRNG(createWorkerTurnStartSeed(room, snapshot, getCurrentPlayerKey(snapshotRecord.gameState)));
}

function asPlaybackAdapter(value: unknown): MatchWorkerPlaybackAdapter | null {
    return value && typeof asRecord(value).mapToPlaybackEvents === 'function'
        ? value as MatchWorkerPlaybackAdapter
        : null;
}

function asWorkerSnapshot(value: unknown): MatchWorkerPublicSnapshot {
    return value && typeof value === 'object' ? value as MatchWorkerPublicSnapshot : {};
}

function collectServerPlaybackEvents(snapshot: unknown, rawEvents: unknown, playbackAdapter: unknown): MatchWorkerPlaybackAssembly {
    const snapshotRecord = asWorkerSnapshot(snapshot);
    const playerKey = getCurrentPlayerKey(snapshotRecord.gameState);
    const PlaybackEventHelpers = getPlaybackEventHelpersModule();
    const collectPlaybackEvents = PlaybackEventHelpers.collectServerPlaybackEvents as ((options: unknown) => MatchWorkerPlaybackAssembly);
    const assembly = collectPlaybackEvents({
        rawEvents,
        snapshot,
        playerKey,
        fallbackPlayerKey: playerKey,
        adapter: asPlaybackAdapter(playbackAdapter),
        normalizePlayerKey
    });
    return Object.assign({}, assembly || {}, {
        playbackEvents: Array.isArray(assembly && assembly.playbackEvents) ? assembly.playbackEvents : [],
        diagnostics: assembly ? assembly.diagnostics || null : null,
        presentationEvents: Array.isArray(assembly && assembly.presentationEvents) ? assembly.presentationEvents : [],
        playerKey
    });
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
    if (options.previousSnapshotForChargeDelta) {
        MatchAuthority.restoreMissingChargeDeltaEvents(options.previousSnapshotForChargeDelta, snapshot);
    }
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

function captureTurnStartHandState(snapshot: unknown): MatchWorkerTurnStartHandState {
    const snapshotRecord = asWorkerSnapshot(snapshot);
    const cardStateRecord = asRecord(snapshotRecord.cardState);
    const playerKey = getCurrentPlayerKey(snapshotRecord.gameState);
    const hands = (cardStateRecord.hands && typeof cardStateRecord.hands === 'object')
        ? asRecord(cardStateRecord.hands)
        : {};
    return {
        playerKey,
        hand: playerKey && Array.isArray(hands[playerKey]) ? hands[playerKey].slice() : []
    };
}

function appendTurnStartDrawPlaybackEvents(
    playbackAssembly: MatchWorkerPlaybackAssembly | unknown[] | unknown,
    snapshot: unknown,
    handState: MatchWorkerTurnStartHandState,
    playbackAdapter: unknown
): MatchWorkerPlaybackAssembly {
    const PlaybackEventHelpers = getPlaybackEventHelpersModule();
    const appendDrawPlaybackEvents = PlaybackEventHelpers.appendTurnStartDrawPlaybackEvents as ((options: unknown) => MatchWorkerPlaybackAssembly);
    return appendDrawPlaybackEvents({
        playbackAssembly,
        snapshot,
        handState,
        adapter: asPlaybackAdapter(playbackAdapter),
        normalizePlayerKey
    });
}

function isHiddenHandTokenForSeat(value: unknown, seatKey: MatchAuthoritySeatKey): boolean {
    const parsed = MatchAuthority.parseHiddenHandToken(value);
    return !!(parsed && parsed.ownerKey === seatKey);
}

async function repairNetworkDebugProjectedHandForCardUse(
    room: MatchWorkerRoomState | null | undefined,
    cardStateValue: Record<string, unknown>,
    playerKey: MatchAuthoritySeatKey,
    actionValue: unknown
): Promise<boolean> {
    if (!toPublicNetworkDebugEnabled(room)) return false;
    const action = asRecord(actionValue);
    if (String(action.type || '').toLowerCase() !== 'use_card') return false;
    const debugOptions = asRecord(action.debugOptions);
    if (debugOptions.noConsume !== true || debugOptions.ignoreCost !== true) return false;

    const cardId = typeof action.useCardId === 'string' ? String(action.useCardId).trim() : '';
    if (!cardId) return false;
    const ownerKey = normalizePlayerKey(action.useCardOwnerKey || playerKey);
    if (ownerKey !== playerKey) return false;

    const hands = asRecord(cardStateValue.hands);
    const hand = Array.isArray(hands[ownerKey]) ? hands[ownerKey] as unknown[] : [];
    if (hand.includes(cardId)) return false;
    if (!hand.some((entry) => isHiddenHandTokenForSeat(entry, ownerKey))) return false;

    const DebugActions = await loadDebugActionsModule();
    if (!DebugActions || typeof DebugActions.fillDebugHand !== 'function') return false;
    const chargeByPlayer = asRecord(cardStateValue.charge);
    const charge = Number.isFinite(Number(chargeByPlayer[ownerKey]))
        ? Math.trunc(Number(chargeByPlayer[ownerKey]))
        : undefined;
    return DebugActions.fillDebugHand(cardStateValue, {
        playerKey: ownerKey,
        replaceExisting: true,
        charge
    }) === true;
}

async function reconcileTurnStartAndCollectPlayback(room: MatchWorkerRoomState | null | undefined, snapshot: unknown, playbackAdapter?: unknown): Promise<MatchWorkerPlaybackAssembly> {
    const handState = captureTurnStartHandState(snapshot);
    MatchAuthority.stripTransientPresentationState(snapshot);
    const rawEvents = await reconcileTurnStartIfNeeded(room, snapshot, { includeRawEvents: true });
    const modules = asPlaybackAdapter(playbackAdapter)
        ? { TurnPipelineUIAdapter: playbackAdapter as MatchWorkerPlaybackAdapter }
        : await loadTurnPipelineModules();
    const adapter = modules && modules.TurnPipelineUIAdapter ? asPlaybackAdapter(modules.TurnPipelineUIAdapter) : null;
    const playbackAssembly = collectServerPlaybackEvents(snapshot, rawEvents, adapter);
    const snapshotRecord = asWorkerSnapshot(snapshot);
    const effectLogs = MatchAuthority.collectPipelineEffectLogMessages(
        rawEvents,
        playbackAssembly && Array.isArray(playbackAssembly.presentationEvents) ? playbackAssembly.presentationEvents : [],
        playbackAssembly && playbackAssembly.playerKey ? playbackAssembly.playerKey : getCurrentPlayerKey(snapshotRecord.gameState),
        adapter as { mapEffectLogsFromPipeline?: (rawEvents: unknown, presentationEvents: unknown, playerKey: unknown) => unknown } | null
    );
    return appendTurnStartDrawPlaybackEvents(
        Object.assign({}, playbackAssembly, { effectLogs }),
        snapshot,
        handState,
        adapter
    );
}

async function applyCommandPublishToSnapshot(
    room: MatchWorkerRoomState | null | undefined,
    body: Record<string, unknown>,
    playerKey: MatchAuthoritySeatKey
): Promise<Record<string, unknown>> {
    const NetworkActionSchema = getNetworkActionSchemaModule();
    if (!NetworkActionSchema || typeof NetworkActionSchema.buildAction !== 'function') {
        return { ok: false, rejectedReason: 'COMMAND_SCHEMA_UNAVAILABLE' };
    }

    const roomSnapshot = asWorkerSnapshot(room && room.snapshot);
    const currentSnapshot = (roomSnapshot.gameState && roomSnapshot.cardState)
        ? deepClone(roomSnapshot) as MatchWorkerPublicSnapshot
        : null;
    if (!currentSnapshot) {
        return { ok: false, rejectedReason: 'INVALID_SNAPSHOT' };
    }
    const currentCardState = asRecord(currentSnapshot.cardState);
    MatchAuthority.stripTransientChargeDeltaState(currentSnapshot);

    if (isNetworkDebugFillHandPayload(body)) {
        if (!toPublicNetworkDebugEnabled(room)) {
            return { ok: false, rejectedReason: 'NETWORK_DEBUG_DISABLED' };
        }
        const DebugActions = await loadDebugActionsModule();
        if (!DebugActions || typeof DebugActions.fillDebugHand !== 'function') {
            return { ok: false, rejectedReason: 'DEBUG_ACTIONS_UNAVAILABLE' };
        }

        const applied = DebugActions.fillDebugHand(
            currentCardState,
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
            effectLogs: [],
            action: { type: NETWORK_DEBUG_FILL_HAND_ACTION, playerKey }
        };
    }

    const preparedCommand = prepareMatchCommandAction({
        snapshot: asRecord(currentSnapshot),
        body,
        playerKey,
        buildAction: (input, fallbackActor, fallbackTurnIndex) => (
            NetworkActionSchema.buildAction as (
                input: Record<string, unknown>,
                fallbackActor: unknown,
                fallbackTurnIndex: unknown
            ) => { actor?: unknown; action?: unknown } | null
        )(input, fallbackActor, fallbackTurnIndex),
        normalizePlayerKey,
        validatePendingSelectionPublish: MatchAuthority.validatePendingSelectionPublish,
        sanitizePendingSelectionActionForAuthority: MatchAuthority.sanitizePendingSelectionActionForAuthority
    });
    if (preparedCommand.ok !== true) {
        return preparedCommand;
    }
    const currentTurnIndex = preparedCommand.currentTurnIndex;
    const resolvedAction = preparedCommand.resolvedAction;
    const pendingValidation = preparedCommand.pendingValidation;
    await repairNetworkDebugProjectedHandForCardUse(room, currentCardState, playerKey, resolvedAction);

    const { TurnPipeline, SeededPRNG, TurnPipelineUIAdapter, CardLogic } = await loadTurnPipelineModules();
    if (!TurnPipeline || typeof TurnPipeline.applyTurnSafe !== 'function') {
        return { ok: false, rejectedReason: 'COMMAND_PIPELINE_UNAVAILABLE' };
    }

    const prng = createCommandActionPrng(room, currentSnapshot, SeededPRNG);
    const SubPlacementContinuation = getSubPlacementContinuationModule();
    const isSubPlacementTurnActive = (
        SubPlacementContinuation &&
        typeof SubPlacementContinuation.isSubPlacementTurnActive === 'function'
    )
        ? ((cardState: Record<string, unknown>, seatKey: string) => (
            SubPlacementContinuation.isSubPlacementTurnActive as (
                cardState: Record<string, unknown>,
                playerKey: MatchAuthoritySeatKey
            ) => unknown
        )(cardState, seatKey as MatchAuthoritySeatKey))
        : undefined;
    const skipCommandTurnStart = shouldSkipMatchCommandTurnStart({
        cardState: preparedCommand.currentCardState,
        playerKey,
        resolvedAction,
        isSubPlacementTurnActive
    });
    const result = TurnPipeline.applyTurnSafe(
        currentCardState,
        currentSnapshot.gameState,
        playerKey,
        resolvedAction,
        prng,
        {
            currentStateVersion: currentTurnIndex,
            prngState: currentCardState.prngState,
            skipTurnStart: skipCommandTurnStart
        }
    );

    if (!result || result.ok !== true) {
        return {
            ok: false,
            rejectedReason: (result && result.rejectedReason) || 'COMMAND_REJECTED',
            errorMessage: result && result.errorMessage ? String(result.errorMessage) : null,
            events: result && Array.isArray(result.events) ? result.events : []
        };
    }
    const nextSnapshot = {
        gameState: result.gameState,
        cardState: result.cardState
    };
    const PlaybackEventHelpers = getPlaybackEventHelpersModule();
    const collectActionPlaybackEvents = PlaybackEventHelpers.collectActionPlaybackEvents as ((options: unknown) => MatchWorkerPlaybackAssembly);
    const playbackAssembly = collectActionPlaybackEvents({
        result,
        rawEvents: result.events,
        snapshot: nextSnapshot,
        playerKey,
        fallbackPlayerKey: playerKey,
        adapter: asPlaybackAdapter(TurnPipelineUIAdapter),
        normalizePlayerKey
    });
    MatchAuthority.reportPlaybackAssemblyDiagnostics('worker-action', playbackAssembly && playbackAssembly.diagnostics, {
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
        CardLogic,
        result.events,
        actionPresentationEvents,
        TurnPipelineUIAdapter
    );

    const turnStartPlaybackAssembly = skipCommandTurnStart
        ? null
        : await reconcileTurnStartAndCollectPlayback(room, nextSnapshot, TurnPipelineUIAdapter);
    MatchAuthority.reportPlaybackAssemblyDiagnostics('worker-turn-start', turnStartPlaybackAssembly && turnStartPlaybackAssembly.diagnostics, {
        networkDebugEnabled: toPublicNetworkDebugEnabled(room)
    });
    const turnStartPlaybackEvents = (turnStartPlaybackAssembly && Array.isArray(turnStartPlaybackAssembly.playbackEvents))
        ? turnStartPlaybackAssembly.playbackEvents
        : [];
    const turnStartEffectLogs = (turnStartPlaybackAssembly && Array.isArray(turnStartPlaybackAssembly.effectLogs))
        ? turnStartPlaybackAssembly.effectLogs
        : [];
    const appendPlaybackEventsAfter = PlaybackEventHelpers.appendPlaybackEventsAfter as ((baseEvents: unknown[], appendedEvents: unknown[]) => unknown[]);
    const combinedPlaybackEvents = appendPlaybackEventsAfter(playbackEvents, turnStartPlaybackEvents);
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

async function reconcileTurnStartIfNeeded(room: MatchWorkerRoomState | null | undefined, snapshot: unknown, options?: MatchWorkerTurnStartOptions | null): Promise<unknown[] | unknown> {
    const opts = asRecord(options);
    const snapshotRecord = asWorkerSnapshot(snapshot);
    if (!snapshotRecord.gameState || !snapshotRecord.cardState) return opts.includeRawEvents ? [] : snapshot;

    const cardStateRecord = asRecord(snapshotRecord.cardState);
    const currentPlayerKey = getCurrentPlayerKey(snapshotRecord.gameState);
    const lastTurnStartedFor = parseSeatKeyOptional(cardStateRecord.lastTurnStartedFor);
    if (lastTurnStartedFor === currentPlayerKey) {
        return opts.includeRawEvents ? [] : snapshot;
    }

    const { Core, CardLogic, TurnPipelinePhases, SeededPRNG } = await loadTurnStartModules();
    if (Core.isGameOver(snapshotRecord.gameState)) {
        return opts.includeRawEvents ? [] : snapshot;
    }

    normalizeCardStateForWorkerTurnStart(room, snapshot, CardLogic, SeededPRNG);
    const prng = createWorkerTurnStartPrng(room, snapshot, currentPlayerKey, SeededPRNG);
    const turnStartEvents: unknown[] = [];
    TurnPipelinePhases.applyTurnStartPhase(
        CardLogic,
        Core,
        snapshotRecord.cardState,
        snapshotRecord.gameState,
        currentPlayerKey,
        turnStartEvents,
        prng
    );
    persistTurnStartPrngState(snapshotRecord.cardState, prng);
    return opts.includeRawEvents ? turnStartEvents : snapshot;
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
            black: toPublicSnapshotForViewer(room, { role: 'seat', seatKey: 'black' }),
            white: toPublicSnapshotForViewer(room, { role: 'seat', seatKey: 'white' }),
            spectator: toPublicSnapshotForViewer(room, { role: 'spectator', spectatorId: '' })
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

function normalizeDeckSizeValue(value: unknown): number | null {
    if (value === null || typeof value === 'undefined' || value === '') return null;
    return Number.isFinite(Number(value))
        ? Math.max(0, Math.trunc(Number(value)))
        : null;
}

function cloneInitialDeckSpecByPlayer(value: unknown): MatchWorkerSeatValueMap<unknown | null> {
    const source = asRecord(value);
    return {
        black: (source.black && typeof source.black === 'object') ? deepClone(source.black) : null,
        white: (source.white && typeof source.white === 'object') ? deepClone(source.white) : null
    };
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
    return {
        black: cloneCards(source.black),
        white: cloneCards(source.white)
    };
}

function createAllCardsRoomDeckMetadata(cardIdsByPlayer: MatchWorkerSeatValueMap<string[] | null>): MatchWorkerRoomDeckMetadata {
    const blackSize = Array.isArray(cardIdsByPlayer.black) ? cardIdsByPlayer.black.length : 0;
    const whiteSize = Array.isArray(cardIdsByPlayer.white) ? cardIdsByPlayer.white.length : blackSize;
    return {
        mode: 'shared',
        source: 'allCards',
        deckCode: '',
        deckSize: blackSize,
        deckCodeByPlayer: { black: '', white: '' },
        deckSizeByPlayer: { black: blackSize, white: whiteSize }
    };
}

function isAllCardsDeckRoom(room: MatchWorkerRoomState | null | undefined): boolean {
    return !!(
        room
        && (room.allCardsDeckEnabled === true
            || (room.roomDeck && String(asRecord(room.roomDeck).source || '').trim() === 'allCards'))
    );
}

function normalizeRoomDeckMetadata(value: unknown): MatchWorkerRoomDeckMetadata | null {
    const source = (value && typeof value === 'object') ? asRecord(value) : null;
    if (!source) return null;

    const mode = String(source.mode || '').trim();
    const sharedDeckCode = String(source.deckCode || '').trim();
    const sharedDeckSize = normalizeDeckSizeValue(source.deckSize);
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
            ? normalizeDeckSizeValue(deckSizeByPlayerSource.black)
            : (mode === 'shared' ? sharedDeckSize : null),
        white: deckSizeByPlayerSource
            ? normalizeDeckSizeValue(deckSizeByPlayerSource.white)
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

function hasRoomDeckMetadataEntries(value: unknown): boolean {
    const metadata = normalizeRoomDeckMetadata(value);
    if (!metadata) return false;

    return !!(
        metadata.deckCode ||
        metadata.deckSize !== null ||
        metadata.deckCodeByPlayer.black ||
        metadata.deckCodeByPlayer.white ||
        metadata.deckSizeByPlayer.black !== null ||
        metadata.deckSizeByPlayer.white !== null
    );
}

function buildInitialDeckSnapshotOptions(value: unknown): Record<string, unknown> {
    const source = asRecord(value);
    const options: Record<string, unknown> = {};
    const initialDeckCardIdsByPlayer = cloneInitialDeckCardIdsByPlayer(source.initialDeckCardIdsByPlayer);
    if (initialDeckCardIdsByPlayer.black || initialDeckCardIdsByPlayer.white) {
        options.initialDeckCardIdsByPlayer = initialDeckCardIdsByPlayer;
    }
    const initialDeckSpecByPlayer = cloneInitialDeckSpecByPlayer(source.initialDeckSpecByPlayer);
    if (initialDeckSpecByPlayer.black || initialDeckSpecByPlayer.white) {
        options.initialDeckSpecByPlayer = initialDeckSpecByPlayer;
    } else {
        const initialDeckSpec = (source.initialDeckSpec && typeof source.initialDeckSpec === 'object')
            ? deepClone(source.initialDeckSpec)
            : null;
        if (initialDeckSpec) {
            options.initialDeckSpec = initialDeckSpec;
        }
    }
    const boardConfig = MatchAuthority.resolveRoomBoardConfig(source);
    if (boardConfig) {
        options.boardConfig = boardConfig;
    }
    return options;
}

function getRoomInitialDeckSpecByPlayer(room: MatchWorkerRoomState | null | undefined): MatchWorkerSeatValueMap<unknown | null> {
    const initialDeckSpecByPlayer = cloneInitialDeckSpecByPlayer(room && room.initialDeckSpecByPlayer);
    if (initialDeckSpecByPlayer.black || initialDeckSpecByPlayer.white) {
        return initialDeckSpecByPlayer;
    }

    const sharedDeckSpec = (room && room.initialDeckSpec && typeof room.initialDeckSpec === 'object')
        ? room.initialDeckSpec
        : null;
    if (!sharedDeckSpec) {
        return { black: null, white: null };
    }

    return {
        black: deepClone(sharedDeckSpec),
        white: deepClone(sharedDeckSpec)
    };
}

function assignRoomDeckSelection(room: MatchWorkerRoomState | null | undefined, seatKey: unknown, deckSelection: MatchWorkerDeckSelection | null | undefined): boolean {
    if (!room || !deckSelection || deckSelection.ok !== true) return false;

    const normalizedSeatKey = normalizePlayerKey(seatKey);
    if (!normalizedSeatKey) return false;
    const initialDeckSpecByPlayer = getRoomInitialDeckSpecByPlayer(room);
    initialDeckSpecByPlayer[normalizedSeatKey] = deckSelection.hasCustomDeck === true
        ? deepClone(deckSelection.deckSpec)
        : null;
    room.initialDeckSpecByPlayer = (initialDeckSpecByPlayer.black || initialDeckSpecByPlayer.white)
        ? initialDeckSpecByPlayer
        : null;
    room.initialDeckSpec = null;

    const roomDeck: MatchWorkerRoomDeckMetadata = normalizeRoomDeckMetadata(room.roomDeck) || {
        mode: 'perPlayer',
        source: 'room',
        deckCode: '',
        deckSize: null,
        deckCodeByPlayer: { black: '', white: '' },
        deckSizeByPlayer: { black: null, white: null }
    };

    roomDeck.mode = 'perPlayer';
    roomDeck.source = 'room';
    roomDeck.deckCode = '';
    roomDeck.deckSize = null;
    roomDeck.deckCodeByPlayer = Object.assign({ black: '', white: '' }, roomDeck.deckCodeByPlayer || {});
    roomDeck.deckSizeByPlayer = Object.assign({ black: null, white: null }, roomDeck.deckSizeByPlayer || {});
    roomDeck.deckCodeByPlayer[normalizedSeatKey] = deckSelection.hasCustomDeck === true
        ? String(deckSelection.deckCode || '').trim()
        : '';
    roomDeck.deckSizeByPlayer[normalizedSeatKey] = deckSelection.hasCustomDeck === true
        ? normalizeDeckSizeValue(deckSelection.deckSize)
        : null;

    room.roomDeck = hasRoomDeckMetadataEntries(roomDeck) ? roomDeck : null;
    return true;
}

function toPublicRoomDeck(room: MatchWorkerRoomState | null | undefined): Record<string, unknown> | null {
    const metadata = normalizeRoomDeckMetadata(room && room.roomDeck);
    const snapshot = asWorkerSnapshot(room && room.snapshot);
    const cardState = asRecord(snapshot.cardState);
    const initialDeckSizeByPlayer = asRecord(cardState.initialDeckSizeByPlayer);
    const snapshotDeckSizes = {
        black: normalizeDeckSizeValue(
            initialDeckSizeByPlayer.black
        ),
        white: normalizeDeckSizeValue(
            initialDeckSizeByPlayer.white
        )
    };
    const snapshotDeckSize = snapshotDeckSizes.black !== null
        ? snapshotDeckSizes.black
        : normalizeDeckSizeValue(cardState.initialDeckSize);

    if (metadata && metadata.mode === 'perPlayer') {
        const deckCodeByPlayer = {
            black: String(metadata.deckCodeByPlayer.black || '').trim(),
            white: String(metadata.deckCodeByPlayer.white || '').trim()
        };
        const deckSizeByPlayer = {
            black: metadata.deckSizeByPlayer.black !== null ? metadata.deckSizeByPlayer.black : snapshotDeckSizes.black,
            white: metadata.deckSizeByPlayer.white !== null ? metadata.deckSizeByPlayer.white : snapshotDeckSizes.white
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
            source: metadata.source || 'room'
        };
    }

    if (!metadata && snapshotDeckSize === null) return null;

    return {
        mode: metadata && metadata.mode ? String(metadata.mode) : 'shared',
        deckCode: metadata && metadata.deckCode ? String(metadata.deckCode).trim() : '',
        deckSize: metadata && metadata.deckSize !== null ? metadata.deckSize : snapshotDeckSize,
        source: metadata && metadata.source ? String(metadata.source) : 'room'
    };
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
    return withPublicRatedMatchMetadata(MatchAuthority.buildSnapshotPayloadFromRoom(room, {
        viewerRole,
        snapshot: toPublicSnapshotForViewer(room, viewer),
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
            roomDeck: createAllCardsRoomDeckMetadata(initialDeckCardIdsByPlayer)
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

function normalizeRatedBoardOwner(value: unknown): 'black' | 'white' | null {
    if (value === 1 || value === '1') return 'black';
    if (value === -1 || value === '-1') return 'white';
    const normalized = String(value || '').trim().toLowerCase();
    if (normalized === 'black' || normalized === 'b') return 'black';
    if (normalized === 'white' || normalized === 'w') return 'white';
    return null;
}

function resolveRatedResultFromSnapshot(snapshotValue: unknown): 'BLACK_WIN' | 'WHITE_WIN' | 'DRAW' | null {
    const snapshot = asRecord(snapshotValue);
    const gameState = asRecord(snapshot.gameState || snapshot);
    const board = Array.isArray(gameState.board) ? gameState.board : [];
    if (!board.length) return null;
    let black = 0;
    let white = 0;
    for (const row of board) {
        if (!Array.isArray(row)) continue;
        for (const cell of row) {
            const owner = normalizeRatedBoardOwner(cell);
            if (owner === 'black') black += 1;
            if (owner === 'white') white += 1;
        }
    }
    if (black > white) return 'BLACK_WIN';
    if (white > black) return 'WHITE_WIN';
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
                writeTimeoutMs: SSE_WRITE_TIMEOUT_MS
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
                asRecord,
                parseSeatKeyOptional,
                resolveTurnSeatKey,
                refreshTurnTimer: (options) => this.refreshTurnTimer(options),
                saveRoom: () => this.saveRoom(),
                loadCoreLogicModule,
                applyTimeoutPassToSnapshot,
                deepClone,
                stripTransientPresentationState: MatchAuthority.stripTransientPresentationState,
                reconcileTurnStartAndCollectPlayback,
                reportPlaybackAssemblyDiagnostics: MatchAuthority.reportPlaybackAssemblyDiagnostics,
                toPublicNetworkDebugEnabled,
                toDebugPlaybackDiagnostics: MatchAuthority.toDebugPlaybackDiagnostics,
                computeAuthoritativeStateHash: MatchAuthority.computeAuthoritativeStateHash,
                appendAuthorityLog: MatchAuthority.appendAuthorityLog,
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
                includePreviousSnapshotForChargeDelta: true,
                makeInitialSnapshot,
                buildInitialDeckSnapshotOptions,
                applyCommandPublishToSnapshot,
                isSnapshotGameOver: (snapshot: MatchWorkerPublicSnapshot | null | undefined) => this.isSnapshotGameOver(snapshot),
                finalizeRatedMatchAfterAcceptedPublish: async () => {
                    const result = await this.resolveRatedNormalResult();
                    if (result) await this.finalizeRatedMatchIfNeeded(result, 'normal_end');
                },
                refreshTurnTimer: (options: MatchWorkerTurnTimerOptions | null | undefined) => this.refreshTurnTimer(options),
                prepareSnapshotBroadcast: (meta: MatchWorkerSnapshotPayloadMeta | null | undefined) => this.prepareSnapshotBroadcast(meta),
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

    async loadRoom(): Promise<void> {
        if (this.roomLoaded) return;
        this.room = await this.state.storage.get(ROOM_STORAGE_KEY) as MatchWorkerRoomState | null || null;
        if (this.room && !Number.isFinite(Number(this.room.createdAt))) {
            this.room.createdAt = Number.isFinite(Number(this.room.updatedAt)) ? Number(this.room.updatedAt) : Date.now();
        }
        if (this.room && !Array.isArray(this.room.sseEventBuffer)) {
            this.room.sseEventBuffer = [];
        }
        if (this.room && !Array.isArray(this.room.authorityLog)) {
            this.room.authorityLog = [];
        }
        if (this.room && typeof this.room.authoritativeStateHash === 'undefined') {
            this.room.authoritativeStateHash = MatchAuthority.computeAuthoritativeStateHash(this.room.snapshot);
        }
        this.sseEventBuffer = this.room && Array.isArray(this.room.sseEventBuffer)
            ? this.room.sseEventBuffer.slice()
            : [];
        this.roomLoaded = true;
    }

    async saveRoom(): Promise<void> {
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
        await this.loadRoom();
        const room = this.room;

        if (!room) {
            return jsonResponse(404, { ok: false, reason: 'ROOM_NOT_FOUND' });
        }
        if (await this.expireRoomIfNeeded(Date.now())) {
            return jsonResponse(404, { ok: false, reason: 'ROOM_NOT_FOUND' });
        }

        const requestedSeatKey = parseSeatKeyOptional(body.seatKey);
        const seatToken = String(body.seatToken || '').trim();
        const seatKey = resolveAuthenticatedSeatKey(room, requestedSeatKey, seatToken);
        if (!seatKey) {
            return jsonResponse(403, { ok: false, reason: classifySeatTokenRejectionReason(seatToken) });
        }
        if (!asRecord(room.seats)[seatKey]) {
            return jsonResponse(409, { ok: false, reason: 'SEAT_NOT_JOINED' });
        }

        const selectedHandSkinId = normalizeSeatHandSkinId(body.selectedHandSkinId);
        room.seatHandSkins = toPublicSeatHandSkins(room);
        const previousSkinId = room.seatHandSkins[seatKey] || '';
        room.seatHandSkins[seatKey] = selectedHandSkinId;
        room.updatedAt = Date.now();
        await this.saveRoom();

        if (previousSkinId !== selectedHandSkinId) {
            await this.broadcastPresence({
                type: 'hand_skin',
                seatKey,
                rejoined: false
            });
        }

        const serverTime = Date.now();
        return jsonResponse(200, MatchAuthority.buildRoomPayloadFromRoom(room, {
            ok: true,
            seatKey,
            selectedHandSkinId,
            roomDeck: toPublicRoomDeck(room),
            roomBoardConfig: toPublicRoomBoardConfig(room),
            networkDebugEnabled: toPublicNetworkDebugEnabled(room),
            networkAutoEnabled: toPublicNetworkAutoEnabled(room),
            turnTimer: toPublicTurnTimer(room, serverTime),
            serverTime
        }));
    }

    async handleDeck(body: Record<string, unknown>): Promise<Response> {
        await this.loadRoom();
        const room = this.room;

        if (!room) {
            return jsonResponse(404, { ok: false, reason: 'ROOM_NOT_FOUND' });
        }
        if (await this.expireRoomIfNeeded(Date.now())) {
            return jsonResponse(404, { ok: false, reason: 'ROOM_NOT_FOUND' });
        }

        const requestedSeatKey = parseSeatKeyOptional(body.seatKey);
        const seatToken = String(body.seatToken || '').trim();
        const seatKey = resolveAuthenticatedSeatKey(room, requestedSeatKey, seatToken);
        if (!seatKey) {
            return jsonResponse(403, { ok: false, reason: classifySeatTokenRejectionReason(seatToken) });
        }
        if (!asRecord(room.seats)[seatKey]) {
            return jsonResponse(409, { ok: false, reason: 'SEAT_NOT_JOINED' });
        }

        if (isAllCardsDeckRoom(room)) {
            const serverTime = Date.now();
            return jsonResponse(200, MatchAuthority.buildRoomPayloadFromRoom(room, {
                ok: true,
                seatKey,
                roomDeck: toPublicRoomDeck(room),
                roomBoardConfig: toPublicRoomBoardConfig(room),
                networkDebugEnabled: toPublicNetworkDebugEnabled(room),
                networkAutoEnabled: toPublicNetworkAutoEnabled(room),
                turnTimer: toPublicTurnTimer(room, serverTime),
                serverTime
            }));
        }

        const deckSelection = await resolveDeckSelection(body.deckCode);
        if (!deckSelection.ok) {
            return jsonResponse(400, {
                ok: false,
                reason: deckSelection.reason || 'DECK_CODE_INVALID'
            });
        }

        const previousRoomDeckJson = JSON.stringify(toPublicRoomDeck(room) || null);
        assignRoomDeckSelection(room, seatKey, deckSelection);
        const nextRoomDeck = toPublicRoomDeck(room);
        room.updatedAt = Date.now();
        await this.saveRoom();

        if (previousRoomDeckJson !== JSON.stringify(nextRoomDeck || null)) {
            await this.broadcastPresence({
                type: 'deck',
                seatKey,
                rejoined: false
            });
        }

        const serverTime = Date.now();
        return jsonResponse(200, MatchAuthority.buildRoomPayloadFromRoom(room, {
            ok: true,
            seatKey,
            roomDeck: nextRoomDeck,
            roomBoardConfig: toPublicRoomBoardConfig(room),
            networkDebugEnabled: toPublicNetworkDebugEnabled(room),
            networkAutoEnabled: toPublicNetworkAutoEnabled(room),
            turnTimer: toPublicTurnTimer(room, serverTime),
            serverTime
        }));
    }

    async handlePublish(body: Record<string, unknown>): Promise<Response> {
        await this.loadRoom();
        if (await this.expireRoomIfNeeded(Date.now())) {
            return jsonResponse(404, { ok: false, rejectedReason: 'ROOM_NOT_FOUND' });
        }
        return this.getPublishController().handlePublish(body);
    }

    async handleRematchRequest(body: Record<string, unknown>): Promise<Response> {
        await this.loadRoom();
        const room = this.room;
        if (!room) {
            return jsonResponse(404, { ok: false, reason: 'ROOM_NOT_FOUND' });
        }
        if (await this.expireRoomIfNeeded(Date.now())) {
            return jsonResponse(404, { ok: false, reason: 'ROOM_NOT_FOUND' });
        }

        const requestedSeatKey = parseSeatKeyOptional(body.seatKey);
        const seatToken = String(body.seatToken || '').trim();
        const seatKey = resolveAuthenticatedSeatKey(room, requestedSeatKey, seatToken);
        if (!seatKey) {
            return jsonResponse(403, { ok: false, reason: classifySeatTokenRejectionReason(seatToken) });
        }
        if (!asRecord(room.seats)[seatKey]) {
            return jsonResponse(409, { ok: false, reason: 'SEAT_NOT_JOINED' });
        }
        if (!asRecord(room.seats).black || !asRecord(room.seats).white) {
            return jsonResponse(409, { ok: false, reason: 'OPPONENT_REQUIRED' });
        }

        const requestId = makeRematchRequestId();
        await this.broadcastPresence({
            type: 'rematch_request',
            seatKey,
            requestId,
            rejoined: false
        });

        const serverTime = Date.now();
        return jsonResponse(200, MatchAuthority.buildRoomPayloadFromRoom(room, {
            ok: true,
            seatKey,
            requestId,
            roomDeck: toPublicRoomDeck(room),
            roomBoardConfig: toPublicRoomBoardConfig(room),
            networkDebugEnabled: toPublicNetworkDebugEnabled(room),
            networkAutoEnabled: toPublicNetworkAutoEnabled(room),
            turnTimer: toPublicTurnTimer(room, serverTime),
            serverTime
        }));
    }

    async handleRematchResponse(body: Record<string, unknown>): Promise<Response> {
        await this.loadRoom();
        const room = this.room;
        if (!room) {
            return jsonResponse(404, { ok: false, reason: 'ROOM_NOT_FOUND' });
        }
        if (await this.expireRoomIfNeeded(Date.now())) {
            return jsonResponse(404, { ok: false, reason: 'ROOM_NOT_FOUND' });
        }

        const requestedSeatKey = parseSeatKeyOptional(body.seatKey);
        const seatToken = String(body.seatToken || '').trim();
        const seatKey = resolveAuthenticatedSeatKey(room, requestedSeatKey, seatToken);
        if (!seatKey) {
            return jsonResponse(403, { ok: false, reason: classifySeatTokenRejectionReason(seatToken) });
        }
        if (!asRecord(room.seats)[seatKey]) {
            return jsonResponse(409, { ok: false, reason: 'SEAT_NOT_JOINED' });
        }

        const requestId = String(body.requestId || '').trim();
        const accepted = body.accepted === true;
        await this.broadcastPresence({
            type: 'rematch_response',
            seatKey,
            requestId,
            accepted,
            rejoined: false
        });

        const serverTime = Date.now();
        return jsonResponse(200, MatchAuthority.buildRoomPayloadFromRoom(room, {
            ok: true,
            seatKey,
            requestId,
            accepted,
            roomDeck: toPublicRoomDeck(room),
            roomBoardConfig: toPublicRoomBoardConfig(room),
            networkDebugEnabled: toPublicNetworkDebugEnabled(room),
            networkAutoEnabled: toPublicNetworkAutoEnabled(room),
            turnTimer: toPublicTurnTimer(room, serverTime),
            serverTime
        }));
    }

    async handleState(urlObj: URL): Promise<Response> {
        await this.loadRoom();
        const room = this.room;
        if (!room) {
            return jsonResponse(404, { ok: false, reason: 'ROOM_NOT_FOUND' });
        }
        if (await this.expireRoomIfNeeded(Date.now())) {
            return jsonResponse(404, { ok: false, reason: 'ROOM_NOT_FOUND' });
        }

        await this.applyExpiredTurnTimeoutIfNeeded();

        const seatKey = parseSeatKeyOptional(urlObj && urlObj.searchParams ? urlObj.searchParams.get('seatKey') : null);
        const seatToken = String(urlObj && urlObj.searchParams ? (urlObj.searchParams.get('seatToken') || '') : '').trim();
        const viewer = resolveAuthenticatedViewer(room, {
            viewerRole: urlObj.searchParams.get('viewerRole') || '',
            seatKey,
            seatToken,
            spectatorId: urlObj.searchParams.get('spectatorId') || '',
            spectatorToken: urlObj.searchParams.get('spectatorToken') || '',
            now: Date.now()
        });
        if (!viewer) {
            return jsonResponse(403, { ok: false, reason: classifyViewerTokenRejectionReason(urlObj.searchParams) });
        }

        const serverTime = Date.now();
        const recoveredPayload = MatchAuthority.getBufferedSnapshotPayloadForStateVersion(
            room.sseEventBuffer,
            room.stateVersion,
            viewer
        );
        const recoveredMeta = asRecord(recoveredPayload);

        return jsonResponse(200, withPublicRatedMatchMetadata(MatchAuthority.buildRoomPayloadFromRoom(room, {
            ok: true,
            stateVersion: room.stateVersion,
            viewerRole: viewer.role,
            roomDeck: toPublicRoomDeck(room),
            roomBoardConfig: toPublicRoomBoardConfig(room),
            networkDebugEnabled: toPublicNetworkDebugEnabled(room),
            networkAutoEnabled: toPublicNetworkAutoEnabled(room),
            snapshot: toPublicSnapshotForViewer(room, viewer),
            turnTimer: toPublicTurnTimer(room, serverTime),
            playbackEvents: Array.isArray(recoveredMeta.playbackEvents) ? recoveredMeta.playbackEvents : [],
            effectLogs: MatchAuthority.normalizeEffectLogMessages(recoveredMeta.effectLogs),
            playbackDiagnostics: MatchAuthority.toDebugPlaybackDiagnostics(recoveredMeta.playbackDiagnostics, toPublicNetworkDebugEnabled(room)),
            presentationCursor: buildPresentationCursor(room),
            presentationFrames: Array.isArray(recoveredMeta.presentationFrames) ? recoveredMeta.presentationFrames : [],
            operationId: recoveredMeta.operationId ? String(recoveredMeta.operationId) : null,
            playerKey: recoveredMeta.playerKey ? normalizePlayerKey(recoveredMeta.playerKey) : null,
            actionType: recoveredMeta.actionType ? String(recoveredMeta.actionType) : null,
            serverTime
        }), room));
    }

    async handlePresentationJournal(request: Request): Promise<Response> {
        await this.loadRoom();
        const urlObj = new URL(request.url);
        const room = this.room;
        if (!room) {
            return jsonResponse(404, { ok: false, reason: 'ROOM_NOT_FOUND' });
        }
        if (await this.expireRoomIfNeeded(Date.now())) {
            return jsonResponse(404, { ok: false, reason: 'ROOM_NOT_FOUND' });
        }

        const seatKey = parseSeatKeyOptional(urlObj.searchParams.get('seatKey'));
        const seatToken = String(urlObj.searchParams.get('seatToken') || '').trim();
        const viewer = resolveAuthenticatedViewer(room, {
            viewerRole: urlObj.searchParams.get('viewerRole') || '',
            seatKey,
            seatToken,
            spectatorId: urlObj.searchParams.get('spectatorId') || '',
            spectatorToken: urlObj.searchParams.get('spectatorToken') || '',
            now: Date.now()
        });
        if (!viewer) {
            return jsonResponse(403, { ok: false, reason: classifyViewerTokenRejectionReason(urlObj.searchParams) });
        }

        const payload = MatchAuthority.buildPresentationJournalResponse(room, {
            afterVisualSeq: urlObj.searchParams.get('afterVisualSeq') || 0,
            viewer,
            serverTime: Date.now()
        });
        return jsonResponse(payload.ok === false ? 409 : 200, payload);
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
            const parsed = parseJsonBody(await request.text());
            if (parsed === null) return jsonResponse(400, { ok: false, reason: 'INVALID_JSON' });
            return this.handleLeaderboardSubmit(parsed || {});
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
