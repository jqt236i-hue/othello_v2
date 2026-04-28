import * as path from 'path';
import * as zlib from 'zlib';
const runtime = require(path.resolve(__dirname, '..', 'game', 'ai', 'policy-table-runtime.js'));
const SharedBoardUtils = require(path.resolve(__dirname, '..', 'shared', 'shared-board-utils.js'));

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

  test('chooseMoveFromModel works without mutating loaded runtime state', () => {
    const board = Array.from({ length: 8 }, () => Array.from({ length: 8 }, () => 0));
    const canonical = runtime.canonicalizeBoard(board);
    const stateKey = runtime.makeStateKey('white', canonical.boardKey, null, 2);
    const model = {
      schemaVersion: 'policy_table.v2',
      states: {
        [stateKey]: {
          bestAction: '',
          actions: {
            'place:0:0': { visits: 1, avgOutcome: 0 },
            'place:3:3': { visits: 1, avgOutcome: 0 }
          }
        }
      }
    };
    const candidates = [
      { row: 0, col: 0, flips: [] },
      { row: 3, col: 3, flips: [] }
    ];

    const selected = runtime.chooseMoveFromModel(model, candidates, {
      playerKey: 'white',
      level: 6,
      board,
      pendingType: null,
      legalMovesCount: 2
    });

    expect(selected).toEqual(candidates[0]);
    expect(runtime.hasModel()).toBe(false);
  });

  test('getActionScoreFromModel applies the same heuristic tie-break used by chooseMove', () => {
    const board = Array.from({ length: 8 }, () => Array.from({ length: 8 }, () => 0));
    const canonical = runtime.canonicalizeBoard(board);
    const stateKey = runtime.makeStateKey('white', canonical.boardKey, null, 2);
    const model = {
      schemaVersion: 'policy_table.v2',
      states: {
        [stateKey]: {
          bestAction: '',
          actions: {
            'place:0:0': { visits: 1, avgOutcome: 0 },
            'place:3:3': { visits: 1, avgOutcome: 0 }
          }
        }
      }
    };

    const cornerScore = runtime.getActionScoreFromModel(model, { row: 0, col: 0, flips: [] }, {
      playerKey: 'white',
      level: 6,
      board,
      pendingType: null,
      legalMovesCount: 2
    });
    const innerScore = runtime.getActionScoreFromModel(model, { row: 3, col: 3, flips: [] }, {
      playerKey: 'white',
      level: 6,
      board,
      pendingType: null,
      legalMovesCount: 2
    });

    expect(cornerScore).toBeGreaterThan(innerScore);
  });

  test('preferRaw8x8Keys can resolve raw v2 state keys on shaped 8x8 boards', () => {
    const board = Array.from({ length: 8 }, () => Array.from({ length: 8 }, () => 0));
    const rawCanonical = runtime.canonicalizeBoard(board);
    SharedBoardUtils.attachBoardShape(board, {
      boardExpansion: {
        cells: [{ row: 8, col: 0, owner: 'black' }]
      }
    });
    const stateKey = runtime.makeStateKey('white', rawCanonical.boardKey, null, 2);
    const model = {
      schemaVersion: 'policy_table.v2',
      states: {
        [stateKey]: {
          bestAction: 'place:0:0',
          actions: {
            'place:0:0': { visits: 6, avgOutcome: 0.4 }
          }
        }
      }
    };
    const candidates = [
      { row: 0, col: 0, flips: [] },
      { row: 3, col: 3, flips: [] }
    ];

    const scoreWithoutRaw = runtime.getActionScoreFromModel(model, candidates[0], {
      playerKey: 'white',
      level: 6,
      board,
      pendingType: null,
      legalMovesCount: 2
    });
    const scoreWithRaw = runtime.getActionScoreFromModel(model, candidates[0], {
      playerKey: 'white',
      level: 6,
      board,
      pendingType: null,
      legalMovesCount: 2,
      preferRaw8x8Keys: true
    });
    const selected = runtime.chooseMoveFromModel(model, candidates, {
      playerKey: 'white',
      level: 6,
      board,
      pendingType: null,
      legalMovesCount: 2,
      preferRaw8x8Keys: true
    });

    expect(scoreWithoutRaw).toBeNull();
    expect(scoreWithRaw).not.toBeNull();
    expect(selected).toEqual(candidates[0]);
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

  test('loadFromUrl follows manifest and inflates gzip payload', async () => {
    const board = [[0]];
    const stateKey = runtime.makeStateKey('white', board, null, 1);
    const fakeModel = {
      schemaVersion: runtime.MODEL_SCHEMA_VERSION,
      states: {
        [stateKey]: {
          bestAction: 'place:0:0',
          actions: { 'place:0:0': { visits: 2, avgOutcome: 0.25 } }
        }
      }
    };
    const compressed = zlib.gzipSync(Buffer.from(JSON.stringify(fakeModel), 'utf8'));
    const fetchImpl = jest.fn(async (url) => {
      if (String(url).endsWith('.json')) {
        return {
          ok: true,
          json: async () => ({
            assetType: 'policy_table.redirect.v1',
            compression: 'gzip',
            url: 'data/models/policy-table.json.gz'
          })
        };
      }
      return {
        ok: true,
        arrayBuffer: async () => compressed.buffer.slice(compressed.byteOffset, compressed.byteOffset + compressed.byteLength)
      };
    });

    const ok = await runtime.loadFromUrl('data/models/policy-table.json', fetchImpl);
    expect(ok).toBe(true);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(runtime.hasModel()).toBe(true);
  });

  test('getActionScore ranks known better action above weaker known action', () => {
    const board = Array.from({ length: 8 }, () => Array.from({ length: 8 }, () => 0));
    const stateKey = runtime.makeStateKey('white', runtime.canonicalizeBoard(board).boardKey, null, 2);
    expect(runtime.setModel({
      schemaVersion: runtime.MODEL_SCHEMA_VERSION,
      states: {
        [stateKey]: {
          bestAction: 'place:3:3',
          actions: {
            'place:3:3': { visits: 10, avgOutcome: 0.5 },
            'place:3:4': { visits: 1, avgOutcome: -0.2 }
          }
        }
      }
    })).toBe(true);

    const strongScore = runtime.getActionScore({ row: 3, col: 3 }, {
      playerKey: 'white',
      level: 5,
      board,
      pendingType: null,
      legalMovesCount: 2
    });
    const weakScore = runtime.getActionScore({ row: 3, col: 4 }, {
      playerKey: 'white',
      level: 5,
      board,
      pendingType: null,
      legalMovesCount: 2
    });
    expect(typeof strongScore).toBe('number');
    expect(typeof weakScore).toBe('number');
    expect(strongScore).toBeGreaterThan(weakScore);
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

  test('getActionScoreForKey ranks better use_card action above weaker action', () => {
    const board = [[0]];
    const stateKey = runtime.makeStateKey('white', runtime.canonicalizeBoard(board).boardKey, null, 0);
    expect(runtime.setModel({
      schemaVersion: 'policy_table.v2',
      states: {
        [stateKey]: {
          bestAction: 'use_card:c1',
          actions: {
            'use_card:c1': { visits: 7, avgOutcome: 0.4 },
            'use_card:c2': { visits: 1, avgOutcome: -0.1 }
          }
        }
      }
    })).toBe(true);
    const strongScore = runtime.getActionScoreForKey('use_card:c1', {
      playerKey: 'white',
      level: 5,
      board,
      pendingType: null,
      legalMovesCount: 0
    });
    const weakScore = runtime.getActionScoreForKey('use_card:c2', {
      playerKey: 'white',
      level: 5,
      board,
      pendingType: null,
      legalMovesCount: 0
    });
    expect(typeof strongScore).toBe('number');
    expect(typeof weakScore).toBe('number');
    expect(strongScore).toBeGreaterThan(weakScore);
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

  test('chooseMove uses abstract state fallback for expansion corner placement', () => {
    const board = Array.from({ length: 8 }, () => Array.from({ length: 8 }, () => 0));
    board[3][3] = 1;
    board[3][4] = -1;
    board[4][3] = -1;
    board[4][4] = 1;
    SharedBoardUtils.attachBoardShape(board, {
      boardExpansion: {
        cells: [
          { row: 0, col: 8, owner: 0 },
          { row: 7, col: 8, owner: 0 }
        ]
      }
    });

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

    const expansionMove = { row: 0, col: 8, flips: [] };
    const selected = runtime.chooseMove([expansionMove, { row: 1, col: 1, flips: [] }], {
      playerKey: 'white',
      level: 5,
      board,
      pendingType: null,
      legalMovesCount: 2
    });

    expect(selected).toEqual(expansionMove);
  });
});
