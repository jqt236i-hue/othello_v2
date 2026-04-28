// @ts-nocheck
'use strict';

import * as path from 'path';

import _training_checkpoint_utils from './training-checkpoint-utils';
const { detectCheckpointHead } = _training_checkpoint_utils;

declare const __non_webpack_require__: NodeRequire | undefined;

const _require: NodeRequire = (typeof __non_webpack_require__ !== 'undefined')
  ? __non_webpack_require__
  : require;

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

function normalizePath(filePath: string) {
    return filePath ? path.resolve(filePath) : null;
}

function getPathSegments(filePath: string) {
    const resolvedPath = normalizePath(filePath);
    if (!resolvedPath) return [];
    return resolvedPath.split(path.sep).filter(Boolean).map((segment: any) => segment.toLowerCase());
}

function classifyLifecycle(filePath: any, kind: any) {
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

function resolveCheckpointCompatibility(filePath: any, kind: any, expectedCheckpointHead: any) {
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

function classifyTrainingArtifactPath(filePath: any, options: any) {
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

export = {
    TRAINING_ARTIFACT_LIFECYCLES,
    TRAINING_ARTIFACT_COMPATIBILITY,
    classifyTrainingArtifactPath
};
