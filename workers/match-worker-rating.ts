import {
    createInitialPlayerRating,
    normalizeRatedPool,
    normalizeRatedResult,
    RATED_POOL_CARD_RANKED_V1,
    RATING_SYSTEM_VERSION,
    PlayerRating,
    RatingMatchRecord,
    RatingPlayerHistoryEntry,
    RatingPublicProfile
} from '../shared/rating-contract';
import { computeGlicko2PairUpdate } from '../shared/glicko2-rating';
import type { MatchWorkerActiveRatedMatch, MatchWorkerRatingStore } from './match-worker-types';

const PlayerProfileContract = require('../shared/player-profile-contract');

type RatingHelpersConfig = { now?: () => string };

type ApplyRatedResultInput = {
    matchId: string;
    pool: string;
    blackPlayerId: string;
    whitePlayerId: string;
    result: 'BLACK_WIN' | 'WHITE_WIN' | 'DRAW' | 'NO_CONTEST';
    rulesetVersion: string;
    catalogVersion: string;
};

type ClaimActiveRatedMatchInput = {
    matchId: string;
    roomId: string;
    blackPlayerId: string;
    whitePlayerId: string;
    blackPlayerName?: unknown;
    whitePlayerName?: unknown;
    blackAvatarStoneType?: unknown;
    whiteAvatarStoneType?: unknown;
    blackBio?: unknown;
    whiteBio?: unknown;
    startedAt: string;
};

type ListPlayerHistoryInput = {
    playerId?: unknown;
    limit?: unknown;
};

type UpdatePublicProfileInput = {
    playerId?: unknown;
    playerName?: unknown;
    avatarStoneType?: unknown;
    bio?: unknown;
};

function asRecord(value: unknown): Record<string, unknown> {
    return value && typeof value === 'object' ? value as Record<string, unknown> : {};
}

function normalizePlayerId(value: unknown): string | null {
    const playerId = String(value || '').trim();
    return /^[A-Za-z0-9_-]{8,80}$/.test(playerId) ? playerId : null;
}

function normalizeMatchId(value: unknown): string {
    return String(value || '').trim();
}

function normalizeHistoryLimit(value: unknown): number {
    const limit = Number(value);
    return Number.isFinite(limit) ? Math.max(1, Math.min(50, Math.trunc(limit))) : 10;
}

function parseRatedAtMs(record: RatingMatchRecord): number {
    const ms = Date.parse(String(record.ratedAt || ''));
    return Number.isFinite(ms) ? ms : 0;
}

function normalizePlayerName(value: unknown): string {
    const normalized = String(value || '').replace(/\s+/g, ' ').trim();
    return Array.from(normalized).slice(0, 7).join('') || 'ななし';
}

function normalizeAvatarStoneType(value: unknown): string {
    if (PlayerProfileContract && typeof PlayerProfileContract.normalizeProfileAvatarStoneType === 'function') {
        return PlayerProfileContract.normalizeProfileAvatarStoneType(value);
    }
    return String(value || '').trim().toUpperCase() || 'REGEN';
}

function normalizeProfileBio(value: unknown): string {
    if (PlayerProfileContract && typeof PlayerProfileContract.normalizeProfileBio === 'function') {
        return PlayerProfileContract.normalizeProfileBio(value);
    }
    return Array.from(String(value || '').replace(/\r\n?/g, '\n').trim()).slice(0, 120).join('');
}

function createPublicProfile(playerId: string, source: Record<string, unknown>, nowIso: string): RatingPublicProfile {
    return {
        playerId,
        playerName: normalizePlayerName(source.playerName),
        avatarStoneType: normalizeAvatarStoneType(source.avatarStoneType),
        bio: normalizeProfileBio(source.bio),
        updatedAt: typeof source.updatedAt === 'string' ? source.updatedAt : nowIso
    };
}

function normalizePublicProfile(value: unknown, fallbackPlayerId: string, nowIso: string): RatingPublicProfile | null {
    const playerId = normalizePlayerId(fallbackPlayerId);
    if (!playerId) return null;
    const source = asRecord(value);
    return createPublicProfile(playerId, source, nowIso);
}

function normalizePlayerRating(value: unknown, fallbackPlayerId: string, nowIso: string): PlayerRating {
    const source = asRecord(value);
    const initial = createInitialPlayerRating(fallbackPlayerId, nowIso);
    const playerId = normalizePlayerId(source.playerId) || fallbackPlayerId;
    const rating = Number(source.rating);
    const deviation = Number(source.deviation);
    const volatility = Number(source.volatility);
    return {
        playerId,
        pool: RATED_POOL_CARD_RANKED_V1,
        systemVersion: RATING_SYSTEM_VERSION,
        rating: Number.isFinite(rating) ? rating : initial.rating,
        deviation: Number.isFinite(deviation) ? deviation : initial.deviation,
        volatility: Number.isFinite(volatility) ? volatility : initial.volatility,
        ratedGames: Number.isFinite(Number(source.ratedGames)) ? Math.max(0, Math.trunc(Number(source.ratedGames))) : 0,
        wins: Number.isFinite(Number(source.wins)) ? Math.max(0, Math.trunc(Number(source.wins))) : 0,
        draws: Number.isFinite(Number(source.draws)) ? Math.max(0, Math.trunc(Number(source.draws))) : 0,
        losses: Number.isFinite(Number(source.losses)) ? Math.max(0, Math.trunc(Number(source.losses))) : 0,
        lastRatedAt: typeof source.lastRatedAt === 'string' ? source.lastRatedAt : null,
        updatedAt: typeof source.updatedAt === 'string' ? source.updatedAt : nowIso
    };
}

function normalizeMatchRecord(value: unknown, fallbackMatchId: string): RatingMatchRecord | null {
    const source = asRecord(value);
    const matchId = normalizeMatchId(source.matchId || fallbackMatchId);
    const pool = normalizeRatedPool(source.pool);
    const result = normalizeRatedResult(source.result);
    const blackPlayerId = normalizePlayerId(source.blackPlayerId);
    const whitePlayerId = normalizePlayerId(source.whitePlayerId);
    if (!matchId || !pool || result === 'NO_CONTEST' || !result || !blackPlayerId || !whitePlayerId) return null;
    return source as RatingMatchRecord;
}

function normalizeActiveMatch(value: unknown): MatchWorkerActiveRatedMatch | null {
    const source = asRecord(value);
    const matchId = normalizeMatchId(source.matchId);
    const roomId = String(source.roomId || '').trim();
    const playerIds = Array.isArray(source.playerIds)
        ? source.playerIds.map((entry) => normalizePlayerId(entry)).filter((entry): entry is string => !!entry)
        : [];
    if (!matchId || !roomId || playerIds.length === 0) return null;
    const rawProfiles = asRecord(source.publicProfiles);
    const publicProfiles: Record<string, RatingPublicProfile> = {};
    playerIds.forEach((playerId) => {
        const profile = normalizePublicProfile(rawProfiles[playerId], playerId, typeof source.startedAt === 'string' ? source.startedAt : '');
        if (profile) publicProfiles[playerId] = profile;
    });
    return {
        matchId,
        pool: RATED_POOL_CARD_RANKED_V1,
        roomId,
        playerIds,
        publicProfiles,
        startedAt: typeof source.startedAt === 'string' ? source.startedAt : ''
    };
}

export function createMatchWorkerRatingHelpers(config: RatingHelpersConfig = {}) {
    const now = typeof config.now === 'function' ? config.now : () => new Date().toISOString();

    function createEmptyStore(): MatchWorkerRatingStore {
        return {
            version: RATING_SYSTEM_VERSION,
            pool: RATED_POOL_CARD_RANKED_V1,
            players: {},
            publicProfiles: {},
            matches: {},
            activeMatches: {},
            updatedAt: now()
        };
    }

    function loadStore(raw: unknown): MatchWorkerRatingStore {
        const empty = createEmptyStore();
        if (!raw || typeof raw !== 'object') return empty;
        const source = asRecord(raw);
        const nowIso = typeof source.updatedAt === 'string' ? source.updatedAt : now();
        const rawPlayers = asRecord(source.players);
        const players: Record<string, PlayerRating> = {};
        Object.keys(rawPlayers).forEach((playerIdKey) => {
            const playerId = normalizePlayerId(playerIdKey);
            if (!playerId) return;
            players[playerId] = normalizePlayerRating(rawPlayers[playerIdKey], playerId, nowIso);
        });
        const rawProfiles = asRecord(source.publicProfiles);
        const publicProfiles: Record<string, RatingPublicProfile> = {};
        Object.keys(rawProfiles).forEach((playerIdKey) => {
            const playerId = normalizePlayerId(playerIdKey);
            if (!playerId) return;
            const profile = normalizePublicProfile(rawProfiles[playerIdKey], playerId, nowIso);
            if (profile) publicProfiles[playerId] = profile;
        });
        const rawMatches = asRecord(source.matches);
        const matches: Record<string, RatingMatchRecord> = {};
        Object.keys(rawMatches).forEach((matchIdKey) => {
            const record = normalizeMatchRecord(rawMatches[matchIdKey], matchIdKey);
            if (record) matches[record.matchId] = record;
        });
        const rawActiveMatches = asRecord(source.activeMatches);
        const activeMatches: Record<string, MatchWorkerActiveRatedMatch> = {};
        Object.keys(rawActiveMatches).forEach((playerIdKey) => {
            const playerId = normalizePlayerId(playerIdKey);
            const active = normalizeActiveMatch(rawActiveMatches[playerIdKey]);
            if (playerId && active) activeMatches[playerId] = active;
        });
        return {
            version: RATING_SYSTEM_VERSION,
            pool: RATED_POOL_CARD_RANKED_V1,
            players,
            publicProfiles,
            matches,
            activeMatches,
            updatedAt: nowIso
        };
    }

    function getPlayerRating(storeValue: unknown, playerIdValue: unknown): PlayerRating | null {
        const store = loadStore(storeValue);
        const playerId = normalizePlayerId(playerIdValue);
        if (!playerId) return null;
        return store.players[playerId] || createInitialPlayerRating(playerId, now());
    }

    function applyRatedResult(storeValue: unknown, input: ApplyRatedResultInput): any {
        const store = loadStore(storeValue);
        const matchId = normalizeMatchId(input && input.matchId);
        const pool = normalizeRatedPool(input && input.pool);
        const result = normalizeRatedResult(input && input.result);
        const blackPlayerId = normalizePlayerId(input && input.blackPlayerId);
        const whitePlayerId = normalizePlayerId(input && input.whitePlayerId);
        if (!matchId || !pool || !result || !blackPlayerId || !whitePlayerId || blackPlayerId === whitePlayerId) {
            return { ok: false, reason: 'RATED_RESULT_INVALID', store };
        }
        if (result === 'NO_CONTEST') {
            const released = releaseActiveRatedMatch(store, matchId);
            return { ok: true, noContest: true, store: released.store, payload: { ok: true, matchId, result } };
        }
        const existing = store.matches[matchId];
        if (existing) {
            const released = releaseActiveRatedMatch(store, matchId);
            return { ok: true, idempotentReplay: true, store: released.store, payload: createPayloadFromRecord(existing, released.store) };
        }

        const ratedAt = now();
        const blackBefore = store.players[blackPlayerId] || createInitialPlayerRating(blackPlayerId, ratedAt);
        const whiteBefore = store.players[whitePlayerId] || createInitialPlayerRating(whitePlayerId, ratedAt);
        const activeProfiles = asRecord((store.activeMatches[blackPlayerId] || store.activeMatches[whitePlayerId] || {}).publicProfiles);
        const publicProfiles = {
            ...store.publicProfiles
        };
        [blackPlayerId, whitePlayerId].forEach((playerId) => {
            const profile = normalizePublicProfile(activeProfiles[playerId], playerId, ratedAt)
                || publicProfiles[playerId]
                || createPublicProfile(playerId, {}, ratedAt);
            publicProfiles[playerId] = { ...profile, updatedAt: ratedAt };
        });
        const update = computeGlicko2PairUpdate({ black: blackBefore, white: whiteBefore, result, ratedAt });
        const record: RatingMatchRecord = {
            matchId,
            pool,
            systemVersion: RATING_SYSTEM_VERSION,
            blackPlayerId,
            whitePlayerId,
            result,
            blackBeforeRating: blackBefore.rating,
            blackBeforeDeviation: blackBefore.deviation,
            blackBeforeVolatility: blackBefore.volatility,
            blackAfterRating: update.black.rating,
            blackAfterDeviation: update.black.deviation,
            blackAfterVolatility: update.black.volatility,
            whiteBeforeRating: whiteBefore.rating,
            whiteBeforeDeviation: whiteBefore.deviation,
            whiteBeforeVolatility: whiteBefore.volatility,
            whiteAfterRating: update.white.rating,
            whiteAfterDeviation: update.white.deviation,
            whiteAfterVolatility: update.white.volatility,
            rulesetVersion: String((input && input.rulesetVersion) || 'card-ranked-v1'),
            catalogVersion: String((input && input.catalogVersion) || 'unknown'),
            ratedAt
        };
        const nextStore: MatchWorkerRatingStore = {
            ...store,
            players: { ...store.players, [blackPlayerId]: update.black, [whitePlayerId]: update.white },
            publicProfiles,
            matches: { ...store.matches, [matchId]: record },
            updatedAt: ratedAt
        };
        const released = releaseActiveRatedMatch(nextStore, matchId);

        return {
            ok: true,
            store: released.store,
            payload: {
                ok: true,
                matchId,
                result,
                black: { playerId: blackPlayerId, before: blackBefore, after: update.black, display: update.blackDisplay },
                white: { playerId: whitePlayerId, before: whiteBefore, after: update.white, display: update.whiteDisplay },
                record
            }
        };
    }

    function createPayloadFromRecord(record: RatingMatchRecord, storeValue: unknown): Record<string, unknown> {
        const store = loadStore(storeValue);
        const blackAfter = store.players[record.blackPlayerId] || createInitialPlayerRating(record.blackPlayerId, record.ratedAt);
        const whiteAfter = store.players[record.whitePlayerId] || createInitialPlayerRating(record.whitePlayerId, record.ratedAt);
        const blackBefore = {
            ...blackAfter,
            rating: record.blackBeforeRating,
            deviation: record.blackBeforeDeviation,
            volatility: record.blackBeforeVolatility
        };
        const whiteBefore = {
            ...whiteAfter,
            rating: record.whiteBeforeRating,
            deviation: record.whiteBeforeDeviation,
            volatility: record.whiteBeforeVolatility
        };
        return {
            ok: true,
            matchId: record.matchId,
            result: record.result,
            black: {
                playerId: record.blackPlayerId,
                before: blackBefore,
                after: blackAfter,
                display: {
                    before: Math.round(record.blackBeforeRating),
                    after: Math.round(record.blackAfterRating),
                    delta: Math.round(record.blackAfterRating) - Math.round(record.blackBeforeRating)
                }
            },
            white: {
                playerId: record.whitePlayerId,
                before: whiteBefore,
                after: whiteAfter,
                display: {
                    before: Math.round(record.whiteBeforeRating),
                    after: Math.round(record.whiteAfterRating),
                    delta: Math.round(record.whiteAfterRating) - Math.round(record.whiteBeforeRating)
                }
            },
            record
        };
    }

    function listLeaderboard(storeValue: unknown, options: { limit?: unknown } = {}) {
        const store = loadStore(storeValue);
        const limit = Math.max(1, Math.min(100, Math.trunc(Number(options.limit) || 50)));
        const entries = Object.values(store.players)
            .filter((entry) => entry.ratedGames > 0)
            .sort((a, b) => {
                if (b.rating !== a.rating) return b.rating - a.rating;
                if (a.deviation !== b.deviation) return a.deviation - b.deviation;
                if (b.ratedGames !== a.ratedGames) return b.ratedGames - a.ratedGames;
                return a.playerId.localeCompare(b.playerId);
            })
            .slice(0, limit)
            .map((entry, index) => ({
                ...(store.publicProfiles[entry.playerId] || createPublicProfile(entry.playerId, {}, entry.updatedAt)),
                rank: index + 1,
                playerId: entry.playerId,
                displayRating: Math.round(entry.rating),
                rating: entry.rating,
                ratedGames: entry.ratedGames,
                wins: entry.wins,
                draws: entry.draws,
                losses: entry.losses,
                updatedAt: entry.updatedAt
            }));
        return { ok: true, pool: RATED_POOL_CARD_RANKED_V1, entries, updatedAt: store.updatedAt };
    }

    function createPlayerHistoryEntry(record: RatingMatchRecord, playerId: string): RatingPlayerHistoryEntry | null {
        const isBlack = record.blackPlayerId === playerId;
        const isWhite = record.whitePlayerId === playerId;
        if (!isBlack && !isWhite) return null;
        const side = isBlack ? 'black' : 'white';
        const opponentPlayerId = isBlack ? record.whitePlayerId : record.blackPlayerId;
        let result: RatingPlayerHistoryEntry['result'] = 'DRAW';
        if (record.result === 'BLACK_WIN') {
            result = isBlack ? 'WIN' : 'LOSS';
        } else if (record.result === 'WHITE_WIN') {
            result = isWhite ? 'WIN' : 'LOSS';
        }
        const beforeRating = isBlack ? record.blackBeforeRating : record.whiteBeforeRating;
        const afterRating = isBlack ? record.blackAfterRating : record.whiteAfterRating;
        const displayBeforeRating = Math.round(beforeRating);
        const displayAfterRating = Math.round(afterRating);
        return {
            matchId: record.matchId,
            pool: record.pool,
            systemVersion: record.systemVersion,
            playerId,
            opponentPlayerId,
            side,
            result,
            rawResult: record.result,
            beforeRating,
            afterRating,
            displayBeforeRating,
            displayAfterRating,
            displayDelta: displayAfterRating - displayBeforeRating,
            rulesetVersion: record.rulesetVersion,
            catalogVersion: record.catalogVersion,
            ratedAt: record.ratedAt
        };
    }

    function listPlayerHistory(storeValue: unknown, options: ListPlayerHistoryInput = {}) {
        const store = loadStore(storeValue);
        const playerId = normalizePlayerId(options && options.playerId);
        if (!playerId) {
            return { ok: false, reason: 'PLAYER_ID_REQUIRED', pool: RATED_POOL_CARD_RANKED_V1, entries: [], updatedAt: store.updatedAt };
        }
        const limit = normalizeHistoryLimit(options && options.limit);
        const entries = Object.values(store.matches)
            .filter((record) => record.blackPlayerId === playerId || record.whitePlayerId === playerId)
            .sort((a, b) => {
                const ratedAtDiff = parseRatedAtMs(b) - parseRatedAtMs(a);
                if (ratedAtDiff !== 0) return ratedAtDiff;
                return b.matchId.localeCompare(a.matchId);
            })
            .slice(0, limit)
            .map((record) => createPlayerHistoryEntry(record, playerId))
            .filter((entry): entry is RatingPlayerHistoryEntry => !!entry);
        return { ok: true, pool: RATED_POOL_CARD_RANKED_V1, playerId, entries, updatedAt: store.updatedAt };
    }

    function claimActiveRatedMatch(storeValue: unknown, input: ClaimActiveRatedMatchInput): any {
        const store = loadStore(storeValue);
        const matchId = normalizeMatchId(input && input.matchId);
        const roomId = String((input && input.roomId) || '').trim();
        const blackPlayerId = normalizePlayerId(input && input.blackPlayerId);
        const whitePlayerId = normalizePlayerId(input && input.whitePlayerId);
        if (!matchId || !roomId || !blackPlayerId || !whitePlayerId || blackPlayerId === whitePlayerId) {
            return { ok: false, reason: 'ACTIVE_RATED_MATCH_INVALID', store };
        }
        const occupied = [blackPlayerId, whitePlayerId].find((playerId) => {
            const active = store.activeMatches[playerId];
            return active && active.matchId !== matchId;
        });
        if (occupied) return { ok: false, reason: 'PLAYER_ALREADY_IN_RATED_MATCH', playerId: occupied, store };
        const active: MatchWorkerActiveRatedMatch = {
            matchId,
            pool: RATED_POOL_CARD_RANKED_V1,
            roomId,
            playerIds: [blackPlayerId, whitePlayerId],
            publicProfiles: {
                [blackPlayerId]: createPublicProfile(blackPlayerId, {
                    playerName: input.blackPlayerName,
                    avatarStoneType: input.blackAvatarStoneType,
                    bio: input.blackBio
                }, String((input && input.startedAt) || now())),
                [whitePlayerId]: createPublicProfile(whitePlayerId, {
                    playerName: input.whitePlayerName,
                    avatarStoneType: input.whiteAvatarStoneType,
                    bio: input.whiteBio
                }, String((input && input.startedAt) || now()))
            },
            startedAt: String((input && input.startedAt) || now())
        };
        return {
            ok: true,
            store: {
                ...store,
                activeMatches: {
                    ...store.activeMatches,
                    [blackPlayerId]: active,
                    [whitePlayerId]: active
                },
                updatedAt: now()
            }
        };
    }

    function releaseActiveRatedMatch(storeValue: unknown, matchIdValue: unknown): any {
        const store = loadStore(storeValue);
        const matchId = normalizeMatchId(matchIdValue);
        if (!matchId) return { ok: true, store };
        const activeMatches = { ...store.activeMatches };
        Object.keys(activeMatches).forEach((playerId) => {
            if (activeMatches[playerId] && activeMatches[playerId].matchId === matchId) {
                delete activeMatches[playerId];
            }
        });
        return { ok: true, store: { ...store, activeMatches, updatedAt: now() } };
    }

    function updatePublicProfile(storeValue: unknown, input: UpdatePublicProfileInput): any {
        const store = loadStore(storeValue);
        const playerId = normalizePlayerId(input && input.playerId);
        if (!playerId) return { ok: false, reason: 'PLAYER_ID_REQUIRED', store };

        const updatedAt = now();
        const profile = createPublicProfile(playerId, {
            playerName: input.playerName,
            avatarStoneType: input.avatarStoneType,
            bio: input.bio,
            updatedAt
        }, updatedAt);
        const activeMatches = { ...store.activeMatches };
        Object.keys(activeMatches).forEach((activePlayerId) => {
            const active = activeMatches[activePlayerId];
            if (!active || !active.playerIds.includes(playerId)) return;
            activeMatches[activePlayerId] = {
                ...active,
                publicProfiles: {
                    ...active.publicProfiles,
                    [playerId]: profile
                }
            };
        });

        return {
            ok: true,
            store: {
                ...store,
                publicProfiles: {
                    ...store.publicProfiles,
                    [playerId]: profile
                },
                activeMatches,
                updatedAt
            },
            payload: { ok: true, playerId, profile, updatedAt }
        };
    }

    return {
        createEmptyStore,
        loadStore,
        getPlayerRating,
        applyRatedResult,
        listLeaderboard,
        listPlayerHistory,
        claimActiveRatedMatch,
        releaseActiveRatedMatch,
        updatePublicProfile
    };
}
