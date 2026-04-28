export const PLAYER_KEYS: readonly string[];
export const OPERATION_ID_MAX_LENGTH: 128;
export const SSE_RESUME_BUFFER_LIMIT: 96;
export const NETWORK_PLAYER_NAME_MAX: 7;
export const NETWORK_DEBUG_FILL_HAND_ACTION: "debug_fill_hand";
export const ROOM_ID_CHARS: "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export const ROOM_ID_LENGTH: 3;
export const SEAT_TOKEN_CHARS: "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
export const SEAT_TOKEN_LENGTH: 24;
export const VERSION_REJECTION_REASONS: Readonly<{
    AHEAD: "VERSION_AHEAD";
    BEHIND: "VERSION_BEHIND";
    GAP: "VERSION_GAP";
    MISMATCH: "VERSION_MISMATCH";
}>;
export function randomFromChars(chars: any, length: any, explicitCrypto: any): string;
export function makeRoomId(explicitCrypto: any): string;
export function makeSeatToken(explicitCrypto: any): string;
export function makeSseStreamId(nowValue: any, explicitCrypto: any): string;
export function parseSeatKeyOptional(value: any): "black" | "white" | null;
export function normalizePlayerKey(value: any, fallback: any): "black" | "white";
export function getCurrentPlayerKey(gameState: any): "black" | "white";
export function getOpponentKey(playerKey: any): "black" | "white";
export function normalizeOperationId(value: any): string;
export function normalizeSeatHandSkinId(value: any): string;
export function normalizeSeatHandSkins(value: any): {
    black: string;
    white: string;
};
export function normalizeNetworkPlayerName(value: any): string;
export function normalizePublicSeats(value: any): {
    black: boolean;
    white: boolean;
};
export function buildPublicSeatMetadata(value: any): {
    seats: {
        black: boolean;
        white: boolean;
    };
    seatNames: {
        black: string;
        white: string;
    };
    seatHandSkins: {
        black: string;
        white: string;
    };
};
export function hasRequiredOperationId(value: any): boolean;
export function ensureAcceptedOperationsBySeat(room: any): {
    black: any;
    white: any;
};
export function ensureAcceptedOperationHistoryBySeat(room: any): {
    black: never[];
    white: never[];
};
export function findAcceptedOperationBySeat(room: any, seatKey: any, operationId: any): any;
export function resolveAcceptedOperation(room: any, seatKey: any, operationId: any, fallbackEntry: any): any;
export function rememberAcceptedOperationBySeat(room: any, seatKey: any, entry: any): null;
export function classifyVersionRejectionReason(receivedBaseVersionValue: any, authoritativeStateVersionValue: any): "VERSION_BEHIND" | "VERSION_AHEAD" | "VERSION_MISMATCH" | "VERSION_GAP";
export function isVersionRejectionReason(reasonValue: any): boolean;
export function makeHiddenHandToken(ownerKey: any, handIndex: any): string;
export function parseHiddenHandToken(value: any): {
    ownerKey: string;
    handIndex: number;
} | null;
export function resolveAuthenticatedSeatKey(room: any, seatKeyValue: any, seatTokenValue: any): "black" | "white" | null;
export function classifySeatTokenRejectionReason(seatTokenValue: any): "SEAT_TOKEN_MISMATCH" | "SEAT_TOKEN_REQUIRED";
/**
 * Returns the FATE_WILL controller seat key for the given turn owner, or null if none.
 * Reads from snapshot.cardState.fateWillControllerByTurnOwner.
 */
export function getFateWillControllerKey(snapshot: any, turnOwnerKey: any): "black" | "white" | null;
/**
 * Returns true if seatKey is the authenticated FATE_WILL controller for the current turn owner.
 * Only valid when it is currently the turn owner's turn (gameState.currentPlayer === turnOwnerKey).
 */
export function isFateWillControllerForCurrentTurn(snapshot: any, seatKey: any): boolean;
export function canViewerInspectOwnerHand(snapshot: any, viewerSeatKey: any, ownerSeatKey: any): boolean;
export function normalizePublishMeta(value: any): {
    kind: string | null;
    operationId: string;
    actionType: string | null;
    receivedBaseVersion: number | null;
    authoritativeStateVersion: number | null;
    replayedStateVersion: number | null;
    rejectedReason: string | null;
};
export function buildRoomPayload(options: any): {
    ok: boolean;
    roomId: string | null;
    serverTime: number;
};
export function buildRoomPayloadFromRoom(roomValue: any, options: any): {
    ok: boolean;
    roomId: string | null;
    serverTime: number;
};
export function buildSnapshotPayloadFromRoom(roomValue: any, options: any): {
    ok: boolean;
    roomId: string | null;
    serverTime: number;
};
export function buildPresencePayloadFromRoom(roomValue: any, options: any): {
    ok: boolean;
    roomId: string | null;
    serverTime: number;
};
export function buildHeartbeatPayloadFromRoom(roomValue: any, options: any): {
    ok: boolean;
    roomId: string | null;
    serverTime: number;
};
export function buildPublishPayloadFromRoom(roomValue: any, options: any): {
    ok: boolean;
    roomId: string | null;
    serverTime: number;
};
export function buildPublishResponseOptions(options: any): {
    ok: boolean;
    publishMeta: {
        kind: string | null;
        operationId: string;
        actionType: string | null;
        receivedBaseVersion: number | null;
        authoritativeStateVersion: number | null;
        replayedStateVersion: number | null;
        rejectedReason: string | null;
    };
};
export function resolveSeatForJoin(roomValue: any, requestedSeatKey: any, providedToken: any): "black" | "white" | null;
export function normalizeEffectLogMessages(values: any): string[];
export function appendEffectLogMessages(...lists: any[]): string[];
export function getSeatLabelJa(playerKey: any): "黒" | "白";
export function resolveActionCardId(action: any): string;
export function resolveActionCardDisplayName(action: any, cardLogic: any): string;
export function buildNetworkCardUseEffectLogs(action: any, playerKey: any, cardLogic: any): string[];
export function collectPipelineEffectLogMessages(rawEvents: any, presentationEvents: any, playerKey: any, playbackAdapter: any): string[];
export function isNetworkDebugFillHandAction(value: any): boolean;
export function isNetworkDebugFillHandPayload(value: any): boolean;
export function resolveNetworkDebugFillHandOptions(value: any): {
    fillWhite?: undefined;
    replaceExisting?: undefined;
    cardIds?: undefined;
    charge?: undefined;
    chargeByPlayer?: undefined;
} | {
    fillWhite: boolean;
    replaceExisting: boolean;
    cardIds: any[] | undefined;
    charge: number | undefined;
    chargeByPlayer: {
        black: number | undefined;
        white: number | undefined;
    } | undefined;
};
export function isPlainObject(value: any): boolean;
export function mergeWithDefaultShape(defaultValue: any, overrideValue: any): any;
export function mixTurnStartSeed(seed: any, value: any): number;
export function createTurnStartSeed(room: any, snapshot: any, playerKey: any): number;
export function normalizeRoomBoardConfig(value: any, fallbackBoard: any): any;
export function resolveRoomBoardConfig(value: any): any;
export function buildPublishResponsePayload(options: any): {
    ok: boolean;
    roomId: string | null;
    serverTime: number;
};
export function applySeatLeaveToRoom(roomValue: any, seatKeyValue: any, options: any): {
    seatKey: string;
    updatedAt: number;
    seatToken: any;
    seats: any;
    seatNames: any;
    seatHandSkins: any;
} | null;
export function shouldDisposeRoom(roomValue: any, streamCountValue: any): boolean;
export function computeAuthoritativeStateHash(snapshotValue: any): any;
export function computeProjectedSnapshotHash(snapshotValue: any): any;
export function stripTransientPresentationState(nextSnapshot: any): any;
export function stripTransientChargeDeltaState(nextSnapshot: any): any;
export function projectSnapshotForViewer(snapshotValue: any, viewerSeatKey: any, metadata: any): any;
export function buildPublicSnapshot(room: any, viewerSeatKey: any): any;
export function validatePendingSelectionPublish(snapshotValue: any, playerKey: any, actionValue: any): {
    ok: boolean;
    rejectedReason?: undefined;
    pendingEffectId?: undefined;
} | {
    ok: boolean;
    rejectedReason: string;
    pendingEffectId?: undefined;
} | {
    ok: boolean;
    pendingEffectId: string | null;
    rejectedReason?: undefined;
};
export function sanitizePendingSelectionActionForAuthority(snapshotValue: any, playerKey: any, actionValue: any): any;
export function appendAuthorityLog(roomValue: any, entryValue: any, limitValue: any): any;
export function createBufferedSseEventRecord(options: any): {
    id: string;
    event: string;
} | null;
export function appendBufferedSseEvent(bufferValue: any, recordValue: any, limitValue: any): any[];
export function getBufferedSseReplayEvents(bufferValue: any, lastEventIdValue: any, viewerSeatKey: any): {
    eventId: string;
    eventName: string;
    payload: any;
}[] | null;
//# sourceMappingURL=match-authority.d.ts.map