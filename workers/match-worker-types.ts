import type {
    MatchAuthorityBufferedSseEventRecord,
    MatchAuthorityBufferedSseEventRecordInput,
    MatchAuthorityPublishMeta,
    MatchAuthorityPublicSeats,
    MatchAuthoritySeatHandSkins,
    MatchAuthoritySeatNames,
    MatchAuthorityRoomState,
    MatchAuthoritySeatKey,
    MatchAuthorityViewer
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
        deleteAll?(): Promise<void> | void;
        getAlarm?(): Promise<number | Date | null> | number | Date | null;
        setAlarm?(value: number | Date): Promise<void> | void;
        deleteAlarm?(): Promise<void> | void;
    };
}

export interface MatchWorkerRoomState extends MatchAuthorityRoomState {
    inactiveSince?: number | null;
    eventSeq?: number | null;
    turnTimer?: Record<string, unknown> | null;
    chatMessages?: unknown[] | null;
    chatSeq?: number | null;
}

export interface MatchWorkerSseStreamInfo {
    writer: WritableStreamDefaultWriter<Uint8Array>;
    viewer: MatchAuthorityViewer;
}

export interface MatchWorkerPublicSeatState {
    seats: MatchAuthorityPublicSeats;
    seatNames: MatchAuthoritySeatNames;
    seatHandSkins: MatchAuthoritySeatHandSkins;
}

export interface MatchWorkerPreparedSnapshotBroadcast {
    eventId: string;
    record: MatchAuthorityBufferedSseEventRecordInput;
    payloadByViewer: Partial<Record<MatchAuthoritySeatKey | 'spectator', unknown>>;
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
    isGameOver(gameState: unknown): boolean;
    applyPass(gameState: unknown, playerKey?: unknown, options?: unknown): unknown;
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
    deckSpecHelpers: MatchWorkerDeckSpecHelpersModule;
    deckCodecModule: MatchWorkerDeckCodecModule;
}

export interface MatchWorkerDeckSpecHelpersModule extends MatchWorkerRuntimeModule {
    normalizeDeckSpec(deckSpec: unknown, options?: { requireFullDeck?: boolean }): unknown;
    summarizeDeckSpec(deckSpec: unknown): { deckSize?: unknown; [key: string]: unknown };
}

export interface MatchWorkerDeckCodecModule extends MatchWorkerRuntimeModule {
    decodeDeckCode(deckCode: string): unknown;
    encodeDeckSpec(deckSpec: unknown): string;
}

export interface MatchWorkerSeatValueMap<T> {
    black: T;
    white: T;
}

export interface MatchWorkerRoomDeckMetadata {
    mode: 'shared' | 'perPlayer';
    source: string;
    deckCode: string;
    deckSize: number | null;
    deckCodeByPlayer: MatchWorkerSeatValueMap<string>;
    deckSizeByPlayer: MatchWorkerSeatValueMap<number | null>;
}

export interface MatchWorkerDeckSelection {
    ok: boolean;
    hasCustomDeck: boolean;
    deckSpec: unknown | null;
    deckCode: string;
    deckSize: number | null;
    reason?: string;
    error?: unknown;
}

export interface MatchWorkerTurnStartOptions extends Record<string, unknown> {
    includeRawEvents?: unknown;
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

export interface MatchWorkerPublicSnapshot extends Record<string, unknown> {
    gameState?: unknown;
    cardState?: Record<string, unknown>;
}

export interface MatchWorkerPlaybackAdapter extends MatchWorkerRuntimeModule {
    mapToPlaybackEvents(presentationEvents: unknown[], cardState?: unknown, gameState?: unknown): unknown[] | null | undefined;
}

export interface MatchWorkerPlaybackDiagnostics {
    warnings?: unknown[];
    [key: string]: unknown;
}

export interface MatchWorkerPlaybackAssembly {
    playbackEvents: unknown[];
    diagnostics: MatchWorkerPlaybackDiagnostics | null;
    presentationEvents?: unknown[];
    playerKey?: MatchAuthoritySeatKey | null;
    effectLogs?: string[];
    [key: string]: unknown;
}

export interface MatchWorkerPublishPayloadOptions extends Record<string, unknown> {
    ok?: boolean;
    serverTime?: unknown;
    snapshot?: unknown;
    previousSnapshotForChargeDelta?: unknown;
    playbackEvents?: unknown;
    effectLogs?: unknown;
    idempotentReplay?: unknown;
    publishMeta?: Partial<MatchAuthorityPublishMeta> | null;
    rejectedReason?: unknown;
    errorMessage?: unknown;
    playbackDiagnostics?: unknown;
    autoPassNotice?: unknown;
}

export interface MatchWorkerSnapshotPayloadMeta extends Record<string, unknown> {
    playbackEvents?: unknown;
    effectLogs?: unknown;
    playbackDiagnostics?: unknown;
    autoPassNotice?: unknown;
    operationId?: unknown;
    playerKey?: unknown;
    actionType?: unknown;
}

export interface MatchWorkerPresencePayloadMeta extends Record<string, unknown> {
    type?: unknown;
    seatKey?: unknown;
    rejoined?: unknown;
}

export interface MatchWorkerRoomCreateOptions extends Record<string, unknown> {
    seed?: unknown;
    snapshot?: unknown;
    initialDeckSpec?: unknown;
    initialDeckSpecByPlayer?: unknown;
    roomDeck?: unknown;
    roomName?: unknown;
    roomBoardConfig?: unknown;
    networkDebugEnabled?: unknown;
}

export interface MatchWorkerTurnTimerOptions extends Record<string, unknown> {
    nowMs?: unknown;
    forceRestart?: unknown;
}

export interface MatchWorkerTurnTimeoutResult extends Record<string, unknown> {
    applied: boolean;
    stateVersion?: number;
    playerKey?: MatchAuthoritySeatKey;
}

export interface MatchWorkerParsedChatMessage {
    ok: boolean;
    text?: string;
    reason?: string;
}

export interface MatchWorkerTurnStartHandState {
    playerKey: MatchAuthoritySeatKey;
    hand: unknown[];
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
    handleSpectate(body: Record<string, unknown>): Promise<Response>;
    handleSpectatorLeave(body: Record<string, unknown>): Promise<Response>;
    handleHandSkin(body: Record<string, unknown>): Promise<Response>;
    handlePublish(body: Record<string, unknown>): Promise<Response>;
    handleRematchRequest(body: Record<string, unknown>): Promise<Response>;
    handleRematchResponse(body: Record<string, unknown>): Promise<Response>;
    handleState(urlObj: URL): Promise<Response>;
    handleStream(request: Request): Promise<Response>;
    handleChat(body: Record<string, unknown>): Promise<Response>;
    handleLeaderboardSubmit(body: Record<string, unknown>): Promise<Response>;
    handleLeaderboardList(urlObj: URL): Promise<Response>;
}

export interface MatchRoomDurableObjectConstructor {
    new (state: DurableObjectStateLike): MatchRoomDurableObjectApi;
}
