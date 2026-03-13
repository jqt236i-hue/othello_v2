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
        version: 'teacher_lv6_parity_v2',
        browser: {
            minThinkMsWhite: 250,
            moveDecisionMode: 'policy-table-lookahead',
            cardDecisionMode: 'policy-table-core',
            lookaheadTimeCaps: {
                whiteUi: {
                    moveCapMs: 2800,
                    endgameCapMs: 4200,
                    quiescenceMoveCapMs: 2800,
                    quiescenceEndgameCapMs: 4200,
                    quiescenceEndgameMinMs: 2200
                },
                whiteHeadless: {
                    moveCapMs: 2400,
                    endgameCapMs: 3000,
                    quiescenceMoveCapMs: 2400,
                    quiescenceEndgameCapMs: 3000,
                    quiescenceEndgameMinMs: 1800
                },
                black: {
                    moveCapMs: 2200,
                    endgameCapMs: 12000,
                    quiescenceMoveCapMs: 3500,
                    quiescenceEndgameCapMs: 20000,
                    quiescenceEndgameMinMs: 4000
                }
            },
            lookaheadStages: {
                opening: {
                    maxOccupiedRatio: 0.28,
                    depth: 6,
                    maxBranch: 10,
                    nodeBudgetBase: 3000000,
                    maxTimeBaseMs: 2800
                },
                mid: {
                    maxOccupiedRatio: 0.62,
                    depth: 8,
                    maxBranch: 10,
                    nodeBudgetBase: 6000000,
                    maxTimeBaseMs: 3200
                },
                end: {
                    depth: 10,
                    maxBranch: 10,
                    nodeBudgetBase: 10000000,
                    maxTimeBaseMs: 4200
                }
            },
            endgameLookahead: {
                solveEmptiesOpeningMid: 44,
                solveEmptiesEnd: 46,
                depthOpeningMid: 44,
                depthEnd: 48,
                nodeBudgetBase: 32000000,
                maxTimeBaseMs: 22000
            },
            lookaheadWeights: {
                onnxRefinePriorWeight: 66,
                policyLookaheadPriorWeight: 62,
                searchWeight: 1.8
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
            tacticalDepthOpening: 6,
            tacticalDepthMid: 8,
            tacticalDepthEnd: 10,
            tacticalBeamWidth: 10,
            teacherCommitteeWeightMin: 48,
            teacherCommitteeWeightMax: 72,
            teacherCommitteeConsensusBonusMin: 620,
            teacherCommitteeConsensusBonusMax: 1080,
            usePromotedModelOnly: true
        }
    };
}));
