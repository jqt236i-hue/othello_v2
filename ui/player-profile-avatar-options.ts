'use strict';

declare const __non_webpack_require__: NodeRequire | undefined;

const _require: NodeRequire = (typeof __non_webpack_require__ !== 'undefined')
  ? __non_webpack_require__
  : require;

const SpecialStoneRegistry = _require('../shared/special-stone-registry');
const PlayerProfileContract = _require('../shared/player-profile-contract');
const VisualEffectsMap = _require('./visual-effects-map');

type ProfileAvatarOption = {
  id: string;
  stoneType: string;
  label: string;
  imagePath: string;
};

type PlayerProfileContractModule = {
  PROFILE_AVATAR_STONE_TYPES: readonly string[];
  normalizeProfileAvatarStoneType?: (value: unknown) => string;
};

const TypedPlayerProfileContract = PlayerProfileContract as PlayerProfileContractModule;
const PROFILE_AVATAR_STONE_TYPES: readonly string[] = TypedPlayerProfileContract.PROFILE_AVATAR_STONE_TYPES;

const FALLBACK_IMAGE_BY_STONE_TYPE: Record<string, string> = {
  REGEN: 'assets/images/special-stones/regen_stone-black.png',
  PROTECTED: 'assets/images/special-stones/protected_next_stone.png',
  PERMA_PROTECTED: 'assets/images/special-stones/perma_protect_next_stone-black.png',
  SNIPER: 'assets/images/special-stones/sna-black.png',
  GHOST: 'assets/images/special-stones/GHOST_WILL-black.png',
  AFTERIMAGE_WILL: 'assets/images/special-stones/ZAN-BLACK.png',
  SACRIFICE: 'assets/images/special-stones/SACRIFICE_WILL-black.png',
  TRAP: 'assets/images/special-stones/trap_stone-black.png',
  TIME_BOMB: 'assets/images/special-stones/TIME_BOMB-black.png',
  TIME_STOP: 'assets/images/special-stones/TIME_STOP-black.png',
  BREEDING: 'assets/images/special-stones/BREEDING_WILL-black.png',
  PROLIFERATION: 'assets/images/special-stones/PROLIFERATION_WILL-black.png',
  HYPERACTIVE: 'assets/images/special-stones/HYPERACTIVE_WILL-black.png',
  EXTREME_HYPERACTIVE: 'assets/images/special-stones/EXTREME_HYPERACTIVE_WILL-black.png',
  ESCAPE_HYPERACTIVE: 'assets/images/special-stones/ESCAPE_WILL-black.png',
  ROBOT_VACUUM: 'assets/images/special-stones/ROBOT_VACUUM_WILL-black.png',
  GLUTTONOUS: 'assets/images/special-stones/GLUTTONOUS_WILL-black.png',
  WILL_HUNTER_KING: 'assets/images/special-stones/WILL_HUNTER_KING-black.png',
  WORK: 'assets/images/special-stones/work_stone-black.png',
  STONE_SALVATION_GOD: 'assets/images/special-stones/STONE_SALVATION_GOD-black.png',
  DRAGON: 'assets/images/special-stones/ultimate_reverse_dragon-black.png',
  DESTROY_DRAGON: 'assets/images/special-stones/DESTROY_DRAGON-black.png',
  LIGHTNING: 'assets/images/special-stones/rakurai-black.png',
  ULTIMATE_DESTROY_GOD: 'assets/images/special-stones/ULTIMATE_DESTROY_GOD-black.png',
  ULTIMATE_HYPERACTIVE: 'assets/images/special-stones/ULTIMATE_HYPERACTIVE_GOD-black.png',
  METEOR_GOD: 'assets/images/special-stones/METEOR_GOD-black.png',
  THEORY_INCARNATION: 'assets/images/special-stones/theory_incarnation-black.png',
  BOARD_EXECUTOR: 'assets/images/special-stones/board_executor-black.png',
  OBSERVER_WILL: 'assets/images/special-stones/OBSERVER_WILL-black.png',
  GOLD: 'assets/images/special-stones/gold_stone.png',
  SILVER: 'assets/images/special-stones/silver.stone.png',
  RAINBOW: 'assets/images/special-stones/rainbow_stone.png',
  CROSS_BOMB: 'assets/images/special-stones/X_BOMB-black.png',
  X_BOMB: 'assets/images/special-stones/CROSS_BOMB-black.png'
};

let cachedOptions: ProfileAvatarOption[] | null = null;

function normalizeProfileAvatarStoneType(value: unknown): string {
  if (
    TypedPlayerProfileContract
    && typeof TypedPlayerProfileContract.normalizeProfileAvatarStoneType === 'function'
  ) {
    return TypedPlayerProfileContract.normalizeProfileAvatarStoneType(value);
  }
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

  const builtOptions: ProfileAvatarOption[] = PROFILE_AVATAR_STONE_TYPES.map((stoneType: string) => Object.freeze({
    id: `stone:${stoneType}`,
    stoneType,
    label: getLabel(stoneType),
    imagePath: resolveImagePath(stoneType)
  }));

  cachedOptions = builtOptions;
  return builtOptions.map((option) => Object.assign({}, option));
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
