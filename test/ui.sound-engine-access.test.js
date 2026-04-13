describe('sound engine access module', () => {
  let accessModule;

  beforeEach(() => {
    jest.resetModules();
    accessModule = require('../ui/sound-engine-access.js');
  });

  afterEach(() => {
    try { delete globalThis.SoundEngine; } catch (e) {}
  });

  test('resolveSoundEngine prefers the explicit root binding', () => {
    const rootEngine = { source: 'root' };
    globalThis.SoundEngine = { source: 'global' };

    expect(accessModule.resolveSoundEngine({ SoundEngine: rootEngine })).toBe(rootEngine);
  });

  test('resolveSoundEngine falls back to globalThis SoundEngine', () => {
    const globalEngine = { source: 'global' };
    globalThis.SoundEngine = globalEngine;

    expect(accessModule.resolveSoundEngine({})).toBe(globalEngine);
  });

  test('isBgmPlaying only reports true for an allowed, unpaused BGM', () => {
    expect(accessModule.isBgmPlaying(null)).toBe(false);
    expect(accessModule.isBgmPlaying({ allowBgmPlay: false, bgm: { paused: false } })).toBe(false);
    expect(accessModule.isBgmPlaying({ allowBgmPlay: true, bgm: { paused: true } })).toBe(false);
    expect(accessModule.isBgmPlaying({ allowBgmPlay: true, bgm: { paused: false } })).toBe(true);
    expect(accessModule.isBgmPlaying({ allowBgmPlay: true, bgm: {} })).toBe(true);
  });
});
