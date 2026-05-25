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
    MatchWorkerLeaderboardEntry,
    MatchWorkerLeaderboardMode,
    MatchWorkerLeaderboardStore,
    MatchWorkerPlaybackAdapter,
    MatchWorkerPlaybackAssembly,
    MatchWorkerPlaybackDiagnostics,
    MatchWorkerParsedChatMessage,
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
    MatchWorkerTurnPipelineSafeResult,
    MatchWorkerSnapshotPayloadMeta,
    MatchWorkerTurnTimeoutResult,
    MatchWorkerTurnTimerOptions,
    MatchWorkerTurnStartOptions,
    MatchWorkerTurnStartHandState,
    MatchWorkerTurnStartModules,
    MatchWorkerRoomDeckMetadata
} from './match-worker-types';
import type {
    MatchAuthorityAcceptedOperationsBySeat,
    MatchAuthorityAcceptedOperationEntry,
    MatchAuthorityBufferedSseEventRecord,
    MatchAuthorityBufferedSseEventRecordInput,
    MatchAuthorityRoomState,
    MatchAuthoritySeatKey
} from '../utils/match-authority-types';
import type { GameState } from '../src/types';
import {
    assertMatchRoomDurableObjectConstructor,
    assertMatchWorkerEntrypoint
} from './match-worker-contract';
import deepClone from '../utils/deepClone.js';
import matchAuthority from '../utils/match-authority.js';
import networkActionSchemaModule = require('../shared/network-action-schema.js');
import playbackEventHelpersModule = require('../shared/playback-event-helpers.js');
import sharedConstantsModule from '../shared-constants.js';
import sharedBoardUtilsModule = require('../shared/shared-board-utils.js');
import deckSpecHelpersModule = require('../shared/deck-spec.js');
import deckCodecModule = require('../shared/deck-codec.js');
import playerEncodingModule = require('../shared/player-encoding.js');
import destroyOutcomeContractModule = require('../shared/destroy-outcome-contract.js');
import stoneStatusSnapshotModule = require('../shared/stone-status-snapshot.js');
import specialStoneRegistryModule = require('../shared/special-stone-registry.js');
import presentationEffectProfilesModule = require('../shared/presentation-effect-profiles.js');
import cardRandomSourceModule from '../game/logic/cards-internal/random-source.js';
import cardStateFactoryModule from '../game/logic/cards-internal/state-factory.js';
import cardModuleResolverModule from '../game/logic/cards-internal/module-resolver.js';
import cardPresentationHelpersModule from '../game/logic/cards-internal/presentation-helpers.js';
import cardHandManagerModule from '../game/logic/cards-internal/hand-manager.js';
import cardChargeLedgerModule from '../game/logic/cards-internal/charge-ledger.js';
import cardPendingStateManagerModule from '../game/logic/cards-internal/pending-state-manager.js';
import cardUsagePrechecksModule from '../game/logic/cards-internal/card-usage-prechecks.js';
import cardEffectTimingModule from '../game/logic/cards-internal/effect-timing.js';
import cardMarkersModule from '../game/logic/cards/markers.js';
import boardOpsModule from '../game/logic/board_ops.js';
import destroyOneStoneEffectsModule from '../game/logic/effects/destroy_one_stone.js';
import swapWithEnemyEffectsModule from '../game/logic/effects/swap_with_enemy.js';
import cardStateManagerModule from '../game/cards/state-manager.js';
import cardEffectResolverModule from '../game/cards/effect-resolver.js';
import cardTimingProcessorModule from '../game/cards/timing-processor.js';
import cardTargetResolverModule from '../game/cards/target-resolver.js';
import cardStatusCellsEffectsModule = require('../game/cards/effects/status-cells.js');

const MatchAuthority = matchAuthority || {};
type MatchWorkerCryptoLike = {
    getRandomValues(array: Uint8Array): Uint8Array;
};
const ROOM_STORAGE_KEY = 'match_room_state_v1';
const NetworkActionSchema = asRuntimeModule(networkActionSchemaModule);
const PlaybackEventHelpers = asRuntimeModule(playbackEventHelpersModule);
const CHAT_MAX_LENGTH = 20;
const CHAT_HISTORY_LIMIT = 40;
const NETWORK_PLAYER_NAME_MAX = Number.isFinite(Number(MatchAuthority.NETWORK_PLAYER_NAME_MAX))
    ? Number(MatchAuthority.NETWORK_PLAYER_NAME_MAX)
    : 7;
const LEADERBOARD_STORAGE_KEY = 'global_score_leaderboard_v3';
const LEADERBOARD_STORAGE_VERSION = 3;
const LEADERBOARD_ROOM_ID = '__leaderboard__';
const LEADERBOARD_PLAYER_NAME_MAX = NETWORK_PLAYER_NAME_MAX;
const LEADERBOARD_DEFAULT_LIMIT = 10;
const LEADERBOARD_MAX_LIMIT = 100;
const LEADERBOARD_MAX_STORED_PLAYERS = 200;
const LEADERBOARD_PLAYER_ID_RE = /^[A-Za-z0-9_-]{8,80}$/;
const NETWORK_TURN_LIMIT_SECONDS = 120;
const NETWORK_TURN_LIMIT_MS = NETWORK_TURN_LIMIT_SECONDS * 1000;
const SSE_HEARTBEAT_INTERVAL_MS = 10000;
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

const WORKER_PRELOAD_MODULES: Readonly<Record<string, unknown>> = Object.freeze({
    '../shared-constants.js': sharedConstantsModule,
    '../shared/shared-board-utils.js': sharedBoardUtilsModule,
    '../shared/deck-spec.js': deckSpecHelpersModule,
    '../shared/deck-codec.js': deckCodecModule,
    '../shared/player-encoding.js': playerEncodingModule,
    '../shared/destroy-outcome-contract.js': destroyOutcomeContractModule,
    '../shared/stone-status-snapshot.js': stoneStatusSnapshotModule,
    '../shared/special-stone-registry.js': specialStoneRegistryModule,
    '../shared/presentation-effect-profiles.js': presentationEffectProfilesModule,
    '../game/logic/cards-internal/random-source.js': cardRandomSourceModule,
    '../game/logic/cards-internal/state-factory.js': cardStateFactoryModule,
    '../game/logic/cards-internal/module-resolver.js': cardModuleResolverModule,
    '../game/logic/cards-internal/presentation-helpers.js': cardPresentationHelpersModule,
    '../game/logic/cards-internal/hand-manager.js': cardHandManagerModule,
    '../game/logic/cards-internal/charge-ledger.js': cardChargeLedgerModule,
    '../game/logic/cards-internal/pending-state-manager.js': cardPendingStateManagerModule,
    '../game/logic/cards-internal/card-usage-prechecks.js': cardUsagePrechecksModule,
    '../game/logic/cards-internal/effect-timing.js': cardEffectTimingModule,
    '../game/logic/cards/markers.js': cardMarkersModule,
    '../game/logic/board_ops.js': boardOpsModule,
    '../game/logic/effects/destroy_one_stone.js': destroyOneStoneEffectsModule,
    '../game/logic/effects/swap_with_enemy.js': swapWithEnemyEffectsModule,
    '../game/cards/state-manager.js': cardStateManagerModule,
    '../game/cards/effect-resolver.js': cardEffectResolverModule,
    '../game/cards/timing-processor.js': cardTimingProcessorModule,
    '../game/cards/target-resolver.js': cardTargetResolverModule,
    '../game/cards/effects/status-cells.js': cardStatusCellsEffectsModule
});

const CORS_HEADERS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
};

function asRecord(value: unknown): Record<string, unknown> {
    return value && typeof value === 'object' ? value as Record<string, unknown> : {};
}

function asRuntimeModule(value: unknown): MatchWorkerRuntimeModule {
    return value && typeof value === 'object' ? value as MatchWorkerRuntimeModule : {};
}

function resolveModuleDefault(mod: unknown): MatchWorkerRuntimeModule {
    const source = asRecord(mod);
    return asRuntimeModule(source.default || mod);
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

function classifySeatTokenRejectionReason(seatTokenValue: unknown): string {
    return MatchAuthority.classifySeatTokenRejectionReason(seatTokenValue);
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
    if (typeof MatchAuthority.makeRoomId === 'function') {
        return MatchAuthority.makeRoomId(crypto as unknown as { getRandomValues(array: Uint8Array): Uint8Array });
    }
    throw new Error('MatchAuthority.makeRoomId is required');
}

function makeSeatToken(): string {
    if (typeof MatchAuthority.makeSeatToken === 'function') {
        return MatchAuthority.makeSeatToken(crypto as unknown as { getRandomValues(array: Uint8Array): Uint8Array });
    }
    throw new Error('MatchAuthority.makeSeatToken is required');
}

function getRuntimeGlobalScope(): Record<string, unknown> | null {
    if (typeof globalThis !== 'undefined') return globalThis;
    if (typeof self !== 'undefined') return self;
    return null;
}

function setRuntimeGlobalValue(key: string, value: unknown): unknown {
    const scope = getRuntimeGlobalScope();
    if (!scope || !key) return value;
    scope[key] = value;
    return value;
}

function importWorkerGlobal(importPath: string, globalKey: string): Promise<unknown> {
    const mod = Object.prototype.hasOwnProperty.call(WORKER_PRELOAD_MODULES, importPath)
        ? WORKER_PRELOAD_MODULES[importPath]
        : null;
    if (!mod) {
        return Promise.reject(new Error(`Worker preload module missing: ${importPath}`));
    }
    const scope = getRuntimeGlobalScope();
    const modRecord = asRecord(mod);
    const runtimeValue = scope && globalKey ? scope[globalKey] : null;
    const moduleExports = modRecord['module.exports'] || null;
    const resolved = runtimeValue || moduleExports || modRecord.default || mod;
    if (globalKey && resolved) {
        setRuntimeGlobalValue(globalKey, resolved);
    }
    return Promise.resolve(resolved);
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
            ['../shared/stone-status-snapshot.js', 'StoneStatusSnapshot'],
            ['../shared/special-stone-registry.js', 'SpecialStoneRegistry'],
            ['../game/logic/cards-internal/random-source.js', 'CardRandomSource'],
            ['../game/logic/cards-internal/state-factory.js', 'CardStateFactory'],
            ['../game/logic/cards-internal/module-resolver.js', 'CardModuleResolver'],
            ['../game/logic/cards-internal/presentation-helpers.js', 'CardPresentationHelpers'],
            ['../game/logic/cards-internal/hand-manager.js', 'CardHandManager'],
            ['../game/logic/cards-internal/charge-ledger.js', 'CardChargeLedger'],
            ['../game/logic/cards-internal/pending-state-manager.js', 'CardPendingStateManager'],
            ['../game/logic/cards-internal/card-usage-prechecks.js', 'CardUsagePrechecks'],
            ['../game/logic/cards-internal/effect-timing.js', 'CardEffectTiming'],
            ['../game/logic/cards/markers.js', 'CardMarkers'],
            ['../game/logic/board_ops.js', 'BoardOps'],
            ['../game/cards/state-manager.js', 'CardStateManager'],
            ['../game/cards/effect-resolver.js', 'CardEffectResolver'],
            ['../game/cards/timing-processor.js', 'CardTimingProcessor'],
            ['../game/cards/target-resolver.js', 'CardTargetResolver']
        ];
        const optionalGlobals: Array<[string, string]> = [
            ['../game/logic/cards/utils.js', 'CardUtils'],
            ['../game/logic/cards/targets.js', 'CardTargets'],
            ['../game/logic/cards/selectors.js', 'CardSelectors'],
            ['../game/logic/cards/movement.js', 'CardMovement'],
            ['../game/logic/cards/teleport.js', 'CardTeleport'],
            ['../game/logic/cards/clone.js', 'CardClone'],
            ['../game/logic/cards/meteor.js', 'CardMeteor'],
            ['../game/logic/cards/shrink.js', 'CardShrink'],
            ['../game/logic/cards/breeding.js', 'CardBreeding'],
            ['../game/logic/cards/flips.js', 'CardFlips'],
            ['../game/logic/cards/regen.js', 'CardRegen'],
            ['../game/logic/cards/living_will.js', 'CardLivingWill'],
            ['../game/logic/cards/sniper.js', 'CardSniper'],
            ['../game/logic/cards/lightning.js', 'CardLightning'],
            ['../game/logic/cards/time_bomb.js', 'CardTimeBomb'],
            ['../game/logic/cards/udg.js', 'CardUdg'],
            ['../game/logic/cards/hyperactive.js', 'CardHyperactive'],
            ['../game/logic/cards/will_hunter_king.js', 'CardWillHunterKing'],
            ['../game/logic/effects/dragon.js', 'DragonEffects'],
            ['../game/logic/effects/destroy_one_stone.js', 'DestroyOneStoneEffects'],
            ['../game/logic/effects/swap_with_enemy.js', 'SwapWithEnemyEffects'],
            ['../game/cards/effects/status-cells.js', 'CardStatusCellsEffects'],
            ['../game/cards/effects/protect.js', 'CardProtectEffects'],
            ['../game/cards/effects/trap.js', 'CardTrapEffects'],
            ['../game/cards/effects/ownership.js', 'CardOwnershipEffects'],
            ['../game/cards/effects/board-expansion-apply.js', 'CardBoardExpansionApply'],
            ['../game/cards/effects/position-swap.js', 'CardPositionSwapEffects']
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

function normalizeWorkerTurnPipelinePlayer(Core: MatchWorkerRuntimeModule | null | undefined, player: unknown): MatchAuthoritySeatKey | null {
    const blackValue = Core && Number.isFinite(Number(Core.BLACK)) ? Number(Core.BLACK) : 1;
    const whiteValue = Core && Number.isFinite(Number(Core.WHITE)) ? Number(Core.WHITE) : -1;
    if (player === blackValue || player === 'black') return 'black';
    if (player === whiteValue || player === 'white') return 'white';
    return null;
}

function createWorkerTurnPipelineModule(
    CardLogic: MatchWorkerCardLogicModule,
    Core: MatchWorkerCoreModule,
    TurnPipelinePhases: MatchWorkerTurnPipelinePhasesModule,
    BoardOps: MatchWorkerRuntimeModule
): MatchWorkerTurnPipelineModule {
    function applyTurn(cardState: unknown, gameState: unknown, playerKey: unknown, action: unknown, prng?: unknown, options?: Record<string, unknown> | null) {
        const events: unknown[] = [];
        const p = asRecord(prng);
        const prngValue = typeof p.random === 'function' ? p : undefined;
        const opts = asRecord(options);
        const normalizedPlayerKey = normalizeWorkerTurnPipelinePlayer(Core, playerKey) || playerKey;
        const cardStateRecord = asRecord(cardState);
        const actionRecord = asRecord(action);
        const previousBoardOpsRandomSource = cardStateRecord._boardOpsRandomSource;
        if (cardState && prngValue) {
            cardStateRecord._boardOpsRandomSource = prngValue;
        }
        try {
            const applyTurnStartPhase = TurnPipelinePhases.applyTurnStartPhase;
            if (opts.skipTurnStart !== true) {
                if (typeof applyTurnStartPhase !== 'function') {
                    throw new Error('TurnPipelinePhases.applyTurnStartPhase is required');
                }
                applyTurnStartPhase(CardLogic, Core, cardState, gameState, normalizedPlayerKey, events, prngValue);
            }
            const applyCardUsagePhase = TurnPipelinePhases.applyCardUsagePhase;
            if (typeof applyCardUsagePhase !== 'function') {
                throw new Error('TurnPipelinePhases.applyCardUsagePhase is required');
            }
            applyCardUsagePhase(CardLogic, cardState, gameState, normalizedPlayerKey, action, events, prngValue);
            const actionMeta = {
                actionId: actionRecord.actionId || null,
                turnIndex: cardStateRecord.turnIndex || 0,
                plyIndex: 0,
                randomSource: prngValue || null
            };
            if (cardState && BoardOps && typeof BoardOps.setActionContext === 'function') {
                BoardOps.setActionContext(cardState, actionMeta);
            } else if (cardState) {
                cardStateRecord._currentActionMeta = actionMeta;
            }
            try {
                const applyActionPhase = TurnPipelinePhases.applyActionPhase;
                if (typeof applyActionPhase !== 'function') {
                    throw new Error('TurnPipelinePhases.applyActionPhase is required');
                }
                applyActionPhase(CardLogic, Core, cardState, gameState, normalizedPlayerKey, action, events, prngValue, BoardOps);
            } finally {
                if (cardState && BoardOps && typeof BoardOps.clearActionContext === 'function') {
                    BoardOps.clearActionContext(cardState);
                } else if (cardState) {
                    delete cardStateRecord._currentActionMeta;
                }
            }
            const presentationEvents = (typeof CardLogic.flushPresentationEvents === 'function')
                ? CardLogic.flushPresentationEvents(cardState)
                : ((cardState && Array.isArray(cardStateRecord.presentationEvents)) ? cardStateRecord.presentationEvents.slice() : []);
            return { gameState, cardState, events, presentationEvents: Array.isArray(presentationEvents) ? presentationEvents : [] };
        } finally {
            if (cardState) {
                if (previousBoardOpsRandomSource && typeof asRecord(previousBoardOpsRandomSource).random === 'function') {
                    cardStateRecord._boardOpsRandomSource = previousBoardOpsRandomSource;
                } else {
                    delete cardStateRecord._boardOpsRandomSource;
                }
            }
        }
    }

    function applyTurnSafe(cardState: unknown, gameState: unknown, playerKey: unknown, action: unknown, prng?: unknown, options?: Record<string, unknown> | null): MatchWorkerTurnPipelineSafeResult {
        const cs = deepClone(cardState) as Record<string, unknown>;
        const gs = deepClone(gameState) as Record<string, unknown>;
        const actionRecord = asRecord(action);
        const opts = asRecord(options);
        const actionPlayerKey = normalizeWorkerTurnPipelinePlayer(Core, playerKey);
        const currentPlayerKey = normalizeWorkerTurnPipelinePlayer(Core, gs.currentPlayer);
        const currentVersion = (typeof opts.currentStateVersion === 'number')
            ? opts.currentStateVersion
            : 0;
        let effectivePipelinePlayerKey = actionPlayerKey;

        if (actionPlayerKey && currentPlayerKey && actionPlayerKey !== currentPlayerKey) {
            const fateWillController = asRecord(cs.fateWillControllerByTurnOwner)[currentPlayerKey];
            if (fateWillController === actionPlayerKey) {
                effectivePipelinePlayerKey = currentPlayerKey;
            } else {
                return {
                    ok: false,
                    gameState: gs,
                    cardState: cs,
                    events: [{ type: 'action_rejected', player: playerKey, reason: 'OUT_OF_TURN', message: 'playerKey does not match gameState.currentPlayer' }],
                    nextStateVersion: currentVersion,
                    rejectedReason: 'OUT_OF_TURN'
                };
            }
        }

        if (actionRecord.actionId && Array.isArray(opts.previousActionIds) && opts.previousActionIds.includes(actionRecord.actionId)) {
            return {
                ok: false,
                gameState: gs,
                cardState: cs,
                events: [{ type: 'action_rejected', player: playerKey, reason: 'DUPLICATE_ACTION', message: 'actionId already seen' }],
                nextStateVersion: currentVersion,
                rejectedReason: 'DUPLICATE_ACTION'
            };
        }

        if (typeof actionRecord.turnIndex === 'number' && typeof opts.currentStateVersion === 'number' && actionRecord.turnIndex !== opts.currentStateVersion) {
            return {
                ok: false,
                gameState: gs,
                cardState: cs,
                events: [{ type: 'action_rejected', player: playerKey, reason: 'OUT_OF_ORDER', message: 'action.turnIndex does not match currentStateVersion' }],
                nextStateVersion: currentVersion,
                rejectedReason: 'OUT_OF_ORDER'
            };
        }

        try {
            const result = applyTurn(cs, gs, effectivePipelinePlayerKey || playerKey, action, prng, options);
            return {
                ok: true,
                gameState: result.gameState,
                cardState: result.cardState,
                events: result.events,
                presentationEvents: result.presentationEvents || [],
                nextStateVersion: currentVersion + 1,
                stateHash: null
            };
        } catch (error) {
            const errorRecord = asRecord(error);
            const rawMsg = errorRecord.message ? String(errorRecord.message) : 'unknown_error';
            let reason = 'UNKNOWN';
            if (rawMsg.includes('Illegal move')) reason = 'ILLEGAL_MOVE';
            else if (rawMsg.includes('applyCardUsage failed')) reason = 'CARD_USE_FAILED';
            else if (rawMsg.includes('requires')) reason = 'MISSING_REQUIRED_TARGET';
            else if (rawMsg.includes('Unknown action.type')) reason = 'UNKNOWN_ACTION_TYPE';
            return {
                ok: false,
                gameState: gs,
                cardState: cs,
                events: [{ type: 'action_rejected', player: playerKey, reason, message: rawMsg }],
                nextStateVersion: currentVersion,
                rejectedReason: reason,
                errorMessage: rawMsg
            };
        }
    }

    return {
        applyTurn,
        applyTurnSafe
    };
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
            import('../game/turn/turn_pipeline_phases.js').then((mod) => resolveModuleDefault(mod) as MatchWorkerTurnPipelinePhasesModule),
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
            import('../game/turn/turn_pipeline_phases.js').then((mod) => resolveModuleDefault(mod) as MatchWorkerTurnPipelinePhasesModule),
            import('../game/turn/pipeline_ui_adapter.js').then(resolveModuleDefault),
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
    const roomId = String(value || '').trim().toUpperCase();
    return roomId || '';
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

function normalizeLeaderboardPlayerId(value: unknown): string | null {
    const normalized = String(value || '').trim();
    if (!LEADERBOARD_PLAYER_ID_RE.test(normalized)) return null;
    return normalized;
}

function normalizeLeaderboardPlayerName(value: unknown): string {
    const normalized = String(value || '').replace(/\s+/g, ' ').trim();
    const clipped = Array.from(normalized).slice(0, LEADERBOARD_PLAYER_NAME_MAX).join('');
    return clipped || 'ななし';
}

function normalizeLeaderboardMode(value: unknown): MatchWorkerLeaderboardMode {
    if (value === 'network') return 'network';
    if (value === 'cpu') return 'cpu';
    return 'cpu';
}

function clampLeaderboardScore(value: unknown): number {
    const score = Number(value);
    if (!Number.isFinite(score)) return 0;
    return Math.max(0, Math.min(100000, Math.trunc(score)));
}

function normalizeLeaderboardCpuLevel(value: unknown): number | null {
    if (!Number.isFinite(Number(value))) return null;
    const level = Math.trunc(Number(value));
    return Math.max(1, Math.min(6, level));
}

function normalizeLeaderboardLimit(value: unknown): number {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return LEADERBOARD_DEFAULT_LIMIT;
    return Math.max(1, Math.min(LEADERBOARD_MAX_LIMIT, Math.trunc(parsed)));
}

function normalizeLeaderboardEntry(value: unknown, fallbackPlayerId?: unknown): MatchWorkerLeaderboardEntry | null {
    if (!value || typeof value !== 'object') return null;

    const entry = asRecord(value);
    const playerId = normalizeLeaderboardPlayerId(entry.playerId || fallbackPlayerId);
    if (!playerId) return null;

    const updatedAt = Number.isFinite(Number(entry.updatedAt))
        ? Math.max(0, Math.trunc(Number(entry.updatedAt)))
        : Date.now();
    const submittedAt = Number.isFinite(Number(entry.submittedAt))
        ? Math.max(0, Math.trunc(Number(entry.submittedAt)))
        : updatedAt;

    return {
        playerId,
        playerName: normalizeLeaderboardPlayerName(entry.playerName),
        bestScore: clampLeaderboardScore(entry.bestScore),
        lastScore: clampLeaderboardScore(entry.lastScore),
        mode: normalizeLeaderboardMode(entry.mode),
        cpuLevel: normalizeLeaderboardCpuLevel(entry.cpuLevel),
        scoreVersion: Number.isFinite(Number(entry.scoreVersion)) ? Math.max(0, Math.trunc(Number(entry.scoreVersion))) : null,
        turnCount: Number.isFinite(Number(entry.turnCount)) ? Math.max(0, Math.trunc(Number(entry.turnCount))) : null,
        updatedAt,
        submittedAt
    };
}

function isLeaderboardEntry(value: MatchWorkerLeaderboardEntry | null): value is MatchWorkerLeaderboardEntry {
    return value !== null;
}

function sortLeaderboardEntries(entries: MatchWorkerLeaderboardEntry[]): void {
    entries.sort((a, b) => {
        if (b.bestScore !== a.bestScore) return b.bestScore - a.bestScore;
        if (a.updatedAt !== b.updatedAt) return a.updatedAt - b.updatedAt;
        return String(a.playerName || '').localeCompare(String(b.playerName || ''), 'ja');
    });
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
    const networkDebugEnabled = toPublicNetworkDebugEnabled(room);
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
        payloadOptions.playbackDiagnostics = MatchAuthority.toDebugPlaybackDiagnostics(options.playbackDiagnostics, networkDebugEnabled) as MatchWorkerPlaybackDiagnostics | null;
    }
    return MatchAuthority.buildPublishPayloadFromRoom(room, payloadOptions);
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
    const appendDrawPlaybackEvents = PlaybackEventHelpers.appendTurnStartDrawPlaybackEvents as ((options: unknown) => MatchWorkerPlaybackAssembly);
    return appendDrawPlaybackEvents({
        playbackAssembly,
        snapshot,
        handState,
        adapter: asPlaybackAdapter(playbackAdapter),
        normalizePlayerKey
    });
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

    const currentTurnIndex = Number.isFinite(Number(currentCardState.turnIndex))
        ? Number(currentCardState.turnIndex)
        : 0;
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

    const { TurnPipeline, SeededPRNG, TurnPipelineUIAdapter, CardLogic } = await loadTurnPipelineModules();
    if (!TurnPipeline || typeof TurnPipeline.applyTurnSafe !== 'function') {
        return { ok: false, rejectedReason: 'COMMAND_PIPELINE_UNAVAILABLE' };
    }

    const prng = createCommandActionPrng(room, currentSnapshot, SeededPRNG);
    const result = TurnPipeline.applyTurnSafe(
        currentCardState,
        currentSnapshot.gameState,
        playerKey,
        resolvedAction,
        prng,
        {
            currentStateVersion: currentTurnIndex,
            prngState: currentCardState.prngState
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

    const turnStartPlaybackAssembly = await reconcileTurnStartAndCollectPlayback(room, nextSnapshot, TurnPipelineUIAdapter);
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
    if (typeof Core.isGameOver === 'function' && Core.isGameOver(snapshotRecord.gameState)) {
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
    return opts.includeRawEvents ? turnStartEvents : snapshot;
}

function toPublicSnapshot(room: MatchWorkerRoomState | null | undefined, viewerSeatKey: unknown): MatchWorkerPublicSnapshot {
    const viewer = parseSeatKeyOptional(viewerSeatKey);
    return MatchAuthority.buildPublicSnapshot(room, viewer) as MatchWorkerPublicSnapshot;
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

function assignRoomDeckSelection(room: MatchWorkerRoomState | null | undefined, seatKey: unknown, deckSelection: MatchWorkerDeckSelection | null | undefined): void {
    if (!room || !deckSelection || deckSelection.hasCustomDeck !== true) return;

    const normalizedSeatKey = normalizePlayerKey(seatKey);
    if (!normalizedSeatKey) return;
    const initialDeckSpecByPlayer = getRoomInitialDeckSpecByPlayer(room);
    initialDeckSpecByPlayer[normalizedSeatKey] = deepClone(deckSelection.deckSpec);
    room.initialDeckSpecByPlayer = initialDeckSpecByPlayer;
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
    roomDeck.deckCodeByPlayer[normalizedSeatKey] = String(deckSelection.deckCode || '').trim();
    roomDeck.deckSizeByPlayer[normalizedSeatKey] = normalizeDeckSizeValue(deckSelection.deckSize);

    room.roomDeck = hasRoomDeckMetadataEntries(roomDeck) ? roomDeck : null;
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
    return !!(room && room.networkDebugEnabled === true);
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
    return {
        limitSeconds: NETWORK_TURN_LIMIT_SECONDS,
        active: false,
        turnSeatKey: resolveTurnSeatKey(room),
        turnStartedAt: null,
        turnDeadlineAt: null
    };
}

function createActiveTurnTimer(room: MatchWorkerRoomState | null | undefined, nowMs: unknown): Record<string, unknown> {
    const now = Number.isFinite(Number(nowMs)) ? Math.max(0, Math.trunc(Number(nowMs))) : Date.now();
    return {
        limitSeconds: NETWORK_TURN_LIMIT_SECONDS,
        active: true,
        turnSeatKey: resolveTurnSeatKey(room),
        turnStartedAt: now,
        turnDeadlineAt: now + NETWORK_TURN_LIMIT_MS
    };
}

function areTurnTimersEqual(a: unknown, b: unknown): boolean {
    const left = asRecord(a);
    const right = asRecord(b);
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

function toPublicTurnTimer(room: MatchWorkerRoomState | null | undefined, nowMs: unknown): Record<string, unknown> {
    const timer = (room && room.turnTimer && typeof room.turnTimer === 'object') ? room.turnTimer : null;
    const timerRecord = asRecord(timer);
    const serverNow = Number.isFinite(Number(nowMs)) ? Number(nowMs) : Date.now();
    const deadline = timer && Number.isFinite(Number(timerRecord.turnDeadlineAt)) ? Number(timerRecord.turnDeadlineAt) : null;
    const startedAt = timer && Number.isFinite(Number(timerRecord.turnStartedAt)) ? Number(timerRecord.turnStartedAt) : null;
    const active = !!(timer && timerRecord.active === true && deadline !== null);

    return {
        limitSeconds: NETWORK_TURN_LIMIT_SECONDS,
        active,
        turnSeatKey: parseSeatKeyOptional(timerRecord.turnSeatKey) || resolveTurnSeatKey(room),
        turnStartedAt: active ? startedAt : null,
        turnDeadlineAt: active ? deadline : null,
        remainingMs: active && deadline !== null ? Math.max(0, Math.trunc(deadline - serverNow)) : null
    };
}

function parseChatMessageText(value: unknown): MatchWorkerParsedChatMessage {
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

function buildSnapshotPayload(room: MatchWorkerRoomState, meta: MatchWorkerSnapshotPayloadMeta | null | undefined, viewerSeatKey: unknown): Record<string, unknown> {
    const serverTime = Date.now();
    const metaRecord = asRecord(meta);
    return MatchAuthority.buildSnapshotPayloadFromRoom(room, {
        snapshot: toPublicSnapshot(room, viewerSeatKey),
        roomDeck: toPublicRoomDeck(room),
        roomBoardConfig: toPublicRoomBoardConfig(room),
        networkDebugEnabled: toPublicNetworkDebugEnabled(room),
        turnTimer: toPublicTurnTimer(room, serverTime),
        playbackEvents: Array.isArray(metaRecord.playbackEvents) ? metaRecord.playbackEvents : [],
        effectLogs: MatchAuthority.normalizeEffectLogMessages(metaRecord.effectLogs),
        playbackDiagnostics: MatchAuthority.toDebugPlaybackDiagnostics(metaRecord.playbackDiagnostics, toPublicNetworkDebugEnabled(room)),
        operationId: metaRecord.operationId ? String(metaRecord.operationId) : null,
        playerKey: metaRecord.playerKey ? normalizePlayerKey(metaRecord.playerKey) : null,
        actionType: metaRecord.actionType ? String(metaRecord.actionType) : null,
        serverTime
    });
}

function buildPresencePayload(room: MatchWorkerRoomState, meta: MatchWorkerPresencePayloadMeta | null | undefined): Record<string, unknown> {
    const serverTime = Date.now();
    const metaRecord = asRecord(meta);
    const seatKey = metaRecord.seatKey ? normalizePlayerKey(metaRecord.seatKey) : 'black';
    const publicSeatState = buildPublicSeatState(room);
    return MatchAuthority.buildPresencePayloadFromRoom(room, {
        type: metaRecord.type ? String(metaRecord.type) : 'join',
        seatKey,
        playerName: normalizeNetworkPlayerName(publicSeatState.seatNames[seatKey]),
        rejoined: !!metaRecord.rejoined,
        roomDeck: toPublicRoomDeck(room),
        roomBoardConfig: toPublicRoomBoardConfig(room),
        networkDebugEnabled: toPublicNetworkDebugEnabled(room),
        turnTimer: toPublicTurnTimer(room, serverTime),
        serverTime
    });
}

function buildHeartbeatPayload(room: MatchWorkerRoomState, serverTime: unknown): Record<string, unknown> {
    return MatchAuthority.buildHeartbeatPayloadFromRoom(room, {
        roomDeck: toPublicRoomDeck(room),
        roomBoardConfig: toPublicRoomBoardConfig(room),
        networkDebugEnabled: toPublicNetworkDebugEnabled(room),
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

function getRoomStub(env: MatchWorkerEnv, roomId: string) {
    if (!env.MATCH_ROOM) throw new Error('MATCH_ROOM binding is required');
    const doId = env.MATCH_ROOM.idFromName(roomId);
    return env.MATCH_ROOM.get(doId);
}

function getLeaderboardStub(env: MatchWorkerEnv) {
    return getRoomStub(env, LEADERBOARD_ROOM_ID);
}

async function forwardJsonToRoom(env: MatchWorkerEnv, roomId: string, pathname: string, payload: unknown): Promise<Response> {
    const stub = getRoomStub(env, roomId);
    const req = new Request(`https://room${pathname}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload || {})
    });
    const response = await stub.fetch(req);
    return withCORS(response);
}

async function forwardGetToRoom(env: MatchWorkerEnv, roomId: string, pathname: string, sourceUrl: string): Promise<Response> {
    const stub = getRoomStub(env, roomId);
    const urlObj = new URL(sourceUrl);
    const target = new URL(`https://room${pathname}`);
    for (const [key, value] of urlObj.searchParams.entries()) {
        target.searchParams.set(key, value);
    }
    target.searchParams.set('roomId', roomId);

    const req = new Request(target.toString(), { method: 'GET' });
    const response = await stub.fetch(req);
    return withCORS(response);
}

async function forwardJsonToLeaderboard(env: MatchWorkerEnv, pathname: string, payload: unknown): Promise<Response> {
    const stub = getLeaderboardStub(env);
    const req = new Request(`https://room${pathname}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload || {})
    });
    const response = await stub.fetch(req);
    return withCORS(response);
}

async function forwardGetToLeaderboard(env: MatchWorkerEnv, pathname: string, sourceUrl: string): Promise<Response> {
    const stub = getLeaderboardStub(env);
    const urlObj = new URL(sourceUrl);
    const target = new URL(`https://room${pathname}`);
    for (const [key, value] of urlObj.searchParams.entries()) {
        target.searchParams.set(key, value);
    }
    const req = new Request(target.toString(), { method: 'GET' });
    const response = await stub.fetch(req);
    return withCORS(response);
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
        const normalizedDeckSpec = deckSpecHelpers.normalizeDeckSpec(decodedDeckSpec);
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

async function handleCreate(env: MatchWorkerEnv, options: unknown): Promise<Response> {
    const opts = asRecord(options);
    const networkDebugEnabled = opts.networkDebugEnabled === true;
    const roomBoardConfig = MatchAuthority.normalizeRoomBoardConfig(opts.roomBoardConfig);
    const deckSelection = await resolveDeckSelection(opts.deckCode);
    if (!deckSelection.ok) {
        return jsonResponse(400, {
            ok: false,
            reason: deckSelection.reason || 'DECK_CODE_INVALID'
        });
    }

    const initialDeckSpecByPlayer = deckSelection.hasCustomDeck
        ? { black: deckSelection.deckSpec }
        : null;
    const roomDeck = deckSelection.hasCustomDeck
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
        : null;

    for (let attempt = 0; attempt < 12; attempt += 1) {
        const roomId = makeRoomId();
        const seed = Date.now();
        const snapshot = await makeInitialSnapshot(seed, {
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
                playerName: opts.playerName,
                selectedHandSkinId: opts.selectedHandSkinId,
                networkDebugEnabled,
                initialDeckSpecByPlayer,
                roomDeck,
                roomBoardConfig
            })
        });
        const response = await stub.fetch(req);
        if (response.status === 409) {
            continue;
        }
        return withCORS(response);
    }
    return jsonResponse(500, { ok: false, reason: 'CREATE_RETRY_EXHAUSTED' });
}

async function parsePostBody(request: Request): Promise<
    { ok: true; body: Record<string, unknown> } | { ok: false; response: Response }
> {
    const raw = await request.text();
    const body = parseJsonBody(raw);
    if (body === null) {
        return { ok: false, response: jsonResponse(400, { ok: false, reason: 'INVALID_JSON' }) };
    }
    return { ok: true, body };
}

async function handleMatchApi(request: Request, env: MatchWorkerEnv): Promise<Response> {
    const urlObj = new URL(request.url);
    const pathname = urlObj.pathname;

    if (request.method === 'OPTIONS') {
        return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    if (request.method === 'POST' && pathname === '/api/match/create') {
        const parsed = await parsePostBody(request);
        if (!parsed.ok) return parsed.response;
        return handleCreate(env, parsed.body || {});
    }

    if (request.method === 'POST' && (pathname === '/api/match/join' || pathname === '/api/match/leave' || pathname === '/api/match/publish' || pathname === '/api/match/chat' || pathname === '/api/match/hand-skin')) {
        const parsed = await parsePostBody(request);
        if (!parsed.ok) return parsed.response;

        const body = parsed.body || {};
        const roomId = normalizeRoomId(body.roomId);
        if (!roomId) {
            return jsonResponse(400, { ok: false, reason: 'ROOM_ID_REQUIRED' });
        }
        body.roomId = roomId;

        return forwardJsonToRoom(env, roomId, pathname, body);
    }

    if (request.method === 'GET' && (pathname === '/api/match/state' || pathname === '/api/match/stream')) {
        const roomId = normalizeRoomId(urlObj.searchParams.get('roomId') || '');
        if (!roomId) {
            return jsonResponse(400, { ok: false, reason: 'ROOM_ID_REQUIRED' });
        }
        return forwardGetToRoom(env, roomId, pathname, request.url);
    }

    return jsonResponse(404, { ok: false, reason: 'NOT_FOUND' });
}

async function handleLeaderboardApi(request: Request, env: MatchWorkerEnv): Promise<Response> {
    const urlObj = new URL(request.url);
    const pathname = urlObj.pathname;

    if (request.method === 'OPTIONS') {
        return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    if (request.method === 'POST' && pathname === '/api/leaderboard/submit') {
        const parsed = await parsePostBody(request);
        if (!parsed.ok) return parsed.response;
        return forwardJsonToLeaderboard(env, pathname, parsed.body || {});
    }

    if (request.method === 'GET' && pathname === '/api/leaderboard/list') {
        return forwardGetToLeaderboard(env, pathname, request.url);
    }

    return jsonResponse(404, { ok: false, reason: 'NOT_FOUND' });
}

export class MatchRoomDurableObject implements MatchRoomDurableObjectApi {
    state: DurableObjectStateLike;
    room: MatchWorkerRoomState | null;
    roomLoaded: boolean;
    streams: Map<string, MatchWorkerSseStreamInfo>;
    encoder: TextEncoder;
    heartbeatTimerId: ReturnType<typeof setTimeout> | null;
    sseEventBuffer: MatchAuthorityBufferedSseEventRecord[];

    constructor(state: DurableObjectStateLike) {
        this.state = state;
        this.room = null;
        this.roomLoaded = false;
        this.streams = new Map();
        this.encoder = new TextEncoder();
        this.heartbeatTimerId = null;
        this.sseEventBuffer = [];
    }

    async loadRoom(): Promise<void> {
        if (this.roomLoaded) return;
        this.room = await this.state.storage.get(ROOM_STORAGE_KEY) as MatchWorkerRoomState | null || null;
        if (this.room && !Array.isArray(this.room.sseEventBuffer)) {
            this.room.sseEventBuffer = [];
        }
        if (this.room && !Array.isArray(this.room.authorityLog)) {
            this.room.authorityLog = [];
        }
        if (this.room && typeof this.room.authoritativeStateHash === 'undefined' && MatchAuthority && typeof MatchAuthority.computeAuthoritativeStateHash === 'function') {
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

    async removeRoom(): Promise<void> {
        this.room = null;
        this.sseEventBuffer = [];
        if (this.heartbeatTimerId !== null) {
            try { clearTimeout(this.heartbeatTimerId); } catch (e) { /* ignore */ }
            this.heartbeatTimerId = null;
        }
        await this.state.storage.delete(ROOM_STORAGE_KEY);
        if (this.state.storage && typeof this.state.storage.deleteAlarm === 'function') {
            await this.state.storage.deleteAlarm();
        }
    }

    nextSseEventId(): string {
        const room = this.room;
        if (!room || typeof room !== 'object') {
            return MatchAuthority.makeSseStreamId(Date.now(), crypto as unknown as MatchWorkerCryptoLike);
        }

        const prevSeq = Number.isFinite(Number(room.eventSeq))
            ? Math.max(0, Math.trunc(Number(room.eventSeq)))
            : 0;
        const nextSeq = prevSeq + 1;
        room.eventSeq = nextSeq;

        const roomId = normalizeRoomId(room.roomId || 'room') || 'room';
        const stateVersion = Number.isFinite(Number(room.stateVersion))
            ? Math.max(0, Math.trunc(Number(room.stateVersion)))
            : 0;

        return `${roomId}_${stateVersion}_${nextSeq}`;
    }

    rememberBufferedSseEvent(record: MatchAuthorityBufferedSseEventRecordInput): void {
        const nextBuffer = MatchAuthority.appendBufferedSseEvent(
            this.room && Array.isArray(this.room.sseEventBuffer) ? this.room.sseEventBuffer : this.sseEventBuffer,
            record
        );
        this.sseEventBuffer = nextBuffer;
        if (this.room && typeof this.room === 'object') {
            this.room.sseEventBuffer = nextBuffer.slice();
        }
    }

    buildBufferedSnapshotEvent(meta: MatchWorkerSnapshotPayloadMeta | null | undefined, eventId: string): {
        record: MatchAuthorityBufferedSseEventRecordInput;
        payloadByViewer: Partial<Record<MatchAuthoritySeatKey, unknown>>;
    } {
        if (!this.room) {
            return {
                record: { eventId, eventName: 'snapshot', payloadByViewer: {} },
                payloadByViewer: {}
            };
        }
        const payloadByViewer = {
            black: buildSnapshotPayload(this.room, meta, 'black'),
            white: buildSnapshotPayload(this.room, meta, 'white')
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

    prepareSnapshotBroadcast(meta: MatchWorkerSnapshotPayloadMeta | null | undefined): MatchWorkerPreparedSnapshotBroadcast {
        const eventId = this.nextSseEventId();
        const { record, payloadByViewer } = this.buildBufferedSnapshotEvent(meta, eventId);
        return {
            eventId,
            record,
            payloadByViewer,
            fallbackPayload: this.room ? buildSnapshotPayload(this.room, meta, null) : {}
        };
    }

    async broadcastPreparedSnapshot(preparedSnapshot: MatchWorkerPreparedSnapshotBroadcast | null | undefined): Promise<void> {
        if (!this.room || !preparedSnapshot) return;
        this.rememberBufferedSseEvent(preparedSnapshot.record);
        await this.saveRoom();
        const streamEntries = Array.from(this.streams.entries());
        if (streamEntries.length === 0) return;
        await Promise.all(streamEntries.map(([streamId, streamInfo]) => {
            const viewerSeatKey = streamInfo && streamInfo.seatKey ? streamInfo.seatKey : null;
            const payload = (viewerSeatKey && preparedSnapshot.payloadByViewer[viewerSeatKey])
                ? preparedSnapshot.payloadByViewer[viewerSeatKey]
                : preparedSnapshot.fallbackPayload;
            return this.sendSse(streamId, 'snapshot', payload, { eventId: preparedSnapshot.eventId });
        }));
    }

    ensureHeartbeatTimer(): void {
        if (this.heartbeatTimerId !== null) return;
        if (this.streams.size === 0) return;

        this.heartbeatTimerId = setTimeout(() => {
            this.heartbeatTimerId = null;
            if (this.streams.size === 0) return;

            this.broadcastHeartbeat().catch(() => {
                // Keep heartbeat loop resilient even if one tick fails.
            }).finally(() => {
                this.ensureHeartbeatTimer();
            });
        }, SSE_HEARTBEAT_INTERVAL_MS);
    }

    async broadcastHeartbeat(): Promise<void> {
        if (!this.room) return;
        const streamEntries = Array.from(this.streams.entries());
        if (streamEntries.length === 0) return;

        const serverTime = Date.now();
        const payload = buildHeartbeatPayload(this.room, serverTime);
        const eventId = this.nextSseEventId();
        this.rememberBufferedSseEvent({
            eventId,
            eventName: 'heartbeat',
            payload
        });
        await this.saveRoom();

        await Promise.all(streamEntries.map(([streamId]) => (
            this.sendSse(streamId, 'heartbeat', payload, { eventId })
        )));
    }

    async closeStream(streamId: string): Promise<void> {
        const stream = this.streams.get(streamId);
        if (!stream) return;
        this.streams.delete(streamId);
        if (this.streams.size === 0 && this.heartbeatTimerId !== null) {
            try { clearTimeout(this.heartbeatTimerId); } catch (e) { /* ignore */ }
            this.heartbeatTimerId = null;
        }
        try {
            await stream.writer.close();
        } catch (e) {
            try { stream.writer.releaseLock(); } catch (inner) { /* ignore */ }
        }
    }

    async closeStreamsForSeat(seatKey: unknown): Promise<void> {
        if (!seatKey || !this.streams || this.streams.size === 0) return;
        for (const [streamId, stream] of Array.from(this.streams.entries())) {
            if (!stream || stream.seatKey !== seatKey) continue;
            await this.closeStream(streamId);
        }
    }

    async sendSse(streamId: string, eventName: string, payload: unknown, options?: Record<string, unknown> | null): Promise<void> {
        const stream = this.streams.get(streamId);
        if (!stream) return;
        const opts = (options && typeof options === 'object') ? options : {};
        const hasEventId = Object.prototype.hasOwnProperty.call(opts, 'eventId');
        const eventId = hasEventId ? opts.eventId : this.nextSseEventId();
        const timeoutMs = Number.isFinite(Number(opts.timeoutMs))
            ? Math.max(0, Math.trunc(Number(opts.timeoutMs)))
            : SSE_WRITE_TIMEOUT_MS;
        const chunk = sseChunk(eventName, payload, eventId);
        try {
            const writePromise = stream.writer.write(this.encoder.encode(chunk));
            if (timeoutMs > 0) {
                await Promise.race([
                    writePromise,
                    new Promise((_, reject) => {
                        setTimeout(() => reject(new Error('SSE_WRITE_TIMEOUT')), timeoutMs);
                    })
                ]);
            } else {
                await writePromise;
            }
        } catch (e) {
            await this.closeStream(streamId);
        }
    }

    async broadcastSnapshot(meta: MatchWorkerSnapshotPayloadMeta | null | undefined): Promise<void> {
        if (!this.room) return;
        const preparedCandidate = asRecord(meta).__preparedSnapshot;
        const preparedSnapshot = preparedCandidate && typeof preparedCandidate === 'object'
            ? preparedCandidate as MatchWorkerPreparedSnapshotBroadcast
            : this.prepareSnapshotBroadcast(meta);
        await this.broadcastPreparedSnapshot(preparedSnapshot);
    }

    async broadcastPresence(meta: MatchWorkerPresencePayloadMeta | null | undefined): Promise<void> {
        if (!this.room) return;
        const payload = buildPresencePayload(this.room, meta || {});
        const eventId = this.nextSseEventId();
        this.rememberBufferedSseEvent({
            eventId,
            eventName: 'presence',
            payload
        });
        await this.saveRoom();
        const streamEntries = Array.from(this.streams.entries());
        if (streamEntries.length === 0) return;
        await Promise.all(streamEntries.map(([streamId]) => (
            this.sendSse(streamId, 'presence', payload, { eventId })
        )));
    }

    async broadcastChat(payload: unknown): Promise<void> {
        if (!this.room) return;
        const eventId = this.nextSseEventId();
        this.rememberBufferedSseEvent({
            eventId,
            eventName: 'chat',
            payload
        });
        await this.saveRoom();
        const streamEntries = Array.from(this.streams.entries());
        if (streamEntries.length === 0) return;
        await Promise.all(streamEntries.map(([streamId]) => (
            this.sendSse(streamId, 'chat', payload, { eventId })
        )));
    }

    createRoomState(roomId: string, initOptions?: MatchWorkerRoomCreateOptions | null): MatchWorkerRoomState {
        const opts = asRecord(initOptions);
        const seed = Number.isFinite(Number(opts.seed)) ? Number(opts.seed) : Date.now();
        const snapshot = (opts.snapshot && typeof opts.snapshot === 'object') ? deepClone(opts.snapshot) as MatchWorkerPublicSnapshot : null;
        const initialDeckSpec = (opts.initialDeckSpec && typeof opts.initialDeckSpec === 'object') ? deepClone(opts.initialDeckSpec) : null;
        const initialDeckSpecByPlayer = (opts.initialDeckSpecByPlayer && typeof opts.initialDeckSpecByPlayer === 'object')
            ? cloneInitialDeckSpecByPlayer(opts.initialDeckSpecByPlayer)
            : null;
        const roomDeck = (opts.roomDeck && typeof opts.roomDeck === 'object') ? deepClone(opts.roomDeck) : null;
        const roomBoardConfig = MatchAuthority.normalizeRoomBoardConfig(
            opts.roomBoardConfig,
            asRecord(snapshot && snapshot.gameState).board
        );
        const networkDebugEnabled = opts.networkDebugEnabled === true;
        const nowMs = Date.now();
        return {
            roomId,
            seed,
            snapshot,
            authoritativeStateHash: MatchAuthority && typeof MatchAuthority.computeAuthoritativeStateHash === 'function'
                ? MatchAuthority.computeAuthoritativeStateHash(snapshot)
                : null,
            initialDeckSpec,
            initialDeckSpecByPlayer,
            roomDeck,
            roomBoardConfig,
            networkDebugEnabled,
            stateVersion: 0,
            seats: { black: false, white: false },
            seatNames: { black: '', white: '' },
            seatHandSkins: { black: '', white: '' },
            seatTokens: { black: makeSeatToken(), white: makeSeatToken() },
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
            updatedAt: nowMs
        };
    }

    async syncTurnTimerAlarm(): Promise<boolean> {
        const room = this.room;
        if (!room || !this.state || !this.state.storage) return false;
        const storage = this.state.storage;
        const timer = (room.turnTimer && typeof room.turnTimer === 'object') ? room.turnTimer : null;
        if (!timer || timer.active !== true || !Number.isFinite(Number(timer.turnDeadlineAt))) {
            if (typeof storage.deleteAlarm === 'function') {
                await storage.deleteAlarm();
                return true;
            }
            return false;
        }
        if (typeof storage.setAlarm === 'function') {
            await storage.setAlarm(Math.max(0, Math.trunc(Number(timer.turnDeadlineAt))));
            return true;
        }
        return false;
    }

    async isSnapshotGameOver(snapshot: MatchWorkerPublicSnapshot | null | undefined): Promise<boolean> {
        if (!snapshot || !snapshot.gameState) return false;
        try {
            const core = await loadCoreLogicModule();
            if (!core || typeof core.isGameOver !== 'function') return false;
            return !!core.isGameOver(snapshot.gameState);
        } catch (e) {
            return false;
        }
    }

    async refreshTurnTimer(options?: MatchWorkerTurnTimerOptions | null): Promise<boolean> {
        const opts = asRecord(options);
        const room = this.room;
        if (!room) return false;

        const nowMs = Number.isFinite(Number(opts.nowMs)) ? Math.max(0, Math.trunc(Number(opts.nowMs))) : Date.now();
        const turnSeatKey = resolveTurnSeatKey(room);
        const shouldRunBySeats = hasTwoActiveSeats(room);
        const isGameOver = shouldRunBySeats ? await this.isSnapshotGameOver(room.snapshot as MatchWorkerPublicSnapshot | null | undefined) : false;
        const shouldBeActive = shouldRunBySeats && !isGameOver;

        if (!shouldBeActive) {
            const pausedTimer = createPausedTurnTimer(room);
            const changed = !areTurnTimersEqual(room.turnTimer, pausedTimer);
            room.turnTimer = pausedTimer;
            await this.syncTurnTimerAlarm();
            return changed;
        }

        const timer = (room.turnTimer && typeof room.turnTimer === 'object') ? room.turnTimer : null;
        if (!opts.forceRestart && timer && timer.active === true) {
            const timerSeatKey = parseSeatKeyOptional(timer.turnSeatKey);
            const timerDeadline = Number(timer.turnDeadlineAt);
            if (timerSeatKey === turnSeatKey && Number.isFinite(timerDeadline)) {
                timer.limitSeconds = NETWORK_TURN_LIMIT_SECONDS;
                return false;
            }
        }

        const activeTimer = createActiveTurnTimer(room, nowMs);
        const changed = !areTurnTimersEqual(room.turnTimer, activeTimer);
        room.turnTimer = activeTimer;
        await this.syncTurnTimerAlarm();
        return changed;
    }

    async applyExpiredTurnTimeoutIfNeeded(options?: MatchWorkerTurnTimerOptions | null): Promise<MatchWorkerTurnTimeoutResult> {
        const opts = asRecord(options);
        if (!this.room) return { applied: false };

        const nowMs = Number.isFinite(Number(opts.nowMs)) ? Math.max(0, Math.trunc(Number(opts.nowMs))) : Date.now();
        const timerRefreshed = await this.refreshTurnTimer({ nowMs, forceRestart: false });
        if (timerRefreshed) {
            this.room.updatedAt = nowMs;
            await this.saveRoom();
        }

        const room = this.room;
        const timer = (room && room.turnTimer && typeof room.turnTimer === 'object') ? room.turnTimer : null;
        if (!timer || timer.active !== true) return { applied: false };

        const deadline = Number(timer.turnDeadlineAt);
        if (!Number.isFinite(deadline) || deadline > nowMs) return { applied: false };

        const snapshot = room && room.snapshot && typeof room.snapshot === 'object'
            ? room.snapshot as MatchWorkerPublicSnapshot
            : null;
        if (!snapshot || !snapshot.gameState || !snapshot.cardState) return { applied: false };

        const timedOutSeatKey = parseSeatKeyOptional(timer.turnSeatKey) || resolveTurnSeatKey(room);
        const currentTurnSeatKey = resolveTurnSeatKey(room);
        if (timedOutSeatKey !== currentTurnSeatKey) {
            const corrected = await this.refreshTurnTimer({ nowMs, forceRestart: true });
            if (corrected) {
                room.updatedAt = nowMs;
                await this.saveRoom();
            }
            return { applied: false };
        }

        const core = await loadCoreLogicModule();
        if (!core || typeof core.applyPass !== 'function') return { applied: false };
        const nextSnapshot = deepClone(snapshot) as MatchWorkerPublicSnapshot;
        nextSnapshot.gameState = core.applyPass(nextSnapshot.gameState);
        MatchAuthority.stripTransientPresentationState(nextSnapshot);
        if (nextSnapshot.cardState && typeof nextSnapshot.cardState === 'object') {
            if (
                parseSeatKeyOptional(nextSnapshot.cardState.selectedCardOwnerKey) === timedOutSeatKey
            ) {
                nextSnapshot.cardState.selectedCardId = null;
                nextSnapshot.cardState.selectedCardOwnerKey = null;
            }
        }
        if (nextSnapshot.cardState && nextSnapshot.cardState.pendingEffectByPlayer && typeof nextSnapshot.cardState.pendingEffectByPlayer === 'object') {
            asRecord(nextSnapshot.cardState.pendingEffectByPlayer)[timedOutSeatKey] = null;
        }
        const serverPlaybackAssembly = await reconcileTurnStartAndCollectPlayback(room, nextSnapshot);
        MatchAuthority.reportPlaybackAssemblyDiagnostics('worker-timeout-pass', serverPlaybackAssembly && serverPlaybackAssembly.diagnostics, {
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
        room.authoritativeStateHash = MatchAuthority && typeof MatchAuthority.computeAuthoritativeStateHash === 'function'
            ? MatchAuthority.computeAuthoritativeStateHash(nextSnapshot)
            : null;
        if (MatchAuthority && typeof MatchAuthority.appendAuthorityLog === 'function') {
            MatchAuthority.appendAuthorityLog(room, {
                kind: 'timeout_applied',
                actionType: 'timeout_pass',
                committedVersion: room.stateVersion,
                stateHashAfter: room.authoritativeStateHash,
                timeoutReason: 'turn_deadline_expired'
            }, undefined);
        }

        await this.refreshTurnTimer({ nowMs, forceRestart: true });
        await this.saveRoom();

        await this.broadcastSnapshot({
            playerKey: timedOutSeatKey,
            actionType: 'timeout_pass',
            playbackEvents: serverPlaybackEvents,
            effectLogs: serverEffectLogs,
            playbackDiagnostics: MatchAuthority.toDebugPlaybackDiagnostics(serverPlaybackAssembly && serverPlaybackAssembly.diagnostics, toPublicNetworkDebugEnabled(room)),
            operationId: `timeout_${room.stateVersion}_${nowMs}`
        });

        return {
            applied: true,
            stateVersion: room.stateVersion,
            playerKey: timedOutSeatKey
        };
    }

    async alarm() {
        await this.loadRoom();
        if (!this.room) return;
        const nowMs = Date.now();
        const result = await this.applyExpiredTurnTimeoutIfNeeded({ nowMs });
        if (!result || result.applied !== true) {
            const timerChanged = await this.refreshTurnTimer({ nowMs, forceRestart: false });
            if (timerChanged) {
                this.room.updatedAt = nowMs;
                await this.saveRoom();
            }
        }
    }

    async handleInternalCreate(urlObj: URL, body: Record<string, unknown>): Promise<Response> {
        await this.loadRoom();
        if (this.room) {
            return jsonResponse(409, { ok: false, reason: 'ROOM_EXISTS' });
        }
        const payload = asRecord(body);
        const roomId = normalizeRoomId(payload.roomId || (urlObj && urlObj.searchParams ? urlObj.searchParams.get('roomId') : ''));
        const seed = Number.isFinite(Number(payload.seed)) ? Number(payload.seed) : Date.now();
        const snapshot = (payload.snapshot && typeof payload.snapshot === 'object')
            ? payload.snapshot as MatchWorkerPublicSnapshot
            : null;
        const playerName = normalizeNetworkPlayerName(payload.playerName);
        const selectedHandSkinId = normalizeSeatHandSkinId(payload.selectedHandSkinId);
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

        if (!roomId) {
            return jsonResponse(400, { ok: false, reason: 'ROOM_ID_REQUIRED' });
        }
        if (!snapshot || !snapshot.gameState || !snapshot.cardState) {
            return jsonResponse(400, { ok: false, reason: 'SNAPSHOT_REQUIRED' });
        }
        if (!playerName) {
            return jsonResponse(400, { ok: false, reason: 'PLAYER_NAME_REQUIRED' });
        }

        const room = this.createRoomState(roomId, {
            seed,
            snapshot,
            initialDeckSpec,
            initialDeckSpecByPlayer,
            roomDeck,
            roomBoardConfig,
            networkDebugEnabled
        });
        this.room = room;
        this.sseEventBuffer = [];
        const publicSeatState = buildPublicSeatState(room);
        publicSeatState.seats.black = true;
        publicSeatState.seatNames.black = playerName;
        publicSeatState.seatHandSkins.black = selectedHandSkinId;
        room.seats = publicSeatState.seats;
        room.seatNames = publicSeatState.seatNames;
        room.seatHandSkins = publicSeatState.seatHandSkins;
        room.updatedAt = Date.now();
        await this.refreshTurnTimer({ nowMs: room.updatedAt, forceRestart: false });
        await this.saveRoom();

        const serverTime = Date.now();

        return jsonResponse(200, MatchAuthority.buildRoomPayloadFromRoom(room, {
            ok: true,
            seatKey: 'black',
            playerName,
            seatToken: asRecord(room.seatTokens).black,
            roomDeck: toPublicRoomDeck(room),
            roomBoardConfig: toPublicRoomBoardConfig(room),
            networkDebugEnabled: toPublicNetworkDebugEnabled(room),
            stateVersion: room.stateVersion,
            snapshot: toPublicSnapshot(room, 'black'),
            turnTimer: toPublicTurnTimer(room, serverTime),
            serverTime
        }));
    }

    async handleJoin(body: Record<string, unknown>): Promise<Response> {
        await this.loadRoom();
        const room = this.room;
        if (!room) {
            return jsonResponse(404, { ok: false, reason: 'ROOM_NOT_FOUND' });
        }

        const deckSelection = await resolveDeckSelection(body.deckCode);
        if (!deckSelection.ok) {
            return jsonResponse(400, {
                ok: false,
                reason: deckSelection.reason || 'DECK_CODE_INVALID'
            });
        }

        const playerName = normalizeNetworkPlayerName(body.playerName);
        const selectedHandSkinId = normalizeSeatHandSkinId(body.selectedHandSkinId);
        if (!playerName) {
            return jsonResponse(400, { ok: false, reason: 'PLAYER_NAME_REQUIRED' });
        }

        const requestedSeatKey = parseSeatKeyOptional(body.seatKey);
        const providedToken = String(body.seatToken || '').trim();
        const seatKey = resolveSeatForJoin(room, requestedSeatKey, providedToken);
        if (!seatKey) {
            return jsonResponse(409, { ok: false, reason: 'ROOM_FULL' });
        }

        if (!room.seatTokens || !room.seatTokens[seatKey]) {
            room.seatTokens = room.seatTokens || {};
            room.seatTokens[seatKey] = makeSeatToken();
        }
        const seatToken = room.seatTokens[seatKey];
        const rejoined = providedToken && providedToken === seatToken;

        const hadTwoSeats = hasTwoActiveSeats(room);
        asRecord(room.seats)[seatKey] = true;
        room.seatNames = room.seatNames && typeof room.seatNames === 'object'
            ? room.seatNames
            : { black: '', white: '' };
        room.seatNames[seatKey] = playerName;
        room.seatHandSkins = toPublicSeatHandSkins(room);
        room.seatHandSkins[seatKey] = selectedHandSkinId;
        if (deckSelection.hasCustomDeck) {
            assignRoomDeckSelection(room, seatKey, deckSelection);
        }

        const hasTwoSeatsNow = hasTwoActiveSeats(room);
        let rebasedInitialSnapshot = false;
        if (!hadTwoSeats && hasTwoSeatsNow && room.stateVersion === 0) {
            try {
                const nextSnapshot = await makeInitialSnapshot(room.seed, buildInitialDeckSnapshotOptions(room));
                room.stateVersion = 1;
                nextSnapshot.stateVersion = room.stateVersion;
                nextSnapshot.updatedAt = Date.now();
                room.snapshot = nextSnapshot;
                room.updatedAt = nextSnapshot.updatedAt;
                rebasedInitialSnapshot = true;
            } catch (e) {
                return jsonResponse(500, { ok: false, reason: 'JOIN_DECK_INIT_FAILED' });
            }
        } else {
            room.updatedAt = Date.now();
        }

        await this.refreshTurnTimer({
            nowMs: room.updatedAt,
            forceRestart: !hadTwoSeats && hasTwoSeatsNow
        });
        await this.saveRoom();

        if (rebasedInitialSnapshot) {
            await this.broadcastSnapshot({
                playerKey: seatKey,
                actionType: 'join_room',
                playbackEvents: [],
                operationId: `join_room_${room.stateVersion}`
            });
        }

        await this.broadcastPresence({
            type: 'join',
            seatKey,
            rejoined: !!rejoined
        });

        const serverTime = Date.now();
        return jsonResponse(200, MatchAuthority.buildRoomPayloadFromRoom(room, {
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

    async handleLeave(body: Record<string, unknown>): Promise<Response> {
        await this.loadRoom();
        const room = this.room;
        if (!room) {
            return jsonResponse(200, { ok: true });
        }

        const seatKey = normalizePlayerKey(body.seatKey);
        const seatToken = String(body.seatToken || '').trim();
        const authenticatedSeatKey = resolveAuthenticatedSeatKey(room, seatKey, seatToken);

        if (authenticatedSeatKey !== seatKey) {
            return jsonResponse(403, {
                ok: false,
                reason: classifySeatTokenRejectionReason(seatToken)
            });
        }

        MatchAuthority.applySeatLeaveToRoom(room, seatKey, {
            makeSeatToken,
            now: Date.now()
        });
        await this.refreshTurnTimer({ nowMs: room.updatedAt, forceRestart: false });
        await this.closeStreamsForSeat(seatKey);

        await this.broadcastPresence({
            type: 'leave',
            seatKey,
            rejoined: false
        });

        if (MatchAuthority.shouldDisposeRoom(room, this.streams.size)) {
            await this.removeRoom();
        } else {
            await this.saveRoom();
        }

        const serverTime = Date.now();
        return jsonResponse(200, MatchAuthority.buildRoomPayloadFromRoom(room, {
            ok: true,
            roomBoardConfig: toPublicRoomBoardConfig(room),
            turnTimer: toPublicTurnTimer(room, serverTime),
            serverTime
        }));
    }

    async handleHandSkin(body: Record<string, unknown>): Promise<Response> {
        await this.loadRoom();
        const room = this.room;

        if (!room) {
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
            turnTimer: toPublicTurnTimer(room, serverTime),
            serverTime
        }));
    }

    async handlePublish(body: Record<string, unknown>): Promise<Response> {
        await this.loadRoom();
        const room = this.room;

        if (!room) {
            return jsonResponse(404, { ok: false, rejectedReason: 'ROOM_NOT_FOUND' });
        }

        await this.applyExpiredTurnTimeoutIfNeeded();

        const seatKey = normalizePlayerKey(body.seatKey);
        const playerKey = normalizePlayerKey(body.playerKey);
        const seatToken = String(body.seatToken || '').trim();
        const baseVersion = Number.isFinite(Number(body.baseVersion)) ? Number(body.baseVersion) : null;
        const actionType = String(body.actionType || '').trim().toLowerCase();
        const operationId = normalizeOperationId(body.operationId);
        const isRematchResetAction = actionType === 'reset_game' || actionType === 'rematch' || actionType === 'restart';
        const isNetworkDebugAction = isNetworkDebugFillHandPayload(body);
        const viewerSeatKey = resolveAuthenticatedSeatKey(room, seatKey, seatToken);
        const acceptedOperationsBySeat = ensureAcceptedOperationsBySeat(room);
        if (!Array.isArray(room.authorityLog)) room.authorityLog = [];
        if (!Array.isArray(room.sseEventBuffer)) room.sseEventBuffer = [];
        if (typeof room.authoritativeStateHash === 'undefined' && MatchAuthority && typeof MatchAuthority.computeAuthoritativeStateHash === 'function') {
            room.authoritativeStateHash = MatchAuthority.computeAuthoritativeStateHash(room.snapshot);
        }

        if (!asRecord(room.seats)[seatKey]) {
            return jsonResponse(403, buildPublishPayload(room, viewerSeatKey, MatchAuthority.buildPublishResponseOptions({
                ok: false,
                rejectedReason: 'SEAT_NOT_JOINED',
                publishKind: 'rejected',
                operationId,
                actionType,
                receivedBaseVersion: baseVersion,
                authoritativeStateVersion: room.stateVersion
            })));
        }

        if (seatKey !== playerKey) {
            return jsonResponse(403, buildPublishPayload(room, viewerSeatKey, MatchAuthority.buildPublishResponseOptions({
                ok: false,
                rejectedReason: 'SEAT_MISMATCH',
                publishKind: 'rejected',
                operationId,
                actionType,
                receivedBaseVersion: baseVersion,
                authoritativeStateVersion: room.stateVersion
            })));
        }

        if (!seatToken || !room.seatTokens || room.seatTokens[seatKey] !== seatToken) {
            return jsonResponse(403, buildPublishPayload(room, null, MatchAuthority.buildPublishResponseOptions({
                ok: false,
                rejectedReason: 'SEAT_TOKEN_MISMATCH',
                publishKind: 'rejected',
                operationId,
                actionType,
                receivedBaseVersion: baseVersion,
                authoritativeStateVersion: room.stateVersion
            })));
        }

        if (!(MatchAuthority && typeof MatchAuthority.hasRequiredOperationId === 'function'
            ? MatchAuthority.hasRequiredOperationId(operationId)
            : !!operationId)) {
            return jsonResponse(409, buildPublishPayload(room, seatKey, MatchAuthority.buildPublishResponseOptions({
                ok: false,
                rejectedReason: 'OPERATION_ID_REQUIRED',
                publishKind: 'rejected',
                operationId,
                actionType,
                receivedBaseVersion: baseVersion,
                authoritativeStateVersion: room.stateVersion
            })));
        }

        const lastAcceptedOperation = MatchAuthority && typeof MatchAuthority.resolveAcceptedOperation === 'function'
            ? MatchAuthority.resolveAcceptedOperation(room, seatKey, operationId, acceptedOperationsBySeat[seatKey])
            : acceptedOperationsBySeat[seatKey];
        if (
            operationId &&
            lastAcceptedOperation &&
            typeof lastAcceptedOperation === 'object'
        ) {
            const serverTime = Date.now();
            if (MatchAuthority && typeof MatchAuthority.appendAuthorityLog === 'function') {
                MatchAuthority.appendAuthorityLog(room, {
                    kind: 'publish_idempotent_replay',
                    operationId,
                    actionType,
                    baseVersion,
                    committedVersion: room.stateVersion,
                    stateHashBefore: room.authoritativeStateHash,
                    dedupeOutcome: 'replay'
                }, undefined);
            }
            return jsonResponse(200, buildPublishPayload(room, seatKey, MatchAuthority.buildPublishResponseOptions({
                ok: true,
                idempotentReplay: true,
                serverTime,
                publishKind: 'idempotent_replay',
                operationId,
                actionType,
                receivedBaseVersion: baseVersion,
                authoritativeStateVersion: room.stateVersion,
                replayedStateVersion: lastAcceptedOperation.stateVersion
            })));
        }

        if (baseVersion === null || baseVersion !== room.stateVersion) {
            const versionRejectedOptions = MatchAuthority && typeof MatchAuthority.buildVersionRejectedPublishResponseOptions === 'function'
                ? MatchAuthority.buildVersionRejectedPublishResponseOptions(room, {
                    operationId,
                    actionType,
                    receivedBaseVersion: baseVersion,
                    authoritativeStateVersion: room.stateVersion
                })
                : MatchAuthority.buildPublishResponseOptions({
                    ok: false,
                    rejectedReason: MatchAuthority && typeof MatchAuthority.classifyVersionRejectionReason === 'function'
                        ? MatchAuthority.classifyVersionRejectionReason(baseVersion, room.stateVersion)
                        : 'VERSION_MISMATCH',
                    publishKind: 'rejected',
                    operationId,
                    actionType,
                    receivedBaseVersion: baseVersion,
                    authoritativeStateVersion: room.stateVersion
                });
            const rejectedReason = versionRejectedOptions && versionRejectedOptions.rejectedReason
                ? versionRejectedOptions.rejectedReason
                : 'VERSION_MISMATCH';
            if (MatchAuthority && typeof MatchAuthority.appendAuthorityLog === 'function') {
                MatchAuthority.appendAuthorityLog(room, {
                    kind: 'publish_rejected',
                    operationId,
                    actionType,
                    baseVersion,
                    committedVersion: room.stateVersion,
                    stateHashBefore: room.authoritativeStateHash,
                    rejectedReason
                }, undefined);
            }
            return jsonResponse(409, buildPublishPayload(room, seatKey, versionRejectedOptions));
        }

        const expectedPlayerKey = getCurrentPlayerKey(asRecord(room.snapshot).gameState);
        if (playerKey !== expectedPlayerKey) {
            const allowOutOfTurnRematch = isRematchResetAction && await this.isSnapshotGameOver(room.snapshot as MatchWorkerPublicSnapshot | null | undefined);
            const allowOutOfTurnNetworkDebug = isNetworkDebugAction && toPublicNetworkDebugEnabled(room);
            const allowFateWillController = MatchAuthority && typeof MatchAuthority.isFateWillControllerForCurrentTurn === 'function'
                && MatchAuthority.isFateWillControllerForCurrentTurn(room.snapshot, playerKey);
            if (!allowOutOfTurnRematch && !allowOutOfTurnNetworkDebug && !allowFateWillController) {
                return jsonResponse(409, buildPublishPayload(room, seatKey, MatchAuthority.buildPublishResponseOptions({
                    ok: false,
                    rejectedReason: 'OUT_OF_TURN',
                    publishKind: 'rejected',
                    operationId,
                    actionType,
                    receivedBaseVersion: baseVersion,
                    authoritativeStateVersion: room.stateVersion
                })));
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

        const stateHashBefore = MatchAuthority && typeof MatchAuthority.computeAuthoritativeStateHash === 'function'
            ? MatchAuthority.computeAuthoritativeStateHash(room.snapshot)
            : (room.authoritativeStateHash || null);
        const previousSnapshotForChargeDelta = deepClone(room.snapshot);
        let nextSnapshot: MatchWorkerPublicSnapshot | null = null;
        let serverPlaybackEvents: unknown[] = [];
        let serverEffectLogs: unknown[] = [];
        let serverPlaybackDiagnostics: unknown = null;
        let commandAction: unknown = null;
        let pendingEffectId: unknown = null;
        if (isRematchResetAction) {
            const rematchSeed = Date.now();
            try {
                nextSnapshot = await makeInitialSnapshot(rematchSeed, buildInitialDeckSnapshotOptions(room)) as MatchWorkerPublicSnapshot;
                room.seed = rematchSeed;
            } catch (e) {
                return jsonResponse(500, buildPublishPayload(room, seatKey, MatchAuthority.buildPublishResponseOptions({
                    ok: false,
                    rejectedReason: 'REMATCH_RESET_FAILED',
                    publishKind: 'rejected',
                    operationId,
                    actionType,
                    receivedBaseVersion: baseVersion,
                    authoritativeStateVersion: room.stateVersion
                })));
            }
        } else if (hasCommandPayload) {
            const commandResult = await applyCommandPublishToSnapshot(room, body, playerKey);
            if (!commandResult.ok) {
                if (MatchAuthority && typeof MatchAuthority.appendAuthorityLog === 'function') {
                    MatchAuthority.appendAuthorityLog(room, {
                        kind: 'publish_rejected',
                        operationId,
                        actionType,
                        baseVersion,
                        committedVersion: room.stateVersion,
                        stateHashBefore,
                        pendingEffectId: commandResult.pendingEffectId || null,
                        rejectedReason: commandResult.rejectedReason || 'COMMAND_REJECTED'
                    }, undefined);
                }
                return jsonResponse(409, buildPublishPayload(room, seatKey, MatchAuthority.buildPublishResponseOptions({
                    ok: false,
                    rejectedReason: commandResult.rejectedReason || 'COMMAND_REJECTED',
                    errorMessage: commandResult.errorMessage || null,
                    publishKind: 'rejected',
                    operationId,
                    actionType,
                    receivedBaseVersion: baseVersion,
                    authoritativeStateVersion: room.stateVersion
                })));
            }
            nextSnapshot = commandResult.snapshot as MatchWorkerPublicSnapshot;
            serverPlaybackEvents = Array.isArray(commandResult.playbackEvents) ? commandResult.playbackEvents : [];
            serverEffectLogs = Array.isArray(commandResult.effectLogs) ? commandResult.effectLogs : [];
            serverPlaybackDiagnostics = commandResult.playbackDiagnostics || null;
            commandAction = commandResult.action || null;
            pendingEffectId = commandResult.pendingEffectId || null;
        } else {
            return jsonResponse(409, buildPublishPayload(room, seatKey, MatchAuthority.buildPublishResponseOptions({
                ok: false,
                rejectedReason: 'COMMAND_REQUIRED',
                publishKind: 'rejected',
                operationId,
                actionType,
                receivedBaseVersion: baseVersion,
                authoritativeStateVersion: room.stateVersion
            })));
        }

        room.stateVersion += 1;
        nextSnapshot.stateVersion = room.stateVersion;
        const snapshotUpdatedAt = Date.now();
        nextSnapshot.updatedAt = snapshotUpdatedAt;

        room.snapshot = nextSnapshot;
        room.updatedAt = snapshotUpdatedAt;
        room.authoritativeStateHash = MatchAuthority && typeof MatchAuthority.computeAuthoritativeStateHash === 'function'
            ? MatchAuthority.computeAuthoritativeStateHash(nextSnapshot)
            : null;
        if (operationId) {
            const acceptedEntry: MatchAuthorityAcceptedOperationEntry = {
                operationId,
                stateVersion: room.stateVersion,
                updatedAt: Number.isFinite(Number(room.updatedAt)) ? Number(room.updatedAt) : null
            };
            if (MatchAuthority && typeof MatchAuthority.rememberAcceptedOperationBySeat === 'function') {
                MatchAuthority.rememberAcceptedOperationBySeat(room, seatKey, acceptedEntry);
            } else {
                acceptedOperationsBySeat[seatKey] = acceptedEntry;
            }
        }
        await this.refreshTurnTimer({ nowMs: room.updatedAt, forceRestart: !isNetworkDebugAction });

        const meta = {
            playerKey,
            actionType: body.actionType ? String(body.actionType) : null,
            playbackEvents: serverPlaybackEvents,
            effectLogs: serverEffectLogs,
            playbackDiagnostics: serverPlaybackDiagnostics,
            operationId: operationId || null
        };
        const serverTime = Date.now();
        const preparedSnapshot = this.prepareSnapshotBroadcast(meta);
        const responsePayload = buildPublishPayload(room, seatKey, Object.assign(
            MatchAuthority.buildPublishResponseOptions({
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
            }),
            { previousSnapshotForChargeDelta }
        ));
        if (MatchAuthority && typeof MatchAuthority.appendAuthorityLog === 'function') {
            MatchAuthority.appendAuthorityLog(room, {
                kind: 'publish_accepted',
                operationId,
                actionType: actionType || (commandAction && asRecord(commandAction).type ? String(asRecord(commandAction).type) : null),
                baseVersion,
                committedVersion: room.stateVersion,
                stateHashBefore,
                stateHashAfter: room.authoritativeStateHash,
                pendingEffectId,
                dedupeOutcome: 'accepted'
            }, undefined);
        }
        MatchAuthority.stripTransientChargeDeltaState(room.snapshot);
        await this.saveRoom();
        await this.broadcastSnapshot({
            ...meta,
            __preparedSnapshot: preparedSnapshot
        });
        return jsonResponse(200, responsePayload);
    }

    async handleState(urlObj: URL): Promise<Response> {
        await this.loadRoom();
        const room = this.room;
        if (!room) {
            return jsonResponse(404, { ok: false, reason: 'ROOM_NOT_FOUND' });
        }

        await this.applyExpiredTurnTimeoutIfNeeded();

        const seatKey = parseSeatKeyOptional(urlObj && urlObj.searchParams ? urlObj.searchParams.get('seatKey') : null);
        const seatToken = String(urlObj && urlObj.searchParams ? (urlObj.searchParams.get('seatToken') || '') : '').trim();
        const viewerSeatKey = resolveAuthenticatedSeatKey(room, seatKey, seatToken);
        if (!viewerSeatKey) {
            return jsonResponse(403, { ok: false, reason: classifySeatTokenRejectionReason(seatToken) });
        }

        const serverTime = Date.now();

        return jsonResponse(200, MatchAuthority.buildRoomPayloadFromRoom(room, {
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

    async handleStream(request: Request): Promise<Response> {
        await this.loadRoom();
        const room = this.room;
        if (!room) {
            return jsonResponse(404, { ok: false, reason: 'ROOM_NOT_FOUND' });
        }

        await this.applyExpiredTurnTimeoutIfNeeded();

        const urlObj = new URL(request.url);
        const seatKey = parseSeatKeyOptional(urlObj.searchParams.get('seatKey') || '');
        const seatToken = String(urlObj.searchParams.get('seatToken') || '').trim();
        const resumeEventId = String(urlObj.searchParams.get('lastEventId') || '').trim();
        const viewerSeatKey = resolveAuthenticatedSeatKey(room, seatKey, seatToken);
        if (!viewerSeatKey) {
            return jsonResponse(403, { ok: false, reason: classifySeatTokenRejectionReason(seatToken) });
        }

        const { readable, writable } = new TransformStream();
        const writer = writable.getWriter();

        const streamId = MatchAuthority.makeSseStreamId(Date.now(), crypto as unknown as MatchWorkerCryptoLike);
        this.streams.set(streamId, { writer, seatKey: viewerSeatKey });
        this.ensureHeartbeatTimer();
        const lastEventId = String(request.headers.get('Last-Event-ID') || resumeEventId).trim();
        const replayBuffer = Array.isArray(room.sseEventBuffer) ? room.sseEventBuffer : this.sseEventBuffer;
        const replayEvents = MatchAuthority.getBufferedSseReplayEvents(replayBuffer, lastEventId, viewerSeatKey);

        const onAbort = () => {
            this.closeStream(streamId).catch(() => {});
        };

        try {
            if (request.signal && typeof request.signal.addEventListener === 'function') {
                request.signal.addEventListener('abort', onAbort, { once: true });
            }
        } catch (e) { /* ignore */ }

        const initialPayload = buildSnapshotPayload(room, { playbackEvents: [] }, viewerSeatKey);

        queueMicrotask(() => {
            (async () => {
                try {
                    if (Array.isArray(replayEvents)) {
                        if (MatchAuthority && typeof MatchAuthority.appendAuthorityLog === 'function') {
                            MatchAuthority.appendAuthorityLog(room, {
                                kind: replayEvents.length > 0 ? 'stream_resume_replay' : 'stream_resume_heartbeat',
                                stateHashBefore: room.authoritativeStateHash,
                                dedupeOutcome: replayEvents.length > 0 ? 'replay' : 'empty_replay'
                            }, undefined);
                        }
                        if (replayEvents.length > 0) {
                            for (const event of replayEvents) {
                                await this.sendSse(streamId, event.eventName, event.payload, { eventId: event.eventId });
                            }
                        } else {
                            await this.sendSse(streamId, 'heartbeat', buildHeartbeatPayload(room, Date.now()), { eventId: null });
                        }
                        return;
                    }
                    if (MatchAuthority && typeof MatchAuthority.appendAuthorityLog === 'function') {
                        MatchAuthority.appendAuthorityLog(room, {
                            kind: 'stream_resume_full_sync',
                            stateHashBefore: room.authoritativeStateHash,
                            dedupeOutcome: 'full_sync'
                        }, undefined);
                    }
                    await this.sendSse(streamId, 'snapshot', initialPayload);
                    await this.sendSse(streamId, 'chat', withPublicSeatState(room, {
                        ok: true,
                        roomId: room.roomId,
                        type: 'history',
                        roomDeck: toPublicRoomDeck(room),
                        networkDebugEnabled: toPublicNetworkDebugEnabled(room),
                        messages: toPublicChatMessages(room)
                    }));
                } catch (e) {
                    this.closeStream(streamId).catch(() => {});
                }
            })();
        });

        return new Response(readable, {
            status: 200,
            headers: {
                'Content-Type': 'text/event-stream; charset=utf-8',
                'Cache-Control': 'no-cache, no-transform',
                Connection: 'keep-alive',
                ...CORS_HEADERS
            }
        });
    }

    async loadLeaderboardStore(): Promise<MatchWorkerLeaderboardStore> {
        const empty: MatchWorkerLeaderboardStore = {
            version: LEADERBOARD_STORAGE_VERSION,
            players: {},
            updatedAt: Date.now()
        };

        const raw = await this.state.storage.get(LEADERBOARD_STORAGE_KEY);
        if (!raw || typeof raw !== 'object') return empty;
        const rawRecord = asRecord(raw);

        const playersRaw = (rawRecord.players && typeof rawRecord.players === 'object') ? asRecord(rawRecord.players) : {};
        const players: Record<string, MatchWorkerLeaderboardEntry> = {};

        for (const [key, entry] of Object.entries(playersRaw)) {
            const normalized = normalizeLeaderboardEntry(entry, key);
            if (!normalized) continue;
            players[normalized.playerId] = normalized;
        }

        const updatedAt = Number.isFinite(Number(rawRecord.updatedAt))
            ? Math.max(0, Math.trunc(Number(rawRecord.updatedAt)))
            : Date.now();

        return {
            version: LEADERBOARD_STORAGE_VERSION,
            players,
            updatedAt
        };
    }

    async saveLeaderboardStore(store: MatchWorkerLeaderboardStore): Promise<void> {
        await this.state.storage.put(LEADERBOARD_STORAGE_KEY, {
            version: LEADERBOARD_STORAGE_VERSION,
            players: (store && store.players && typeof store.players === 'object') ? store.players : {},
            updatedAt: Number.isFinite(Number(store && store.updatedAt)) ? Math.max(0, Math.trunc(Number(store.updatedAt))) : Date.now()
        });
    }

    listLeaderboardEntries(store: MatchWorkerLeaderboardStore, limit: unknown): Array<Record<string, unknown>> {
        const rows = Object.values((store && store.players) || {})
            .map((entry) => normalizeLeaderboardEntry(entry))
            .filter(isLeaderboardEntry);

        sortLeaderboardEntries(rows);

        const clipped = rows.slice(0, normalizeLeaderboardLimit(limit));
        return clipped.map((entry, index) => ({
            rank: index + 1,
            playerId: entry.playerId,
            playerName: entry.playerName,
            bestScore: entry.bestScore,
            mode: entry.mode,
            cpuLevel: entry.cpuLevel,
            updatedAt: entry.updatedAt,
            scoreVersion: entry.scoreVersion,
            turnCount: entry.turnCount
        }));
    }

    async handleLeaderboardSubmit(body: Record<string, unknown>): Promise<Response> {
        const playerId = normalizeLeaderboardPlayerId(body && body.playerId);
        if (!playerId) {
            return jsonResponse(400, { ok: false, reason: 'PLAYER_ID_REQUIRED' });
        }

        const playerName = normalizeLeaderboardPlayerName(body && body.playerName);
        const score = clampLeaderboardScore(body && body.score);
        const mode = normalizeLeaderboardMode(body && body.mode);
        const cpuLevel = normalizeLeaderboardCpuLevel(body && body.cpuLevel);
        const scoreVersion = Number.isFinite(Number(body && body.scoreVersion)) ? Math.max(0, Math.trunc(Number(body.scoreVersion))) : null;
        const turnCount = Number.isFinite(Number(body && body.turnCount)) ? Math.max(0, Math.trunc(Number(body.turnCount))) : null;

        const store = await this.loadLeaderboardStore();
        const now = Date.now();
        const current = normalizeLeaderboardEntry(store.players[playerId], playerId);
        const previousBest = current ? current.bestScore : 0;
        const updated = score > previousBest;
        const bestScore = updated ? score : previousBest;
        const nextMode = (updated || !current) ? mode : current.mode;
        const nextCpuLevel = (updated || !current) ? cpuLevel : current.cpuLevel;
        const nextScoreVersion = (updated || !current) ? scoreVersion : current.scoreVersion;
        const nextTurnCount = (updated || !current) ? turnCount : current.turnCount;

        store.players[playerId] = {
            playerId,
            playerName,
            bestScore,
            lastScore: score,
            mode: nextMode,
            cpuLevel: nextCpuLevel,
            scoreVersion: nextScoreVersion,
            turnCount: nextTurnCount,
            updatedAt: updated ? now : (current ? current.updatedAt : now),
            submittedAt: now
        };

        const allRows = Object.values(store.players)
            .map((entry) => normalizeLeaderboardEntry(entry))
            .filter(isLeaderboardEntry);
        sortLeaderboardEntries(allRows);

        if (allRows.length > LEADERBOARD_MAX_STORED_PLAYERS) {
            const keep = new Set(allRows.slice(0, LEADERBOARD_MAX_STORED_PLAYERS).map((entry) => entry.playerId));
            for (const id of Object.keys(store.players)) {
                if (!keep.has(id)) delete store.players[id];
            }
        }

        store.updatedAt = now;
        await this.saveLeaderboardStore(store);

        const listLimit = normalizeLeaderboardLimit(body && body.limit);
        const entries = this.listLeaderboardEntries(store, listLimit);
        const playerRank = allRows.findIndex((entry) => entry.playerId === playerId) + 1;

        return jsonResponse(200, {
            ok: true,
            version: LEADERBOARD_STORAGE_VERSION,
            playerId,
            playerName,
            updated,
            previousBest,
            bestScore,
            score,
            rank: playerRank > 0 ? playerRank : null,
            entries,
            updatedAt: store.updatedAt,
            serverTime: Date.now()
        });
    }

    async handleLeaderboardList(urlObj: URL): Promise<Response> {
        const limit = normalizeLeaderboardLimit(urlObj && urlObj.searchParams ? urlObj.searchParams.get('limit') : LEADERBOARD_DEFAULT_LIMIT);
        const store = await this.loadLeaderboardStore();
        const entries = this.listLeaderboardEntries(store, limit);

        return jsonResponse(200, {
            ok: true,
            version: LEADERBOARD_STORAGE_VERSION,
            limit,
            entries,
            updatedAt: store.updatedAt,
            serverTime: Date.now()
        });
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

        if (request.method === 'GET' && pathname === '/api/leaderboard/list') {
            return this.handleLeaderboardList(urlObj);
        }

        if (request.method === 'POST' && pathname === '/internal/create') {
            const parsed = parseJsonBody(await request.text());
            if (parsed === null) return jsonResponse(400, { ok: false, reason: 'INVALID_JSON' });
            return this.handleInternalCreate(urlObj, parsed || {});
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

        if (request.method === 'POST' && pathname === '/api/match/publish') {
            const parsed = parseJsonBody(await request.text());
            if (parsed === null) return jsonResponse(400, { ok: false, reason: 'INVALID_JSON' });
            return this.handlePublish(parsed || {});
        }

        if (request.method === 'POST' && pathname === '/api/match/chat') {
            const parsed = parseJsonBody(await request.text());
            if (parsed === null) return jsonResponse(400, { ok: false, reason: 'INVALID_JSON' });
            return this.handleChat(parsed || {});
        }

        if (request.method === 'POST' && pathname === '/api/match/hand-skin') {
            const parsed = parseJsonBody(await request.text());
            if (parsed === null) return jsonResponse(400, { ok: false, reason: 'INVALID_JSON' });
            return this.handleHandSkin(parsed || {});
        }

        if (request.method === 'GET' && pathname === '/api/match/state') {
            return this.handleState(urlObj);
        }

        if (request.method === 'GET' && pathname === '/api/match/stream') {
            return this.handleStream(request);
        }

        return jsonResponse(404, { ok: false, reason: 'NOT_FOUND' });
    }

    async handleChat(body: Record<string, unknown>): Promise<Response> {
        await this.loadRoom();
        const room = this.room;

        if (!room) {
            return jsonResponse(404, { ok: false, reason: 'ROOM_NOT_FOUND' });
        }

        await this.applyExpiredTurnTimeoutIfNeeded();

        const seatKey = normalizePlayerKey(body.seatKey);
        const seatToken = String(body.seatToken || '').trim();
        const publicSeats = buildPublicSeatState(room).seats;
        if (!publicSeats[seatKey]) {
            return jsonResponse(403, withPublicSeatState(room, {
                ok: false,
                reason: 'SEAT_NOT_JOINED',
                turnTimer: toPublicTurnTimer(room, Date.now()),
                serverTime: Date.now()
            }));
        }
        if (!seatToken || !room.seatTokens || room.seatTokens[seatKey] !== seatToken) {
            return jsonResponse(403, withPublicSeatState(room, {
                ok: false,
                reason: 'SEAT_TOKEN_MISMATCH',
                turnTimer: toPublicTurnTimer(room, Date.now()),
                serverTime: Date.now()
            }));
        }
        if (!publicSeats.black || !publicSeats.white) {
            return jsonResponse(409, withPublicSeatState(room, {
                ok: false,
                reason: 'CHAT_DISABLED',
                turnTimer: toPublicTurnTimer(room, Date.now()),
                serverTime: Date.now()
            }));
        }

        const parsedText = parseChatMessageText(body.message);
        if (!parsedText.ok) {
            return jsonResponse(400, withPublicSeatState(room, {
                ok: false,
                reason: parsedText.reason,
                maxLength: CHAT_MAX_LENGTH,
                turnTimer: toPublicTurnTimer(room, Date.now()),
                serverTime: Date.now()
            }));
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
        await this.saveRoom();

        const payload = withPublicSeatState(room, {
            ok: true,
            roomId: room.roomId,
            type: 'message',
            message,
            networkDebugEnabled: toPublicNetworkDebugEnabled(room)
        });

        await this.broadcastChat(payload);

        return jsonResponse(200, withPublicSeatState(room, {
            ok: true,
            roomId: room.roomId,
            message,
            networkDebugEnabled: toPublicNetworkDebugEnabled(room),
            turnTimer: toPublicTurnTimer(room, Date.now()),
            serverTime: Date.now()
        }));
    }
}

assertMatchRoomDurableObjectConstructor(MatchRoomDurableObject);

const matchWorkerEntrypoint: MatchWorkerEntrypoint = assertMatchWorkerEntrypoint({
    async fetch(request, env) {
        const urlObj = new URL(request.url);

        if (urlObj.pathname.startsWith('/api/match/')) {
            return handleMatchApi(request, env);
        }

        if (urlObj.pathname.startsWith('/api/leaderboard/')) {
            return handleLeaderboardApi(request, env);
        }

        if (env.ASSETS && typeof env.ASSETS.fetch === 'function') {
            return env.ASSETS.fetch(request);
        }

        return new Response('Not Found', { status: 404 });
    }
});

export default matchWorkerEntrypoint;
