'use strict';

const cpuLv6SharedProfile = require('../constants/cpu-lv6-shared-profile');

function readFiniteNumber(value, fallback) {
    const num = Number(value);
    return Number.isFinite(num) ? num : fallback;
}

function readNonNegativeInt(value, fallback) {
    return Math.max(0, Math.floor(readFiniteNumber(value, fallback)));
}

function readUnitRate(value, fallback) {
    return Math.max(0, Math.min(1, readFiniteNumber(value, fallback)));
}

function getStandaloneSelfplayTeacherDefaults() {
    const teacher = cpuLv6SharedProfile && cpuLv6SharedProfile.teacher && typeof cpuLv6SharedProfile.teacher === 'object'
        ? cpuLv6SharedProfile.teacher
        : {};
    const tacticalWeightMin = Math.max(0, readFiniteNumber(teacher.tacticalWeightMin, 1));
    const teacherCommitteeWeightMin = Math.max(0, readFiniteNumber(teacher.teacherCommitteeWeightMin, 28));
    const teacherCommitteeConsensusBonusMin = Math.max(0, readFiniteNumber(teacher.teacherCommitteeConsensusBonusMin, 320));
    const policyScoreWeightMin = Math.max(0, readFiniteNumber(teacher.policyScoreWeightMin, 1));
    const heuristicWeightMin = Math.max(0, readFiniteNumber(teacher.heuristicWeightMin, 1));
    return Object.freeze({
        policyMixRate: readUnitRate(teacher.policyMixRate, 1),
        policyPoolSampling: String(teacher.policyPoolSampling || 'uniform').trim().toLowerCase() || 'uniform',
        policyPoolRecencyDecay: Math.max(0.000001, readFiniteNumber(teacher.policyPoolRecencyDecay, 1)),
        policyCurrentAnchorRate: readUnitRate(teacher.policyCurrentAnchorRate, 0),
        tacticalWeightMin,
        tacticalWeightMax: Math.max(tacticalWeightMin, readFiniteNumber(teacher.tacticalWeightMax, tacticalWeightMin)),
        tacticalDepthOpening: readNonNegativeInt(teacher.tacticalDepthOpening, 2),
        tacticalDepthMid: readNonNegativeInt(teacher.tacticalDepthMid, 3),
        tacticalDepthEnd: readNonNegativeInt(teacher.tacticalDepthEnd, 4),
        tacticalBeamWidth: readNonNegativeInt(teacher.tacticalBeamWidth, 0),
        teacherCommitteeWeightMin,
        teacherCommitteeWeightMax: Math.max(teacherCommitteeWeightMin, readFiniteNumber(teacher.teacherCommitteeWeightMax, teacherCommitteeWeightMin)),
        teacherCommitteeConsensusBonusMin,
        teacherCommitteeConsensusBonusMax: Math.max(
            teacherCommitteeConsensusBonusMin,
            readFiniteNumber(teacher.teacherCommitteeConsensusBonusMax, teacherCommitteeConsensusBonusMin)
        ),
        policyScoreWeightMin,
        policyScoreWeightMax: Math.max(policyScoreWeightMin, readFiniteNumber(teacher.policyScoreWeightMax, policyScoreWeightMin)),
        heuristicWeightMin,
        heuristicWeightMax: Math.max(heuristicWeightMin, readFiniteNumber(teacher.heuristicWeightMax, heuristicWeightMin))
    });
}

module.exports = {
    getStandaloneSelfplayTeacherDefaults
};
