import * as CardUtils from '../game/logic/cards/utils.js';

describe('charge delta events', () => {
  test('addChargeWithDelta records per-change events with sequence', () => {
    const cardState = {
      charge: { black: 0, white: 0 },
      chargeDeltaEvents: [],
      _nextChargeDeltaSeq: 1
    };

    const r1 = CardUtils.addChargeWithDelta(cardState, 'black', 3, 'test_gain');
    const r2 = CardUtils.addChargeWithDelta(cardState, 'black', -1, 'test_cost');

    expect(r1.delta).toBe(3);
    expect(r2.delta).toBe(-1);
    expect(cardState.charge.black).toBe(2);
    expect(cardState.chargeDeltaEvents).toEqual([
      { seq: 1, player: 'black', delta: 3, before: 0, after: 3, reason: 'test_gain' },
      { seq: 2, player: 'black', delta: -1, before: 3, after: 2, reason: 'test_cost' }
    ]);
  });

  test('setChargeWithDelta clamps into 0..99 and emits only when changed', () => {
    const cardState = {
      charge: { black: 98, white: 0 },
      chargeDeltaEvents: [],
      _nextChargeDeltaSeq: 1
    };

    CardUtils.setChargeWithDelta(cardState, 'black', 130, 'cap_up');
    CardUtils.setChargeWithDelta(cardState, 'black', -3, 'cap_down');
    CardUtils.setChargeWithDelta(cardState, 'black', 0, 'no_change');

    expect(cardState.charge.black).toBe(0);
    expect(cardState.chargeDeltaEvents).toEqual([
      { seq: 1, player: 'black', delta: 1, before: 98, after: 99, reason: 'cap_up' },
      { seq: 2, player: 'black', delta: -99, before: 99, after: 0, reason: 'cap_down' }
    ]);
  });

  test('addChargeWithDelta normalizes padded uppercase player keys', () => {
    const cardState = {
      charge: { black: 0, white: 4 },
      chargeDeltaEvents: [],
      _nextChargeDeltaSeq: 1
    };

    const result = CardUtils.addChargeWithDelta(cardState, ' WHITE ', 2, 'normalized_gain');

    expect(result.delta).toBe(2);
    expect(cardState.charge.white).toBe(6);
    expect(cardState.chargeDeltaEvents).toEqual([
      { seq: 1, player: 'white', delta: 2, before: 4, after: 6, reason: 'normalized_gain' }
    ]);
  });

  test('addChargeWithDelta records board popup metadata for flip-related gains', () => {
    const cardState = {
      charge: { black: 0, white: 0 },
      chargeDeltaEvents: [],
      _nextChargeDeltaSeq: 1
    };

    CardUtils.addChargeWithDelta(cardState, 'black', 4, 'placement_or_effect_gain', {
      popupKind: 'board',
      sourceType: 'placement_flip_gain',
      anchorRow: 3,
      anchorCol: 4
    });

    expect(cardState.chargeDeltaEvents).toEqual([
      {
        seq: 1,
        player: 'black',
        delta: 4,
        before: 0,
        after: 4,
        reason: 'placement_or_effect_gain',
        popupKind: 'board',
        sourceType: 'placement_flip_gain',
        anchorRow: 3,
        anchorCol: 4
      }
    ]);
  });

  test('board popup metadata rejects missing anchors', () => {
    const cardState = {
      charge: { black: 0, white: 0 },
      chargeDeltaEvents: [],
      _nextChargeDeltaSeq: 1
    };

    expect(() => CardUtils.addChargeWithDelta(cardState, 'black', 2, 'placement_or_effect_gain', {
      popupKind: 'board',
      sourceType: 'placement_flip_gain',
      anchorRow: 3,
      anchorCol: null
    })).toThrow('board popup requires integer anchorRow/anchorCol');
  });
});
