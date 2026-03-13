const { runSelfPlayGames, decideAction } = require('../src/engine/selfplay-runner');
const Core = require('../game/logic/core');
const CardLogic = require('../game/logic/cards');
const CpuPolicyCore = require('../game/ai/cpu-policy-core');

describe('selfplay runner', () => {
    beforeEach(() => {
        jest.spyOn(console, 'log').mockImplementation(() => {});
        jest.spyOn(console, 'warn').mockImplementation(() => {});
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    test('is deterministic for the same config/seed', () => {
        const options = {
            games: 2,
            baseSeed: 123,
            maxPlies: 80,
            allowCardUsage: false
        };

        const a = runSelfPlayGames(options);
        const b = runSelfPlayGames(options);

        expect(a.summary).toEqual(b.summary);
        expect(a.gameSummaries).toEqual(b.gameSummaries);
        expect(a.records).toEqual(b.records);
    });

    test('produces winner/outcome labels for each record', () => {
        const result = runSelfPlayGames({
            games: 1,
            baseSeed: 7,
            maxPlies: 100,
            allowCardUsage: false
        });

        expect(result.summary.totalGames).toBe(1);
        expect(result.records.length).toBeGreaterThan(0);
        expect(['black', 'white', 'draw']).toContain(result.gameSummaries[0].winner);

        for (const rec of result.records) {
            expect(['black', 'white']).toContain(rec.player);
            expect(['place', 'pass', 'use_card', 'cancel_card', 'destroy_hand_card']).toContain(rec.actionType);
            expect(['black', 'white', 'draw']).toContain(rec.winner);
            expect([-1, 0, 1]).toContain(rec.outcome);
            expect(typeof rec.board).toBe('string');
            expect(Array.isArray(rec.handCards)).toBe(true);
            expect(Array.isArray(rec.usableCardIds)).toBe(true);
            expect(Object.prototype.hasOwnProperty.call(rec, 'tacticalScoreMissRatio')).toBe(true);
            if (Number.isFinite(rec.tacticalScoreMissRatio)) {
                expect(rec.tacticalScoreMissRatio).toBeGreaterThanOrEqual(0);
            }
        }
    });

    test('cards enabled smoke run does not throw', () => {
        const result = runSelfPlayGames({
            games: 1,
            baseSeed: 11,
            maxPlies: 80,
            allowCardUsage: true,
            cardUsageRate: 0.25
        });
        expect(result.summary.totalGames).toBe(1);
        expect(result.records.length).toBeGreaterThan(0);
    });

    test('mixed guide-policy selfplay remains deterministic', () => {
        const model = { schemaVersion: 'policy_table.v2', states: {} };
        const options = {
            games: 2,
            baseSeed: 29,
            maxPlies: 70,
            allowCardUsage: true,
            cardUsageRate: 0.25,
            policyMixRate: 0.65,
            cardUsageRateJitter: 0.12,
            tacticalWeightMin: 0.7,
            tacticalWeightMax: 1.4,
            playerPolicies: {
                black: {
                    allowCardUsage: true,
                    cardUsageRate: 0.25,
                    policyTableModel: model,
                    enableTacticalLookahead: true,
                    tacticalWeight: 1
                },
                white: {
                    allowCardUsage: true,
                    cardUsageRate: 0.25,
                    policyTableModel: model,
                    enableTacticalLookahead: true,
                    tacticalWeight: 1
                }
            }
        };

        const a = runSelfPlayGames(options);
        const b = runSelfPlayGames(options);
        expect(a.summary).toEqual(b.summary);
        expect(a.gameSummaries).toEqual(b.gameSummaries);
        expect(a.records).toEqual(b.records);
    });

    test('decideAction can stop SACRIFICE_WILL follow-up selection in non-emergency', () => {
        const gameState = Core.createGameState();
        gameState.board = Array.from({ length: 8 }, () => Array(8).fill(0));
        gameState.board[0][0] = 1;
        gameState.board[3][3] = 1;
        gameState.board[3][4] = 1;
        gameState.board[4][4] = -1;
        gameState.currentPlayer = 1;

        const cardState = {
            pendingEffectByPlayer: {
                black: { type: 'SACRIFICE_WILL', stage: 'selectTarget', selectedCount: 1, maxSelections: 3 },
                white: null
            },
            markers: [],
            charge: { black: 0, white: 0 },
            hands: { black: [], white: [] },
            hasUsedCardThisTurnByPlayer: { black: true, white: false }
        };

        const decision = decideAction(
            gameState,
            cardState,
            'black',
            { random: () => 0.5 },
            { allowCardUsage: true, cardUsageRate: 0.25 },
            { gameState, cardState }
        );
        expect(decision.action.type).toBe('cancel_card');
    });

    test('decideAction resolves TELEPORT_WILL pending target instead of canceling', () => {
        const gameState = Core.createGameState();
        gameState.board = Array.from({ length: 8 }, () => Array(8).fill(0));
        gameState.board[3][3] = 1;
        gameState.board[4][4] = -1;
        gameState.currentPlayer = 1;

        const cardState = {
            pendingEffectByPlayer: {
                black: { type: 'TELEPORT_WILL', stage: 'selectTarget' },
                white: null
            },
            markers: [],
            charge: { black: 0, white: 0 },
            hands: { black: [], white: [] },
            hasUsedCardThisTurnByPlayer: { black: true, white: false }
        };

        const decision = decideAction(
            gameState,
            cardState,
            'black',
            { random: () => 0.2 },
            { allowCardUsage: true, cardUsageRate: 0.25 },
            { gameState, cardState }
        );
        expect(decision.action.type).toBe('place');
        expect(decision.action.teleportTarget).toBeTruthy();
    });

    test('decideAction resolves CELL_TELEPORT_WILL pending target instead of canceling', () => {
        const gameState = Core.createGameState();
        gameState.board = Array.from({ length: 8 }, () => Array(8).fill(0));
        gameState.board[3][3] = 1;
        gameState.boardExpansion = {
            active: true,
            side: 'left',
            row: 2,
            owner: 0,
            usedByPlayer: { black: false, white: false },
            cells: [
                { side: 'left', row: 2, col: -1, owner: -1 }
            ]
        };
        gameState.currentPlayer = 1;

        const cardState = {
            pendingEffectByPlayer: {
                black: { type: 'CELL_TELEPORT_WILL', stage: 'selectTarget' },
                white: null
            },
            markers: [],
            charge: { black: 0, white: 0 },
            hands: { black: [], white: [] },
            hasUsedCardThisTurnByPlayer: { black: true, white: false }
        };

        const decision = decideAction(
            gameState,
            cardState,
            'black',
            { random: () => 0.2 },
            { allowCardUsage: true, cardUsageRate: 0.25 },
            { gameState, cardState }
        );
        expect(decision.action.type).toBe('place');
        expect(decision.action.teleportTarget).toBeTruthy();
    });

    test('decideAction resolves SUPER_BUOYANCY_WILL pending target instead of canceling', () => {
        const gameState = Core.createGameState();
        gameState.board = Array.from({ length: 8 }, () => Array(8).fill(0));
        gameState.board[4][3] = 1;
        gameState.board[2][3] = -1;
        gameState.currentPlayer = 1;

        const cardState = {
            pendingEffectByPlayer: {
                black: { type: 'SUPER_BUOYANCY_WILL', stage: 'selectTarget' },
                white: null
            },
            markers: [],
            charge: { black: 0, white: 0 },
            hands: { black: [], white: [] },
            hasUsedCardThisTurnByPlayer: { black: true, white: false }
        };

        const decision = decideAction(
            gameState,
            cardState,
            'black',
            { random: () => 0.33 },
            { allowCardUsage: true, cardUsageRate: 0.25 },
            { gameState, cardState }
        );
        expect(decision.action.type).toBe('place');
        expect(decision.action.superBuoyancyTarget).toBeTruthy();
    });

    test('decideAction resolves SUPER_GRAVITY_WILL pending target instead of canceling', () => {
        const gameState = Core.createGameState();
        gameState.board = Array.from({ length: 8 }, () => Array(8).fill(0));
        gameState.board[3][4] = 1;
        gameState.board[5][4] = -1;
        gameState.currentPlayer = 1;

        const cardState = {
            pendingEffectByPlayer: {
                black: { type: 'SUPER_GRAVITY_WILL', stage: 'selectTarget' },
                white: null
            },
            markers: [],
            charge: { black: 0, white: 0 },
            hands: { black: [], white: [] },
            hasUsedCardThisTurnByPlayer: { black: true, white: false }
        };

        const decision = decideAction(
            gameState,
            cardState,
            'black',
            { random: () => 0.66 },
            { allowCardUsage: true, cardUsageRate: 0.25 },
            { gameState, cardState }
        );
        expect(decision.action.type).toBe('place');
        expect(decision.action.superGravityTarget).toBeTruthy();
    });

    test('decideAction resolves HYPERACTIVE_INHERIT_WILL pending target instead of canceling', () => {
        const gameState = Core.createGameState();
        gameState.board = Array.from({ length: 8 }, () => Array(8).fill(0));
        gameState.board[3][3] = 1;
        gameState.board[4][4] = -1;
        gameState.currentPlayer = 1;

        const cardState = {
            pendingEffectByPlayer: {
                black: { type: 'HYPERACTIVE_INHERIT_WILL', stage: 'selectTarget' },
                white: null
            },
            markers: [],
            charge: { black: 0, white: 0 },
            hands: { black: [], white: [] },
            hasUsedCardThisTurnByPlayer: { black: true, white: false }
        };

        const decision = decideAction(
            gameState,
            cardState,
            'black',
            { random: () => 0.4 },
            { allowCardUsage: true, cardUsageRate: 0.25 },
            { gameState, cardState }
        );
        expect(decision.action.type).toBe('place');
        expect(decision.action.hyperactiveInheritTarget).toBeTruthy();
    });

    test('decideAction resolves CORROSION_WILL pending target instead of canceling', () => {
        const gameState = Core.createGameState();
        gameState.board = Array.from({ length: 8 }, () => Array(8).fill(0));
        gameState.board[3][3] = 1;
        gameState.board[4][4] = -1;
        gameState.currentPlayer = 1;

        const cardState = {
            pendingEffectByPlayer: {
                black: { type: 'CORROSION_WILL', stage: 'selectTarget' },
                white: null
            },
            markers: [
                { kind: 'specialStone', row: 3, col: 3, owner: 'black', data: { type: 'WORK', remainingOwnerTurns: 6 } },
                { kind: 'specialStone', row: 4, col: 4, owner: 'white', data: { type: 'GUARD', remainingOwnerTurns: 3 } }
            ],
            charge: { black: 0, white: 0 },
            hands: { black: [], white: [] },
            hasUsedCardThisTurnByPlayer: { black: true, white: false }
        };

        const decision = decideAction(
            gameState,
            cardState,
            'black',
            { random: () => 0.25 },
            { allowCardUsage: true, cardUsageRate: 0.25 },
            { gameState, cardState }
        );
        expect(decision.action.type).toBe('place');
        expect(decision.action.corrosionTarget).toBeTruthy();

        const key = `${decision.action.corrosionTarget.row},${decision.action.corrosionTarget.col}`;
        expect(['3,3', '4,4']).toContain(key);
    });

    test('decideAction can choose destroy_hand_card for deck cycling before card use', () => {
        const gameState = Core.createGameState();
        gameState.board = Array.from({ length: 8 }, () => Array(8).fill(0));
        gameState.board[0][7] = 1;
        gameState.board[3][3] = -1;
        gameState.board[3][4] = 1;
        gameState.board[4][3] = 1;
        gameState.board[4][4] = -1;
        gameState.currentPlayer = -1;

        const cardState = {
            pendingEffectByPlayer: { black: null, white: null },
            markers: [],
            charge: { black: 0, white: 12 },
            hands: { black: [], white: ['sacrifice_01', 'silver_stone'] },
            hasUsedCardThisTurnByPlayer: { black: false, white: false },
            hasDestroyedCardThisTurnByPlayer: { black: false, white: false }
        };

        const decision = decideAction(
            gameState,
            cardState,
            'white',
            { random: () => 0.5 },
            { allowCardUsage: true, cardUsageRate: 0.7 },
            { gameState, cardState }
        );
        expect(['destroy_hand_card', 'place', 'use_card']).toContain(decision.action.type);
    });

    test('decideAction skips destroy_hand_card when allowHandDestroy is false', () => {
        const gameState = Core.createGameState();
        gameState.board = Array.from({ length: 8 }, () => Array(8).fill(0));
        gameState.board[0][7] = 1;
        gameState.board[3][3] = -1;
        gameState.board[3][4] = 1;
        gameState.board[4][3] = 1;
        gameState.board[4][4] = -1;
        gameState.currentPlayer = -1;

        const cardState = {
            pendingEffectByPlayer: { black: null, white: null },
            markers: [],
            charge: { black: 0, white: 12 },
            hands: { black: [], white: ['sacrifice_01', 'silver_stone'] },
            hasUsedCardThisTurnByPlayer: { black: false, white: false },
            hasDestroyedCardThisTurnByPlayer: { black: false, white: false }
        };

        const decision = decideAction(
            gameState,
            cardState,
            'white',
            { random: () => 0.5 },
            { allowCardUsage: true, allowHandDestroy: false, cardUsageRate: 0.7 },
            { gameState, cardState }
        );
        expect(decision.action.type).not.toBe('destroy_hand_card');
    });

    test('decideAction forces corner placement before destroy-hand and inner preference', () => {
        const gameState = Core.createGameState();
        gameState.board = Array.from({ length: 8 }, () => Array(8).fill(0));
        gameState.board[0][1] = -1;
        gameState.board[0][2] = -1;
        gameState.board[0][3] = 1;
        gameState.board[3][3] = -1;
        gameState.board[3][4] = 1;
        gameState.board[4][3] = 1;
        gameState.board[4][4] = -1;
        gameState.currentPlayer = 1;

        const cardState = {
            pendingEffectByPlayer: { black: null, white: null },
            markers: [],
            charge: { black: 8, white: 0 },
            hands: { black: ['silver_stone'], white: [] },
            hasUsedCardThisTurnByPlayer: { black: false, white: false },
            hasDestroyedCardThisTurnByPlayer: { black: false, white: false }
        };

        jest.spyOn(CpuPolicyCore, 'chooseHandDestroyTargetForCycle').mockReturnValue({ cardId: 'silver_stone' });
        jest.spyOn(CpuPolicyCore, 'scoreMoveForCornerEdgePlan').mockImplementation((move) => {
            if (move && move.row === 2 && move.col === 3) return 999999;
            return 0;
        });

        const decision = decideAction(
            gameState,
            cardState,
            'black',
            { random: () => 0.5 },
            { allowCardUsage: true, cardUsageRate: 1, enableTacticalLookahead: false },
            { gameState, cardState }
        );

        expect(decision.action.type).toBe('place');
        expect(decision.action.row).toBe(0);
        expect(decision.action.col).toBe(0);
    });

    test('decideAction forces edge placement before card use and inner preference', () => {
        const gameState = Core.createGameState();
        gameState.board = Array.from({ length: 8 }, () => Array(8).fill(0));
        gameState.board[0][0] = 1;
        gameState.board[0][1] = -1;
        gameState.board[0][2] = -1;
        gameState.board[0][3] = -1;
        gameState.board[3][3] = -1;
        gameState.board[3][4] = 1;
        gameState.board[4][3] = 1;
        gameState.board[4][4] = -1;
        gameState.currentPlayer = 1;

        const cardState = {
            pendingEffectByPlayer: { black: null, white: null },
            markers: [],
            charge: { black: 12, white: 0 },
            hands: { black: ['silver_stone'], white: [] },
            hasUsedCardThisTurnByPlayer: { black: false, white: false },
            hasDestroyedCardThisTurnByPlayer: { black: false, white: false }
        };

        jest.spyOn(CardLogic, 'getUsableCardIds').mockReturnValue(['silver_stone']);
        jest.spyOn(CpuPolicyCore, 'chooseCardWithRiskProfile').mockReturnValue({ cardId: 'silver_stone' });
        jest.spyOn(CpuPolicyCore, 'scoreCardUseDecision').mockReturnValue({ shouldUse: true, score: 100, minUseScore: 0 });
        jest.spyOn(CpuPolicyCore, 'scoreMoveForCornerEdgePlan').mockImplementation((move) => {
            if (move && move.row === 2 && move.col === 3) return 999999;
            return 0;
        });

        const decision = decideAction(
            gameState,
            cardState,
            'black',
            { random: () => 0.5 },
            { allowCardUsage: true, cardUsageRate: 1, enableTacticalLookahead: false },
            { gameState, cardState }
        );

        expect(decision.action.type).toBe('place');
        expect(decision.action.row).toBe(0);
        expect(decision.action.col).toBe(4);
    });
});
