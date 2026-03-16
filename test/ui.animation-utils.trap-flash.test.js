const { JSDOM } = require('jsdom');

describe('animation-utils trap placement flash', () => {
  beforeEach(() => {
    jest.resetModules();
    jest.useFakeTimers();

    const dom = new JSDOM(`<!doctype html><html><body>
      <div id="board">
        <div class="cell" data-row="2" data-col="2"><div class="disc"></div></div>
      </div>
    </body></html>`);

    global.window = dom.window;
    global.document = dom.window.document;
    global.boardEl = document.getElementById('board');
    global.window.LOCAL_PLAYER_KEY = 'black';
  });

  afterEach(() => {
    jest.useRealTimers();
    delete global.boardEl;
    delete global.document;
    delete global.window;
  });

  test('shows and then removes the temporary trap overlay for the local viewer', () => {
    const mod = require('../ui/animation-utils');

    mod.playTrapPlacementFlash(2, 2, 'black');

    expect(document.querySelector('.trap-place-overlay')).toBeTruthy();

    jest.advanceTimersByTime(900);

    expect(document.querySelector('.trap-place-overlay')).toBeFalsy();
  });

  test('does not show the trap overlay for the non-viewer seat', () => {
    const mod = require('../ui/animation-utils');
    global.window.BOARD_VIEWER_KEY = 'white';

    mod.playTrapPlacementFlash(2, 2, 'black');

    expect(document.querySelector('.trap-place-overlay')).toBeFalsy();
  });
});