const CpuOpponentProfiles = require('../shared/cpu-opponent-profiles.js');
const CpuOpponentStartupOptions = require('../shared/cpu-opponent-startup-options.js');
const DeckCodecModule = require('../shared/deck-codec.js');
const DeckSpecHelpers = require('../shared/deck-spec.js');

const EXPECTED_LV7_THEORY_INCARNATION_DECK_CODE = 'D1C1:ghost_01.perma_01.tempt_01.regen_01.udr_01.breeding_01.proliferation_01.clone_01.hyperactive_01.escape_01.robot_vacuum_01.will_hunter_king_01.instant_hyperactive_01.heaven_01.theory_incarnation_01.gold_stone.rainbow_stone.crystal_stone.extend_life_01.extend_life_god_01.guard_01.guardian_god_01.stone_salvation_god_01.destroy_dragon_01.lightning_01.udg_01.ultimate_hyperactive_01.meteor_god_01.chaos_summon_01*2';
const EXPECTED_LV8_ENDING_ASH_DECK_CODE = 'D1C1:swap_01*2.position_swap_01*2.perma_01*3.strong_wind_01.super_buoyancy_01.buoyancy_01.super_gravity_01.super_attraction_01.gravity_01.tempt_01.regen_01.destroy_01*3.udr_01.will_hunter_king_01.observer_will_01.guard_01*2.stone_salvation_god_01.board_expand_01*2.board_shrink_01.meteor_01.support_troops_01.meteor_god_01';

describe('cpu opponent profiles', () => {
  test('Lv11 uses the supplied portrait and preserves evaluated Lv10 game conditions on both colors', () => {
    expect(CpuOpponentProfiles.getCpuOpponentProfile(11)).toMatchObject({
      id: '11-execution-chaos-dragon', decisionLevel: 11,
      name: '執行エグゼキューションカオスドラゴン',
      portraitSrc: 'assets/images/cpu/execution-chaos-dragon.png'
    });
    for (const player of ['black', 'white']) {
      const { profileId: _ten, ...baseline } = CpuOpponentStartupOptions.getCpuOpponentStartupOptions(10, player);
      const { profileId: _eleven, ...candidate } = CpuOpponentStartupOptions.getCpuOpponentStartupOptions(11, player);
      expect(candidate).toEqual(baseline);
      expect(candidate.deckCardIds).toHaveLength(94);
      expect(candidate).toMatchObject({ initialCharge: 99, chargeGainMultiplier: 2, cardUseUnlockTurnNumber: 6 });
    }
  });
  test('Lv10 has its own decision path and inherits every Lv9 game condition on both colors', () => {
    expect(CpuOpponentProfiles.getCpuOpponentDecisionLevel(10)).toBe(10);
    expect(CpuOpponentProfiles.getCpuOpponentProfileId(10)).toBe('10-observed-dark-dragon');
    const nine = CpuOpponentProfiles.getCpuOpponentProfile(9), ten = CpuOpponentProfiles.getCpuOpponentProfile(10);
    expect(ten.initialChargeByPlayer).toBe(nine.initialChargeByPlayer);
    for (const player of ['black', 'white']) {
      // Lv10 has its own deck (CPU deck tool); every other startup condition is shared with Lv9.
      const { profileId: _nine, deckCardIds: nineDeck, ...a } = CpuOpponentStartupOptions.getCpuOpponentStartupOptions(9, player);
      const { profileId: _ten, deckCardIds: tenDeck, ...b } = CpuOpponentStartupOptions.getCpuOpponentStartupOptions(10, player);
      expect(b).toEqual(a);
      expect(nineDeck).toHaveLength(94);
      expect(tenDeck!.length).toBeGreaterThan(0);
      expect(b).toMatchObject({ initialCharge: 99, chargeGainMultiplier: 2, cardUseUnlockTurnNumber: 6 });
    }
  });
  test('defines the visible CPU opponent menu from one source', () => {
    expect(CpuOpponentProfiles.getCpuOpponentMenuOptions()).toEqual([
      { value: '1', label: 'Lv1: 盤喰いの小鬼' },
      { value: '2', label: 'Lv2: 反転の影' },
      { value: '3', label: 'Lv3: 布石を紡ぐ者' },
      { value: '4', label: 'Lv4: 盤面支配者' },
      { value: '5', label: 'Lv5: 終局を告げる者' },
      { value: '6', label: 'Lv6: 盤理の観測者' },
      { value: '7-board-executor', label: 'Lv7: 盤界の執行者' },
      { value: '8-theory-incarnation', label: 'Lv8: 理論の化身' },
      { value: '9-ending-ash', label: 'Lv9: 終焉の冥灰' },
      { value: '10-observed-dark-dragon', label: 'Lv10: 観測ダークドラゴン' },
      { value: '11-execution-chaos-dragon', label: 'Lv11: 執行エグゼキューションカオスドラゴン' },
      { value: '12-strategy-cpu', label: 'Lv12: 理論カオスロジカルエンペラービースト' },
      { value: '13-truth-chaos-emperor-beast', label: 'Lv13: 真理カオスロジカルエンペラービースト' }
    ]);
  });

  test('keeps board executor as a Lv7 opponent profile with its own presentation and deck profile', () => {
    expect(CpuOpponentProfiles.getCpuOpponentProfile('7-board-executor')).toEqual(expect.objectContaining({
      id: '7-board-executor',
      level: 7,
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
    expect(CpuOpponentProfiles.getCpuOpponentLevel('7-board-executor')).toBe(7);
    expect(CpuOpponentProfiles.getCpuOpponentLevel('8-theory-incarnation')).toBe(8);
    expect(CpuOpponentProfiles.getCpuOpponentLevel('9-ending-ash')).toBe(9);
    expect(CpuOpponentProfiles.getCpuOpponentLevel('4')).toBe(4);
    expect(CpuOpponentProfiles.getCpuOpponentProfileId('7-board-executor')).toBe('7-board-executor');
    expect(CpuOpponentProfiles.getCpuOpponentProfileId(7)).toBe('7-board-executor');
    expect(CpuOpponentProfiles.getCpuOpponentProfileId(8)).toBe('8-theory-incarnation');
    expect(CpuOpponentProfiles.getCpuOpponentProfileId(9)).toBe('9-ending-ash');
    expect(CpuOpponentProfiles.getCpuOpponentProfileId('bad-value')).toBe('1');
  });

  test('maps legacy profile ids onto the new Lv7-Lv9 profile ids', () => {
    expect(CpuOpponentProfiles.getCpuOpponentProfileId('6-board-executor')).toBe('7-board-executor');
    expect(CpuOpponentProfiles.getCpuOpponentProfileId('7-theory-incarnation')).toBe('8-theory-incarnation');
    expect(CpuOpponentProfiles.getCpuOpponentProfileId('8-ending-ash')).toBe('9-ending-ash');
    expect(CpuOpponentProfiles.isCpuOpponentProfile('6-board-executor', '7-board-executor')).toBe(true);
    expect(CpuOpponentProfiles.isCpuOpponentProfile('8-ending-ash', '9-ending-ash')).toBe(true);
  });

  test('keeps theory incarnation as a Lv8 opponent profile that reuses Lv6 decisions with a handicap', () => {
    expect(CpuOpponentProfiles.getCpuOpponentProfile('8-theory-incarnation')).toEqual(expect.objectContaining({
      id: '8-theory-incarnation',
      level: 8,
      decisionLevel: 6,
      name: '理論の化身',
      portraitSrc: 'assets/images/special-cards/characters/theory_incarnation.png',
      deckProfile: 'lv7-theory-incarnation',
      initialChargeByPlayer: { white: 50 },
      cardUseUnlockTurnNumber: 8
    }));
    expect(CpuOpponentProfiles.getCpuOpponentDecisionLevel('8-theory-incarnation')).toBe(6);
    expect(CpuOpponentProfiles.getCpuOpponentCardUseUnlockTurnNumber(8)).toBe(8);
  });

  test('keeps ending ash as a Lv9 opponent profile that reuses Lv6 decisions with a stronger handicap', () => {
    expect(CpuOpponentProfiles.getCpuOpponentProfile('9-ending-ash')).toEqual(expect.objectContaining({
      id: '9-ending-ash',
      level: 9,
      decisionLevel: 6,
      name: '終焉の冥灰',
      portraitSrc: 'assets/images/special-cards/characters/終焉の冥灰.png',
      deckProfile: 'lv9-ending-ash-all-enabled',
      initialCharge: 99,
      initialChargeByPlayer: { black: 99, white: 99 },
      chargeGainMultiplier: 2,
      cardUseUnlockTurnNumber: 6
    }));
    expect(CpuOpponentProfiles.getCpuOpponentChargeGainMultiplierForPlayer('9-ending-ash', 'white')).toBe(2);
    expect(CpuOpponentProfiles.getCpuOpponentChargeGainMultiplierForPlayer('9-ending-ash', 'black')).toBe(2);
    expect(CpuOpponentProfiles.getCpuOpponentChargeGainMultiplierForPlayer('8-theory-incarnation', 'white')).toBe(1);
    expect(CpuOpponentProfiles.getCpuOpponentDecisionLevel('9-ending-ash')).toBe(6);
    expect(CpuOpponentProfiles.getCpuOpponentDecisionLevel(9)).toBe(6);
    expect(CpuOpponentProfiles.getCpuOpponentCardUseUnlockTurnNumber(9)).toBe(6);
  });

  test('resolves runtime CPU selection from one profile source for numeric and id values', () => {
    expect(CpuOpponentProfiles.resolveCpuOpponentRuntimeSelection(9)).toEqual(expect.objectContaining({
      profileId: '9-ending-ash',
      level: 9,
      decisionLevel: 6,
      cardUseUnlockTurnNumber: 6
    }));
    expect(CpuOpponentProfiles.resolveCpuOpponentRuntimeSelection('9-ending-ash')).toEqual(expect.objectContaining({
      profileId: '9-ending-ash',
      level: 9,
      decisionLevel: 6,
      cardUseUnlockTurnNumber: 6
    }));
    expect(CpuOpponentProfiles.resolveCpuOpponentRuntimeSelection('8-theory-incarnation')).toEqual(expect.objectContaining({
      profileId: '8-theory-incarnation',
      level: 8,
      decisionLevel: 6,
      cardUseUnlockTurnNumber: 8
    }));
  });

  test('resolves CPU card phase unlock from shared profile data', () => {
    expect(CpuOpponentProfiles.shouldSkipCpuOpponentCardPhase('9-ending-ash', 5)).toBe(true);
    expect(CpuOpponentProfiles.shouldSkipCpuOpponentCardPhase('9-ending-ash', 6)).toBe(false);
    expect(CpuOpponentProfiles.shouldSkipCpuOpponentCardPhase(9, 5)).toBe(true);
    expect(CpuOpponentProfiles.shouldSkipCpuOpponentCardPhase(9, 6)).toBe(false);
    expect(CpuOpponentProfiles.shouldSkipCpuOpponentCardPhase('8-theory-incarnation', 7)).toBe(true);
    expect(CpuOpponentProfiles.shouldSkipCpuOpponentCardPhase('8-theory-incarnation', 8)).toBe(false);
    expect(CpuOpponentProfiles.shouldSkipCpuOpponentCardPhase('6', 1)).toBe(false);
    expect(CpuOpponentProfiles.shouldSkipCpuOpponentCardPhase('9-ending-ash', 'not-a-turn')).toBe(false);
  });

  test('resolves each CPU deck from its fixed deck instead of a deck code', () => {
    // Contents are edited with the CPU deck tool; only the resolution is fixed here.
    const fixedDecks = require('../shared/cpu-opponent-decks').CPU_OPPONENT_DECKS;
    for (const id of ['1', '6', '7-board-executor', '8-theory-incarnation', '9-ending-ash', '13-truth-chaos-emperor-beast']) {
      expect(CpuOpponentStartupOptions.getCpuOpponentDeckCode(id)).toBeNull();
    }
    for (const id of ['6', '7-board-executor', '8-theory-incarnation', '10-observed-dark-dragon', '13-truth-chaos-emperor-beast']) {
      expect(CpuOpponentStartupOptions.getCpuOpponentDeckCardIds(id)).toEqual(fixedDecks[id]);
    }
    expect(CpuOpponentStartupOptions.getCpuOpponentDeckCardIds('9-ending-ash')).toEqual(DeckSpecHelpers.getCpuLv9EndingAshDeckCardIds());
  });

  test('exposes the dedicated CPU decks as built-in deck presets', () => {
    expect(DeckSpecHelpers.getBuiltInDeckPresets()).toEqual([
      {
        id: 'observation',
        displayName: '観測デッキ',
        deckCode: DeckSpecHelpers.getCpuLv6WhiteDeckCode()
      },
      {
        id: 'execution',
        displayName: '執行デッキ',
        deckCode: DeckSpecHelpers.getCpuLv6BoardExecutorWhiteDeckCode()
      },
      {
        id: 'theory',
        displayName: '理論デッキ',
        deckCode: DeckSpecHelpers.getCpuLv7TheoryIncarnationWhiteDeckCode()
      },
      {
        id: 'ending-ash',
        displayName: '冥灰デッキ',
        deckCode: DeckSpecHelpers.getCpuLv8EndingAshDeckCode()
      }
    ]);
  });

  test('keeps Lv8 theory incarnation on the configured fixed deck code', () => {
    expect(DeckSpecHelpers.getCpuLv7TheoryIncarnationWhiteDeckCode()).toBe(EXPECTED_LV7_THEORY_INCARNATION_DECK_CODE);

    const deckSpec = DeckCodecModule.decodeDeckCode(EXPECTED_LV7_THEORY_INCARNATION_DECK_CODE);

    expect(deckSpec.cards.reduce((sum, entry) => sum + entry.count, 0)).toBe(30);
  });

  test('keeps legacy ending ash built-in preset on the configured fixed deck code', () => {
    expect(DeckSpecHelpers.getCpuLv8EndingAshDeckCode()).toBe(EXPECTED_LV8_ENDING_ASH_DECK_CODE);

    const deckSpec = DeckCodecModule.decodeDeckCode(EXPECTED_LV8_ENDING_ASH_DECK_CODE);

    expect(deckSpec.cards.reduce((sum, entry) => sum + entry.count, 0)).toBe(30);
    expect(deckSpec.cards.find((entry) => entry.cardId === 'observer_will_01')).toEqual({
      cardId: 'observer_will_01',
      count: 1
    });
  });

  test('builds Lv9 ending ash deck from every enabled card except forbidden successors', () => {
    const deckCardIds = DeckSpecHelpers.getCpuLv9EndingAshDeckCardIds();
    const enabledIds = DeckSpecHelpers.getEnabledCardIds();
    const forbidden = [
      'triple_chain_01',
      'quad_chain_01',
      'infinite_chain_01',
      'triple_01',
      'quad_01',
      'infinite_01'
    ];

    expect(deckCardIds.length).toBeGreaterThan(30);
    expect(new Set(deckCardIds).size).toBe(deckCardIds.length);
    expect(deckCardIds).toEqual(enabledIds.filter((cardId) => !forbidden.includes(cardId)));
    expect(deckCardIds).toContain('double_chain_01');
    expect(deckCardIds).toContain('double_01');
    for (const cardId of forbidden) {
      expect(deckCardIds).not.toContain(cardId);
    }
  });

  test('resolves startup options for Lv8 handicap and normal levels', () => {
    expect(CpuOpponentStartupOptions.getCpuOpponentStartupOptions('8-theory-incarnation', 'black')).toEqual({
      profileId: '8-theory-incarnation',
      deckCode: null,
      deckCardIds: require('../shared/cpu-opponent-decks').CPU_OPPONENT_DECKS['8-theory-incarnation'],
      initialCharge: 50,
      chargeGainMultiplier: null,
      cardUseUnlockTurnNumber: 8,
      hasStartupOptions: true
    });
    expect(CpuOpponentStartupOptions.getCpuOpponentStartupOptions('8-theory-incarnation', 'white')).toEqual({
      profileId: '8-theory-incarnation',
      deckCode: null,
      deckCardIds: require('../shared/cpu-opponent-decks').CPU_OPPONENT_DECKS['8-theory-incarnation'],
      initialCharge: 50,
      chargeGainMultiplier: null,
      cardUseUnlockTurnNumber: 8,
      hasStartupOptions: true
    });
    const lv9DeckCardIds = DeckSpecHelpers.getCpuLv9EndingAshDeckCardIds();
    expect(CpuOpponentStartupOptions.getCpuOpponentStartupOptions('9-ending-ash', 'black')).toEqual({
      profileId: '9-ending-ash',
      deckCode: null,
      deckCardIds: lv9DeckCardIds,
      initialCharge: 99,
      chargeGainMultiplier: 2,
      cardUseUnlockTurnNumber: 6,
      hasStartupOptions: true
    });
    expect(CpuOpponentStartupOptions.getCpuOpponentStartupOptions('9-ending-ash', 'white')).toEqual({
      profileId: '9-ending-ash',
      deckCode: null,
      deckCardIds: lv9DeckCardIds,
      initialCharge: 99,
      chargeGainMultiplier: 2,
      cardUseUnlockTurnNumber: 6,
      hasStartupOptions: true
    });
    expect(CpuOpponentStartupOptions.getCpuOpponentStartupOptions('1', 'white')).toEqual({
      profileId: '1',
      deckCode: null,
      deckCardIds: null,
      initialCharge: null,
      chargeGainMultiplier: null,
      cardUseUnlockTurnNumber: null,
      hasStartupOptions: false
    });
  });

  test('keeps opening reset limited to CPU profile startup option changes', () => {
    expect(CpuOpponentStartupOptions.shouldResetOpeningCpuProfileChange({
      matchMode: 'cpu',
      turnNumber: 0,
      previousProfileValue: '1',
      nextProfileValue: '8-theory-incarnation'
    })).toBe(true);
    expect(CpuOpponentStartupOptions.shouldResetOpeningCpuProfileChange({
      matchMode: 'cpu',
      turnNumber: 0,
      previousProfileValue: '1',
      nextProfileValue: '9-ending-ash'
    })).toBe(true);
    expect(CpuOpponentStartupOptions.shouldResetOpeningCpuProfileChange({
      matchMode: 'cpu',
      turnNumber: 1,
      previousProfileValue: '8-theory-incarnation',
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
      previousProfileValue: '8-theory-incarnation',
      nextProfileValue: '1'
    })).toBe(false);
    expect(CpuOpponentStartupOptions.shouldResetOpeningCpuProfileChange({
      matchMode: 'network',
      turnNumber: 0,
      previousProfileValue: '1',
      nextProfileValue: '8-theory-incarnation'
    })).toBe(false);
  });
});


test('Lv12 keeps every evaluated Lv11 startup condition for both colors',()=>{
  expect(CpuOpponentProfiles.getCpuOpponentProfile(12)).toMatchObject({
    name:'理論カオスロジカルエンペラービースト',
    portraitSrc:'assets/images/cpu/theory-chaos-logical-emperor-beast.png'
  });
  expect(CpuOpponentProfiles.getCpuOpponentDecisionLevel(12)).toBe(12);
  expect(CpuOpponentProfiles.getCpuOpponentProfileId(12)).toBe('12-strategy-cpu');
  for(const side of ['black','white']){
    const {profileId:_old,deckCardIds:_oldDeck,...baseline}=CpuOpponentStartupOptions.getCpuOpponentStartupOptions(11,side);
    const {profileId:_new,deckCardIds:newDeck,...candidate}=CpuOpponentStartupOptions.getCpuOpponentStartupOptions(12,side);
    expect(candidate).toEqual(baseline);
    expect(newDeck!.length).toBeGreaterThan(0);
    expect(candidate).toMatchObject({initialCharge:99,chargeGainMultiplier:2,cardUseUnlockTurnNumber:6});
  }
});

test('Lv13 keeps every Lv12 startup condition for both colors and has its own decision level',()=>{
  expect(CpuOpponentProfiles.getCpuOpponentProfile(13)).toMatchObject({
    id:'13-truth-chaos-emperor-beast',
    name:'真理カオスロジカルエンペラービースト'
  });
  expect(CpuOpponentProfiles.getCpuOpponentDecisionLevel(13)).toBe(13);
  expect(CpuOpponentProfiles.getCpuOpponentProfileId(13)).toBe('13-truth-chaos-emperor-beast');
  expect(CpuOpponentProfiles.getCpuOpponentLevel(99)).toBe(13);
  for(const side of ['black','white']){
    // Decks are each CPU's own (CPU deck tool); every other startup condition is shared.
    const {profileId:_old,deckCardIds:_oldDeck,...baseline}=CpuOpponentStartupOptions.getCpuOpponentStartupOptions(12,side);
    const {profileId:_new,deckCardIds:_newDeck,...candidate}=CpuOpponentStartupOptions.getCpuOpponentStartupOptions(13,side);
    expect(candidate).toEqual(baseline);
  }
});
