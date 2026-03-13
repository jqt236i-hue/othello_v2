const { JSDOM } = require('jsdom');

describe('animation-engine observer bubble', () => {
  let dom;

  beforeEach(() => {
    jest.resetModules();
    jest.useFakeTimers();
    dom = new JSDOM('<!doctype html><html><body><div id="board"></div></body></html>', { pretendToBeVisual: true });
    global.window = dom.window;
    global.document = dom.window.document;
    global.window.__telemetry__ = { watchdogFired: 0, singleVisualWriterHits: 0, abortCount: 0 };
    global.window.getEffectKeyForSpecialType = () => null;
    global.window.applyStoneVisualEffect = () => {};

    const board = document.getElementById('board');
    const cell = document.createElement('div');
    cell.className = 'cell';
    cell.dataset.row = '2';
    cell.dataset.col = '3';
    cell.getBoundingClientRect = () => ({
      left: 120,
      top: 220,
      width: 40,
      height: 40,
      right: 160,
      bottom: 260,
      x: 120,
      y: 220,
      toJSON() { return {}; }
    });
    board.appendChild(cell);
  });

  afterEach(() => {
    jest.useRealTimers();
    if (dom && dom.window) dom.window.close();
    delete global.window;
    delete global.document;
  });

  test('observer_bubble を石アンカー近くに表示し、約3秒で消す', async () => {
    const engine = require('../ui/animation-engine');

    await engine.executeEvent({
      type: 'observer_bubble',
      targets: [{ r: 2, col: 3, owner: 'black', gained: 4 }]
    });

    let bubble = document.querySelector('.observer-speech-bubble');
    expect(bubble).not.toBeNull();
    expect(bubble.dataset.row).toBe('2');
    expect(bubble.dataset.col).toBe('3');
    expect(bubble.style.pointerEvents).toBe('none');
    expect(bubble.textContent).toContain('布石+4 観測が捗る');

    jest.advanceTimersByTime(3200);

    bubble = document.querySelector('.observer-speech-bubble');
    expect(bubble).toBeNull();
  });

  test('observer_bubble で text 指定がある場合はその文言を表示する', async () => {
    const engine = require('../ui/animation-engine');

    await engine.executeEvent({
      type: 'observer_bubble',
      targets: [{ r: 2, col: 3, owner: 'white', gained: 0, text: '盤理観測してる場合じゃなかったわ' }]
    });

    const bubble = document.querySelector('.observer-speech-bubble');
    expect(bubble).not.toBeNull();
    expect(bubble.textContent).toContain('盤理観測してる場合じゃなかったわ');
    expect(bubble.textContent).not.toContain('観測が捗る');
  });
});
