export class MatchRoomDurableObject {
    constructor(state: any);
    state: any;
    room: any;
    roomLoaded: boolean;
    streams: Map<any, any>;
    encoder: TextEncoder;
    heartbeatTimerId: any;
    sseEventBuffer: any;
    loadRoom(): Promise<void>;
    saveRoom(): Promise<void>;
    removeRoom(): Promise<void>;
    nextSseEventId(): string;
    rememberBufferedSseEvent(record: any): void;
    buildBufferedSnapshotEvent(meta: any, eventId: any): {
        record: {
            eventId: any;
            eventName: string;
            payloadByViewer: {
                black: any;
                white: any;
            };
        };
        payloadByViewer: {
            black: any;
            white: any;
        };
    };
    prepareSnapshotBroadcast(meta: any): {
        eventId: string;
        record: {
            eventId: any;
            eventName: string;
            payloadByViewer: {
                black: any;
                white: any;
            };
        };
        payloadByViewer: {
            black: any;
            white: any;
        };
        fallbackPayload: any;
    };
    broadcastPreparedSnapshot(preparedSnapshot: any): Promise<void>;
    ensureHeartbeatTimer(): void;
    broadcastHeartbeat(): Promise<void>;
    closeStream(streamId: any): Promise<void>;
    closeStreamsForSeat(seatKey: any): Promise<void>;
    sendSse(streamId: any, eventName: any, payload: any, options: any): Promise<void>;
    broadcastSnapshot(meta: any): Promise<void>;
    broadcastPresence(meta: any): Promise<void>;
    broadcastChat(payload: any): Promise<void>;
    createRoomState(roomId: any, initOptions: any): {
        roomId: any;
        seed: number;
        snapshot: any;
        authoritativeStateHash: any;
        initialDeckSpec: any;
        initialDeckSpecByPlayer: {
            black: any;
            white: any;
        } | null;
        roomDeck: any;
        roomBoardConfig: any;
        networkDebugEnabled: boolean;
        stateVersion: number;
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
        seatTokens: {
            black: string;
            white: string;
        };
        turnTimer: {
            limitSeconds: number;
            active: boolean;
            turnSeatKey: string;
            turnStartedAt: null;
            turnDeadlineAt: null;
        };
        lastAcceptedOperationBySeat: {
            black: null;
            white: null;
        };
        eventSeq: number;
        sseEventBuffer: never[];
        authorityLog: never[];
        chatMessages: never[];
        chatSeq: number;
        updatedAt: number;
    };
    syncTurnTimerAlarm(): Promise<boolean>;
    isSnapshotGameOver(snapshot: any): Promise<boolean>;
    refreshTurnTimer(options: any): Promise<boolean>;
    applyExpiredTurnTimeoutIfNeeded(options: any): Promise<{
        applied: boolean;
        stateVersion?: undefined;
        playerKey?: undefined;
    } | {
        applied: boolean;
        stateVersion: any;
        playerKey: string;
    }>;
    alarm(): Promise<void>;
    handleInternalCreate(urlObj: any, body: any): Promise<Response>;
    handleJoin(body: any): Promise<Response>;
    handleLeave(body: any): Promise<Response>;
    handleHandSkin(body: any): Promise<Response>;
    handlePublish(body: any): Promise<Response>;
    handleState(urlObj: any): Promise<Response>;
    handleStream(request: any): Promise<Response>;
    loadLeaderboardStore(): Promise<{
        version: number;
        players: {};
        updatedAt: number;
    }>;
    saveLeaderboardStore(store: any): Promise<void>;
    listLeaderboardEntries(store: any, limit: any): {
        rank: number;
        playerId: string;
        playerName: string;
        bestScore: number;
        mode: string;
        cpuLevel: number | null;
        updatedAt: number;
        scoreVersion: number | null;
        turnCount: number | null;
    }[];
    handleLeaderboardSubmit(body: any): Promise<Response>;
    handleLeaderboardList(urlObj: any): Promise<Response>;
    fetch(request: any): Promise<Response>;
    handleChat(body: any): Promise<Response>;
}
declare namespace _default {
    function fetch(request: any, env: any): Promise<any>;
}
export default _default;
//# sourceMappingURL=match-worker.d.mts.map