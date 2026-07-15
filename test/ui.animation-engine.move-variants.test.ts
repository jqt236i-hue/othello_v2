import { JSDOM } from 'jsdom';
import { installAnimationEngineDomBackendMock } from './helpers/animation-engine-dom-backend';

installAnimationEngineDomBackendMock();

const CASES = [
  ['STRONG_WIND_WILL', 'strong_wind_move', 'scale(1.08)', 400],
  ['SUPER_BUOYANCY_WILL', 'super_buoyancy_move', 'scale(1.06)', 400],
  ['SUPER_GRAVITY_WILL', 'super_gravity_move', 'scale(1.05)', 400],
  ['SUPER_ATTRACTION_WILL', 'super_attraction_move', 'scale(1.05)', 200]
];

describe.each(CASES)('animation-engine move variants %s', (cause, reason, midpointScale, expectedDurationMs) => {
  let dom;

  beforeEach(() => {
    jest.resetModules();
    dom = new JSDOM('<!doctype html><html><body><div id="board"></div></body></html>');
    global.window = dom.window;
    global.document = dom.window.document;
    global.emitBoardUpdate = jest.fn();
  });

  afterEach(() => {
    delete (global as any).getEffectKeyForSpecialType;
    delete (global as any).applyStoneVisualEffect;
    delete (global as any).clearStoneVisualEffectState;
    delete global.window;
    delete global.document;
    delete global.emitBoardUpdate;
    if (dom && dom.window && typeof dom.window.close === 'function') {
      dom.window.close();
    }
  });

  test('uses a dedicated 3-keyframe ghost animation', async () => {
    const board = document.getElementById('board');
    const fromCell = document.createElement('div');
    const toCell = document.createElement('div');
    const disc = document.createElement('div');
    const animateCalls = [];

    fromCell.className = 'cell';
    fromCell.dataset.row = '2';
    fromCell.dataset.col = '2';
    fromCell.getBoundingClientRect = () => ({ left: 20, top: 20, width: 50, height: 50 });

    toCell.className = 'cell';
    toCell.dataset.row = '2';
    toCell.dataset.col = '4';
    toCell.getBoundingClientRect = () => ({ left: 140, top: 20, width: 50, height: 50 });

    disc.className = 'disc black';
    fromCell.appendChild(disc);
    board.appendChild(fromCell);
    board.appendChild(toCell);

    global.window.Element.prototype.animate = jest.fn((keyframes, options) => {
      animateCalls.push({ keyframes, options });
      return {
        addEventListener(eventName, handler) {
          if (eventName === 'finish' && typeof handler === 'function') {
            handler();
          }
        },
        removeEventListener() {},
        finished: Promise.resolve()
      };
    });

    const engine = require('../ui/animation-engine.js');
    await engine.handleMove({
      type: 'move',
      targets: [{
        from: { r: 2, col: 2 },
        to: { r: 2, col: 4 },
        ownerAfter: 'black',
        cause,
        reason
      }]
    });

    expect(animateCalls).toHaveLength(1);
    expect(animateCalls[0].keyframes).toHaveLength(3);
    expect(String(animateCalls[0].keyframes[1].transform)).toContain(midpointScale);
    expect(animateCalls[0].options.duration).toBe(expectedDurationMs);
  });

  test('animates network snapshot move when source cell is already empty', async () => {
    const board = document.getElementById('board');
    const fromCell = document.createElement('div');
    const toCell = document.createElement('div');
    const destinationDisc = document.createElement('div');
    const animateCalls = [];

    fromCell.className = 'cell';
    fromCell.dataset.row = '2';
    fromCell.dataset.col = '2';
    fromCell.getBoundingClientRect = () => ({ left: 20, top: 20, width: 50, height: 50 });

    toCell.className = 'cell has-disc';
    toCell.dataset.row = '2';
    toCell.dataset.col = '4';
    toCell.getBoundingClientRect = () => ({ left: 140, top: 20, width: 50, height: 50 });

    destinationDisc.className = 'disc black';
    toCell.appendChild(destinationDisc);
    board.appendChild(fromCell);
    board.appendChild(toCell);

    global.window.Element.prototype.animate = jest.fn((keyframes, options) => {
      animateCalls.push({ keyframes, options });
      return {
        addEventListener(eventName, handler) {
          if (eventName === 'finish' && typeof handler === 'function') {
            handler();
          }
        },
        removeEventListener() {},
        finished: Promise.resolve()
      };
    });

    const engine = require('../ui/animation-engine.js');
    await engine.handleMove({
      type: 'move',
      targets: [{
        from: { r: 2, col: 2 },
        to: { r: 2, col: 4 },
        ownerAfter: 'black',
        cause,
        reason,
        meta: {
          moveIntent: reason === 'strong_wind_move' ? 'wind_move' : 'crush_move'
        },
        after: { color: 1, special: null, timer: null, owner: 'black' }
      }]
    });

    expect(animateCalls).toHaveLength(1);
    expect(animateCalls[0].keyframes).toHaveLength(3);
    expect(String(animateCalls[0].keyframes[1].transform)).toContain(midpointScale);
    expect(animateCalls[0].options.duration).toBe(expectedDurationMs);
    expect(fromCell.querySelector('.disc')).toBeNull();
    expect(toCell.querySelector('.disc.black')).toBe(destinationDisc);
  });
});

describe('animation-engine super attraction waypoint path', () => {
  let dom;

  beforeEach(() => {
    jest.resetModules();
    dom = new JSDOM('<!doctype html><html><body><div id="board"></div></body></html>');
    global.window = dom.window;
    global.document = dom.window.document;
    global.emitBoardUpdate = jest.fn();
  });

  afterEach(() => {
    delete global.window;
    delete global.document;
    delete global.emitBoardUpdate;
    if (dom && dom.window && typeof dom.window.close === 'function') {
      dom.window.close();
    }
  });

  test('follows the supplied bend waypoint during super attraction movement', async () => {
    const board = document.getElementById('board');
    const fromCell = document.createElement('div');
    const bendCell = document.createElement('div');
    const toCell = document.createElement('div');
    const disc = document.createElement('div');
    const animateCalls = [];

    fromCell.className = 'cell';
    fromCell.dataset.row = '2';
    fromCell.dataset.col = '2';
    fromCell.getBoundingClientRect = () => ({ left: 20, top: 20, width: 50, height: 50 });

    bendCell.className = 'cell';
    bendCell.dataset.row = '4';
    bendCell.dataset.col = '4';
    bendCell.getBoundingClientRect = () => ({ left: 140, top: 140, width: 50, height: 50 });

    toCell.className = 'cell';
    toCell.dataset.row = '5';
    toCell.dataset.col = '4';
    toCell.getBoundingClientRect = () => ({ left: 140, top: 200, width: 50, height: 50 });

    disc.className = 'disc black';
    fromCell.appendChild(disc);
    board.appendChild(fromCell);
    board.appendChild(bendCell);
    board.appendChild(toCell);

    global.window.Element.prototype.animate = jest.fn((keyframes, options) => {
      animateCalls.push({ keyframes, options });
      return {
        addEventListener(eventName, handler) {
          if (eventName === 'finish' && typeof handler === 'function') {
            handler();
          }
        },
        removeEventListener() {},
        finished: Promise.resolve()
      };
    });

    const engine = require('../ui/animation-engine.js');
    await engine.handleMove({
      type: 'move',
      targets: [{
        from: { r: 2, col: 2 },
        to: { r: 5, col: 4 },
        ownerAfter: 'black',
        cause: 'SUPER_ATTRACTION_WILL',
        reason: 'super_attraction_move',
        meta: {
          moveIntent: 'crush_move',
          waypoints: [{ row: 4, col: 4 }, { row: 5, col: 4 }],
          segments: [
            { from: { row: 2, col: 2 }, to: { row: 4, col: 4 }, dr: 1, dc: 1, length: 2 },
            { from: { row: 4, col: 4 }, to: { row: 5, col: 4 }, dr: 1, dc: 0, length: 1 }
          ]
        }
      }]
    });

    expect(animateCalls).toHaveLength(1);
    expect(animateCalls[0].keyframes).toHaveLength(3);
    expect(String(animateCalls[0].keyframes[1].transform)).toContain('translate(120px, 120px)');
    expect(animateCalls[0].keyframes[1].offset).toBeCloseTo(2 / 3, 5);
    expect(String(animateCalls[0].keyframes[2].transform)).toContain('translate(120px, 180px)');
  });
});

describe.each([
  ['GLUTTONOUS_WILL', 'gluttonous_eat_overlap_return'],
  ['WILL_HUNTER_KING', 'will_hunter_king_slash_overlap_return']
])('animation-engine overlap return %s', (cause, reason) => {
  let dom;

  beforeEach(() => {
    jest.resetModules();
    dom = new JSDOM('<!doctype html><html><body><div id="board"></div></body></html>');
    global.window = dom.window;
    global.document = dom.window.document;
    global.emitBoardUpdate = jest.fn();
  });

  afterEach(() => {
    delete global.window;
    delete global.document;
    delete global.emitBoardUpdate;
    if (dom && dom.window && typeof dom.window.close === 'function') {
      dom.window.close();
    }
  });

  test('animates out-and-back without relocating source or target discs', async () => {
    const board = document.getElementById('board');
    const fromCell = document.createElement('div');
    const toCell = document.createElement('div');
    const sourceDisc = document.createElement('div');
    const targetDisc = document.createElement('div');
    const animateCalls = [];

    fromCell.className = 'cell';
    fromCell.dataset.row = '3';
    fromCell.dataset.col = '3';
    fromCell.getBoundingClientRect = () => ({ left: 20, top: 20, width: 50, height: 50 });

    toCell.className = 'cell';
    toCell.dataset.row = '3';
    toCell.dataset.col = '4';
    toCell.getBoundingClientRect = () => ({ left: 90, top: 20, width: 50, height: 50 });

    sourceDisc.className = 'disc black';
    targetDisc.className = 'disc white';
    fromCell.appendChild(sourceDisc);
    toCell.appendChild(targetDisc);
    board.appendChild(fromCell);
    board.appendChild(toCell);

    global.window.Element.prototype.animate = jest.fn((keyframes) => {
      animateCalls.push(keyframes);
      return {
        addEventListener(eventName, handler) {
          if (eventName === 'finish' && typeof handler === 'function') {
            handler();
          }
        },
        removeEventListener() {},
        finished: Promise.resolve()
      };
    });

    const engine = require('../ui/animation-engine.js');
    await engine.handleMove({
      type: 'move',
      targets: [{
        from: { r: 3, col: 3 },
        to: { r: 3, col: 4 },
        ownerAfter: 'black',
        cause,
        reason,
        after: { color: 1, special: cause === 'GLUTTONOUS_WILL' ? 'GLUTTONOUS' : 'WILL_HUNTER_KING', timer: null, owner: 'black' }
      }]
    });

    expect(animateCalls).toHaveLength(1);
    expect(animateCalls[0]).toHaveLength(3);
    expect(String(animateCalls[0][0].transform)).toContain('translate(0, 0)');
    expect(String(animateCalls[0][2].transform)).toContain('translate(0, 0)');
    expect(fromCell.querySelectorAll('.disc.black')).toHaveLength(1);
    expect(toCell.querySelectorAll('.disc.white')).toHaveLength(1);
  });

  test('removes the overlap ghost before restoring the hidden source disc', async () => {
    const board = document.getElementById('board');
    const fromCell = document.createElement('div');
    const toCell = document.createElement('div');
    const sourceDisc = document.createElement('div');
    const targetDisc = document.createElement('div');
    let sourceVisibilityAtGhostRemoval = null;

    fromCell.className = 'cell';
    fromCell.dataset.row = '4';
    fromCell.dataset.col = '2';
    fromCell.getBoundingClientRect = () => ({ left: 20, top: 20, width: 50, height: 50 });

    toCell.className = 'cell';
    toCell.dataset.row = '4';
    toCell.dataset.col = '3';
    toCell.getBoundingClientRect = () => ({ left: 90, top: 20, width: 50, height: 50 });

    sourceDisc.className = 'disc black';
    targetDisc.className = 'disc white';
    fromCell.appendChild(sourceDisc);
    toCell.appendChild(targetDisc);
    board.appendChild(fromCell);
    board.appendChild(toCell);

    global.window.Element.prototype.animate = jest.fn(() => ({
      addEventListener(eventName, handler) {
        if (eventName === 'finish' && typeof handler === 'function') {
          handler();
        }
      },
      removeEventListener() {},
      finished: Promise.resolve()
    }));

    const originalRemoveChild = document.body.removeChild.bind(document.body);
    jest.spyOn(document.body, 'removeChild').mockImplementation((node) => {
      if (node && node.classList && node.classList.contains('disc')) {
        sourceVisibilityAtGhostRemoval = sourceDisc.style.visibility;
      }
      return originalRemoveChild(node);
    });

    const engine = require('../ui/animation-engine.js');
    await engine.handleMove({
      type: 'move',
      targets: [{
        from: { r: 4, col: 2 },
        to: { r: 4, col: 3 },
        ownerAfter: 'black',
        cause,
        reason,
        after: { color: 1, special: cause === 'GLUTTONOUS_WILL' ? 'GLUTTONOUS' : 'WILL_HUNTER_KING', timer: null, owner: 'black' }
      }]
    });

    expect(sourceVisibilityAtGhostRemoval).toBe('hidden');
    expect(sourceDisc.style.visibility).toBe('visible');
  });

  test('keeps the destination disc visible while the overlap-return ghost is in flight', async () => {
    const board = document.getElementById('board');
    const fromCell = document.createElement('div');
    const toCell = document.createElement('div');
    const sourceDisc = document.createElement('div');
    const targetDisc = document.createElement('div');

    fromCell.className = 'cell';
    fromCell.dataset.row = '5';
    fromCell.dataset.col = '1';
    fromCell.getBoundingClientRect = () => ({ left: 20, top: 20, width: 50, height: 50 });

    toCell.className = 'cell';
    toCell.dataset.row = '5';
    toCell.dataset.col = '2';
    toCell.getBoundingClientRect = () => ({ left: 90, top: 20, width: 50, height: 50 });

    sourceDisc.className = 'disc black';
    targetDisc.className = 'disc white';
    fromCell.appendChild(sourceDisc);
    toCell.appendChild(targetDisc);
    board.appendChild(fromCell);
    board.appendChild(toCell);

    let finishAnimation = null;
    const finished = new Promise((resolve) => {
      finishAnimation = resolve;
    });

    global.window.Element.prototype.animate = jest.fn(() => ({
      addEventListener(eventName, handler) {
        if (eventName === 'finish' && typeof handler === 'function') {
          finished.then(handler);
        }
      },
      removeEventListener() {},
      finished
    }));

    const engine = require('../ui/animation-engine.js');
    const playbackPromise = engine.handleMove({
      type: 'move',
      targets: [{
        from: { r: 5, col: 1 },
        to: { r: 5, col: 2 },
        ownerAfter: 'black',
        cause,
        reason,
        after: { color: 1, special: cause === 'GLUTTONOUS_WILL' ? 'GLUTTONOUS' : 'WILL_HUNTER_KING', timer: null, owner: 'black' }
      }]
    });

    await Promise.resolve();
    expect(sourceDisc.style.visibility).toBe('hidden');
    expect(targetDisc.style.visibility).not.toBe('hidden');

    finishAnimation();
    await playbackPromise;

    expect(sourceDisc.style.visibility).toBe('visible');
    expect(targetDisc.style.visibility).not.toBe('hidden');
  });
});

describe('animation-engine hyperactive source-empty move', () => {
  let dom;

  beforeEach(() => {
    jest.resetModules();
    dom = new JSDOM('<!doctype html><html><body><div id="board"></div></body></html>');
    global.window = dom.window;
    global.document = dom.window.document;
    global.emitBoardUpdate = jest.fn();
  });

  afterEach(() => {
    delete global.window;
    delete global.document;
    delete global.emitBoardUpdate;
    if (dom && dom.window && typeof dom.window.close === 'function') {
      dom.window.close();
    }
  });

  test('uses a playback-only ghost and keeps exactly one cell disc at destination', async () => {
    const board = document.getElementById('board');
    const fromCell = document.createElement('div');
    const toCell = document.createElement('div');
    const destinationDisc = document.createElement('div');
    let finishHandler = null;

    fromCell.className = 'cell';
    fromCell.dataset.row = '3';
    fromCell.dataset.col = '3';
    fromCell.getBoundingClientRect = () => ({ left: 20, top: 20, width: 50, height: 50 });

    toCell.className = 'cell has-disc';
    toCell.dataset.row = '4';
    toCell.dataset.col = '3';
    toCell.getBoundingClientRect = () => ({ left: 20, top: 90, width: 50, height: 50 });

    destinationDisc.className = 'disc black';
    toCell.appendChild(destinationDisc);
    board.appendChild(fromCell);
    board.appendChild(toCell);

    global.window.Element.prototype.animate = jest.fn(() => ({
      addEventListener(eventName, handler) {
        if (eventName === 'finish') finishHandler = handler;
      },
      removeEventListener() {},
      finished: new Promise(() => {})
    }));

    const engine = require('../ui/animation-engine.js');
    const movePromise = engine.handleMove({
      type: 'move',
      targets: [{
        from: { r: 3, col: 3 },
        to: { r: 4, col: 3 },
        ownerAfter: 'black',
        cause: 'HYPERACTIVE',
        reason: 'hyperactive_move',
        meta: { moveIntent: 'hyperactive_move' },
        after: { color: 1, special: 'HYPERACTIVE', timer: 8, owner: 'black' }
      }]
    });

    await Promise.resolve();
    await Promise.resolve();

    expect(fromCell.querySelectorAll('.disc')).toHaveLength(0);
    expect(toCell.querySelectorAll('.disc')).toHaveLength(1);
    expect(toCell.querySelector('.disc')).toBe(destinationDisc);
    expect(destinationDisc.style.visibility).toBe('hidden');

    expect(typeof finishHandler).toBe('function');
    finishHandler();
    await movePromise;

    expect(fromCell.querySelectorAll('.disc')).toHaveLength(0);
    expect(toCell.querySelectorAll('.disc')).toHaveLength(1);
    expect(toCell.querySelector('.disc')).toBe(destinationDisc);
    expect(destinationDisc.style.visibility).toBe('visible');
  });
});

describe('animation-engine extreme forced swap playback', () => {
  let dom;

  beforeEach(() => {
    jest.resetModules();
    dom = new JSDOM('<!doctype html><html><body><div id="board"></div></body></html>');
    global.window = dom.window;
    global.document = dom.window.document;
    global.emitBoardUpdate = jest.fn();
  });

  afterEach(() => {
    delete (global as any).getEffectKeyForSpecialType;
    delete (global as any).applyStoneVisualEffect;
    delete (global as any).clearStoneVisualEffectState;
    delete global.window;
    delete global.document;
    delete global.emitBoardUpdate;
    if (dom && dom.window && typeof dom.window.close === 'function') {
      dom.window.close();
    }
  });

  test('overlaps the occupied destination first, then sends the displaced stone back to the source cell', async () => {
    const board = document.getElementById('board');
    const fromCell = document.createElement('div');
    const toCell = document.createElement('div');
    const sourceDisc = document.createElement('div');
    const targetDisc = document.createElement('div');
    const animateCalls = [];
    let finishFirstAnimation = null;
    let finishSecondAnimation = null;

    fromCell.className = 'cell';
    fromCell.dataset.row = '6';
    fromCell.dataset.col = '2';
    fromCell.getBoundingClientRect = () => ({ left: 20, top: 20, width: 50, height: 50 });

    toCell.className = 'cell';
    toCell.dataset.row = '6';
    toCell.dataset.col = '3';
    toCell.getBoundingClientRect = () => ({ left: 90, top: 20, width: 50, height: 50 });

    sourceDisc.className = 'disc black';
    targetDisc.className = 'disc white';
    fromCell.appendChild(sourceDisc);
    toCell.appendChild(targetDisc);
    board.appendChild(fromCell);
    board.appendChild(toCell);

    global.window.Element.prototype.animate = jest.fn((keyframes) => {
      animateCalls.push(keyframes);
      const animationIndex = animateCalls.length;
      let finished = Promise.resolve();
      if (animationIndex === 1) {
        finished = new Promise((resolve) => {
          finishFirstAnimation = resolve;
        });
      } else if (animationIndex === 2) {
        finished = new Promise((resolve) => {
          finishSecondAnimation = resolve;
        });
      }
      return {
        addEventListener(eventName, handler) {
          if (eventName === 'finish' && typeof handler === 'function') {
            finished.then(handler);
          }
        },
        removeEventListener() {},
        finished
      };
    });

    const engine = require('../ui/animation-engine.js');
    const playPromise = engine.handleMove({
      type: 'move',
      meta: { sequence: 'extreme_hyperactive_forced_swap' },
      targets: [{
        from: { r: 6, col: 2 },
        to: { r: 6, col: 3 },
        ownerBefore: 'black',
        ownerAfter: 'black',
        cause: 'EXTREME_HYPERACTIVE_WILL',
        reason: 'extreme_hyperactive_forced_swap',
        extremeForcedSwapRole: 'lead',
        after: { color: 1, special: 'EXTREME_HYPERACTIVE', timer: 5, owner: 'black' }
      }, {
        from: { r: 6, col: 3 },
        to: { r: 6, col: 2 },
        ownerBefore: 'white',
        ownerAfter: 'white',
        cause: 'EXTREME_HYPERACTIVE_WILL',
        reason: 'extreme_hyperactive_forced_swap',
        extremeForcedSwapRole: 'follow',
        after: { color: -1, special: null, timer: null, owner: 'white' }
      }]
    });

    await Promise.resolve();
    await Promise.resolve();

    expect(animateCalls).toHaveLength(1);
    expect(animateCalls[0]).toHaveLength(3);
    expect(String(animateCalls[0][2].transform)).toContain('scale(1.06)');
    expect(sourceDisc.style.visibility).toBe('hidden');
    expect(targetDisc.style.visibility).toBe('hidden');
    expect(toCell.querySelectorAll('.disc.white')).toHaveLength(1);

    finishFirstAnimation();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(animateCalls).toHaveLength(2);
    expect(fromCell.querySelectorAll('.disc.black')).toHaveLength(0);
    expect(toCell.querySelectorAll('.disc.black')).toHaveLength(1);

    finishSecondAnimation();
    await playPromise;

    expect(animateCalls).toHaveLength(2);
    expect(fromCell.querySelectorAll('.disc.white')).toHaveLength(1);
    expect(fromCell.querySelectorAll('.disc.black')).toHaveLength(0);
    expect(toCell.querySelectorAll('.disc.black')).toHaveLength(1);
    expect(toCell.querySelectorAll('.disc.white')).toHaveLength(0);
  });

  test('does not duplicate the extreme visual when the board DOM already reflects the swapped state', async () => {
    const board = document.getElementById('board');
    const fromCell = document.createElement('div');
    const toCell = document.createElement('div');
    const displacedDisc = document.createElement('div');
    const extremeDisc = document.createElement('div');
    const animateCalls = [];
    let finishFirstAnimation = null;
    let finishSecondAnimation = null;

    fromCell.className = 'cell';
    fromCell.dataset.row = '4';
    fromCell.dataset.col = '1';
    fromCell.getBoundingClientRect = () => ({ left: 20, top: 20, width: 50, height: 50 });

    toCell.className = 'cell';
    toCell.dataset.row = '4';
    toCell.dataset.col = '2';
    toCell.getBoundingClientRect = () => ({ left: 90, top: 20, width: 50, height: 50 });

    displacedDisc.className = 'disc white';
    extremeDisc.className = 'disc black';
    board.appendChild(fromCell);
    board.appendChild(toCell);
    fromCell.appendChild(displacedDisc);
    toCell.appendChild(extremeDisc);

    global.window.Element.prototype.animate = jest.fn((keyframes) => {
      animateCalls.push(keyframes);
      const animationIndex = animateCalls.length;
      let finished = Promise.resolve();
      if (animationIndex === 1) {
        finished = new Promise((resolve) => {
          finishFirstAnimation = resolve;
        });
      } else if (animationIndex === 2) {
        finished = new Promise((resolve) => {
          finishSecondAnimation = resolve;
        });
      }
      return {
        addEventListener(eventName, handler) {
          if (eventName === 'finish' && typeof handler === 'function') {
            finished.then(handler);
          }
        },
        removeEventListener() {},
        finished
      };
    });

    const engine = require('../ui/animation-engine.js');
    window.getEffectKeyForSpecialType = jest.fn((specialType) => (
      String(specialType || '').toUpperCase() === 'EXTREME_HYPERACTIVE' ? 'extremeHyperactiveStone' : null
    ));
    window.applyStoneVisualEffect = jest.fn((disc, effectKey) => {
      if (!disc || effectKey !== 'extremeHyperactiveStone') return;
      disc.classList.add('special-stone', 'extreme-hyperactive-visual');
    });
    window.clearStoneVisualEffectState = jest.fn((disc) => {
      if (!disc) return;
      disc.classList.remove('special-stone', 'extreme-hyperactive-visual');
    });
    (global as any).getEffectKeyForSpecialType = window.getEffectKeyForSpecialType;
    (global as any).applyStoneVisualEffect = window.applyStoneVisualEffect;
    (global as any).clearStoneVisualEffectState = window.clearStoneVisualEffectState;
    window.applyStoneVisualEffect(extremeDisc, 'extremeHyperactiveStone');
    const playPromise = engine.handleMove({
      type: 'move',
      meta: { sequence: 'extreme_hyperactive_forced_swap' },
      targets: [{
        from: { r: 4, col: 1 },
        to: { r: 4, col: 2 },
        ownerBefore: 'black',
        ownerAfter: 'black',
        cause: 'EXTREME_HYPERACTIVE_WILL',
        reason: 'extreme_hyperactive_forced_swap',
        extremeForcedSwapRole: 'lead',
        after: { color: 1, special: 'EXTREME_HYPERACTIVE', timer: 5, owner: 'black' }
      }, {
        from: { r: 4, col: 2 },
        to: { r: 4, col: 1 },
        ownerBefore: 'white',
        ownerAfter: 'white',
        cause: 'EXTREME_HYPERACTIVE_WILL',
        reason: 'extreme_hyperactive_forced_swap',
        extremeForcedSwapRole: 'follow',
        after: { color: -1, special: null, timer: null, owner: 'white' }
      }]
    });

    await Promise.resolve();
    await Promise.resolve();
    expect(animateCalls).toHaveLength(1);

    finishFirstAnimation();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(animateCalls).toHaveLength(2);
    expect(document.body.querySelectorAll('.extreme-hyperactive-visual')).toHaveLength(1);
    expect(document.body.querySelectorAll('.special-stone')).toHaveLength(1);

    finishSecondAnimation();
    await playPromise;

    expect(fromCell.querySelectorAll('.disc.white')).toHaveLength(1);
    expect(fromCell.querySelectorAll('.extreme-hyperactive-visual')).toHaveLength(0);
    expect(toCell.querySelectorAll('.disc.black')).toHaveLength(1);
    expect(toCell.querySelectorAll('.extreme-hyperactive-visual')).toHaveLength(1);
  });

  test('applies the forced-swap final state immediately in no-anim mode', async () => {
    const board = document.getElementById('board');
    const fromCell = document.createElement('div');
    const toCell = document.createElement('div');
    const sourceDisc = document.createElement('div');
    const targetDisc = document.createElement('div');

    fromCell.className = 'cell';
    fromCell.dataset.row = '1';
    fromCell.dataset.col = '1';
    fromCell.getBoundingClientRect = () => ({ left: 20, top: 20, width: 50, height: 50 });

    toCell.className = 'cell';
    toCell.dataset.row = '1';
    toCell.dataset.col = '2';
    toCell.getBoundingClientRect = () => ({ left: 90, top: 20, width: 50, height: 50 });

    sourceDisc.className = 'disc black';
    targetDisc.className = 'disc white';
    fromCell.appendChild(sourceDisc);
    toCell.appendChild(targetDisc);
    board.appendChild(fromCell);
    board.appendChild(toCell);

    window.DISABLE_ANIMATIONS = true;

    const engine = require('../ui/animation-engine.js');
    await engine.handleMove({
      type: 'move',
      meta: { sequence: 'extreme_hyperactive_forced_swap' },
      targets: [{
        from: { r: 1, col: 1 },
        to: { r: 1, col: 2 },
        ownerBefore: 'black',
        ownerAfter: 'black',
        cause: 'EXTREME_HYPERACTIVE_WILL',
        reason: 'extreme_hyperactive_forced_swap',
        extremeForcedSwapRole: 'lead',
        after: { color: 1, special: 'EXTREME_HYPERACTIVE', timer: 5, owner: 'black' }
      }, {
        from: { r: 1, col: 2 },
        to: { r: 1, col: 1 },
        ownerBefore: 'white',
        ownerAfter: 'white',
        cause: 'EXTREME_HYPERACTIVE_WILL',
        reason: 'extreme_hyperactive_forced_swap',
        extremeForcedSwapRole: 'follow',
        after: { color: -1, special: null, timer: null, owner: 'white' }
      }]
    });

    expect(fromCell.querySelectorAll('.disc.white')).toHaveLength(1);
    expect(fromCell.querySelectorAll('.disc.black')).toHaveLength(0);
    expect(toCell.querySelectorAll('.disc.black')).toHaveLength(1);
    expect(toCell.querySelectorAll('.disc.white')).toHaveLength(0);
  });

  test('ignores malformed forced-swap payloads without throwing', async () => {
    const engine = require('../ui/animation-engine.js');
    await expect(engine.handleMove({
      type: 'move',
      meta: { sequence: 'extreme_hyperactive_forced_swap' },
      targets: [{
        from: { r: 2, col: 2 },
        to: null,
        cause: 'EXTREME_HYPERACTIVE_WILL',
        reason: 'extreme_hyperactive_forced_swap'
      }]
    })).resolves.toBeUndefined();
  });
});

describe('animation-engine network move final visual state', () => {
  let dom;

  beforeEach(() => {
    jest.resetModules();
    dom = new JSDOM('<!doctype html><html><body><div id="board"></div></body></html>');
    global.window = dom.window;
    global.document = dom.window.document;
    global.emitBoardUpdate = jest.fn();
  });

  afterEach(() => {
    delete global.window;
    delete global.document;
    delete global.emitBoardUpdate;
    if (dom && dom.window && typeof dom.window.close === 'function') {
      dom.window.close();
    }
  });

  test('syncs a source-empty network move to the supplied special after-state', async () => {
    const board = document.getElementById('board');
    const fromCell = document.createElement('div');
    const toCell = document.createElement('div');
    const destinationDisc = document.createElement('div');
    const animateCalls = [];

    fromCell.className = 'cell';
    fromCell.dataset.row = '4';
    fromCell.dataset.col = '4';
    fromCell.getBoundingClientRect = () => ({ left: 20, top: 20, width: 50, height: 50 });

    toCell.className = 'cell has-disc';
    toCell.dataset.row = '5';
    toCell.dataset.col = '5';
    toCell.getBoundingClientRect = () => ({ left: 90, top: 90, width: 50, height: 50 });

    destinationDisc.className = 'disc black';
    toCell.appendChild(destinationDisc);
    board.appendChild(fromCell);
    board.appendChild(toCell);

    window.getEffectKeyForSpecialType = jest.fn((specialType) => (
      String(specialType || '').toUpperCase() === 'ESCAPE_HYPERACTIVE' ? 'escapeHyperactiveStone' : null
    ));
    window.applyStoneVisualEffect = jest.fn((disc, effectKey) => {
      if (effectKey === 'escapeHyperactiveStone') {
        disc.classList.add('special-stone', 'escape-hyperactive-visual');
      }
    });
    window.clearStoneVisualEffectState = jest.fn((disc) => {
      if (disc) disc.classList.remove('special-stone', 'escape-hyperactive-visual');
    });

    global.window.Element.prototype.animate = jest.fn((keyframes, options) => {
      animateCalls.push({ keyframes, options });
      return {
        addEventListener(eventName, handler) {
          if (eventName === 'finish' && typeof handler === 'function') {
            handler();
          }
        },
        removeEventListener() {},
        finished: Promise.resolve()
      };
    });

    const engine = require('../ui/animation-engine.js');
    await engine.handleMove({
      type: 'move',
      targets: [{
        from: { r: 4, col: 4 },
        to: { r: 5, col: 5 },
        ownerBefore: 'black',
        ownerAfter: 'black',
        cause: 'ESCAPE_HYPERACTIVE',
        reason: 'escape_hyperactive_move',
        meta: { moveIntent: 'hyperactive_move', special: 'ESCAPE_HYPERACTIVE' },
        after: {
          color: 1,
          owner: 'black',
          special: 'ESCAPE_HYPERACTIVE',
          timer: 5,
          flipEvadeRemaining: 1
        }
      }]
    });

    expect(animateCalls).toHaveLength(1);
    expect(fromCell.querySelector('.disc')).toBeNull();
    expect(toCell.querySelector('.disc')).toBe(destinationDisc);
    expect(destinationDisc.classList.contains('special-stone')).toBe(true);
    expect(destinationDisc.querySelector('.flip-evade-timer').textContent).toBe('1');
  });
});

describe('animation-engine move animation finish fallback', () => {
  let dom;

  beforeEach(() => {
    jest.resetModules();
    dom = new JSDOM('<!doctype html><html><body><div id="board"></div></body></html>');
    global.window = dom.window;
    global.document = dom.window.document;
    global.emitBoardUpdate = jest.fn();
  });

  afterEach(() => {
    jest.useRealTimers();
    delete global.window;
    delete global.document;
    delete global.emitBoardUpdate;
    if (dom && dom.window && typeof dom.window.close === 'function') {
      dom.window.close();
    }
  });

  test('completes move playback from animation.finished even when finish events never fire', async () => {
    jest.useFakeTimers();

    const board = document.getElementById('board');
    const fromCell = document.createElement('div');
    const toCell = document.createElement('div');
    const disc = document.createElement('div');

    fromCell.className = 'cell';
    fromCell.dataset.row = '1';
    fromCell.dataset.col = '1';
    fromCell.getBoundingClientRect = () => ({ left: 20, top: 20, width: 50, height: 50 });

    toCell.className = 'cell';
    toCell.dataset.row = '1';
    toCell.dataset.col = '3';
    toCell.getBoundingClientRect = () => ({ left: 140, top: 20, width: 50, height: 50 });

    disc.className = 'disc black';
    fromCell.appendChild(disc);
    board.appendChild(fromCell);
    board.appendChild(toCell);

    let finishAnimation = null;
    const finished = new Promise((resolve) => {
      finishAnimation = resolve;
    });

    global.window.Element.prototype.animate = jest.fn(() => ({
      addEventListener() {},
      removeEventListener() {},
      finished
    }));

    const engine = require('../ui/animation-engine.js');
    const settled = jest.fn();
    const playbackPromise = engine.handleMove({
      type: 'move',
      targets: [{
        from: { r: 1, col: 1 },
        to: { r: 1, col: 3 },
        ownerAfter: 'black',
        cause: 'STRONG_WIND_WILL',
        reason: 'strong_wind_move',
        after: { color: 1, special: null, timer: null, owner: 'black' }
      }]
    });
    playbackPromise.then(settled);

    await Promise.resolve();
    expect(settled).not.toHaveBeenCalled();

    finishAnimation();
    await jest.advanceTimersByTimeAsync(0);

    expect(settled).toHaveBeenCalledTimes(1);
    expect(fromCell.querySelector('.disc')).toBeNull();
    expect(toCell.querySelector('.disc')).toBe(disc);

    jest.runOnlyPendingTimers();
    await playbackPromise;
  });
});
