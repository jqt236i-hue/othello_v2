'use strict';

declare const __non_webpack_require__: NodeRequire | undefined;

const _require: NodeRequire = (typeof __non_webpack_require__ !== 'undefined')
  ? __non_webpack_require__
  : require;

function resolveRootRef(rootRef: any): any {
  if (rootRef && typeof rootRef === 'object') return rootRef;
  try {
    if (typeof globalThis !== 'undefined' && globalThis) return globalThis;
  } catch (e) { /* ignore */ }
  return null;
}

function resolveGachaProgressStorage(rootRef: any): any {
  const ctx = resolveRootRef(rootRef);
  if (ctx && ctx.GachaProgressStorage) return ctx.GachaProgressStorage;
  if (ctx && ctx.GachaProgressStorageModule) return ctx.GachaProgressStorageModule;
  try {
    if (typeof globalThis !== 'undefined') {
      return (globalThis as any).GachaProgressStorage || (globalThis as any).GachaProgressStorageModule || null;
    }
  } catch (e) { /* ignore */ }
  try {
    return _require('../storage/gacha-progress.js');
  } catch (e) { /* ignore */ }
  return null;
}

function resolveObservationGachaCatalogModule(rootRef: any): any {
  const ctx = resolveRootRef(rootRef);
  if (ctx && ctx.ObservationGachaCatalogModule) return ctx.ObservationGachaCatalogModule;
  try {
    if (typeof globalThis !== 'undefined' && (globalThis as any).ObservationGachaCatalogModule) {
      return (globalThis as any).ObservationGachaCatalogModule;
    }
  } catch (e) { /* ignore */ }
  try {
    return _require('../../shared/observation-gacha-catalog.generated.js');
  } catch (e) { /* ignore */ }
  return null;
}

function resolveObservationGachaCatalogSharedModule(rootRef: any): any {
  const ctx = resolveRootRef(rootRef);
  if (ctx && ctx.ObservationGachaCatalogSharedModule) return ctx.ObservationGachaCatalogSharedModule;
  try {
    if (typeof globalThis !== 'undefined' && (globalThis as any).ObservationGachaCatalogSharedModule) {
      return (globalThis as any).ObservationGachaCatalogSharedModule;
    }
  } catch (e) { /* ignore */ }
  try {
    return _require('../../shared/observation-gacha-catalog-shared.js');
  } catch (e) { /* ignore */ }
  return null;
}

function readLoadedAssetManifest(rootRef: any): any {
  const ctx = resolveRootRef(rootRef);
  const candidates = [
    ctx && ctx.UIBootstrap,
    ctx && ctx.SharedUIBootstrap,
    (typeof globalThis !== 'undefined' && (globalThis as any).UIBootstrap) ? (globalThis as any).UIBootstrap : null,
    (typeof globalThis !== 'undefined' && (globalThis as any).SharedUIBootstrap) ? (globalThis as any).SharedUIBootstrap : null
  ];
  for (const candidate of candidates) {
    try {
      if (candidate && typeof candidate.getLoadedAssetManifest === 'function') {
        const manifest = candidate.getLoadedAssetManifest();
        if (manifest && typeof manifest === 'object' && Array.isArray(manifest.files)) return manifest;
      }
    } catch (e) { /* ignore */ }
  }
  return null;
}

function normalizeCatalogItemId(value: any): string {
  return String(value || '').trim();
}

function normalizeKnownCatalogItemId(value: any, rootRef: any): string {
  const normalized = normalizeCatalogItemId(value);
  if (!normalized) return '';
  const sharedModule = resolveObservationGachaCatalogSharedModule(rootRef);
  if (sharedModule && typeof sharedModule.normalizeCatalogItemId === 'function') {
    const canonical = normalizeCatalogItemId(sharedModule.normalizeCatalogItemId(normalized));
    if (canonical) return canonical;
  }
  const catalogModule = resolveObservationGachaCatalogModule(rootRef);
  if (catalogModule && typeof catalogModule.normalizeCatalogItemId === 'function') {
    const canonical = normalizeCatalogItemId(catalogModule.normalizeCatalogItemId(normalized));
    if (canonical) return canonical;
  }
  return normalized;
}

interface CatalogItem {
  id: string;
  label: string;
  note: string;
  imagePath: string;
  previewImagePath?: string;
  assetPath?: string;
  cssBackground?: string;
  cssClass?: string;
  [key: string]: any;
}

function cloneItem(item: any): CatalogItem | null {
  if (!item || typeof item !== 'object') return null;
  const id = normalizeCatalogItemId(item.id);
  if (!id) return null;
  const imagePath = String(item.imagePath || item.previewImagePath || item.assetPath || '').trim();
  const out: CatalogItem = {
    id,
    label: String(item.label || id).trim() || id,
    note: String(item.note || '').trim(),
    imagePath
  };
  if (item.previewImagePath !== undefined) out.previewImagePath = String(item.previewImagePath || imagePath).trim();
  if (item.assetPath !== undefined) out.assetPath = String(item.assetPath || imagePath).trim();
  if (item.cssBackground !== undefined) out.cssBackground = String(item.cssBackground || '').trim();
  if (item.cssClass !== undefined) out.cssClass = String(item.cssClass || '').trim();
  return out;
}

// The loaded asset manifest is replaced as a whole object when it changes (never mutated in
// place), so the catalog derived from it can be reused by manifest identity. Every catalog read
// (hand-skin sync, status refresh, hand animation context) previously rescanned all manifest
// files; the derived items are still cloned per read below, so callers see the same values.
const manifestCatalogMemo = new WeakMap<object, { sharedModule: any; catalog: any }>();

function buildManifestCatalog(sharedModule: any, manifest: any): any {
  if (!manifest || typeof manifest !== 'object' || !sharedModule || typeof sharedModule.buildCatalogFromAssetManifest !== 'function') {
    return null;
  }
  const cached = manifestCatalogMemo.get(manifest);
  if (cached && cached.sharedModule === sharedModule) return cached.catalog;
  const catalog = sharedModule.buildCatalogFromAssetManifest(manifest, {
    generatedAt: manifest.generatedAt || manifest.version || null
  });
  manifestCatalogMemo.set(manifest, { sharedModule, catalog });
  return catalog;
}

function collectGeneratedItems(rootRef: any, kind: string): CatalogItem[] {
  const sharedModule = resolveObservationGachaCatalogSharedModule(rootRef);
  const manifest = readLoadedAssetManifest(rootRef);
  const manifestCatalog = buildManifestCatalog(sharedModule, manifest);
  const manifestItems = Array.isArray(manifestCatalog && manifestCatalog.items) ? manifestCatalog.items : [];
  const catalogModule = resolveObservationGachaCatalogModule(rootRef);
  const catalog = catalogModule && typeof catalogModule.getCatalog === 'function'
    ? catalogModule.getCatalog()
    : catalogModule;
  const generatedItems = Array.isArray(catalog && catalog.items) ? catalog.items : [];
  const items = generatedItems.concat(manifestItems);
  return items
    .filter((item: any) => item && item.kind === kind)
    .map(cloneItem)
    .filter((item: any): item is CatalogItem => item !== null);
}

function dedupeItems(items: any[]): CatalogItem[] {
  const byId = new Map<string, CatalogItem>();
  (Array.isArray(items) ? items : []).forEach((item: any) => {
    const cloned = cloneItem(item);
    if (!cloned) return;
    if (!byId.has(cloned.id)) byId.set(cloned.id, cloned);
  });
  return Array.from(byId.values());
}

interface CosmeticCatalogApi {
  ALL_ITEMS: CatalogItem[];
  DEFAULT_ID: string;
  normalizeCatalogItemId: (value: any) => string;
  getAllItems: (rootRef: any) => CatalogItem[];
  listOwnedIds: (rootRef: any) => string[];
  isOwned: (rootRef: any, itemId: string) => boolean;
  getOwnedItems: (rootRef: any) => CatalogItem[];
  normalizeSelectedId: (value: any, rootRef: any, optionsArg?: any) => string;
  getDefinition: (itemId: string, rootRef: any, optionsArg?: any) => CatalogItem | null;
}

function createOwnedCosmeticCatalogApi(options?: any): CosmeticCatalogApi {
  const opts = (options && typeof options === 'object') ? options : {};
  const kind = String(opts.kind || '').trim();
  const defaultId = normalizeCatalogItemId(opts.defaultId) || 'default';
  const baseItems = dedupeItems(opts.baseItems || []);
  const listOwnedMethodName = String(opts.listOwnedMethodName || '').trim();
  const isOwnedMethodName = String(opts.isOwnedMethodName || '').trim();

  function getAllItems(rootRef: any): CatalogItem[] {
    return dedupeItems(baseItems.concat(collectGeneratedItems(rootRef, kind)));
  }

  function getDefinition(itemId: string, rootRef: any, optionsArg?: any): CatalogItem | null {
    const normalized = normalizeKnownCatalogItemId(itemId, rootRef) || defaultId;
    const allowUnowned = !!(optionsArg && optionsArg.allowUnowned);
    const items = getAllItems(rootRef);
    const found = items.find((item) => item.id === normalized) || items.find((item) => item.id === defaultId) || items[0] || null;
    if (!found) return null;
    if (allowUnowned || isOwned(rootRef, found.id) || found.id === defaultId) return { ...found };
    const fallback = items.find((item) => item.id === defaultId) || items[0];
    return fallback ? { ...fallback } : null;
  }

  function listOwnedIds(rootRef: any): string[] {
    const storage = resolveGachaProgressStorage(rootRef);
    if (storage && listOwnedMethodName && typeof storage[listOwnedMethodName] === 'function') {
      return storage[listOwnedMethodName](rootRef).map((itemId: any) => normalizeKnownCatalogItemId(itemId, rootRef)).filter(Boolean);
    }
    return [defaultId];
  }

  function isOwned(rootRef: any, itemId: string): boolean {
    const normalized = normalizeKnownCatalogItemId(itemId, rootRef);
    if (!normalized) return false;
    if (normalized === defaultId) return true;
    const storage = resolveGachaProgressStorage(rootRef);
    if (storage && isOwnedMethodName && typeof storage[isOwnedMethodName] === 'function') {
      return !!storage[isOwnedMethodName](rootRef, normalized);
    }
    return listOwnedIds(rootRef).includes(normalized);
  }

  function getOwnedItems(rootRef: any): CatalogItem[] {
    const owned = new Set(listOwnedIds(rootRef));
    owned.add(defaultId);
    return getAllItems(rootRef).filter((item) => owned.has(item.id));
  }

  function normalizeSelectedId(value: any, rootRef: any, optionsArg?: any): string {
    const normalized = normalizeKnownCatalogItemId(value, rootRef) || defaultId;
    const allowUnowned = !!(optionsArg && optionsArg.allowUnowned);
    const definition = getAllItems(rootRef).find((item) => item.id === normalized);
    if (definition && (allowUnowned || isOwned(rootRef, normalized))) return normalized;
    return defaultId;
  }

  return {
    ALL_ITEMS: baseItems.slice(),
    DEFAULT_ID: defaultId,
    normalizeCatalogItemId,
    getAllItems,
    listOwnedIds,
    isOwned,
    getOwnedItems,
    normalizeSelectedId,
    getDefinition
  };
}

const CosmeticCatalogShared = {
  createOwnedCosmeticCatalogApi,
  normalizeCatalogItemId
};

export = CosmeticCatalogShared;
