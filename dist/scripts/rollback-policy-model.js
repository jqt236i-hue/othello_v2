"use strict";
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
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const _require = (typeof __non_webpack_require__ !== 'undefined')
    ? __non_webpack_require__
    : require;
function parseArgs(argv) {
    const args = {
        manifestPath: null,
        out: null,
        help: false
    };
    for (let i = 0; i < argv.length; i++) {
        const a = argv[i];
        if (a === '--help' || a === '-h') {
            args.help = true;
            continue;
        }
        if (a === '--manifest') {
            args.manifestPath = path.resolve(process.cwd(), argv[++i]);
            continue;
        }
        if (a === '--out') {
            args.out = path.resolve(process.cwd(), argv[++i]);
            continue;
        }
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
function doRollback(source, manifest, options) {
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
function rollbackModel(options) {
    const manifest = readJson(options.manifestPath);
    if (!manifest || (manifest.schemaVersion !== 'policy_promotion.v2' && manifest.schemaVersion !== 'policy_promotion.v3')) {
        throw new Error('manifest schema must be policy_promotion.v2 or policy_promotion.v3');
    }
    const deployTruth = manifest.deployTruthPath && fs.existsSync(manifest.deployTruthPath)
        ? readJson(manifest.deployTruthPath)
        : null;
    // Validate promotionId match to prevent cross-promotion rollback
    if (deployTruth && typeof deployTruth === 'object' &&
        deployTruth.promotionId && manifest.promotionId &&
        deployTruth.promotionId !== manifest.promotionId) {
        // Try per-promotionId backup
        const helpers = require('./promotion-helpers');
        const backupName = `promotion-deploy-truth.${helpers.sanitizePromotionId(manifest.promotionId)}.json`;
        const backupPath = path.join(path.dirname(manifest.deployTruthPath), backupName);
        if (fs.existsSync(backupPath)) {
            const backup = readJson(backupPath);
            if (backup && backup.promotionId === manifest.promotionId) {
                return doRollback(backup, manifest, options);
            }
        }
        throw new Error(`deploy-truth promotionId mismatch: manifest=${manifest.promotionId} deploy-truth=${deployTruth.promotionId}. ` +
            `Per-promotionId backup not found at ${backupPath}.`);
    }
    const source = deployTruth && typeof deployTruth === 'object' ? deployTruth : manifest;
    return doRollback(source, manifest, options);
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
    }
    catch (err) {
        console.error('[policy-rollback] failed:', err && err.message ? err.message : err);
        process.exit(1);
    }
}
module.exports = {
    parseArgs,
    rollbackModel
};
//# sourceMappingURL=rollback-policy-model.js.map