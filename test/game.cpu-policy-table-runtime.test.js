const path = require('path');
const runtime = require(path.resolve(__dirname, '..', 'game', 'ai', 'policy-table-runtime.js'));

describe('policy-table-runtime', () => {
  beforeEach(() => {
    runtime.clearModel();
    runtime.configure({ enabled: true, minLevel: 4, sourceUrl: 'data/models/policy-table.json' });
  });

  test('setModel rejects schema mismatch', () => {
    const ok = runtime.setModel({ schemaVersion: 'other.v1', states: {} });
    expect(ok).toBe(false);
    expect(runtime.hasModel()).toBe(false);
  });

  test('chooseMove uses model best action when state is found', () => {
    const board = [
      [1, 0],
      [0, -1]
    ];
    const stateKey = runtime.makeStateKey('white', board, null, 2);
    const model = {
      schemaVersion: runtime.MODEL_SCHEMA_VERSION,
      states: {
        [stateKey]: {
          bestAction: 'place:0:1',
          actions: {
            'place:0:1': { visits: 9, avgOutcome: 0.8 },
            'place:1:0': { visits: 3, avgOutcome: 0.1 }
          }
        }
      }
    };
    expect(runtime.setModel(model)).toBe(true);

    const candidates = [
      { row: 0, col: 1, flips: [] },
      { row: 1, col: 0, flips: [] }
    ];
    const selected = runtime.chooseMove(candidates, {
      playerKey: 'white',
      level: 5,
      board,
      pendingType: null,
      legalMovesCount: 2
    });
    expect(selected).toBe(candidates[0]);
  });

  test('chooseMove returns null below min level', () => {
    const board = [[0]];
    const stateKey = runtime.makeStateKey('white', board, null, 1);
    expect(runtime.setModel({
      schemaVersion: runtime.MODEL_SCHEMA_VERSION,
      states: {
        [stateKey]: {
          bestAction: 'place:0:0',
          actions: { 'place:0:0': { visits: 1, avgOutcome: 0.1 } }
        }
      }
    })).toBe(true);

    const selected = runtime.chooseMove([{ row: 0, col: 0, flips: [] }], {
      playerKey: 'white',
      level: 1,
      board,
      pendingType: null,
      legalMovesCount: 1
    });
    expect(selected).toBeNull();
  });

  test('loadFromUrl loads model with injected fetch', async () => {
    const board = [[0]];
    const stateKey = runtime.makeStateKey('white', board, null, 1);
    const fakeModel = {
      schemaVersion: runtime.MODEL_SCHEMA_VERSION,
      states: {
        [stateKey]: {
          bestAction: 'place:0:0',
          actions: { 'place:0:0': { visits: 1, avgOutcome: 0 } }
        }
      }
    };
    const fetchImpl = jest.fn(async () => ({
      ok: true,
      json: async () => fakeModel
    }));

    const ok = await runtime.loadFromUrl('data/models/policy-table.json', fetchImpl);
    expect(ok).toBe(true);
    expect(fetchImpl).toHaveBeenCalled();
    expect(runtime.hasModel()).toBe(true);
  });

  test('getActionScore returns numeric score for known action', () => {
    const board = [[0]];
    const stateKey = runtime.makeStateKey('white', board, null, 1);
    expect(runtime.setModel({
      schemaVersion: runtime.MODEL_SCHEMA_VERSION,
      states: {
        [stateKey]: {
          bestAction: 'place:0:0',
          actions: { 'place:0:0': { visits: 5, avgOutcome: 0.3 } }
        }
      }
    })).toBe(true);

    const score = runtime.getActionScore({ row: 0, col: 0 }, {
      playerKey: 'white',
      level: 5,
      board,
      pendingType: null,
      legalMovesCount: 1
    });
    expect(typeof score).toBe('number');
    expect(score).toBeGreaterThan(1000);
  });

  test('chooseMove supports v2 canonicalized state keys', () => {
    const board = [
      [0, 0, 0],
      [0, 1, 0],
      [0, 0, -1]
    ];
    const canon = runtime.canonicalizeBoard(board);
    const stateKey = runtime.makeStateKey('white', canon.boardKey, null, 2);
    expect(runtime.setModel({
      schemaVersion: 'policy_table.v2',
      states: {
        [stateKey]: {
          bestAction: 'place:0:0',
          actions: {
            'place:0:0': { visits: 10, avgOutcome: 0.9 }
          }
        }
      }
    })).toBe(true);

    const selected = runtime.chooseMove([{ row: 0, col: 0, flips: [] }, { row: 2, col: 2, flips: [] }], {
      playerKey: 'white',
      level: 5,
      board,
      pendingType: null,
      legalMovesCount: 2
    });
    expect(selected).toBeTruthy();
  });

  test('getActionScoreForKey returns numeric score for use_card action', () => {
    const board = [[0]];
    const stateKey = runtime.makeStateKey('white', runtime.canonicalizeBoard(board).boardKey, null, 0);
    expect(runtime.setModel({
      schemaVersion: 'policy_table.v2',
      states: {
        [stateKey]: {
          bestAction: 'use_card:c1',
          actions: { 'use_card:c1': { visits: 7, avgOutcome: 0.4 } }
        }
      }
    })).toBe(true);
    const score = runtime.getActionScoreForKey('use_card:c1', {
      playerKey: 'white',
      level: 5,
      board,
      pendingType: null,
      legalMovesCount: 0
    });
    expect(typeof score).toBe('number');
    expect(score).toBeGreaterThan(1000);
  });

  test('chooseMove uses abstract state fallback for placement', () => {
    const board = Array.from({ length: 8 }, () => Array.from({ length: 8 }, () => 0));
    board[3][3] = 1;
    board[3][4] = -1;
    board[4][3] = -1;
    board[4][4] = 1;
    expect(runtime.setModel({
      schemaVersion: 'policy_table.v2',
      states: {},
      abstractStates: {
        'white|-|opening|mob:2|disc:0|corner:0': {
          bestAction: 'place_cat:corner',
          actions: {
            'place_cat:corner': { visits: 20, avgOutcome: 0.9 },
            'place_cat:inner': { visits: 8, avgOutcome: 0.1 }
          }
        }
      }
    })).toBe(true);

    const selected = runtime.chooseMove([{ row: 0, col: 0, flips: [] }, { row: 1, col: 1, flips: [] }], {
      playerKey: 'white',
      level: 5,
      board,
      pendingType: null,
      legalMovesCount: 2
    });
    expect(selected).toEqual({ row: 0, col: 0, flips: [] });
  });
});
