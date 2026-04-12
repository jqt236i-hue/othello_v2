const mod = require('../game/cpu-turn-handler');
const cpuDecision = require('../game/cpu-decision');

function makeBoard() {
    const board = Array.from({ length: 8 }, () => Array(8).fill(0));
    board[3][3] = -1;
    board[3][4] = 1;
    board[4][3] = 1;
    board[4][4] = -1;
    return board;
}

describe('cpu-turn-handler onnx hold behavior', () => {
    beforeEach(() => {
        mod.resetCpuTurnHandlerState();
        mod.setTimers(null);
        delete global.CPU_LV6_SHARED_PROFILE;
        global.__BENCH_FAST_MODE = true;
        global.ANIMATION_RETRY_DELAY_MS = 0;
        global.BLACK = 1;
        global.WHITE = -1;
        global.cpuSmartness = { white: 6, black: 1 };
        global.isCardAnimating = false;
        global.isProcessing = false;
        global.isDebugLogAvailable = () => false;
        global.emitLogAdded = jest.fn();
        global.executeMove = jest.fn();
        global.playHandAnimation = jest.fn((playerValue, row, col, cb) => {
            if (typeof cb === 'function') cb();
        });
        global.applyCardChoice = jest.fn(() => false);
        global.CardLogic = {
            getUsableCardIds: () => ['card_a'],
            hasUsableCard: () => true,
            getCardDef: (id) => ({ id })
        };
        global.selectCardFromOnnxPolicyAsync = jest.fn(async () => ({ hold: true }));
        global.cpuMaybeUseCardWithPolicy = jest.fn(() => false);
    });

    afterEach(() => {
        mod.resetCpuTurnHandlerState();
        mod.setTimers(null);
        delete global.__BENCH_FAST_MODE;
        delete global.ANIMATION_RETRY_DELAY_MS;
    });

    test('respects ONNX hold in stable state', async () => {
        global.cardState = {
            hands: { white: ['card_a', 'card_b', 'card_c', 'card_d', 'card_e'], black: [] },
            charge: { white: 10, black: 10 },
            pendingEffectByPlayer: { white: null, black: null },
            hasUsedCardThisTurnByPlayer: { white: false, black: false },
            hasDestroyedCardThisTurnByPlayer: { white: false, black: false }
        };
        global.gameState = { board: makeBoard(), currentPlayer: 'white', turnNumber: 10 };
        global.generateMovesForPlayer = jest.fn(() => [
            { row: 2, col: 3, flips: [{ row: 3, col: 3 }] },
            { row: 2, col: 4, flips: [{ row: 3, col: 4 }] },
            { row: 5, col: 3, flips: [{ row: 4, col: 3 }] },
            { row: 5, col: 4, flips: [{ row: 4, col: 4 }] }
        ]);

        await mod.runCpuTurn('white');

        expect(global.selectCardFromOnnxPolicyAsync).toHaveBeenCalled();
        expect(global.cpuMaybeUseCardWithPolicy).not.toHaveBeenCalled();
    });

    test('overrides ONNX hold in emergency state for Lv6', async () => {
        const emergencyBoard = Array.from({ length: 8 }, () => Array(8).fill(1));
        emergencyBoard[0][0] = -1;
        emergencyBoard[0][1] = -1;
        emergencyBoard[0][2] = -1;
        emergencyBoard[0][3] = -1;
        emergencyBoard[1][0] = 0;
        emergencyBoard[1][1] = 0;

        global.cardState = {
            hands: { white: ['a', 'b', 'c', 'd', 'e', 'f'], black: [] },
            charge: { white: 40, black: 8 },
            pendingEffectByPlayer: { white: null, black: null },
            hasUsedCardThisTurnByPlayer: { white: false, black: false },
            hasDestroyedCardThisTurnByPlayer: { white: false, black: false }
        };
        global.gameState = { board: emergencyBoard, currentPlayer: 'white', turnNumber: 52 };
        global.generateMovesForPlayer = jest.fn(() => [
            { row: 1, col: 0, flips: [{ row: 0, col: 0 }] }
        ]);

        await mod.runCpuTurn('white');

        expect(global.selectCardFromOnnxPolicyAsync).toHaveBeenCalled();
        expect(global.cpuMaybeUseCardWithPolicy).toHaveBeenCalledWith('white');
    });

    test('overrides ONNX hold when hand is at cap and charge is high (Lv6)', async () => {
        global.cardState = {
            hands: { white: ['a', 'b', 'c', 'd', 'e'], black: [] },
            charge: { white: 30, black: 8 },
            pendingEffectByPlayer: { white: null, black: null },
            hasUsedCardThisTurnByPlayer: { white: false, black: false },
            hasDestroyedCardThisTurnByPlayer: { white: false, black: false }
        };
        global.gameState = { board: makeBoard(), currentPlayer: 'white', turnNumber: 28 };
        global.generateMovesForPlayer = jest.fn(() => [
            { row: 2, col: 3, flips: [{ row: 3, col: 3 }] },
            { row: 2, col: 4, flips: [{ row: 3, col: 4 }] },
            { row: 5, col: 3, flips: [{ row: 4, col: 3 }] }
        ]);

        await mod.runCpuTurn('white');

        expect(global.selectCardFromOnnxPolicyAsync).toHaveBeenCalled();
        expect(global.cpuMaybeUseCardWithPolicy).toHaveBeenCalledWith('white');
    });

    test('overrides ONNX hold when mobility is low and charge is available (Lv6)', async () => {
        global.cardState = {
            hands: { white: ['a', 'b', 'c', 'd'], black: [] },
            charge: { white: 14, black: 8 },
            pendingEffectByPlayer: { white: null, black: null },
            hasUsedCardThisTurnByPlayer: { white: false, black: false },
            hasDestroyedCardThisTurnByPlayer: { white: false, black: false }
        };
        global.gameState = { board: makeBoard(), currentPlayer: 'white', turnNumber: 26 };
        global.generateMovesForPlayer = jest.fn(() => [
            { row: 2, col: 3, flips: [{ row: 3, col: 3 }] },
            { row: 5, col: 4, flips: [{ row: 4, col: 4 }] }
        ]);

        await mod.runCpuTurn('white');

        expect(global.selectCardFromOnnxPolicyAsync).toHaveBeenCalled();
        expect(global.cpuMaybeUseCardWithPolicy).toHaveBeenCalledWith('white');
    });

    test('overrides ONNX hold when hand is loaded and state is only slightly behind (Lv6)', async () => {
        const board = makeBoard();
        board[0][0] = 1;
        board[0][1] = -1;
        board[1][0] = 1;
        global.cardState = {
            hands: { white: ['a', 'b', 'c'], black: [] },
            charge: { white: 12, black: 8 },
            pendingEffectByPlayer: { white: null, black: null },
            hasUsedCardThisTurnByPlayer: { white: false, black: false },
            hasDestroyedCardThisTurnByPlayer: { white: false, black: false }
        };
        global.gameState = { board, currentPlayer: 'white', turnNumber: 30 };
        global.generateMovesForPlayer = jest.fn(() => [
            { row: 2, col: 3, flips: [{ row: 3, col: 3 }] },
            { row: 5, col: 4, flips: [{ row: 4, col: 4 }] },
            { row: 4, col: 5, flips: [{ row: 4, col: 4 }] }
        ]);

        await mod.runCpuTurn('white');

        expect(global.selectCardFromOnnxPolicyAsync).toHaveBeenCalled();
        expect(global.cpuMaybeUseCardWithPolicy).toHaveBeenCalledWith('white');
    });

    test('skips ONNX card path when shared profile requests policy-table/core parity', async () => {
        global.CPU_LV6_SHARED_PROFILE = {
            browser: {
                cardDecisionMode: 'policy-table-core'
            }
        };
        global.cardState = {
            hands: { white: ['a', 'b', 'c'], black: [] },
            charge: { white: 12, black: 8 },
            pendingEffectByPlayer: { white: null, black: null },
            hasUsedCardThisTurnByPlayer: { white: false, black: false },
            hasDestroyedCardThisTurnByPlayer: { white: false, black: false }
        };
        global.gameState = { board: makeBoard(), currentPlayer: 'white', turnNumber: 30 };
        global.generateMovesForPlayer = jest.fn(() => [
            { row: 2, col: 3, flips: [{ row: 3, col: 3 }] },
            { row: 5, col: 4, flips: [{ row: 4, col: 4 }] }
        ]);
        global.cpuMaybeUseCardWithPolicy = jest.fn(() => true);

        await mod.runCpuTurn('white');

        expect(global.selectCardFromOnnxPolicyAsync).not.toHaveBeenCalled();
        expect(global.cpuMaybeUseCardWithPolicy).toHaveBeenCalledWith('white');
    });

    test('skips ONNX move path when shared profile requests policy-table/lookahead parity', async () => {
        global.CPU_LV6_SHARED_PROFILE = {
            browser: {
                moveDecisionMode: 'policy-table-lookahead',
                cardDecisionMode: 'policy-table-core'
            }
        };
        global.selectMoveFromOnnxPolicyAsync = jest.fn(async () => ({ row: 2, col: 3, flips: [{ row: 3, col: 3 }] }));
        global.selectCpuMoveWithPolicy = jest.fn(() => ({ row: 5, col: 4, flips: [{ row: 4, col: 4 }] }));
        global.cardState = {
            hands: { white: ['a', 'b', 'c'], black: [] },
            charge: { white: 12, black: 8 },
            pendingEffectByPlayer: { white: null, black: null },
            hasUsedCardThisTurnByPlayer: { white: false, black: false },
            hasDestroyedCardThisTurnByPlayer: { white: false, black: false }
        };
        global.gameState = { board: makeBoard(), currentPlayer: 'white', turnNumber: 30 };
        global.generateMovesForPlayer = jest.fn(() => [
            { row: 2, col: 3, flips: [{ row: 3, col: 3 }] },
            { row: 5, col: 4, flips: [{ row: 4, col: 4 }] }
        ]);

        await mod.runCpuTurn('white');

        expect(global.selectMoveFromOnnxPolicyAsync).not.toHaveBeenCalled();
        expect(global.selectCpuMoveWithPolicy).toHaveBeenCalled();
    });

    test('no-legal-moves retry still falls back to policy and direct card use after ONNX hold', async () => {
        global.cardState = {
            hands: { white: ['card_a'], black: [] },
            charge: { white: 10, black: 10 },
            pendingEffectByPlayer: { white: null, black: null },
            hasUsedCardThisTurnByPlayer: { white: false, black: false },
            hasDestroyedCardThisTurnByPlayer: { white: false, black: false }
        };
        global.gameState = { board: makeBoard(), currentPlayer: 'white', turnNumber: 10 };
        global.generateMovesForPlayer = jest.fn(() => []);
        global.cpuMaybeUseCardWithPolicy = jest.fn(() => false);
        global.applyCardChoice = jest.fn(() => true);

        await mod.runCpuTurn('white');

        expect(global.selectCardFromOnnxPolicyAsync).toHaveBeenCalled();
        expect(global.cpuMaybeUseCardWithPolicy).toHaveBeenCalledWith('white');
        expect(global.applyCardChoice).toHaveBeenCalledWith('white', {
            cardId: 'card_a',
            cardDef: { id: 'card_a' }
        });
    });

    test('runCpuTurn destroys bucket2 FATE_WILL before card-use path in browser Lv6 flow', async () => {
        const setTimeoutSpy = jest.spyOn(global, 'setTimeout').mockImplementation(() => 1);
        global.cpuMaybeDestroyHandCardWithPolicy = cpuDecision.cpuMaybeDestroyHandCardWithPolicy;
        global.cardState = {
            hands: { white: ['fate_01'], black: [] },
            charge: { white: 50, black: 10 },
            pendingEffectByPlayer: { white: null, black: null },
            hasUsedCardThisTurnByPlayer: { white: false, black: false },
            hasDestroyedCardThisTurnByPlayer: { white: false, black: false }
        };
        global.gameState = { board: makeBoard(), currentPlayer: 'white', turnNumber: 10 };
        global.generateMovesForPlayer = jest.fn(() => [
            { row: 2, col: 3, flips: [{ row: 3, col: 3 }] }
        ]);
        global.CardLogic = {
            getUsableCardIds: () => ['fate_01'],
            hasUsableCard: () => true,
            getCardDef: () => ({ id: 'fate_01', name: '運命の意志', type: 'FATE_WILL' }),
            getCardCost: () => 50
        };
        global.TurnPipeline = {};
        global.TurnPipelineUIAdapter = {
            runTurnWithAdapter: jest.fn((_cs, _gs, _p, action) => ({
                ok: action.type === 'destroy_hand_card',
                nextCardState: {
                    ...global.cardState,
                    hands: { ...global.cardState.hands, white: [] },
                    hasDestroyedCardThisTurnByPlayer: { ...global.cardState.hasDestroyedCardThisTurnByPlayer, white: true }
                },
                nextGameState: global.gameState,
                playbackEvents: []
            }))
        };

        await mod.runCpuTurn('white');

        expect(global.TurnPipelineUIAdapter.runTurnWithAdapter).toHaveBeenCalled();
        const action = global.TurnPipelineUIAdapter.runTurnWithAdapter.mock.calls[0][3];
        expect(action.type).toBe('destroy_hand_card');
        expect(action.destroyCardId).toBe('fate_01');
        expect(global.selectCardFromOnnxPolicyAsync).not.toHaveBeenCalled();
        expect(global.cpuMaybeUseCardWithPolicy).not.toHaveBeenCalled();
        expect(setTimeoutSpy).toHaveBeenCalled();
    });

    test('runCpuTurn destroys bucket3 CORNER_TRIBUTE before card-use path in browser Lv6 flow', async () => {
        const setTimeoutSpy = jest.spyOn(global, 'setTimeout').mockImplementation(() => 1);
        global.cpuMaybeDestroyHandCardWithPolicy = cpuDecision.cpuMaybeDestroyHandCardWithPolicy;
        global.cardState = {
            hands: { white: ['corner_tribute_01'], black: [] },
            charge: { white: 60, black: 10 },
            pendingEffectByPlayer: { white: null, black: null },
            hasUsedCardThisTurnByPlayer: { white: false, black: false },
            hasDestroyedCardThisTurnByPlayer: { white: false, black: false }
        };
        global.gameState = { board: makeBoard(), currentPlayer: 'white', turnNumber: 10 };
        global.generateMovesForPlayer = jest.fn(() => [
            { row: 2, col: 3, flips: [{ row: 3, col: 3 }] }
        ]);
        global.CardLogic = {
            getUsableCardIds: () => [],
            hasUsableCard: () => false,
            getCardDef: () => ({ id: 'corner_tribute_01', name: '角の代償', type: 'CORNER_TRIBUTE' }),
            getCardCost: () => 12
        };
        global.TurnPipeline = {};
        global.TurnPipelineUIAdapter = {
            runTurnWithAdapter: jest.fn((_cs, _gs, _p, action) => ({
                ok: action.type === 'destroy_hand_card',
                nextCardState: {
                    ...global.cardState,
                    hands: { ...global.cardState.hands, white: [] },
                    hasDestroyedCardThisTurnByPlayer: { ...global.cardState.hasDestroyedCardThisTurnByPlayer, white: true }
                },
                nextGameState: global.gameState,
                playbackEvents: []
            }))
        };

        await mod.runCpuTurn('white');

        expect(global.TurnPipelineUIAdapter.runTurnWithAdapter).toHaveBeenCalled();
        const action = global.TurnPipelineUIAdapter.runTurnWithAdapter.mock.calls[0][3];
        expect(action.type).toBe('destroy_hand_card');
        expect(action.destroyCardId).toBe('corner_tribute_01');
        expect(global.selectCardFromOnnxPolicyAsync).not.toHaveBeenCalled();
        expect(global.cpuMaybeUseCardWithPolicy).not.toHaveBeenCalled();
        expect(setTimeoutSpy).toHaveBeenCalled();
    });
});
