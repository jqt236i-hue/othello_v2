const path = require('path');
const {
    parseArgs,
    buildIterationPaths,
    iterationTag
} = require('../scripts/run-selfplay-training-cycle');

describe('selfplay training cycle script', () => {
    test('parseArgs uses long-run defaults', () => {
        const args = parseArgs([]);
        expect(args.maxHours).toBe(24);
        expect(args.onnxEpochs).toBe(9999);
    });

    test('parseArgs validates range options', () => {
        expect(() => parseArgs(['--iterations', '0'])).toThrow('--iterations must be >= 1');
        expect(() => parseArgs(['--max-hours', '0'])).toThrow('--max-hours must be > 0');
        expect(() => parseArgs(['--card-usage-rate', '2'])).toThrow('--card-usage-rate must be in [0,1]');
        expect(() => parseArgs(['--onnx-log-interval-steps', '-1'])).toThrow('--onnx-log-interval-steps must be >= 0');
        expect(() => parseArgs(['--onnx-val-split', '0.5'])).toThrow('--onnx-val-split must be in [0,0.5)');
        expect(() => parseArgs(['--onnx-early-stop-patience', '-1'])).toThrow('--onnx-early-stop-patience must be >= 0');
        expect(() => parseArgs(['--onnx-early-stop-min-delta', '-0.1'])).toThrow('--onnx-early-stop-min-delta must be >= 0');
        expect(() => parseArgs(['--onnx-early-stop-monitor', 'x'])).toThrow('--onnx-early-stop-monitor must be val_loss or train_loss');
        expect(() => parseArgs(['--shape-immediate', '-0.1'])).toThrow('--shape-immediate must be in [0,1]');
        expect(() => parseArgs(['--threshold', '2'])).toThrow('--threshold must be in [0,1]');
        expect(() => parseArgs(['--adoption-seed-count', '0'])).toThrow('--adoption-seed-count must be >= 1');
        expect(() => parseArgs(['--adoption-seed-stride', '0'])).toThrow('--adoption-seed-stride must be >= 1');
        expect(() => parseArgs(['--adoption-final-seed-offset', '0'])).toThrow('--adoption-final-seed-offset must be >= 1');
        expect(() => parseArgs(['--adoption-min-seed-uplift', '-2'])).toThrow('--adoption-min-seed-uplift must be in [-1,1]');
        expect(() => parseArgs(['--adoption-min-seed-pass-count', '-1'])).toThrow('--adoption-min-seed-pass-count must be >= 0');
        expect(() => parseArgs(['--onnx-gate-threshold', '2'])).toThrow('--onnx-gate-threshold must be in [0,1]');
        expect(() => parseArgs(['--onnx-gate-min-seed-score', '-1'])).toThrow('--onnx-gate-min-seed-score must be in [0,1]');
        expect(() => parseArgs(['--onnx-gate-seed-count', '0'])).toThrow('--onnx-gate-seed-count must be >= 1');
        expect(() => parseArgs(['--onnx-gate-timeout-ms', '999'])).toThrow('--onnx-gate-timeout-ms must be >= 1000');
    });

    test('parseArgs keeps explicit run tag and paths', () => {
        const existingPath = __filename;
        const args = parseArgs([
            '--run-tag', 'testtag',
            '--max-hours', '6',
            '--bootstrap-policy-model', existingPath,
            '--resume-checkpoint', existingPath,
            '--adoption-seed-count', '3',
            '--adoption-seed-stride', '2000',
            '--adoption-final-seed-offset', '500000',
            '--adoption-min-seed-uplift', '-0.01',
            '--adoption-min-seed-pass-count', '2',
            '--onnx-gate',
            '--onnx-gate-games', '8',
            '--onnx-gate-seed-count', '3',
            '--onnx-gate-seed-stride', '1000',
            '--onnx-gate-seed-offset', '800000',
            '--onnx-gate-threshold', '0.52',
            '--onnx-gate-min-seed-score', '0.45',
            '--onnx-gate-min-seed-pass-count', '2',
            '--onnx-gate-timeout-ms', '200000',
            '--onnx-gate-black-level', '6',
            '--onnx-gate-white-level', '5',
            '--runs-dir', 'data/runs',
            '--models-dir', 'data/models',
            '--summary-out', 'data/runs/out.json'
        ]);
        expect(args.runTag).toBe('testtag');
        expect(args.maxHours).toBe(6);
        expect(args.bootstrapPolicyModelPath).toBe(path.resolve(process.cwd(), existingPath));
        expect(args.resumeCheckpointPath).toBe(path.resolve(process.cwd(), existingPath));
        expect(args.adoptionSeedCount).toBe(3);
        expect(args.adoptionSeedStride).toBe(2000);
        expect(args.adoptionFinalSeedOffset).toBe(500000);
        expect(args.adoptionMinSeedUplift).toBeCloseTo(-0.01, 6);
        expect(args.adoptionMinSeedPassCount).toBe(2);
        expect(args.onnxGateEnabled).toBe(true);
        expect(args.onnxGateGames).toBe(8);
        expect(args.onnxGateSeedCount).toBe(3);
        expect(args.onnxGateThreshold).toBeCloseTo(0.52, 6);
        expect(args.onnxGateMinSeedScore).toBeCloseTo(0.45, 6);
        expect(args.onnxGateMinSeedPassCount).toBe(2);
        expect(args.summaryOut).toBe(path.resolve(process.cwd(), 'data/runs/out.json'));
    });

    test('parseArgs rejects missing bootstrap/resume paths', () => {
        expect(() => parseArgs(['--bootstrap-policy-model', 'missing.json'])).toThrow('--bootstrap-policy-model not found:');
        expect(() => parseArgs(['--resume-checkpoint', 'missing.pt'])).toThrow('--resume-checkpoint not found:');
    });

    test('iterationTag and buildIterationPaths create stable filenames', () => {
        const args = parseArgs(['--run-tag', 'abc123']);
        const tag = iterationTag(args.runTag, 3);
        expect(tag).toBe('abc123.it03');
        const p = buildIterationPaths(args, 3);
        expect(p.tag).toBe('abc123.it03');
        expect(p.trainDataPath.endsWith(path.join('data', 'runs', 'selfplay.train.abc123.it03.ndjson'))).toBe(true);
        expect(p.evalDataPath.endsWith(path.join('data', 'runs', 'selfplay.eval.abc123.it03.ndjson'))).toBe(true);
        expect(p.onnxModelPath.endsWith(path.join('data', 'models', 'policy-net.candidate.abc123.it03.onnx'))).toBe(true);
        expect(p.onnxMetaPath.endsWith(path.join('data', 'models', 'policy-net.candidate.abc123.it03.onnx.meta.json'))).toBe(true);
        expect(p.checkpointPath.endsWith(path.join('data', 'models', 'policy-net.candidate.abc123.it03.checkpoint.pt'))).toBe(true);
        expect(p.onnxMetricsPath.endsWith(path.join('data', 'runs', 'train.metrics.abc123.it03.jsonl'))).toBe(true);
        expect(p.candidateModelPath.endsWith(path.join('data', 'models', 'policy-table.candidate.abc123.it03.json'))).toBe(true);
        expect(p.quickAdoptionPath.endsWith(path.join('data', 'runs', 'adoption.quick.abc123.it03.json'))).toBe(true);
        expect(p.finalAdoptionPath.endsWith(path.join('data', 'runs', 'adoption.final.abc123.it03.json'))).toBe(true);
        expect(p.onnxGatePath.endsWith(path.join('data', 'runs', 'adoption.onnx.abc123.it03.json'))).toBe(true);
    });
});
