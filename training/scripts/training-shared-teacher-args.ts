'use strict';

const SHARED_TEACHER_ARG_SPECS = Object.freeze([
    { flag: '--selfplay-policy-mix-rate', key: 'policyMixRate', type: 'number' },
    { flag: '--selfplay-policy-model-pool-size', key: 'policyModelPoolSize', type: 'integer' },
    { flag: '--selfplay-policy-pool-sampling', key: 'policyPoolSampling', type: 'string' },
    { flag: '--selfplay-policy-pool-recency-decay', key: 'policyPoolRecencyDecay', type: 'number' },
    { flag: '--selfplay-policy-current-anchor-rate', key: 'policyCurrentAnchorRate', type: 'number' },
    { flag: '--selfplay-tactical-weight-min', key: 'tacticalWeightMin', type: 'number' },
    { flag: '--selfplay-tactical-weight-max', key: 'tacticalWeightMax', type: 'number' },
    { flag: '--selfplay-tactical-depth-opening', key: 'tacticalDepthOpening', type: 'integer' },
    { flag: '--selfplay-tactical-depth-mid', key: 'tacticalDepthMid', type: 'integer' },
    { flag: '--selfplay-tactical-depth-end', key: 'tacticalDepthEnd', type: 'integer' },
    { flag: '--selfplay-tactical-beam-width', key: 'tacticalBeamWidth', type: 'integer' },
    { flag: '--selfplay-policy-score-weight-min', key: 'policyScoreWeightMin', type: 'number' },
    { flag: '--selfplay-policy-score-weight-max', key: 'policyScoreWeightMax', type: 'number' },
    { flag: '--selfplay-heuristic-weight-min', key: 'heuristicWeightMin', type: 'number' },
    { flag: '--selfplay-heuristic-weight-max', key: 'heuristicWeightMax', type: 'number' },
    { flag: '--selfplay-teacher-committee-weight-min', key: 'teacherCommitteeWeightMin', type: 'number' },
    { flag: '--selfplay-teacher-committee-weight-max', key: 'teacherCommitteeWeightMax', type: 'number' },
    { flag: '--selfplay-teacher-committee-consensus-bonus-min', key: 'teacherCommitteeConsensusBonusMin', type: 'number' },
    { flag: '--selfplay-teacher-committee-consensus-bonus-max', key: 'teacherCommitteeConsensusBonusMax', type: 'number' }
]);

function findFlagIndex(args: any, flag: any) {
    if (!Array.isArray(args) || !flag) return -1;
    for (let i = 0; i < args.length; i++) {
        if (String(args[i] || '').trim() === flag) return i;
    }
    return -1;
}

function removeFlagAndValue(args: any, flag: any) {
    if (!Array.isArray(args) || !flag) return args || [];
    const out = args.slice();
    const index = findFlagIndex(out, flag);
    if (index < 0) return out;
    out.splice(index, 1);
    if (index < out.length && !String(out[index] || '').trim().startsWith('--')) {
        out.splice(index, 1);
    }
    return out;
}

function upsertFlagValue(args: any, flag: any, value: any) {
    const out = removeFlagAndValue(args, flag);
    out.push(flag, String(value));
    return out;
}

function upsertBooleanFlag(args: any, flag: any, enabled: any) {
    const out = removeFlagAndValue(args, flag);
    if (enabled) out.push(flag);
    return out;
}

function formatSharedTeacherValue(type: any, value: any) {
    if (type === 'integer') {
        const numeric = Math.max(0, Math.floor(Number(value) || 0));
        return String(numeric);
    }
    if (type === 'number') {
        const numeric = Number(value);
        return String(Number.isFinite(numeric) ? numeric : 0);
    }
    return String(value);
}

function resolveGuideModeFromArgs(args: any) {
    if (findFlagIndex(args, '--selfplay-use-promoted-model-only') >= 0) return 'promoted-only';
    if (findFlagIndex(args, '--selfplay-use-candidate-every-iteration') >= 0) return 'candidate-every-iteration';
    return null;
}

function applySharedTeacherProfileArgs(trainCycleArgs: any, teacherProfile: any, options: any) {
    let nextArgs = Array.isArray(trainCycleArgs) ? trainCycleArgs.slice() : [];
    const syncMode = options && options.mode === 'override' ? 'override' : 'fill-missing';
    const report = {
        enabled: true,
        mode: syncMode,
        sourcePath: options && options.sourcePath ? options.sourcePath : null,
        sourceFound: !!(teacherProfile && typeof teacherProfile === 'object'),
        flagActions: [],
        guideMode: {
            desired: null,
            active: resolveGuideModeFromArgs(nextArgs),
            status: teacherProfile && typeof teacherProfile === 'object'
                ? 'preserved-explicit'
                : 'source-missing'
        }
    };
    if (!teacherProfile || typeof teacherProfile !== 'object') {
        return { args: nextArgs, report };
    }

    for (const spec of SHARED_TEACHER_ARG_SPECS) {
        const rawValue = teacherProfile[spec.key];
        if (rawValue == null) {
            report.flagActions.push({
                flag: spec.flag,
                key: spec.key,
                status: 'missing-source-value'
            });
            continue;
        }
        const formattedValue = formatSharedTeacherValue(spec.type, rawValue);
        const hasExplicitFlag = findFlagIndex(nextArgs, spec.flag) >= 0;
        if (hasExplicitFlag && syncMode !== 'override') {
            report.flagActions.push({
                flag: spec.flag,
                key: spec.key,
                teacherValue: rawValue,
                formattedValue,
                status: 'preserved-explicit'
            });
            continue;
        }
        nextArgs = upsertFlagValue(nextArgs, spec.flag, formattedValue);
        report.flagActions.push({
            flag: spec.flag,
            key: spec.key,
            teacherValue: rawValue,
            formattedValue,
            status: hasExplicitFlag ? 'overrode-explicit' : 'applied'
        });
    }
    const desiredGuideMode = teacherProfile.usePromotedModelOnly === false
        ? 'candidate-every-iteration'
        : 'promoted-only';
    const explicitGuideMode = resolveGuideModeFromArgs(nextArgs);
    if (!explicitGuideMode || syncMode === 'override') {
        nextArgs = upsertBooleanFlag(
            nextArgs,
            '--selfplay-use-promoted-model-only',
            teacherProfile.usePromotedModelOnly !== false
        );
        nextArgs = upsertBooleanFlag(
            nextArgs,
            '--selfplay-use-candidate-every-iteration',
            teacherProfile.usePromotedModelOnly === false
        );
        report.guideMode = {
            desired: desiredGuideMode,
            active: resolveGuideModeFromArgs(nextArgs),
            status: explicitGuideMode && syncMode === 'override'
                ? 'overrode-explicit'
                : 'applied'
        };
    } else {
        report.guideMode = {
            desired: desiredGuideMode,
            active: explicitGuideMode,
            status: 'preserved-explicit'
        };
    }
    return { args: nextArgs, report };
}

export = {
    SHARED_TEACHER_ARG_SPECS,
    findFlagIndex,
    resolveGuideModeFromArgs,
    applySharedTeacherProfileArgs
};
