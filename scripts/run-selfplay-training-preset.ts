#!/usr/bin/env node
// @ts-nocheck
'use strict';

import * as path from 'path';
import { spawnSync } from 'child_process';
import * as cpuLv6SharedProfile from '../constants/cpu-lv6-shared-profile';

declare const __non_webpack_require__: NodeRequire | undefined;

const _require: NodeRequire = (typeof __non_webpack_require__ !== 'undefined')
  ? __non_webpack_require__
  : require;

function parseArgs(argv: string[]) {
    const args = {
        profile: 'cards_v1',
        passThrough: [],
        help: false
    };

    for (let i = 0; i < argv.length; i++) {
        const a = argv[i];
        if (a === '--help' || a === '-h') { args.help = true; continue; }
        if (a === '--profile') {
            args.profile = String(argv[++i] || '').trim() || 'cards_v1';
            continue;
        }
        args.passThrough.push(a);
    }

    return args;
}

function printHelp() {
    console.log([
        'Usage:',
        '  node scripts/run-selfplay-training-preset.js [options] [-- extra-options-for-train-cycle]',
        '',
        'Options:',
        '      --profile <name>   Preset profile name (default: cards_v1)',
        '  -h, --help             Show this help',
        '',
        'Available profiles:',
        '  cards_v1: card-focused training preset for post-spec-change retraining',
        '  cards_v1_egaroucid: cards_v1 + stronger card-risk weighting for Egaroucid bootstrap',
        '  cards_v2_rootfix: root-cause-focused retraining preset (more self-play, stable resume, stricter eval)',
        '',
        'Example:',
        '  node scripts/run-selfplay-training-preset.js -- --max-hours 8 --seed 1001'
    ].join('\n'));
}

function buildPresetArgs(profile: string) {
    const teacherProfile = cpuLv6SharedProfile && cpuLv6SharedProfile.teacher ? cpuLv6SharedProfile.teacher : {};
    if (profile === 'cards_v1') {
        return [
            '--iterations', '999',
            '--max-hours', '100',
            '--train-games', '16000',
            '--eval-games', '3000',
            '--seed', '1',
            '--max-plies', '220',
            '--with-cards',
            '--card-usage-rate', '0.55',
            '--selfplay-policy-mix-rate', '0.65',
            '--selfplay-card-usage-rate-jitter', '0.15',
            '--selfplay-tactical-weight-min', '0.80',
            '--selfplay-tactical-weight-max', '1.40',
            '--selfplay-tactical-depth-opening', '4',
            '--selfplay-tactical-depth-mid', '6',
            '--selfplay-tactical-depth-end', '8',
            '--selfplay-tactical-beam-width', '12',
            '--selfplay-teacher-committee-weight-min', '32',
            '--selfplay-teacher-committee-weight-max', '48',
            '--selfplay-teacher-committee-consensus-bonus-min', '360',
            '--selfplay-teacher-committee-consensus-bonus-max', '620',
            '--selfplay-use-promoted-model-only',
            '--onnx-epochs', '9999',
            '--onnx-batch-size', '2048',
            '--onnx-lr', '0.0008',
            '--onnx-hidden-size', '256',
            '--onnx-device', 'auto',
            '--onnx-val-split', '0.12',
            '--onnx-early-stop-patience', '12',
            '--onnx-early-stop-min-delta', '0.00015',
            '--onnx-early-stop-min-epochs', '20',
            '--onnx-early-stop-monitor', 'val_loss',
            '--onnx-early-stop-smoothing-window', '3',
            '--onnx-card-no-action-weight', '0.75',
            '--onnx-card-class-balance-power', '0.35',
            '--onnx-winner-sample-boost', '0.45',
            '--onnx-loser-sample-weight', '0.85',
            '--onnx-draw-sample-weight', '1.0',
            '--onnx-corner-emergency-sample-boost', '0.30',
            '--onnx-negative-future-disc-sample-boost', '0.20',
            '--onnx-negative-future-disc-threshold', '-2.0',
            '--onnx-tactical-miss-sample-boost', '0.25',
            '--onnx-tactical-miss-threshold', '0.08',
            '--min-visits', '10',
            '--shape-immediate', '0.45',
            '--quick-games', '700',
            '--final-games', '3000',
            '--threshold', '0.02',
            '--adoption-seed-count', '3',
            '--adoption-seed-stride', '1000',
            '--adoption-final-seed-offset', '500000',
            '--adoption-confidence-level', '0.95',
            '--adoption-min-lower-bound', '0.00',
            '--adoption-min-seed-uplift', '-0.03',
            '--adoption-min-seed-pass-count', '1',
            '--quick-adoption-threshold', '0.005',
            '--quick-adoption-confidence-level', '0.90',
            '--quick-adoption-min-lower-bound', '-0.01',
            '--quick-adoption-min-seed-uplift', '-0.08',
            '--quick-adoption-min-seed-pass-count', '0',
            '--final-adoption-threshold', '0.02',
            '--final-adoption-confidence-level', '0.95',
            '--final-adoption-min-lower-bound', '0.00',
            '--final-adoption-min-seed-uplift', '-0.03',
            '--final-adoption-min-seed-pass-count', '1',
            '--adoption-policy-score-weight', '1.40',
            '--adoption-heuristic-weight', '1.00',
            '--adoption-white-priority', '0.90',
            '--onnx-gate',
            '--onnx-gate-games', '40',
            '--onnx-gate-seed-count', '5',
            '--onnx-gate-seed-stride', '1000',
            '--onnx-gate-seed-offset', '800000',
            '--onnx-gate-threshold', '0.50',
            '--onnx-gate-min-seed-score', '0.40',
            '--onnx-gate-min-seed-pass-count', '3',
            '--onnx-gate-candidate-color-mode', 'white',
            '--promotion-mode', 'onnx-primary',
            '--onnx-primary-require-quick-regression',
            '--onnx-primary-max-quick-regression', '0.00'
        ];
    }

    if (profile === 'cards_v1_egaroucid') {
        return [
            '--iterations', '999',
            '--max-hours', '100',
            '--train-games', '16000',
            '--eval-games', '3000',
            '--seed', '1',
            '--max-plies', '220',
            '--with-cards',
            '--card-usage-rate', '0.55',
            '--selfplay-policy-mix-rate', '0.70',
            '--selfplay-policy-model-pool-size', '6',
            '--selfplay-policy-pool-sampling', 'recency',
            '--selfplay-policy-pool-recency-decay', '2.0',
            '--selfplay-policy-current-anchor-rate', '0.40',
            '--selfplay-card-usage-rate-jitter', '0.15',
            '--selfplay-tactical-weight-min', '0.90',
            '--selfplay-tactical-weight-max', '1.55',
            '--selfplay-tactical-depth-opening', '4',
            '--selfplay-tactical-depth-mid', '6',
            '--selfplay-tactical-depth-end', '8',
            '--selfplay-tactical-beam-width', '12',
            '--selfplay-teacher-committee-weight-min', '36',
            '--selfplay-teacher-committee-weight-max', '56',
            '--selfplay-teacher-committee-consensus-bonus-min', '420',
            '--selfplay-teacher-committee-consensus-bonus-max', '760',
            '--selfplay-use-candidate-every-iteration',
            '--onnx-epochs', '9999',
            '--onnx-batch-size', '2048',
            '--onnx-lr', '0.0008',
            '--onnx-hidden-size', '256',
            '--onnx-device', 'auto',
            '--onnx-val-split', '0.12',
            '--onnx-early-stop-patience', '16',
            '--onnx-early-stop-min-delta', '0.00015',
            '--onnx-early-stop-min-epochs', '100',
            '--onnx-early-stop-monitor', 'val_loss',
            '--onnx-early-stop-smoothing-window', '5',
            '--onnx-card-no-action-weight', '0.70',
            '--onnx-card-class-balance-power', '0.40',
            '--onnx-winner-sample-boost', '0.40',
            '--onnx-loser-sample-weight', '0.90',
            '--onnx-draw-sample-weight', '1.0',
            '--onnx-corner-emergency-sample-boost', '0.60',
            '--onnx-negative-future-disc-sample-boost', '0.55',
            '--onnx-negative-future-disc-threshold', '-1.0',
            '--onnx-tactical-miss-sample-boost', '0.45',
            '--onnx-tactical-miss-threshold', '0.07',
            '--min-visits', '2',
            '--shape-immediate', '0.45',
            '--quick-games', '700',
            '--final-games', '3000',
            '--threshold', '0.005',
            '--adoption-seed-count', '3',
            '--adoption-seed-stride', '1000',
            '--adoption-final-seed-offset', '500000',
            '--adoption-confidence-level', '0.95',
            '--adoption-min-lower-bound', '-0.005',
            '--adoption-min-seed-uplift', '-0.02',
            '--adoption-min-seed-pass-count', '1',
            '--quick-adoption-threshold', '0.002',
            '--quick-adoption-confidence-level', '0.90',
            '--quick-adoption-min-lower-bound', '-0.015',
            '--quick-adoption-min-seed-uplift', '-0.10',
            '--quick-adoption-min-seed-pass-count', '0',
            '--final-adoption-threshold', '0.005',
            '--final-adoption-confidence-level', '0.95',
            '--final-adoption-min-lower-bound', '-0.005',
            '--final-adoption-min-seed-uplift', '-0.02',
            '--final-adoption-min-seed-pass-count', '1',
            '--adoption-policy-score-weight', '1.35',
            '--adoption-heuristic-weight', '1.00',
            '--adoption-white-priority', '0.50',
            '--adoption-quality-weight-card-immediate', '0.04',
            '--adoption-quality-weight-card-future', '0.07',
            '--adoption-quality-weight-place-delta', '0.02',
            '--adoption-use-guide-baseline',
            '--no-carry-over-checkpoint',
            '--onnx-gate',
            '--onnx-gate-games', '40',
            '--onnx-gate-seed-count', '5',
            '--onnx-gate-seed-stride', '1000',
            '--onnx-gate-seed-offset', '800000',
            '--onnx-gate-threshold', '0.48',
            '--onnx-gate-min-seed-score', '0.39',
            '--onnx-gate-min-seed-pass-count', '2',
            '--onnx-gate-candidate-color-mode', 'white',
            '--promotion-mode', 'onnx-primary',
            '--no-onnx-primary-require-quick-regression',
            '--onnx-primary-max-quick-regression', '0.08',
            '--onnx-primary-require-quick-non-regression',
            '--onnx-primary-min-quick-core-delta', '0.00',
            '--onnx-primary-min-quick-white-delta', '0.00',
            '--onnx-primary-min-quick-quality-delta', '-0.01'
        ];
    }

    if (profile === 'cards_v2_rootfix') {
        return [
            '--iterations', '999',
            '--max-hours', '100',
            '--train-games', '16000',
            '--eval-games', '3000',
            '--selfplay-jobs', '6',
            '--adoption-jobs', '6',
            '--onnx-gate-jobs', '6',
            '--seed', '1',
            '--max-plies', '220',
            '--with-cards',
            '--card-usage-rate', '0.55',
            '--selfplay-policy-mix-rate', String(Number(teacherProfile.policyMixRate) || 1.0),
            '--selfplay-policy-model-pool-size', String(Math.max(1, Math.floor(Number(teacherProfile.policyModelPoolSize) || 1))),
            '--selfplay-policy-pool-sampling', String(teacherProfile.policyPoolSampling || 'uniform'),
            '--selfplay-policy-pool-recency-decay', String(Number(teacherProfile.policyPoolRecencyDecay) || 1.0),
            '--selfplay-policy-current-anchor-rate', String(Number(teacherProfile.policyCurrentAnchorRate) || 1.0),
            '--selfplay-tactical-depth-opening', String(Math.max(0, Math.floor(Number(teacherProfile.tacticalDepthOpening) || 4))),
            '--selfplay-tactical-depth-mid', String(Math.max(0, Math.floor(Number(teacherProfile.tacticalDepthMid) || 6))),
            '--selfplay-tactical-depth-end', String(Math.max(0, Math.floor(Number(teacherProfile.tacticalDepthEnd) || 8))),
            '--selfplay-tactical-beam-width', String(Math.max(0, Math.floor(Number(teacherProfile.tacticalBeamWidth) || 8))),
            ...(teacherProfile.usePromotedModelOnly === false ? [] : ['--selfplay-use-promoted-model-only']),
            '--bootstrap-policy-model', 'data/models/policy-table.json',
            '--onnx-epochs', '9999',
            '--onnx-batch-size', '2048',
            '--onnx-lr', '0.00065',
            '--onnx-hidden-size', '384',
            '--onnx-device', 'auto',
            '--onnx-val-split', '0.15',
            '--onnx-early-stop-patience', '20',
            '--onnx-early-stop-min-delta', '0.00005',
            '--onnx-early-stop-min-epochs', '120',
            '--onnx-early-stop-monitor', 'val_loss',
            '--onnx-early-stop-smoothing-window', '5',
            '--onnx-card-no-action-weight', '0.68',
            '--onnx-card-class-balance-power', '0.45',
            '--onnx-winner-sample-boost', '0.38',
            '--onnx-loser-sample-weight', '0.95',
            '--onnx-draw-sample-weight', '1.0',
            '--onnx-corner-emergency-sample-boost', '0.70',
            '--onnx-negative-future-disc-sample-boost', '0.60',
            '--onnx-negative-future-disc-threshold', '-1.0',
            '--onnx-tactical-miss-sample-boost', '0.55',
            '--onnx-tactical-miss-threshold', '0.06',
            '--min-visits', '4',
            '--shape-immediate', '0.45',
            '--quick-games', '800',
            '--final-games', '3000',
            '--threshold', '0.005',
            '--adoption-seed-count', '5',
            '--adoption-seed-stride', '1000',
            '--adoption-final-seed-offset', '500000',
            '--adoption-confidence-level', '0.95',
            '--adoption-min-lower-bound', '0.000',
            '--adoption-min-seed-uplift', '-0.03',
            '--adoption-min-seed-pass-count', '1',
            '--quick-adoption-threshold', '0.000',
            '--quick-adoption-seed-count', '3',
            '--quick-adoption-seed-stride', '1000',
            '--quick-adoption-confidence-level', '0.90',
            '--quick-adoption-min-lower-bound', '-0.025',
            '--quick-adoption-min-seed-uplift', '-0.08',
            '--quick-adoption-min-seed-pass-count', '0',
            '--final-adoption-threshold', '0.003',
            '--final-adoption-seed-count', '7',
            '--final-adoption-seed-stride', '1000',
            '--final-adoption-confidence-level', '0.95',
            '--final-adoption-min-lower-bound', '0.000',
            '--final-adoption-min-seed-uplift', '-0.03',
            '--final-adoption-min-seed-pass-count', '1',
            '--adoption-policy-score-weight', '1.35',
            '--adoption-heuristic-weight', '1.00',
            '--adoption-white-priority', '0.70',
            '--adoption-quality-weight-corner', '0.06',
            '--adoption-quality-weight-edge', '0.04',
            '--adoption-quality-weight-corner-recovery', '0.05',
            '--adoption-quality-weight-corner-recapture', '0.04',
            '--adoption-quality-weight-edge-recovery', '0.03',
            '--adoption-quality-weight-corner-hold', '0.05',
            '--adoption-quality-weight-corner-hold-turns', '0.03',
            '--adoption-quality-weight-edge-hold', '0.03',
            '--adoption-quality-weight-final-corner-share', '0.07',
            '--adoption-quality-weight-final-edge-share', '0.03',
            '--adoption-quality-weight-bonus', '0.003',
            '--adoption-quality-weight-card-immediate', '0.015',
            '--adoption-quality-weight-card-future', '0.02',
            '--adoption-quality-weight-place-delta', '0.01',
            '--adoption-use-guide-baseline',
            '--carry-over-checkpoint',
            '--onnx-gate',
            '--onnx-gate-games', '48',
            '--onnx-gate-seed-count', '7',
            '--onnx-gate-seed-stride', '1000',
            '--onnx-gate-seed-offset', '800000',
            '--onnx-gate-threshold', '0.485',
            '--onnx-gate-min-seed-score', '0.40',
            '--onnx-gate-min-seed-pass-count', '3',
            '--onnx-gate-candidate-color-mode', 'white',
            '--promotion-mode', 'onnx-primary',
            '--onnx-primary-require-quick-regression',
            '--onnx-primary-max-quick-regression', '0.03',
            '--onnx-primary-require-quick-non-regression',
            '--onnx-primary-min-quick-core-delta', '-0.01',
            '--onnx-primary-min-quick-white-delta', '-0.01',
            '--onnx-primary-min-quick-quality-delta', '-0.005',
            '--onnx-primary-min-quick-uplift', '0.000',
            '--onnx-primary-min-quick-lower-bound', '-0.020',
            '--onnx-primary-min-onnx-gate-avg', '0.485',
            '--onnx-primary-min-onnx-gate-min-seed', '0.40'
        ];
    }

    throw new Error(`unknown --profile: ${profile}`);
}

function runTrainCycle(args: any) {
    const scriptPath = path.resolve('scripts', 'run-selfplay-training-cycle.js');
    const presetArgs = buildPresetArgs(args.profile);
    const commandArgs = [scriptPath].concat(presetArgs, args.passThrough);
    const shown = [process.execPath].concat(commandArgs).join(' ');
    console.log(`[selfplay-preset] run: ${shown}`);
    const result = spawnSync(process.execPath, commandArgs, {
        cwd: process.cwd(),
        env: process.env,
        stdio: 'inherit'
    });
    if (result.error) throw result.error;
    if (result.status !== 0) {
        throw new Error(`train-cycle failed (exit=${result.status})`);
    }
}

function main() {
    const args = parseArgs(process.argv.slice(2));
    if (args.help) {
        printHelp();
        return;
    }
    runTrainCycle(args);
}

if (require.main === module) {
    try {
        main();
    } catch (err) {
        console.error('[selfplay-preset] failed:', err && err.message ? err.message : err);
        process.exit(1);
    }
}

export = {
    parseArgs,
    buildPresetArgs
};
