import type { DurableObjectStateLike, MatchWorkerLeaderboardStore } from './match-worker-types';

type MatchWorkerLeaderboardRoomHelpers = {
    loadStore: (raw: unknown) => MatchWorkerLeaderboardStore;
    serializeStore: (store: MatchWorkerLeaderboardStore) => Record<string, unknown>;
    listEntries: (store: MatchWorkerLeaderboardStore, limit: unknown) => Array<Record<string, unknown>>;
    applySubmit: (store: MatchWorkerLeaderboardStore, body: Record<string, unknown>) =>
        | { ok: true; store: MatchWorkerLeaderboardStore; payload: Record<string, unknown> }
        | { ok: false; reason: 'PLAYER_ID_REQUIRED' };
    normalizeLimit: (value: unknown) => number;
};

type MatchWorkerLeaderboardRoomControllerConfig = {
    storage: DurableObjectStateLike['storage'];
    storageKey: string;
    defaultLimit: number;
    helpers: MatchWorkerLeaderboardRoomHelpers;
    jsonResponse: (statusCode: number, payload: unknown) => Response;
    now?: () => number;
};

export function createMatchWorkerLeaderboardRoomController(config: MatchWorkerLeaderboardRoomControllerConfig) {
    const cfg = (config && typeof config === 'object') ? config : {} as MatchWorkerLeaderboardRoomControllerConfig;
    const now = typeof cfg.now === 'function' ? cfg.now : () => Date.now();

    async function loadLeaderboardStore(): Promise<MatchWorkerLeaderboardStore> {
        const raw = await cfg.storage.get(cfg.storageKey);
        return cfg.helpers.loadStore(raw);
    }

    async function saveLeaderboardStore(store: MatchWorkerLeaderboardStore): Promise<void> {
        await cfg.storage.put(
            cfg.storageKey,
            cfg.helpers.serializeStore(store)
        );
    }

    function listLeaderboardEntries(store: MatchWorkerLeaderboardStore, limit: unknown): Array<Record<string, unknown>> {
        return cfg.helpers.listEntries(store, limit);
    }

    async function handleLeaderboardSubmit(body: Record<string, unknown>): Promise<Response> {
        const store = await loadLeaderboardStore();
        const submitResult = cfg.helpers.applySubmit(store, body);
        if (!submitResult.ok) {
            return cfg.jsonResponse(400, { ok: false, reason: submitResult.reason });
        }

        await saveLeaderboardStore(submitResult.store);
        return cfg.jsonResponse(200, submitResult.payload);
    }

    async function handleLeaderboardList(urlObj: URL): Promise<Response> {
        const limit = cfg.helpers.normalizeLimit(
            urlObj && urlObj.searchParams ? urlObj.searchParams.get('limit') : cfg.defaultLimit
        );
        const store = await loadLeaderboardStore();
        const entries = listLeaderboardEntries(store, limit);

        return cfg.jsonResponse(200, {
            ok: true,
            version: store.version,
            limit,
            entries,
            updatedAt: store.updatedAt,
            serverTime: now()
        });
    }

    return {
        loadLeaderboardStore,
        saveLeaderboardStore,
        listLeaderboardEntries,
        handleLeaderboardSubmit,
        handleLeaderboardList
    };
}
