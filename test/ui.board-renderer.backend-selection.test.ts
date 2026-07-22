import fs from 'fs';
import path from 'path';
import { JSDOM } from 'jsdom';
import { readCssBlock } from './helpers/css-test-helpers';

type BackendHooks = {
  mount?: (host: HTMLElement) => void | Promise<void>;
  applyFrame?: (frame: any) => void;
  restore?: (frame: any) => void | Promise<void>;
  destroy?: () => void;
};

function createBackend(kind: 'dom' | 'pixi', hooks: BackendHooks = {}) {
  return {
    kind,
    mount: jest.fn((host: HTMLElement) => hooks.mount?.(host)),
    applyFrame: jest.fn((frame: any) => hooks.applyFrame?.(frame)),
    playPhase: jest.fn(async () => undefined),
    getCellClientRect: jest.fn(() => null),
    resize: jest.fn(),
    restore: jest.fn((frame: any) => hooks.restore ? hooks.restore(frame) : hooks.applyFrame?.(frame)),
    destroy: jest.fn(() => hooks.destroy?.())
  };
}

function createInitialFrame() {
  return {
    frameToken: 'initial:1',
    model: {
      visualRevision: 1,
      topology: {
        baseRows: 1,
        baseCols: 1,
        minRow: 0,
        maxRow: 0,
        minCol: 0,
        maxCol: 0,
        renderRowOffset: 0,
        renderColOffset: 0,
        renderRows: 1,
        renderCols: 1,
        baseKeys: ['0,0'],
        existingKeys: ['0,0'],
        playableKeys: ['0,0'],
        holeKeys: []
      },
      cells: [],
      keyboardCursorKey: null,
      viewerContext: 'black',
      currentPlayer: 'black',
      canControlCurrentTurn: true,
      isHumanTurn: true
    },
    layout: {
      revision: 1,
      cellSize: 20,
      dpr: 1,
      orientation: 'normal',
      frameInset: { top: 0, right: 0, bottom: 0, left: 0 },
      clientOrigin: { x: 0, y: 0 },
      visualViewport: { scale: 1, offsetLeft: 0, offsetTop: 0 },
      camera: { scrollLeft: 0, scrollTop: 0, viewportWidth: 20, viewportHeight: 20 },
      logicalWidth: 20,
      logicalHeight: 20,
      visibleWorldWindow: { minRow: 0, maxRow: 0, minCol: 0, maxCol: 0 }
    },
    appearance: {
      boardSkinId: 'default',
      boardImageUrl: '',
      boardFrameSkinId: 'default',
      boardFrameLayout: {},
      stoneSkinId: 'default',
      blackStoneImageUrl: '',
      whiteStoneImageUrl: '',
      revision: 1
    },
    theme: { revision: 1 }
  };
}

function createInteractiveFrame() {
  const frame: any = createInitialFrame();
  frame.frameToken = 'input:settled:1';
  frame.model.cells = [{
    key: '0,0',
    row: 0,
    col: 0,
    kind: 'playable',
    interaction: {
      legal: true,
      legalFree: false,
      interactionLocked: false,
      directionHints: [{
        id: 'expand:right',
        kind: 'board-expansion-will',
        directionKey: 'right'
      }]
    }
  }];
  return frame;
}

describe('board renderer backend selection and initial compatibility fallback', () => {
  let dom: JSDOM;
  let controller: any;

  function loadRenderer(url = 'https://example.test/game') {
    dom = new JSDOM(
      '<!doctype html><html><body><div id="board-stack"><div id="board-frame"><div id="board"></div></div><div id="board-expansion-layer"></div></div></body></html>',
      { url }
    );
    (global as any).window = dom.window;
    (global as any).document = dom.window.document;
    (global as any).boardEl = dom.window.document.getElementById('board');
    return require('../ui/board-renderer.js');
  }

  beforeEach(() => {
    jest.resetModules();
    controller = null;
  });

  afterEach(() => {
    try { controller?.destroy?.(); } catch (_error) { /* test cleanup */ }
    try { dom?.window.close(); } catch (_error) { /* test cleanup */ }
    delete (global as any).window;
    delete (global as any).document;
    delete (global as any).boardEl;
    delete (global as any).handleCellClick;
    for (const key of [
      'SoundEngine', 'BLACK', 'WHITE', 'EMPTY', 'getPlayerKey', 'getLegalMoves',
      'countDiscs', 'applyStoneVisualEffect', 'CardLogic'
    ]) delete (global as any)[key];
  });

  test.each([
    'https://example.test/game',
    'https://example.test/game?boardRenderer=dom',
    'https://example.test/game?debug=0&boardRenderer=dom',
    'https://example.test/game?boardRenderer=pixi&noanim=1'
  ])('keeps Pixi as the production/default backend for %s', async (url) => {
    const renderer = loadRenderer(url);
    const pixiBackend = createBackend('pixi');
    const createDomBackend = jest.fn(() => createBackend('dom'));
    const createPixiBackend = jest.fn(() => pixiBackend);
    renderer.configureBoardVisualBackendForTest({ createDomBackend, createPixiBackend });

    controller = renderer.getBoardVisualController();
    await controller.waitUntilReady();

    expect(createPixiBackend).toHaveBeenCalledTimes(1);
    expect(createPixiBackend).toHaveBeenCalledWith(expect.objectContaining({
      allowSoftwareRenderer: false
    }));
    expect(createDomBackend).not.toHaveBeenCalled();
    expect(controller.getBackendKind()).toBe('pixi');
    expect(document.getElementById('board')?.getAttribute('data-board-renderer')).toBe('pixi');
  });

  test('keeps the exact debug/noanim Pixi query and mounts one canvas without cell DOM', async () => {
    const renderer = loadRenderer('https://example.test/game?debug=1&boardRenderer=pixi&noanim=1');
    const createDomBackend = jest.fn(() => createBackend('dom'));
    const createPixiBackend = jest.fn((options: any) => createBackend('pixi', {
      mount(host) {
        while (host.firstChild) host.removeChild(host.firstChild);
        host.appendChild(document.createElement('canvas'));
      }
    }));
    renderer.configureBoardVisualBackendForTest({ createDomBackend, createPixiBackend });

    controller = renderer.getBoardVisualController();
    await controller.waitUntilReady();

    expect(createPixiBackend).toHaveBeenCalledWith(expect.objectContaining({
      noAnimation: true,
      allowSoftwareRenderer: true,
      getInputController: expect.any(Function),
      onTopologyRevealStart: expect.any(Function),
      contextRecovery: expect.objectContaining({
        timeoutMs: 5000,
        onContextLost: expect.any(Function),
        onContextRestored: expect.any(Function),
        onFallbackRequired: expect.any(Function),
        onRecoveryFailed: expect.any(Function)
      })
    }));
    const inputController = createPixiBackend.mock.calls[0][0].getInputController();
    expect(inputController).toBe(renderer.getBoardInputController());
    expect(inputController.getState().enabled).toBe(false);
    expect(createDomBackend).not.toHaveBeenCalled();
    expect(controller.getBackendKind()).toBe('pixi');
    expect(document.querySelectorAll('#board > canvas')).toHaveLength(1);
    expect(document.querySelectorAll('#board .cell')).toHaveLength(0);
    expect(document.getElementById('board')?.getAttribute('data-board-renderer')).toBe('pixi');
  });

  test('materializes the expansion layer only after the DOM compatibility backend is selected', async () => {
    const renderer = loadRenderer('https://example.test/game?debug=1&boardRenderer=pixi&noanim=1');
    const createPixiBackend = jest.fn(() => createBackend('pixi'));
    renderer.configureBoardVisualBackendForTest({ createPixiBackend });

    controller = renderer.getBoardVisualController();
    await controller.waitUntilReady();

    const board = document.getElementById('board') as HTMLElement;
    document.getElementById('board-expansion-layer')?.remove();
    renderer.syncBoardExpansionLayerGeometry(board, { rows: 8, cols: 8 });
    expect(document.getElementById('board-expansion-layer')).toBeNull();

    board.setAttribute('data-board-renderer', 'dom');
    renderer.syncBoardExpansionLayerGeometry(board, { rows: 8, cols: 8 });
    expect(document.getElementById('board-expansion-layer')?.parentElement?.id).toBe('board-stack');
  });

  test('allows only the exact debug query to select the DOM compatibility backend', async () => {
    const renderer = loadRenderer('https://example.test/game?debug=1&boardRenderer=dom&noanim=1');
    const domBackend = createBackend('dom');
    const createDomBackend = jest.fn(() => domBackend);
    const createPixiBackend = jest.fn(() => createBackend('pixi'));
    renderer.configureBoardVisualBackendForTest({ createDomBackend, createPixiBackend });

    controller = renderer.getBoardVisualController();
    await controller.waitUntilReady();

    expect(createDomBackend).toHaveBeenCalledTimes(1);
    expect(createPixiBackend).not.toHaveBeenCalled();
    expect(controller.getBackendKind()).toBe('dom');
    expect(document.getElementById('board')?.getAttribute('data-board-renderer')).toBe('dom');
  });

  test('allows an explicit test harness to select the animated Pixi backend without query flags', async () => {
    const renderer = loadRenderer();
    const createPixiBackend = jest.fn(() => createBackend('pixi'));
    renderer.configureBoardVisualBackendForTest({ selection: 'pixi', createPixiBackend });

    controller = renderer.getBoardVisualController();
    await controller.waitUntilReady();

    expect(createPixiBackend).toHaveBeenCalledWith(expect.objectContaining({
      noAnimation: false,
      allowSoftwareRenderer: false,
      getInputController: expect.any(Function),
      onTopologyRevealStart: expect.any(Function)
    }));
    expect(controller.getBackendKind()).toBe('pixi');
  });

  test('enables one shared input controller after readiness and publishes Pixi semantics only after settlement', async () => {
    const renderer = loadRenderer('https://example.test/game?debug=1&boardRenderer=pixi&noanim=1');
    const handleCellClick = jest.fn();
    (global as any).handleCellClick = handleCellClick;
    const pixiBackend = createBackend('pixi', {
      mount(host) {
        host.replaceChildren(document.createElement('canvas'));
      }
    });
    pixiBackend.getCellClientRect.mockReturnValue({
      left: 10,
      top: 20,
      right: 54,
      bottom: 64,
      width: 44,
      height: 44,
      layoutRevision: 1
    });
    const createPixiBackend = jest.fn(() => pixiBackend);
    renderer.configureBoardVisualBackendForTest({ createPixiBackend });

    controller = renderer.getBoardVisualController();
    await controller.waitUntilReady();
    const input = createPixiBackend.mock.calls[0][0].getInputController();
    expect(input.getState().enabled).toBe(false);
    expect(renderer.activateBoardInputController()).toBe(input);
    expect(input.getState().enabled).toBe(true);

    expect(controller.submitFrame(createInteractiveFrame())).toBe(true);
    expect(document.querySelector('.board-accessibility-layer')).toBeNull();
    await controller.waitForIdle();
    await Promise.resolve();

    const layers = document.querySelectorAll('#board > .board-accessibility-layer');
    const button = layers[0]?.querySelector('button') as HTMLButtonElement | null;
    expect(layers).toHaveLength(1);
    expect(document.querySelector('#board canvas')?.getAttribute('aria-hidden')).toBe('true');
    expect(button?.getAttribute('role')).toBe('button');
    expect(button?.getAttribute('aria-label')).toBe('盤面を→方向へ拡張');
    expect(input.getLegalCells()).toEqual([{ row: 0, col: 0, key: '0,0' }]);

    button?.click();
    expect(handleCellClick).toHaveBeenCalledWith(0, 0, 'right');
  });

  test('keeps board input locked until an idle visual frame has settled', async () => {
    const renderer = loadRenderer('https://example.test/game?debug=1&boardRenderer=pixi&noanim=1');
    let resolveSettlement!: () => void;
    const settlement = new Promise<void>((resolve) => {
      resolveSettlement = resolve;
    });
    const pixiBackend = createBackend('pixi');
    (pixiBackend as any).waitForVisualSettlement = jest.fn(() => settlement);
    const createPixiBackend = jest.fn(() => pixiBackend);
    renderer.configureBoardVisualBackendForTest({ createPixiBackend });

    controller = renderer.getBoardVisualController();
    await controller.waitUntilReady();
    const input = renderer.activateBoardInputController();

    expect(controller.submitFrame(createInteractiveFrame())).toBe(true);
    await Promise.resolve();
    expect(controller.getMode()).toBe('idle');
    expect(controller.isIdleSettlementPending()).toBe(true);
    expect(input.getState().locked).toBe(true);

    resolveSettlement();
    await controller.waitForIdle();
    expect(controller.isIdleSettlementPending()).toBe(false);
    expect(input.getState().locked).toBe(false);
  });

  test('never mounts the Pixi semantic layer for the DOM compatibility backend', async () => {
    const renderer = loadRenderer();
    const domBackend = createBackend('dom');
    renderer.configureBoardVisualBackendForTest({
      selection: 'dom',
      createDomBackend: () => domBackend
    });
    controller = renderer.getBoardVisualController();
    await controller.waitUntilReady();
    renderer.activateBoardInputController();
    controller.submitFrame(createInteractiveFrame());
    await controller.waitForIdle();
    await Promise.resolve();

    expect(document.querySelector('.board-accessibility-layer')).toBeNull();
  });

  test('enables live Pixi animation without silently selecting DOM', async () => {
    const renderer = loadRenderer('https://example.test/game?debug=1&boardRenderer=pixi');
    const createDomBackend = jest.fn(() => createBackend('dom'));
    const createPixiBackend = jest.fn(() => createBackend('pixi'));
    renderer.configureBoardVisualBackendForTest({ createDomBackend, createPixiBackend });

    controller = renderer.getBoardVisualController();
    await controller.waitUntilReady();

    expect(createPixiBackend).toHaveBeenCalledWith(expect.objectContaining({
      noAnimation: false,
      allowSoftwareRenderer: true,
      getInputController: expect.any(Function),
      onTopologyRevealStart: expect.any(Function)
    }));
    expect(createDomBackend).not.toHaveBeenCalled();
    expect(controller.getBackendKind()).toBe('pixi');
    expect(document.getElementById('board')?.getAttribute('data-board-renderer')).toBe('pixi');
  });

  test('plays one DOM-compatible expansion reveal sound for each Pixi topology delta', async () => {
    const renderer = loadRenderer('https://example.test/game?debug=1&boardRenderer=pixi');
    const soundEngine = {
      init: jest.fn(),
      playEffectByKey: jest.fn()
    };
    (global as any).SoundEngine = soundEngine;
    (global as any).window.SoundEngine = soundEngine;
    (global as any).window.requestAnimationFrame = jest.fn((callback: FrameRequestCallback) => {
      callback(0);
      return 1;
    });
    const createPixiBackend = jest.fn(() => createBackend('pixi'));
    renderer.configureBoardVisualBackendForTest({ createPixiBackend });
    controller = renderer.getBoardVisualController();
    await controller.waitUntilReady();

    const onTopologyRevealStart = createPixiBackend.mock.calls[0][0].onTopologyRevealStart;
    const firstFrame = { frameToken: 'expansion:1' };
    onTopologyRevealStart(['0,1', '1,0'], firstFrame);
    onTopologyRevealStart(['1,0', '0,1'], firstFrame);
    onTopologyRevealStart([], { frameToken: 'ignored' });

    expect(soundEngine.init).toHaveBeenCalledTimes(1);
    expect(soundEngine.playEffectByKey).toHaveBeenCalledTimes(1);
    expect(soundEngine.playEffectByKey).toHaveBeenLastCalledWith('board_expansion_reveal');

    onTopologyRevealStart(['0,2'], { frameToken: 'expansion:2' });
    expect(soundEngine.playEffectByKey).toHaveBeenCalledTimes(2);

    delete (global as any).SoundEngine;
  });

  test('suppresses the Pixi expansion sound captured by the post-playback frame context', async () => {
    const renderer = loadRenderer('https://example.test/game?debug=1&boardRenderer=pixi');
    const soundEngine = { init: jest.fn(), playEffectByKey: jest.fn() };
    (global as any).SoundEngine = soundEngine;
    (global as any).window.SoundEngine = soundEngine;
    (global as any).window.requestAnimationFrame = jest.fn((callback: FrameRequestCallback) => {
      callback(0);
      return 1;
    });
    Object.assign(global as any, {
      BLACK: 1,
      WHITE: -1,
      EMPTY: 0,
      getPlayerKey: (player: any) => player === -1 ? 'white' : 'black',
      getLegalMoves: jest.fn(() => []),
      countDiscs: jest.fn(() => ({ black: 1, white: 0 })),
      applyStoneVisualEffect: jest.fn(),
      CardLogic: {
        getCardContext: () => ({ protectedStones: [], permaProtectedStones: [], bombs: [] }),
        getSelectableTargets: () => []
      }
    });
    const createPixiBackend = jest.fn(() => createBackend('pixi'));
    renderer.configureBoardVisualBackendForTest({ createPixiBackend });
    controller = renderer.getBoardVisualController();
    await controller.waitUntilReady();
    const playbackState = require('../ui/playback-state-manager.js');
    playbackState.armBoardUpdateContext({
      suppressBoardExpansionRevealSound: true,
      source: 'unit-test',
      reason: 'cell_teleport_post_playback_sync'
    });
    const frame = renderer.buildBoardVisualFrame(controller, {
      gameState: { currentPlayer: 1, board: [[1]] },
      cardState: {
        markers: [],
        hands: { black: [], white: [] },
        pendingEffectByPlayer: { black: null, white: null }
      }
    });

    createPixiBackend.mock.calls[0][0].onTopologyRevealStart(['0,1'], frame);
    expect(soundEngine.init).not.toHaveBeenCalled();
    expect(soundEngine.playEffectByKey).not.toHaveBeenCalled();

    playbackState.clearBoardUpdateContext();
    for (const key of [
      'SoundEngine', 'BLACK', 'WHITE', 'EMPTY', 'getPlayerKey', 'getLegalMoves',
      'countDiscs', 'applyStoneVisualEffect', 'CardLogic'
    ]) delete (global as any)[key];
  });

  test('destroys failed Pixi before exclusively mounting DOM and restores the queued initial frame', async () => {
    const renderer = loadRenderer('https://example.test/game?debug=1&boardRenderer=pixi&noanim=1');
    const order: string[] = [];
    const initError: any = new Error('application init rejected');
    initError.code = 'pixi_application_init_failed';
    initError.stage = 'init';
    let pixiHost: HTMLElement | null = null;
    let pixiCanvas: HTMLCanvasElement | null = null;
    const pixiBackend = createBackend('pixi', {
      mount(host) {
        order.push('pixi:mount');
        pixiHost = host;
        pixiCanvas = document.createElement('canvas');
        host.appendChild(pixiCanvas);
        return Promise.reject(initError);
      },
      destroy() {
        order.push('pixi:destroy');
        if (pixiCanvas?.parentNode === pixiHost) pixiHost.removeChild(pixiCanvas);
      }
    });
    const domBackend = createBackend('dom', {
      mount(host) {
        order.push('dom:mount');
        expect(host.querySelectorAll('canvas')).toHaveLength(0);
        expect(host.querySelectorAll('.cell')).toHaveLength(0);
      },
      restore() {
        order.push('dom:restore');
        const cell = document.createElement('div');
        cell.className = 'cell';
        document.getElementById('board')?.appendChild(cell);
      }
    });
    const createDomBackend = jest.fn(() => domBackend);
    renderer.configureBoardVisualBackendForTest({
      createPixiBackend: () => pixiBackend,
      createDomBackend
    });

    controller = renderer.getBoardVisualController();
    expect(controller.submitFrame(createInitialFrame())).toBe(false);
    await controller.waitUntilReady();

    expect(order).toEqual(['pixi:mount', 'pixi:destroy', 'dom:mount', 'dom:restore']);
    expect(pixiBackend.destroy).toHaveBeenCalledTimes(1);
    expect(createDomBackend).toHaveBeenCalledTimes(1);
    expect(controller.getBackendKind()).toBe('dom');
    expect(controller.isReady()).toBe(true);
    expect(controller.getVisualFrameDigest()).toEqual(expect.any(String));
    expect(document.querySelectorAll('#board canvas')).toHaveLength(0);
    expect(document.querySelectorAll('#board > .cell')).toHaveLength(1);
    expect(document.getElementById('board')?.getAttribute('data-board-renderer')).toBe('dom');
  });

  test('does not turn scene or texture failures into a success-shaped DOM fallback', async () => {
    const renderer = loadRenderer('https://example.test/game?debug=1&boardRenderer=pixi&noanim=1');
    const resourceError: any = new Error('stone texture decode failed');
    resourceError.code = 'pixi_texture_decode_failed';
    resourceError.stage = 'texture';
    const pixiBackend = createBackend('pixi', {
      mount() { return Promise.reject(resourceError); }
    });
    const createDomBackend = jest.fn(() => createBackend('dom'));
    renderer.configureBoardVisualBackendForTest({
      createPixiBackend: () => pixiBackend,
      createDomBackend
    });

    controller = renderer.getBoardVisualController();
    await expect(controller.waitUntilReady()).rejects.toBe(resourceError);

    expect(createDomBackend).not.toHaveBeenCalled();
    expect(pixiBackend.destroy).not.toHaveBeenCalled();
    expect(controller.getBackendKind()).toBe('pixi');
    expect(controller.getMode()).toBe('recovering');
    expect(document.getElementById('board')?.hasAttribute('data-board-renderer')).toBe(false);
  });

  test('requires an explicit initialization error code instead of a generic stage or message', async () => {
    const renderer = loadRenderer('https://example.test/game?debug=1&boardRenderer=pixi&noanim=1');
    const ambiguousError: any = new Error('application init rejected');
    ambiguousError.stage = 'init';
    const pixiBackend = createBackend('pixi', {
      mount() { return Promise.reject(ambiguousError); }
    });
    const createDomBackend = jest.fn(() => createBackend('dom'));
    renderer.configureBoardVisualBackendForTest({
      createPixiBackend: () => pixiBackend,
      createDomBackend
    });

    controller = renderer.getBoardVisualController();
    await expect(controller.waitUntilReady()).rejects.toBe(ambiguousError);

    expect(createDomBackend).not.toHaveBeenCalled();
    expect(controller.getBackendKind()).toBe('pixi');
    expect(controller.getMode()).toBe('recovering');
  });

  test('restores an idle Pixi checkpoint and then switches exclusively to DOM on timeout', async () => {
    const renderer = loadRenderer('https://example.test/game?debug=1&boardRenderer=pixi&noanim=1');
    const order: string[] = [];
    let hooks: any = null;
    let pixiCanvas: HTMLCanvasElement | null = null;
    const pixiBackend = createBackend('pixi', {
      mount(host) {
        pixiCanvas = document.createElement('canvas');
        host.appendChild(pixiCanvas);
      },
      restore() { order.push('pixi:restore'); },
      destroy() {
        order.push('pixi:destroy');
        pixiCanvas?.remove();
      }
    });
    const domBackend = createBackend('dom', {
      mount(host) {
        order.push('dom:mount');
        expect(host.querySelectorAll('canvas')).toHaveLength(0);
      },
      restore() { order.push('dom:restore'); }
    });
    renderer.configureBoardVisualBackendForTest({
      createPixiBackend: (options: any) => {
        hooks = options.contextRecovery;
        return pixiBackend;
      },
      createDomBackend: () => domBackend
    });
    controller = renderer.getBoardVisualController();
    await controller.waitUntilReady();
    controller.submitFrame(createInitialFrame());
    await controller.waitForIdle();

    hooks.onContextLost(new Error('first context loss'), new Event('webglcontextlost'));
    await expect(hooks.onContextRestored(new Event('webglcontextrestored'))).resolves.toBe(true);
    expect(controller.getBackendKind()).toBe('pixi');
    expect(controller.getMode()).toBe('idle');
    expect(order).toEqual(['pixi:restore']);

    hooks.onContextLost(new Error('second context loss'), new Event('webglcontextlost'));
    await expect(hooks.onFallbackRequired(new Error('restore timed out'))).resolves.toBe(true);

    expect(order).toEqual(['pixi:restore', 'pixi:destroy', 'dom:mount', 'dom:restore']);
    expect(controller.getBackendKind()).toBe('dom');
    expect(controller.getMode()).toBe('idle');
    expect(document.getElementById('board')?.getAttribute('data-board-renderer')).toBe('dom');
  });

  test('shows reload-required only when checkpointed DOM fallback also fails', async () => {
    const renderer = loadRenderer('https://example.test/game?debug=1&boardRenderer=pixi&noanim=1');
    let hooks: any = null;
    const fallbackError = new Error('DOM compatibility mount failed');
    renderer.configureBoardVisualBackendForTest({
      createPixiBackend: (options: any) => {
        hooks = options.contextRecovery;
        return createBackend('pixi');
      },
      createDomBackend: () => createBackend('dom', {
        mount() { throw fallbackError; }
      })
    });
    controller = renderer.getBoardVisualController();
    await controller.waitUntilReady();
    controller.submitFrame(createInitialFrame());
    await controller.waitForIdle();

    hooks.onContextLost(new Error('context loss'), new Event('webglcontextlost'));
    await expect(hooks.onFallbackRequired(new Error('restore timed out'))).rejects.toBe(fallbackError);

    expect(controller.getMode()).toBe('recovering');
    expect(controller.isReady()).toBe(false);
    expect(document.getElementById('network-presentation-reload-required')).not.toBeNull();
    expect(document.querySelector('[data-presentation-reload="true"]')?.textContent).toBe('再読み込み');
  });

  test('fixes the injected selection before mount and refuses mutation afterwards', async () => {
    const renderer = loadRenderer();
    renderer.configureBoardVisualBackendForTest({
      selection: 'dom',
      createDomBackend: () => createBackend('dom')
    });
    controller = renderer.getBoardVisualController();
    await controller.waitUntilReady();

    expect(() => renderer.configureBoardVisualBackendForTest({ selection: 'pixi' }))
      .toThrow('selection is already fixed');
  });
});

describe('Pixi board CSS and classic delivery wiring', () => {
  const root = path.resolve(__dirname, '..');

  test('scopes canvas surface replacement to data-board-renderer="pixi" and keeps DOM/frame rules', () => {
    const boardCss = fs.readFileSync(path.join(root, 'styles-board.css'), 'utf8');
    const layoutCss = fs.readFileSync(path.join(root, 'styles-layout.css'), 'utf8');
    const responsiveCss = fs.readFileSync(path.join(root, 'styles-responsive.css'), 'utf8');
    const pixiViewportCss = readCssBlock(
      boardCss,
      '#board[data-board-renderer="pixi"] > .pixi-board-scroll-viewport'
    );

    expect(boardCss).toMatch(/#board\s*\{[\s\S]*?display:\s*grid;/);
    expect(boardCss).toContain('#board[data-board-renderer="pixi"]');
    expect(boardCss).toContain('.pixi-board-scroll-viewport');
    expect(pixiViewportCss).toMatch(/overflow:\s*hidden;/);
    expect(pixiViewportCss).not.toMatch(/overflow:\s*auto;/);
    expect(boardCss).toContain('.pixi-board-scroll-surface');
    expect(boardCss).toContain('.pixi-board-canvas-layer');
    expect(boardCss).toMatch(/#board\[data-board-renderer="pixi"\]::before,[\s\S]*?content:\s*none;/);
    expect(layoutCss).toContain('#board-frame::before');
    expect(layoutCss).toContain('background: var(--board-frame-image)');
    expect(responsiveCss).toMatch(/#board\s*\{\s*--board-max-size:/);
  });

  test('loads the classic Pixi runtime pair exactly once before every app runtime entry', () => {
    const classic = fs.readFileSync(path.join(root, 'index.classic.html'), 'utf8');
    const vendor = 'public/vendor/pixi-8.18.1.min.js';
    const unsafeEvalVendor = 'public/vendor/pixi-unsafe-eval-8.18.1.min.js';
    const vendorMatches = classic.match(/public\/vendor\/pixi-8\.18\.1\.min\.js/g) || [];
    const unsafeEvalVendorMatches = classic.match(/public\/vendor\/pixi-unsafe-eval-8\.18\.1\.min\.js/g) || [];
    const vendorIndex = classic.indexOf(vendor);
    const unsafeEvalVendorIndex = classic.indexOf(unsafeEvalVendor);
    const runtimeIndex = classic.indexOf('public/runtime.js');
    const registryIndex = classic.indexOf('public/module-registry.js');
    const entryIndex = classic.indexOf('entry-browser.js');

    expect(vendorMatches).toHaveLength(1);
    expect(unsafeEvalVendorMatches).toHaveLength(1);
    expect(vendorIndex).toBeGreaterThanOrEqual(0);
    expect(unsafeEvalVendorIndex).toBeGreaterThan(vendorIndex);
    expect(runtimeIndex).toBeGreaterThan(unsafeEvalVendorIndex);
    expect(registryIndex).toBeGreaterThan(runtimeIndex);
    expect(entryIndex).toBeGreaterThan(registryIndex);
  });
});
