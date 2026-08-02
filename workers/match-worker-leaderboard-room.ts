import type { DurableObjectStateLike, MatchWorkerLeaderboardStore } from './match-worker-types';

type MatchWorkerLeaderboardRoomHelpers = {
    loadStore: (raw: unknown) => MatchWorkerLeaderboardStore;
    serializeStore: (store: MatchWorkerLeaderboardStore, category?: unknown) => Record<string, unknown>;
    listEntries: (store: MatchWorkerLeaderboardStore, limit: unknown, mode?: unknown, cpuLevel?: unknown, category?: unknown) => Array<Record<string, unknown>>;
    updatePublicProfile: (store: MatchWorkerLeaderboardStore, body: Record<string, unknown>) =>
        | { ok: true; store: MatchWorkerLeaderboardStore; payload: Record<string, unknown> }
        | { ok: false; reason: 'PLAYER_ID_REQUIRED' };
    applySubmit: (store: MatchWorkerLeaderboardStore, body: Record<string, unknown>) =>
        | { ok: true; store: MatchWorkerLeaderboardStore; payload: Record<string, unknown> }
        | { ok: false; reason: 'PLAYER_ID_REQUIRED' | 'TIME_ATTACK_INELIGIBLE' | 'TIME_DEFENSE_INELIGIBLE' | 'SHORTEST_TURNS_INELIGIBLE' | 'SCORE_INELIGIBLE' | 'BOARD_NOT_ELIGIBLE' };
    normalizeLimit: (value: unknown) => number;
    normalizeListMode: (value: unknown) => 'all' | 'cpu' | 'network';
    normalizeListCpuLevel: (value: unknown) => number | null;
    normalizeCategory: (value: unknown) => 'score' | 'timeAttack' | 'timeDefense' | 'shortestTurns';
};

type MatchWorkerLeaderboardRoomControllerConfig = {
    storage: DurableObjectStateLike['storage'];
    storageKey: string;
    timeAttackStorageKey?: string;
    timeDefenseStorageKey?: string;
    shortestTurnsStorageKey?: string;
    legacyStorageKey?: string;
    legacyTimeAttackStorageKey?: string;
    legacyTimeDefenseStorageKey?: string;
    legacyShortestTurnsStorageKey?: string;
    defaultLimit: number;
    helpers: MatchWorkerLeaderboardRoomHelpers;
    jsonResponse: (statusCode: number, payload: unknown) => Response;
    now?: () => number;
};

type MatchWorkerLeaderboardEra = 'current' | 'legacy';

export function createMatchWorkerLeaderboardRoomController(config: MatchWorkerLeaderboardRoomControllerConfig) {
    const cfg = (config && typeof config === 'object') ? config : {} as MatchWorkerLeaderboardRoomControllerConfig;
    const now = typeof cfg.now === 'function' ? cfg.now : () => Date.now();
    const scoreStorageKey = cfg.storageKey;
    const timeAttackStorageKey = cfg.timeAttackStorageKey || `${scoreStorageKey}_time_attack`;
    const timeDefenseStorageKey = cfg.timeDefenseStorageKey || `${scoreStorageKey}_time_defense`;
    const shortestTurnsStorageKey = cfg.shortestTurnsStorageKey || `${scoreStorageKey}_shortest_turns`;
    const legacyScoreStorageKey = typeof cfg.legacyStorageKey === 'string' && cfg.legacyStorageKey
        ? cfg.legacyStorageKey
        : null;
    const legacyTimeAttackStorageKey = typeof cfg.legacyTimeAttackStorageKey === 'string' && cfg.legacyTimeAttackStorageKey
        ? cfg.legacyTimeAttackStorageKey
        : null;
    const legacyTimeDefenseStorageKey = typeof cfg.legacyTimeDefenseStorageKey === 'string' && cfg.legacyTimeDefenseStorageKey
        ? cfg.legacyTimeDefenseStorageKey
        : null;
    const legacyShortestTurnsStorageKey = typeof cfg.legacyShortestTurnsStorageKey === 'string' && cfg.legacyShortestTurnsStorageKey
        ? cfg.legacyShortestTurnsStorageKey
        : null;

    function normalizeEra(value: unknown): MatchWorkerLeaderboardEra {
        return String(value || '').trim().toLowerCase() === 'legacy' ? 'legacy' : 'current';
    }

    function currentStorageKeyForCategory(category: unknown): string {
        const normalized = cfg.helpers.normalizeCategory(category);
        if (normalized === 'timeAttack') return timeAttackStorageKey;
        if (normalized === 'timeDefense') return timeDefenseStorageKey;
        if (normalized === 'shortestTurns') return shortestTurnsStorageKey;
        return scoreStorageKey;
    }

    function legacyStorageKeyForCategory(category: unknown): string | null {
        const normalized = cfg.helpers.normalizeCategory(category);
        if (normalized === 'timeAttack') return legacyTimeAttackStorageKey;
        if (normalized === 'timeDefense') return legacyTimeDefenseStorageKey;
        if (normalized === 'shortestTurns') return legacyShortestTurnsStorageKey;
        return legacyScoreStorageKey;
    }

    function storageKeyForCategory(category: unknown, era?: unknown): string | null {
        return normalizeEra(era) === 'legacy'
            ? legacyStorageKeyForCategory(category)
            : currentStorageKeyForCategory(category);
    }

    async function loadLeaderboardStore(category?: unknown, era?: unknown): Promise<MatchWorkerLeaderboardStore> {
        const storageKey = storageKeyForCategory(category, era);
        const raw = storageKey ? await cfg.storage.get(storageKey) : null;
        return cfg.helpers.loadStore(raw);
    }

    async function saveLeaderboardStore(store: MatchWorkerLeaderboardStore, category?: unknown): Promise<void> {
        await cfg.storage.put(
            currentStorageKeyForCategory(category),
            cfg.helpers.serializeStore(store, category)
        );
    }

    function listLeaderboardEntries(store: MatchWorkerLeaderboardStore, limit: unknown, mode?: unknown, cpuLevel?: unknown, category?: unknown): Array<Record<string, unknown>> {
        return cfg.helpers.listEntries(store, limit, mode, cpuLevel, category);
    }

    async function handleLeaderboardSubmit(body: Record<string, unknown>): Promise<Response> {
        const category = cfg.helpers.normalizeCategory(body && body.category);
        const store = await loadLeaderboardStore(category);
        const submitResult = cfg.helpers.applySubmit(store, body);
        if (!submitResult.ok) {
            return cfg.jsonResponse(400, { ok: false, reason: submitResult.reason });
        }

        await saveLeaderboardStore(submitResult.store, category);
        return cfg.jsonResponse(200, submitResult.payload);
    }

    async function handleLeaderboardProfileUpdate(body: Record<string, unknown>): Promise<Response> {
        const categories = ['score', 'timeAttack', 'timeDefense', 'shortestTurns'] as const;
        let payload: Record<string, unknown> | null = null;
        for (const category of categories) {
            const store = await loadLeaderboardStore(category);
            const updateResult = cfg.helpers.updatePublicProfile(store, body);
            if (!updateResult.ok) {
                return cfg.jsonResponse(400, { ok: false, reason: updateResult.reason });
            }
            await saveLeaderboardStore(updateResult.store, category);
            payload = updateResult.payload;
        }
        return cfg.jsonResponse(200, payload || { ok: true });
    }

    async function handleLeaderboardList(urlObj: URL): Promise<Response> {
        const limit = cfg.helpers.normalizeLimit(
            urlObj && urlObj.searchParams ? urlObj.searchParams.get('limit') : cfg.defaultLimit
        );
        const mode = cfg.helpers.normalizeListMode(
            urlObj && urlObj.searchParams ? urlObj.searchParams.get('mode') : 'all'
        );
        const cpuLevel = mode === 'cpu'
            ? cfg.helpers.normalizeListCpuLevel(urlObj && urlObj.searchParams ? urlObj.searchParams.get('cpuLevel') : null)
            : null;
        const category = cfg.helpers.normalizeCategory(
            urlObj && urlObj.searchParams ? urlObj.searchParams.get('category') : 'score'
        );
        const era = normalizeEra(
            urlObj && urlObj.searchParams ? urlObj.searchParams.get('era') : 'current'
        );
        const store = await loadLeaderboardStore(category, era);
        const entries = listLeaderboardEntries(store, limit, mode, cpuLevel, category);

        return cfg.jsonResponse(200, {
            ok: true,
            version: store.version,
            limit,
            mode,
            cpuLevel,
            category,
            era,
            entries,
            updatedAt: store.updatedAt,
            serverTime: now()
        });
    }

    return {
        loadLeaderboardStore,
        saveLeaderboardStore,
        listLeaderboardEntries,
        normalizeEra,
        handleLeaderboardSubmit,
        handleLeaderboardProfileUpdate,
        handleLeaderboardList
    };
}
