import * as path from 'path';

declare const __non_webpack_require__: NodeRequire | undefined;

const _require: NodeRequire = (typeof __non_webpack_require__ !== 'undefined')
  ? __non_webpack_require__
  : require;

interface CheckpointSpec {
    head: string;
    prefix: string;
    resumeFlag: string;
    argKey: string;
    bootstrapKey: string;
    resultPathKey: string;
}

interface ResumeCheckpointPaths {
    policy: string | null;
    card: string | null;
    target: string | null;
    value: string | null;
}

const TRAINING_CHECKPOINT_HEAD_SPECS: ReadonlyArray<CheckpointSpec> = Object.freeze([
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

function createEmptyResumeCheckpointPaths(): ResumeCheckpointPaths {
    return {
        policy: null,
        card: null,
        target: null,
        value: null
    };
}

function cloneResumeCheckpointPaths(value: any): ResumeCheckpointPaths {
    const out = createEmptyResumeCheckpointPaths();
    if (!value || typeof value !== 'object') return out;
    for (const spec of TRAINING_CHECKPOINT_HEAD_SPECS) {
        out[spec.head as keyof ResumeCheckpointPaths] = value[spec.head] ? String(value[spec.head]) : null;
    }
    return out;
}

function detectCheckpointHead(checkpointPath: string): string | null {
    const baseName = path.basename(String(checkpointPath || '')).toLowerCase();
    for (const spec of TRAINING_CHECKPOINT_HEAD_SPECS) {
        if (baseName.startsWith(spec.prefix)) return spec.head;
    }
    return null;
}

function isCheckpointNameCompatibleWithHead(checkpointPath: string, head: string): boolean {
    const detectedHead = detectCheckpointHead(checkpointPath);
    return detectedHead === null || detectedHead === head;
}

export = { 
    TRAINING_CHECKPOINT_HEAD_SPECS,
    createEmptyResumeCheckpointPaths,
    cloneResumeCheckpointPaths,
    detectCheckpointHead,
    isCheckpointNameCompatibleWithHead
 } as any;
