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

    const targetDir = path.dirname(options.targetModelPath);
    fs.mkdirSync(targetDir, { recursive: true });
    fs.copyFileSync(options.candidateModelPath, options.targetModelPath);
    const candidateOnnxPath = options.candidateOnnxPath || null;
    const candidateOnnxMetaPath = options.candidateOnnxMetaPath || (candidateOnnxPath ? `${candidateOnnxPath}.meta.json` : null);
    const onnxPromotion = promoteOptionalFile(candidateOnnxPath, options.targetOnnxPath);
    const onnxMetaPromotion = promoteOptionalFile(candidateOnnxMetaPath, options.targetOnnxMetaPath);
    return {
        targetModelPath: options.targetModelPath,
        candidateModelPath: options.candidateModelPath,
        onnxPromotion,
        onnxMetaPromotion,
        forced: !!options.force,
        promotedAt: new Date().toISOString()
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
