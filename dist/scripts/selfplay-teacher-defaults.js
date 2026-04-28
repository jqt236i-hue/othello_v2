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
const cpuLv6SharedProfile = __importStar(require("../constants/cpu-lv6-shared-profile"));
const _require = (typeof __non_webpack_require__ !== 'undefined')
    ? __non_webpack_require__
    : require;
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
        teacherCommitteeConsensusBonusMax: Math.max(teacherCommitteeConsensusBonusMin, readFiniteNumber(teacher.teacherCommitteeConsensusBonusMax, teacherCommitteeConsensusBonusMin)),
        policyScoreWeightMin,
        policyScoreWeightMax: Math.max(policyScoreWeightMin, readFiniteNumber(teacher.policyScoreWeightMax, policyScoreWeightMin)),
        heuristicWeightMin,
        heuristicWeightMax: Math.max(heuristicWeightMin, readFiniteNumber(teacher.heuristicWeightMax, heuristicWeightMin))
    });
}
module.exports = {
    getStandaloneSelfplayTeacherDefaults
};
//# sourceMappingURL=selfplay-teacher-defaults.js.map