const CpuOpponentProfiles = require('../shared/cpu-opponent-profiles.js');

describe('cpu opponent profiles', () => {
  test('defines the visible CPU opponent menu from one source', () => {
    expect(CpuOpponentProfiles.getCpuOpponentMenuOptions()).toEqual([
      { value: '1', label: 'Lv1: 盤喰いの小鬼' },
      { value: '2', label: 'Lv2: 反転の影' },
      { value: '3', label: 'Lv3: 布石を紡ぐ者' },
      { value: '4', label: 'Lv4: 盤面支配者' },
      { value: '5', label: 'Lv5: 終局を告げる者' },
      { value: '6', label: 'Lv6: 盤理の観測者' },
      { value: '6-board-executor', label: 'Lv6: 盤界の執行者' }
    ]);
  });

  test('keeps board executor as a Lv6 opponent profile with its own presentation and deck profile', () => {
    expect(CpuOpponentProfiles.getCpuOpponentProfile('6-board-executor')).toEqual(expect.objectContaining({
      id: '6-board-executor',
      level: 6,
      name: '盤界の執行者',
      portraitSrc: 'assets/images/special-cards/characters/board_executor.png',
      deckProfile: 'lv6-board-executor'
    }));
  });

  test('normalizes profile ids and numeric levels for runtime CPU strength', () => {
    expect(CpuOpponentProfiles.getCpuOpponentLevel('6-board-executor')).toBe(6);
    expect(CpuOpponentProfiles.getCpuOpponentLevel('4')).toBe(4);
    expect(CpuOpponentProfiles.getCpuOpponentProfileId('6-board-executor')).toBe('6-board-executor');
    expect(CpuOpponentProfiles.getCpuOpponentProfileId('bad-value')).toBe('1');
  });
});
