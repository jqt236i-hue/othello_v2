import { JSDOM } from 'jsdom';

const surfaces = ['bluegreen-felt', 'study-forest-baize', 'study-jade-slate', 'study-olive-leather'];

describe('board skin render invalidation', () => {
  let dom: JSDOM;
  let scheduler: any;
  let api: any;
  let frames: any[];
  let rafCallbacks: FrameRequestCallback[];

  function flushFrame() {
    const callback = rafCallbacks.shift();
    expect(callback).toBeDefined();
    callback!(0);
  }

  beforeEach(() => {
    jest.resetModules();
    dom = new JSDOM('<!doctype html><html><body><div id="board-frame"><div id="board"></div></div><div id="boardSkinOptions"></div><div id="boardFrameSkinOptions"></div></body></html>', {
      url: 'https://example.test/'
    });
    global.window = dom.window as any;
    global.document = dom.window.document as any;
    frames = [];
    rafCallbacks = [];
    const presenter = require('../ui/board-visual/frame-presenter.ts');
    scheduler = require('../ui/render-scheduler.ts').createRenderScheduler({
      requestAnimationFrame: (callback: FrameRequestCallback) => {
        rafCallbacks.push(callback);
        return rafCallbacks.length;
      },
      renderBoard: () => frames.push(presenter.resolveBoardAppearanceDescriptor(document.getElementById('board')))
    });
    (window as any).RenderScheduler = scheduler;
    api = require('../ui/board-skin/controller.ts').setupBoardSkinControls({ root: window });
    flushFrame();
    frames.length = 0;
  });

  afterEach(() => {
    dom.window.close();
    delete (global as any).window;
    delete (global as any).document;
  });

  test.each(surfaces)('clicking %s submits its appearance without closing SKIN, resizing or moving a stone', (id) => {
    (document.querySelector(`.board-skin-option[data-board-skin-id="${id}"]`) as HTMLButtonElement).click();
    expect(scheduler.getState().boardQueued).toBe(true);
    expect(frames).toHaveLength(0);
    flushFrame();
    expect(frames).toHaveLength(1);
    expect(frames[0].boardSkinId).toBe(id);
    expect(frames[0].boardImageUrl).toBe(
      require('../ui/board-skin/catalog.ts').getBoardSkinDefinition(id, window).imagePath
    );
  });

  test('preview use requests a render without persisting the selection', () => {
    api.useSkin('study-olive-leather');
    flushFrame();
    expect(frames[0].boardSkinId).toBe('study-olive-leather');
    expect(window.localStorage.getItem('reversi.boardSkin')).toBeNull();
  });

  test('rapid surface switches coalesce into a single render of the latest selection', () => {
    api.selectSkin('study-forest-baize');
    api.selectSkin('study-jade-slate');
    api.selectSkin('study-olive-leather');
    expect(rafCallbacks).toHaveLength(1);
    flushFrame();
    expect(frames).toHaveLength(1);
    expect(frames[0].boardSkinId).toBe('study-olive-leather');
  });

  test('frame-only changes also request an appearance render', () => {
    api.selectFrameSkin('study-ebony-jade');
    flushFrame();
    expect(frames).toHaveLength(1);
    expect(frames[0].boardFrameSkinId).toBe('study-ebony-jade');
  });
});
