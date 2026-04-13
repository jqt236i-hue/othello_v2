'use strict';

const path = require('path');

const { detectCheckpointHead } = require('./training-checkpoint-utils');

const TRAINING_ARTIFACT_LIFECYCLES = Object.freeze({
    ACTIVE: 'active',
    ARCHIVED: 'archived',
    EXPERIMENTAL: 'experimental',
    INCOMPATIBLE: 'incompatible'
});

const TRAINING_ARTIFACT_COMPATIBILITY = Object.freeze({
    COMPATIBLE: 'compatible',
    INCOMPATIBLE: 'incompatible',
    UNKNOWN: 'unknown'
});

const EXPECTED_CHECKPOINT_HEAD_BY_KIND = Object.freeze({
    'model.policy-checkpoint': 'policy',
    'model.card-checkpoint': 'card',
    'model.target-checkpoint': 'target',
    'model.value-checkpoint': 'value'
});

const DEFAULT_BOARD_SIZE = 8;

function normalizePath(filePath) {
    return filePath ? path.resolve(filePath) : null;
}

function getPathSegments(filePath) {
    const resolvedPath = normalizePath(filePath);
    if (!resolvedPath) return [];
    return resolvedPath.split(path.sep).filter(Boolean).map((segment) => segment.toLowerCase());
}

function classifyLifecycle(filePath, kind) {
    const resolvedPath = normalizePath(filePath);
    if (!resolvedPath) {
        return {
            lifecycle: null,
            reason: 'missing-path'
        };
    }

    const segments = getPathSegments(resolvedPath);
    const baseName = path.basename(resolvedPath).toLowerCase();
    const normalizedKind = typeof kind === 'string' ? kind.toLowerCase() : '';

    const shapeMatch = baseName.match(/shape(\d+)x(\d+)/i);
    if (shapeMatch) {
        const detectedRows = Number(shapeMatch[1]);
        const detectedCols = Number(shapeMatch[2]);
        if (
            Number.isFinite(detectedRows) &&
            Number.isFinite(detectedCols) &&
            (detectedRows !== DEFAULT_BOARD_SIZE || detectedCols !== DEFAULT_BOARD_SIZE)
        ) {
            return {
                lifecycle: TRAINING_ARTIFACT_LIFECYCLES.INCOMPATIBLE,
                reason: 'board-shape-mismatch',
                expectedBoardSize: DEFAULT_BOARD_SIZE,
                detectedBoardSize: `${detectedRows}x${detectedCols}`
            };
        }
    }

    if (segments.includes('archive')) {
        return {
            lifecycle: TRAINING_ARTIFACT_LIFECYCLES.ARCHIVED,
            reason: 'archive-path'
        };
    }

    if (segments.includes('promoted')) {
        if (segments.includes('challenger')) {
            return {
                lifecycle: TRAINING_ARTIFACT_LIFECYCLES.EXPERIMENTAL,
                reason: 'promoted-challenger'
            };
        }
        if (segments.includes('champion')) {
            return {
                lifecycle: TRAINING_ARTIFACT_LIFECYCLES.ACTIVE,
                reason: 'promoted-champion'
            };
        }
        return {
            lifecycle: TRAINING_ARTIFACT_LIFECYCLES.ACTIVE,
            reason: 'promoted-root'
        };
    }

    if (segments.includes('runs') || segments.includes('deepcfr')) {
        return {
            lifecycle: TRAINING_ARTIFACT_LIFECYCLES.EXPERIMENTAL,
            reason: 'run-output-path'
        };
    }

    if (
        baseName.includes('.candidate.') ||
        baseName.startsWith('candidate.') ||
        baseName.includes('candidate')
    ) {
        return {
            lifecycle: TRAINING_ARTIFACT_LIFECYCLES.EXPERIMENTAL,
            reason: 'candidate-name'
        };
    }

    if (baseName.startsWith('training-warehouse.')) {
        return {
            lifecycle: TRAINING_ARTIFACT_LIFECYCLES.EXPERIMENTAL,
            reason: 'warehouse-manifest'
        };
    }

    if (normalizedKind.startsWith('gate.')) {
        return {
            lifecycle: TRAINING_ARTIFACT_LIFECYCLES.EXPERIMENTAL,
            reason: 'gate-artifact'
        };
    }

    if (normalizedKind.startsWith('selfplay.')) {
        return {
            lifecycle: TRAINING_ARTIFACT_LIFECYCLES.EXPERIMENTAL,
            reason: 'selfplay-artifact'
        };
    }

    if (baseName === 'promotion-manifest.json') {
        return {
            lifecycle: TRAINING_ARTIFACT_LIFECYCLES.ACTIVE,
            reason: 'promotion-manifest'
        };
    }

    return {
        lifecycle: TRAINING_ARTIFACT_LIFECYCLES.ACTIVE,
        reason: 'default-active'
    };
}

function resolveCheckpointCompatibility(filePath, kind, expectedCheckpointHead) {
    const resolvedExpectedHead = expectedCheckpointHead || EXPECTED_CHECKPOINT_HEAD_BY_KIND[kind] || null;
    const detectedCheckpointHead = detectCheckpointHead(filePath);
    if (!resolvedExpectedHead) {
        return {
            compatibility: TRAINING_ARTIFACT_COMPATIBILITY.UNKNOWN,
            expectedCheckpointHead: null,
            detectedCheckpointHead
        };
    }
    if (!detectedCheckpointHead) {
        return {
            compatibility: TRAINING_ARTIFACT_COMPATIBILITY.UNKNOWN,
            expectedCheckpointHead: resolvedExpectedHead,
            detectedCheckpointHead: null
        };
    }
    if (detectedCheckpointHead !== resolvedExpectedHead) {
        return {
            compatibility: TRAINING_ARTIFACT_COMPATIBILITY.INCOMPATIBLE,
            expectedCheckpointHead: resolvedExpectedHead,
            detectedCheckpointHead
        };
    }
    return {
        compatibility: TRAINING_ARTIFACT_COMPATIBILITY.COMPATIBLE,
        expectedCheckpointHead: resolvedExpectedHead,
        detectedCheckpointHead
    };
}

function classifyTrainingArtifactPath(filePath, options) {
    const kind = options && typeof options.kind === 'string' ? options.kind : null;
    const expectedCheckpointHead = options && options.expectedCheckpointHead
        ? String(options.expectedCheckpointHead)
        : null;
    const lifecycleInfo = classifyLifecycle(filePath, kind);
    if (lifecycleInfo.lifecycle === TRAINING_ARTIFACT_LIFECYCLES.INCOMPATIBLE && lifecycleInfo.reason === 'board-shape-mismatch') {
        return {
            lifecycle: TRAINING_ARTIFACT_LIFECYCLES.INCOMPATIBLE,
            reason: lifecycleInfo.reason,
            compatibility: TRAINING_ARTIFACT_COMPATIBILITY.INCOMPATIBLE,
            expectedBoardSize: lifecycleInfo.expectedBoardSize,
            detectedBoardSize: lifecycleInfo.detectedBoardSize
        };
    }
    const compatibilityInfo = resolveCheckpointCompatibility(filePath, kind, expectedCheckpointHead);

    if (compatibilityInfo.compatibility === TRAINING_ARTIFACT_COMPATIBILITY.INCOMPATIBLE) {
        return {
            lifecycle: TRAINING_ARTIFACT_LIFECYCLES.INCOMPATIBLE,
            reason: 'checkpoint-head-mismatch',
            compatibility: TRAINING_ARTIFACT_COMPATIBILITY.INCOMPATIBLE,
            expectedCheckpointHead: compatibilityInfo.expectedCheckpointHead,
            detectedCheckpointHead: compatibilityInfo.detectedCheckpointHead
        };
    }

    return {
        lifecycle: lifecycleInfo.lifecycle,
        reason: lifecycleInfo.reason,
        compatibility: compatibilityInfo.compatibility,
        expectedCheckpointHead: compatibilityInfo.expectedCheckpointHead,
        detectedCheckpointHead: compatibilityInfo.detectedCheckpointHead
    };
}

module.exports = {
    TRAINING_ARTIFACT_LIFECYCLES,
    TRAINING_ARTIFACT_COMPATIBILITY,
    classifyTrainingArtifactPath
};
