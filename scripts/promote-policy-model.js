#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const {
    classifyTrainingArtifactPath
} = require('./training-artifact-status');

function parseArgs(argv) {
    const args = {
        adoptionResultPath: null,
        candidateModelPath: null,
        candidateOnnxPath: null,
        candidateOnnxMetaPath: null,
        candidateCardOnnxPath: null,
        candidateCardOnnxMetaPath: null,
        candidateTargetOnnxPath: null,
        candidateTargetOnnxMetaPath: null,
        candidateValueOnnxPath: null,
        candidateValueOnnxMetaPath: null,
        targetModelPath: path.resolve(process.cwd(), 'data', 'models', 'policy-table.json'),
        targetOnnxPath: path.resolve(process.cwd(), 'data', 'models', 'policy-net.onnx'),
        targetOnnxMetaPath: path.resolve(process.cwd(), 'data', 'models', 'policy-net.onnx.meta.json'),
        targetCardOnnxPath: path.resolve(process.cwd(), 'data', 'models', 'policy-card.onnx'),
        targetCardOnnxMetaPath: path.resolve(process.cwd(), 'data', 'models', 'policy-card.onnx.meta.json'),
        targetTargetOnnxPath: path.resolve(process.cwd(), 'data', 'models', 'policy-target.onnx'),
        targetTargetOnnxMetaPath: path.resolve(process.cwd(), 'data', 'models', 'policy-target.onnx.meta.json'),
        targetValueOnnxPath: path.resolve(process.cwd(), 'data', 'models', 'policy-value.onnx'),
        targetValueOnnxMetaPath: path.resolve(process.cwd(), 'data', 'models', 'policy-value.onnx.meta.json'),
        promotedDir: path.resolve(process.cwd(), 'data', 'models', 'promoted'),
        archiveDir: path.resolve(process.cwd(), 'data', 'models', 'archive'),
        manifestPath: null,
        quickGatePayloadPath: null,
        qualityGatePayloadPath: null,
        finalGatePayloadPath: null,
        onnxGatePayloadPath: null,
        warehouseManifestPath: null,
        force: false,
        help: false
    };

    for (let i = 0; i < argv.length; i++) {
        const a = argv[i];
        if (a === '--help' || a === '-h') { args.help = true; continue; }
        if (a === '--adoption-result') { args.adoptionResultPath = path.resolve(process.cwd(), argv[++i]); continue; }
        if (a === '--candidate-model') { args.candidateModelPath = path.resolve(process.cwd(), argv[++i]); continue; }
        if (a === '--candidate-onnx') { args.candidateOnnxPath = path.resolve(process.cwd(), argv[++i]); continue; }
        if (a === '--candidate-onnx-meta') { args.candidateOnnxMetaPath = path.resolve(process.cwd(), argv[++i]); continue; }
        if (a === '--candidate-card-onnx') { args.candidateCardOnnxPath = path.resolve(process.cwd(), argv[++i]); continue; }
        if (a === '--candidate-card-onnx-meta') { args.candidateCardOnnxMetaPath = path.resolve(process.cwd(), argv[++i]); continue; }
        if (a === '--candidate-target-onnx') { args.candidateTargetOnnxPath = path.resolve(process.cwd(), argv[++i]); continue; }
        if (a === '--candidate-target-onnx-meta') { args.candidateTargetOnnxMetaPath = path.resolve(process.cwd(), argv[++i]); continue; }
        if (a === '--candidate-value-onnx') { args.candidateValueOnnxPath = path.resolve(process.cwd(), argv[++i]); continue; }
        if (a === '--candidate-value-onnx-meta') { args.candidateValueOnnxMetaPath = path.resolve(process.cwd(), argv[++i]); continue; }
        if (a === '--target-model') { args.targetModelPath = path.resolve(process.cwd(), argv[++i]); continue; }
        if (a === '--target-onnx') { args.targetOnnxPath = path.resolve(process.cwd(), argv[++i]); continue; }
        if (a === '--target-onnx-meta') { args.targetOnnxMetaPath = path.resolve(process.cwd(), argv[++i]); continue; }
        if (a === '--target-card-onnx') { args.targetCardOnnxPath = path.resolve(process.cwd(), argv[++i]); continue; }
        if (a === '--target-card-onnx-meta') { args.targetCardOnnxMetaPath = path.resolve(process.cwd(), argv[++i]); continue; }
        if (a === '--target-target-onnx') { args.targetTargetOnnxPath = path.resolve(process.cwd(), argv[++i]); continue; }
        if (a === '--target-target-onnx-meta') { args.targetTargetOnnxMetaPath = path.resolve(process.cwd(), argv[++i]); continue; }
        if (a === '--target-value-onnx') { args.targetValueOnnxPath = path.resolve(process.cwd(), argv[++i]); continue; }
        if (a === '--target-value-onnx-meta') { args.targetValueOnnxMetaPath = path.resolve(process.cwd(), argv[++i]); continue; }
        if (a === '--promoted-dir') { args.promotedDir = path.resolve(process.cwd(), argv[++i]); continue; }
        if (a === '--archive-dir') { args.archiveDir = path.resolve(process.cwd(), argv[++i]); continue; }
        if (a === '--manifest') { args.manifestPath = path.resolve(process.cwd(), argv[++i]); continue; }
        if (a === '--quick-gate-payload') { args.quickGatePayloadPath = path.resolve(process.cwd(), argv[++i]); continue; }
        if (a === '--quality-gate-payload') { args.qualityGatePayloadPath = path.resolve(process.cwd(), argv[++i]); continue; }
        if (a === '--final-gate-payload') { args.finalGatePayloadPath = path.resolve(process.cwd(), argv[++i]); continue; }
        if (a === '--onnx-gate-payload') { args.onnxGatePayloadPath = path.resolve(process.cwd(), argv[++i]); continue; }
        if (a === '--warehouse-manifest') { args.warehouseManifestPath = path.resolve(process.cwd(), argv[++i]); continue; }
        if (a === '--force') { args.force = true; continue; }
    }

    if (args.help) return args;
    if (!args.adoptionResultPath) throw new Error('--adoption-result is required');
    if (!args.candidateModelPath) throw new Error('--candidate-model is required');
    return args;
}

function printHelp() {
    console.log([
        'Usage:',
        '  node scripts/promote-policy-model.js [options]',
        '',
        'Options:',
        '      --adoption-result <path>  Adoption check JSON (required)',
        '      --candidate-model <path>  Candidate policy model JSON (required)',
        '      --candidate-onnx <path>   Candidate ONNX model path (optional)',
        '      --candidate-onnx-meta <path> Candidate ONNX meta path (optional)',
        '      --candidate-card-onnx <path> Candidate card-specialist ONNX path (optional)',
        '      --candidate-card-onnx-meta <path> Candidate card-specialist ONNX meta path (optional)',
        '      --candidate-target-onnx <path> Candidate pending-target ONNX path (optional)',
        '      --candidate-target-onnx-meta <path> Candidate pending-target ONNX meta path (optional)',
        '      --candidate-value-onnx <path> Candidate value ONNX path (optional)',
        '      --candidate-value-onnx-meta <path> Candidate value ONNX meta path (optional)',
        '      --target-model <path>     Promotion target path (default: data/models/policy-table.json)',
        '      --target-onnx <path>      ONNX promotion target path (default: data/models/policy-net.onnx)',
        '      --target-onnx-meta <path> ONNX meta promotion target path (default: data/models/policy-net.onnx.meta.json)',
        '      --target-card-onnx <path> Card-specialist promotion target path (default: data/models/policy-card.onnx)',
        '      --target-card-onnx-meta <path> Card-specialist meta promotion target path (default: data/models/policy-card.onnx.meta.json)',
        '      --target-target-onnx <path> Pending-target promotion target path (default: data/models/policy-target.onnx)',
        '      --target-target-onnx-meta <path> Pending-target meta promotion target path (default: data/models/policy-target.onnx.meta.json)',
        '      --target-value-onnx <path> Value promotion target path (default: data/models/policy-value.onnx)',
        '      --target-value-onnx-meta <path> Value meta promotion target path (default: data/models/policy-value.onnx.meta.json)',
        '      --promoted-dir <path>     Champion/challenger snapshot root (default: data/models/promoted)',
        '      --archive-dir <path>      Archived champion root (default: data/models/archive)',
        '      --manifest <path>         Promotion manifest path (default: <promoted-dir>/promotion-manifest.json)',
        '      --quick-gate-payload <path> Quick gate payload path to record in manifest',
        '      --quality-gate-payload <path> Quality gate payload path to record in manifest',
        '      --final-gate-payload <path> Final gate payload path to record in manifest',
        '      --onnx-gate-payload <path> ONNX gate payload path to record in manifest',
        '      --warehouse-manifest <path> Training warehouse manifest path to record in manifest',
        '      --force                   Ignore adoption decision and promote anyway',
        '  -h, --help                    Show this help'
    ].join('\n'));
}

const {
    readJson,
    writeJson,
    validatePolicyModel,
    sanitizePromotionId,
    decorateTransferArtifact,
    copyRequiredFile,
    promoteOptionalFile,
    archiveExistingFile,
    buildBundlePaths
} = require('./promotion-helpers');

function summarizeGateDecision(decision) {
    if (!decision || typeof decision !== 'object') return null;
    return {
        passed: decision.passed === true,
        primaryFailureReason: decision.primaryFailureReason || null,
        failureReasons: Array.isArray(decision.failureReasons)
            ? decision.failureReasons.slice()
            : [],
        seedCount: Number.isFinite(Number(decision.seedCount)) ? Number(decision.seedCount) : null,
        seedPassCount: Number.isFinite(Number(decision.seedPassCount)) ? Number(decision.seedPassCount) : null
    };
}

function summarizeGatePayload(filePath) {
    if (!filePath) return null;
    const classification = classifyTrainingArtifactPath(filePath, { kind: 'gate.payload' });
    const summary = {
        path: filePath,
        exists: fs.existsSync(filePath),
        status: fs.existsSync(filePath) ? 'present' : 'missing',
        lifecycle: classification.lifecycle,
        lifecycleReason: classification.reason,
        compatibility: classification.compatibility,
        generatedAt: null,
        gateType: null,
        gateFamily: null,
        payloadSchemaVersion: null,
        seedSchedule: null,
        decision: null
    };
    if (!summary.exists) return summary;
    const payload = readJson(filePath);
    if (!payload || typeof payload !== 'object') {
        summary.status = 'unreadable';
        return summary;
    }
    summary.generatedAt = payload && payload.generatedAt ? payload.generatedAt : null;
    summary.gateType = payload && payload.gateType ? payload.gateType : null;
    summary.gateFamily = payload && payload.gateFamily ? payload.gateFamily : null;
    summary.payloadSchemaVersion = payload && payload.payloadSchemaVersion ? payload.payloadSchemaVersion : null;
    summary.seedSchedule = payload && payload.seedSchedule ? payload.seedSchedule : null;
    summary.decision = summarizeGateDecision(payload && payload.decision ? payload.decision : null);
    return summary;
}

function buildArtifactReference(filePath) {
    if (!filePath) return null;
    const resolvedPath = path.resolve(filePath);
    const classification = classifyTrainingArtifactPath(resolvedPath);
    return {
        path: resolvedPath,
        exists: fs.existsSync(resolvedPath),
        lifecycle: classification.lifecycle,
        lifecycleReason: classification.reason,
        compatibility: classification.compatibility,
        expectedCheckpointHead: classification.expectedCheckpointHead,
        detectedCheckpointHead: classification.detectedCheckpointHead
    };
}

function promoteModel(options) {
    const adoption = readJson(options.adoptionResultPath);
    const decision = adoption && adoption.decision ? adoption.decision : null;
    if (!options.force) {
        if (!decision || decision.passed !== true) {
            throw new Error('adoption decision is not passed; use --force to override');
        }
    }

    const candidate = readJson(options.candidateModelPath);
    validatePolicyModel(candidate);

    const promotedAt = typeof options.promotedAt === 'string' && options.promotedAt.trim()
        ? options.promotedAt.trim()
        : new Date().toISOString();
    const promotionId = sanitizePromotionId(options.promotionId || promotedAt);
    const promotedDir = options.promotedDir || path.resolve(process.cwd(), 'data', 'models', 'promoted');
    const archiveDir = options.archiveDir || path.resolve(process.cwd(), 'data', 'models', 'archive');
    const manifestPath = options.manifestPath || path.join(promotedDir, 'promotion-manifest.json');
    const deployTruthPath = options.deployTruthPath || path.join(promotedDir, 'promotion-deploy-truth.json');
    const targetDir = path.dirname(options.targetModelPath);
    fs.mkdirSync(targetDir, { recursive: true });
    const candidateOnnxPath = options.candidateOnnxPath || null;
    const candidateOnnxMetaPath = options.candidateOnnxMetaPath || (candidateOnnxPath ? `${candidateOnnxPath}.meta.json` : null);
    const candidateCardOnnxPath = options.candidateCardOnnxPath || null;
    const candidateCardOnnxMetaPath = options.candidateCardOnnxMetaPath || (candidateCardOnnxPath ? `${candidateCardOnnxPath}.meta.json` : null);
    const candidateTargetOnnxPath = options.candidateTargetOnnxPath || null;
    const candidateTargetOnnxMetaPath = options.candidateTargetOnnxMetaPath || (candidateTargetOnnxPath ? `${candidateTargetOnnxPath}.meta.json` : null);
    const candidateValueOnnxPath = options.candidateValueOnnxPath || null;
    const candidateValueOnnxMetaPath = options.candidateValueOnnxMetaPath || (candidateValueOnnxPath ? `${candidateValueOnnxPath}.meta.json` : null);
    const championPaths = buildBundlePaths(promotedDir, 'champion', options);
    const challengerPaths = buildBundlePaths(promotedDir, 'challenger', options);
    const archivePaths = buildBundlePaths(archiveDir, promotionId, options);

    const archivedChampion = {
        model: archiveExistingFile(options.targetModelPath, archivePaths.modelPath),
        onnx: archiveExistingFile(options.targetOnnxPath, archivePaths.onnxPath),
        onnxMeta: archiveExistingFile(options.targetOnnxMetaPath, archivePaths.onnxMetaPath),
        cardOnnx: archiveExistingFile(options.targetCardOnnxPath, archivePaths.cardOnnxPath),
        cardOnnxMeta: archiveExistingFile(options.targetCardOnnxMetaPath, archivePaths.cardOnnxMetaPath),
        targetOnnx: archiveExistingFile(options.targetTargetOnnxPath, archivePaths.targetOnnxPath),
        targetOnnxMeta: archiveExistingFile(options.targetTargetOnnxMetaPath, archivePaths.targetOnnxMetaPath),
        valueOnnx: archiveExistingFile(options.targetValueOnnxPath, archivePaths.valueOnnxPath),
        valueOnnxMeta: archiveExistingFile(options.targetValueOnnxMetaPath, archivePaths.valueOnnxMetaPath)
    };

    fs.copyFileSync(options.candidateModelPath, options.targetModelPath);
    const onnxPromotion = promoteOptionalFile(candidateOnnxPath, options.targetOnnxPath);
    const onnxMetaPromotion = promoteOptionalFile(candidateOnnxMetaPath, options.targetOnnxMetaPath);
    const cardOnnxPromotion = promoteOptionalFile(candidateCardOnnxPath, options.targetCardOnnxPath);
    const cardOnnxMetaPromotion = promoteOptionalFile(candidateCardOnnxMetaPath, options.targetCardOnnxMetaPath);
    const targetOnnxPromotion = promoteOptionalFile(candidateTargetOnnxPath, options.targetTargetOnnxPath);
    const targetOnnxMetaPromotion = promoteOptionalFile(candidateTargetOnnxMetaPath, options.targetTargetOnnxMetaPath);
    const valueOnnxPromotion = promoteOptionalFile(candidateValueOnnxPath, options.targetValueOnnxPath);
    const valueOnnxMetaPromotion = promoteOptionalFile(candidateValueOnnxMetaPath, options.targetValueOnnxMetaPath);

    const championPromotion = {
        model: copyRequiredFile(options.candidateModelPath, championPaths.modelPath, 'candidate model'),
        onnx: promoteOptionalFile(candidateOnnxPath, championPaths.onnxPath),
        onnxMeta: promoteOptionalFile(candidateOnnxMetaPath, championPaths.onnxMetaPath),
        cardOnnx: promoteOptionalFile(candidateCardOnnxPath, championPaths.cardOnnxPath),
        cardOnnxMeta: promoteOptionalFile(candidateCardOnnxMetaPath, championPaths.cardOnnxMetaPath),
        targetOnnx: promoteOptionalFile(candidateTargetOnnxPath, championPaths.targetOnnxPath),
        targetOnnxMeta: promoteOptionalFile(candidateTargetOnnxMetaPath, championPaths.targetOnnxMetaPath),
        valueOnnx: promoteOptionalFile(candidateValueOnnxPath, championPaths.valueOnnxPath),
        valueOnnxMeta: promoteOptionalFile(candidateValueOnnxMetaPath, championPaths.valueOnnxMetaPath)
    };
    const challengerSnapshot = {
        model: copyRequiredFile(options.candidateModelPath, challengerPaths.modelPath, 'candidate model'),
        onnx: promoteOptionalFile(candidateOnnxPath, challengerPaths.onnxPath),
        onnxMeta: promoteOptionalFile(candidateOnnxMetaPath, challengerPaths.onnxMetaPath),
        cardOnnx: promoteOptionalFile(candidateCardOnnxPath, challengerPaths.cardOnnxPath),
        cardOnnxMeta: promoteOptionalFile(candidateCardOnnxMetaPath, challengerPaths.cardOnnxMetaPath),
        targetOnnx: promoteOptionalFile(candidateTargetOnnxPath, challengerPaths.targetOnnxPath),
        targetOnnxMeta: promoteOptionalFile(candidateTargetOnnxMetaPath, challengerPaths.targetOnnxMetaPath),
        valueOnnx: promoteOptionalFile(candidateValueOnnxPath, challengerPaths.valueOnnxPath),
        valueOnnxMeta: promoteOptionalFile(candidateValueOnnxMetaPath, challengerPaths.valueOnnxMetaPath)
    };

    const rollback = {
        modelPath: archivedChampion.model.archived ? archivedChampion.model.targetPath : null,
        onnxPath: archivedChampion.onnx.archived ? archivedChampion.onnx.targetPath : null,
        onnxMetaPath: archivedChampion.onnxMeta.archived ? archivedChampion.onnxMeta.targetPath : null,
        cardOnnxPath: archivedChampion.cardOnnx.archived ? archivedChampion.cardOnnx.targetPath : null,
        cardOnnxMetaPath: archivedChampion.cardOnnxMeta.archived ? archivedChampion.cardOnnxMeta.targetPath : null,
        targetOnnxPath: archivedChampion.targetOnnx.archived ? archivedChampion.targetOnnx.targetPath : null,
        targetOnnxMetaPath: archivedChampion.targetOnnxMeta.archived ? archivedChampion.targetOnnxMeta.targetPath : null,
        valueOnnxPath: archivedChampion.valueOnnx.archived ? archivedChampion.valueOnnx.targetPath : null,
        valueOnnxMetaPath: archivedChampion.valueOnnxMeta.archived ? archivedChampion.valueOnnxMeta.targetPath : null
    };

    const deployTruth = {
        schemaVersion: 'policy_promotion_deploy_truth.v1',
        promotionId,
        promotedAt,
        manifestPath,
        candidateModelPath: options.candidateModelPath,
        deployed: {
            lifecycle: classifyTrainingArtifactPath(options.targetModelPath).lifecycle,
            modelPath: options.targetModelPath,
            onnxPath: options.targetOnnxPath,
            onnxMetaPath: options.targetOnnxMetaPath,
            cardOnnxPath: options.targetCardOnnxPath,
            cardOnnxMetaPath: options.targetCardOnnxMetaPath,
            targetOnnxPath: options.targetTargetOnnxPath,
            targetOnnxMetaPath: options.targetTargetOnnxMetaPath,
            valueOnnxPath: options.targetValueOnnxPath,
            valueOnnxMetaPath: options.targetValueOnnxMetaPath
        },
        champion: Object.assign({
            lifecycle: classifyTrainingArtifactPath(championPaths.rootDir).lifecycle
        }, championPaths),
        archive: {
            lifecycle: classifyTrainingArtifactPath(archivePaths.rootDir).lifecycle,
            bundleId: promotionId,
            rootDir: archivePaths.rootDir,
            model: archivedChampion.model,
            onnx: archivedChampion.onnx,
            onnxMeta: archivedChampion.onnxMeta,
            cardOnnx: archivedChampion.cardOnnx,
            cardOnnxMeta: archivedChampion.cardOnnxMeta,
            targetOnnx: archivedChampion.targetOnnx,
            targetOnnxMeta: archivedChampion.targetOnnxMeta,
            valueOnnx: archivedChampion.valueOnnx,
            valueOnnxMeta: archivedChampion.valueOnnxMeta
        },
        rollback: Object.assign({
            lifecycle: classifyTrainingArtifactPath(archivePaths.rootDir).lifecycle
        }, rollback)
    };
    // Back up existing deploy-truth per-promotionId to prevent overwrite bug
    if (fs.existsSync(deployTruthPath)) {
        try {
            const existing = readJson(deployTruthPath);
            if (existing && existing.promotionId && existing.promotionId !== promotionId) {
                const backupName = `promotion-deploy-truth.${sanitizePromotionId(existing.promotionId)}.json`;
                const backupPath = path.join(path.dirname(deployTruthPath), backupName);
                if (!fs.existsSync(backupPath)) {
                    writeJson(backupPath, existing);
                }
            }
        } catch (_e) { /* best-effort backup */ }
    }
    writeJson(deployTruthPath, deployTruth);

    const manifest = {
        schemaVersion: 'policy_promotion.v3',
        promotionId,
        promotedAt,
        forced: !!options.force,
        adoptionResultPath: options.adoptionResultPath,
        decision,
        candidate: {
            lifecycle: classifyTrainingArtifactPath(options.candidateModelPath).lifecycle,
            modelPath: options.candidateModelPath,
            onnxPath: candidateOnnxPath,
            onnxMetaPath: candidateOnnxMetaPath,
            cardOnnxPath: candidateCardOnnxPath,
            cardOnnxMetaPath: candidateCardOnnxMetaPath,
            targetOnnxPath: candidateTargetOnnxPath,
            targetOnnxMetaPath: candidateTargetOnnxMetaPath,
            valueOnnxPath: candidateValueOnnxPath,
            valueOnnxMetaPath: candidateValueOnnxMetaPath,
            schemaVersion: candidate.schemaVersion
        },
        deployed: {
            lifecycle: classifyTrainingArtifactPath(options.targetModelPath).lifecycle,
            modelPath: options.targetModelPath,
            onnxPath: options.targetOnnxPath,
            onnxMetaPath: options.targetOnnxMetaPath,
            cardOnnxPath: options.targetCardOnnxPath,
            cardOnnxMetaPath: options.targetCardOnnxMetaPath,
            targetOnnxPath: options.targetTargetOnnxPath,
            targetOnnxMetaPath: options.targetTargetOnnxMetaPath,
            valueOnnxPath: options.targetValueOnnxPath,
            valueOnnxMetaPath: options.targetValueOnnxMetaPath
        },
        champion: Object.assign({
            lifecycle: classifyTrainingArtifactPath(championPaths.rootDir).lifecycle
        }, championPaths),
        challenger: Object.assign({
            lifecycle: classifyTrainingArtifactPath(challengerPaths.rootDir).lifecycle
        }, challengerPaths),
        archive: {
            lifecycle: classifyTrainingArtifactPath(archivePaths.rootDir).lifecycle,
            bundleId: promotionId,
            rootDir: archivePaths.rootDir,
            model: archivedChampion.model,
            onnx: archivedChampion.onnx,
            onnxMeta: archivedChampion.onnxMeta,
            cardOnnx: archivedChampion.cardOnnx,
            cardOnnxMeta: archivedChampion.cardOnnxMeta,
            targetOnnx: archivedChampion.targetOnnx,
            targetOnnxMeta: archivedChampion.targetOnnxMeta,
            valueOnnx: archivedChampion.valueOnnx,
            valueOnnxMeta: archivedChampion.valueOnnxMeta
        },
        gatePayloads: {
            quick: summarizeGatePayload(options.quickGatePayloadPath),
            quality: summarizeGatePayload(options.qualityGatePayloadPath),
            final: summarizeGatePayload(options.finalGatePayloadPath),
            onnx: summarizeGatePayload(options.onnxGatePayloadPath)
        },
        trainingWarehouse: buildArtifactReference(options.warehouseManifestPath),
        deployTruthPath,
        deployTruth: buildArtifactReference(deployTruthPath),
        rollback: Object.assign({
            lifecycle: classifyTrainingArtifactPath(archivePaths.rootDir).lifecycle
        }, rollback)
    };
    writeJson(manifestPath, manifest);

    return {
        targetModelPath: options.targetModelPath,
        candidateModelPath: options.candidateModelPath,
        onnxPromotion,
        onnxMetaPromotion,
        cardOnnxPromotion,
        cardOnnxMetaPromotion,
        targetOnnxPromotion,
        targetOnnxMetaPromotion,
        valueOnnxPromotion,
        valueOnnxMetaPromotion,
        championPromotion,
        challengerSnapshot,
        archivedChampion,
        manifestPath,
        promotionId,
        rollback,
        forced: !!options.force,
        promotedAt,
        deployTruthPath
    };
}

function main() {
    const args = parseArgs(process.argv.slice(2));
    if (args.help) { printHelp(); return; }
    const result = promoteModel(args);
    console.log(`[policy-promote] promoted model -> ${result.targetModelPath} (forced=${result.forced})`);
    if (result.onnxPromotion && result.onnxPromotion.promoted) {
        console.log(`[policy-promote] promoted onnx -> ${result.onnxPromotion.targetPath}`);
    } else if (result.onnxPromotion && result.onnxPromotion.skipped && result.onnxPromotion.reason !== 'not_requested') {
        console.warn(`[policy-promote] skipped onnx promotion (${result.onnxPromotion.reason}): ${result.onnxPromotion.sourcePath}`);
    }
    if (result.onnxMetaPromotion && result.onnxMetaPromotion.promoted) {
        console.log(`[policy-promote] promoted onnx meta -> ${result.onnxMetaPromotion.targetPath}`);
    } else if (result.onnxMetaPromotion && result.onnxMetaPromotion.skipped && result.onnxMetaPromotion.reason !== 'not_requested') {
        console.warn(`[policy-promote] skipped onnx meta promotion (${result.onnxMetaPromotion.reason}): ${result.onnxMetaPromotion.sourcePath}`);
    }
    if (result.cardOnnxPromotion && result.cardOnnxPromotion.promoted) {
        console.log(`[policy-promote] promoted card onnx -> ${result.cardOnnxPromotion.targetPath}`);
    } else if (result.cardOnnxPromotion && result.cardOnnxPromotion.skipped && result.cardOnnxPromotion.reason !== 'not_requested') {
        console.warn(`[policy-promote] skipped card onnx promotion (${result.cardOnnxPromotion.reason}): ${result.cardOnnxPromotion.sourcePath}`);
    }
    if (result.cardOnnxMetaPromotion && result.cardOnnxMetaPromotion.promoted) {
        console.log(`[policy-promote] promoted card onnx meta -> ${result.cardOnnxMetaPromotion.targetPath}`);
    } else if (result.cardOnnxMetaPromotion && result.cardOnnxMetaPromotion.skipped && result.cardOnnxMetaPromotion.reason !== 'not_requested') {
        console.warn(`[policy-promote] skipped card onnx meta promotion (${result.cardOnnxMetaPromotion.reason}): ${result.cardOnnxMetaPromotion.sourcePath}`);
    }
    if (result.targetOnnxPromotion && result.targetOnnxPromotion.promoted) {
        console.log(`[policy-promote] promoted target onnx -> ${result.targetOnnxPromotion.targetPath}`);
    } else if (result.targetOnnxPromotion && result.targetOnnxPromotion.skipped && result.targetOnnxPromotion.reason !== 'not_requested') {
        console.warn(`[policy-promote] skipped target onnx promotion (${result.targetOnnxPromotion.reason}): ${result.targetOnnxPromotion.sourcePath}`);
    }
    if (result.targetOnnxMetaPromotion && result.targetOnnxMetaPromotion.promoted) {
        console.log(`[policy-promote] promoted target onnx meta -> ${result.targetOnnxMetaPromotion.targetPath}`);
    } else if (result.targetOnnxMetaPromotion && result.targetOnnxMetaPromotion.skipped && result.targetOnnxMetaPromotion.reason !== 'not_requested') {
        console.warn(`[policy-promote] skipped target onnx meta promotion (${result.targetOnnxMetaPromotion.reason}): ${result.targetOnnxMetaPromotion.sourcePath}`);
    }
    if (result.valueOnnxPromotion && result.valueOnnxPromotion.promoted) {
        console.log(`[policy-promote] promoted value onnx -> ${result.valueOnnxPromotion.targetPath}`);
    } else if (result.valueOnnxPromotion && result.valueOnnxPromotion.skipped && result.valueOnnxPromotion.reason !== 'not_requested') {
        console.warn(`[policy-promote] skipped value onnx promotion (${result.valueOnnxPromotion.reason}): ${result.valueOnnxPromotion.sourcePath}`);
    }
    if (result.valueOnnxMetaPromotion && result.valueOnnxMetaPromotion.promoted) {
        console.log(`[policy-promote] promoted value onnx meta -> ${result.valueOnnxMetaPromotion.targetPath}`);
    } else if (result.valueOnnxMetaPromotion && result.valueOnnxMetaPromotion.skipped && result.valueOnnxMetaPromotion.reason !== 'not_requested') {
        console.warn(`[policy-promote] skipped value onnx meta promotion (${result.valueOnnxMetaPromotion.reason}): ${result.valueOnnxMetaPromotion.sourcePath}`);
    }
    console.log(`[policy-promote] manifest -> ${result.manifestPath}`);
    if (result.rollback && result.rollback.modelPath) {
        console.log(`[policy-promote] rollback model snapshot -> ${result.rollback.modelPath}`);
    }
}

if (require.main === module) {
    try {
        main();
    } catch (err) {
        console.error('[policy-promote] failed:', err && err.message ? err.message : err);
        process.exit(1);
    }
}

module.exports = {
    parseArgs,
    promoteModel
};
