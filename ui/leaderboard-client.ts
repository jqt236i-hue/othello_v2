'use strict';

declare const __non_webpack_require__: NodeRequire | undefined;

const _require: NodeRequire = (typeof __non_webpack_require__ !== 'undefined')
  ? __non_webpack_require__
  : require;

const PlayerIdentity = _require('./player-identity');
const PlayerProfile = _require('./player-profile');
const IdentityContract = _require('../shared/player-identity-contract');
const PlayerProfileContract = _require('../shared/player-profile-contract');

const PLAYER_NAME_STORAGE_KEY = 'shared_leaderboard_player_name_v1';
const PLAYER_NAME_MAX = 7;
const DEFAULT_PLAYER_NAME = 'ななし';
const LEADERBOARD_FETCH_LIMIT_MAX = 100;
const LEADERBOARD_FETCH_MODES = new Set(['all', 'network', 'cpu']);

function canUseStorage(): boolean {
  try {
    return typeof localStorage !== 'undefined' && !!localStorage;
  } catch (e) {
    return false;
  }
}

function normalizePlayerName(value: any): string {
  const normalized = String(value || '').replace(/\s+/g, ' ').trim();
  const clipped = Array.from(normalized).slice(0, PLAYER_NAME_MAX).join('');
  return clipped || DEFAULT_PLAYER_NAME;
}

function withTrailingSlashRemoved(url: string): string {
  return String(url || '').replace(/\/+$/, '');
}

function resolveServerBaseUrl(options?: any): string {
  const opts = options || {};
  if (opts.serverUrl) {
    return withTrailingSlashRemoved(String(opts.serverUrl || '').trim());
  }

  try {
    if ((window as any).NetworkMatchClient && typeof (window as any).NetworkMatchClient.getServerUrl === 'function') {
      const fromClient = (window as any).NetworkMatchClient.getServerUrl();
      if (fromClient) return withTrailingSlashRemoved(fromClient);
    }
  } catch (e) { /* ignore */ }

  try {
    if (typeof location !== 'undefined' && /^https?:$/i.test(location.protocol) && location.origin) {
      return withTrailingSlashRemoved(location.origin);
    }
  } catch (e) { /* ignore */ }

  return '';
}

function getPlayerName(): string {
  try {
    if (PlayerProfile && typeof PlayerProfile.readPlayerProfile === 'function') {
      const profile = PlayerProfile.readPlayerProfile();
      const displayName = normalizePlayerName(profile && profile.displayName);
      if (displayName && displayName !== DEFAULT_PLAYER_NAME) {
        if (canUseStorage()) {
          try {
            localStorage.setItem(PLAYER_NAME_STORAGE_KEY, displayName);
          } catch (e) { /* ignore */ }
        }
        return displayName;
      }
    }
  } catch (e) { /* ignore */ }

  if (!canUseStorage()) return DEFAULT_PLAYER_NAME;
  try {
    const raw = localStorage.getItem(PLAYER_NAME_STORAGE_KEY);
    return normalizePlayerName(raw || DEFAULT_PLAYER_NAME);
  } catch (e) {
    return DEFAULT_PLAYER_NAME;
  }
}

function setPlayerName(value: string): string {
  const name = normalizePlayerName(value);
  if (!canUseStorage()) return name;
  try {
    localStorage.setItem(PLAYER_NAME_STORAGE_KEY, name);
  } catch (e) { /* ignore */ }
  try {
    if (PlayerProfile && typeof PlayerProfile.savePlayerProfile === 'function') {
      PlayerProfile.savePlayerProfile({ displayName: name });
    }
  } catch (e) { /* ignore */ }
  return name;
}

function getPlayerId(): string | null {
  try {
    return typeof PlayerIdentity.getPlayerId === 'function' ? PlayerIdentity.getPlayerId() : null;
  } catch (e) {
    return null;
  }
}

function getPublicPlayerProfile(): { avatarStoneType: string; bio: string } {
  try {
    if (PlayerProfile && typeof PlayerProfile.readPublicPlayerProfile === 'function') {
      return PlayerProfile.readPublicPlayerProfile();
    }
  } catch (e) { /* ignore */ }
  return PlayerProfileContract.normalizePublicPlayerProfile(null);
}

async function requestJson(method: string, path: string, payload?: any, options?: any): Promise<any> {
  if (typeof fetch !== 'function') {
    return { ok: false, reason: 'FETCH_UNAVAILABLE', status: 0, data: null };
  }

  const baseUrl = resolveServerBaseUrl(options);
  const targetUrl = `${baseUrl}${path}`;

  const init: any = { method, headers: {} };
  if (method === 'POST') {
    init.headers['Content-Type'] = 'application/json';
    init.body = JSON.stringify(payload || {});
  }

  try {
    const response = await fetch(targetUrl, init);
    const data = await response.json().catch(() => null);
    const ok = response.ok && data && data.ok === true;
    return {
      ok,
      status: response.status,
      data,
      reason: ok ? null : ((data && data.reason) || `HTTP_${response.status}`)
    };
  } catch (e) {
    return { ok: false, status: 0, data: null, reason: 'NETWORK_ERROR' };
  }
}

function normalizeEntry(entry: any): any {
  if (!entry || typeof entry !== 'object') return null;
  const category = entry.category === 'timeAttack'
    ? 'timeAttack'
    : entry.category === 'timeDefense'
    ? 'timeDefense'
    : entry.category === 'shortestTurns'
    ? 'shortestTurns'
    : 'score';
  const score = Number.isFinite(Number(entry.bestScore)) ? Math.max(0, Math.trunc(Number(entry.bestScore))) : 0;
  const bestTimeMs = category === 'timeAttack' && Number.isFinite(Number(entry.bestTimeMs))
    ? Math.max(1, Math.trunc(Number(entry.bestTimeMs)))
    : null;
  const turnCount = (category === 'timeDefense' || category === 'shortestTurns') && Number.isFinite(Number(entry.turnCount))
    ? Math.max(1, Math.trunc(Number(entry.turnCount)))
    : (Number.isFinite(Number(entry.turnCount)) ? Math.max(0, Math.trunc(Number(entry.turnCount))) : null);
  const rank = Number.isFinite(Number(entry.rank)) ? Math.max(1, Math.trunc(Number(entry.rank))) : null;
  const updatedAt = Number.isFinite(Number(entry.updatedAt)) ? Number(entry.updatedAt) : 0;
  const mode = entry.mode === 'network' ? 'network' : 'cpu';
  const cpuLevel = Number.isFinite(Number(entry.cpuLevel)) ? Math.max(1, Math.min(9, Math.trunc(Number(entry.cpuLevel)))) : null;

  return {
    rank,
    playerId: IdentityContract.normalizeLeaderboardDisplayPlayerId(entry.playerId) || null,
    playerName: normalizePlayerName(entry.playerName),
    category,
    bestScore: score,
    bestTimeMs,
    turnCount,
    mode,
    cpuLevel,
    avatarStoneType: PlayerProfileContract.normalizeProfileAvatarStoneType(entry.avatarStoneType),
    bio: PlayerProfileContract.normalizeProfileBio(entry.bio),
    updatedAt
  };
}

function normalizeRatedEntry(entry: any): any {
  if (!entry || typeof entry !== 'object') return null;
  const rating = Number(entry.displayRating);
  const ratedGames = Number(entry.ratedGames);
  const wins = Number(entry.wins);
  const draws = Number(entry.draws);
  const losses = Number(entry.losses);
  return {
    rank: Number.isFinite(Number(entry.rank)) ? Math.max(1, Math.trunc(Number(entry.rank))) : null,
    playerId: IdentityContract.normalizeLeaderboardDisplayPlayerId(entry.playerId) || null,
    playerName: normalizePlayerName(entry.playerName),
    category: 'rated',
    displayRating: Number.isFinite(rating) ? Math.round(rating) : 1500,
    ratedGames: Number.isFinite(ratedGames) ? Math.max(0, Math.trunc(ratedGames)) : 0,
    wins: Number.isFinite(wins) ? Math.max(0, Math.trunc(wins)) : 0,
    draws: Number.isFinite(draws) ? Math.max(0, Math.trunc(draws)) : 0,
    losses: Number.isFinite(losses) ? Math.max(0, Math.trunc(losses)) : 0,
    avatarStoneType: PlayerProfileContract.normalizeProfileAvatarStoneType(entry.avatarStoneType),
    bio: PlayerProfileContract.normalizeProfileBio(entry.bio),
    updatedAt: Number.isFinite(Number(entry.updatedAt)) ? Number(entry.updatedAt) : 0
  };
}

function appendPublicPlayerProfile(payload: Record<string, any>): void {
  const publicProfile = getPublicPlayerProfile();
  payload.avatarStoneType = publicProfile.avatarStoneType;
  payload.bio = publicProfile.bio;
}

async function appendVerifiedIdentity(payload: Record<string, any>, options?: any): Promise<boolean> {
  try {
    const identity = PlayerIdentity && typeof PlayerIdentity.ensurePlayerIdentity === 'function'
      ? await PlayerIdentity.ensurePlayerIdentity(options)
      : null;
    const playerId = IdentityContract.normalizePlayerId(identity && identity.playerId);
    const playerToken = IdentityContract.normalizePlayerToken(identity && identity.playerToken);
    if (!playerId || !playerToken) return false;
    payload.playerId = playerId;
    payload.playerToken = playerToken;
    return true;
  } catch (e) {
    return false;
  }
}

async function updatePublicProfile(options?: any): Promise<any> {
  const payload: Record<string, any> = {
    playerName: getPlayerName()
  };
  appendPublicPlayerProfile(payload);
  if (!await appendVerifiedIdentity(payload, options || {})) {
    return { ok: false, reason: 'PLAYER_IDENTITY_UNAVAILABLE' };
  }

  const res = await requestJson('POST', '/api/player/profile', payload, options || {});
  if (!res.ok) {
    return { ok: false, reason: res.reason || 'PROFILE_UPDATE_FAILED' };
  }
  return {
    ok: true,
    playerId: res.data && res.data.playerId ? String(res.data.playerId) : payload.playerId
  };
}

function normalizeBoardConfig(value: any): any {
  if (!value || typeof value !== 'object') return null;
  const rows = Number(value.rows);
  const cols = Number(value.cols);
  if (!Number.isFinite(rows) || !Number.isFinite(cols)) return null;
  const normalizedRows = Math.trunc(rows);
  const normalizedCols = Math.trunc(cols);
  if (normalizedRows <= 0 || normalizedCols <= 0) return null;
  const shape = String(value.shape || '').toLowerCase() === 'circle' ? 'circle' : 'rectangle';
  return {
    rows: shape === 'circle' ? 10 : normalizedRows,
    cols: shape === 'circle' ? 10 : normalizedCols,
    shape,
    standard8x8: shape === 'rectangle' && (value.standard8x8 === true || (normalizedRows === 8 && normalizedCols === 8))
  };
}

async function fetchLeaderboard(options?: any): Promise<any> {
  const opts = options || {};
  const limit = Number.isFinite(Number(opts.limit))
    ? Math.max(1, Math.min(LEADERBOARD_FETCH_LIMIT_MAX, Math.trunc(Number(opts.limit))))
    : 10;
  const mode = LEADERBOARD_FETCH_MODES.has(String(opts.mode || ''))
    ? String(opts.mode)
    : 'cpu';
  const category = opts.category === 'timeAttack'
    ? 'timeAttack'
    : opts.category === 'timeDefense'
    ? 'timeDefense'
    : opts.category === 'shortestTurns'
    ? 'shortestTurns'
    : 'score';
  const cpuLevel = mode === 'cpu' && Number.isFinite(Number(opts.cpuLevel))
    ? Math.max(1, Math.min(9, Math.trunc(Number(opts.cpuLevel))))
    : null;
  const levelQuery = cpuLevel === null ? '' : `&cpuLevel=${encodeURIComponent(String(cpuLevel))}`;
  const res = await requestJson('GET', `/api/leaderboard/list?limit=${limit}&mode=${encodeURIComponent(mode)}&category=${encodeURIComponent(category)}${levelQuery}`, null, opts);
  if (!res.ok) {
    return { ok: false, reason: res.reason || 'LIST_FAILED', entries: [], updatedAt: 0 };
  }

  const entries = Array.isArray(res.data && res.data.entries)
    ? res.data.entries.map((entry: any) => normalizeEntry(entry)).filter(Boolean)
    : [];

  return {
    ok: true,
    entries,
    mode,
    category,
    cpuLevel,
    updatedAt: Number.isFinite(Number(res.data && res.data.updatedAt)) ? Number(res.data.updatedAt) : 0
  };
}

async function getRatedLeaderboard(limitValue = 50, options?: any): Promise<any> {
  const limit = Number.isFinite(Number(limitValue))
    ? Math.max(1, Math.min(LEADERBOARD_FETCH_LIMIT_MAX, Math.trunc(Number(limitValue))))
    : 50;
  const res = await requestJson('GET', `/api/rating/leaderboard?pool=card_ranked_v1&limit=${limit}`, null, options || {});
  if (!res.ok) {
    return { ok: false, reason: res.reason || 'RATED_LIST_FAILED', entries: [], updatedAt: 0, category: 'rated' };
  }

  const entries = Array.isArray(res.data && res.data.entries)
    ? res.data.entries.map((entry: any) => normalizeRatedEntry(entry)).filter(Boolean)
    : [];

  return {
    ok: true,
    entries,
    category: 'rated',
    pool: 'card_ranked_v1',
    updatedAt: Number.isFinite(Number(res.data && res.data.updatedAt)) ? Number(res.data.updatedAt) : 0
  };
}

async function submitScore(scoreSummary: any, options?: any): Promise<any> {
  const summary = scoreSummary || {};
  const opts = options || {};

  const score = Number.isFinite(Number(summary.total)) ? Math.max(0, Math.trunc(Number(summary.total))) : null;
  if (score === null) {
    return { ok: false, reason: 'INVALID_SCORE' };
  }

  const payload = {
    playerName: getPlayerName(),
    score,
    scoreVersion: Number.isFinite(Number(summary.version)) ? Math.trunc(Number(summary.version)) : null,
    turnCount: Number.isFinite(Number(summary.turnCount)) ? Math.max(0, Math.trunc(Number(summary.turnCount))) : null,
    category: 'score',
    mode: opts.mode === 'network' ? 'network' : 'cpu',
    cpuLevel: Number.isFinite(Number(opts.cpuLevel)) ? Math.max(1, Math.min(9, Math.trunc(Number(opts.cpuLevel)))) : null,
    boardConfig: normalizeBoardConfig(opts.boardConfig),
    limit: Number.isFinite(Number(opts.limit))
      ? Math.max(1, Math.min(LEADERBOARD_FETCH_LIMIT_MAX, Math.trunc(Number(opts.limit))))
      : 10
  };
  appendPublicPlayerProfile(payload);
  if (!await appendVerifiedIdentity(payload, opts)) {
    return { ok: false, reason: 'PLAYER_IDENTITY_UNAVAILABLE' };
  }

  const res = await requestJson('POST', '/api/leaderboard/submit', payload, opts);
  if (!res.ok) {
    return { ok: false, reason: res.reason || 'SUBMIT_FAILED' };
  }

  const entries = Array.isArray(res.data && res.data.entries)
    ? res.data.entries.map((entry: any) => normalizeEntry(entry)).filter(Boolean)
    : [];

  return {
    ok: true,
    updated: !!(res.data && res.data.updated),
    bestScore: Number.isFinite(Number(res.data && res.data.bestScore)) ? Number(res.data.bestScore) : score,
    rank: Number.isFinite(Number(res.data && res.data.rank)) ? Number(res.data.rank) : null,
    entries
  };
}

async function submitTimeAttack(summary: any, options?: any): Promise<any> {
  const input = summary || {};
  const opts = options || {};
  const elapsedMs = Number.isFinite(Number(input.elapsedMs))
    ? Math.max(1, Math.trunc(Number(input.elapsedMs)))
    : null;
  if (elapsedMs === null) {
    return { ok: false, reason: 'INVALID_TIME_ATTACK' };
  }

  const payload = {
    playerName: getPlayerName(),
    category: 'timeAttack',
    elapsedMs,
    debug: opts.debug === true,
    mode: opts.mode === 'network' ? 'network' : 'cpu',
    cpuLevel: Number.isFinite(Number(opts.cpuLevel)) ? Math.max(1, Math.min(9, Math.trunc(Number(opts.cpuLevel)))) : null,
    boardConfig: normalizeBoardConfig(opts.boardConfig),
    limit: Number.isFinite(Number(opts.limit))
      ? Math.max(1, Math.min(LEADERBOARD_FETCH_LIMIT_MAX, Math.trunc(Number(opts.limit))))
      : 10
  };
  appendPublicPlayerProfile(payload);
  if (!await appendVerifiedIdentity(payload, opts)) {
    return { ok: false, reason: 'PLAYER_IDENTITY_UNAVAILABLE' };
  }

  const res = await requestJson('POST', '/api/leaderboard/submit', payload, opts);
  if (!res.ok) {
    return { ok: false, reason: res.reason || 'SUBMIT_FAILED' };
  }

  const entries = Array.isArray(res.data && res.data.entries)
    ? res.data.entries.map((entry: any) => normalizeEntry(entry)).filter(Boolean)
    : [];

  return {
    ok: true,
    updated: !!(res.data && res.data.updated),
    bestTimeMs: Number.isFinite(Number(res.data && res.data.bestTimeMs)) ? Number(res.data.bestTimeMs) : elapsedMs,
    rank: Number.isFinite(Number(res.data && res.data.rank)) ? Number(res.data.rank) : null,
    entries
  };
}

async function submitTimeDefense(summary: any, options?: any): Promise<any> {
  const input = summary || {};
  const opts = options || {};
  const turnCount = Number.isFinite(Number(input.turnCount))
    ? Math.max(1, Math.trunc(Number(input.turnCount)))
    : null;
  if (turnCount === null) {
    return { ok: false, reason: 'INVALID_TIME_DEFENSE' };
  }

  const payload = {
    playerName: getPlayerName(),
    category: 'timeDefense',
    turnCount,
    debug: opts.debug === true,
    mode: opts.mode === 'network' ? 'network' : 'cpu',
    cpuLevel: Number.isFinite(Number(opts.cpuLevel)) ? Math.max(1, Math.min(9, Math.trunc(Number(opts.cpuLevel)))) : null,
    boardConfig: normalizeBoardConfig(opts.boardConfig),
    limit: Number.isFinite(Number(opts.limit))
      ? Math.max(1, Math.min(LEADERBOARD_FETCH_LIMIT_MAX, Math.trunc(Number(opts.limit))))
      : 10
  };
  appendPublicPlayerProfile(payload);
  if (!await appendVerifiedIdentity(payload, opts)) {
    return { ok: false, reason: 'PLAYER_IDENTITY_UNAVAILABLE' };
  }

  const res = await requestJson('POST', '/api/leaderboard/submit', payload, opts);
  if (!res.ok) {
    return { ok: false, reason: res.reason || 'SUBMIT_FAILED' };
  }

  const entries = Array.isArray(res.data && res.data.entries)
    ? res.data.entries.map((entry: any) => normalizeEntry(entry)).filter(Boolean)
    : [];

  return {
    ok: true,
    updated: !!(res.data && res.data.updated),
    bestTurnCount: Number.isFinite(Number(res.data && res.data.bestTurnCount)) ? Number(res.data.bestTurnCount) : turnCount,
    rank: Number.isFinite(Number(res.data && res.data.rank)) ? Number(res.data.rank) : null,
    entries
  };
}

async function submitShortestTurns(summary: any, options?: any): Promise<any> {
  const input = summary || {};
  const opts = options || {};
  const turnCount = Number.isFinite(Number(input.turnCount))
    ? Math.max(1, Math.trunc(Number(input.turnCount)))
    : null;
  if (turnCount === null) {
    return { ok: false, reason: 'INVALID_SHORTEST_TURNS' };
  }

  const payload = {
    playerName: getPlayerName(),
    category: 'shortestTurns',
    turnCount,
    debug: opts.debug === true,
    mode: opts.mode === 'network' ? 'network' : 'cpu',
    cpuLevel: Number.isFinite(Number(opts.cpuLevel)) ? Math.max(1, Math.min(9, Math.trunc(Number(opts.cpuLevel)))) : null,
    boardConfig: normalizeBoardConfig(opts.boardConfig),
    limit: Number.isFinite(Number(opts.limit))
      ? Math.max(1, Math.min(LEADERBOARD_FETCH_LIMIT_MAX, Math.trunc(Number(opts.limit))))
      : 10
  };
  appendPublicPlayerProfile(payload);
  if (!await appendVerifiedIdentity(payload, opts)) {
    return { ok: false, reason: 'PLAYER_IDENTITY_UNAVAILABLE' };
  }

  const res = await requestJson('POST', '/api/leaderboard/submit', payload, opts);
  if (!res.ok) {
    return { ok: false, reason: res.reason || 'SUBMIT_FAILED' };
  }

  const entries = Array.isArray(res.data && res.data.entries)
    ? res.data.entries.map((entry: any) => normalizeEntry(entry)).filter(Boolean)
    : [];

  return {
    ok: true,
    updated: !!(res.data && res.data.updated),
    bestTurnCount: Number.isFinite(Number(res.data && res.data.bestTurnCount)) ? Number(res.data.bestTurnCount) : turnCount,
    rank: Number.isFinite(Number(res.data && res.data.rank)) ? Number(res.data.rank) : null,
    entries
  };
}

const LeaderboardClient = {
  getPlayerName,
  setPlayerName,
  getPlayerId,
  getPublicPlayerProfile,
  updatePublicProfile,
  fetchLeaderboard,
  getRatedLeaderboard,
  submitScore,
  submitTimeAttack,
  submitTimeDefense,
  submitShortestTurns,
  resolveServerBaseUrl
};

try {
  if (typeof globalThis !== 'undefined') {
    (globalThis as any).LeaderboardClient = LeaderboardClient;
  }
} catch (e) { /* ignore */ }

export = LeaderboardClient;
