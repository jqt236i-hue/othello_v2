import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

const {
    parseArgs,
    inferPhaseFromCommand,
    analyzeLauncherLogLines,
    buildMonitorSnapshot,
    formatMonitorSnapshotText,
    findLatestRunDirectory,
    resolveRunDirectory
} = require('../scripts/monitor-selfplay-training-run');

describe('selfplay training monitor script', () => {
    test('parseArgs accepts watch and tail options', () => {
        const args = parseArgs([
            '--profile', 'research_incremental_growth_v1',
            '--watch',
            '--interval-ms', '6000',
            '--tail', '12',
            '--json'
        ]);

        expect(args.profile).toBe('research_incremental_growth_v1');
        expect(args.watch).toBe(true);
        expect(args.intervalMs).toBe(6000);
        expect(args.tailLines).toBe(12);
        expect(args.json).toBe(true);
    });

    test('inferPhaseFromCommand distinguishes train and eval selfplay', () => {
        expect(inferPhaseFromCommand('node scripts/generate-selfplay-data.js --out data/runs/selfplay.train.foo.ndjson'))
            .toEqual({ key: 'generate-train', label: '自己対局(train)' });
        expect(inferPhaseFromCommand('node scripts/generate-selfplay-data.js --out data/runs/selfplay.eval.foo.ndjson --data-lane eval-suite'))
            .toEqual({ key: 'generate-eval', label: '自己対局(eval)' });
    });

    test('analyzes live iteration progress from launcher log tail', () => {
        const parsed = analyzeLauncherLogLines([
            '[training-cycle] iteration 11/20 start',
            '[training-cycle] run: node scripts/generate-selfplay-data.js --out data/runs/selfplay.train.research_incremental_growth_v1_20260317_012456.it11.ndjson',
            '[selfplay] 190/500 completed (last winner: black)'
        ]);

        expect(parsed.currentIteration).toBe(11);
        expect(parsed.totalIterations).toBe(20);
        expect(parsed.currentPhaseKey).toBe('generate-train');
        expect(parsed.phaseProgress).toEqual({ current: 190, total: 500, unit: 'games' });
    });

    test('builds snapshot from summary and launcher log', () => {
        const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'othello-training-monitor-'));
        const runDir = path.join(tempRoot, 'research_incremental_growth_v1_20260317_012456');
        fs.mkdirSync(runDir, { recursive: true });

        const summaryPath = path.join(runDir, 'training-cycle.summary.json');
        const launcherLogPath = path.join(runDir, 'launcher.log');
        fs.writeFileSync(summaryPath, JSON.stringify({
            config: {
                iterations: 20,
                gateFinalIterationOnly: true,
                adoptionUseAnchorBaseline: true,
                qualityGateEnabled: true,
                seedBankPath: 'C:/tmp/seed-bank.demo.json'
            },
            latestGuideModelPath: 'C:/tmp/policy-table.candidate.test.it10.json',
            latestResumeCheckpointPath: 'C:/tmp/policy-net.candidate.test.it10.checkpoint.pt',
            latestAnchorModelPath: 'C:/tmp/anchor.json',
            latestWarehouseManifestPath: path.join(runDir, 'training-warehouse.test.it10.json'),
            warehouseManifestSchemaVersion: 'training_warehouse_manifest.v1',
            stoppedByTimeBudget: false,
            stopReason: null,
            failure: null,
            iterations: Array.from({ length: 10 }, (_, index) => ({
                iteration: index + 1,
                quickDecision: index === 9
                    ? {
                        passed: false,
                        primaryFailureReason: 'lower-bound',
                        failureReasons: ['lower-bound']
                    }
                    : { passed: true }
            }))
        }, null, 2), 'utf8');
        fs.writeFileSync(launcherLogPath, [
            '[training-cycle] iteration 11/20 start',
            '[training-cycle] run: node scripts/generate-selfplay-data.js --out data/runs/selfplay.train.research_incremental_growth_v1_20260317_012456.it11.ndjson',
            '[selfplay] 190/500 completed (last winner: black)'
        ].join('\n'), 'utf8');

        const snapshot = buildMonitorSnapshot(runDir, { tailLines: 3 });
        expect(snapshot.status).toBe('running');
        expect(snapshot.completedIterations).toBe(10);
        expect(snapshot.currentIteration).toBe(11);
        expect(snapshot.currentPhaseKey).toBe('generate-train');
        expect(snapshot.phaseProgress).toEqual({ current: 190, total: 500, unit: 'games' });
        expect(snapshot.gateMode).toBe('final-only');
        expect(snapshot.baselineMode).toBe('anchor');
        expect(snapshot.latestGuideModel).toBe('policy-table.candidate.test.it10.json');
        expect(snapshot.seedBank).toBe('seed-bank.demo.json');
        expect(snapshot.latestWarehouseManifest).toBe('training-warehouse.test.it10.json');
        expect(snapshot.latestGateOutcomes.quick).toMatchObject({
            state: 'failed',
            primaryFailureReason: 'lower-bound'
        });
    });

    test('builds snapshot from launcher log before summary exists', () => {
        const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'othello-training-monitor-'));
        const runDir = path.join(tempRoot, 'adaptive_best_current_v1_20260318_010101');
        fs.mkdirSync(runDir, { recursive: true });

        fs.writeFileSync(path.join(runDir, 'config.resolved.json'), JSON.stringify({
            command: {
                args: [
                        'scripts/run-selfplay-training-cycle.js',
                        '--iterations', '8',
                        '--adoption-use-guide-baseline',
                        '--gate-final-iteration-only',
                        '--seed-bank', 'data/runs/research_incremental_growth_v1/seed-bank.json'
                    ]
                }
            }, null, 2), 'utf8');
        fs.writeFileSync(path.join(runDir, 'launcher.log'), [
            '[training-cycle] iteration 1/8 start',
            '[training-cycle] run: node scripts/generate-selfplay-data.js --out data/runs/selfplay.train.adaptive_best_current_v1_20260318_010101.it1.ndjson',
            '[selfplay] 24/1500 completed (last winner: white)'
        ].join('\n'), 'utf8');

        const snapshot = buildMonitorSnapshot(runDir, { tailLines: 2 });
        expect(snapshot.status).toBe('running');
        expect(snapshot.totalIterations).toBe(8);
        expect(snapshot.currentIteration).toBe(1);
        expect(snapshot.currentPhaseKey).toBe('generate-train');
        expect(snapshot.phaseProgress).toEqual({ current: 24, total: 1500, unit: 'games' });
        expect(snapshot.gateMode).toBe('final-only');
        expect(snapshot.baselineMode).toBe('guide');
        expect(snapshot.seedBank).toBe('seed-bank.json');
    });

    test('tolerates a null summary payload during startup', () => {
        const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'othello-training-monitor-'));
        const runDir = path.join(tempRoot, 'adaptive_best_current_v1_20260318_020202');
        fs.mkdirSync(runDir, { recursive: true });

        fs.writeFileSync(path.join(runDir, 'config.resolved.json'), JSON.stringify({
            command: {
                args: [
                        'scripts/run-selfplay-training-cycle.js',
                        '--iterations', '8',
                        '--adoption-use-guide-baseline',
                        '--gate-final-iteration-only',
                        '--seed-bank', 'data/runs/adaptive_best_current_v1/seed-bank.json'
                    ]
                }
            }, null, 2), 'utf8');
        fs.writeFileSync(path.join(runDir, 'training-cycle.summary.json'), 'null\n', 'utf8');
        fs.writeFileSync(path.join(runDir, 'launcher.log'), [
            '[training-cycle] iteration 1/8 start',
            '[training-cycle] run: node scripts/generate-selfplay-data.js --out data/runs/selfplay.train.adaptive_best_current_v1_20260318_020202.it1.ndjson',
            '[selfplay] 10/1500 completed (last winner: black)'
        ].join('\n'), 'utf8');

        const snapshot = buildMonitorSnapshot(runDir, { tailLines: 2 });
        expect(snapshot.status).toBe('running');
        expect(snapshot.totalIterations).toBe(8);
        expect(snapshot.currentIteration).toBe(1);
        expect(snapshot.gateMode).toBe('final-only');
        expect(snapshot.baselineMode).toBe('guide');
        expect(snapshot.seedBank).toBe('seed-bank.json');
    });

    test('formatMonitorSnapshotText includes warehouse and gate failure taxonomy', () => {
        const text = formatMonitorSnapshotText({
            runTag: 'demo_run',
            runDir: 'C:/tmp/demo_run',
            status: 'running',
            updatedAt: '2026-04-02T00:00:00.000Z',
            totalIterations: 10,
            completedIterations: 3,
            currentIteration: 4,
            currentPhaseLabel: '自己対局(train)',
            phaseProgress: { current: 12, total: 100, unit: 'games' },
            gateMode: 'every-iteration',
            baselineMode: 'guide',
            latestGuideModel: 'policy-table.json',
            latestResumeCheckpoint: 'policy-net.checkpoint.pt',
            latestAnchorModel: null,
            seedBank: 'seed-bank.demo.json',
            latestWarehouseManifest: 'training-warehouse.demo_run.it03.json',
            latestWarehouseManifestSchemaVersion: 'training_warehouse_manifest.v1',
            latestGateOutcomes: {
                quick: { state: 'failed', primaryFailureReason: 'lower-bound' },
                quality: { state: 'blocked-by-quick', primaryFailureReason: null },
                final: { state: 'blocked-by-earlier-gate', primaryFailureReason: null },
                onnx: { state: 'disabled', primaryFailureReason: null }
            },
            stopReason: null,
            failure: null,
            failureMessage: null,
            tailLines: []
        });

        expect(text).toContain('seed-bank=seed-bank.demo.json');
        expect(text).toContain('warehouse=training-warehouse.demo_run.it03.json schema=training_warehouse_manifest.v1');
        expect(text).toContain('latest-gates=quick:failed(lower-bound) quality:blocked-by-quick final:blocked-by-earlier-gate onnx:disabled');
    });

    test('resolves latest run directory by freshness', () => {
        const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'othello-training-monitor-'));
        const runsDir = path.join(tempRoot, 'data', 'runs', 'research_incremental_growth_v1');
        const olderRun = path.join(runsDir, 'run_old');
        const newerRun = path.join(runsDir, 'run_new');
        fs.mkdirSync(olderRun, { recursive: true });
        fs.mkdirSync(newerRun, { recursive: true });

        const olderLog = path.join(olderRun, 'launcher.log');
        const newerLog = path.join(newerRun, 'launcher.log');
        fs.writeFileSync(olderLog, 'old\n', 'utf8');
        fs.writeFileSync(newerLog, 'new\n', 'utf8');
        fs.utimesSync(olderLog, new Date('2026-03-17T01:00:00.000Z'), new Date('2026-03-17T01:00:00.000Z'));
        fs.utimesSync(newerLog, new Date('2026-03-17T02:00:00.000Z'), new Date('2026-03-17T02:00:00.000Z'));

        expect(findLatestRunDirectory(runsDir)).toBe(newerRun);
        expect(resolveRunDirectory({ profile: 'research_incremental_growth_v1' }, tempRoot)).toBe(newerRun);
    });
});
