const fs = require('fs');
const path = require('path');
const {
    parseArgs,
    buildSeedList,
    computeOnnxGateDecision
} = require('../scripts/benchmark-policy-onnx-gate');

describe('selfplay onnx gate benchmark script', () => {
    test('parseArgs requires candidate onnx path', () => {
        expect(() => parseArgs(['--games', '2'])).toThrow('--candidate-onnx is required');
    });

    test('parseArgs infers candidate meta path', () => {
        const modelsDir = path.resolve(__dirname, '..', 'data', 'models');
        const onnxPath = path.join(modelsDir, 'policy-net.onnx-gate.test.onnx');
        const metaPath = `${onnxPath}.meta.json`;
        fs.mkdirSync(modelsDir, { recursive: true });
        fs.writeFileSync(onnxPath, Buffer.from([1, 2, 3]));
        fs.writeFileSync(metaPath, JSON.stringify({ schemaVersion: 'policy_onnx.v1' }), 'utf8');

        const args = parseArgs([
            '--games', '4',
            '--seed-count', '3',
            '--min-seed-pass-count', '2',
            '--candidate-onnx', onnxPath
        ]);
        expect(args.games).toBe(4);
        expect(args.seedCount).toBe(3);
        expect(args.minSeedPassCount).toBe(2);
        expect(args.candidateOnnxMetaPath).toBe(metaPath);

        fs.unlinkSync(onnxPath);
        fs.unlinkSync(metaPath);
    });

    test('parseArgs accepts match retries and rejects negative value', () => {
        const modelsDir = path.resolve(__dirname, '..', 'data', 'models');
        const onnxPath = path.join(modelsDir, 'policy-net.onnx-gate.retry.test.onnx');
        const metaPath = `${onnxPath}.meta.json`;
        fs.mkdirSync(modelsDir, { recursive: true });
        fs.writeFileSync(onnxPath, Buffer.from([4, 5, 6]));
        fs.writeFileSync(metaPath, JSON.stringify({ schemaVersion: 'policy_onnx.v1' }), 'utf8');

        const args = parseArgs([
            '--candidate-onnx', onnxPath,
            '--match-retries', '2'
        ]);
        expect(args.matchRetries).toBe(2);

        expect(() => parseArgs([
            '--candidate-onnx', onnxPath,
            '--match-retries', '-1'
        ])).toThrow('--match-retries must be >= 0');

        fs.unlinkSync(onnxPath);
        fs.unlinkSync(metaPath);
    });

    test('parseArgs accepts white-only candidate color mode', () => {
        const modelsDir = path.resolve(__dirname, '..', 'data', 'models');
        const onnxPath = path.join(modelsDir, 'policy-net.onnx-gate.color.test.onnx');
        const metaPath = `${onnxPath}.meta.json`;
        fs.mkdirSync(modelsDir, { recursive: true });
        fs.writeFileSync(onnxPath, Buffer.from([7, 8, 9]));
        fs.writeFileSync(metaPath, JSON.stringify({ schemaVersion: 'policy_onnx.v1' }), 'utf8');

        const args = parseArgs([
            '--candidate-onnx', onnxPath,
            '--candidate-color-mode', 'white'
        ]);
        expect(args.candidateColorMode).toBe('white');

        expect(() => parseArgs([
            '--candidate-onnx', onnxPath,
            '--candidate-color-mode', 'black'
        ])).toThrow('--candidate-color-mode must be one of: both, white');

        fs.unlinkSync(onnxPath);
        fs.unlinkSync(metaPath);
    });

    test('parseArgs applies defaults from resolved config', () => {
        const tempDir = fs.mkdtempSync(path.join(__dirname, '..', 'data', 'models', 'onnx-gate-resolved-'));
        const candidateOnnxPath = path.join(tempDir, 'candidate.onnx');
        const candidateMetaPath = `${candidateOnnxPath}.meta.json`;
        const resolvedConfigPath = path.join(tempDir, 'resolved-config.json');
        fs.writeFileSync(candidateOnnxPath, Buffer.from([10, 11, 12]));
        fs.writeFileSync(candidateMetaPath, JSON.stringify({ schemaVersion: 'policy_onnx.v1' }), 'utf8');
        fs.writeFileSync(resolvedConfigPath, JSON.stringify({
            paths: {
                modelsDir: tempDir
            },
            command: {
                args: [
                    'scripts/run-selfplay-training-cycle.js',
                    '--onnx-gate-games', '12',
                    '--onnx-gate-seed-count', '4',
                    '--onnx-gate-seed-stride', '777',
                    '--onnx-gate-threshold', '0.61',
                    '--onnx-gate-min-seed-score', '0.58',
                    '--onnx-gate-min-seed-pass-count', '3',
                    '--onnx-gate-jobs', '5',
                    '--onnx-gate-timeout-ms', '240000',
                    '--onnx-gate-black-level', '5',
                    '--onnx-gate-white-level', '6',
                    '--onnx-gate-candidate-color-mode', 'white'
                ]
            }
        }, null, 2), 'utf8');

        try {
            const args = parseArgs([
                '--resolved-config', resolvedConfigPath,
                '--candidate-onnx', candidateOnnxPath
            ]);
            expect(args.games).toBe(12);
            expect(args.seedCount).toBe(4);
            expect(args.seedStride).toBe(777);
            expect(args.threshold).toBeCloseTo(0.61, 6);
            expect(args.minSeedScore).toBeCloseTo(0.58, 6);
            expect(args.minSeedPassCount).toBe(3);
            expect(args.jobs).toBe(5);
            expect(args.timeoutMs).toBe(240000);
            expect(args.blackLevel).toBe(5);
            expect(args.whiteLevel).toBe(6);
            expect(args.candidateColorMode).toBe('white');
            expect(args.targetOnnxPath).toBe(path.join(tempDir, 'policy-net.onnx'));
            expect(args.targetOnnxMetaPath).toBe(path.join(tempDir, 'policy-net.onnx.meta.json'));
        } finally {
            fs.rmSync(tempDir, { recursive: true, force: true });
        }
    });

    test('buildSeedList creates deterministic sequence', () => {
        expect(buildSeedList(10, 3, 7)).toEqual([10, 17, 24]);
    });

    test('computeOnnxGateDecision enforces all constraints', () => {
        const decision = computeOnnxGateDecision(
            [
                { candidateScore: 0.55 },
                { candidateScore: 0.60 },
                { candidateScore: 0.44 }
            ],
            {
                threshold: 0.5,
                minSeedScore: 0.45,
                minSeedPassCount: 2
            },
            {
                totalMatches: 6,
                onnxLoadedMatches: 6,
                runtimeErrorCount: 0,
                matchErrorCount: 1
            }
        );
        expect(decision.passedByAverage).toBe(true);
        expect(decision.passedBySeedPassCount).toBe(true);
        expect(decision.passedByMinSeedScore).toBe(false);
        expect(decision.passedByNoMatchErrors).toBe(false);
        expect(decision.passed).toBe(false);
    });
});
