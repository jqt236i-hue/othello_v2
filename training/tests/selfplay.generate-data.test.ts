// @ts-nocheck
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { parseArgs } from '../scripts/generate-selfplay-data.js';
import * as cpuLv6SharedProfile from '../constants/cpu-lv6-shared-profile.js';

describe('selfplay generate data script', () => {
    test('parseArgs defaults align standalone selfplay with shared Lv6 teacher profile', () => {
        const teacher = cpuLv6SharedProfile.teacher;
        const args = parseArgs([]);

        expect(args.policyMixRate).toBeCloseTo(teacher.policyMixRate, 6);
        expect(args.policyCurrentAnchorRate).toBeCloseTo(teacher.policyCurrentAnchorRate, 6);
        expect(args.tacticalWeightMin).toBeCloseTo(teacher.tacticalWeightMin, 6);
        expect(args.tacticalWeightMax).toBeCloseTo(teacher.tacticalWeightMax, 6);
        expect(args.tacticalDepthOpening).toBe(teacher.tacticalDepthOpening);
        expect(args.tacticalDepthMid).toBe(teacher.tacticalDepthMid);
        expect(args.tacticalDepthEnd).toBe(teacher.tacticalDepthEnd);
        expect(args.tacticalBeamWidth).toBe(teacher.tacticalBeamWidth);
        expect(args.teacherCommitteeWeightMin).toBeCloseTo(teacher.teacherCommitteeWeightMin, 6);
        expect(args.teacherCommitteeWeightMax).toBeCloseTo(teacher.teacherCommitteeWeightMax, 6);
        expect(args.teacherCommitteeConsensusBonusMin).toBeCloseTo(teacher.teacherCommitteeConsensusBonusMin, 6);
        expect(args.teacherCommitteeConsensusBonusMax).toBeCloseTo(teacher.teacherCommitteeConsensusBonusMax, 6);
        expect(args.policyScoreWeightMin).toBeCloseTo(teacher.policyScoreWeightMin, 6);
        expect(args.policyScoreWeightMax).toBeCloseTo(teacher.policyScoreWeightMax, 6);
        expect(args.heuristicWeightMin).toBeCloseTo(teacher.heuristicWeightMin, 6);
        expect(args.heuristicWeightMax).toBeCloseTo(teacher.heuristicWeightMax, 6);
        expect(args.blackDeckCode).toBeNull();
        expect(args.whiteDeckCode).toContain('D1C1:');
        expect(args.whiteDeckCode).toContain('reinforcement_01');
    });

    test('parseArgs can disable the fixed white selfplay deck', () => {
        const args = parseArgs(['--no-white-deck-code']);

        expect(args.whiteDeckCode).toBeNull();
    });

    test('parseArgs accepts existing --policy-model path', () => {
        const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'othello-selfplay-'));
        const modelPath = path.join(tempDir, 'policy-table.json');
        fs.writeFileSync(modelPath, JSON.stringify({ schemaVersion: 'policy_table.v2', states: {} }), 'utf8');
        try {
            const args = parseArgs(['--policy-model', modelPath]);
            expect(args.policyModelPath).toBe(path.resolve(process.cwd(), modelPath));
        } finally {
            fs.rmSync(tempDir, { recursive: true, force: true });
        }
    });

    test('parseArgs rejects missing --policy-model path', () => {
        expect(() => parseArgs(['--policy-model', 'missing-policy-model.json'])).toThrow('--policy-model not found:');
    });

    test('parseArgs accepts --policy-model-pool and normalizes paths', () => {
        const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'othello-selfplay-pool-'));
        const modelA = path.join(tempDir, 'pool-a.json');
        const modelB = path.join(tempDir, 'pool-b.json');
        fs.writeFileSync(modelA, JSON.stringify({ schemaVersion: 'policy_table.v2', states: {} }), 'utf8');
        fs.writeFileSync(modelB, JSON.stringify({ schemaVersion: 'policy_table.v2', states: {} }), 'utf8');
        try {
            const args = parseArgs(['--policy-model-pool', `${modelA},${modelB}`]);
            expect(args.policyModelPoolPaths).toEqual([
                path.resolve(process.cwd(), modelA),
                path.resolve(process.cwd(), modelB)
            ]);
        } finally {
            fs.rmSync(tempDir, { recursive: true, force: true });
        }
    });

    test('parseArgs rejects missing --policy-model-pool paths', () => {
        expect(() => parseArgs(['--policy-model-pool', 'missing-a.json'])).toThrow('--policy-model-pool not found:');
    });

    test('parseArgs accepts imperfect-information diversity controls', () => {
        const args = parseArgs([
            '--policy-mix-rate', '0.72',
            '--card-usage-rate-jitter', '0.18',
            '--tactical-weight-min', '0.7',
            '--tactical-weight-max', '1.6',
            '--tactical-depth-opening', '4',
            '--tactical-depth-mid', '8',
            '--tactical-depth-end', '12',
            '--tactical-beam-width', '8',
            '--worker-retries', '2.9',
            '--resume-chunk-size', '1000.9',
            '--reuse-completed-chunks'
        ]);
        expect(args.policyMixRate).toBeCloseTo(0.72, 6);
        expect(args.cardUsageRateJitter).toBeCloseTo(0.18, 6);
        expect(args.tacticalWeightMin).toBeCloseTo(0.7, 6);
        expect(args.tacticalWeightMax).toBeCloseTo(1.6, 6);
        expect(args.tacticalDepthOpening).toBe(4);
        expect(args.tacticalDepthMid).toBe(8);
        expect(args.tacticalDepthEnd).toBe(12);
        expect(args.tacticalBeamWidth).toBe(8);
        expect(args.workerRetries).toBe(2);
        expect(args.resumeChunkSize).toBe(1000);
        expect(args.reuseCompletedChunks).toBe(true);
    });

    test('parseArgs validates diversity control ranges', () => {
        expect(() => parseArgs(['--policy-mix-rate', '1.1'])).toThrow('--policy-mix-rate must be in [0,1]');
        expect(() => parseArgs(['--card-usage-rate-jitter', '-0.1'])).toThrow('--card-usage-rate-jitter must be in [0,1]');
        expect(() => parseArgs(['--tactical-weight-min', '-1'])).toThrow('--tactical-weight-min must be >= 0');
        expect(() => parseArgs(['--tactical-weight-max', '-1'])).toThrow('--tactical-weight-max must be >= 0');
        expect(() => parseArgs(['--tactical-weight-min', '1.2', '--tactical-weight-max', '0.8'])).toThrow('--tactical-weight-max must be >= --tactical-weight-min');
        expect(() => parseArgs(['--tactical-depth-opening', '-1'])).toThrow('--tactical-depth-opening must be >= 0');
        expect(() => parseArgs(['--tactical-depth-mid', '-1'])).toThrow('--tactical-depth-mid must be >= 0');
        expect(() => parseArgs(['--tactical-depth-end', '-1'])).toThrow('--tactical-depth-end must be >= 0');
        expect(() => parseArgs(['--tactical-beam-width', '-1'])).toThrow('--tactical-beam-width must be >= 0');
        expect(() => parseArgs(['--worker-retries', '-1'])).toThrow('--worker-retries must be >= 0');
        expect(() => parseArgs(['--resume-chunk-size', '-1'])).toThrow('--resume-chunk-size must be >= 0');
    });

    test('parseArgs applies resolved profile defaults and derives hardcase split output', () => {
        const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'othello-selfplay-resolved-'));
        const modelPath = path.join(tempDir, 'bootstrap-policy.json');
        const resolvedConfigPath = path.join(tempDir, 'resolved-config.json');
        fs.writeFileSync(modelPath, JSON.stringify({ schemaVersion: 'policy_table.v2', states: {} }), 'utf8');
        fs.writeFileSync(resolvedConfigPath, JSON.stringify({
            bootstrap: {
                bootstrapPolicyModelPath: modelPath
            },
            command: {
                args: [
                    'scripts/run-selfplay-training-cycle.js',
                    '--train-games', '321',
                    '--selfplay-jobs', '7',
                    '--selfplay-resume-chunk-size', '1000',
                    '--card-usage-rate', '0.44',
                    '--selfplay-policy-score-weight-min', '1.6',
                    '--selfplay-policy-score-weight-max', '2.2',
                    '--selfplay-heuristic-weight-min', '0.75',
                    '--selfplay-heuristic-weight-max', '1.0',
                    '--no-cards'
                ]
            }
        }, null, 2), 'utf8');

        try {
            const outPath = path.join(tempDir, 'train.ndjson');
            const args = parseArgs([
                '--resolved-config', resolvedConfigPath,
                '--out', outPath,
                '--seed-family', 'train'
            ]);
            expect(args.games).toBe(321);
            expect(args.jobs).toBe(7);
            expect(args.resumeChunkSize).toBe(1000);
            expect(args.allowCardUsage).toBe(false);
            expect(args.cardUsageRate).toBeCloseTo(0.44, 6);
            expect(args.policyScoreWeightMin).toBeCloseTo(1.6, 6);
            expect(args.policyScoreWeightMax).toBeCloseTo(2.2, 6);
            expect(args.heuristicWeightMin).toBeCloseTo(0.75, 6);
            expect(args.heuristicWeightMax).toBeCloseTo(1.0, 6);
            expect(args.policyModelPath).toBe(path.resolve(process.cwd(), modelPath));
            expect(args.dataLane).toBe('train-main');
            expect(args.hardcaseOut).toBe(path.join(path.dirname(outPath), 'train.hardcase.ndjson'));
        } finally {
            fs.rmSync(tempDir, { recursive: true, force: true });
        }
    });
});
