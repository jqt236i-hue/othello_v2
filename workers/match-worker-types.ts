import type {
    MatchAuthorityBufferedSseEventRecord,
    MatchAuthorityRoomState,
    MatchAuthoritySeatKey
} from '../utils/match-authority-types';

export interface MatchWorkerEnv {
    MATCH_ROOM?: DurableObjectNamespaceLike;
    LEADERBOARD_ROOM?: DurableObjectNamespaceLike;
    ASSETS?: { fetch(request: Request): Response | Promise<Response> };
    [key: string]: unknown;
}

export interface DurableObjectNamespaceLike {
    idFromName(name: string): unknown;
    get(id: unknown): { fetch(request: Request): Response | Promise<Response> };
}

export interface DurableObjectStateLike {
    storage: {
        get(key: string): Promise<unknown> | unknown;
        put(key: string, value: unknown): Promise<void> | void;
        delete(key: string): Promise<boolean | void> | boolean | void;
        setAlarm?(value: number | Date): Promise<void> | void;
        deleteAlarm?(): Promise<void> | void;
    };
}

export interface MatchWorkerRoomState extends MatchAuthorityRoomState {
    eventSeq?: number | null;
    turnTimer?: Record<string, unknown> | null;
    chatMessages?: unknown[] | null;
    chatSeq?: number | null;
}

export interface MatchWorkerSseStreamInfo {
    writer: WritableStreamDefaultWriter<Uint8Array>;
    seatKey: MatchAuthoritySeatKey;
}

export interface MatchWorkerPreparedSnapshotBroadcast {
    eventId: string;
    record: unknown;
    payloadByViewer: Partial<Record<MatchAuthoritySeatKey, unknown>>;
    fallbackPayload: unknown;
}

export interface MatchWorkerLeaderboardStore {
    version: number;
    players: Record<string, MatchWorkerLeaderboardEntry>;
    updatedAt: number;
}

export type MatchWorkerLeaderboardMode = 'cpu' | 'network';

export interface MatchWorkerLeaderboardEntry {
    playerId: string;
    playerName: string;
    bestScore: number;
    lastScore: number;
    mode: MatchWorkerLeaderboardMode;
    cpuLevel: number | null;
    scoreVersion: number | null;
    turnCount: number | null;
    updatedAt: number;
    submittedAt: number;
}

export interface MatchWorkerRuntimeModule {
    [key: string]: unknown;
}

export interface MatchWorkerPrng {
    random(): number;
    getState?: () => unknown;
    [key: string]: unknown;
}

export interface MatchWorkerCoreModule extends MatchWorkerRuntimeModule {
    BLACK?: unknown;
    WHITE?: unknown;
    createGameState(boardConfig?: unknown): unknown;
    applyPass?: (gameState: unknown, playerKey?: unknown, options?: unknown) => unknown;
}

export interface MatchWorkerCardLogicModule extends MatchWorkerRuntimeModule {
    createCardState(prng?: unknown, options?: unknown): unknown;
    flushPresentationEvents?: (cardState: unknown) => unknown;
}

export interface MatchWorkerTurnPipelinePhasesModule extends MatchWorkerRuntimeModule {
    applyTurnStartPhase(
        CardLogic: MatchWorkerCardLogicModule,
        Core: MatchWorkerCoreModule,
        cardState: unknown,
        gameState: unknown,
        playerKey: unknown,
        events: unknown[],
        prng?: unknown
    ): void;
    applyCardUsagePhase(
        CardLogic: MatchWorkerCardLogicModule,
        cardState: unknown,
        gameState: unknown,
        playerKey: unknown,
        action: unknown,
        events: unknown[],
        prng?: unknown
    ): void;
    applyActionPhase(
        CardLogic: MatchWorkerCardLogicModule,
        Core: MatchWorkerCoreModule,
        cardState: unknown,
        gameState: unknown,
        playerKey: unknown,
        action: unknown,
        events: unknown[],
        prng?: unknown,
        BoardOps?: MatchWorkerRuntimeModule
    ): void;
}

export interface MatchWorkerSeededPrngModule extends MatchWorkerRuntimeModule {
    createPRNG(seed?: unknown): MatchWorkerPrng;
    fromState?(state: unknown): MatchWorkerPrng;
}

export interface MatchWorkerDeckGlobals {
    deckSpecHelpers: MatchWorkerRuntimeModule;
    deckCodecModule: MatchWorkerRuntimeModule;
}

export interface MatchWorkerTurnStartModules {
    Core: MatchWorkerCoreModule;
    CardLogic: MatchWorkerCardLogicModule;
    TurnPipelinePhases: MatchWorkerTurnPipelinePhasesModule;
    SeededPRNG: MatchWorkerSeededPrngModule;
}

export interface MatchWorkerTurnPipelineResult {
    gameState: unknown;
    cardState: unknown;
    events: unknown[];
    presentationEvents?: unknown[];
}

export interface MatchWorkerTurnPipelineSafeResult extends MatchWorkerTurnPipelineResult {
    ok: boolean;
    nextStateVersion: number;
    stateHash?: unknown;
    rejectedReason?: string;
    errorMessage?: string;
}

export interface MatchWorkerTurnPipelineModule {
    applyTurn(
        cardState: unknown,
        gameState: unknown,
        playerKey: unknown,
        action: unknown,
        prng?: unknown,
        options?: Record<string, unknown> | null
    ): MatchWorkerTurnPipelineResult;
    applyTurnSafe(
        cardState: unknown,
        gameState: unknown,
        playerKey: unknown,
        action: unknown,
        prng?: unknown,
        options?: Record<string, unknown> | null
    ): MatchWorkerTurnPipelineSafeResult;
}

export interface MatchWorkerTurnPipelineModules {
    TurnPipeline: MatchWorkerTurnPipelineModule;
    SeededPRNG: MatchWorkerSeededPrngModule;
    TurnPipelineUIAdapter: MatchWorkerRuntimeModule;
    CardLogic: MatchWorkerCardLogicModule;
}

export interface MatchWorkerEntrypoint {
    fetch(request: Request, env: MatchWorkerEnv): Promise<Response>;
}

export interface MatchRoomDurableObjectApi {
    fetch(request: Request): Promise<Response>;
    handleInternalCreate(urlObj: URL, body: Record<string, unknown>): Promise<Response>;
    handleJoin(body: Record<string, unknown>): Promise<Response>;
    handleLeave(body: Record<string, unknown>): Promise<Response>;
    handleHandSkin(body: Record<string, unknown>): Promise<Response>;
    handlePublish(body: Record<string, unknown>): Promise<Response>;
    handleState(urlObj: URL): Promise<Response>;
    handleStream(request: Request): Promise<Response>;
    handleChat(body: Record<string, unknown>): Promise<Response>;
    handleLeaderboardSubmit(body: Record<string, unknown>): Promise<Response>;
    handleLeaderboardList(urlObj: URL): Promise<Response>;
}

export interface MatchRoomDurableObjectConstructor {
    new (state: DurableObjectStateLike): MatchRoomDurableObjectApi;
}
