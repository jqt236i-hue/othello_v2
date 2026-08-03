import { JSDOM } from 'jsdom';

const FramePresenter = require('../ui/board-visual/frame-presenter');
const Theme = require('../ui/board-visual/theme');

function makeRawFrame(overrides: Record<string, any> = {}) {
  const topology = {
    baseShape: 'rectangle',
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
    baseKeys: [],
    existingKeys: [],
    playableKeys: [],
    holeKeys: []
  };
  const model = {
    boardDigest: 'board.v1.revision-fixture',
    modelCommitId: 0,
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
    expect(first.model.modelCommitId).toBe(1);
    expect(second.model.modelCommitId).toBe(1);
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
      name: 'canonical board digest',
      override: { model: { boardDigest: 'board.v1.changed' } },
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
    expect(second.model.modelCommitId).toBe(
      changed === 'model' && override.model?.boardDigest ? 2 : 1
    );
  });

  test('assigns a fresh interaction identity when an A-B-A input contract returns to prior content', () => {
    const composer = FramePresenter.createBoardVisualFrameRevisionComposer();
    const cell = (hintInputSignature: string) => ({
      key: '0,0',
      visualSignature: `visual:${hintInputSignature}`,
      hintInputSignature
    });

    const firstA = composer.compose(makeRawFrame({
      model: { cells: [cell('input:A')] }
    }));
    const stateB = composer.compose(makeRawFrame({
      frameToken: 'idle:2',
      model: { cells: [cell('input:B')] }
    }));
    const secondA = composer.compose(makeRawFrame({
      frameToken: 'idle:3',
      model: { cells: [cell('input:A')] }
    }));

    expect([
      firstA.model.modelCommitId,
      stateB.model.modelCommitId,
      secondA.model.modelCommitId
    ]).toEqual([1, 2, 3]);
  });

  test('treats cell order as non-semantic while deriving both revision channels', () => {
    const composer = FramePresenter.createBoardVisualFrameRevisionComposer();
    const cellA = { key: '0,0', visualSignature: 'visual:A', hintInputSignature: 'input:A' };
    const cellB = { key: '0,1', visualSignature: 'visual:B', hintInputSignature: 'input:B' };
    const first = composer.compose(makeRawFrame({ model: { cells: [cellB, cellA] } }));
    const second = composer.compose(makeRawFrame({
      frameToken: 'idle:ordered',
      model: { cells: [cellA, cellB] }
    }));

    expect(second.model.visualRevision).toBe(first.model.visualRevision);
    expect(second.model.modelCommitId).toBe(first.model.modelCommitId);
  });

  test('reuses the combined fingerprint for the same frozen model identity', () => {
    let keyReads = 0;
    const cell = Object.freeze({
      get key() {
        keyReads += 1;
        return '0,0';
      },
      visualSignature: 'visual:A',
      hintInputSignature: 'input:A'
    });
    const raw = makeRawFrame({ model: { cells: Object.freeze([cell]) } });
    for (const keys of [
      raw.model.topology.baseKeys,
      raw.model.topology.existingKeys,
      raw.model.topology.playableKeys,
      raw.model.topology.holeKeys
    ]) Object.freeze(keys);
    Object.freeze(raw.model.topology);
    Object.freeze(raw.model);
    const composer = FramePresenter.createBoardVisualFrameRevisionComposer();

    const first = composer.compose(raw);
    const readsAfterFirstCompose = keyReads;
    const second = composer.compose({ ...raw, frameToken: 'idle:cached' });

    expect(readsAfterFirstCompose).toBeGreaterThan(0);
    expect(keyReads).toBe(readsAfterFirstCompose);
    expect(second.model.visualRevision).toBe(first.model.visualRevision);
    expect(second.model.modelCommitId).toBe(first.model.modelCommitId);
  });

  test('input epoch changes invalidate input identity even when board and hints are unchanged', () => {
    const composer = FramePresenter.createBoardVisualFrameRevisionComposer();
    const inputEpoch = (
      stateVersion: number,
      visualSeq: number,
      pendingEffectId: string
    ) => JSON.stringify({
      stateVersion,
      visualSeq,
      pending: { pendingEffectId }
    });

    const firstA = composer.compose(makeRawFrame({
      model: {
        inputEpoch: inputEpoch(10, 20, 'pending:A'),
        cells: [{
          key: '0,0',
          visualSignature: 'visual:normal',
          hintInputSignature: 'input:stable'
        }]
      }
    }));
    const hoverOnly = composer.compose(makeRawFrame({
      frameToken: 'idle:hover',
      model: {
        inputEpoch: inputEpoch(10, 20, 'pending:A'),
        cells: [{
          key: '0,0',
          visualSignature: 'visual:hovered',
          hintInputSignature: 'input:stable'
        }]
      }
    }));
    const stateVersionChanged = composer.compose(makeRawFrame({
      frameToken: 'idle:state-version',
      model: {
        inputEpoch: inputEpoch(11, 20, 'pending:A'),
        cells: [{
          key: '0,0',
          visualSignature: 'visual:hovered',
          hintInputSignature: 'input:stable'
        }]
      }
    }));
    const visualSeqChanged = composer.compose(makeRawFrame({
      frameToken: 'idle:visual-seq',
      model: {
        inputEpoch: inputEpoch(11, 21, 'pending:A'),
        cells: [{
          key: '0,0',
          visualSignature: 'visual:hovered',
          hintInputSignature: 'input:stable'
        }]
      }
    }));
    const pendingChanged = composer.compose(makeRawFrame({
      frameToken: 'idle:pending',
      model: {
        inputEpoch: inputEpoch(11, 21, 'pending:B'),
        cells: [{
          key: '0,0',
          visualSignature: 'visual:hovered',
          hintInputSignature: 'input:stable'
        }]
      }
    }));
    const secondA = composer.compose(makeRawFrame({
      frameToken: 'idle:again',
      model: {
        inputEpoch: inputEpoch(10, 20, 'pending:A'),
        cells: [{
          key: '0,0',
          visualSignature: 'visual:normal',
          hintInputSignature: 'input:stable'
        }]
      }
    }));

    expect(firstA.model.modelCommitId).toBe(1);
    expect(hoverOnly.model.modelCommitId).toBe(1);
    expect(stateVersionChanged.model.modelCommitId).toBe(2);
    expect(visualSeqChanged.model.modelCommitId).toBe(3);
    expect(pendingChanged.model.modelCommitId).toBe(4);
    expect(secondA.model.modelCommitId).toBe(5);

    const themeOnly = composer.compose(makeRawFrame({
      frameToken: 'idle:theme',
      model: {
        inputEpoch: inputEpoch(10, 20, 'pending:A'),
        cells: [{
          key: '0,0',
          visualSignature: 'visual:normal',
          hintInputSignature: 'input:stable'
        }]
      },
      theme: Theme.createBoardVisualThemeDescriptor({ surfaceColor: '#123456' })
    }));
    expect(themeOnly.model.modelCommitId).toBe(5);
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
