#!/usr/bin/env node
'use strict';

const {
    resolveTrainingProfile,
    writeResolvedConfig
} = require('./load-training-profile');
const {
    parseTrainingProfileLauncherArgs,
    formatTrainingProfileLauncherHelp
} = require('./training-profile-launcher-args');

function parseArgs(argv) {
    return parseTrainingProfileLauncherArgs(argv, { mode: 'resolve' });
}

function printHelp() {
    console.log(formatTrainingProfileLauncherHelp({ mode: 'resolve' }));
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
