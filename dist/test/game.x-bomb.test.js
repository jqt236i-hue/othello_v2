"use strict";
describe('X_BOMB (クロス爆弾)', () => {
    let CardLogic;
    beforeEach(() => {
        jest.resetModules();
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
    function makeCardState() {
        return {
            deck: [],
            discard: [],
            hands: { black: [], white: [] },
            turnIndex: 0,
            lastTurnStartedFor: null,
            turnCountByPlayer: { black: 0, white: 0 },
            selectedCardId: null,
            hasUsedCardThisTurnByPlayer: { black: false, white: false },
            pendingEffectByPlayer: { black: { type: 'X_BOMB' }, white: null },
            activeEffectsByPlayer: { black: {}, white: {} },
            markers: [],
            _nextMarkerId: 1,
            _nextCreatedSeq: 1,
            presentationEvents: [],
            _presentationEventsPersist: [],
            _nextStoneId: 10,
            stoneIdMap: Array.from({ length: 8 }, () => Array(8).fill(null)),
            hyperactiveSeqCounter: 0,
            lastUsedCardByPlayer: { black: null, white: null },
            charge: { black: 0, white: 0 },
            chargeGainedTotal: { black: 0, white: 0 },
            extraPlaceRemainingByPlayer: { black: 0, white: 0 },
            workAnchorPosByPlayer: { black: null, white: null },
            workNextPlacementArmedByPlayer: { black: false, white: false }
        };
    }
    test('通常反転後に中心+斜め8マスを即時爆破し、爆破では布石を獲得しない', () => {
        const gs = {
            currentPlayer: 1,
            board: Array.from({ length: 8 }, () => Array(8).fill(0)),
            consecutivePasses: 0,
            turnNumber: 1
        };
        const cs = makeCardState();
        // Center + diagonal targets (distance 1 and 2)
        gs.board[3][3] = 1;
        gs.board[2][2] = -1;
        gs.board[2][4] = 1;
        gs.board[4][2] = -1;
        gs.board[4][4] = 1;
        gs.board[1][1] = -1;
        gs.board[1][5] = 1;
        gs.board[5][1] = -1;
        gs.board[5][5] = 1;
        // Orthogonal (must survive)
        gs.board[3][4] = -1;
        cs.stoneIdMap[3][3] = 's1';
        cs.stoneIdMap[2][2] = 's2';
        cs.stoneIdMap[2][4] = 's3';
        cs.stoneIdMap[4][2] = 's4';
        cs.stoneIdMap[4][4] = 's5';
        cs.stoneIdMap[1][1] = 's6';
        cs.stoneIdMap[1][5] = 's7';
        cs.stoneIdMap[5][1] = 's8';
        cs.stoneIdMap[5][5] = 's9';
        cs.stoneIdMap[3][4] = 's10';
        const effects = CardLogic.applyPlacementEffects(cs, gs, 'black', 3, 3, 2);
        expect(effects.xBombExploded).toBe(true);
        expect(effects.xBombDestroyed).toBe(9);
        expect(effects.chargeGained).toBe(2);
        expect(cs.charge.black).toBe(2);
        expect(gs.board[3][3]).toBe(0);
        expect(gs.board[2][2]).toBe(0);
        expect(gs.board[2][4]).toBe(0);
        expect(gs.board[4][2]).toBe(0);
        expect(gs.board[4][4]).toBe(0);
        expect(gs.board[1][1]).toBe(0);
        expect(gs.board[1][5]).toBe(0);
        expect(gs.board[5][1]).toBe(0);
        expect(gs.board[5][5]).toBe(0);
        expect(gs.board[3][4]).toBe(-1);
        const destroyEvents = (cs._presentationEventsPersist || []).filter(e => e.type === 'DESTROY' && e.cause === 'X_BOMB' && e.reason === 'x_bomb_explosion');
        expect(destroyEvents).toHaveLength(9);
    });
    test('左拡張マスが斜め2マス先なら爆破対象に含む', () => {
        const gs = {
            currentPlayer: 1,
            board: Array.from({ length: 8 }, () => Array(8).fill(0)),
            consecutivePasses: 0,
            turnNumber: 1,
            boardExpansion: {
                active: false,
                side: null,
                row: null,
                owner: EMPTY,
                usedByPlayer: { black: false, white: false },
                cells: [{ side: 'left', row: 0, col: -1, owner: WHITE }]
            }
        };
        const cs = makeCardState();
        cs.expansionStoneIdByCell = { '0,-1': 'sx1' };
        gs.board[2][1] = BLACK;
        cs.stoneIdMap[2][1] = 's1';
        const effects = CardLogic.applyPlacementEffects(cs, gs, 'black', 2, 1, 0);
        expect(effects.xBombExploded).toBe(true);
        expect(effects.xBombDestroyed).toBe(2);
        expect(gs.board[2][1]).toBe(EMPTY);
        expect(gs.boardExpansion.cells.find((cell) => cell && cell.row === 0 && cell.col === -1).owner).toBe(EMPTY);
        const destroyEvents = (cs._presentationEventsPersist || []).filter(e => e.type === 'DESTROY' && e.cause === 'X_BOMB' && e.reason === 'x_bomb_explosion');
        expect(destroyEvents).toHaveLength(2);
        expect(destroyEvents).toEqual(expect.arrayContaining([
            expect.objectContaining({ row: 2, col: 1 }),
            expect.objectContaining({ row: 0, col: -1 })
        ]));
    });
});
//# sourceMappingURL=game.x-bomb.test.js.map