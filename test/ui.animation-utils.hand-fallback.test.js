const { JSDOM } = require('jsdom');

describe('animation-utils hand fallback', () => {
  beforeEach(() => {
    jest.resetModules();
    const dom = new JSDOM(`
      <!doctype html><html><body>
        <div id="board">
          <div class="cell" data-row="0" data-col="0"></div>
        </div>
        <div id="deck-black"></div>
        <div id="hand-black"></div>
        <div id="handLayer" style="display:none;"></div>
        <div id="handWrapper"></div>
        <div id="heldStone"></div>
      </body></html>
    `);
    global.window = dom.window;
    global.document = dom.window.document;

    global.BLACK = 1;
    global.WHITE = -1;
    global.boardEl = document.getElementById('board');
    global.SoundEngine = { init: jest.fn(), playStoneClack: jest.fn() };
    global.renderCardUI = jest.fn();
    global.isProcessing = false;
    global.isCardAnimating = false;
    if (Object.prototype.hasOwnProperty.call(global, 'TimerRegistry')) {
      delete global.TimerRegistry;
    }
  });

  afterEach(() => {
    delete global.window;
    delete global.document;
    delete global.boardEl;
  });

  test('playHandAnimation completes even when Element.animate is unavailable', async () => {
    const wrapper = document.getElementById('handWrapper');
    wrapper.animate = undefined;
    const mod = require('../ui/animation-utils');

    await new Promise((resolve, reject) => {
      const to = setTimeout(() => reject(new Error('timeout')), 2200);
      mod.playHandAnimation(global.BLACK, 0, 0, () => {
        clearTimeout(to);
        resolve();
      });
    });

    expect(global.SoundEngine.playStoneClack).toHaveBeenCalledTimes(1);
  });

  test('playDrawCardHandAnimation resolves without Element.animate', async () => {
    const wrapper = document.getElementById('handWrapper');
    wrapper.animate = undefined;
    const mod = require('../ui/animation-utils');

    await expect(mod.playDrawCardHandAnimation({ player: 'black', count: 1 })).resolves.toBeUndefined();
    expect(document.getElementById('handLayer').style.display).toBe('none');
  });
});
