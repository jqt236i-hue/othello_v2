const os = require('os');
const path = require('path');
const fs = require('fs');

const {
    resolveTrainingProfile,
    resolveNamedConfigPath
} = require('../scripts/load-training-profile');
const cpuLv6SharedProfile = require('../constants/cpu-lv6-shared-profile');

function getFlagValue(args, flag) {
    const index = args.indexOf(flag);
    if (index < 0) return null;
    if (index + 1 >= args.length) return '';
    return args[index + 1];
}

describe('load-training-profile shared teacher sync', () => {
    test('production_v2 resolves selfplay teacher args from shared Lv6 profile', () => {
        const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'othello-training-profile-'));
        const runsDir = path.join(tempRoot, 'runs');
        const modelsDir = path.join(tempRoot, 'models');
        const resolved = resolveTrainingProfile('production_v2', {
            cwd: process.cwd(),
            runTag: 'test_sync_run',
            runsDir,
            modelsDir
        });
        const args = resolved.command.args;
        const teacher = cpuLv6SharedProfile.teacher;

        expect(getFlagValue(args, '--selfplay-policy-mix-rate')).toBe(String(teacher.policyMixRate));
        expect(getFlagValue(args, '--selfplay-policy-model-pool-size')).toBe(String(teacher.policyModelPoolSize));
        expect(getFlagValue(args, '--selfplay-policy-pool-sampling')).toBe(String(teacher.policyPoolSampling));
        expect(getFlagValue(args, '--selfplay-policy-pool-recency-decay')).toBe(String(teacher.policyPoolRecencyDecay));
        expect(getFlagValue(args, '--selfplay-policy-current-anchor-rate')).toBe(String(teacher.policyCurrentAnchorRate));
        expect(getFlagValue(args, '--selfplay-tactical-depth-opening')).toBe(String(teacher.tacticalDepthOpening));
        expect(getFlagValue(args, '--selfplay-tactical-depth-mid')).toBe(String(teacher.tacticalDepthMid));
        expect(getFlagValue(args, '--selfplay-tactical-depth-end')).toBe(String(teacher.tacticalDepthEnd));
        expect(getFlagValue(args, '--selfplay-tactical-beam-width')).toBe(String(teacher.tacticalBeamWidth));
        expect(getFlagValue(args, '--selfplay-teacher-committee-weight-min')).toBe(String(teacher.teacherCommitteeWeightMin));
        expect(getFlagValue(args, '--selfplay-teacher-committee-weight-max')).toBe(String(teacher.teacherCommitteeWeightMax));
        expect(getFlagValue(args, '--selfplay-teacher-committee-consensus-bonus-min')).toBe(String(teacher.teacherCommitteeConsensusBonusMin));
        expect(getFlagValue(args, '--selfplay-teacher-committee-consensus-bonus-max')).toBe(String(teacher.teacherCommitteeConsensusBonusMax));
        expect(args).toContain('--selfplay-use-promoted-model-only');
        expect(args).not.toContain('--selfplay-use-candidate-every-iteration');
    });

    test('production_v3 resolves promotion_v3 gate and promoted-only guide mode', () => {
        const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'othello-training-profile-'));
        const runsDir = path.join(tempRoot, 'runs');
        const modelsDir = path.join(tempRoot, 'models');
        const resolved = resolveTrainingProfile('production_v3', {
            cwd: process.cwd(),
            runTag: 'test_prod_v3',
            runsDir,
            modelsDir
        });
        const args = resolved.command.args;

        expect(resolved.gate && resolved.gate.name).toBe('promotion_v3');
        expect(resolved.launcher && resolved.launcher.scriptPath).toMatch(/run-selfplay-training-cycle\.js$/);
    expect(args).toContain('--selfplay-use-promoted-model-only');
    expect(args).not.toContain('--selfplay-use-candidate-every-iteration');
        expect(args).toContain('--quality-gate');
        expect(getFlagValue(args, '--selfplay-jobs')).toBe('8');
        expect(getFlagValue(args, '--adoption-jobs')).toBe('8');
        expect(getFlagValue(args, '--onnx-gate-jobs')).toBe('8');
        expect(getFlagValue(args, '--quick-games')).toBe('120');
        expect(getFlagValue(args, '--quality-gate-games')).toBe('120');
        expect(getFlagValue(args, '--final-games')).toBe('480');
        expect(getFlagValue(args, '--quality-gate-threshold')).toBe('0.001');
        expect(getFlagValue(args, '--onnx-gate-threshold')).toBe('0.480');
    });

    test('browser_lv6_deploy_v1 resolves strict promoted-only deploy lane', () => {
        const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'othello-training-profile-'));
        const runsDir = path.join(tempRoot, 'runs');
        const modelsDir = path.join(tempRoot, 'models');
        const resolved = resolveTrainingProfile('browser_lv6_deploy_v1', {
            cwd: process.cwd(),
            runTag: 'test_browser_lv6_deploy_v1',
            runsDir,
            modelsDir
        });
        const args = resolved.command.args;

        expect(resolved.gate && resolved.gate.name).toBe('browser_lv6_deploy_v1');
        expect(args).toContain('--selfplay-use-promoted-model-only');
        expect(args).not.toContain('--selfplay-use-candidate-every-iteration');
        expect(args).toContain('--quality-gate');
        expect(args).not.toContain('--onnx-gate');
        expect(getFlagValue(args, '--adoption-jobs')).toBe('16');
        expect(getFlagValue(args, '--quick-games')).toBe('120');
        expect(getFlagValue(args, '--quality-gate-games')).toBe('120');
        expect(getFlagValue(args, '--final-games')).toBe('480');
        expect(getFlagValue(args, '--promotion-mode')).toBe('strict');
        expect(args).toContain('--onnx-resume-optimizer');
    });

    test('foundation_bootstrap_v1 resolves custom launcher and isolated paths', () => {
        const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'othello-training-profile-'));
        const runsDir = path.join(tempRoot, 'runs');
        const modelsDir = path.join(tempRoot, 'models');
        const resolved = resolveTrainingProfile('foundation_bootstrap_v1', {
            cwd: process.cwd(),
            runTag: 'test_foundation_v1',
            runsDir,
            modelsDir
        });
        const args = resolved.command.args;

        expect(resolved.gate).toBeNull();
        expect(resolved.launcher && resolved.launcher.scriptPath).toMatch(/run-foundation-bootstrap\.js$/);
        expect(getFlagValue(args, '--train-games')).toBe('12000');
        expect(getFlagValue(args, '--runs-dir')).toBe(runsDir);
        expect(getFlagValue(args, '--models-dir')).toBe(modelsDir);
    });

    test('missing named profile reports searched candidates', () => {
        expect(() => resolveNamedConfigPath('profile', 'definitely_missing_profile', process.cwd()))
            .toThrow('searched:');
    });
});
