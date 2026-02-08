const path = require('path');
const runner = require(path.resolve(__dirname, '..', 'src', 'engine', 'selfplay-runner.js'));
const runtime = require(path.resolve(__dirname, '..', 'game', 'ai', 'policy-table-runtime.js'));

function transformCoord(row, col, size, t) {
  if (t === 0) return { row, col };
  if (t === 1) return { row: col, col: size - 1 - row };
  if (t === 2) return { row: size - 1 - row, col: size - 1 - col };
  if (t === 3) return { row: size - 1 - col, col: row };
  if (t === 4) return { row, col: size - 1 - col };
  if (t === 5) return { row: size - 1 - col, col: size - 1 - row };
  if (t === 6) return { row: size - 1 - row, col };
  if (t === 7) return { row: col, col: row };
  return { row, col };
}

describe('selfplay/runtime v2 parity', () => {
  beforeEach(() => {
    runtime.clearModel();
    runtime.configure({ enabled: true, minLevel: 4 });
  });

  test('headless and browser runtime choose same move for same v2 model', () => {
    const board = [
      [1, 0, 0],
      [0, -1, 0],
      [0, 0, 0]
    ];
    const candidates = [
      { row: 0, col: 1, flips: [{ row: 0, col: 0 }] },
      { row: 2, col: 2, flips: [{ row: 1, col: 1 }] }
    ];
    const canonical = runtime.canonicalizeBoard(board);
    const selectedRaw = candidates[1];
    const mapped = transformCoord(selectedRaw.row, selectedRaw.col, board.length, canonical.transformId);
    const bestAction = `place:${mapped.row}:${mapped.col}`;
    const stateKey = runtime.makeStateKey('white', canonical.boardKey, null, candidates.length);
    const model = {
      schemaVersion: 'policy_table.v2',
      states: {
        [stateKey]: {
          bestAction,
          actions: {
            [bestAction]: { visits: 20, avgOutcome: 0.8 }
          }
        }
      }
    };

    expect(runtime.setModel(model)).toBe(true);
    const runtimeSelected = runtime.chooseMove(candidates, {
      playerKey: 'white',
      level: 5,
      board,
      pendingType: null,
      legalMovesCount: candidates.length
    });

    const headlessSelected = runner.selectPlacementMove(
      candidates,
      { random: () => 0 },
      {
        gameState: { board },
        cardState: {},
        playerKey: 'white',
        pendingType: null,
        legalMovesCount: candidates.length
      },
      { policyTableModel: model }
    );

    expect(runtimeSelected).toBe(candidates[1]);
    expect(headlessSelected).toBe(candidates[1]);
  });
});

