'use strict';

const fs = require('fs');
const path = require('path');
const {
    buildSeedSchedule,
    sanitizeSeedList
} = require('./policy-seed-utils');

const TRAINING_WAREHOUSE_MANIFEST_SCHEMA_VERSION = 'training_warehouse_manifest.v1';
const SELFPLAY_DATA_FILE_PATTERN = /^selfplay\.(train|eval)(\.hardcase)?\..+\.ndjson$/i;
const DEFAULT_STALE_ORPHAN_TRANSIENT_MIN_AGE_MS = 24 * 60 * 60 * 1000;

function normalizePath(filePath) {
    return filePath ? path.resolve(filePath) : null;
}

function fileExists(filePath) {
    const resolved = normalizePath(filePath);
    return !!resolved && fs.existsSync(resolved);
}

function cloneResolvedPathMap(pathMap) {
    const out = {};
    if (!pathMap || typeof pathMap !== 'object') return out;
    for (const [key, value] of Object.entries(pathMap)) {
        out[key] = normalizePath(value);
    }
    return out;
}

function buildFileArtifact(filePath, extra) {
    const resolvedPath = normalizePath(filePath);
    const artifact = Object.assign({
        path: resolvedPath,
        exists: false,
        sizeBytes: 0,
        modifiedAt: null
    }, extra || {});
    if (!resolvedPath || !fs.existsSync(resolvedPath)) {
        return artifact;
    }
    const stats = fs.statSync(resolvedPath);
    artifact.exists = true;
    artifact.sizeBytes = Number(stats.size) || 0;
    artifact.modifiedAt = new Date(Number(stats.mtimeMs) || Date.now()).toISOString();
    return artifact;
}

function formatBytes(value) {
    if (!Number.isFinite(value) || value <= 0) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    let current = Number(value);
    let index = 0;
    while (current >= 1024 && index < units.length - 1) {
        current /= 1024;
        index += 1;
    }
    return `${current.toFixed(index === 0 ? 0 : 2)} ${units[index]}`;
}

function isSelfplayDatasetFileName(fileName) {
    return SELFPLAY_DATA_FILE_PATTERN.test(String(fileName || '').trim());
}

function buildWarehouseCompanionArtifactPaths(filePath) {
    const resolvedPath = normalizePath(filePath);
    if (!resolvedPath) return [];
    return [
        resolvedPath,
        `${resolvedPath}.resume-chunks`,
        `${resolvedPath}.partial`,
        `${resolvedPath}.merge-state.json`
    ];
}

function listTrainingWarehouseManifestPaths(runsDir) {
    const resolvedDir = normalizePath(runsDir);
    if (!resolvedDir || !fs.existsSync(resolvedDir)) return [];
    const out = [];
    const stack = [resolvedDir];
    while (stack.length > 0) {
        const current = stack.pop();
        const entries = fs.readdirSync(current, { withFileTypes: true });
        for (const entry of entries) {
            const fullPath = path.join(current, entry.name);
            if (entry.isDirectory()) {
                stack.push(fullPath);
                continue;
            }
            if (!entry.isFile()) continue;
            if (entry.name.startsWith('training-warehouse.') && entry.name.endsWith('.json')) {
                out.push(fullPath);
            }
        }
    }
    return out.sort();
}

function readTrainingWarehouseManifest(manifestPath) {
    const resolvedPath = normalizePath(manifestPath);
    if (!resolvedPath || !fs.existsSync(resolvedPath)) return null;
    const payload = readJsonSafe(resolvedPath);
    return payload && typeof payload === 'object'
        ? payload
        : null;
}

function collectWarehouseSelfplayArtifactPaths(manifest) {
    const datasetRoots = [
        manifest && manifest.datasets && manifest.datasets.train && manifest.datasets.train.selfplay
            ? manifest.datasets.train.selfplay.path
            : null,
        manifest && manifest.datasets && manifest.datasets.train && manifest.datasets.train.hardcase
            ? manifest.datasets.train.hardcase.path
            : null,
        manifest && manifest.datasets && manifest.datasets.eval && manifest.datasets.eval.selfplay
            ? manifest.datasets.eval.selfplay.path
            : null,
        manifest && manifest.datasets && manifest.datasets.eval && manifest.datasets.eval.hardcase
            ? manifest.datasets.eval.hardcase.path
            : null
    ];
    const seen = new Set();
    const out = [];
    for (const onePath of datasetRoots) {
        for (const artifactPath of buildWarehouseCompanionArtifactPaths(onePath)) {
            const resolvedPath = normalizePath(artifactPath);
            if (!resolvedPath || seen.has(resolvedPath)) continue;
            seen.add(resolvedPath);
            out.push(resolvedPath);
        }
    }
    return out;
}

function calculatePathSizeBytes(targetPath) {
    const resolvedPath = normalizePath(targetPath);
    if (!resolvedPath || !fs.existsSync(resolvedPath)) return 0;
    const stats = fs.statSync(resolvedPath);
    if (stats.isFile()) {
        return Number(stats.size) || 0;
    }
    if (!stats.isDirectory()) return 0;
    let total = 0;
    const stack = [resolvedPath];
    while (stack.length > 0) {
        const current = stack.pop();
        const entries = fs.readdirSync(current, { withFileTypes: true });
        for (const entry of entries) {
            const fullPath = path.join(current, entry.name);
            if (entry.isDirectory()) {
                stack.push(fullPath);
                continue;
            }
            if (!entry.isFile()) continue;
            try {
                total += Number(fs.statSync(fullPath).size) || 0;
            } catch (_) {
                continue;
            }
        }
    }
    return total;
}

function resolveSelfplayCompanionBasePath(targetPath) {
    const resolvedPath = normalizePath(targetPath);
    if (!resolvedPath) return null;
    const fileName = path.basename(resolvedPath);
    if (fileName.endsWith('.partial')) {
        const candidate = resolvedPath.slice(0, -'.partial'.length);
        return isSelfplayDatasetFileName(path.basename(candidate)) ? candidate : null;
    }
    if (fileName.endsWith('.merge-state.json')) {
        const candidate = resolvedPath.slice(0, -'.merge-state.json'.length);
        return isSelfplayDatasetFileName(path.basename(candidate)) ? candidate : null;
    }
    if (fileName.endsWith('.resume-chunks')) {
        const candidate = resolvedPath.slice(0, -'.resume-chunks'.length);
        return isSelfplayDatasetFileName(path.basename(candidate)) ? candidate : null;
    }
    return null;
}

function isPathOlderThan(targetPath, minAgeMs, nowMs) {
    const resolvedPath = normalizePath(targetPath);
    if (!resolvedPath || !fs.existsSync(resolvedPath)) return false;
    const ageFloorMs = Number.isFinite(Number(minAgeMs)) ? Math.max(0, Number(minAgeMs)) : 0;
    if (ageFloorMs <= 0) return true;
    const baselineNowMs = Number.isFinite(Number(nowMs)) ? Number(nowMs) : Date.now();
    const stats = fs.statSync(resolvedPath);
    const modifiedAtMs = Number(stats.mtimeMs) || 0;
    return (baselineNowMs - modifiedAtMs) >= ageFloorMs;
}

function collectStaleOrphanSelfplayArtifactPaths(runsDir, options) {
    const resolvedDir = normalizePath(runsDir);
    if (!resolvedDir || !fs.existsSync(resolvedDir)) return [];
    const staleAgeMs = Number.isFinite(Number(options && options.staleOrphanMinAgeMs))
        ? Math.max(0, Number(options.staleOrphanMinAgeMs))
        : DEFAULT_STALE_ORPHAN_TRANSIENT_MIN_AGE_MS;
    const nowMs = Number.isFinite(Number(options && options.nowMs))
        ? Number(options.nowMs)
        : Date.now();
    const out = [];
    const seen = new Set();
    const stack = [resolvedDir];

    while (stack.length > 0) {
        const current = stack.pop();
        const entries = fs.readdirSync(current, { withFileTypes: true });
        for (const entry of entries) {
            const fullPath = path.join(current, entry.name);
            if (entry.isDirectory()) {
                if (entry.name.endsWith('.resume-chunks')) {
                    const basePath = resolveSelfplayCompanionBasePath(fullPath);
                    if (
                        basePath &&
                        !fs.existsSync(basePath) &&
                        isPathOlderThan(fullPath, staleAgeMs, nowMs)
                    ) {
                        const resolvedPath = normalizePath(fullPath);
                        if (resolvedPath && !seen.has(resolvedPath)) {
                            seen.add(resolvedPath);
                            out.push(resolvedPath);
                        }
                    }
                    continue;
                }
                stack.push(fullPath);
                continue;
            }
            if (!entry.isFile()) continue;
            const basePath = resolveSelfplayCompanionBasePath(fullPath);
            if (
                !basePath ||
                fs.existsSync(basePath) ||
                !isPathOlderThan(fullPath, staleAgeMs, nowMs)
            ) {
                continue;
            }
            const resolvedPath = normalizePath(fullPath);
            if (!resolvedPath || seen.has(resolvedPath)) continue;
            seen.add(resolvedPath);
            out.push(resolvedPath);
        }
    }

    return out.sort();
}

function removeArtifactPaths(artifactPaths) {
    const removed = [];
    const failed = [];
    let totalBytesRemoved = 0;
    const seenTargets = new Set();

    for (const artifactPath of artifactPaths) {
        const resolvedPath = normalizePath(artifactPath);
        if (!resolvedPath || seenTargets.has(resolvedPath) || !fs.existsSync(resolvedPath)) continue;
        seenTargets.add(resolvedPath);
        const bytes = calculatePathSizeBytes(resolvedPath);
        try {
            fs.rmSync(resolvedPath, { recursive: true, force: false });
            removed.push(resolvedPath);
            totalBytesRemoved += bytes;
        } catch (error) {
            failed.push({
                path: resolvedPath,
                error: error && error.message ? error.message : String(error)
            });
        }
    }

    return {
        removed,
        failed,
        totalBytesRemoved
    };
}

function resolveRunsCleanupRoot(runsDir) {
    const resolvedDir = normalizePath(runsDir);
    if (!resolvedDir) return null;
    let current = resolvedDir;
    while (current) {
        if (path.basename(current).toLowerCase() === 'runs') {
            return current;
        }
        const parent = path.dirname(current);
        if (!parent || parent === current) break;
        current = parent;
    }
    return resolvedDir;
}

function cleanupWarehouseSelfplayArtifacts(runsDir, options) {
    const cleanupRoot = resolveRunsCleanupRoot(runsDir);
    if (!cleanupRoot || !fs.existsSync(cleanupRoot)) {
        return {
            cleanupRoot,
            manifestsScanned: 0,
            orphanedArtifactsRemoved: 0,
            removed: [],
            failed: [],
            totalBytesRemoved: 0,
            totalBytesRemovedHuman: formatBytes(0)
        };
    }
    const manifestPaths = listTrainingWarehouseManifestPaths(cleanupRoot);
    let manifestsScanned = 0;
    const manifestArtifactPaths = [];

    for (const manifestPath of manifestPaths) {
        const manifest = readTrainingWarehouseManifest(manifestPath);
        if (!manifest) continue;
        manifestsScanned += 1;
        manifestArtifactPaths.push(...collectWarehouseSelfplayArtifactPaths(manifest));
    }

    const staleOrphanPaths = collectStaleOrphanSelfplayArtifactPaths(cleanupRoot, options);
    const removal = removeArtifactPaths(manifestArtifactPaths.concat(staleOrphanPaths));

    return {
        cleanupRoot,
        manifestsScanned,
        orphanedArtifactsRemoved: staleOrphanPaths.filter((artifactPath) => removal.removed.includes(artifactPath)).length,
        removed: removal.removed,
        failed: removal.failed,
        totalBytesRemoved: removal.totalBytesRemoved,
        totalBytesRemovedHuman: formatBytes(removal.totalBytesRemoved)
    };
}

function readJsonSafe(filePath) {
    try {
        return JSON.parse(fs.readFileSync(filePath, 'utf8'));
    } catch (_) {
        return null;
    }
}

function buildGatePayloadSeedSchedule(payload) {
    if (!payload || typeof payload !== 'object') return null;
    const config = payload.config && typeof payload.config === 'object'
        ? payload.config
        : {};
    const rawSeedSchedule = payload.seedSchedule && typeof payload.seedSchedule === 'object'
        ? payload.seedSchedule
        : {};
    const completedSeeds = Array.isArray(rawSeedSchedule.completedSeeds) && rawSeedSchedule.completedSeeds.length > 0
        ? rawSeedSchedule.completedSeeds
        : (Array.isArray(payload.perSeed) ? payload.perSeed.map((entry) => entry && entry.seed) : []);
    const seedSchedule = buildSeedSchedule(
        Number.isFinite(Number(rawSeedSchedule.baseSeed)) ? Number(rawSeedSchedule.baseSeed) : config.seed,
        Number.isFinite(Number(rawSeedSchedule.seedCount)) ? Number(rawSeedSchedule.seedCount) : config.seedCount,
        Number.isFinite(Number(rawSeedSchedule.seedStride)) ? Number(rawSeedSchedule.seedStride) : config.seedStride,
        completedSeeds
    );
    const scheduledSeeds = Array.isArray(rawSeedSchedule.scheduledSeeds) && rawSeedSchedule.scheduledSeeds.length > 0
        ? sanitizeSeedList(rawSeedSchedule.scheduledSeeds)
        : seedSchedule.scheduledSeeds;
    if (
        seedSchedule.baseSeed === null &&
        scheduledSeeds.length <= 0 &&
        seedSchedule.completedSeeds.length <= 0
    ) {
        return null;
    }
    return Object.assign({}, seedSchedule, {
        scheduledSeeds
    });
}

function sanitizeDecision(decision) {
    if (!decision || typeof decision !== 'object') return null;
    return {
        passed: decision.passed === true,
        primaryFailureReason: decision.primaryFailureReason || null,
        failureReasons: Array.isArray(decision.failureReasons)
            ? decision.failureReasons.slice()
            : [],
        uplift: Number.isFinite(Number(decision.uplift)) ? Number(decision.uplift) : null,
        upliftLowerBound: Number.isFinite(Number(decision.upliftLowerBound))
            ? Number(decision.upliftLowerBound)
            : null,
        seedCount: Number.isFinite(Number(decision.seedCount)) ? Number(decision.seedCount) : null,
        seedPassCount: Number.isFinite(Number(decision.seedPassCount)) ? Number(decision.seedPassCount) : null,
        earlyStopReason: decision.earlyStopReason || null
    };
}

function buildGateArtifact(filePath, kind) {
    const artifact = buildFileArtifact(filePath, {
        kind,
        gateType: null,
        gateFamily: null,
        schemaVersion: null,
        payloadSchemaVersion: null,
        seedSchedule: null,
        decision: null
    });
    if (!artifact.exists) return artifact;
    const payload = readJsonSafe(filePath);
    if (!payload || typeof payload !== 'object') return artifact;
    artifact.gateType = payload.gateType || null;
    artifact.gateFamily = payload.gateFamily || null;
    artifact.schemaVersion = payload.schemaVersion || null;
    artifact.payloadSchemaVersion = payload.payloadSchemaVersion || null;
    artifact.seedSchedule = buildGatePayloadSeedSchedule(payload);
    artifact.decision = sanitizeDecision(payload.decision);
    return artifact;
}

function buildDataArtifact(filePath, summaryPath, kind) {
    const resolvedSummaryPath = normalizePath(summaryPath);
    const artifact = buildFileArtifact(filePath, {
        kind,
        summaryPath: resolvedSummaryPath,
        summaryExists: !!resolvedSummaryPath && fs.existsSync(resolvedSummaryPath),
        summarySchemaVersion: null
    });
    if (!artifact.summaryExists) return artifact;
    const summary = readJsonSafe(resolvedSummaryPath);
    artifact.summarySchemaVersion = summary && summary.schemaVersion ? summary.schemaVersion : null;
    return artifact;
}

function sanitizeStep(step) {
    return {
        name: step && step.name ? String(step.name) : null,
        status: step && Number.isFinite(Number(step.status)) ? Number(step.status) : null,
        elapsedMs: step && Number.isFinite(Number(step.elapsedMs)) ? Number(step.elapsedMs) : null,
        reused: !!(step && step.reused),
        command: step && typeof step.command === 'string' ? step.command : null
    };
}

function buildIterationWarehouseManifest(args, iterationResult) {
    const result = iterationResult && typeof iterationResult === 'object'
        ? iterationResult
        : {};
    const paths = result.paths && typeof result.paths === 'object'
        ? result.paths
        : {};
    const gateControl = result.gateControl && typeof result.gateControl === 'object'
        ? result.gateControl
        : {};

    return {
        schemaVersion: TRAINING_WAREHOUSE_MANIFEST_SCHEMA_VERSION,
        generatedAt: new Date().toISOString(),
        runTag: args && args.runTag ? args.runTag : null,
        iteration: Number.isFinite(Number(result.iteration)) ? Number(result.iteration) : null,
        iterationTag: paths.tag || null,
        lineage: {
            trainingCycleSummaryPath: normalizePath(args && args.summaryOut),
            bootstrapPolicyModelPath: normalizePath(args && args.bootstrapPolicyModelPath),
            usedGuideModelPath: normalizePath(result.usedGuideModelPath),
            usedGuideModelPoolPaths: Array.isArray(result.usedGuideModelPoolPaths)
                ? result.usedGuideModelPoolPaths.map((one) => normalizePath(one)).filter((one) => !!one)
                : [],
            usedAnchorModelPath: normalizePath(result.usedAnchorModelPath),
            seedBankPath: normalizePath(result.seedBankPath),
            seedBankId: result.seedBankId || null,
            baselineMode: gateControl.baselineMode || null,
            baselineModelPath: normalizePath(gateControl.baselineModelPath),
            usedResumeCheckpointPaths: cloneResolvedPathMap(result.usedResumeCheckpointPaths),
            seeds: {
                iterationSeed: Number.isFinite(Number(result.seed)) ? Number(result.seed) : null,
                quickAdoptionSeed: Number.isFinite(Number(result.quickAdoptionSeed)) ? Number(result.quickAdoptionSeed) : null,
                qualityGateSeed: Number.isFinite(Number(result.qualityGateSeed)) ? Number(result.qualityGateSeed) : null,
                finalAdoptionSeed: Number.isFinite(Number(result.finalAdoptionSeed)) ? Number(result.finalAdoptionSeed) : null,
                onnxGateSeed: Number.isFinite(Number(result.onnxGateSeed)) ? Number(result.onnxGateSeed) : null,
                evalSeed: Number.isFinite(Number(result.evalSeed)) ? Number(result.evalSeed) : null
            },
            gateConfig: {
                quick: result.quickAdoptionConfig || null,
                quality: result.qualityGateConfig || null,
                final: result.finalAdoptionConfig || null,
                onnx: result.onnxGateConfig || null
            }
        },
        training: {
            allowCardUsage: !!(args && args.allowCardUsage),
            usedSelfplayCardUsageRate: Number.isFinite(Number(result.usedSelfplayCardUsageRate))
                ? Number(result.usedSelfplayCardUsageRate)
                : null,
            hasTargetTrainingData: !!result.hasTargetTrainingData,
            gateIterationAllowed: !!gateControl.gateIterationAllowed,
            promoted: !!result.promoted,
            promotionMode: args && args.promotionMode ? args.promotionMode : null
        },
        promotion: result.promotionDetail || null,
        datasets: {
            train: {
                selfplay: buildDataArtifact(paths.trainDataPath, paths.trainDataSummaryPath, 'selfplay.train'),
                hardcase: buildFileArtifact(paths.trainHardcaseDataPath, { kind: 'selfplay.train.hardcase' })
            },
            eval: {
                selfplay: buildDataArtifact(paths.evalDataPath, paths.evalDataSummaryPath, 'selfplay.eval'),
                hardcase: buildFileArtifact(paths.evalHardcaseDataPath, { kind: 'selfplay.eval.hardcase' })
            }
        },
        models: {
            candidatePolicyTable: buildFileArtifact(paths.candidateModelPath, { kind: 'model.policy-table' }),
            policyOnnx: buildFileArtifact(paths.onnxModelPath, { kind: 'model.policy-onnx' }),
            policyOnnxMeta: buildFileArtifact(paths.onnxMetaPath, { kind: 'model.policy-onnx-meta' }),
            policyCheckpoint: buildFileArtifact(paths.checkpointPath, { kind: 'model.policy-checkpoint' }),
            cardOnnx: buildFileArtifact(paths.cardOnnxModelPath, { kind: 'model.card-onnx' }),
            cardOnnxMeta: buildFileArtifact(paths.cardOnnxMetaPath, { kind: 'model.card-onnx-meta' }),
            cardCheckpoint: buildFileArtifact(paths.cardCheckpointPath, { kind: 'model.card-checkpoint' }),
            targetOnnx: buildFileArtifact(paths.targetOnnxModelPath, { kind: 'model.target-onnx' }),
            targetOnnxMeta: buildFileArtifact(paths.targetOnnxMetaPath, { kind: 'model.target-onnx-meta' }),
            targetCheckpoint: buildFileArtifact(paths.targetCheckpointPath, { kind: 'model.target-checkpoint' }),
            valueOnnx: buildFileArtifact(paths.valueOnnxModelPath, { kind: 'model.value-onnx' }),
            valueOnnxMeta: buildFileArtifact(paths.valueOnnxMetaPath, { kind: 'model.value-onnx-meta' }),
            valueCheckpoint: buildFileArtifact(paths.valueCheckpointPath, { kind: 'model.value-checkpoint' })
        },
        gates: {
            quick: buildGateArtifact(paths.quickAdoptionPath, 'gate.quick'),
            quality: buildGateArtifact(paths.qualityGatePath, 'gate.quality'),
            final: buildGateArtifact(paths.finalAdoptionPath, 'gate.final'),
            onnx: buildGateArtifact(paths.onnxGatePath, 'gate.onnx')
        },
        steps: Array.isArray(result.steps)
            ? result.steps.map((step) => sanitizeStep(step))
            : []
    };
}

function writeTrainingWarehouseManifest(manifestPath, manifest) {
    const resolvedPath = normalizePath(manifestPath);
    if (!resolvedPath) {
        throw new Error('manifest path is required');
    }
    fs.mkdirSync(path.dirname(resolvedPath), { recursive: true });
    fs.writeFileSync(resolvedPath, JSON.stringify(manifest, null, 2), 'utf8');
    return resolvedPath;
}

module.exports = {
    TRAINING_WAREHOUSE_MANIFEST_SCHEMA_VERSION,
    buildIterationWarehouseManifest,
    writeTrainingWarehouseManifest,
    formatBytes,
    resolveRunsCleanupRoot,
    buildWarehouseCompanionArtifactPaths,
    listTrainingWarehouseManifestPaths,
    readTrainingWarehouseManifest,
    collectWarehouseSelfplayArtifactPaths,
    collectStaleOrphanSelfplayArtifactPaths,
    cleanupWarehouseSelfplayArtifacts
};
