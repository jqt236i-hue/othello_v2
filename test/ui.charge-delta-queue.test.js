const path = require('path');
const { JSDOM } = require('jsdom');

describe('StoneVisuals.showChargeDelta queue', () => {
  beforeEach(() => {
    jest.resetModules();
    jest.useFakeTimers();

    const dom = new JSDOM(`
      <!doctype html>
      <html>
        <body>
          <div id="charge-delta-black" class="charge-delta"></div>
          <div id="charge-delta-white" class="charge-delta"></div>
        </body>
      </html>
    `);
    global.window = dom.window;
    global.document = dom.window.document;
    global.requestAnimationFrame = (cb) => setTimeout(cb, 0);
    global.BLACK = 1;
    global.WHITE = -1;
  });

  afterEach(() => {
    jest.useRealTimers();
    delete global.window;
    delete global.document;
    delete global.requestAnimationFrame;
    delete global.BLACK;
    delete global.WHITE;
  });

  test('plays deltas sequentially without overwrite loss', () => {
    const stoneVisuals = require(path.resolve(__dirname, '..', 'ui', 'stone-visuals.js'));
    const el = document.getElementById('charge-delta-black');

    stoneVisuals.showChargeDelta('black', 1);
    stoneVisuals.showChargeDelta('black', 2);

    jest.advanceTimersByTime(20);
    expect(el.textContent).toBe('布石+1');

    jest.advanceTimersByTime(4500);
    jest.advanceTimersByTime(20);
    expect(el.textContent).toBe('布石+2');
  });
});
