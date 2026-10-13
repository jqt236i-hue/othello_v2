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

describe('player profile change subscription', () => {
  test('notifies subscribers after save and clear, and stops after unsubscribe', () => {
    jest.resetModules();
    const store = new Map<string, string>();
    (global as any).localStorage = {
      getItem: (key: string) => (store.has(key) ? store.get(key) : null),
      setItem: (key: string, value: string) => { store.set(key, String(value)); },
      removeItem: (key: string) => { store.delete(key); }
    };
    try {
      const PlayerProfile = require('../ui/player-profile.ts');
      const listener = jest.fn();
      const unsubscribe = PlayerProfile.subscribePlayerProfile(listener);
      PlayerProfile.savePlayerProfile({ displayName: 'なまえA' });
      PlayerProfile.savePlayerProfile({ displayName: 'なまえB' });
      PlayerProfile.clearPlayerProfile();
      expect(listener.mock.calls.map((call: any[]) => call[0].displayName)).toEqual(['なまえA', 'なまえB', '']);
      unsubscribe();
      PlayerProfile.savePlayerProfile({ displayName: 'なまえC' });
      expect(listener).toHaveBeenCalledTimes(3);
    } finally {
      delete (global as any).localStorage;
    }
  });

  test('a failing subscriber does not stop the save or the other subscribers', () => {
    jest.resetModules();
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    try {
      const PlayerProfile = require('../ui/player-profile.ts');
      const second = jest.fn();
      const offFirst = PlayerProfile.subscribePlayerProfile(() => { throw new Error('screen failed'); });
      const offSecond = PlayerProfile.subscribePlayerProfile(second);
      expect(PlayerProfile.savePlayerProfile({ displayName: 'なまえ' }).displayName).toBe('なまえ');
      expect(second).toHaveBeenCalledWith(expect.objectContaining({ displayName: 'なまえ' }));
      expect(errorSpy).toHaveBeenCalled();
      offFirst();
      offSecond();
    } finally {
      errorSpy.mockRestore();
    }
  });
});
