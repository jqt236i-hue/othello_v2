'use strict';

declare const __non_webpack_require__: NodeRequire | undefined;

const _require: NodeRequire = (typeof __non_webpack_require__ !== 'undefined')
  ? __non_webpack_require__
  : require;

const AvatarOptions = _require('./player-profile-avatar-options');

const PLAYER_PROFILE_STORAGE_KEY = 'card_reversi_player_profile_v1';
const PLAYER_PROFILE_VERSION = 1;
const PLAYER_PROFILE_NAME_MAX = 7;
const PLAYER_PROFILE_BIO_MAX = 120;
const DEFAULT_AVATAR_STONE_TYPE = 'REGEN';

type PlayerProfile = {
  version: number;
  displayName: string;
  avatarStoneType: string;
  bio: string;
  updatedAt: number;
};

function canUseStorage(): boolean {
  try {
    return typeof localStorage !== 'undefined' && !!localStorage;
  } catch (e) {
    return false;
  }
}

function clipCharacters(value: string, max: number): string {
  return Array.from(String(value || '')).slice(0, max).join('');
}

function normalizeDisplayName(value: unknown): string {
  return clipCharacters(String(value || '').replace(/\s+/g, ' ').trim(), PLAYER_PROFILE_NAME_MAX);
}

function normalizeBio(value: unknown): string {
  return clipCharacters(String(value || '').replace(/\r\n?/g, '\n').trim(), PLAYER_PROFILE_BIO_MAX);
}

function normalizeAvatarStoneType(value: unknown): string {
  if (AvatarOptions && typeof AvatarOptions.normalizeProfileAvatarStoneType === 'function') {
    return AvatarOptions.normalizeProfileAvatarStoneType(value);
  }
  return DEFAULT_AVATAR_STONE_TYPE;
}

function normalizePlayerProfile(value: unknown): PlayerProfile {
  const source = value && typeof value === 'object' ? value as Partial<PlayerProfile> : {};
  const updatedAtValue = Number(source.updatedAt);
  return {
    version: PLAYER_PROFILE_VERSION,
    displayName: normalizeDisplayName(source.displayName),
    avatarStoneType: normalizeAvatarStoneType(source.avatarStoneType),
    bio: normalizeBio(source.bio),
    updatedAt: Number.isFinite(updatedAtValue) && updatedAtValue > 0 ? updatedAtValue : 0
  };
}

function getDefaultPlayerProfile(): PlayerProfile {
  return {
    version: PLAYER_PROFILE_VERSION,
    displayName: '',
    avatarStoneType: DEFAULT_AVATAR_STONE_TYPE,
    bio: '',
    updatedAt: 0
  };
}

function readPlayerProfile(): PlayerProfile {
  if (!canUseStorage()) return getDefaultPlayerProfile();
  try {
    const raw = localStorage.getItem(PLAYER_PROFILE_STORAGE_KEY);
    if (!raw) return getDefaultPlayerProfile();
    return normalizePlayerProfile(JSON.parse(raw));
  } catch (e) {
    return getDefaultPlayerProfile();
  }
}

function writePlayerProfile(profile: unknown): PlayerProfile {
  const normalized = normalizePlayerProfile(profile);
  const nextProfile = Object.assign({}, normalized, {
    updatedAt: normalized.updatedAt || Date.now()
  });
  if (canUseStorage()) {
    try {
      localStorage.setItem(PLAYER_PROFILE_STORAGE_KEY, JSON.stringify(nextProfile));
    } catch (e) { /* ignore */ }
  }
  return nextProfile;
}

function savePlayerProfile(profile: unknown): PlayerProfile {
  return writePlayerProfile(Object.assign({}, readPlayerProfile(), profile || {}, {
    updatedAt: Date.now()
  }));
}

function updatePlayerProfile(patch: unknown): PlayerProfile {
  return savePlayerProfile(patch);
}

function clearPlayerProfile(): void {
  if (!canUseStorage()) return;
  try {
    localStorage.removeItem(PLAYER_PROFILE_STORAGE_KEY);
  } catch (e) { /* ignore */ }
}

const PlayerProfileModel = {
  PLAYER_PROFILE_STORAGE_KEY,
  PLAYER_PROFILE_NAME_MAX,
  PLAYER_PROFILE_BIO_MAX,
  DEFAULT_AVATAR_STONE_TYPE,
  getDefaultPlayerProfile,
  normalizePlayerProfile,
  normalizeDisplayName,
  normalizeBio,
  readPlayerProfile,
  writePlayerProfile,
  savePlayerProfile,
  updatePlayerProfile,
  clearPlayerProfile
};

try {
  if (typeof globalThis !== 'undefined') {
    (globalThis as any).PlayerProfile = PlayerProfileModel;
  }
} catch (e) { /* ignore */ }

export = PlayerProfileModel;
