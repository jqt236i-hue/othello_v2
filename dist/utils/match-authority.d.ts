import type { CardState, GameState, PlayerKey } from '../src/types';
declare function randomFromChars(chars: any, length: any, explicitCrypto: any): string;
declare function makeRoomId(explicitCrypto: any): string;
declare function makeSeatToken(explicitCrypto: any): string;
declare function makeSseStreamId(nowValue: any, explicitCrypto: any): string;
declare function parseSeatKeyOptional(value: any): "black" | "white" | null;
declare function normalizePlayerKey(value: any, fallback: any): "black" | "white";
declare function getCurrentPlayerKey(gameState: Partial<GameState> | null | undefined): PlayerKey;
declare function getOpponentKey(playerKey: PlayerKey | null | undefined): PlayerKey;
declare function normalizeOperationId(value: any): string;
declare function normalizeSeatHandSkinId(value: any): string;
declare function normalizeSeatHandSkins(value: any): {
    black: string;
    white: string;
};
declare function normalizeNetworkPlayerName(value: any): string;
declare function normalizePublicSeats(value: any): {
    black: boolean;
    white: boolean;
};
declare function buildPublicSeatMetadata(value: any): {
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
declare function hasRequiredOperationId(value: any): boolean;
declare function ensureAcceptedOperationsBySeat(room: any): {
    black: any;
    white: any;
};
declare function ensureAcceptedOperationHistoryBySeat(room: any): {
    black: never[];
    white: never[];
};
declare function findAcceptedOperationBySeat(room: any, seatKey: any, operationId: any): null;
declare function resolveAcceptedOperation(room: any, seatKey: any, operationId: any, fallbackEntry: any): {
    operationId: string;
    stateVersion: number | null;
    updatedAt: number | null;
} | null;
declare function rememberAcceptedOperationBySeat(room: any, seatKey: any, entry: any): null;
declare function classifyVersionRejectionReason(receivedBaseVersionValue: any, authoritativeStateVersionValue: any): "VERSION_MISMATCH" | "VERSION_AHEAD" | "VERSION_BEHIND" | "VERSION_GAP";
declare function isVersionRejectionReason(reasonValue: any): boolean;
declare function normalizePublishMeta(value: any): {
    kind: string | null;
    operationId: string;
    actionType: string | null;
    receivedBaseVersion: number | null;
    authoritativeStateVersion: number | null;
    replayedStateVersion: number | null;
    rejectedReason: string | null;
};
declare function buildPublishResponseOptions(options: any): {
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
declare function normalizeEffectLogMessages(values: any): string[];
declare function appendEffectLogMessages(...lists: any[]): string[];
declare function getSeatLabelJa(playerKey: PlayerKey | null | undefined): string;
declare function resolveActionCardId(action: any): string;
declare function resolveActionCardDisplayName(action: any, cardLogic: any): string;
declare function buildNetworkCardUseEffectLogs(action: any, playerKey: any, cardLogic: any): string[];
declare function collectPipelineEffectLogMessages(rawEvents: any, presentationEvents: any, playerKey: any, playbackAdapter: any): string[];
declare function isNetworkDebugFillHandAction(value: any): boolean;
declare function isNetworkDebugFillHandPayload(value: any): boolean;
declare function resolveNetworkDebugFillHandOptions(value: any): {
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
declare function isPlainObject(value: any): boolean;
declare function mergeWithDefaultShape(defaultValue: any, overrideValue: any): any;
declare function mixTurnStartSeed(seed: any, value: any): number;
declare function createTurnStartSeed(room: any, snapshot: any, playerKey: any): number;
declare function normalizeRoomBoardConfig(value: any, fallbackBoard: any): any;
declare function resolveRoomBoardConfig(value: any): any;
declare function buildPublishResponsePayload(options: any): {
    ok: boolean;
    roomId: string | null;
    serverTime: number;
};
declare function buildRoomPayload(options: any): {
    ok: boolean;
    roomId: string | null;
    serverTime: number;
};
declare function buildRoomPayloadFromRoom(roomValue: any, options: any): {
    ok: boolean;
    roomId: string | null;
    serverTime: number;
};
declare function buildSnapshotPayloadFromRoom(roomValue: any, options: any): {
    ok: boolean;
    roomId: string | null;
    serverTime: number;
};
declare function buildPresencePayloadFromRoom(roomValue: any, options: any): {
    ok: boolean;
    roomId: string | null;
    serverTime: number;
};
declare function buildHeartbeatPayloadFromRoom(roomValue: any, options: any): {
    ok: boolean;
    roomId: string | null;
    serverTime: number;
};
declare function buildPublishPayloadFromRoom(roomValue: any, options: any): {
    ok: boolean;
    roomId: string | null;
    serverTime: number;
};
declare function resolveSeatForJoin(roomValue: any, requestedSeatKey: any, providedToken: any): "black" | "white" | null;
declare function applySeatLeaveToRoom(roomValue: any, seatKeyValue: any, options: any): {
    seatKey: string;
    updatedAt: number;
    seatToken: any;
    seats: any;
    seatNames: any;
    seatHandSkins: any;
} | null;
declare function shouldDisposeRoom(roomValue: any, streamCountValue: any): boolean;
declare function makeHiddenHandToken(ownerKey: any, handIndex: any): string;
declare function parseHiddenHandToken(value: any): {
    ownerKey: string;
    handIndex: number;
} | null;
declare function resolveAuthenticatedSeatKey(room: any, seatKeyValue: any, seatTokenValue: any): "black" | "white" | null;
declare function classifySeatTokenRejectionReason(seatTokenValue: any): "SEAT_TOKEN_REQUIRED" | "SEAT_TOKEN_MISMATCH";
declare function stripTransientPresentationState(nextSnapshot: any): any;
declare function stripTransientChargeDeltaState(nextSnapshot: any): any;
/**
 * Returns the FATE_WILL controller seat key for the given turn owner, or null if none.
 * Reads from snapshot.cardState.fateWillControllerByTurnOwner.
 */
declare function getFateWillControllerKey(snapshot: {
    cardState?: Partial<CardState> | null;
} | null | undefined, turnOwnerKey: PlayerKey | null | undefined): PlayerKey | null;
/**
 * Returns true if seatKey is the authenticated FATE_WILL controller for the current turn owner.
 * Only valid when it is currently the turn owner's turn (gameState.currentPlayer === turnOwnerKey).
 */
declare function isFateWillControllerForCurrentTurn(snapshot: {
    gameState?: Partial<GameState> | null;
    cardState?: Partial<CardState> | null;
} | null | undefined, seatKey: PlayerKey | null | undefined): boolean;
declare function canViewerInspectOwnerHand(snapshot: {
    gameState?: Partial<GameState> | null;
    cardState?: Partial<CardState> | null;
} | null | undefined, viewerSeatKey: PlayerKey | null | undefined, ownerSeatKey: PlayerKey | null | undefined): boolean;
declare function projectSnapshotForViewer(snapshotValue: any, viewerSeatKey: PlayerKey | null | undefined, metadata?: {
    stateVersion?: number | null;
    updatedAt?: number | null;
    projectedForSeat?: PlayerKey | null;
    turnStartReconciled?: boolean;
}): any;
declare function buildPublicSnapshot(room: any, viewerSeatKey: any): any;
declare function computeAuthoritativeStateHash(snapshotValue: any): any;
declare function computeProjectedSnapshotHash(snapshotValue: any): any;
declare function validatePendingSelectionPublish(snapshotValue: any, playerKey: any, actionValue: any): {
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
declare function sanitizePendingSelectionActionForAuthority(snapshotValue: any, playerKey: any, actionValue: any): any;
declare function appendAuthorityLog(roomValue: any, entryValue: any, limitValue: any): any;
declare function createBufferedSseEventRecord(options: any): {
    id: string;
    event: string;
} | null;
declare function appendBufferedSseEvent(bufferValue: any, recordValue: any, limitValue: any): any[];
declare function getBufferedSseReplayEvents(bufferValue: any, lastEventIdValue: any, viewerSeatKey: any): {
    eventId: string;
    eventName: string;
    payload: any;
}[] | null;
declare const matchAuthority: {
    PLAYER_KEYS: readonly string[];
    OPERATION_ID_MAX_LENGTH: number;
    SSE_RESUME_BUFFER_LIMIT: number;
    NETWORK_PLAYER_NAME_MAX: number;
    NETWORK_DEBUG_FILL_HAND_ACTION: string;
    ROOM_ID_CHARS: string;
    ROOM_ID_LENGTH: number;
    SEAT_TOKEN_CHARS: string;
    SEAT_TOKEN_LENGTH: number;
    VERSION_REJECTION_REASONS: Readonly<{
        AHEAD: "VERSION_AHEAD";
        BEHIND: "VERSION_BEHIND";
        GAP: "VERSION_GAP";
        MISMATCH: "VERSION_MISMATCH";
    }>;
    randomFromChars: typeof randomFromChars;
    makeRoomId: typeof makeRoomId;
    makeSeatToken: typeof makeSeatToken;
    makeSseStreamId: typeof makeSseStreamId;
    parseSeatKeyOptional: typeof parseSeatKeyOptional;
    normalizePlayerKey: typeof normalizePlayerKey;
    getCurrentPlayerKey: typeof getCurrentPlayerKey;
    getOpponentKey: typeof getOpponentKey;
    normalizeOperationId: typeof normalizeOperationId;
    normalizeSeatHandSkinId: typeof normalizeSeatHandSkinId;
    normalizeSeatHandSkins: typeof normalizeSeatHandSkins;
    normalizeNetworkPlayerName: typeof normalizeNetworkPlayerName;
    normalizePublicSeats: typeof normalizePublicSeats;
    buildPublicSeatMetadata: typeof buildPublicSeatMetadata;
    hasRequiredOperationId: typeof hasRequiredOperationId;
    ensureAcceptedOperationsBySeat: typeof ensureAcceptedOperationsBySeat;
    ensureAcceptedOperationHistoryBySeat: typeof ensureAcceptedOperationHistoryBySeat;
    findAcceptedOperationBySeat: typeof findAcceptedOperationBySeat;
    resolveAcceptedOperation: typeof resolveAcceptedOperation;
    rememberAcceptedOperationBySeat: typeof rememberAcceptedOperationBySeat;
    classifyVersionRejectionReason: typeof classifyVersionRejectionReason;
    isVersionRejectionReason: typeof isVersionRejectionReason;
    makeHiddenHandToken: typeof makeHiddenHandToken;
    parseHiddenHandToken: typeof parseHiddenHandToken;
    resolveAuthenticatedSeatKey: typeof resolveAuthenticatedSeatKey;
    classifySeatTokenRejectionReason: typeof classifySeatTokenRejectionReason;
    getFateWillControllerKey: typeof getFateWillControllerKey;
    isFateWillControllerForCurrentTurn: typeof isFateWillControllerForCurrentTurn;
    canViewerInspectOwnerHand: typeof canViewerInspectOwnerHand;
    normalizePublishMeta: typeof normalizePublishMeta;
    buildRoomPayload: typeof buildRoomPayload;
    buildRoomPayloadFromRoom: typeof buildRoomPayloadFromRoom;
    buildSnapshotPayloadFromRoom: typeof buildSnapshotPayloadFromRoom;
    buildPresencePayloadFromRoom: typeof buildPresencePayloadFromRoom;
    buildHeartbeatPayloadFromRoom: typeof buildHeartbeatPayloadFromRoom;
    buildPublishPayloadFromRoom: typeof buildPublishPayloadFromRoom;
    buildPublishResponseOptions: typeof buildPublishResponseOptions;
    resolveSeatForJoin: typeof resolveSeatForJoin;
    normalizeEffectLogMessages: typeof normalizeEffectLogMessages;
    appendEffectLogMessages: typeof appendEffectLogMessages;
    getSeatLabelJa: typeof getSeatLabelJa;
    resolveActionCardId: typeof resolveActionCardId;
    resolveActionCardDisplayName: typeof resolveActionCardDisplayName;
    buildNetworkCardUseEffectLogs: typeof buildNetworkCardUseEffectLogs;
    collectPipelineEffectLogMessages: typeof collectPipelineEffectLogMessages;
    isNetworkDebugFillHandAction: typeof isNetworkDebugFillHandAction;
    isNetworkDebugFillHandPayload: typeof isNetworkDebugFillHandPayload;
    resolveNetworkDebugFillHandOptions: typeof resolveNetworkDebugFillHandOptions;
    isPlainObject: typeof isPlainObject;
    mergeWithDefaultShape: typeof mergeWithDefaultShape;
    mixTurnStartSeed: typeof mixTurnStartSeed;
    createTurnStartSeed: typeof createTurnStartSeed;
    normalizeRoomBoardConfig: typeof normalizeRoomBoardConfig;
    resolveRoomBoardConfig: typeof resolveRoomBoardConfig;
    buildPublishResponsePayload: typeof buildPublishResponsePayload;
    applySeatLeaveToRoom: typeof applySeatLeaveToRoom;
    shouldDisposeRoom: typeof shouldDisposeRoom;
    computeAuthoritativeStateHash: typeof computeAuthoritativeStateHash;
    computeProjectedSnapshotHash: typeof computeProjectedSnapshotHash;
    stripTransientPresentationState: typeof stripTransientPresentationState;
    stripTransientChargeDeltaState: typeof stripTransientChargeDeltaState;
    projectSnapshotForViewer: typeof projectSnapshotForViewer;
    buildPublicSnapshot: typeof buildPublicSnapshot;
    validatePendingSelectionPublish: typeof validatePendingSelectionPublish;
    sanitizePendingSelectionActionForAuthority: typeof sanitizePendingSelectionActionForAuthority;
    appendAuthorityLog: typeof appendAuthorityLog;
    createBufferedSseEventRecord: typeof createBufferedSseEventRecord;
    appendBufferedSseEvent: typeof appendBufferedSseEvent;
    getBufferedSseReplayEvents: typeof getBufferedSseReplayEvents;
};
export = matchAuthority;
//# sourceMappingURL=match-authority.d.ts.map