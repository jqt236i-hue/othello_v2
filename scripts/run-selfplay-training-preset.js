#!/usr/bin/env node
'use strict';

const path = require('path');
const { spawnSync } = require('child_process');

function parseArgs(argv) {
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
        '',
        'Example:',
        '  node scripts/run-selfplay-training-preset.js -- --max-hours 8 --seed 1001'
    ].join('\n'));
}

function buildPresetArgs(profile) {
    if (profile !== 'cards_v1') {
        throw new Error(`unknown --profile: ${profile}`);
    }
    return [
        '--iterations', '999',
        '--max-hours', '24',
        '--train-games', '16000',
        '--eval-games', '3000',
        '--seed', '1',
        '--max-plies', '220',
        '--with-cards',
        '--card-usage-rate', '0.40',
        '--onnx-epochs', '9999',
        '--onnx-batch-size', '2048',
        '--onnx-lr', '0.0008',
        '--onnx-hidden-size', '256',
        '--onnx-device', 'auto',
        '--onnx-val-split', '0.12',
        '--onnx-early-stop-patience', '6',
        '--onnx-early-stop-min-delta', '0.0002',
        '--onnx-early-stop-monitor', 'val_loss',
        '--min-visits', '10',
        '--shape-immediate', '0.35',
        '--quick-games', '700',
        '--final-games', '3000',
        '--threshold', '0.05',
        '--adoption-seed-count', '3',
        '--adoption-seed-stride', '1000',
        '--adoption-final-seed-offset', '500000',
        '--adoption-min-seed-uplift', '-0.01',
        '--adoption-min-seed-pass-count', '2',
        '--onnx-gate',
        '--onnx-gate-games', '8',
        '--onnx-gate-seed-count', '3',
        '--onnx-gate-seed-stride', '1000',
        '--onnx-gate-seed-offset', '800000',
        '--onnx-gate-threshold', '0.52',
        '--onnx-gate-min-seed-score', '0.45',
        '--onnx-gate-min-seed-pass-count', '2'
    ];
}

function runTrainCycle(args) {
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

module.exports = {
    parseArgs,
    buildPresetArgs
};
