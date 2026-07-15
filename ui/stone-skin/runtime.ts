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
  contentFingerprint?: string;
}

interface StoneSkinCatalogModule {
  DEFAULT_STONE_SKIN_ID?: string;
  normalizeStoneSkinId?: (value: string | null | undefined, rootRef?: Window) => string;
  getStoneSkinDefinition?: (skinId: string, rootRef?: Window) => StoneSkinDefinition | null;
}

interface CustomSkinImageSourceDescriptor {
  role: string;
  url: string;
  blob: Blob;
}

interface CustomSkinResourceDescriptor {
  id: string;
  kind: string;
  contentFingerprint: string;
  images: readonly CustomSkinImageSourceDescriptor[];
}

interface CustomSkinObjectUrlLease {
  release(): boolean;
}

interface CustomSkinStorageModule {
  isCustomSkin?: (skinId: string, kind?: string) => boolean;
  getCustomSkinResourceDescriptor?: (rootRef: Window, skinId: string) => CustomSkinResourceDescriptor | null;
  acquireCustomSkinObjectUrlLease?: (
    rootRef: Window,
    skinId: string,
    expectedUrls?: readonly string[]
  ) => CustomSkinObjectUrlLease | null;
}

interface StoneSkinResourceDescriptor {
  readonly skinId: string;
  readonly blackImagePath: string;
  readonly whiteImagePath: string;
  readonly blackSourceBlob: Blob | null;
  readonly whiteSourceBlob: Blob | null;
  readonly contentFingerprint: string;
}

interface ActiveStoneDisplayLease {
  signature: string;
  lease: CustomSkinObjectUrlLease | null;
}

type NormalStoneOwner = 'black' | 'white';
const FALLBACK_STONE_SKIN_ID = 'o-stone';
const FALLBACK_STONE_IMAGE_PATHS = Object.freeze({
  black: 'assets/images/stone-skin/o-stone/black.png',
  white: 'assets/images/stone-skin/o-stone/white.png'
});
const displayLeaseStates = new WeakMap<object, ActiveStoneDisplayLease>();

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

function resolveCustomSkinStorageModule(rootRef: Window | null | undefined): CustomSkinStorageModule | null {
  const ctx = resolveRootRef(rootRef);
  if (ctx && (ctx as Window & { CustomSkinStorageModule?: CustomSkinStorageModule }).CustomSkinStorageModule) {
    return (ctx as Window & { CustomSkinStorageModule?: CustomSkinStorageModule }).CustomSkinStorageModule ?? null;
  }
  try {
    if (typeof globalThis !== 'undefined' && (globalThis as unknown as { CustomSkinStorageModule?: CustomSkinStorageModule }).CustomSkinStorageModule) {
      return (globalThis as unknown as { CustomSkinStorageModule?: CustomSkinStorageModule }).CustomSkinStorageModule ?? null;
    }
  } catch (e) { /* ignore */ }
  try {
    return _require('../custom-skin/storage') ?? null;
  } catch (e) {
    return null;
  }
}

function fnv1a32Text(value: string): string {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `fnv1a32:${(hash >>> 0).toString(16).padStart(8, '0')}`;
}

function resolveStoneSkinResourceDescriptor(
  rootRef: Window | null | undefined,
  preferredSkinId: string | null | undefined
): StoneSkinResourceDescriptor | null {
  const root = resolveRootRef(rootRef);
  const catalog = resolveCatalogModule(root);
  const fallbackId = String((catalog && catalog.DEFAULT_STONE_SKIN_ID) || FALLBACK_STONE_SKIN_ID).trim() || FALLBACK_STONE_SKIN_ID;
  const skinId = catalog && typeof catalog.normalizeStoneSkinId === 'function'
    ? catalog.normalizeStoneSkinId(preferredSkinId, root as Window)
    : fallbackId;
  const definition = catalog && typeof catalog.getStoneSkinDefinition === 'function'
    ? catalog.getStoneSkinDefinition(skinId, root as Window)
    : null;
  if (!definition) return null;
  const storage = resolveCustomSkinStorageModule(root);
  let custom: CustomSkinResourceDescriptor | null = null;
  if (root && storage && typeof storage.getCustomSkinResourceDescriptor === 'function') {
    try {
      const candidate = storage.getCustomSkinResourceDescriptor(root, definition.id);
      if (candidate && candidate.kind === 'stone') custom = candidate;
    } catch (e) { /* built-in descriptor remains available */ }
  }
  const blackImage = custom && custom.images.find((image) => image.role === 'black-stone');
  const whiteImage = custom && custom.images.find((image) => image.role === 'white-stone');
  const contentFingerprint = String(
    custom && custom.contentFingerprint
      || definition.contentFingerprint
      || fnv1a32Text(`${definition.id}|${definition.blackImagePath}|${definition.whiteImagePath}`)
  );
  return Object.freeze({
    skinId: definition.id,
    blackImagePath: String(definition.blackImagePath || ''),
    whiteImagePath: String(definition.whiteImagePath || ''),
    blackSourceBlob: blackImage ? blackImage.blob : null,
    whiteSourceBlob: whiteImage ? whiteImage.blob : null,
    contentFingerprint
  });
}

function acquireDisplayLease(
  rootRef: Window | null | undefined,
  skinId: string,
  urls: readonly string[]
): CustomSkinObjectUrlLease | null {
  const root = resolveRootRef(rootRef);
  const storage = resolveCustomSkinStorageModule(root);
  if (!root || !storage || typeof storage.isCustomSkin !== 'function'
    || !storage.isCustomSkin(skinId, 'stone')
    || typeof storage.acquireCustomSkinObjectUrlLease !== 'function') return null;
  try {
    return storage.acquireCustomSkinObjectUrlLease(root, skinId, urls);
  } catch (e) {
    return null;
  }
}

function releaseAppliedStoneSkinLease(rootRef: Window | null | undefined): void {
  const root = resolveRootRef(rootRef);
  if (!root || typeof root !== 'object') return;
  const state = displayLeaseStates.get(root);
  if (state && state.lease) state.lease.release();
  displayLeaseStates.delete(root);
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
  const signature = `${definition.id}|${definition.blackImagePath}|${definition.whiteImagePath}`;
  const previous = ctx && typeof ctx === 'object' ? displayLeaseStates.get(ctx) : undefined;
  if (previous && previous.signature === signature) {
    rootEl.setAttribute('data-stone-skin-id', definition.id);
    rootEl.style.setProperty(getNormalStoneImageVariableName('black'), cssUrl(definition.blackImagePath));
    rootEl.style.setProperty(getNormalStoneImageVariableName('white'), cssUrl(definition.whiteImagePath));
    return definition;
  }
  const nextLease = acquireDisplayLease(ctx, definition.id, [definition.blackImagePath, definition.whiteImagePath]);
  try {
    rootEl.setAttribute('data-stone-skin-id', definition.id);
    rootEl.style.setProperty(getNormalStoneImageVariableName('black'), cssUrl(definition.blackImagePath));
    rootEl.style.setProperty(getNormalStoneImageVariableName('white'), cssUrl(definition.whiteImagePath));
  } catch (error) {
    if (nextLease) nextLease.release();
    throw error;
  }
  if (ctx && typeof ctx === 'object') {
    displayLeaseStates.set(ctx, { signature, lease: nextLease });
  }
  if (previous && previous.lease) previous.lease.release();
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
  resolveStoneSkinResourceDescriptor,
  releaseAppliedStoneSkinLease,
  applyStoneSkin,
  syncDisplayedStoneSkin
};
