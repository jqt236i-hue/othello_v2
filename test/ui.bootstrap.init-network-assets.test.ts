describe('initial asset manifest loading', () => {
  afterEach(() => {
    jest.resetModules();
  });

  test('publishes the manifest without eagerly preloading every image', async () => {
    const initNetwork = require('../ui/bootstrap/init-network.js');
    const manifest = {
      version: 'test',
      files: [
        { path: 'assets/images/background/unused.png', sha256: 'unused' },
        { path: 'assets/images/stone-skin/default/black.png', sha256: 'black' }
      ]
    };
    const fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue(manifest)
    });
    const uiBootstrap = {
      setLoadedAssetManifest: jest.fn(),
      preloadAssets: jest.fn()
    };
    const root = {
      fetch,
      location: { protocol: 'https:', origin: 'https://example.test' }
    };

    await expect(initNetwork.loadAssetManifestForBoot(root, uiBootstrap)).resolves.toEqual({
      status: 'ok',
      manifest
    });
    expect(fetch).toHaveBeenCalledWith('assets/asset-manifest.json', { cache: 'no-cache' });
    expect(uiBootstrap.setLoadedAssetManifest).toHaveBeenCalledWith(manifest, { root, dispatch: true });
    expect(uiBootstrap.preloadAssets).not.toHaveBeenCalled();
  });

  test('does not publish an invalid manifest', async () => {
    const initNetwork = require('../ui/bootstrap/init-network.js');
    const setLoadedAssetManifest = jest.fn();
    const root = {
      fetch: jest.fn().mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({ version: 'invalid' })
      }),
      location: { protocol: 'https:', origin: 'https://example.test' }
    };

    await expect(initNetwork.loadAssetManifestForBoot(root, { setLoadedAssetManifest }))
      .resolves.toEqual({ status: 'error', reason: 'invalid-manifest' });
    expect(setLoadedAssetManifest).not.toHaveBeenCalled();
  });
});
