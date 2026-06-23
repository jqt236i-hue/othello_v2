'use strict';

declare const __non_webpack_require__: NodeRequire | undefined;

const _require: NodeRequire = (typeof __non_webpack_require__ !== 'undefined')
  ? __non_webpack_require__
  : require;

const Contract = _require('../shared/player-identity-contract');

const PLAYER_IDENTITY_STORAGE_KEY = 'card_reversi_player_identity_v1';

type StoredPlayerIdentity = {
  playerId: string;
  playerToken: string;
  recoveryCode: string;
};

type VerifyPlayerIdentityResult = 'valid' | 'invalid' | 'unavailable';

function canUseStorage(): boolean {
  try {
    return typeof localStorage !== 'undefined' && !!localStorage;
  } catch (e) {
    return false;
  }
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
    const root: any = typeof window !== 'undefined' ? window : globalThis;
    if (root && root.NetworkMatchClient && typeof root.NetworkMatchClient.getServerUrl === 'function') {
      const fromClient = root.NetworkMatchClient.getServerUrl();
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

function normalizeIdentity(value: any): StoredPlayerIdentity | null {
  const source = value && typeof value === 'object' ? value : {};
  const playerId = Contract.normalizePlayerId(source.playerId);
  const playerToken = Contract.normalizePlayerToken(source.playerToken);
  const recoveryCode = Contract.normalizeRecoveryCode(source.recoveryCode);
  if (!playerId || !playerToken || !recoveryCode) return null;
  return { playerId, playerToken, recoveryCode };
}

function readStoredIdentity(): StoredPlayerIdentity | null {
  if (!canUseStorage()) return null;
  try {
    const raw = localStorage.getItem(PLAYER_IDENTITY_STORAGE_KEY);
    if (!raw) return null;
    return normalizeIdentity(JSON.parse(raw));
  } catch (e) {
    return null;
  }
}

function writeStoredIdentity(identity: any): StoredPlayerIdentity | null {
  const normalized = normalizeIdentity(identity);
  if (!normalized) return null;
  if (canUseStorage()) {
    try {
      localStorage.setItem(PLAYER_IDENTITY_STORAGE_KEY, JSON.stringify(normalized));
    } catch (e) { /* ignore */ }
  }
  return normalized;
}

function clearStoredIdentity(): void {
  if (!canUseStorage()) return;
  try {
    localStorage.removeItem(PLAYER_IDENTITY_STORAGE_KEY);
  } catch (e) { /* ignore */ }
}

function getPlayerIdentity(): StoredPlayerIdentity | null {
  return readStoredIdentity();
}

function getPlayerId(): string | null {
  const identity = readStoredIdentity();
  return identity ? identity.playerId : null;
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

async function createPlayerIdentity(options?: any): Promise<StoredPlayerIdentity> {
  const res = await requestJson('POST', '/api/player/identity/create', {}, options);
  const identity = res.ok ? writeStoredIdentity(res.data) : null;
  if (!identity) {
    throw new Error(String(res.reason || 'PLAYER_IDENTITY_CREATE_FAILED'));
  }
  return identity;
}

async function verifyPlayerIdentity(identity: StoredPlayerIdentity, options?: any): Promise<VerifyPlayerIdentityResult> {
  const res = await requestJson('POST', '/api/player/identity/verify', {
    playerId: identity.playerId,
    playerToken: identity.playerToken
  }, options);
  if (res.ok === true) return 'valid';
  if (res.status === 403 && String(res.reason || '') === 'PLAYER_ID_TOKEN_INVALID') return 'invalid';
  return 'unavailable';
}

async function ensurePlayerIdentity(options?: any): Promise<StoredPlayerIdentity> {
  const stored = readStoredIdentity();
  if (stored) {
    const verifyResult = await verifyPlayerIdentity(stored, options);
    if (verifyResult === 'valid') return stored;
    if (verifyResult === 'unavailable') {
      throw new Error('PLAYER_IDENTITY_VERIFY_UNAVAILABLE');
    }
    clearStoredIdentity();
  }
  return createPlayerIdentity(options);
}

async function recoverPlayerIdentity(recoveryCodeValue: any, options?: any): Promise<StoredPlayerIdentity> {
  const recoveryCode = Contract.normalizeRecoveryCode(recoveryCodeValue);
  if (!recoveryCode) {
    throw new Error('RECOVERY_CODE_INVALID');
  }
  const res = await requestJson('POST', '/api/player/identity/recover', { recoveryCode }, options);
  const identity = res.ok ? writeStoredIdentity(res.data) : null;
  if (!identity) {
    throw new Error(String(res.reason || 'PLAYER_IDENTITY_RECOVER_FAILED'));
  }
  return identity;
}

const PlayerIdentity = {
  PLAYER_IDENTITY_STORAGE_KEY,
  getPlayerIdentity,
  getPlayerId,
  ensurePlayerIdentity,
  createPlayerIdentity,
  recoverPlayerIdentity,
  clearStoredIdentity,
  resolveServerBaseUrl
};

try {
  if (typeof globalThis !== 'undefined') {
    (globalThis as any).PlayerIdentity = PlayerIdentity;
  }
} catch (e) { /* ignore */ }

export = PlayerIdentity;
