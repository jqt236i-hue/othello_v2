import * as path from 'path';
const { JSDOM } = require('jsdom');
describe('initializeUI gacha wiring', () => {
  beforeEach(() => {
    jest.resetModules();

    const dom = new JSDOM(`<!doctype html><html><body>
      <button id="gachaOpenBtn" aria-expanded="false"></button>
      <div id="gachaOverlay" aria-hidden="true">
        <div id="gachaModal"></div>
      </div>
      <button id="gachaCloseBtn" type="button"></button>
      <span id="gachaBalanceValue">0</span>
      <button id="gachaDetailToggleBtn" aria-expanded="false"></button>
      <div id="gachaDetailsPanel" hidden></div>
      <button id="gachaSinglePullBtn" type="button"></button>
      <button id="gachaTenPullBtn" type="button"></button>
      <div id="gachaStatusText"></div>
      <div id="gachaResults"></div>
    </body></html>`, { url: 'https://example.test/' });

    global.window = dom.window;
    global.document = dom.window.document;
    global.resetGame = jest.fn();
    global.SoundEngine = {
      primeEffectSounds: jest.fn()
    };
    global.setupGachaControls = jest.fn();

    const bootstrapPath = path.resolve(__dirname, '..', 'ui', 'bootstrap.js');
    jest.doMock(bootstrapPath, () => ({
      installGameDI: jest.fn()
    }), { virtual: false });
  });

  afterEach(() => {
    try {
      if (global.window && typeof global.window.close === 'function') {
        global.window.close();
      }
    } catch (e) { /* Intentionally empty: test cleanup guard */ }
    delete global.window;
    delete global.document;
    delete global.resetGame;
    delete global.SoundEngine;
    delete global.setupGachaControls;
  });

  test('UI初期化時にガチャ設定を接続する', () => {
    const initModule = require('../ui/handlers/init.js');
    initModule.initializeUI();

    expect(global.setupGachaControls).toHaveBeenCalledWith({
      root: window
    });
  });
});
