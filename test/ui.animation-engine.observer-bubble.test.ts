import { JSDOM } from 'jsdom';
import { installPreparedDomBoardDependencies } from './helpers/feature-stylesheet-test-helpers';

const ORIGINAL_NOANIM = process.env.NOANIM;
const ORIGINAL_DISABLE_ANIMATIONS = process.env.DISABLE_ANIMATIONS;

function restoreAnimationEnv(): void {
  if (typeof ORIGINAL_NOANIM === 'undefined') delete process.env.NOANIM;
  else process.env.NOANIM = ORIGINAL_NOANIM;
  if (typeof ORIGINAL_DISABLE_ANIMATIONS === 'undefined') delete process.env.DISABLE_ANIMATIONS;
  else process.env.DISABLE_ANIMATIONS = ORIGINAL_DISABLE_ANIMATIONS;
}

describe('animation-engine observer bubble', () => {
  let dom;

  beforeEach(() => {
    delete process.env.NOANIM;
    delete process.env.DISABLE_ANIMATIONS;
    jest.resetModules();
    jest.useFakeTimers();
    dom = new JSDOM('<!doctype html><html><body><div id="board"></div></body></html>', { pretendToBeVisual: true });
    global.window = dom.window;
    global.document = dom.window.document;
    installPreparedDomBoardDependencies(global.document);
    global.requestAnimationFrame = (cb) => setTimeout(cb, 0);
    global.window.requestAnimationFrame = global.requestAnimationFrame;
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
    delete global.requestAnimationFrame;
    delete global.window;
    delete global.document;
    restoreAnimationEnv();
  });

  test.each([
    {
      name: 'observer speech',
      event: { type: 'observer_bubble', targets: [{ r: 2, col: 3, owner: 'black', gained: 4 }] },
      selector: '.observer-speech-bubble'
    },
    {
      name: 'charge bubble',
      event: { type: 'observer_bubble', targets: [{ r: 2, col: 3, owner: 'black', gained: 5, bubbleKind: 'charge' }] },
      selector: '.board-charge-bubble'
    }
  ])('NOANIM $name settles without mounting transient DOM', async ({ event, selector }) => {
    window.DISABLE_ANIMATIONS = true;
    const engine = require('../ui/animation-engine.js');

    await expect(engine.executeEvent(event)).resolves.toBeUndefined();

    expect(document.querySelector(selector)).toBeNull();
  });

  test('observer_bubble を石アンカー近くに表示し、約3秒で消す', async () => {
    const engine = require('../ui/animation-engine.js');
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
    const engine = require('../ui/animation-engine.js');
    await engine.executeEvent({
      type: 'observer_bubble',
      targets: [{ r: 2, col: 3, owner: 'white', gained: 0, text: '盤理観測してる場合じゃなかったわ' }]
    });

    const bubble = document.querySelector('.observer-speech-bubble');
    expect(bubble).not.toBeNull();
    expect(bubble.textContent).toContain('盤理観測してる場合じゃなかったわ');
    expect(bubble.textContent).not.toContain('観測が捗る');
  });

  test('observer_bubble の charge kind は盤面内の布石ポップアップとして表示する', async () => {
    const engine = require('../ui/animation-engine.js');
    await engine.executeEvent({
      type: 'observer_bubble',
      targets: [{ r: 2, col: 3, owner: 'black', gained: 5, bubbleKind: 'charge' }]
    });

    const bubble = document.querySelector('.board-charge-bubble');
    expect(bubble).not.toBeNull();
    expect(bubble.dataset.row).toBe('2');
    expect(bubble.dataset.col).toBe('3');
    expect(bubble.dataset.bubbleKind).toBe('charge');
    expect(bubble.textContent).toContain('+5');
    expect(bubble.textContent).not.toContain('布石');
    expect(bubble.textContent).not.toContain('観測が捗る');
    expect(bubble.style.top).toBe('258px');
    expect(bubble.style.transform).toBe('translate(-50%, -18px)');
    expect(bubble.style.transition).toBe('opacity 250ms ease, transform 180ms cubic-bezier(0.22, 1, 0.36, 1)');
    expect(bubble.style.padding).toBe('2px 8px');
    expect(bubble.style.fontSize).toBe('12px');
    expect(bubble.style.lineHeight).toBe('1.05');
    expect(bubble.children).toHaveLength(2);
    jest.advanceTimersByTime(20);
    expect(bubble.style.transform).toBe('translate(-50%, 0)');

    jest.advanceTimersByTime(2200);
    expect(document.querySelector('.board-charge-bubble')).toBeNull();
  });

  test('raw CHARGE_BUBBLE playback event も charge kind として表示する', async () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const engine = require('../ui/animation-engine.js');
    await engine.play([{
      type: 'CHARGE_BUBBLE',
      phase: 1,
      row: 2,
      col: 3,
      player: 'black',
      gained: 3,
      meta: { sourceType: 'placement_flip_gain' }
    }]);

    const bubble = document.querySelector('.board-charge-bubble');
    expect(bubble).not.toBeNull();
    expect(bubble.dataset.row).toBe('2');
    expect(bubble.dataset.col).toBe('3');
    expect(bubble.dataset.bubbleKind).toBe('charge');
    expect(bubble.textContent).toContain('+3');
    expect(warnSpy).not.toHaveBeenCalledWith('[AnimationEngine] Unhandled event type:', 'CHARGE_BUBBLE');
    warnSpy.mockRestore();
  });

  test('同じ phase・同じマスの charge bubble は合算表示する', async () => {
    const engine = require('../ui/animation-engine.js');
    await engine.play([
      {
        type: 'observer_bubble',
        phase: 1,
        targets: [{ r: 2, col: 3, owner: 'black', gained: 2, bubbleKind: 'charge' }]
      },
      {
        type: 'observer_bubble',
        phase: 1,
        targets: [{ r: 2, col: 3, owner: 'black', gained: 5, bubbleKind: 'charge' }]
      }
    ]);

    const bubbles = document.querySelectorAll('.board-charge-bubble');
    expect(bubbles).toHaveLength(1);
    expect(bubbles[0].textContent).toContain('+7');
  });
});
