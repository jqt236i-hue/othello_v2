import { JSDOM } from 'jsdom';

describe('UIBootstrap initial board frame preparation', () => {
  afterEach(() => {
    jest.dontMock('../ui/board-skin/selection');
    jest.dontMock('../ui/board-skin/runtime');
    delete (global as any).window;
    delete (global as any).document;
  });

  test('reads the stored frame and delegates preparation to BoardSkinRuntime', async () => {
    jest.resetModules();
    const dom = new JSDOM('<!doctype html><html><body></body></html>', {
      url: 'https://example.test/'
    });
    (global as any).window = dom.window;
    (global as any).document = dom.window.document;
    const readStoredBoardFrameSkinId = jest.fn(() => 'submerged-wood');
    const prepareBoardFrameSkin = jest.fn(async () => ({ id: 'submerged-wood' }));
    jest.doMock('../ui/board-skin/selection', () => ({
      readStoredBoardFrameSkinId
    }));
    jest.doMock('../ui/board-skin/runtime', () => ({
      prepareBoardFrameSkin
    }));
    const bootstrap = require('../ui/bootstrap.ts');

    await expect(bootstrap.prepareInitialBoardFrameSkin(dom.window))
      .resolves.toEqual({ id: 'submerged-wood' });
    expect(readStoredBoardFrameSkinId).toHaveBeenCalledWith(dom.window);
    expect(prepareBoardFrameSkin).toHaveBeenCalledWith(dom.window, 'submerged-wood');
    dom.window.close();
  });
});
