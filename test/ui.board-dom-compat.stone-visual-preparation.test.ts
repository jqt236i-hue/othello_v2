import { JSDOM } from 'jsdom';

type FakeImageControl = {
  instances: Array<{
    src: string;
    onload: null | (() => void);
    onerror: null | (() => void);
    decode: jest.Mock<Promise<void>, []>;
  }>;
  ImageCtor: new () => HTMLImageElement;
};

function createFakeImageControl(): FakeImageControl {
  const instances: FakeImageControl['instances'] = [];
  class FakeImage {
    private _src = '';
    onload: null | (() => void) = null;
    onerror: null | (() => void) = null;
    decode = jest.fn(async () => undefined);
    decoding = '';

    constructor() {
      instances.push(this);
    }

    set src(value: string) {
      this._src = value;
    }

    get src() {
      return this._src;
    }
  }
  return { instances, ImageCtor: FakeImage as unknown as new () => HTMLImageElement };
}

describe('DOM compatibility special-stone preparation', () => {
  afterEach(() => {
    jest.resetModules();
  });

  test('shares concurrent work per Document and caches only successful load/decode', async () => {
    const dom = new JSDOM('<!doctype html>', { url: 'https://example.test/game/' });
    const control = createFakeImageControl();
    const preparation = require('../ui/board-dom-compat/stone-visual-preparation');
    const options = {
      effectKeys: ['ultimateDragon'],
      ImageCtor: control.ImageCtor,
      timeoutMs: 1000
    };

    const first = preparation.prepareDomCompatibilityStoneVisuals(dom.window.document, options);
    const concurrent = preparation.prepareDomCompatibilityStoneVisuals(dom.window.document, options);
    expect(control.instances).toHaveLength(2);
    expect(control.instances.map((image) => image.src)).toEqual([
      'https://example.test/game/assets/images/special-stones/ultimate_reverse_dragon-black.png',
      'https://example.test/game/assets/images/special-stones/ultimate_reverse_dragon-white.png'
    ]);
    control.instances.forEach((image) => image.onload?.());

    await expect(first).resolves.toMatchObject({ success: true, loaded: expect.any(Array), failed: [] });
    await expect(concurrent).resolves.toMatchObject({ success: true, loaded: expect.any(Array), failed: [] });
    await preparation.prepareDomCompatibilityStoneVisuals(dom.window.document, options);
    expect(control.instances).toHaveLength(2);
    expect(control.instances.every((image) => image.decode.mock.calls.length === 1)).toBe(true);
    dom.window.close();
  });

  test('reports failures and retries the failed path on the next request', async () => {
    const dom = new JSDOM('<!doctype html>', { url: 'https://example.test/' });
    const control = createFakeImageControl();
    const preparation = require('../ui/board-dom-compat/stone-visual-preparation');
    const options = {
      effectKeys: ['ultimateDragon'],
      ImageCtor: control.ImageCtor,
      timeoutMs: 1000
    };

    const first = preparation.prepareDomCompatibilityStoneVisuals(dom.window.document, options);
    control.instances[0].onload?.();
    control.instances[1].onerror?.();
    await expect(first).resolves.toMatchObject({
      success: false,
      loaded: ['https://example.test/assets/images/special-stones/ultimate_reverse_dragon-black.png'],
      failed: [{
        src: 'https://example.test/assets/images/special-stones/ultimate_reverse_dragon-white.png',
        reason: 'load failed'
      }]
    });

    const retry = preparation.prepareDomCompatibilityStoneVisuals(dom.window.document, options);
    expect(control.instances).toHaveLength(3);
    control.instances[2].onload?.();
    await expect(retry).resolves.toMatchObject({ success: true, failed: [] });
    dom.window.close();
  });

  test('keeps caches isolated across Documents', async () => {
    const left = new JSDOM('<!doctype html>', { url: 'https://left.test/' });
    const right = new JSDOM('<!doctype html>', { url: 'https://right.test/' });
    const control = createFakeImageControl();
    const preparation = require('../ui/board-dom-compat/stone-visual-preparation');
    const options = {
      effectKeys: ['rainbowStone'],
      ImageCtor: control.ImageCtor,
      timeoutMs: 1000
    };

    const leftResult = preparation.prepareDomCompatibilityStoneVisuals(left.window.document, options);
    const rightResult = preparation.prepareDomCompatibilityStoneVisuals(right.window.document, options);
    expect(control.instances).toHaveLength(2);
    control.instances.forEach((image) => image.onload?.());
    await Promise.all([leftResult, rightResult]);
    expect(control.instances.map((image) => image.src)).toEqual([
      'https://left.test/assets/images/special-stones/rainbow_stone.png',
      'https://right.test/assets/images/special-stones/rainbow_stone.png'
    ]);
    left.window.close();
    right.window.close();
  });
});
