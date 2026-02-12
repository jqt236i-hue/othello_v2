#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const Cleaner = require('./clean-selfplay-artifacts');

function makeDefaultOutputPath(runsDir) {
    const stamp = new Date().toISOString().replace(/[^\d]/g, '').slice(0, 14);
    return path.resolve(runsDir, `deepcfr.preflight.${stamp}.json`);
}

function parseArgs(argv) {
    const runsDir = path.resolve(process.cwd(), 'data', 'runs');
    const deepcfrDir = path.resolve(process.cwd(), 'data', 'deepcfr');
    const args = {
        pythonPath: path.resolve(process.cwd(), '.venv', 'Scripts', 'python.exe'),
        checkScriptPath: path.resolve(process.cwd(), 'ai', 'train', 'check_deepcfr_env.py'),
        runsDir,
        modelsDir: path.resolve(process.cwd(), 'data', 'models'),
        deepcfrDir,
        configPath: path.resolve(deepcfrDir, 'deepcfr_config.active.yaml'),
        out: makeDefaultOutputPath(runsDir),
        checkWindow: true,
        requireCleanData: true,
        strict: false,
        help: false
    };

    for (let i = 0; i < argv.length; i++) {
        const a = argv[i];
        if (a === '--help' || a === '-h') { args.help = true; continue; }
        if (a === '--python') { args.pythonPath = path.resolve(process.cwd(), argv[++i]); continue; }
        if (a === '--check-script') { args.checkScriptPath = path.resolve(process.cwd(), argv[++i]); continue; }
        if (a === '--runs-dir') { args.runsDir = path.resolve(process.cwd(), argv[++i]); continue; }
        if (a === '--models-dir') { args.modelsDir = path.resolve(process.cwd(), argv[++i]); continue; }
        if (a === '--deepcfr-dir') { args.deepcfrDir = path.resolve(process.cwd(), argv[++i]); continue; }
        if (a === '--config') { args.configPath = path.resolve(process.cwd(), argv[++i]); continue; }
        if (a === '--out') { args.out = path.resolve(process.cwd(), argv[++i]); continue; }
        if (a === '--check-window') { args.checkWindow = true; continue; }
        if (a === '--skip-check-window') { args.checkWindow = false; continue; }
        if (a === '--require-clean-data') { args.requireCleanData = true; continue; }
        if (a === '--allow-artifacts') { args.requireCleanData = false; continue; }
        if (a === '--strict') { args.strict = true; continue; }
    }

    return args;
}

function printHelp() {
    console.log([
        'Usage:',
        '  node scripts/preflight-deepcfr-training.js [options]',
        '',
        'Options:',
        '      --python <path>         Python executable path (default: .venv/Scripts/python.exe)',
        '      --check-script <path>   DeepCFR environment check script (default: ai/train/check_deepcfr_env.py)',
        '      --runs-dir <path>       Runs directory (default: data/runs)',
        '      --models-dir <path>     Models directory (default: data/models)',
        '      --deepcfr-dir <path>    DeepCFR work directory (default: data/deepcfr)',
        '      --config <path>         Active DeepCFR config path (default: data/deepcfr/deepcfr_config.active.yaml)',
        '      --out <path>            Output report JSON path',
        '      --check-window          Run check-window script (default: on)',
        '      --skip-check-window     Skip check-window script',
        '      --require-clean-data    Fail when old training artifacts exist (default: on)',
        '      --allow-artifacts       Do not fail when old artifacts exist',
        '      --strict                Treat warnings as failures',
        '  -h, --help                  Show this help'
    ].join('\n'));
}

function runCommand(cmd, args) {
    const result = spawnSync(cmd, args, {
        cwd: process.cwd(),
        env: process.env,
        encoding: 'utf8'
    });
    return {
        status: result.status,
        stdout: (result.stdout || '').trim(),
        stderr: (result.stderr || '').trim(),
        error: result.error ? String(result.error.message || result.error) : null
    };
}

function safeParseJson(text) {
    try {
        return JSON.parse(text);
    } catch (e) {
        return null;
    }
}

function ensureParentDir(filePath) {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

function isIgnorableArtifactForDeepcfr(filePath) {
    const name = path.basename(String(filePath || '')).toLowerCase();
    if (name.startsWith('deepcfr.foundation.') && name.endsWith('.json')) return true;
    if (name.startsWith('deepcfr.preflight.') && name.endsWith('.json')) return true;
    return false;
}

function main() {
    const args = parseArgs(process.argv.slice(2));
    if (args.help) {
        printHelp();
        return;
    }

    const startedAt = Date.now();
    const errors = [];
    const warnings = [];
    const checks = {};

    checks.node = { version: process.version };

    checks.python = {
        path: args.pythonPath,
        exists: fs.existsSync(args.pythonPath)
    };
    if (!checks.python.exists) {
        errors.push(`python executable not found: ${args.pythonPath}`);
    } else {
        const pyVersion = runCommand(args.pythonPath, ['--version']);
        checks.python.versionCheck = pyVersion;
        if (pyVersion.error || pyVersion.status !== 0) {
            errors.push(`python version check failed: ${pyVersion.error || pyVersion.stderr || `exit=${pyVersion.status}`}`);
        }
    }

    checks.deepcfr = {
        dir: args.deepcfrDir,
        dirExists: fs.existsSync(args.deepcfrDir),
        configPath: args.configPath,
        configExists: fs.existsSync(args.configPath),
        checkScriptPath: args.checkScriptPath,
        checkScriptExists: fs.existsSync(args.checkScriptPath)
    };
    if (!checks.deepcfr.dirExists) {
        warnings.push(`deepcfr directory was not initialized yet: ${args.deepcfrDir}`);
    }
    if (!checks.deepcfr.configExists) {
        warnings.push(`deepcfr active config is missing: ${args.configPath}`);
    }
    if (!checks.deepcfr.checkScriptExists) {
        errors.push(`deepcfr environment script not found: ${args.checkScriptPath}`);
    } else if (checks.python.exists) {
        const deepcfrCheck = runCommand(args.pythonPath, [args.checkScriptPath]);
        checks.deepcfr.command = deepcfrCheck;
        const payload = safeParseJson(deepcfrCheck.stdout);
        checks.deepcfr.payload = payload;
        if (deepcfrCheck.error || deepcfrCheck.status !== 0 || !payload) {
            errors.push(`deepcfr environment check failed: ${deepcfrCheck.error || deepcfrCheck.stderr || `exit=${deepcfrCheck.status}`}`);
        } else {
            if (payload.ok !== true) {
                errors.push('deepcfr environment payload is not ok');
            }
            const cudaAvailable = !!(payload.torch && payload.torch.cuda_available);
            if (!cudaAvailable) {
                warnings.push('CUDA is not available. Deep training will run slower on CPU.');
            }
            if (!payload.modules || !payload.modules.tensorboard || payload.modules.tensorboard.available !== true) {
                warnings.push('tensorboard module is not available. Realtime dashboards will be limited.');
            }
        }
    }

    const artifactTargets = Cleaner.collectTargets({
        runsDir: args.runsDir,
        modelsDir: args.modelsDir,
        keepDeployed: true
    }).filter((p) => !isIgnorableArtifactForDeepcfr(p));
    checks.artifacts = Cleaner.summarizeTargets(artifactTargets);
    checks.artifacts.requireCleanData = args.requireCleanData;
    if (artifactTargets.length > 0 && args.requireCleanData) {
        errors.push(`training artifacts are not clean: ${artifactTargets.length} files`);
    } else if (artifactTargets.length > 0) {
        warnings.push(`training artifacts exist: ${artifactTargets.length} files`);
    }

    if (args.checkWindow) {
        const windowCheck = runCommand(process.execPath, [path.resolve('scripts', 'check-window-usage.js')]);
        checks.window = windowCheck;
        if (windowCheck.error || windowCheck.status !== 0) {
            errors.push(`check-window failed: ${windowCheck.error || windowCheck.stderr || `exit=${windowCheck.status}`}`);
        }
    } else {
        checks.window = { skipped: true };
    }

    const status = (errors.length === 0 && (!args.strict || warnings.length === 0)) ? 'ok' : 'failed';
    const report = {
        generatedAt: new Date().toISOString(),
        elapsedMs: Date.now() - startedAt,
        status,
        strict: args.strict,
        errors,
        warnings,
        checks
    };

    ensureParentDir(args.out);
    fs.writeFileSync(args.out, JSON.stringify(report, null, 2), 'utf8');

    console.log(`[deepcfr-preflight] status=${status} errors=${errors.length} warnings=${warnings.length}`);
    console.log(`[deepcfr-preflight] report=${args.out}`);
    if (warnings.length > 0) {
        for (const w of warnings) console.warn(`[deepcfr-preflight] warning: ${w}`);
    }
    if (errors.length > 0) {
        for (const e of errors) console.error(`[deepcfr-preflight] error: ${e}`);
    }

    if (status !== 'ok') process.exit(1);
}

if (require.main === module) {
    try {
        main();
    } catch (err) {
        console.error('[deepcfr-preflight] failed:', err && err.message ? err.message : err);
        process.exit(1);
    }
}

module.exports = {
    parseArgs,
    runCommand,
    safeParseJson,
    makeDefaultOutputPath,
    isIgnorableArtifactForDeepcfr
};
