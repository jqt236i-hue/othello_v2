import { JSDOM } from 'jsdom';
import { loadOptionalFeatureRegistry } from '../browser-vite/features/feature-registry';

describe('Vite optional feature registry adapter', () => {
  test('loads the exact group registry, restores once, and validates required modules', async () => {
    const dom = new JSDOM('<!doctype html><html><head><script src="../public/module-registry.js?v=123"></script></head><body></body></html>', {
      url: 'https://example.test/vite-dist/index.vite.html'
    });
    const root: any = dom.window;
    const restored: string[] = [];
    const required: string[] = [];
    const loaded: Array<{ src: string; group: string }> = [];
    root.__restoreCardReversiOptionalBootEntries = (group: string) => restored.push(group);
    root.require = (moduleKey: string) => {
      required.push(moduleKey);
      return { moduleKey };
    };

    await loadOptionalFeatureRegistry('gacha', {
      root,
      document: root.document,
      loadScript: async (src, group) => { loaded.push({ src, group }); }
    }, ['ui/gacha/gacha-overlay-controller']);

    expect(loaded).toEqual([{
      src: 'public/module-registry.optional.gacha.js?v=123',
      group: 'gacha'
    }]);
    expect(restored).toEqual(['gacha']);
    expect(required).toEqual(['ui/gacha/gacha-overlay-controller']);
  });
});
