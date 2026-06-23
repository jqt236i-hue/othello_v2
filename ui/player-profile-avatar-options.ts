'use strict';

declare const __non_webpack_require__: NodeRequire | undefined;

const _require: NodeRequire = (typeof __non_webpack_require__ !== 'undefined')
  ? __non_webpack_require__
  : require;

const SpecialStoneRegistry = _require('../shared/special-stone-registry');
const VisualEffectsMap = _require('./visual-effects-map');

type ProfileAvatarOption = {
  id: string;
  stoneType: string;
  label: string;
  imagePath: string;
};

const PROFILE_AVATAR_STONE_TYPES = Object.freeze([
  'REGEN',
  'SNIPER',
  'GHOST',
  'BREEDING',
  'PROLIFERATION',
  'HYPERACTIVE',
  'ESCAPE_HYPERACTIVE',
  'ROBOT_VACUUM',
  'GLUTTONOUS',
  'WILL_HUNTER_KING',
  'STONE_SALVATION_GOD',
  'DESTROY_DRAGON',
  'LIGHTNING',
  'ULTIMATE_DESTROY_GOD',
  'ULTIMATE_HYPERACTIVE',
  'METEOR_GOD',
  'GOLD',
  'SILVER',
  'RAINBOW',
  'ABSOLUTE_PROTECTED'
]);

const FALLBACK_IMAGE_BY_STONE_TYPE: Record<string, string> = {
  REGEN: 'assets/images/special-stones/regen_stone-black.png',
  SNIPER: 'assets/images/special-stones/sna-black.png',
  GHOST: 'assets/images/special-stones/GHOST_WILL-black.png',
  BREEDING: 'assets/images/special-stones/BREEDING_WILL-black.png',
  PROLIFERATION: 'assets/images/special-stones/PROLIFERATION_WILL-black.png',
  HYPERACTIVE: 'assets/images/special-stones/HYPERACTIVE_WILL-black.png',
  ESCAPE_HYPERACTIVE: 'assets/images/special-stones/ESCAPE_WILL-black.png',
  ROBOT_VACUUM: 'assets/images/special-stones/ROBOT_VACUUM_WILL-black.png',
  GLUTTONOUS: 'assets/images/special-stones/GLUTTONOUS_WILL-black.png',
  WILL_HUNTER_KING: 'assets/images/special-stones/WILL_HUNTER_KING-black.png',
  STONE_SALVATION_GOD: 'assets/images/special-stones/STONE_SALVATION_GOD-black.png',
  DESTROY_DRAGON: 'assets/images/special-stones/DESTROY_DRAGON-black.png',
  LIGHTNING: 'assets/images/special-stones/rakurai-black.png',
  ULTIMATE_DESTROY_GOD: 'assets/images/special-stones/ULTIMATE_DESTROY_GOD-black.png',
  ULTIMATE_HYPERACTIVE: 'assets/images/special-stones/ULTIMATE_HYPERACTIVE_WILL-black.png',
  METEOR_GOD: 'assets/images/special-stones/METEOR_GOD-black.png',
  GOLD: 'assets/images/special-stones/gold_stone.png',
  SILVER: 'assets/images/special-stones/silver_stone.png',
  RAINBOW: 'assets/images/special-stones/rainbow_stone.png',
  ABSOLUTE_PROTECTED: 'assets/images/special-stones/absolute_protect_next_stone-black.png'
};

let cachedOptions: ProfileAvatarOption[] | null = null;

function normalizeProfileAvatarStoneType(value: unknown): string {
  const raw = String(value || '').trim().toUpperCase();
  if (!raw) return 'REGEN';
  const normalized = SpecialStoneRegistry && typeof SpecialStoneRegistry.normalizeSpecialStoneType === 'function'
    ? SpecialStoneRegistry.normalizeSpecialStoneType(raw)
    : raw;
  const stoneType = String(normalized || '').toUpperCase();
  return PROFILE_AVATAR_STONE_TYPES.includes(stoneType) ? stoneType : 'REGEN';
}

function resolveImagePath(stoneType: string): string {
  try {
    if (VisualEffectsMap && typeof VisualEffectsMap.getEffectKeyForSpecialType === 'function' && typeof VisualEffectsMap.getStoneVisualPathsForEffectKey === 'function') {
      const effectKey = VisualEffectsMap.getEffectKeyForSpecialType(stoneType);
      const paths = effectKey ? VisualEffectsMap.getStoneVisualPathsForEffectKey(effectKey) : [];
      const preferred = paths.find((path: string) => /-black\.png$/i.test(path)) || paths[0];
      if (preferred) return preferred;
    }
  } catch (e) { /* ignore */ }
  return FALLBACK_IMAGE_BY_STONE_TYPE[stoneType] || FALLBACK_IMAGE_BY_STONE_TYPE.REGEN;
}

function getLabel(stoneType: string): string {
  try {
    if (SpecialStoneRegistry && typeof SpecialStoneRegistry.getSpecialStoneDisplayName === 'function') {
      return SpecialStoneRegistry.getSpecialStoneDisplayName(stoneType, stoneType);
    }
  } catch (e) { /* ignore */ }
  return stoneType;
}

function getProfileAvatarOptions(): ProfileAvatarOption[] {
  if (cachedOptions) return cachedOptions.map((option) => Object.assign({}, option));
  cachedOptions = PROFILE_AVATAR_STONE_TYPES.map((stoneType) => Object.freeze({
    id: `stone:${stoneType}`,
    stoneType,
    label: getLabel(stoneType),
    imagePath: resolveImagePath(stoneType)
  }));
  return cachedOptions.map((option) => Object.assign({}, option));
}

function getProfileAvatarOption(value: unknown): ProfileAvatarOption {
  const stoneType = normalizeProfileAvatarStoneType(value);
  return getProfileAvatarOptions().find((option) => option.stoneType === stoneType) || getProfileAvatarOptions()[0];
}

const PlayerProfileAvatarOptions = {
  PROFILE_AVATAR_STONE_TYPES,
  getProfileAvatarOptions,
  getProfileAvatarOption,
  normalizeProfileAvatarStoneType
};

try {
  if (typeof globalThis !== 'undefined') {
    (globalThis as any).PlayerProfileAvatarOptions = PlayerProfileAvatarOptions;
  }
} catch (e) { /* ignore */ }

export = PlayerProfileAvatarOptions;
