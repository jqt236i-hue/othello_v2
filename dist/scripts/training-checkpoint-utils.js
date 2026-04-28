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
const path = __importStar(require("path"));
const _require = (typeof __non_webpack_require__ !== 'undefined')
    ? __non_webpack_require__
    : require;
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
    if (!value || typeof value !== 'object')
        return out;
    for (const spec of TRAINING_CHECKPOINT_HEAD_SPECS) {
        out[spec.head] = value[spec.head] ? String(value[spec.head]) : null;
    }
    return out;
}
function detectCheckpointHead(checkpointPath) {
    const baseName = path.basename(String(checkpointPath || '')).toLowerCase();
    for (const spec of TRAINING_CHECKPOINT_HEAD_SPECS) {
        if (baseName.startsWith(spec.prefix))
            return spec.head;
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
//# sourceMappingURL=training-checkpoint-utils.js.map