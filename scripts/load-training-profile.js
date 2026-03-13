#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const PROFILE_SCHEMA_VERSION = 'training_profile.v1';
const GATE_SCHEMA_VERSION = 'training_gate.v1';
const RESOLVED_SCHEMA_VERSION = 'training_profile_resolved.v1';

const RESERVED_TRAIN_CYCLE_FLAGS = new Set([
    '--python',
    '--runs-dir',
    '--models-dir',
    '--summary-out',
    '--bootstrap-policy-model',
    '--resume-checkpoint',
    '--run-tag'
]);

function defaultPythonPath(cwd) {
    return path.resolve(cwd || process.cwd(), '.venv', 'Scripts', 'python.exe');
}

function sanitizeRunTagFragment(value, fallback) {
    const raw = String(value || '').trim();
    const cleaned = raw
        .replace(/[^a-zA-Z0-9._-]+/g, '_')
        .replace(/^_+|_+$/g, '');
    return cleaned || String(fallback || 'training').trim() || 'training';
}

function makeTimestampTag(date) {
    const now = date instanceof Date ? date : new Date();
    const pad = (value) => String(value).padStart(2, '0');
    return [
        now.getFullYear(),
        pad(now.getMonth() + 1),
        pad(now.getDate())
    ].join('') + '_' + [
        pad(now.getHours()),
        pad(now.getMinutes()),
        pad(now.getSeconds())
    ].join('');
}

function makeRunTag(prefix, date) {
    return `${sanitizeRunTagFragment(prefix, 'training')}_${makeTimestampTag(date)}`;
}

function resolveMaybePath(cwd, value) {
    if (!value) return null;
    return path.isAbsolute(value) ? value : path.resolve(cwd, value);
}

function resolveNamedConfigPath(kind, ref, cwd) {
    const safeKind = kind === 'gate' ? 'gates' : 'profiles';
    const label = kind === 'gate' ? 'gate profile' : 'training profile';
    const baseDir = path.resolve(cwd, 'ai', 'train', 'configs', safeKind);
    const raw = String(ref || '').trim();
    const candidates = [];

    if (!raw) {
        throw new Error(`${label} is required`);
    }

    if (path.isAbsolute(raw)) {
        candidates.push(raw);
    } else {
        candidates.push(path.resolve(cwd, raw));
        candidates.push(path.resolve(baseDir, raw));
        candidates.push(path.resolve(baseDir, `${raw}.yaml`));
        candidates.push(path.resolve(baseDir, `${raw}.yml`));
        candidates.push(path.resolve(baseDir, `${raw}.json`));
    }

    for (const one of candidates) {
        if (one && fs.existsSync(one) && fs.statSync(one).isFile()) {
            return path.resolve(one);
        }
    }

    throw new Error(`${label} not found: ${raw}`);
}

function loadStructuredFile(filePath, pythonPath) {
    const raw = fs.readFileSync(filePath, 'utf8');
    if (!raw.trim()) return {};

    try {
        return JSON.parse(raw);
    } catch (e) {
        // fall through to YAML loader
    }

    const pyPath = resolveMaybePath(process.cwd(), pythonPath || defaultPythonPath(process.cwd()));
    if (!pyPath || !fs.existsSync(pyPath)) {
        throw new Error(`python executable not found for YAML loading: ${pyPath || '(empty)'}`);
    }

    const script = [
        'import json, sys',
        'try:',
        '    import yaml',
        'except Exception as exc:',
        '    sys.stderr.write(f"PyYAML import failed: {exc}")',
        '    sys.exit(2)',
        'payload = yaml.safe_load(sys.stdin.read())',
        'json.dump(payload, sys.stdout, ensure_ascii=False)'
    ].join('\n');

    const result = spawnSync(pyPath, ['-X', 'utf8', '-c', script], {
        cwd: process.cwd(),
        env: Object.assign({}, process.env, {
            PYTHONIOENCODING: 'utf-8',
            PYTHONUTF8: '1'
        }),
        input: Buffer.from(raw, 'utf8'),
        encoding: 'utf8',
        maxBuffer: 16 * 1024 * 1024
    });

    if (result.error) {
        throw result.error;
    }
    if (result.status !== 0) {
        throw new Error(`YAML load failed for ${filePath}: ${result.stderr || `exit=${result.status}`}`);
    }

    try {
        return JSON.parse(result.stdout || 'null');
    } catch (e) {
        throw new Error(`YAML loader returned invalid JSON for ${filePath}: ${e.message}`);
    }
}

function ensureArrayOfStrings(value, label) {
    if (value == null) return [];
    if (!Array.isArray(value)) {
        throw new Error(`${label} must be an array`);
    }
    return value.map((one) => String(one));
}

function resolveProfileDocument(profileRef, options) {
    const cwd = options && options.cwd ? options.cwd : process.cwd();
    const pythonPath = options && options.pythonPath ? options.pythonPath : defaultPythonPath(cwd);
    const profilePath = resolveNamedConfigPath('profile', profileRef, cwd);
    const profile = loadStructuredFile(profilePath, pythonPath);
    if (!profile || typeof profile !== 'object' || Array.isArray(profile)) {
        throw new Error(`training profile must be an object: ${profilePath}`);
    }
    if (profile.schemaVersion && profile.schemaVersion !== PROFILE_SCHEMA_VERSION) {
        throw new Error(`unsupported training profile schemaVersion in ${profilePath}: ${profile.schemaVersion}`);
    }

    const gateRef = options && options.gateProfile ? options.gateProfile : profile.gateProfile;
    let gatePath = null;
    let gate = null;
    if (gateRef) {
        gatePath = resolveNamedConfigPath('gate', gateRef, cwd);
        gate = loadStructuredFile(gatePath, pythonPath);
        if (!gate || typeof gate !== 'object' || Array.isArray(gate)) {
            throw new Error(`gate profile must be an object: ${gatePath}`);
        }
        if (gate.schemaVersion && gate.schemaVersion !== GATE_SCHEMA_VERSION) {
            throw new Error(`unsupported gate profile schemaVersion in ${gatePath}: ${gate.schemaVersion}`);
        }
    }

    return {
        profilePath,
        gatePath,
        profile,
        gate,
        pythonPath: resolveMaybePath(cwd, pythonPath)
    };
}

function planBootstrapCopies(cwd, modelsDir, bootstrap) {
    const sourcePolicyTable = resolveMaybePath(cwd, bootstrap.sourcePolicyTable || path.join('data', 'models', 'policy-table.json'));
    const sourceOnnxModel = resolveMaybePath(cwd, bootstrap.sourceOnnxModel || path.join('data', 'models', 'policy-net.onnx'));
    const sourceOnnxMeta = resolveMaybePath(cwd, bootstrap.sourceOnnxMeta || path.join('data', 'models', 'policy-net.onnx.meta.json'));

    const plans = [];
    if (bootstrap.copyPromotedPolicyTable !== false) {
        plans.push({ label: 'policy-table', source: sourcePolicyTable, target: path.resolve(modelsDir, 'policy-table.json') });
    }
    if (bootstrap.copyPromotedOnnxModel === true) {
        plans.push({ label: 'policy-net.onnx', source: sourceOnnxModel, target: path.resolve(modelsDir, 'policy-net.onnx') });
    }
    if (bootstrap.copyPromotedOnnxMeta === true) {
        plans.push({ label: 'policy-net.onnx.meta.json', source: sourceOnnxMeta, target: path.resolve(modelsDir, 'policy-net.onnx.meta.json') });
    }
    return plans;
}

function executeBootstrapPlans(plans, options) {
    const refreshBootstrap = !!(options && options.refreshBootstrap);
    const actions = [];

    for (const plan of plans) {
        const entry = {
            label: plan.label,
            source: plan.source,
            target: plan.target,
            status: 'skipped'
        };

        if (!plan.source || !fs.existsSync(plan.source)) {
            entry.status = 'missing-source';
            actions.push(entry);
            continue;
        }

        fs.mkdirSync(path.dirname(plan.target), { recursive: true });
        if (fs.existsSync(plan.target) && !refreshBootstrap) {
            entry.status = 'kept-existing';
            actions.push(entry);
            continue;
        }

        fs.copyFileSync(plan.source, plan.target);
        entry.status = refreshBootstrap && fs.existsSync(plan.target) ? 'copied' : 'copied';
        actions.push(entry);
    }

    return actions;
}

function findLatestCheckpoint(modelsDir) {
    if (!modelsDir || !fs.existsSync(modelsDir)) return null;
    let entries = [];
    try {
        entries = fs.readdirSync(modelsDir, { withFileTypes: true });
    } catch (e) {
        return null;
    }

    const candidates = entries
        .filter((entry) => entry && entry.isFile() && /\.checkpoint\.pt$/i.test(entry.name))
        .map((entry) => {
            const fullPath = path.resolve(modelsDir, entry.name);
            let mtimeMs = 0;
            try {
                mtimeMs = Number(fs.statSync(fullPath).mtimeMs) || 0;
            } catch (e) {
                mtimeMs = 0;
            }
            return { fullPath, mtimeMs };
        })
        .sort((a, b) => b.mtimeMs - a.mtimeMs);

    return candidates.length > 0 ? candidates[0].fullPath : null;
}

function assertNoReservedArgs(passThrough) {
    for (let i = 0; i < passThrough.length; i++) {
        const token = String(passThrough[i] || '').trim();
        if (RESERVED_TRAIN_CYCLE_FLAGS.has(token)) {
            throw new Error(`pass-through flag is reserved by profile launcher: ${token}`);
        }
    }
}

function shellQuote(arg) {
    const raw = String(arg);
    if (!/[\s"]/u.test(raw)) return raw;
    return `"${raw.replace(/"/g, '\\"')}"`;
}

function buildPreflightCommand(resolved) {
    if (!resolved.preflight.enabled) return null;
    const args = [
        path.resolve(resolved.cwd, 'scripts', 'preflight-selfplay-training.js'),
        '--python', resolved.pythonPath,
        '--runs-dir', resolved.paths.runsDir,
        '--models-dir', resolved.paths.modelsDir,
        '--out', resolved.paths.preflightOut,
        resolved.preflight.checkWindow === false ? '--skip-check-window' : '--check-window',
        resolved.preflight.allowArtifacts === true ? '--allow-artifacts' : '--require-clean-data'
    ];
    if (resolved.preflight.strict === true) {
        args.push('--strict');
    }
    return {
        executable: process.execPath,
        args,
        display: [process.execPath].concat(args).map(shellQuote).join(' ')
    };
}

function resolveTrainingProfile(profileRef, options) {
    const cwd = options && options.cwd ? options.cwd : process.cwd();
    const passThrough = Array.isArray(options && options.passThrough) ? options.passThrough.slice() : [];
    assertNoReservedArgs(passThrough);

    const docs = resolveProfileDocument(profileRef, options || {});
    const profile = docs.profile;
    const gate = docs.gate;

    const profileName = sanitizeRunTagFragment(profile.name || path.basename(docs.profilePath, path.extname(docs.profilePath)), 'production_v2');
    const runTagPrefix = sanitizeRunTagFragment(
        (options && options.runTagPrefix) || profile.runTagPrefix || profileName,
        profileName
    );
    const runTag = sanitizeRunTagFragment((options && options.runTag) || makeRunTag(runTagPrefix), runTagPrefix);

    const profilePaths = profile.paths && typeof profile.paths === 'object' ? profile.paths : {};
    const runsDir = resolveMaybePath(cwd, (options && options.runsDir) || profilePaths.runsDir || path.join('data', 'runs', profileName));
    const modelsDir = resolveMaybePath(cwd, (options && options.modelsDir) || profilePaths.modelsDir || path.join('data', 'models', profileName));
    const runDir = resolveMaybePath(cwd, (options && options.runDir) || path.join(runsDir, runTag));
    const summaryOut = resolveMaybePath(cwd, (options && options.summaryOut) || path.join(runDir, 'training-cycle.summary.json'));
    const resolvedConfigOut = resolveMaybePath(cwd, (options && options.resolvedConfigOut) || path.join(runDir, 'config.resolved.json'));
    const preflightOut = resolveMaybePath(cwd, (options && options.preflightOut) || path.join(runDir, 'preflight.json'));
    const launcherLogPath = resolveMaybePath(cwd, (options && options.launcherLogPath) || path.join(runDir, 'launcher.log'));

    const bootstrap = profile.bootstrap && typeof profile.bootstrap === 'object' ? profile.bootstrap : {};
    const preflight = Object.assign({
        enabled: true,
        strict: false,
        allowArtifacts: true,
        checkWindow: true
    }, profile.preflight && typeof profile.preflight === 'object' ? profile.preflight : {});

    fs.mkdirSync(runsDir, { recursive: true });
    fs.mkdirSync(modelsDir, { recursive: true });
    fs.mkdirSync(runDir, { recursive: true });

    const bootstrapPlans = planBootstrapCopies(cwd, modelsDir, bootstrap);
    const bootstrapActions = executeBootstrapPlans(bootstrapPlans, options || {});

    const copiedPolicyTablePath = path.resolve(modelsDir, 'policy-table.json');
    let bootstrapPolicyModelPath = null;
    if (bootstrap.useCopiedPolicyTableAsBootstrap !== false && fs.existsSync(copiedPolicyTablePath)) {
        bootstrapPolicyModelPath = copiedPolicyTablePath;
    } else if (bootstrap.bootstrapPolicyModelPath) {
        const explicitBootstrapModel = resolveMaybePath(cwd, bootstrap.bootstrapPolicyModelPath);
        if (explicitBootstrapModel && fs.existsSync(explicitBootstrapModel)) {
            bootstrapPolicyModelPath = explicitBootstrapModel;
        }
    }

    let resumeCheckpointPath = null;
    if (bootstrap.resumeCheckpointPath) {
        const explicitCheckpoint = resolveMaybePath(cwd, bootstrap.resumeCheckpointPath);
        if (explicitCheckpoint && fs.existsSync(explicitCheckpoint)) {
            resumeCheckpointPath = explicitCheckpoint;
        }
    }
    if (!resumeCheckpointPath && bootstrap.autoResumeLatestCheckpoint === true) {
        resumeCheckpointPath = findLatestCheckpoint(modelsDir);
    }

    const profileTrainCycleArgs = ensureArrayOfStrings(profile.trainCycleArgs, 'profile.trainCycleArgs');
    const gateTrainCycleArgs = gate ? ensureArrayOfStrings(gate.trainCycleArgs, 'gate.trainCycleArgs') : [];

    const generatedArgs = [
        '--python', docs.pythonPath,
        '--runs-dir', runsDir,
        '--models-dir', modelsDir,
        '--summary-out', summaryOut,
        '--run-tag', runTag
    ];
    if (bootstrapPolicyModelPath) {
        generatedArgs.push('--bootstrap-policy-model', bootstrapPolicyModelPath);
    }
    if (resumeCheckpointPath) {
        generatedArgs.push('--resume-checkpoint', resumeCheckpointPath);
    }

    const trainCycleScriptPath = path.resolve(cwd, 'scripts', 'run-selfplay-training-cycle.js');
    const trainCycleArgs = [trainCycleScriptPath]
        .concat(profileTrainCycleArgs)
        .concat(gateTrainCycleArgs)
        .concat(generatedArgs)
        .concat(passThrough);

    const resolved = {
        schemaVersion: RESOLVED_SCHEMA_VERSION,
        generatedAt: new Date().toISOString(),
        cwd,
        pythonPath: docs.pythonPath,
        profile: {
            name: profileName,
            path: docs.profilePath,
            description: String(profile.description || '').trim(),
            schemaVersion: profile.schemaVersion || PROFILE_SCHEMA_VERSION
        },
        gate: gate ? {
            name: String(gate.name || path.basename(docs.gatePath, path.extname(docs.gatePath))).trim(),
            path: docs.gatePath,
            description: String(gate.description || '').trim(),
            schemaVersion: gate.schemaVersion || GATE_SCHEMA_VERSION
        } : null,
        paths: {
            runsDir,
            modelsDir,
            runDir,
            runTag,
            summaryOut,
            resolvedConfigOut,
            preflightOut,
            launcherLogPath
        },
        bootstrap: {
            actions: bootstrapActions,
            bootstrapPolicyModelPath,
            resumeCheckpointPath,
            autoResumeLatestCheckpoint: bootstrap.autoResumeLatestCheckpoint === true
        },
        preflight,
        command: {
            executable: process.execPath,
            args: trainCycleArgs,
            display: [process.execPath].concat(trainCycleArgs).map(shellQuote).join(' ')
        },
        preflightCommand: null,
        passThrough
    };

    resolved.preflightCommand = buildPreflightCommand(resolved);
    return resolved;
}

function writeResolvedConfig(resolved, outPath) {
    const target = outPath || (resolved && resolved.paths ? resolved.paths.resolvedConfigOut : null);
    if (!target) throw new Error('resolved config output path is required');
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, JSON.stringify(resolved, null, 2), 'utf8');
    return target;
}

function runCommand(executable, args, options) {
    const result = spawnSync(executable, args, {
        cwd: options && options.cwd ? options.cwd : process.cwd(),
        env: process.env,
        encoding: 'utf8',
        stdio: options && options.stdio ? options.stdio : 'pipe'
    });
    if (result.error) throw result.error;
    return result;
}

module.exports = {
    PROFILE_SCHEMA_VERSION,
    GATE_SCHEMA_VERSION,
    RESOLVED_SCHEMA_VERSION,
    RESERVED_TRAIN_CYCLE_FLAGS,
    defaultPythonPath,
    makeTimestampTag,
    makeRunTag,
    resolveNamedConfigPath,
    loadStructuredFile,
    resolveProfileDocument,
    findLatestCheckpoint,
    resolveTrainingProfile,
    writeResolvedConfig,
    runCommand,
    shellQuote
};
