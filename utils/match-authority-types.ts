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

export interface MatchAuthoritySeatTokens {
    black?: string;
    white?: string;
}

export interface MatchAuthorityAcceptedOperationEntry {
    operationId: string;
    stateVersion: number | null;
    updatedAt: number | null;
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
    updatedAt?: number | null;
    seed?: number | null;
    snapshot?: unknown;
    seats?: Partial<MatchAuthorityPublicSeats> | null;
    seatNames?: Partial<MatchAuthoritySeatNames> | null;
    seatHandSkins?: Partial<MatchAuthoritySeatHandSkins> | null;
    seatTokens?: MatchAuthoritySeatTokens | null;
    lastAcceptedOperationBySeat?: Partial<MatchAuthorityAcceptedOperationsBySeat> | null;
    acceptedOperationHistoryBySeat?: Partial<MatchAuthorityAcceptedOperationHistoryBySeat> | null;
    sseEventBuffer?: MatchAuthorityBufferedSseEventRecord[] | null;
    authorityLog?: unknown[] | null;
    authoritativeStateHash?: unknown;
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

export interface MatchAuthorityRoomPayloadOptions extends MatchAuthorityJsonObject {
    ok?: boolean;
    roomId?: unknown;
    serverTime?: unknown;
    stateVersion?: unknown;
    snapshot?: unknown;
    seats?: unknown;
    seatNames?: unknown;
    seatHandSkins?: unknown;
    roomDeck?: unknown;
    roomBoardConfig?: unknown;
    networkDebugEnabled?: unknown;
    turnTimer?: unknown;
    playbackEvents?: unknown;
    effectLogs?: unknown;
    rejectedReason?: unknown;
    idempotentReplay?: unknown;
    errorMessage?: unknown;
    playbackDiagnostics?: unknown;
    projectedSnapshotHash?: unknown;
    type?: unknown;
    seatKey?: unknown;
    playerKey?: unknown;
    playerName?: unknown;
    seatToken?: unknown;
    rejoined?: unknown;
    selectedHandSkinId?: unknown;
    operationId?: unknown;
    actionType?: unknown;
}

export interface MatchAuthorityRoomPayload extends MatchAuthorityJsonObject {
    ok: boolean;
    roomId: string | null;
    serverTime: number;
    stateVersion?: number | null;
    snapshot?: unknown;
    seats?: MatchAuthorityPublicSeats;
    seatNames?: MatchAuthoritySeatNames;
    seatHandSkins?: MatchAuthoritySeatHandSkins;
    roomDeck?: unknown;
    roomBoardConfig?: unknown;
    networkDebugEnabled?: boolean;
    turnTimer?: unknown | null;
    playbackEvents?: unknown[];
    effectLogs?: string[];
    rejectedReason?: string | null;
    idempotentReplay?: true;
    errorMessage?: unknown;
    playbackDiagnostics?: unknown | null;
    projectedSnapshotHash?: unknown | null;
    type?: string | null;
    seatKey?: MatchAuthoritySeatKey | null;
    playerKey?: MatchAuthoritySeatKey | null;
    playerName?: string;
    seatToken?: string;
    rejoined?: boolean;
    selectedHandSkinId?: string;
    operationId?: string | null;
    actionType?: string | null;
}

export interface MatchAuthorityPublishResponseOptions extends MatchAuthorityRoomPayloadOptions {
    publishMeta?: Partial<MatchAuthorityPublishMeta> | null;
}

export interface MatchAuthorityRoomPayloadFromRoomOptions extends MatchAuthorityRoomPayloadOptions {}

export interface MatchAuthoritySnapshotPayloadFromRoomOptions extends MatchAuthorityRoomPayloadOptions {
    snapshot?: unknown;
    roomDeck?: unknown;
    networkDebugEnabled?: unknown;
    turnTimer?: unknown;
    playbackEvents?: unknown;
    effectLogs?: unknown;
    playbackDiagnostics?: unknown;
    operationId?: unknown;
    playerKey?: unknown;
    actionType?: unknown;
}

export interface MatchAuthorityPresencePayloadFromRoomOptions extends MatchAuthorityRoomPayloadOptions {
    roomDeck?: unknown;
    networkDebugEnabled?: unknown;
    turnTimer?: unknown;
    type?: unknown;
    seatKey?: unknown;
    playerName?: unknown;
    rejoined?: unknown;
}

export interface MatchAuthorityHeartbeatPayloadFromRoomOptions extends MatchAuthorityRoomPayloadOptions {
    roomDeck?: unknown;
    networkDebugEnabled?: unknown;
    turnTimer?: unknown;
}

export interface MatchAuthorityPublishPayloadFromRoomOptions extends MatchAuthorityPublishResponseOptions {
    snapshot?: unknown;
    roomDeck?: unknown;
    networkDebugEnabled?: unknown;
    turnTimer?: unknown;
    playbackEvents?: unknown;
    effectLogs?: unknown;
    playbackDiagnostics?: unknown;
    rejectedReason?: unknown;
    idempotentReplay?: unknown;
    errorMessage?: unknown;
}

export interface MatchAuthorityPublishResponsePayload extends MatchAuthorityRoomPayload {
    publishMeta?: MatchAuthorityPublishMeta;
}

export interface MatchAuthorityPublicSnapshot extends MatchAuthorityJsonObject {
    gameState?: unknown;
    cardState?: unknown;
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
    turnStartReconciled?: boolean;
}

export interface MatchAuthoritySeatLeaveOptions {
    now?: unknown;
    makeSeatToken?: (() => string) | null;
}

export interface MatchAuthoritySeatLeaveResult {
    seatKey: MatchAuthoritySeatKey;
    updatedAt: number;
    seatToken: string;
    seats: MatchAuthorityPublicSeats;
    seatNames: MatchAuthoritySeatNames;
    seatHandSkins: MatchAuthoritySeatHandSkins;
}

export interface MatchAuthorityBufferedSsePayloadByViewer {
    black?: unknown;
    white?: unknown;
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
}

export interface MatchAuthorityPublicApi {
    normalizePublishMeta(value: unknown): MatchAuthorityPublishMeta;
    buildPublishResponsePayload(options: MatchAuthorityPublishResponseOptions): MatchAuthorityPublishResponsePayload;
    buildRoomPayload(options: MatchAuthorityRoomPayloadOptions): MatchAuthorityRoomPayload;
    buildRoomPayloadFromRoom(roomValue: MatchAuthorityRoomState | null | undefined, options?: MatchAuthorityRoomPayloadFromRoomOptions | null): MatchAuthorityRoomPayload;
    buildSnapshotPayloadFromRoom(roomValue: MatchAuthorityRoomState | null | undefined, options?: MatchAuthoritySnapshotPayloadFromRoomOptions | null): MatchAuthorityRoomPayload;
    buildPresencePayloadFromRoom(roomValue: MatchAuthorityRoomState | null | undefined, options?: MatchAuthorityPresencePayloadFromRoomOptions | null): MatchAuthorityRoomPayload;
    buildHeartbeatPayloadFromRoom(roomValue: MatchAuthorityRoomState | null | undefined, options?: MatchAuthorityHeartbeatPayloadFromRoomOptions | null): MatchAuthorityRoomPayload;
    buildPublishPayloadFromRoom(roomValue: MatchAuthorityRoomState | null | undefined, options?: MatchAuthorityPublishPayloadFromRoomOptions | null): MatchAuthorityPublishResponsePayload;
    projectSnapshotForViewer(snapshotValue: unknown, viewerSeatKey: unknown, metadata?: MatchAuthorityProjectionMetadata): MatchAuthorityPublicSnapshot;
    buildPublicSnapshot(roomValue: MatchAuthorityRoomState | null | undefined, viewerSeatKey: unknown): MatchAuthorityPublicSnapshot;
    resolveSeatForJoin(roomValue: MatchAuthorityRoomState | null | undefined, requestedSeatKey: unknown, providedToken: unknown): MatchAuthoritySeatKey | null;
    applySeatLeaveToRoom(roomValue: MatchAuthorityRoomState | null | undefined, seatKeyValue: unknown, options?: MatchAuthoritySeatLeaveOptions | null): MatchAuthoritySeatLeaveResult | null;
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
}
