import { createCpuPolicyLookaheadBonus } from '../game/ai/cpu-policy-lookahead-bonus';

describe('cpu-policy lookahead bonus module', () => {
  test('parseBonusCellKey rejects malformed keys and hash is stable', () => {
    const helpers = createCpuPolicyLookaheadBonus();

    expect(helpers.parseBonusCellKey('2,5')).toEqual({ row: 2, col: 5 });
    expect(helpers.parseBonusCellKey('bad')).toBeNull();
    expect(helpers.parseBonusCellKey('2,')).toBeNull();
    expect(helpers.hashBonusCellCoord(2, 5)).toBe(helpers.hashBonusCellCoord(2, 5));
    expect(helpers.hashBonusCellCoord(2, 5)).not.toBe(helpers.hashBonusCellCoord(5, 2));
  });

  test('createConsumedBonusMap keeps only valid true entries and tracks count/hash', () => {
    const helpers = createCpuPolicyLookaheadBonus();
    const consumed = helpers.createConsumedBonusMap({
      '1,2': true,
      'bad': true,
      '3,4': false
    } as any);

    expect(consumed['1,2']).toBe(true);
    expect(consumed.bad).toBeUndefined();
    expect(consumed.__bonusCount).toBe(1);
    expect(consumed.__bonusHash).toBe(helpers.hashBonusCellCoord(1, 2));
  });

  test('consumeBonusCell is idempotent for already-consumed cells', () => {
    const helpers = createCpuPolicyLookaheadBonus();
    const base = helpers.createConsumedBonusMap({ '0,1': true } as any);

    expect(helpers.consumeBonusCell(base, 0, 1)).toBe(base);
    const next = helpers.consumeBonusCell(base, 2, 3);
    expect(next).not.toBe(base);
    expect(next['2,3']).toBe(true);
    expect(next.__bonusCount).toBe(2);
  });

  test('getMoveChargeGain combines flips with injected board bonus lookup', () => {
    const getBoardBonusAtCell = jest.fn(() => 4);
    const helpers = createCpuPolicyLookaheadBonus({
      getBoardBonusAtCell,
      isFiniteNumber: (value: unknown) => Number.isFinite(Number(value))
    });

    expect(helpers.getMoveChargeGain({
      row: 3,
      col: 4,
      flips: [{ row: 1, col: 1 }, { row: 1, col: 2 }]
    } as any, { '3,4': 9 } as any, {} as any)).toBe(6);
    expect(getBoardBonusAtCell).toHaveBeenCalledWith({ '3,4': 9 }, {}, 3, 4);
    expect(helpers.getMoveChargeGain(null, null, null)).toBe(0);
  });
});
