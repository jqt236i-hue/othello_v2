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
let classifyTrainingArtifactPath;
try {
    ({ classifyTrainingArtifactPath } = require('./training-artifact-status'));
}
catch (e) {
    classifyTrainingArtifactPath = () => ({
        lifecycle: 'unknown', reason: 'classification unavailable',
        compatibility: null, expectedCheckpointHead: null, detectedCheckpointHead: null
    });
}
function readJson(p) {
    const raw = fs.readFileSync(p, 'utf8');
    return JSON.parse(raw);
}
function writeJson(p, value) {
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, JSON.stringify(value, null, 2), 'utf8');
}
function validatePolicyModel(model) {
    if (!model || typeof model !== 'object')
        throw new Error('model is not an object');
    if (model.schemaVersion !== 'policy_table.v1' && model.schemaVersion !== 'policy_table.v2') {
        throw new Error('model schema must be policy_table.v1 or policy_table.v2');
    }
    if (!model.states || typeof model.states !== 'object')
        throw new Error('model must include states object');
}
function sanitizePromotionId(value) {
    const raw = typeof value === 'string' && value.trim()
        ? value.trim()
        : new Date().toISOString();
    return raw.replace(/[\\/:*?"()<>|.]+/g, '-').replace(/\s+/g, '-');
}
function decorateTransferArtifact(record, sourcePath, targetPath) {
    const classification = classifyTrainingArtifactPath(targetPath || sourcePath);
    return Object.assign({}, record, {
        sourcePath,
        targetPath,
        lifecycle: classification.lifecycle,
        lifecycleReason: classification.reason,
        compatibility: classification.compatibility,
        expectedCheckpointHead: classification.expectedCheckpointHead,
        detectedCheckpointHead: classification.detectedCheckpointHead
    });
}
function copyRequiredFile(srcPath, targetPath, label) {
    if (!srcPath || !fs.existsSync(srcPath)) {
        throw new Error(`${label} is missing: ${srcPath || '(null)'}`);
    }
    fs.mkdirSync(path.dirname(targetPath), { recursive: true });
    fs.copyFileSync(srcPath, targetPath);
    return decorateTransferArtifact({
        promoted: true,
        skipped: false,
        reason: null
    }, srcPath, targetPath);
}
function promoteOptionalFile(srcPath, targetPath) {
    if (!srcPath) {
        return decorateTransferArtifact({
            promoted: false,
            skipped: true,
            reason: 'not_requested'
        }, null, targetPath);
    }
    if (!fs.existsSync(srcPath)) {
        return decorateTransferArtifact({
            promoted: false,
            skipped: true,
            reason: 'source_missing'
        }, srcPath, targetPath);
    }
    const targetDir = path.dirname(targetPath);
    fs.mkdirSync(targetDir, { recursive: true });
    fs.copyFileSync(srcPath, targetPath);
    return decorateTransferArtifact({
        promoted: true,
        skipped: false,
        reason: null
    }, srcPath, targetPath);
}
function archiveExistingFile(srcPath, targetPath) {
    const archived = promoteOptionalFile(srcPath, targetPath);
    return {
        archived: archived.promoted,
        skipped: archived.skipped,
        reason: archived.reason,
        sourcePath: archived.sourcePath,
        targetPath: archived.targetPath,
        lifecycle: archived.lifecycle,
        lifecycleReason: archived.lifecycleReason,
        compatibility: archived.compatibility,
        expectedCheckpointHead: archived.expectedCheckpointHead,
        detectedCheckpointHead: archived.detectedCheckpointHead
    };
}
function buildBundlePaths(rootDir, bundleName, options) {
    const baseDir = path.join(rootDir, bundleName);
    return {
        rootDir: baseDir,
        modelPath: path.join(baseDir, path.basename(options.targetModelPath)),
        onnxPath: options.targetOnnxPath ? path.join(baseDir, path.basename(options.targetOnnxPath)) : null,
        onnxMetaPath: options.targetOnnxMetaPath ? path.join(baseDir, path.basename(options.targetOnnxMetaPath)) : null,
        cardOnnxPath: options.targetCardOnnxPath ? path.join(baseDir, path.basename(options.targetCardOnnxPath)) : null,
        cardOnnxMetaPath: options.targetCardOnnxMetaPath ? path.join(baseDir, path.basename(options.targetCardOnnxMetaPath)) : null,
        targetOnnxPath: options.targetTargetOnnxPath ? path.join(baseDir, path.basename(options.targetTargetOnnxPath)) : null,
        targetOnnxMetaPath: options.targetTargetOnnxMetaPath ? path.join(baseDir, path.basename(options.targetTargetOnnxMetaPath)) : null,
        valueOnnxPath: options.targetValueOnnxPath ? path.join(baseDir, path.basename(options.targetValueOnnxPath)) : null,
        valueOnnxMetaPath: options.targetValueOnnxMetaPath ? path.join(baseDir, path.basename(options.targetValueOnnxMetaPath)) : null
    };
}
module.exports = {
    readJson,
    writeJson,
    validatePolicyModel,
    sanitizePromotionId,
    decorateTransferArtifact,
    copyRequiredFile,
    promoteOptionalFile,
    archiveExistingFile,
    buildBundlePaths,
    classifyTrainingArtifactPath: (...args) => classifyTrainingArtifactPath(...args)
};
//# sourceMappingURL=promotion-helpers.js.map