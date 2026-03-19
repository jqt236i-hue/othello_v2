(function (root, factory) {
    const profile = factory();
    if (root && typeof root === 'object') {
        root.CPU_LV6_SHARED_PROFILE = profile;
    }
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = profile;
    }
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
    return {
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
                cardBudgetMs: 80,
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
}));
