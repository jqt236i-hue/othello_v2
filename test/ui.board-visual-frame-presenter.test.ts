import { JSDOM } from 'jsdom';

const FramePresenter = require('../ui/board-visual/frame-presenter');
const Theme = require('../ui/board-visual/theme');

describe('board visual frame descriptor and presenter', () => {
  let dom: JSDOM;

  beforeEach(() => {
    dom = new JSDOM(`<!doctype html><html><body>
      <div id="game-container"><div id="board-frame"><div id="board"></div></div></div>
    </body></html>`, { url: 'https://example.test/' });
  });

  afterEach(() => dom.window.close());

  test('resolves selected board/frame/stone definitions into one immutable appearance snapshot', () => {
    const doc = dom.window.document;
    const root = doc.documentElement;
    const host = doc.getElementById('board') as HTMLElement;
    root.dataset.boardSkinId = 'emerald-stone';
    root.dataset.boardFrameSkinId = 'swamp-ruin-stone';
    root.dataset.stoneSkinId = 'jade-rim';

    const appearance = FramePresenter.resolveBoardAppearanceDescriptor(host, 7);

    expect(appearance).toMatchObject({
      boardSkinId: 'emerald-stone',
      boardImageUrl: 'assets/images/board/board-surface-emerald-v1.png',
      boardFrameSkinId: 'swamp-ruin-stone',
      stoneSkinId: 'jade-rim',
      blackStoneImageUrl: 'assets/images/stone-skin/jade-rim/black.png',
      whiteStoneImageUrl: 'assets/images/stone-skin/jade-rim/white.png',
      revision: 7
    });
    expect(appearance.boardFrameLayout).toMatchObject({ paddingTop: 17, paddingLeft: 22 });
    expect(Object.isFrozen(appearance)).toBe(true);
    expect(Object.isFrozen(appearance.boardFrameLayout)).toBe(true);
  });

  test('applies frame skin/layout, sparse/oversize classes, and theme from the same frame snapshot', () => {
    const doc = dom.window.document;
    const host = doc.getElementById('board') as HTMLElement;
    host.style.setProperty('--board-surface-base-color', '#123456');
    host.style.setProperty('--board-legal-ring-color', '#abcdef');
    host.style.setProperty('--board-bonus-number-color', '#fedcba');
    host.style.setProperty('--board-bonus-number-font-family', 'serif');
    const appearance = FramePresenter.resolveBoardAppearanceDescriptor(host, 3);
    const theme = Theme.resolveBoardVisualThemeDescriptor(host, 3);
    const topology = {
      baseRows: 8, baseCols: 8,
      minRow: 0, maxRow: 7, minCol: 0, maxCol: 8,
      renderRowOffset: 0, renderColOffset: 0,
      renderRows: 8, renderCols: 9,
      existingKeys: [], playableKeys: [], holeKeys: []
    };
    const frame = {
      frameToken: 'idle:3',
      model: { visualRevision: 3, topology, cells: [], keyboardCursorKey: null, viewerContext: 'black' },
      layout: {}, appearance, theme
    };

    FramePresenter.presentBoardFrame(host, frame);

    expect(theme).toMatchObject({ surfaceColor: '#123456', hintColor: '#abcdef', markerColor: '#fedcba', fontFamily: 'serif' });
    expect(host.dataset.boardSkinId).toBe(appearance.boardSkinId);
    expect(doc.getElementById('board-frame')?.dataset.boardFrameSkinId).toBe(appearance.boardFrameSkinId);
    expect(doc.body.classList.contains('board-oversize-active')).toBe(true);
    expect(doc.getElementById('game-container')?.classList.contains('board-oversize-active')).toBe(true);
    expect(host.classList.contains('board-has-void-cells')).toBe(true);
  });
});
