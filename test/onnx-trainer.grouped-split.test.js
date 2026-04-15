const path = require('path');
const { spawnSync } = require('child_process');

const REPO_ROOT = path.resolve(__dirname, '..');
const PYTHON = process.env.PYTHON || path.join(REPO_ROOT, '.venv', 'Scripts', 'python.exe');

function buildGroupedGameKey({ dataLane = 'train-main', seedFamily = 'train', seed, gameIndex }) {
  return JSON.stringify({
    dataLane,
    gameIndex,
    seed,
    seedFamily
  });
}

function runPythonSplit(payload) {
  const script = [
    'import json, pathlib, sys',
    'repo_root = pathlib.Path(sys.argv[1])',
    'payload = json.loads(sys.argv[2])',
    'sys.path.insert(0, str(repo_root / "ai" / "train"))',
    'import onnx_trainer_common as trainer_common',
    'train_idx, val_idx, summary = trainer_common.resolve_train_val_split(',
    '    int(payload["n"]),',
    '    float(payload["valSplit"]),',
    '    "cpu",',
    '    seed=int(payload["seed"]),',
    '    split_mode=str(payload["mode"]),',
    '    split_group_keys=payload.get("keys"),',
    ')',
    'print(json.dumps({',
    '    "train": train_idx.cpu().tolist(),',
    '    "val": val_idx.cpu().tolist(),',
    '    "summary": summary,',
    '}))',
  ].join('\n');

  return spawnSync(PYTHON, ['-c', script, REPO_ROOT, JSON.stringify(payload)], {
    cwd: REPO_ROOT,
    encoding: 'utf8'
  });
}

describe('onnx trainer grouped validation split', () => {
  test('grouped-game split keeps realistic per-game keys entirely in train or val', () => {
    const keys = [
      buildGroupedGameKey({ seed: 7, gameIndex: 1000 }),
      buildGroupedGameKey({ seed: 7, gameIndex: 1000 }),
      buildGroupedGameKey({ seed: 8, gameIndex: 1001 }),
      buildGroupedGameKey({ seed: 8, gameIndex: 1001 }),
      buildGroupedGameKey({ dataLane: 'eval-main', seedFamily: 'eval', seed: 100007, gameIndex: 2000 }),
      buildGroupedGameKey({ dataLane: 'eval-main', seedFamily: 'eval', seed: 100007, gameIndex: 2000 }),
      buildGroupedGameKey({ dataLane: 'hardcase-main', seedFamily: 'train', seed: 9, gameIndex: 1002 }),
      buildGroupedGameKey({ dataLane: 'hardcase-main', seedFamily: 'train', seed: 9, gameIndex: 1002 })
    ];
    const result = runPythonSplit({
      n: keys.length,
      valSplit: 0.25,
      seed: 7,
      mode: 'grouped-game',
      keys
    });

    expect(result.status).toBe(0);
    const payload = JSON.parse(result.stdout.trim());
    expect(payload.summary.mode).toBe('grouped-game');
    expect(payload.summary.totalGroups).toBe(4);

    const trainGroups = new Set(payload.train.map((index) => keys[index]));
    const valGroups = new Set(payload.val.map((index) => keys[index]));
    expect([...trainGroups].filter((group) => valGroups.has(group))).toEqual([]);
  });

  test('grouped-game split rejects records without game grouping keys', () => {
    const result = runPythonSplit({
      n: 3,
      valSplit: 0.34,
      seed: 7,
      mode: 'grouped-game',
      keys: [
        buildGroupedGameKey({ seed: 7, gameIndex: 1000 }),
        null,
        buildGroupedGameKey({ seed: 8, gameIndex: 1001 })
      ]
    });

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('--val-split-mode grouped-game requires seed/gameIndex on every training record');
  });
});
