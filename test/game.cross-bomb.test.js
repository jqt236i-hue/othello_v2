const path = require('path');

describe('CROSS_BOMB (十字爆弾)', () => {
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
            pendingEffectByPlayer: { black: { type: 'CROSS_BOMB' }, white: null },
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

    test('通常反転後に中心+十字8マスを即時破壊し、破壊では布石を獲得しない', () => {
        const gs = {
            currentPlayer: 1,
            board: Array.from({ length: 8 }, () => Array(8).fill(0)),
            consecutivePasses: 0,
            turnNumber: 1
        };
        const cs = makeCardState();

        // Center + cross targets (distance 1 and 2)
        gs.board[3][3] = 1;
        gs.board[2][3] = -1;
        gs.board[4][3] = 1;
        gs.board[3][2] = -1;
        gs.board[3][4] = 1;
        gs.board[1][3] = -1;
        gs.board[5][3] = 1;
        gs.board[3][1] = -1;
        gs.board[3][5] = 1;
        // Diagonal (must survive)
        gs.board[2][2] = -1;

        // Give stone ids for destroy presentation checks
        cs.stoneIdMap[3][3] = 's1';
        cs.stoneIdMap[2][3] = 's2';
        cs.stoneIdMap[4][3] = 's3';
        cs.stoneIdMap[3][2] = 's4';
        cs.stoneIdMap[3][4] = 's5';
        cs.stoneIdMap[1][3] = 's7';
        cs.stoneIdMap[5][3] = 's8';
        cs.stoneIdMap[3][1] = 's9';
        cs.stoneIdMap[3][5] = 's10';
        cs.stoneIdMap[2][2] = 's6';

        // Special markers on targets should not protect from destroy
        cs.markers.push({
            id: 'm1',
            kind: 'specialStone',
            row: 2,
            col: 3,
            owner: 'white',
            data: { type: 'PERMA_PROTECTED' }
        });
        cs.markers.push({
            id: 'm2',
            kind: 'bomb',
            row: 3,
            col: 4,
            owner: 'black',
            data: { remainingTurns: 2 }
        });

        const effects = CardLogic.applyPlacementEffects(cs, gs, 'black', 3, 3, 2);

        expect(effects.crossBombExploded).toBe(true);
        expect(effects.crossBombDestroyed).toBe(9);
        expect(effects.chargeGained).toBe(2);
        expect(cs.charge.black).toBe(2);

        expect(gs.board[3][3]).toBe(0);
        expect(gs.board[2][3]).toBe(0);
        expect(gs.board[4][3]).toBe(0);
        expect(gs.board[3][2]).toBe(0);
        expect(gs.board[3][4]).toBe(0);
        expect(gs.board[1][3]).toBe(0);
        expect(gs.board[5][3]).toBe(0);
        expect(gs.board[3][1]).toBe(0);
        expect(gs.board[3][5]).toBe(0);
        expect(gs.board[2][2]).toBe(-1);

        // Markers at destroyed cells are removed
        const markerAt23 = cs.markers.find(m => m.row === 2 && m.col === 3);
        const markerAt34 = cs.markers.find(m => m.row === 3 && m.col === 4);
        expect(markerAt23).toBeUndefined();
        expect(markerAt34).toBeUndefined();

        const destroyEvents = (cs._presentationEventsPersist || []).filter(
            e => e.type === 'DESTROY' && e.cause === 'CROSS_BOMB' && e.reason === 'cross_bomb_explosion'
        );
        expect(destroyEvents).toHaveLength(9);
    });
});
