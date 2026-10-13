#!/usr/bin/env node
'use strict';

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { spawn } from 'child_process';
import * as crypto from 'crypto';
import GateContract = require('./policy-onnx-browser-gate-contract');
import _training_resolved_config_utils from './training-resolved-config-utils';
const { loadResolvedTrainingConfig, applyOnnxGateArgsFromResolvedConfig } = _training_resolved_config_utils;
import _policy_seed_utils from './policy-seed-utils';
const { buildSeedList, buildSeedSchedule } = _policy_seed_utils;

declare const __non_webpack_require__: NodeRequire | undefined;

const _require: NodeRequire = (typeof __non_webpack_require__ !== 'undefined')
  ? __non_webpack_require__
  : require;

function defaultJobs() {
    const cpuCount = Array.isArray(os.cpus()) ? os.cpus().length : 1;
    return Math.max(1, Math.min(12, cpuCount));
}

function parseArgs(argv: string[]) {
    const args = {
        games: 8,
        seed: 1,
        seedCount: 1,
        seedStride: 1000,
        jobs: defaultJobs(),
        threshold: 0.5,
        minSeedScore: 0,
        minSeedPassCount: 0,
        maxAverageLatencyMs: 0,
        maxP95LatencyMs: 0,
        maxMaxLatencyMs: 0,
        blackLevel: 6,
        whiteLevel: 6,
        candidateColorMode: 'both',
        timeoutMs: 180000,
        matchRetries: 1,
        maxTotalMs: 900000,
        candidateOnnxPath: null,
        candidateOnnxMetaPath: null,
        candidateCardOnnxPath: null,
        candidateCardOnnxMetaPath: null,
        candidateTargetOnnxPath: null,
        candidateTargetOnnxMetaPath: null,
        candidateValueOnnxPath: null,
        candidateValueOnnxMetaPath: null,
        targetOnnxPath: null,
        targetOnnxMetaPath: null,
        targetCardOnnxPath: null,
        targetCardOnnxMetaPath: null,
        targetTargetOnnxPath: null,
        targetTargetOnnxMetaPath: null,
        targetValueOnnxPath: null,
        targetValueOnnxMetaPath: null,
        resolvedConfigPath: null,
        out: null,
        verbose: false,
        help: false
    };
    const specified = new Set();

    for (let i = 0; i < argv.length; i++) {
        const a = argv[i];
        if (a === '--help' || a === '-h') { args.help = true; continue; }
        if (a === '--games' || a === '-g') { args.games = Number(argv[++i]); specified.add('games'); continue; }
        if (a === '--seed' || a === '-s') { args.seed = Number(argv[++i]); specified.add('seed'); continue; }
        if (a === '--seed-count') { args.seedCount = Number(argv[++i]); specified.add('seedCount'); continue; }
        if (a === '--seed-stride') { args.seedStride = Number(argv[++i]); specified.add('seedStride'); continue; }
        if (a === '--jobs' || a === '-j') { args.jobs = Number(argv[++i]); specified.add('jobs'); continue; }
        if (a === '--threshold') { args.threshold = Number(argv[++i]); specified.add('threshold'); continue; }
        if (a === '--min-seed-score') { args.minSeedScore = Number(argv[++i]); specified.add('minSeedScore'); continue; }
        if (a === '--min-seed-pass-count') { args.minSeedPassCount = Number(argv[++i]); specified.add('minSeedPassCount'); continue; }
        if (a === '--max-average-latency-ms') { args.maxAverageLatencyMs = Number(argv[++i]); specified.add('maxAverageLatencyMs'); continue; }
        if (a === '--max-p95-latency-ms') { args.maxP95LatencyMs = Number(argv[++i]); specified.add('maxP95LatencyMs'); continue; }
        if (a === '--max-max-latency-ms') { args.maxMaxLatencyMs = Number(argv[++i]); specified.add('maxMaxLatencyMs'); continue; }
        if (a === '--black-level') { args.blackLevel = Number(argv[++i]); specified.add('blackLevel'); continue; }
        if (a === '--white-level') { args.whiteLevel = Number(argv[++i]); specified.add('whiteLevel'); continue; }
        if (a === '--candidate-color-mode') { args.candidateColorMode = String(argv[++i] || '').toLowerCase(); specified.add('candidateColorMode'); continue; }
        if (a === '--timeout-ms') { args.timeoutMs = Number(argv[++i]); specified.add('timeoutMs'); continue; }
        if (a === '--match-retries') { args.matchRetries = Number(argv[++i]); specified.add('matchRetries'); continue; }
        if (a === '--max-total-ms') { args.maxTotalMs = Number(argv[++i]); specified.add('maxTotalMs'); continue; }
        if (a === '--candidate-onnx') { args.candidateOnnxPath = path.resolve(process.cwd(), argv[++i]); specified.add('candidateOnnxPath'); continue; }
        if (a === '--candidate-onnx-meta') { args.candidateOnnxMetaPath = path.resolve(process.cwd(), argv[++i]); specified.add('candidateOnnxMetaPath'); continue; }
        if (a === '--candidate-card-onnx') { args.candidateCardOnnxPath = path.resolve(process.cwd(), argv[++i]); specified.add('candidateCardOnnxPath'); continue; }
        if (a === '--candidate-card-onnx-meta') { args.candidateCardOnnxMetaPath = path.resolve(process.cwd(), argv[++i]); specified.add('candidateCardOnnxMetaPath'); continue; }
        if (a === '--candidate-target-onnx') { args.candidateTargetOnnxPath = path.resolve(process.cwd(), argv[++i]); specified.add('candidateTargetOnnxPath'); continue; }
        if (a === '--candidate-target-onnx-meta') { args.candidateTargetOnnxMetaPath = path.resolve(process.cwd(), argv[++i]); specified.add('candidateTargetOnnxMetaPath'); continue; }
        if (a === '--candidate-value-onnx') { args.candidateValueOnnxPath = path.resolve(process.cwd(), argv[++i]); specified.add('candidateValueOnnxPath'); continue; }
        if (a === '--candidate-value-onnx-meta') { args.candidateValueOnnxMetaPath = path.resolve(process.cwd(), argv[++i]); specified.add('candidateValueOnnxMetaPath'); continue; }
        if (a === '--target-onnx') { args.targetOnnxPath = path.resolve(process.cwd(), argv[++i]); specified.add('targetOnnxPath'); continue; }
        if (a === '--target-onnx-meta') { args.targetOnnxMetaPath = path.resolve(process.cwd(), argv[++i]); specified.add('targetOnnxMetaPath'); continue; }
        if (a === '--target-card-onnx') { args.targetCardOnnxPath = path.resolve(process.cwd(), argv[++i]); specified.add('targetCardOnnxPath'); continue; }
        if (a === '--target-card-onnx-meta') { args.targetCardOnnxMetaPath = path.resolve(process.cwd(), argv[++i]); specified.add('targetCardOnnxMetaPath'); continue; }
        if (a === '--target-target-onnx') { args.targetTargetOnnxPath = path.resolve(process.cwd(), argv[++i]); specified.add('targetTargetOnnxPath'); continue; }
        if (a === '--target-target-onnx-meta') { args.targetTargetOnnxMetaPath = path.resolve(process.cwd(), argv[++i]); specified.add('targetTargetOnnxMetaPath'); continue; }
        if (a === '--target-value-onnx') { args.targetValueOnnxPath = path.resolve(process.cwd(), argv[++i]); specified.add('targetValueOnnxPath'); continue; }
        if (a === '--target-value-onnx-meta') { args.targetValueOnnxMetaPath = path.resolve(process.cwd(), argv[++i]); specified.add('targetValueOnnxMetaPath'); continue; }
        if (a === '--resolved-config') { args.resolvedConfigPath = path.resolve(process.cwd(), argv[++i]); specified.add('resolvedConfigPath'); continue; }
        if (a === '--out' || a === '-o') { args.out = path.resolve(process.cwd(), argv[++i]); specified.add('out'); continue; }
        if (a === '--verbose') { args.verbose = true; continue; }
    }

    if (args.resolvedConfigPath) {
        const resolvedConfig = loadResolvedTrainingConfig(args.resolvedConfigPath);
        applyOnnxGateArgsFromResolvedConfig(args, specified, resolvedConfig);
    }

    if (args.help) return args;

    if (!Number.isFinite(args.games) || args.games < 1) throw new Error('--games must be >= 1');
    args.games = Math.floor(args.games);
    if (!Number.isFinite(args.seed)) throw new Error('--seed must be a number');
    if (!Number.isFinite(args.seedCount) || args.seedCount < 1) throw new Error('--seed-count must be >= 1');
    args.seedCount = Math.floor(args.seedCount);
    if (!Number.isFinite(args.seedStride) || args.seedStride < 1) throw new Error('--seed-stride must be >= 1');
    args.seedStride = Math.floor(args.seedStride);
    if (!Number.isFinite(args.jobs) || args.jobs < 1) throw new Error('--jobs must be >= 1');
    args.jobs = Math.floor(args.jobs);
    if (!Number.isFinite(args.threshold) || args.threshold < 0 || args.threshold > 1) throw new Error('--threshold must be in [0,1]');
    if (!Number.isFinite(args.minSeedScore) || args.minSeedScore < 0 || args.minSeedScore > 1) throw new Error('--min-seed-score must be in [0,1]');
    if (!Number.isFinite(args.minSeedPassCount) || args.minSeedPassCount < 0) throw new Error('--min-seed-pass-count must be >= 0');
    args.minSeedPassCount = Math.floor(args.minSeedPassCount);
    if (args.minSeedPassCount > args.seedCount) throw new Error('--min-seed-pass-count must be <= --seed-count');
    if (!Number.isFinite(args.maxAverageLatencyMs) || args.maxAverageLatencyMs < 0) throw new Error('--max-average-latency-ms must be >= 0');
    if (!Number.isFinite(args.maxP95LatencyMs) || args.maxP95LatencyMs < 0) throw new Error('--max-p95-latency-ms must be >= 0');
    if (!Number.isFinite(args.maxMaxLatencyMs) || args.maxMaxLatencyMs < 0) throw new Error('--max-max-latency-ms must be >= 0');
    if (!Number.isFinite(args.blackLevel) || args.blackLevel < 1 || args.blackLevel > 6) throw new Error('--black-level must be in [1,6]');
    if (!Number.isFinite(args.whiteLevel) || args.whiteLevel < 1 || args.whiteLevel > 6) throw new Error('--white-level must be in [1,6]');
    if (!['both', 'white'].includes(args.candidateColorMode)) {
        throw new Error('--candidate-color-mode must be one of: both, white');
    }
    if (!Number.isFinite(args.timeoutMs) || args.timeoutMs < 1000) throw new Error('--timeout-ms must be >= 1000');
    if (!Number.isFinite(args.matchRetries) || args.matchRetries < 0) throw new Error('--match-retries must be >= 0');
    args.matchRetries = Math.floor(args.matchRetries);
    if (!Number.isFinite(args.maxTotalMs) || args.maxTotalMs < 0) throw new Error('--max-total-ms must be >= 0');
    if (!args.candidateOnnxPath) throw new Error('--candidate-onnx is required');
    if (!args.candidateOnnxMetaPath) args.candidateOnnxMetaPath = `${args.candidateOnnxPath}.meta.json`;
    if (!fs.existsSync(args.candidateOnnxPath)) throw new Error(`candidate onnx not found: ${args.candidateOnnxPath}`);
    if (!fs.existsSync(args.candidateOnnxMetaPath)) throw new Error(`candidate onnx meta not found: ${args.candidateOnnxMetaPath}`);
    if (!args.targetOnnxPath) throw new Error('--target-onnx is required unless provided by --resolved-config');
    if (!args.targetOnnxMetaPath) throw new Error('--target-onnx-meta is required unless provided by --resolved-config');
    if (args.candidateCardOnnxPath || args.candidateCardOnnxMetaPath) {
        // The browser runtime cannot load or report a card head; never accept and then ignore it.
        GateContract.assertBrowserGateHeadsSupported(['card'], 'onnx-gate');
    }
    if (args.candidateTargetOnnxPath) {
        if (!args.targetTargetOnnxPath) throw new Error('--target-target-onnx is required when --candidate-target-onnx is provided or must come from --resolved-config');
        if (!args.targetTargetOnnxMetaPath) throw new Error('--target-target-onnx-meta is required when --candidate-target-onnx is provided or must come from --resolved-config');
    }
    if (args.candidateValueOnnxPath) {
        if (!args.targetValueOnnxPath) throw new Error('--target-value-onnx is required when --candidate-value-onnx is provided or must come from --resolved-config');
        if (!args.targetValueOnnxMetaPath) throw new Error('--target-value-onnx-meta is required when --candidate-value-onnx is provided or must come from --resolved-config');
    }
    if (args.candidateTargetOnnxPath) {
        if (!args.candidateTargetOnnxMetaPath) args.candidateTargetOnnxMetaPath = `${args.candidateTargetOnnxPath}.meta.json`;
        if (!fs.existsSync(args.candidateTargetOnnxPath)) throw new Error(`candidate target onnx not found: ${args.candidateTargetOnnxPath}`);
        if (!fs.existsSync(args.candidateTargetOnnxMetaPath)) throw new Error(`candidate target onnx meta not found: ${args.candidateTargetOnnxMetaPath}`);
    }
    if (args.candidateValueOnnxPath) {
        if (!args.candidateValueOnnxMetaPath) args.candidateValueOnnxMetaPath = `${args.candidateValueOnnxPath}.meta.json`;
        if (!fs.existsSync(args.candidateValueOnnxPath)) throw new Error(`candidate value onnx not found: ${args.candidateValueOnnxPath}`);
        if (!fs.existsSync(args.candidateValueOnnxMetaPath)) throw new Error(`candidate value onnx meta not found: ${args.candidateValueOnnxMetaPath}`);
    }

    return args;
}

function printHelp() {
    console.log([
        'Usage:',
        '  node scripts/benchmark-policy-onnx-gate.js [options]',
        '',
        'Options:',
        '  -g, --games <n>              Games per side/seed (default: 8)',
        '  -s, --seed <n>               Base seed (default: 1)',
        '      --seed-count <n>         Number of seeds to evaluate (default: 1)',
        '      --seed-stride <n>        Seed step between runs (default: 1000)',
        '  -j, --jobs <n>               Parallel match workers (default: auto, up to 12)',
        '      --threshold <r>          Required average score [0..1] (default: 0.5)',
        '      --min-seed-score <r>     Required minimum per-seed score [0..1] (default: 0)',
        '      --min-seed-pass-count <n> Required count of seeds scoring >= threshold (default: 0)',
        '      --max-average-latency-ms <n> Required max overall average inference latency in ms (default: 0=off)',
        '      --max-p95-latency-ms <n> Required max worst-match p95 inference latency in ms (default: 0=off)',
        '      --max-max-latency-ms <n> Required max peak inference latency in ms (default: 0=off)',
        '      --black-level <n>        Candidate side level when black (default: 6)',
        '      --white-level <n>        Baseline side level when white (default: 6)',
        '      --candidate-color-mode <m> Candidate side usage: both | white (default: both)',
        '      --timeout-ms <n>         Per-match timeout (default: 180000)',
        '      --match-retries <n>      Retry count for a failed match (default: 1)',
        '      --max-total-ms <n>       Total gate time budget in ms (default: 900000, 0=off)',
        '      --candidate-onnx <path>  Candidate ONNX file path (required)',
        '      --candidate-onnx-meta <path> Candidate ONNX meta path (default: <candidate>.meta.json)',
        '      --candidate-card-onnx <path> Rejected: the card head is research-only and the browser runtime cannot verify it',
        '      --candidate-target-onnx <path> Optional candidate pending-target ONNX path',
        '      --candidate-target-onnx-meta <path> Candidate pending-target meta path (default: <candidate-target>.meta.json)',
        '      --candidate-value-onnx <path> Optional candidate value ONNX path',
        '      --candidate-value-onnx-meta <path> Candidate value meta path (default: <candidate-value>.meta.json)',
        '      --target-onnx <path>     Deployed ONNX path used by browser runtime (required unless --resolved-config)',
        '      --target-onnx-meta <path> Deployed ONNX meta path used by browser runtime (required unless --resolved-config)',
        '      --target-card-onnx <path> Deployed card-specialist ONNX path used by browser runtime',
        '      --target-card-onnx-meta <path> Deployed card-specialist meta path used by browser runtime',
        '      --target-target-onnx <path> Deployed pending-target ONNX path used by browser runtime',
        '      --target-target-onnx-meta <path> Deployed pending-target ONNX meta path used by browser runtime',
        '      --target-value-onnx <path> Deployed value ONNX path used by browser runtime',
        '      --target-value-onnx-meta <path> Deployed value ONNX meta path used by browser runtime',
        '      --resolved-config <path> Apply defaults from a resolved training profile JSON',
        '  -o, --out <path>             Optional JSON output path',
        '      --verbose                Print match-level logs',
        '  -h, --help                   Show this help'
    ].join('\n'));
}

const MODEL_ASSET_MANIFEST_SCHEMA_VERSION = 'model_assets.v1';
const MODEL_ASSET_MANIFEST_FILE = 'model-assets.json';

function normalizeModelAssetManifestPath(filePath: any, cwd: string = process.cwd()) {
    const raw = String(filePath || '').trim();
    if (!raw) return '';
    const relativePath = path.isAbsolute(raw) ? path.relative(cwd, raw) : raw;
    return relativePath.replace(/\\/g, '/').replace(/^\.\//, '').replace(/^\/+/, '');
}

function buildPatchedModelAssetManifestPayload(existingPayload: any, assetPaths: any[], cwd: string = process.cwd()) {
    const files: string[] = [];
    const seen = new Set<string>();
    const add = (value: any) => {
        const normalized = normalizeModelAssetManifestPath(value, cwd);
        if (!normalized || seen.has(normalized)) return;
        seen.add(normalized);
        files.push(normalized);
    };

    if (
        existingPayload &&
        existingPayload.schemaVersion === MODEL_ASSET_MANIFEST_SCHEMA_VERSION &&
        Array.isArray(existingPayload.files)
    ) {
        for (const filePath of existingPayload.files) add(filePath);
    }

    for (const assetPath of assetPaths || []) add(assetPath);

    return {
        schemaVersion: MODEL_ASSET_MANIFEST_SCHEMA_VERSION,
        generatedAt: existingPayload && existingPayload.generatedAt
            ? existingPayload.generatedAt
            : new Date().toISOString(),
        files
    };
}

function readModelAssetManifestPayload(manifestPath: string) {
    if (!fs.existsSync(manifestPath)) return null;
    try {
        return JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    } catch (_err) {
        return null;
    }
}

function sha256File(filePath: string) {
    return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

/**
 * Builds a gate-only model bundle. The browser page loads data/models/<file> exactly as in normal
 * play; run-ui-level-match serves this bundle's files in place of those paths, so the page reads
 * the candidate while the root delivery directory (and every other lane) is never written.
 */
function createOnnxGateModelBundle(descriptors: any[], options: { serveRoot?: string; baseDir?: string } = {}) {
    const serveRoot = path.resolve(options.serveRoot || process.cwd());
    const dir = fs.mkdtempSync(path.join(options.baseDir || os.tmpdir(), 'onnx-gate-bundle-'));
    const files: Array<{ head: string; kind: 'model' | 'meta'; urlPath: string; sourcePath: string; sha256: string }> = [];
    try {
        for (const descriptor of descriptors) {
            for (const [kind, sourcePath, targetPath] of [
                ['model', descriptor.candidatePath, descriptor.targetPath],
                ['meta', descriptor.candidateMetaPath, descriptor.targetMetaPath]
            ] as const) {
                if (!sourcePath || !targetPath) throw new Error(`[onnx-gate] ${descriptor.key} ${kind} path is required`);
                const urlPath = `data/models/${path.basename(targetPath)}`;
                const bundlePath = path.join(dir, ...urlPath.split('/'));
                fs.mkdirSync(path.dirname(bundlePath), { recursive: true });
                fs.copyFileSync(sourcePath, bundlePath);
                files.push({ head: descriptor.key, kind, urlPath, sourcePath: path.resolve(sourcePath), sha256: sha256File(bundlePath) });
            }
        }
        const rootManifestPath = path.join(serveRoot, 'data', 'models', MODEL_ASSET_MANIFEST_FILE);
        const manifest = buildPatchedModelAssetManifestPayload(
            readModelAssetManifestPayload(rootManifestPath),
            files.map((file) => file.urlPath),
            serveRoot
        );
        fs.writeFileSync(path.join(dir, 'data', 'models', MODEL_ASSET_MANIFEST_FILE), JSON.stringify(manifest, null, 2), 'utf8');
    } catch (err) {
        fs.rmSync(dir, { recursive: true, force: true });
        throw err;
    }
    return {
        dir,
        files,
        cleanup() {
            fs.rmSync(dir, { recursive: true, force: true });
        }
    };
}

/** Model files of the bundle that the page did not read with the bundle's exact bytes. */
function findUnverifiedBundleModels(bundle: any, matchPayload: any, heads: readonly string[]) {
    const served = matchPayload && matchPayload.modelOverlay && Array.isArray(matchPayload.modelOverlay.served)
        ? matchPayload.modelOverlay.served
        : [];
    return bundle.files
        .filter((file: any) => file.kind === 'model' && heads.includes(file.head))
        .filter((file: any) => !served.some((entry: any) => entry && entry.path === file.urlPath && entry.sha256 === file.sha256))
        .map((file: any) => file.urlPath);
}

const ONNX_ARTIFACT_VARIANTS = Object.freeze([
    Object.freeze({
        key: 'primary',
        candidatePathKey: 'candidateOnnxPath',
        candidateMetaPathKey: 'candidateOnnxMetaPath',
        targetPathKey: 'targetOnnxPath',
        targetMetaPathKey: 'targetOnnxMetaPath',
        required: true
    }),
    Object.freeze({
        key: 'target',
        candidatePathKey: 'candidateTargetOnnxPath',
        candidateMetaPathKey: 'candidateTargetOnnxMetaPath',
        targetPathKey: 'targetTargetOnnxPath',
        targetMetaPathKey: 'targetTargetOnnxMetaPath',
        required: false
    }),
    Object.freeze({
        key: 'value',
        candidatePathKey: 'candidateValueOnnxPath',
        candidateMetaPathKey: 'candidateValueOnnxMetaPath',
        targetPathKey: 'targetValueOnnxPath',
        targetMetaPathKey: 'targetValueOnnxMetaPath',
        required: false
    })
]);

function buildOnnxArtifactDescriptors(options: any) {
    return ONNX_ARTIFACT_VARIANTS.map((variant: any) => {
        const candidatePath = options[variant.candidatePathKey] || null;
        const candidateMetaPath = options[variant.candidateMetaPathKey] || null;
        const targetPath = options[variant.targetPathKey] || null;
        const targetMetaPath = options[variant.targetMetaPathKey] || null;
        if (!variant.required && !candidatePath) return null;
        return {
            key: variant.key,
            candidatePath,
            candidateMetaPath,
            targetPath,
            targetMetaPath
        };
    }).filter(Boolean);
}

function scoreWinnerForCandidate(winner: any, candidateColor: any) {
    if (winner === 'draw') return 0.5;
    return winner === candidateColor ? 1 : 0;
}

function collectOnnxDiagnostics(matchPayload: any) {
    const runtime = matchPayload && matchPayload.runtimeStatus ? matchPayload.runtimeStatus : {};
    const onnxStatus = runtime.onnx && typeof runtime.onnx === 'object' ? runtime.onnx : null;
    const onnxLoaded = !!(onnxStatus && onnxStatus.loaded === true);
    const cardModelLoaded = !!(
        onnxStatus && (
            onnxStatus.cardModelLoaded === true ||
            onnxStatus.hasCardHead === true
        )
    );
    const targetModelLoaded = !!(onnxStatus && onnxStatus.targetModelLoaded === true);
    const valueModelLoaded = !!(onnxStatus && onnxStatus.valueModelLoaded === true);
    const latencyStatus = onnxStatus && onnxStatus.latency && typeof onnxStatus.latency === 'object'
        ? onnxStatus.latency
        : null;
    const overallLatency = latencyStatus && latencyStatus.overall && typeof latencyStatus.overall === 'object'
        ? latencyStatus.overall
        : null;
    const logs = Array.isArray(matchPayload && matchPayload.consoleMessages) ? matchPayload.consoleMessages : [];
    let runtimeErrorCount = 0;
    let cardRuntimeErrorCount = 0;
    let targetRuntimeErrorCount = 0;
    let valueRuntimeErrorCount = 0;
    for (const log of logs) {
        const text = String(log && log.text ? log.text : '');
        if (!text) continue;
        if (text.includes('[CPU] policy-onnx runtime failed')) runtimeErrorCount += 1;
        if (text.includes('[CPU] policy-onnx not loaded')) runtimeErrorCount += 1;
        if (text.includes('[CPU] policy-onnx loading failed')) runtimeErrorCount += 1;
        if (text.includes('[CPU] policy-card runtime failed')) cardRuntimeErrorCount += 1;
        if (text.includes('[CPU] policy-onnx card runtime failed')) cardRuntimeErrorCount += 1;
        if (text.includes('[CPU] policy-card not loaded')) cardRuntimeErrorCount += 1;
        if (text.includes('[CPU] policy-card loading failed')) cardRuntimeErrorCount += 1;
        if (text.includes('[CPU] policy-onnx pending runtime failed')) targetRuntimeErrorCount += 1;
        if (text.includes('[CPU] policy-target runtime failed')) targetRuntimeErrorCount += 1;
        if (text.includes('[CPU] policy-target not loaded')) targetRuntimeErrorCount += 1;
        if (text.includes('[CPU] policy-target loading failed')) targetRuntimeErrorCount += 1;
        if (text.includes('[CPU] policy-value runtime failed')) valueRuntimeErrorCount += 1;
        if (text.includes('[CPU] policy-value not loaded')) valueRuntimeErrorCount += 1;
        if (text.includes('[CPU] policy-value loading failed')) valueRuntimeErrorCount += 1;
    }
    return {
        onnxLoaded,
        runtimeErrorCount,
        cardModelLoaded,
        cardRuntimeErrorCount,
        targetModelLoaded,
        targetRuntimeErrorCount,
        valueModelLoaded,
        valueRuntimeErrorCount,
        latencyCallCount: Number(overallLatency && overallLatency.count) || 0,
        latencyTotalMs: Number(overallLatency && overallLatency.totalMs) || 0,
        averageLatencyMs: Number(overallLatency && overallLatency.averageMs) || 0,
        p95LatencyMs: Number(overallLatency && overallLatency.p95Ms) || 0,
        maxLatencyMs: Number(overallLatency && overallLatency.maxMs) || 0
    };
}

function computeOnnxGateDecision(perSeed: any, options: any, diagnostics: any) {
    const requireCardLoaded = !!(diagnostics && diagnostics.requireCardLoaded);
    const requireTargetLoaded = !!(diagnostics && diagnostics.requireTargetLoaded);
    const requireValueLoaded = !!(diagnostics && diagnostics.requireValueLoaded);
    if (!Array.isArray(perSeed) || perSeed.length <= 0) {
        return {
            averageScore: 0,
            minSeedScore: 0,
            threshold: options.threshold,
            requiredMinSeedScore: options.minSeedScore,
            requiredMinSeedPassCount: options.minSeedPassCount,
            seedCount: 0,
            seedPassCount: 0,
            onnxLoadedMatches: 0,
            cardLoadedMatches: 0,
            targetLoadedMatches: 0,
            valueLoadedMatches: 0,
            totalMatches: 0,
            runtimeErrorCount: 0,
            cardRuntimeErrorCount: 0,
            targetRuntimeErrorCount: 0,
            valueRuntimeErrorCount: 0,
            matchErrorCount: 0,
            averageLatencyMs: 0,
            worstP95LatencyMs: 0,
            maxLatencyMs: 0,
            latencyCallCount: 0,
            requiredMaxAverageLatencyMs: options.maxAverageLatencyMs,
            requiredMaxP95LatencyMs: options.maxP95LatencyMs,
            requiredMaxMaxLatencyMs: options.maxMaxLatencyMs,
            passedByAverage: false,
            passedByMinSeedScore: false,
            passedBySeedPassCount: false,
            passedByOnnxLoaded: false,
            passedByNoRuntimeErrors: false,
            passedByCardLoaded: !requireCardLoaded,
            passedByNoCardRuntimeErrors: !requireCardLoaded,
            passedByTargetLoaded: !requireTargetLoaded,
            passedByNoTargetRuntimeErrors: !requireTargetLoaded,
            passedByValueLoaded: !requireValueLoaded,
            passedByNoValueRuntimeErrors: !requireValueLoaded,
            passedByNoMatchErrors: false,
            passedByAverageLatency: options.maxAverageLatencyMs <= 0,
            passedByP95Latency: options.maxP95LatencyMs <= 0,
            passedByMaxLatency: options.maxMaxLatencyMs <= 0,
            passed: false
        };
    }

    let scoreSum = 0;
    let minSeedScore = Infinity;
    let seedPassCount = 0;
    for (const one of perSeed) {
        const score = Number(one && one.candidateScore) || 0;
        scoreSum += score;
        if (score < minSeedScore) minSeedScore = score;
        if (score >= options.threshold) seedPassCount += 1;
    }
    if (!Number.isFinite(minSeedScore)) minSeedScore = 0;
    const averageScore = scoreSum / perSeed.length;

    const totalMatches = Number(diagnostics && diagnostics.totalMatches) || 0;
    const onnxLoadedMatches = Number(diagnostics && diagnostics.onnxLoadedMatches) || 0;
    const cardLoadedMatches = Number(diagnostics && diagnostics.cardLoadedMatches) || 0;
    const targetLoadedMatches = Number(diagnostics && diagnostics.targetLoadedMatches) || 0;
    const valueLoadedMatches = Number(diagnostics && diagnostics.valueLoadedMatches) || 0;
    const runtimeErrorCount = Number(diagnostics && diagnostics.runtimeErrorCount) || 0;
    const cardRuntimeErrorCount = Number(diagnostics && diagnostics.cardRuntimeErrorCount) || 0;
    const targetRuntimeErrorCount = Number(diagnostics && diagnostics.targetRuntimeErrorCount) || 0;
    const valueRuntimeErrorCount = Number(diagnostics && diagnostics.valueRuntimeErrorCount) || 0;
    const matchErrorCount = Number(diagnostics && diagnostics.matchErrorCount) || 0;
    const latencyCallCount = Number(diagnostics && diagnostics.latencyCallCount) || 0;
    const latencyTotalMs = Number(diagnostics && diagnostics.latencyTotalMs) || 0;
    const averageLatencyMs = latencyCallCount > 0 ? (latencyTotalMs / latencyCallCount) : 0;
    const worstP95LatencyMs = Number(diagnostics && diagnostics.latencyP95Ms) || 0;
    const maxLatencyMs = Number(diagnostics && diagnostics.latencyMaxMs) || 0;

    const passedByAverage = averageScore >= options.threshold;
    const passedByMinSeedScore = minSeedScore >= options.minSeedScore;
    const passedBySeedPassCount = seedPassCount >= options.minSeedPassCount;
    const passedByOnnxLoaded = totalMatches > 0 && onnxLoadedMatches >= totalMatches;
    const passedByCardLoaded = !requireCardLoaded || (totalMatches > 0 && cardLoadedMatches >= totalMatches);
    const passedByNoRuntimeErrors = runtimeErrorCount === 0;
    const passedByNoCardRuntimeErrors = !requireCardLoaded || cardRuntimeErrorCount === 0;
    const passedByTargetLoaded = !requireTargetLoaded || (totalMatches > 0 && targetLoadedMatches >= totalMatches);
    const passedByNoTargetRuntimeErrors = !requireTargetLoaded || targetRuntimeErrorCount === 0;
    const passedByValueLoaded = !requireValueLoaded || (totalMatches > 0 && valueLoadedMatches >= totalMatches);
    const passedByNoValueRuntimeErrors = !requireValueLoaded || valueRuntimeErrorCount === 0;
    const passedByNoMatchErrors = matchErrorCount === 0;
    // Every match must have loaded the candidate bytes from the gate bundle (never another lane or root).
    const modelIdentityMismatchCount = Number(diagnostics && diagnostics.modelIdentityMismatchCount) || 0;
    const passedByModelIdentity = modelIdentityMismatchCount === 0;
    const passedByAverageLatency = options.maxAverageLatencyMs <= 0
        ? true
        : (latencyCallCount > 0 && averageLatencyMs <= options.maxAverageLatencyMs);
    const passedByP95Latency = options.maxP95LatencyMs <= 0
        ? true
        : (latencyCallCount > 0 && worstP95LatencyMs <= options.maxP95LatencyMs);
    const passedByMaxLatency = options.maxMaxLatencyMs <= 0
        ? true
        : (latencyCallCount > 0 && maxLatencyMs <= options.maxMaxLatencyMs);
    const passed = passedByAverage &&
        passedByMinSeedScore &&
        passedBySeedPassCount &&
        passedByOnnxLoaded &&
        passedByCardLoaded &&
        passedByNoRuntimeErrors &&
        passedByNoCardRuntimeErrors &&
        passedByTargetLoaded &&
        passedByNoTargetRuntimeErrors &&
        passedByValueLoaded &&
        passedByNoValueRuntimeErrors &&
        passedByNoMatchErrors &&
        passedByModelIdentity &&
        passedByAverageLatency &&
        passedByP95Latency &&
        passedByMaxLatency;

    return {
        averageScore,
        minSeedScore,
        threshold: options.threshold,
        requiredMinSeedScore: options.minSeedScore,
        requiredMinSeedPassCount: options.minSeedPassCount,
        seedCount: perSeed.length,
        seedPassCount,
        onnxLoadedMatches,
        cardLoadedMatches,
        targetLoadedMatches,
        valueLoadedMatches,
        totalMatches,
        runtimeErrorCount,
        cardRuntimeErrorCount,
        targetRuntimeErrorCount,
        valueRuntimeErrorCount,
        matchErrorCount,
        averageLatencyMs,
        worstP95LatencyMs,
        maxLatencyMs,
        latencyCallCount,
        requiredMaxAverageLatencyMs: options.maxAverageLatencyMs,
        requiredMaxP95LatencyMs: options.maxP95LatencyMs,
        requiredMaxMaxLatencyMs: options.maxMaxLatencyMs,
        passedByAverage,
        passedByMinSeedScore,
        passedBySeedPassCount,
        passedByOnnxLoaded,
        passedByCardLoaded,
        passedByNoRuntimeErrors,
        passedByNoCardRuntimeErrors,
        passedByTargetLoaded,
        passedByNoTargetRuntimeErrors,
        passedByValueLoaded,
        passedByNoValueRuntimeErrors,
        passedByNoMatchErrors,
        passedByModelIdentity,
        modelIdentityMismatchCount,
        passedByAverageLatency,
        passedByP95Latency,
        passedByMaxLatency,
        passed
    };
}

function buildUiLevelMatchArgs(options: any, outPath: any) {
    const heads = ['primary'];
    if (options.requireCardModelLoaded) heads.push('card');
    if (options.requireTargetModelLoaded) heads.push('target');
    if (options.requireValueModelLoaded) heads.push('value');
    const args = [
        path.resolve('scripts', 'run-ui-level-match.js'),
        '--black', String(options.blackLevel),
        '--white', String(options.whiteLevel),
        '--seed', String(options.seed),
        '--timeout-ms', String(options.timeoutMs),
        // Wait flags come from the shared browser gate contract; an unsupported head throws here.
        ...GateContract.buildBrowserGateRequireFlags(heads)
    ];
    if (options.modelOverlayDir) args.push('--model-overlay-dir', options.modelOverlayDir);

    args.push(
        '--onnx-wait-ms', String(options.onnxWaitMs || Math.max(10000, Math.floor(options.timeoutMs * 0.5))),
        '--out', outPath
    );

    return args;
}

function runUiLevelMatch(options: any) {
    const outPath = path.resolve(
        process.cwd(),
        'data',
        'runs',
        `onnx-gate.match.${process.pid}.${Date.now()}.${Math.floor(Math.random() * 100000)}.json`
    );
    const args = buildUiLevelMatchArgs(options, outPath);
    const shown = [process.execPath].concat(args).join(' ');
    if (options.verbose) console.log(`[onnx-gate] run: ${shown}`);
    const spawnTimeoutMs = Math.max(120000, options.timeoutMs + 60000);

    return new Promise((resolve: any, reject: any) => {
        let stderr = '';
        const child = spawn(process.execPath, args, {
            cwd: process.cwd(),
            env: process.env,
            stdio: options.verbose ? 'inherit' : 'pipe',
            timeout: spawnTimeoutMs,
            killSignal: 'SIGKILL'
        });

        if (!options.verbose && child.stderr) {
            child.stderr.on('data', (chunk: any) => { stderr += String(chunk); });
        }
        child.once('error', (err: any) => {
            reject(err);
        });
        child.once('close', (code: any, signal: any) => {
            if (code !== 0) {
                const timeoutLike = code === null && signal === 'SIGKILL';
                if (timeoutLike) {
                    reject(new Error(`run-ui-level-match timed out (spawn timeout ${spawnTimeoutMs}ms, game timeout ${options.timeoutMs}ms)`));
                    return;
                }
                const suffix = stderr.trim();
                reject(new Error(`run-ui-level-match failed (exit=${code} signal=${signal || 'none'}) ${suffix}`));
                return;
            }
            try {
                const payload = JSON.parse(fs.readFileSync(outPath, 'utf8'));
                resolve(payload);
            } catch (err) {
                reject(err);
            } finally {
                try { fs.unlinkSync(outPath); } catch (e) { /* ignore */ }
            }
        });
    });
}

function buildMatchTasks(options: any, seeds: any) {
    const gamesPerSeed = Number.isFinite(Number(options && options.games))
        ? Math.max(0, Math.floor(Number(options.games)))
        : 0;
    const tasks = [];
    for (let seedIndex = 0; seedIndex < seeds.length; seedIndex++) {
        const seed = seeds[seedIndex];
        for (let gameIndex = 0; gameIndex < gamesPerSeed; gameIndex++) {
            const gameSeed = seed + gameIndex;
            if (options.candidateColorMode !== 'white') {
                tasks.push({
                    seedIndex,
                    seed,
                    gameSeed,
                    candidateColor: 'black',
                    blackLevel: options.blackLevel,
                    whiteLevel: options.whiteLevel
                });
            }
            tasks.push({
                seedIndex,
                seed,
                gameSeed,
                candidateColor: 'white',
                blackLevel: options.whiteLevel,
                whiteLevel: options.blackLevel
            });
        }
    }
    return tasks;
}

async function runOnnxGate(options: any, hooks: any = {}) {
    if (options.candidateCardOnnxPath) GateContract.assertBrowserGateHeadsSupported(['card'], 'onnx-gate');
    // The card head is research-only and never part of the browser gate (see policy-onnx-browser-gate-contract).
    const requireCardLoaded = false;
    const requireTargetLoaded = !!options.candidateTargetOnnxPath;
    const requireValueLoaded = !!options.candidateValueOnnxPath;
    const verifiedHeads = ['primary', ...(requireTargetLoaded ? ['target'] : []), ...(requireValueLoaded ? ['value'] : [])];
    const runMatch = typeof hooks.runUiLevelMatch === 'function' ? hooks.runUiLevelMatch : runUiLevelMatch;
    const artifactDescriptors = buildOnnxArtifactDescriptors(options);
    const seeds = buildSeedList(options.seed, options.seedCount, options.seedStride);
    const seedState = seeds.map((seed: any) => ({
        seed,
        scoreSum: 0,
        matchCount: 0,
        totals: { win: 0, draw: 0, loss: 0 }
    }));
    const diagnostics = {
        totalMatches: 0,
        onnxLoadedMatches: 0,
        cardLoadedMatches: 0,
        targetLoadedMatches: 0,
        valueLoadedMatches: 0,
        runtimeErrorCount: 0,
        cardRuntimeErrorCount: 0,
        targetRuntimeErrorCount: 0,
        valueRuntimeErrorCount: 0,
        matchErrorCount: 0,
        matchRetryCount: 0,
        latencyCallCount: 0,
        latencyTotalMs: 0,
        latencyP95Ms: 0,
        latencyMaxMs: 0,
        maxTotalMs: options.maxTotalMs,
        timedOut: false,
        requireCardLoaded,
        requireTargetLoaded,
        requireValueLoaded,
        modelIdentityMismatchCount: 0,
        modelIdentityMismatches: [] as string[]
    };
    const gateStartedAt = Date.now();
    const bundle = createOnnxGateModelBundle(artifactDescriptors, { serveRoot: hooks.serveRoot, baseDir: hooks.bundleBaseDir });

    try {

        const tasks = buildMatchTasks(options, seeds);
        const jobs = Math.max(1, Math.min(options.jobs, tasks.length));
        let cursor = 0;

        const runWorker = async () => {
            while (true) {
                if (diagnostics.timedOut) return;
                const taskIndex = cursor;
                if (taskIndex >= tasks.length) return;
                cursor += 1;

                if (options.maxTotalMs > 0 && (Date.now() - gateStartedAt) >= options.maxTotalMs) {
                    diagnostics.timedOut = true;
                    diagnostics.matchErrorCount += 1;
                    return;
                }

                const task = tasks[taskIndex];
                const state = seedState[task.seedIndex];
                if (!options.verbose) {
                    console.log(`[onnx-gate] match-start seed=${task.gameSeed} candidateColor=${task.candidateColor} totalMatches=${diagnostics.totalMatches + 1}`);
                }
                diagnostics.totalMatches += 1;
                state.matchCount += 1;
                let completed = false;
                let attempt = 0;
                const maxAttempts = 1 + Math.max(0, Number(options.matchRetries) || 0);
                while (!completed && attempt < maxAttempts) {
                    attempt += 1;
                    try {
                    const payload: any = await runMatch({
                        blackLevel: task.blackLevel,
                        whiteLevel: task.whiteLevel,
                        seed: task.gameSeed,
                        timeoutMs: options.timeoutMs,
                        onnxWaitMs: Math.max(10000, Math.min(options.timeoutMs, 45000)),
                        requireTargetModelLoaded: requireTargetLoaded,
                        requireValueModelLoaded: requireValueLoaded,
                        modelOverlayDir: bundle.dir,
                        verbose: options.verbose
                    });
                        // The page must have read exactly the candidate bytes of every verified head.
                        const unverified = findUnverifiedBundleModels(bundle, payload, verifiedHeads);
                        if (unverified.length > 0) {
                            diagnostics.modelIdentityMismatchCount += 1;
                            for (const urlPath of unverified) {
                                if (!diagnostics.modelIdentityMismatches.includes(urlPath)) diagnostics.modelIdentityMismatches.push(urlPath);
                            }
                        }
                        const score = scoreWinnerForCandidate(payload.result.winner, task.candidateColor);
                        state.scoreSum += score;
                        if (score === 1) state.totals.win += 1;
                        else if (score === 0.5) state.totals.draw += 1;
                        else state.totals.loss += 1;

                        const diag = collectOnnxDiagnostics(payload);
                        if (diag.onnxLoaded) diagnostics.onnxLoadedMatches += 1;
                        if (requireCardLoaded && diag.cardModelLoaded) diagnostics.cardLoadedMatches += 1;
                        if (requireTargetLoaded && diag.targetModelLoaded) diagnostics.targetLoadedMatches += 1;
                        if (requireValueLoaded && diag.valueModelLoaded) diagnostics.valueLoadedMatches += 1;
                        diagnostics.runtimeErrorCount += diag.runtimeErrorCount;
                        diagnostics.cardRuntimeErrorCount += diag.cardRuntimeErrorCount;
                        diagnostics.targetRuntimeErrorCount += diag.targetRuntimeErrorCount;
                        diagnostics.valueRuntimeErrorCount += diag.valueRuntimeErrorCount;
                        diagnostics.latencyCallCount += diag.latencyCallCount;
                        diagnostics.latencyTotalMs += diag.latencyTotalMs;
                        diagnostics.latencyP95Ms = Math.max(diagnostics.latencyP95Ms, diag.p95LatencyMs);
                        diagnostics.latencyMaxMs = Math.max(diagnostics.latencyMaxMs, diag.maxLatencyMs);
                        completed = true;
                    } catch (err) {
                        const msg = err && err.message ? err.message : String(err);
                        const hasRetry = attempt < maxAttempts;
                        if (hasRetry) {
                            diagnostics.matchRetryCount += 1;
                            if (options.verbose) {
                                console.warn(`[onnx-gate] match retry ${attempt}/${maxAttempts - 1} seed=${task.gameSeed} candidateColor=${task.candidateColor}: ${msg}`);
                            }
                            continue;
                        }
                        diagnostics.matchErrorCount += 1;
                        state.totals.loss += 1;
                        if (msg.includes('timed out')) diagnostics.timedOut = true;
                        if (options.verbose) {
                            console.warn(`[onnx-gate] match failed seed=${task.gameSeed} candidateColor=${task.candidateColor}: ${msg}`);
                        }
                        completed = true;
                    }
                }
                if (!options.verbose && diagnostics.totalMatches > 0 && (diagnostics.totalMatches % 8) === 0) {
                    console.log(`[onnx-gate] progress matches=${diagnostics.totalMatches} timedOut=${diagnostics.timedOut}`);
                }
            }
        };

        const workers = [];
        for (let i = 0; i < jobs; i++) workers.push(runWorker());
        await Promise.all(workers);
    } finally {
        bundle.cleanup();
    }

    const perSeed = [];
    for (const state of seedState) {
        if (state.matchCount <= 0) continue;
        perSeed.push({
            seed: state.seed,
            candidateScore: state.matchCount > 0 ? (state.scoreSum / state.matchCount) : 0,
            matches: state.matchCount,
            totals: state.totals
        });
    }

    const decision = computeOnnxGateDecision(perSeed, options, diagnostics);
    const seedSchedule = buildSeedSchedule(
        options.seed,
        options.seedCount,
        options.seedStride,
        perSeed.map((entry: any) => entry && entry.seed)
    );
    return {
        generatedAt: new Date().toISOString(),
        config: {
            games: options.games,
            seed: options.seed,
            seedCount: options.seedCount,
            seedStride: options.seedStride,
            jobs: options.jobs,
            threshold: options.threshold,
            minSeedScore: options.minSeedScore,
            minSeedPassCount: options.minSeedPassCount,
            maxAverageLatencyMs: options.maxAverageLatencyMs,
            maxP95LatencyMs: options.maxP95LatencyMs,
            maxMaxLatencyMs: options.maxMaxLatencyMs,
            blackLevel: options.blackLevel,
            whiteLevel: options.whiteLevel,
            candidateColorMode: options.candidateColorMode,
            timeoutMs: options.timeoutMs,
            matchRetries: options.matchRetries,
            maxTotalMs: options.maxTotalMs,
            candidateOnnxPath: options.candidateOnnxPath,
            candidateOnnxMetaPath: options.candidateOnnxMetaPath,
            candidateCardOnnxPath: options.candidateCardOnnxPath || null,
            candidateCardOnnxMetaPath: options.candidateCardOnnxMetaPath || null,
            candidateTargetOnnxPath: options.candidateTargetOnnxPath || null,
            candidateTargetOnnxMetaPath: options.candidateTargetOnnxMetaPath || null,
            candidateValueOnnxPath: options.candidateValueOnnxPath || null,
            candidateValueOnnxMetaPath: options.candidateValueOnnxMetaPath || null
        },
        seedSchedule,
        perSeed,
        modelBundle: {
            isolation: 'gate-only-overlay',
            files: bundle.files.map((file: any) => ({ head: file.head, kind: file.kind, urlPath: file.urlPath, sourcePath: file.sourcePath, sha256: file.sha256 }))
        },
        diagnostics,
        decision
    };
}

async function main() {
    const args = parseArgs(process.argv.slice(2));
    if (args.help) { printHelp(); return; }
    const payload = await runOnnxGate(args);
    if (args.out) {
        fs.mkdirSync(path.dirname(args.out), { recursive: true });
        fs.writeFileSync(args.out, JSON.stringify(payload, null, 2), 'utf8');
        console.log(`[onnx-gate] wrote: ${args.out}`);
    }
    const d = payload.decision;
    console.log(
        `[onnx-gate] avg=${d.averageScore.toFixed(3)} min_seed=${d.minSeedScore.toFixed(3)} threshold=${d.threshold.toFixed(3)} ` +
        `seed_pass=${d.seedPassCount}/${d.seedCount} onnx_loaded=${d.onnxLoadedMatches}/${d.totalMatches} ` +
        `latency_avg=${d.averageLatencyMs.toFixed(2)}ms latency_p95=${d.worstP95LatencyMs.toFixed(2)}ms latency_max=${d.maxLatencyMs.toFixed(2)}ms ` +
        `card_loaded=${d.cardLoadedMatches}/${d.totalMatches} target_loaded=${d.targetLoadedMatches}/${d.totalMatches} ` +
        `value_loaded=${d.valueLoadedMatches}/${d.totalMatches} runtime_errors=${d.runtimeErrorCount} ` +
        `card_runtime_errors=${d.cardRuntimeErrorCount} target_runtime_errors=${d.targetRuntimeErrorCount} ` +
        `value_runtime_errors=${d.valueRuntimeErrorCount} match_errors=${d.matchErrorCount} pass=${d.passed}`
    );
    process.exit(d.passed ? 0 : 2);
}

if (require.main === module) {
    main().catch((err: any) => {
        console.error('[onnx-gate] failed:', err && err.message ? err.message : err);
        process.exit(1);
    });
}

export = {
    parseArgs,
    buildSeedList,
    buildOnnxArtifactDescriptors,
    createOnnxGateModelBundle,
    findUnverifiedBundleModels,
    buildPatchedModelAssetManifestPayload,
    buildUiLevelMatchArgs,
    collectOnnxDiagnostics,
    computeOnnxGateDecision,
    runOnnxGate
};
