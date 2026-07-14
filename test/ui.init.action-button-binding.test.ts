import * as path from 'path';
import { JSDOM } from 'jsdom';

describe('initializeUI action button binding', () => {
  beforeEach(() => {
    jest.resetModules();

    const dom = new JSDOM(`<!doctype html><html><body>
      <button id="resetBtn">リセット</button>
      <button id="destroy-card-btn">破壊</button>
      <button id="use-card-btn">使用</button>
    </body></html>`);

    global.window = dom.window;
    global.document = dom.window.document;

    global.destroySelectedHandCard = jest.fn();
    global.useSelectedCard = jest.fn();
    global.cardState = { selectedCardId: null };
    global.CardLogic = {
      getCardDef: jest.fn(() => ({ type: 'WORK_WILL' }))
    };
    global.SoundEngine = {
      primeEffectSounds: jest.fn(),
      installUserGestureUnlock: jest.fn(),
      init: jest.fn(),
      playEffectByKey: jest.fn()
    };
    global.resetGame = jest.fn();

    const bootstrapPath = path.resolve(__dirname, '..', 'ui', 'bootstrap.js');
    jest.doMock(bootstrapPath, () => ({
      installGameDI: jest.fn(),
      getBoardVisualController: jest.fn(() => ({
        waitUntilReady: jest.fn(async () => undefined),
        isReady: jest.fn(() => true),
        getVisualFrameDigest: jest.fn(() => 'initial-frame')
      }))
    }), { virtual: false });
  });

  afterEach(() => {
    delete global.window;
    delete global.document;
    delete global.destroySelectedHandCard;
    delete global.useSelectedCard;
    delete global.cardState;
    delete global.CardLogic;
    delete global.SoundEngine;
    delete global.resetGame;
    delete global.gameState;
    delete global.isGameOver;
    delete global.window?.MATCH_MODE;
    delete global.window?.NetworkMatchClient;
  });

  test('UI初期化時に効果音のユーザー操作アンロックを予約する', async () => {
    const initModule = require('../ui/handlers/init.js');
    await initModule.initializeUI();

    expect(global.SoundEngine.installUserGestureUnlock).toHaveBeenCalledTimes(1);
    expect(global.SoundEngine.installUserGestureUnlock).toHaveBeenCalledWith(document);
    expect(global.SoundEngine.primeEffectSounds).not.toHaveBeenCalled();
    expect(global.SoundEngine.init).not.toHaveBeenCalled();
    expect(global.SoundEngine.playEffectByKey).not.toHaveBeenCalled();
  });

  test('破壊ボタン押下で既存処理を呼ぶ', async () => {
    const initModule = require('../ui/handlers/init.js');
    await initModule.initializeUI();

    document.getElementById('destroy-card-btn').click();

    expect(global.SoundEngine.init).not.toHaveBeenCalled();
    expect(global.SoundEngine.playEffectByKey).not.toHaveBeenCalled();
    expect(global.destroySelectedHandCard).toHaveBeenCalledTimes(1);
  });

  test('通常カードの使用ボタン押下では既存処理だけを呼ぶ', async () => {
    global.cardState.selectedCardId = 'WORK_WILL_001';
    global.CardLogic.getCardDef.mockReturnValue({ id: 'WORK_WILL_001', type: 'WORK_WILL' });
    const initModule = require('../ui/handlers/init.js');
    await initModule.initializeUI();

    document.getElementById('use-card-btn').click();

    expect(global.SoundEngine.init).not.toHaveBeenCalled();
    expect(global.SoundEngine.playEffectByKey).not.toHaveBeenCalled();
    expect(global.useSelectedCard).toHaveBeenCalledTimes(1);
  });

  test('宝箱カードの使用ボタン押下でも既存処理だけを呼ぶ', async () => {
    global.cardState.selectedCardId = 'TREASURE_BOX_001';
    global.CardLogic.getCardDef.mockReturnValue({ id: 'TREASURE_BOX_001', type: 'TREASURE_BOX' });
    const initModule = require('../ui/handlers/init.js');
    await initModule.initializeUI();

    document.getElementById('use-card-btn').click();

    expect(global.SoundEngine.init).not.toHaveBeenCalled();
    expect(global.SoundEngine.playEffectByKey).not.toHaveBeenCalledWith('card_use_button');
    expect(global.useSelectedCard).toHaveBeenCalledTimes(1);
  });

  test('ネット対戦中は終局前でも常設ボタンを再戦表示にして再戦申請を送る', async () => {
    window.MATCH_MODE = 'network';
    global.gameState = { consecutivePasses: 0 };
    global.isGameOver = jest.fn(() => false);
    const requestRematch = jest.fn(() => Promise.resolve({ ok: true }));
    window.NetworkMatchClient = {
      isActive: () => true,
      requestRematch
    };

    const initEvents = require('../ui/bootstrap/init-events.js');
    initEvents.attachInitEventListeners({
      resetBtn: document.getElementById('resetBtn')
    }, false);

    const resetBtn = document.getElementById('resetBtn');
    expect(resetBtn.textContent).toBe('再戦');
    resetBtn.click();
    await Promise.resolve();

    expect(requestRematch).toHaveBeenCalledTimes(1);
    expect(global.resetGame).not.toHaveBeenCalled();
    expect(resetBtn.textContent).toBe('申請中...');
    expect(resetBtn.disabled).toBe(true);
  });

  test('ネット参加中は MATCH_MODE が cpu のままでも常設ボタンを再戦表示にする', () => {
    window.MATCH_MODE = 'cpu';
    const requestRematch = jest.fn(() => Promise.resolve({ ok: true }));
    window.NetworkMatchClient = {
      isActive: () => true,
      requestRematch
    };

    const initEvents = require('../ui/bootstrap/init-events.js');
    initEvents.attachInitEventListeners({
      resetBtn: document.getElementById('resetBtn')
    }, false);

    const resetBtn = document.getElementById('resetBtn');
    expect(resetBtn.textContent).toBe('再戦');
    expect(resetBtn.getAttribute('aria-label')).toBe('再戦');
  });

  test('ローカル終局後も常設ボタンはリセット表示固定で resetGame を呼ぶ', () => {
    window.MATCH_MODE = 'cpu';
    global.gameState = { consecutivePasses: 2 };
    global.isGameOver = jest.fn(() => true);

    const initEvents = require('../ui/bootstrap/init-events.js');
    initEvents.attachInitEventListeners({
      resetBtn: document.getElementById('resetBtn')
    }, false);

    const resetBtn = document.getElementById('resetBtn');
    expect(resetBtn.textContent).toBe('リセット');
    resetBtn.click();

    expect(global.resetGame).toHaveBeenCalledTimes(1);
    expect(resetBtn.textContent).toBe('リセット');
    expect(resetBtn.getAttribute('aria-label')).toBe('リセット');
  });
});
