const {
    runSelfPlayGames,
    runSingleGame,
    decideAction,
    selectPlacementMove,
    buildActorViewSnapshot,
    buildCardDecisionContext,
    buildSelectionTrace,
    encodeBoard
} = require('../src/engine/selfplay-runner');
const Core = require('../game/logic/core.js');
const CardLogic = require('../game/logic/cards.js');
const CpuPolicyCore = require('../game/ai/cpu-policy-core.js');
const CpuLv6LookaheadProfile = require('../game/ai/cpu-lv6-lookahead-profile.js');
const CpuDecision = require('../game/cpu-decision.js');
const TurnPipeline = require('../game/turn/turn_pipeline.js');
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
            maxPlies: 2,
            allowCardUsage: false
        };

        const a = runSelfPlayGames(options);
        const b = runSelfPlayGames(options);

        expect(a.summary).toEqual(b.summary);
        expect(a.gameSummaries).toEqual(b.gameSummaries);
        expect(a.records).toEqual(b.records);
    });

    test('supports fixed white-only initial deck while black stays default', () => {
        const result = runSingleGame(0, 123, {
            maxPlies: 2,
            allowCardUsage: false,
            initialDeckCardIdsByPlayer: {
                white: ['hard_01', 'swap_01']
            }
        });

        expect(result.records[0]).toEqual(expect.objectContaining({
            player: 'black',
            initialDeckSize: 30
        }));
        expect(result.records[1]).toEqual(expect.objectContaining({
            player: 'white',
            initialDeckSize: 2
        }));
    });

    test('passes global game indexes through player policy resolver offsets', () => {
        const seen = [];
        runSelfPlayGames({
            games: 2,
            baseSeed: 123,
            gameIndexOffset: 1000,
            maxPlies: 2,
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
            maxPlies: 2,
            allowCardUsage: false
        });

        expect(result.summary.totalGames).toBe(1);
        expect(result.records.length).toBeGreaterThan(0);
        expect(['black', 'white', 'draw']).toContain(result.gameSummaries[0].winner);
        expect(result.gameSummaries[0]).toEqual(expect.objectContaining({
            blackLongestEdgeRun: expect.any(Number),
            whiteLongestEdgeRun: expect.any(Number),
            maxEdgeLineLength: expect.any(Number)
        }));

        for (const rec of result.records) {
            expect(['black', 'white']).toContain(rec.player);
            expect(['place', 'pass', 'use_card', 'cancel_card', 'destroy_hand_card']).toContain(rec.actionType);
            expect(['black', 'white', 'draw']).toContain(rec.winner);
            expect([-1, 0, 1]).toContain(rec.outcome);
            expect(typeof rec.board).toBe('string');
            expect(typeof rec.boardEnvelope).toBe('string');
            expect(rec.boardEnvelope).toBe(rec.board);
            expect(rec.boardMinRow).toBe(0);
            expect(rec.boardMinCol).toBe(0);
            expect(Array.isArray(rec.handCards)).toBe(true);
            expect(Array.isArray(rec.usableCardIds)).toBe(true);
            expect(Object.prototype.hasOwnProperty.call(rec, 'ownEdgeChainStrengthBefore')).toBe(true);
            expect(Object.prototype.hasOwnProperty.call(rec, 'oppEdgeChainStrengthBefore')).toBe(true);
            expect(Object.prototype.hasOwnProperty.call(rec, 'ownLongestEdgeRunBefore')).toBe(true);
            expect(Object.prototype.hasOwnProperty.call(rec, 'oppLongestEdgeRunBefore')).toBe(true);
            expect(Object.prototype.hasOwnProperty.call(rec, 'ownEdgeChainStrengthAfter')).toBe(true);
            expect(Object.prototype.hasOwnProperty.call(rec, 'oppEdgeChainStrengthAfter')).toBe(true);
            expect(Object.prototype.hasOwnProperty.call(rec, 'ownLongestEdgeRunAfter')).toBe(true);
            expect(Object.prototype.hasOwnProperty.call(rec, 'oppLongestEdgeRunAfter')).toBe(true);
            expect(Object.prototype.hasOwnProperty.call(rec, 'tacticalScoreMissRatio')).toBe(true);
            if (Number.isFinite(rec.bestTacticalScore) && rec.bestTacticalScore <= 0) {
                expect(rec.tacticalScoreMiss).toBe(0);
                expect(rec.tacticalScoreMissRatio).toBe(0);
            }
            if (Number.isFinite(rec.tacticalScoreMissRatio)) {
                expect(rec.tacticalScoreMissRatio).toBeGreaterThanOrEqual(0);
            }
        }
    });

    test('records grouped split metadata on every selfplay record', () => {
        const result = runSelfPlayGames({
            games: 2,
            baseSeed: 31,
            gameIndexOffset: 900,
            maxPlies: 2,
            allowCardUsage: false,
            seedFamily: 'eval',
            dataLane: 'eval-main'
        });

        expect(result.records.length).toBeGreaterThan(0);
        expect([...new Set(result.records.map((rec) => rec.gameIndex))].sort((a, b) => a - b)).toEqual([900, 901]);
        for (const rec of result.records) {
            expect([900, 901]).toContain(rec.gameIndex);
            expect(rec.seedFamily).toBe('eval');
            expect(rec.dataLane).toBe('eval-main');
        }
    });

    test('cards enabled smoke run does not throw', () => {
        const result = runSelfPlayGames({
            games: 1,
            baseSeed: 11,
            maxPlies: 2,
            allowCardUsage: true,
            cardUsageRate: 0.25
        });
        expect(result.summary.totalGames).toBe(1);
        expect(result.records.length).toBeGreaterThan(0);
    });

    test('records per-player deck metrics when deck sizes diverge', () => {
        const realInitGame = CardLogic.initGame;
        jest.spyOn(CardLogic, 'initGame').mockImplementation((prng) => {
            const init = realInitGame(prng);
            init.cardState.decks.black = init.cardState.decks.black.slice(0, 3);
            init.cardState.decks.white = init.cardState.decks.white.slice(0, 1);
            init.cardState.deck = init.cardState.decks.black.slice();
            init.cardState.initialDeckSize = 3;
            init.cardState.initialDeckSizeByPlayer = { black: 3, white: 1 };
            return init;
        });

        const result = runSelfPlayGames({
            games: 1,
            baseSeed: 17,
            maxPlies: 2,
            allowCardUsage: false
        });

        const blackRecord = result.records.find((one) => one && one.player === 'black');
        const whiteRecord = result.records.find((one) => one && one.player === 'white');
        expect(blackRecord).toEqual(expect.objectContaining({
            deckCount: 3,
            ownDeckCount: 3,
            initialDeckSize: 3
        }));
        expect(whiteRecord).toEqual(expect.objectContaining({
            deckCount: 1,
            ownDeckCount: 1,
            initialDeckSize: 1,
            actorView: expect.objectContaining({
                deckCount: 1,
                ownDeckCount: 1,
                initialDeckSize: 1
            })
        }));
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

    test('teacher lookahead keeps full move space by default when only edge candidates exist', () => {
        const board = createPlacementBoard();
        const legalMoves = [
            { row: 0, col: 3, flips: [{ row: 1, col: 3 }] },
            { row: 2, col: 3, flips: [{ row: 3, col: 3 }] },
            { row: 5, col: 4, flips: [{ row: 4, col: 4 }] }
        ];
        const lookaheadSpy = mockTeacherLookahead().mockImplementation((moves) => {
            expect(moves).toEqual(legalMoves);
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
            {}
        );

        expect(lookaheadSpy).toHaveBeenCalled();
        expect(selected).toBe(legalMoves[1]);
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

    test('buildCardDecisionContext preserves card scoring parity with the in-game CPU context', () => {
        const gameState = Core.createGameState();
        gameState.board = Array.from({ length: 8 }, () => Array(8).fill(Core.EMPTY));
        gameState.board[3][3] = Core.BLACK;
        gameState.board[3][4] = Core.WHITE;
        gameState.board[4][3] = Core.WHITE;
        gameState.board[4][4] = Core.BLACK;

        const cardState = CardLogic.createCardState({ shuffle: (arr) => arr, random: () => 0.5 });
        cardState.hands.white = ['work', 'dragon', 'guard', 'silver'];
        cardState.charge.white = 11;
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

        const liveContext = CpuDecision.buildCardUseDecisionContext('white', 6, legalMoves.length, legalMoves, ['work']);
        const selfplayContext = buildCardDecisionContext(gameState, cardState, 'white', legalMoves.length, legalMoves, ['work']);
        const defs = {
            work: { id: 'work', type: 'WORK_WILL' },
            dragon: { id: 'dragon', type: 'ULTIMATE_REVERSE_DRAGON' },
            guard: { id: 'guard', type: 'GUARD_WILL' },
            silver: { id: 'silver', type: 'SILVER_STONE' }
        };
        const costs = { work: 11, dragon: 30, guard: 2, silver: 3 };
        const getCost = (id) => costs[id] || 0;
        const getDef = (id) => defs[id] || null;

        const liveScore = CpuPolicyCore.scoreCardUseDecision('work', getCost, getDef, liveContext);
        const selfplayScore = CpuPolicyCore.scoreCardUseDecision('work', getCost, getDef, selfplayContext);

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
            games: 3,
            baseSeed: 1,
            maxPlies: 20,
            allowCardUsage: true,
            cardUsageRate: 0.35,
            enableTacticalLookahead: false
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

    test('buildSelectionTrace preserves live destroy candidates and selectedActionKey', () => {
        const trace = buildSelectionTrace({
            actionType: 'destroy_hand_card',
            destroyCardId: 'last_resort_01',
            selectedActionKey: 'destroy:last_resort_01',
            decisionCandidates: [
                { actionType: 'destroy_hand_card', decisionKind: 'destroy', cardId: 'last_resort_01', cardType: 'LAST_RESORT', cardCost: 8, score: 12, isSelected: true },
                { actionType: 'destroy_hand_card', decisionKind: 'destroy', cardId: 'guard_01', cardType: 'GUARD_WILL', cardCost: 2, score: 42, isSelected: false }
            ],
            decisionReasonTags: ['decision:destroy', 'hand_pressure'],
            decisionScoreSummary: {
                selectedRetentionScore: 12,
                bestRetentionScore: 12,
                lowerScoreIsBetter: true
            }
        });

        expect(trace).toEqual(expect.objectContaining({
            kind: 'card',
            decision: 'destroy',
            selectedCardId: 'last_resort_01',
            selectedActionKey: 'destroy:last_resort_01',
            reasonTags: expect.arrayContaining(['decision:destroy', 'hand_pressure']),
            scoreSummary: expect.objectContaining({ lowerScoreIsBetter: true }),
            candidates: expect.arrayContaining([
                expect.objectContaining({ cardId: 'last_resort_01', isSelected: true }),
                expect.objectContaining({ cardId: 'guard_01', isSelected: false })
            ])
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

    test('runSingleGame records placement committee metrics when teacher committee is enabled', () => {
        const withoutCommittee = runSingleGame(0, 1, {
            maxPlies: 1,
            allowCardUsage: false,
            enableTacticalLookahead: false,
            playerPolicies: {
                black: {
                    allowCardUsage: false,
                    enableTacticalLookahead: false,
                    teacherCommitteeWeight: 0,
                    teacherCommitteeConsensusBonus: 0
                },
                white: {
                    allowCardUsage: false,
                    enableTacticalLookahead: false,
                    teacherCommitteeWeight: 0,
                    teacherCommitteeConsensusBonus: 0
                }
            }
        });
        const withCommittee = runSingleGame(0, 1, {
            maxPlies: 1,
            allowCardUsage: false,
            enableTacticalLookahead: false,
            playerPolicies: {
                black: {
                    allowCardUsage: false,
                    enableTacticalLookahead: false,
                    teacherCommitteeWeight: 40,
                    teacherCommitteeConsensusBonus: 400
                },
                white: {
                    allowCardUsage: false,
                    enableTacticalLookahead: false,
                    teacherCommitteeWeight: 40,
                    teacherCommitteeConsensusBonus: 400
                }
            }
        });

        expect(withoutCommittee.records[0].selectedCommitteeScore).toBe(0);
        expect(withCommittee.records[0].topPlacementCandidates.some((one) => Number(one.committeeScore) > 0)).toBe(true);
        expect(withCommittee.records[0].topPlacementCandidates.some((one) => Number(one.committeeVotes) > 0)).toBe(true);
    });

    test('decideAction lets teacher committee change use-card selection and preserves trace', () => {
        const gameState = Core.createGameState();
        gameState.board = createPlacementBoard();
        gameState.currentPlayer = Core.BLACK;

        const cardState = {
            pendingEffectByPlayer: { black: null, white: null },
            markers: [],
            charge: { black: 20, white: 0 },
            hands: { black: ['guard_01', 'time_01'], white: [] },
            hasUsedCardThisTurnByPlayer: { black: false, white: false },
            boardBonusByCell: {},
            boardBonusConsumedByCell: {}
        };

        jest.spyOn(CardLogic, 'getUsableCardIds').mockReturnValue(['guard_01', 'time_01']);
        jest.spyOn(CardLogic, 'getCardType').mockImplementation((cardId) => (
            cardId === 'guard_01' ? 'GUARD_WILL' : 'TIME_BOMB'
        ));
        jest.spyOn(CardLogic, 'getCardCost').mockImplementation((cardId) => (
            cardId === 'guard_01' ? 12 : 2
        ));
        jest.spyOn(CardLogic, 'getCardDef').mockImplementation((cardId) => ({
            id: cardId,
            type: cardId === 'guard_01' ? 'GUARD_WILL' : 'TIME_BOMB'
        }));
        jest.spyOn(CpuPolicyCore, 'scoreCardUseDecision').mockImplementation((cardId) => ({
            cardId,
            cardCost: cardId === 'guard_01' ? 12 : 2,
            score: cardId === 'guard_01' ? 60 : 55,
            minUseScore: 20,
            shouldUse: true
        }));

        const boardKey = encodeBoard(gameState.board);
        const stateKey = `black|${boardKey}|-|4`;
        const policyTableModel = {
            schemaVersion: 'policy_table.v1',
            states: {
                [stateKey]: {
                    actions: {
                        'use_card:guard_01': { visits: 49, avgOutcome: 0 },
                        'use_card:time_01': { visits: 50, avgOutcome: 0 }
                    }
                }
            }
        };

        const withoutCommittee = decideAction(
            gameState,
            cardState,
            'black',
            { random: () => 0.5 },
            {
                allowCardUsage: true,
                cardUsageRate: 1,
                policyTableModel,
                teacherCommitteeWeight: 0,
                teacherCommitteeConsensusBonus: 0
            },
            { gameState, cardState }
        );
        const withCommittee = decideAction(
            gameState,
            cardState,
            'black',
            { random: () => 0.5 },
            {
                allowCardUsage: true,
                cardUsageRate: 1,
                policyTableModel,
                teacherCommitteeWeight: 600,
                teacherCommitteeConsensusBonus: 500
            },
            { gameState, cardState }
        );

        expect(withoutCommittee.action).toEqual(expect.objectContaining({ type: 'use_card', useCardId: 'time_01' }));
        expect(withCommittee.action).toEqual(expect.objectContaining({ type: 'use_card', useCardId: 'guard_01' }));
        expect(withCommittee.cardDecision).toEqual(expect.objectContaining({
            selectedActionKey: 'use:guard_01',
            reasonTags: expect.arrayContaining(['decision:use', 'threshold_passed'])
        }));
        expect(withCommittee.cardDecision.candidates).toEqual(expect.arrayContaining([
            expect.objectContaining({
                cardId: 'guard_01',
                isSelected: true,
                committeeScore: expect.any(Number),
                committeeVotes: 2
            }),
            expect.objectContaining({
                cardId: 'time_01',
                isSelected: false,
                policyScore: 50000
            })
        ]));
    });

    test('retries from a clean baseline after an invalid action rejection', () => {
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
        expect(retriedAction).not.toEqual(expect.objectContaining({ row: 0, col: 2 }));
        const cleanBaselineLegalKeys = new Set(
            Core.getLegalMoves(Core.createGameState(), 1).map((move) => `${move.row},${move.col}`)
        );
        expect(cleanBaselineLegalKeys.has(`${retriedAction.row},${retriedAction.col}`)).toBe(true);
        expect(result.records).toHaveLength(1);
        expect(result.records[0].row).toBe(retriedAction.row);
        expect(result.records[0].col).toBe(retriedAction.col);
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
        expect(fallbackAction.row).toBe(2);
        expect(fallbackAction.col).toBe(3);
        expect(result.records).toHaveLength(1);
        expect(result.records[0].row).toBe(2);
        expect(result.records[0].col).toBe(3);
    });


    test('mixed guide-policy selfplay remains deterministic', () => {
        const model = { schemaVersion: 'policy_table.v2', states: {} };
        const options = {
            games: 2,
            baseSeed: 29,
            maxPlies: 2,
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

    test('decideAction resolves SEED_WILL pending target instead of canceling', () => {
        const gameState = Core.createGameState();
        gameState.board = Array.from({ length: 8 }, () => Array(8).fill(0));
        gameState.currentPlayer = 1;

        const cardState = {
            pendingEffectByPlayer: {
                black: { type: 'SEED_WILL', stage: 'selectTarget' },
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
        expect(decision.action.seedTarget).toBeTruthy();
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

    test.each([
        {
            pendingType: 'LIVING_WILL',
            getterName: 'getLivingWillTargets',
            applyName: 'applyLivingWill',
            actionKey: 'livingWillTarget',
            target: { row: 4, col: 2 }
        },
        {
            pendingType: 'BOARD_SHRINK_WILL',
            getterName: 'getBoardShrinkTargets',
            applyName: 'applyBoardShrinkWill',
            actionKey: 'shrinkTarget',
            target: { row: 0, col: 1 }
        },
        {
            pendingType: 'BOARD_SHRINK_GOD',
            getterName: 'getBoardShrinkGodTargets',
            applyName: 'applyBoardShrinkGod',
            actionKey: 'shrinkTarget',
            target: { row: 0, col: 0 }
        },
        {
            pendingType: 'FREEZE_WILL',
            getterName: 'getFreezeTargets',
            applyName: 'applyFreezeWill',
            actionKey: 'freezeTarget',
            target: { row: 2, col: 5 }
        }
    ])('decideAction resolves $pendingType pending target instead of canceling', ({
        pendingType,
        getterName,
        applyName,
        actionKey,
        target
    }) => {
        const gameState = Core.createGameState();
        gameState.board = Array.from({ length: 8 }, () => Array(8).fill(0));
        gameState.board[3][3] = 1;
        gameState.currentPlayer = 1;

        const cardState = {
            pendingEffectByPlayer: {
                black: { type: pendingType, stage: 'selectTarget' },
                white: null
            },
            markers: [],
            charge: { black: 0, white: 0 },
            hands: { black: [], white: [] },
            hasUsedCardThisTurnByPlayer: { black: true, white: false }
        };

        jest.spyOn(CardLogic, getterName).mockReturnValue([target]);
        jest.spyOn(CardLogic, applyName).mockReturnValue({ applied: true });

        const decision = decideAction(
            gameState,
            cardState,
            'black',
            { random: () => 0.2 },
            { allowCardUsage: true, cardUsageRate: 0.25 },
            { gameState, cardState }
        );

        expect(decision.action.type).toBe('place');
        expect(decision.action[actionKey]).toEqual(target);
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
            { kind: 'specialStone', row: 2, col: 8, owner: 'white', data: { type: 'WORK', remainingOwnerTurns: 3 } }
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

    test('decideAction can still force edge placement before card use when explicitly requested', () => {
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
            { allowCardUsage: true, cardUsageRate: 1, enableTacticalLookahead: false, forceCornerEdgePlacement: true },
            { gameState, cardState }
        );

        expect(decision.action.type).toBe('place');
        expect(decision.action.row).toBe(0);
        expect(decision.action.col).toBe(4);
    });

    test('decideAction destroys bucket1 card before considering card use', () => {
        const gameState = Core.createGameState();
        const cardState = {
            pendingEffectByPlayer: { black: null, white: null },
            markers: [],
            charge: { black: 0, white: 0 },
            hands: { black: ['time_stop_god_01'], white: [] },
            hasUsedCardThisTurnByPlayer: { black: false, white: false },
            hasDestroyedCardThisTurnByPlayer: { black: false, white: false }
        };

        const decision = decideAction(
            gameState,
            cardState,
            'black',
            { random: () => 0.5 },
            { allowCardUsage: true, allowHandDestroy: true, enableTacticalLookahead: false },
            { gameState, cardState }
        );

        expect(decision.action).toEqual({
            type: 'destroy_hand_card',
            destroyCardId: 'time_stop_god_01'
        });
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

    test('buildCardDecisionContext keeps engine-reported usable cards without a selfplay whitelist', () => {
        const gameState = Core.createGameState();
        const cardState = {
            pendingEffectByPlayer: { black: null, white: null },
            markers: [],
            charge: { black: 30, white: 0 },
            hands: { black: ['board_shrink_01', 'freeze_01', 'will_hunter_king_01'], white: [] },
            hasUsedCardThisTurnByPlayer: { black: false, white: false },
            hasDestroyedCardThisTurnByPlayer: { black: false, white: false }
        };

        jest.spyOn(CardLogic, 'getUsableCardIds').mockReturnValue(['board_shrink_01', 'freeze_01', 'will_hunter_king_01']);

        const context = buildCardDecisionContext(gameState, cardState, 'black', 0, []);

        expect(context.usableCardIds).toEqual(['board_shrink_01', 'freeze_01', 'will_hunter_king_01']);
    });

    test('decideAction can use engine-reported cards that were previously filtered out of selfplay', () => {
        const gameState = Core.createGameState();
        gameState.board = Array.from({ length: 8 }, () => Array(8).fill(0));
        gameState.currentPlayer = 1;

        const cardState = {
            pendingEffectByPlayer: { black: null, white: null },
            markers: [],
            charge: { black: 20, white: 0 },
            hands: { black: ['board_shrink_01'], white: [] },
            hasUsedCardThisTurnByPlayer: { black: false, white: false },
            hasDestroyedCardThisTurnByPlayer: { black: false, white: false }
        };

        jest.spyOn(CardLogic, 'getUsableCardIds').mockReturnValue(['board_shrink_01']);
        jest.spyOn(CardLogic, 'getCardCost').mockImplementation((cardId) => (
            cardId === 'board_shrink_01' ? 8 : 0
        ));
        jest.spyOn(CardLogic, 'getCardDef').mockImplementation((cardId) => (
            cardId === 'board_shrink_01'
                ? { id: cardId, type: 'BOARD_SHRINK_WILL' }
                : null
        ));
        jest.spyOn(CpuPolicyCore, 'scoreCardUseDecision').mockReturnValue({
            score: 96,
            shouldUse: true,
            minUseScore: 0
        });

        const decision = decideAction(
            gameState,
            cardState,
            'black',
            { random: () => 0.5 },
            { allowCardUsage: true, cardUsageRate: 1, enableTacticalLookahead: false },
            { gameState, cardState }
        );

        expect(decision.action).toEqual({
            type: 'use_card',
            useCardId: 'board_shrink_01',
            useCardOwnerKey: 'black'
        });
        expect(decision.cardDecision).toEqual(expect.objectContaining({
            selectedActionKey: 'use:board_shrink_01'
        }));
    });

});
