'use strict';

const path = require('path');

const TRAINING_CHECKPOINT_HEAD_SPECS = Object.freeze([
    Object.freeze({
        head: 'policy',
        prefix: 'policy-net.',
        resumeFlag: '--resume-policy-checkpoint',
        argKey: 'resumePolicyCheckpointPath',
        bootstrapKey: 'resumePolicyCheckpointPath',
        resultPathKey: 'checkpointPath'
    }),
    Object.freeze({
        head: 'card',
        prefix: 'policy-card.',
        resumeFlag: '--resume-card-checkpoint',
        argKey: 'resumeCardCheckpointPath',
        bootstrapKey: 'resumeCardCheckpointPath',
        resultPathKey: 'cardCheckpointPath'
    }),
    Object.freeze({
        head: 'target',
        prefix: 'policy-target.',
        resumeFlag: '--resume-target-checkpoint',
        argKey: 'resumeTargetCheckpointPath',
        bootstrapKey: 'resumeTargetCheckpointPath',
        resultPathKey: 'targetCheckpointPath'
    }),
    Object.freeze({
        head: 'value',
        prefix: 'policy-value.',
        resumeFlag: '--resume-value-checkpoint',
        argKey: 'resumeValueCheckpointPath',
        bootstrapKey: 'resumeValueCheckpointPath',
        resultPathKey: 'valueCheckpointPath'
    })
]);

function createEmptyResumeCheckpointPaths() {
    return {
        policy: null,
        card: null,
        target: null,
        value: null
    };
}

function cloneResumeCheckpointPaths(value) {
    const out = createEmptyResumeCheckpointPaths();
    if (!value || typeof value !== 'object') return out;
    for (const spec of TRAINING_CHECKPOINT_HEAD_SPECS) {
        out[spec.head] = value[spec.head] ? String(value[spec.head]) : null;
    }
    return out;
}

function detectCheckpointHead(checkpointPath) {
    const baseName = path.basename(String(checkpointPath || '')).toLowerCase();
    for (const spec of TRAINING_CHECKPOINT_HEAD_SPECS) {
        if (baseName.startsWith(spec.prefix)) return spec.head;
    }
    return null;
}

function isCheckpointNameCompatibleWithHead(checkpointPath, head) {
    const detectedHead = detectCheckpointHead(checkpointPath);
    return detectedHead === null || detectedHead === head;
}

module.exports = {
    TRAINING_CHECKPOINT_HEAD_SPECS,
    createEmptyResumeCheckpointPaths,
    cloneResumeCheckpointPaths,
    detectCheckpointHead,
    isCheckpointNameCompatibleWithHead
};
