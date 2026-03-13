describe('animation-engine hand_add', () => {
  beforeEach(() => {
    jest.resetModules();
    global.window = {
      __telemetry__: { watchdogFired: 0, singleVisualWriterHits: 0, abortCount: 0 },
      playClearHandAnimation: jest.fn(() => Promise.resolve()),
      playDrawCardHandAnimation: jest.fn(() => Promise.resolve()),
      playCardUseHandAnimation: jest.fn(() => Promise.resolve())
    };
    global.SoundEngine = {
      init: jest.fn(),
      playEffectByKey: jest.fn()
    };
    global.document = {
      getElementById: () => ({
        classList: { add() {}, remove() {} },
        querySelector: () => null
      })
    };
  });

  afterEach(() => {
    delete global.window;
    delete global.document;
    delete global.SoundEngine;
    delete global.CardLogic;
  });

  test('delegates hand_add to draw-hand animation helper', async () => {
    const engine = require('../ui/animation-engine');
    await engine.executeEvent({
      type: 'hand_add',
      targets: [{ player: 'black', cardId: 'card_1', count: 1 }]
    });

    expect(global.window.playDrawCardHandAnimation).toHaveBeenCalledTimes(1);
    expect(global.window.playDrawCardHandAnimation).toHaveBeenCalledWith(
      expect.objectContaining({ player: 'black', cardId: 'card_1', count: 1 })
    );
  });

  test('delegates card_use_animation to card-use hand animation helper', async () => {
    const engine = require('../ui/animation-engine');
    await engine.executeEvent({
      type: 'card_use_animation',
      targets: [{ player: 'black', owner: 'black', cardId: 'card_2', cost: 5, name: 'X' }]
    });

    expect(global.window.playCardUseHandAnimation).toHaveBeenCalledTimes(1);
    expect(global.window.playCardUseHandAnimation).toHaveBeenCalledWith(
      expect.objectContaining({ player: 'black', owner: 'black', cardId: 'card_2', cost: 5, name: 'X' })
    );
  });

  test('delegates hand_remove to clear-hand animation helper', async () => {
    const engine = require('../ui/animation-engine');
    await engine.executeEvent({
      type: 'hand_remove',
      targets: [{ player: 'black', count: 2, reason: 'rebuild_will', cardId: 'x1', cardIds: ['x1', 'x2'] }]
    });

    expect(global.window.playClearHandAnimation).toHaveBeenCalledTimes(1);
    expect(global.window.playClearHandAnimation).toHaveBeenCalledWith(
      expect.objectContaining({ player: 'black', count: 2, reason: 'rebuild_will', cardId: 'x1', cardIds: ['x1', 'x2'] })
    );
  });

  test('plays card_use_button cue for opponent card_use_animation only', async () => {
    const engine = require('../ui/animation-engine');

    await engine.executeEvent({
      type: 'card_use_animation',
      targets: [{ player: 'white', owner: 'white', cardId: 'enemy_card_1', cost: 5, name: 'Enemy Card' }]
    });

    expect(global.SoundEngine.init).toHaveBeenCalled();
    expect(global.SoundEngine.playEffectByKey).toHaveBeenCalledWith('card_use_button');

    global.SoundEngine.init.mockClear();
    global.SoundEngine.playEffectByKey.mockClear();

    await engine.executeEvent({
      type: 'card_use_animation',
      targets: [{ player: 'black', owner: 'black', cardId: 'self_card_1', cost: 5, name: 'Self Card' }]
    });

    expect(global.SoundEngine.playEffectByKey).not.toHaveBeenCalledWith('card_use_button');
  });

  test('does not play card_use_button cue for opponent treasure box card_use_animation', async () => {
    global.CardLogic = {
      getCardDef: () => ({ type: 'TREASURE_BOX' })
    };
    const engine = require('../ui/animation-engine');

    await engine.executeEvent({
      type: 'card_use_animation',
      targets: [{ player: 'white', owner: 'white', cardId: 'TREASURE_BOX_001', cost: 8, name: '宝箱' }]
    });

    expect(global.SoundEngine.playEffectByKey).not.toHaveBeenCalledWith('card_use_button');
  });
});
