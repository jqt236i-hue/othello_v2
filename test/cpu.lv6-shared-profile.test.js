const cpuLv6SharedProfile = require('../constants/cpu-lv6-shared-profile');

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
