"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const path = __importStar(require("path"));
const child_process_1 = require("child_process");
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
    return (0, child_process_1.spawnSync)(PYTHON, ['-c', script, REPO_ROOT, JSON.stringify(payload)], {
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
//# sourceMappingURL=onnx-trainer.grouped-split.test.js.map