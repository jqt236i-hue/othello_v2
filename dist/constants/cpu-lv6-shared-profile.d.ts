interface LookaheadTimeCaps {
    moveCapMs: number;
    endgameCapMs: number;
    quiescenceMoveCapMs: number;
    quiescenceEndgameCapMs: number;
    quiescenceEndgameMinMs: number;
}
interface LookaheadStage {
    maxOccupiedRatio?: number;
    depth: number;
    maxBranch: number;
    nodeBudgetBase: number;
    maxTimeBaseMs: number;
}
interface LookaheadStages {
    opening: LookaheadStage;
    mid: LookaheadStage;
    end: LookaheadStage;
}
interface EndgameLookahead {
    solveEmptiesOpeningMid: number;
    solveEmptiesEnd: number;
    depthOpeningMid: number;
    depthEnd: number;
    nodeBudgetBase: number;
    maxTimeBaseMs: number;
}
interface LookaheadWeights {
    onnxRefinePriorWeight: number;
    policyLookaheadPriorWeight: number;
    searchWeight: number;
}
interface OnnxRuntimeGuard {
    minSamples: number;
    maxAverageLatencyMs: number;
    maxP95LatencyMs: number;
    maxMaxLatencyMs: number;
    moveBudgetMs: number;
    cardBudgetMs: number;
    pendingSelectionBudgetMs: number;
}
interface BrowserConfig {
    minThinkMsWhite: number;
    moveDecisionMode: string;
    cardDecisionMode: string;
    sacrificeWillMinTurnNumber: number;
    lookaheadTimeCaps: {
        whiteUi: LookaheadTimeCaps;
        whiteHeadless: LookaheadTimeCaps;
        black: LookaheadTimeCaps;
    };
    lookaheadStages: LookaheadStages;
    endgameLookahead: EndgameLookahead;
    lookaheadWeights: LookaheadWeights;
    onnxRuntimeGuard: OnnxRuntimeGuard;
}
interface TeacherConfig {
    moveDecisionMode: string;
    cardDecisionMode: string;
    lookaheadBudgetScale: number;
    lookaheadTimeCaps: {
        moveCapMs: number;
        endgameCapMs: number;
    };
    policyMixRate: number;
    policyModelPoolSize: number;
    policyPoolSampling: string;
    policyPoolRecencyDecay: number;
    policyCurrentAnchorRate: number;
    tacticalDepthOpening: number;
    tacticalDepthMid: number;
    tacticalDepthEnd: number;
    tacticalBeamWidth: number;
    tacticalWeightMin: number;
    tacticalWeightMax: number;
    policyScoreWeightMin: number;
    policyScoreWeightMax: number;
    heuristicWeightMin: number;
    heuristicWeightMax: number;
    teacherCommitteeWeightMin: number;
    teacherCommitteeWeightMax: number;
    teacherCommitteeConsensusBonusMin: number;
    teacherCommitteeConsensusBonusMax: number;
    usePromotedModelOnly: boolean;
}
interface CpuLv6SharedProfile {
    version: string;
    browser: BrowserConfig;
    teacher: TeacherConfig;
}
declare const CPU_LV6_SHARED_PROFILE: CpuLv6SharedProfile;
export = CPU_LV6_SHARED_PROFILE;
//# sourceMappingURL=cpu-lv6-shared-profile.d.ts.map