/**
 * @file runtime.ts
 * @description Font skin runtime application
 */

declare const __non_webpack_require__: NodeRequire | undefined;

const _require: NodeRequire = (typeof __non_webpack_require__ !== 'undefined')
  ? __non_webpack_require__
  : require;

interface FontSkinDefinition {
  id: string;
  fontFamily: string;
  accentFontFamily?: string;
  readableFontFamily?: string;
}

interface FontSkinCatalogModule {
  DEFAULT_FONT_SKIN_ID?: string;
  normalizeFontSkinId?: (value: string | null | undefined, rootRef: Window) => string;
  getFontSkinDefinition?: (skinId: string, rootRef: Window) => FontSkinDefinition | null;
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

function requireFontSkinCatalogModuleOrNull(): FontSkinCatalogModule | null {
  if (typeof _require !== 'function') return null;
  try {
    return _require('./catalog') ?? null;
  } catch (e) {
    /* ignore */
  }
  return null;
}

function resolveCatalogModule(rootRef: Window | null | undefined): FontSkinCatalogModule | null {
  const ctx = resolveRootRef(rootRef);
  if (ctx && (ctx as Window & { FontSkinCatalogModule?: FontSkinCatalogModule }).FontSkinCatalogModule) {
    return (ctx as Window & { FontSkinCatalogModule?: FontSkinCatalogModule }).FontSkinCatalogModule ?? null;
  }
  try {
    if (typeof globalThis !== 'undefined' && (globalThis as unknown as Window & { FontSkinCatalogModule?: FontSkinCatalogModule }).FontSkinCatalogModule) {
      return (globalThis as unknown as Window & { FontSkinCatalogModule?: FontSkinCatalogModule }).FontSkinCatalogModule ?? null;
    }
  } catch (e) { /* ignore */ }
  return requireFontSkinCatalogModuleOrNull();
}

function applyFontSkin(rootRef: Window | null | undefined, skinId: string): FontSkinDefinition | null {
  const ctx = resolveRootRef(rootRef);
  const docRef = resolveDocument(ctx);
  const catalogModule = resolveCatalogModule(ctx);
  const definition = catalogModule && typeof catalogModule.getFontSkinDefinition === 'function'
    ? catalogModule.getFontSkinDefinition(skinId, ctx as Window)
    : null;
  if (!docRef || !definition) return null;
  const body = docRef.body;
  const rootEl = docRef.documentElement;
  const accentFontFamily = String(definition.accentFontFamily || definition.fontFamily || '').trim();
  const fontFamily = String(definition.fontFamily || '').trim();
  const readableFontFamily = String(definition.readableFontFamily || accentFontFamily || fontFamily || '').trim();
  const targets = [rootEl, body].filter(Boolean) as HTMLElement[];

  targets.forEach((target) => {
    target.setAttribute('data-font-skin-id', definition.id);
    if (fontFamily) {
      target.style.setProperty('--selected-app-font-family', fontFamily);
    } else {
      target.style.removeProperty('--selected-app-font-family');
    }
    if (accentFontFamily) {
      target.style.setProperty('--selected-app-font-accent-family', accentFontFamily);
    } else {
      target.style.removeProperty('--selected-app-font-accent-family');
    }
    if (readableFontFamily) {
      target.style.setProperty('--selected-app-font-readable-family', readableFontFamily);
    } else {
      target.style.removeProperty('--selected-app-font-readable-family');
    }
  });

  const fitCardName = ctx && typeof (ctx as Window & { fitCardNameElement?: (nameEl: Element) => void }).fitCardNameElement === 'function'
    ? (ctx as Window & { fitCardNameElement?: (nameEl: Element) => void }).fitCardNameElement
    : null;
  if (fitCardName && docRef) {
    Array.from(docRef.querySelectorAll('.card-name')).forEach((nameEl) => {
      try {
        fitCardName(nameEl);
      } catch (e) {
        /* ignore */
      }
    });
  }

  return definition;
}

function syncDisplayedFontSkin(rootRef: Window | null | undefined, preferredSkinId: string | null | undefined): FontSkinDefinition | null {
  const catalogModule = resolveCatalogModule(rootRef);
  const fallbackId = String((catalogModule && catalogModule.DEFAULT_FONT_SKIN_ID) || 'shippori-mincho').trim() || 'shippori-mincho';
  const normalized = catalogModule && typeof catalogModule.normalizeFontSkinId === 'function'
    ? catalogModule.normalizeFontSkinId(preferredSkinId, rootRef as Window)
    : fallbackId;
  return applyFontSkin(rootRef, normalized);
}

export = {
  resolveRootRef,
  resolveDocument,
  applyFontSkin,
  syncDisplayedFontSkin
};
