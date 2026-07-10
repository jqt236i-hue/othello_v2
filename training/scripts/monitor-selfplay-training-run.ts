#!/usr/bin/env node
'use strict';

import * as fs from 'fs';
import * as path from 'path';

declare const __non_webpack_require__: NodeRequire | undefined;

const _require: NodeRequire = (typeof __non_webpack_require__ !== 'undefined')
  ? __non_webpack_require__
  : require;

const DEFAULT_TAIL_LINES = 8;
const DEFAULT_WATCH_INTERVAL_MS = 5000;
const DEFAULT_TAIL_READ_BYTES = 512 * 1024;

const PHASE_LABELS = Object.freeze({
    'generate-train': '自己対局(train)',
    'generate-eval': '自己対局(eval)',
    'train-policy': '方策学習',
    'evaluate-policy': '候補評価',
    'train-card-policy': 'カード学習',
    'train-target-policy': '対象学習',
    'train-value-policy': '価値学習',
    'adoption-quick': '事前判定(quick)',
    'adoption-quality-gate': '品質 gate',
    'adoption-final': '最終判定(final)',
    'adoption-onnx-gate': 'ONNX gate',
    'promote-model': '昇格反映',
    'iteration-start': '反復開始',
    'iteration-done': '反復完了'
});

function parseArgs(argv: string[]) {
    const args = {
        profile: null,
        runTag: null,
        runsDir: null,
        runDir: null,
        watch: false,
        intervalMs: DEFAULT_WATCH_INTERVAL_MS,
        tailLines: DEFAULT_TAIL_LINES,
        json: false,
        help: false
    };

    for (let i = 0; i < argv.length; i += 1) {
        const token = String(argv[i] || '').trim();
        if (!token) continue;
        if (token === '--help' || token === '-h') {
            args.help = true;
            continue;
        }
        if (token === '--profile') {
            args.profile = String(argv[++i] || '').trim() || null;
            continue;
        }
        if (token === '--run-tag') {
            args.runTag = String(argv[++i] || '').trim() || null;
            continue;
        }
        if (token === '--runs-dir') {
            args.runsDir = String(argv[++i] || '').trim() || null;
            continue;
        }
        if (token === '--run-dir') {
            args.runDir = String(argv[++i] || '').trim() || null;
            continue;
        }
        if (token === '--watch') {
            args.watch = true;
            continue;
        }
        if (token === '--interval-ms') {
            args.intervalMs = Number(argv[++i]);
            continue;
        }
        if (token === '--tail') {
            args.tailLines = Number(argv[++i]);
            continue;
        }
        if (token === '--no-tail') {
            args.tailLines = 0;
            continue;
        }
        if (token === '--json') {
            args.json = true;
            continue;
        }
        throw new Error(`unknown argument: ${token}`);
    }

    if (!Number.isFinite(args.intervalMs) || args.intervalMs < 1000) {
        throw new Error('--interval-ms must be >= 1000');
    }
    if (!Number.isFinite(args.tailLines) || args.tailLines < 0) {
        throw new Error('--tail must be >= 0');
    }
    args.intervalMs = Math.trunc(args.intervalMs);
    args.tailLines = Math.trunc(args.tailLines);
    return args;
}

function printHelp() {
    console.log([
        'Usage:',
        '  node scripts/monitor-selfplay-training-run.js [options]',
        '',
        'Options:',
        '      --profile <name>         Profile runs directory under data/runs/<name>',
        '      --run-tag <tag>          Monitor a specific run tag under the profile runs dir',
        '      --runs-dir <path>        Override runs root directory',
        '      --run-dir <path>         Monitor a specific run directory directly',
        '      --watch                  Poll and print only when state changes',
        '      --interval-ms <ms>       Watch polling interval (default: 5000)',
        '      --tail <count>           Include the last N log lines (default: 8)',
        '      --no-tail                Omit log tail from the snapshot output',
        '      --json                   Emit JSON snapshots',
        '  -h, --help                   Show this help',
        '',
        'Examples:',
        '  node scripts/monitor-selfplay-training-run.js --profile research_incremental_growth_v1',
        '  node scripts/monitor-selfplay-training-run.js --profile research_incremental_growth_v1 --run-tag research_incremental_growth_v1_20260317_012456 --watch'
    ].join('\n'));
}

function resolveMaybePath(cwd: any, value: any) {
    if (!value) return null;
    return path.resolve(cwd, value);
}

function safeStat(filePath: string) {
    try {
        return fs.statSync(filePath);
    } catch (error) {
        return null;
    }
}

function readJsonSafe(filePath: string) {
    if (!filePath || !fs.existsSync(filePath)) return null;
    try {
        return JSON.parse(fs.readFileSync(filePath, 'utf8'));
    } catch (error) {
        return null;
    }
}

function readTextTail(filePath: any, maxBytes: any) {
    const stat = safeStat(filePath);
    if (!stat || !stat.isFile()) {
        return { stat: null, text: '' };
    }
    const size = Number.isFinite(stat.size) ? Math.max(0, stat.size) : 0;
    const readBytes = Math.min(size, Number.isFinite(maxBytes) && maxBytes > 0 ? maxBytes : DEFAULT_TAIL_READ_BYTES);
    const start = Math.max(0, size - readBytes);
    const fd = fs.openSync(filePath, 'r');
    try {
        const buffer = Buffer.alloc(readBytes);
        const bytesRead = fs.readSync(fd, buffer, 0, readBytes, start);
        let text = buffer.subarray(0, bytesRead).toString('utf8');
        if (start > 0) {
            const firstNewline = text.indexOf('\n');
            if (firstNewline >= 0) {
                text = text.slice(firstNewline + 1);
            }
        }
        return { stat, text };
    } finally {
        fs.closeSync(fd);
    }
}

function splitNonEmptyLines(text: string) {
    return String(text || '')
        .split(/\r?\n/)
        .map((line: any) => String(line || '').trim())
        .filter((line: any) => line.length > 0);
}

function readLastLines(filePath: any, maxLines: any, maxBytes: any) {
    const tail = readTextTail(filePath, maxBytes);
    const lines = splitNonEmptyLines(tail.text);
    return {
        stat: tail.stat,
        lines: maxLines > 0 ? lines.slice(-maxLines) : []
    };
}

function extractIterationHint(text: string) {
    const match = String(text || '').match(/\.it(\d+)\b/i);
    if (!match) return null;
    const value = Number(match[1]);
    return Number.isFinite(value) ? value : null;
}

function inferPhaseFromTrainerPrefix(prefix: string) {
    const normalized = String(prefix || '').trim().toLowerCase();
    if (normalized === 'train_policy_onnx') return { key: 'train-policy', label: PHASE_LABELS['train-policy'] };
    if (normalized === 'train_card_onnx') return { key: 'train-card-policy', label: PHASE_LABELS['train-card-policy'] };
    if (normalized === 'train_target_onnx') return { key: 'train-target-policy', label: PHASE_LABELS['train-target-policy'] };
    if (normalized === 'train_value_onnx') return { key: 'train-value-policy', label: PHASE_LABELS['train-value-policy'] };
    return null;
}

function inferPhaseFromCommand(commandLine: any) {
    const normalized = String(commandLine || '').trim().toLowerCase();
    if (!normalized) return null;
    if (normalized.includes('generate-selfplay-data.js')) {
        if (normalized.includes('selfplay.eval.') || normalized.includes('--data-lane eval-suite')) {
            return { key: 'generate-eval', label: PHASE_LABELS['generate-eval'] };
        }
        return { key: 'generate-train', label: PHASE_LABELS['generate-train'] };
    }
    if (normalized.includes('train_policy_onnx.py')) return { key: 'train-policy', label: PHASE_LABELS['train-policy'] };
    if (normalized.includes('evaluate_policy_table.py')) return { key: 'evaluate-policy', label: PHASE_LABELS['evaluate-policy'] };
    if (normalized.includes('train_card_onnx.py')) return { key: 'train-card-policy', label: PHASE_LABELS['train-card-policy'] };
    if (normalized.includes('train_target_onnx.py')) return { key: 'train-target-policy', label: PHASE_LABELS['train-target-policy'] };
    if (normalized.includes('train_value_onnx.py')) return { key: 'train-value-policy', label: PHASE_LABELS['train-value-policy'] };
    if (normalized.includes('benchmark-policy-quality-gate.js')) return { key: 'adoption-quality-gate', label: PHASE_LABELS['adoption-quality-gate'] };
    if (normalized.includes('benchmark-policy-onnx-gate.js')) return { key: 'adoption-onnx-gate', label: PHASE_LABELS['adoption-onnx-gate'] };
    if (normalized.includes('benchmark-policy-adoption.js')) {
        if (normalized.includes('adoption.final.')) {
            return { key: 'adoption-final', label: PHASE_LABELS['adoption-final'] };
        }
        return { key: 'adoption-quick', label: PHASE_LABELS['adoption-quick'] };
    }
    if (normalized.includes('promote-policy-model.js')) return { key: 'promote-model', label: PHASE_LABELS['promote-model'] };
    return null;
}

function analyzeLauncherLogLines(lines: string[]) {
    const state = {
        currentIteration: null,
        totalIterations: null,
        lastCompletedIteration: 0,
        currentPhaseKey: null,
        currentPhaseLabel: null,
        currentCommand: null,
        phaseProgress: null,
        statusHint: null,
        stopReason: null,
        failureMessage: null
    };

    const entries = Array.isArray(lines) ? lines : [];
    for (const rawLine of entries) {
        const line = String(rawLine || '').trim();
        if (!line) continue;

        let match = line.match(/^\[training-cycle\] iteration (\d+)\/(\d+) start$/);
        if (match) {
            state.currentIteration = Number(match[1]);
            state.totalIterations = Number(match[2]);
            state.currentPhaseKey = 'iteration-start';
            state.currentPhaseLabel = PHASE_LABELS['iteration-start'];
            state.phaseProgress = null;
            continue;
        }

        match = line.match(/^\[training-cycle\] run: (.+)$/);
        if (match) {
            state.currentCommand = match[1];
            const iterationHint = extractIterationHint(state.currentCommand);
            if (Number.isFinite(iterationHint)) {
                state.currentIteration = iterationHint;
            }
            const phase = inferPhaseFromCommand(state.currentCommand);
            if (phase) {
                state.currentPhaseKey = phase.key;
                state.currentPhaseLabel = phase.label;
                state.phaseProgress = null;
            }
            continue;
        }

        match = line.match(/^\[selfplay\]\s+(\d+)\/(\d+)\s+completed\b/i);
        if (match) {
            const current = Number(match[1]);
            const total = Number(match[2]);
            const phase = inferPhaseFromCommand(state.currentCommand) || { key: 'generate-train', label: '自己対局' };
            state.currentPhaseKey = phase.key;
            state.currentPhaseLabel = phase.label;
            state.phaseProgress = {
                current,
                total,
                unit: 'games'
            };
            continue;
        }

        match = line.match(/^\[(train_policy_onnx|train_card_onnx|train_target_onnx|train_value_onnx)]\s+epoch=(\d+)\/(\d+)\b/i);
        if (match) {
            const phase = inferPhaseFromTrainerPrefix(match[1]);
            if (phase) {
                state.currentPhaseKey = phase.key;
                state.currentPhaseLabel = phase.label;
                state.phaseProgress = {
                    current: Number(match[2]),
                    total: Number(match[3]),
                    unit: 'epochs'
                };
            }
            continue;
        }

        match = line.match(/^\[training-cycle\] iteration (\d+) done\b/i);
        if (match) {
            state.lastCompletedIteration = Math.max(state.lastCompletedIteration, Number(match[1]));
            state.currentIteration = Math.max(state.lastCompletedIteration, Number(match[1]));
            state.currentPhaseKey = 'iteration-done';
            state.currentPhaseLabel = PHASE_LABELS['iteration-done'];
            state.phaseProgress = null;
            continue;
        }

        match = line.match(/^\[training-cycle\] stopped by time budget: (.+)$/i);
        if (match) {
            state.statusHint = 'stopped';
            state.stopReason = match[1];
            continue;
        }

        match = line.match(/^\[training-cycle\] failed:\s*(.+)$/i);
        if (match) {
            state.statusHint = 'failed';
            state.failureMessage = match[1];
        }
    }

    return state;
}

function basenameOrNull(filePath: string) {
    if (!filePath) return null;
    return path.basename(String(filePath));
}

function resolveBaselineMode(configLike: any) {
    const config = configLike && typeof configLike === 'object' ? configLike : {};
    if (config.adoptionUseAnchorBaseline === true) return 'anchor';
    if (config.adoptionUseGuideBaseline === true) return 'guide';
    return 'candidate';
}

function resolveGateMode(configLike: any) {
    const config = configLike && typeof configLike === 'object' ? configLike : {};
    return config.gateFinalIterationOnly === true ? 'final-only' : 'every-iteration';
}

function resolveSummaryConfig(summary: any) {
    return summary && summary.config && typeof summary.config === 'object' ? summary.config : null;
}

function deriveConfigFromResolvedPayload(payload: any) {
    const commandArgs = Array.isArray(payload && payload.command && payload.command.args)
        ? payload.command.args
        : [];
    if (commandArgs.length <= 0) return null;

    const config: any = {};
    for (let index = 0; index < commandArgs.length; index += 1) {
        const token = String(commandArgs[index] || '').trim();
        if (!token) continue;
        if (token === '--iterations') {
            config.iterations = Number(commandArgs[index + 1]);
            index += 1;
            continue;
        }
        if (token === '--adoption-use-guide-baseline') {
            config.adoptionUseGuideBaseline = true;
            config.adoptionUseAnchorBaseline = false;
            continue;
        }
        if (token === '--no-adoption-use-guide-baseline') {
            config.adoptionUseGuideBaseline = false;
            continue;
        }
        if (token === '--adoption-use-anchor-baseline') {
            config.adoptionUseAnchorBaseline = true;
            config.adoptionUseGuideBaseline = false;
            continue;
        }
        if (token === '--no-adoption-use-anchor-baseline') {
            config.adoptionUseAnchorBaseline = false;
            continue;
        }
        if (token === '--gate-final-iteration-only') {
            config.gateFinalIterationOnly = true;
            continue;
        }
        if (token === '--no-gate-final-iteration-only') {
            config.gateFinalIterationOnly = false;
            continue;
        }
        if (token === '--seed-bank') {
            config.seedBankPath = String(commandArgs[index + 1] || '').trim() || null;
            index += 1;
        }
    }
    return config;
}

function resolveMonitorConfig(summary: any, resolvedPayload: any) {
    return resolveSummaryConfig(summary) || deriveConfigFromResolvedPayload(resolvedPayload);
}

function formatIsoTimestamp(value: any) {
    if (!Number.isFinite(value) || value <= 0) return null;
    return new Date(value).toISOString();
}

function buildDecisionFailureSummary(decision: any, fallbackState: any) {
    const state = typeof fallbackState === 'string' && fallbackState.trim()
        ? fallbackState.trim()
        : 'unknown';
    if (!decision || typeof decision !== 'object') {
        return {
            state,
            passed: null,
            primaryFailureReason: null,
            failureReasons: []
        };
    }
    const passed = decision.passed === true;
    const failureReasons = Array.isArray(decision.failureReasons)
        ? decision.failureReasons.slice()
        : [];
    const primaryFailureReason = decision.primaryFailureReason
        || decision.earlyStopReason
        || (failureReasons.length > 0 ? failureReasons[0] : null)
        || null;
    return {
        state: passed ? 'passed' : 'failed',
        passed,
        primaryFailureReason,
        failureReasons
    };
}

function buildLatestGateOutcomes(iteration: any, config: any) {
    const latestIteration = iteration && typeof iteration === 'object' ? iteration : null;
    if (!latestIteration) return null;
    const safeConfig = config && typeof config === 'object' ? config : {};
    const qualityEnabled = !!(
        (latestIteration.qualityGateConfig && latestIteration.qualityGateConfig.enabled === true) ||
        safeConfig.qualityGateEnabled === true
    );
    const onnxEnabled = !!(
        safeConfig.onnxGateEnabled === true ||
        latestIteration.onnxGateDecision
    );
    const qualityBlockedByQuick = qualityEnabled && !latestIteration.qualityGateDecision && !(latestIteration.quickDecision && latestIteration.quickDecision.passed === true);
    const finalBlockedByEarlierGate = !latestIteration.finalDecision && !(
        latestIteration.quickDecision &&
        latestIteration.quickDecision.passed === true &&
        (
            !qualityEnabled ||
            (latestIteration.qualityGateDecision && latestIteration.qualityGateDecision.passed === true)
        )
    );
    const onnxBlockedByEarlierGate = onnxEnabled && !latestIteration.onnxGateDecision && !(
        latestIteration.promotionDetail &&
        latestIteration.promotionDetail.qualityGatePassed === true &&
        (
            (latestIteration.finalDecision && latestIteration.finalDecision.passed === true) ||
            (latestIteration.promotionDetail && latestIteration.promotionDetail.mode === 'onnx-primary')
        )
    );

    return {
        quick: buildDecisionFailureSummary(
            latestIteration.quickDecision,
            latestIteration.gateControl && latestIteration.gateControl.gateIterationAllowed === false ? 'skipped' : 'not-run'
        ),
        quality: buildDecisionFailureSummary(
            latestIteration.qualityGateDecision,
            qualityEnabled
                ? (qualityBlockedByQuick ? 'blocked-by-quick' : 'not-run')
                : 'disabled'
        ),
        final: buildDecisionFailureSummary(
            latestIteration.finalDecision,
            finalBlockedByEarlierGate ? 'blocked-by-earlier-gate' : 'not-run'
        ),
        onnx: buildDecisionFailureSummary(
            latestIteration.onnxGateDecision,
            onnxEnabled
                ? (onnxBlockedByEarlierGate ? 'blocked-by-earlier-gate' : 'not-run')
                : 'disabled'
        )
    };
}

function formatLatestGateOutcomes(gates: any) {
    if (!gates || typeof gates !== 'object') return 'none';
    const ordered = ['quick', 'quality', 'final', 'onnx'];
    const parts = [];
    for (const key of ordered) {
        const gate = gates[key];
        if (!gate || typeof gate !== 'object') continue;
        const reason = gate.primaryFailureReason ? `(${gate.primaryFailureReason})` : '';
        parts.push(`${key}:${gate.state}${reason}`);
    }
    return parts.length > 0 ? parts.join(' ') : 'none';
}

function buildMonitorSnapshot(runDir: any, options: any) {
    const opts = (options && typeof options === 'object') ? options : {};
    const tailLines = Number.isFinite(opts.tailLines) ? Math.max(0, Math.trunc(opts.tailLines)) : DEFAULT_TAIL_LINES;
    const summaryPath = path.join(runDir, 'training-cycle.summary.json');
    const resolvedConfigPath = path.join(runDir, 'config.resolved.json');
    const launcherLogPath = path.join(runDir, 'launcher.log');
    const summary = readJsonSafe(summaryPath);
    const resolvedPayload = readJsonSafe(resolvedConfigPath);
    const monitorConfig = resolveMonitorConfig(summary, resolvedPayload);
    const summaryStat = safeStat(summaryPath);
    const resolvedConfigStat = safeStat(resolvedConfigPath);
    const logTail = readLastLines(launcherLogPath, Math.max(64, tailLines * 12), DEFAULT_TAIL_READ_BYTES);
    const logStat = logTail.stat;
    const parsedLog = analyzeLauncherLogLines(logTail.lines);
    const summaryIterations = monitorConfig ? Number(monitorConfig.iterations) : Number.NaN;
    const totalIterations = Number.isFinite(summaryIterations)
        ? summaryIterations
        : (Number.isFinite(parsedLog.totalIterations) ? parsedLog.totalIterations : null);
    const completedIterations = Array.isArray(summary && summary.iterations)
        ? summary.iterations.length
        : Math.max(0, Number(parsedLog.lastCompletedIteration) || 0);

    let currentIteration = null;
    if (summary && summary.failure && Number.isFinite(Number(summary.failure.iteration))) {
        currentIteration = Number(summary.failure.iteration);
    } else if (Number.isFinite(Number(parsedLog.currentIteration)) && Number(parsedLog.currentIteration) > 0) {
        currentIteration = Number(parsedLog.currentIteration);
    } else if (
        Number.isFinite(totalIterations) &&
        completedIterations < totalIterations &&
        logStat &&
        (!summaryStat || logStat.mtimeMs >= summaryStat.mtimeMs)
    ) {
        currentIteration = completedIterations + 1;
    }

    const latestUpdatedMs = Math.max(
        summaryStat && Number.isFinite(summaryStat.mtimeMs) ? summaryStat.mtimeMs : 0,
        resolvedConfigStat && Number.isFinite(resolvedConfigStat.mtimeMs) ? resolvedConfigStat.mtimeMs : 0,
        logStat && Number.isFinite(logStat.mtimeMs) ? logStat.mtimeMs : 0
    );
    const failure = summary && summary.failure ? summary.failure : null;
    const latestIteration = Array.isArray(summary && summary.iterations) && summary.iterations.length > 0
        ? summary.iterations[summary.iterations.length - 1]
        : null;
    const latestGateOutcomes = buildLatestGateOutcomes(latestIteration, monitorConfig);
    const runningPhase = !!(
        parsedLog.currentPhaseKey &&
        parsedLog.currentPhaseKey !== 'iteration-done'
    );

    let status = 'idle';
    if (!summaryStat && !logStat) {
        status = 'missing';
    } else if (failure || parsedLog.statusHint === 'failed') {
        status = 'failed';
    } else if ((summary && summary.stoppedByTimeBudget === true) || parsedLog.statusHint === 'stopped') {
        status = 'stopped';
    } else if (
        Number.isFinite(totalIterations) &&
        completedIterations >= totalIterations &&
        !runningPhase
    ) {
        status = 'completed';
    } else if (runningPhase || (Number.isFinite(currentIteration) && currentIteration > completedIterations)) {
        status = 'running';
    } else if (completedIterations > 0) {
        status = 'idle';
    } else {
        status = 'running';
    }

    return {
        runDir,
        runTag: path.basename(runDir),
        status,
        updatedAt: formatIsoTimestamp(latestUpdatedMs),
        summaryUpdatedAt: formatIsoTimestamp(summaryStat && summaryStat.mtimeMs),
        launcherUpdatedAt: formatIsoTimestamp(logStat && logStat.mtimeMs),
        totalIterations,
        completedIterations,
        currentIteration,
        currentPhaseKey: parsedLog.currentPhaseKey,
        currentPhaseLabel: parsedLog.currentPhaseLabel,
        phaseProgress: parsedLog.phaseProgress,
        gateMode: resolveGateMode(monitorConfig),
        baselineMode: resolveBaselineMode(monitorConfig),
        latestGuideModel: basenameOrNull(summary && summary.latestGuideModelPath),
        latestResumeCheckpoint: basenameOrNull(summary && summary.latestResumeCheckpointPath),
        latestAnchorModel: basenameOrNull(summary && summary.latestAnchorModelPath),
        seedBankPath: monitorConfig && monitorConfig.seedBankPath ? String(monitorConfig.seedBankPath) : null,
        seedBank: basenameOrNull(monitorConfig && monitorConfig.seedBankPath),
        latestWarehouseManifest: basenameOrNull(summary && summary.latestWarehouseManifestPath),
        latestWarehouseManifestPath: summary && summary.latestWarehouseManifestPath ? String(summary.latestWarehouseManifestPath) : null,
        latestWarehouseManifestSchemaVersion: summary && summary.warehouseManifestSchemaVersion
            ? String(summary.warehouseManifestSchemaVersion)
            : null,
        latestGateOutcomes,
        stopReason: (summary && summary.stopReason) || parsedLog.stopReason || null,
        failure,
        failureMessage: (failure && failure.message) || parsedLog.failureMessage || null,
        tailLines: tailLines > 0 ? logTail.lines.slice(-tailLines) : []
    };
}

function formatPhaseProgress(progress: any) {
    if (!progress || !Number.isFinite(progress.current) || !Number.isFinite(progress.total)) return null;
    const unit = String(progress.unit || '').trim();
    return `${progress.current}/${progress.total}${unit ? ` ${unit}` : ''}`;
}

function formatFailureDetail(snapshot: any) {
    if (!snapshot || !snapshot.failure) return snapshot && snapshot.failureMessage ? snapshot.failureMessage : 'none';
    const failure = snapshot.failure;
    const segments = [];
    if (Number.isFinite(Number(failure.iteration))) segments.push(`iteration=${Number(failure.iteration)}`);
    if (failure.step) segments.push(`step=${failure.step}`);
    if (failure.message) segments.push(String(failure.message));
    return segments.join(' ');
}

function formatMonitorSnapshotText(snapshot: any) {
    const lines = [];
    lines.push(`[training-monitor] run=${snapshot.runTag}`);
    lines.push(`[training-monitor] dir=${snapshot.runDir}`);
    lines.push(`[training-monitor] status=${snapshot.status} updated=${snapshot.updatedAt || 'n/a'}`);

    const totalLabel = Number.isFinite(snapshot.totalIterations) ? snapshot.totalIterations : '?';
    const currentLabel = Number.isFinite(snapshot.currentIteration)
        ? `${snapshot.currentIteration}/${totalLabel}`
        : 'n/a';
    lines.push(`[training-monitor] iterations completed=${snapshot.completedIterations}/${totalLabel} current=${currentLabel}`);

    const phaseBits = [];
    if (snapshot.currentPhaseLabel) phaseBits.push(`phase=${snapshot.currentPhaseLabel}`);
    const phaseProgress = formatPhaseProgress(snapshot.phaseProgress);
    if (phaseProgress) phaseBits.push(`progress=${phaseProgress}`);
    if (phaseBits.length > 0) {
        lines.push(`[training-monitor] ${phaseBits.join(' ')}`);
    }

    lines.push(`[training-monitor] gate=${snapshot.gateMode} baseline=${snapshot.baselineMode}`);
    if (snapshot.latestGuideModel) lines.push(`[training-monitor] guide=${snapshot.latestGuideModel}`);
    if (snapshot.latestResumeCheckpoint) lines.push(`[training-monitor] checkpoint=${snapshot.latestResumeCheckpoint}`);
    if (snapshot.latestAnchorModel) lines.push(`[training-monitor] anchor=${snapshot.latestAnchorModel}`);
    if (snapshot.seedBank) lines.push(`[training-monitor] seed-bank=${snapshot.seedBank}`);
    if (snapshot.latestWarehouseManifest) {
        const schemaSuffix = snapshot.latestWarehouseManifestSchemaVersion
            ? ` schema=${snapshot.latestWarehouseManifestSchemaVersion}`
            : '';
        lines.push(`[training-monitor] warehouse=${snapshot.latestWarehouseManifest}${schemaSuffix}`);
    }
    if (snapshot.latestGateOutcomes) {
        lines.push(`[training-monitor] latest-gates=${formatLatestGateOutcomes(snapshot.latestGateOutcomes)}`);
    }
    if (snapshot.stopReason) lines.push(`[training-monitor] stopReason=${snapshot.stopReason}`);
    lines.push(`[training-monitor] failure=${formatFailureDetail(snapshot)}`);

    if (Array.isArray(snapshot.tailLines) && snapshot.tailLines.length > 0) {
        lines.push('[training-monitor] tail:');
        for (const line of snapshot.tailLines) {
            lines.push(`  ${line}`);
        }
    }

    return lines.join('\n');
}

function getRunDirectoryFreshness(runDir: string) {
    const candidates = [
        safeStat(path.join(runDir, 'launcher.log')),
        safeStat(path.join(runDir, 'training-cycle.summary.json')),
        safeStat(path.join(runDir, 'config.resolved.json')),
        safeStat(runDir)
    ].filter((entry: any) => !!entry);
    return candidates.reduce((best: any, entry: any) => {
        const value = Number.isFinite(entry.mtimeMs) ? entry.mtimeMs : 0;
        return value > best ? value : best;
    }, 0);
}

function findLatestRunDirectory(runsDir: string) {
    if (!runsDir || !fs.existsSync(runsDir)) {
        throw new Error(`runs directory not found: ${runsDir || '(empty)'}`);
    }
    const entries = fs.readdirSync(runsDir, { withFileTypes: true })
        .filter((entry: any) => entry && entry.isDirectory())
        .map((entry: any) => {
            const runDir = path.join(runsDir, entry.name);
            return {
                runDir,
                freshness: getRunDirectoryFreshness(runDir)
            };
        })
        .sort((left: any, right: any) => right.freshness - left.freshness || left.runDir.localeCompare(right.runDir));
    if (entries.length <= 0) {
        throw new Error(`no run directories found under: ${runsDir}`);
    }
    return entries[0].runDir;
}

function resolveRunDirectory(args: any, cwd: any) {
    const root = cwd || process.cwd();
    if (args.runDir) {
        const resolvedRunDir = resolveMaybePath(root, args.runDir);
        if (!resolvedRunDir || !fs.existsSync(resolvedRunDir)) {
            throw new Error(`run directory not found: ${resolvedRunDir || args.runDir}`);
        }
        return resolvedRunDir;
    }

    const runsDir = resolveMaybePath(
        root,
        args.runsDir || (args.profile ? path.join('data', 'runs', args.profile) : null)
    );
    if (!runsDir) {
        throw new Error('specify --run-dir or --profile');
    }
    if (args.runTag) {
        const resolvedRunDir = path.join(runsDir, args.runTag);
        if (!fs.existsSync(resolvedRunDir)) {
            throw new Error(`run directory not found: ${resolvedRunDir}`);
        }
        return resolvedRunDir;
    }
    return findLatestRunDirectory(runsDir);
}

function emitSnapshot(snapshot: any, args: any) {
    if (args.json) {
        console.log(JSON.stringify(snapshot));
        return;
    }
    console.log(formatMonitorSnapshotText(snapshot));
}

function sleep(ms: any) {
    return new Promise((resolve: any) => setTimeout(resolve, ms));
}

async function main() {
    const args = parseArgs(process.argv.slice(2));
    if (args.help) {
        printHelp();
        return;
    }

    const runDir = resolveRunDirectory(args, process.cwd());
    if (!args.watch) {
        emitSnapshot(buildMonitorSnapshot(runDir, args), args);
        return;
    }

    let lastFingerprint = null;
    let stopping = false;
    const handleStop = () => {
        stopping = true;
    };

    process.on('SIGINT', handleStop);
    process.on('SIGTERM', handleStop);

    while (!stopping) {
        const snapshot = buildMonitorSnapshot(runDir, args);
        const fingerprint = JSON.stringify(snapshot);
        if (fingerprint !== lastFingerprint) {
            if (!args.json && lastFingerprint !== null) {
                console.log('');
            }
            emitSnapshot(snapshot, args);
            lastFingerprint = fingerprint;
        }
        await sleep(args.intervalMs);
    }
}

if (require.main === module) {
    Promise.resolve(main()).catch((error: any) => {
        console.error(`[training-monitor] failed: ${error && error.message ? error.message : error}`);
        process.exit(1);
    });
}

export = {
    parseArgs,
    inferPhaseFromCommand,
    analyzeLauncherLogLines,
    buildMonitorSnapshot,
    formatMonitorSnapshotText,
    formatLatestGateOutcomes,
    buildLatestGateOutcomes,
    deriveConfigFromResolvedPayload,
    findLatestRunDirectory,
    resolveRunDirectory,
    getRunDirectoryFreshness
};
