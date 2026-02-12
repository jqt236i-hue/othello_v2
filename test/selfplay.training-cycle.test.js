const path = require('path');
const {
    parseArgs,
    buildIterationPaths,
    iterationTag
} = require('../scripts/run-selfplay-training-cycle');

describe('selfplay training cycle script', () => {
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
    });

    test('parseArgs keeps explicit run tag and paths', () => {
        const existingPath = __filename;
        const args = parseArgs([
            '--run-tag', 'testtag',
            '--max-hours', '6',
            '--bootstrap-policy-model', existingPath,
            '--resume-checkpoint', existingPath,
            '--runs-dir', 'data/runs',
            '--models-dir', 'data/models',
            '--summary-out', 'data/runs/out.json'
        ]);
        expect(args.runTag).toBe('testtag');
        expect(args.maxHours).toBe(6);
        expect(args.bootstrapPolicyModelPath).toBe(path.resolve(process.cwd(), existingPath));
        expect(args.resumeCheckpointPath).toBe(path.resolve(process.cwd(), existingPath));
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
    });
});
