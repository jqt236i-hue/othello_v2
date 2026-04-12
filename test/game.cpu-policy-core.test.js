const core = require('../game/ai/cpu-policy-core');
const Core = require('../game/logic/core');
const catalog = require('../cards/catalog.json');
const SharedBoardUtils = require('../shared/shared-board-utils');

describe('cpu-policy-core', () => {
    test('every catalog card type has explicit CPU usage style coverage', () => {
        const catalogTypes = [...new Set((catalog.cards || []).map((card) => String(card.type || '').trim()).filter(Boolean))];
        expect(catalogTypes.length).toBeGreaterThan(0);
        const missing = catalogTypes.filter((type) => !core.hasUsageStyleForCardType(type));
        expect(missing).toEqual([]);
    });

    test('chooseHighestCostCard picks max-cost card', () => {
        const usable = ['a', 'b', 'c'];
        const costs = { a: 5, b: 12, c: 7 };
        const defs = { a: { id: 'a' }, b: { id: 'b' }, c: { id: 'c' } };
        const out = core.chooseHighestCostCard(
            usable,
            (id) => costs[id],
            (id) => defs[id]
        );
        expect(out).toEqual({ cardId: 'b', cardDef: defs.b });
    });

    test('chooseMove uses AI selector when available', () => {
        const moves = [{ row: 1, col: 1 }, { row: 2, col: 2 }];
        const selected = core.chooseMove(moves, 3, { random: () => 0.99 }, () => moves[0]);
        expect(selected).toEqual(moves[0]);
    });

    test('scoreCardUseDecision suppresses non-emergency guard use when legal corner exists', () => {
        const decision = core.scoreCardUseDecision(
            'guard_01',
            () => 2,
            () => ({ id: 'guard_01', type: 'GUARD_WILL' }),
            {
                level: 6,
                playerValue: -1,
                legalMovesCount: 2,
                hasCornerMoveNow: true,
                cornerEmergency: false,
                ownCharge: 12,
                reserveChargeFloor: 8,
                handSize: 1,
                ownDiscs: 16,
                oppDiscs: 16,
                empties: 40,
                discDiff: 0,
                ownCorners: 0,
                oppCorners: 0,
                ownEdges: 0,
                oppEdges: 0
            }
        );
        expect(decision.shouldUse).toBe(false);
        expect(decision.score).toBeLessThan(decision.minUseScore);
    });

    test('scoreCardUseDecision suppresses non-corner utility when charge is tight', () => {
        const decision = core.scoreCardUseDecision(
            'treasure_01',
            () => 5,
            () => ({ id: 'treasure_01', type: 'TREASURE_BOX' }),
            {
                level: 6,
                playerValue: -1,
                legalMovesCount: 4,
                hasCornerMoveNow: false,
                cornerEmergency: false,
                ownCharge: 8,
                reserveChargeFloor: 8,
                handSize: 2,
                ownDiscs: 18,
                oppDiscs: 18,
                empties: 36,
                discDiff: 0,
                ownCorners: 0,
                oppCorners: 0,
                ownEdges: 0,
                oppEdges: 0
            }
        );
        expect(decision.shouldUse).toBe(false);
    });

    test('scoreCardUseDecision still allows high-yield charge recovery when charge is tight', () => {
        const decision = core.scoreCardUseDecision(
            'gold_01',
            () => 6,
            () => ({ id: 'gold_01', type: 'GOLD_STONE' }),
            {
                level: 6,
                playerValue: -1,
                legalMovesCount: 3,
                hasCornerMoveNow: false,
                cornerEmergency: true,
                ownCharge: 8,
                reserveChargeFloor: 8,
                handSize: 3,
                ownDiscs: 10,
                oppDiscs: 16,
                empties: 26,
                discDiff: -6,
                ownCorners: 0,
                oppCorners: 1,
                ownEdges: 1,
                oppEdges: 3,
                oppCharge: 8,
                oppHandSize: 2,
                maxLegalFlips: 3,
                maxLegalGain: 4
            }
        );
        expect(decision.shouldUse).toBe(true);
    });

    test('chooseHandDestroyTargetForCycle immediately destroys bucket1 never-use cards', () => {
        const selected = core.chooseHandDestroyTargetForCycle(
            ['time_stop_god_01'],
            ['time_stop_god_01'],
            () => 0,
            () => ({ id: 'time_stop_god_01', type: 'TIME_STOP_GOD' }),
            {
                level: 6,
                playerValue: -1,
                legalMovesCount: 2,
                ownCharge: 80,
                handSize: 1,
                empties: 32,
                discDiff: 0,
                ownCorners: 0,
                oppCorners: 0,
                ownEdges: 0,
                oppEdges: 0,
                hasCornerMoveNow: false,
                cornerEmergency: false
            }
        );
        expect(selected).toEqual(expect.objectContaining({
            cardId: 'time_stop_god_01',
            reason: 'bucket1_never_use'
        }));
    });

    test('chooseHandDestroyTargetForCycle immediately destroys bucket2 cards while charge is 50 or lower', () => {
        const selected = core.chooseHandDestroyTargetForCycle(
            ['escape_01'],
            ['escape_01'],
            () => 7,
            () => ({ id: 'escape_01', type: 'ESCAPE_WILL' }),
            {
                level: 6,
                playerValue: -1,
                legalMovesCount: 2,
                ownCharge: 50,
                handSize: 1,
                empties: 32,
                discDiff: 0,
                ownCorners: 0,
                oppCorners: 0,
                ownEdges: 0,
                oppEdges: 0,
                hasCornerMoveNow: false,
                cornerEmergency: false
            }
        );
        expect(selected).toEqual(expect.objectContaining({
            cardId: 'escape_01',
            reason: 'bucket2_low_charge'
        }));
    });

    test('chooseHandDestroyTargetForCycle immediately destroys bucket3 cards when currently unusable', () => {
        const selected = core.chooseHandDestroyTargetForCycle(
            ['last_resort_01'],
            [],
            () => 9,
            () => ({ id: 'last_resort_01', type: 'LAST_RESORT' }),
            {
                level: 6,
                playerValue: -1,
                legalMovesCount: 0,
                ownCharge: 12,
                handSize: 1,
                empties: 20,
                discDiff: 0,
                ownCorners: 0,
                oppCorners: 0,
                ownEdges: 0,
                oppEdges: 0,
                hasCornerMoveNow: false,
                cornerEmergency: false
            }
        );
        expect(selected).toEqual(expect.objectContaining({
            cardId: 'last_resort_01',
            reason: 'bucket3_currently_unusable'
        }));
    });

    test('chooseHandDestroyTargetForCycle immediately destroys EQUALITY_WILL when the 10-disc gap is inactive', () => {
        const selected = core.chooseHandDestroyTargetForCycle(
            ['equality_01'],
            [],
            () => 15,
            () => ({ id: 'equality_01', type: 'EQUALITY_WILL' }),
            {
                level: 6,
                playerValue: -1,
                legalMovesCount: 3,
                ownCharge: 20,
                handSize: 1,
                empties: 24,
                discDiff: -8,
                ownCorners: 0,
                oppCorners: 1,
                ownEdges: 2,
                oppEdges: 4,
                hasCornerMoveNow: false,
                cornerEmergency: true
            }
        );
        expect(selected).toEqual(expect.objectContaining({
            cardId: 'equality_01',
            reason: 'bucket3_currently_unusable'
        }));
    });

    test('chooseHandDestroyTargetForCycle immediately destroys SUPPLY_WILL while charge is 50 or lower', () => {
        const selected = core.chooseHandDestroyTargetForCycle(
            ['supply_01'],
            ['supply_01'],
            () => 1,
            () => ({ id: 'supply_01', type: 'SUPPLY_WILL' }),
            {
                level: 6,
                playerValue: -1,
                legalMovesCount: 2,
                ownCharge: 50,
                handSize: 1,
                empties: 32,
                discDiff: 0,
                ownCorners: 0,
                oppCorners: 0,
                ownEdges: 0,
                oppEdges: 0,
                hasCornerMoveNow: false,
                cornerEmergency: false
            }
        );
        expect(selected).toEqual(expect.objectContaining({
            cardId: 'supply_01',
            reason: 'bucket2_low_charge'
        }));
    });

    test('chooseHandDestroyTargetForCycle immediately destroys REVEAL_HAND_WILL while charge is 50 or lower', () => {
        const selected = core.chooseHandDestroyTargetForCycle(
            ['reveal_01'],
            ['reveal_01'],
            () => 3,
            () => ({ id: 'reveal_01', type: 'REVEAL_HAND_WILL' }),
            {
                level: 6,
                playerValue: -1,
                legalMovesCount: 2,
                ownCharge: 50,
                handSize: 1,
                empties: 32,
                discDiff: 0,
                ownCorners: 0,
                oppCorners: 0,
                ownEdges: 0,
                oppEdges: 0,
                hasCornerMoveNow: false,
                cornerEmergency: false
            }
        );
        expect(selected).toEqual(expect.objectContaining({
            cardId: 'reveal_01',
            reason: 'bucket2_low_charge'
        }));
    });

    test('chooseHandDestroyTargetForCycle immediately destroys FATE_WILL while charge is 50 or lower', () => {
        const selected = core.chooseHandDestroyTargetForCycle(
            ['fate_01'],
            ['fate_01'],
            () => 6,
            () => ({ id: 'fate_01', type: 'FATE_WILL' }),
            {
                level: 6,
                playerValue: -1,
                legalMovesCount: 2,
                ownCharge: 50,
                handSize: 1,
                empties: 32,
                discDiff: 0,
                ownCorners: 0,
                oppCorners: 0,
                ownEdges: 0,
                oppEdges: 0,
                hasCornerMoveNow: false,
                cornerEmergency: false
            }
        );
        expect(selected).toEqual(expect.objectContaining({
            cardId: 'fate_01',
            reason: 'bucket2_low_charge'
        }));
    });

    test('chooseHandDestroyTargetForCycle immediately destroys CORROSION_WILL when currently unusable', () => {
        const selected = core.chooseHandDestroyTargetForCycle(
            ['corrosion_01'],
            [],
            () => 4,
            () => ({ id: 'corrosion_01', type: 'CORROSION_WILL' }),
            {
                level: 6,
                playerValue: -1,
                legalMovesCount: 0,
                ownCharge: 60,
                handSize: 1,
                empties: 20,
                discDiff: 0,
                ownCorners: 0,
                oppCorners: 0,
                ownEdges: 0,
                oppEdges: 0,
                hasCornerMoveNow: false,
                cornerEmergency: false
            }
        );
        expect(selected).toEqual(expect.objectContaining({
            cardId: 'corrosion_01',
            reason: 'bucket3_currently_unusable'
        }));
    });

    test('chooseHandDestroyTargetForCycle immediately destroys SALVATION_WILL when currently unusable', () => {
        const selected = core.chooseHandDestroyTargetForCycle(
            ['salvation_01'],
            [],
            () => 7,
            () => ({ id: 'salvation_01', type: 'SALVATION_WILL' }),
            {
                level: 6,
                playerValue: -1,
                legalMovesCount: 0,
                ownCharge: 60,
                handSize: 1,
                empties: 20,
                discDiff: 0,
                ownCorners: 0,
                oppCorners: 0,
                ownEdges: 0,
                oppEdges: 0,
                hasCornerMoveNow: false,
                cornerEmergency: false
            }
        );
        expect(selected).toEqual(expect.objectContaining({
            cardId: 'salvation_01',
            reason: 'bucket3_currently_unusable'
        }));
    });

    test('chooseHandDestroyTargetForCycle immediately destroys REINFORCEMENT_WILL when currently unusable', () => {
        const selected = core.chooseHandDestroyTargetForCycle(
            ['reinforcement_01'],
            [],
            () => 6,
            () => ({ id: 'reinforcement_01', type: 'REINFORCEMENT_WILL' }),
            {
                level: 6,
                playerValue: -1,
                legalMovesCount: 3,
                ownCharge: 20,
                handSize: 1,
                empties: 24,
                discDiff: -4,
                ownCorners: 0,
                oppCorners: 1,
                ownEdges: 2,
                oppEdges: 4,
                hasCornerMoveNow: false,
                cornerEmergency: false
            }
        );
        expect(selected).toEqual(expect.objectContaining({
            cardId: 'reinforcement_01',
            reason: 'bucket3_currently_unusable'
        }));
    });

    test('chooseHandDestroyTargetForCycle immediately destroys CORNER_TRIBUTE when currently unusable', () => {
        const selected = core.chooseHandDestroyTargetForCycle(
            ['corner_tribute_01'],
            [],
            () => 8,
            () => ({ id: 'corner_tribute_01', type: 'CORNER_TRIBUTE' }),
            {
                level: 6,
                playerValue: -1,
                legalMovesCount: 0,
                ownCharge: 60,
                handSize: 1,
                empties: 20,
                discDiff: 0,
                ownCorners: 0,
                oppCorners: 0,
                ownEdges: 0,
                oppEdges: 0,
                hasCornerMoveNow: false,
                cornerEmergency: false
            }
        );
        expect(selected).toEqual(expect.objectContaining({
            cardId: 'corner_tribute_01',
            reason: 'bucket3_currently_unusable'
        }));
    });

    test('chooseHandDestroyTargetForCycle leaves TEMPT_WILL unchanged when low charge and currently unusable', () => {
        const selected = core.chooseHandDestroyTargetForCycle(
            ['tempt_01'],
            [],
            () => 6,
            () => ({ id: 'tempt_01', type: 'TEMPT_WILL' }),
            {
                level: 6,
                playerValue: -1,
                legalMovesCount: 0,
                ownCharge: 50,
                handSize: 1,
                empties: 20,
                discDiff: 0,
                ownCorners: 0,
                oppCorners: 0,
                ownEdges: 0,
                oppEdges: 0,
                hasCornerMoveNow: false,
                cornerEmergency: false
            }
        );
        expect(selected).toBeNull();
    });

    test('scoreCardUseDecision suppresses LOSS_WILL while own special stones remain', () => {
        const decision = core.scoreCardUseDecision(
            'loss_will_01',
            () => 11,
            () => ({ id: 'loss_will_01', type: 'LOSS_WILL' }),
            {
                level: 6,
                playerValue: -1,
                legalMovesCount: 2,
                ownCharge: 24,
                handSize: 2,
                ownDiscs: 10,
                oppDiscs: 14,
                empties: 26,
                discDiff: -4,
                ownCorners: 0,
                oppCorners: 1,
                ownEdges: 2,
                oppEdges: 4,
                ownSpecialCount: 1,
                oppSpecialCount: 2,
                hasCornerMoveNow: false,
                cornerEmergency: true
            }
        );
        expect(decision.shouldUse).toBe(false);
        expect(decision.reason).toBe('loss_will_own_special');
        expect(decision.score).toBeLessThan(decision.minUseScore);
    });

    test('chooseMove falls back to deterministic rng', () => {
        const moves = [{ id: 0 }, { id: 1 }, { id: 2 }];
        const selected = core.chooseMove(moves, 1, { random: () => 0.5 }, null);
        expect(selected).toEqual(moves[1]);
    });

    test('chooseMove with heuristic enabled prefers corner', () => {
        const moves = [
            { row: 3, col: 3, flips: [{}, {}] },
            { row: 0, col: 0, flips: [] }
        ];
        const selected = core.chooseMove(moves, 4, { random: () => 0.99 }, null, {
            enableHeuristic: true
        });
        expect(selected).toEqual(moves[1]);
    });

    test('chooseMove uses scoreMove ordering when provided', () => {
        const moves = [{ id: 'a' }, { id: 'b' }];
        const selected = core.chooseMove(moves, 4, { random: () => 0.0 }, null, {
            scoreMove: (m) => (m.id === 'b' ? 100 : 0)
        });
        expect(selected).toEqual(moves[1]);
    });

    test('chooseMoveByLookahead prefers corner capture on valid corner line', () => {
        const board = Array.from({ length: 8 }, () => Array(8).fill(0));
        board[0][1] = 1;
        board[0][2] = 1;
        board[0][3] = 1;
        board[0][4] = -1;
        board[3][3] = -1;
        board[3][4] = 1;
        board[4][3] = 1;
        board[4][4] = -1;

        const cornerMove = { row: 0, col: 0, flips: [{ row: 0, col: 1 }, { row: 0, col: 2 }, { row: 0, col: 3 }] };
        const innerMove = { row: 2, col: 4, flips: [{ row: 3, col: 4 }] };

        const selected = core.chooseMoveByLookahead([innerMove, cornerMove], {
            board,
            playerValue: -1,
            level: 6
        });
        expect(selected).toEqual(cornerMove);
    });

    test('chooseMoveByLookahead can use prior score to break near-tie roots', () => {
        const board = Array.from({ length: 8 }, () => Array(8).fill(0));
        board[3][3] = -1;
        board[3][4] = 1;
        board[4][3] = 1;
        board[4][4] = -1;

        const moveA = { row: 2, col: 4, flips: [{ row: 3, col: 4 }] };
        const moveB = { row: 4, col: 2, flips: [{ row: 4, col: 3 }] };

        const selected = core.chooseMoveByLookahead([moveA, moveB], {
            board,
            playerValue: -1,
            level: 6,
            scoreMove: (move) => (move === moveB ? 99999 : 0)
        });
        expect(selected).toEqual(moveB);
    });

    test('chooseMoveByLookahead treats expansion corner as corner candidate', () => {
        const board = Array.from({ length: 8 }, () => Array(8).fill(0));
        board[0][7] = 1;
        board[3][3] = -1;
        board[3][4] = 1;
        board[4][3] = 1;
        board[4][4] = -1;
        SharedBoardUtils.attachBoardShape(board, {
            boardExpansion: {
                cells: [
                    { row: 0, col: 8, owner: 0 },
                    { row: 7, col: 8, owner: 0 }
                ]
            }
        });

        const expansionCornerMove = { row: 0, col: 8, flips: [{ row: 0, col: 7 }] };
        const innerMove = { row: 2, col: 4, flips: [{ row: 3, col: 4 }] };

        const selected = core.chooseMoveByLookahead([innerMove, expansionCornerMove], {
            board,
            playerValue: -1,
            level: 6
        });

        expect(selected).toEqual(expansionCornerMove);
    });

    test('chooseMoveByLookahead avoids move that immediately opens opponent corner access', () => {
        const board = Array.from({ length: 8 }, () => Array(8).fill(0));
        board[0][2] = 1;
        board[2][0] = 1;
        board[3][3] = 1;
        board[3][4] = -1;
        board[4][3] = -1;
        board[4][4] = 1;

        const riskyMove = {
            row: 1,
            col: 1,
            flips: [{ row: 0, col: 1 }, { row: 1, col: 0 }]
        };
        const saferMove = {
            row: 3,
            col: 2,
            flips: [{ row: 3, col: 3 }]
        };

        const selected = core.chooseMoveByLookahead([riskyMove, saferMove], {
            board,
            playerValue: -1,
            level: 6,
            depth: 1,
            maxBranch: 2,
            nodeBudget: 2000
        });
        expect(selected).toEqual(saferMove);
    });

    test('chooseMoveByLookahead applies lv6 hard guard against immediate corner donation', () => {
        const board = Array.from({ length: 8 }, () => Array(8).fill(0));
        board[0][2] = 1;
        board[2][0] = 1;
        board[3][3] = 1;
        board[3][4] = -1;
        board[4][3] = -1;
        board[4][4] = 1;

        const riskyMove = {
            row: 1,
            col: 1,
            flips: [{ row: 0, col: 1 }, { row: 1, col: 0 }]
        };
        const saferMove = {
            row: 3,
            col: 2,
            flips: [{ row: 3, col: 3 }]
        };

        const selected = core.chooseMoveByLookahead([riskyMove, saferMove], {
            board,
            playerValue: -1,
            level: 6,
            depth: 1,
            maxBranch: 2,
            nodeBudget: 2000,
            // Force prior-only ranking so the guard behavior is explicitly tested.
            searchWeight: 0,
            priorWeight: 400,
            scoreMove: (move) => (move === riskyMove ? 999999 : 0)
        });
        expect(selected).toEqual(saferMove);
    });

    test('chooseMoveByLookahead always takes a corner when any corner candidate exists at lv6', () => {
        const board = Array.from({ length: 8 }, () => Array(8).fill(0));
        board[3][3] = -1;
        board[3][4] = 1;
        board[4][3] = 1;
        board[4][4] = -1;
        board[0][1] = 1;
        board[0][2] = 1;
        board[0][3] = -1;

        const cornerMove = { row: 0, col: 0, flips: [{ row: 0, col: 1 }, { row: 0, col: 2 }] };
        const innerMove = { row: 2, col: 4, flips: [{ row: 3, col: 4 }] };

        const selected = core.chooseMoveByLookahead([innerMove, cornerMove], {
            board,
            playerValue: -1,
            level: 6,
            depth: 1,
            maxBranch: 2,
            nodeBudget: 2000,
            // make inner prior extremely large: lv6 hard guard should still force corner.
            searchWeight: 0,
            priorWeight: 500,
            scoreMove: (move) => (move === innerMove ? 999999 : 0)
        });
        expect(selected).toEqual(cornerMove);
    });

    test('chooseMoveByLookahead prefers safe edge over inner move when already leading corners', () => {
        const board = Array.from({ length: 8 }, () => Array(8).fill(0));
        board[0][0] = -1;
        board[0][7] = -1;
        board[3][3] = -1;
        board[3][4] = 1;
        board[4][3] = 1;
        board[4][4] = -1;

        const innerMove = { row: 2, col: 3, flips: [{ row: 3, col: 3 }] };
        const edgeMove = { row: 0, col: 4, flips: [{ row: 0, col: 3 }] };

        const selected = core.chooseMoveByLookahead([innerMove, edgeMove], {
            board,
            playerValue: -1,
            level: 6,
            depth: 1,
            maxBranch: 2,
            nodeBudget: 2000,
            // force prior to prefer inner; lv6 edge-hold guard should switch to edge.
            searchWeight: 0,
            priorWeight: 500,
            scoreMove: (move) => (move === innerMove ? 999999 : 0)
        });
        expect(selected).toEqual(edgeMove);
    });

    test('chooseMoveByLookahead keeps inner move when only a loose edge exists at Lv6', () => {
        const board = Array.from({ length: 8 }, () => Array(8).fill(0));
        board[0][0] = -1;
        board[7][7] = 1;
        board[3][3] = -1;
        board[3][4] = 1;
        board[4][3] = 1;
        board[4][4] = -1;

        const innerMove = { row: 2, col: 3, flips: [{ row: 3, col: 3 }] };
        const edgeMove = { row: 0, col: 4, flips: [{ row: 0, col: 3 }] };

        const selected = core.chooseMoveByLookahead([innerMove, edgeMove], {
            board,
            playerValue: -1,
            level: 6,
            depth: 1,
            maxBranch: 2,
            nodeBudget: 2000,
            searchWeight: 0,
            priorWeight: 500,
            scoreMove: (move) => (move === innerMove ? 999999 : 0)
        });
        expect(selected).toEqual(innerMove);
    });

    test('chooseMoveByLookahead prefers stabilizing edge over inner move when no corner exists at Lv6', () => {
        const board = Array.from({ length: 8 }, () => Array(8).fill(0));
        board[0][0] = -1;
        board[0][1] = 1;
        board[3][3] = -1;
        board[3][4] = 1;
        board[4][3] = 1;
        board[4][4] = -1;

        const stabilizingEdgeMove = { row: 0, col: 2, flips: [{ row: 0, col: 1 }] };
        const innerMove = { row: 2, col: 3, flips: [{ row: 3, col: 3 }] };

        const selected = core.chooseMoveByLookahead([innerMove, stabilizingEdgeMove], {
            board,
            playerValue: -1,
            level: 6,
            depth: 1,
            maxBranch: 2,
            nodeBudget: 2000,
            searchWeight: 0,
            priorWeight: 500,
            scoreMove: (move) => (move === innerMove ? 999999 : 0)
        });
        expect(selected).toEqual(stabilizingEdgeMove);
    });

    test('chooseMoveByLookahead prefers pseudo-corner X when own corner and both C-squares are already secured', () => {
        const board = Array.from({ length: 8 }, () => Array(8).fill(0));
        board[0][0] = -1;
        board[0][1] = -1;
        board[1][0] = -1;
        board[1][2] = 1;
        board[1][3] = -1;
        board[3][3] = 1;
        board[3][4] = -1;
        board[4][3] = -1;
        board[4][4] = 1;

        const pseudoCornerXMove = { row: 1, col: 1, flips: [{ row: 1, col: 2 }] };
        const innerMove = { row: 2, col: 3, flips: [{ row: 3, col: 3 }] };

        const selected = core.chooseMoveByLookahead([pseudoCornerXMove, innerMove], {
            board,
            playerValue: -1,
            level: 6,
            depth: 1,
            maxBranch: 2,
            nodeBudget: 2000,
            searchWeight: 1,
            priorWeight: 0,
            scoreMove: () => 0
        });
        expect(selected).toEqual(pseudoCornerXMove);
    });

    test('chooseMoveByLookahead keeps standard-board donation veto for risky edge moves', () => {
        const board = Array.from({ length: 8 }, () => Array(8).fill(0));
        board[0][1] = -1;
        board[0][2] = 1;
        board[0][3] = 1;
        board[4][3] = 1;

        const innerMove = { row: 4, col: 4, flips: [{ row: 4, col: 3 }] };
        const edgeMove = { row: 0, col: 4, flips: [{ row: 0, col: 3 }] };

        const selected = core.chooseMoveByLookahead([innerMove, edgeMove], {
            board,
            playerValue: -1,
            level: 6,
            depth: 1,
            maxBranch: 2,
            nodeBudget: 2000,
            searchWeight: 0,
            priorWeight: 500,
            scoreMove: (move) => (move === innerMove ? 999999 : 0)
        });

        expect(selected).toEqual(innerMove);
    });

    test('chooseMoveByLookahead keeps corner-donation veto on nonstandard boards too', () => {
        const board = Array.from({ length: 9 }, () => Array(9).fill(0));
        board[0][1] = -1;
        board[0][2] = 1;
        board[0][3] = 1;
        board[4][3] = 1;

        const innerMove = { row: 4, col: 4, flips: [{ row: 4, col: 3 }] };
        const edgeMove = { row: 0, col: 4, flips: [{ row: 0, col: 3 }] };

        const selected = core.chooseMoveByLookahead([innerMove, edgeMove], {
            board,
            playerValue: -1,
            level: 6,
            depth: 1,
            maxBranch: 2,
            nodeBudget: 2000,
            searchWeight: 0,
            priorWeight: 500,
            scoreMove: (move) => (move === innerMove ? 999999 : 0)
        });

        expect(selected).toEqual(innerMove);
    });

    test('chooseMoveByLookahead does not crash when nonstandard edge neighbors live in expansion cells', () => {
        const board = Array.from({ length: 8 }, () => Array(8).fill(0));
        board[0][0] = -1;
        board[0][5] = -1;
        board[0][6] = 1;
        board[4][3] = 1;

        SharedBoardUtils.attachBoardShape(board, {
            boardExpansion: {
                cells: [
                    { row: -1, col: 7, owner: 0 },
                    { row: 0, col: 8, owner: 0 }
                ]
            }
        });

        const innerMove = { row: 4, col: 4, flips: [{ row: 4, col: 3 }] };
        const expansionEdgeMove = { row: 0, col: 7, flips: [{ row: 0, col: 6 }] };

        expect(() => core.chooseMoveByLookahead([innerMove, expansionEdgeMove], {
            board,
            playerValue: -1,
            level: 6,
            depth: 1,
            maxBranch: 2,
            nodeBudget: 2000,
            searchWeight: 0,
            priorWeight: 500,
            scoreMove: (move) => (move === innerMove ? 999999 : 0)
        })).not.toThrow();
    });

    test('chooseMoveByLookahead enables 30-ply endgame mode when empties are low', () => {
        const board = Array.from({ length: 8 }, () => Array(8).fill(1));
        const empties = [
            [0, 0], [0, 1], [0, 2], [0, 3], [0, 4], [0, 5], [0, 6], [0, 7],
            [1, 0], [1, 1], [1, 2], [1, 3], [1, 4], [1, 5], [1, 6], [1, 7],
            [2, 0], [2, 1], [2, 2], [2, 3], [2, 4], [2, 5], [2, 6], [2, 7],
            [3, 0], [3, 1], [3, 2], [3, 3], [3, 4], [3, 5]
        ];
        for (const [r, c] of empties) board[r][c] = 0;
        board[0][1] = -1;
        board[1][0] = -1;
        board[2][3] = -1;

        const moveCorner = { row: 0, col: 0, flips: [{ row: 0, col: 1 }, { row: 1, col: 0 }] };
        const moveInner = { row: 2, col: 2, flips: [{ row: 2, col: 3 }] };

        let meta = null;
        const selected = core.chooseMoveByLookahead([moveInner, moveCorner], {
            board,
            playerValue: 1,
            level: 6,
            endgameNodeBudget: 20_000,
            endgameMaxTimeMs: 120,
            onSearchMeta: (m) => {
                meta = m;
            }
        });

        expect(selected).toBeTruthy();
        expect([moveInner, moveCorner]).toContain(selected);
        expect(meta).toBeTruthy();
        expect(meta.endgameMode).toBe(true);
        expect(meta.depth).toBeGreaterThanOrEqual(30);
    });

    test('chooseMoveByLookahead exposes late-endgame parity and damped prior mix in metadata', () => {
        const board = Array.from({ length: 8 }, () => Array(8).fill(Core.BLACK));
        board[0][0] = Core.EMPTY;
        board[0][1] = Core.EMPTY;
        board[1][0] = Core.EMPTY;

        let meta = null;
        const selected = core.chooseMoveByLookahead([
            { row: 0, col: 0, flips: [] }
        ], {
            board,
            playerValue: Core.BLACK,
            level: 6,
            priorWeight: 100,
            searchWeight: 1.8,
            onSearchMeta: (one) => {
                meta = one;
            }
        });

        expect(selected).toEqual(expect.objectContaining({ row: 0, col: 0 }));
        expect(meta).toBeTruthy();
        expect(meta.endgameMode).toBe(true);
        expect(meta.effectivePriorWeight).toBeLessThan(100);
        expect(meta.effectiveSearchWeight).toBeGreaterThan(1.8);
        expect(meta.parityOddRegionCount).toBe(1);
        expect(meta.parityEvenRegionCount).toBe(0);
        expect(meta.paritySignal).toBe(1);
        expect(meta.forcedPassSignal).toBe(0);
    });

    test('chooseCardWithRiskProfile avoids high-variance expensive card while ahead', () => {
        const defs = {
            high: { id: 'high', type: 'ULTIMATE_REVERSE_DRAGON' },
            safe: { id: 'safe', type: 'HEAVEN_BLESSING' }
        };
        const costs = { high: 30, safe: 2 };
        const selected = core.chooseCardWithRiskProfile(
            ['high', 'safe'],
            (id) => costs[id],
            (id) => defs[id],
            {
                level: 6,
                legalMovesCount: 1,
                discDiff: 14,
                empties: 10,
                ownCharge: 30
            }
        );
        expect(selected).toBeTruthy();
        expect(selected.cardId).toBe('safe');
    });

    test('scoreCardUseDecision forceUseCard allows risky card when no legal move exists', () => {
        const out = core.scoreCardUseDecision(
            'high',
            () => 30,
            () => ({ id: 'high', type: 'ULTIMATE_REVERSE_DRAGON' }),
            {
                level: 6,
                legalMovesCount: 0,
                forceUseCard: true,
                discDiff: 16,
                empties: 8,
                ownCharge: 30
            }
        );
        expect(out.shouldUse).toBe(true);
    });




    test('scoreCardUseDecision uses REBUILD_WILL to recover from saturated low-quality hand', () => {
        const defs = {
            rebuild: { id: 'rebuild', type: 'REBUILD_WILL' },
            risk_a: { id: 'risk_a', type: 'TIME_STOP_GOD' },
            risk_b: { id: 'risk_b', type: 'TIME_BOMB' },
            risk_c: { id: 'risk_c', type: 'DOUBLE_CHAIN_WILL' },
            silver: { id: 'silver', type: 'SILVER_STONE' }
        };
        const out = core.scoreCardUseDecision(
            'rebuild',
            () => 0,
            (id) => defs[id] || null,
            {
                level: 6,
                legalMovesCount: 4,
                discDiff: -4,
                empties: 34,
                ownCharge: 10,
                handSize: 5,
                handCardIds: ['rebuild', 'risk_a', 'risk_b', 'risk_c', 'silver'],
                usableCardIds: ['rebuild'],
                deckRemaining: 12,
                ownCorners: 0,
                oppCorners: 1
            }
        );
        expect(out.shouldUse).toBe(true);
        expect(out.score).toBeGreaterThan(out.minUseScore);
    });

    test('scoreCardUseDecision suppresses REBUILD_WILL when key cards are held or deck is too thin', () => {
        const defs = {
            rebuild: { id: 'rebuild', type: 'REBUILD_WILL' },
            guard: { id: 'guard', type: 'GUARD_WILL' },
            destroy: { id: 'destroy', type: 'DESTROY_ONE_STONE' },
            silver: { id: 'silver', type: 'SILVER_STONE' }
        };
        const out = core.scoreCardUseDecision(
            'rebuild',
            () => 0,
            (id) => defs[id] || null,
            {
                level: 6,
                legalMovesCount: 4,
                discDiff: 2,
                empties: 30,
                ownCharge: 12,
                handSize: 4,
                handCardIds: ['rebuild', 'guard', 'destroy', 'silver'],
                usableCardIds: ['rebuild', 'guard', 'destroy'],
                deckRemaining: 1,
                ownCorners: 1,
                oppCorners: 0
            }
        );
        expect(out.shouldUse).toBe(false);
    });

    test('scoreCardUseDecision uses SUPPLY_WILL to refill a shallow hand', () => {
        const out = core.scoreCardUseDecision(
            'supply',
            () => 1,
            () => ({ id: 'supply', type: 'SUPPLY_WILL' }),
            {
                level: 6,
                legalMovesCount: 4,
                discDiff: -2,
                empties: 36,
                ownCharge: 6,
                handSize: 2,
                handCardIds: ['supply', 'guard'],
                usableCardIds: ['supply'],
                deckRemaining: 10,
                ownCorners: 0,
                oppCorners: 1,
                hasCornerMoveNow: false,
                hasEdgeMoveNow: true
            }
        );
        expect(out.shouldUse).toBe(true);
        expect(out.score).toBeGreaterThan(out.minUseScore);
    });

    test('scoreCardUseDecision suppresses SUPPLY_WILL when hand is full', () => {
        const out = core.scoreCardUseDecision(
            'supply',
            () => 1,
            () => ({ id: 'supply', type: 'SUPPLY_WILL' }),
            {
                level: 6,
                legalMovesCount: 4,
                discDiff: 4,
                empties: 30,
                ownCharge: 10,
                handSize: 5,
                handCardIds: ['supply', 'guard', 'destroy', 'silver', 'work'],
                usableCardIds: ['supply', 'guard', 'destroy'],
                deckRemaining: 10,
                ownCorners: 1,
                oppCorners: 0,
                hasCornerMoveNow: false,
                hasEdgeMoveNow: true
            }
        );
        expect(out.shouldUse).toBe(false);
    });

    test('scoreCardUseDecision prefers stability cards while ahead with corner-edge lead', () => {
        const defs = {
            guard: { id: 'guard', type: 'GUARD_WILL' },
            bomb: { id: 'bomb', type: 'TIME_BOMB' }
        };
        const costs = { guard: 8, bomb: 9 };
        const guardDecision = core.scoreCardUseDecision(
            'guard',
            (id) => costs[id],
            (id) => defs[id] || null,
            {
                level: 6,
                legalMovesCount: 5,
                discDiff: 10,
                empties: 18,
                ownCharge: 16,
                handSize: 4,
                ownCorners: 2,
                oppCorners: 0,
                ownEdges: 8,
                oppEdges: 2,
                hasCornerMoveNow: true,
                hasEdgeMoveNow: true,
                cornerEmergency: false
            }
        );
        const bombDecision = core.scoreCardUseDecision(
            'bomb',
            (id) => costs[id],
            (id) => defs[id] || null,
            {
                level: 6,
                legalMovesCount: 5,
                discDiff: 10,
                empties: 18,
                ownCharge: 16,
                handSize: 4,
                ownCorners: 2,
                oppCorners: 0,
                ownEdges: 8,
                oppEdges: 2,
                hasCornerMoveNow: true,
                hasEdgeMoveNow: true,
                cornerEmergency: false
            }
        );

        expect(guardDecision.score).toBeGreaterThan(bombDecision.score);
    });

    test('scoreCardUseDecision prefers recovery swing cards while behind in corner-edge deficit', () => {
        const defs = {
            recover: { id: 'recover', type: 'DESTROY_ONE_STONE' },
            guard: { id: 'guard', type: 'GUARD_WILL' }
        };
        const costs = { recover: 12, guard: 8 };
        const recoverDecision = core.scoreCardUseDecision(
            'recover',
            (id) => costs[id],
            (id) => defs[id] || null,
            {
                level: 6,
                legalMovesCount: 3,
                discDiff: -12,
                empties: 24,
                ownCharge: 16,
                handSize: 4,
                ownCorners: 0,
                oppCorners: 2,
                ownEdges: 2,
                oppEdges: 7,
                hasCornerMoveNow: false,
                hasEdgeMoveNow: true,
                cornerEmergency: true
            }
        );
        const guardDecision = core.scoreCardUseDecision(
            'guard',
            (id) => costs[id],
            (id) => defs[id] || null,
            {
                level: 6,
                legalMovesCount: 3,
                discDiff: -12,
                empties: 24,
                ownCharge: 16,
                handSize: 4,
                ownCorners: 0,
                oppCorners: 2,
                ownEdges: 2,
                oppEdges: 7,
                hasCornerMoveNow: false,
                hasEdgeMoveNow: true,
                cornerEmergency: true
            }
        );

        expect(recoverDecision.score).toBeGreaterThan(guardDecision.score);
        expect(recoverDecision.shouldUse).toBe(true);
    });

    test('scoreCardUseDecision boosts edge contest cards when edge control is collapsing', () => {
        const defs = {
            destroy: { id: 'destroy', type: 'DESTROY_ONE_STONE' },
            heaven: { id: 'heaven', type: 'HEAVEN_BLESSING' }
        };
        const costs = { destroy: 12, heaven: 6 };
        const destroyDecision = core.scoreCardUseDecision(
            'destroy',
            (id) => costs[id],
            (id) => defs[id] || null,
            {
                level: 6,
                legalMovesCount: 2,
                discDiff: -4,
                empties: 32,
                ownCharge: 14,
                handSize: 4,
                ownCorners: 1,
                oppCorners: 1,
                ownEdges: 1,
                oppEdges: 6,
                hasCornerMoveNow: false,
                hasEdgeMoveNow: false,
                cornerEmergency: false
            }
        );
        const heavenDecision = core.scoreCardUseDecision(
            'heaven',
            (id) => costs[id],
            (id) => defs[id] || null,
            {
                level: 6,
                legalMovesCount: 2,
                discDiff: -4,
                empties: 32,
                ownCharge: 14,
                handSize: 4,
                ownCorners: 1,
                oppCorners: 1,
                ownEdges: 1,
                oppEdges: 6,
                hasCornerMoveNow: false,
                hasEdgeMoveNow: false,
                cornerEmergency: false
            }
        );

        expect(destroyDecision.score).toBeGreaterThan(heavenDecision.score);
    });


    test('scoreCardUseDecision lowers min threshold when hand is saturated', () => {
        const out = core.scoreCardUseDecision(
            'chain',
            () => 3,
            () => ({ id: 'chain', type: 'DOUBLE_CHAIN_WILL' }),
            {
                level: 6,
                legalMovesCount: 4,
                discDiff: 1,
                empties: 36,
                ownCharge: 10,
                handSize: 5
            }
        );
        expect(out.minUseScore).toBeLessThan(14);
    });

    test('scoreCardUseDecision suppresses HEAVEN_BLESSING when hand is saturated in endgame', () => {
        const out = core.scoreCardUseDecision(
            'heaven',
            () => 3,
            () => ({ id: 'heaven', type: 'HEAVEN_BLESSING' }),
            {
                level: 6,
                playerValue: -1,
                legalMovesCount: 4,
                discDiff: 6,
                empties: 10,
                ownCharge: 20,
                handSize: 5,
                ownCorners: 2,
                oppCorners: 0,
                hasCornerMoveNow: true,
                deckRemaining: 2
            }
        );
        expect(out.shouldUse).toBe(false);
    });

    test('scoreCardUseDecision uses BLOCKADE_WILL more aggressively under low mobility and corner pressure', () => {
        const out = core.scoreCardUseDecision(
            'blockade',
            () => 1,
            () => ({ id: 'blockade', type: 'BLOCKADE_WILL' }),
            {
                level: 6,
                playerValue: -1,
                legalMovesCount: 1,
                discDiff: -6,
                empties: 20,
                ownCharge: 8,
                handSize: 3,
                ownCorners: 0,
                oppCorners: 1,
                ownEdges: 1,
                oppEdges: 5,
                hasCornerMoveNow: false,
                hasEdgeMoveNow: false,
                cornerEmergency: true
            }
        );
        expect(out.shouldUse).toBe(true);
        expect(out.score).toBeGreaterThan(out.minUseScore);
    });

    test('scoreCardUseDecision uses GOLD_STONE when immediate charge ROI is high', () => {
        const out = core.scoreCardUseDecision(
            'gold',
            () => 6,
            () => ({ id: 'gold', type: 'GOLD_STONE' }),
            {
                level: 6,
                legalMovesCount: 4,
                discDiff: -3,
                empties: 28,
                ownCharge: 14,
                handSize: 3,
                ownCorners: 1,
                oppCorners: 1,
                hasCornerMoveNow: false,
                maxLegalFlips: 4,
                maxLegalGain: 5,
                avgLegalFlips: 2.8
            }
        );
        expect(out.shouldUse).toBe(true);
    });

    test('scoreCardUseDecision lowers white Lv6 threshold for safe card under hand and charge pressure', () => {
        const out = core.scoreCardUseDecision(
            'treasure',
            () => 6,
            () => ({ id: 'treasure', type: 'TREASURE_BOX' }),
            {
                level: 6,
                playerValue: -1,
                legalMovesCount: 2,
                discDiff: 2,
                empties: 28,
                ownCorners: 1,
                oppCorners: 1,
                ownEdges: 0,
                oppEdges: 0,
                ownCharge: 40,
                handSize: 5
            }
        );
        expect(out.shouldUse).toBe(true);
        expect(out.minUseScore).toBeLessThanOrEqual(8);
    });

    test('scoreCardUseDecision suppresses GOLD_STONE when immediate charge ROI is poor', () => {
        const out = core.scoreCardUseDecision(
            'gold',
            () => 6,
            () => ({ id: 'gold', type: 'GOLD_STONE' }),
            {
                level: 6,
                legalMovesCount: 5,
                discDiff: 10,
                empties: 20,
                ownCharge: 14,
                handSize: 3,
                ownCorners: 2,
                oppCorners: 0,
                hasCornerMoveNow: true,
                maxLegalFlips: 1,
                maxLegalGain: 1,
                avgLegalFlips: 1
            }
        );
        expect(out.shouldUse).toBe(false);
    });

    test('scoreCardUseDecision suppresses SILVER_STONE below three flips', () => {
        const out = core.scoreCardUseDecision(
            'silver',
            () => 5,
            () => ({ id: 'silver', type: 'SILVER_STONE' }),
            {
                level: 6,
                playerValue: -1,
                legalMovesCount: 4,
                discDiff: -2,
                empties: 24,
                ownCharge: 12,
                handSize: 3,
                ownCorners: 1,
                oppCorners: 1,
                maxLegalFlips: 2,
                maxLegalGain: 2,
                avgLegalFlips: 1.8
            }
        );
        expect(out.shouldUse).toBe(false);
    });

    test('scoreCardUseDecision suppresses PLUNDER_WILL below three flips in white Lv6 mode', () => {
        const out = core.scoreCardUseDecision(
            'plunder',
            () => 7,
            () => ({ id: 'plunder', type: 'PLUNDER_WILL' }),
            {
                level: 6,
                playerValue: -1,
                legalMovesCount: 4,
                discDiff: 0,
                empties: 26,
                ownCharge: 18,
                oppCharge: 10,
                handSize: 2,
                ownCorners: 1,
                oppCorners: 1,
                hasCornerMoveNow: false,
                cornerEmergency: false,
                reserveChargeFloor: 8,
                maxLegalFlips: 2,
                maxLegalGain: 2,
                avgLegalFlips: 1.8
            }
        );
        expect(out.shouldUse).toBe(false);
    });

    test('scoreCardUseDecision uses RAINBOW_STONE when immediate charge ROI is high', () => {
        const out = core.scoreCardUseDecision(
            'rainbow',
            () => 10,
            () => ({ id: 'rainbow', type: 'RAINBOW_STONE' }),
            {
                level: 6,
                legalMovesCount: 4,
                discDiff: -4,
                empties: 24,
                ownCharge: 18,
                handSize: 3,
                ownCorners: 1,
                oppCorners: 2,
                hasCornerMoveNow: false,
                maxLegalFlips: 4,
                maxLegalGain: 5,
                avgLegalFlips: 2.8
            }
        );
        expect(out.shouldUse).toBe(true);
    });

    test('scoreCardUseDecision uses CRYSTAL_STONE when high-value number cell is available', () => {
        const out = core.scoreCardUseDecision(
            'crystal',
            () => 7,
            () => ({ id: 'crystal', type: 'CRYSTAL_STONE' }),
            {
                level: 6,
                legalMovesCount: 4,
                discDiff: -2,
                empties: 26,
                ownCharge: 12,
                handSize: 3,
                ownCorners: 1,
                oppCorners: 1,
                hasCornerMoveNow: false,
                highBonusMoveAvailable: true,
                maxLegalFlips: 1,
                maxLegalGain: 4,
                maxLegalBoardBonus: 3,
                avgLegalFlips: 1.5
            }
        );
        expect(out.shouldUse).toBe(true);
    });

    test('scoreCardUseDecision suppresses CRYSTAL_STONE when数字マス利益がない', () => {
        const out = core.scoreCardUseDecision(
            'crystal',
            () => 7,
            () => ({ id: 'crystal', type: 'CRYSTAL_STONE' }),
            {
                level: 6,
                legalMovesCount: 5,
                discDiff: 8,
                empties: 18,
                ownCharge: 14,
                handSize: 3,
                ownCorners: 2,
                oppCorners: 0,
                hasCornerMoveNow: true,
                maxLegalFlips: 3,
                maxLegalGain: 3,
                maxLegalBoardBonus: 0,
                avgLegalFlips: 2.2
            }
        );
        expect(out.shouldUse).toBe(false);
    });

    test('scoreCardUseDecision suppresses CRYSTAL_STONE on medium-value number cell only', () => {
        const out = core.scoreCardUseDecision(
            'crystal',
            () => 7,
            () => ({ id: 'crystal', type: 'CRYSTAL_STONE' }),
            {
                level: 6,
                playerValue: -1,
                legalMovesCount: 2,
                discDiff: -8,
                empties: 42,
                ownCharge: 12,
                handSize: 3,
                ownCorners: 0,
                oppCorners: 1,
                ownEdges: 3,
                oppEdges: 5,
                ownDiscs: 10,
                hasCornerMoveNow: false,
                hasEdgeMoveNow: true,
                cornerEmergency: true,
                highBonusMoveAvailable: true,
                maxLegalFlips: 2,
                maxLegalGain: 3,
                maxLegalBoardBonus: 2,
                avgLegalFlips: 1.5
            }
        );
        expect(out.shouldUse).toBe(false);
    });

    test('scoreCardUseDecision promotes GLUTTONOUS_WILL when four-plus flips are available', () => {
        const out = core.scoreCardUseDecision(
            'gluttonous',
            () => 9,
            () => ({ id: 'gluttonous', type: 'GLUTTONOUS_WILL' }),
            {
                level: 6,
                playerValue: -1,
                legalMovesCount: 3,
                discDiff: -7,
                empties: 26,
                ownCharge: 20,
                handSize: 3,
                ownCorners: 0,
                oppCorners: 1,
                hasCornerMoveNow: false,
                maxLegalFlips: 4,
                maxLegalGain: 4,
                avgLegalFlips: 2.8
            }
        );
        expect(out.shouldUse).toBe(true);
    });

    test('scoreCardUseDecision suppresses GLUTTONOUS_WILL below four flips even under mobility pressure', () => {
        const out = core.scoreCardUseDecision(
            'gluttonous',
            () => 9,
            () => ({ id: 'gluttonous', type: 'GLUTTONOUS_WILL' }),
            {
                level: 6,
                playerValue: -1,
                legalMovesCount: 1,
                discDiff: -20,
                empties: 50,
                ownCharge: 28,
                handSize: 5,
                ownCorners: 0,
                oppCorners: 1,
                hasCornerMoveNow: false,
                hasEdgeMoveNow: true,
                maxLegalFlips: 2,
                maxLegalGain: 2,
                avgLegalFlips: 1.8
            }
        );
        expect(out.shouldUse).toBe(false);
    });

    test('scoreCardUseDecision lowers threshold and promotes mobility rescue at four discs', () => {
        const out = core.scoreCardUseDecision(
            'blockade',
            () => 8,
            () => ({ id: 'blockade', type: 'BLOCKADE_WILL' }),
            {
                level: 6,
                playerValue: -1,
                legalMovesCount: 1,
                discDiff: -18,
                ownDiscs: 4,
                empties: 18,
                ownCharge: 14,
                handSize: 3,
                ownCorners: 0,
                oppCorners: 2,
                hasCornerMoveNow: false,
                hasEdgeMoveNow: false,
                cornerEmergency: true
            }
        );
        expect(out.shouldUse).toBe(true);
        expect(out.minUseScore).toBeLessThanOrEqual(2);
    });

    test('scoreCardUseDecision values LOSS_WILL when opponent has more specials', () => {
        const strong = core.scoreCardUseDecision(
            'loss',
            () => 11,
            () => ({ id: 'loss', type: 'LOSS_WILL' }),
            {
                level: 6,
                legalMovesCount: 4,
                discDiff: -4,
                empties: 30,
                ownCharge: 18,
                ownSpecialCount: 1,
                oppSpecialCount: 5,
                ownGuardCount: 0,
                oppGuardCount: 1
            }
        );
        const weak = core.scoreCardUseDecision(
            'loss',
            () => 11,
            () => ({ id: 'loss', type: 'LOSS_WILL' }),
            {
                level: 6,
                legalMovesCount: 4,
                discDiff: 6,
                empties: 22,
                ownCharge: 18,
                ownSpecialCount: 3,
                oppSpecialCount: 1,
                ownGuardCount: 1,
                oppGuardCount: 0
            }
        );
        expect(strong.score).toBeGreaterThan(weak.score);
    });

    test('scoreCardUseDecision suppresses LOSS_WILL when it would reset own corner special without bigger enemy anchor payoff', () => {
        const out = core.scoreCardUseDecision(
            'loss',
            () => 11,
            () => ({ id: 'loss', type: 'LOSS_WILL' }),
            {
                level: 6,
                legalMovesCount: 4,
                discDiff: -4,
                empties: 26,
                ownCharge: 18,
                ownSpecialCount: 1,
                oppSpecialCount: 3,
                ownGuardCount: 0,
                oppGuardCount: 0,
                ownCornerResetCount: 1,
                oppCornerResetCount: 0,
                ownEdgeResetCount: 0,
                oppEdgeResetCount: 0
            }
        );
        expect(out.shouldUse).toBe(false);
        expect(out.score).toBeLessThan(out.minUseScore);
    });

    test('scoreCardUseDecision keeps LOSS_WILL available when enemy anchor resets clearly outweigh own', () => {
        const out = core.scoreCardUseDecision(
            'loss',
            () => 11,
            () => ({ id: 'loss', type: 'LOSS_WILL' }),
            {
                level: 6,
                legalMovesCount: 2,
                discDiff: -8,
                empties: 20,
                ownCharge: 18,
                ownSpecialCount: 1,
                oppSpecialCount: 5,
                ownGuardCount: 0,
                oppGuardCount: 0,
                ownCornerResetCount: 1,
                oppCornerResetCount: 2,
                ownEdgeResetCount: 0,
                oppEdgeResetCount: 1,
                cornerEmergency: true
            }
        );
        expect(out.shouldUse).toBe(true);
        expect(out.score).toBeGreaterThanOrEqual(out.minUseScore);
    });

    test('scoreCardUseDecision uses EXTREME_HYPERACTIVE_WILL as comeback card and suppresses it while ahead in endgame', () => {
        const trailing = core.scoreCardUseDecision(
            'extreme',
            () => 35,
            () => ({ id: 'extreme', type: 'EXTREME_HYPERACTIVE_WILL' }),
            {
                level: 6,
                legalMovesCount: 3,
                discDiff: -12,
                empties: 30,
                ownCharge: 46,
                handSize: 3,
                ownCorners: 0,
                oppCorners: 2,
                hasCornerMoveNow: true,
                hasEdgeMoveNow: true,
                cornerEmergency: true
            }
        );
        const aheadEndgame = core.scoreCardUseDecision(
            'extreme',
            () => 35,
            () => ({ id: 'extreme', type: 'EXTREME_HYPERACTIVE_WILL' }),
            {
                level: 6,
                legalMovesCount: 4,
                discDiff: 10,
                empties: 10,
                ownCharge: 46,
                handSize: 3,
                ownCorners: 2,
                oppCorners: 0,
                hasCornerMoveNow: true,
                hasEdgeMoveNow: true,
                cornerEmergency: false
            }
        );

        expect(trailing.shouldUse).toBe(true);
        expect(aheadEndgame.shouldUse).toBe(false);
        expect(trailing.score).toBeGreaterThan(aheadEndgame.score);
    });

    test('scoreCardUseDecision treats EQUALITY_WILL as a comeback-only option', () => {
        const trailing = core.scoreCardUseDecision(
            'equality',
            () => 15,
            () => ({ id: 'equality', type: 'EQUALITY_WILL' }),
            {
                level: 6,
                playerValue: -1,
                legalMovesCount: 3,
                discDiff: -12,
                empties: 26,
                ownCharge: 28,
                handSize: 3,
                ownDiscs: 8,
                oppDiscs: 20,
                ownCorners: 0,
                oppCorners: 1,
                ownEdges: 2,
                oppEdges: 5,
                usableCardIds: ['equality'],
                hasCornerMoveNow: false,
                hasEdgeMoveNow: true,
                cornerEmergency: true
            }
        );
        const inactive = core.scoreCardUseDecision(
            'equality',
            () => 15,
            () => ({ id: 'equality', type: 'EQUALITY_WILL' }),
            {
                level: 6,
                playerValue: -1,
                legalMovesCount: 4,
                discDiff: -6,
                empties: 26,
                ownCharge: 28,
                handSize: 3,
                ownDiscs: 13,
                oppDiscs: 19,
                ownCorners: 1,
                oppCorners: 1,
                ownEdges: 4,
                oppEdges: 4,
                usableCardIds: [],
                hasCornerMoveNow: false,
                hasEdgeMoveNow: true,
                cornerEmergency: false
            }
        );

        expect(trailing.shouldUse).toBe(true);
        expect(inactive.shouldUse).toBe(false);
        expect(trailing.score).toBeGreaterThan(inactive.score);
    });

    test('scoreCardUseDecision treats REINFORCEMENT_WILL as a recovery option under pressure', () => {
        const pressured = core.scoreCardUseDecision(
            'reinforcement',
            () => 6,
            () => ({ id: 'reinforcement', type: 'REINFORCEMENT_WILL' }),
            {
                level: 6,
                playerValue: -1,
                legalMovesCount: 1,
                discDiff: -10,
                empties: 26,
                ownCharge: 12,
                handSize: 3,
                ownDiscs: 10,
                oppDiscs: 20,
                ownCorners: 0,
                oppCorners: 2,
                ownEdges: 2,
                oppEdges: 6,
                usableCardIds: ['reinforcement'],
                hasCornerMoveNow: false,
                hasEdgeMoveNow: true,
                cornerEmergency: true
            }
        );
        const stable = core.scoreCardUseDecision(
            'reinforcement',
            () => 6,
            () => ({ id: 'reinforcement', type: 'REINFORCEMENT_WILL' }),
            {
                level: 6,
                playerValue: -1,
                legalMovesCount: 4,
                discDiff: 8,
                empties: 14,
                ownCharge: 12,
                handSize: 3,
                ownDiscs: 22,
                oppDiscs: 14,
                ownCorners: 2,
                oppCorners: 0,
                ownEdges: 7,
                oppEdges: 3,
                usableCardIds: ['reinforcement'],
                hasCornerMoveNow: true,
                hasEdgeMoveNow: true,
                cornerEmergency: false
            }
        );
        expect(pressured.score).toBeGreaterThan(stable.score);
        expect(stable.shouldUse).toBe(false);
    });

    test('scoreCardUseDecision suppresses METEOR_WILL while ahead and promotes it in corner emergency with bonus follow-up', () => {
        const ahead = core.scoreCardUseDecision(
            'meteor',
            () => 21,
            () => ({ id: 'meteor', type: 'METEOR_WILL' }),
            {
                level: 6,
                playerValue: -1,
                legalMovesCount: 4,
                discDiff: 10,
                empties: 18,
                ownCharge: 36,
                handSize: 3,
                ownCorners: 2,
                oppCorners: 0,
                hasCornerMoveNow: true,
                hasEdgeMoveNow: true,
                cornerEmergency: false
            }
        );
        const emergency = core.scoreCardUseDecision(
            'meteor',
            () => 21,
            () => ({ id: 'meteor', type: 'METEOR_WILL' }),
            {
                level: 6,
                playerValue: -1,
                legalMovesCount: 6,
                discDiff: -12,
                empties: 22,
                ownCharge: 36,
                handSize: 3,
                ownCorners: 0,
                oppCorners: 2,
                ownEdges: 1,
                oppEdges: 6,
                hasCornerMoveNow: false,
                hasEdgeMoveNow: false,
                cornerEmergency: true,
                highBonusMoveAvailable: true
            }
        );
        expect(ahead.shouldUse).toBe(false);
        expect(emergency.score).toBeGreaterThan(ahead.score);
    });

    test('scoreCardUseDecision suppresses METEOR_WILL in low-mobility no-anchor corner emergency without bonus follow-up', () => {
        const riskyEmergency = core.scoreCardUseDecision(
            'meteor',
            () => 21,
            () => ({ id: 'meteor', type: 'METEOR_WILL' }),
            {
                level: 6,
                playerValue: -1,
                legalMovesCount: 1,
                discDiff: -8,
                empties: 20,
                ownCharge: 36,
                handSize: 5,
                ownCorners: 0,
                oppCorners: 2,
                ownEdges: 1,
                oppEdges: 7,
                hasCornerMoveNow: false,
                hasEdgeMoveNow: false,
                cornerEmergency: true,
                forceUseCard: true,
                highBonusMoveAvailable: false
            }
        );
        const bonusEmergency = core.scoreCardUseDecision(
            'meteor',
            () => 21,
            () => ({ id: 'meteor', type: 'METEOR_WILL' }),
            {
                level: 6,
                playerValue: -1,
                legalMovesCount: 6,
                discDiff: -8,
                empties: 20,
                ownCharge: 36,
                handSize: 5,
                ownCorners: 0,
                oppCorners: 2,
                ownEdges: 1,
                oppEdges: 7,
                hasCornerMoveNow: false,
                hasEdgeMoveNow: false,
                cornerEmergency: true,
                highBonusMoveAvailable: true
            }
        );
        expect(riskyEmergency.score).toBeLessThan(bonusEmergency.score);
    });

    test('chooseLowestRetentionCard rotates EXTREME_HYPERACTIVE_WILL first when leading in endgame', () => {
        const defs = {
            extreme: { id: 'extreme', type: 'EXTREME_HYPERACTIVE_WILL' },
            guard: { id: 'guard', type: 'GUARD_WILL' },
            silver: { id: 'silver', type: 'SILVER_STONE' }
        };
        const costs = { extreme: 35, guard: 2, silver: 3 };
        const selected = core.chooseLowestRetentionCard(
            ['extreme', 'guard', 'silver'],
            (id) => costs[id],
            (id) => defs[id] || null,
            {
                level: 6,
                legalMovesCount: 4,
                handSize: 5,
                discDiff: 9,
                empties: 12,
                ownCorners: 2,
                oppCorners: 0,
                hasCornerMoveNow: true,
                cornerEmergency: false,
                ownCharge: 30
            }
        );
        expect(selected).toBeTruthy();
        expect(selected.cardId).toBe('extreme');
    });

    test('chooseLowestRetentionCard keeps recovery card and sells lower-impact card when hand is full', () => {
        const defs = {
            guard: { id: 'guard', type: 'GUARD_WILL' },
            dragon: { id: 'dragon', type: 'ULTIMATE_REVERSE_DRAGON' },
            silver: { id: 'silver', type: 'SILVER_STONE' }
        };
        const costs = { guard: 2, dragon: 30, silver: 5 };
        const selected = core.chooseLowestRetentionCard(
            ['guard', 'dragon', 'silver'],
            (id) => costs[id],
            (id) => defs[id],
            {
                level: 6,
                legalMovesCount: 4,
                handSize: 5,
                discDiff: 10,
                empties: 18,
                ownCorners: 2,
                oppCorners: 1,
                hasCornerMoveNow: true
            }
        );
        expect(selected).toBeTruthy();
        expect(selected.cardId).toBe('silver');
    });

    test('chooseLowestRetentionCard keeps recovery card during corner emergency', () => {
        const defs = {
            recover: { id: 'recover', type: 'DESTROY_ONE_STONE' },
            chain: { id: 'chain', type: 'DOUBLE_CHAIN_WILL' },
            wind: { id: 'wind', type: 'STRONG_WIND_WILL' }
        };
        const costs = { recover: 14, chain: 10, wind: 8 };
        const selected = core.chooseLowestRetentionCard(
            ['recover', 'chain', 'wind'],
            (id) => costs[id],
            (id) => defs[id],
            {
                level: 6,
                legalMovesCount: 2,
                handSize: 5,
                discDiff: -10,
                empties: 24,
                ownCorners: 0,
                oppCorners: 2,
                cornerEmergency: true
            }
        );
        expect(selected).toBeTruthy();
        expect(selected.cardId).toBe('chain');
    });

    test('chooseLowestRetentionCard prefers selling cost>=20 card in white Lv6 mode', () => {
        const defs = {
            dragon: { id: 'dragon', type: 'ULTIMATE_REVERSE_DRAGON' },
            guard: { id: 'guard', type: 'GUARD_WILL' },
            silver: { id: 'silver', type: 'SILVER_STONE' }
        };
        const costs = { dragon: 30, guard: 2, silver: 3 };
        const selected = core.chooseLowestRetentionCard(
            ['dragon', 'guard', 'silver'],
            (id) => costs[id],
            (id) => defs[id],
            {
                level: 6,
                playerValue: -1,
                legalMovesCount: 4,
                handSize: 4,
                discDiff: 6,
                empties: 24,
                ownCorners: 1,
                oppCorners: 0,
                hasCornerMoveNow: false,
                cornerEmergency: false
            }
        );
        expect(selected).toBeTruthy();
        expect(selected.cardId).toBe('dragon');
    });

    test('chooseLowestRetentionCard rotates LAST_RESORT first when it is unusable and hand is crowded', () => {
        const defs = {
            last: { id: 'last', type: 'LAST_RESORT' },
            guard: { id: 'guard', type: 'GUARD_WILL' },
            recover: { id: 'recover', type: 'DESTROY_ONE_STONE' }
        };
        const costs = { last: 20, guard: 2, recover: 14 };
        const selected = core.chooseLowestRetentionCard(
            ['last', 'guard', 'recover'],
            (id) => costs[id],
            (id) => defs[id],
            {
                level: 6,
                playerValue: -1,
                legalMovesCount: 4,
                handSize: 5,
                discDiff: 6,
                empties: 24,
                ownCorners: 1,
                oppCorners: 0,
                hasCornerMoveNow: false,
                cornerEmergency: false
            }
        );
        expect(selected).toBeTruthy();
        expect(selected.cardId).toBe('last');
    });

    test('chooseLowestRetentionCard rotates LAST_RESORT first when no legal moves remain but discDiff is non-negative', () => {
        const defs = {
            last: { id: 'last', type: 'LAST_RESORT' },
            guard: { id: 'guard', type: 'GUARD_WILL' },
            recover: { id: 'recover', type: 'DESTROY_ONE_STONE' }
        };
        const costs = { last: 20, guard: 2, recover: 14 };
        const selected = core.chooseLowestRetentionCard(
            ['last', 'guard', 'recover'],
            (id) => costs[id],
            (id) => defs[id],
            {
                level: 6,
                playerValue: -1,
                legalMovesCount: 0,
                handSize: 5,
                discDiff: 0,
                empties: 24,
                ownCorners: 1,
                oppCorners: 0,
                hasCornerMoveNow: false,
                cornerEmergency: false
            }
        );
        expect(selected).toBeTruthy();
        expect(selected.cardId).toBe('last');
    });

    test('scoreCardRetentionPriority devalues EQUALITY_WILL when the 10-disc gap is inactive', () => {
        const live = core.scoreCardRetentionPriority(
            'equality',
            () => 15,
            () => ({ id: 'equality', type: 'EQUALITY_WILL' }),
            {
                level: 6,
                playerValue: -1,
                legalMovesCount: 3,
                handSize: 4,
                discDiff: -12,
                empties: 24,
                ownCorners: 0,
                oppCorners: 1,
                hasCornerMoveNow: false,
                cornerEmergency: true,
                ownCharge: 28
            }
        );
        const inactive = core.scoreCardRetentionPriority(
            'equality',
            () => 15,
            () => ({ id: 'equality', type: 'EQUALITY_WILL' }),
            {
                level: 6,
                playerValue: -1,
                legalMovesCount: 3,
                handSize: 4,
                discDiff: -8,
                empties: 24,
                ownCorners: 0,
                oppCorners: 1,
                hasCornerMoveNow: false,
                cornerEmergency: true,
                ownCharge: 28
            }
        );

        expect(live.score).toBeGreaterThan(inactive.score);
        expect(inactive.score).toBeLessThan(0);
    });

    test('scoreCardRetentionPriority devalues REINFORCEMENT_WILL when corner recovery pressure is absent', () => {
        const pressured = core.scoreCardRetentionPriority(
            'reinforcement',
            () => 6,
            () => ({ id: 'reinforcement', type: 'REINFORCEMENT_WILL' }),
            {
                level: 6,
                playerValue: -1,
                legalMovesCount: 2,
                handSize: 4,
                discDiff: -10,
                empties: 24,
                ownCorners: 0,
                oppCorners: 2,
                hasCornerMoveNow: false,
                cornerEmergency: true,
                ownCharge: 12
            }
        );
        const stable = core.scoreCardRetentionPriority(
            'reinforcement',
            () => 6,
            () => ({ id: 'reinforcement', type: 'REINFORCEMENT_WILL' }),
            {
                level: 6,
                playerValue: -1,
                legalMovesCount: 4,
                handSize: 4,
                discDiff: 8,
                empties: 14,
                ownCorners: 2,
                oppCorners: 0,
                hasCornerMoveNow: true,
                cornerEmergency: false,
                ownCharge: 12
            }
        );
        expect(pressured.score).toBeGreaterThan(stable.score);
    });

    test('chooseLowestRetentionCard rotates SUPER_BUOYANCY_WILL when no corner or edge conversion exists', () => {
        const defs = {
            super: { id: 'super', type: 'SUPER_BUOYANCY_WILL' },
            guard: { id: 'guard', type: 'GUARD_WILL' },
            recover: { id: 'recover', type: 'DESTROY_ONE_STONE' },
            work: { id: 'work', type: 'WORK_WILL' }
        };
        const costs = { super: 14, guard: 2, recover: 14, work: 11 };
        const selected = core.chooseLowestRetentionCard(
            ['super', 'guard', 'recover', 'work'],
            (id) => costs[id],
            (id) => defs[id],
            {
                level: 6,
                playerValue: -1,
                legalMovesCount: 3,
                handSize: 4,
                discDiff: -4,
                empties: 30,
                ownCorners: 0,
                oppCorners: 0,
                ownEdges: 2,
                oppEdges: 3,
                hasCornerMoveNow: false,
                hasEdgeMoveNow: false,
                cornerEmergency: false
            }
        );
        expect(selected).toBeTruthy();
        expect(selected.cardId).toBe('super');
    });

    test('chooseLowestRetentionCard keeps TELEPORT_WILL during corner emergency', () => {
        const defs = {
            teleport: { id: 'teleport', type: 'TELEPORT_WILL' },
            silver: { id: 'silver', type: 'SILVER_STONE' },
            recover: { id: 'recover', type: 'DESTROY_ONE_STONE' }
        };
        const costs = { teleport: 9, silver: 3, recover: 14 };
        const selected = core.chooseLowestRetentionCard(
            ['teleport', 'silver', 'recover'],
            (id) => costs[id],
            (id) => defs[id],
            {
                level: 6,
                playerValue: -1,
                legalMovesCount: 2,
                handSize: 4,
                discDiff: -10,
                empties: 26,
                ownCorners: 0,
                oppCorners: 2,
                hasCornerMoveNow: false,
                cornerEmergency: true
            }
        );
        expect(selected).toBeTruthy();
        expect(selected.cardId).toBe('silver');
    });

    test('chooseLowestRetentionCard rotates CONDEMN_WILL when opponent hand is nearly empty', () => {
        const defs = {
            condemn: { id: 'condemn', type: 'CONDEMN_WILL' },
            guard: { id: 'guard', type: 'GUARD_WILL' },
            recover: { id: 'recover', type: 'DESTROY_ONE_STONE' }
        };
        const costs = { condemn: 6, guard: 2, recover: 14 };
        const selected = core.chooseLowestRetentionCard(
            ['condemn', 'guard', 'recover'],
            (id) => costs[id],
            (id) => defs[id],
            {
                level: 6,
                playerValue: -1,
                legalMovesCount: 4,
                handSize: 4,
                discDiff: 8,
                empties: 22,
                ownCorners: 1,
                oppCorners: 0,
                oppHandSize: 1,
                hasCornerMoveNow: false,
                cornerEmergency: false
            }
        );
        expect(selected).toBeTruthy();
        expect(selected.cardId).toBe('condemn');
    });

    test('chooseLowestRetentionCard rotates TEMPT_WILL when opponent has no special stones', () => {
        const defs = {
            tempt: { id: 'tempt', type: 'TEMPT_WILL' },
            guard: { id: 'guard', type: 'GUARD_WILL' },
            recover: { id: 'recover', type: 'DESTROY_ONE_STONE' }
        };
        const costs = { tempt: 6, guard: 2, recover: 14 };
        const selected = core.chooseLowestRetentionCard(
            ['tempt', 'guard', 'recover'],
            (id) => costs[id],
            (id) => defs[id],
            {
                level: 6,
                playerValue: -1,
                legalMovesCount: 4,
                handSize: 4,
                discDiff: 6,
                empties: 28,
                ownCorners: 1,
                oppCorners: 0,
                oppSpecialCount: 0,
                hasCornerMoveNow: false,
                cornerEmergency: false
            }
        );
        expect(selected).toBeTruthy();
        expect(selected.cardId).toBe('tempt');
    });

    test('chooseHandDestroyTargetForCycle rotates time bomb first when missing recovery role', () => {
        const defs = {
            bomb: { id: 'bomb', type: 'TIME_BOMB' },
            guard: { id: 'guard', type: 'GUARD_WILL' },
            silver: { id: 'silver', type: 'SILVER_STONE' },
            chain: { id: 'chain', type: 'DOUBLE_CHAIN_WILL' }
        };
        const costs = { bomb: 13, guard: 2, silver: 5, chain: 10 };
        const selected = core.chooseHandDestroyTargetForCycle(
            ['bomb', 'guard', 'silver', 'chain'],
            [],
            (id) => costs[id],
            (id) => defs[id],
            {
                level: 6,
                legalMovesCount: 4,
                discDiff: 2,
                empties: 36,
                ownCorners: 0,
                oppCorners: 1,
                hasCornerMoveNow: false,
                cornerEmergency: true
            }
        );
        expect(selected).toBeTruthy();
        expect(selected.cardId).toBe('bomb');
    });

    test('chooseHandDestroyTargetForCycle keeps recovery card during emergency hand-pressure cycle', () => {
        const defs = {
            recover: { id: 'recover', type: 'DESTROY_ONE_STONE' },
            chain: { id: 'chain', type: 'DOUBLE_CHAIN_WILL' },
            silver: { id: 'silver', type: 'SILVER_STONE' },
            bomb: { id: 'bomb', type: 'TIME_BOMB' },
            guard: { id: 'guard', type: 'GUARD_WILL' }
        };
        const costs = { recover: 14, chain: 10, silver: 5, bomb: 13, guard: 2 };
        const selected = core.chooseHandDestroyTargetForCycle(
            ['recover', 'chain', 'silver', 'bomb', 'guard'],
            [],
            (id) => costs[id],
            (id) => defs[id],
            {
                level: 6,
                legalMovesCount: 3,
                handSize: 5,
                discDiff: -8,
                empties: 20,
                ownCorners: 0,
                oppCorners: 2,
                hasCornerMoveNow: false,
                cornerEmergency: true
            }
        );
        expect(selected).toBeTruthy();
        expect(selected.cardId).not.toBe('recover');
    });

    test('chooseHandDestroyTargetForCycle rotates SUPER_BUOYANCY_WILL first in non-emergency no-anchor fast cycle', () => {
        const defs = {
            super: { id: 'super', type: 'SUPER_BUOYANCY_WILL' },
            guard: { id: 'guard', type: 'GUARD_WILL' },
            recover: { id: 'recover', type: 'DESTROY_ONE_STONE' },
            work: { id: 'work', type: 'WORK_WILL' }
        };
        const costs = { super: 14, guard: 2, recover: 14, work: 11 };
        const selected = core.chooseHandDestroyTargetForCycle(
            ['super', 'guard', 'recover', 'work'],
            [],
            (id) => costs[id],
            (id) => defs[id],
            {
                level: 6,
                playerValue: -1,
                legalMovesCount: 3,
                handSize: 4,
                discDiff: -4,
                empties: 30,
                ownCorners: 0,
                oppCorners: 0,
                ownEdges: 2,
                oppEdges: 3,
                hasCornerMoveNow: false,
                hasEdgeMoveNow: false,
                cornerEmergency: false
            }
        );
        expect(selected).toBeTruthy();
        expect(selected.cardId).toBe('super');
    });

    test('chooseHandDestroyTargetForCycle rotates CHAIN/DOUBLE first in white Lv6 stable lead', () => {
        const defs = {
            chain: { id: 'chain', type: 'DOUBLE_CHAIN_WILL' },
            double: { id: 'double', type: 'DOUBLE_PLACE' },
            guard: { id: 'guard', type: 'GUARD_WILL' },
            work: { id: 'work', type: 'WORK_WILL' }
        };
        const costs = { chain: 22, double: 24, guard: 2, work: 11 };
        const selected = core.chooseHandDestroyTargetForCycle(
            ['chain', 'double', 'guard', 'work'],
            [],
            (id) => costs[id],
            (id) => defs[id],
            {
                level: 6,
                playerValue: -1,
                legalMovesCount: 3,
                handSize: 4,
                discDiff: 10,
                empties: 20,
                ownCorners: 2,
                oppCorners: 0,
                hasCornerMoveNow: false,
                cornerEmergency: false
            }
        );
        expect(selected).toBeTruthy();
        expect(['chain', 'double']).toContain(selected.cardId);
    });

    test('chooseHandDestroyTargetForCycle keeps generated TRIPLE_PLACE in white Lv6 stable lead', () => {
        const defs = {
            triple: { id: 'triple', type: 'TRIPLE_PLACE' },
            heaven: { id: 'heaven', type: 'HEAVEN_BLESSING' },
            guard: { id: 'guard', type: 'GUARD_WILL' },
            work: { id: 'work', type: 'WORK_WILL' }
        };
        const costs = { triple: 24, heaven: 24, guard: 2, work: 11 };
        const selected = core.chooseHandDestroyTargetForCycle(
            ['triple', 'heaven', 'guard', 'work'],
            [],
            (id) => costs[id],
            (id) => defs[id],
            {
                level: 6,
                playerValue: -1,
                legalMovesCount: 4,
                handSize: 4,
                discDiff: 8,
                empties: 24,
                ownCorners: 2,
                oppCorners: 0,
                hasCornerMoveNow: false,
                cornerEmergency: false
            }
        );
        expect(selected).toBeTruthy();
        expect(selected.cardId).toBe('heaven');
    });

    test('chooseHandDestroyTargetForCycle rotates LAST_RESORT first when legal moves already exist', () => {
        const defs = {
            last: { id: 'last', type: 'LAST_RESORT' },
            guard: { id: 'guard', type: 'GUARD_WILL' },
            recover: { id: 'recover', type: 'DESTROY_ONE_STONE' },
            silver: { id: 'silver', type: 'SILVER_STONE' }
        };
        const costs = { last: 20, guard: 2, recover: 14, silver: 3 };
        const selected = core.chooseHandDestroyTargetForCycle(
            ['last', 'guard', 'recover', 'silver'],
            [],
            (id) => costs[id],
            (id) => defs[id],
            {
                level: 6,
                playerValue: -1,
                legalMovesCount: 4,
                handSize: 4,
                discDiff: 4,
                empties: 22,
                ownCorners: 1,
                oppCorners: 0,
                hasCornerMoveNow: false,
                cornerEmergency: false
            }
        );
        expect(selected).toBeTruthy();
        expect(selected.cardId).toBe('last');
    });

    test('chooseHandDestroyTargetForCycle rotates clone-style volatile cards in white Lv6 stable lead', () => {
        const defs = {
            clone: { id: 'clone', type: 'CLONE_WILL' },
            split: { id: 'split', type: 'SPLIT_WILL' },
            guard: { id: 'guard', type: 'GUARD_WILL' },
            work: { id: 'work', type: 'WORK_WILL' }
        };
        const costs = { clone: 14, split: 16, guard: 2, work: 11 };
        const selected = core.chooseHandDestroyTargetForCycle(
            ['clone', 'split', 'guard', 'work'],
            [],
            (id) => costs[id],
            (id) => defs[id],
            {
                level: 6,
                playerValue: -1,
                legalMovesCount: 4,
                handSize: 4,
                discDiff: 12,
                empties: 24,
                ownCorners: 2,
                oppCorners: 0,
                hasCornerMoveNow: false,
                cornerEmergency: false
            }
        );
        expect(selected).toBeTruthy();
        expect(['clone', 'split']).toContain(selected.cardId);
    });

    test('card type classifiers expose corner plan card groups', () => {
        expect(core.isCornerRecoveryCardType('DESTROY_ONE_STONE')).toBe(true);
        expect(core.isCornerRecoveryCardType('SUPER_BUOYANCY_WILL')).toBe(true);
        expect(core.isCornerHoldCardType('GUARD_WILL')).toBe(true);
        expect(core.isChargeRampCardType('TREASURE_BOX')).toBe(true);
        expect(core.isCornerRecoveryCardType('HEAVEN_BLESSING')).toBe(false);
    });

    test('CORNER_TRIBUTE keeps an explicit economy-cycle move plan profile', () => {
        expect(core.hasMovePlanProfileForCardType('CORNER_TRIBUTE')).toBe(true);
        expect(core.getMovePlanProfileForCardType('CORNER_TRIBUTE')).toEqual(expect.objectContaining({
            archetype: 'economyCycle',
            placementWeight: 0
        }));
    });

    test('EQUALITY_WILL keeps an explicit explosive-comeback profile without free-placement recovery classification', () => {
        expect(core.isCornerRecoveryCardType('EQUALITY_WILL')).toBe(false);
        expect(core.hasUsageStyleForCardType('EQUALITY_WILL')).toBe(true);
        expect(core.hasMovePlanProfileForCardType('EQUALITY_WILL')).toBe(true);
        expect(core.getMovePlanProfileForCardType('EQUALITY_WILL')).toEqual(expect.objectContaining({
            archetype: 'explosiveComeback',
            placementWeight: 0
        }));
    });

    test('REINFORCEMENT_WILL keeps an explicit recovery-reposition move plan profile', () => {
        expect(core.hasUsageStyleForCardType('REINFORCEMENT_WILL')).toBe(true);
        expect(core.hasMovePlanProfileForCardType('REINFORCEMENT_WILL')).toBe(true);
        expect(core.getMovePlanProfileForCardType('REINFORCEMENT_WILL')).toEqual(expect.objectContaining({
            archetype: 'recoveryReposition',
            placementWeight: 0
        }));
    });

    test('PROLIFERATION_WILL keeps an explicit spawn-mobile move plan profile', () => {
        expect(core.hasMovePlanProfileForCardType('PROLIFERATION_WILL')).toBe(true);
        expect(core.getMovePlanProfileForCardType('PROLIFERATION_WILL')).toEqual(expect.objectContaining({
            archetype: 'spawnMobile',
            placementWeight: 3,
            cornerBias: -1
        }));
    });

    test('all catalog card types have explicit usage style profile', () => {
        const types = Array.from(new Set((catalog.cards || []).map((c) => c && c.type).filter(Boolean)));
        const missing = types.filter((type) => !core.hasUsageStyleForCardType(type));
        expect(missing).toEqual([]);
    });

    test('all catalog card types have explicit base score bonus', () => {
        const types = Array.from(new Set((catalog.cards || []).map((c) => c && c.type).filter(Boolean)));
        const missing = types.filter((type) => !core.hasBaseScoreBonusForCardType(type));
        expect(missing).toEqual([]);
    });

    test('all catalog card types have explicit move plan profile', () => {
        const types = Array.from(new Set((catalog.cards || []).map((c) => c && c.type).filter(Boolean)));
        const missing = types.filter((type) => !core.hasMovePlanProfileForCardType(type));
        expect(missing).toEqual([]);
    });

    test('scoreCardUseDecision remains finite across all catalog card types', () => {
        const types = Array.from(new Set((catalog.cards || []).map((c) => c && c.type).filter(Boolean)));
        for (const type of types) {
            const out = core.scoreCardUseDecision(
                `id_${type}`,
                () => 8,
                () => ({ id: `id_${type}`, type }),
                {
                    level: 6,
                    legalMovesCount: 4,
                    discDiff: 0,
                    empties: 28,
                    ownCharge: 18,
                    handSize: 3,
                    ownCorners: 1,
                    oppCorners: 1,
                    ownEdges: 4,
                    oppEdges: 4,
                    hasCornerMoveNow: false,
                    hasEdgeMoveNow: true,
                    cornerEmergency: false
                }
            );
            expect(Number.isFinite(out.score)).toBe(true);
            expect(typeof out.shouldUse).toBe('boolean');
        }
    });

    test('scoreCardUseDecision suppresses SUPER_BUOYANCY_WILL while safely ahead', () => {
        const out = core.scoreCardUseDecision(
            'super_buoyancy_01',
            () => 14,
            () => ({ id: 'super_buoyancy_01', type: 'SUPER_BUOYANCY_WILL' }),
            {
                level: 6,
                legalMovesCount: 3,
                discDiff: 12,
                empties: 16,
                ownCorners: 2,
                oppCorners: 0,
                ownEdges: 8,
                oppEdges: 2,
                hasCornerMoveNow: true,
                ownCharge: 32
            }
        );
        expect(out.shouldUse).toBe(false);
    });

    test('scoreCardUseDecision allows SUPER_BUOYANCY_WILL during trailing corner emergency', () => {
        const out = core.scoreCardUseDecision(
            'super_buoyancy_01',
            () => 14,
            () => ({ id: 'super_buoyancy_01', type: 'SUPER_BUOYANCY_WILL' }),
            {
                level: 6,
                legalMovesCount: 1,
                discDiff: -14,
                empties: 24,
                ownCorners: 0,
                oppCorners: 2,
                ownEdges: 2,
                oppEdges: 9,
                hasCornerMoveNow: false,
                hasEdgeMoveNow: true,
                cornerEmergency: true,
                ownCharge: 28
            }
        );
        expect(out.shouldUse).toBe(true);
    });

    test('scoreCardUseDecision suppresses SUPER_BUOYANCY_WILL in opening edge race without corner emergency', () => {
        const out = core.scoreCardUseDecision(
            'super_buoyancy_01',
            () => 14,
            () => ({ id: 'super_buoyancy_01', type: 'SUPER_BUOYANCY_WILL' }),
            {
                level: 6,
                playerValue: -1,
                legalMovesCount: 2,
                discDiff: -12,
                empties: 48,
                ownCharge: 8,
                handSize: 3,
                ownCorners: 0,
                oppCorners: 0,
                ownEdges: 3,
                oppEdges: 4,
                ownDiscs: 10,
                hasCornerMoveNow: false,
                hasEdgeMoveNow: true,
                cornerEmergency: false,
                maxLegalFlips: 2,
                maxLegalGain: 2,
                avgLegalFlips: 1.5
            }
        );
        expect(out.shouldUse).toBe(false);
    });

    test('scoreCardUseDecision suppresses gold and rainbow economy cards below 3 flips', () => {
        const lowGold = core.scoreCardUseDecision(
            'gold_01',
            () => 8,
            () => ({ id: 'gold_01', type: 'GOLD_STONE' }),
            {
                level: 6,
                legalMovesCount: 4,
                discDiff: 0,
                empties: 28,
                ownCharge: 20,
                handSize: 3,
                ownCorners: 1,
                oppCorners: 1,
                maxLegalFlips: 2,
                maxLegalGain: 2
            }
        );
        const lowRainbow = core.scoreCardUseDecision(
            'rainbow_01',
            () => 10,
            () => ({ id: 'rainbow_01', type: 'RAINBOW_STONE' }),
            {
                level: 6,
                legalMovesCount: 4,
                discDiff: 0,
                empties: 28,
                ownCharge: 20,
                handSize: 3,
                ownCorners: 1,
                oppCorners: 1,
                maxLegalFlips: 2,
                maxLegalGain: 2
            }
        );
        expect(lowGold.shouldUse).toBe(false);
        expect(lowRainbow.shouldUse).toBe(false);
    });

    test('scoreCardUseDecision allows gold silver rainbow and plunder at 3+ flips', () => {
        const defs = {
            gold: { id: 'gold', type: 'GOLD_STONE' },
            silver: { id: 'silver', type: 'SILVER_STONE' },
            rainbow: { id: 'rainbow', type: 'RAINBOW_STONE' },
            plunder: { id: 'plunder', type: 'PLUNDER_WILL' }
        };
        const common = {
            level: 6,
            legalMovesCount: 2,
            discDiff: -4,
            empties: 24,
            ownCharge: 24,
            handSize: 4,
            ownCorners: 0,
            oppCorners: 1,
            maxLegalFlips: 3,
            maxLegalGain: 3,
            oppCharge: 12
        };
        const gold = core.scoreCardUseDecision('gold', () => 8, (id) => defs[id], common);
        const silver = core.scoreCardUseDecision('silver', () => 6, (id) => defs[id], common);
        const rainbow = core.scoreCardUseDecision('rainbow', () => 10, (id) => defs[id], common);
        const plunder = core.scoreCardUseDecision('plunder', () => 7, (id) => defs[id], common);
        expect(gold.shouldUse).toBe(true);
        expect(silver.shouldUse).toBe(true);
        expect(rainbow.shouldUse).toBe(true);
        expect(plunder.shouldUse).toBe(true);
    });

    test('scoreCardUseDecision suppresses CLONE_WILL when setup budget is tight and gain is small', () => {
        const out = core.scoreCardUseDecision(
            'clone',
            () => 14,
            () => ({ id: 'clone', type: 'CLONE_WILL' }),
            {
                level: 6,
                playerValue: -1,
                legalMovesCount: 4,
                discDiff: 0,
                empties: 26,
                ownCharge: 22,
                handSize: 2,
                ownCorners: 1,
                oppCorners: 1,
                ownEdges: 2,
                oppEdges: 2,
                hasCornerMoveNow: false,
                hasEdgeMoveNow: false,
                cornerEmergency: false,
                reserveChargeFloor: 8,
                maxLegalFlips: 2,
                maxLegalGain: 2
            }
        );
        expect(out.shouldUse).toBe(false);
    });

    test('scoreCardUseDecision keeps CLONE_WILL available when hand pressure and charge margin are high', () => {
        const out = core.scoreCardUseDecision(
            'clone',
            () => 14,
            () => ({ id: 'clone', type: 'CLONE_WILL' }),
            {
                level: 6,
                playerValue: -1,
                legalMovesCount: 3,
                discDiff: -4,
                empties: 28,
                ownCharge: 32,
                handSize: 5,
                ownCorners: 1,
                oppCorners: 1,
                ownEdges: 2,
                oppEdges: 2,
                hasCornerMoveNow: false,
                hasEdgeMoveNow: true,
                cornerEmergency: false,
                reserveChargeFloor: 8,
                maxLegalFlips: 3,
                maxLegalGain: 4,
                avgLegalFlips: 2.6
            }
        );
        expect(out.shouldUse).toBe(true);
    });

    test('scoreCardUseDecision suppresses CLONE_WILL when only normal stones are available', () => {
        const out = core.scoreCardUseDecision(
            'clone',
            () => 14,
            () => ({ id: 'clone', type: 'CLONE_WILL' }),
            {
                level: 6,
                playerValue: -1,
                legalMovesCount: 3,
                discDiff: -2,
                empties: 28,
                ownCharge: 32,
                handSize: 4,
                ownCorners: 1,
                oppCorners: 1,
                ownEdges: 2,
                oppEdges: 2,
                hasCornerMoveNow: false,
                hasEdgeMoveNow: true,
                cornerEmergency: false,
                cloneSplitEligibleSourceCount: 0,
                maxLegalFlips: 3,
                maxLegalGain: 4,
                avgLegalFlips: 2.6
            }
        );
        expect(out.shouldUse).toBe(false);
        expect(out.score).toBeLessThan(out.minUseScore);
    });

    test('scoreCardUseDecision suppresses SPLIT_WILL when setup budget is tight and gain is small', () => {
        const out = core.scoreCardUseDecision(
            'split',
            () => 16,
            () => ({ id: 'split', type: 'SPLIT_WILL' }),
            {
                level: 6,
                playerValue: -1,
                legalMovesCount: 4,
                discDiff: 2,
                empties: 24,
                ownCharge: 24,
                handSize: 2,
                ownCorners: 1,
                oppCorners: 1,
                ownEdges: 2,
                oppEdges: 2,
                hasCornerMoveNow: false,
                hasEdgeMoveNow: false,
                cornerEmergency: false,
                reserveChargeFloor: 8,
                maxLegalFlips: 2,
                maxLegalGain: 2
            }
        );
        expect(out.shouldUse).toBe(false);
    });

    test('scoreCardUseDecision suppresses SPLIT_WILL when only normal stones are available', () => {
        const out = core.scoreCardUseDecision(
            'split',
            () => 16,
            () => ({ id: 'split', type: 'SPLIT_WILL' }),
            {
                level: 6,
                playerValue: -1,
                legalMovesCount: 3,
                discDiff: -2,
                empties: 24,
                ownCharge: 34,
                handSize: 4,
                ownCorners: 1,
                oppCorners: 1,
                ownEdges: 2,
                oppEdges: 2,
                hasCornerMoveNow: false,
                hasEdgeMoveNow: true,
                cornerEmergency: false,
                cloneSplitEligibleSourceCount: 0,
                maxLegalFlips: 3,
                maxLegalGain: 4,
                avgLegalFlips: 2.6
            }
        );
        expect(out.shouldUse).toBe(false);
        expect(out.score).toBeLessThan(out.minUseScore);
    });

    test('scoreCardUseDecision uses LIGHTNING_WILL only when stable anchor exists', () => {
        const anchored = core.scoreCardUseDecision(
            'lightning_anchored',
            () => 26,
            () => ({ id: 'lightning_anchored', type: 'LIGHTNING_WILL' }),
            {
                level: 6,
                legalMovesCount: 4,
                discDiff: 2,
                empties: 32,
                ownCharge: 40,
                ownCorners: 1,
                oppCorners: 1,
                hasCornerMoveNow: true,
                hasEdgeMoveNow: true,
                cornerEmergency: false
            }
        );
        const unanchored = core.scoreCardUseDecision(
            'lightning_unanchored',
            () => 26,
            () => ({ id: 'lightning_unanchored', type: 'LIGHTNING_WILL' }),
            {
                level: 6,
                legalMovesCount: 4,
                discDiff: 2,
                empties: 32,
                ownCharge: 40,
                ownCorners: 1,
                oppCorners: 1,
                hasCornerMoveNow: false,
                hasEdgeMoveNow: false,
                cornerEmergency: false
            }
        );

        expect(anchored.score).toBeGreaterThan(unanchored.score);
        expect(unanchored.shouldUse).toBe(false);
    });

    test('scoreCardUseDecision limits TABOO_REVERSE_WILL to comeback situations', () => {
        const trailingEmergency = core.scoreCardUseDecision(
            'taboo_emergency',
            () => 44,
            () => ({ id: 'taboo_emergency', type: 'TABOO_REVERSE_WILL' }),
            {
                level: 6,
                legalMovesCount: 1,
                discDiff: -14,
                empties: 26,
                ownCharge: 60,
                ownCorners: 0,
                oppCorners: 2,
                hasCornerMoveNow: true,
                hasEdgeMoveNow: true,
                cornerEmergency: true
            }
        );
        const stableLead = core.scoreCardUseDecision(
            'taboo_stable',
            () => 44,
            () => ({ id: 'taboo_stable', type: 'TABOO_REVERSE_WILL' }),
            {
                level: 6,
                legalMovesCount: 4,
                discDiff: 10,
                empties: 20,
                ownCharge: 60,
                ownCorners: 2,
                oppCorners: 0,
                hasCornerMoveNow: false,
                hasEdgeMoveNow: true,
                cornerEmergency: false
            }
        );

        expect(trailingEmergency.score).toBeGreaterThan(stableLead.score);
        expect(stableLead.shouldUse).toBe(false);
    });

    test('scoreCardUseDecision promotes STRONG_WIND_WILL in trailing edge emergency and suppresses it in stable corner window', () => {
        const pressured = core.scoreCardUseDecision(
            'wind_pressured',
            () => 8,
            () => ({ id: 'wind_pressured', type: 'STRONG_WIND_WILL' }),
            {
                level: 6,
                legalMovesCount: 2,
                discDiff: -10,
                empties: 24,
                ownCharge: 30,
                handSize: 4,
                ownCorners: 0,
                oppCorners: 2,
                ownEdges: 2,
                oppEdges: 8,
                hasCornerMoveNow: false,
                hasEdgeMoveNow: true,
                cornerEmergency: true,
                maxLegalFlips: 4
            }
        );
        const stable = core.scoreCardUseDecision(
            'wind_stable',
            () => 8,
            () => ({ id: 'wind_stable', type: 'STRONG_WIND_WILL' }),
            {
                level: 6,
                legalMovesCount: 4,
                discDiff: 8,
                empties: 18,
                ownCharge: 30,
                handSize: 2,
                ownCorners: 2,
                oppCorners: 0,
                ownEdges: 8,
                oppEdges: 2,
                hasCornerMoveNow: true,
                hasEdgeMoveNow: true,
                cornerEmergency: false,
                maxLegalFlips: 3
            }
        );

        expect(pressured.score).toBeGreaterThan(stable.score);
        expect(stable.shouldUse).toBe(false);
    });

    test('scoreCardUseDecision uses STRONG_WIND_WILL in low-mobility edge deficit even without corner emergency', () => {
        const out = core.scoreCardUseDecision(
            'wind_edge_deficit',
            () => 8,
            () => ({ id: 'wind_edge_deficit', type: 'STRONG_WIND_WILL' }),
            {
                level: 6,
                playerValue: -1,
                legalMovesCount: 1,
                discDiff: -4,
                empties: 32,
                ownCharge: 18,
                handSize: 3,
                ownCorners: 1,
                oppCorners: 1,
                ownEdges: 4,
                oppEdges: 5,
                ownDiscs: 10,
                hasCornerMoveNow: false,
                hasEdgeMoveNow: true,
                cornerEmergency: false,
                maxLegalFlips: 3,
                maxLegalGain: 3,
                avgLegalFlips: 2.2
            }
        );
        expect(out.shouldUse).toBe(true);
    });

    test('scoreCardUseDecision uses BREEDING_WILL earlier and suppresses it late while ahead', () => {
        const opening = core.scoreCardUseDecision(
            'breeding_opening',
            () => 18,
            () => ({ id: 'breeding_opening', type: 'BREEDING_WILL' }),
            {
                level: 6,
                legalMovesCount: 3,
                discDiff: -2,
                empties: 40,
                ownCharge: 24,
                handSize: 3,
                ownCorners: 0,
                oppCorners: 1,
                ownEdges: 3,
                oppEdges: 5,
                hasCornerMoveNow: true,
                hasEdgeMoveNow: true,
                cornerEmergency: false
            }
        );
        const lateAhead = core.scoreCardUseDecision(
            'breeding_late',
            () => 18,
            () => ({ id: 'breeding_late', type: 'BREEDING_WILL' }),
            {
                level: 6,
                legalMovesCount: 4,
                discDiff: 8,
                empties: 10,
                ownCharge: 24,
                handSize: 3,
                ownCorners: 2,
                oppCorners: 0,
                ownEdges: 7,
                oppEdges: 3,
                hasCornerMoveNow: false,
                hasEdgeMoveNow: false,
                cornerEmergency: false
            }
        );

        expect(opening.score).toBeGreaterThan(lateAhead.score);
        expect(lateAhead.shouldUse).toBe(false);
    });

    test('chooseLowestRetentionCard rotates taboo card first when white Lv6 is ahead', () => {
        const defs = {
            taboo: { id: 'taboo', type: 'TABOO_REVERSE_WILL' },
            guard: { id: 'guard', type: 'GUARD_WILL' },
            recover: { id: 'recover', type: 'DESTROY_ONE_STONE' }
        };
        const costs = { taboo: 44, guard: 2, recover: 14 };
        const selected = core.chooseLowestRetentionCard(
            ['taboo', 'guard', 'recover'],
            (id) => costs[id],
            (id) => defs[id] || null,
            {
                level: 6,
                playerValue: -1,
                legalMovesCount: 4,
                handSize: 4,
                discDiff: 10,
                empties: 20,
                ownCorners: 2,
                oppCorners: 0,
                hasCornerMoveNow: false,
                hasEdgeMoveNow: true,
                cornerEmergency: false,
                ownCharge: 46
            }
        );
        expect(selected).toBeTruthy();
        expect(selected.cardId).toBe('taboo');
    });

    test('chooseLowestRetentionCard rotates meteor before stable guard while ahead', () => {
        const defs = {
            meteor: { id: 'meteor', type: 'METEOR_WILL' },
            guard: { id: 'guard', type: 'GUARD_WILL' },
            treasure: { id: 'treasure', type: 'TREASURE_BOX' }
        };
        const costs = { meteor: 21, guard: 2, treasure: 0 };
        const selected = core.chooseLowestRetentionCard(
            ['meteor', 'guard', 'treasure'],
            (id) => costs[id],
            (id) => defs[id],
            {
                level: 6,
                playerValue: -1,
                legalMovesCount: 4,
                handSize: 5,
                discDiff: 8,
                empties: 18,
                ownCorners: 2,
                oppCorners: 0,
                hasCornerMoveNow: true,
                hasEdgeMoveNow: true,
                cornerEmergency: false,
                ownCharge: 32
            }
        );
        expect(selected).toBeTruthy();
        expect(selected.cardId).toBe('meteor');
    });

    test('scoreMoveForCornerEdgePlan strongly penalizes unsafe x-square', () => {
        const board = Array.from({ length: 8 }, () => Array(8).fill(0));
        board[3][3] = -1;
        board[3][4] = 1;
        board[4][3] = 1;
        board[4][4] = -1;
        const xMove = { row: 1, col: 1, flips: [] };
        const innerMove = { row: 2, col: 3, flips: [{ row: 3, col: 3 }] };
        const xScore = core.scoreMoveForCornerEdgePlan(xMove, {
            level: 6,
            board,
            playerValue: -1
        });
        const innerScore = core.scoreMoveForCornerEdgePlan(innerMove, {
            level: 6,
            board,
            playerValue: -1
        });
        expect(innerScore).toBeGreaterThan(xScore);
    });

    test('scoreMoveForCornerEdgePlan rewards board bonus tiles', () => {
        const board = Array.from({ length: 8 }, () => Array(8).fill(0));
        board[0][0] = -1;
        board[0][7] = -1;
        board[7][0] = 1;
        board[7][7] = 1;
        const move = { row: 3, col: 2, flips: [{ row: 3, col: 3 }] };
        const baseScore = core.scoreMoveForCornerEdgePlan(move, {
            level: 6,
            board,
            playerValue: -1
        });
        const bonusScore = core.scoreMoveForCornerEdgePlan(move, {
            level: 6,
            board,
            playerValue: -1,
            boardBonusByCell: { '3,2': 5 },
            boardBonusConsumedByCell: {}
        });
        expect(bonusScore).toBeGreaterThan(baseScore);
    });

    test('scoreMoveForCornerEdgePlan heavily penalizes moves that donate corner without reply in Lv6', () => {
        const board = Array.from({ length: 8 }, () => Array(8).fill(0));
        board[0][2] = 1;
        board[2][0] = 1;
        board[3][3] = 1;
        board[3][4] = -1;
        board[4][3] = -1;
        board[4][4] = 1;

        const riskyMove = {
            row: 1,
            col: 1,
            flips: [{ row: 0, col: 1 }, { row: 1, col: 0 }]
        };
        const saferMove = {
            row: 3,
            col: 2,
            flips: [{ row: 3, col: 3 }]
        };

        const riskyScore = core.scoreMoveForCornerEdgePlan(riskyMove, {
            level: 6,
            board,
            playerValue: -1
        });
        const saferScore = core.scoreMoveForCornerEdgePlan(saferMove, {
            level: 6,
            board,
            playerValue: -1
        });

        expect(saferScore).toBeGreaterThan(riskyScore);
    });

    test('scoreMoveForCornerEdgePlan penalizes pseudo-corner C-square after METEOR_HOLE reshapes the board', () => {
        const board = Array.from({ length: 8 }, () => Array(8).fill(0));
        board[1][2] = 1;
        board[3][3] = 1;
        board[3][4] = -1;
        board[4][3] = -1;
        board[4][4] = 1;
        const shapedBoard = SharedBoardUtils.attachBoardShape(board, {
            cardState: {
                markers: [
                    { kind: 'specialStone', row: 0, col: 0, owner: 'black', data: { type: 'METEOR_HOLE' } }
                ]
            }
        });

        const riskyMove = { row: 0, col: 2, flips: [{ row: 1, col: 2 }] };
        const saferMove = { row: 2, col: 3, flips: [{ row: 3, col: 3 }] };

        const riskyScore = core.scoreMoveForCornerEdgePlan(riskyMove, {
            level: 6,
            board: shapedBoard,
            playerValue: -1
        });
        const saferScore = core.scoreMoveForCornerEdgePlan(saferMove, {
            level: 6,
            board: shapedBoard,
            playerValue: -1
        });

        expect(saferScore).toBeGreaterThan(riskyScore);
    });

    test('scoreMoveForCornerEdgePlan rewards pseudo-corner X once own corner and both C-squares are secured', () => {
        const board = Array.from({ length: 8 }, () => Array(8).fill(0));
        board[0][0] = -1;
        board[0][1] = -1;
        board[1][0] = -1;
        board[1][2] = 1;
        board[1][3] = -1;
        board[3][3] = 1;
        board[3][4] = -1;
        board[4][3] = -1;
        board[4][4] = 1;

        const pseudoCornerXMove = { row: 1, col: 1, flips: [{ row: 1, col: 2 }] };
        const innerMove = { row: 2, col: 3, flips: [{ row: 3, col: 3 }] };

        const pseudoCornerScore = core.scoreMoveForCornerEdgePlan(pseudoCornerXMove, {
            level: 6,
            board,
            playerValue: -1
        });
        const innerScore = core.scoreMoveForCornerEdgePlan(innerMove, {
            level: 6,
            board,
            playerValue: -1
        });

        expect(pseudoCornerScore).toBeGreaterThan(innerScore);
    });

    test('scoreMoveForCornerEdgePlan amplifies safe-edge preference in low-disc survival mode', () => {
        const board = Array.from({ length: 8 }, () => Array(8).fill(0));
        board[0][0] = -1;
        board[0][7] = 1;
        board[7][0] = 1;
        board[7][7] = -1;
        board[3][3] = -1;
        board[3][4] = 1;
        board[4][3] = 1;
        board[4][4] = -1;

        const edgeMove = { row: 0, col: 4, flips: [{ row: 1, col: 4 }] };
        const innerMove = { row: 2, col: 3, flips: [{ row: 3, col: 3 }] };

        const normalEdge = core.scoreMoveForCornerEdgePlan(edgeMove, {
            level: 6,
            board,
            playerValue: -1,
            ownDiscs: 10
        });
        const normalInner = core.scoreMoveForCornerEdgePlan(innerMove, {
            level: 6,
            board,
            playerValue: -1,
            ownDiscs: 10
        });
        const survivalEdge = core.scoreMoveForCornerEdgePlan(edgeMove, {
            level: 6,
            board,
            playerValue: -1,
            ownDiscs: 4
        });
        const survivalInner = core.scoreMoveForCornerEdgePlan(innerMove, {
            level: 6,
            board,
            playerValue: -1,
            ownDiscs: 4
        });

        expect((survivalEdge - normalEdge)).toBeGreaterThan(survivalInner - normalInner);
        expect((survivalEdge - survivalInner)).toBeGreaterThan(normalEdge - normalInner);
    });

    test('scoreMoveForCornerEdgePlan prefers reclaiming opponent edge control over flashy inner bonus before corner lead', () => {
        const board = Array.from({ length: 8 }, () => Array(8).fill(0));
        board[0][3] = 1;
        board[0][4] = 1;
        board[3][3] = 1;
        board[3][4] = -1;
        board[4][3] = -1;
        board[4][4] = 1;

        const recoveryMove = {
            row: 1,
            col: 3,
            flips: [{ row: 0, col: 3 }, { row: 0, col: 4 }]
        };
        const bonusInnerMove = {
            row: 2,
            col: 3,
            flips: [{ row: 3, col: 3 }]
        };

        const recoveryScore = core.scoreMoveForCornerEdgePlan(recoveryMove, {
            level: 6,
            board,
            playerValue: -1,
            ownDiscs: 12,
            boardBonusByCell: { '2,3': 6 },
            boardBonusConsumedByCell: {}
        });
        const bonusInnerScore = core.scoreMoveForCornerEdgePlan(bonusInnerMove, {
            level: 6,
            board,
            playerValue: -1,
            ownDiscs: 12,
            boardBonusByCell: { '2,3': 6 },
            boardBonusConsumedByCell: {}
        });

        expect(recoveryScore).toBeGreaterThan(bonusInnerScore);
    });

    test('scoreCardUseDecision lowers non-counter utility under strong enemy threat while recovery gap remains', () => {
        const lowThreat = core.scoreCardUseDecision(
            'supply_01',
            () => 0,
            () => ({ id: 'supply_01', type: 'SUPPLY_WILL' }),
            {
                level: 6,
                playerValue: -1,
                legalMovesCount: 4,
                hasCornerMoveNow: false,
                cornerEmergency: false,
                ownCharge: 14,
                oppCharge: 8,
                reserveChargeFloor: 8,
                recoveryCostGap: 4,
                handSize: 2,
                ownDiscs: 10,
                oppDiscs: 10,
                empties: 28,
                discDiff: 0,
                ownCorners: 0,
                oppCorners: 0,
                ownEdges: 2,
                oppEdges: 2,
                ownSpecialCount: 1,
                oppSpecialCount: 1
            }
        );
        const highThreat = core.scoreCardUseDecision(
            'supply_01',
            () => 0,
            () => ({ id: 'supply_01', type: 'SUPPLY_WILL' }),
            {
                level: 6,
                playerValue: -1,
                legalMovesCount: 4,
                hasCornerMoveNow: false,
                cornerEmergency: false,
                ownCharge: 14,
                oppCharge: 24,
                reserveChargeFloor: 8,
                recoveryCostGap: 4,
                handSize: 2,
                ownDiscs: 10,
                oppDiscs: 10,
                empties: 28,
                discDiff: 0,
                ownCorners: 0,
                oppCorners: 0,
                ownEdges: 2,
                oppEdges: 2,
                ownSpecialCount: 1,
                oppSpecialCount: 4
            }
        );

        expect(highThreat.score).toBeLessThan(lowThreat.score);
    });
});
