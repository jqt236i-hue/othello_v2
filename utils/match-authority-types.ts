import type { PlayerKey } from '../src/types';

export type MatchAuthoritySeatKey = PlayerKey;

export type MatchAuthorityJsonObject = Record<string, unknown>;

export interface MatchAuthorityPublicSeats {
    black: boolean;
    white: boolean;
}

export interface MatchAuthoritySeatNames {
    black: string;
    white: string;
}

export interface MatchAuthoritySeatHandSkins {
    black: string;
    white: string;
}

export interface MatchAuthoritySeatPlayerIds {
    black: string;
    white: string;
}

export interface MatchAuthoritySeatTokens {
    black?: string;
    white?: string;
}

export type MatchAuthorityViewerRole = 'seat' | 'spectator';

export type MatchAuthorityPublishResponseMode = 'snapshot_compat' | 'ack_only';

export interface MatchAuthoritySpectatorState {
    token: string;
    name: string;
    joinedAt: number;
    lastSeenAt: number;
}

export interface MatchAuthoritySpectators {
    [spectatorId: string]: MatchAuthoritySpectatorState;
}

export interface MatchAuthoritySeatViewer {
    role: 'seat';
    seatKey: MatchAuthoritySeatKey;
}

export interface MatchAuthoritySpectatorViewer {
    role: 'spectator';
    spectatorId: string;
}

export type MatchAuthorityViewer = MatchAuthoritySeatViewer | MatchAuthoritySpectatorViewer;

export type MatchAuthorityPresentationPayloadKey = MatchAuthoritySeatKey | 'spectator';

export interface MatchAuthorityPresentationFramePayload {
    playbackEvents?: unknown[];
    playbackDigest?: string;
    effectLogs?: unknown[];
    playbackDiagnostics?: unknown | null;
}

export interface MatchAuthorityPresentationJournalEntry {
    visualSeq: number;
    stateVersionFrom: number;
    stateVersionTo: number;
    operationId: string | null;
    actorSeatKey: MatchAuthoritySeatKey | null;
    actionType: string | null;
    payloadByViewer: Partial<Record<MatchAuthorityPresentationPayloadKey, MatchAuthorityPresentationFramePayload>>;
    snapshotAfterByViewer: Partial<Record<MatchAuthorityPresentationPayloadKey, unknown>>;
    createdAt: number;
}

export interface MatchAuthorityPresentationFramePublic extends MatchAuthorityJsonObject {
    roomId: string | null;
    visualSeq: number;
    stateVersionFrom: number;
    stateVersionTo: number;
    operationId: string | null;
    actorSeatKey: MatchAuthoritySeatKey | null;
    actionType: string | null;
    playbackEvents: unknown[];
    playbackDigest: string;
    effectLogs: string[];
    playbackDiagnostics?: unknown | null;
    projectedSnapshotHash?: string | null;
    snapshotAfter?: unknown | null;
    createdAt: number;
}

export interface MatchAuthoritySpectatorJoinOptions {
    spectatorName?: unknown;
    makeSpectatorToken?: (() => string) | null;
    makeSpectatorId?: (() => string) | null;
    now?: unknown;
}

export type MatchAuthoritySpectatorJoinResult =
    | { ok: true; spectatorId: string; spectatorToken: string; spectatorName: string; spectatorCount: number; maxSpectators: number }
    | { ok: false; reason: 'SPECTATOR_FULL' | 'SPECTATOR_ID_COLLISION' };

export type MatchAuthoritySpectatorLeaveResult =
    | { ok: true; spectatorId: string; spectatorName: string; spectatorCount: number; maxSpectators: number }
    | { ok: false; reason: 'SPECTATOR_TOKEN_REQUIRED' | 'SPECTATOR_TOKEN_MISMATCH' };

export interface MatchAuthorityAcceptedOperationEntry {
    operationId: string;
    stateVersion: number | null;
    updatedAt: number | null;
    autoPassNotice?: {
        playerKey: MatchAuthoritySeatKey;
        reason: string;
        turnReturned?: boolean;
    };
}

export interface MatchAuthorityAcceptedOperationsBySeat {
    black: MatchAuthorityAcceptedOperationEntry | null;
    white: MatchAuthorityAcceptedOperationEntry | null;
}

export interface MatchAuthorityAcceptedOperationHistoryBySeat {
    black: MatchAuthorityAcceptedOperationEntry[];
    white: MatchAuthorityAcceptedOperationEntry[];
}

export interface MatchAuthorityRoomState extends MatchAuthorityJsonObject {
    roomId?: string | null;
    stateVersion?: number | null;
    createdAt?: number | null;
    updatedAt?: number | null;
    seed?: number | null;
    snapshot?: unknown;
    seats?: Partial<MatchAuthorityPublicSeats> | null;
    seatNames?: Partial<MatchAuthoritySeatNames> | null;
    seatHandSkins?: Partial<MatchAuthoritySeatHandSkins> | null;
    seatPlayerIds?: Partial<MatchAuthoritySeatPlayerIds> | null;
    seatTokens?: MatchAuthoritySeatTokens | null;
    spectators?: MatchAuthoritySpectators | null;
    lastAcceptedOperationBySeat?: Partial<MatchAuthorityAcceptedOperationsBySeat> | null;
    acceptedOperationHistoryBySeat?: Partial<MatchAuthorityAcceptedOperationHistoryBySeat> | null;
    sseEventBuffer?: MatchAuthorityBufferedSseEventRecord[] | null;
    visualSeq?: number | null;
    presentationJournal?: MatchAuthorityPresentationJournalEntry[] | null;
    initialSnapshotByViewer?: Partial<Record<MatchAuthorityPresentationPayloadKey, unknown>> | null;
    publishResponseMode?: MatchAuthorityPublishResponseMode | string | null;
    authorityLog?: unknown[] | null;
    authoritativeStateHash?: unknown;
    networkAutoEnabled?: boolean | null;
    allCardsDeckEnabled?: boolean | null;
    stoneSupplyEnabled?: boolean | null;
    initialDeckCardIdsByPlayer?: unknown;
}

export interface MatchAuthorityPublishMeta {
    kind: string | null;
    operationId: string;
    actionType: string | null;
    receivedBaseVersion: number | null;
    authoritativeStateVersion: number | null;
    replayedStateVersion: number | null;
    rejectedReason: string | null;
}

export interface MatchAuthorityAutoPassNotice {
    playerKey: MatchAuthoritySeatKey;
    reason: string;
    /** 2回目のパスで終局せず、先にパスした側へ手番が戻った（01-rulebook.md §8.2）。「続行」通知を続けて出す。 */
    turnReturned?: boolean;
}

export interface MatchAuthorityRoomPayloadOptions extends MatchAuthorityJsonObject {
    ok?: boolean;
    roomId?: unknown;
    roomName?: unknown;
    createdAt?: unknown;
    serverTime?: unknown;
    stateVersion?: unknown;
    snapshot?: unknown;
    seats?: unknown;
    seatNames?: unknown;
    seatHandSkins?: unknown;
    seatPlayerIds?: unknown;
    roomDeck?: unknown;
    roomBoardConfig?: unknown;
    networkDebugEnabled?: unknown;
    networkAutoEnabled?: unknown;
    turnTimer?: unknown;
    playbackEvents?: unknown;
    playbackDigest?: unknown;
    effectLogs?: unknown;
    rejectedReason?: unknown;
    idempotentReplay?: unknown;
    errorMessage?: unknown;
    playbackDiagnostics?: unknown;
    projectedSnapshotHash?: unknown;
    autoPassNotice?: unknown;
    type?: unknown;
    seatKey?: unknown;
    playerKey?: unknown;
    playerName?: unknown;
    seatToken?: unknown;
    rejoined?: unknown;
    selectedHandSkinId?: unknown;
    operationId?: unknown;
    requestId?: unknown;
    accepted?: unknown;
    actionType?: unknown;
    viewerRole?: unknown;
    spectatorId?: unknown;
    spectatorToken?: unknown;
    spectatorName?: unknown;
    spectatorCount?: unknown;
    maxSpectators?: unknown;
    presentationCursor?: unknown;
    presentationFrames?: unknown;
    baseVisualSeq?: unknown;
    baseSnapshot?: unknown;
    publishResponseMode?: unknown;
}

export interface MatchAuthorityRoomPayload extends MatchAuthorityJsonObject {
    ok: boolean;
    roomId: string | null;
    serverTime: number;
    createdAt?: number | null;
    stateVersion?: number | null;
    snapshot?: unknown;
    seats?: MatchAuthorityPublicSeats;
    seatNames?: MatchAuthoritySeatNames;
    seatHandSkins?: MatchAuthoritySeatHandSkins;
    seatPlayerIds?: MatchAuthoritySeatPlayerIds;
    roomDeck?: unknown;
    roomBoardConfig?: unknown;
    networkDebugEnabled?: boolean;
    networkAutoEnabled?: boolean;
    turnTimer?: unknown | null;
    playbackEvents?: unknown[];
    playbackDigest?: string;
    effectLogs?: string[];
    rejectedReason?: string | null;
    idempotentReplay?: true;
    errorMessage?: unknown;
    playbackDiagnostics?: unknown | null;
    projectedSnapshotHash?: unknown | null;
    autoPassNotice?: MatchAuthorityAutoPassNotice;
    type?: string | null;
    seatKey?: MatchAuthoritySeatKey | null;
    playerKey?: MatchAuthoritySeatKey | null;
    playerName?: string;
    seatToken?: string;
    rejoined?: boolean;
    selectedHandSkinId?: string;
    operationId?: string | null;
    requestId?: string;
    accepted?: boolean;
    actionType?: string | null;
    viewerRole?: MatchAuthorityViewerRole;
    spectatorId?: string;
    spectatorToken?: string;
    spectatorName?: string;
    spectatorCount?: number;
    maxSpectators?: number;
    presentationCursor?: unknown;
    presentationFrames?: unknown;
    baseVisualSeq?: number;
    baseSnapshot?: unknown;
}

export interface MatchAuthorityPublishResponseOptions extends MatchAuthorityRoomPayloadOptions {
    publishMeta?: Partial<MatchAuthorityPublishMeta> | null;
}

export interface MatchAuthorityRoomPayloadFromRoomOptions extends MatchAuthorityRoomPayloadOptions {}

export interface MatchAuthoritySnapshotPayloadFromRoomOptions extends MatchAuthorityRoomPayloadOptions {
    snapshot?: unknown;
    roomDeck?: unknown;
    networkDebugEnabled?: unknown;
    networkAutoEnabled?: unknown;
    turnTimer?: unknown;
    playbackEvents?: unknown;
    playbackDigest?: unknown;
    effectLogs?: unknown;
    playbackDiagnostics?: unknown;
    operationId?: unknown;
    playerKey?: unknown;
    actionType?: unknown;
}

export interface MatchAuthorityPresencePayloadFromRoomOptions extends MatchAuthorityRoomPayloadOptions {
    roomDeck?: unknown;
    networkDebugEnabled?: unknown;
    networkAutoEnabled?: unknown;
    turnTimer?: unknown;
    type?: unknown;
    seatKey?: unknown;
    playerName?: unknown;
    rejoined?: unknown;
    spectatorId?: unknown;
    spectatorName?: unknown;
    spectatorCount?: unknown;
    maxSpectators?: unknown;
    requestId?: unknown;
    accepted?: unknown;
}

export interface MatchAuthorityHeartbeatPayloadFromRoomOptions extends MatchAuthorityRoomPayloadOptions {
    roomDeck?: unknown;
    networkDebugEnabled?: unknown;
    networkAutoEnabled?: unknown;
    turnTimer?: unknown;
}

export interface MatchAuthorityPublishPayloadFromRoomOptions extends MatchAuthorityPublishResponseOptions {
    snapshot?: unknown;
    roomDeck?: unknown;
    networkDebugEnabled?: unknown;
    networkAutoEnabled?: unknown;
    turnTimer?: unknown;
    playbackEvents?: unknown;
    playbackDigest?: unknown;
    effectLogs?: unknown;
    playbackDiagnostics?: unknown;
    rejectedReason?: unknown;
    idempotentReplay?: unknown;
    errorMessage?: unknown;
}

export interface MatchAuthorityPublishResponsePayload extends MatchAuthorityRoomPayload {
    publishMeta?: MatchAuthorityPublishMeta;
}

export interface MatchAuthorityBoardExpansionCell extends MatchAuthorityJsonObject {
    row: number;
    col: number;
    side?: string;
    owner: -1 | 0 | 1;
}

export interface MatchAuthorityBoardExpansionState extends MatchAuthorityJsonObject {
    cells: MatchAuthorityBoardExpansionCell[];
}

export interface MatchAuthorityGameState extends MatchAuthorityJsonObject {
    board: unknown[][];
    boardConfig?: MatchAuthorityJsonObject;
    boardExpansion?: MatchAuthorityBoardExpansionState;
}

export interface MatchAuthoritySnapshotMeta extends MatchAuthorityJsonObject {
    authority?: string;
    version?: number | null;
    boardContractVersion?: number | null;
    projectedForSeat?: MatchAuthoritySeatKey | null;
    viewerRole?: MatchAuthorityViewerRole | null;
    turnStartReconciled?: boolean;
    projectedSnapshotHash?: string | null;
    authoritativeStateHash?: string | null;
}

export interface MatchAuthorityPublicSnapshot extends MatchAuthorityJsonObject {
    gameState?: MatchAuthorityGameState;
    cardState?: MatchAuthorityJsonObject;
    _meta?: MatchAuthoritySnapshotMeta;
    stateVersion?: number | null;
    updatedAt?: number | null;
    projectedForSeat?: MatchAuthoritySeatKey | null;
    projectedAt?: number;
    turnStartReconciled?: boolean;
}

export interface MatchAuthorityProjectionMetadata {
    stateVersion?: number | null;
    updatedAt?: number | null;
    projectedForSeat?: MatchAuthoritySeatKey | null;
    viewerRole?: MatchAuthorityViewerRole | null;
    turnStartReconciled?: boolean;
}

export interface MatchAuthorityBoardContractInspection {
    ok: boolean;
    version: number | null;
    legacy: boolean;
    migrated: boolean;
    errors: string[];
    warnings: string[];
}

export interface MatchAuthoritySeatLeaveOptions {
    now?: unknown;
    makeSeatToken?: (() => string) | null;
}

export interface MatchAuthoritySeatLeaveResult {
    seatKey: MatchAuthoritySeatKey;
    updatedAt: number;
    seatToken: string;
    seats: Partial<MatchAuthorityPublicSeats>;
    seatNames: Partial<MatchAuthoritySeatNames>;
    seatHandSkins: Partial<MatchAuthoritySeatHandSkins>;
    seatPlayerIds: Partial<MatchAuthoritySeatPlayerIds>;
}

export type MatchAuthoritySeatTokenRejectionReason = 'SEAT_TOKEN_MISMATCH' | 'SEAT_TOKEN_REQUIRED';

export interface MatchAuthorityBufferedSsePayloadByViewer {
    black?: unknown;
    white?: unknown;
    spectator?: unknown;
}

export interface MatchAuthorityBufferedSseEventRecordInput {
    eventId?: unknown;
    eventName?: unknown;
    payload?: unknown;
    payloadByViewer?: MatchAuthorityBufferedSsePayloadByViewer | null;
}

export interface MatchAuthorityBufferedSseEventRecord {
    id: string;
    event: string;
    payload?: unknown;
    payloadByViewer?: MatchAuthorityBufferedSsePayloadByViewer;
}

export interface MatchAuthorityBufferedSseReplayEvent {
    eventId: string;
    eventName: string;
    payload: unknown;
    replayIndex?: number;
    replayCount?: number;
    replayRemaining?: number;
}

export interface MatchAuthorityPublicApi {
    BOARD_CONTRACT_VERSION: number;
    CHAT_MAX_LENGTH: number;
    CHAT_HISTORY_LIMIT: number;
    NETWORK_TURN_LIMIT_SECONDS: number;
    NETWORK_TURN_LIMIT_MIN_SECONDS: number;
    NETWORK_TURN_LIMIT_MAX_SECONDS: number;
    NETWORK_TURN_LIMIT_MS: number;
    normalizeNetworkTurnLimitSeconds(value: unknown, fallback?: unknown): number;
    SSE_HEARTBEAT_INTERVAL_MS: number;
    normalizePublishMeta(value: unknown): MatchAuthorityPublishMeta;
    ensureAcceptedOperationsBySeat(roomValue: MatchAuthorityRoomState | null | undefined): MatchAuthorityAcceptedOperationsBySeat;
    ensureAcceptedOperationHistoryBySeat(roomValue: MatchAuthorityRoomState | null | undefined): MatchAuthorityAcceptedOperationHistoryBySeat;
    findAcceptedOperationBySeat(roomValue: MatchAuthorityRoomState | null | undefined, seatKey: unknown, operationId: unknown): MatchAuthorityAcceptedOperationEntry | null;
    resolveAcceptedOperation(
        roomValue: MatchAuthorityRoomState | null | undefined,
        seatKey: unknown,
        operationId: unknown,
        fallbackEntry?: unknown
    ): MatchAuthorityAcceptedOperationEntry | null;
    rememberAcceptedOperationBySeat(
        roomValue: MatchAuthorityRoomState | null | undefined,
        seatKey: unknown,
        entry: unknown
    ): MatchAuthorityAcceptedOperationEntry | null;
    normalizePublishResponseMode(value: unknown): MatchAuthorityPublishResponseMode;
    shouldUseAckOnlyPublishResponse(roomValue: MatchAuthorityRoomState | null | undefined, options?: MatchAuthorityPublishResponseOptions | null): boolean;
    buildPublishAckPayloadFromRoom(roomValue: MatchAuthorityRoomState | null | undefined, options?: MatchAuthorityPublishPayloadFromRoomOptions | null): MatchAuthorityPublishResponsePayload;
    buildPublishResponsePayload(options: MatchAuthorityPublishResponseOptions): MatchAuthorityPublishResponsePayload;
    buildRoomPayload(options: MatchAuthorityRoomPayloadOptions): MatchAuthorityRoomPayload;
    buildRoomPayloadFromRoom(roomValue: MatchAuthorityRoomState | null | undefined, options?: MatchAuthorityRoomPayloadFromRoomOptions | null): MatchAuthorityRoomPayload;
    buildSnapshotPayloadFromRoom(roomValue: MatchAuthorityRoomState | null | undefined, options?: MatchAuthoritySnapshotPayloadFromRoomOptions | null): MatchAuthorityRoomPayload;
    buildPresencePayloadFromRoom(roomValue: MatchAuthorityRoomState | null | undefined, options?: MatchAuthorityPresencePayloadFromRoomOptions | null): MatchAuthorityRoomPayload;
    buildHeartbeatPayloadFromRoom(roomValue: MatchAuthorityRoomState | null | undefined, options?: MatchAuthorityHeartbeatPayloadFromRoomOptions | null): MatchAuthorityRoomPayload;
    buildPublishPayloadFromRoom(roomValue: MatchAuthorityRoomState | null | undefined, options?: MatchAuthorityPublishPayloadFromRoomOptions | null): MatchAuthorityPublishResponsePayload;
    makeSpectatorToken(makeSeatTokenFn?: (() => string)): string;
    makeSpectatorId(makeSeatTokenFn?: (() => string)): string;
    makeRematchRequestId(makeSeatTokenFn?: (() => string), nowFn?: (() => number)): string;
    getPlaybackAssemblyWarnings(diagnostics: unknown): string[];
    toDebugPlaybackDiagnostics(diagnostics: unknown, networkDebugEnabled: unknown): unknown | null;
    reportPlaybackAssemblyDiagnostics(context: unknown, diagnostics: unknown, options?: unknown): void;
    readSnapshotBoardContractVersion(snapshotValue: unknown): number | null;
    inspectSnapshotBoardContract(
        snapshotValue: unknown,
        options?: { allowLegacy?: boolean; requireFullSnapshot?: boolean }
    ): MatchAuthorityBoardContractInspection;
    normalizeSnapshotBoardContract(
        snapshotValue: unknown,
        options?: { allowLegacy?: boolean; requireFullSnapshot?: boolean }
    ): MatchAuthorityBoardContractInspection;
    stampSnapshotBoardContract(snapshotValue: unknown): boolean;
    countSnapshotBoardDiscs(
        snapshotValue: unknown,
        boardUtilsOverride?: Record<string, unknown> | null
    ): { black: number; white: number } | null;
    projectSnapshotForViewer(snapshotValue: unknown, viewerSeatKey: unknown, metadata?: MatchAuthorityProjectionMetadata): MatchAuthorityPublicSnapshot;
    buildPublicSnapshotForViewer(roomValue: MatchAuthorityRoomState | null | undefined, viewerValue: unknown): MatchAuthorityPublicSnapshot;
    buildPublicSnapshot(roomValue: MatchAuthorityRoomState | null | undefined, viewerSeatKey: unknown): MatchAuthorityPublicSnapshot;
    resolveSeatForJoin(roomValue: MatchAuthorityRoomState | null | undefined, requestedSeatKey: unknown, providedToken: unknown): MatchAuthoritySeatKey | null;
    applySeatLeaveToRoom(roomValue: MatchAuthorityRoomState | null | undefined, seatKeyValue: unknown, options?: MatchAuthoritySeatLeaveOptions | null): MatchAuthoritySeatLeaveResult | null;
    addSpectatorToRoom(roomValue: MatchAuthorityRoomState | null | undefined, options?: MatchAuthoritySpectatorJoinOptions | null): MatchAuthoritySpectatorJoinResult;
    removeSpectatorFromRoom(roomValue: MatchAuthorityRoomState | null | undefined, options?: Record<string, unknown> | null): MatchAuthoritySpectatorLeaveResult;
    resolveAuthenticatedViewer(roomValue: MatchAuthorityRoomState | null | undefined, options?: Record<string, unknown> | null): MatchAuthorityViewer | null;
    getPayloadKeyForViewer(viewerValue: unknown): MatchAuthoritySeatKey | 'spectator';
    resolveAuthenticatedSeatKey(roomValue: MatchAuthorityRoomState | null | undefined, seatKeyValue: unknown, seatTokenValue: unknown): MatchAuthoritySeatKey | null;
    classifySeatTokenRejectionReason(seatTokenValue: unknown): MatchAuthoritySeatTokenRejectionReason;
    createBufferedSseEventRecord(options: MatchAuthorityBufferedSseEventRecordInput): MatchAuthorityBufferedSseEventRecord | null;
    appendBufferedSseEvent(
        bufferValue: unknown,
        recordValue: MatchAuthorityBufferedSseEventRecordInput,
        limitValue?: unknown
    ): MatchAuthorityBufferedSseEventRecord[];
    getBufferedSseReplayEvents(
        bufferValue: unknown,
        lastEventIdValue: unknown,
        viewerSeatKey: unknown
    ): MatchAuthorityBufferedSseReplayEvent[] | null;
    getBufferedSnapshotPayloadForStateVersion(
        bufferValue: unknown,
        stateVersionValue: unknown,
        viewerSeatKey: unknown
    ): unknown | null;
    appendPresentationFrame(roomValue: MatchAuthorityRoomState | null | undefined, inputValue: unknown): MatchAuthorityPresentationJournalEntry | null;
    getPresentationFramesAfter(
        roomValue: MatchAuthorityRoomState | null | undefined,
        afterVisualSeq: unknown,
        viewerValue: unknown
    ): MatchAuthorityPresentationFramePublic[];
    buildPresentationJournalResponse(
        roomValue: MatchAuthorityRoomState | null | undefined,
        options?: Record<string, unknown> | null
    ): Record<string, unknown>;
    toPublicPresentationFrame(
        entryValue: unknown,
        viewerValue: unknown,
        roomValue?: MatchAuthorityRoomState | null | undefined
    ): MatchAuthorityPresentationFramePublic;
}
