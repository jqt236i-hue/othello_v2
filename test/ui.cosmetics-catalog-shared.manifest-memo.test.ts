import { JSDOM } from 'jsdom';

describe('cosmetics catalog shared: manifest catalog memo', () => {
  let dom: JSDOM;

  beforeEach(() => {
    jest.resetModules();
    dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'https://example.test/' });
    (global as any).window = dom.window;
  });

  afterEach(() => {
    try { dom.window.close(); } catch (e) { /* cleanup guard */ }
    delete (global as any).window;
  });

  function makeManifest(files: string[]): any {
    return { version: 'v1', generatedAt: '2026-09-25T00:00:00.000Z', files };
  }

  function makeRoot(manifest: any, buildCatalog: jest.Mock): any {
    return {
      UIBootstrap: { getLoadedAssetManifest: () => manifest },
      ObservationGachaCatalogSharedModule: { buildCatalogFromAssetManifest: buildCatalog },
      ObservationGachaCatalogModule: { getCatalog: () => ({ items: [] }) },
      GachaProgressStorage: { listOwnedHandSkinIds: () => [], isHandSkinOwned: () => false }
    };
  }

  test('rebuilds the manifest catalog once per manifest object and returns equal, independent items', () => {
    const buildCatalog = jest.fn((manifest: any) => ({
      version: 1,
      generatedAt: manifest.generatedAt,
      sourceDir: 'x',
      items: [{ id: 'skin-a', kind: 'hand-skin', label: 'A', note: '', imagePath: 'assets/a.png' }]
    }));
    const manifest = makeManifest(['assets/a.png']);
    const root = makeRoot(manifest, buildCatalog);
    const shared = require('../ui/cosmetics/catalog-shared.ts');
    const api = shared.createOwnedCosmeticCatalogApi({
      kind: 'hand-skin',
      baseItems: [{ id: 'default', label: '既定', note: '', imagePath: 'assets/default.png' }],
      defaultId: 'default',
      listOwnedMethodName: 'listOwnedHandSkinIds',
      isOwnedMethodName: 'isHandSkinOwned'
    });

    const first = api.getAllItems(root);
    const second = api.getAllItems(root);
    api.getDefinition('skin-a', root, { allowUnowned: true });
    api.normalizeSelectedId('skin-a', root, { allowUnowned: true });

    expect(buildCatalog).toHaveBeenCalledTimes(1);
    expect(first).toEqual(second);
    expect(first).not.toBe(second);
    expect(first[1]).not.toBe(second[1]);
    expect(first.map((item: any) => item.id)).toEqual(['default', 'skin-a']);

    // A replaced manifest object (refresh / custom skin registration) is scanned again.
    const nextManifest = makeManifest(['assets/a.png', 'assets/b.png']);
    root.UIBootstrap.getLoadedAssetManifest = () => nextManifest;
    api.getAllItems(root);
    expect(buildCatalog).toHaveBeenCalledTimes(2);
    expect(buildCatalog.mock.calls[1][0]).toBe(nextManifest);

    // A different shared module implementation is not served from the memo either.
    const otherBuild = jest.fn(() => ({ version: 1, generatedAt: null, sourceDir: 'x', items: [] }));
    root.ObservationGachaCatalogSharedModule = { buildCatalogFromAssetManifest: otherBuild };
    api.getAllItems(root);
    expect(otherBuild).toHaveBeenCalledTimes(1);
  });
});
