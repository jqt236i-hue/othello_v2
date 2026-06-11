const CpuOpponentProfiles = require('../shared/cpu-opponent-profiles.js');
const CpuOpponentStartupOptions = require('../shared/cpu-opponent-startup-options.js');
const DeckSpecHelpers = require('../shared/deck-spec.js');

describe('cpu opponent profiles', () => {
  test('defines the visible CPU opponent menu from one source', () => {
    expect(CpuOpponentProfiles.getCpuOpponentMenuOptions()).toEqual([
      { value: '1', label: 'Lv1: 盤喰いの小鬼' },
      { value: '2', label: 'Lv2: 反転の影' },
      { value: '3', label: 'Lv3: 布石を紡ぐ者' },
      { value: '4', label: 'Lv4: 盤面支配者' },
      { value: '5', label: 'Lv5: 終局を告げる者' },
      { value: '6', label: 'Lv6: 盤理の観測者' },
      { value: '6-board-executor', label: 'Lv6: 盤界の執行者' },
      { value: '7-theory-incarnation', label: 'Lv7: 理論の化身' }
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

  test('keeps observer will as the default Lv6 opponent portrait', () => {
    expect(CpuOpponentProfiles.getCpuOpponentProfile('6')).toEqual(expect.objectContaining({
      id: '6',
      level: 6,
      name: '盤理の観測者',
      portraitSrc: 'assets/images/special-cards/characters/observer_will.png',
      deckProfile: 'lv6-default'
    }));
  });

  test('normalizes profile ids and numeric levels for runtime CPU strength', () => {
    expect(CpuOpponentProfiles.getCpuOpponentLevel('6-board-executor')).toBe(6);
    expect(CpuOpponentProfiles.getCpuOpponentLevel('7-theory-incarnation')).toBe(7);
    expect(CpuOpponentProfiles.getCpuOpponentLevel('4')).toBe(4);
    expect(CpuOpponentProfiles.getCpuOpponentProfileId('6-board-executor')).toBe('6-board-executor');
    expect(CpuOpponentProfiles.getCpuOpponentProfileId(7)).toBe('7-theory-incarnation');
    expect(CpuOpponentProfiles.getCpuOpponentProfileId('bad-value')).toBe('1');
  });

  test('keeps theory incarnation as a Lv7 opponent profile that reuses Lv6 decisions with a handicap', () => {
    expect(CpuOpponentProfiles.getCpuOpponentProfile('7-theory-incarnation')).toEqual(expect.objectContaining({
      id: '7-theory-incarnation',
      level: 7,
      decisionLevel: 6,
      name: '理論の化身',
      portraitSrc: 'assets/images/special-cards/characters/theory_incarnation.png',
      deckProfile: 'lv7-theory-incarnation',
      initialChargeByPlayer: { white: 50 },
      cardUseUnlockTurnNumber: 8
    }));
    expect(CpuOpponentProfiles.getCpuOpponentDecisionLevel('7-theory-incarnation')).toBe(6);
    expect(CpuOpponentProfiles.getCpuOpponentCardUseUnlockTurnNumber(7)).toBe(8);
  });

  test('resolves dedicated CPU deck codes from opponent profiles', () => {
    expect(CpuOpponentStartupOptions.getCpuOpponentDeckCode('1')).toBeNull();
    expect(CpuOpponentStartupOptions.getCpuOpponentDeckCode('6')).toBe(DeckSpecHelpers.getCpuLv6WhiteDeckCode());
    expect(CpuOpponentStartupOptions.getCpuOpponentDeckCode('6-board-executor')).toBe(DeckSpecHelpers.getCpuLv6BoardExecutorWhiteDeckCode());
    expect(CpuOpponentStartupOptions.getCpuOpponentDeckCode('7-theory-incarnation')).toBe(DeckSpecHelpers.getCpuLv7TheoryIncarnationWhiteDeckCode());
  });

  test('resolves startup options for Lv7 handicap and normal levels', () => {
    expect(CpuOpponentStartupOptions.getCpuOpponentStartupOptions('7-theory-incarnation', 'black')).toEqual({
      profileId: '7-theory-incarnation',
      deckCode: DeckSpecHelpers.getCpuLv7TheoryIncarnationWhiteDeckCode(),
      initialCharge: 50,
      cardUseUnlockTurnNumber: 8,
      hasStartupOptions: true
    });
    expect(CpuOpponentStartupOptions.getCpuOpponentStartupOptions('7-theory-incarnation', 'white')).toEqual({
      profileId: '7-theory-incarnation',
      deckCode: DeckSpecHelpers.getCpuLv7TheoryIncarnationWhiteDeckCode(),
      initialCharge: 50,
      cardUseUnlockTurnNumber: 8,
      hasStartupOptions: true
    });
    expect(CpuOpponentStartupOptions.getCpuOpponentStartupOptions('1', 'white')).toEqual({
      profileId: '1',
      deckCode: null,
      initialCharge: null,
      cardUseUnlockTurnNumber: null,
      hasStartupOptions: false
    });
  });

  test('keeps opening reset limited to CPU profile startup option changes', () => {
    expect(CpuOpponentStartupOptions.shouldResetOpeningCpuProfileChange({
      matchMode: 'cpu',
      turnNumber: 0,
      previousProfileValue: '1',
      nextProfileValue: '7-theory-incarnation'
    })).toBe(true);
    expect(CpuOpponentStartupOptions.shouldResetOpeningCpuProfileChange({
      matchMode: 'cpu',
      turnNumber: 1,
      previousProfileValue: '7-theory-incarnation',
      nextProfileValue: '1'
    })).toBe(true);
    expect(CpuOpponentStartupOptions.shouldResetOpeningCpuProfileChange({
      matchMode: 'cpu',
      turnNumber: 1,
      previousProfileValue: '1',
      nextProfileValue: '2'
    })).toBe(false);
    expect(CpuOpponentStartupOptions.shouldResetOpeningCpuProfileChange({
      matchMode: 'cpu',
      turnNumber: 2,
      previousProfileValue: '7-theory-incarnation',
      nextProfileValue: '1'
    })).toBe(false);
    expect(CpuOpponentStartupOptions.shouldResetOpeningCpuProfileChange({
      matchMode: 'network',
      turnNumber: 0,
      previousProfileValue: '1',
      nextProfileValue: '7-theory-incarnation'
    })).toBe(false);
  });
});
