const path = require('path');
const { JSDOM } = require('jsdom');

describe('initializeUI hand skin wiring', () => {
  beforeEach(() => {
    jest.resetModules();

    const dom = new JSDOM(`<!doctype html><html><body>
      <button id="handSkinBtn" aria-expanded="false"></button>
      <div id="handSkinPanel" aria-hidden="true">
        <button id="handSkinCloseBtn" type="button"></button>
        <div id="handSkinOptions"></div>
      </div>
      <img id="handImage" src="assets/images/hand-skin/勇者の手.png" alt="" />
    </body></html>`, { url: 'https://example.test/' });

    global.window = dom.window;
    global.document = dom.window.document;
    global.resetGame = jest.fn();
    global.SoundEngine = {
      primeEffectSounds: jest.fn()
    };
    global.setupHandSkinControls = jest.fn();

    const bootstrapPath = path.resolve(__dirname, '..', 'ui', 'bootstrap.js');
    jest.doMock(bootstrapPath, () => ({
      installGameDI: jest.fn()
    }), { virtual: false });
  });

  afterEach(() => {
    delete global.window;
    delete global.document;
    delete global.resetGame;
    delete global.SoundEngine;
    delete global.setupHandSkinControls;
  });

  test('UI初期化時に手スキン設定を接続する', () => {
    const initModule = require('../ui/handlers/init.js');
    initModule.initializeUI();

    expect(global.setupHandSkinControls).toHaveBeenCalledWith(expect.objectContaining({
      button: document.getElementById('handSkinBtn'),
      panel: document.getElementById('handSkinPanel'),
      closeBtn: document.getElementById('handSkinCloseBtn'),
      optionsEl: document.getElementById('handSkinOptions'),
      handImage: document.getElementById('handImage'),
      root: window
    }));
  });
});
