describe('UI bootstrap asset manifest runtime', () => {
  const originalFetch = global.fetch;
  const originalImage = global.Image;

  afterEach(() => {
    jest.resetModules();
    global.fetch = originalFetch;
    global.Image = originalImage;
    try { delete global.window; } catch (e) { /* Intentionally empty: test cleanup guard */ }
  });

  function loadBootstrap() {
    return require('../ui/bootstrap.js');
  }

  function installFailingImage() {
    global.Image = function() {
      this.onload = null;
      this.onerror = null;
      Object.defineProperty(this, 'src', {
        set(_value) {
          setTimeout(() => {
            if (typeof this.onerror === 'function') this.onerror();
          }, 0);
        }
      });
    };
  }

  test('refreshLoadedAssetManifest reports unavailable when fetch is missing', async () => {
    global.fetch = undefined;
    const bootstrap = loadBootstrap();

    await expect(bootstrap.refreshLoadedAssetManifest({ root: {} })).resolves.toEqual({
      status: 'unavailable',
      reason: 'fetch-unavailable'
    });
  });

  test('refreshLoadedAssetManifest skips file origins', async () => {
    const fetch = jest.fn();
    const bootstrap = loadBootstrap();

    await expect(bootstrap.refreshLoadedAssetManifest({
      root: {
        fetch,
        location: { protocol: 'file:', origin: 'null' }
      }
    })).resolves.toEqual({
      status: 'skipped',
      reason: 'file-origin'
    });
    expect(fetch).not.toHaveBeenCalled();
  });

  test('refreshLoadedAssetManifest revalidates the cached manifest instead of bypassing the cache', async () => {
    const bootstrap = loadBootstrap();
    const fetch = jest.fn().mockResolvedValue({ ok: false, status: 304 });

    await bootstrap.refreshLoadedAssetManifest({
      root: { fetch, location: { protocol: 'https:', origin: 'https://example.test' } }
    });
    expect(fetch).toHaveBeenCalledWith('assets/asset-manifest.json', { cache: 'no-cache' });
  });

  test('refreshLoadedAssetManifest reports non-ok fetch failures with status code', async () => {
    const bootstrap = loadBootstrap();

    await expect(bootstrap.refreshLoadedAssetManifest({
      root: {
        fetch: jest.fn().mockResolvedValue({ ok: false, status: 503 }),
        location: { protocol: 'https:', origin: 'https://example.test' }
      }
    })).resolves.toEqual({
      status: 'error',
      reason: 'fetch-failed',
      code: 503
    });
  });

  test('refreshLoadedAssetManifest rejects invalid manifest shape', async () => {
    const bootstrap = loadBootstrap();

    await expect(bootstrap.refreshLoadedAssetManifest({
      root: {
        fetch: jest.fn().mockResolvedValue({ ok: true, json: jest.fn().mockResolvedValue({ version: 'x' }) }),
        location: { protocol: 'https:', origin: 'https://example.test' }
      }
    })).resolves.toEqual({
      status: 'error',
      reason: 'invalid-manifest'
    });
  });

  test('refreshLoadedAssetManifest stores valid manifest and dispatches an update event', async () => {
    const bootstrap = loadBootstrap();
    const manifest = { version: 'x', files: [] };
    const root = {
      fetch: jest.fn().mockResolvedValue({ ok: true, json: jest.fn().mockResolvedValue(manifest) }),
      location: { protocol: 'https:', origin: 'https://example.test' },
      dispatchEvent: jest.fn()
    };

    await expect(bootstrap.refreshLoadedAssetManifest({ root })).resolves.toEqual({
      status: 'ok',
      manifest
    });
    expect(bootstrap.getLoadedAssetManifest()).toBe(manifest);
    expect(root.dispatchEvent).toHaveBeenCalledTimes(1);
  });

  test('applyAssetManifest returns error in strict mode when preload fails', async () => {
    installFailingImage();
    const bootstrap = loadBootstrap();
    const manifest = { version: 'x', files: [{ path: 'assets/images/stones/missing.png' }] };

    const out = await bootstrap.applyAssetManifest(manifest, { mode: 'strict' }, { timeoutMs: 10 });

    expect(out.status).toBe('error');
  });

  test('applyAssetManifest returns fallback in compat mode when preload fails', async () => {
    installFailingImage();
    const bootstrap = loadBootstrap();
    const manifest = { version: 'x', files: [{ path: 'assets/images/stones/missing.png' }] };

    const out = await bootstrap.applyAssetManifest(manifest, { mode: 'compat' }, { timeoutMs: 10 });

    expect(out.status).toBe('fallback');
  });
});
