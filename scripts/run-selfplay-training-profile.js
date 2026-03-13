#!/usr/bin/env node
'use strict';

const {
    resolveTrainingProfile,
    writeResolvedConfig,
    runCommand
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
        skipPreflight: false,
        dryRun: false,
        passThrough: [],
        help: false
    };

    let passThroughMode = false;
    for (let i = 0; i < argv.length; i++) {
        const token = argv[i];
        if (passThroughMode) {
            args.passThrough.push(token);
            continue;
        }
        if (token === '--') { passThroughMode = true; continue; }
        if (token === '--help' || token === '-h') { args.help = true; continue; }
        if (token === '--profile') { args.profile = String(argv[++i] || '').trim() || 'production_v2'; continue; }
        if (token === '--gate-profile') { args.gateProfile = String(argv[++i] || '').trim() || null; continue; }
        if (token === '--run-tag') { args.runTag = String(argv[++i] || '').trim() || null; continue; }
        if (token === '--runs-dir') { args.runsDir = String(argv[++i] || '').trim() || null; continue; }
        if (token === '--models-dir') { args.modelsDir = String(argv[++i] || '').trim() || null; continue; }
        if (token === '--summary-out') { args.summaryOut = String(argv[++i] || '').trim() || null; continue; }
        if (token === '--resolved-config-out' || token === '--out') { args.resolvedConfigOut = String(argv[++i] || '').trim() || null; continue; }
        if (token === '--preflight-out') { args.preflightOut = String(argv[++i] || '').trim() || null; continue; }
        if (token === '--launcher-log') { args.launcherLogPath = String(argv[++i] || '').trim() || null; continue; }
        if (token === '--python') { args.pythonPath = String(argv[++i] || '').trim() || null; continue; }
        if (token === '--refresh-bootstrap') { args.refreshBootstrap = true; continue; }
        if (token === '--skip-preflight') { args.skipPreflight = true; continue; }
        if (token === '--dry-run') { args.dryRun = true; continue; }
        args.passThrough.push(token);
    }

    return args;
}

function printHelp() {
    console.log([
        'Usage:',
        '  node scripts/run-selfplay-training-profile.js [options] [-- extra-options-for-train-cycle]',
        '',
        'Options:',
        '      --profile <name|path>      Training profile name/path (default: production_v2)',
        '      --gate-profile <name|path> Override gate profile name/path',
        '      --run-tag <tag>            Fixed run tag',
        '      --runs-dir <path>          Override runs directory',
        '      --models-dir <path>        Override models directory',
        '      --summary-out <path>       Override training summary output path',
        '      --resolved-config-out <p>  Override resolved config output path',
        '      --preflight-out <path>     Override preflight report path',
        '      --launcher-log <path>      Override launcher log path hint',
        '      --python <path>            Override Python executable path',
        '      --refresh-bootstrap        Re-copy bootstrap models even if target exists',
        '      --skip-preflight           Skip preflight check',
        '      --dry-run                  Resolve profile, write config, run preflight only',
        '  -h, --help                     Show this help',
        '',
        'Example:',
        '  node scripts/run-selfplay-training-profile.js --profile production_v2 -- --max-hours 100'
    ].join('\n'));
}

function printResolvedBanner(resolved) {
    console.log(`[training-profile] profile=${resolved.profile.name}`);
    if (resolved.gate) {
        console.log(`[training-profile] gate=${resolved.gate.name}`);
    }
    console.log(`[training-profile] runTag=${resolved.paths.runTag}`);
    console.log(`[training-profile] runsDir=${resolved.paths.runsDir}`);
    console.log(`[training-profile] modelsDir=${resolved.paths.modelsDir}`);
    console.log(`[training-profile] config=${resolved.paths.resolvedConfigOut}`);
    console.log(`[training-profile] preflight=${resolved.paths.preflightOut}`);
    console.log(`[training-profile] summary=${resolved.paths.summaryOut}`);
  }

function runPreflight(resolved) {
    if (!resolved.preflightCommand) return;
    console.log(`[training-profile] preflight: ${resolved.preflightCommand.display}`);
    const result = runCommand(resolved.preflightCommand.executable, resolved.preflightCommand.args, {
        cwd: resolved.cwd,
        stdio: 'inherit'
    });
    if (result.status !== 0) {
        throw new Error(`preflight failed (exit=${result.status})`);
    }
}

function runTrainCycle(resolved) {
    console.log(`[training-profile] launch: ${resolved.command.display}`);
    const result = runCommand(resolved.command.executable, resolved.command.args, {
        cwd: resolved.cwd,
        stdio: 'inherit'
    });
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
        refreshBootstrap: args.refreshBootstrap,
        passThrough: args.passThrough
    });

    writeResolvedConfig(resolved, args.resolvedConfigOut || null);
    printResolvedBanner(resolved);

    if (!args.skipPreflight) {
        runPreflight(resolved);
    }

    if (args.dryRun) {
        console.log('[training-profile] dry-run complete');
        return;
    }

    runTrainCycle(resolved);
}

if (require.main === module) {
    try {
        main();
    } catch (err) {
        console.error('[training-profile] failed:', err && err.message ? err.message : err);
        process.exit(1);
    }
}

module.exports = {
    parseArgs
};
