import type {
    MatchWorkerLeaderboardCategory,
    MatchWorkerLeaderboardEntry,
    MatchWorkerLeaderboardMode,
    MatchWorkerLeaderboardModeEntries,
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
    reason: 'PLAYER_ID_REQUIRED' | 'TIME_ATTACK_INELIGIBLE' | 'TIME_DEFENSE_INELIGIBLE' | 'SHORTEST_TURNS_INELIGIBLE' | 'SCORE_INELIGIBLE' | 'BOARD_NOT_ELIGIBLE';
};

type MatchWorkerLeaderboardSubmitResult =
    | MatchWorkerLeaderboardSubmitOk
    | MatchWorkerLeaderboardSubmitRejected;

type MatchWorkerLeaderboardListMode = 'all' | MatchWorkerLeaderboardMode;
const TIME_ATTACK_LIMIT_MS = 900000;

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

    function normalizeListMode(value: unknown): MatchWorkerLeaderboardListMode {
        if (value === 'network') return 'network';
        if (value === 'cpu') return 'cpu';
        return 'all';
    }

    function normalizeCategory(value: unknown): MatchWorkerLeaderboardCategory {
        if (value === 'shortestTurns') return 'shortestTurns';
        if (value === 'timeDefense') return 'timeDefense';
        return value === 'timeAttack' ? 'timeAttack' : 'score';
    }

    function isTurnCountCategory(category: unknown): category is 'timeDefense' | 'shortestTurns' {
        return category === 'timeDefense' || category === 'shortestTurns';
    }

    function clampScore(value: unknown): number {
        const score = Number(value);
        if (!Number.isFinite(score)) return 0;
        return Math.max(0, Math.min(100000, Math.trunc(score)));
    }

    function normalizeTimeAttackMs(value: unknown): number | null {
        const ms = Number(value);
        if (!Number.isFinite(ms)) return null;
        const normalized = Math.trunc(ms);
        if (normalized <= 0 || normalized > TIME_ATTACK_LIMIT_MS) return null;
        return normalized;
    }

    function normalizeTimeDefenseTurnCount(value: unknown): number | null {
        const turns = Number(value);
        if (!Number.isFinite(turns)) return null;
        const normalized = Math.trunc(turns);
        if (normalized <= 0) return null;
        return normalized;
    }

    function isStandardBoardEligible(value: unknown): boolean {
        if (!value || typeof value !== 'object') return true;
        const boardConfig = asRecord(value);
        if (boardConfig.standard8x8 === false) return false;
        const rows = Number(boardConfig.rows);
        const cols = Number(boardConfig.cols);
        if (Number.isFinite(rows) || Number.isFinite(cols)) {
            return Math.trunc(rows) === 8 && Math.trunc(cols) === 8;
        }
        return boardConfig.standard8x8 === true || !Object.prototype.hasOwnProperty.call(boardConfig, 'standard8x8');
    }

    function normalizeCpuLevel(value: unknown): number | null {
        if (value === null || value === undefined || String(value).trim() === '') return null;
        if (!Number.isFinite(Number(value))) return null;
        const level = Math.trunc(Number(value));
        return Math.max(1, Math.min(9, level));
    }

    function normalizeListCpuLevel(value: unknown): number | null {
        return normalizeCpuLevel(value);
    }

    function normalizeLimit(value: unknown): number {
        const parsed = Number(value);
        if (!Number.isFinite(parsed)) return defaultLimit;
        return Math.max(1, Math.min(maxLimit, Math.trunc(parsed)));
    }

    function normalizeEntry(value: unknown, fallbackPlayerId?: unknown, fallbackMode?: unknown, fallbackCategory?: unknown): MatchWorkerLeaderboardEntry | null {
        if (!value || typeof value !== 'object') return null;

        const entry = asRecord(value);
        const playerId = normalizePlayerId(entry.playerId || fallbackPlayerId);
        if (!playerId) return null;

        const category = normalizeCategory(entry.category || fallbackCategory);
        const mode = normalizeMode(entry.mode || fallbackMode);
        const bestTimeMs = category === 'timeAttack' ? normalizeTimeAttackMs(entry.bestTimeMs) : null;
        const lastTimeMs = category === 'timeAttack'
            ? (normalizeTimeAttackMs(entry.lastTimeMs) || bestTimeMs)
            : null;
        const turnCount = isTurnCountCategory(category)
            ? normalizeTimeDefenseTurnCount(entry.turnCount)
            : (Number.isFinite(Number(entry.turnCount)) ? Math.max(0, Math.trunc(Number(entry.turnCount))) : null);
        if (category === 'timeAttack' && bestTimeMs === null) return null;
        if (isTurnCountCategory(category) && turnCount === null) return null;
        const updatedAt = Number.isFinite(Number(entry.updatedAt))
            ? Math.max(0, Math.trunc(Number(entry.updatedAt)))
            : now();
        const submittedAt = Number.isFinite(Number(entry.submittedAt))
            ? Math.max(0, Math.trunc(Number(entry.submittedAt)))
            : updatedAt;

        return {
            playerId,
            playerName: normalizePlayerName(entry.playerName),
            category,
            bestScore: clampScore(entry.bestScore),
            lastScore: clampScore(entry.lastScore),
            bestTimeMs,
            lastTimeMs,
            mode,
            cpuLevel: mode === 'cpu' ? normalizeCpuLevel(entry.cpuLevel) : null,
            scoreVersion: Number.isFinite(Number(entry.scoreVersion)) ? Math.max(0, Math.trunc(Number(entry.scoreVersion))) : null,
            turnCount,
            updatedAt,
            submittedAt
        };
    }

    function isEntry(value: MatchWorkerLeaderboardEntry | null): value is MatchWorkerLeaderboardEntry {
        return value !== null;
    }

    function sortEntries(entries: MatchWorkerLeaderboardEntry[], category?: MatchWorkerLeaderboardCategory): void {
        const sortCategory = category || (entries[0] && entries[0].category) || 'score';
        entries.sort((a, b) => {
            if (sortCategory === 'timeAttack') {
                const aTime = Number.isFinite(Number(a.bestTimeMs)) ? Number(a.bestTimeMs) : Number.MAX_SAFE_INTEGER;
                const bTime = Number.isFinite(Number(b.bestTimeMs)) ? Number(b.bestTimeMs) : Number.MAX_SAFE_INTEGER;
                if (aTime !== bTime) return aTime - bTime;
                if (a.updatedAt !== b.updatedAt) return a.updatedAt - b.updatedAt;
                return String(a.playerName || '').localeCompare(String(b.playerName || ''), 'ja');
            }
            if (sortCategory === 'timeDefense') {
                const aTurns = Number.isFinite(Number(a.turnCount)) ? Number(a.turnCount) : 0;
                const bTurns = Number.isFinite(Number(b.turnCount)) ? Number(b.turnCount) : 0;
                if (aTurns !== bTurns) return bTurns - aTurns;
                if (a.updatedAt !== b.updatedAt) return a.updatedAt - b.updatedAt;
                return String(a.playerName || '').localeCompare(String(b.playerName || ''), 'ja');
            }
            if (sortCategory === 'shortestTurns') {
                const aTurns = Number.isFinite(Number(a.turnCount)) ? Number(a.turnCount) : Number.MAX_SAFE_INTEGER;
                const bTurns = Number.isFinite(Number(b.turnCount)) ? Number(b.turnCount) : Number.MAX_SAFE_INTEGER;
                if (aTurns !== bTurns) return aTurns - bTurns;
                if (a.updatedAt !== b.updatedAt) return a.updatedAt - b.updatedAt;
                return String(a.playerName || '').localeCompare(String(b.playerName || ''), 'ja');
            }
            if (b.bestScore !== a.bestScore) return b.bestScore - a.bestScore;
            if (a.updatedAt !== b.updatedAt) return a.updatedAt - b.updatedAt;
            return String(a.playerName || '').localeCompare(String(b.playerName || ''), 'ja');
        });
    }

    function createEmptyStore(): MatchWorkerLeaderboardStore {
        return {
            version: storageVersion,
            players: {},
            playerModes: {},
            playerCpuLevels: {},
            timeAttackPlayers: {},
            timeAttackPlayerModes: {},
            timeAttackPlayerCpuLevels: {},
            timeDefensePlayers: {},
            timeDefensePlayerModes: {},
            timeDefensePlayerCpuLevels: {},
            shortestTurnsPlayers: {},
            shortestTurnsPlayerModes: {},
            shortestTurnsPlayerCpuLevels: {},
            updatedAt: now()
        };
    }

    function normalizeModeEntries(
        value: unknown,
        fallbackPlayerId?: unknown,
        fallbackPlayerName?: unknown,
        fallbackOverallEntry?: MatchWorkerLeaderboardEntry | null,
        category?: MatchWorkerLeaderboardCategory
    ): MatchWorkerLeaderboardModeEntries {
        const out: MatchWorkerLeaderboardModeEntries = {};
        const raw = asRecord(value);
        const playerId = normalizePlayerId(fallbackPlayerId || raw.playerId || (fallbackOverallEntry && fallbackOverallEntry.playerId));
        if (!playerId) return out;
        const playerName = normalizePlayerName(
            fallbackPlayerName
            || raw.playerName
            || (fallbackOverallEntry && fallbackOverallEntry.playerName)
        );

        (['cpu', 'network'] as MatchWorkerLeaderboardMode[]).forEach((modeKey) => {
            const normalized = normalizeEntry(
                raw[modeKey],
                playerId,
                modeKey,
                category
            );
            if (normalized) {
                normalized.playerName = playerName;
                out[modeKey] = normalized;
            }
        });

        if (!out.cpu && !out.network && fallbackOverallEntry) {
            const fallbackEntry = normalizeEntry(fallbackOverallEntry, playerId, fallbackOverallEntry.mode, category);
            if (fallbackEntry) {
                fallbackEntry.playerName = playerName;
                out[fallbackEntry.mode] = fallbackEntry;
            }
        }

        return out;
    }

    function normalizeCpuLevelEntries(value: unknown, fallbackPlayerId?: unknown, fallbackPlayerName?: unknown, category?: MatchWorkerLeaderboardCategory): Record<string, MatchWorkerLeaderboardEntry> {
        const out: Record<string, MatchWorkerLeaderboardEntry> = {};
        const raw = asRecord(value);
        const playerId = normalizePlayerId(fallbackPlayerId || raw.playerId);
        if (!playerId) return out;
        const playerName = normalizePlayerName(fallbackPlayerName || raw.playerName);

        Object.keys(raw).forEach((key) => {
            const level = normalizeCpuLevel(key);
            if (level === null) return;
            const source = asRecord(raw[key]);
            const normalized = normalizeEntry(
                { ...source, playerId, playerName, mode: 'cpu', cpuLevel: level, category: category || 'score' },
                playerId,
                'cpu',
                category
            );
            if (!normalized) return;
            normalized.playerName = playerName;
            normalized.cpuLevel = level;
            out[String(level)] = normalized;
        });

        return out;
    }

    function selectOverallEntry(modeEntries: MatchWorkerLeaderboardModeEntries, category?: MatchWorkerLeaderboardCategory): MatchWorkerLeaderboardEntry | null {
        const entries = (['cpu', 'network'] as MatchWorkerLeaderboardMode[])
            .map((modeKey) => normalizeEntry(modeEntries[modeKey], undefined, modeKey, category))
            .filter(isEntry);
        if (!entries.length) return null;
        sortEntries(entries, category);
        return entries[0];
    }

    function cloneModeEntriesWithPlayerName(modeEntries: MatchWorkerLeaderboardModeEntries, playerName: string, category?: MatchWorkerLeaderboardCategory): MatchWorkerLeaderboardModeEntries {
        const out: MatchWorkerLeaderboardModeEntries = {};
        (['cpu', 'network'] as MatchWorkerLeaderboardMode[]).forEach((modeKey) => {
            const normalized = normalizeEntry(modeEntries[modeKey], undefined, modeKey, category);
            if (!normalized) return;
            normalized.playerName = playerName;
            out[modeKey] = normalized;
        });
        return out;
    }

    function loadStore(raw: unknown): MatchWorkerLeaderboardStore {
        const empty = createEmptyStore();
        if (!raw || typeof raw !== 'object') return empty;

        const rawRecord = asRecord(raw);
        const playersRaw = (rawRecord.players && typeof rawRecord.players === 'object') ? asRecord(rawRecord.players) : {};
        const playerModesRaw = (rawRecord.playerModes && typeof rawRecord.playerModes === 'object') ? asRecord(rawRecord.playerModes) : {};
        const playerCpuLevelsRaw = (rawRecord.playerCpuLevels && typeof rawRecord.playerCpuLevels === 'object') ? asRecord(rawRecord.playerCpuLevels) : {};
        const timeAttackPlayersRaw = (rawRecord.timeAttackPlayers && typeof rawRecord.timeAttackPlayers === 'object') ? asRecord(rawRecord.timeAttackPlayers) : {};
        const timeAttackPlayerModesRaw = (rawRecord.timeAttackPlayerModes && typeof rawRecord.timeAttackPlayerModes === 'object') ? asRecord(rawRecord.timeAttackPlayerModes) : {};
        const timeAttackPlayerCpuLevelsRaw = (rawRecord.timeAttackPlayerCpuLevels && typeof rawRecord.timeAttackPlayerCpuLevels === 'object') ? asRecord(rawRecord.timeAttackPlayerCpuLevels) : {};
        const timeDefensePlayersRaw = (rawRecord.timeDefensePlayers && typeof rawRecord.timeDefensePlayers === 'object') ? asRecord(rawRecord.timeDefensePlayers) : {};
        const timeDefensePlayerModesRaw = (rawRecord.timeDefensePlayerModes && typeof rawRecord.timeDefensePlayerModes === 'object') ? asRecord(rawRecord.timeDefensePlayerModes) : {};
        const timeDefensePlayerCpuLevelsRaw = (rawRecord.timeDefensePlayerCpuLevels && typeof rawRecord.timeDefensePlayerCpuLevels === 'object') ? asRecord(rawRecord.timeDefensePlayerCpuLevels) : {};
        const shortestTurnsPlayersRaw = (rawRecord.shortestTurnsPlayers && typeof rawRecord.shortestTurnsPlayers === 'object') ? asRecord(rawRecord.shortestTurnsPlayers) : {};
        const shortestTurnsPlayerModesRaw = (rawRecord.shortestTurnsPlayerModes && typeof rawRecord.shortestTurnsPlayerModes === 'object') ? asRecord(rawRecord.shortestTurnsPlayerModes) : {};
        const shortestTurnsPlayerCpuLevelsRaw = (rawRecord.shortestTurnsPlayerCpuLevels && typeof rawRecord.shortestTurnsPlayerCpuLevels === 'object') ? asRecord(rawRecord.shortestTurnsPlayerCpuLevels) : {};
        const players: Record<string, MatchWorkerLeaderboardEntry> = {};
        const playerModes: Record<string, MatchWorkerLeaderboardModeEntries> = {};
        const playerCpuLevels: Record<string, Record<string, MatchWorkerLeaderboardEntry>> = {};
        const timeAttackPlayers: Record<string, MatchWorkerLeaderboardEntry> = {};
        const timeAttackPlayerModes: Record<string, MatchWorkerLeaderboardModeEntries> = {};
        const timeAttackPlayerCpuLevels: Record<string, Record<string, MatchWorkerLeaderboardEntry>> = {};
        const timeDefensePlayers: Record<string, MatchWorkerLeaderboardEntry> = {};
        const timeDefensePlayerModes: Record<string, MatchWorkerLeaderboardModeEntries> = {};
        const timeDefensePlayerCpuLevels: Record<string, Record<string, MatchWorkerLeaderboardEntry>> = {};
        const shortestTurnsPlayers: Record<string, MatchWorkerLeaderboardEntry> = {};
        const shortestTurnsPlayerModes: Record<string, MatchWorkerLeaderboardModeEntries> = {};
        const shortestTurnsPlayerCpuLevels: Record<string, Record<string, MatchWorkerLeaderboardEntry>> = {};

        const playerIds = new Set<string>();
        Object.keys(playersRaw).forEach((key) => {
            const normalized = normalizePlayerId(key);
            if (normalized) playerIds.add(normalized);
        });
        Object.keys(playerModesRaw).forEach((key) => {
            const normalized = normalizePlayerId(key);
            if (normalized) playerIds.add(normalized);
        });
        Object.keys(playerCpuLevelsRaw).forEach((key) => {
            const normalized = normalizePlayerId(key);
            if (normalized) playerIds.add(normalized);
        });

        for (const playerId of playerIds) {
            const overallEntry = normalizeEntry(playersRaw[playerId], playerId);
            const playerName = normalizePlayerName(
                (overallEntry && overallEntry.playerName)
                || asRecord(playerModesRaw[playerId]).playerName
            );
            const modeEntries = cloneModeEntriesWithPlayerName(
                normalizeModeEntries(playerModesRaw[playerId], playerId, playerName, overallEntry),
                playerName
            );
            const cpuLevelEntries = normalizeCpuLevelEntries(playerCpuLevelsRaw[playerId], playerId, playerName);
            if (!Object.keys(cpuLevelEntries).length && modeEntries.cpu && modeEntries.cpu.cpuLevel !== null) {
                cpuLevelEntries[String(modeEntries.cpu.cpuLevel)] = modeEntries.cpu;
            }
            const cpuBestEntry = selectCpuOverallEntry(cpuLevelEntries);
            if (cpuBestEntry) {
                modeEntries.cpu = cpuBestEntry;
            }
            const nextOverall = selectOverallEntry(modeEntries) || overallEntry;
            if (nextOverall) {
                nextOverall.playerName = playerName;
                players[playerId] = nextOverall;
            }
            if (modeEntries.cpu || modeEntries.network) {
                playerModes[playerId] = modeEntries;
            }
            if (Object.keys(cpuLevelEntries).length) {
                playerCpuLevels[playerId] = cpuLevelEntries;
            }
        }

        const timeAttackIds = new Set<string>();
        Object.keys(timeAttackPlayersRaw).forEach((key) => {
            const normalized = normalizePlayerId(key);
            if (normalized) timeAttackIds.add(normalized);
        });
        Object.keys(timeAttackPlayerModesRaw).forEach((key) => {
            const normalized = normalizePlayerId(key);
            if (normalized) timeAttackIds.add(normalized);
        });
        Object.keys(timeAttackPlayerCpuLevelsRaw).forEach((key) => {
            const normalized = normalizePlayerId(key);
            if (normalized) timeAttackIds.add(normalized);
        });

        for (const playerId of timeAttackIds) {
            const overallEntry = normalizeEntry(timeAttackPlayersRaw[playerId], playerId, undefined, 'timeAttack');
            const playerName = normalizePlayerName(
                (overallEntry && overallEntry.playerName)
                || asRecord(timeAttackPlayerModesRaw[playerId]).playerName
            );
            const modeEntries = cloneModeEntriesWithPlayerName(
                normalizeModeEntries(timeAttackPlayerModesRaw[playerId], playerId, playerName, overallEntry, 'timeAttack'),
                playerName,
                'timeAttack'
            );
            const cpuLevelEntries = normalizeCpuLevelEntries(timeAttackPlayerCpuLevelsRaw[playerId], playerId, playerName, 'timeAttack');
            const cpuBestEntry = selectCpuOverallEntry(cpuLevelEntries, 'timeAttack');
            if (cpuBestEntry) {
                modeEntries.cpu = cpuBestEntry;
            }
            const nextOverall = selectOverallEntry(modeEntries, 'timeAttack') || overallEntry;
            if (nextOverall) {
                nextOverall.playerName = playerName;
                timeAttackPlayers[playerId] = nextOverall;
            }
            if (modeEntries.cpu || modeEntries.network) {
                timeAttackPlayerModes[playerId] = modeEntries;
            }
            if (Object.keys(cpuLevelEntries).length) {
                timeAttackPlayerCpuLevels[playerId] = cpuLevelEntries;
            }
        }

        const timeDefenseIds = new Set<string>();
        Object.keys(timeDefensePlayersRaw).forEach((key) => {
            const normalized = normalizePlayerId(key);
            if (normalized) timeDefenseIds.add(normalized);
        });
        Object.keys(timeDefensePlayerModesRaw).forEach((key) => {
            const normalized = normalizePlayerId(key);
            if (normalized) timeDefenseIds.add(normalized);
        });
        Object.keys(timeDefensePlayerCpuLevelsRaw).forEach((key) => {
            const normalized = normalizePlayerId(key);
            if (normalized) timeDefenseIds.add(normalized);
        });

        for (const playerId of timeDefenseIds) {
            const overallEntry = normalizeEntry(timeDefensePlayersRaw[playerId], playerId, undefined, 'timeDefense');
            const playerName = normalizePlayerName(
                (overallEntry && overallEntry.playerName)
                || asRecord(timeDefensePlayerModesRaw[playerId]).playerName
            );
            const modeEntries = cloneModeEntriesWithPlayerName(
                normalizeModeEntries(timeDefensePlayerModesRaw[playerId], playerId, playerName, overallEntry, 'timeDefense'),
                playerName,
                'timeDefense'
            );
            const cpuLevelEntries = normalizeCpuLevelEntries(timeDefensePlayerCpuLevelsRaw[playerId], playerId, playerName, 'timeDefense');
            const cpuBestEntry = selectCpuOverallEntry(cpuLevelEntries, 'timeDefense');
            if (cpuBestEntry) {
                modeEntries.cpu = cpuBestEntry;
            }
            const nextOverall = selectOverallEntry(modeEntries, 'timeDefense') || overallEntry;
            if (nextOverall) {
                nextOverall.playerName = playerName;
                timeDefensePlayers[playerId] = nextOverall;
            }
            if (modeEntries.cpu || modeEntries.network) {
                timeDefensePlayerModes[playerId] = modeEntries;
            }
            if (Object.keys(cpuLevelEntries).length) {
                timeDefensePlayerCpuLevels[playerId] = cpuLevelEntries;
            }
        }

        const shortestTurnsIds = new Set<string>();
        Object.keys(shortestTurnsPlayersRaw).forEach((key) => {
            const normalized = normalizePlayerId(key);
            if (normalized) shortestTurnsIds.add(normalized);
        });
        Object.keys(shortestTurnsPlayerModesRaw).forEach((key) => {
            const normalized = normalizePlayerId(key);
            if (normalized) shortestTurnsIds.add(normalized);
        });
        Object.keys(shortestTurnsPlayerCpuLevelsRaw).forEach((key) => {
            const normalized = normalizePlayerId(key);
            if (normalized) shortestTurnsIds.add(normalized);
        });

        for (const playerId of shortestTurnsIds) {
            const overallEntry = normalizeEntry(shortestTurnsPlayersRaw[playerId], playerId, undefined, 'shortestTurns');
            const playerName = normalizePlayerName(
                (overallEntry && overallEntry.playerName)
                || asRecord(shortestTurnsPlayerModesRaw[playerId]).playerName
            );
            const modeEntries = cloneModeEntriesWithPlayerName(
                normalizeModeEntries(shortestTurnsPlayerModesRaw[playerId], playerId, playerName, overallEntry, 'shortestTurns'),
                playerName,
                'shortestTurns'
            );
            const cpuLevelEntries = normalizeCpuLevelEntries(shortestTurnsPlayerCpuLevelsRaw[playerId], playerId, playerName, 'shortestTurns');
            const cpuBestEntry = selectCpuOverallEntry(cpuLevelEntries, 'shortestTurns');
            if (cpuBestEntry) {
                modeEntries.cpu = cpuBestEntry;
            }
            const nextOverall = selectOverallEntry(modeEntries, 'shortestTurns') || overallEntry;
            if (nextOverall) {
                nextOverall.playerName = playerName;
                shortestTurnsPlayers[playerId] = nextOverall;
            }
            if (modeEntries.cpu || modeEntries.network) {
                shortestTurnsPlayerModes[playerId] = modeEntries;
            }
            if (Object.keys(cpuLevelEntries).length) {
                shortestTurnsPlayerCpuLevels[playerId] = cpuLevelEntries;
            }
        }

        const updatedAt = Number.isFinite(Number(rawRecord.updatedAt))
            ? Math.max(0, Math.trunc(Number(rawRecord.updatedAt)))
            : now();

        return {
            version: storageVersion,
            players,
            playerModes,
            playerCpuLevels,
            timeAttackPlayers,
            timeAttackPlayerModes,
            timeAttackPlayerCpuLevels,
            timeDefensePlayers,
            timeDefensePlayerModes,
            timeDefensePlayerCpuLevels,
            shortestTurnsPlayers,
            shortestTurnsPlayerModes,
            shortestTurnsPlayerCpuLevels,
            updatedAt
        };
    }

    function serializeStore(store: MatchWorkerLeaderboardStore, category?: unknown): Record<string, unknown> {
        const normalizedCategory = normalizeCategory(category);
        if (normalizedCategory === 'timeAttack') {
            return {
                version: storageVersion,
                timeAttackPlayers: (store && store.timeAttackPlayers && typeof store.timeAttackPlayers === 'object') ? store.timeAttackPlayers : {},
                timeAttackPlayerModes: (store && store.timeAttackPlayerModes && typeof store.timeAttackPlayerModes === 'object') ? store.timeAttackPlayerModes : {},
                timeAttackPlayerCpuLevels: (store && store.timeAttackPlayerCpuLevels && typeof store.timeAttackPlayerCpuLevels === 'object') ? store.timeAttackPlayerCpuLevels : {},
                updatedAt: Number.isFinite(Number(store && store.updatedAt)) ? Math.max(0, Math.trunc(Number(store.updatedAt))) : now()
            };
        }
        if (normalizedCategory === 'timeDefense') {
            return {
                version: storageVersion,
                timeDefensePlayers: (store && store.timeDefensePlayers && typeof store.timeDefensePlayers === 'object') ? store.timeDefensePlayers : {},
                timeDefensePlayerModes: (store && store.timeDefensePlayerModes && typeof store.timeDefensePlayerModes === 'object') ? store.timeDefensePlayerModes : {},
                timeDefensePlayerCpuLevels: (store && store.timeDefensePlayerCpuLevels && typeof store.timeDefensePlayerCpuLevels === 'object') ? store.timeDefensePlayerCpuLevels : {},
                updatedAt: Number.isFinite(Number(store && store.updatedAt)) ? Math.max(0, Math.trunc(Number(store.updatedAt))) : now()
            };
        }
        if (normalizedCategory === 'shortestTurns') {
            return {
                version: storageVersion,
                shortestTurnsPlayers: (store && store.shortestTurnsPlayers && typeof store.shortestTurnsPlayers === 'object') ? store.shortestTurnsPlayers : {},
                shortestTurnsPlayerModes: (store && store.shortestTurnsPlayerModes && typeof store.shortestTurnsPlayerModes === 'object') ? store.shortestTurnsPlayerModes : {},
                shortestTurnsPlayerCpuLevels: (store && store.shortestTurnsPlayerCpuLevels && typeof store.shortestTurnsPlayerCpuLevels === 'object') ? store.shortestTurnsPlayerCpuLevels : {},
                updatedAt: Number.isFinite(Number(store && store.updatedAt)) ? Math.max(0, Math.trunc(Number(store.updatedAt))) : now()
            };
        }
        return {
            version: storageVersion,
            players: (store && store.players && typeof store.players === 'object') ? store.players : {},
            playerModes: (store && store.playerModes && typeof store.playerModes === 'object') ? store.playerModes : {},
            playerCpuLevels: (store && store.playerCpuLevels && typeof store.playerCpuLevels === 'object') ? store.playerCpuLevels : {},
            updatedAt: Number.isFinite(Number(store && store.updatedAt)) ? Math.max(0, Math.trunc(Number(store.updatedAt))) : now()
        };
    }

    function selectCpuOverallEntry(entriesByLevel: Record<string, MatchWorkerLeaderboardEntry>, category?: MatchWorkerLeaderboardCategory): MatchWorkerLeaderboardEntry | null {
        const entries = Object.values(entriesByLevel || {})
            .map((entry) => normalizeEntry(entry, undefined, 'cpu', category))
            .filter(isEntry);
        if (!entries.length) return null;
        sortEntries(entries, category);
        return entries[0];
    }

    function listEntries(store: MatchWorkerLeaderboardStore, limit: unknown, mode?: unknown, cpuLevel?: unknown, category?: unknown): Array<Record<string, unknown>> {
        const normalizedCategory = normalizeCategory(category);
        const normalizedMode = normalizeListMode(mode);
        const normalizedCpuLevel = normalizedMode === 'cpu' ? normalizeListCpuLevel(cpuLevel) : null;
        const playersMap = normalizedCategory === 'timeAttack'
            ? store && store.timeAttackPlayers
            : normalizedCategory === 'timeDefense'
            ? store && store.timeDefensePlayers
            : normalizedCategory === 'shortestTurns'
            ? store && store.shortestTurnsPlayers
            : store && store.players;
        const modeMap = normalizedCategory === 'timeAttack'
            ? store && store.timeAttackPlayerModes
            : normalizedCategory === 'timeDefense'
            ? store && store.timeDefensePlayerModes
            : normalizedCategory === 'shortestTurns'
            ? store && store.shortestTurnsPlayerModes
            : store && store.playerModes;
        const cpuLevelsMap = normalizedCategory === 'timeAttack'
            ? store && store.timeAttackPlayerCpuLevels
            : normalizedCategory === 'timeDefense'
            ? store && store.timeDefensePlayerCpuLevels
            : normalizedCategory === 'shortestTurns'
            ? store && store.shortestTurnsPlayerCpuLevels
            : store && store.playerCpuLevels;
        let sourceEntries: MatchWorkerLeaderboardEntry[];

        if (normalizedMode === 'all') {
            sourceEntries = Object.values(playersMap || {})
                .map((entry) => normalizeEntry(entry, undefined, undefined, normalizedCategory))
                .filter(isEntry);
        } else if (normalizedMode === 'cpu' && normalizedCpuLevel !== null) {
            sourceEntries = Object.entries(cpuLevelsMap || {})
                .map(([playerId, levelEntries]) => normalizeEntry(
                    levelEntries && levelEntries[String(normalizedCpuLevel)],
                    playerId,
                    'cpu',
                    normalizedCategory
                ))
                .filter(isEntry);
        } else {
            sourceEntries = Object.entries(modeMap || {})
                .map(([playerId, modeEntries]) => normalizeEntry(modeEntries && modeEntries[normalizedMode], playerId, normalizedMode, normalizedCategory))
                .filter(isEntry);
        }

        sortEntries(sourceEntries, normalizedCategory);

        const clipped = sourceEntries.slice(0, normalizeLimit(limit));
        return clipped.map((entry, index) => ({
            rank: index + 1,
            playerId: entry.playerId,
            playerName: entry.playerName,
            category: entry.category,
            bestScore: entry.bestScore,
            bestTimeMs: entry.bestTimeMs,
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

        const category = normalizeCategory(body && body.category);
        const playerName = normalizePlayerName(body && body.playerName);
        const score = clampScore(body && body.score);
        const elapsedMs = normalizeTimeAttackMs(body && body.elapsedMs);
        const timeDefenseTurnCount = normalizeTimeDefenseTurnCount(body && body.turnCount);
        const shortestTurnsCount = normalizeTimeDefenseTurnCount(body && body.turnCount);
        const mode = normalizeMode(body && body.mode);
        if (!isStandardBoardEligible(body && body.boardConfig)) {
            return { ok: false, reason: 'BOARD_NOT_ELIGIBLE' };
        }
        if (category === 'timeAttack' && (elapsedMs === null || body && body.debug === true || mode !== 'cpu')) {
            return { ok: false, reason: 'TIME_ATTACK_INELIGIBLE' };
        }
        if (category === 'timeDefense' && (timeDefenseTurnCount === null || body && body.debug === true || mode !== 'cpu')) {
            return { ok: false, reason: 'TIME_DEFENSE_INELIGIBLE' };
        }
        if (category === 'shortestTurns' && (shortestTurnsCount === null || body && body.debug === true || mode !== 'cpu')) {
            return { ok: false, reason: 'SHORTEST_TURNS_INELIGIBLE' };
        }
        if (category === 'score' && body && body.debug === true) {
            return { ok: false, reason: 'SCORE_INELIGIBLE' };
        }
        const cpuLevel = mode === 'cpu' ? normalizeCpuLevel(body && body.cpuLevel) : null;
        const scoreVersion = Number.isFinite(Number(body && body.scoreVersion)) ? Math.max(0, Math.trunc(Number(body.scoreVersion))) : null;
        const turnCount = Number.isFinite(Number(body && body.turnCount)) ? Math.max(0, Math.trunc(Number(body.turnCount))) : null;
        const listMode = normalizeListMode(body && body.mode);

        const nextStore: MatchWorkerLeaderboardStore = {
            version: storageVersion,
            players: { ...((store && store.players) || {}) },
            playerModes: { ...((store && store.playerModes) || {}) },
            playerCpuLevels: { ...((store && store.playerCpuLevels) || {}) },
            timeAttackPlayers: { ...((store && store.timeAttackPlayers) || {}) },
            timeAttackPlayerModes: { ...((store && store.timeAttackPlayerModes) || {}) },
            timeAttackPlayerCpuLevels: { ...((store && store.timeAttackPlayerCpuLevels) || {}) },
            timeDefensePlayers: { ...((store && store.timeDefensePlayers) || {}) },
            timeDefensePlayerModes: { ...((store && store.timeDefensePlayerModes) || {}) },
            timeDefensePlayerCpuLevels: { ...((store && store.timeDefensePlayerCpuLevels) || {}) },
            shortestTurnsPlayers: { ...((store && store.shortestTurnsPlayers) || {}) },
            shortestTurnsPlayerModes: { ...((store && store.shortestTurnsPlayerModes) || {}) },
            shortestTurnsPlayerCpuLevels: { ...((store && store.shortestTurnsPlayerCpuLevels) || {}) },
            updatedAt: Number.isFinite(Number(store && store.updatedAt)) ? Math.max(0, Math.trunc(Number(store.updatedAt))) : now()
        };

        const submittedAt = now();
        const playersMap = category === 'timeAttack'
            ? nextStore.timeAttackPlayers
            : category === 'timeDefense'
            ? nextStore.timeDefensePlayers
            : category === 'shortestTurns'
            ? nextStore.shortestTurnsPlayers
            : nextStore.players;
        const modeMap = category === 'timeAttack'
            ? nextStore.timeAttackPlayerModes
            : category === 'timeDefense'
            ? nextStore.timeDefensePlayerModes
            : category === 'shortestTurns'
            ? nextStore.shortestTurnsPlayerModes
            : nextStore.playerModes;
        const cpuLevelsMap = category === 'timeAttack'
            ? nextStore.timeAttackPlayerCpuLevels
            : category === 'timeDefense'
            ? nextStore.timeDefensePlayerCpuLevels
            : category === 'shortestTurns'
            ? nextStore.shortestTurnsPlayerCpuLevels
            : nextStore.playerCpuLevels;
        const currentOverall = normalizeEntry(playersMap[playerId], playerId, undefined, category);
        const currentModeEntries = cloneModeEntriesWithPlayerName(
            normalizeModeEntries(modeMap[playerId], playerId, playerName, currentOverall, category),
            playerName,
            category
        );
        const currentCpuLevelEntries = normalizeCpuLevelEntries(cpuLevelsMap[playerId], playerId, playerName, category);
        const currentModeEntry = mode === 'cpu' && cpuLevel !== null
            ? normalizeEntry(currentCpuLevelEntries[String(cpuLevel)], playerId, 'cpu', category)
            : normalizeEntry(currentModeEntries[mode], playerId, mode, category);
        const previousBest = category === 'timeAttack'
            ? (currentModeEntry && Number.isFinite(Number(currentModeEntry.bestTimeMs)) ? Number(currentModeEntry.bestTimeMs) : null)
            : category === 'timeDefense'
            ? (currentModeEntry && Number.isFinite(Number(currentModeEntry.turnCount)) ? Number(currentModeEntry.turnCount) : null)
            : category === 'shortestTurns'
            ? (currentModeEntry && Number.isFinite(Number(currentModeEntry.turnCount)) ? Number(currentModeEntry.turnCount) : null)
            : (currentModeEntry ? currentModeEntry.bestScore : 0);
        const updated = category === 'timeAttack'
            ? (previousBest === null || Number(elapsedMs) < Number(previousBest))
            : category === 'timeDefense'
            ? (previousBest === null || Number(timeDefenseTurnCount) > Number(previousBest))
            : category === 'shortestTurns'
            ? (previousBest === null || Number(shortestTurnsCount) < Number(previousBest))
            : score > Number(previousBest);
        const bestScore = category === 'score' ? (updated ? score : Number(previousBest)) : 0;
        const bestTimeMs = category === 'timeAttack'
            ? (updated ? elapsedMs : previousBest)
            : null;
        const bestScoreVersion = category === 'score' && !updated && currentModeEntry
            ? currentModeEntry.scoreVersion
            : (category === 'score' ? scoreVersion : null);
        const bestTurnCount = category === 'timeDefense'
            ? (updated ? timeDefenseTurnCount : previousBest)
            : category === 'shortestTurns'
            ? (updated ? shortestTurnsCount : previousBest)
            : category === 'score' && !updated && currentModeEntry
            ? currentModeEntry.turnCount
            : turnCount;

        const nextEntry: MatchWorkerLeaderboardEntry = {
            playerId,
            playerName,
            category,
            bestScore,
            lastScore: score,
            bestTimeMs,
            lastTimeMs: category === 'timeAttack' ? elapsedMs : null,
            mode,
            cpuLevel,
            scoreVersion: bestScoreVersion,
            turnCount: bestTurnCount,
            updatedAt: updated ? submittedAt : (currentModeEntry ? currentModeEntry.updatedAt : submittedAt),
            submittedAt
        };

        if (mode === 'cpu' && cpuLevel !== null) {
            currentCpuLevelEntries[String(cpuLevel)] = nextEntry;
            const cpuOverall = selectCpuOverallEntry(currentCpuLevelEntries, category);
            if (cpuOverall) {
                currentModeEntries.cpu = cpuOverall;
                cpuLevelsMap[playerId] = currentCpuLevelEntries;
            }
        } else {
            currentModeEntries[mode] = nextEntry;
        }

        const nextOverall = selectOverallEntry(currentModeEntries, category);
        if (nextOverall) {
            nextOverall.playerName = playerName;
            playersMap[playerId] = nextOverall;
            modeMap[playerId] = currentModeEntries;
        }

        const allRows = Object.values(playersMap)
            .map((entry) => normalizeEntry(entry, undefined, undefined, category))
            .filter(isEntry);
        sortEntries(allRows, category);

        if (allRows.length > maxStoredPlayers) {
            const keep = new Set(allRows.slice(0, maxStoredPlayers).map((entry) => entry.playerId));
            for (const id of Object.keys(playersMap)) {
                if (keep.has(id)) continue;
                delete playersMap[id];
                delete modeMap[id];
                delete cpuLevelsMap[id];
            }
        }

        nextStore.updatedAt = submittedAt;
        const entries = listEntries(nextStore, body && body.limit, listMode, cpuLevel, category);
        const playerRank = entries.findIndex((entry) => entry && entry.playerId === playerId) + 1;

        return {
            ok: true,
            store: nextStore,
            payload: {
                ok: true,
                version: storageVersion,
                category,
                playerId,
                playerName,
                updated,
                previousBest,
                bestScore,
                bestTimeMs,
                bestTurnCount: isTurnCountCategory(category) ? bestTurnCount : null,
                score,
                elapsedMs,
                turnCount: category === 'timeDefense'
                    ? timeDefenseTurnCount
                    : category === 'shortestTurns'
                    ? shortestTurnsCount
                    : turnCount,
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
        normalizeListMode,
        normalizeCategory,
        normalizeListCpuLevel,
        clampScore,
        normalizeCpuLevel,
        normalizeLimit,
        isStandardBoardEligible,
        normalizeEntry,
        createEmptyStore,
        loadStore,
        serializeStore,
        listEntries,
        applySubmit
    };
}
