declare const __non_webpack_require__: NodeRequire | undefined;
const _require: NodeRequire = typeof __non_webpack_require__ !== 'undefined' ? __non_webpack_require__ : require;

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

const CPU_LV6_SHARED_PROFILE: CpuLv6SharedProfile = {
    version: 'teacher_lv6_parity_v5',
    browser: {
        minThinkMsWhite: 250,
        moveDecisionMode: 'policy-table-lookahead',
        cardDecisionMode: 'policy-table-core',
        sacrificeWillMinTurnNumber: 25,
        lookaheadTimeCaps: {
            whiteUi: {
                moveCapMs: 1250,
                endgameCapMs: 1800,
                quiescenceMoveCapMs: 1000,
                quiescenceEndgameCapMs: 1700,
                quiescenceEndgameMinMs: 800
            },
            whiteHeadless: {
                moveCapMs: 900,
                endgameCapMs: 1300,
                quiescenceMoveCapMs: 750,
                quiescenceEndgameCapMs: 1200,
                quiescenceEndgameMinMs: 600
            },
            black: {
                moveCapMs: 1000,
                endgameCapMs: 1500,
                quiescenceMoveCapMs: 800,
                quiescenceEndgameCapMs: 1400,
                quiescenceEndgameMinMs: 700
            }
        },
        lookaheadStages: {
            opening: {
                maxOccupiedRatio: 0.28,
                depth: 4,
                maxBranch: 6,
                nodeBudgetBase: 900000,
                maxTimeBaseMs: 900
            },
            mid: {
                maxOccupiedRatio: 0.62,
                depth: 6,
                maxBranch: 7,
                nodeBudgetBase: 1900000,
                maxTimeBaseMs: 1200
            },
            end: {
                depth: 7,
                maxBranch: 8,
                nodeBudgetBase: 2800000,
                maxTimeBaseMs: 1600
            }
        },
        endgameLookahead: {
            solveEmptiesOpeningMid: 16,
            solveEmptiesEnd: 20,
            depthOpeningMid: 12,
            depthEnd: 16,
            nodeBudgetBase: 4800000,
            maxTimeBaseMs: 1800
        },
        lookaheadWeights: {
            onnxRefinePriorWeight: 66,
            policyLookaheadPriorWeight: 62,
            searchWeight: 1.8
        },
        onnxRuntimeGuard: {
            minSamples: 4,
            maxAverageLatencyMs: 18,
            maxP95LatencyMs: 28,
            maxMaxLatencyMs: 45,
            moveBudgetMs: 120,
            pendingSelectionBudgetMs: 120
        }
    },
    teacher: {
        moveDecisionMode: 'browser-policy-lookahead',
        cardDecisionMode: 'policy-table-core',
        lookaheadBudgetScale: 0.05,
        lookaheadTimeCaps: {
            moveCapMs: 80,
            endgameCapMs: 160
        },
        policyMixRate: 1.0,
        policyModelPoolSize: 1,
        policyPoolSampling: 'uniform',
        policyPoolRecencyDecay: 1.0,
        policyCurrentAnchorRate: 1.0,
        tacticalDepthOpening: 4,
        tacticalDepthMid: 6,
        tacticalDepthEnd: 7,
        tacticalBeamWidth: 6,
        tacticalWeightMin: 0.95,
        tacticalWeightMax: 1.2,
        policyScoreWeightMin: 1.6,
        policyScoreWeightMax: 2.2,
        heuristicWeightMin: 0.75,
        heuristicWeightMax: 1.0,
        teacherCommitteeWeightMin: 48,
        teacherCommitteeWeightMax: 72,
        teacherCommitteeConsensusBonusMin: 620,
        teacherCommitteeConsensusBonusMax: 1080,
        usePromotedModelOnly: true
    }
};

export = CPU_LV6_SHARED_PROFILE;
