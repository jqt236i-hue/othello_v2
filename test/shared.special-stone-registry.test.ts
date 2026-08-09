import * as SpecialStoneRegistry from '../shared/special-stone-registry.js';

const INVALID_STORED_ANCHORS = [
  { label: 'numeric strings', row: '2', col: '3' },
  { label: 'fraction', row: 2.5, col: 3 },
  { label: 'NaN', row: Number.NaN, col: 3 },
  { label: 'infinity', row: 2, col: Number.POSITIVE_INFINITY },
  { label: 'missing row', col: 3 },
  { label: 'non-number', row: {}, col: 3 }
];

function createOrdinaryMarker(anchor: any) {
  return Object.assign({
    kind: 'specialStone',
    owner: 'black',
    data: { type: 'GUARD' }
  }, anchor);
}

function createShinraMarker(anchor: any) {
  return Object.assign({
    kind: 'specialStone',
    owner: 'black',
    data: {
      type: 'SHINRA_BANSHO_GOD',
      footprint: 'square_2x2.v1',
      permanent: true
    }
  }, anchor);
}

function expectExactStoredAnchorContract(registry: any) {
  const ordinary = createOrdinaryMarker({ row: 2, col: 3 });
  const shinra = createShinraMarker({ row: 2, col: 3 });

  expect(registry.getSpecialStoneFootprint(ordinary)).toEqual([
    { row: 2, col: 3, role: 'anchor' }
  ]);
  expect(registry.markerOccupiesCell(ordinary, '2', '3')).toBe(true);
  expect(registry.getSpecialStoneFootprint(shinra)).toEqual([
    { row: 2, col: 3, role: 'anchor' },
    { row: 2, col: 4, role: 'top-right' },
    { row: 3, col: 3, role: 'bottom-left' },
    { row: 3, col: 4, role: 'bottom-right' }
  ]);
  expect(registry.markerOccupiesCell(shinra, '3', '4')).toBe(true);

  for (const nonMarker of [0, -0, null, undefined, false, '', []]) {
    expect(registry.getSpecialStoneFootprint(nonMarker)).toEqual([]);
    expect(registry.markerOccupiesCell(nonMarker, 0, 0)).toBe(false);
  }

  for (const anchor of INVALID_STORED_ANCHORS) {
    const ordinaryInvalid = createOrdinaryMarker(anchor);
    const shinraInvalid = createShinraMarker(anchor);
    expect(registry.getSpecialStoneFootprint(ordinaryInvalid)).toEqual([]);
    expect(registry.markerOccupiesCell(ordinaryInvalid, 2, 3)).toBe(false);
    expect(registry.getSpecialStoneFootprint(shinraInvalid)).toEqual([]);
    expect(registry.markerOccupiesCell(shinraInvalid, 2, 3)).toBe(false);
  }
}

describe('special stone registry rule classification', () => {
  const playerSpecialStoneTypes = [
    'PROTECTED',
    'PERMA_PROTECTED',
    'REGEN',
    'GHOST',
    'AFTERIMAGE_WILL',
    'HYPERACTIVE',
    'EXTREME_HYPERACTIVE',
    'ESCAPE_HYPERACTIVE',
    'ULTIMATE_HYPERACTIVE',
    'WORK',
    'BREEDING',
    'PROLIFERATION',
    'SNIPER',
    'LIGHTNING',
    'FIRE',
    'GRASS',
    'DESTROY_DRAGON',
    'DRAGON',
    'ULTIMATE_DESTROY_GOD',
    'ROBOT_VACUUM',
    'GLUTTONOUS',
    'STONE_SALVATION_GOD',
    'TIME_STOP',
    'TIME_STOP_DEITY',
    'WILL_HUNTER_KING',
    'SACRIFICE',
    'ZOMBIE',
    'TRAP',
    'TIME_BOMB'
  ];

  test('classifies enduring active stones as true_special_stone', () => {
    expect(SpecialStoneRegistry.classifySpecialStoneRuleClass('HYPERACTIVE')).toBe('true_special_stone');
    expect(SpecialStoneRegistry.classifySpecialStoneRuleClass('DESTROY_DRAGON')).toBe('true_special_stone');
    expect(SpecialStoneRegistry.classifySpecialStoneRuleClass('GRASS')).toBe('true_special_stone');
    expect(SpecialStoneRegistry.classifySpecialStoneRuleClass('STONE_SALVATION_GOD')).toBe('true_special_stone');
    expect(SpecialStoneRegistry.classifySpecialStoneRuleClass('PROTECTED')).toBe('true_special_stone');
    expect(SpecialStoneRegistry.classifySpecialStoneRuleClass('PERMA_PROTECTED')).toBe('true_special_stone');
    expect(SpecialStoneRegistry.classifySpecialStoneRuleClass('GHOST')).toBe('true_special_stone');
    expect(SpecialStoneRegistry.classifySpecialStoneRuleClass('SACRIFICE')).toBe('true_special_stone');
    expect(SpecialStoneRegistry.classifySpecialStoneRuleClass('AFTERIMAGE_WILL')).toBe('true_special_stone');
    expect(SpecialStoneRegistry.classifySpecialStoneRuleClass('REGEN')).toBe('true_special_stone');
    expect(SpecialStoneRegistry.classifySpecialStoneRuleClass('TIME_BOMB')).toBe('bomb');
    expect(SpecialStoneRegistry.classifySpecialStoneRuleClass('TRAP')).toBe('trap');
  });

  test('classifies statuses, bombs, traps, board markers, and placement effects', () => {
    expect(SpecialStoneRegistry.classifySpecialStoneRuleClass('GUARD')).toBe('stone_status');
    expect(SpecialStoneRegistry.classifySpecialStoneRuleClass('LIVING_WILL')).toBe('stone_status');
    expect(SpecialStoneRegistry.classifySpecialStoneRuleClass('TIME_BOMB')).toBe('bomb');
    expect(SpecialStoneRegistry.classifySpecialStoneRuleClass('TRAP')).toBe('trap');
    expect(SpecialStoneRegistry.classifySpecialStoneRuleClass('BLOCKADE')).toBe('board_marker');
    expect(SpecialStoneRegistry.classifySpecialStoneRuleClass('FREEZE')).toBe('board_marker');
    expect(SpecialStoneRegistry.classifySpecialStoneRuleClass('SEED')).toBe('board_marker');
    expect(SpecialStoneRegistry.classifySpecialStoneRuleClass('CROSS_BOMB')).toBe('placement_effect');
    expect(SpecialStoneRegistry.classifySpecialStoneRuleClass('X_BOMB')).toBe('placement_effect');
    expect(SpecialStoneRegistry.classifySpecialStoneRuleClass('GOLD')).toBe('placement_effect');
    expect(SpecialStoneRegistry.classifySpecialStoneRuleClass('SILVER')).toBe('placement_effect');
    expect(SpecialStoneRegistry.classifySpecialStoneRuleClass('RAINBOW')).toBe('placement_effect');
  });

  test('classifies Rescue God duration as a normal special stone body timer', () => {
    expect(SpecialStoneRegistry.getSpecialStoneTimerClass('STONE_SALVATION_GOD', 'special-timer')).toBe('special-timer');
  });

  test('classifies instant hyperactive marker as placement_effect', () => {
    expect(SpecialStoneRegistry.classifySpecialStoneRuleClass('HYPERACTIVE', { instantPlacementOnly: true })).toBe('placement_effect');
    expect(SpecialStoneRegistry.classifyMarkerRuleClass({
      kind: 'specialStone',
      data: { type: 'HYPERACTIVE', instantPlacementOnly: true }
    })).toBe('placement_effect');
  });

  test('exposes player-facing special stone traits separately from implementation category', () => {
    for (const type of playerSpecialStoneTypes) {
      expect(SpecialStoneRegistry.countsAsSpecialStone(type)).toBe(true);
      expect(SpecialStoneRegistry.isTargetableSpecialStone(type)).toBe(true);
    }

    expect(SpecialStoneRegistry.canLossWillRevert('PROTECTED')).toBe(true);
    expect(SpecialStoneRegistry.canLossWillRevert('GHOST')).toBe(true);
    expect(SpecialStoneRegistry.canLossWillRevert('TRAP')).toBe(true);
    expect(SpecialStoneRegistry.canLossWillRevert('TIME_BOMB')).toBe(true);
  });

  test('keeps manifest stones and status attachments outside special-stone targeting', () => {
    for (const type of ['THEORY_INCARNATION', 'BOARD_EXECUTOR', 'OBSERVER_WILL']) {
      expect(SpecialStoneRegistry.classifySpecialStoneRuleClass(type)).toBe('manifest_stone');
      expect(SpecialStoneRegistry.countsAsSpecialStone(type)).toBe(false);
      expect(SpecialStoneRegistry.isTargetableSpecialStone(type)).toBe(false);
      expect(SpecialStoneRegistry.isInviolableStoneEffect(type)).toBe(true);
    }

    for (const type of ['LIVING_WILL', 'GUARD', 'SCORCHED']) {
      expect(SpecialStoneRegistry.classifySpecialStoneRuleClass(type)).toBe('stone_status');
      expect(SpecialStoneRegistry.countsAsSpecialStone(type)).toBe(false);
      expect(SpecialStoneRegistry.isTargetableSpecialStone(type)).toBe(false);
      expect(SpecialStoneRegistry.canLossWillRevert(type)).toBe(false);
    }
  });

  test('prepares theory incarnation spawn candidates without including traps or bombs', () => {
    expect(SpecialStoneRegistry.isTheoryIncarnationSpawnCandidate('GHOST')).toBe(true);
    expect(SpecialStoneRegistry.isTheoryIncarnationSpawnCandidate('AFTERIMAGE_WILL')).toBe(true);
    expect(SpecialStoneRegistry.isTheoryIncarnationSpawnCandidate('REGEN')).toBe(true);
    expect(SpecialStoneRegistry.isTheoryIncarnationSpawnCandidate('GRASS')).toBe(true);
    expect(SpecialStoneRegistry.isTheoryIncarnationSpawnCandidate('TRAP')).toBe(false);
    expect(SpecialStoneRegistry.isTheoryIncarnationSpawnCandidate('TIME_BOMB')).toBe(false);
    expect(SpecialStoneRegistry.isTheoryIncarnationSpawnCandidate('OBSERVER_WILL')).toBe(false);
    expect(SpecialStoneRegistry.isTheoryIncarnationSpawnCandidate('LIVING_WILL')).toBe(false);
    expect(SpecialStoneRegistry.getTheoryIncarnationSpawnCandidates()).toEqual(
      expect.arrayContaining(['GHOST', 'AFTERIMAGE_WILL', 'REGEN', 'GRASS'])
    );
    expect(SpecialStoneRegistry.getTheoryIncarnationSpawnCandidates()).not.toEqual(
      expect.arrayContaining(['TRAP', 'TIME_BOMB', 'OBSERVER_WILL', 'LIVING_WILL'])
    );
  });

  test('keeps Shinra as one special stone while projecting inviolability across its footprint', () => {
    const marker = {
      kind: 'specialStone',
      row: 2,
      col: 3,
      owner: 'black',
      data: {
        type: 'SHINRA_BANSHO_GOD',
        footprint: 'square_2x2.v1',
        permanent: true
      }
    };

    expect(SpecialStoneRegistry.classifySpecialStoneRuleClass('SHINRA_BANSHO_GOD')).toBe('true_special_stone');
    expect(SpecialStoneRegistry.countsAsSpecialStone('SHINRA_BANSHO_GOD')).toBe(true);
    expect(SpecialStoneRegistry.isTargetableSpecialStone('SHINRA_BANSHO_GOD')).toBe(false);
    expect(SpecialStoneRegistry.isInviolableStoneEffect('SHINRA_BANSHO_GOD')).toBe(true);
    expect(SpecialStoneRegistry.isFullyProtectedSpecialStoneMarker(marker)).toBe(false);
    expect(SpecialStoneRegistry.isInviolableSpecialStoneMarker(marker)).toBe(true);
    for (const [row, col] of [[2, 3], [2, 4], [3, 3], [3, 4]]) {
      expect(SpecialStoneRegistry.isInviolableCell([marker], row, col)).toBe(true);
    }
  });

  test('requires exact integer stored anchors through the primary footprint owner', () => {
    expectExactStoredAnchorContract(SpecialStoneRegistry);
  });

  test('keeps exact stored anchors in the compatibility fallback without MultiCellStone', () => {
    let fallbackRegistry: any = null;
    try {
      jest.resetModules();
      jest.doMock('../shared/multi-cell-stone', () => ({}));
      jest.isolateModules(() => {
        const mockedMultiCellStone = require('../shared/multi-cell-stone');
        expect(mockedMultiCellStone.getSpecialStoneFootprint).toBeUndefined();
        fallbackRegistry = require('../shared/special-stone-registry');
      });

      expect(fallbackRegistry).toBeTruthy();
      expectExactStoredAnchorContract(fallbackRegistry);
    } finally {
      jest.dontMock('../shared/multi-cell-stone');
      jest.resetModules();
    }
  });

  test('exposes canonical special-stone card mappings', () => {
    const expected = [
      ['hard_01', 'PROTECTED_NEXT_STONE', 'PROTECTED'],
      ['perma_01', 'PERMA_PROTECT_NEXT_STONE', 'PERMA_PROTECTED'],
      ['sniper_01', 'SNIPER_WILL', 'SNIPER'],
      ['ghost_01', 'GHOST_WILL', 'GHOST'],
      ['afterimage_will_01', 'AFTERIMAGE_WILL', 'AFTERIMAGE_WILL'],
      ['trap_01', 'TRAP_WILL', 'TRAP'],
      ['bomb_01', 'TIME_BOMB', 'TIME_BOMB'],
      ['time_stop_god_01', 'TIME_STOP_GOD', 'TIME_STOP'],
      ['time_stop_deity_01', 'TIME_STOP_DEITY', 'TIME_STOP_DEITY'],
      ['regen_01', 'REGEN_WILL', 'REGEN'],
      ['udr_01', 'ULTIMATE_REVERSE_DRAGON', 'DRAGON'],
      ['breeding_01', 'BREEDING_WILL', 'BREEDING'],
      ['proliferation_01', 'PROLIFERATION_WILL', 'PROLIFERATION'],
      ['hyperactive_01', 'HYPERACTIVE_WILL', 'HYPERACTIVE'],
      ['extreme_hyperactive_01', 'EXTREME_HYPERACTIVE_WILL', 'EXTREME_HYPERACTIVE'],
      ['escape_01', 'ESCAPE_WILL', 'ESCAPE_HYPERACTIVE'],
      ['robot_vacuum_01', 'ROBOT_VACUUM_WILL', 'ROBOT_VACUUM'],
      ['gluttonous_will_01', 'GLUTTONOUS_WILL', 'GLUTTONOUS'],
      ['will_hunter_king_01', 'WILL_HUNTER_KING', 'WILL_HUNTER_KING'],
      ['work_01', 'WORK_WILL', 'WORK'],
      ['ultimate_work_god_01', 'ULTIMATE_WORK_GOD', 'ULTIMATE_WORK_GOD'],
      ['stone_salvation_god_01', 'STONE_SALVATION_GOD', 'STONE_SALVATION_GOD'],
      ['destroy_dragon_01', 'DESTROY_DRAGON_WILL', 'DESTROY_DRAGON'],
      ['lightning_01', 'LIGHTNING_WILL', 'LIGHTNING'],
      ['fire_will_01', 'FIRE_WILL', 'FIRE'],
      ['water_will_01', 'WATER_WILL', 'WATER'],
      ['grass_will_01', 'GRASS_WILL', 'GRASS'],
      ['udg_01', 'ULTIMATE_DESTROY_GOD', 'ULTIMATE_DESTROY_GOD'],
      ['ultimate_hyperactive_01', 'ULTIMATE_HYPERACTIVE_GOD', 'ULTIMATE_HYPERACTIVE'],
      ['meteor_god_01', 'METEOR_GOD', 'METEOR_GOD'],
      ['sacrifice_will_01', 'SACRIFICE_WILL', 'SACRIFICE'],
      ['zombie_will_01', 'ZOMBIE_WILL', 'ZOMBIE']
    ];

    for (const [cardId, cardType, markerType] of expected) {
      expect(SpecialStoneRegistry.getSpecialStoneCardDefinition(cardType)).toEqual(
        expect.objectContaining({ cardId, cardType, markerType })
      );
      expect(SpecialStoneRegistry.getMarkerTypeForSpecialStoneCard(cardType)).toBe(markerType);
    }
    expect(SpecialStoneRegistry.getSpecialStoneDisplayName('SACRIFICE')).toBe('犠牲石');
    expect(SpecialStoneRegistry.countsAsSpecialStone('SACRIFICE')).toBe(true);
    expect(SpecialStoneRegistry.isTargetableSpecialStone('SACRIFICE')).toBe(true);
  });

  test('exposes purpose-specific special-stone targeting traits', () => {
    for (const type of ['PROTECTED', 'PERMA_PROTECTED', 'GHOST', 'AFTERIMAGE_WILL', 'REGEN', 'WILL_HUNTER_KING']) {
      expect(SpecialStoneRegistry.isTemptTargetableStoneEffect(type)).toBe(true);
      expect(SpecialStoneRegistry.isCaptureTargetableStoneEffect(type)).toBe(true);
      expect(SpecialStoneRegistry.canLossWillRevert(type)).toBe(true);
    }

    expect(SpecialStoneRegistry.isTemptTargetableStoneEffect('TRAP')).toBe(true);
    expect(SpecialStoneRegistry.isTemptTargetableStoneEffect('TIME_BOMB')).toBe(true);
    expect(SpecialStoneRegistry.isTemptTargetableStoneEffect('LIVING_WILL')).toBe(true);
    expect(SpecialStoneRegistry.isNormalVisualStoneEffect('TRAP')).toBe(true);
    expect(SpecialStoneRegistry.isNormalVisualStoneEffect('LIVING_WILL')).toBe(true);
    expect(SpecialStoneRegistry.canLossWillRevert('TRAP')).toBe(true);
    expect(SpecialStoneRegistry.canLossWillRevert('TIME_BOMB')).toBe(true);

    expect(SpecialStoneRegistry.isCaptureTargetableStoneEffect('TRAP')).toBe(false);
    expect(SpecialStoneRegistry.isCaptureTargetableStoneEffect('TIME_BOMB')).toBe(false);
    expect(SpecialStoneRegistry.isCaptureTargetableStoneEffect('LIVING_WILL')).toBe(false);
    expect(SpecialStoneRegistry.canLossWillRevert('LIVING_WILL')).toBe(false);
    expect(SpecialStoneRegistry.classifySpecialStoneRuleClass('POISONED')).toBe('stone_status');
    expect(SpecialStoneRegistry.isNormalVisualStoneEffect('POISONED')).toBe(true);
    expect(SpecialStoneRegistry.isTemptTargetableStoneEffect('POISONED')).toBe(false);
    expect(SpecialStoneRegistry.isDurationAffectableMarker({ kind: 'specialStone', data: { type: 'POISONED', remainingTurns: 5 } })).toBe(false);
    expect(SpecialStoneRegistry.isDurationAffectableMarker({ kind: 'specialStone', data: { type: 'REGEN', remainingOwnerTurns: 3, regenRemaining: 3 } })).toBe(false);

    expect(SpecialStoneRegistry.isTemptTargetableStoneEffect('GUARD')).toBe(false);
    expect(SpecialStoneRegistry.blocksTempt('GUARD')).toBe(true);
    expect(SpecialStoneRegistry.isNormalVisualStoneEffect('GUARD')).toBe(false);
    expect(SpecialStoneRegistry.canLossWillRevert('GUARD')).toBe(false);

    for (const type of ['THEORY_INCARNATION', 'BOARD_EXECUTOR', 'OBSERVER_WILL', 'BLOCKADE', 'FREEZE', 'SEED', 'GOLD', 'SILVER', 'RAINBOW']) {
      expect(SpecialStoneRegistry.isTemptTargetableStoneEffect(type)).toBe(false);
    }
  });

  test('defines ownership-change lifecycle without per-caller card lists', () => {
    for (const type of ['SACRIFICE', 'PROLIFERATION', 'SNIPER', 'WORK', 'WATER', 'GRASS', 'TIME_STOP', 'TIME_STOP_DEITY', 'TIME_BOMB']) {
      expect(SpecialStoneRegistry.getOwnershipChangePolicy(type)).toBe('revert');
    }
    for (const type of ['REGEN', 'ZOMBIE', 'LIVING_WILL', 'TRAP']) {
      expect(SpecialStoneRegistry.getOwnershipChangePolicy(type)).toBe('resolve_after_change');
    }
    for (const type of ['POISONED', 'SCORCHED', 'BLOCKADE', 'FREEZE', 'SCORCHED_CELL', 'HEALING_CELL', 'THEORY_INCARNATION', 'GOLD']) {
      expect(SpecialStoneRegistry.getOwnershipChangePolicy(type)).toBe('preserve');
    }
    expect(SpecialStoneRegistry.getOwnershipChangePolicy('FUTURE_UNKNOWN_SPECIAL_STONE')).toBe('revert');
    expect(SpecialStoneRegistry.getOwnershipChangePolicy('CUSTOM_BOMB', { category: 'bomb' })).toBe('revert');
  });

  test('defines cell-marker ownership, clock, and stone-preservation semantics centrally', () => {
    expect(SpecialStoneRegistry.getMarkerSemanticTraits('SCORCHED_CELL')).toEqual({
      subjectKind: 'cell_marker',
      ownershipPolicy: 'none',
      durationClock: 'completed_turn',
      exclusivityGroup: 'temporary_special_cell',
      visualLayer: 'cell'
    });
    expect(SpecialStoneRegistry.getMarkerSemanticTraits('POISON_CELL')).toEqual(
      SpecialStoneRegistry.getMarkerSemanticTraits('SCORCHED_CELL')
    );
    expect(SpecialStoneRegistry.getMarkerSemanticTraits('HEALING_CELL')).toEqual(
      SpecialStoneRegistry.getMarkerSemanticTraits('SCORCHED_CELL')
    );
    expect(SpecialStoneRegistry.getMarkerSubjectKind('SCORCHED')).toBe('stone_status');
    expect(SpecialStoneRegistry.getMarkerDurationValue('SCORCHED_CELL', { remainingTurns: 10 })).toBe(10);
    expect(SpecialStoneRegistry.isTemporarySpecialCellType('SEED')).toBe(true);
  });

  test('exposes water stone protection and duration traits through the shared registry', () => {
    expect(SpecialStoneRegistry.getSpecialStoneInfo('WATER')).toEqual(expect.objectContaining({
      name: '水石',
      flipProtected: true
    }));
    expect(SpecialStoneRegistry.isDurationAffectableMarker({
      kind: 'specialStone',
      data: { type: 'WATER', remainingOwnerTurns: 6 }
    })).toBe(true);
    expect(SpecialStoneRegistry.isHazardCellType('HEALING_CELL')).toBe(false);
  });

  test('exposes grass stone protection and duration traits through the shared registry', () => {
    expect(SpecialStoneRegistry.getSpecialStoneInfo('GRASS')).toEqual(expect.objectContaining({
      name: '草石',
      flipProtected: true
    }));
    expect(SpecialStoneRegistry.isDurationAffectableMarker({
      kind: 'specialStone',
      data: { type: 'GRASS', remainingOwnerTurns: 10 }
    })).toBe(true);
  });

  test('late-bound global EvasionStatus still supplies evade defaults', () => {
    const previous = (globalThis as any).EvasionStatus;
    try {
      jest.resetModules();
      jest.doMock('../shared/evasion-status', () => ({}));
      const realEvasionStatus = jest.requireActual('../shared/evasion-status');
      const lateRegistry = require('../shared/special-stone-registry');
      (globalThis as any).EvasionStatus = realEvasionStatus;

      expect(lateRegistry.getSpecialStoneInfo('AFTERIMAGE_WILL')).toMatchObject({
        tagFlipEvadeDefault: 6,
        tagDestroyEvadeDefault: 6
      });
      expect(lateRegistry.getSpecialStoneInfo('EXTREME_HYPERACTIVE')).toMatchObject({
        tagFlipEvadeDefault: 5,
        tagDestroyEvadeDefault: 5,
        visualFlipEvadeDefault: 5
      });
      expect(lateRegistry.getSpecialStoneInfo('ULTIMATE_HYPERACTIVE')).toMatchObject({
        tagFlipEvadeDefault: 5,
        tagDestroyEvadeDefault: 2,
        visualFlipEvadeDefault: 5
      });
    } finally {
      jest.dontMock('../shared/evasion-status');
      if (previous === undefined) delete (globalThis as any).EvasionStatus;
      else (globalThis as any).EvasionStatus = previous;
      jest.resetModules();
    }
  });
});

