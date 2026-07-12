import mctsPolicyModule = require('../mcts-policy');
import Core = require('../../logic/core');

const { _gameInterface, _network } = mctsPolicyModule as any;

function makeFullState(overrides: Record<string, unknown> = {}) {
  return {
    board: Array.from({ length: 8 }, () => Array(8).fill(1)),
    currentPlayer: 1,
    consecutivePasses: 0,
    turnNumber: 12,
    roundNumber: 1,
    roundCompletionByPlayer: { black: false, white: false },
    pendingRoundBonus: null,
    boardExpansion: {
      active: false,
      side: null,
      row: null,
      owner: 0,
      usedByPlayer: { black: false, white: false },
      cells: []
    },
    ...overrides
  };
}

describe('MCTS policy pass handling', () => {
  test('does not treat a full board as terminal before two consecutive passes', () => {
    const terminal = _gameInterface.isTerminal(makeFullState({ consecutivePasses: 0 }), {});

    expect(terminal.isTerminal).toBe(false);
  });

  test('adds a pass action when placement search has no legal moves before terminal', () => {
    const actions = _gameInterface.listActions(makeFullState({ consecutivePasses: 0 }), {}, 'black');

    expect(actions).toEqual([{ type: 'pass' }]);
  });

  test('applies pass actions through the core pass transition', () => {
    const result = _gameInterface.applyAction(makeFullState({ consecutivePasses: 0 }), {}, { type: 'pass' }, 'black');

    expect(result.nextPlayer).toBe('white');
    expect(result.state.currentPlayer).toBe(-1);
    expect(result.state.consecutivePasses).toBe(1);
    expect(result.state.turnNumber).toBe(13);
  });

  test('treats two consecutive passes as terminal', () => {
    const terminal = _gameInterface.isTerminal(makeFullState({ consecutivePasses: 2 }), {});

    expect(terminal.isTerminal).toBe(true);
  });

  test('uses a uniform policy without ONNX inference for boards larger than 8x8', async () => {
    const state = Core.createGameState({ rows: 16, cols: 16 });

    const result = await _network.evaluate(state, {}, 'black');

    expect(result.value).toBe(0);
    expect(result.policy.size).toBe(4);
    expect(Array.from(result.policy.values())).toEqual([0.25, 0.25, 0.25, 0.25]);
  });
});
