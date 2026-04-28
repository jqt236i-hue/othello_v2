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
const fs = __importStar(require("fs"));
const os = __importStar(require("os"));
const path = __importStar(require("path"));
const generate_selfplay_data_parallel_js_1 = require("../scripts/generate-selfplay-data-parallel.js");
describe('selfplay parallel generator', () => {
    test('splitGames balances chunks and preserves total', () => {
        expect((0, generate_selfplay_data_parallel_js_1.splitGames)(10, 3)).toEqual([4, 3, 3]);
        expect((0, generate_selfplay_data_parallel_js_1.splitGames)(3, 8)).toEqual([1, 1, 1]);
        expect((0, generate_selfplay_data_parallel_js_1.splitGames)(1, 1)).toEqual([1]);
    });
    test('parseArgs validates numeric ranges', () => {
        expect(() => (0, generate_selfplay_data_parallel_js_1.parseArgs)(['--games', '0'])).toThrow('--games must be >= 1');
        expect(() => (0, generate_selfplay_data_parallel_js_1.parseArgs)(['--workers', '0'])).toThrow('--workers must be >= 1');
        expect(() => (0, generate_selfplay_data_parallel_js_1.parseArgs)(['--seed-stride', '0'])).toThrow('--seed-stride must be >= 1');
        expect(() => (0, generate_selfplay_data_parallel_js_1.parseArgs)(['--card-usage-rate', '2'])).toThrow('--card-usage-rate must be in [0,1]');
        expect(() => (0, generate_selfplay_data_parallel_js_1.parseArgs)(['--policy-mix-rate', '-0.1'])).toThrow('--policy-mix-rate must be in [0,1]');
        expect(() => (0, generate_selfplay_data_parallel_js_1.parseArgs)(['--card-usage-rate-jitter', '2'])).toThrow('--card-usage-rate-jitter must be in [0,1]');
        expect(() => (0, generate_selfplay_data_parallel_js_1.parseArgs)(['--tactical-weight-min', '-1'])).toThrow('--tactical-weight-min must be >= 0');
        expect(() => (0, generate_selfplay_data_parallel_js_1.parseArgs)(['--tactical-weight-max', '-1'])).toThrow('--tactical-weight-max must be >= 0');
        expect(() => (0, generate_selfplay_data_parallel_js_1.parseArgs)(['--tactical-weight-min', '1.3', '--tactical-weight-max', '1.2'])).toThrow('--tactical-weight-max must be >= --tactical-weight-min');
        expect(() => (0, generate_selfplay_data_parallel_js_1.parseArgs)(['--tactical-depth-opening', '-1'])).toThrow('--tactical-depth-opening must be >= 0');
        expect(() => (0, generate_selfplay_data_parallel_js_1.parseArgs)(['--tactical-depth-mid', '-1'])).toThrow('--tactical-depth-mid must be >= 0');
        expect(() => (0, generate_selfplay_data_parallel_js_1.parseArgs)(['--tactical-depth-end', '-1'])).toThrow('--tactical-depth-end must be >= 0');
        expect(() => (0, generate_selfplay_data_parallel_js_1.parseArgs)(['--tactical-beam-width', '-1'])).toThrow('--tactical-beam-width must be >= 0');
    });
    test('parseArgs validates --policy-model-pool paths', () => {
        expect(() => (0, generate_selfplay_data_parallel_js_1.parseArgs)(['--policy-model-pool', 'missing-policy-model.json'])).toThrow('--policy-model-pool not found:');
    });
    test('parseArgs resolves defaults and options', () => {
        const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'selfplay-parallel-'));
        const poolPath = path.join(tempDir, 'pool.json');
        fs.writeFileSync(poolPath, JSON.stringify({ schemaVersion: 'policy_table.v2', states: {} }), 'utf8');
        try {
            const args = (0, generate_selfplay_data_parallel_js_1.parseArgs)([
                '--games', '120',
                '--workers', '6',
                '--seed', '100',
                '--seed-stride', '500',
                '--out', 'data/runs/out.ndjson',
                '--policy-mix-rate', '0.7',
                '--card-usage-rate-jitter', '0.2',
                '--tactical-weight-min', '0.8',
                '--tactical-weight-max', '1.5',
                '--tactical-depth-opening', '4',
                '--tactical-depth-mid', '8',
                '--tactical-depth-end', '12',
                '--tactical-beam-width', '8',
                '--policy-model-pool', poolPath
            ]);
            expect(args.games).toBe(120);
            expect(args.workers).toBe(6);
            expect(args.seed).toBe(100);
            expect(args.seedStride).toBe(500);
            expect(args.policyMixRate).toBeCloseTo(0.7, 6);
            expect(args.cardUsageRateJitter).toBeCloseTo(0.2, 6);
            expect(args.tacticalWeightMin).toBeCloseTo(0.8, 6);
            expect(args.tacticalWeightMax).toBeCloseTo(1.5, 6);
            expect(args.tacticalDepthOpening).toBe(4);
            expect(args.tacticalDepthMid).toBe(8);
            expect(args.tacticalDepthEnd).toBe(12);
            expect(args.tacticalBeamWidth).toBe(8);
            expect(args.policyModelPoolPaths).toEqual([path.resolve(process.cwd(), poolPath)]);
            expect(args.out.endsWith('data\\runs\\out.ndjson') || args.out.endsWith('data/runs/out.ndjson')).toBe(true);
        }
        finally {
            fs.rmSync(tempDir, { recursive: true, force: true });
        }
    });
    test('mergeNdjson merges shard files without losing order', () => {
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'selfplay-merge-'));
        try {
            const a = path.join(dir, 'a.ndjson');
            const b = path.join(dir, 'b.ndjson');
            const out = path.join(dir, 'out.ndjson');
            fs.writeFileSync(a, '{"i":1}\n{"i":2}\n', 'utf8');
            fs.writeFileSync(b, '{"i":3}\n', 'utf8');
            (0, generate_selfplay_data_parallel_js_1.mergeNdjson)([a, b], out);
            const merged = fs.readFileSync(out, 'utf8');
            expect(merged).toBe('{"i":1}\n{"i":2}\n{"i":3}\n');
        }
        finally {
            fs.rmSync(dir, { recursive: true, force: true });
        }
    });
});
//# sourceMappingURL=selfplay.generate-parallel.test.js.map