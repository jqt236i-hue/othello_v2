describe('animation-engine hand_add', () => {
  beforeEach(() => {
    jest.resetModules();
    global.window = {
      __telemetry__: { watchdogFired: 0, singleVisualWriterHits: 0, abortCount: 0 },
      MATCH_MODE: 'cpu',
      playClearHandAnimation: jest.fn(() => Promise.resolve()),
      playDrawCardHandAnimation: jest.fn(() => Promise.resolve()),
      playDirectHandAddAnimation: jest.fn(() => Promise.resolve()),
      playCaptureToHandAnimation: jest.fn(() => Promise.resolve()),
      playCardUseHandAnimation: jest.fn(() => Promise.resolve()),
      playHandAnimation: jest.fn((player, row, col, onComplete) => {
        if (typeof onComplete === 'function') onComplete();
      })
    };
    global.SoundEngine = {
      init: jest.fn(),
      playEffectByKey: jest.fn()
    };
    global.BLACK = 1;
    global.WHITE = -1;
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
    delete global.BLACK;
    delete global.WHITE;
  });

  test('delegates draw-style hand_add to draw-hand animation helper', async () => {
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

  test('keeps HAND_ADD adaptation thin and leaves visual resolution to draw-hand animation helper', async () => {
    global.window.resolveHandVisualOptions = jest.fn(() => ({ ownerKey: 'white', cpu: true, cpuLevel: 4 }));
    const engine = require('../ui/animation-engine');
    await engine.executeEvent({
      type: 'hand_add',
      targets: [{ player: 'white', cardId: 'card_2', count: 1 }]
    });

    expect(global.window.resolveHandVisualOptions).not.toHaveBeenCalled();
    expect(global.window.playDrawCardHandAnimation).toHaveBeenCalledWith(
      expect.objectContaining({ player: 'white', cardId: 'card_2', count: 1, cpu: false })
    );
  });

  test('passes through explicit CPU visual metadata already attached to HAND_ADD payload', async () => {
    const engine = require('../ui/animation-engine');
    await engine.executeEvent({
      type: 'hand_add',
      targets: [{ player: 'white', cardId: 'card_2', count: 1, cpu: true, cpuLevel: 4 }]
    });

    expect(global.window.playDrawCardHandAnimation).toHaveBeenCalledWith(
      expect.objectContaining({ player: 'white', cardId: 'card_2', count: 1, cpu: true, cpuLevel: 4 })
    );
  });

  test('delegates generated throw-chain hand_add to direct hand animation helper', async () => {
    const engine = require('../ui/animation-engine');
    await engine.executeEvent({
      type: 'hand_add',
      targets: [{ player: 'black', cardId: 'triple_01', count: 1, reason: 'generated_throw_chain', sourceType: 'DOUBLE_PLACE' }]
    });

    expect(global.window.playDirectHandAddAnimation).toHaveBeenCalledTimes(1);
    expect(global.window.playDirectHandAddAnimation).toHaveBeenCalledWith(
      expect.objectContaining({ player: 'black', cardId: 'triple_01', count: 1, reason: 'generated_throw_chain', sourceType: 'DOUBLE_PLACE' })
    );
    expect(global.window.playDrawCardHandAnimation).not.toHaveBeenCalledWith(
      expect.objectContaining({ cardId: 'triple_01', reason: 'generated_throw_chain' })
    );
  });

  test('delegates capture_to_hand_animation to capture hand animation helper', async () => {
    const engine = require('../ui/animation-engine');
    await engine.executeEvent({
      type: 'capture_to_hand_animation',
      targets: [{
        player: 'black',
        cardId: 'guardian_god_01',
        reason: 'capture_will',
        sourceType: 'GUARDIAN_GOD',
        sourceCardId: 'guardian_god_01',
        sourceSpecialType: 'GUARD',
        sourceRow: 4,
        sourceCol: 5,
        sourceOwner: 'white',
        insertIndex: 1,
        visualDescriptor: { cardId: 'guardian_god_01', name: '守護神', cost: 30, costTier: 'red' }
      }]
    });

    expect(global.window.playCaptureToHandAnimation).toHaveBeenCalledTimes(1);
    expect(global.window.playCaptureToHandAnimation).toHaveBeenCalledWith(
      expect.objectContaining({
        player: 'black',
        cardId: 'guardian_god_01',
        reason: 'capture_will',
        sourceType: 'GUARDIAN_GOD',
        sourceCardId: 'guardian_god_01',
        sourceSpecialType: 'GUARD',
        sourceRow: 4,
        sourceCol: 5,
        sourceOwner: 'white',
        insertIndex: 1,
        visualDescriptor: { cardId: 'guardian_god_01', name: '守護神', cost: 30, costTier: 'red' }
      })
    );
  });

  test('delegates card_use_animation to card-use hand animation helper', async () => {
    const engine = require('../ui/animation-engine');
    const sourceCardEl = { nodeType: 1 };
    const sourceCardRect = { left: 220, top: 500, width: 90, height: 120, right: 310, bottom: 620 };
    const disappearPlaybackEvents = [{
      type: 'status_removed',
      rawType: 'STATUS_REMOVED',
      targets: [{ r: 3, col: 3, after: { color: 1, special: null, timer: null, owner: 'black' } }],
      meta: { special: 'GUARD', reason: 'loss_will_reset' }
    }];
    await engine.executeEvent({
      type: 'card_use_animation',
      targets: [{
        player: 'black',
        owner: 'black',
        cardId: 'card_2',
        cost: 5,
        name: 'X',
        visualDescriptor: { cardId: 'card_2', name: 'X', cost: 5, costTier: 'gray' },
        disappearSoundKey: 'loss_will_reset',
        disappearPlaybackEvents,
        sourceCardEl,
        sourceCardRect
      }]
    });

    expect(global.window.playCardUseHandAnimation).toHaveBeenCalledTimes(1);
    expect(global.window.playCardUseHandAnimation).toHaveBeenCalledWith(
      expect.objectContaining({
        player: 'black',
        owner: 'black',
        cardId: 'card_2',
        cost: 5,
        name: 'X',
        visualDescriptor: { cardId: 'card_2', name: 'X', cost: 5, costTier: 'gray' },
        disappearSoundKey: 'loss_will_reset',
        sourceCardEl,
        sourceCardRect,
        onDisappear: expect.any(Function)
      })
    );
  });

  test('delegates place_hand_animation to placement hand helper for remote network moves', async () => {
    const engine = require('../ui/animation-engine');
    global.window.MATCH_MODE = 'network';
    global.window.LOCAL_PLAYER_KEY = 'black';

    await engine.executeEvent({
      type: 'place_hand_animation',
      targets: [{ player: 'white', owner: 'white', r: 4, col: 3 }]
    });

    expect(global.window.playHandAnimation).toHaveBeenCalledTimes(1);
    expect(global.window.playHandAnimation).toHaveBeenCalledWith(global.WHITE, 4, 3, expect.any(Function));
  });

  test('plays place_hand_animation for local network moves from authoritative playback', async () => {
    const engine = require('../ui/animation-engine');
    global.window.MATCH_MODE = 'network';
    global.window.LOCAL_PLAYER_KEY = 'black';

    await engine.executeEvent({
      type: 'place_hand_animation',
      targets: [{ player: 'black', owner: 'black', r: 2, col: 5 }]
    });

    expect(global.window.playHandAnimation).toHaveBeenCalledTimes(1);
    expect(global.window.playHandAnimation).toHaveBeenCalledWith(global.BLACK, 2, 5, expect.any(Function));
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

  test('card_use_animation 自体では card_use_button を直接再生しない', async () => {
    const engine = require('../ui/animation-engine');

    await engine.executeEvent({
      type: 'card_use_animation',
      targets: [{ player: 'white', owner: 'white', cardId: 'enemy_card_1', cost: 5, name: 'Enemy Card' }]
    });

    expect(global.SoundEngine.init).not.toHaveBeenCalled();
    expect(global.SoundEngine.playEffectByKey).not.toHaveBeenCalled();
  });

  test('treasure box の card_use_animation でも直接 sound を鳴らさない', async () => {
    const engine = require('../ui/animation-engine');

    await engine.executeEvent({
      type: 'card_use_animation',
      targets: [{ player: 'white', owner: 'white', cardId: 'TREASURE_BOX_001', cost: 8, name: '宝箱' }]
    });

    expect(global.SoundEngine.init).not.toHaveBeenCalled();
    expect(global.SoundEngine.playEffectByKey).not.toHaveBeenCalled();
  });
});
