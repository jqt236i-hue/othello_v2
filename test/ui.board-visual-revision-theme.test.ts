import { JSDOM } from 'jsdom';

const FramePresenter = require('../ui/board-visual/frame-presenter');
const Theme = require('../ui/board-visual/theme');

function makeRawFrame(overrides: Record<string, any> = {}) {
  const topology = {
    baseRows: 8,
    baseCols: 8,
    minRow: 0,
    maxRow: 7,
    minCol: 0,
    maxCol: 7,
    renderRowOffset: 0,
    renderColOffset: 0,
    renderRows: 8,
    renderCols: 8,
    existingKeys: [],
    playableKeys: [],
    holeKeys: []
  };
  const model = {
    visualRevision: 0,
    topology,
    cells: [],
    keyboardCursorKey: null,
    viewerContext: 'black',
    currentPlayer: 'black',
    canControlCurrentTurn: true,
    isHumanTurn: true,
    ...(overrides.model || {})
  };
  const layout = {
    revision: 0,
    cellSize: 64,
    dpr: 1,
    orientation: 'normal',
    frameInset: { top: 0, right: 0, bottom: 0, left: 0 },
    clientOrigin: { x: 10, y: 20 },
    visualViewport: { scale: 1, offsetLeft: 0, offsetTop: 0 },
    camera: { scrollLeft: 0, scrollTop: 0, viewportWidth: 512, viewportHeight: 512 },
    logicalWidth: 512,
    logicalHeight: 512,
    visibleWorldWindow: { minRow: 0, maxRow: 7, minCol: 0, maxCol: 7 },
    ...(overrides.layout || {})
  };
  const appearance = {
    boardSkinId: 'default-board',
    boardImageUrl: 'https://example.test/board.png',
    boardFrameSkinId: 'default-frame',
    boardFrameLayout: {},
    stoneSkinId: 'default-stone',
    blackStoneImageUrl: 'https://example.test/black.png',
    whiteStoneImageUrl: 'https://example.test/white.png',
    revision: 0,
    ...(overrides.appearance || {})
  };
  return {
    frameToken: overrides.frameToken || 'idle:1',
    renderSessionId: overrides.renderSessionId || 'match:default',
    model,
    layout,
    appearance,
    theme: overrides.theme || Theme.createBoardVisualThemeDescriptor(),
    ...overrides,
    // Channel overrides above are merged instead of replacing their base DTO.
    model,
    layout,
    appearance
  };
}

function revisions(frame: any) {
  return {
    model: frame.model.visualRevision,
    layout: frame.layout.revision,
    appearance: frame.appearance.revision,
    theme: frame.theme.revision
  };
}

describe('board visual independent revision contract', () => {
  test('same content remains stable even when frame settlement identity changes', () => {
    const composer = FramePresenter.createBoardVisualFrameRevisionComposer();
    const first = composer.compose(makeRawFrame({ frameToken: 'idle:1' }));
    const clone = JSON.parse(JSON.stringify(makeRawFrame({ frameToken: 'idle:2' })));
    clone.model.visualRevision = 101;
    clone.layout.revision = 102;
    clone.appearance.revision = 103;
    clone.theme.revision = 104;
    clone.renderSessionId = 'match:next';
    const second = composer.compose(clone);

    expect(revisions(first)).toEqual({ model: 1, layout: 1, appearance: 1, theme: 1 });
    expect(revisions(second)).toEqual(revisions(first));
    expect(second.frameToken).toBe('idle:2');
    expect(first.renderSessionId).toBe('match:default');
    expect(second.renderSessionId).toBe('match:next');
  });

  test.each([
    {
      name: 'model state',
      override: { model: { keyboardCursorKey: '3,4' } },
      changed: 'model'
    },
    {
      name: 'scroll/layout',
      override: {
        layout: { camera: { scrollLeft: 32, scrollTop: 0, viewportWidth: 512, viewportHeight: 512 } }
      },
      changed: 'layout'
    },
    {
      name: 'skin/appearance',
      override: {
        appearance: {
          stoneSkinId: 'jade',
          blackStoneImageUrl: 'https://example.test/jade-black.png',
          whiteStoneImageUrl: 'https://example.test/jade-white.png'
        }
      },
      changed: 'appearance'
    },
    {
      name: 'theme token',
      override: { theme: Theme.createBoardVisualThemeDescriptor({ surfaceColor: '#123456' }) },
      changed: 'theme'
    }
  ])('advances only the $name revision', ({ override, changed }) => {
    const composer = FramePresenter.createBoardVisualFrameRevisionComposer();
    const first = composer.compose(makeRawFrame());
    const second = composer.compose(makeRawFrame({ ...override, frameToken: 'idle:2' }));
    const expected = { ...revisions(first), [changed]: 2 };
    expect(revisions(second)).toEqual(expected);
  });
});

describe('board visual semantic theme descriptor', () => {
  let dom: JSDOM;

  beforeEach(() => {
    dom = new JSDOM('<!doctype html><html><body><div id="board"></div></body></html>');
  });

  afterEach(() => dom.window.close());

  test('provides immutable bonus/timer/direction/hint styles including double-digit and shadow/glow data', () => {
    const theme = Theme.createBoardVisualThemeDescriptor();

    expect(theme.boardBonus.doubleDigitScale).toBeLessThan(1);
    expect(theme.timer.doubleDigitScale).toBeLessThan(1);
    expect(theme.directionHint.fontWeight).toBe(700);
    expect(theme.legalHint.lineWidthRatio).toBeGreaterThan(0);
    expect(theme.contourMetalColor).toBe(Theme.DEFAULT_BOARD_VISUAL_THEME.contourMetalColor);
    expect(theme.contourShadowColor).toBe(Theme.DEFAULT_BOARD_VISUAL_THEME.contourShadowColor);
    expect(theme.boardBonus.shadows.length).toBeGreaterThan(0);
    expect(theme.boardBonus.glow).toMatchObject({ color: expect.any(String), blurRatio: expect.any(Number) });
    expect(Object.isFrozen(theme)).toBe(true);
    expect(Object.isFrozen(theme.boardBonus)).toBe(true);
    expect(Object.isFrozen(theme.boardBonus.shadows)).toBe(true);
    expect(Object.isFrozen(theme.boardBonus.shadows[0])).toBe(true);
    expect(Object.isFrozen(theme.legalHint)).toBe(true);
  });

  test('rejects unsafe colors, fonts, and out-of-range numeric style values', () => {
    expect(() => Theme.createBoardVisualThemeDescriptor({ surfaceColor: 'url(javascript:bad)' }))
      .toThrow(/surfaceColor/);
    expect(() => Theme.createBoardVisualThemeDescriptor({ contourShadowColor: 'url(javascript:bad)' }))
      .toThrow(/contourShadowColor/);
    expect(() => Theme.createBoardVisualThemeDescriptor({ fontFamily: 'var(--unresolved-font)' }))
      .toThrow(/fontFamily/);
    expect(() => Theme.createBoardVisualThemeDescriptor({ timer: { doubleDigitScale: 1.2 } }))
      .toThrow(/doubleDigitScale/);
    expect(() => Theme.createBoardVisualThemeDescriptor({ directionHint: { fontWeight: Number.NaN } }))
      .toThrow(/fontWeight/);
  });

  test('font selection, semantic token, and fonts-ready changes advance only theme revision', () => {
    const host = dom.window.document.getElementById('board') as HTMLElement;
    const composer = FramePresenter.createBoardVisualFrameRevisionComposer();
    const first = composer.compose(makeRawFrame({
      theme: Theme.resolveBoardVisualThemeDescriptor(host),
      frameToken: 'idle:1'
    }));

    host.style.setProperty('--board-surface-base-color', '#123456');
    const tokenChanged = composer.compose(makeRawFrame({
      theme: Theme.resolveBoardVisualThemeDescriptor(host),
      frameToken: 'idle:2'
    }));
    expect(revisions(tokenChanged)).toEqual({ ...revisions(first), theme: 2 });

    host.style.setProperty('--board-bonus-number-font-family', 'serif');
    const fontChanged = composer.compose(makeRawFrame({
      theme: Theme.resolveBoardVisualThemeDescriptor(host),
      frameToken: 'idle:3'
    }));
    expect(revisions(fontChanged)).toEqual({ ...revisions(first), theme: 3 });
    expect(fontChanged.theme.boardBonus.fontFamily).toBe('serif');

    Theme.markBoardVisualThemeFontsReady(host);
    const readyChanged = composer.compose(makeRawFrame({
      theme: Theme.resolveBoardVisualThemeDescriptor(host),
      frameToken: 'idle:4'
    }));
    expect(revisions(readyChanged)).toEqual({ ...revisions(first), theme: 4 });
    expect(readyChanged.theme.fontReadyEpoch).toBe(1);
  });

  test('document.fonts.ready advances the font epoch once for a loading cycle', async () => {
    const host = dom.window.document.getElementById('board') as HTMLElement;
    let settleReady!: () => void;
    const ready = new Promise<void>((resolve) => { settleReady = resolve; });
    Object.defineProperty(dom.window.document, 'fonts', {
      configurable: true,
      value: { ready }
    });

    const before = Theme.resolveBoardVisualThemeDescriptor(host);
    expect(before.fontReadyEpoch).toBe(0);

    settleReady();
    await ready;
    await Promise.resolve();

    const after = Theme.resolveBoardVisualThemeDescriptor(host);
    expect(after.fontReadyEpoch).toBe(1);
    await Promise.resolve();
    expect(Theme.resolveBoardVisualThemeDescriptor(host).fontReadyEpoch).toBe(1);
  });

  test('font-ready observer deduplicates callbacks across cycles and can be disposed for reinitialization', async () => {
    const host = dom.window.document.getElementById('board') as HTMLElement;
    const callback = jest.fn();
    let settleFirst!: () => void;
    const firstReady = new Promise<void>((resolve) => { settleFirst = resolve; });
    const fontSet = { ready: firstReady };
    Object.defineProperty(dom.window.document, 'fonts', {
      configurable: true,
      value: fontSet
    });
    const disposeFirst = Theme.observeBoardVisualThemeFonts(host, callback);
    const disposeDuplicate = Theme.observeBoardVisualThemeFonts(host, callback);

    settleFirst();
    await firstReady;
    await Promise.resolve();
    expect(callback).toHaveBeenCalledTimes(1);

    let settleSecond!: () => void;
    const secondReady = new Promise<void>((resolve) => { settleSecond = resolve; });
    fontSet.ready = secondReady;
    Theme.observeBoardVisualThemeFonts(host);
    settleSecond();
    await secondReady;
    await Promise.resolve();
    expect(callback).toHaveBeenCalledTimes(2);

    disposeFirst();
    disposeDuplicate();
    let settleAfterDispose!: () => void;
    const afterDisposeReady = new Promise<void>((resolve) => { settleAfterDispose = resolve; });
    fontSet.ready = afterDisposeReady;
    Theme.observeBoardVisualThemeFonts(host);
    settleAfterDispose();
    await afterDisposeReady;
    await Promise.resolve();
    expect(callback).toHaveBeenCalledTimes(2);
  });

  test('falls back to validated defaults instead of exposing unresolved CSS tokens to a backend', () => {
    const host = dom.window.document.getElementById('board') as HTMLElement;
    host.style.setProperty('--board-surface-base-color', 'url(javascript:bad)');
    host.style.setProperty('--board-bonus-number-font-family', 'var(--missing-font)');
    host.style.setProperty('--board-grid-line-width', '999');

    const theme = Theme.resolveBoardVisualThemeDescriptor(host);

    expect(theme.surfaceColor).toBe(Theme.DEFAULT_BOARD_VISUAL_THEME.surfaceColor);
    expect(theme.contourMetalColor).toBe(Theme.DEFAULT_BOARD_VISUAL_THEME.contourMetalColor);
    expect(theme.contourShadowColor).toBe(Theme.DEFAULT_BOARD_VISUAL_THEME.contourShadowColor);
    expect(theme.fontFamily).toBe(Theme.DEFAULT_BOARD_VISUAL_THEME.fontFamily);
    expect(theme.gridLineWidth).toBe(Theme.DEFAULT_BOARD_VISUAL_THEME.gridLineWidth);
  });
});
