declare const __non_webpack_require__: NodeRequire | undefined;

const _require: NodeRequire = (typeof __non_webpack_require__ !== 'undefined')
  ? __non_webpack_require__
  : require;

interface CommonArgs {
    profile: string;
    gateProfile: string | null;
    runTag: string | null;
    runsDir: string | null;
    modelsDir: string | null;
    summaryOut: string | null;
    resolvedConfigOut: string | null;
    preflightOut: string | null;
    launcherLogPath: string | null;
    pythonPath: string | null;
    refreshBootstrap: boolean;
    help: boolean;
    [key: string]: any;
}

interface LauncherOptions {
    mode?: 'run' | 'resolve';
}

function createCommonArgs(): CommonArgs {
    return {
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
        help: false
    };
}

function parseTrainingProfileLauncherArgs(argv: string[], options?: LauncherOptions): CommonArgs {
    const mode = options && options.mode === 'run' ? 'run' : 'resolve';
    const args = createCommonArgs();
    if (mode === 'run') {
        args.skipPreflight = false;
        args.dryRun = false;
        args.passThrough = [];
    } else {
        args.stdout = true;
    }

    let passThroughMode = false;
    for (let i = 0; i < argv.length; i++) {
        const token = argv[i];
        if (passThroughMode) {
            args.passThrough.push(token);
            continue;
        }
        if (mode === 'run' && token === '--') { passThroughMode = true; continue; }
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
        if (mode === 'run' && token === '--skip-preflight') { args.skipPreflight = true; continue; }
        if (mode === 'run' && token === '--dry-run') { args.dryRun = true; continue; }
        if (mode === 'resolve' && token === '--no-stdout') { args.stdout = false; continue; }
        if (mode === 'run') {
            args.passThrough.push(token);
            continue;
        }
        throw new Error(`unknown option: ${token}`);
    }

    return args;
}

function formatTrainingProfileLauncherHelp(options?: LauncherOptions): string {
    const mode = options && options.mode === 'run' ? 'run' : 'resolve';
    const usageLine = mode === 'run'
        ? '  node scripts/run-selfplay-training-profile.js [options] [-- extra-options-for-train-cycle]'
        : '  node scripts/resolve-training-profile.js [options]';
    const lines = [
        'Usage:',
        usageLine,
        '',
        'Options:',
        '      --profile <name|path>      Training profile name/path (default: production_v2)',
        '      --gate-profile <name|path> Override gate profile name/path',
        '      --run-tag <tag>            Fixed run tag',
        '      --runs-dir <path>          Override runs directory',
        '      --models-dir <path>        Override models directory',
        '      --summary-out <path>       Override training summary output path',
        mode === 'run'
            ? '      --resolved-config-out <p>  Override resolved config output path'
            : '      --out <path>               Override resolved config output path',
        '      --preflight-out <path>     Override preflight report path',
        '      --launcher-log <path>      Override launcher log path hint',
        '      --python <path>            Override Python executable path',
        '      --refresh-bootstrap        Re-copy bootstrap models even if target exists'
    ];
    if (mode === 'run') {
        lines.push('      --skip-preflight           Skip preflight check');
        lines.push('      --dry-run                  Resolve profile, write config, run preflight only');
    } else {
        lines.push('      --no-stdout                Do not print resolved JSON to stdout');
    }
    lines.push('  -h, --help                     Show this help');
    if (mode === 'run') {
        lines.push('');
        lines.push('Example:');
        lines.push('  node scripts/run-selfplay-training-profile.js --profile production_v2 -- --max-hours 100');
    }
    return lines.join('\n');
}

export = { 
    parseTrainingProfileLauncherArgs,
    formatTrainingProfileLauncherHelp
 } as any;
