import { JSDOM } from 'jsdom';

describe('board-renderer font-ready theme refresh', () => {
  let dom: JSDOM;

  beforeEach(() => {
    jest.resetModules();
    dom = new JSDOM('<!doctype html><html><body><div id="board-frame"><div id="board"></div></div></body></html>');
    (global as any).window = dom.window;
    (global as any).document = dom.window.document;
    (global as any).boardEl = dom.window.document.getElementById('board');
    (global as any).BLACK = 1;
    (global as any).WHITE = -1;
    (global as any).EMPTY = 0;
    (global as any).getPlayerKey = (player: number) => player === 1 ? 'black' : 'white';
    (global as any).getLegalMoves = jest.fn(() => []);
    (global as any).countDiscs = jest.fn(() => ({ black: 0, white: 0 }));
    (global as any).handleCellClick = jest.fn();
    (global as any).applyStoneVisualEffect = jest.fn();
    (global as any).renderBoardDiff = jest.fn();
    (global as any).updateOccupancyUI = jest.fn();
    (global as any).renderCardUI = jest.fn();
    (global as any).SoundEngine = {
      bgm: { paused: false },
      allowBgmPlay: true,
      pauseBgm: jest.fn(),
      playBgm: jest.fn()
    };
    (global as any).CardLogic = {
      getCardContext: () => ({ protectedStones: [], permaProtectedStones: [], bombs: [] }),
      getSelectableTargets: () => [],
      getCardDef: () => null,
      getReinforcementWillTargets: () => [],
      getSupportTroopsWillTargets: () => []
    };
    (global as any).gameState = {
      currentPlayer: 1,
      board: Array.from({ length: 8 }, () => Array(8).fill(0))
    };
    (global as any).cardState = {
      markers: [],
      pendingEffectByPlayer: { black: null, white: null }
    };
  });

  afterEach(() => {
    dom.window.close();
    for (const key of [
      'window', 'document', 'boardEl', 'BLACK', 'WHITE', 'EMPTY', 'getPlayerKey',
      'getLegalMoves', 'countDiscs', 'handleCellClick', 'applyStoneVisualEffect',
      'renderBoardDiff', 'updateOccupancyUI', 'renderCardUI', 'SoundEngine', 'CardLogic',
      'gameState', 'cardState'
    ]) delete (global as any)[key];
  });

  function createController() {
    const frames: any[] = [];
    return {
      frames,
      submitFrame: jest.fn((frame: any) => {
        frames.push(frame);
        return true;
      }),
      getMode: jest.fn(() => 'idle'),
      getActiveFrameToken: jest.fn(() => null),
      getActiveWriterToken: jest.fn(() => null),
      waitUntilReady: jest.fn(() => Promise.resolve()),
      ready: Promise.resolve(),
      destroy: jest.fn()
    };
  }

  test('fonts.ready requests one ordinary frame and advances only theme after controller reinitialization', async () => {
    let settleReady!: () => void;
    const ready = new Promise<void>((resolve) => { settleReady = resolve; });
    Object.defineProperty(dom.window.document, 'fonts', {
      configurable: true,
      value: { ready }
    });
    const renderer = require('../ui/board-renderer.js');
    const firstController = createController();
    const activeController = createController();
    const host = dom.window.document.getElementById('board') as HTMLElement;

    renderer.configureBoardVisualController(firstController, { host });
    renderer.renderBoard();
    renderer.configureBoardVisualController(activeController, { host });
    renderer.renderBoard();
    const before = activeController.frames[0];

    settleReady();
    await ready;
    await Promise.resolve();
    await Promise.resolve();

    expect(firstController.destroy).toHaveBeenCalledTimes(1);
    expect(firstController.submitFrame).toHaveBeenCalledTimes(1);
    expect(activeController.submitFrame).toHaveBeenCalledTimes(2);
    const after = activeController.frames[1];
    expect(after.model.visualRevision).toBe(before.model.visualRevision);
    expect(after.layout.revision).toBe(before.layout.revision);
    expect(after.appearance.revision).toBe(before.appearance.revision);
    expect(after.theme.revision).toBe(before.theme.revision + 1);
    expect(after.theme.fontReadyEpoch).toBe(before.theme.fontReadyEpoch + 1);
  });

  test('occupancy excludes an expansion stone hidden by METEOR_HOLE', () => {
    const legacyOccupancy = jest.fn();
    (dom.window as any).updateOccupancyUI = legacyOccupancy;
    dom.window.document.body.insertAdjacentHTML(
      'beforeend',
      '<div id="occ-black"></div><div id="occ-white"></div>'
    );
    (global as any).gameState = {
      currentPlayer: 1,
      boardConfig: { rows: 4, cols: 4, shape: 'rectangle' },
      board: [
        [1, 1, -1, 0],
        [0, 0, 0, 0],
        [0, 0, 0, 0],
        [0, 0, 0, 0]
      ],
      boardExpansion: {
        active: true,
        side: 'left',
        row: 1,
        col: -1,
        owner: 1,
        cells: [{ side: 'left', row: 1, col: -1, owner: 1 }]
      }
    };
    (global as any).cardState = {
      markers: [{
        kind: 'specialStone',
        row: 1,
        col: -1,
        data: { type: 'METEOR_HOLE' }
      }],
      pendingEffectByPlayer: { black: null, white: null }
    };

    const renderer = require('../ui/board-renderer.js');
    expect((dom.window as any).updateOccupancyUI).toBe(renderer.updateOccupancyUI);
    (dom.window as any).updateOccupancyUI();

    expect(dom.window.document.getElementById('occ-black')?.textContent).toContain('黒 67%');
    expect(dom.window.document.getElementById('occ-white')?.textContent).toContain('白 33%');
    expect((global as any).countDiscs).not.toHaveBeenCalled();
    expect(legacyOccupancy).not.toHaveBeenCalled();
  });
});
