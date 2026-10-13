import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

// R12: heads skipped by their training cadence must not be handed to the ONNX gate or promotion
// as planned (never produced) candidate paths; gate and promotion receive the same bundle.

function valueAfter(argv: string[], flag: string) {
    const index = argv.indexOf(flag);
    return index >= 0 ? argv[index + 1] : null;
}

function candidateHeads(argv: string[]) {
    const heads: Record<string, string> = {};
    for (const [flag, head] of [['--candidate-onnx', 'primary'], ['--candidate-card-onnx', 'card'],
        ['--candidate-target-onnx', 'target'], ['--candidate-value-onnx', 'value']]) {
        const value = valueAfter(argv, flag);
        if (value) heads[head] = value;
    }
    return heads;
}

function writeJson(filePath: string, payload: any) {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, JSON.stringify(payload), 'utf8');
}

function passedAdoptionPayload() {
    return {
        decision: {
            passed: true, uplift: 0.2, upliftLowerBound: 0.1,
            averageScore: 1, minSeedScore: 1,
            baselineCoreScore: 0.5, candidateCoreScore: 0.6
        },
        perSeed: []
    };
}

describe('training cycle ONNX bundle across cadence iterations', () => {
    let tempDir: string;
    let calls: Array<{ script: string; argv: string[] }>;
    // Files each training script produces in the current iteration (set per iteration).
    let producedFiles: Record<string, string[]>;

    beforeEach(() => {
        tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'training-cycle-bundle-'));
        calls = [];
        producedFiles = {};
        jest.spyOn(console, 'log').mockImplementation(() => {});
        jest.spyOn(console, 'warn').mockImplementation(() => {});
    });

    afterEach(() => {
        fs.rmSync(tempDir, { recursive: true, force: true });
        jest.resetModules();
        jest.restoreAllMocks();
        jest.unmock('child_process');
    });

    function loadCycleWithSpawnMock() {
        const spawnSync = jest.fn((_cmd: string, argv: string[]) => {
            const script = path.basename(String(argv[0] || ''));
            calls.push({ script, argv: argv.slice(1) });
            for (const filePath of producedFiles[script] || []) {
                fs.mkdirSync(path.dirname(filePath), { recursive: true });
                fs.writeFileSync(filePath, 'artifact');
            }
            const out = valueAfter(argv, '--out') || valueAfter(argv, '--output');
            if (script === 'generate-selfplay-data.js' && out) {
                fs.mkdirSync(path.dirname(out), { recursive: true });
                fs.writeFileSync(out, JSON.stringify({ pendingSelection: { kind: 'board_cell', row: 2, col: 3 } }) + '\n');
                const hardcase = valueAfter(argv, '--hardcase-out');
                if (hardcase) fs.writeFileSync(hardcase, '');
                const summary = valueAfter(argv, '--summary-out');
                if (summary) writeJson(summary, { summary: { totalGames: 2 } });
            }
            for (const flag of ['--onnx-out', '--meta-out', '--model-out', '--policy-table-out', '--onnx-meta-out', '--candidate-model-out']) {
                const target = valueAfter(argv, flag);
                if (target) {
                    fs.mkdirSync(path.dirname(target), { recursive: true });
                    fs.writeFileSync(target, 'artifact');
                }
            }
            if (/^benchmark-policy-(adoption|quality-gate|onnx-gate)\.js$/.test(script) && out) {
                writeJson(out, passedAdoptionPayload());
            }
            return { status: 0, signal: null, error: null };
        });
        jest.resetModules();
        jest.doMock('child_process', () => ({ ...jest.requireActual('child_process'), spawnSync }));
        let loaded: any = null;
        jest.isolateModules(() => {
            loaded = require('../scripts/run-selfplay-training-cycle');
        });
        return loaded;
    }

    test('value/target every 2: iteration 2 passes no planned candidate, and gate and promotion agree each iteration', () => {
        const cycle = loadCycleWithSpawnMock();
        const args = cycle.parseArgs([
            '--iterations', '3',
            '--runs-dir', path.join(tempDir, 'runs'),
            '--models-dir', path.join(tempDir, 'models'),
            '--train-games', '2',
            '--eval-games', '2',
            '--with-cards',
            '--train-target-head',
            '--train-target-every', '2',
            '--train-value-every', '2',
            '--onnx-gate',
            '--promotion-mode', 'onnx-primary'
        ]);

        const perIteration: any[] = [];
        for (const iterationIndex of [1, 2, 3]) {
            const before = calls.length;
            const p = cycle.buildIterationPaths(args, iterationIndex);
            // The training scripts produce exactly the files the cycle expects for this iteration.
            producedFiles = {
                'train_policy_onnx.py': [p.onnxModelPath, p.onnxMetaPath, p.candidateModelPath],
                'train_target_onnx.py': [p.targetOnnxModelPath, p.targetOnnxMetaPath],
                'train_value_onnx.py': [p.valueOnnxModelPath, p.valueOnnxMetaPath]
            };
            try {
                cycle.runIteration(args, iterationIndex, null, null);
            } catch (error) {
                throw new Error(`iteration ${iterationIndex}: ${(error as Error).message}`);
            }
            const iterationCalls = calls.slice(before);
            const gate = iterationCalls.find((call) => call.script === 'benchmark-policy-onnx-gate.js');
            const promote = iterationCalls.find((call) => call.script === 'promote-policy-model.js');
            const bundle = p.onnxBundlePath && fs.existsSync(p.onnxBundlePath) ? JSON.parse(fs.readFileSync(p.onnxBundlePath, 'utf8')) : null;
            perIteration.push({ iterationIndex, p, gate, promote, bundle });
        }

        for (const { iterationIndex, p, gate, promote, bundle } of perIteration) {
            expect(gate).toBeTruthy();
            expect(promote).toBeTruthy();
            const gated = candidateHeads(gate.argv);
            const promoted = candidateHeads(promote.argv);
            // Every candidate handed on exists and belongs to this iteration.
            for (const filePath of [...Object.values(gated), ...Object.values(promoted)]) {
                expect(fs.existsSync(filePath)).toBe(true);
                expect(filePath).toContain(`.it0${iterationIndex}`);
            }
            // Promotion receives exactly what the gate verified (card is not part of this lane).
            expect(promoted).toEqual(gated);
            const trained = iterationIndex !== 2;
            expect(Object.keys(gated).sort()).toEqual(trained ? ['primary', 'target', 'value'] : ['primary']);
            expect(gated.value || null).toBe(trained ? p.valueOnnxModelPath : null);
        }
        // The resolved bundle is recorded with the provenance of every head.
        for (const { iterationIndex, bundle } of perIteration) {
            const trained = iterationIndex !== 2;
            expect(bundle && bundle.heads.value.status).toBe(trained ? 'generated' : 'retained');
            expect(bundle && bundle.heads.target.status).toBe(trained ? 'generated' : 'retained');
        }
    });

    test('a head reported as produced but missing on disk stops the iteration instead of being skipped silently', () => {
        const { resolveIterationOnnxBundle } = require('../scripts/training-cycle-command-builders');
        const iterationPaths = {
            onnxModelPath: path.join(tempDir, 'policy-net.candidate.onnx'),
            onnxMetaPath: path.join(tempDir, 'policy-net.candidate.onnx.meta.json'),
            valueOnnxModelPath: path.join(tempDir, 'policy-value.candidate.onnx'),
            valueOnnxMetaPath: path.join(tempDir, 'policy-value.candidate.onnx.meta.json')
        };
        fs.writeFileSync(iterationPaths.onnxModelPath, 'x');
        fs.writeFileSync(iterationPaths.onnxMetaPath, 'x');
        expect(() => resolveIterationOnnxBundle({
            args: { modelsDir: tempDir, trainValueHeadEnabled: true },
            iterationPaths,
            hasTargetTrainingData: false,
            headSteps: { primary: { ran: true }, value: { ran: true } }
        })).toThrow(/value ONNX head was reported as generated but .* does not exist/);
    });
});
