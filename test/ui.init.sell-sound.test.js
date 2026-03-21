const path = require('path');
const { JSDOM } = require('jsdom');

describe('initializeUI action button sound', () => {
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

  test('破壊ボタン押下で効果音を鳴らして既存処理を呼ぶ', () => {
    const initModule = require('../ui/handlers/init.js');
    initModule.initializeUI();

    document.getElementById('destroy-card-btn').click();

    expect(global.SoundEngine.init).toHaveBeenCalledTimes(1);
    expect(global.SoundEngine.playEffectByKey).toHaveBeenCalledWith('stone_destroy');
    expect(global.destroySelectedHandCard).toHaveBeenCalledTimes(1);
  });

  test('売却ボタン押下で効果音を鳴らして既存処理を呼ぶ', () => {
    const initModule = require('../ui/handlers/init.js');
    initModule.initializeUI();

    document.getElementById('sell-card-btn').click();

    expect(global.SoundEngine.init).toHaveBeenCalledTimes(1);
    expect(global.SoundEngine.playEffectByKey).toHaveBeenCalledWith('charge_gain_common');
    expect(global.confirmSellCardSelection).toHaveBeenCalledTimes(1);
  });

  test('売却成功時は次の playback gain sound を 1 回だけ抑止する', () => {
    const initModule = require('../ui/handlers/init.js');
    initModule.initializeUI();

    document.getElementById('sell-card-btn').click();

    expect(global.window.__skipNextPlaybackSoundUntilByKey).toMatchObject({
      charge_gain_common: expect.any(Number)
    });
  });

  test('売却失敗時は local playback skip を残さない', () => {
    global.confirmSellCardSelection.mockReturnValue(false);
    const initModule = require('../ui/handlers/init.js');
    initModule.initializeUI();

    document.getElementById('sell-card-btn').click();

    expect(global.window.__skipNextPlaybackSoundUntilByKey).toBeUndefined();
  });

  test('通常カードの使用ボタン押下では card_use_button を鳴らして既存処理を呼ぶ', () => {
    global.cardState.selectedCardId = 'WORK_WILL_001';
    global.CardLogic.getCardDef.mockReturnValue({ id: 'WORK_WILL_001', type: 'WORK_WILL' });
    const initModule = require('../ui/handlers/init.js');
    initModule.initializeUI();

    document.getElementById('use-card-btn').click();

    expect(global.SoundEngine.init).toHaveBeenCalledTimes(1);
    expect(global.SoundEngine.playEffectByKey).toHaveBeenCalledWith('card_use_button');
    expect(global.useSelectedCard).toHaveBeenCalledTimes(1);
  });

  test('宝箱カードの使用ボタン押下では treasure_gain 側に寄せるため card_use_button を鳴らさない', () => {
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
