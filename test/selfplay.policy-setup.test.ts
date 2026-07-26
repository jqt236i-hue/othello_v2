const { createSelfplayPolicySetup } = require('../src/engine/selfplay-policy-setup.js');

function createSequencePrng(values) {
    const seq = Array.isArray(values) && values.length > 0 ? values.slice() : [0];
    let index = 0;
    return {
        random: () => {
            const nextIndex = Math.min(index, seq.length - 1);
            const value = seq[nextIndex];
            index += 1;
            return value;
        }
    };
}

describe('selfplay policy setup module', () => {
    test('normalizeOptions clamps values and clones initial deck ids', () => {
        const cloneInitialDeckCardIdsByPlayer = jest.fn((value) => ({
            black: value.black.slice(),
            white: value.white.slice()
        }));
        const helpers = createSelfplayPolicySetup({
            SELFPLAY_SCHEMA_VERSION: 'selfplay.v2',
            SeededPRNG: { createPRNG: jest.fn(() => createSequencePrng([0])) },
            cloneInitialDeckCardIdsByPlayer
        });

        const out = helpers.normalizeOptions({
            games: 0,
            baseSeed: 12.9,
            gameIndexOffset: -4,
            maxPlies: 0,
            gameRetryCount: -1,
            allowCardUsage: false,
            cardUsageRate: 2,
            policyMixRate: -1,
            cardUsageRateJitter: 5,
            tacticalWeightMin: -3,
            tacticalWeightMax: -2,
            policyScoreWeightMin: -1,
            policyScoreWeightMax: -4,
            heuristicWeightMin: -2,
            heuristicWeightMax: -1,
            tacticalDepthOpening: 1.8,
            tacticalDepthMid: 2.2,
            tacticalDepthEnd: 3.7,
            tacticalBeamWidth: 0,
            tacticalSearchNodeBudget: 1000000,
            teacherCommitteeWeightMin: -5,
            teacherCommitteeWeightMax: -2,
            teacherCommitteeConsensusBonusMin: -8,
            teacherCommitteeConsensusBonusMax: -3,
            seedFamily: '  prod  ',
            dataLane: ' lane ',
            initialDeckCardIdsByPlayer: {
                black: ['b1'],
                white: ['w1']
            }
        });

        expect(cloneInitialDeckCardIdsByPlayer).toHaveBeenCalledWith({
            black: ['b1'],
            white: ['w1']
        });
        expect(out).toMatchObject({
            schemaVersion: 'selfplay.v2',
            games: 1,
            baseSeed: 12,
            gameIndexOffset: 0,
            maxPlies: 1,
            gameRetryCount: 0,
            allowCardUsage: false,
            cardUsageRate: 1,
            policyMixRate: 0,
            cardUsageRateJitter: 1,
            tacticalWeightMin: 0,
            tacticalWeightMax: 0,
            policyScoreWeightMin: 0,
            policyScoreWeightMax: 0,
            heuristicWeightMin: 0,
            heuristicWeightMax: 0,
            tacticalDepthOpening: 1,
            tacticalDepthMid: 2,
            tacticalDepthEnd: 3,
            tacticalBeamWidth: 1,
            tacticalSearchNodeBudget: 100000,
            teacherCommitteeWeightMin: 0,
            teacherCommitteeWeightMax: 0,
            teacherCommitteeConsensusBonusMin: 0,
            teacherCommitteeConsensusBonusMax: 0,
            seedFamily: 'prod',
            dataLane: 'lane',
            initialDeckCardIdsByPlayer: {
                black: ['b1'],
                white: ['w1']
            }
        });
    });

    test('getPolicyForPlayer applies player override and lookahead normalization', () => {
        const helpers = createSelfplayPolicySetup({
            SELFPLAY_SCHEMA_VERSION: 'selfplay.v2',
            SeededPRNG: { createPRNG: jest.fn(() => createSequencePrng([0])) }
        });

        const out = helpers.getPolicyForPlayer({
            allowCardUsage: true,
            cardUsageRate: 0.35,
            tacticalDepthOpening: 2,
            tacticalDepthMid: 3,
            tacticalDepthEnd: 4,
            tacticalBeamWidth: 5,
            tacticalSearchNodeBudget: 321,
            playerPolicies: {
                black: {
                    allowCardUsage: false,
                    cardUsageRate: 2,
                    policyTableModel: { name: 'm' },
                    enableTacticalLookahead: false,
                    disableLookaheadTimeBudget: true,
                    lookaheadMaxTimeMs: 12.9,
                    lookaheadEndgameMaxTimeMs: -5,
                    lookaheadVirtualTimePerNodeMs: -2,
                    tacticalWeight: 7,
                    policyScoreWeight: 8,
                    heuristicWeight: 9,
                    tacticalDepthOpening: 6.7,
                    tacticalDepthMid: 7.2,
                    tacticalDepthEnd: 8.4,
                    tacticalBeamWidth: 3.9,
                    tacticalSearchNodeBudget: 123.9,
                    teacherCommitteeWeight: 10,
                    teacherCommitteeConsensusBonus: 11
                }
            }
        }, 'black');

        expect(out).toEqual({
            allowCardUsage: false,
            cardUsageRate: 1,
            policyTableModel: { name: 'm' },
            enableTacticalLookahead: false,
            disableLookaheadTimeBudget: true,
            lookaheadMaxTimeMs: 12,
            lookaheadEndgameMaxTimeMs: 0,
            lookaheadVirtualTimePerNodeMs: 0,
            tacticalWeight: 7,
            policyScoreWeight: 8,
            heuristicWeight: 9,
            tacticalDepthOpening: 6,
            tacticalDepthMid: 7,
            tacticalDepthEnd: 8,
            tacticalBeamWidth: 3,
            tacticalSearchNodeBudget: 123,
            teacherCommitteeWeight: 10,
            teacherCommitteeConsensusBonus: 11
        });
    });

    test('top-level tactical lookahead disable survives normalization and becomes the policy default', () => {
        const helpers = createSelfplayPolicySetup({
            SELFPLAY_SCHEMA_VERSION: 'selfplay.v2',
            SeededPRNG: {
                createPRNG: jest.fn(() => createSequencePrng([0]))
            }
        });

        const normalized = helpers.normalizeOptions({
            enableTacticalLookahead: false
        });
        const policies = helpers.buildPerGamePolicySet(normalized, 1, 0);

        expect(normalized.enableTacticalLookahead).toBe(false);
        expect(helpers.getPolicyForPlayer(normalized, 'black').enableTacticalLookahead).toBe(false);
        expect(policies.black).toMatchObject({
            enableTacticalLookahead: false,
            tacticalWeight: 0
        });
        expect(policies.white).toMatchObject({
            enableTacticalLookahead: false,
            tacticalWeight: 0
        });
    });

    test('buildPerGamePolicySet keeps model path and jitters usage with deterministic rng', () => {
        const helpers = createSelfplayPolicySetup({
            SELFPLAY_SCHEMA_VERSION: 'selfplay.v2',
            SeededPRNG: {
                createPRNG: jest.fn(() => createSequencePrng([0, 0, 0, 0, 0, 0, 0, 0, 0, 0]))
            }
        });
        const normalized = helpers.normalizeOptions({
            policyMixRate: 1,
            cardUsageRate: 0.6,
            cardUsageRateJitter: 0.2,
            tacticalWeightMin: 2,
            tacticalWeightMax: 4,
            policyScoreWeightMin: 5,
            policyScoreWeightMax: 9,
            heuristicWeightMin: 7,
            heuristicWeightMax: 8,
            tacticalSearchNodeBudget: 77,
            teacherCommitteeWeightMin: 20,
            teacherCommitteeWeightMax: 40,
            teacherCommitteeConsensusBonusMin: 100,
            teacherCommitteeConsensusBonusMax: 200,
            playerPolicies: {
                black: {
                    cardUsageRate: 0.6,
                    policyTableModel: { id: 'black-model' }
                }
            }
        });

        const out = helpers.buildPerGamePolicySet(normalized, 3, 4);

        expect(out.black).toMatchObject({
            allowCardUsage: true,
            policyTableModel: { id: 'black-model' },
            enableTacticalLookahead: true,
            disableLookaheadTimeBudget: false,
            tacticalWeight: 2,
            policyScoreWeight: 5,
            heuristicWeight: 7,
            tacticalSearchNodeBudget: 77,
            teacherCommitteeWeight: 20,
            teacherCommitteeConsensusBonus: 100
        });
        expect(out.black.cardUsageRate).toBeCloseTo(0.4, 6);
    });

    test('buildPerGamePolicySet drops model score when mix rate disables model usage', () => {
        const helpers = createSelfplayPolicySetup({
            SELFPLAY_SCHEMA_VERSION: 'selfplay.v2',
            SeededPRNG: {
                createPRNG: jest.fn(() => createSequencePrng([0.9, 0.9, 0.9, 0.9, 0.9]))
            }
        });

        const out = helpers.buildPerGamePolicySet({
            allowCardUsage: true,
            cardUsageRate: 0.3,
            policyMixRate: 0,
            cardUsageRateJitter: 0,
            tacticalWeightMin: 1,
            tacticalWeightMax: 1,
            policyScoreWeightMin: 4,
            policyScoreWeightMax: 4,
            heuristicWeightMin: 2,
            heuristicWeightMax: 2,
            teacherCommitteeWeightMin: 3,
            teacherCommitteeWeightMax: 3,
            teacherCommitteeConsensusBonusMin: 9,
            teacherCommitteeConsensusBonusMax: 9,
            playerPolicies: {
                white: {
                    policyTableModel: { id: 'white-model' }
                }
            }
        }, 1, 2);

        expect(out.white.policyTableModel).toBeNull();
        expect(out.white.policyScoreWeight).toBe(0);
    });
});
