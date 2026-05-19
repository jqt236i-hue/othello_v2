import * as fs from 'fs';
import * as path from 'path';

function parsePolicyModelPoolPaths(rawValue: any, cwd: string = process.cwd()): string[] {
    const raw = String(rawValue || '').trim();
    if (!raw) {
        throw new Error('--policy-model-pool requires at least one path');
    }
    const paths = raw
        .split(',')
        .map((one) => one.trim())
        .filter(Boolean)
        .map((one) => path.resolve(cwd, one));
    if (paths.length <= 0) {
        throw new Error('--policy-model-pool requires at least one path');
    }
    return paths;
}

function validateSelfplayTeacherRangeArgs(args: any): void {
    if (!Number.isFinite(args.tacticalWeightMin) || args.tacticalWeightMin < 0) {
        throw new Error('--tactical-weight-min must be >= 0');
    }
    if (!Number.isFinite(args.tacticalWeightMax) || args.tacticalWeightMax < 0) {
        throw new Error('--tactical-weight-max must be >= 0');
    }
    if (args.tacticalWeightMax < args.tacticalWeightMin) {
        throw new Error('--tactical-weight-max must be >= --tactical-weight-min');
    }
    if (!Number.isFinite(args.tacticalDepthOpening) || args.tacticalDepthOpening < 0) {
        throw new Error('--tactical-depth-opening must be >= 0');
    }
    if (!Number.isFinite(args.tacticalDepthMid) || args.tacticalDepthMid < 0) {
        throw new Error('--tactical-depth-mid must be >= 0');
    }
    if (!Number.isFinite(args.tacticalDepthEnd) || args.tacticalDepthEnd < 0) {
        throw new Error('--tactical-depth-end must be >= 0');
    }
    if (!Number.isFinite(args.tacticalBeamWidth) || args.tacticalBeamWidth < 0) {
        throw new Error('--tactical-beam-width must be >= 0');
    }
    if (!Number.isFinite(args.teacherCommitteeWeightMin) || args.teacherCommitteeWeightMin < 0) {
        throw new Error('--teacher-committee-weight-min must be >= 0');
    }
    if (!Number.isFinite(args.teacherCommitteeWeightMax) || args.teacherCommitteeWeightMax < 0) {
        throw new Error('--teacher-committee-weight-max must be >= 0');
    }
    if (args.teacherCommitteeWeightMax < args.teacherCommitteeWeightMin) {
        throw new Error('--teacher-committee-weight-max must be >= --teacher-committee-weight-min');
    }
    if (!Number.isFinite(args.teacherCommitteeConsensusBonusMin) || args.teacherCommitteeConsensusBonusMin < 0) {
        throw new Error('--teacher-committee-consensus-bonus-min must be >= 0');
    }
    if (!Number.isFinite(args.teacherCommitteeConsensusBonusMax) || args.teacherCommitteeConsensusBonusMax < 0) {
        throw new Error('--teacher-committee-consensus-bonus-max must be >= 0');
    }
    if (args.teacherCommitteeConsensusBonusMax < args.teacherCommitteeConsensusBonusMin) {
        throw new Error('--teacher-committee-consensus-bonus-max must be >= --teacher-committee-consensus-bonus-min');
    }
    args.tacticalDepthOpening = Math.floor(args.tacticalDepthOpening);
    args.tacticalDepthMid = Math.floor(args.tacticalDepthMid);
    args.tacticalDepthEnd = Math.floor(args.tacticalDepthEnd);
    args.tacticalBeamWidth = Math.floor(args.tacticalBeamWidth);
    if (!Number.isFinite(args.policyScoreWeightMin) || args.policyScoreWeightMin < 0) {
        throw new Error('--policy-score-weight-min must be >= 0');
    }
    if (!Number.isFinite(args.policyScoreWeightMax) || args.policyScoreWeightMax < 0) {
        throw new Error('--policy-score-weight-max must be >= 0');
    }
    if (args.policyScoreWeightMax < args.policyScoreWeightMin) {
        throw new Error('--policy-score-weight-max must be >= --policy-score-weight-min');
    }
    if (!Number.isFinite(args.heuristicWeightMin) || args.heuristicWeightMin < 0) {
        throw new Error('--heuristic-weight-min must be >= 0');
    }
    if (!Number.isFinite(args.heuristicWeightMax) || args.heuristicWeightMax < 0) {
        throw new Error('--heuristic-weight-max must be >= 0');
    }
    if (args.heuristicWeightMax < args.heuristicWeightMin) {
        throw new Error('--heuristic-weight-max must be >= --heuristic-weight-min');
    }
}

function validateSelfplayPolicyModelArgs(args: any, fsApi: Pick<typeof fs, 'existsSync'> = fs): void {
    if (args.policyModelPath && !fsApi.existsSync(args.policyModelPath)) {
        throw new Error(`--policy-model not found: ${args.policyModelPath}`);
    }
    for (const onePath of args.policyModelPoolPaths || []) {
        if (!fsApi.existsSync(onePath)) {
            throw new Error(`--policy-model-pool not found: ${onePath}`);
        }
    }
    if (args.policyPoolSampling !== 'uniform' && args.policyPoolSampling !== 'recency') {
        throw new Error('--policy-pool-sampling must be uniform or recency');
    }
    if (!Number.isFinite(args.policyPoolRecencyDecay) || args.policyPoolRecencyDecay <= 0) {
        throw new Error('--policy-pool-recency-decay must be > 0');
    }
    if (!Number.isFinite(args.policyCurrentAnchorRate) || args.policyCurrentAnchorRate < 0 || args.policyCurrentAnchorRate > 1) {
        throw new Error('--policy-current-anchor-rate must be in [0,1]');
    }
}

export = {
    parsePolicyModelPoolPaths,
    validateSelfplayTeacherRangeArgs,
    validateSelfplayPolicyModelArgs
} as any;
