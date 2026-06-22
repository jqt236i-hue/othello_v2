/**
 * @file runtime.ts
 * @description Normal stone skin runtime application
 */

declare const __non_webpack_require__: NodeRequire | undefined;

const _require: NodeRequire = (typeof __non_webpack_require__ !== 'undefined')
  ? __non_webpack_require__
  : require;

interface StoneSkinDefinition {
  id: string;
  blackImagePath: string;
  whiteImagePath: string;
}

interface StoneSkinCatalogModule {
  DEFAULT_STONE_SKIN_ID?: string;
  normalizeStoneSkinId?: (value: string | null | undefined, rootRef?: Window) => string;
  getStoneSkinDefinition?: (skinId: string, rootRef?: Window) => StoneSkinDefinition | null;
}

type NormalStoneOwner = 'black' | 'white';
const FALLBACK_STONE_SKIN_ID = 'o-stone';
const FALLBACK_STONE_IMAGE_PATHS = Object.freeze({
  black: 'assets/images/stone-skin/o-stone/black.png',
  white: 'assets/images/stone-skin/o-stone/white.png'
});

function resolveRootRef(rootRef: Window | null | undefined): Window | null {
  if (rootRef && typeof rootRef === 'object') return rootRef;
  try {
    if (typeof globalThis !== 'undefined' && globalThis) return globalThis as unknown as Window;
  } catch (e) { /* ignore */ }
  return null;
}

function resolveDocument(rootRef: Window | null | undefined): Document | null {
  const ctx = resolveRootRef(rootRef);
  if (ctx && ctx.document) return ctx.document;
  if (typeof document !== 'undefined') return document;
  return null;
}

function requireStoneSkinCatalogModuleOrNull(): StoneSkinCatalogModule | null {
  if (typeof _require !== 'function') return null;
  try {
    return _require('./catalog') ?? null;
  } catch (e) {
    /* ignore */
  }
  return null;
}

function resolveCatalogModule(rootRef: Window | null | undefined): StoneSkinCatalogModule | null {
  const ctx = resolveRootRef(rootRef);
  if (ctx && (ctx as Window & { StoneSkinCatalogModule?: StoneSkinCatalogModule }).StoneSkinCatalogModule) {
    return (ctx as Window & { StoneSkinCatalogModule?: StoneSkinCatalogModule }).StoneSkinCatalogModule ?? null;
  }
  try {
    if (typeof globalThis !== 'undefined' && (globalThis as unknown as Window & { StoneSkinCatalogModule?: StoneSkinCatalogModule }).StoneSkinCatalogModule) {
      return (globalThis as unknown as Window & { StoneSkinCatalogModule?: StoneSkinCatalogModule }).StoneSkinCatalogModule ?? null;
    }
  } catch (e) { /* ignore */ }
  return requireStoneSkinCatalogModuleOrNull();
}

function cssUrl(path: string): string {
  return 'url("' + String(path || '').replace(/"/g, '\\"') + '")';
}

function normalizeNormalStoneOwner(owner: unknown): NormalStoneOwner {
  return String(owner || '').trim().toLowerCase() === 'white' ? 'white' : 'black';
}

function getNormalStoneImageVariableName(owner: unknown): string {
  return normalizeNormalStoneOwner(owner) === 'white'
    ? '--normal-stone-white-image'
    : '--normal-stone-black-image';
}

function getDefaultNormalStoneImagePath(owner: unknown, rootRef?: Window | null): string {
  const normalizedOwner = normalizeNormalStoneOwner(owner);
  const fallbackPath = FALLBACK_STONE_IMAGE_PATHS[normalizedOwner];
  const catalogModule = resolveCatalogModule(rootRef);
  if (!catalogModule || typeof catalogModule.getStoneSkinDefinition !== 'function') return fallbackPath;
  const defaultSkinId = String(catalogModule.DEFAULT_STONE_SKIN_ID || '').trim() || FALLBACK_STONE_SKIN_ID;
  const definition = catalogModule.getStoneSkinDefinition(defaultSkinId, resolveRootRef(rootRef) as Window);
  if (!definition) return fallbackPath;
  return normalizedOwner === 'white'
    ? String(definition.whiteImagePath || '').trim() || fallbackPath
    : String(definition.blackImagePath || '').trim() || fallbackPath;
}

function resolveNormalStoneBackgroundImage(owner: unknown, rootRef?: Window | null): string {
  const fallbackValue = cssUrl(getDefaultNormalStoneImagePath(owner, rootRef));
  try {
    const docRef = resolveDocument(rootRef);
    const rootEl = docRef && docRef.documentElement ? docRef.documentElement : null;
    if (!rootEl) return fallbackValue;
    const variableName = getNormalStoneImageVariableName(owner);
    const inlineValue = rootEl.style && typeof rootEl.style.getPropertyValue === 'function'
      ? rootEl.style.getPropertyValue(variableName)
      : '';
    const ctx = resolveRootRef(rootRef);
    const computedStyleReader = ctx && typeof ctx.getComputedStyle === 'function'
      ? ctx.getComputedStyle.bind(ctx)
      : (typeof getComputedStyle === 'function' ? getComputedStyle : null);
    const computedValue = computedStyleReader
      ? computedStyleReader(rootEl).getPropertyValue(variableName)
      : '';
    const resolvedValue = String(inlineValue || computedValue || '').trim();
    return resolvedValue || fallbackValue;
  } catch {
    return fallbackValue;
  }
}

function applyStoneSkin(rootRef: Window | null | undefined, skinId: string): StoneSkinDefinition | null {
  const ctx = resolveRootRef(rootRef);
  const docRef = resolveDocument(ctx);
  const catalogModule = resolveCatalogModule(ctx);
  const definition = catalogModule && typeof catalogModule.getStoneSkinDefinition === 'function'
    ? catalogModule.getStoneSkinDefinition(skinId, ctx as Window)
    : null;
  if (!docRef || !definition || !docRef.documentElement) return null;
  const rootEl = docRef.documentElement;
  rootEl.setAttribute('data-stone-skin-id', definition.id);
  rootEl.style.setProperty(getNormalStoneImageVariableName('black'), cssUrl(definition.blackImagePath));
  rootEl.style.setProperty(getNormalStoneImageVariableName('white'), cssUrl(definition.whiteImagePath));
  return definition;
}

function syncDisplayedStoneSkin(rootRef: Window | null | undefined, preferredSkinId: string | null | undefined): StoneSkinDefinition | null {
  const catalogModule = resolveCatalogModule(rootRef);
  const fallbackId = String((catalogModule && catalogModule.DEFAULT_STONE_SKIN_ID) || FALLBACK_STONE_SKIN_ID).trim() || FALLBACK_STONE_SKIN_ID;
  const normalized = catalogModule && typeof catalogModule.normalizeStoneSkinId === 'function'
    ? catalogModule.normalizeStoneSkinId(preferredSkinId, rootRef as Window)
    : fallbackId;
  return applyStoneSkin(rootRef, normalized);
}

export = {
  resolveRootRef,
  resolveDocument,
  normalizeNormalStoneOwner,
  getNormalStoneImageVariableName,
  getDefaultNormalStoneImagePath,
  resolveNormalStoneBackgroundImage,
  applyStoneSkin,
  syncDisplayedStoneSkin
};
