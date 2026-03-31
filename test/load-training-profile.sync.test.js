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

        expect(Number(getFlagValue(args, '--selfplay-policy-mix-rate'))).toBeCloseTo(Number(teacher.policyMixRate), 6);
        expect(getFlagValue(args, '--selfplay-policy-model-pool-size')).toBe(String(teacher.policyModelPoolSize));
        expect(getFlagValue(args, '--selfplay-policy-pool-sampling')).toBe(String(teacher.policyPoolSampling));
        expect(Number(getFlagValue(args, '--selfplay-policy-pool-recency-decay'))).toBeCloseTo(Number(teacher.policyPoolRecencyDecay), 6);
        expect(Number(getFlagValue(args, '--selfplay-policy-current-anchor-rate'))).toBeCloseTo(Number(teacher.policyCurrentAnchorRate), 6);
        expect(getFlagValue(args, '--selfplay-tactical-weight-min')).toBe(String(teacher.tacticalWeightMin));
        expect(getFlagValue(args, '--selfplay-tactical-weight-max')).toBe(String(teacher.tacticalWeightMax));
        expect(getFlagValue(args, '--selfplay-tactical-depth-opening')).toBe(String(teacher.tacticalDepthOpening));
        expect(getFlagValue(args, '--selfplay-tactical-depth-mid')).toBe(String(teacher.tacticalDepthMid));
        expect(getFlagValue(args, '--selfplay-tactical-depth-end')).toBe(String(teacher.tacticalDepthEnd));
        expect(getFlagValue(args, '--selfplay-tactical-beam-width')).toBe(String(teacher.tacticalBeamWidth));
        expect(getFlagValue(args, '--selfplay-policy-score-weight-min')).toBe(String(teacher.policyScoreWeightMin));
        expect(getFlagValue(args, '--selfplay-policy-score-weight-max')).toBe(String(teacher.policyScoreWeightMax));
        expect(getFlagValue(args, '--selfplay-heuristic-weight-min')).toBe(String(teacher.heuristicWeightMin));
        expect(Number(getFlagValue(args, '--selfplay-heuristic-weight-max'))).toBeCloseTo(Number(teacher.heuristicWeightMax), 6);
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
        expect(resolved.bootstrap.autoResumeLatestCheckpoint).toBe(true);
        expect(getFlagValue(args, '--selfplay-jobs')).toBe('8');
        expect(getFlagValue(args, '--adoption-jobs')).toBe('8');
        expect(getFlagValue(args, '--onnx-gate-jobs')).toBe('8');
        expect(getFlagValue(args, '--selfplay-policy-model-pool-size')).toBe('4');
        expect(getFlagValue(args, '--selfplay-policy-pool-sampling')).toBe('recency');
        expect(getFlagValue(args, '--selfplay-policy-pool-recency-decay')).toBe('2.0');
        expect(getFlagValue(args, '--selfplay-policy-current-anchor-rate')).toBe('0.35');
        expect(getFlagValue(args, '--quick-games')).toBe('120');
        expect(getFlagValue(args, '--quality-gate-games')).toBe('120');
        expect(getFlagValue(args, '--final-games')).toBe('480');
        expect(getFlagValue(args, '--quality-gate-seed-count')).toBe('5');
        expect(getFlagValue(args, '--quality-gate-threshold')).toBe('0.000');
        expect(getFlagValue(args, '--quality-gate-min-seed-pass-count')).toBe('3');
        expect(getFlagValue(args, '--quick-adoption-seed-count')).toBe('5');
        expect(getFlagValue(args, '--quick-adoption-min-seed-pass-count')).toBe('2');
        expect(getFlagValue(args, '--final-adoption-seed-count')).toBe('5');
        expect(getFlagValue(args, '--final-adoption-min-seed-pass-count')).toBe('3');
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

    test('browser_lv6_growth_v1 resolves isolated cumulative growth lane', () => {
        const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'othello-training-profile-'));
        const runsDir = path.join(tempRoot, 'runs');
        const modelsDir = path.join(tempRoot, 'models');
        const resolved = resolveTrainingProfile('browser_lv6_growth_v1', {
            cwd: process.cwd(),
            runTag: 'test_browser_lv6_growth_v1',
            runsDir,
            modelsDir
        });
        const args = resolved.command.args;

        expect(resolved.gate && resolved.gate.name).toBe('browser_lv6_growth_v1');
        expect(args).toContain('--selfplay-use-candidate-every-iteration');
        expect(args).not.toContain('--selfplay-use-promoted-model-only');
        expect(args).toContain('--carry-over-checkpoint');
        expect(args).not.toContain('--adoption-use-guide-baseline');
        expect(args).toContain('--adoption-use-anchor-baseline');
        expect(args).toContain('--no-quality-gate');
        expect(args).not.toContain('--quality-gate');
        expect(args).not.toContain('--no-promote');
        expect(getFlagValue(args, '--promotion-mode')).toBe('strict');
        expect(getFlagValue(args, '--selfplay-policy-model-pool-size')).toBe('4');
        expect(getFlagValue(args, '--selfplay-policy-pool-sampling')).toBe('recency');
        expect(Number(getFlagValue(args, '--selfplay-policy-current-anchor-rate'))).toBeCloseTo(0.35, 6);
        expect(getFlagValue(args, '--eval-games')).toBe('2000');
        expect(getFlagValue(args, '--selfplay-card-usage-rate-schedule')).toBe('0.30@1,0.40@3,0.50@6,0.60@10');
        expect(getFlagValue(args, '--selfplay-tactical-weight-min')).toBe('0.95');
        expect(getFlagValue(args, '--selfplay-tactical-weight-max')).toBe('1.25');
        expect(getFlagValue(args, '--selfplay-tactical-depth-opening')).toBe('4');
        expect(getFlagValue(args, '--selfplay-tactical-depth-mid')).toBe('6');
        expect(getFlagValue(args, '--selfplay-tactical-depth-end')).toBe('7');
        expect(getFlagValue(args, '--selfplay-tactical-beam-width')).toBe('4');
        expect(Number(getFlagValue(args, '--onnx-tactical-miss-sample-boost'))).toBeCloseTo(0.6, 6);
        expect(Number(getFlagValue(args, '--onnx-tactical-miss-threshold'))).toBeCloseTo(0.12, 6);
        expect(Number(getFlagValue(args, '--onnx-corner-balance-sample-boost'))).toBeCloseTo(0.18, 6);
        expect(Number(getFlagValue(args, '--onnx-edge-balance-sample-boost'))).toBeCloseTo(0.08, 6);
        expect(getFlagValue(args, '--quick-adoption-seed-offset')).toBe('200000');
        expect(getFlagValue(args, '--quick-adoption-seed-count')).toBe('3');
        expect(getFlagValue(args, '--quick-adoption-min-seed-pass-count')).toBe('1');
        expect(getFlagValue(args, '--final-adoption-seed-count')).toBe('3');
        expect(getFlagValue(args, '--final-adoption-min-seed-pass-count')).toBe('2');
        expect(getFlagValue(args, '--runs-dir')).toBe(runsDir);
        expect(getFlagValue(args, '--models-dir')).toBe(modelsDir);
        expect(resolved.bootstrap.autoResumeLatestCheckpoint).toBe(true);
    });

    test('browser_lv6_growth_quick_v1 resolves quick-only comparison lane', () => {
        const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'othello-training-profile-'));
        const runsDir = path.join(tempRoot, 'runs');
        const modelsDir = path.join(tempRoot, 'models');
        const resolved = resolveTrainingProfile('browser_lv6_growth_quick_v1', {
            cwd: process.cwd(),
            runTag: 'test_browser_lv6_growth_quick_v1',
            runsDir,
            modelsDir
        });
        const args = resolved.command.args;

        expect(resolved.gate && resolved.gate.name).toBe('browser_lv6_growth_quick_v1');
        expect(args).toContain('--selfplay-use-candidate-every-iteration');
        expect(args).toContain('--carry-over-checkpoint');
        expect(args).toContain('--adoption-use-guide-baseline');
        expect(args).toContain('--no-quality-gate');
        expect(args).not.toContain('--quality-gate');
        expect(getFlagValue(args, '--promotion-mode')).toBe('quick-only');
        expect(getFlagValue(args, '--eval-games')).toBe('2000');
        expect(getFlagValue(args, '--selfplay-tactical-weight-max')).toBe('1.25');
        expect(getFlagValue(args, '--selfplay-tactical-beam-width')).toBe('4');
        expect(getFlagValue(args, '--quick-adoption-seed-count')).toBe('3');
        expect(getFlagValue(args, '--quick-adoption-min-seed-pass-count')).toBe('1');
        expect(getFlagValue(args, '--final-adoption-seed-count')).toBe('3');
        expect(getFlagValue(args, '--final-adoption-min-seed-pass-count')).toBe('2');
        expect(getFlagValue(args, '--runs-dir')).toBe(runsDir);
        expect(getFlagValue(args, '--models-dir')).toBe(modelsDir);
        expect(resolved.bootstrap.autoResumeLatestCheckpoint).toBe(true);
    });

    test('browser_lv6_growth_final5_v1 resolves stricter final-seed comparison lane', () => {
        const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'othello-training-profile-'));
        const runsDir = path.join(tempRoot, 'runs');
        const modelsDir = path.join(tempRoot, 'models');
        const resolved = resolveTrainingProfile('browser_lv6_growth_final5_v1', {
            cwd: process.cwd(),
            runTag: 'test_browser_lv6_growth_final5_v1',
            runsDir,
            modelsDir
        });
        const args = resolved.command.args;

        expect(resolved.gate && resolved.gate.name).toBe('browser_lv6_growth_final5_v1');
        expect(args).toContain('--selfplay-use-candidate-every-iteration');
        expect(args).toContain('--carry-over-checkpoint');
        expect(args).toContain('--adoption-use-guide-baseline');
        expect(args).toContain('--no-quality-gate');
        expect(args).not.toContain('--quality-gate');
        expect(getFlagValue(args, '--promotion-mode')).toBe('strict');
        expect(getFlagValue(args, '--eval-games')).toBe('2000');
        expect(getFlagValue(args, '--selfplay-tactical-weight-max')).toBe('1.25');
        expect(getFlagValue(args, '--selfplay-tactical-beam-width')).toBe('4');
        expect(getFlagValue(args, '--quick-adoption-seed-count')).toBe('3');
        expect(getFlagValue(args, '--quick-adoption-min-seed-pass-count')).toBe('1');
        expect(getFlagValue(args, '--adoption-seed-count')).toBe('5');
        expect(getFlagValue(args, '--adoption-min-seed-pass-count')).toBe('3');
        expect(getFlagValue(args, '--final-adoption-seed-count')).toBe('5');
        expect(getFlagValue(args, '--final-adoption-min-seed-pass-count')).toBe('3');
        expect(getFlagValue(args, '--runs-dir')).toBe(runsDir);
        expect(getFlagValue(args, '--models-dir')).toBe(modelsDir);
        expect(resolved.bootstrap.autoResumeLatestCheckpoint).toBe(true);
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
        expect(args).toContain('--adoption-use-guide-baseline');
        expect(args).not.toContain('--adoption-use-anchor-baseline');
        expect(args).not.toContain('--no-promote');
        expect(resolved.bootstrap.autoResumeLatestCheckpoint).toBe(true);
        expect(getFlagValue(args, '--adoption-jobs')).toBe('16');
        expect(getFlagValue(args, '--quick-games')).toBe('120');
        expect(getFlagValue(args, '--quality-gate-games')).toBe('120');
        expect(getFlagValue(args, '--final-games')).toBe('240');
        expect(getFlagValue(args, '--quality-gate-seed-count')).toBe('5');
        expect(Number(getFlagValue(args, '--quality-gate-threshold'))).toBeCloseTo(0, 6);
        expect(getFlagValue(args, '--quality-gate-min-seed-pass-count')).toBe('3');
        expect(getFlagValue(args, '--quick-adoption-seed-count')).toBe('5');
        expect(getFlagValue(args, '--quick-adoption-min-seed-pass-count')).toBe('2');
        expect(getFlagValue(args, '--final-adoption-seed-count')).toBe('5');
        expect(getFlagValue(args, '--final-adoption-min-seed-pass-count')).toBe('3');
        expect(getFlagValue(args, '--selfplay-policy-model-pool-size')).toBe('4');
        expect(getFlagValue(args, '--selfplay-policy-pool-sampling')).toBe('recency');
        expect(getFlagValue(args, '--selfplay-policy-pool-recency-decay')).toBe('2.0');
        expect(getFlagValue(args, '--selfplay-policy-current-anchor-rate')).toBe('0.35');
        expect(getFlagValue(args, '--selfplay-tactical-weight-max')).toBe('1.25');
        expect(getFlagValue(args, '--onnx-early-stop-patience')).toBe('20');
        expect(getFlagValue(args, '--onnx-early-stop-min-delta')).toBe('0.00005');
        expect(getFlagValue(args, '--onnx-early-stop-smoothing-window')).toBe('5');
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

    test('browser_lv6_deploy_v1 keeps auto-resume checkpoint in promoted-only mode', () => {
        const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'othello-training-profile-'));
        const runsDir = path.join(tempRoot, 'runs');
        const modelsDir = path.join(tempRoot, 'models');
        const policyCheckpointPath = createFakeCheckpoint(modelsDir, 'policy-net.candidate.browser.restart.checkpoint.pt');
        const valueCheckpointPath = createFakeCheckpoint(modelsDir, 'policy-value.candidate.browser.restart.checkpoint.pt');
        const now = new Date();
        fs.utimesSync(policyCheckpointPath, new Date(now.getTime() - 5000), new Date(now.getTime() - 5000));
        fs.utimesSync(valueCheckpointPath, now, now);
        const resolved = resolveTrainingProfile('browser_lv6_deploy_v1', {
            cwd: process.cwd(),
            runTag: 'test_browser_lv6_no_auto_resume',
            runsDir,
            modelsDir
        });
        const args = resolved.command.args;

        expect(resolved.bootstrap.autoResumeLatestCheckpoint).toBe(true);
        expect(resolved.bootstrap.resumeCheckpointPath).toBe(policyCheckpointPath);
        expect(resolved.bootstrap.resumeCheckpointPaths).toMatchObject({
            policy: policyCheckpointPath,
            value: valueCheckpointPath
        });
        expect(getFlagValue(args, '--resume-policy-checkpoint')).toBe(policyCheckpointPath);
        expect(getFlagValue(args, '--resume-value-checkpoint')).toBe(valueCheckpointPath);
        expect(getFlagValue(args, '--resume-checkpoint')).toBeNull();
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
        const policyCheckpointPath = createFakeCheckpoint(modelsDir, 'policy-net.candidate.research.restart.checkpoint.pt');
        const cardCheckpointPath = createFakeCheckpoint(modelsDir, 'policy-card.candidate.research.restart.checkpoint.pt');
        const valueCheckpointPath = createFakeCheckpoint(modelsDir, 'policy-value.candidate.research.restart.checkpoint.pt');
        const now = new Date();
        fs.utimesSync(policyCheckpointPath, new Date(now.getTime() - 7000), new Date(now.getTime() - 7000));
        fs.utimesSync(cardCheckpointPath, new Date(now.getTime() - 3000), new Date(now.getTime() - 3000));
        fs.utimesSync(valueCheckpointPath, now, now);
        const resolved = resolveTrainingProfile('research_incremental_growth_v1', {
            cwd: process.cwd(),
            runTag: 'test_research_auto_resume',
            runsDir,
            modelsDir
        });
        const args = resolved.command.args;

        expect(resolved.bootstrap.autoResumeLatestCheckpoint).toBe(true);
        expect(resolved.bootstrap.resumeCheckpointPath).toBe(policyCheckpointPath);
        expect(resolved.bootstrap.resumeCheckpointPaths).toMatchObject({
            policy: policyCheckpointPath,
            card: cardCheckpointPath,
            value: valueCheckpointPath
        });
        expect(getFlagValue(args, '--resume-policy-checkpoint')).toBe(policyCheckpointPath);
        expect(getFlagValue(args, '--resume-card-checkpoint')).toBe(cardCheckpointPath);
        expect(getFlagValue(args, '--resume-value-checkpoint')).toBe(valueCheckpointPath);
    });

    test('browser_lv6_growth_v1 keeps auto-resume checkpoint in cumulative lane', () => {
        const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'othello-training-profile-'));
        const runsDir = path.join(tempRoot, 'runs');
        const modelsDir = path.join(tempRoot, 'models');
        const policyCheckpointPath = createFakeCheckpoint(modelsDir, 'policy-net.candidate.browser_lv6_growth.restart.checkpoint.pt');
        const targetCheckpointPath = createFakeCheckpoint(modelsDir, 'policy-target.candidate.browser_lv6_growth.restart.checkpoint.pt');
        const valueCheckpointPath = createFakeCheckpoint(modelsDir, 'policy-value.candidate.browser_lv6_growth.restart.checkpoint.pt');
        const now = new Date();
        fs.utimesSync(policyCheckpointPath, new Date(now.getTime() - 9000), new Date(now.getTime() - 9000));
        fs.utimesSync(targetCheckpointPath, new Date(now.getTime() - 4000), new Date(now.getTime() - 4000));
        fs.utimesSync(valueCheckpointPath, now, now);
        const resolved = resolveTrainingProfile('browser_lv6_growth_v1', {
            cwd: process.cwd(),
            runTag: 'test_browser_lv6_growth_auto_resume',
            runsDir,
            modelsDir
        });
        const args = resolved.command.args;

        expect(resolved.bootstrap.autoResumeLatestCheckpoint).toBe(true);
        expect(resolved.bootstrap.resumeCheckpointPath).toBe(policyCheckpointPath);
        expect(resolved.bootstrap.resumeCheckpointPaths).toMatchObject({
            policy: policyCheckpointPath,
            target: targetCheckpointPath,
            value: valueCheckpointPath
        });
        expect(getFlagValue(args, '--resume-policy-checkpoint')).toBe(policyCheckpointPath);
        expect(getFlagValue(args, '--resume-target-checkpoint')).toBe(targetCheckpointPath);
        expect(getFlagValue(args, '--resume-value-checkpoint')).toBe(valueCheckpointPath);
        expect(args).toContain('--carry-over-checkpoint');
        expect(args).toContain('--no-quality-gate');
        expect(args).not.toContain('--adoption-use-guide-baseline');
        expect(args).toContain('--adoption-use-anchor-baseline');
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
