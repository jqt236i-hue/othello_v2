import loadTrainingProfile = require('./load-training-profile');
const { resolveTrainingProfile, writeResolvedConfig } = loadTrainingProfile;
import trainingArgsModule = require('./training-profile-launcher-args');
const { parseTrainingProfileLauncherArgs, formatTrainingProfileLauncherHelp } = trainingArgsModule;

declare const __non_webpack_require__: NodeRequire | undefined;

const _require: NodeRequire = (typeof __non_webpack_require__ !== 'undefined')
  ? __non_webpack_require__
  : require;

function parseArgs(argv: string[]): any {
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
    } catch (err: any) {
        console.error('[resolve-training-profile] failed:', err && err.message ? err.message : err);
        process.exit(1);
    }
}

export = { 
    parseArgs
 } as any;
