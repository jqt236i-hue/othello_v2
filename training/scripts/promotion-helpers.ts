import * as fs from 'fs';
import * as path from 'path';

declare const __non_webpack_require__: NodeRequire | undefined;

const _require: NodeRequire = (typeof __non_webpack_require__ !== 'undefined')
  ? __non_webpack_require__
  : require;

let classifyTrainingArtifactPath: any;
try {
    ({ classifyTrainingArtifactPath } = require('./training-artifact-status'));
} catch (e) {
    classifyTrainingArtifactPath = () => ({
        lifecycle: 'unknown', reason: 'classification unavailable',
        compatibility: null, expectedCheckpointHead: null, detectedCheckpointHead: null
    });
}

interface TransferRecord {
    promoted: boolean;
    skipped: boolean;
    reason: string | null;
}

interface TransferArtifact extends TransferRecord {
    sourcePath: string | null;
    targetPath: string | null;
    lifecycle: string;
    lifecycleReason: string;
    compatibility: any;
    expectedCheckpointHead: any;
    detectedCheckpointHead: any;
}

interface BundlePaths {
    rootDir: string;
    modelPath: string;
    onnxPath: string | null;
    onnxMetaPath: string | null;
    cardOnnxPath: string | null;
    cardOnnxMetaPath: string | null;
    targetOnnxPath: string | null;
    targetOnnxMetaPath: string | null;
    valueOnnxPath: string | null;
    valueOnnxMetaPath: string | null;
}

interface BundleOptions {
    targetModelPath: string;
    targetOnnxPath?: string;
    targetOnnxMetaPath?: string;
    targetCardOnnxPath?: string;
    targetCardOnnxMetaPath?: string;
    targetTargetOnnxPath?: string;
    targetTargetOnnxMetaPath?: string;
    targetValueOnnxPath?: string;
    targetValueOnnxMetaPath?: string;
}

function readJson(p: string): any {
    const raw = fs.readFileSync(p, 'utf8');
    return JSON.parse(raw);
}

function writeJson(p: string, value: any) {
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, JSON.stringify(value, null, 2), 'utf8');
}

function validatePolicyModel(model: any) {
    if (!model || typeof model !== 'object') throw new Error('model is not an object');
    if (model.schemaVersion !== 'policy_table.v1' && model.schemaVersion !== 'policy_table.v2') {
        throw new Error('model schema must be policy_table.v1 or policy_table.v2');
    }
    if (!model.states || typeof model.states !== 'object') throw new Error('model must include states object');
}

function sanitizePromotionId(value: any): string {
    const raw = typeof value === 'string' && value.trim()
        ? value.trim()
        : new Date().toISOString();
    return raw.replace(/[\\/:*?"()<>|.]+/g, '-').replace(/\s+/g, '-');
}

function decorateTransferArtifact(record: TransferRecord, sourcePath: string | null, targetPath: string | null): TransferArtifact {
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

function copyRequiredFile(srcPath: string, targetPath: string, label: string): TransferArtifact {
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

function promoteOptionalFile(srcPath: string | null, targetPath: string | null): TransferArtifact {
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
    const targetDir = path.dirname(targetPath!);
    fs.mkdirSync(targetDir, { recursive: true });
    fs.copyFileSync(srcPath, targetPath!);
    return decorateTransferArtifact({
        promoted: true,
        skipped: false,
        reason: null
    }, srcPath, targetPath);
}

function archiveExistingFile(srcPath: string | null, targetPath: string | null): any {
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

function buildBundlePaths(rootDir: string, bundleName: string, options: BundleOptions): BundlePaths {
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

export = { 
    readJson,
    writeJson,
    validatePolicyModel,
    sanitizePromotionId,
    decorateTransferArtifact,
    copyRequiredFile,
    promoteOptionalFile,
    archiveExistingFile,
    buildBundlePaths,
    classifyTrainingArtifactPath: (...args: any[]) => classifyTrainingArtifactPath(...args)
 } as any;
