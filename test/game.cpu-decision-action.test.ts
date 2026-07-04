import { computeCpuActionWithPolicy } from '../game/cpu-decision-action';

describe('cpu decision action module', () => {
  test('returns pass when there are no moves and no card choice', () => {
    const action = computeCpuActionWithPolicy('white', {
      resolvePlayerValue: () => -1,
      getActiveProtectionForPlayer: () => [],
      getFlipBlockers: () => [],
      getGameState: () => ({}),
      getLegalMoves: () => [],
      selectCardToUse: () => null,
      selectCpuMoveWithPolicy: () => null
    });

    expect(action).toEqual({ type: 'pass' });
  });

  test('returns card use before pass when no legal moves exist', () => {
    const cardDef = { id: 'guard_01', name: 'Guard' };
    const action = computeCpuActionWithPolicy('white', {
      resolvePlayerValue: () => -1,
      getActiveProtectionForPlayer: () => [],
      getFlipBlockers: () => [],
      getGameState: () => ({}),
      getLegalMoves: () => [],
      selectCardToUse: () => ({ cardId: 'guard_01', cardDef }),
      selectCpuMoveWithPolicy: () => null
    });

    expect(action).toEqual({ type: 'useCard', cardId: 'guard_01', cardDef });
  });

  test('returns selected move when legal moves exist', () => {
    const selected = { row: 2, col: 3, flips: [] };
    const action = computeCpuActionWithPolicy('white', {
      resolvePlayerValue: () => -1,
      getActiveProtectionForPlayer: () => [],
      getFlipBlockers: () => [],
      getGameState: () => ({}),
      getLegalMoves: () => [selected],
      selectCardToUse: () => null,
      selectCpuMoveWithPolicy: () => selected
    });

    expect(action).toEqual({ type: 'move', move: selected });
  });
});
