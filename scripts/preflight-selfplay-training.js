#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const Cleaner = require('./clean-selfplay-artifacts');

function makeDefaultOutputPath(runsDir) {
    const stamp = new Date().toISOString().replace(/[^\d]/g, '').slice(0, 14);
    return path.resolve(runsDir, `preflight.${stamp}.json`);
}

function parseArgs(argv) {
    const runsDir = path.resolve(process.cwd(), 'data', 'runs');
    const args = {
        pythonPath: path.resolve(process.cwd(), '.venv', 'Scripts', 'python.exe'),
        checkTorchScriptPath: path.resolve(process.cwd(), 'ai', 'train', 'check_torch_env.py'),
        runsDir,
        modelsDir: path.resolve(process.cwd(), 'data', 'models'),
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
        if (a === '--check-torch-script') { args.checkTorchScriptPath = path.resolve(process.cwd(), argv[++i]); continue; }
        if (a === '--runs-dir') { args.runsDir = path.resolve(process.cwd(), argv[++i]); continue; }
        if (a === '--models-dir') { args.modelsDir = path.resolve(process.cwd(), argv[++i]); continue; }
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
        '  node scripts/preflight-selfplay-training.js [options]',
        '',
        'Options:',
        '      --python <path>            Python executable path (default: .venv/Scripts/python.exe)',
        '      --check-torch-script <p>   Torch diagnostic script path (default: ai/train/check_torch_env.py)',
        '      --runs-dir <path>          Runs directory (default: data/runs)',
        '      --models-dir <path>        Models directory (default: data/models)',
        '      --out <path>               Output report JSON path',
        '      --check-window             Run check-window script (default: on)',
        '      --skip-check-window        Skip check-window script',
        '      --require-clean-data       Fail when training artifacts exist (default: on)',
        '      --allow-artifacts          Do not fail when artifacts exist',
        '      --strict                   Treat warnings as failures',
        '  -h, --help                     Show this help'
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
    const parent = path.dirname(filePath);
    fs.mkdirSync(parent, { recursive: true });
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

    checks.node = {
        version: process.version
    };

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

    checks.torch = {
        scriptPath: args.checkTorchScriptPath,
        scriptExists: fs.existsSync(args.checkTorchScriptPath)
    };
    if (!checks.torch.scriptExists) {
        errors.push(`torch diagnostic script not found: ${args.checkTorchScriptPath}`);
    } else if (checks.python.exists) {
        const torchCheck = runCommand(args.pythonPath, [args.checkTorchScriptPath]);
        checks.torch.command = torchCheck;
        const payload = safeParseJson(torchCheck.stdout);
        checks.torch.payload = payload;
        if (torchCheck.error || torchCheck.status !== 0 || !payload) {
            errors.push(`torch environment check failed: ${torchCheck.error || torchCheck.stderr || `exit=${torchCheck.status}`}`);
        } else {
            if (payload.cuda_available !== true) {
                warnings.push('CUDA is not available. Training will run on CPU and may be slower.');
            }
        }
    }

    const artifactTargets = Cleaner.collectTargets({
        runsDir: args.runsDir,
        modelsDir: args.modelsDir,
        keepDeployed: false
    });
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

    console.log(`[selfplay-preflight] status=${status} errors=${errors.length} warnings=${warnings.length}`);
    console.log(`[selfplay-preflight] report=${args.out}`);
    if (warnings.length > 0) {
        for (const w of warnings) console.warn(`[selfplay-preflight] warning: ${w}`);
    }
    if (errors.length > 0) {
        for (const e of errors) console.error(`[selfplay-preflight] error: ${e}`);
    }

    if (status !== 'ok') process.exit(1);
}

if (require.main === module) {
    try {
        main();
    } catch (err) {
        console.error('[selfplay-preflight] failed:', err && err.message ? err.message : err);
        process.exit(1);
    }
}

module.exports = {
    parseArgs,
    runCommand,
    safeParseJson,
    makeDefaultOutputPath
};

