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
});
