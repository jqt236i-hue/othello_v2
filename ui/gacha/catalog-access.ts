'use strict';

declare const __non_webpack_require__: NodeRequire | undefined;

const _require: NodeRequire = (typeof __non_webpack_require__ !== 'undefined')
  ? __non_webpack_require__
  : require;

interface CatalogItem {
  id: string;
  label?: string;
  kind?: string;
  [key: string]: any;
}

interface Catalog {
  version: number;
  generatedAt: string;
  sourceDir: string;
  items: CatalogItem[];
}

interface AssetManifest {
  files: any[];
  generatedAt?: string;
  version?: string;
  [key: string]: any;
}

function resolveObservationCatalogModule(): any {
  try {
    return _require('../../shared/observation-gacha-catalog.generated.js');
  } catch (e) { /* ignore */ }
  try {
    if (typeof globalThis !== 'undefined' && (globalThis as any).ObservationGachaCatalogModule) {
      return (globalThis as any).ObservationGachaCatalogModule;
    }
  } catch (e) { /* ignore */ }
  return null;
}

function resolveObservationCatalogSharedModule(): any {
  try {
    return _require('../../shared/observation-gacha-catalog-shared.js');
  } catch (e) { /* ignore */ }
  try {
    if (typeof globalThis !== 'undefined' && (globalThis as any).ObservationGachaCatalogSharedModule) {
      return (globalThis as any).ObservationGachaCatalogSharedModule;
    }
  } catch (e) { /* ignore */ }
  return null;
}

function resolveUIBootstrapModule(): any {
  try {
    return _require('../bootstrap.js');
  } catch (e) { /* ignore */ }
  try {
    if (typeof globalThis !== 'undefined' && (globalThis as any).UIBootstrap) return (globalThis as any).UIBootstrap;
  } catch (e) { /* ignore */ }
  return null;
}

function readLoadedAssetManifest(rootRef: any, options?: any): AssetManifest | null {
  const opts = (options && typeof options === 'object') ? options : {};
  if (opts.assetManifest && typeof opts.assetManifest === 'object') {
    return opts.assetManifest;
  }

  const uiBootstrap = opts.uiBootstrap || resolveUIBootstrapModule();
  if (uiBootstrap && typeof uiBootstrap.getLoadedAssetManifest === 'function') {
    try {
      const manifest = uiBootstrap.getLoadedAssetManifest();
      if (manifest && typeof manifest === 'object' && Array.isArray(manifest.files)) {
        return manifest;
      }
    } catch (e) { /* ignore */ }
  }

  const ctx = opts.root || rootRef || (typeof window !== 'undefined' ? window : null);
  if (ctx && ctx.UIBootstrap && typeof ctx.UIBootstrap.getLoadedAssetManifest === 'function') {
    try {
      const manifest = ctx.UIBootstrap.getLoadedAssetManifest();
      if (manifest && typeof manifest === 'object' && Array.isArray(manifest.files)) {
        return manifest;
      }
    } catch (e) { /* ignore */ }
  }

  return null;
}

function getObservationCatalog(options?: any): Catalog {
  const opts = (options && typeof options === 'object') ? options : {};
  if (opts.catalog && typeof opts.catalog === 'object' && Array.isArray(opts.catalog.items)) {
    return opts.catalog;
  }

  const sharedModule = opts.catalogSharedModule || resolveObservationCatalogSharedModule();
  const manifest = readLoadedAssetManifest(opts.root, opts);
  if (manifest && sharedModule && typeof sharedModule.buildCatalogFromAssetManifest === 'function') {
    const manifestCatalog = sharedModule.buildCatalogFromAssetManifest(manifest, {
      generatedAt: manifest.generatedAt || manifest.version || null
    });
    if (Array.isArray(manifestCatalog && manifestCatalog.items) && manifestCatalog.items.length) {
      return manifestCatalog;
    }
  }

  const generatedModule = opts.catalogModule || resolveObservationCatalogModule();
  if (generatedModule && Array.isArray(generatedModule.items)) {
    return generatedModule;
  }

  return {
    version: 1,
    generatedAt: '',
    sourceDir: '',
    items: []
  };
}

function getObservationCatalogItems(options?: any): CatalogItem[] {
  const catalog = getObservationCatalog(options);
  return Array.isArray(catalog && catalog.items) ? catalog.items.filter(Boolean) : [];
}

function getObservationCatalogItemsByKind(kind: string, options?: any): CatalogItem[] {
  const opts = (options && typeof options === 'object') ? options : {};
  const sharedModule = opts.catalogSharedModule || resolveObservationCatalogSharedModule();
  const items = getObservationCatalogItems(opts);
  if (!sharedModule || typeof sharedModule.filterCatalogItemsByKind !== 'function') {
    return items;
  }
  return sharedModule.filterCatalogItemsByKind(items, kind);
}

const CatalogAccess = {
  readLoadedAssetManifest,
  getObservationCatalog,
  getObservationCatalogItems,
  getObservationCatalogItemsByKind
};

export = CatalogAccess;
