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
  rootEl.setAttribute('data-board-skin-id', definition.id);
  rootEl.style.setProperty('--board-surface-texture-image', cssUrl(definition.imagePath));
  if (boardEl) {
    boardEl.setAttribute('data-board-skin-id', definition.id);
    boardEl.style.setProperty('--board-surface-texture-image', cssUrl(definition.imagePath));
  }
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
  rootEl.setAttribute('data-board-frame-skin-id', definition.id);
  rootEl.style.setProperty('--board-frame-image', cssUrl(definition.imagePath));
  applyBoardFrameLayoutVars(rootEl as HTMLElement, definition.layout);
  if (frameEl) {
    frameEl.setAttribute('data-board-frame-skin-id', definition.id);
    frameEl.style.setProperty('--board-frame-image', cssUrl(definition.imagePath));
    applyBoardFrameLayoutVars(frameEl, definition.layout);
  }
  return definition;
}

function syncDisplayedBoardSkin(rootRef: Window | null | undefined, preferredSkinId: string | null | undefined): BoardSkinDefinition | null {
  const catalogModule = resolveCatalogModule(rootRef);
  const fallbackId = String((catalogModule && catalogModule.DEFAULT_BOARD_SKIN_ID) || 'woven-felt').trim() || 'woven-felt';
  const normalized = catalogModule && typeof catalogModule.normalizeBoardSkinId === 'function'
    ? catalogModule.normalizeBoardSkinId(preferredSkinId, rootRef as Window)
    : fallbackId;
  return applyBoardSkin(rootRef, normalized);
}

function syncDisplayedBoardFrameSkin(rootRef: Window | null | undefined, preferredSkinId: string | null | undefined): BoardSkinDefinition | null {
  const catalogModule = resolveCatalogModule(rootRef);
  const fallbackId = String((catalogModule && catalogModule.DEFAULT_BOARD_FRAME_SKIN_ID) || 'black-gold-lacquer').trim() || 'black-gold-lacquer';
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
  syncDisplayedBoardSkin,
  syncDisplayedBoardFrameSkin
};
