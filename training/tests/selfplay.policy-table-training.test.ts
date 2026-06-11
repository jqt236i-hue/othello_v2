import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { spawnSync } from 'child_process';

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const TRAIN_SCRIPT = path.join(REPO_ROOT, 'training', 'python', 'train_policy_table.py');
const PYTHON = process.env.PYTHON || 'python';
const EMPTY_BOARD_8X8 = Array.from({ length: 8 }, () => '........').join('/');

function makePlaceRecord(row, col, outcome) {
  return {
    player: 'white',
    board: EMPTY_BOARD_8X8,
    legalMoves: 2,
    actionType: 'place',
    row,
    col,
    outcome
  };
}

function getOnlyState(states) {
  const items = Object.values(states || {});
  expect(items).toHaveLength(1);
  return items[0];
}

function runTrainer(records) {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'othello-policy-table-train-'));
  const inputPath = path.join(tempDir, 'selfplay.ndjson');
  const outputPath = path.join(tempDir, 'policy-table.json');

  try {
    fs.writeFileSync(inputPath, records.map((record) => JSON.stringify(record)).join('\n'), 'utf8');
    const result = spawnSync(PYTHON, [
      TRAIN_SCRIPT,
      '--input', inputPath,
      '--model-out', outputPath,
      '--min-visits', '1',
      '--shape-immediate', '0'
    ], {
      cwd: REPO_ROOT,
      encoding: 'utf8'
    });

    if (result.status !== 0) {
      throw new Error([
        `train_policy_table failed (exit=${result.status})`,
        result.stdout ? `STDOUT:\n${result.stdout}` : '',
        result.stderr ? `STDERR:\n${result.stderr}` : ''
      ].filter(Boolean).join('\n'));
    }

    return JSON.parse(fs.readFileSync(outputPath, 'utf8'));
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

describe('train_policy_table bestAction selection', () => {
  test('keeps bestAction populated when every action average is negative', () => {
    const model = runTrainer([
      makePlaceRecord(0, 0, -1.0),
      makePlaceRecord(0, 0, -1.0),
      makePlaceRecord(0, 0, -1.0),
      makePlaceRecord(3, 3, -0.5),
      makePlaceRecord(3, 3, -0.5),
      makePlaceRecord(3, 3, -0.5),
      makePlaceRecord(3, 3, -0.5)
    ]);

    const state = getOnlyState(model.states);
    expect(state.bestAction).toBe('place:3:3');
    expect(state.bestActionVisits).toBe(4);
    expect(state.bestActionAvgOutcome).toBeCloseTo(-0.5, 8);

    const abstractState = getOnlyState(model.abstractStates);
    expect(abstractState.bestAction).toBe('place_cat:inner');
    expect(abstractState.bestActionVisits).toBe(4);
    expect(abstractState.bestActionAvgOutcome).toBeCloseTo(-0.5, 8);
  });

  test('prefers the better-supported action over a lucky low-visit outlier', () => {
    const model = runTrainer([
      ...Array.from({ length: 24 }, () => makePlaceRecord(0, 0, 0.6)),
      ...Array.from({ length: 3 }, () => makePlaceRecord(3, 3, 1.0))
    ]);

    const state = getOnlyState(model.states);
    expect(state.bestAction).toBe('place:0:0');
    expect(state.bestActionVisits).toBe(24);
    expect(state.bestActionAvgOutcome).toBeCloseTo(0.6, 8);
    expect(state.actions['place:3:3'].visits).toBe(3);
    expect(state.actions['place:3:3'].avgOutcome).toBeCloseTo(1.0, 8);

    const abstractState = getOnlyState(model.abstractStates);
    expect(abstractState.bestAction).toBe('place_cat:corner');
    expect(abstractState.bestActionVisits).toBe(24);
    expect(abstractState.bestActionAvgOutcome).toBeCloseTo(0.6, 8);
  });
});
