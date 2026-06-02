import * as SpecialStoneRegistry from '../shared/special-stone-registry.js';

describe('special stone registry rule classification', () => {
  test('classifies enduring active stones as true_special_stone', () => {
    expect(SpecialStoneRegistry.classifySpecialStoneRuleClass('HYPERACTIVE')).toBe('true_special_stone');
    expect(SpecialStoneRegistry.classifySpecialStoneRuleClass('OBSERVER')).toBe('true_special_stone');
    expect(SpecialStoneRegistry.classifySpecialStoneRuleClass('DESTROY_DRAGON')).toBe('true_special_stone');
    expect(SpecialStoneRegistry.classifySpecialStoneRuleClass('STONE_SALVATION_GOD')).toBe('true_special_stone');
  });

  test('classifies statuses, bombs, traps, board markers, and placement effects', () => {
    expect(SpecialStoneRegistry.classifySpecialStoneRuleClass('GUARD')).toBe('stone_status');
    expect(SpecialStoneRegistry.classifySpecialStoneRuleClass('AFTERIMAGE_WILL')).toBe('stone_status');
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

  test('classifies instant hyperactive marker as placement_effect', () => {
    expect(SpecialStoneRegistry.classifySpecialStoneRuleClass('HYPERACTIVE', { instantPlacementOnly: true })).toBe('placement_effect');
    expect(SpecialStoneRegistry.classifyMarkerRuleClass({
      kind: 'specialStone',
      data: { type: 'HYPERACTIVE', instantPlacementOnly: true }
    })).toBe('placement_effect');
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
