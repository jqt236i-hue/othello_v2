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

  test('applies a generated placement action with its canonical flips', () => {
    const state = Core.createGameState({ rows: 4, cols: 4 });
    const actions = _gameInterface.listActions(state, {}, 'black');
    const action = actions.find((candidate: any) => candidate.row === 0 && candidate.col === 1);

    expect(action).toEqual({
      type: 'place',
      row: 0,
      col: 1,
      flips: [[1, 1]]
    });

    const result = _gameInterface.applyAction(state, {}, action, 'black');

    expect(result.nextPlayer).toBe('white');
    expect(result.state.currentPlayer).toBe(Core.WHITE);
    expect(result.state.turnNumber).toBe(1);
    expect(result.state.board[0][1]).toBe(Core.BLACK);
    expect(result.state.board[1][1]).toBe(Core.BLACK);
    expect(state.board[0][1]).toBe(Core.EMPTY);
    expect(state.board[1][1]).toBe(Core.WHITE);
  });

  test('applies an expansion placement without exposing or mutating a METEOR_HOLE cell', () => {
    const state = Core.createGameState({ rows: 4, cols: 4 });
    state.board = Array.from({ length: 4 }, () => Array(4).fill(Core.EMPTY));
    state.board[1][2] = Core.BLACK;
    state.board[1][3] = Core.WHITE;
    state.boardExpansion = {
      active: true,
      side: 'right',
      row: 2,
      col: 4,
      owner: Core.BLACK,
      usedByPlayer: { black: true, white: true },
      cells: [
        { side: 'right', row: 1, col: 4, owner: Core.EMPTY },
        { side: 'right', row: 2, col: 4, owner: Core.BLACK }
      ]
    };
    const cardState = {
      markers: [
        {
          kind: 'specialStone',
          row: 2,
          col: 4,
          data: { type: 'METEOR_HOLE' }
        }
      ]
    };
    const actions = _gameInterface.listActions(state, cardState, 'black');
    const action = actions.find((candidate: any) => candidate.row === 1 && candidate.col === 4);

    expect(action).toEqual({
      type: 'place',
      row: 1,
      col: 4,
      flips: [[1, 3]]
    });
    expect(actions).not.toEqual(expect.arrayContaining([
      expect.objectContaining({ type: 'place', row: 2, col: 4 })
    ]));

    const result = _gameInterface.applyAction(state, cardState, action, 'black');

    expect(Core.getCellValue(result.state, 1, 4, result.cardState)).toBe(Core.BLACK);
    expect(result.state.board[1][3]).toBe(Core.BLACK);
    expect(Core.getCellValue(result.state, 2, 4, result.cardState)).toBeNull();
    expect(result.state.boardExpansion.cells[1].owner).toBe(Core.BLACK);
    expect(Core.getCellValue(state, 1, 4, cardState)).toBe(Core.EMPTY);
    expect(state.board[1][3]).toBe(Core.WHITE);
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

  test('uses a uniform policy for an 8x8 circle despite matching model dimensions', async () => {
    const state = Core.createGameState({ rows: 8, cols: 8, shape: 'circle' });

    const result = await _network.evaluate(state, {}, 'black');

    expect(result.value).toBe(0);
    expect(result.policy.size).toBe(4);
    expect(Array.from(result.policy.values())).toEqual([0.25, 0.25, 0.25, 0.25]);
  });

  test('does not send an expanded 8x8 state to the standard-board ONNX lane', async () => {
    const state = Core.createGameState({ rows: 8, cols: 8 });
    state.boardExpansion.cells = [
      { side: 'right', row: 2, col: 8, owner: Core.EMPTY }
    ];

    const result = await _network.evaluate(state, {}, 'black');

    expect(result.value).toBe(0);
    expect(result.policy.size).toBe(4);
    expect(Array.from(result.policy.values())).toEqual([0.25, 0.25, 0.25, 0.25]);
  });

  test('includes expansion ownership in MCTS state hashes', () => {
    const left = Core.createGameState({ rows: 4, cols: 4 });
    const right = Core.copyGameState(left);
    left.boardExpansion.cells = [
      { side: 'right', row: 1, col: 4, owner: Core.BLACK }
    ];
    right.boardExpansion.cells = [
      { side: 'right', row: 1, col: 4, owner: Core.WHITE }
    ];

    expect(_gameInterface.hashState(left, {}, 'black'))
      .not.toBe(_gameInterface.hashState(right, {}, 'black'));
  });

  test('re-resolves the ONNX runtime after its optional group becomes available', async () => {
    jest.resetModules();
    let attempts = 0;
    const runInference = jest.fn(async () => ({
      place_logits: { data: new Float32Array(100) },
      value: { data: new Float32Array([0.25]) }
    }));
    jest.doMock('../policy-onnx-runtime', () => {
      attempts += 1;
      if (attempts === 1) throw new Error('optional runtime not loaded yet');
      return { runInference };
    });

    try {
      const freshMctsPolicy = require('../mcts-policy');
      const state = Core.createGameState({ rows: 8, cols: 8 });
      const result = await freshMctsPolicy._network.evaluate(state, {}, 'black');

      expect(attempts).toBe(2);
      expect(runInference).toHaveBeenCalledTimes(1);
      expect(result.value).toBeCloseTo(0.25, 6);
      expect(result.policy.size).toBe(4);
    } finally {
      jest.dontMock('../policy-onnx-runtime');
      jest.resetModules();
    }
  });
});
