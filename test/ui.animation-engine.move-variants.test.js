const { JSDOM } = require('jsdom');

const CASES = [
  ['STRONG_WIND_WILL', 'strong_wind_move', 'scale(1.08)'],
  ['SUPER_BUOYANCY_WILL', 'super_buoyancy_move', 'scale(1.06)'],
  ['SUPER_GRAVITY_WILL', 'super_gravity_move', 'scale(1.05)']
];

describe.each(CASES)('animation-engine move variants %s', (cause, reason, midpointScale) => {
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

    const engine = require('../ui/animation-engine');
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
    expect(animateCalls[0]).toHaveLength(3);
    expect(String(animateCalls[0][1].transform)).toContain(midpointScale);
  });
});
