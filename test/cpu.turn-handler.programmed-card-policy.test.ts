export {};
const global: Record<string, any> = globalThis;
const mod = require('../game/cpu-turn-handler.js');
const cpuDecision: Record<string, any> = require('../game/cpu-decision.js');

function resolveGlobalRuntimeFunction(name: string) {
    const candidate = global[name];
    return typeof candidate === 'function' ? candidate : null;
}

function resolveGlobalRuntimeValue(name: string) {
    return Object.prototype.hasOwnProperty.call(global, name)
        ? global[name]
        : undefined;
}

function makeBoard() {
    const board = Array.from({ length: 8 }, () => Array(8).fill(0));
    board[3][3] = -1;
    board[3][4] = 1;
    board[4][3] = 1;
    board[4][4] = -1;
    return board;
}

const lowYieldEconomyCards = [
    {
        id: 'silver_01',
        name: '銀の意志',
        type: 'SILVER_STONE',
        cost: 3,
        legalMoves: [{ row: 2, col: 3, flips: [{ row: 3, col: 3 }] }]
    },
    {
        id: 'gold_01',
        name: '金の意志',
        type: 'GOLD_STONE',
        cost: 6,
        legalMoves: [{ row: 2, col: 3, flips: [{ row: 3, col: 3 }] }]
    },
    {
        id: 'rainbow_01',
        name: '虹の意志',
        type: 'RAINBOW_STONE',
        cost: 10,
        legalMoves: [{ row: 2, col: 3, flips: [{ row: 3, col: 3 }, { row: 3, col: 4 }] }]
    },
    {
        id: 'crystal_01',
        name: '演算の意志',
        type: 'CRYSTAL_STONE',
        cost: 6,
        legalMoves: [{ row: 2, col: 3, flips: [{ row: 3, col: 3 }] }]
    }
];

function setupLowYieldEconomyCard(cardCase: any, legalMoves: any[]) {
    global.cpuSmartness = { white: 7, black: 1 };
    global.cardState = {
        hands: { white: [cardCase.id], black: [] },
        charge: { white: 50, black: 10 },
        pendingEffectByPlayer: { white: null, black: null },
        hasUsedCardThisTurnByPlayer: { white: false, black: false },
        hasDestroyedCardThisTurnByPlayer: { white: false, black: false },
        ...(cardCase.boardBonusByCell ? { boardBonusByCell: cardCase.boardBonusByCell } : {})
    };
    global.gameState = { board: makeBoard(), currentPlayer: 'white', turnNumber: 8 };
    global.CardLogic = {
        getUsableCardIds: () => [cardCase.id],
        hasUsableCard: () => true,
        getCardDef: () => ({ id: cardCase.id, name: cardCase.name, type: cardCase.type }),
        getCardCost: () => cardCase.cost
    };
    global.generateMovesForPlayer = jest.fn(() => legalMoves);
    global.applyCardChoice = jest.fn(() => true);
    global.cpuMaybeUseCardWithPolicy = jest.fn(() => false);
}

function createCapturingTimerService(callbacks: Array<() => void>) {
    return {
        setTimeout: jest.fn((callback: () => void, delay: number) => {
            callbacks.push(callback);
            return { delay, index: callbacks.length };
        }),
        clearTimeout: jest.fn()
    };
}

describe('cpu-turn-handler programmed card policy behavior', () => {
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
        global.processPassTurn = jest.fn();
        global.playHandAnimation = jest.fn((playerValue, row, col, cb) => {
            if (typeof cb === 'function') cb();
        });
        global.applyCardChoice = jest.fn(() => false);
        global.CardLogic = {
            getUsableCardIds: () => ['card_a'],
            hasUsableCard: () => true,
            getCardDef: (id: string) => ({ id })
        };
        global.cpuMaybeUseCardWithPolicy = jest.fn(() => false);
        mod.setCpuUIImpl({
            readBenchFastMode: () => global.__BENCH_FAST_MODE === true,
            getCpuLv6SharedProfile: () => global.CPU_LV6_SHARED_PROFILE || null,
            getCpuCardLogic: () => global.CardLogic || null,
            resolveRuntimeFunction: resolveGlobalRuntimeFunction,
            resolveRuntimeValue: (name: string) => {
                if (name === 'TurnPipelineUIAdapter') return global.TurnPipelineUIAdapter;
                if (name === 'TurnPipeline') return global.TurnPipeline;
                return resolveGlobalRuntimeValue(name);
            },
            applyRuntimeStatePatch: (nextCardState: any, nextGameState: any) => {
                if (nextCardState) global.cardState = nextCardState;
                if (nextGameState) global.gameState = nextGameState;
            },
            readMatchMode: () => global.MATCH_MODE || null,
            readQuerySearch: () => global.__CPU_TEST_QUERY_SEARCH || '',
            resolveExecuteMove: () => global.executeMove,
            resolveProcessPassTurn: () => global.processPassTurn
        });
    });

    afterEach(() => {
        mod.resetCpuTurnHandlerState();
        mod.setCpuUIImpl({});
        mod.setTimers(null);
        mod.setCpuTurnTimerService(null);
        delete global.__BENCH_FAST_MODE;
        delete global.ANIMATION_RETRY_DELAY_MS;
        delete global.MATCH_MODE;
        delete global.TurnPipeline;
        delete global.TurnPipelineUIAdapter;
        delete global.generateMovesForPlayer;
        delete global.selectMoveFromOnnxPolicyAsync;
        delete global.selectCpuMoveWithPolicy;
        delete global.cpuMaybeDestroyHandCardWithPolicy;
        delete global.processPassTurn;
        delete global.onTurnStart;
        delete global.__CPU_TEST_QUERY_SEARCH;
        delete global.isGameOver;
        delete global.showResult;
    });

    test('uses programmed card policy in stable state', async () => {
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

        expect(global.cpuMaybeUseCardWithPolicy).toHaveBeenCalledWith('white');
    });

    test('Lv7 theory incarnation skips all card-use paths before turn 8 and places a stone', async () => {
        const move = { row: 2, col: 3, flips: [{ row: 3, col: 3 }] };
        global.cpuSmartness = { white: 7, black: 1 };
        global.cardState = {
            hands: { white: ['theory_incarnation_01'], black: [] },
            charge: { white: 50, black: 10 },
            pendingEffectByPlayer: { white: null, black: null },
            hasUsedCardThisTurnByPlayer: { white: false, black: false },
            hasDestroyedCardThisTurnByPlayer: { white: false, black: false }
        };
        global.gameState = { board: makeBoard(), currentPlayer: 'white', turnNumber: 7 };
        global.generateMovesForPlayer = jest.fn(() => [move]);
        global.selectCpuMoveWithPolicy = jest.fn(() => move);

        await mod.runCpuTurn('white');

        expect(global.cpuMaybeUseCardWithPolicy).not.toHaveBeenCalled();
        expect(global.selectCpuMoveWithPolicy).toHaveBeenCalled();
        expect(global.executeMove).toHaveBeenCalledWith(move);
    });

    test('black Lv7 theory incarnation skips all card-use paths before turn 8 and places a stone', async () => {
        const move = { row: 2, col: 3, flips: [{ row: 3, col: 3 }] };
        global.cpuSmartness = { white: 1, black: 7 };
        global.cardState = {
            hands: { white: [], black: ['theory_incarnation_01'] },
            charge: { white: 10, black: 50 },
            pendingEffectByPlayer: { white: null, black: null },
            hasUsedCardThisTurnByPlayer: { white: false, black: false },
            hasDestroyedCardThisTurnByPlayer: { white: false, black: false }
        };
        global.gameState = { board: makeBoard(), currentPlayer: 'black', turnNumber: 7 };
        global.generateMovesForPlayer = jest.fn(() => [move]);
        global.selectCpuMoveWithPolicy = jest.fn(() => move);

        await mod.runCpuTurn('black');

        expect(global.cpuMaybeUseCardWithPolicy).not.toHaveBeenCalled();
        expect(global.selectCpuMoveWithPolicy).toHaveBeenCalled();
        expect(global.executeMove).toHaveBeenCalledWith(move);
    });

    test('Lv7 theory incarnation uses Lv6 card logic from turn 8 onward', async () => {
        global.cpuSmartness = { white: 7, black: 1 };
        global.cardState = {
            hands: { white: ['theory_incarnation_01'], black: [] },
            charge: { white: 50, black: 10 },
            pendingEffectByPlayer: { white: null, black: null },
            hasUsedCardThisTurnByPlayer: { white: false, black: false },
            hasDestroyedCardThisTurnByPlayer: { white: false, black: false }
        };
        global.gameState = { board: makeBoard(), currentPlayer: 'white', turnNumber: 8 };
        global.generateMovesForPlayer = jest.fn(() => [
            { row: 2, col: 3, flips: [{ row: 3, col: 3 }] }
        ]);

        await mod.runCpuTurn('white');

        expect(global.cpuMaybeUseCardWithPolicy).toHaveBeenCalledWith('white');
    });

    test('CPU turn places normally while 理論の化身 leaves placement unlocked', async () => {
        const move = { row: 2, col: 3, flips: [{ row: 3, col: 3 }] };
        global.cpuSmartness = { white: 7, black: 1 };
        global.cardState = {
            hands: { white: ['some_card'], black: [] },
            charge: { white: 50, black: 10 },
            pendingEffectByPlayer: { white: null, black: null },
            hasUsedCardThisTurnByPlayer: { white: false, black: false },
            hasDestroyedCardThisTurnByPlayer: { white: false, black: false },
            lastTurnStartedFor: 'black',
            markers: [
                {
                    kind: 'manifestStone',
                    row: 2,
                    col: 2,
                    owner: 'white',
                    data: { type: 'THEORY_INCARNATION', remainingOwnerTurns: 3 }
                }
            ]
        };
        global.gameState = { board: makeBoard(), currentPlayer: 'white', turnNumber: 12 };
        global.CardLogic = {
            getUsableCardIds: () => ['some_card'],
            hasUsableCard: () => true,
            getCardDef: (id: string) => ({ id }),
            isPlacementLockedForPlayer: jest.fn(() => false)
        };
        global.generateMovesForPlayer = jest.fn(() => [move]);
        global.selectCpuMoveWithPolicy = jest.fn(() => move);
        global.onTurnStart = jest.fn(async () => {
            global.gameState.currentPlayer = 'black';
            return { stopAction: true, playbackEvents: [] };
        });

        await mod.runCpuTurn('white');

        expect(global.onTurnStart).not.toHaveBeenCalled();
        expect(global.generateMovesForPlayer).toHaveBeenCalled();
        expect(global.selectCpuMoveWithPolicy).toHaveBeenCalled();
        expect(global.executeMove).toHaveBeenCalledWith(move);
        expect(global.processPassTurn).not.toHaveBeenCalled();
    });

    test('Lv8 ending ash skips all card-use paths before turn 6 and places a stone', async () => {
        const move = { row: 2, col: 3, flips: [{ row: 3, col: 3 }] };
        global.cpuSmartness = { white: '8-ending-ash', black: 1 };
        global.cardState = {
            hands: { white: ['observer_will_01'], black: [] },
            charge: { white: 99, black: 10 },
            pendingEffectByPlayer: { white: null, black: null },
            hasUsedCardThisTurnByPlayer: { white: false, black: false },
            hasDestroyedCardThisTurnByPlayer: { white: false, black: false }
        };
        global.gameState = { board: makeBoard(), currentPlayer: 'white', turnNumber: 5 };
        global.generateMovesForPlayer = jest.fn(() => [move]);
        global.selectCpuMoveWithPolicy = jest.fn(() => move);

        await mod.runCpuTurn('white');

        expect(global.cpuMaybeUseCardWithPolicy).not.toHaveBeenCalled();
        expect(global.selectCpuMoveWithPolicy).toHaveBeenCalled();
        expect(global.executeMove).toHaveBeenCalledWith(move);
    });

    test('Lv8 ending ash uses Lv6 card logic from turn 6 onward', async () => {
        global.cpuSmartness = { white: '8-ending-ash', black: 1 };
        global.cardState = {
            hands: { white: ['observer_will_01'], black: [] },
            charge: { white: 99, black: 10 },
            pendingEffectByPlayer: { white: null, black: null },
            hasUsedCardThisTurnByPlayer: { white: false, black: false },
            hasDestroyedCardThisTurnByPlayer: { white: false, black: false }
        };
        global.gameState = { board: makeBoard(), currentPlayer: 'white', turnNumber: 6 };
        global.generateMovesForPlayer = jest.fn(() => [
            { row: 2, col: 3, flips: [{ row: 3, col: 3 }] }
        ]);

        await mod.runCpuTurn('white');

        expect(global.cpuMaybeUseCardWithPolicy).toHaveBeenCalledWith('white');
    });

    test.each(lowYieldEconomyCards)('Lv7 theory incarnation blocks low-yield $name through programmed policy', async (cardCase) => {
        setupLowYieldEconomyCard(cardCase, cardCase.legalMoves);

        await mod.runCpuTurn('white');

        expect(global.cpuMaybeUseCardWithPolicy).toHaveBeenCalledWith('white');
        expect(global.applyCardChoice).not.toHaveBeenCalledWith('white', expect.objectContaining({
            cardId: cardCase.id
        }));
    });

    test('reads processing through CPU bridge without inspecting PlaybackStateManager shape', async () => {
        const readProcessing = jest.fn(() => true);
        const getPlaybackStateManager = jest.fn(() => ({
            getProcessing: jest.fn(() => false)
        }));
        mod.setCpuUIImpl({
            readProcessing,
            getPlaybackStateManager
        });
        global.gameState = { board: makeBoard(), currentPlayer: 1, turnNumber: 10 };

        await mod.processAutoBlackTurn();

        expect(readProcessing).toHaveBeenCalled();
        expect(getPlaybackStateManager).not.toHaveBeenCalled();
    });

    test('processAutoBlackTurn retries when CPU or animation is busy', async () => {
        const callbacks: Array<() => void> = [];
        const timerService = createCapturingTimerService(callbacks);
        mod.setCpuTurnTimerService(timerService);
        mod.setCpuUIImpl({
            readProcessing: jest.fn(() => true)
        });
        global.gameState = { board: makeBoard(), currentPlayer: global.BLACK, turnNumber: 10 };

        await mod.processAutoBlackTurn();

        expect(timerService.setTimeout).toHaveBeenCalledTimes(1);
        expect(callbacks).toHaveLength(1);
        expect(global.executeMove).not.toHaveBeenCalled();
    });

    test('uses programmed card policy in emergency state for Lv6', async () => {
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

        expect(global.cpuMaybeUseCardWithPolicy).toHaveBeenCalledWith('white');
    });

    test('uses programmed card policy when hand is at cap and charge is high (Lv6)', async () => {
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

        expect(global.cpuMaybeUseCardWithPolicy).toHaveBeenCalledWith('white');
    });

    test('uses programmed card policy when mobility is low and charge is available (Lv6)', async () => {
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

        expect(global.cpuMaybeUseCardWithPolicy).toHaveBeenCalledWith('white');
    });

    test('uses programmed card policy when hand is loaded and state is only slightly behind (Lv6)', async () => {
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

        expect(global.cpuMaybeUseCardWithPolicy).toHaveBeenCalledWith('white');
    });

    test('uses programmed card path when shared profile requests policy-table/core parity', async () => {
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

    test('uses Othello ONNX move path in normal card-reversi while keeping policy-table card decisions', async () => {
        const onnxMove = { row: 2, col: 3, flips: [{ row: 3, col: 3 }] };
        const fallbackMove = { row: 5, col: 4, flips: [{ row: 4, col: 4 }] };
        global.CPU_LV6_SHARED_PROFILE = {
            browser: {
                moveDecisionMode: 'othello-onnx',
                cardDecisionMode: 'policy-table-core'
            }
        };
        global.CardLogic = {
            getUsableCardIds: () => ['a'],
            hasUsableCard: () => true,
            getCardDef: (id: string) => ({ id })
        };
        global.cardState = {
            hands: { white: ['a', 'b', 'c'], black: [] },
            charge: { white: 12, black: 8 },
            pendingEffectByPlayer: { white: null, black: null },
            hasUsedCardThisTurnByPlayer: { white: false, black: false },
            hasDestroyedCardThisTurnByPlayer: { white: false, black: false }
        };
        global.gameState = { board: makeBoard(), currentPlayer: 'white', turnNumber: 30 };
        global.MATCH_MODE = 'cpu';
        global.generateMovesForPlayer = jest.fn(() => [onnxMove, fallbackMove]);
        global.cpuMaybeUseCardWithPolicy = jest.fn(() => false);
        global.selectMoveFromOnnxPolicyAsync = jest.fn(async () => onnxMove);
        global.selectCpuMoveWithPolicy = jest.fn(() => fallbackMove);

        await mod.runCpuTurn('white');

        expect(global.cpuMaybeUseCardWithPolicy).toHaveBeenCalledWith('white');
        expect(global.selectMoveFromOnnxPolicyAsync).toHaveBeenCalledWith([onnxMove, fallbackMove], 'white', 6);
        expect(global.selectCpuMoveWithPolicy).not.toHaveBeenCalled();
        expect(global.executeMove).toHaveBeenCalledWith(onnxMove);
    });

    test('runCpuTurn commits the ONNX move directly without policy fallback override', async () => {
        const onnxMove = { row: 2, col: 3, flips: [{ row: 3, col: 3 }] };
        const fallbackMove = { row: 5, col: 4, flips: [{ row: 4, col: 4 }] };
        global.cpuSmartness = { white: '8-ending-ash', black: 1 };
        global.CardLogic = {
            getUsableCardIds: () => [],
            hasUsableCard: () => false,
            getCardDef: (id: string) => ({ id })
        };
        global.cardState = {
            hands: { white: [], black: [] },
            charge: { white: 0, black: 0 },
            pendingEffectByPlayer: { white: null, black: null },
            hasUsedCardThisTurnByPlayer: { white: false, black: false },
            hasDestroyedCardThisTurnByPlayer: { white: false, black: false }
        };
        global.gameState = { board: makeBoard(), currentPlayer: 'white', turnNumber: 30 };
        global.MATCH_MODE = 'reversi';
        global.generateMovesForPlayer = jest.fn(() => [onnxMove, fallbackMove]);
        global.selectMoveFromOnnxPolicyAsync = jest.fn(async () => onnxMove);
        global.selectCpuMoveWithPolicy = jest.fn(() => fallbackMove);

        await mod.runCpuTurn('white');

        expect(global.selectMoveFromOnnxPolicyAsync).toHaveBeenCalledWith([onnxMove, fallbackMove], 'white', 6);
        expect(global.selectCpuMoveWithPolicy).not.toHaveBeenCalled();
        expect(global.executeMove).toHaveBeenCalledWith(onnxMove);
    });

    test('uses injected query search to disable Othello ONNX move path', async () => {
        const onnxMove = { row: 2, col: 3, flips: [{ row: 3, col: 3 }] };
        const fallbackMove = { row: 5, col: 4, flips: [{ row: 4, col: 4 }] };
        global.CardLogic = {
            getUsableCardIds: () => [],
            hasUsableCard: () => false,
            getCardDef: (id: string) => ({ id })
        };
        global.cardState = {
            hands: { white: [], black: [] },
            charge: { white: 0, black: 0 },
            pendingEffectByPlayer: { white: null, black: null },
            hasUsedCardThisTurnByPlayer: { white: false, black: false },
            hasDestroyedCardThisTurnByPlayer: { white: false, black: false }
        };
        global.gameState = { board: makeBoard(), currentPlayer: 'white', turnNumber: 30 };
        global.MATCH_MODE = 'reversi';
        global.__CPU_TEST_QUERY_SEARCH = '?othelloOnnx=0';
        global.generateMovesForPlayer = jest.fn(() => [onnxMove, fallbackMove]);
        global.selectMoveFromOnnxPolicyAsync = jest.fn(async () => onnxMove);
        global.selectCpuMoveWithPolicy = jest.fn(() => fallbackMove);

        await mod.runCpuTurn('white');

        expect(global.selectMoveFromOnnxPolicyAsync).not.toHaveBeenCalled();
        expect(global.selectCpuMoveWithPolicy).toHaveBeenCalled();
        expect(global.executeMove).toHaveBeenCalledWith(fallbackMove);
    });

    test('processCpuTurn shows game-over result through injected runtime function', async () => {
        global.gameState = { board: makeBoard(), currentPlayer: 'white', turnNumber: 30 };
        global.cardState = {
            hands: { white: [], black: [] },
            charge: { white: 0, black: 0 },
            pendingEffectByPlayer: { white: null, black: null }
        };
        global.isGameOver = jest.fn(() => true);
        global.showResult = jest.fn();

        await mod.processCpuTurn();

        expect(global.showResult).toHaveBeenCalledTimes(1);
    });

    test('no-legal-moves retry uses policy and direct card use without ONNX hold', async () => {
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

        expect(global.cpuMaybeUseCardWithPolicy).toHaveBeenCalledWith('white');
        expect(global.applyCardChoice).toHaveBeenCalledWith('white', {
            cardId: 'card_a',
            cardDef: { id: 'card_a' }
        });
    });

    test.each(lowYieldEconomyCards)('no-legal-moves direct retry does not bypass Lv6 low-yield $name gate', async (cardCase) => {
        setupLowYieldEconomyCard(cardCase, []);

        await mod.runCpuTurn('white');

        expect(global.applyCardChoice).not.toHaveBeenCalledWith('white', expect.objectContaining({
            cardId: cardCase.id
        }));
    });

    test('runCpuTurn destroys bucket2 FATE_WILL before card-use path in browser Lv6 flow', async () => {
        const callbacks: Array<() => void> = [];
        const timerService = createCapturingTimerService(callbacks);
        mod.setCpuTurnTimerService(timerService);
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
        expect(global.cpuMaybeUseCardWithPolicy).not.toHaveBeenCalled();
        expect(timerService.setTimeout).toHaveBeenCalled();
        // Execute stored callbacks to clean up timers
        callbacks.forEach(cb => cb());
    });

});
