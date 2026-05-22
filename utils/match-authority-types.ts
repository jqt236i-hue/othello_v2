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

export interface MatchAuthorityPublishResponsePayload extends MatchAuthorityRoomPayload {
    publishMeta?: MatchAuthorityPublishMeta;
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
