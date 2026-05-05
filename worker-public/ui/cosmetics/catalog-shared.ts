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

function normalizeCatalogItemId(value: any): string {
  return String(value || '').trim();
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

function collectGeneratedItems(rootRef: any, kind: string): CatalogItem[] {
  const catalogModule = resolveObservationGachaCatalogModule(rootRef);
  const catalog = catalogModule && typeof catalogModule.getCatalog === 'function'
    ? catalogModule.getCatalog()
    : catalogModule;
  const items = Array.isArray(catalog && catalog.items) ? catalog.items : [];
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
    const normalized = normalizeCatalogItemId(itemId) || defaultId;
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
      return storage[listOwnedMethodName](rootRef).map(normalizeCatalogItemId).filter(Boolean);
    }
    return [defaultId];
  }

  function isOwned(rootRef: any, itemId: string): boolean {
    const normalized = normalizeCatalogItemId(itemId);
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
    const normalized = normalizeCatalogItemId(value) || defaultId;
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
