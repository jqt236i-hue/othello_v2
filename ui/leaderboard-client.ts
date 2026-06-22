'use strict';

declare const __non_webpack_require__: NodeRequire | undefined;

const _require: NodeRequire = (typeof __non_webpack_require__ !== 'undefined')
  ? __non_webpack_require__
  : require;

const PLAYER_NAME_STORAGE_KEY = 'shared_leaderboard_player_name_v1';
const PLAYER_ID_STORAGE_KEY = 'shared_leaderboard_player_id_v1';
const PLAYER_NAME_MAX = 7;
const DEFAULT_PLAYER_NAME = 'ななし';
const PLAYER_ID_RE = /^[A-Za-z0-9_-]{8,80}$/;
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

function normalizePlayerId(value: any): string | null {
  const normalized = String(value || '').trim();
  if (!PLAYER_ID_RE.test(normalized)) return null;
  return normalized;
}

function makePlayerId(): string {
  try {
    if (typeof crypto !== 'undefined' && crypto && typeof crypto.getRandomValues === 'function') {
      const bytes = new Uint8Array(16);
      crypto.getRandomValues(bytes);
      return Array.from(bytes).map((one) => one.toString(16).padStart(2, '0')).join('');
    }
  } catch (e) { /* ignore */ }

  const fallback = `${Date.now()}_${Math.floor(Math.random() * 1000000)}`;
  return String(fallback).replace(/[^0-9a-zA-Z_-]/g, '');
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
  return name;
}

function getPlayerId(): string {
  if (canUseStorage()) {
    try {
      const stored = normalizePlayerId(localStorage.getItem(PLAYER_ID_STORAGE_KEY));
      if (stored) return stored;
    } catch (e) { /* ignore */ }
  }

  const created = normalizePlayerId(makePlayerId()) || normalizePlayerId(`p_${Date.now()}_${Math.floor(Math.random() * 100000)}`) || 'player_fallback';
  if (canUseStorage()) {
    try {
      localStorage.setItem(PLAYER_ID_STORAGE_KEY, created);
    } catch (e) { /* ignore */ }
  }
  return created;
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
    : 'score';
  const score = Number.isFinite(Number(entry.bestScore)) ? Math.max(0, Math.trunc(Number(entry.bestScore))) : 0;
  const bestTimeMs = category === 'timeAttack' && Number.isFinite(Number(entry.bestTimeMs))
    ? Math.max(1, Math.trunc(Number(entry.bestTimeMs)))
    : null;
  const turnCount = category === 'timeDefense' && Number.isFinite(Number(entry.turnCount))
    ? Math.max(1, Math.trunc(Number(entry.turnCount)))
    : (Number.isFinite(Number(entry.turnCount)) ? Math.max(0, Math.trunc(Number(entry.turnCount))) : null);
  const rank = Number.isFinite(Number(entry.rank)) ? Math.max(1, Math.trunc(Number(entry.rank))) : null;
  const updatedAt = Number.isFinite(Number(entry.updatedAt)) ? Number(entry.updatedAt) : 0;
  const mode = entry.mode === 'network' ? 'network' : 'cpu';
  const cpuLevel = Number.isFinite(Number(entry.cpuLevel)) ? Math.max(1, Math.min(9, Math.trunc(Number(entry.cpuLevel)))) : null;

  return {
    rank,
    playerId: normalizePlayerId(entry.playerId) || null,
    playerName: normalizePlayerName(entry.playerName),
    category,
    bestScore: score,
    bestTimeMs,
    turnCount,
    mode,
    cpuLevel,
    updatedAt
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
  return {
    rows: normalizedRows,
    cols: normalizedCols,
    standard8x8: value.standard8x8 === true || (normalizedRows === 8 && normalizedCols === 8)
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

async function submitScore(scoreSummary: any, options?: any): Promise<any> {
  const summary = scoreSummary || {};
  const opts = options || {};

  const score = Number.isFinite(Number(summary.total)) ? Math.max(0, Math.trunc(Number(summary.total))) : null;
  if (score === null) {
    return { ok: false, reason: 'INVALID_SCORE' };
  }

  const payload = {
    playerId: getPlayerId(),
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
    playerId: getPlayerId(),
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
    playerId: getPlayerId(),
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
  fetchLeaderboard,
  submitScore,
  submitTimeAttack,
  submitTimeDefense,
  resolveServerBaseUrl
};

try {
  if (typeof globalThis !== 'undefined') {
    (globalThis as any).LeaderboardClient = LeaderboardClient;
  }
} catch (e) { /* ignore */ }

export = LeaderboardClient;
