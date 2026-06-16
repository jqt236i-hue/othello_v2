'use strict';

const TRAINING_CYCLE_STEP_ORDER = Object.freeze([
    'generate-train',
    'generate-eval',
    'train-policy',
    'evaluate-policy',
    'train-card-policy',
    'train-target-policy',
    'train-value-policy',
    'adoption-quick',
    'adoption-quality-gate',
    'adoption-final',
    'adoption-onnx-gate',
    'promote-model',
    'deploy-promoted-root'
]);

function isTrainingCycleStep(value: any) {
    return TRAINING_CYCLE_STEP_ORDER.includes(String(value || ''));
}

export = {
    TRAINING_CYCLE_STEP_ORDER,
    isTrainingCycleStep
};
