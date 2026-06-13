export type AssetManifestRuntimeDeps = {
  preloadAssets: (manifest: any, opts: any) => Promise<any>;
  isAssetManifestShape: (manifest: any) => boolean;
  dispatchAssetManifestUpdated: (manifest: any, opts: any) => any;
};

export function createAssetManifestRuntime(deps: AssetManifestRuntimeDeps) {
  let loadedAssetManifest: any = null;

  function setLoadedAssetManifest(manifest: any, options: any = {}) {
    loadedAssetManifest = deps.isAssetManifestShape(manifest) ? manifest : null;
    if (options.dispatch === false) return loadedAssetManifest;

    try { deps.dispatchAssetManifestUpdated(loadedAssetManifest, options); } catch (e: any) { /* ignore */ }
    return loadedAssetManifest;
  }

  function getLoadedAssetManifest() {
    return loadedAssetManifest;
  }

  async function refreshLoadedAssetManifest(opts: any = {}) {
    try {
      const fetchFn = (opts.root && typeof opts.root.fetch === 'function')
        ? opts.root.fetch.bind(opts.root)
        : (typeof fetch === 'function' ? fetch : null);
      if (typeof fetchFn !== 'function') {
        return { status: 'unavailable', reason: 'fetch-unavailable' };
      }
      try {
        const locationRef = (opts.root && opts.root.location)
          || (typeof location !== 'undefined' ? location : null);
        if (locationRef && (locationRef.protocol === 'file:' || locationRef.origin === 'null')) {
          return { status: 'skipped', reason: 'file-origin' };
        }
      } catch (e: any) { /* ignore */ }

      const manifestUrl = String(opts.manifestUrl || 'assets/asset-manifest.json').trim() || 'assets/asset-manifest.json';
      const response = await fetchFn(manifestUrl, { cache: 'no-store' });
      if (!response || response.ok !== true) {
        return {
          status: 'error',
          reason: 'fetch-failed',
          code: response && Number.isFinite(Number(response.status)) ? Number(response.status) : null
        };
      }
      const manifest = await response.json();
      if (!deps.isAssetManifestShape(manifest)) {
        return { status: 'error', reason: 'invalid-manifest' };
      }
      setLoadedAssetManifest(manifest, {
        root: opts.root,
        dispatch: opts.dispatch !== false
      });
      return { status: 'ok', manifest };
    } catch (e: any) {
      return { status: 'error', reason: String(e) };
    }
  }

  async function applyAssetManifest(manifest: any, policy: any = { mode: 'compat' }, opts: any = {}) {
    if (!manifest || !manifest.files) return { status: 'error', details: 'invalid manifest' };
    setLoadedAssetManifest(manifest, { root: opts.root, dispatch: true });
    try {
      const res = await deps.preloadAssets(manifest, opts || {});
      if (res.success) {
        return { status: 'ok', details: res };
      }
      if (policy && policy.mode === 'strict') {
        return { status: 'error', details: res };
      }
      try {
        if (typeof console !== 'undefined' && console.warn) {
          console.warn('[ASSET_MANIFEST] preload incomplete, using fallback', res.failed);
        }
      } catch (e: any) { /* Intentionally empty: console guard */ }
      return { status: 'fallback', details: res };
    } catch (e: any) {
      return { status: 'error', details: String(e) };
    }
  }

  async function handleGameInit(payload: any, opts: any = { assetPolicy: { mode: 'compat' } }) {
    if (!payload) return { status: 'no_payload' };
    if (payload.assetManifest) {
      const res = await applyAssetManifest(payload.assetManifest, opts.assetPolicy || { mode: 'compat' }, opts);
      try { if (typeof window !== 'undefined') window.__assetManifestStatus = res; } catch (e: any) { /* Intentionally empty: window assignment guard */ }
      return { status: 'asset_manifest_handled', result: res };
    }
    return { status: 'no_asset_manifest' };
  }

  return {
    setLoadedAssetManifest,
    getLoadedAssetManifest,
    refreshLoadedAssetManifest,
    applyAssetManifest,
    handleGameInit
  };
}

module.exports = {
  createAssetManifestRuntime
};
