const fs = require('fs');
const os = require('os');
const path = require('path');

const {
    createLauncherLogger,
    runCommandLogged,
    readTrainingCycleFailureDetail,
    annotateTrainingProfileError,
    buildTrainingProfileFailureReport,
    ensureSeedBankInitialized,
    cleanupResolvedWarehouseArtifacts
} = require('../scripts/run-selfplay-training-profile');
const {
    loadSeedBank
} = require('../scripts/seed-bank-manager');
const {
    buildIterationWarehouseManifest,
    writeTrainingWarehouseManifest
} = require('../scripts/training-warehouse-manifest-utils');

describe('selfplay training profile launcher logging', () => {
    test('launcher logger captures streamed stdout and stderr into launcher.log', async () => {
        const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'othello-training-launcher-'));
        const logPath = path.join(tempRoot, 'launcher.log');
        const logger = createLauncherLogger(logPath);
        const stdoutSpy = jest.spyOn(process.stdout, 'write').mockImplementation(() => true);
        const stderrSpy = jest.spyOn(process.stderr, 'write').mockImplementation(() => true);

        try {
            logger.log('[training-profile] launch: test');
            const result = await runCommandLogged(process.execPath, [
                '-e',
                [
                    'process.stdout.write("[selfplay] 9390/16000 completed (last winner: black)\\n");',
                    'process.stderr.write("[selfplay] 9400/16000 completed (last winner: white)\\n");'
                ].join(' ')
            ], {
                cwd: process.cwd(),
                logger
            });

            await logger.close();

            expect(result.status).toBe(0);
            expect(fs.existsSync(logPath)).toBe(true);
            const logText = fs.readFileSync(logPath, 'utf8');
            expect(logText).toContain('[training-profile] launch: test');
            expect(logText).toContain('[selfplay] 9390/16000 completed (last winner: black)');
            expect(logText).toContain('[selfplay] 9400/16000 completed (last winner: white)');
        } finally {
            stdoutSpy.mockRestore();
            stderrSpy.mockRestore();
        }
    });

    test('launcher logger rotates existing launcher.log before writing a restarted run', async () => {
        const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'othello-training-launcher-'));
        const logPath = path.join(tempRoot, 'launcher.log');
        fs.writeFileSync(logPath, '[old-run] games=2000/3200\n', 'utf8');

        const logger = createLauncherLogger(logPath);
        const stdoutSpy = jest.spyOn(process.stdout, 'write').mockImplementation(() => true);

        try {
            logger.log('[training-profile] launch: restarted');
            await logger.close();

            const files = fs.readdirSync(tempRoot).sort();
            const archived = files.filter((name) => name !== 'launcher.log' && /^launcher\..+\.log$/.test(name));
            expect(archived).toHaveLength(1);

            const currentText = fs.readFileSync(logPath, 'utf8');
            const archivedText = fs.readFileSync(path.join(tempRoot, archived[0]), 'utf8');
            expect(currentText).toContain('[training-profile] launch: restarted');
            expect(currentText).not.toContain('games=2000/3200');
            expect(archivedText).toContain('games=2000/3200');
            expect(logger.archivedPath).toBe(path.join(tempRoot, archived[0]));
        } finally {
            stdoutSpy.mockRestore();
        }
    });

    test('reads failed iteration detail from training-cycle summary', () => {
        const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'othello-training-launcher-'));
        const summaryPath = path.join(tempRoot, 'training-cycle.summary.json');
        fs.writeFileSync(summaryPath, JSON.stringify({
            failure: {
                iteration: 4,
                step: 'train-card-policy',
                exitCode: 1,
                command: 'python train_card_onnx.py'
            }
        }, null, 2), 'utf8');

        expect(readTrainingCycleFailureDetail(summaryPath)).toEqual({
            iteration: 4,
            step: 'train-card-policy',
            exitCode: 1,
            command: 'python train_card_onnx.py'
        });
    });

    test('formats phase and step details into failure report', () => {
        const error = annotateTrainingProfileError(new Error('train-cycle failed (exit=1)'), {
            phase: 'train-cycle',
            exitCode: 1,
            profile: 'production_v3',
            gate: 'promotion_v3',
            runTag: 'production_v3_test',
            summaryPath: 'C:/tmp/training-cycle.summary.json',
            launcherLogPath: 'C:/tmp/launcher.log',
            failureDetail: {
                iteration: 4,
                step: 'train-card-policy',
                command: 'python train_card_onnx.py',
                stepOutputs: ['C:/tmp/train.card.metrics.jsonl']
            }
        });

        const report = buildTrainingProfileFailureReport(error).join('\n');
        expect(report).toContain('phase=train-cycle');
        expect(report).toContain('iteration=4');
        expect(report).toContain('step=train-card-policy');
        expect(report).toContain('summary=C:/tmp/training-cycle.summary.json');
        expect(report).toContain('launcherLog=C:/tmp/launcher.log');
        expect(report).toContain('failedCommand=python train_card_onnx.py');
        expect(report).toContain('stepOutputs=C:/tmp/train.card.metrics.jsonl');
    });

    test('initializes a missing seed bank from resolved command args', () => {
        const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'othello-training-launcher-'));
        const seedBankPath = path.join(tempRoot, 'seed-bank.v1.json');
        const logger = { log: jest.fn() };
        const resolved = {
            cwd: process.cwd(),
            profile: { name: 'browser_lv6_deploy_v1_seedbank_canary' },
            paths: { runTag: 'browser_lv6_deploy_v1_seedbank_canary_test' },
            command: {
                args: [
                    process.execPath,
                    '--seed', '1',
                    '--seed-bank', seedBankPath,
                    '--quality-gate',
                    '--quality-gate-seed-count', '5',
                    '--quality-gate-seed-stride', '1000',
                    '--quality-gate-seed-offset', '250000',
                    '--quick-adoption-seed-count', '5',
                    '--quick-adoption-seed-stride', '1000',
                    '--quick-adoption-seed-offset', '0',
                    '--final-adoption-seed-count', '5',
                    '--final-adoption-seed-stride', '1000',
                    '--adoption-final-seed-offset', '500000'
                ]
            }
        };

        const createdPath = ensureSeedBankInitialized(resolved, logger);
        const bank = loadSeedBank(seedBankPath);

        expect(createdPath).toBe(seedBankPath);
        expect(bank.bankId).toBe('browser_lv6_deploy_v1_seedbank_canary-seed-bank');
        expect(bank.gates.quick).toMatchObject({
            baseSeed: 1,
            seedCount: 5,
            seedStride: 1000
        });
        expect(bank.gates.quality).toMatchObject({
            baseSeed: 250001,
            seedCount: 5,
            seedStride: 1000
        });
        expect(bank.gates.final).toMatchObject({
            baseSeed: 500001,
            seedCount: 5,
            seedStride: 1000
        });
        expect(bank.gates.onnx).toMatchObject({
            baseSeed: 700001,
            seedCount: 1,
            seedStride: 1000
        });
        expect(logger.log).toHaveBeenCalledWith(`[training-profile] seedBank initialized=${seedBankPath}`);
    });

    test('launcher cleanup sweeps the runs root for historical selfplay blobs', () => {
        const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'othello-training-launcher-'));
        const runsRoot = path.join(tempRoot, 'data', 'runs');
        const laneADir = path.join(runsRoot, 'lane-a');
        const laneBDir = path.join(runsRoot, 'lane-b');
        const modelsDir = path.join(tempRoot, 'data', 'models');
        fs.mkdirSync(laneADir, { recursive: true });
        fs.mkdirSync(laneBDir, { recursive: true });
        fs.mkdirSync(modelsDir, { recursive: true });

        const runTag = 'cleanup-launcher';
        const trainDataPath = path.join(laneADir, `selfplay.train.${runTag}.it01.ndjson`);
        const trainDataSummaryPath = `${trainDataPath}.summary.json`;
        const evalDataPath = path.join(laneADir, `selfplay.eval.${runTag}.it01.ndjson`);
        const evalDataSummaryPath = `${evalDataPath}.summary.json`;
        const trainHardcaseDataPath = path.join(laneADir, `selfplay.train.hardcase.${runTag}.it01.ndjson`);
        const evalHardcaseDataPath = path.join(laneADir, `selfplay.eval.hardcase.${runTag}.it01.ndjson`);
        const warehouseManifestPath = path.join(laneADir, `training-warehouse.${runTag}.it01.json`);
        const logger = { log: jest.fn() };

        try {
            fs.writeFileSync(trainDataPath, '{}\n', 'utf8');
            fs.writeFileSync(trainHardcaseDataPath, '{}\n', 'utf8');
            fs.writeFileSync(evalDataPath, '{}\n', 'utf8');
            fs.writeFileSync(evalHardcaseDataPath, '{}\n', 'utf8');
            fs.writeFileSync(trainDataSummaryPath, JSON.stringify({ schemaVersion: 'selfplay_summary.v1' }, null, 2), 'utf8');
            fs.writeFileSync(evalDataSummaryPath, JSON.stringify({ schemaVersion: 'selfplay_summary.v1' }, null, 2), 'utf8');

            const manifest = buildIterationWarehouseManifest({
                runTag,
                summaryOut: path.join(laneADir, 'training-cycle.summary.json'),
                allowCardUsage: true,
                bootstrapPolicyModelPath: null,
                promotionMode: 'quick-only'
            }, {
                iteration: 1,
                seed: 1,
                evalSeed: 100001,
                usedSelfplayCardUsageRate: 0.2,
                gateControl: {
                    gateIterationAllowed: true,
                    baselineMode: 'guide',
                    baselineModelPath: null
                },
                paths: {
                    tag: `${runTag}.it01`,
                    trainDataPath,
                    trainDataSummaryPath,
                    trainHardcaseDataPath,
                    evalDataPath,
                    evalDataSummaryPath,
                    evalHardcaseDataPath
                },
                hasTargetTrainingData: true,
                promoted: false,
                promotionDetail: {
                    promoteEligible: false
                },
                steps: []
            });
            writeTrainingWarehouseManifest(warehouseManifestPath, manifest);

            const result = cleanupResolvedWarehouseArtifacts({
                paths: {
                    runsDir: laneBDir
                }
            }, logger);

            expect(result.cleanupRoot).toBe(runsRoot);
            expect(result.manifestsScanned).toBe(1);
            expect(result.failed).toEqual([]);
            expect(fs.existsSync(trainDataPath)).toBe(false);
            expect(fs.existsSync(evalDataPath)).toBe(false);
            expect(fs.existsSync(trainDataSummaryPath)).toBe(true);
            expect(fs.existsSync(warehouseManifestPath)).toBe(true);
            expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('cleaned historical selfplay artifacts='));
        } finally {
            fs.rmSync(tempRoot, { recursive: true, force: true });
        }
    });
});
