/** Applies only the hand mat image token; hand layout and board are untouched. */
declare const __non_webpack_require__: NodeRequire | undefined;
const _require: NodeRequire = typeof __non_webpack_require__ !== 'undefined' ? __non_webpack_require__ : require;
type CatalogModule = typeof import('./catalog');
type HandMatSkinDefinition = ReturnType<CatalogModule['getHandMatSkinDefinition']>;

function resolveCatalogModule(rootRef: any): CatalogModule | null {
  if (rootRef && rootRef.HandMatSkinCatalogModule) return rootRef.HandMatSkinCatalogModule;
  try {
    if (typeof globalThis !== 'undefined' && (globalThis as any).HandMatSkinCatalogModule) {
      return (globalThis as any).HandMatSkinCatalogModule;
    }
  } catch (e) { /* ignore */ }
  try { return _require('./catalog'); } catch (e) { return null; }
}

function syncDisplayedHandMatSkin(rootRef: any, skinId: unknown): HandMatSkinDefinition | null {
  const ctx = rootRef || (typeof globalThis !== 'undefined' ? globalThis : null);
  const docRef: Document | null = (ctx && ctx.document) || (typeof document !== 'undefined' ? document : null);
  const catalog = resolveCatalogModule(ctx);
  if (!docRef || !docRef.documentElement || !catalog) return null;
  const definition = catalog.getHandMatSkinDefinition(skinId, ctx);
  if (!definition) return null;
  docRef.documentElement.style.setProperty('--hand-mat-image', 'url("' + definition.imagePath + '")');
  docRef.documentElement.setAttribute('data-hand-mat-skin-id', definition.id);
  return definition;
}

export = { syncDisplayedHandMatSkin };
