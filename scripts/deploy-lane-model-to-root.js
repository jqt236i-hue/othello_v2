#!/usr/bin/env node
'use strict';

/**
 * @file deploy-lane-model-to-root.js
 * Deploys a lane-promoted policy-table model to the browser-accessible root.
 *
 * Lane promotion (promote-policy-model.js) writes to lane-local directories only.
 * This script is the explicit "go-live" step that copies the lane champion
 * bundle to root data/models/ so the browser can load it.
 */

const fs = require('fs');
const path = require('path');
const {
    readJson,
    writeJson,
    validatePolicyModel,
    sanitizePromotionId,
    archiveExistingFile
} = require('./promotion-helpers');

const DEPLOY_MANIFEST_SCHEMA = 'root_deploy_manifest.v1';
const DEFAULT_ROOT_MODELS_DIR = path.resolve(process.cwd(), 'data', 'models');

function parseArgs(argv) {
    const args = {
        laneDir: null,
        rootModelsDir: DEFAULT_ROOT_MODELS_DIR,
        deployId: null,
        minStates: 0,
        force: false,
        dryRun: false,
        help: false
    };

    for (let i = 0; i < argv.length; i++) {
        const a = argv[i];
        if (a === '--help' || a === '-h') { args.help = true; continue; }
        if (a === '--lane-dir') { args.laneDir = path.resolve(process.cwd(), argv[++i]); continue; }
        if (a === '--root-models-dir') { args.rootModelsDir = path.resolve(process.cwd(), argv[++i]); continue; }
        if (a === '--deploy-id') { args.deployId = argv[++i]; continue; }
        if (a === '--min-states') { args.minStates = parseInt(argv[++i], 10) || 0; continue; }
        if (a === '--force') { args.force = true; continue; }
        if (a === '--dry-run') { args.dryRun = true; continue; }
    }

    if (!args.help && !args.laneDir) {
        throw new Error('--lane-dir is required');
    }
    return args;
}

function printHelp() {
    console.log([
        'Usage:',
        '  node scripts/deploy-lane-model-to-root.js --lane-dir <path> [options]',
        '',
        'Deploys a lane-promoted model to the browser-accessible root.',
        '',
        'Options:',
        '      --lane-dir <path>        Lane model directory (required)',
        '      --root-models-dir <path> Root models directory (default: data/models)',
        '      --deploy-id <id>         Deploy identifier (default: timestamp)',
        '      --min-states <n>         Minimum state count required (default: 0)',
        '      --force                  Deploy even if lane has fewer states than root',
        '      --dry-run                Show what would happen without writing files',
        '  -h, --help                   Show this help'
    ].join('\n'));
}

function copyOptionalFile(srcPath, targetPath, dryRun) {
    if (!srcPath || !fs.existsSync(srcPath)) {
        return { copied: false, reason: srcPath ? 'source_missing' : 'not_requested' };
    }
    if (dryRun) {
        return { copied: false, reason: 'dry_run', wouldCopy: { from: srcPath, to: targetPath } };
    }
    fs.mkdirSync(path.dirname(targetPath), { recursive: true });
    fs.copyFileSync(srcPath, targetPath);
    return { copied: true, from: srcPath, to: targetPath };
}

function deployLaneModelToRoot(options) {
    const laneDir = options.laneDir;
    const rootDir = options.rootModelsDir;
    const dryRun = !!options.dryRun;
    const deployId = sanitizePromotionId(options.deployId || new Date().toISOString());

    // 1. Locate and validate lane model
    const laneModelPath = path.join(laneDir, 'policy-table.json');
    if (!fs.existsSync(laneModelPath)) {
        throw new Error(`Lane model not found: ${laneModelPath}`);
    }
    const laneModel = readJson(laneModelPath);
    validatePolicyModel(laneModel);

    const laneStateCount = Object.keys(laneModel.states).length;
    const laneAbstractCount = Object.keys(laneModel.abstractStates || {}).length;

    // 2. Check min-states
    if (options.minStates > 0 && laneStateCount < options.minStates) {
        throw new Error(
            `Lane model has ${laneStateCount} states, below minimum ${options.minStates}`
        );
    }

    // 3. Read current root model for comparison
    const rootModelPath = path.join(rootDir, 'policy-table.json');
    let rootStateCount = 0;
    let rootAbstractCount = 0;
    if (fs.existsSync(rootModelPath)) {
        try {
            const rootModel = readJson(rootModelPath);
            rootStateCount = Object.keys(rootModel.states || {}).length;
            rootAbstractCount = Object.keys(rootModel.abstractStates || {}).length;
        } catch (_e) { /* damaged root is acceptable — we're replacing it */ }
    }

    // 4. Safety check: lane should not have fewer states unless --force
    if (!options.force && rootStateCount > 0 && laneStateCount < rootStateCount) {
        throw new Error(
            `Lane model (${laneStateCount} states) has fewer states than root (${rootStateCount}). ` +
            `Use --force to override.`
        );
    }

    // 5. Build artifact map
    const onnxFiles = [
        { name: 'policy-net.onnx' },
        { name: 'policy-net.onnx.meta.json' },
        { name: 'policy-card.onnx' },
        { name: 'policy-card.onnx.meta.json' },
        { name: 'policy-target.onnx' },
        { name: 'policy-target.onnx.meta.json' },
        { name: 'policy-value.onnx' },
        { name: 'policy-value.onnx.meta.json' }
    ];

    if (dryRun) {
        const summary = {
            dryRun: true,
            deployId,
            laneDir,
            rootDir,
            laneStates: laneStateCount,
            laneAbstract: laneAbstractCount,
            rootStates: rootStateCount,
            rootAbstract: rootAbstractCount,
            wouldArchiveTo: path.join(rootDir, 'archive', deployId),
            wouldCopyModel: { from: laneModelPath, to: rootModelPath },
            onnxFiles: onnxFiles.map(f => ({
                name: f.name,
                laneExists: fs.existsSync(path.join(laneDir, f.name)),
                rootExists: fs.existsSync(path.join(rootDir, f.name))
            }))
        };
        return summary;
    }

    // 6. Archive existing root model
    const archiveDir = path.join(rootDir, 'archive', deployId);
    const archived = {
        model: archiveExistingFile(rootModelPath, path.join(archiveDir, 'policy-table.json'))
    };
    for (const f of onnxFiles) {
        archived[f.name] = archiveExistingFile(
            path.join(rootDir, f.name),
            path.join(archiveDir, f.name)
        );
    }

    // 7. Copy lane model to root
    fs.copyFileSync(laneModelPath, rootModelPath);

    // 8. Copy ONNX files if present in lane
    const onnxResults = {};
    for (const f of onnxFiles) {
        onnxResults[f.name] = copyOptionalFile(
            path.join(laneDir, f.name),
            path.join(rootDir, f.name),
            false
        );
    }

    // 9. Read lane promotion manifest for provenance
    let sourcePromotionId = null;
    const laneManifestPath = path.join(laneDir, 'promoted', 'promotion-manifest.json');
    if (fs.existsSync(laneManifestPath)) {
        try {
            const laneManifest = readJson(laneManifestPath);
            sourcePromotionId = laneManifest.promotionId || null;
        } catch (_e) { /* best effort */ }
    }

    // 10. Write deploy manifest
    const deployManifest = {
        schemaVersion: DEPLOY_MANIFEST_SCHEMA,
        deployId,
        deployedAt: new Date().toISOString(),
        laneSource: laneDir,
        sourcePromotionId,
        laneStates: laneStateCount,
        laneAbstract: laneAbstractCount,
        previousRootStates: rootStateCount,
        previousRootAbstract: rootAbstractCount,
        archiveDir,
        archived,
        onnxResults,
        forced: !!options.force
    };
    const deployManifestPath = path.join(rootDir, 'deploy-manifest.json');
    writeJson(deployManifestPath, deployManifest);

    return deployManifest;
}

function main() {
    const args = parseArgs(process.argv.slice(2));
    if (args.help) {
        printHelp();
        return;
    }

    const result = deployLaneModelToRoot(args);

    if (result.dryRun) {
        console.log('[deploy-to-root] DRY RUN — no files written');
        console.log(JSON.stringify(result, null, 2));
    } else {
        console.log(`[deploy-to-root] Deployed lane model to root`);
        console.log(`  lane: ${result.laneSource} (${result.laneStates} states)`);
        console.log(`  root: ${result.previousRootStates} → ${result.laneStates} states`);
        console.log(`  archive: ${result.archiveDir}`);
        console.log(`  deploy-manifest: ${path.join(args.rootModelsDir, 'deploy-manifest.json')}`);
        console.log('');
        console.log('[deploy-to-root] Run `npm run worker:prepare` to sync worker-public mirror.');
    }
}

if (require.main === module) {
    try {
        main();
    } catch (err) {
        console.error('[deploy-to-root] failed:', err && err.message ? err.message : err);
        process.exit(1);
    }
}

module.exports = {
    parseArgs,
    deployLaneModelToRoot
};
