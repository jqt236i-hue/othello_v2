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

function createFakeCheckpoint(modelsDir, fileName) {
    fs.mkdirSync(modelsDir, { recursive: true });
    const checkpointPath = path.join(modelsDir, fileName || 'policy-value.fake.checkpoint.pt');
    fs.writeFileSync(checkpointPath, 'fake checkpoint', 'utf8');
    return checkpointPath;
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
        expect(getFlagValue(args, '--selfplay-tactical-weight-min')).toBe(String(teacher.tacticalWeightMin));
        expect(getFlagValue(args, '--selfplay-tactical-weight-max')).toBe(String(teacher.tacticalWeightMax));
        expect(getFlagValue(args, '--selfplay-tactical-depth-opening')).toBe(String(teacher.tacticalDepthOpening));
        expect(getFlagValue(args, '--selfplay-tactical-depth-mid')).toBe(String(teacher.tacticalDepthMid));
        expect(getFlagValue(args, '--selfplay-tactical-depth-end')).toBe(String(teacher.tacticalDepthEnd));
        expect(getFlagValue(args, '--selfplay-tactical-beam-width')).toBe(String(teacher.tacticalBeamWidth));
        expect(getFlagValue(args, '--selfplay-policy-score-weight-min')).toBe(String(teacher.policyScoreWeightMin));
        expect(getFlagValue(args, '--selfplay-policy-score-weight-max')).toBe(String(teacher.policyScoreWeightMax));
        expect(getFlagValue(args, '--selfplay-heuristic-weight-min')).toBe(String(teacher.heuristicWeightMin));
        expect(getFlagValue(args, '--selfplay-heuristic-weight-max')).toBe(String(teacher.heuristicWeightMax));
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
    expect(resolved.bootstrap.autoResumeLatestCheckpoint).toBe(false);
        expect(getFlagValue(args, '--selfplay-jobs')).toBe('8');
        expect(getFlagValue(args, '--adoption-jobs')).toBe('8');
        expect(getFlagValue(args, '--onnx-gate-jobs')).toBe('8');
        expect(getFlagValue(args, '--quick-games')).toBe('120');
        expect(getFlagValue(args, '--quality-gate-games')).toBe('120');
        expect(getFlagValue(args, '--final-games')).toBe('480');
        expect(getFlagValue(args, '--quality-gate-threshold')).toBe('0.001');
        expect(getFlagValue(args, '--onnx-gate-threshold')).toBe('0.480');
    });

    test('research_incremental_growth_v1 resolves research-only anchor/final gate lane', () => {
        const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'othello-training-profile-'));
        const runsDir = path.join(tempRoot, 'runs');
        const modelsDir = path.join(tempRoot, 'models');
        const resolved = resolveTrainingProfile('research_incremental_growth_v1', {
            cwd: process.cwd(),
            runTag: 'test_research_incremental_growth_v1',
            runsDir,
            modelsDir
        });
        const args = resolved.command.args;

        expect(resolved.gate && resolved.gate.name).toBe('research_incremental_growth_v1');
        expect(args).toContain('--selfplay-use-candidate-every-iteration');
        expect(args).not.toContain('--selfplay-use-promoted-model-only');
        expect(args).toContain('--adoption-use-anchor-baseline');
        expect(args).toContain('--gate-final-iteration-only');
        expect(args).toContain('--quality-gate');
        expect(args).toContain('--onnx-gate');
        expect(getFlagValue(args, '--promotion-mode')).toBe('strict');
        expect(getFlagValue(args, '--iterations')).toBe('20');
        expect(getFlagValue(args, '--train-games')).toBe('500');
        expect(getFlagValue(args, '--eval-games')).toBe('120');
        expect(resolved.bootstrap.autoResumeLatestCheckpoint).toBe(true);
        expect(getFlagValue(args, '--runs-dir')).toBe(runsDir);
        expect(getFlagValue(args, '--models-dir')).toBe(modelsDir);
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
        expect(resolved.bootstrap.autoResumeLatestCheckpoint).toBe(false);
        expect(getFlagValue(args, '--adoption-jobs')).toBe('16');
        expect(getFlagValue(args, '--quick-games')).toBe('120');
        expect(getFlagValue(args, '--quality-gate-games')).toBe('120');
        expect(getFlagValue(args, '--final-games')).toBe('240');
        expect(getFlagValue(args, '--promotion-mode')).toBe('strict');
        expect(args).toContain('--onnx-resume-optimizer');
    });

    test('adaptive_best_current_v1 resolves 10000-game repeated promotion loop', () => {
        const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'othello-training-profile-'));
        const runsDir = path.join(tempRoot, 'runs');
        const modelsDir = path.join(tempRoot, 'models');
        const resolved = resolveTrainingProfile('adaptive_best_current_v1', {
            cwd: process.cwd(),
            runTag: 'test_adaptive_best_current_v1',
            runsDir,
            modelsDir
        });
        const args = resolved.command.args;

        expect(resolved.gate && resolved.gate.name).toBe('adaptive_best_current_v1');
        expect(getFlagValue(args, '--iterations')).toBe('9999');
        expect(getFlagValue(args, '--max-hours')).toBe('100');
        expect(getFlagValue(args, '--train-games')).toBe('10000');
        expect(getFlagValue(args, '--promotion-mode')).toBe('quick-only');
        expect(args).toContain('--no-gate-final-iteration-only');
        expect(args).not.toContain('--gate-final-iteration-only');
    });

    test('browser_lv6_deploy_v1 ignores auto-resume checkpoint in promoted-only mode', () => {
        const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'othello-training-profile-'));
        const runsDir = path.join(tempRoot, 'runs');
        const modelsDir = path.join(tempRoot, 'models');
        createFakeCheckpoint(modelsDir, 'policy-value.candidate.browser.restart.checkpoint.pt');
        const resolved = resolveTrainingProfile('browser_lv6_deploy_v1', {
            cwd: process.cwd(),
            runTag: 'test_browser_lv6_no_auto_resume',
            runsDir,
            modelsDir
        });
        const args = resolved.command.args;

        expect(resolved.bootstrap.autoResumeLatestCheckpoint).toBe(false);
        expect(resolved.bootstrap.resumeCheckpointPath).toBeNull();
        expect(args).not.toContain('--resume-checkpoint');
    });

    test('adaptive_best_current_v1 refreshes bootstrap policy copy on restart when source exists', () => {
        const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'othello-training-profile-'));
        const runsDir = path.join(tempRoot, 'runs');
        const modelsDir = path.join(tempRoot, 'models');
        fs.mkdirSync(modelsDir, { recursive: true });
        const staleBootstrapPath = path.join(modelsDir, 'policy-table.json');
        const sourcePolicyTablePath = path.join(
            process.cwd(),
            'data',
            'models',
            'research_incremental_growth_v1',
            'policy-table.candidate.research_incremental_growth_v1_20260317_012456.it11.json'
        );
        fs.writeFileSync(staleBootstrapPath, 'stale bootstrap\n', 'utf8');

        const resolved = resolveTrainingProfile('adaptive_best_current_v1', {
            cwd: process.cwd(),
            runTag: 'test_adaptive_refresh_bootstrap',
            runsDir,
            modelsDir
        });
        const policyTableAction = resolved.bootstrap.actions.find((one) => one && one.label === 'policy-table');

        expect(fs.existsSync(sourcePolicyTablePath)).toBe(true);
        expect(policyTableAction && policyTableAction.status).toBe('copied');
        expect(fs.readFileSync(staleBootstrapPath, 'utf8')).toBe(fs.readFileSync(sourcePolicyTablePath, 'utf8'));
    });

    test('research_incremental_growth_v1 keeps auto-resume checkpoint in candidate lane', () => {
        const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'othello-training-profile-'));
        const runsDir = path.join(tempRoot, 'runs');
        const modelsDir = path.join(tempRoot, 'models');
        const checkpointPath = createFakeCheckpoint(modelsDir, 'policy-value.candidate.research.restart.checkpoint.pt');
        const resolved = resolveTrainingProfile('research_incremental_growth_v1', {
            cwd: process.cwd(),
            runTag: 'test_research_auto_resume',
            runsDir,
            modelsDir
        });
        const args = resolved.command.args;

        expect(resolved.bootstrap.autoResumeLatestCheckpoint).toBe(true);
        expect(resolved.bootstrap.resumeCheckpointPath).toBe(checkpointPath);
        expect(getFlagValue(args, '--resume-checkpoint')).toBe(checkpointPath);
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
