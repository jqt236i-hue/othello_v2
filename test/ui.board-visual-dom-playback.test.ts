import { JSDOM } from 'jsdom';

let playbackContextSequence = 20;

function createPlaybackContext(event: any) {
  const id = ++playbackContextSequence;
  return Object.freeze({
    token: Object.freeze({ id, frameToken: `local:dom-playback:${id}`, mode: 'local' }),
    strictNetworkPlayback: false,
    phaseScope: Object.freeze({ events: Object.freeze([event]), phaseKey: '0', stepIndex: 0 })
  });
}

describe('DOM board playback phase ownership', () => {
  let dom: JSDOM;

  beforeEach(() => {
    dom = new JSDOM('<!doctype html><html><body></body></html>');
    (global as any).window = dom.window;
    (global as any).document = dom.window.document;
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.dontMock('../ui/layout-read-batch');
    jest.dontMock('../ui/transient-overlay-batch');
    jest.dontMock('../ui/stone-visuals');
    jest.resetModules();
    dom.window.close();
    delete (global as any).window;
    delete (global as any).document;
  });

  test('parallel launches share one phase context and clean it after the final launch', () => {
    const clear = jest.fn();
    const cleanup = jest.fn();
    const createLayoutReadBatch = jest.fn(() => ({ clear }));
    const createTransientOverlayBatch = jest.fn(() => ({ cleanup }));
    jest.doMock('../ui/layout-read-batch', () => ({ createLayoutReadBatch }));
    jest.doMock('../ui/transient-overlay-batch', () => ({ createTransientOverlayBatch }));

    const { createDomBoardPlaybackHandlers } = require('../ui/board-visual/dom-runtime');
    const handlers = createDomBoardPlaybackHandlers({ documentRef: document });
    const scope = Object.freeze({
      phaseKey: '3',
      stepIndex: 1,
      events: Object.freeze([{ type: 'place' }, { type: 'spawn' }])
    });
    const context = Object.freeze({
      token: Object.freeze({ id: 4, frameToken: 'local:parallel', mode: 'local' }),
      strictNetworkPlayback: false,
      phaseScope: scope
    });

    handlers.beginPhase([{ type: 'place' }], context);
    handlers.beginPhase([{ type: 'spawn' }], context);

    expect(createLayoutReadBatch).toHaveBeenCalledTimes(1);
    expect(createTransientOverlayBatch).toHaveBeenCalledTimes(1);
    handlers.endPhase(context);
    expect(clear).not.toHaveBeenCalled();
    expect(cleanup).not.toHaveBeenCalled();
    handlers.endPhase(context);
    expect(clear).toHaveBeenCalledTimes(1);
    expect(cleanup).toHaveBeenCalledTimes(1);
  });

  test('crossfade settlement keeps the backend phase alive until its visual promise completes', async () => {
    let finishCrossfade!: () => void;
    const crossfadeStoneVisual = jest.fn(() => new Promise<void>((resolve) => {
      finishCrossfade = resolve;
    }));
    jest.doMock('../ui/stone-visuals', () => ({
      syncDiscVisualToCurrentState: jest.fn(),
      crossfadeStoneVisual
    }));

    document.body.innerHTML = '<div id="board"><div class="cell" data-row="1" data-col="2"><div class="disc black"></div></div></div>';
    const { createDomBoardPlaybackHandlers } = require('../ui/board-visual/dom-runtime');
    const { createDomBoardPlaybackExecutor } = require('../ui/board-visual/dom-playback');
    const handlers = createDomBoardPlaybackHandlers({
      boardElement: document.getElementById('board'),
      documentRef: document
    });
    const executor = createDomBoardPlaybackExecutor(handlers);
    const event = {
      type: 'crossfade_stone',
      row: 1,
      col: 2,
      effectKey: 'regenStone',
      durationMs: 600
    };
    const context = Object.freeze({
      token: Object.freeze({ id: 5, frameToken: 'local:crossfade', mode: 'local' }),
      strictNetworkPlayback: false,
      phaseScope: Object.freeze({ events: Object.freeze([event]), phaseKey: '0', stepIndex: 0 })
    });
    let settled = false;

    const pending = executor.playPhase([event], context).then(() => { settled = true; });
    await Promise.resolve();

    expect(crossfadeStoneVisual).toHaveBeenCalledTimes(1);
    expect(settled).toBe(false);
    finishCrossfade();
    await pending;
    expect(settled).toBe(true);
  });

  test('legacy fade-out mutates the disc only inside the DOM backend and settles its timer', async () => {
    jest.useFakeTimers();
    document.body.innerHTML = '<div id="board"><div class="cell" data-row="1" data-col="2"><div class="disc black flip"></div></div></div>';
    const { createDomBoardPlaybackHandlers } = require('../ui/board-visual/dom-runtime');
    const { createDomBoardPlaybackExecutor } = require('../ui/board-visual/dom-playback');
    const handlers = createDomBoardPlaybackHandlers({
      boardElement: document.getElementById('board'),
      documentRef: document,
      getTimer: () => ({
        setTimeout: (fn: () => void, ms: number) => setTimeout(fn, ms),
        clearTimeout: (id: any) => clearTimeout(id)
      })
    });
    const executor = createDomBoardPlaybackExecutor(handlers);
    const event = { type: 'legacy_fade_out', row: 1, col: 2, options: {} };
    const disc = document.querySelector('.disc') as HTMLElement;

    const pending = executor.playPhase([event], createPlaybackContext(event));
    await Promise.resolve();

    expect(disc.classList.contains('flip')).toBe(false);
    expect(disc.classList.contains('destroy-fade')).toBe(true);
    jest.advanceTimersByTime(700);
    await pending;
  });

  test('legacy fade-out NOANIM follows the backend without starting a DOM animation', async () => {
    document.body.innerHTML = '<div id="board"><div class="cell" data-row="1" data-col="2"><div class="disc black"></div></div></div>';
    const { createDomBoardPlaybackHandlers } = require('../ui/board-visual/dom-runtime');
    const { createDomBoardPlaybackExecutor } = require('../ui/board-visual/dom-playback');
    const handlers = createDomBoardPlaybackHandlers({
      boardElement: document.getElementById('board'),
      documentRef: document,
      isNoAnim: () => true
    });
    const executor = createDomBoardPlaybackExecutor(handlers);
    const event = { type: 'legacy_fade_out', row: 1, col: 2, options: {} };
    const disc = document.querySelector('.disc') as HTMLElement;

    await executor.playPhase([event], createPlaybackContext(event));

    expect(disc.classList.contains('destroy-fade')).toBe(false);
  });

  test('legacy hyperactive chained moves materialize through the DOM backend in NOANIM', async () => {
    document.body.innerHTML = `
      <div id="board">
        <div class="cell" data-row="3" data-col="3"></div>
        <div class="cell" data-row="3" data-col="4"></div>
        <div class="cell" data-row="3" data-col="5"><div class="disc black"></div></div>
      </div>
      <div id="card-fx-layer"></div>`;
    const { createDomBoardPlaybackHandlers } = require('../ui/board-visual/dom-runtime');
    const { createDomBoardPlaybackExecutor } = require('../ui/board-visual/dom-playback');
    const handlers = createDomBoardPlaybackHandlers({
      boardElement: document.getElementById('board'),
      documentRef: document,
      isNoAnim: () => true
    });
    const executor = createDomBoardPlaybackExecutor(handlers);
    const disc = document.querySelector('.disc') as HTMLElement;
    const firstEvent = {
      type: 'legacy_hyperactive_move',
      from: { row: 3, col: 3 },
      to: { row: 3, col: 4 },
      options: { carryDisc: disc }
    };
    await executor.playPhase([firstEvent], createPlaybackContext(firstEvent));
    expect(document.querySelector('.cell[data-col="4"] .disc')).toBe(disc);

    const secondEvent = {
      type: 'legacy_hyperactive_move',
      from: { row: 3, col: 4 },
      to: { row: 3, col: 5 },
      options: { carryDisc: disc }
    };
    await executor.playPhase([secondEvent], createPlaybackContext(secondEvent));
    expect(document.querySelector('.cell[data-col="5"] .disc')).toBe(disc);
  });

  test('legacy hyperactive geometry uses cell DTOs and board pixel variables without reading the disc rect', async () => {
    document.body.innerHTML = `
      <div id="board">
        <div class="cell" data-row="3" data-col="3"><div class="disc black"></div></div>
        <div class="cell" data-row="3" data-col="4"></div>
      </div>
      <div id="card-fx-layer"></div>`;
    const board = document.getElementById('board') as HTMLElement;
    const fxLayer = document.getElementById('card-fx-layer') as HTMLElement;
    const fromCell = document.querySelector('.cell[data-col="3"]') as HTMLElement;
    const toCell = document.querySelector('.cell[data-col="4"]') as HTMLElement;
    const disc = document.querySelector('.disc') as HTMLElement;
    board.style.setProperty('--board-disc-size-px', '65px');
    board.style.setProperty('--board-disc-inset-px', '4px');
    fxLayer.getBoundingClientRect = () => ({ left: 0, top: 0, width: 1000, height: 1000, right: 1000, bottom: 1000, x: 0, y: 0, toJSON: () => ({}) });
    fromCell.getBoundingClientRect = () => ({ left: 300.4, top: 200.4, width: 73.2, height: 73.2, right: 373.6, bottom: 273.6, x: 300.4, y: 200.4, toJSON: () => ({}) });
    toCell.getBoundingClientRect = () => ({ left: 380.4, top: 200.4, width: 73.2, height: 73.2, right: 453.6, bottom: 273.6, x: 380.4, y: 200.4, toJSON: () => ({}) });
    disc.getBoundingClientRect = jest.fn(() => {
      throw new Error('DOM backend must not read live disc geometry');
    });
    dom.window.requestAnimationFrame = ((callback: FrameRequestCallback) => {
      callback(Date.now());
      return 1;
    }) as any;
    dom.window.cancelAnimationFrame = jest.fn();
    const { createDomBoardPlaybackHandlers } = require('../ui/board-visual/dom-runtime');
    const { createDomBoardPlaybackExecutor } = require('../ui/board-visual/dom-playback');
    const handlers = createDomBoardPlaybackHandlers({ boardElement: board, documentRef: document });
    const executor = createDomBoardPlaybackExecutor(handlers);
    const event = {
      type: 'legacy_hyperactive_move',
      from: { row: 3, col: 3 },
      to: { row: 3, col: 4 },
      options: {}
    };

    const pending = executor.playPhase([event], createPlaybackContext(event));
    const ghost = fxLayer.querySelector('.hyperactive-move-ghost') as HTMLElement;
    expect(ghost).not.toBeNull();
    expect(ghost.style.left).toBe('384px');
    expect(ghost.style.top).toBe('204px');
    expect(ghost.style.width).toBe('65px');
    expect(ghost.style.height).toBe('65px');
    expect(ghost.style.transition).toContain('400ms');
    const transitionEnd = new dom.window.Event('transitionend');
    Object.defineProperty(transitionEnd, 'propertyName', { value: 'left' });
    ghost.dispatchEvent(transitionEnd);
    await pending;
    expect(toCell.querySelector('.disc')).toBe(disc);
  });

  test('sacrifice absorb pulse is owned and settled by the board backend', async () => {
    document.body.innerHTML = '<div id="board"><div class="cell" data-row="2" data-col="3"></div></div>';
    const cell = document.querySelector('.cell') as HTMLElement & { animate: jest.Mock };
    let finishPulse!: () => void;
    cell.animate = jest.fn(() => ({
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      finished: new Promise<void>((resolve) => { finishPulse = resolve; })
    }));
    const { createDomBoardPlaybackHandlers } = require('../ui/board-visual/dom-runtime');
    const { createDomBoardPlaybackExecutor } = require('../ui/board-visual/dom-playback');
    const handlers = createDomBoardPlaybackHandlers({
      boardElement: document.getElementById('board'),
      documentRef: document
    });
    const executor = createDomBoardPlaybackExecutor(handlers);
    const event = { type: 'legacy_sacrifice_absorb_pulse', row: 2, col: 3, durationMs: 2600 };
    const context = Object.freeze({
      token: Object.freeze({ id: 6, frameToken: 'local:sacrifice', mode: 'local' }),
      strictNetworkPlayback: false,
      phaseScope: Object.freeze({ events: Object.freeze([event]), phaseKey: '0', stepIndex: 0 })
    });
    let settled = false;

    const pending = executor.playPhase([event], context).then(() => { settled = true; });
    await Promise.resolve();

    expect(cell.animate).toHaveBeenCalledWith([
      { filter: 'none' },
      { filter: 'drop-shadow(0 0 16px rgba(255, 55, 55, 0.88)) brightness(1.12)' },
      { filter: 'none' }
    ], {
      duration: 2600,
      easing: 'ease-out',
      fill: 'none'
    });
    expect(settled).toBe(false);
    finishPulse();
    await pending;
    expect(settled).toBe(true);
  });
});
