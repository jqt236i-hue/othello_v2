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
});
