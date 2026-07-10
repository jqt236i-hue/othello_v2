'use strict';

declare const __non_webpack_require__: NodeRequire | undefined;

const _require: NodeRequire = (typeof __non_webpack_require__ !== 'undefined')
  ? __non_webpack_require__
  : require;

let VisualEffectsMapGlobalPublication: any = null;
try {
  VisualEffectsMapGlobalPublication = _require('./visual-effects-map-global-publication');
} catch (e) { /* optional global compatibility adapter */ }

function shouldLogVisualEffectsBootstrap(): boolean {
  try {
    if (typeof window !== 'undefined' && window) {
      if ((window as any).DEBUG_WORK_VISUALS === true || (window as any).DEBUG_MODE_ALLOWED === true) return true;
    }
  } catch (e) { /* ignore */ }
  try {
    const qs = (typeof location !== 'undefined' && location && typeof location.search === 'string')
      ? location.search
      : '';
    return /[?&]debug=(?:1|true)\b/i.test(qs);
  } catch (e) { /* ignore */ }
  return false;
}

if (shouldLogVisualEffectsBootstrap() && typeof console !== 'undefined' && typeof console.log === 'function') {
  console.log('[VISUAL_EFFECTS] ui/visual-effects-map.js loaded');
}

function getSharedVisualEffectsMap(): any {
  try {
    if (typeof window !== 'undefined' && (window as any).GameVisualEffectsMap && (window as any).GameVisualEffectsMap.STONE_VISUAL_EFFECTS) {
      return (window as any).GameVisualEffectsMap;
    }
  } catch (e) { /* ignore */ }
  try {
    if (typeof _require === 'function') {
      const mod = _require('../game/visual-effects-map');
      if (mod && mod.STONE_VISUAL_EFFECTS) return mod;
    }
  } catch (e) { /* ignore */ }
  try {
    if (typeof window !== 'undefined' && (window as any).STONE_VISUAL_EFFECTS) {
      return { STONE_VISUAL_EFFECTS: (window as any).STONE_VISUAL_EFFECTS };
    }
  } catch (e) { /* ignore */ }
  return { STONE_VISUAL_EFFECTS: {} };
}

function installSharedVisualEffectsMapGlobals(): void {
  const sharedMap = getSharedVisualEffectsMap();
  if (!sharedMap || !sharedMap.STONE_VISUAL_EFFECTS) return;
  if (VisualEffectsMapGlobalPublication
    && typeof VisualEffectsMapGlobalPublication.publishGameVisualEffectsMap === 'function') {
    VisualEffectsMapGlobalPublication.publishGameVisualEffectsMap(sharedMap);
  }
}

installSharedVisualEffectsMapGlobals();
const SHARED_MAP = getSharedVisualEffectsMap();
function getUiStoneVisualEffects(): any {
  const map = getSharedVisualEffectsMap();
  return (map && map.STONE_VISUAL_EFFECTS) ? map.STONE_VISUAL_EFFECTS : {};
}

function getUiPendingTypeToEffectKey(): any {
  const map = getSharedVisualEffectsMap();
  return (map && map.PENDING_TYPE_TO_EFFECT_KEY) ? map.PENDING_TYPE_TO_EFFECT_KEY : {};
}

function getUiSpecialTypeToEffectKey(): any {
  const map = getSharedVisualEffectsMap();
  return (map && map.SPECIAL_TYPE_TO_EFFECT_KEY) ? map.SPECIAL_TYPE_TO_EFFECT_KEY : {};
}

function getEffectKeyForPendingType(pendingType: string): string | null {
  const pendingMap = getUiPendingTypeToEffectKey();
  return pendingMap[pendingType] || null;
}

function getEffectKeyForSpecialType(type: string): string | null {
  const specialMap = getUiSpecialTypeToEffectKey();
  return specialMap[type] || null;
}

function normalizeOwnerValue(owner: any): number {
  if (owner === 1 || owner === '1' || owner === 'black') return 1;
  if (owner === -1 || owner === '-1' || owner === 'white') return -1;
  const n = Number(owner);
  if (Number.isFinite(n) && (n === 1 || n === -1)) return n;
  return 1;
}

let DiscRenderHelpersModule: any = null;
if (typeof _require === 'function') {
  try { DiscRenderHelpersModule = _require('./board-renderer'); } catch (e) { /* ignore */ }
}

function getDiscRenderHelper(name: string): any {
  if (DiscRenderHelpersModule && typeof DiscRenderHelpersModule[name] === 'function') {
    return DiscRenderHelpersModule[name];
  }
  try {
    if (typeof window !== 'undefined' && typeof (window as any)[name] === 'function') {
      return (window as any)[name];
    }
  } catch (e) { /* ignore */ }
  return null;
}

function normalizeOwnerKey(owner: any): string | null {
  if (owner === undefined || owner === null) return null;
  if (owner === 1 || owner === '1' || owner === 'black') return '1';
  if (owner === -1 || owner === '-1' || owner === 'white') return '-1';
  const s = String(owner).trim().toLowerCase();
  if (s === 'black') return '1';
  if (s === 'white') return '-1';
  if (s === '1') return '1';
  if (s === '-1') return '-1';
  return String(owner);
}

function resolveStoneEffectImagePath(effect: any, options: any = {}): string | null {
  if (!effect || typeof effect !== 'object') return null;
  if (effect.imagePathByOwner) {
    const ownerKey = normalizeOwnerKey(options.owner);
    return ownerKey ? (effect.imagePathByOwner[ownerKey] || null) : null;
  }
  if (effect.imagePathByPlayer) {
    const playerKey = normalizeOwnerKey(options.player);
    return playerKey ? (effect.imagePathByPlayer[playerKey] || null) : null;
  }
  return effect.imagePath || null;
}

function resolveRenderMode(effect: any): string {
  return (effect && typeof effect.renderMode === 'string' && effect.renderMode)
    ? effect.renderMode
    : 'replace';
}

function resolveOverlayScale(effect: any): number {
  const n = Number(effect && effect.scale);
  return (Number.isFinite(n) && n > 0) ? n : 1;
}

function resolveOwnerClassSuffix(owner: any): string {
  return normalizeOwnerValue(owner) === -1 ? 'white' : 'black';
}

function applyOwnerMetadataForEffect(discElement: HTMLElement, effectKey: string, effect: any, options: any = {}): void {
  if (!discElement || !effect || !effect.imagePathByOwner || options.owner === undefined) return;
  const ownerSuffix = resolveOwnerClassSuffix(options.owner);
  if (effectKey === 'breedingStone') {
    discElement.classList.remove('breeding-black', 'breeding-white');
    discElement.classList.add(`breeding-${ownerSuffix}`);
    discElement.dataset.breeding = ownerSuffix;
    return;
  }
  discElement.classList.remove('ud-black', 'ud-white');
  discElement.classList.add(`ud-${ownerSuffix}`);
  discElement.dataset.ud = ownerSuffix;
}

function clearOwnerMetadataForEffect(discElement: HTMLElement, effectKey: string): void {
  if (!discElement) return;
  if (effectKey === 'breedingStone') {
    discElement.classList.remove('breeding-black', 'breeding-white');
    delete discElement.dataset.breeding;
    return;
  }
  discElement.classList.remove('ud-black', 'ud-white');
  delete discElement.dataset.ud;
}

function getStoneVisualPathsForEffectKey(effectKey: string): string[] {
  const visualMap = getUiStoneVisualEffects();
  const effect = visualMap[effectKey];
  if (!effect || typeof effect !== 'object') return [];

  const paths: string[] = [];
  if (typeof effect.imagePath === 'string' && effect.imagePath) {
    paths.push(effect.imagePath);
  }
  if (effect.imagePathByOwner && typeof effect.imagePathByOwner === 'object') {
    for (const value of Object.values(effect.imagePathByOwner)) {
      if (typeof value === 'string' && value) paths.push(value);
    }
  }
  if (effect.imagePathByPlayer && typeof effect.imagePathByPlayer === 'object') {
    for (const value of Object.values(effect.imagePathByPlayer)) {
      if (typeof value === 'string' && value) paths.push(value);
    }
  }

  return Array.from(new Set(paths));
}

function preloadStoneVisualEffectKeys(effectKeys: string | string[]): { started: string[]; skipped: string[] } {
  const root = (typeof window !== 'undefined' && window)
    ? window
    : ((typeof globalThis !== 'undefined' && globalThis) ? globalThis : null);
  const ImageCtor = root && typeof (root as any).Image === 'function'
    ? (root as any).Image
    : ((typeof Image === 'function') ? Image : null);
  const keys = Array.isArray(effectKeys) ? effectKeys : [effectKeys];
  const paths = Array.from(new Set(
    keys
      .map((key) => String(key || '').trim())
      .filter((key) => !!key)
      .flatMap((key) => getStoneVisualPathsForEffectKey(key))
  ));

  if (!paths.length || !ImageCtor || !root) {
    return { started: [], skipped: paths };
  }

  const cache = (root as any).__preloadedStoneVisualPaths || ((root as any).__preloadedStoneVisualPaths = Object.create(null));
  const imageRefs = (root as any).__preloadedStoneVisualImages || ((root as any).__preloadedStoneVisualImages = Object.create(null));
  const started: string[] = [];
  const skipped: string[] = [];

  for (const src of paths) {
    const cacheKey = String(src);
    if (cache[cacheKey] === 'started' || cache[cacheKey] === 'loaded') {
      skipped.push(src);
      continue;
    }

    cache[cacheKey] = 'started';
    started.push(src);

    try {
      const img = new ImageCtor();
      imageRefs[cacheKey] = img;
      img.onload = function () {
        cache[cacheKey] = 'loaded';
      };
      img.onerror = function () {
        cache[cacheKey] = 'error';
        try { delete imageRefs[cacheKey]; } catch (e) { /* ignore */ }
      };
      try { img.decoding = 'async'; } catch (e) { /* ignore */ }
      img.src = src;
    } catch (e) {
      cache[cacheKey] = 'error';
    }
  }

  return { started, skipped };
}

async function applyTrapStoneFallbackVisual(discElement: HTMLElement, owner: any): Promise<boolean> {
  try {
    return await applyStoneVisualEffect(discElement, 'trapStone', { owner });
  } catch (e) {
    return false;
  }
}

function clearStoneVisualEffectState(discElement: HTMLElement, options: any = {}): void {
  if (!discElement) return;

  const visualMap = getUiStoneVisualEffects();
  discElement.classList.remove('special-stone', 'ud-black', 'ud-white', 'breeding-black', 'breeding-white');
  delete discElement.dataset.ud;
  delete discElement.dataset.breeding;

  for (const effect of Object.values(visualMap)) {
    if (!effect || !(effect as any).cssClass) continue;
    discElement.classList.remove((effect as any).cssClass);
    Object.keys((effect as any).dataAttributes || {}).forEach((key) => {
      delete discElement.dataset[key];
    });
    Object.keys((effect as any).clearStyles || {}).forEach((property) => {
      try { discElement.style.removeProperty(property); } catch (e) { /* ignore */ }
    });
  }

  try { discElement.style.removeProperty('--special-stone-image'); } catch (e) { /* ignore */ }
  try { discElement.style.removeProperty('--disc-overlay-image'); } catch (e) { /* ignore */ }
  try { discElement.style.removeProperty('--disc-overlay-scale'); } catch (e) { /* ignore */ }
  try { discElement.style.removeProperty('--dragon-image-path'); } catch (e) { /* ignore */ }
  try { discElement.style.removeProperty('--breeding-image-path'); } catch (e) { /* ignore */ }
  if (options.skipRenderReset) return;

  const applyDiscRenderState = getDiscRenderHelper('applyDiscRenderState');
  const owner = discElement.classList && discElement.classList.contains('white') ? -1 : 1;
  if (applyDiscRenderState) {
    applyDiscRenderState(discElement, {
      owner,
      renderMode: 'base-only',
      effectKey: 'normal'
    });
    return;
  }
  try {
    discElement.dataset.renderMode = 'base-only';
    discElement.dataset.effect = 'normal';
  } catch (e) { /* ignore */ }
}

async function applyStoneVisualEffect(discElement: HTMLElement, effectKey: string, options: any = {}): Promise<boolean> {
  const debugVisual = (typeof window !== 'undefined' && (window as any).DEBUG_WORK_VISUALS === true);
  if (debugVisual) console.log('[VISUAL_DEBUG] applyStoneVisualEffect called', effectKey, options);
  const visualMap = getUiStoneVisualEffects();
  const effect = visualMap[effectKey];
  try { if (!discElement && debugVisual) console.warn('[VISUAL_DEBUG] applyStoneVisualEffect: discElement missing for', effectKey); } catch (e) { /* Intentionally empty: debug guard */ }
  try { if (debugVisual) console.log('[VISUAL_DEBUG] effect lookup:', effectKey, effect ? effect.cssClass : null); } catch (e) { /* Intentionally empty: debug guard */ }
  if (!effect) {
    console.warn(`[VISUAL_EFFECTS] Unknown effect key: ${effectKey}`);
    return false;
  }

  if (debugVisual && effectKey === 'workStone') {
    console.log('[VISUAL_DEBUG] applyStoneVisualEffect(workStone) called, options:', options, 'effect:', effect);
    try { (window as any)._lastApplyWorkTs = Date.now(); } catch (e) { /* Intentionally empty: diagnostic timestamp */ }
  }

  const ensureDiscSkeleton = getDiscRenderHelper('ensureDiscSkeleton');
  const applyDiscRenderState = getDiscRenderHelper('applyDiscRenderState');
  if (ensureDiscSkeleton) ensureDiscSkeleton(discElement);

  discElement.classList.add('special-stone');
  discElement.classList.add(effect.cssClass);
  applyOwnerMetadataForEffect(discElement, effectKey, effect, options);

  try { if (debugVisual) console.log('[VISUAL_DEBUG] after apply classes:', discElement.className, 'cssVar:', discElement.style.getPropertyValue('--special-stone-image')); } catch(e){ /* Intentionally empty: debug guard */ }
  const imagePath = resolveStoneEffectImagePath(effect, options);
  let overlayImage: string | null = null;
  if (imagePath) {
    let resolvedPath = imagePath;
    try {
      if (typeof document !== 'undefined' && document.baseURI) {
        resolvedPath = new URL(imagePath, document.baseURI).href;
      }
    } catch (e) { /* ignore */ }
    overlayImage = `url('${resolvedPath}')`;
    try { discElement.style.setProperty('--special-stone-image', overlayImage); } catch (e) { /* ignore */ }
    try { discElement.style.setProperty('--disc-overlay-image', overlayImage); } catch (e) { /* ignore */ }
    if (effectKey === 'ultimateDragon' || effectKey === 'destroyDragonStone' || effectKey === 'ultimateDestroyGod') {
      try { discElement.style.setProperty('--dragon-image-path', overlayImage); } catch (e) { /* ignore */ }
    }
    if (effectKey === 'breedingStone') {
      try { discElement.style.setProperty('--breeding-image-path', overlayImage); } catch (e) { /* ignore */ }
    }
  }

  if (applyDiscRenderState) {
    applyDiscRenderState(discElement, {
      owner: options.owner,
      renderMode: resolveRenderMode(effect),
      overlayImage,
      scale: resolveOverlayScale(effect),
      imageState: overlayImage ? 'loaded' : undefined,
      effectKey
    });
  } else {
    try {
      discElement.dataset.renderMode = resolveRenderMode(effect);
      discElement.dataset.effect = effectKey;
      if (overlayImage) discElement.style.setProperty('--disc-overlay-image', overlayImage);
    } catch (e) { /* ignore */ }
  }

  Object.entries(effect.dataAttributes || {}).forEach(([key, value]) => {
    discElement.dataset[key] = String(value);
  });

  if (effect.clearStyles) {
    Object.entries(effect.clearStyles).forEach(([property, value]) => {
      discElement.style.setProperty(property, String(value), 'important');
    });
  }

  return !!(overlayImage || !effect.imagePath && !effect.imagePathByOwner && !effect.imagePathByPlayer);
}

function removeStoneVisualEffect(discElement: HTMLElement, effectKey: string): void {
  const visualMap = getUiStoneVisualEffects();
  const effect = visualMap[effectKey];
  if (!effect) return;

  discElement.classList.remove('special-stone');
  discElement.classList.remove(effect.cssClass);
  clearOwnerMetadataForEffect(discElement, effectKey);

  Object.keys(effect.dataAttributes || {}).forEach(key => {
    delete discElement.dataset[key];
  });

  Object.keys(effect.clearStyles || {}).forEach((property) => {
    try { discElement.style.removeProperty(property); } catch (e) { /* ignore */ }
  });

  try { discElement.style.removeProperty('--special-stone-image'); } catch (e) { /* ignore */ }
  try { discElement.style.removeProperty('--disc-overlay-image'); } catch (e) { /* ignore */ }
  try { discElement.style.removeProperty('--disc-overlay-scale'); } catch (e) { /* ignore */ }
  try { discElement.style.removeProperty('--dragon-image-path'); } catch (e) { /* ignore */ }
  try { discElement.style.removeProperty('--breeding-image-path'); } catch (e) { /* ignore */ }
  const applyDiscRenderState = getDiscRenderHelper('applyDiscRenderState');
  const owner = discElement.classList && discElement.classList.contains('white') ? -1 : 1;
  if (applyDiscRenderState) {
    applyDiscRenderState(discElement, {
      owner,
      renderMode: 'base-only',
      effectKey: 'normal'
    });
  } else {
    try {
      discElement.dataset.renderMode = 'base-only';
      discElement.dataset.effect = 'normal';
    } catch (e) { /* ignore */ }
  }
}

function getSupportedEffectKeys(): string[] {
  return Object.keys(getUiStoneVisualEffects());
}

const VisualEffectsMap = {
  UI_STONE_VISUAL_EFFECTS: getUiStoneVisualEffects(),
  PENDING_TYPE_TO_EFFECT_KEY: getUiPendingTypeToEffectKey(),
  getEffectKeyForPendingType,
  SPECIAL_TYPE_TO_EFFECT_KEY: getUiSpecialTypeToEffectKey(),
  getEffectKeyForSpecialType,
  getStoneVisualPathsForEffectKey,
  preloadStoneVisualEffectKeys,
  normalizeOwnerValue,
  applyTrapStoneFallbackVisual,
  clearStoneVisualEffectState,
  applyStoneVisualEffect,
  removeStoneVisualEffect,
  getSupportedEffectKeys
};

try {
  if (typeof window !== 'undefined' && window) {
    (window as any).UIVisualEffectsMap = VisualEffectsMap;
    (window as any).applyStoneVisualEffect = applyStoneVisualEffect;
    (window as any).removeStoneVisualEffect = removeStoneVisualEffect;
    (window as any).preloadStoneVisualEffectKeys = preloadStoneVisualEffectKeys;
    (window as any).clearStoneVisualEffectState = clearStoneVisualEffectState;
  }
} catch (e) { /* ignore */ }

export = VisualEffectsMap;
