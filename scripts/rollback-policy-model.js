#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

function parseArgs(argv) {
    const args = {
        manifestPath: null,
        out: null,
        help: false
    };

    for (let i = 0; i < argv.length; i++) {
        const a = argv[i];
        if (a === '--help' || a === '-h') { args.help = true; continue; }
        if (a === '--manifest') { args.manifestPath = path.resolve(process.cwd(), argv[++i]); continue; }
        if (a === '--out') { args.out = path.resolve(process.cwd(), argv[++i]); continue; }
    }

    if (!args.help && !args.manifestPath) {
        throw new Error('--manifest is required');
    }
    return args;
}

function printHelp() {
    console.log([
        'Usage:',
        '  node scripts/rollback-policy-model.js --manifest <path> [options]',
        '',
        'Options:',
        '      --manifest <path>  Promotion manifest JSON (required)',
        '      --out <path>       Optional rollback result JSON path',
        '  -h, --help             Show this help'
    ].join('\n'));
}

function readJson(p) {
    return JSON.parse(fs.readFileSync(p, 'utf8'));
}

function copyRequiredFile(srcPath, targetPath, label) {
    if (!srcPath || !fs.existsSync(srcPath)) {
        throw new Error(`${label} is missing: ${srcPath || '(null)'}`);
    }
    fs.mkdirSync(path.dirname(targetPath), { recursive: true });
    fs.copyFileSync(srcPath, targetPath);
    return { restored: true, sourcePath: srcPath, targetPath };
}

function restoreOptionalFile(srcPath, targetPath) {
    if (!srcPath) {
        return { restored: false, skipped: true, reason: 'not_requested', sourcePath: null, targetPath };
    }
    if (!fs.existsSync(srcPath)) {
        return { restored: false, skipped: true, reason: 'source_missing', sourcePath: srcPath, targetPath };
    }
    fs.mkdirSync(path.dirname(targetPath), { recursive: true });
    fs.copyFileSync(srcPath, targetPath);
    return { restored: true, skipped: false, reason: null, sourcePath: srcPath, targetPath };
}

function rollbackModel(options) {
    const manifest = readJson(options.manifestPath);
    if (!manifest || (manifest.schemaVersion !== 'policy_promotion.v2' && manifest.schemaVersion !== 'policy_promotion.v3')) {
        throw new Error('manifest schema must be policy_promotion.v2 or policy_promotion.v3');
    }
    const deployTruth = manifest.deployTruthPath && fs.existsSync(manifest.deployTruthPath)
        ? readJson(manifest.deployTruthPath)
        : null;
    const source = deployTruth && typeof deployTruth === 'object' ? deployTruth : manifest;
    if (!source.rollback || !source.rollback.modelPath) {
        throw new Error('manifest does not include a rollback model path');
    }
    if (!source.deployed || !source.deployed.modelPath) {
        throw new Error('manifest does not include deployed target paths');
    }

    const restoredAt = typeof options.restoredAt === 'string' && options.restoredAt.trim()
        ? options.restoredAt.trim()
        : new Date().toISOString();
    const deployed = source.deployed;
    const champion = source.champion || null;

    const restored = {
        model: copyRequiredFile(source.rollback.modelPath, deployed.modelPath, 'rollback model'),
        onnx: restoreOptionalFile(source.rollback.onnxPath, deployed.onnxPath || null),
        onnxMeta: restoreOptionalFile(source.rollback.onnxMetaPath, deployed.onnxMetaPath || null),
        cardOnnx: restoreOptionalFile(source.rollback.cardOnnxPath, deployed.cardOnnxPath || null),
        cardOnnxMeta: restoreOptionalFile(source.rollback.cardOnnxMetaPath, deployed.cardOnnxMetaPath || null),
        targetOnnx: restoreOptionalFile(source.rollback.targetOnnxPath, deployed.targetOnnxPath || null),
        targetOnnxMeta: restoreOptionalFile(source.rollback.targetOnnxMetaPath, deployed.targetOnnxMetaPath || null),
        valueOnnx: restoreOptionalFile(source.rollback.valueOnnxPath, deployed.valueOnnxPath || null),
        valueOnnxMeta: restoreOptionalFile(source.rollback.valueOnnxMetaPath, deployed.valueOnnxMetaPath || null)
    };

    const championRestore = champion
        ? {
            model: copyRequiredFile(source.rollback.modelPath, champion.modelPath, 'champion rollback model'),
            onnx: restoreOptionalFile(source.rollback.onnxPath, champion.onnxPath || null),
            onnxMeta: restoreOptionalFile(source.rollback.onnxMetaPath, champion.onnxMetaPath || null),
            cardOnnx: restoreOptionalFile(source.rollback.cardOnnxPath, champion.cardOnnxPath || null),
            cardOnnxMeta: restoreOptionalFile(source.rollback.cardOnnxMetaPath, champion.cardOnnxMetaPath || null),
            targetOnnx: restoreOptionalFile(source.rollback.targetOnnxPath, champion.targetOnnxPath || null),
            targetOnnxMeta: restoreOptionalFile(source.rollback.targetOnnxMetaPath, champion.targetOnnxMetaPath || null),
            valueOnnx: restoreOptionalFile(source.rollback.valueOnnxPath, champion.valueOnnxPath || null),
            valueOnnxMeta: restoreOptionalFile(source.rollback.valueOnnxMetaPath, champion.valueOnnxMetaPath || null)
        }
        : null;

    return {
        manifestPath: options.manifestPath,
        promotionId: manifest.promotionId || null,
        deployTruthPath: manifest.deployTruthPath || null,
        restoredAt,
        restored,
        championRestore
    };
}

function main() {
    const args = parseArgs(process.argv.slice(2));
    if (args.help) {
        printHelp();
        return;
    }
    const result = rollbackModel(args);
    if (args.out) {
        fs.mkdirSync(path.dirname(args.out), { recursive: true });
        fs.writeFileSync(args.out, JSON.stringify(result, null, 2), 'utf8');
        console.log(`[policy-rollback] wrote: ${args.out}`);
    }
    console.log(`[policy-rollback] restored model -> ${result.restored.model.targetPath}`);
}

if (require.main === module) {
    try {
        main();
    } catch (err) {
        console.error('[policy-rollback] failed:', err && err.message ? err.message : err);
        process.exit(1);
    }
}

module.exports = {
    parseArgs,
    rollbackModel
};
