#!/usr/bin/env node
// @ts-nocheck
'use strict';
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const child_process_1 = require("child_process");
const training_checkpoint_utils_1 = __importDefault(require("./training-checkpoint-utils"));
const { TRAINING_CHECKPOINT_HEAD_SPECS, createEmptyResumeCheckpointPaths, cloneResumeCheckpointPaths, detectCheckpointHead } = training_checkpoint_utils_1.default;
const training_command_args_1 = __importDefault(require("./training-command-args"));
const { stripLeadingScriptArg, collectCliFlagMap, getFlagValue, hasFlag } = training_command_args_1.default;
const _require = (typeof __non_webpack_require__ !== 'undefined')
    ? __non_webpack_require__
    : require;
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
].concat(TRAINING_CHECKPOINT_HEAD_SPECS.map((spec) => spec.resumeFlag)));
const SHARED_TEACHER_ARG_SPECS = Object.freeze([
    { flag: '--selfplay-policy-mix-rate', key: 'policyMixRate', type: 'number' },
    { flag: '--selfplay-policy-model-pool-size', key: 'policyModelPoolSize', type: 'integer' },
    { flag: '--selfplay-policy-pool-sampling', key: 'policyPoolSampling', type: 'string' },
    { flag: '--selfplay-policy-pool-recency-decay', key: 'policyPoolRecencyDecay', type: 'number' },
    { flag: '--selfplay-policy-current-anchor-rate', key: 'policyCurrentAnchorRate', type: 'number' },
    { flag: '--selfplay-tactical-weight-min', key: 'tacticalWeightMin', type: 'number' },
    { flag: '--selfplay-tactical-weight-max', key: 'tacticalWeightMax', type: 'number' },
    { flag: '--selfplay-tactical-depth-opening', key: 'tacticalDepthOpening', type: 'integer' },
    { flag: '--selfplay-tactical-depth-mid', key: 'tacticalDepthMid', type: 'integer' },
    { flag: '--selfplay-tactical-depth-end', key: 'tacticalDepthEnd', type: 'integer' },
    { flag: '--selfplay-tactical-beam-width', key: 'tacticalBeamWidth', type: 'integer' },
    { flag: '--selfplay-policy-score-weight-min', key: 'policyScoreWeightMin', type: 'number' },
    { flag: '--selfplay-policy-score-weight-max', key: 'policyScoreWeightMax', type: 'number' },
    { flag: '--selfplay-heuristic-weight-min', key: 'heuristicWeightMin', type: 'number' },
    { flag: '--selfplay-heuristic-weight-max', key: 'heuristicWeightMax', type: 'number' },
    { flag: '--selfplay-teacher-committee-weight-min', key: 'teacherCommitteeWeightMin', type: 'number' },
    { flag: '--selfplay-teacher-committee-weight-max', key: 'teacherCommitteeWeightMax', type: 'number' },
    { flag: '--selfplay-teacher-committee-consensus-bonus-min', key: 'teacherCommitteeConsensusBonusMin', type: 'number' },
    { flag: '--selfplay-teacher-committee-consensus-bonus-max', key: 'teacherCommitteeConsensusBonusMax', type: 'number' }
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
    if (!value)
        return null;
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
    }
    else {
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
    throw new Error(`${label} not found: ${raw} (searched: ${candidates.join(', ')})`);
}
function loadStructuredFile(filePath, pythonPath) {
    const raw = fs.readFileSync(filePath, 'utf8');
    if (!raw.trim())
        return {};
    try {
        return JSON.parse(raw);
    }
    catch (e) {
        // fall through to YAML loader
    }
    const pyPath = resolveMaybePath(process.cwd(), pythonPath || defaultPythonPath(process.cwd()));
    if (!pyPath || !fs.existsSync(pyPath)) {
        throw new Error(`python executable not found for YAML loading: ${pyPath || '(empty)'} (file: ${filePath})`);
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
    const result = (0, child_process_1.spawnSync)(pyPath, ['-X', 'utf8', '-c', script], {
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
        throw new Error(`YAML load failed for ${filePath} via ${pyPath}: ${result.stderr || `exit=${result.status}`}`);
    }
    try {
        return JSON.parse(result.stdout || 'null');
    }
    catch (e) {
        throw new Error(`YAML loader returned invalid JSON for ${filePath} via ${pyPath}: ${e.message}`);
    }
}
function ensureArrayOfStrings(value, label) {
    if (value == null)
        return [];
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
function findLatestCheckpointPaths(modelsDir) {
    const latest = createEmptyResumeCheckpointPaths();
    if (!modelsDir || !fs.existsSync(modelsDir))
        return latest;
    let entries = [];
    try {
        entries = fs.readdirSync(modelsDir, { withFileTypes: true });
    }
    catch (e) {
        return latest;
    }
    const latestByHead = new Map();
    for (const entry of entries) {
        if (!entry || !entry.isFile() || !/\.checkpoint\.pt$/i.test(entry.name))
            continue;
        const fullPath = path.resolve(modelsDir, entry.name);
        const head = detectCheckpointHead(fullPath);
        if (!head)
            continue;
        let mtimeMs = 0;
        try {
            mtimeMs = Number(fs.statSync(fullPath).mtimeMs) || 0;
        }
        catch (e) {
            mtimeMs = 0;
        }
        const previous = latestByHead.get(head);
        if (!previous || mtimeMs > previous.mtimeMs) {
            latestByHead.set(head, { fullPath, mtimeMs });
        }
    }
    for (const spec of TRAINING_CHECKPOINT_HEAD_SPECS) {
        const entry = latestByHead.get(spec.head);
        latest[spec.head] = entry ? entry.fullPath : null;
    }
    return latest;
}
function findLatestCheckpoint(modelsDir) {
    const latest = findLatestCheckpointPaths(modelsDir);
    return latest.policy || null;
}
function assignResumeCheckpointPath(target, head, checkpointPath, label) {
    if (!target || !head || !checkpointPath)
        return;
    const resolvedPath = path.resolve(checkpointPath);
    if (target[head] && path.resolve(target[head]) !== resolvedPath) {
        throw new Error(`${label || 'resume checkpoint'} conflicts with existing ${head} checkpoint: ${target[head]} (tried to set: ${resolvedPath})`);
    }
    target[head] = resolvedPath;
}
function resolveExplicitResumeCheckpointPaths(cwd, bootstrap) {
    const resolved = createEmptyResumeCheckpointPaths();
    if (!bootstrap || typeof bootstrap !== 'object')
        return resolved;
    const configuredMap = bootstrap.resumeCheckpointPaths && typeof bootstrap.resumeCheckpointPaths === 'object' && !Array.isArray(bootstrap.resumeCheckpointPaths)
        ? bootstrap.resumeCheckpointPaths
        : null;
    for (const spec of TRAINING_CHECKPOINT_HEAD_SPECS) {
        const rawValue = bootstrap[spec.bootstrapKey] || (configuredMap ? configuredMap[spec.head] : null);
        if (!rawValue)
            continue;
        const resolvedPath = resolveMaybePath(cwd, rawValue);
        if (!resolvedPath || !fs.existsSync(resolvedPath)) {
            throw new Error(`${spec.bootstrapKey} not found: ${resolvedPath || '(empty)'}`);
        }
        assignResumeCheckpointPath(resolved, spec.head, resolvedPath, spec.bootstrapKey);
    }
    if (bootstrap.resumeCheckpointPath) {
        const explicitCheckpoint = resolveMaybePath(cwd, bootstrap.resumeCheckpointPath);
        if (!explicitCheckpoint || !fs.existsSync(explicitCheckpoint)) {
            throw new Error(`bootstrap.resumeCheckpointPath not found: ${explicitCheckpoint || '(empty)'}`);
        }
        const explicitHead = detectCheckpointHead(explicitCheckpoint);
        if (!explicitHead) {
            throw new Error(`bootstrap.resumeCheckpointPath must target a policy-net/policy-card/policy-target/policy-value checkpoint: ${explicitCheckpoint}`);
        }
        assignResumeCheckpointPath(resolved, explicitHead, explicitCheckpoint, 'bootstrap.resumeCheckpointPath');
    }
    return resolved;
}
function usesPromotedOnlyGuideMode(trainCycleArgs) {
    return resolveGuideModeFromArgs(trainCycleArgs) === 'promoted-only';
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
    if (!/[\s"]/u.test(raw))
        return raw;
    return `"${raw.replace(/"/g, '\\"')}"`;
}
function findFlagIndex(args, flag) {
    if (!Array.isArray(args) || !flag)
        return -1;
    for (let i = 0; i < args.length; i++) {
        if (String(args[i] || '').trim() === flag)
            return i;
    }
    return -1;
}
function removeFlagAndValue(args, flag) {
    if (!Array.isArray(args) || !flag)
        return args || [];
    const out = args.slice();
    const index = findFlagIndex(out, flag);
    if (index < 0)
        return out;
    out.splice(index, 1);
    if (index < out.length && !String(out[index] || '').trim().startsWith('--')) {
        out.splice(index, 1);
    }
    return out;
}
function upsertFlagValue(args, flag, value) {
    const out = removeFlagAndValue(args, flag);
    out.push(flag, String(value));
    return out;
}
function upsertBooleanFlag(args, flag, enabled) {
    const out = removeFlagAndValue(args, flag);
    if (enabled)
        out.push(flag);
    return out;
}
function loadCpuLv6SharedTeacherProfile(cwd) {
    const sharedPath = path.resolve(cwd, 'constants', 'cpu-lv6-shared-profile.js');
    if (!fs.existsSync(sharedPath))
        return null;
    try {
        const shared = require(sharedPath);
        if (!shared || typeof shared !== 'object')
            return null;
        const teacher = shared.teacher;
        return teacher && typeof teacher === 'object' ? teacher : null;
    }
    catch (e) {
        return null;
    }
}
function formatSharedTeacherValue(type, value) {
    if (type === 'integer') {
        const numeric = Math.max(0, Math.floor(Number(value) || 0));
        return String(numeric);
    }
    if (type === 'number') {
        const numeric = Number(value);
        return String(Number.isFinite(numeric) ? numeric : 0);
    }
    return String(value);
}
function resolveGuideModeFromArgs(args) {
    if (findFlagIndex(args, '--selfplay-use-promoted-model-only') >= 0)
        return 'promoted-only';
    if (findFlagIndex(args, '--selfplay-use-candidate-every-iteration') >= 0)
        return 'candidate-every-iteration';
    return null;
}
function resolveSharedTeacherSyncConfig(profile) {
    const explicit = profile && profile.sharedTeacherSync && typeof profile.sharedTeacherSync === 'object' && !Array.isArray(profile.sharedTeacherSync)
        ? profile.sharedTeacherSync
        : null;
    if (explicit) {
        return {
            enabled: explicit.enabled !== false,
            mode: explicit.mode === 'override' ? 'override' : 'fill-missing'
        };
    }
    if (profile && profile.syncCpuLv6SharedTeacher === true) {
        return {
            enabled: true,
            mode: 'fill-missing'
        };
    }
    return {
        enabled: false,
        mode: 'disabled'
    };
}
function getNumericFlagValue(flagMap, flag, fallback) {
    const raw = getFlagValue(flagMap, flag);
    if (raw === undefined || raw === true)
        return fallback;
    const numeric = Number(raw);
    return Number.isFinite(numeric) ? numeric : fallback;
}
function buildSeedBankPlan(trainCycleArgs, context) {
    const normalizedArgs = stripLeadingScriptArg(trainCycleArgs);
    const flagMap = collectCliFlagMap(normalizedArgs);
    const seedBankArg = getFlagValue(flagMap, '--seed-bank');
    if (seedBankArg === undefined || seedBankArg === true)
        return null;
    const seedBankPath = resolveMaybePath(context && context.cwd ? context.cwd : process.cwd(), String(seedBankArg || '').trim());
    if (!seedBankPath)
        return null;
    const baseSeed = getNumericFlagValue(flagMap, '--seed', 1);
    const quickSeedCount = getNumericFlagValue(flagMap, '--quick-adoption-seed-count', getNumericFlagValue(flagMap, '--adoption-seed-count', 1));
    const quickSeedStride = getNumericFlagValue(flagMap, '--quick-adoption-seed-stride', getNumericFlagValue(flagMap, '--adoption-seed-stride', 1000));
    const quickSeedOffset = getNumericFlagValue(flagMap, '--quick-adoption-seed-offset', 0);
    const finalSeedCount = getNumericFlagValue(flagMap, '--final-adoption-seed-count', getNumericFlagValue(flagMap, '--adoption-seed-count', 1));
    const finalSeedStride = getNumericFlagValue(flagMap, '--final-adoption-seed-stride', getNumericFlagValue(flagMap, '--adoption-seed-stride', 1000));
    const finalSeedOffset = getNumericFlagValue(flagMap, '--adoption-final-seed-offset', getNumericFlagValue(flagMap, '--eval-seed-offset', 500000));
    const gates = {
        quick: {
            baseSeed: baseSeed + quickSeedOffset,
            seedCount: quickSeedCount,
            seedStride: quickSeedStride,
            purpose: 'quick adoption gate'
        },
        final: {
            baseSeed: baseSeed + finalSeedOffset,
            seedCount: finalSeedCount,
            seedStride: finalSeedStride,
            purpose: 'final adoption gate'
        },
        onnx: {
            baseSeed: baseSeed + getNumericFlagValue(flagMap, '--onnx-gate-seed-offset', 700000),
            seedCount: getNumericFlagValue(flagMap, '--onnx-gate-seed-count', 1),
            seedStride: getNumericFlagValue(flagMap, '--onnx-gate-seed-stride', 1000),
            purpose: hasFlag(flagMap, '--onnx-gate')
                ? 'onnx gate'
                : 'onnx gate schedule'
        }
    };
    if (hasFlag(flagMap, '--quality-gate')) {
        gates.quality = {
            baseSeed: baseSeed + getNumericFlagValue(flagMap, '--quality-gate-seed-offset', 250000),
            seedCount: getNumericFlagValue(flagMap, '--quality-gate-seed-count', 1),
            seedStride: getNumericFlagValue(flagMap, '--quality-gate-seed-stride', 1000),
            purpose: 'quality gate'
        };
    }
    return {
        path: seedBankPath,
        bankId: `${context && context.profileName ? context.profileName : 'training'}-seed-bank`,
        description: context && context.runTag
            ? `Auto-initialized seed bank for ${context.runTag}`
            : 'Auto-initialized seed bank',
        gates
    };
}
function applySharedTeacherProfileArgs(trainCycleArgs, teacherProfile, options) {
    let nextArgs = Array.isArray(trainCycleArgs) ? trainCycleArgs.slice() : [];
    const syncMode = options && options.mode === 'override' ? 'override' : 'fill-missing';
    const report = {
        enabled: true,
        mode: syncMode,
        sourcePath: options && options.sourcePath ? options.sourcePath : null,
        sourceFound: !!(teacherProfile && typeof teacherProfile === 'object'),
        flagActions: [],
        guideMode: {
            desired: null,
            active: resolveGuideModeFromArgs(nextArgs),
            status: teacherProfile && typeof teacherProfile === 'object'
                ? 'preserved-explicit'
                : 'source-missing'
        }
    };
    if (!teacherProfile || typeof teacherProfile !== 'object') {
        return { args: nextArgs, report };
    }
    for (const spec of SHARED_TEACHER_ARG_SPECS) {
        const rawValue = teacherProfile[spec.key];
        if (rawValue == null) {
            report.flagActions.push({
                flag: spec.flag,
                key: spec.key,
                status: 'missing-source-value'
            });
            continue;
        }
        const formattedValue = formatSharedTeacherValue(spec.type, rawValue);
        const hasExplicitFlag = findFlagIndex(nextArgs, spec.flag) >= 0;
        if (hasExplicitFlag && syncMode !== 'override') {
            report.flagActions.push({
                flag: spec.flag,
                key: spec.key,
                teacherValue: rawValue,
                formattedValue,
                status: 'preserved-explicit'
            });
            continue;
        }
        nextArgs = upsertFlagValue(nextArgs, spec.flag, formattedValue);
        report.flagActions.push({
            flag: spec.flag,
            key: spec.key,
            teacherValue: rawValue,
            formattedValue,
            status: hasExplicitFlag ? 'overrode-explicit' : 'applied'
        });
    }
    const desiredGuideMode = teacherProfile.usePromotedModelOnly === false
        ? 'candidate-every-iteration'
        : 'promoted-only';
    const explicitGuideMode = resolveGuideModeFromArgs(nextArgs);
    if (!explicitGuideMode || syncMode === 'override') {
        nextArgs = upsertBooleanFlag(nextArgs, '--selfplay-use-promoted-model-only', teacherProfile.usePromotedModelOnly !== false);
        nextArgs = upsertBooleanFlag(nextArgs, '--selfplay-use-candidate-every-iteration', teacherProfile.usePromotedModelOnly === false);
        report.guideMode = {
            desired: desiredGuideMode,
            active: resolveGuideModeFromArgs(nextArgs),
            status: explicitGuideMode && syncMode === 'override'
                ? 'overrode-explicit'
                : 'applied'
        };
    }
    else {
        report.guideMode = {
            desired: desiredGuideMode,
            active: explicitGuideMode,
            status: 'preserved-explicit'
        };
    }
    return { args: nextArgs, report };
}
function buildPreflightCommand(resolved) {
    if (!resolved.preflight.enabled)
        return null;
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
    const runTagPrefix = sanitizeRunTagFragment((options && options.runTagPrefix) || profile.runTagPrefix || profileName, profileName);
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
    const sharedTeacherSyncConfig = resolveSharedTeacherSyncConfig(profile);
    const sharedTeacherSourcePath = path.resolve(cwd, 'constants', 'cpu-lv6-shared-profile.js');
    fs.mkdirSync(runsDir, { recursive: true });
    fs.mkdirSync(modelsDir, { recursive: true });
    fs.mkdirSync(runDir, { recursive: true });
    const rawProfileTrainCycleArgs = ensureArrayOfStrings(profile.trainCycleArgs, 'profile.trainCycleArgs');
    let profileTrainCycleArgs = rawProfileTrainCycleArgs.slice();
    let effectiveSharedTeacher = null;
    let sharedTeacherSync = {
        enabled: sharedTeacherSyncConfig.enabled,
        mode: sharedTeacherSyncConfig.mode,
        sourcePath: sharedTeacherSourcePath,
        sourceFound: false,
        flagActions: [],
        guideMode: {
            desired: null,
            active: resolveGuideModeFromArgs(profileTrainCycleArgs),
            status: sharedTeacherSyncConfig.enabled ? 'source-missing' : 'disabled'
        }
    };
    if (sharedTeacherSyncConfig.enabled) {
        const sharedTeacherProfile = loadCpuLv6SharedTeacherProfile(cwd);
        if (sharedTeacherProfile) {
            effectiveSharedTeacher = Object.assign({}, sharedTeacherProfile);
            const syncResult = applySharedTeacherProfileArgs(profileTrainCycleArgs, sharedTeacherProfile, {
                mode: sharedTeacherSyncConfig.mode,
                sourcePath: sharedTeacherSourcePath
            });
            profileTrainCycleArgs = syncResult.args;
            sharedTeacherSync = syncResult.report;
        }
    }
    const gateTrainCycleArgs = gate ? ensureArrayOfStrings(gate.trainCycleArgs, 'gate.trainCycleArgs') : [];
    const promotedOnlyGuideMode = usesPromotedOnlyGuideMode(profileTrainCycleArgs)
        || usesPromotedOnlyGuideMode(gateTrainCycleArgs);
    const bootstrapPlans = planBootstrapCopies(cwd, modelsDir, bootstrap);
    const bootstrapActions = executeBootstrapPlans(bootstrapPlans, Object.assign({}, options || {}, {
        refreshBootstrap: !!((options && options.refreshBootstrap) || promotedOnlyGuideMode)
    }));
    const copiedPolicyTablePath = path.resolve(modelsDir, 'policy-table.json');
    let bootstrapPolicyModelPath = null;
    if (bootstrap.useCopiedPolicyTableAsBootstrap !== false && fs.existsSync(copiedPolicyTablePath)) {
        bootstrapPolicyModelPath = copiedPolicyTablePath;
    }
    else if (bootstrap.bootstrapPolicyModelPath) {
        const explicitBootstrapModel = resolveMaybePath(cwd, bootstrap.bootstrapPolicyModelPath);
        if (explicitBootstrapModel && fs.existsSync(explicitBootstrapModel)) {
            bootstrapPolicyModelPath = explicitBootstrapModel;
        }
    }
    // Promoted-only lanes still benefit from cumulative optimizer/checkpoint state
    // even when the selfplay guide remains pinned to the current promoted model.
    const autoResumeLatestCheckpointEnabled = bootstrap.autoResumeLatestCheckpoint === true;
    const resumeCheckpointPaths = resolveExplicitResumeCheckpointPaths(cwd, bootstrap);
    if (autoResumeLatestCheckpointEnabled) {
        const latestResumeCheckpointPaths = findLatestCheckpointPaths(modelsDir);
        for (const spec of TRAINING_CHECKPOINT_HEAD_SPECS) {
            if (!resumeCheckpointPaths[spec.head] && latestResumeCheckpointPaths[spec.head]) {
                resumeCheckpointPaths[spec.head] = latestResumeCheckpointPaths[spec.head];
            }
        }
    }
    const resumeCheckpointPath = resumeCheckpointPaths.policy || null;
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
    for (const spec of TRAINING_CHECKPOINT_HEAD_SPECS) {
        if (resumeCheckpointPaths[spec.head]) {
            generatedArgs.push(spec.resumeFlag, resumeCheckpointPaths[spec.head]);
        }
    }
    const launcherScriptPath = resolveMaybePath(cwd, (profile && typeof profile.launcherScript === 'string' && profile.launcherScript.trim())
        ? profile.launcherScript.trim()
        : path.join('scripts', 'run-selfplay-training-cycle.js'));
    if (!launcherScriptPath || !fs.existsSync(launcherScriptPath)) {
        throw new Error(`launcher script not found: ${launcherScriptPath || '(empty)'}`);
    }
    const trainCycleArgs = [launcherScriptPath]
        .concat(profileTrainCycleArgs)
        .concat(gateTrainCycleArgs)
        .concat(generatedArgs)
        .concat(passThrough);
    const seedBankPlan = buildSeedBankPlan(trainCycleArgs, {
        cwd,
        profileName,
        runTag
    });
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
            resumeCheckpointPaths: cloneResumeCheckpointPaths(resumeCheckpointPaths),
            autoResumeLatestCheckpoint: autoResumeLatestCheckpointEnabled
        },
        sharedTeacherSync,
        effectiveSharedTeacher,
        seedBankPlan,
        provenance: {
            rawProfileTrainCycleArgs,
            effectiveProfileTrainCycleArgs: profileTrainCycleArgs.slice(),
            gateTrainCycleArgs: gateTrainCycleArgs.slice(),
            generatedArgs: generatedArgs.slice(),
            passThrough: passThrough.slice()
        },
        preflight,
        command: {
            executable: process.execPath,
            args: trainCycleArgs,
            display: [process.execPath].concat(trainCycleArgs).map(shellQuote).join(' ')
        },
        launcher: {
            scriptPath: launcherScriptPath
        },
        preflightCommand: null,
        passThrough
    };
    resolved.preflightCommand = buildPreflightCommand(resolved);
    return resolved;
}
function writeResolvedConfig(resolved, outPath) {
    const target = outPath || (resolved && resolved.paths ? resolved.paths.resolvedConfigOut : null);
    if (!target)
        throw new Error('resolved config output path is required');
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, JSON.stringify(resolved, null, 2), 'utf8');
    return target;
}
function runCommand(executable, args, options) {
    const result = (0, child_process_1.spawnSync)(executable, args, {
        cwd: options && options.cwd ? options.cwd : process.cwd(),
        env: process.env,
        encoding: 'utf8',
        stdio: options && options.stdio ? options.stdio : 'pipe'
    });
    if (result.error)
        throw result.error;
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
    findLatestCheckpointPaths,
    findLatestCheckpoint,
    resolveTrainingProfile,
    writeResolvedConfig,
    runCommand,
    shellQuote
};
//# sourceMappingURL=load-training-profile.js.map