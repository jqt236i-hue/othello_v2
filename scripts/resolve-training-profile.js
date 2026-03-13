#!/usr/bin/env node
'use strict';

const {
    resolveTrainingProfile,
    writeResolvedConfig
} = require('./load-training-profile');

function parseArgs(argv) {
    const args = {
        profile: 'production_v2',
        gateProfile: null,
        runTag: null,
        runsDir: null,
        modelsDir: null,
        summaryOut: null,
        resolvedConfigOut: null,
        preflightOut: null,
        launcherLogPath: null,
        pythonPath: null,
        refreshBootstrap: false,
        stdout: true,
        help: false
    };

    for (let i = 0; i < argv.length; i++) {
        const token = argv[i];
        if (token === '--help' || token === '-h') { args.help = true; continue; }
        if (token === '--profile') { args.profile = String(argv[++i] || '').trim() || 'production_v2'; continue; }
        if (token === '--gate-profile') { args.gateProfile = String(argv[++i] || '').trim() || null; continue; }
        if (token === '--run-tag') { args.runTag = String(argv[++i] || '').trim() || null; continue; }
        if (token === '--runs-dir') { args.runsDir = String(argv[++i] || '').trim() || null; continue; }
        if (token === '--models-dir') { args.modelsDir = String(argv[++i] || '').trim() || null; continue; }
        if (token === '--summary-out') { args.summaryOut = String(argv[++i] || '').trim() || null; continue; }
        if (token === '--out' || token === '--resolved-config-out') { args.resolvedConfigOut = String(argv[++i] || '').trim() || null; continue; }
        if (token === '--preflight-out') { args.preflightOut = String(argv[++i] || '').trim() || null; continue; }
        if (token === '--launcher-log') { args.launcherLogPath = String(argv[++i] || '').trim() || null; continue; }
        if (token === '--python') { args.pythonPath = String(argv[++i] || '').trim() || null; continue; }
        if (token === '--refresh-bootstrap') { args.refreshBootstrap = true; continue; }
        if (token === '--no-stdout') { args.stdout = false; continue; }
        throw new Error(`unknown option: ${token}`);
    }

    return args;
}

function printHelp() {
    console.log([
        'Usage:',
        '  node scripts/resolve-training-profile.js [options]',
        '',
        'Options:',
        '      --profile <name|path>      Training profile name/path (default: production_v2)',
        '      --gate-profile <name|path> Override gate profile name/path',
        '      --run-tag <tag>            Fixed run tag',
        '      --runs-dir <path>          Override runs directory',
        '      --models-dir <path>        Override models directory',
        '      --summary-out <path>       Override training summary output path',
        '      --out <path>               Override resolved config output path',
        '      --preflight-out <path>     Override preflight report path',
        '      --launcher-log <path>      Override launcher log path hint',
        '      --python <path>            Override Python executable path',
        '      --refresh-bootstrap        Re-copy bootstrap models even if target exists',
        '      --no-stdout                Do not print resolved JSON to stdout',
        '  -h, --help                     Show this help'
    ].join('\n'));
}

function main() {
    const args = parseArgs(process.argv.slice(2));
    if (args.help) {
        printHelp();
        return;
    }

    const resolved = resolveTrainingProfile(args.profile, {
        gateProfile: args.gateProfile,
        runTag: args.runTag,
        runsDir: args.runsDir,
        modelsDir: args.modelsDir,
        summaryOut: args.summaryOut,
        resolvedConfigOut: args.resolvedConfigOut,
        preflightOut: args.preflightOut,
        launcherLogPath: args.launcherLogPath,
        pythonPath: args.pythonPath,
        refreshBootstrap: args.refreshBootstrap
    });

    writeResolvedConfig(resolved, args.resolvedConfigOut || null);
    if (args.stdout) {
        process.stdout.write(JSON.stringify(resolved, null, 2));
        process.stdout.write('\n');
    }
}

if (require.main === module) {
    try {
        main();
    } catch (err) {
        console.error('[resolve-training-profile] failed:', err && err.message ? err.message : err);
        process.exit(1);
    }
}

module.exports = {
    parseArgs
};
