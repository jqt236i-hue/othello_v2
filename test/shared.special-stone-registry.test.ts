import * as SpecialStoneRegistry from '../shared/special-stone-registry.js';

describe('special stone registry rule classification', () => {
  const playerSpecialStoneTypes = [
    'PROTECTED',
    'PERMA_PROTECTED',
    'ABSOLUTE_PROTECTED',
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
    'DESTROY_DRAGON',
    'DRAGON',
    'ULTIMATE_DESTROY_GOD',
    'ROBOT_VACUUM',
    'GLUTTONOUS',
    'STONE_SALVATION_GOD',
    'TIME_STOP',
    'WILL_HUNTER_KING',
    'TRAP',
    'TIME_BOMB'
  ];

  test('classifies enduring active stones as true_special_stone', () => {
    expect(SpecialStoneRegistry.classifySpecialStoneRuleClass('HYPERACTIVE')).toBe('true_special_stone');
    expect(SpecialStoneRegistry.classifySpecialStoneRuleClass('DESTROY_DRAGON')).toBe('true_special_stone');
    expect(SpecialStoneRegistry.classifySpecialStoneRuleClass('STONE_SALVATION_GOD')).toBe('true_special_stone');
    expect(SpecialStoneRegistry.classifySpecialStoneRuleClass('PROTECTED')).toBe('true_special_stone');
    expect(SpecialStoneRegistry.classifySpecialStoneRuleClass('PERMA_PROTECTED')).toBe('true_special_stone');
    expect(SpecialStoneRegistry.classifySpecialStoneRuleClass('ABSOLUTE_PROTECTED')).toBe('true_special_stone');
    expect(SpecialStoneRegistry.classifySpecialStoneRuleClass('GHOST')).toBe('true_special_stone');
    expect(SpecialStoneRegistry.classifySpecialStoneRuleClass('AFTERIMAGE_WILL')).toBe('true_special_stone');
    expect(SpecialStoneRegistry.classifySpecialStoneRuleClass('REGEN')).toBe('true_special_stone');
    expect(SpecialStoneRegistry.classifySpecialStoneRuleClass('TIME_BOMB')).toBe('bomb');
    expect(SpecialStoneRegistry.classifySpecialStoneRuleClass('TRAP')).toBe('trap');
  });

  test('classifies statuses, bombs, traps, board markers, and placement effects', () => {
    expect(SpecialStoneRegistry.classifySpecialStoneRuleClass('GUARD')).toBe('stone_status');
    expect(SpecialStoneRegistry.classifySpecialStoneRuleClass('DESTROY_PROTECTION')).toBe('stone_status');
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

    expect(SpecialStoneRegistry.canLossWillRevert('ABSOLUTE_PROTECTED')).toBe(false);
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

    for (const type of ['LIVING_WILL', 'GUARD', 'DESTROY_PROTECTION']) {
      expect(SpecialStoneRegistry.classifySpecialStoneRuleClass(type)).toBe('stone_status');
      expect(SpecialStoneRegistry.countsAsSpecialStone(type)).toBe(false);
      expect(SpecialStoneRegistry.isTargetableSpecialStone(type)).toBe(false);
      expect(SpecialStoneRegistry.canLossWillRevert(type)).toBe(false);
    }
  });

  test('DESTROY_PROTECTION is a destroy-only overlay status', () => {
    const info = SpecialStoneRegistry.getSpecialStoneInfo('DESTROY_PROTECTION');

    expect(info).toMatchObject({
      name: '破壊保護',
      destroyProtected: true,
      overlayOnlyVisual: true,
      timerClass: 'stone-destroy-protection-timer'
    });
    expect(info.flipProtected).not.toBe(true);
    expect(SpecialStoneRegistry.getSpecialStoneTimerClass('DESTROY_PROTECTION', 'special-timer')).toBe('stone-destroy-protection-timer');
  });

  test('prepares theory incarnation spawn candidates without including traps or bombs', () => {
    expect(SpecialStoneRegistry.isTheoryIncarnationSpawnCandidate('GHOST')).toBe(true);
    expect(SpecialStoneRegistry.isTheoryIncarnationSpawnCandidate('AFTERIMAGE_WILL')).toBe(true);
    expect(SpecialStoneRegistry.isTheoryIncarnationSpawnCandidate('REGEN')).toBe(true);
    expect(SpecialStoneRegistry.isTheoryIncarnationSpawnCandidate('TRAP')).toBe(false);
    expect(SpecialStoneRegistry.isTheoryIncarnationSpawnCandidate('TIME_BOMB')).toBe(false);
    expect(SpecialStoneRegistry.isTheoryIncarnationSpawnCandidate('OBSERVER_WILL')).toBe(false);
    expect(SpecialStoneRegistry.isTheoryIncarnationSpawnCandidate('LIVING_WILL')).toBe(false);
    expect(SpecialStoneRegistry.getTheoryIncarnationSpawnCandidates()).toEqual(
      expect.arrayContaining(['GHOST', 'AFTERIMAGE_WILL', 'REGEN'])
    );
    expect(SpecialStoneRegistry.getTheoryIncarnationSpawnCandidates()).not.toEqual(
      expect.arrayContaining(['TRAP', 'TIME_BOMB', 'OBSERVER_WILL', 'LIVING_WILL'])
    );
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
        tagFlipEvadeDefault: 3,
        tagDestroyEvadeDefault: 3
      });
      expect(lateRegistry.getSpecialStoneInfo('ULTIMATE_HYPERACTIVE')).toMatchObject({
        tagFlipEvadeDefault: 3,
        tagDestroyEvadeDefault: 1,
        visualFlipEvadeDefault: 3
      });
    } finally {
      jest.dontMock('../shared/evasion-status');
      if (previous === undefined) delete (globalThis as any).EvasionStatus;
      else (globalThis as any).EvasionStatus = previous;
      jest.resetModules();
    }
  });
});

