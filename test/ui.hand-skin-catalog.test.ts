import { JSDOM } from 'jsdom';

describe('hand skin catalog', () => {
  let dom: JSDOM;

  beforeEach(() => {
    jest.resetModules();
    dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'https://example.test/' });
    (global as any).window = dom.window;
  });

  afterEach(() => {
    try {
      if (dom && dom.window && typeof dom.window.close === 'function') dom.window.close();
    } catch (e) { /* Intentionally empty: test cleanup guard */ }
    delete (global as any).window;
  });

  test('labels the startup hand skin as the default appearance item', () => {
    const catalog = require('../ui/hand-skin/catalog.ts');

    expect(catalog.DEFAULT_HAND_SKIN_ID).toBe('default');
    expect(catalog.getHandSkinDefinition('default', window)).toEqual(expect.objectContaining({
      id: 'default',
      label: '既定',
      note: '初期所持',
      imagePath: 'assets/images/hand-skin/勇者の手.png'
    }));
  });
});
