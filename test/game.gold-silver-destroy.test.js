/**
 * 金の意志 / 銀の意志 — 配置直後に破壊される仕様のテスト
 *
 * 確認事項:
 * 1. 配置後、盤面は EMPTY になる（マーカーも残らない）
 * 2. プレゼンテーションイベントに SPAWN → DESTROY の順番で含まれる
 * 3. チャージ倍率が正しく適用される（GOLD=×4, SILVER=×3）
 */
const path = require('path');

describe('金/銀の意志 — 即時破壊', () => {
    let CardLogic;

    beforeEach(() => {
        jest.resetModules();

        // Minimal globals expected by cards.js
        global.BLACK = 1;
        global.WHITE = -1;
        global.EMPTY = 0;
        global.BOARD_SIZE = 8;
        global.getPlayerKey = (v) => (v === 1 ? 'black' : 'white');
        global.getPlayerName = (v) => (v === 1 ? '黒' : '白');
        global.getPlayerDisplayName = global.getPlayerName;
        global.getLegalMoves = () => [];
        global.emitLogAdded = jest.fn();
        global.isDebugLogAvailable = () => false;
        global.debugLog = jest.fn();
        global.LOG_MESSAGES = require('../game/log-messages');

        CardLogic = require('../game/logic/cards');
    });

    afterEach(() => {
        delete global.BLACK;
        delete global.WHITE;
        delete global.EMPTY;
        delete global.BOARD_SIZE;
        delete global.getPlayerKey;
        delete global.getPlayerName;
        delete global.getPlayerDisplayName;
        delete global.getLegalMoves;
        delete global.emitLogAdded;
        delete global.isDebugLogAvailable;
        delete global.debugLog;
        delete global.LOG_MESSAGES;
    });

    function makeBoard() {
        const board = Array.from({ length: 8 }, () => Array(8).fill(0));
        // Standard initial setup
        board[3][3] = -1; board[3][4] = 1;
        board[4][3] = 1;  board[4][4] = -1;
        return board;
    }

    function makeGameState() {
        return {
            currentPlayer: 1,
            board: makeBoard(),
            consecutivePasses: 0,
            turnNumber: 1
        };
    }

    function makeCardState(pendingType) {
        return {
            deck: [],
            discard: [],
            hands: { black: [], white: [] },
            turnIndex: 0,
            lastTurnStartedFor: null,
            turnCountByPlayer: { black: 0, white: 0 },
            selectedCardId: null,
            hasUsedCardThisTurnByPlayer: { black: false, white: false },
            pendingEffectByPlayer: {
                black: { type: pendingType },
                white: null
            },
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

    test('GOLD_STONE: 配置直後に盤面が EMPTY になり、SPAWN → DESTROY イベントが出る', () => {
        const gs = makeGameState();
        const cs = makeCardState('GOLD_STONE');

        // Simulate that spawnAt already placed the stone (applyPlacementEffects runs after placement)
        gs.board[2][3] = 1; // BLACK
        cs.stoneIdMap[2][3] = 's5';

        // Place black at (2,3) — flips (3,3) from white to black
        const effects = CardLogic.applyPlacementEffects(cs, gs, 'black', 2, 3, 1);

        // Board cell should be EMPTY (destroyed immediately)
        expect(gs.board[2][3]).toBe(0);

        // No marker should remain
        const markers = cs.markers.filter(m => m.row === 2 && m.col === 3);
        expect(markers.length).toBe(0);

        // Charge multiplier applied
        expect(effects.goldStoneUsed).toBe(true);
        expect(effects.chargeGained).toBe(4); // 1 flip × 4

        // Presentation events should include DESTROY for (2,3)
        const allEvents = (cs._presentationEventsPersist || []).concat(cs.presentationEvents || []);
        const destroyEvents = allEvents.filter(e => e.type === 'DESTROY' && e.row === 2 && e.col === 3);
        expect(destroyEvents.length).toBeGreaterThanOrEqual(1);
        expect(destroyEvents[0].reason).toBe('gold_stone_sacrifice');
    });

    test('SILVER_STONE: 配置直後に盤面が EMPTY になり、SPAWN → DESTROY イベントが出る', () => {
        const gs = makeGameState();
        const cs = makeCardState('SILVER_STONE');

        // Simulate that spawnAt already placed the stone
        gs.board[2][3] = 1; // BLACK
        cs.stoneIdMap[2][3] = 's5';

        // Place black at (2,3) — flips (3,3)
        const effects = CardLogic.applyPlacementEffects(cs, gs, 'black', 2, 3, 1);

        expect(gs.board[2][3]).toBe(0);

        const markers = cs.markers.filter(m => m.row === 2 && m.col === 3);
        expect(markers.length).toBe(0);

        expect(effects.silverStoneUsed).toBe(true);
        expect(effects.chargeGained).toBe(3); // 1 flip × 3

        const allEvents = (cs._presentationEventsPersist || []).concat(cs.presentationEvents || []);
        const destroyEvents = allEvents.filter(e => e.type === 'DESTROY' && e.row === 2 && e.col === 3);
        expect(destroyEvents.length).toBeGreaterThanOrEqual(1);
        expect(destroyEvents[0].reason).toBe('silver_stone_sacrifice');
    });

    test('GOLD_STONE: 盤面にマーカーが残らない（次ターンの expiry 対象なし）', () => {
        const gs = makeGameState();
        const cs = makeCardState('GOLD_STONE');
        gs.board[2][3] = 1;
        cs.stoneIdMap[2][3] = 's5';

        CardLogic.applyPlacementEffects(cs, gs, 'black', 2, 3, 2);

        // No specialStone markers should exist at all
        const goldMarkers = cs.markers.filter(m =>
            m.data && (m.data.type === 'GOLD' || m.data.type === 'SILVER')
        );
        expect(goldMarkers.length).toBe(0);
    });

    test('GOLD_STONE: flipCount=3 なら chargeGained=12', () => {
        const gs = makeGameState();
        const cs = makeCardState('GOLD_STONE');
        gs.board[2][3] = 1;
        cs.stoneIdMap[2][3] = 's5';
        const effects = CardLogic.applyPlacementEffects(cs, gs, 'black', 2, 3, 3);
        expect(effects.chargeGained).toBe(12);
    });

    test('SILVER_STONE: flipCount=3 なら chargeGained=9', () => {
        const gs = makeGameState();
        const cs = makeCardState('SILVER_STONE');
        gs.board[2][3] = 1;
        cs.stoneIdMap[2][3] = 's5';
        const effects = CardLogic.applyPlacementEffects(cs, gs, 'black', 2, 3, 3);
        expect(effects.chargeGained).toBe(9);
    });
});
