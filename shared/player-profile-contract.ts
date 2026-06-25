'use strict';

const PLAYER_PROFILE_NAME_MAX = 7;
const PLAYER_PROFILE_BIO_MAX = 120;
const DEFAULT_PROFILE_AVATAR_STONE_TYPE = 'REGEN';

const PROFILE_AVATAR_STONE_TYPES = Object.freeze([
  'REGEN',
  'PROTECTED',
  'PERMA_PROTECTED',
  'SNIPER',
  'GHOST',
  'AFTERIMAGE_WILL',
  'SACRIFICE',
  'TRAP',
  'TIME_BOMB',
  'TIME_STOP',
  'BREEDING',
  'PROLIFERATION',
  'HYPERACTIVE',
  'EXTREME_HYPERACTIVE',
  'ESCAPE_HYPERACTIVE',
  'ROBOT_VACUUM',
  'GLUTTONOUS',
  'WILL_HUNTER_KING',
  'WORK',
  'STONE_SALVATION_GOD',
  'DRAGON',
  'DESTROY_DRAGON',
  'LIGHTNING',
  'ULTIMATE_DESTROY_GOD',
  'ULTIMATE_HYPERACTIVE',
  'METEOR_GOD',
  'THEORY_INCARNATION',
  'BOARD_EXECUTOR',
  'OBSERVER_WILL',
  'GOLD',
  'SILVER',
  'RAINBOW',
  'CROSS_BOMB',
  'X_BOMB'
]);

function clipCharacters(value: string, max: number): string {
  return Array.from(String(value || '')).slice(0, max).join('');
}

function normalizeProfileDisplayName(value: unknown): string {
  return clipCharacters(String(value || '').replace(/\s+/g, ' ').trim(), PLAYER_PROFILE_NAME_MAX);
}

function normalizeProfileBio(value: unknown): string {
  return clipCharacters(String(value || '').replace(/\r\n?/g, '\n').trim(), PLAYER_PROFILE_BIO_MAX);
}

function normalizeProfileAvatarStoneType(value: unknown): string {
  const normalized = String(value || '').trim().toUpperCase();
  return PROFILE_AVATAR_STONE_TYPES.includes(normalized) ? normalized : DEFAULT_PROFILE_AVATAR_STONE_TYPE;
}

function normalizePublicPlayerProfile(value: unknown): { avatarStoneType: string; bio: string } {
  const source = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  return {
    avatarStoneType: normalizeProfileAvatarStoneType(source.avatarStoneType),
    bio: normalizeProfileBio(source.bio)
  };
}

function hasPublicPlayerProfileFields(value: unknown): boolean {
  if (!value || typeof value !== 'object') return false;
  const source = value as Record<string, unknown>;
  return Object.prototype.hasOwnProperty.call(source, 'avatarStoneType')
    || Object.prototype.hasOwnProperty.call(source, 'bio');
}

export = {
  PLAYER_PROFILE_NAME_MAX,
  PLAYER_PROFILE_BIO_MAX,
  DEFAULT_PROFILE_AVATAR_STONE_TYPE,
  PROFILE_AVATAR_STONE_TYPES,
  normalizeProfileDisplayName,
  normalizeProfileBio,
  normalizeProfileAvatarStoneType,
  normalizePublicPlayerProfile,
  hasPublicPlayerProfileFields
};
