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
Object.defineProperty(exports, "__esModule", { value: true });
const cpuLv6SharedProfile = __importStar(require("../constants/cpu-lv6-shared-profile.js"));
describe('cpu lv6 shared profile', () => {
    test('exports browser and teacher parity settings', () => {
        expect(cpuLv6SharedProfile).toBeTruthy();
        expect(cpuLv6SharedProfile.version).toBe('teacher_lv6_parity_v5');
        expect(cpuLv6SharedProfile.browser).toBeTruthy();
        expect(cpuLv6SharedProfile.teacher).toBeTruthy();
        expect(cpuLv6SharedProfile.browser.minThinkMsWhite).toBe(250);
        expect(cpuLv6SharedProfile.browser.moveDecisionMode).toBe('policy-table-lookahead');
        expect(cpuLv6SharedProfile.browser.cardDecisionMode).toBe('policy-table-core');
        expect(cpuLv6SharedProfile.browser.sacrificeWillMinTurnNumber).toBe(25);
        expect(cpuLv6SharedProfile.browser.lookaheadTimeCaps.whiteUi.moveCapMs).toBe(1250);
        expect(cpuLv6SharedProfile.browser.lookaheadTimeCaps.whiteUi.endgameCapMs).toBe(1800);
        expect(cpuLv6SharedProfile.browser.lookaheadStages.opening.depth).toBe(4);
        expect(cpuLv6SharedProfile.browser.lookaheadStages.mid.depth).toBe(6);
        expect(cpuLv6SharedProfile.browser.lookaheadStages.end.depth).toBe(7);
        expect(cpuLv6SharedProfile.browser.endgameLookahead.solveEmptiesEnd).toBe(20);
        expect(cpuLv6SharedProfile.teacher.moveDecisionMode).toBe('browser-policy-lookahead');
        expect(cpuLv6SharedProfile.teacher.cardDecisionMode).toBe('policy-table-core');
        expect(cpuLv6SharedProfile.teacher.lookaheadBudgetScale).toBeCloseTo(0.05, 6);
        expect(cpuLv6SharedProfile.teacher.lookaheadTimeCaps.moveCapMs).toBe(80);
        expect(cpuLv6SharedProfile.teacher.lookaheadTimeCaps.endgameCapMs).toBe(160);
        expect(cpuLv6SharedProfile.teacher.policyMixRate).toBe(1.0);
        expect(cpuLv6SharedProfile.teacher.policyModelPoolSize).toBe(1);
        expect(cpuLv6SharedProfile.teacher.policyPoolSampling).toBe('uniform');
        expect(cpuLv6SharedProfile.teacher.policyCurrentAnchorRate).toBe(1.0);
        expect(cpuLv6SharedProfile.teacher.tacticalDepthOpening).toBe(4);
        expect(cpuLv6SharedProfile.teacher.tacticalDepthMid).toBe(6);
        expect(cpuLv6SharedProfile.teacher.tacticalDepthEnd).toBe(7);
        expect(cpuLv6SharedProfile.teacher.tacticalBeamWidth).toBe(6);
        expect(cpuLv6SharedProfile.teacher.tacticalWeightMin).toBeCloseTo(0.95, 6);
        expect(cpuLv6SharedProfile.teacher.tacticalWeightMax).toBeCloseTo(1.2, 6);
        expect(cpuLv6SharedProfile.teacher.policyScoreWeightMin).toBeCloseTo(1.6, 6);
        expect(cpuLv6SharedProfile.teacher.policyScoreWeightMax).toBeCloseTo(2.2, 6);
        expect(cpuLv6SharedProfile.teacher.heuristicWeightMin).toBeCloseTo(0.75, 6);
        expect(cpuLv6SharedProfile.teacher.heuristicWeightMax).toBeCloseTo(1.0, 6);
    });
});
//# sourceMappingURL=cpu.lv6-shared-profile.test.js.map