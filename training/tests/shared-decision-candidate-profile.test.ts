import * as fs from 'fs';
import * as path from 'path';

const { parseSelfplayTrainingCycleArgs } = require('../scripts/selfplay-training-cycle-args');
const { applySharedTeacherProfileArgs } = require('../scripts/training-shared-teacher-args');
const shared = require('../../constants/cpu-lv6-shared-profile');

describe('shared decision candidate training safety', () => {
    const profile = JSON.parse(fs.readFileSync(path.resolve(
        'training/python/configs/profiles/shared_decision_candidate_v1.json'
    ), 'utf8'));
    const effective = applySharedTeacherProfileArgs(profile.trainCycleArgs, shared.teacher, { mode: 'fill-missing' });
    const args = parseSelfplayTrainingCycleArgs(effective.args.concat([
        '--runs-dir', profile.paths.runsDir, '--models-dir', profile.paths.modelsDir
    ]));

    test('shared defaults cannot enable promotion, root deployment, or untested guide admission', () => {
        expect(args.promoteOnPass).toBe(false);
        expect(args.deployPromotedToRoot).toBe(false);
        expect(args.selfplayCandidateAdmission).toBe('promoted-only');
        expect(args.promotionMode).toBe('strict');
        expect(args.modelsDir).toBe(path.resolve(profile.paths.modelsDir));
        expect(path.relative(path.resolve('data/models'), args.modelsDir).startsWith('..')).toBe(true);
        expect(profile.bootstrap.autoResumeLatestCheckpoint).toBe(false);
        expect(profile.bootstrap.sourcePolicyTable).toContain('/baseline/');
    });

    test('learns card, placement, target and value from bounded fresh games with held-out game splits', () => {
        expect(args.allowCardUsage).toBe(true);
        expect(args.trainCardEvery).toBe(1);
        expect(args.trainTargetHeadEnabled).toBe(true);
        expect(args.trainValueHeadEnabled).toBe(true);
        expect(args.onnxValSplitMode).toBe('grouped-game');
        expect(args.evalSeedOffset).toBeGreaterThan(args.iterations * args.seedStride + args.trainGames);
        expect(args.selfplayJobs).toBeLessThanOrEqual(6);
        expect(args.maxHours).toBeGreaterThan(0);
        expect(args.maxHours).toBeLessThanOrEqual(12);
        expect(args.onnxEpochs).toBeLessThanOrEqual(80);
        expect(args.onnxEarlyStopPatience).toBeLessThanOrEqual(8);
        expect(args.adoptionMinLowerBound).toBeGreaterThanOrEqual(0);
        expect(args.adoptionMinSeedUplift).toBeGreaterThanOrEqual(0);
        expect(args.adoptionConfidenceLevel).toBe(0.99);
    });
});
