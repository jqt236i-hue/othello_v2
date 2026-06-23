describe('browser player profile model', () => {
  let storage: Map<string, string>;

  beforeEach(() => {
    jest.resetModules();
    storage = new Map();
    (global as any).localStorage = {
      getItem: jest.fn((key: string) => storage.get(key) || null),
      setItem: jest.fn((key: string, value: string) => void storage.set(key, value)),
      removeItem: jest.fn((key: string) => void storage.delete(key))
    };
  });

  afterEach(() => {
    delete (global as any).localStorage;
  });

  test('normalizes and stores a local profile', () => {
    const profile = require('../ui/player-profile.js');
    const saved = profile.savePlayerProfile({
      displayName: '  abcdefghijk  ',
      avatarStoneType: 'regen',
      bio: 'x'.repeat(140)
    });

    expect(saved.displayName).toBe('abcdefg');
    expect(saved.avatarStoneType).toBe('REGEN');
    expect(saved.bio).toHaveLength(120);
    expect(profile.readPlayerProfile()).toMatchObject(saved);
  });

  test('falls back to default profile when storage is empty', () => {
    const profile = require('../ui/player-profile.js');
    expect(profile.readPlayerProfile()).toMatchObject({
      displayName: '',
      avatarStoneType: 'REGEN',
      bio: ''
    });
  });

  test('stores multibyte display names by character count', () => {
    const profile = require('../ui/player-profile.js');
    const saved = profile.savePlayerProfile({
      displayName: '我を観測するな!',
      avatarStoneType: 'SNIPER',
      bio: ' よろしくお願いします '
    });

    expect(saved.displayName).toBe('我を観測するな');
    expect(saved.bio).toBe('よろしくお願いします');
  });
});
