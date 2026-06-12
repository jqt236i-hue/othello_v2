'use strict';

const HAND_ANIMATION_STORAGE_KEYS = {
  draw: 'othello.handAnimation.draw',
  place: 'othello.handAnimation.place'
} as const;

type HandAnimationKind = keyof typeof HAND_ANIMATION_STORAGE_KEYS;

function isIphoneEnvironment(rootRef: any): boolean {
  try {
    const nav = rootRef && rootRef.navigator
      ? rootRef.navigator
      : (typeof navigator !== 'undefined' ? navigator : null);
    const userAgent = nav && typeof nav.userAgent === 'string' ? nav.userAgent : '';
    return /iPhone/i.test(userAgent);
  } catch (e) { /* ignore */ }
  return false;
}

function getStorage(rootRef: any): Storage | null {
  try {
    const storage = rootRef && rootRef.localStorage ? rootRef.localStorage : null;
    return storage && typeof storage.getItem === 'function' ? storage : null;
  } catch (e) { /* ignore */ }
  return null;
}

function normalizeStoredPreference(rawValue: any): boolean | null {
  const raw = String(rawValue || '').trim().toLowerCase();
  if (!raw) return null;
  if (raw === 'off' || raw === 'false' || raw === '0' || raw === 'disabled') return false;
  if (raw === 'on' || raw === 'true' || raw === '1' || raw === 'enabled') return true;
  return null;
}

function readHandAnimationPreference(rootRef: any, key: HandAnimationKind): boolean {
  try {
    const storage = getStorage(rootRef);
    if (storage) {
      const stored = normalizeStoredPreference(storage.getItem(HAND_ANIMATION_STORAGE_KEYS[key]));
      if (stored !== null) return stored;
    }
  } catch (e) { /* ignore */ }
  return !isIphoneEnvironment(rootRef);
}

function writeHandAnimationPreference(rootRef: any, key: HandAnimationKind, enabled: boolean): void {
  try {
    const storage = getStorage(rootRef);
    if (storage) storage.setItem(HAND_ANIMATION_STORAGE_KEYS[key], enabled ? 'on' : 'off');
  } catch (e) { /* ignore */ }
  if (rootRef && typeof rootRef === 'object') {
    if (key === 'draw') rootRef.DISABLE_DRAW_HAND_ANIMATION = !enabled;
    if (key === 'place') rootRef.DISABLE_PLACE_HAND_ANIMATION = !enabled;
  }
}

function syncHandAnimationFlags(rootRef: any): { draw: boolean; place: boolean } {
  const prefs = {
    draw: readHandAnimationPreference(rootRef, 'draw'),
    place: readHandAnimationPreference(rootRef, 'place')
  };
  if (rootRef && typeof rootRef === 'object') {
    rootRef.DISABLE_DRAW_HAND_ANIMATION = !prefs.draw;
    rootRef.DISABLE_PLACE_HAND_ANIMATION = !prefs.place;
  }
  return prefs;
}

const HandAnimationPreferencesModule = {
  HAND_ANIMATION_STORAGE_KEYS,
  isIphoneEnvironment,
  readHandAnimationPreference,
  writeHandAnimationPreference,
  syncHandAnimationFlags
};

export = HandAnimationPreferencesModule;
