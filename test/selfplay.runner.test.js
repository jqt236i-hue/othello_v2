const {
    runSelfPlayGames,
    runSingleGame,
    decideAction,
    selectPlacementMove,
    buildActorViewSnapshot,
    buildCardDecisionContext,
    buildSelectionTrace
} = require('../src/engine/selfplay-runner');
const Core = require('../game/logic/core');
const CardLogic = require('../game/logic/cards');
const CpuPolicyCore = require('../game/ai/cpu-policy-core');
const CpuLv6LookaheadProfile = require('../game/ai/cpu-lv6-lookahead-profile');
const CpuDecision = require('../game/cpu-decision');
const TurnPipeline = require('../game/turn/turn_pipeline');

describe('selfplay runner', () => {
    beforeEach(() => {
        jest.spyOn(console, 'log').mockImplementation(() => {});
        jest.spyOn(console, 'warn').mockImplementation(() => {});
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    function createGameStateWithRightExpansion(cells) {
        const gameState = Core.createGameState();
        gameState.board = Array.from({ length: 8 }, () => Array(8).fill(0));
        gameState.boardExpansion = {
            active: true,
            side: 'right',
            row: Array.isArray(cells) && cells.length ? cells[0].row : 0,
            owner: 0,
            usedByPlayer: { black: false, white: false },
            cells: (cells || []).map((cell) => ({
                side: 'right',
                row: cell.row,
                col: 8,
                owner: cell.owner
            }))
        };
        gameState.currentPlayer = 1;
        return gameState;
    }

    function createPendingCardState(pendingType, markers = []) {
        return {
            pendingEffectByPlayer: {
                black: { type: pendingType, stage: 'selectTarget' },
                white: null
            },
            markers,
            charge: { black: 0, white: 0 },
            hands: { black: [], white: [] },
            hasUsedCardThisTurnByPlayer: { black: true, white: false }
        };
    }

    function createPlacementBoard() {
        const board = Array.from({ length: 8 }, () => Array(8).fill(Core.EMPTY));
        board[3][3] = Core.BLACK;
        board[3][4] = Core.WHITE;
        board[4][3] = Core.WHITE;
        board[4][4] = Core.BLACK;
        return board;
    }

    function mockTeacherLookahead() {
        jest.spyOn(CpuLv6LookaheadProfile, 'buildLv6LookaheadOptions').mockReturnValue({
            depth: 5,
            maxBranch: 4,
            nodeBudget: 1000,
            maxTimeMs: 0,
            endgameSolveEmpties: 24,
            endgameDepth: 24,
            endgameNodeBudget: 4000,
            endgameMaxTimeMs: 0
        });
        return jest.spyOn(CpuPolicyCore, 'chooseMoveByLookahead');
    }

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

    test('passes global game indexes through player policy resolver offsets', () => {
        const seen = [];
        runSelfPlayGames({
            games: 2,
            baseSeed: 123,
            gameIndexOffset: 1000,
            maxPlies: 80,
            allowCardUsage: false,
            playerPolicyResolver: (gameIndex, seed) => {
                seen.push({ gameIndex, seed });
                return null;
            }
        });

        expect(seen).toEqual([
            { gameIndex: 1000, seed: 123 },
            { gameIndex: 1001, seed: 124 }
        ]);
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

    test('teacher lookahead uses per-policy tactical depth and beam overrides', () => {
        const board = createPlacementBoard();
        const candidateMoves = [
            { row: 2, col: 3, flips: [{ row: 3, col: 3 }] },
            { row: 2, col: 5, flips: [{ row: 3, col: 4 }] }
        ];
        const buildSpy = jest.spyOn(CpuLv6LookaheadProfile, 'buildLv6LookaheadOptions').mockReturnValue({
            depth: 5,
            maxBranch: 4,
            nodeBudget: 1000,
            maxTimeMs: 0,
            endgameSolveEmpties: 24,
            endgameDepth: 24,
            endgameNodeBudget: 4000,
            endgameMaxTimeMs: 0
        });
        jest.spyOn(CpuPolicyCore, 'chooseMoveByLookahead').mockReturnValue(candidateMoves[0]);

        const selected = selectPlacementMove(
            candidateMoves,
            { random: () => 0.5 },
            {
                gameState: { board },
                cardState: {},
                playerKey: 'black',
                pendingType: null,
                legalMovesCount: candidateMoves.length
            },
            {
                tacticalDepthOpening: 4,
                tacticalDepthMid: 5,
                tacticalDepthEnd: 6,
                tacticalBeamWidth: 4
            }
        );

        expect(buildSpy).toHaveBeenCalledWith(
            6,
            board,
            candidateMoves.length,
            'black',
            'teacher',
            expect.objectContaining({
                tacticalDepthOpening: 4,
                tacticalDepthMid: 5,
                tacticalDepthEnd: 6,
                tacticalBeamWidth: 4
            })
        );
        expect(selected).toBe(candidateMoves[0]);
    });

    test('teacher lookahead keeps forced corner hard filter before scoring', () => {
        const board = createPlacementBoard();
        const legalMoves = [
            { row: 0, col: 0, flips: [{ row: 1, col: 1 }] },
            { row: 2, col: 3, flips: [{ row: 3, col: 3 }] },
            { row: 5, col: 4, flips: [{ row: 4, col: 4 }] }
        ];
        const lookaheadSpy = mockTeacherLookahead().mockImplementation((moves) => {
            expect(moves).toEqual([legalMoves[0]]);
            return moves[0];
        });

        const selected = selectPlacementMove(
            legalMoves,
            { random: () => 0.5 },
            {
                gameState: { board },
                cardState: {},
                playerKey: 'black',
                pendingType: null,
                legalMovesCount: legalMoves.length
            },
            { forceCornerEdgePlacement: true }
        );

        expect(lookaheadSpy).toHaveBeenCalled();
        expect(selected).toBe(legalMoves[0]);
    });

    test('teacher lookahead keeps forced edge hard filter before scoring', () => {
        const board = createPlacementBoard();
        const legalMoves = [
            { row: 0, col: 3, flips: [{ row: 1, col: 3 }] },
            { row: 2, col: 3, flips: [{ row: 3, col: 3 }] },
            { row: 5, col: 4, flips: [{ row: 4, col: 4 }] }
        ];
        const lookaheadSpy = mockTeacherLookahead().mockImplementation((moves) => {
            expect(moves).toEqual([legalMoves[0]]);
            return moves[0];
        });

        const selected = selectPlacementMove(
            legalMoves,
            { random: () => 0.5 },
            {
                gameState: { board },
                cardState: {},
                playerKey: 'black',
                pendingType: null,
                legalMovesCount: legalMoves.length
            },
            { forceCornerEdgePlacement: true }
        );

        expect(lookaheadSpy).toHaveBeenCalled();
        expect(selected).toBe(legalMoves[0]);
    });

    test('teacher lookahead can still choose within multiple forced moves', () => {
        const board = createPlacementBoard();
        const legalMoves = [
            { row: 0, col: 0, flips: [{ row: 1, col: 1 }] },
            { row: 0, col: 7, flips: [{ row: 1, col: 6 }] },
            { row: 2, col: 3, flips: [{ row: 3, col: 3 }] }
        ];
        const lookaheadSpy = mockTeacherLookahead().mockImplementation((moves) => {
            expect(moves).toEqual([legalMoves[0], legalMoves[1]]);
            return moves[1];
        });

        const selected = selectPlacementMove(
            legalMoves,
            { random: () => 0.5 },
            {
                gameState: { board },
                cardState: {},
                playerKey: 'black',
                pendingType: null,
                legalMovesCount: legalMoves.length
            },
            { forceCornerEdgePlacement: true }
        );

        expect(lookaheadSpy).toHaveBeenCalled();
        expect(selected).toBe(legalMoves[1]);
    });

    test('teacher lookahead keeps full legal move space when no forced move exists', () => {
        const board = createPlacementBoard();
        const legalMoves = [
            { row: 2, col: 3, flips: [{ row: 3, col: 3 }] },
            { row: 2, col: 5, flips: [{ row: 3, col: 4 }] },
            { row: 5, col: 4, flips: [{ row: 4, col: 4 }] }
        ];
        const lookaheadSpy = mockTeacherLookahead().mockImplementation((moves) => {
            expect(moves).toEqual(legalMoves);
            return moves[2];
        });

        const selected = selectPlacementMove(
            legalMoves,
            { random: () => 0.5 },
            {
                gameState: { board },
                cardState: {},
                playerKey: 'black',
                pendingType: null,
                legalMovesCount: legalMoves.length
            },
            { forceCornerEdgePlacement: true }
        );

        expect(lookaheadSpy).toHaveBeenCalled();
        expect(selected).toBe(legalMoves[2]);
    });

    test('buildCardDecisionContext preserves the same crystal evaluation metrics as the in-game CPU context', () => {
        const gameState = Core.createGameState();
        gameState.board = Array.from({ length: 8 }, () => Array(8).fill(Core.EMPTY));
        gameState.board[3][3] = Core.BLACK;
        gameState.board[3][4] = Core.WHITE;
        gameState.board[4][3] = Core.WHITE;
        gameState.board[4][4] = Core.BLACK;

        const cardState = CardLogic.createCardState({ shuffle: (arr) => arr, random: () => 0.5 });
        cardState.boardBonusByCell = { '2,4': 3, '5,4': 1 };
        cardState.hands.black = ['crystal_stone'];
        cardState.charge.black = 8;
        cardState.charge.white = 6;

        const legalMoves = [
            { row: 2, col: 4, flips: [{ row: 3, col: 4 }] },
            { row: 5, col: 4, flips: [{ row: 4, col: 4 }, { row: 4, col: 3 }] }
        ];

        global.gameState = gameState;
        global.cardState = cardState;
        global.BLACK = Core.BLACK;
        global.WHITE = Core.WHITE;

        const liveContext = CpuDecision.buildCardUseDecisionContext('black', 6, legalMoves.length, legalMoves, ['crystal_stone']);
        const selfplayContext = buildCardDecisionContext(gameState, cardState, 'black', legalMoves.length, legalMoves, ['crystal_stone']);

        expect(selfplayContext).toEqual(expect.objectContaining({
            maxLegalFlips: liveContext.maxLegalFlips,
            avgLegalFlips: liveContext.avgLegalFlips,
            maxLegalGain: liveContext.maxLegalGain,
            maxLegalBoardBonus: liveContext.maxLegalBoardBonus
        }));
    });

    test('buildCardDecisionContext preserves hand-aware sell-card scoring parity with the in-game CPU context', () => {
        const gameState = Core.createGameState();
        gameState.board = Array.from({ length: 8 }, () => Array(8).fill(Core.EMPTY));
        gameState.board[3][3] = Core.BLACK;
        gameState.board[3][4] = Core.WHITE;
        gameState.board[4][3] = Core.WHITE;
        gameState.board[4][4] = Core.BLACK;

        const cardState = CardLogic.createCardState({ shuffle: (arr) => arr, random: () => 0.5 });
        cardState.hands.white = ['sell', 'dragon', 'guard', 'silver'];
        cardState.charge.white = 8;
        cardState.charge.black = 6;

        const legalMoves = [
            { row: 2, col: 3, flips: [{ row: 3, col: 3 }] },
            { row: 2, col: 5, flips: [{ row: 3, col: 4 }] },
            { row: 5, col: 4, flips: [{ row: 4, col: 4 }] }
        ];

        global.gameState = gameState;
        global.cardState = cardState;
        global.BLACK = Core.BLACK;
        global.WHITE = Core.WHITE;

        const liveContext = CpuDecision.buildCardUseDecisionContext('white', 6, legalMoves.length, legalMoves, ['sell']);
        const selfplayContext = buildCardDecisionContext(gameState, cardState, 'white', legalMoves.length, legalMoves, ['sell']);
        const defs = {
            sell: { id: 'sell', type: 'SELL_CARD_WILL' },
            dragon: { id: 'dragon', type: 'ULTIMATE_REVERSE_DRAGON' },
            guard: { id: 'guard', type: 'GUARD_WILL' },
            silver: { id: 'silver', type: 'SILVER_STONE' }
        };
        const costs = { sell: 8, dragon: 30, guard: 2, silver: 3 };
        const getCost = (id) => costs[id] || 0;
        const getDef = (id) => defs[id] || null;

        const liveScore = CpuPolicyCore.scoreCardUseDecision('sell', getCost, getDef, liveContext);
        const selfplayScore = CpuPolicyCore.scoreCardUseDecision('sell', getCost, getDef, selfplayContext);

        expect(selfplayContext.handCardIds).toEqual(liveContext.handCardIds);
        expect(selfplayScore.score).toBe(liveScore.score);
        expect(selfplayScore.shouldUse).toBe(liveScore.shouldUse);
    });

    test('decideAction prioritizes expansion corner placement in forced-placement mode', () => {
        const gameState = createGameStateWithRightExpansion([
            { row: 0, owner: 0 },
            { row: 7, owner: 0 }
        ]);
        const cardState = {
            pendingEffectByPlayer: { black: null, white: null },
            markers: [],
            charge: { black: 0, white: 0 },
            hands: { black: [], white: [] },
            hasUsedCardThisTurnByPlayer: { black: false, white: false },
            boardBonusByCell: {},
            boardBonusConsumedByCell: {}
        };
        jest.spyOn(Core, 'getLegalMoves').mockReturnValue([
            { row: 4, col: 4, flips: [{ row: 4, col: 5 }] },
            { row: 0, col: 8, flips: [{ row: 0, col: 7 }] }
        ]);

        const result = decideAction(
            gameState,
            cardState,
            'black',
            { random: () => 0.5 },
            { allowCardUsage: false, enableTacticalLookahead: false }
        );

        expect(result.action).toEqual(expect.objectContaining({ type: 'place', row: 0, col: 8 }));
    });
    test('records pending target selections with structured labels', () => {
        const result = runSelfPlayGames({
            games: 1,
            baseSeed: 1,
            maxPlies: 140,
            allowCardUsage: true,
            cardUsageRate: 0.35
        });

        const pendingRecord = result.records.find((one) => one && one.pendingSelection && one.pendingSelection.kind === 'board_cell');
        expect(pendingRecord).toBeTruthy();
        expect(pendingRecord.pendingSelection.pendingType).toBeTruthy();
        expect(Number.isInteger(pendingRecord.pendingSelection.row)).toBe(true);
        expect(Number.isInteger(pendingRecord.pendingSelection.col)).toBe(true);
        expect(pendingRecord.actorView).toBeTruthy();
        expect(pendingRecord.actorView.pendingSelection).toEqual(expect.objectContaining({
            kind: 'board_cell',
            pendingType: pendingRecord.pendingSelection.pendingType,
            row: pendingRecord.pendingSelection.row,
            col: pendingRecord.pendingSelection.col
        }));
        expect(pendingRecord.actorView.selectionTrace).toEqual(expect.objectContaining({
            kind: 'place',
            pendingSelection: expect.objectContaining({
                kind: 'board_cell',
                row: pendingRecord.pendingSelection.row,
                col: pendingRecord.pendingSelection.col
            })
        }));
    });

    test('buildSelectionTrace preserves live sell candidates and selectedActionKey', () => {
        const trace = buildSelectionTrace({
            actionType: 'place',
            sellCardId: 'last_resort_01',
            selectedActionKey: 'sell:last_resort_01',
            decisionCandidates: [
                { actionType: 'place', decisionKind: 'sell', cardId: 'last_resort_01', cardType: 'LAST_RESORT', cardCost: 8, score: 12, isSelected: true },
                { actionType: 'place', decisionKind: 'sell', cardId: 'guard_01', cardType: 'GUARD_WILL', cardCost: 2, score: 42, isSelected: false }
            ],
            decisionReasonTags: ['decision:sell', 'hand_pressure'],
            decisionScoreSummary: {
                selectedRetentionScore: 12,
                bestRetentionScore: 12,
                lowerScoreIsBetter: true
            },
            pendingSelection: {
                kind: 'hand_card',
                pendingType: 'SELL_CARD_WILL',
                sourceKey: 'sellCardId',
                cardId: 'last_resort_01'
            }
        });

        expect(trace).toEqual(expect.objectContaining({
            kind: 'card',
            decision: 'sell',
            selectedCardId: 'last_resort_01',
            selectedActionKey: 'sell:last_resort_01',
            reasonTags: expect.arrayContaining(['decision:sell', 'hand_pressure']),
            scoreSummary: expect.objectContaining({ lowerScoreIsBetter: true }),
            candidates: expect.arrayContaining([
                expect.objectContaining({ cardId: 'last_resort_01', isSelected: true }),
                expect.objectContaining({ cardId: 'guard_01', isSelected: false })
            ]),
            pendingSelection: expect.objectContaining({
                kind: 'hand_card',
                cardId: 'last_resort_01'
            })
        }));
    });

    test('buildActorViewSnapshot keeps live use-card candidates and selectedActionKey', () => {
        const snapshot = buildActorViewSnapshot({
            board: '......../......../......../...WB.../...BW.../......../......../........',
            player: 'black',
            legalMoves: 2,
            actionType: 'use_card',
            useCardId: 'guard_01',
            usableCardIds: ['guard_01', 'time_01'],
            selectedActionKey: 'use:guard_01',
            decisionCandidates: [
                { actionType: 'use_card', decisionKind: 'use', cardId: 'guard_01', cardType: 'GUARD_WILL', cardCost: 2, score: 48, shouldUse: true, minUseScore: 12, isSelected: true },
                { actionType: 'use_card', decisionKind: 'use', cardId: 'time_01', cardType: 'TIME_BOMB', cardCost: 10, score: 8, shouldUse: false, minUseScore: 12, isSelected: false }
            ],
            decisionReasonTags: ['decision:use', 'corner_emergency'],
            decisionScoreSummary: {
                selectedScore: 48,
                bestScore: 48,
                minUseScore: 12
            }
        });

        expect(snapshot.selectionTrace).toEqual(expect.objectContaining({
            kind: 'card',
            decision: 'use',
            selectedCardId: 'guard_01',
            selectedActionKey: 'use:guard_01',
            reasonTags: expect.arrayContaining(['decision:use', 'corner_emergency']),
            scoreSummary: expect.objectContaining({ selectedScore: 48, minUseScore: 12 }),
            candidates: expect.arrayContaining([
                expect.objectContaining({ cardId: 'guard_01', isSelected: true, shouldUse: true }),
                expect.objectContaining({ cardId: 'time_01', isSelected: false, shouldUse: false })
            ])
        }));
    });

    test('retries with refreshed state after an invalid action rejection', () => {
        const forcedRetryState = Core.createGameState();
        forcedRetryState.board = Array.from({ length: 8 }, () => Array(8).fill(0));
        forcedRetryState.board[0][0] = 1;
        forcedRetryState.board[0][1] = -1;
        forcedRetryState.currentPlayer = 1;

        const applyTurnSafeSpy = jest.spyOn(TurnPipeline, 'applyTurnSafe')
            .mockImplementationOnce((cardState, gameState) => ({
                ok: false,
                rejectedReason: 'ILLEGAL_MOVE',
                errorMessage: 'mock invalid action',
                cardState,
                gameState: forcedRetryState,
                nextStateVersion: 1
            }))
            .mockImplementationOnce((cardState, gameState, playerKey, action) => ({
                ok: true,
                cardState,
                gameState,
                nextStateVersion: 2,
                action
            }));

        const result = runSingleGame(0, 1, {
            maxPlies: 1,
            allowCardUsage: false
        });

        expect(applyTurnSafeSpy).toHaveBeenCalledTimes(2);
        const retriedAction = applyTurnSafeSpy.mock.calls[1][3];
        expect(retriedAction.type).toBe('place');
        expect(retriedAction.row).toBe(0);
        expect(retriedAction.col).toBe(2);
        expect(result.records).toHaveLength(1);
        expect(result.records[0].row).toBe(0);
        expect(result.records[0].col).toBe(2);
    });

    test('falls back to a deterministic legal place after repeated unknown place rejection', () => {
        const forcedRetryState = Core.createGameState();
        forcedRetryState.board = Array.from({ length: 8 }, () => Array(8).fill(0));
        forcedRetryState.board[0][0] = 1;
        forcedRetryState.board[0][1] = -1;
        forcedRetryState.currentPlayer = 1;

        const applyTurnSafeSpy = jest.spyOn(TurnPipeline, 'applyTurnSafe')
            .mockImplementationOnce((cardState, gameState) => ({
                ok: false,
                rejectedReason: 'UNKNOWN',
                errorMessage: "Cannot read properties of undefined (reading '8')",
                cardState,
                gameState: forcedRetryState,
                nextStateVersion: 1
            }))
            .mockImplementationOnce((cardState, gameState) => ({
                ok: false,
                rejectedReason: 'UNKNOWN',
                errorMessage: "Cannot read properties of undefined (reading '8')",
                cardState,
                gameState,
                nextStateVersion: 1
            }))
            .mockImplementationOnce((cardState, gameState, playerKey, action) => ({
                ok: true,
                cardState,
                gameState,
                nextStateVersion: 2,
                action
            }));

        const result = runSingleGame(0, 1, {
            maxPlies: 1,
            allowCardUsage: false
        });

        expect(applyTurnSafeSpy).toHaveBeenCalledTimes(3);
        const fallbackAction = applyTurnSafeSpy.mock.calls[2][3];
        expect(fallbackAction.type).toBe('place');
        expect(fallbackAction.row).toBe(0);
        expect(fallbackAction.col).toBe(2);
        expect(result.records).toHaveLength(1);
        expect(result.records[0].row).toBe(0);
        expect(result.records[0].col).toBe(2);
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

    test('decideAction chooses a placement for UDR pending on an otherwise flipless board', () => {
        const gameState = Core.createGameState();
        gameState.board = Array.from({ length: 8 }, () => Array(8).fill(0));
        gameState.currentPlayer = 1;

        const cardState = {
            pendingEffectByPlayer: {
                black: { type: 'ULTIMATE_REVERSE_DRAGON', stage: null, cardId: 'udr_01' },
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
            { random: () => 0 },
            { allowCardUsage: true, cardUsageRate: 0.25 },
            { gameState, cardState }
        );

        expect(decision.action.type).toBe('place');
        expect(Number.isInteger(decision.action.row)).toBe(true);
        expect(Number.isInteger(decision.action.col)).toBe(true);
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

    test('decideAction resolves DESTROY_ONE_STONE on occupied expansion cells', () => {
        const gameState = Core.createGameState();
        gameState.board = Array.from({ length: 8 }, () => Array(8).fill(0));
        gameState.boardExpansion = {
            active: true,
            side: 'left',
            row: 2,
            owner: -1,
            usedByPlayer: { black: false, white: false },
            cells: [
                { side: 'left', row: 2, col: -1, owner: -1 }
            ]
        };
        gameState.currentPlayer = 1;

        const cardState = {
            pendingEffectByPlayer: {
                black: { type: 'DESTROY_ONE_STONE', stage: 'selectTarget' },
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
            { random: () => 0.1 },
            { allowCardUsage: true, cardUsageRate: 0.25 },
            { gameState, cardState }
        );

        expect(decision.action.type).toBe('place');
        expect(decision.action.destroyTarget).toEqual({ row: 2, col: -1 });
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

    test('decideAction resolves STRONG_WIND_WILL on right expansion targets without crashing', () => {
        const gameState = createGameStateWithRightExpansion([
            { row: 2, owner: 1 }
        ]);
        const cardState = createPendingCardState('STRONG_WIND_WILL');

        const decision = decideAction(
            gameState,
            cardState,
            'black',
            { random: () => 0.1 },
            { allowCardUsage: true, cardUsageRate: 0.25 },
            { gameState, cardState }
        );

        expect(decision.action.type).toBe('place');
        expect(decision.action.strongWindTarget).toEqual({ row: 2, col: 8 });
    });

    test('decideAction resolves SUPER_BUOYANCY_WILL on right expansion targets without crashing', () => {
        const gameState = createGameStateWithRightExpansion([
            { row: 1, owner: 0 },
            { row: 2, owner: 0 },
            { row: 3, owner: 1 }
        ]);
        const cardState = createPendingCardState('SUPER_BUOYANCY_WILL');

        const decision = decideAction(
            gameState,
            cardState,
            'black',
            { random: () => 0.2 },
            { allowCardUsage: true, cardUsageRate: 0.25 },
            { gameState, cardState }
        );

        expect(decision.action.type).toBe('place');
        expect(decision.action.superBuoyancyTarget).toEqual({ row: 3, col: 8 });
    });

    test('decideAction resolves SUPER_GRAVITY_WILL on right expansion targets without crashing', () => {
        const gameState = createGameStateWithRightExpansion([
            { row: 3, owner: 1 },
            { row: 4, owner: 0 },
            { row: 5, owner: 0 }
        ]);
        const cardState = createPendingCardState('SUPER_GRAVITY_WILL');

        const decision = decideAction(
            gameState,
            cardState,
            'black',
            { random: () => 0.3 },
            { allowCardUsage: true, cardUsageRate: 0.25 },
            { gameState, cardState }
        );

        expect(decision.action.type).toBe('place');
        expect(decision.action.superGravityTarget).toEqual({ row: 3, col: 8 });
    });

    test('decideAction resolves HYPERACTIVE_INHERIT_WILL on right expansion targets without crashing', () => {
        const gameState = createGameStateWithRightExpansion([
            { row: 2, owner: 1 }
        ]);
        const cardState = createPendingCardState('HYPERACTIVE_INHERIT_WILL');

        const decision = decideAction(
            gameState,
            cardState,
            'black',
            { random: () => 0.4 },
            { allowCardUsage: true, cardUsageRate: 0.25 },
            { gameState, cardState }
        );

        expect(decision.action.type).toBe('place');
        expect(decision.action.hyperactiveInheritTarget).toEqual({ row: 2, col: 8 });
    });

    test('decideAction resolves TELEPORT_WILL on right expansion targets without crashing', () => {
        const gameState = createGameStateWithRightExpansion([
            { row: 2, owner: -1 }
        ]);
        const cardState = createPendingCardState('TELEPORT_WILL');

        const decision = decideAction(
            gameState,
            cardState,
            'black',
            { random: () => 0.5 },
            { allowCardUsage: true, cardUsageRate: 0.25 },
            { gameState, cardState }
        );

        expect(decision.action.type).toBe('place');
        expect(decision.action.teleportTarget).toEqual({ row: 2, col: 8 });
    });

    test('decideAction resolves EXTEND_LIFE_WILL on right expansion targets without crashing', () => {
        const gameState = createGameStateWithRightExpansion([
            { row: 2, owner: 1 }
        ]);
        const cardState = createPendingCardState('EXTEND_LIFE_WILL', [
            { kind: 'specialStone', row: 2, col: 8, owner: 'black', data: { type: 'WORK', remainingOwnerTurns: 3 } }
        ]);

        const decision = decideAction(
            gameState,
            cardState,
            'black',
            { random: () => 0.6 },
            { allowCardUsage: true, cardUsageRate: 0.25 },
            { gameState, cardState }
        );

        expect(decision.action.type).toBe('place');
        expect(decision.action.extendTarget).toEqual({ row: 2, col: 8 });
    });

    test('decideAction resolves EXTEND_LIFE_GOD on right expansion targets without crashing', () => {
        const gameState = createGameStateWithRightExpansion([
            { row: 2, owner: 1 }
        ]);
        const cardState = createPendingCardState('EXTEND_LIFE_GOD', [
            { kind: 'specialStone', row: 2, col: 8, owner: 'black', data: { type: 'WORK', remainingOwnerTurns: 3 } }
        ]);

        const decision = decideAction(
            gameState,
            cardState,
            'black',
            { random: () => 0.6 },
            { allowCardUsage: true, cardUsageRate: 0.25 },
            { gameState, cardState }
        );

        expect(decision.action.type).toBe('place');
        expect(decision.action.extendTarget).toEqual({ row: 2, col: 8 });
    });

    test('decideAction resolves CORROSION_WILL on right expansion targets without crashing', () => {
        const gameState = createGameStateWithRightExpansion([
            { row: 2, owner: -1 }
        ]);
        const cardState = createPendingCardState('CORROSION_WILL', [
            { kind: 'specialStone', row: 2, col: 8, owner: 'white', data: { type: 'GUARD', remainingOwnerTurns: 3 } }
        ]);

        const decision = decideAction(
            gameState,
            cardState,
            'black',
            { random: () => 0.7 },
            { allowCardUsage: true, cardUsageRate: 0.25 },
            { gameState, cardState }
        );

        expect(decision.action.type).toBe('place');
        expect(decision.action.corrosionTarget).toEqual({ row: 2, col: 8 });
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
            hands: { black: [], white: ['bomb_01', 'silver_stone'] },
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
            hands: { black: [], white: ['bomb_01', 'silver_stone'] },
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

    test('buildCardDecisionContext keeps staged chain-will cards in teacher candidates', () => {
        const gameState = Core.createGameState();
        const cardState = {
            pendingEffectByPlayer: { black: null, white: null },
            markers: [],
            charge: { black: 30, white: 0 },
            hands: { black: ['double_chain_01', 'silver_stone'], white: [] },
            hasUsedCardThisTurnByPlayer: { black: false, white: false },
            hasDestroyedCardThisTurnByPlayer: { black: false, white: false }
        };

        jest.spyOn(CardLogic, 'getUsableCardIds').mockReturnValue(['double_chain_01', 'silver_stone']);

        const context = buildCardDecisionContext(gameState, cardState, 'black', 0, []);

        expect(context.usableCardIds).toEqual(['double_chain_01', 'silver_stone']);
    });

    test('buildCardDecisionContext keeps afterimage and ghost cards in teacher candidates', () => {
        const gameState = Core.createGameState();
        const cardState = {
            pendingEffectByPlayer: { black: null, white: null },
            markers: [],
            charge: { black: 30, white: 0 },
            hands: { black: ['afterimage_will_01', 'ghost_01', 'silver_stone'], white: [] },
            hasUsedCardThisTurnByPlayer: { black: false, white: false },
            hasDestroyedCardThisTurnByPlayer: { black: false, white: false }
        };

        jest.spyOn(CardLogic, 'getUsableCardIds').mockReturnValue(['afterimage_will_01', 'ghost_01', 'silver_stone']);

        const context = buildCardDecisionContext(gameState, cardState, 'black', 0, []);

        expect(context.usableCardIds).toEqual(['afterimage_will_01', 'ghost_01', 'silver_stone']);
    });

});
