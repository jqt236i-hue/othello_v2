import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

const {
  buildRepeatedHardcaseSelfplayArgs,
  isWhiteLossHardcase,
  rememberHardcaseReplayPath,
  writeWhiteLossHardcases
} = require('../scripts/othello-onnx-hardcase-replay');

describe('othello ONNX hardcase replay helpers', () => {
  test('identifies white loss hardcases without selecting black records', () => {
    expect(isWhiteLossHardcase({ player: 'white', winner: 'black' })).toBe(true);
    expect(isWhiteLossHardcase({ player: 'white', outcome: -0.09 })).toBe(true);
    expect(isWhiteLossHardcase({ player: 'white', finalDiscDiff: -7 })).toBe(true);
    expect(isWhiteLossHardcase({ player: 'white', emptiesBefore: 12, outcome: 0 })).toBe(true);
    expect(isWhiteLossHardcase({ player: 'black', winner: 'black' })).toBe(false);
    expect(isWhiteLossHardcase({ player: 'white', winner: 'white', finalDiscDiff: 8, outcome: 0.2 })).toBe(false);
  });

  test('writes capped white loss hardcases with replay marker', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'othello-hardcase-replay-'));
    try {
      const source = path.join(dir, 'selfplay.ndjson');
      const out = path.join(dir, 'hardcases.ndjson');
      fs.writeFileSync(source, [
        JSON.stringify({ player: 'white', winner: 'black', id: 1 }),
        JSON.stringify({ player: 'black', winner: 'black', id: 2 }),
        JSON.stringify({ player: 'white', finalDiscDiff: -10, id: 3 })
      ].join('\n'), 'utf8');

      const count = writeWhiteLossHardcases([source], out, 1);
      const records = fs.readFileSync(out, 'utf8').trim().split(/\r?\n/).map((line) => JSON.parse(line));

      expect(count).toBe(1);
      expect(records).toEqual([{ player: 'white', winner: 'black', id: 1, hardcaseSource: 'white_loss_replay' }]);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  test('builds repeated dataset args and keeps replay window bounded', () => {
    expect(buildRepeatedHardcaseSelfplayArgs(['a.ndjson', 'b.ndjson'], 2)).toEqual([
      '--selfplay', 'a.ndjson',
      '--selfplay', 'a.ndjson',
      '--selfplay', 'b.ndjson',
      '--selfplay', 'b.ndjson'
    ]);

    const replay = ['old.ndjson'];
    rememberHardcaseReplayPath(replay, 'new-a.ndjson', 2);
    rememberHardcaseReplayPath(replay, 'new-b.ndjson', 2);

    expect(replay).toEqual(['new-a.ndjson', 'new-b.ndjson']);
  });
});

describe('othello ONNX training loop profiles', () => {
  test('loads profile defaults and lets explicit CLI args override them', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'othello-onnx-profile-'));
    try {
      const profilePath = path.join(dir, 'profile.json');
      fs.writeFileSync(profilePath, JSON.stringify({
        args: {
          jobs: 12,
          trainGames: 333,
          hardcaseReplayWeight: 5
        }
      }), 'utf8');
      const { parseArgs } = require('../scripts/run-othello-onnx-training-loop');

      const args = parseArgs(['--profile', profilePath, '--jobs', '4']);

      expect(args.profile).toBe(profilePath);
      expect(args.trainGames).toBe(333);
      expect(args.hardcaseReplayWeight).toBe(5);
      expect(args.jobs).toBe(4);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});
