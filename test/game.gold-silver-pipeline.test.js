/**
 * 金/銀の意志 — TurnPipeline 統合テスト
 *
 * applyTurnSafe を実際に使い、プレゼンテーションイベントに
 * SPAWN → DESTROY が正しく含まれ、盤面が EMPTY になることを検証する。
 */
const path = require('path');

describe('金/銀の意志 — TurnPipeline 統合', () => {
    let TurnPipeline, CardLogic;

    beforeEach(() => {
        jest.resetModules();
        // Provide deepClone mock (utils/deepClone doesn't exist in this workspace)
        jest.doMock(path.resolve(__dirname, '..', 'utils', 'deepClone'), () => {
            return (obj) => JSON.parse(JSON.stringify(obj));
        }, { virtual: true });

        global.BLACK = 1;
        global.WHITE = -1;
        global.EMPTY = 0;
        global.BOARD_SIZE = 8;
        global.getPlayerKey = (v) => (v === 1 ? 'black' : 'white');
        global.getPlayerName = (v) => (v === 1 ? '黒' : '白');
        global.getPlayerDisplayName = global.getPlayerName;
        global.getLegalMoves = (board, player) => {
            // Minimal: find cells that flip at least one
            const moves = [];
            const opp = -player;
            const dirs = [[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]];
            for (let r = 0; r < 8; r++) {
                for (let c = 0; c < 8; c++) {
                    if (board[r][c] !== 0) continue;
                    for (const [dr, dc] of dirs) {
                        let rr = r + dr, cc = c + dc, found = false;
                        while (rr >= 0 && rr < 8 && cc >= 0 && cc < 8 && board[rr][cc] === opp) { rr += dr; cc += dc; found = true; }
                        if (found && rr >= 0 && rr < 8 && cc >= 0 && cc < 8 && board[rr][cc] === player) { moves.push({ row: r, col: c }); break; }
                    }
                }
            }
            return moves;
        };
        global.emitLogAdded = jest.fn();
        global.isDebugLogAvailable = () => false;
        global.debugLog = jest.fn();
        global.LOG_MESSAGES = require('../game/log-messages');

        TurnPipeline = require('../game/turn/turn_pipeline');
        CardLogic = require('../game/logic/cards');
    });

    afterEach(() => {
        ['BLACK','WHITE','EMPTY','BOARD_SIZE','getPlayerKey','getPlayerName',
         'getPlayerDisplayName','getLegalMoves','emitLogAdded','isDebugLogAvailable',
         'debugLog','LOG_MESSAGES'].forEach(k => delete global[k]);
    });

    function makeGameState() {
        const board = Array.from({ length: 8 }, () => Array(8).fill(0));
        board[3][3] = -1; board[3][4] = 1;
        board[4][3] = 1;  board[4][4] = -1;
        return { currentPlayer: 1, board, consecutivePasses: 0, turnNumber: 1 };
    }

    function makeCardState(pendingType) {
        return {
            deck: Array(10).fill('dummy'),
            discard: [],
            hands: { black: ['gold_stone'], white: [] },
            turnIndex: 0,
            lastTurnStartedFor: null,
            turnCountByPlayer: { black: 0, white: 0 },
            selectedCardId: null,
            hasUsedCardThisTurnByPlayer: { black: false, white: false },
            pendingEffectByPlayer: { black: null, white: null },
            activeEffectsByPlayer: { black: {}, white: {} },
            markers: [],
            _nextMarkerId: 1,
            _nextCreatedSeq: 1,
            presentationEvents: [],
            _presentationEventsPersist: [],
            _nextStoneId: 5,
            stoneIdMap: Array.from({ length: 8 }, () => Array(8).fill(null)),
            hyperactiveSeqCounter: 0,
            lastUsedCardByPlayer: { black: null, white: null },
            charge: { black: 10, white: 10 },
            extraPlaceRemainingByPlayer: { black: 0, white: 0 },
            workAnchorPosByPlayer: { black: null, white: null },
            workNextPlacementArmedByPlayer: { black: false, white: false }
        };
    }

    test('GOLD_STONE: applyTurnSafe の結果に SPAWN と DESTROY が含まれ、盤面が EMPTY', () => {
        const gs = makeGameState();
        const cs = makeCardState('GOLD_STONE');

        // Manually set the card in hand and configure pending effect
        // (TurnPipeline handles card usage, so we use useCardId in action)
        const action = { type: 'place', row: 2, col: 3, useCardId: 'gold_stone' };
        const result = TurnPipeline.applyTurnSafe(cs, gs, 'black', action);

        expect(result.ok).toBe(true);

        // Board at (2,3) should be EMPTY after gold stone sacrifice
        expect(result.gameState.board[2][3]).toBe(0);

        // Presentation events
        const pres = result.presentationEvents || [];
        const spawnAt23 = pres.filter(e => e.type === 'SPAWN' && e.row === 2 && e.col === 3);
        const destroyAt23 = pres.filter(e => e.type === 'DESTROY' && e.row === 2 && e.col === 3);

        expect(spawnAt23.length).toBeGreaterThanOrEqual(1);
        expect(destroyAt23.length).toBeGreaterThanOrEqual(1);

        // DESTROY should come after SPAWN in the event list
        const spawnIdx = pres.findIndex(e => e.type === 'SPAWN' && e.row === 2 && e.col === 3);
        const destroyIdx = pres.findIndex(e => e.type === 'DESTROY' && e.row === 2 && e.col === 3);
        expect(destroyIdx).toBeGreaterThan(spawnIdx);

        // No GOLD markers should remain
        const goldMarkers = (result.cardState.markers || []).filter(m => m.data && m.data.type === 'GOLD');
        expect(goldMarkers.length).toBe(0);
    });
});
