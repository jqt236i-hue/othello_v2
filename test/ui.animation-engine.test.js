describe('animation-engine _sleep', () => {
  beforeEach(() => {
    jest.resetModules();
  });

  test('resolves immediately when NOANIM is active', async () => {
    jest.doMock('../ui/animation-shared.js', () => ({ isNoAnim: () => true, getTimer: () => ({ setTimeout: () => {}, clearTimeout: () => {}, clearAll: () => {} }) }));
    // Minimal fake document so the PlaybackEngine constructor succeeds in node tests
    global.document = { getElementById: () => ({ classList: { add() {}, remove() {} }, querySelector: () => null, getBoundingClientRect: () => ({}) }) };
    const engine = require('../ui/animation-engine');
    // _sleep should resolve immediately (no waiting) when NOANIM mode is active
    await expect(engine._sleep(1000)).resolves.toBeUndefined();
  });

  test('returns 500ms fade only for breeding spawn targets', () => {
    global.document = { getElementById: () => ({ classList: { add() {}, remove() {} }, querySelector: () => null, getBoundingClientRect: () => ({}) }) };
    const engine = require('../ui/animation-engine');

    expect(engine.getSpawnFadeInMs({ cause: 'BREEDING', reason: 'breeding_spawn' })).toBe(500);
    expect(engine.getSpawnFadeInMs({ cause: 'BREEDING', reason: 'breeding_spawn_immediate' })).toBe(500);
    expect(engine.getSpawnFadeInMs({ cause: 'SYSTEM', reason: 'standard_place' })).toBe(0);
  });

  test('同じphaseに treasure_gain がある場合は sell_sacrifice_gain を再生しない', async () => {
    global.document = { getElementById: () => ({ classList: { add() {}, remove() {} }, querySelector: () => null, getBoundingClientRect: () => ({}) }) };
    const playEffectByKey = jest.fn();
    global.SoundEngine = {
      init: jest.fn(),
      playEffectByKey
    };
    const engine = require('../ui/animation-engine');

    await engine.executePhase([
      { type: 'sound_effect', phase: 5, targets: [{ soundKey: 'sell_sacrifice_gain' }] },
      { type: 'sound_effect', phase: 5, targets: [{ soundKey: 'treasure_gain' }] }
    ]);

    expect(playEffectByKey).toHaveBeenCalledWith('treasure_gain');
    expect(playEffectByKey).not.toHaveBeenCalledWith('sell_sacrifice_gain');
    delete global.SoundEngine;
  });

  test('card_use_animation の直後 phase にある treasure_gain は追加ギャップなしで再生する', async () => {
    const cellEl = { classList: { add() {}, remove() {} }, querySelector: () => null, getBoundingClientRect: () => ({}) };
    global.document = { getElementById: () => cellEl };
    global.window = {
      playCardUseHandAnimation: jest.fn(() => Promise.resolve())
    };
    global.emitBoardUpdate = jest.fn();
    const playEffectByKey = jest.fn();
    global.SoundEngine = {
      init: jest.fn(),
      playEffectByKey
    };

    const engine = require('../ui/animation-engine');
    engine._sleep = jest.fn(() => Promise.resolve());

    await engine.play([
      { type: 'card_use_animation', phase: 1, targets: [{ player: 'black', owner: 'black', cardId: 'TREASURE_BOX_001' }] },
      { type: 'sound_effect', phase: 2, targets: [{ soundKey: 'treasure_gain' }] }
    ]);

    expect(global.window.playCardUseHandAnimation).toHaveBeenCalled();
    expect(playEffectByKey).toHaveBeenCalledWith('treasure_gain');
    expect(engine._sleep).not.toHaveBeenCalled();

    delete global.SoundEngine;
    delete global.emitBoardUpdate;
    delete global.window;
  });

  test('place_hand_animation の直後 phase に spawn だけがある特殊石配置でも追加ギャップなしで再生する', async () => {
    const cellEl = { classList: { add() {}, remove() {} }, querySelector: () => null, getBoundingClientRect: () => ({}) };
    global.document = { getElementById: () => cellEl };
    global.window = {};
    global.emitBoardUpdate = jest.fn();

    const engine = require('../ui/animation-engine');
    engine._sleep = jest.fn(() => Promise.resolve());
    const executePhaseSpy = jest.spyOn(engine, 'executePhase').mockResolvedValue(undefined);

    await engine.play([
      { type: 'place_hand_animation', phase: 0, targets: [{ r: 4, col: 4, player: 'black', owner: 'black' }] },
      {
        type: 'spawn',
        phase: 1,
        targets: [{
          r: 4,
          col: 4,
          ownerAfter: 'black',
          cause: 'SYSTEM',
          reason: 'standard_place',
          after: { color: 1, special: 'ULTIMATE_DESTROY_GOD', timer: 5, owner: 'black' }
        }]
      }
    ]);

    expect(executePhaseSpy).toHaveBeenCalledTimes(2);
    expect(engine._sleep).not.toHaveBeenCalled();

    executePhaseSpy.mockRestore();
    delete global.emitBoardUpdate;
    delete global.window;
  });

  test('opponent の宝箱 card_use_animation では card_use_button を鳴らさない', async () => {
    const cellEl = { classList: { add() {}, remove() {} }, querySelector: () => null, getBoundingClientRect: () => ({}) };
    global.document = { getElementById: () => cellEl };
    global.window = {
      LOCAL_PLAYER_KEY: 'black',
      playCardUseHandAnimation: jest.fn(() => Promise.resolve())
    };
    const playEffectByKey = jest.fn();
    global.SoundEngine = {
      init: jest.fn(),
      playEffectByKey
    };
    global.CardLogic = {
      getCardDef: jest.fn(() => ({ id: 'TREASURE_BOX_001', type: 'TREASURE_BOX' }))
    };

    const engine = require('../ui/animation-engine');

    await engine.executePhase([
      { type: 'card_use_animation', phase: 1, targets: [{ player: 'white', owner: 'white', cardId: 'TREASURE_BOX_001' }] }
    ]);

    expect(global.window.playCardUseHandAnimation).toHaveBeenCalled();
    expect(global.SoundEngine.playEffectByKey).not.toHaveBeenCalledWith('card_use_button');

    delete global.CardLogic;
    delete global.SoundEngine;
    delete global.window;
  });

  test('opponent の通常カード card_use_animation では card_use_button を鳴らす', async () => {
    const cellEl = { classList: { add() {}, remove() {} }, querySelector: () => null, getBoundingClientRect: () => ({}) };
    global.document = { getElementById: () => cellEl };
    global.window = {
      LOCAL_PLAYER_KEY: 'black',
      playCardUseHandAnimation: jest.fn(() => Promise.resolve())
    };
    const playEffectByKey = jest.fn();
    global.SoundEngine = {
      init: jest.fn(),
      playEffectByKey
    };
    global.CardLogic = {
      getCardDef: jest.fn(() => ({ id: 'WORK_WILL_001', type: 'WORK_WILL' }))
    };

    const engine = require('../ui/animation-engine');

    await engine.executePhase([
      { type: 'card_use_animation', phase: 1, targets: [{ player: 'white', owner: 'white', cardId: 'WORK_WILL_001' }] }
    ]);

    expect(global.window.playCardUseHandAnimation).toHaveBeenCalled();
    expect(global.SoundEngine.playEffectByKey).toHaveBeenCalledWith('card_use_button');

    delete global.CardLogic;
    delete global.SoundEngine;
    delete global.window;
  });

  test('local skip registry がある matching playback sound は 1 回だけ抑止する', async () => {
    global.document = { getElementById: () => ({ classList: { add() {}, remove() {} }, querySelector: () => null, getBoundingClientRect: () => ({}) }) };
    global.window = {
      __skipNextPlaybackSoundUntilByKey: {
        stone_destroy: Date.now() + 1000
      }
    };
    const playEffectByKey = jest.fn();
    global.SoundEngine = {
      init: jest.fn(),
      playEffectByKey
    };
    const engine = require('../ui/animation-engine');

    await engine.executePhase([
      { type: 'sound_effect', phase: 5, targets: [{ soundKey: 'stone_destroy' }] }
    ]);

    expect(playEffectByKey).not.toHaveBeenCalledWith('stone_destroy');
    expect(global.window.__skipNextPlaybackSoundUntilByKey).toBeUndefined();

    delete global.SoundEngine;
    delete global.window;
  });

  test('local skip registry は対象 key だけ消して他 key は残す', async () => {
    global.document = { getElementById: () => ({ classList: { add() {}, remove() {} }, querySelector: () => null, getBoundingClientRect: () => ({}) }) };
    global.window = {
      __skipNextPlaybackSoundUntilByKey: {
        sell_sacrifice_gain: Date.now() + 1000,
        stone_destroy: Date.now() + 2000
      }
    };
    const playEffectByKey = jest.fn();
    global.SoundEngine = {
      init: jest.fn(),
      playEffectByKey
    };
    const engine = require('../ui/animation-engine');

    await engine.executePhase([
      { type: 'sound_effect', phase: 5, targets: [{ soundKey: 'sell_sacrifice_gain' }] }
    ]);

    expect(playEffectByKey).not.toHaveBeenCalledWith('sell_sacrifice_gain');
    expect(global.window.__skipNextPlaybackSoundUntilByKey).toMatchObject({
      stone_destroy: expect.any(Number)
    });
    expect(global.window.__skipNextPlaybackSoundUntilByKey.sell_sacrifice_gain).toBeUndefined();

    delete global.SoundEngine;
    delete global.window;
  });
});
