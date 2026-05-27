import type {
    MatchWorkerLeaderboardEntry,
    MatchWorkerLeaderboardMode,
    MatchWorkerLeaderboardStore
} from './match-worker-types';

type MatchWorkerLeaderboardHelperConfig = {
    storageVersion: number;
    playerNameMax: number;
    playerIdPattern: RegExp;
    defaultLimit: number;
    maxLimit: number;
    maxStoredPlayers: number;
    now?: () => number;
};

type MatchWorkerLeaderboardSubmitOk = {
    ok: true;
    store: MatchWorkerLeaderboardStore;
    payload: Record<string, unknown>;
};

type MatchWorkerLeaderboardSubmitRejected = {
    ok: false;
    reason: 'PLAYER_ID_REQUIRED';
};

type MatchWorkerLeaderboardSubmitResult =
    | MatchWorkerLeaderboardSubmitOk
    | MatchWorkerLeaderboardSubmitRejected;

function asRecord(value: unknown): Record<string, unknown> {
    return value && typeof value === 'object' ? value as Record<string, unknown> : {};
}

export function createMatchWorkerLeaderboardHelpers(config: MatchWorkerLeaderboardHelperConfig) {
    const cfg = (config && typeof config === 'object') ? config : {} as MatchWorkerLeaderboardHelperConfig;
    const now = typeof cfg.now === 'function' ? cfg.now : () => Date.now();
    const playerNameMax = Number.isFinite(Number(cfg.playerNameMax)) ? Math.max(1, Math.trunc(Number(cfg.playerNameMax))) : 7;
    const defaultLimit = Number.isFinite(Number(cfg.defaultLimit)) ? Math.max(1, Math.trunc(Number(cfg.defaultLimit))) : 10;
    const maxLimit = Number.isFinite(Number(cfg.maxLimit)) ? Math.max(defaultLimit, Math.trunc(Number(cfg.maxLimit))) : 100;
    const maxStoredPlayers = Number.isFinite(Number(cfg.maxStoredPlayers)) ? Math.max(1, Math.trunc(Number(cfg.maxStoredPlayers))) : 200;
    const storageVersion = Number.isFinite(Number(cfg.storageVersion)) ? Math.max(1, Math.trunc(Number(cfg.storageVersion))) : 1;
    const playerIdPattern = cfg.playerIdPattern instanceof RegExp ? cfg.playerIdPattern : /^[A-Za-z0-9_-]{8,80}$/;

    function normalizePlayerId(value: unknown): string | null {
        const normalized = String(value || '').trim();
        if (!playerIdPattern.test(normalized)) return null;
        return normalized;
    }

    function normalizePlayerName(value: unknown): string {
        const normalized = String(value || '').replace(/\s+/g, ' ').trim();
        const clipped = Array.from(normalized).slice(0, playerNameMax).join('');
        return clipped || 'ななし';
    }

    function normalizeMode(value: unknown): MatchWorkerLeaderboardMode {
        if (value === 'network') return 'network';
        if (value === 'cpu') return 'cpu';
        return 'cpu';
    }

    function clampScore(value: unknown): number {
        const score = Number(value);
        if (!Number.isFinite(score)) return 0;
        return Math.max(0, Math.min(100000, Math.trunc(score)));
    }

    function normalizeCpuLevel(value: unknown): number | null {
        if (!Number.isFinite(Number(value))) return null;
        const level = Math.trunc(Number(value));
        return Math.max(1, Math.min(6, level));
    }

    function normalizeLimit(value: unknown): number {
        const parsed = Number(value);
        if (!Number.isFinite(parsed)) return defaultLimit;
        return Math.max(1, Math.min(maxLimit, Math.trunc(parsed)));
    }

    function normalizeEntry(value: unknown, fallbackPlayerId?: unknown): MatchWorkerLeaderboardEntry | null {
        if (!value || typeof value !== 'object') return null;

        const entry = asRecord(value);
        const playerId = normalizePlayerId(entry.playerId || fallbackPlayerId);
        if (!playerId) return null;

        const updatedAt = Number.isFinite(Number(entry.updatedAt))
            ? Math.max(0, Math.trunc(Number(entry.updatedAt)))
            : now();
        const submittedAt = Number.isFinite(Number(entry.submittedAt))
            ? Math.max(0, Math.trunc(Number(entry.submittedAt)))
            : updatedAt;

        return {
            playerId,
            playerName: normalizePlayerName(entry.playerName),
            bestScore: clampScore(entry.bestScore),
            lastScore: clampScore(entry.lastScore),
            mode: normalizeMode(entry.mode),
            cpuLevel: normalizeCpuLevel(entry.cpuLevel),
            scoreVersion: Number.isFinite(Number(entry.scoreVersion)) ? Math.max(0, Math.trunc(Number(entry.scoreVersion))) : null,
            turnCount: Number.isFinite(Number(entry.turnCount)) ? Math.max(0, Math.trunc(Number(entry.turnCount))) : null,
            updatedAt,
            submittedAt
        };
    }

    function isEntry(value: MatchWorkerLeaderboardEntry | null): value is MatchWorkerLeaderboardEntry {
        return value !== null;
    }

    function sortEntries(entries: MatchWorkerLeaderboardEntry[]): void {
        entries.sort((a, b) => {
            if (b.bestScore !== a.bestScore) return b.bestScore - a.bestScore;
            if (a.updatedAt !== b.updatedAt) return a.updatedAt - b.updatedAt;
            return String(a.playerName || '').localeCompare(String(b.playerName || ''), 'ja');
        });
    }

    function createEmptyStore(): MatchWorkerLeaderboardStore {
        return {
            version: storageVersion,
            players: {},
            updatedAt: now()
        };
    }

    function loadStore(raw: unknown): MatchWorkerLeaderboardStore {
        const empty = createEmptyStore();
        if (!raw || typeof raw !== 'object') return empty;

        const rawRecord = asRecord(raw);
        const playersRaw = (rawRecord.players && typeof rawRecord.players === 'object') ? asRecord(rawRecord.players) : {};
        const players: Record<string, MatchWorkerLeaderboardEntry> = {};

        for (const [key, entry] of Object.entries(playersRaw)) {
            const normalized = normalizeEntry(entry, key);
            if (!normalized) continue;
            players[normalized.playerId] = normalized;
        }

        const updatedAt = Number.isFinite(Number(rawRecord.updatedAt))
            ? Math.max(0, Math.trunc(Number(rawRecord.updatedAt)))
            : now();

        return {
            version: storageVersion,
            players,
            updatedAt
        };
    }

    function serializeStore(store: MatchWorkerLeaderboardStore): Record<string, unknown> {
        return {
            version: storageVersion,
            players: (store && store.players && typeof store.players === 'object') ? store.players : {},
            updatedAt: Number.isFinite(Number(store && store.updatedAt)) ? Math.max(0, Math.trunc(Number(store.updatedAt))) : now()
        };
    }

    function listEntries(store: MatchWorkerLeaderboardStore, limit: unknown): Array<Record<string, unknown>> {
        const rows = Object.values((store && store.players) || {})
            .map((entry) => normalizeEntry(entry))
            .filter(isEntry);

        sortEntries(rows);

        const clipped = rows.slice(0, normalizeLimit(limit));
        return clipped.map((entry, index) => ({
            rank: index + 1,
            playerId: entry.playerId,
            playerName: entry.playerName,
            bestScore: entry.bestScore,
            mode: entry.mode,
            cpuLevel: entry.cpuLevel,
            updatedAt: entry.updatedAt,
            scoreVersion: entry.scoreVersion,
            turnCount: entry.turnCount
        }));
    }

    function applySubmit(store: MatchWorkerLeaderboardStore, body: Record<string, unknown>): MatchWorkerLeaderboardSubmitResult {
        const playerId = normalizePlayerId(body && body.playerId);
        if (!playerId) {
            return { ok: false, reason: 'PLAYER_ID_REQUIRED' };
        }

        const playerName = normalizePlayerName(body && body.playerName);
        const score = clampScore(body && body.score);
        const mode = normalizeMode(body && body.mode);
        const cpuLevel = normalizeCpuLevel(body && body.cpuLevel);
        const scoreVersion = Number.isFinite(Number(body && body.scoreVersion)) ? Math.max(0, Math.trunc(Number(body.scoreVersion))) : null;
        const turnCount = Number.isFinite(Number(body && body.turnCount)) ? Math.max(0, Math.trunc(Number(body.turnCount))) : null;

        const nextStore: MatchWorkerLeaderboardStore = {
            version: storageVersion,
            players: { ...((store && store.players) || {}) },
            updatedAt: Number.isFinite(Number(store && store.updatedAt)) ? Math.max(0, Math.trunc(Number(store.updatedAt))) : now()
        };

        const submittedAt = now();
        const current = normalizeEntry(nextStore.players[playerId], playerId);
        const previousBest = current ? current.bestScore : 0;
        const updated = score > previousBest;
        const bestScore = updated ? score : previousBest;
        const nextMode = (updated || !current) ? mode : current.mode;
        const nextCpuLevel = (updated || !current) ? cpuLevel : current.cpuLevel;
        const nextScoreVersion = (updated || !current) ? scoreVersion : current.scoreVersion;
        const nextTurnCount = (updated || !current) ? turnCount : current.turnCount;

        nextStore.players[playerId] = {
            playerId,
            playerName,
            bestScore,
            lastScore: score,
            mode: nextMode,
            cpuLevel: nextCpuLevel,
            scoreVersion: nextScoreVersion,
            turnCount: nextTurnCount,
            updatedAt: updated ? submittedAt : (current ? current.updatedAt : submittedAt),
            submittedAt
        };

        const allRows = Object.values(nextStore.players)
            .map((entry) => normalizeEntry(entry))
            .filter(isEntry);
        sortEntries(allRows);

        if (allRows.length > maxStoredPlayers) {
            const keep = new Set(allRows.slice(0, maxStoredPlayers).map((entry) => entry.playerId));
            for (const id of Object.keys(nextStore.players)) {
                if (!keep.has(id)) delete nextStore.players[id];
            }
        }

        nextStore.updatedAt = submittedAt;
        const entries = listEntries(nextStore, body && body.limit);
        const playerRank = allRows.findIndex((entry) => entry.playerId === playerId) + 1;

        return {
            ok: true,
            store: nextStore,
            payload: {
                ok: true,
                version: storageVersion,
                playerId,
                playerName,
                updated,
                previousBest,
                bestScore,
                score,
                rank: playerRank > 0 ? playerRank : null,
                entries,
                updatedAt: nextStore.updatedAt,
                serverTime: now()
            }
        };
    }

    return {
        normalizePlayerId,
        normalizePlayerName,
        normalizeMode,
        clampScore,
        normalizeCpuLevel,
        normalizeLimit,
        normalizeEntry,
        createEmptyStore,
        loadStore,
        serializeStore,
        listEntries,
        applySubmit
    };
}
