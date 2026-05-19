import * as fs from 'fs';
import * as path from 'path';
const {
    parseArgs,
    buildSeedList,
    buildOnnxArtifactDescriptors,
    buildUiLevelMatchArgs,
    collectOnnxDiagnostics,
    computeOnnxGateDecision
} = require('../scripts/benchmark-policy-onnx-gate');

function writeOnnxPair(onnxPath, tag) {
    const metaPath = `${onnxPath}.meta.json`;
    fs.mkdirSync(path.dirname(onnxPath), { recursive: true });
    fs.writeFileSync(onnxPath, Buffer.from([1, 2, 3]));
    fs.writeFileSync(metaPath, JSON.stringify({ schemaVersion: 'policy_onnx.v1', tag }), 'utf8');
    return { onnxPath, metaPath };
}

describe('selfplay onnx gate benchmark script', () => {
    test('parseArgs requires candidate onnx path', () => {
        const modelsDir = path.resolve(__dirname, '..', 'data', 'models');
        const target = writeOnnxPair(path.join(modelsDir, 'policy-net.onnx-gate.required.target.onnx'), 'target');
        try {
            expect(() => parseArgs([
                '--games', '2',
                '--target-onnx', target.onnxPath,
                '--target-onnx-meta', target.metaPath
            ])).toThrow('--candidate-onnx is required');
        } finally {
            fs.unlinkSync(target.onnxPath);
            fs.unlinkSync(target.metaPath);
        }
    });

    test('parseArgs infers candidate meta path', () => {
        const modelsDir = path.resolve(__dirname, '..', 'data', 'models');
        const onnxPath = path.join(modelsDir, 'policy-net.onnx-gate.test.onnx');
        const metaPath = `${onnxPath}.meta.json`;
        const target = writeOnnxPair(path.join(modelsDir, 'policy-net.onnx-gate.test.target.onnx'), 'target');
        writeOnnxPair(onnxPath, 'candidate');

        try {
            const args = parseArgs([
                '--games', '4',
                '--seed-count', '3',
                '--min-seed-pass-count', '2',
                '--max-average-latency-ms', '18',
                '--max-p95-latency-ms', '24',
                '--max-max-latency-ms', '40',
                '--candidate-onnx', onnxPath,
                '--target-onnx', target.onnxPath,
                '--target-onnx-meta', target.metaPath
            ]);
            expect(args.games).toBe(4);
            expect(args.seedCount).toBe(3);
            expect(args.minSeedPassCount).toBe(2);
            expect(args.maxAverageLatencyMs).toBe(18);
            expect(args.maxP95LatencyMs).toBe(24);
            expect(args.maxMaxLatencyMs).toBe(40);
            expect(args.candidateOnnxMetaPath).toBe(metaPath);
        } finally {
            fs.unlinkSync(onnxPath);
            fs.unlinkSync(metaPath);
            fs.unlinkSync(target.onnxPath);
            fs.unlinkSync(target.metaPath);
        }
    });

    test('parseArgs normalizes fractional loop counts to integers', () => {
        const modelsDir = path.resolve(__dirname, '..', 'data', 'models');
        const onnxPath = path.join(modelsDir, 'policy-net.onnx-gate.integerize.test.onnx');
        const metaPath = `${onnxPath}.meta.json`;
        const target = writeOnnxPair(path.join(modelsDir, 'policy-net.onnx-gate.integerize.target.onnx'), 'target');
        writeOnnxPair(onnxPath, 'candidate');

        try {
            const args = parseArgs([
                '--candidate-onnx', onnxPath,
                '--target-onnx', target.onnxPath,
                '--target-onnx-meta', target.metaPath,
                '--games', '4.9',
                '--seed-count', '3.7',
                '--seed-stride', '777.8'
            ]);

            expect(args.games).toBe(4);
            expect(args.seedCount).toBe(3);
            expect(args.seedStride).toBe(777);
        } finally {
            fs.unlinkSync(onnxPath);
            fs.unlinkSync(metaPath);
            fs.unlinkSync(target.onnxPath);
            fs.unlinkSync(target.metaPath);
        }
    });

    test('parseArgs accepts match retries and rejects negative value', () => {
        const modelsDir = path.resolve(__dirname, '..', 'data', 'models');
        const onnxPath = path.join(modelsDir, 'policy-net.onnx-gate.retry.test.onnx');
        const metaPath = `${onnxPath}.meta.json`;
        const target = writeOnnxPair(path.join(modelsDir, 'policy-net.onnx-gate.retry.target.onnx'), 'target');
        writeOnnxPair(onnxPath, 'candidate');

        try {
            const args = parseArgs([
                '--candidate-onnx', onnxPath,
                '--target-onnx', target.onnxPath,
                '--target-onnx-meta', target.metaPath,
                '--match-retries', '2'
            ]);
            expect(args.matchRetries).toBe(2);

            expect(() => parseArgs([
                '--candidate-onnx', onnxPath,
                '--target-onnx', target.onnxPath,
                '--target-onnx-meta', target.metaPath,
                '--match-retries', '-1'
            ])).toThrow('--match-retries must be >= 0');
        } finally {
            fs.unlinkSync(onnxPath);
            fs.unlinkSync(metaPath);
            fs.unlinkSync(target.onnxPath);
            fs.unlinkSync(target.metaPath);
        }
    });

    test('parseArgs accepts white-only candidate color mode', () => {
        const modelsDir = path.resolve(__dirname, '..', 'data', 'models');
        const onnxPath = path.join(modelsDir, 'policy-net.onnx-gate.color.test.onnx');
        const metaPath = `${onnxPath}.meta.json`;
        const target = writeOnnxPair(path.join(modelsDir, 'policy-net.onnx-gate.color.target.onnx'), 'target');
        writeOnnxPair(onnxPath, 'candidate');

        try {
            const args = parseArgs([
                '--candidate-onnx', onnxPath,
                '--target-onnx', target.onnxPath,
                '--target-onnx-meta', target.metaPath,
                '--candidate-color-mode', 'white'
            ]);
            expect(args.candidateColorMode).toBe('white');

            expect(() => parseArgs([
                '--candidate-onnx', onnxPath,
                '--target-onnx', target.onnxPath,
                '--target-onnx-meta', target.metaPath,
                '--candidate-color-mode', 'black'
            ])).toThrow('--candidate-color-mode must be one of: both, white');
        } finally {
            fs.unlinkSync(onnxPath);
            fs.unlinkSync(metaPath);
            fs.unlinkSync(target.onnxPath);
            fs.unlinkSync(target.metaPath);
        }
    });

    test('parseArgs applies defaults from resolved config', () => {
        const tempDir = fs.mkdtempSync(path.join(__dirname, '..', 'data', 'models', 'onnx-gate-resolved-'));
        const candidateOnnxPath = path.join(tempDir, 'candidate.onnx');
        const candidateMetaPath = `${candidateOnnxPath}.meta.json`;
        const targetOnnxPath = path.join(tempDir, 'policy-net.onnx');
        const targetMetaPath = `${targetOnnxPath}.meta.json`;
        const resolvedConfigPath = path.join(tempDir, 'resolved-config.json');
        fs.writeFileSync(candidateOnnxPath, Buffer.from([10, 11, 12]));
        fs.writeFileSync(candidateMetaPath, JSON.stringify({ schemaVersion: 'policy_onnx.v1' }), 'utf8');
        writeOnnxPair(targetOnnxPath, 'target');
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
                    '--onnx-gate-max-average-latency-ms', '22',
                    '--onnx-gate-max-p95-latency-ms', '35',
                    '--onnx-gate-max-max-latency-ms', '60',
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
            expect(args.maxAverageLatencyMs).toBe(22);
            expect(args.maxP95LatencyMs).toBe(35);
            expect(args.maxMaxLatencyMs).toBe(60);
            expect(args.jobs).toBe(5);
            expect(args.timeoutMs).toBe(240000);
            expect(args.blackLevel).toBe(5);
            expect(args.whiteLevel).toBe(6);
            expect(args.candidateColorMode).toBe('white');
            expect(args.targetOnnxPath).toBe(targetOnnxPath);
            expect(args.targetOnnxMetaPath).toBe(targetMetaPath);
        } finally {
            fs.rmSync(tempDir, { recursive: true, force: true });
        }
    });

    test('buildSeedList creates deterministic sequence', () => {
        expect(buildSeedList(10, 3, 7)).toEqual([10, 17, 24]);
    });

    test('buildSeedList floors fractional count and stride inputs', () => {
        expect(buildSeedList(10, 3.9, 7.8)).toEqual([10, 17, 24]);
    });

    test('buildOnnxArtifactDescriptors includes primary and enabled auxiliary artifact pairs only', () => {
        const descriptors = buildOnnxArtifactDescriptors({
            candidateOnnxPath: 'candidate.onnx',
            candidateOnnxMetaPath: 'candidate.onnx.meta.json',
            targetOnnxPath: 'target.onnx',
            targetOnnxMetaPath: 'target.onnx.meta.json',
            candidateTargetOnnxPath: 'candidate-target.onnx',
            candidateTargetOnnxMetaPath: 'candidate-target.onnx.meta.json',
            targetTargetOnnxPath: 'target-target.onnx',
            targetTargetOnnxMetaPath: 'target-target.onnx.meta.json'
        });

        expect(descriptors).toEqual([
            {
                key: 'primary',
                candidatePath: 'candidate.onnx',
                candidateMetaPath: 'candidate.onnx.meta.json',
                targetPath: 'target.onnx',
                targetMetaPath: 'target.onnx.meta.json'
            },
            {
                key: 'target',
                candidatePath: 'candidate-target.onnx',
                candidateMetaPath: 'candidate-target.onnx.meta.json',
                targetPath: 'target-target.onnx',
                targetMetaPath: 'target-target.onnx.meta.json'
            }
        ]);
    });

    test('buildUiLevelMatchArgs waits for auxiliary models when requested', () => {
        const args = buildUiLevelMatchArgs({
            blackLevel: 6,
            whiteLevel: 6,
            seed: 123,
            timeoutMs: 180000,
            onnxWaitMs: 45000,
            requireCardModelLoaded: true,
            requireTargetModelLoaded: true,
            requireValueModelLoaded: true
        }, path.resolve('data', 'runs', 'onnx-gate.out.json'));

        expect(args).toEqual(expect.arrayContaining([
            '--require-onnx-loaded',
            '--require-card-model-loaded',
            '--require-target-model-loaded',
            '--require-value-model-loaded'
        ]));
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
                matchErrorCount: 1,
                latencyCallCount: 12,
                latencyTotalMs: 120,
                latencyP95Ms: 14,
                latencyMaxMs: 25
            }
        );
        expect(decision.passedByAverage).toBe(true);
        expect(decision.passedBySeedPassCount).toBe(true);
        expect(decision.passedByMinSeedScore).toBe(false);
        expect(decision.passedByNoMatchErrors).toBe(false);
        expect(decision.passed).toBe(false);
    });

    test('computeOnnxGateDecision fails when latency thresholds are exceeded', () => {
        const decision = computeOnnxGateDecision(
            [
                { candidateScore: 0.62 },
                { candidateScore: 0.58 }
            ],
            {
                threshold: 0.5,
                minSeedScore: 0.5,
                minSeedPassCount: 1,
                maxAverageLatencyMs: 8,
                maxP95LatencyMs: 10,
                maxMaxLatencyMs: 12
            },
            {
                totalMatches: 4,
                onnxLoadedMatches: 4,
                runtimeErrorCount: 0,
                matchErrorCount: 0,
                latencyCallCount: 10,
                latencyTotalMs: 95,
                latencyP95Ms: 11,
                latencyMaxMs: 13
            }
        );

        expect(decision.passedByAverageLatency).toBe(false);
        expect(decision.passedByP95Latency).toBe(false);
        expect(decision.passedByMaxLatency).toBe(false);
        expect(decision.passed).toBe(false);
    });

    test('collectOnnxDiagnostics counts primary card head as available card capability', () => {
        const diagnostics = collectOnnxDiagnostics({
            runtimeStatus: {
                onnx: {
                    loaded: true,
                    cardModelLoaded: false,
                    hasCardHead: true
                }
            },
            consoleMessages: []
        });

        expect(diagnostics.onnxLoaded).toBe(true);
        expect(diagnostics.cardModelLoaded).toBe(true);
    });

    test('collectOnnxDiagnostics captures runtime latency summary', () => {
        const diagnostics = collectOnnxDiagnostics({
            runtimeStatus: {
                onnx: {
                    loaded: true,
                    latency: {
                        overall: {
                            count: 9,
                            totalMs: 72,
                            averageMs: 8,
                            p95Ms: 12,
                            maxMs: 14
                        }
                    }
                }
            },
            consoleMessages: []
        });

        expect(diagnostics.latencyCallCount).toBe(9);
        expect(diagnostics.latencyTotalMs).toBe(72);
        expect(diagnostics.averageLatencyMs).toBe(8);
        expect(diagnostics.p95LatencyMs).toBe(12);
        expect(diagnostics.maxLatencyMs).toBe(14);
    });
});
