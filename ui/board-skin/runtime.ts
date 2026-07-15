/**
 * @file runtime.ts
 * @description Board surface skin runtime application
 */

declare const __non_webpack_require__: NodeRequire | undefined;

const _require: NodeRequire = (typeof __non_webpack_require__ !== 'undefined')
  ? __non_webpack_require__
  : require;

interface BoardSkinDefinition {
  id: string;
  imagePath: string;
  layout?: BoardFrameSkinLayout;
  contentFingerprint?: string;
}

interface BoardFrameSkinLayout {
  paddingTop?: number;
  paddingRight?: number;
  paddingBottom?: number;
  paddingLeft?: number;
  artOverhangTop?: number;
  artOverhangBottom?: number;
  artOffsetY?: number;
}

interface BoardSkinCatalogModule {
  DEFAULT_BOARD_SKIN_ID?: string;
  DEFAULT_BOARD_FRAME_SKIN_ID?: string;
  normalizeBoardSkinId?: (value: string | null | undefined, rootRef: Window) => string;
  normalizeBoardFrameSkinId?: (value: string | null | undefined, rootRef: Window) => string;
  getBoardSkinDefinition?: (skinId: string, rootRef: Window) => BoardSkinDefinition | null;
  getBoardFrameSkinDefinition?: (skinId: string, rootRef: Window) => BoardSkinDefinition | null;
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

interface BoardSkinResourceDescriptor {
  readonly kind: 'board';
  readonly skinId: string;
  readonly imagePath: string;
  readonly sourceBlob: Blob | null;
  readonly contentFingerprint: string;
}

interface BoardFrameSkinResourceDescriptor {
  readonly kind: 'board-frame';
  readonly skinId: string;
  readonly imagePath: string;
  readonly layout: Readonly<BoardFrameSkinLayout>;
  readonly sourceBlob: Blob | null;
  readonly contentFingerprint: string;
}

interface ActiveDisplayLease {
  signature: string;
  lease: CustomSkinObjectUrlLease | null;
}

interface BoardDisplayLeaseState {
  board?: ActiveDisplayLease;
  frame?: ActiveDisplayLease;
}

const FALLBACK_BOARD_SKIN_ID = 'bluegreen-felt';
const FALLBACK_BOARD_FRAME_SKIN_ID = 'marsh-forged-iron';
const displayLeaseStates = new WeakMap<object, BoardDisplayLeaseState>();

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

function requireBoardSkinCatalogModuleOrNull(): BoardSkinCatalogModule | null {
  if (typeof _require !== 'function') return null;
  try {
    return _require('./catalog') ?? null;
  } catch (e) {
    /* ignore */
  }
  return null;
}

function resolveCatalogModule(rootRef: Window | null | undefined): BoardSkinCatalogModule | null {
  const ctx = resolveRootRef(rootRef);
  if (ctx && (ctx as Window & { BoardSkinCatalogModule?: BoardSkinCatalogModule }).BoardSkinCatalogModule) {
    return (ctx as Window & { BoardSkinCatalogModule?: BoardSkinCatalogModule }).BoardSkinCatalogModule ?? null;
  }
  try {
    if (typeof globalThis !== 'undefined' && (globalThis as unknown as Window & { BoardSkinCatalogModule?: BoardSkinCatalogModule }).BoardSkinCatalogModule) {
      return (globalThis as unknown as Window & { BoardSkinCatalogModule?: BoardSkinCatalogModule }).BoardSkinCatalogModule ?? null;
    }
  } catch (e) { /* ignore */ }
  return requireBoardSkinCatalogModuleOrNull();
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

function freezeFrameLayout(layout: BoardFrameSkinLayout | null | undefined): Readonly<BoardFrameSkinLayout> {
  const source = layout || {};
  const output: BoardFrameSkinLayout = {};
  const keys: Array<keyof BoardFrameSkinLayout> = [
    'paddingTop',
    'paddingRight',
    'paddingBottom',
    'paddingLeft',
    'artOverhangTop',
    'artOverhangBottom',
    'artOffsetY'
  ];
  keys.forEach((key) => {
    const value = Number(source[key]);
    if (Number.isFinite(value)) output[key] = value;
  });
  return Object.freeze(output);
}

function getCustomResource(
  rootRef: Window | null | undefined,
  skinId: string,
  kind: 'board' | 'board-frame'
): CustomSkinResourceDescriptor | null {
  const root = resolveRootRef(rootRef);
  const storage = resolveCustomSkinStorageModule(root);
  if (!root || !storage || typeof storage.getCustomSkinResourceDescriptor !== 'function') return null;
  try {
    const resource = storage.getCustomSkinResourceDescriptor(root, skinId);
    return resource && resource.kind === kind ? resource : null;
  } catch (e) {
    return null;
  }
}

function resolveBoardSkinResourceDescriptor(
  rootRef: Window | null | undefined,
  preferredSkinId: string | null | undefined
): BoardSkinResourceDescriptor | null {
  const catalog = resolveCatalogModule(rootRef);
  const fallbackId = String((catalog && catalog.DEFAULT_BOARD_SKIN_ID) || FALLBACK_BOARD_SKIN_ID).trim() || FALLBACK_BOARD_SKIN_ID;
  const skinId = catalog && typeof catalog.normalizeBoardSkinId === 'function'
    ? catalog.normalizeBoardSkinId(preferredSkinId, resolveRootRef(rootRef) as Window)
    : fallbackId;
  const definition = catalog && typeof catalog.getBoardSkinDefinition === 'function'
    ? catalog.getBoardSkinDefinition(skinId, resolveRootRef(rootRef) as Window)
    : null;
  if (!definition) return null;
  const custom = getCustomResource(rootRef, definition.id, 'board');
  const customImage = custom && custom.images.find((image) => image.role === 'board');
  const contentFingerprint = String(
    custom && custom.contentFingerprint
      || definition.contentFingerprint
      || fnv1a32Text(`${definition.id}|${definition.imagePath}`)
  );
  return Object.freeze({
    kind: 'board',
    skinId: definition.id,
    imagePath: String(definition.imagePath || ''),
    sourceBlob: customImage ? customImage.blob : null,
    contentFingerprint
  });
}

function resolveBoardFrameSkinResourceDescriptor(
  rootRef: Window | null | undefined,
  preferredSkinId: string | null | undefined
): BoardFrameSkinResourceDescriptor | null {
  const catalog = resolveCatalogModule(rootRef);
  const fallbackId = String((catalog && catalog.DEFAULT_BOARD_FRAME_SKIN_ID) || FALLBACK_BOARD_FRAME_SKIN_ID).trim() || FALLBACK_BOARD_FRAME_SKIN_ID;
  const skinId = catalog && typeof catalog.normalizeBoardFrameSkinId === 'function'
    ? catalog.normalizeBoardFrameSkinId(preferredSkinId, resolveRootRef(rootRef) as Window)
    : fallbackId;
  const definition = catalog && typeof catalog.getBoardFrameSkinDefinition === 'function'
    ? catalog.getBoardFrameSkinDefinition(skinId, resolveRootRef(rootRef) as Window)
    : null;
  if (!definition) return null;
  const layout = freezeFrameLayout(definition.layout);
  const custom = getCustomResource(rootRef, definition.id, 'board-frame');
  const customImage = custom && custom.images.find((image) => image.role === 'board-frame');
  const contentFingerprint = String(
    custom && custom.contentFingerprint
      || definition.contentFingerprint
      || fnv1a32Text(`${definition.id}|${definition.imagePath}|${JSON.stringify(layout)}`)
  );
  return Object.freeze({
    kind: 'board-frame',
    skinId: definition.id,
    imagePath: String(definition.imagePath || ''),
    layout,
    sourceBlob: customImage ? customImage.blob : null,
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
    || !storage.isCustomSkin(skinId)
    || typeof storage.acquireCustomSkinObjectUrlLease !== 'function') return null;
  try {
    return storage.acquireCustomSkinObjectUrlLease(root, skinId, urls);
  } catch (e) {
    return null;
  }
}

function swapDisplayLease(
  rootRef: Window | null | undefined,
  slot: keyof BoardDisplayLeaseState,
  signature: string,
  skinId: string,
  urls: readonly string[],
  apply: () => void
): void {
  const root = resolveRootRef(rootRef);
  if (!root || typeof root !== 'object') {
    apply();
    return;
  }
  const state = displayLeaseStates.get(root) || {};
  const previous = state[slot];
  if (previous && previous.signature === signature) {
    apply();
    return;
  }
  const nextLease = acquireDisplayLease(root, skinId, urls);
  try {
    apply();
  } catch (error) {
    if (nextLease) nextLease.release();
    throw error;
  }
  state[slot] = { signature, lease: nextLease };
  displayLeaseStates.set(root, state);
  if (previous && previous.lease) previous.lease.release();
}

function releaseAppliedBoardSkinLeases(rootRef: Window | null | undefined): void {
  const root = resolveRootRef(rootRef);
  if (!root || typeof root !== 'object') return;
  const state = displayLeaseStates.get(root);
  if (!state) return;
  if (state.board && state.board.lease) state.board.lease.release();
  if (state.frame && state.frame.lease) state.frame.lease.release();
  displayLeaseStates.delete(root);
}

function cssUrl(path: string): string {
  return 'url("' + String(path || '').replace(/"/g, '\\"') + '")';
}

function cssLayoutPx(value: unknown): string | null {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) return null;
  return `calc(${numericValue}px * var(--layout-stage-scale))`;
}

function applyBoardFrameLayoutVars(targetEl: HTMLElement | null | undefined, layout: BoardFrameSkinLayout | null | undefined): void {
  if (!targetEl || !targetEl.style) return;
  const entries: Array<[string, keyof BoardFrameSkinLayout]> = [
    ['--board-frame-padding-top', 'paddingTop'],
    ['--board-frame-padding-right', 'paddingRight'],
    ['--board-frame-padding-bottom', 'paddingBottom'],
    ['--board-frame-padding-left', 'paddingLeft'],
    ['--board-frame-art-overhang-top', 'artOverhangTop'],
    ['--board-frame-art-overhang-bottom', 'artOverhangBottom'],
    ['--board-frame-art-offset-y', 'artOffsetY']
  ];
  entries.forEach(([propertyName, fieldName]) => {
    const cssValue = layout ? cssLayoutPx(layout[fieldName]) : null;
    if (cssValue) targetEl.style.setProperty(propertyName, cssValue);
    else targetEl.style.removeProperty(propertyName);
  });
}

function applyBoardSkin(rootRef: Window | null | undefined, skinId: string): BoardSkinDefinition | null {
  const ctx = resolveRootRef(rootRef);
  const docRef = resolveDocument(ctx);
  const catalogModule = resolveCatalogModule(ctx);
  const definition = catalogModule && typeof catalogModule.getBoardSkinDefinition === 'function'
    ? catalogModule.getBoardSkinDefinition(skinId, ctx as Window)
    : null;
  if (!docRef || !definition || !docRef.documentElement) return null;
  const rootEl = docRef.documentElement;
  const boardEl = docRef.getElementById('board') as HTMLElement | null;
  swapDisplayLease(ctx, 'board', `${definition.id}|${definition.imagePath}`, definition.id, [definition.imagePath], () => {
    rootEl.setAttribute('data-board-skin-id', definition.id);
    rootEl.style.setProperty('--board-surface-texture-image', cssUrl(definition.imagePath));
    if (boardEl) {
      boardEl.setAttribute('data-board-skin-id', definition.id);
      boardEl.style.setProperty('--board-surface-texture-image', cssUrl(definition.imagePath));
    }
  });
  return definition;
}

function applyBoardFrameSkin(rootRef: Window | null | undefined, skinId: string): BoardSkinDefinition | null {
  const ctx = resolveRootRef(rootRef);
  const docRef = resolveDocument(ctx);
  const catalogModule = resolveCatalogModule(ctx);
  const definition = catalogModule && typeof catalogModule.getBoardFrameSkinDefinition === 'function'
    ? catalogModule.getBoardFrameSkinDefinition(skinId, ctx as Window)
    : null;
  if (!docRef || !definition || !docRef.documentElement) return null;
  const rootEl = docRef.documentElement;
  const frameEl = docRef.getElementById('board-frame') as HTMLElement | null;
  swapDisplayLease(ctx, 'frame', `${definition.id}|${definition.imagePath}`, definition.id, [definition.imagePath], () => {
    rootEl.setAttribute('data-board-frame-skin-id', definition.id);
    rootEl.style.setProperty('--board-frame-image', cssUrl(definition.imagePath));
    applyBoardFrameLayoutVars(rootEl as HTMLElement, definition.layout);
    if (frameEl) {
      frameEl.setAttribute('data-board-frame-skin-id', definition.id);
      frameEl.style.setProperty('--board-frame-image', cssUrl(definition.imagePath));
      applyBoardFrameLayoutVars(frameEl, definition.layout);
    }
  });
  return definition;
}

function syncDisplayedBoardSkin(rootRef: Window | null | undefined, preferredSkinId: string | null | undefined): BoardSkinDefinition | null {
  const catalogModule = resolveCatalogModule(rootRef);
  const fallbackId = String((catalogModule && catalogModule.DEFAULT_BOARD_SKIN_ID) || FALLBACK_BOARD_SKIN_ID).trim() || FALLBACK_BOARD_SKIN_ID;
  const normalized = catalogModule && typeof catalogModule.normalizeBoardSkinId === 'function'
    ? catalogModule.normalizeBoardSkinId(preferredSkinId, rootRef as Window)
    : fallbackId;
  return applyBoardSkin(rootRef, normalized);
}

function syncDisplayedBoardFrameSkin(rootRef: Window | null | undefined, preferredSkinId: string | null | undefined): BoardSkinDefinition | null {
  const catalogModule = resolveCatalogModule(rootRef);
  const fallbackId = String((catalogModule && catalogModule.DEFAULT_BOARD_FRAME_SKIN_ID) || FALLBACK_BOARD_FRAME_SKIN_ID).trim() || FALLBACK_BOARD_FRAME_SKIN_ID;
  const normalized = catalogModule && typeof catalogModule.normalizeBoardFrameSkinId === 'function'
    ? catalogModule.normalizeBoardFrameSkinId(preferredSkinId, rootRef as Window)
    : fallbackId;
  return applyBoardFrameSkin(rootRef, normalized);
}

export = {
  resolveRootRef,
  resolveDocument,
  applyBoardSkin,
  applyBoardFrameSkin,
  resolveBoardSkinResourceDescriptor,
  resolveBoardFrameSkinResourceDescriptor,
  releaseAppliedBoardSkinLeases,
  syncDisplayedBoardSkin,
  syncDisplayedBoardFrameSkin
};
