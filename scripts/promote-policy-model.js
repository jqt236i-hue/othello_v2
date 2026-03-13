#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

function parseArgs(argv) {
    const args = {
        adoptionResultPath: null,
        candidateModelPath: null,
        candidateOnnxPath: null,
        candidateOnnxMetaPath: null,
        targetModelPath: path.resolve(process.cwd(), 'data', 'models', 'policy-table.json'),
        targetOnnxPath: path.resolve(process.cwd(), 'data', 'models', 'policy-net.onnx'),
        targetOnnxMetaPath: path.resolve(process.cwd(), 'data', 'models', 'policy-net.onnx.meta.json'),
        promotedDir: path.resolve(process.cwd(), 'data', 'models', 'promoted'),
        archiveDir: path.resolve(process.cwd(), 'data', 'models', 'archive'),
        manifestPath: null,
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
        if (a === '--target-model') { args.targetModelPath = path.resolve(process.cwd(), argv[++i]); continue; }
        if (a === '--target-onnx') { args.targetOnnxPath = path.resolve(process.cwd(), argv[++i]); continue; }
        if (a === '--target-onnx-meta') { args.targetOnnxMetaPath = path.resolve(process.cwd(), argv[++i]); continue; }
        if (a === '--promoted-dir') { args.promotedDir = path.resolve(process.cwd(), argv[++i]); continue; }
        if (a === '--archive-dir') { args.archiveDir = path.resolve(process.cwd(), argv[++i]); continue; }
        if (a === '--manifest') { args.manifestPath = path.resolve(process.cwd(), argv[++i]); continue; }
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
        '      --target-model <path>     Promotion target path (default: data/models/policy-table.json)',
        '      --target-onnx <path>      ONNX promotion target path (default: data/models/policy-net.onnx)',
        '      --target-onnx-meta <path> ONNX meta promotion target path (default: data/models/policy-net.onnx.meta.json)',
        '      --promoted-dir <path>     Champion/challenger snapshot root (default: data/models/promoted)',
        '      --archive-dir <path>      Archived champion root (default: data/models/archive)',
        '      --manifest <path>         Promotion manifest path (default: <promoted-dir>/promotion-manifest.json)',
        '      --force                   Ignore adoption decision and promote anyway',
        '  -h, --help                    Show this help'
    ].join('\n'));
}

function readJson(p) {
    const raw = fs.readFileSync(p, 'utf8');
    return JSON.parse(raw);
}

function validatePolicyModel(model) {
    if (!model || typeof model !== 'object') throw new Error('candidate model is not an object');
    if (model.schemaVersion !== 'policy_table.v1' && model.schemaVersion !== 'policy_table.v2') {
        throw new Error('candidate model schema must be policy_table.v1 or policy_table.v2');
    }
    if (!model.states || typeof model.states !== 'object') throw new Error('candidate model must include states object');
}

function sanitizePromotionId(value) {
    const raw = typeof value === 'string' && value.trim()
        ? value.trim()
        : new Date().toISOString();
    return raw.replace(/[\\/:*?"<>|.]+/g, '-').replace(/\s+/g, '-');
}

function buildBundlePaths(rootDir, bundleName, options) {
    const baseDir = path.join(rootDir, bundleName);
    return {
        rootDir: baseDir,
        modelPath: path.join(baseDir, path.basename(options.targetModelPath)),
        onnxPath: options.targetOnnxPath ? path.join(baseDir, path.basename(options.targetOnnxPath)) : null,
        onnxMetaPath: options.targetOnnxMetaPath ? path.join(baseDir, path.basename(options.targetOnnxMetaPath)) : null
    };
}

function writeJson(p, value) {
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, JSON.stringify(value, null, 2), 'utf8');
}

function copyRequiredFile(srcPath, targetPath, label) {
    if (!srcPath || !fs.existsSync(srcPath)) {
        throw new Error(`${label} is missing: ${srcPath || '(null)'}`);
    }
    fs.mkdirSync(path.dirname(targetPath), { recursive: true });
    fs.copyFileSync(srcPath, targetPath);
    return { promoted: true, skipped: false, reason: null, sourcePath: srcPath, targetPath };
}

function promoteOptionalFile(srcPath, targetPath) {
    if (!srcPath) {
        return { promoted: false, skipped: true, reason: 'not_requested', sourcePath: null, targetPath };
    }
    if (!fs.existsSync(srcPath)) {
        return { promoted: false, skipped: true, reason: 'source_missing', sourcePath: srcPath, targetPath };
    }
    const targetDir = path.dirname(targetPath);
    fs.mkdirSync(targetDir, { recursive: true });
    fs.copyFileSync(srcPath, targetPath);
    return { promoted: true, skipped: false, reason: null, sourcePath: srcPath, targetPath };
}

function archiveExistingFile(srcPath, targetPath) {
    const archived = promoteOptionalFile(srcPath, targetPath);
    return {
        archived: archived.promoted,
        skipped: archived.skipped,
        reason: archived.reason,
        sourcePath: archived.sourcePath,
        targetPath: archived.targetPath
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
    const targetDir = path.dirname(options.targetModelPath);
    fs.mkdirSync(targetDir, { recursive: true });
    const candidateOnnxPath = options.candidateOnnxPath || null;
    const candidateOnnxMetaPath = options.candidateOnnxMetaPath || (candidateOnnxPath ? `${candidateOnnxPath}.meta.json` : null);
    const championPaths = buildBundlePaths(promotedDir, 'champion', options);
    const challengerPaths = buildBundlePaths(promotedDir, 'challenger', options);
    const archivePaths = buildBundlePaths(archiveDir, promotionId, options);

    const archivedChampion = {
        model: archiveExistingFile(options.targetModelPath, archivePaths.modelPath),
        onnx: archiveExistingFile(options.targetOnnxPath, archivePaths.onnxPath),
        onnxMeta: archiveExistingFile(options.targetOnnxMetaPath, archivePaths.onnxMetaPath)
    };

    fs.copyFileSync(options.candidateModelPath, options.targetModelPath);
    const onnxPromotion = promoteOptionalFile(candidateOnnxPath, options.targetOnnxPath);
    const onnxMetaPromotion = promoteOptionalFile(candidateOnnxMetaPath, options.targetOnnxMetaPath);

    const championPromotion = {
        model: copyRequiredFile(options.candidateModelPath, championPaths.modelPath, 'candidate model'),
        onnx: promoteOptionalFile(candidateOnnxPath, championPaths.onnxPath),
        onnxMeta: promoteOptionalFile(candidateOnnxMetaPath, championPaths.onnxMetaPath)
    };
    const challengerSnapshot = {
        model: copyRequiredFile(options.candidateModelPath, challengerPaths.modelPath, 'candidate model'),
        onnx: promoteOptionalFile(candidateOnnxPath, challengerPaths.onnxPath),
        onnxMeta: promoteOptionalFile(candidateOnnxMetaPath, challengerPaths.onnxMetaPath)
    };

    const rollback = {
        modelPath: archivedChampion.model.archived ? archivedChampion.model.targetPath : null,
        onnxPath: archivedChampion.onnx.archived ? archivedChampion.onnx.targetPath : null,
        onnxMetaPath: archivedChampion.onnxMeta.archived ? archivedChampion.onnxMeta.targetPath : null
    };

    const manifest = {
        schemaVersion: 'policy_promotion.v2',
        promotionId,
        promotedAt,
        forced: !!options.force,
        adoptionResultPath: options.adoptionResultPath,
        decision,
        candidate: {
            modelPath: options.candidateModelPath,
            onnxPath: candidateOnnxPath,
            onnxMetaPath: candidateOnnxMetaPath,
            schemaVersion: candidate.schemaVersion
        },
        deployed: {
            modelPath: options.targetModelPath,
            onnxPath: options.targetOnnxPath,
            onnxMetaPath: options.targetOnnxMetaPath
        },
        champion: championPaths,
        challenger: challengerPaths,
        archive: {
            bundleId: promotionId,
            rootDir: archivePaths.rootDir,
            model: archivedChampion.model,
            onnx: archivedChampion.onnx,
            onnxMeta: archivedChampion.onnxMeta
        },
        rollback
    };
    writeJson(manifestPath, manifest);

    return {
        targetModelPath: options.targetModelPath,
        candidateModelPath: options.candidateModelPath,
        onnxPromotion,
        onnxMetaPromotion,
        championPromotion,
        challengerSnapshot,
        archivedChampion,
        manifestPath,
        promotionId,
        rollback,
        forced: !!options.force,
        promotedAt
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
