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
