import { JSDOM } from 'jsdom';

describe('UIBootstrap initial board frame preparation', () => {
  afterEach(() => {
    jest.dontMock('../ui/board-skin/selection');
    jest.dontMock('../ui/board-skin/runtime');
    delete (global as any).window;
    delete (global as any).document;
  });

  test('restores the stored surface before preparing the frame without opening SKIN', async () => {
    jest.resetModules();
    const dom = new JSDOM('<!doctype html><html><body></body></html>', {
      url: 'https://example.test/'
    });
    (global as any).window = dom.window;
    (global as any).document = dom.window.document;
    const calls: string[] = [];
    const readStoredBoardFrameSkinId = jest.fn(() => 'study-grimoire-leather');
    const readStoredBoardSkinId = jest.fn(() => 'study-olive-leather');
    const syncDisplayedBoardSkin = jest.fn(() => { calls.push('surface'); });
    const prepareBoardFrameSkin = jest.fn(async () => {
      calls.push('frame');
      return { id: 'study-grimoire-leather' };
    });
    jest.doMock('../ui/board-skin/selection', () => ({
      readStoredBoardFrameSkinId,
      readStoredBoardSkinId
    }));
    jest.doMock('../ui/board-skin/runtime', () => ({
      prepareBoardFrameSkin,
      syncDisplayedBoardSkin
    }));
    const bootstrap = require('../ui/bootstrap.ts');

    await expect(bootstrap.prepareInitialBoardFrameSkin(dom.window))
      .resolves.toEqual({ id: 'study-grimoire-leather' });
    expect(readStoredBoardSkinId).toHaveBeenCalledWith(dom.window);
    expect(syncDisplayedBoardSkin).toHaveBeenCalledWith(dom.window, 'study-olive-leather');
    expect(readStoredBoardFrameSkinId).toHaveBeenCalledWith(dom.window);
    expect(prepareBoardFrameSkin).toHaveBeenCalledWith(dom.window, 'study-grimoire-leather');
    expect(calls).toEqual(['surface', 'frame']);
    dom.window.close();
  });

  test.each(['forest-baize', 'jade-slate', 'olive-leather'])(
    'restores study surface %s through the real startup runtime', async (name) => {
      jest.resetModules();
      const dom = new JSDOM('<!doctype html><html><body><div id="board-frame"></div><div id="board"></div></body></html>', {
        url: 'https://example.test/'
      });
      (global as any).window = dom.window;
      (global as any).document = dom.window.document;
      dom.window.localStorage.setItem('reversi.boardSkin', `study-${name}`);
      dom.window.localStorage.setItem('reversi.boardFrameSkin', 'study-ebony-jade');
      const bootstrap = require('../ui/bootstrap.ts');
      await bootstrap.prepareInitialBoardFrameSkin(dom.window);
      expect(dom.window.document.documentElement.dataset.boardSkinId).toBe(`study-${name}`);
      expect(dom.window.document.getElementById('board')!.style.getPropertyValue('--board-surface-texture-image'))
        .toBe(`url("assets/images/board/board-surface-study-${name}-v1.webp")`);
      expect(dom.window.document.documentElement.dataset.boardFrameSkinId).toBe('study-ebony-jade');
      expect(dom.window.document.querySelector('#boardSkinOptions')).toBeNull();
      dom.window.close();
    }
  );
});
