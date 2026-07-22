import { JSDOM } from 'jsdom';

const FramePresenter = require('../ui/board-visual/frame-presenter');
const Theme = require('../ui/board-visual/theme');

function rectangleKeys(rows: number, cols: number): string[] {
  const keys: string[] = [];
  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) keys.push(`${row},${col}`);
  }
  return keys;
}

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

  test('keeps the image-frame policy for a complete 8x8 base with sparse expansion render bounds', () => {
    const doc = dom.window.document;
    const host = doc.getElementById('board') as HTMLElement;
    host.style.setProperty('--board-surface-base-color', '#123456');
    host.style.setProperty('--board-legal-ring-color', '#abcdef');
    host.style.setProperty('--board-bonus-number-color', '#fedcba');
    host.style.setProperty('--board-bonus-number-font-family', 'serif');
    const appearance = FramePresenter.resolveBoardAppearanceDescriptor(host, 3);
    const theme = Theme.resolveBoardVisualThemeDescriptor(host, 3);
    const baseKeys = rectangleKeys(8, 8);
    const topology = {
      baseRows: 8, baseCols: 8,
      minRow: -1, maxRow: 7, minCol: 0, maxCol: 7,
      renderRowOffset: 1, renderColOffset: 0,
      renderRows: 9, renderCols: 8,
      baseKeys,
      existingKeys: [...baseKeys, '-1,0'],
      playableKeys: [...baseKeys, '-1,0'],
      holeKeys: []
    };
    const frame = {
      frameToken: 'idle:3',
      model: { visualRevision: 3, topology, cells: [], keyboardCursorKey: null, viewerContext: 'black' },
      layout: {}, appearance, theme
    };

    const boardFrame = doc.getElementById('board-frame') as HTMLElement;
    boardFrame.classList.add('board-has-void-cells');
    FramePresenter.presentBoardFrame(host, frame);

    expect(theme).toMatchObject({ surfaceColor: '#123456', hintColor: '#abcdef', markerColor: '#fedcba', fontFamily: 'serif' });
    expect(host.dataset.boardSkinId).toBe(appearance.boardSkinId);
    expect(boardFrame.dataset.boardFrameSkinId).toBe(appearance.boardFrameSkinId);
    expect(doc.body.classList.contains('board-oversize-active')).toBe(true);
    expect(doc.getElementById('game-container')?.classList.contains('board-oversize-active')).toBe(true);
    expect(host.classList.contains('board-has-void-cells')).toBe(true);
    expect(boardFrame.classList.contains('board-has-void-cells')).toBe(false);
    expect(boardFrame.classList.contains('board-has-base-void-cells')).toBe(false);
  });

  test('disables the image-frame policy only when the initial board mask has voids', () => {
    const doc = dom.window.document;
    const host = doc.getElementById('board') as HTMLElement;
    const boardFrame = doc.getElementById('board-frame') as HTMLElement;
    const appearance = FramePresenter.resolveBoardAppearanceDescriptor(host, 1);
    const theme = Theme.resolveBoardVisualThemeDescriptor(host, 1);
    const baseKeys = ['0,1', '1,0', '1,1', '1,2', '2,1'];
    const topology = {
      baseRows: 3, baseCols: 3,
      minRow: 0, maxRow: 2, minCol: 0, maxCol: 2,
      renderRowOffset: 0, renderColOffset: 0,
      renderRows: 3, renderCols: 3,
      baseKeys,
      existingKeys: baseKeys,
      playableKeys: baseKeys,
      holeKeys: []
    };
    const frame = {
      frameToken: 'idle:1',
      model: { visualRevision: 1, topology, cells: [], keyboardCursorKey: null, viewerContext: 'black' },
      layout: {}, appearance, theme
    };

    FramePresenter.presentBoardFrame(host, frame);

    expect(host.classList.contains('board-has-void-cells')).toBe(true);
    expect(boardFrame.classList.contains('board-has-base-void-cells')).toBe(true);
  });
});
