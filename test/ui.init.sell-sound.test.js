const path = require('path');
const { JSDOM } = require('jsdom');

describe('initializeUI action button binding', () => {
  beforeEach(() => {
    jest.resetModules();

    const dom = new JSDOM(`<!doctype html><html><body>
      <button id="destroy-card-btn">破壊</button>
      <button id="use-card-btn">使用</button>
      <button id="sell-card-btn">売却</button>
    </body></html>`);

    global.window = dom.window;
    global.document = dom.window.document;

    global.destroySelectedHandCard = jest.fn();
    global.useSelectedCard = jest.fn();
    global.confirmSellCardSelection = jest.fn(() => true);
    global.cardState = { selectedCardId: null };
    global.CardLogic = {
      getCardDef: jest.fn(() => ({ type: 'WORK_WILL' }))
    };
    global.SoundEngine = {
      primeEffectSounds: jest.fn(),
      init: jest.fn(),
      playEffectByKey: jest.fn()
    };
    global.resetGame = jest.fn();

    const bootstrapPath = path.resolve(__dirname, '..', 'ui', 'bootstrap.js');
    jest.doMock(bootstrapPath, () => ({
      installGameDI: jest.fn()
    }), { virtual: false });
  });

  afterEach(() => {
    delete global.window;
    delete global.document;
    delete global.destroySelectedHandCard;
    delete global.useSelectedCard;
    delete global.confirmSellCardSelection;
    delete global.cardState;
    delete global.CardLogic;
    delete global.SoundEngine;
    delete global.resetGame;
  });

  test('UI初期化時に効果音を先読みする', () => {
    const initModule = require('../ui/handlers/init.js');
    initModule.initializeUI();

    expect(global.SoundEngine.primeEffectSounds).toHaveBeenCalledTimes(1);
    expect(global.SoundEngine.init).not.toHaveBeenCalled();
    expect(global.SoundEngine.playEffectByKey).not.toHaveBeenCalled();
  });

  test('破壊ボタン押下で既存処理を呼ぶ', () => {
    const initModule = require('../ui/handlers/init.js');
    initModule.initializeUI();

    document.getElementById('destroy-card-btn').click();

    expect(global.SoundEngine.init).not.toHaveBeenCalled();
    expect(global.SoundEngine.playEffectByKey).not.toHaveBeenCalled();
    expect(global.destroySelectedHandCard).toHaveBeenCalledTimes(1);
  });

  test('売却ボタン押下で既存処理を呼ぶ', () => {
    const initModule = require('../ui/handlers/init.js');
    initModule.initializeUI();

    document.getElementById('sell-card-btn').click();

    expect(global.SoundEngine.init).not.toHaveBeenCalled();
    expect(global.SoundEngine.playEffectByKey).not.toHaveBeenCalled();
    expect(global.confirmSellCardSelection).toHaveBeenCalledTimes(1);
  });

  test('売却ボタン押下では local playback skip registry を触らない', () => {
    const initModule = require('../ui/handlers/init.js');
    initModule.initializeUI();

    document.getElementById('sell-card-btn').click();

    expect(global.window.__skipNextPlaybackSoundUntilByKey).toBeUndefined();
  });

  test('売却失敗時も local playback skip を作らない', () => {
    global.confirmSellCardSelection.mockReturnValue(false);
    const initModule = require('../ui/handlers/init.js');
    initModule.initializeUI();

    document.getElementById('sell-card-btn').click();

    expect(global.window.__skipNextPlaybackSoundUntilByKey).toBeUndefined();
  });

  test('通常カードの使用ボタン押下では既存処理だけを呼ぶ', () => {
    global.cardState.selectedCardId = 'WORK_WILL_001';
    global.CardLogic.getCardDef.mockReturnValue({ id: 'WORK_WILL_001', type: 'WORK_WILL' });
    const initModule = require('../ui/handlers/init.js');
    initModule.initializeUI();

    document.getElementById('use-card-btn').click();

    expect(global.SoundEngine.init).not.toHaveBeenCalled();
    expect(global.SoundEngine.playEffectByKey).not.toHaveBeenCalled();
    expect(global.useSelectedCard).toHaveBeenCalledTimes(1);
  });

  test('宝箱カードの使用ボタン押下でも既存処理だけを呼ぶ', () => {
    global.cardState.selectedCardId = 'TREASURE_BOX_001';
    global.CardLogic.getCardDef.mockReturnValue({ id: 'TREASURE_BOX_001', type: 'TREASURE_BOX' });
    const initModule = require('../ui/handlers/init.js');
    initModule.initializeUI();

    document.getElementById('use-card-btn').click();

    expect(global.SoundEngine.init).not.toHaveBeenCalled();
    expect(global.SoundEngine.playEffectByKey).not.toHaveBeenCalledWith('card_use_button');
    expect(global.useSelectedCard).toHaveBeenCalledTimes(1);
  });
});
