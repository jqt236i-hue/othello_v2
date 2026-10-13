import * as crypto from 'crypto';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
const {
    parseArgs,
    buildSeedList,
    buildOnnxArtifactDescriptors,
    buildUiLevelMatchArgs,
    buildPatchedModelAssetManifestPayload,
    collectOnnxDiagnostics,
    computeOnnxGateDecision,
    runOnnxGate
} = require('../scripts/benchmark-policy-onnx-gate');
const GateContract = require('../scripts/policy-onnx-browser-gate-contract');

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

    test('buildPatchedModelAssetManifestPayload adds gate target onnx artifacts without dropping existing files', () => {
        const cwd = path.join('C:', 'repo');
        const payload = buildPatchedModelAssetManifestPayload(
            {
                schemaVersion: 'model_assets.v1',
                files: [
                    'data/models/othello/policy-table.json',
                    'data/models/policy-net.onnx'
                ]
            },
            [
                path.join(cwd, 'data', 'models', 'policy-net.onnx'),
                path.join(cwd, 'data', 'models', 'policy-net.onnx.meta.json')
            ],
            cwd
        );

        expect(payload.schemaVersion).toBe('model_assets.v1');
        expect(payload.files).toEqual([
            'data/models/othello/policy-table.json',
            'data/models/policy-net.onnx',
            'data/models/policy-net.onnx.meta.json'
        ]);
    });

    test('buildUiLevelMatchArgs emits only browser gate flags that the CLI parser and runtime status understand', () => {
        const args = buildUiLevelMatchArgs({
            blackLevel: 6,
            whiteLevel: 6,
            seed: 123,
            timeoutMs: 180000,
            onnxWaitMs: 45000,
            requireTargetModelLoaded: true,
            requireValueModelLoaded: true
        }, path.resolve('data', 'runs', 'onnx-gate.out.json'));
        const flags = args.filter((value: string) => /^--require-.*loaded$/.test(value));
        expect(flags).toEqual(['--require-onnx-loaded', '--require-target-model-loaded', '--require-value-model-loaded']);

        // Every emitted flag is a real CLI capability (not silently ignored) ...
        const { parseArgs: parseUiLevelMatchArgs } = require('../../scripts/run-ui-level-match');
        const parsed = parseUiLevelMatchArgs(flags);
        expect([parsed.requireOnnxLoaded, parsed.requireTargetModelLoaded, parsed.requireValueModelLoaded]).toEqual([true, true, true]);
        // ... backed by a field of the browser runtime status.
        const runtime = require(path.resolve(__dirname, '..', '..', 'game', 'ai', 'policy-onnx-runtime.js'));
        const status = runtime.getStatus();
        for (const descriptor of GateContract.BROWSER_GATE_HEADS) {
            expect(Object.prototype.hasOwnProperty.call(status, descriptor.statusField)).toBe(true);
        }
    });

    test('a card head request is rejected by the gate builder, the gate CLI, and the browser match CLI', () => {
        expect(() => buildUiLevelMatchArgs({ blackLevel: 6, whiteLevel: 6, seed: 1, timeoutMs: 180000, requireCardModelLoaded: true }, 'out.json'))
            .toThrow(/unsupported head "card"/);
        const { parseArgs: parseUiLevelMatchArgs } = require('../../scripts/run-ui-level-match');
        expect(() => parseUiLevelMatchArgs(['--require-card-model-loaded'])).toThrow(/unsupported head "card"/);
        expect(() => parseUiLevelMatchArgs(['--require-mystery-model-loaded'])).toThrow(/unsupported head "mystery"/);

        const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'onnx-gate-card-'));
        try {
            const candidate = writeOnnxPair(path.join(tempDir, 'candidate.onnx'), 'candidate');
            const card = writeOnnxPair(path.join(tempDir, 'candidate-card.onnx'), 'card');
            expect(() => parseArgs([
                '--candidate-onnx', candidate.onnxPath,
                '--target-onnx', path.join(tempDir, 'policy-net.onnx'),
                '--target-onnx-meta', path.join(tempDir, 'policy-net.onnx.meta.json'),
                '--candidate-card-onnx', card.onnxPath
            ])).toThrow(/unsupported head "card"/);
        } finally {
            fs.rmSync(tempDir, { recursive: true, force: true });
        }
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

describe('onnx gate model isolation (R08)', () => {
    let tempDir: string;

    beforeEach(() => {
        tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'onnx-gate-isolation-'));
        jest.spyOn(console, 'log').mockImplementation(() => {});
    });

    afterEach(() => {
        fs.rmSync(tempDir, { recursive: true, force: true });
        jest.restoreAllMocks();
    });

    const sha = (bytes: Buffer) => crypto.createHash('sha256').update(bytes).digest('hex');

    function snapshotDir(dir: string) {
        const out: Record<string, { sha: string; mtimeMs: number }> = {};
        const visit = (current: string) => {
            if (!fs.existsSync(current)) return;
            for (const name of fs.readdirSync(current).sort()) {
                const full = path.join(current, name);
                const stat = fs.statSync(full);
                if (stat.isDirectory()) visit(full);
                else out[path.relative(dir, full)] = { sha: sha(fs.readFileSync(full)), mtimeMs: stat.mtimeMs };
            }
        };
        visit(dir);
        return out;
    }

    function setupLane(name: string, bytes: number[]) {
        const serveRoot = path.join(tempDir, 'repo');
        const rootModels = path.join(serveRoot, 'data', 'models');
        if (!fs.existsSync(rootModels)) {
            fs.mkdirSync(rootModels, { recursive: true });
            fs.writeFileSync(path.join(rootModels, 'policy-net.onnx'), Buffer.from([9, 9, 9]));
            fs.writeFileSync(path.join(rootModels, 'policy-net.onnx.meta.json'), '{"tag":"root"}');
            fs.writeFileSync(path.join(rootModels, 'model-assets.json'), JSON.stringify({ schemaVersion: 'model_assets.v1', files: ['data/models/othello/policy-table.json'] }));
        }
        const laneDir = path.join(tempDir, 'lanes', name);
        fs.mkdirSync(laneDir, { recursive: true });
        const candidatePath = path.join(laneDir, `policy-net.candidate.${name}.onnx`);
        fs.writeFileSync(candidatePath, Buffer.from(bytes));
        fs.writeFileSync(`${candidatePath}.meta.json`, JSON.stringify({ tag: name }));
        const options = parseArgs([
            '--candidate-onnx', candidatePath,
            '--target-onnx', path.join(laneDir, 'policy-net.onnx'),
            '--target-onnx-meta', path.join(laneDir, 'policy-net.onnx.meta.json'),
            '--games', '1',
            '--jobs', '1',
            '--max-total-ms', '0'
        ]);
        return { serveRoot, rootModels, laneDir, options, candidateBytes: Buffer.from(bytes) };
    }

    // Stands in for run-ui-level-match: the "page" reads data/models/policy-net.onnx through the overlay.
    function pageReadingOverlay(seen: Buffer[], options: { tamper?: boolean } = {}) {
        return async (matchOptions: any) => {
            const urlPath = 'data/models/policy-net.onnx';
            const overlayFile = path.join(matchOptions.modelOverlayDir, ...urlPath.split('/'));
            const bytes = fs.readFileSync(overlayFile);
            seen.push(bytes);
            await new Promise((resolve) => setImmediate(resolve));
            return {
                result: { winner: 'draw' },
                runtimeStatus: { onnx: { loaded: true } },
                modelOverlay: { dir: matchOptions.modelOverlayDir, served: [{ path: urlPath, sha256: options.tamper ? 'other' : sha(bytes) }] },
                consoleMessages: []
            };
        };
    }

    test('two lanes in parallel each read only their own candidate; root and the lanes stay unchanged', async () => {
        const a = setupLane('lane-a', [1, 1, 1]);
        const b = setupLane('lane-b', [2, 2, 2]);
        const before = snapshotDir(path.join(tempDir, 'repo'));
        const lanesBefore = snapshotDir(path.join(tempDir, 'lanes'));
        const seenA: Buffer[] = [];
        const seenB: Buffer[] = [];
        const bundleBase = path.join(tempDir, 'bundles');
        fs.mkdirSync(bundleBase);

        const [resultA, resultB] = await Promise.all([
            runOnnxGate(a.options, { serveRoot: a.serveRoot, bundleBaseDir: bundleBase, runUiLevelMatch: pageReadingOverlay(seenA) }),
            runOnnxGate(b.options, { serveRoot: b.serveRoot, bundleBaseDir: bundleBase, runUiLevelMatch: pageReadingOverlay(seenB) })
        ]);

        expect(seenA.length).toBeGreaterThan(0);
        expect(seenA.every((bytes) => bytes.equals(a.candidateBytes))).toBe(true);
        expect(seenB.every((bytes) => bytes.equals(b.candidateBytes))).toBe(true);
        expect(resultA.decision.modelIdentityMismatchCount).toBe(0);
        expect(resultA.modelBundle.files).toEqual(expect.arrayContaining([
            expect.objectContaining({ head: 'primary', kind: 'model', urlPath: 'data/models/policy-net.onnx', sha256: sha(a.candidateBytes) })
        ]));
        expect(resultB.modelBundle.files[0].sha256).toBe(sha(b.candidateBytes));
        expect(snapshotDir(path.join(tempDir, 'repo'))).toEqual(before);
        expect(snapshotDir(path.join(tempDir, 'lanes'))).toEqual(lanesBefore);
        expect(fs.readdirSync(bundleBase)).toEqual([]);
    });

    test('a failing match leaves root untouched and removes the gate bundle', async () => {
        const a = setupLane('lane-a', [3, 3, 3]);
        const before = snapshotDir(path.join(tempDir, 'repo'));
        const bundleBase = path.join(tempDir, 'bundles');
        fs.mkdirSync(bundleBase);
        const result = await runOnnxGate(a.options, {
            serveRoot: a.serveRoot,
            bundleBaseDir: bundleBase,
            runUiLevelMatch: async () => { throw new Error('browser crashed'); }
        });
        expect(result.decision.passed).toBe(false);
        expect(snapshotDir(path.join(tempDir, 'repo'))).toEqual(before);
        expect(fs.readdirSync(bundleBase)).toEqual([]);
    });

    test('an interrupted gate (unexpected error) still leaves root untouched and removes the bundle', async () => {
        const a = setupLane('lane-a', [4, 4, 4]);
        const before = snapshotDir(path.join(tempDir, 'repo'));
        const bundleBase = path.join(tempDir, 'bundles');
        fs.mkdirSync(bundleBase);
        const interruptingOptions = { ...a.options, get matchRetries() { throw new Error('interrupted'); } };
        await expect(runOnnxGate(interruptingOptions, {
            serveRoot: a.serveRoot,
            bundleBaseDir: bundleBase,
            runUiLevelMatch: pageReadingOverlay([])
        })).rejects.toThrow('interrupted');
        expect(snapshotDir(path.join(tempDir, 'repo'))).toEqual(before);
        expect(fs.readdirSync(bundleBase)).toEqual([]);
    });

    test('the gate fails when the page did not read the candidate bytes', async () => {
        const a = setupLane('lane-a', [5, 5, 5]);
        const result = await runOnnxGate(a.options, {
            serveRoot: a.serveRoot,
            bundleBaseDir: fs.mkdtempSync(path.join(tempDir, 'bundles-')),
            runUiLevelMatch: pageReadingOverlay([], { tamper: true })
        });
        expect(result.decision.passedByModelIdentity).toBe(false);
        expect(result.decision.passed).toBe(false);
        expect(result.diagnostics.modelIdentityMismatches).toEqual(['data/models/policy-net.onnx']);
    });
});
