const { applyProtectionAfterMove, logPlacementEffects } = require('../game/card-effects/placement');
const LOG_MESSAGES = require('../game/log-messages');

describe('applyProtectionAfterMove', () => {
    beforeEach(() => {
        global.emitLogAdded = jest.fn();
        global.isDebugLogAvailable = jest.fn(() => false);
        global.debugLog = jest.fn();
        global.getPlayerName = jest.fn(player => player === 1 ? '黒' : '白');
        global.getPlayerKey = jest.fn(player => player === 1 ? 'black' : 'white');
        global.getPlayerDisplayName = jest.fn(player => player === 1 ? '黒' : '白');
        global.LOG_MESSAGES = require('../game/log-messages');
        global.BLACK = 1;
        global.WHITE = -1;
        global.cardState = { pendingEffectByPlayer: { black: { type: 'FREE_PLACEMENT' } } };
    });

    afterEach(() => {
        delete global.emitLogAdded;
        delete global.isDebugLogAvailable;
        delete global.debugLog;
        delete global.cardState;
    });

    test('logs placement messages and returns pendingType', () => {
        const move = { row: 0, col: 0, player: 1 };
        const effects = {
            silverStoneUsed: true,
            chargeGained: 3,
            goldStoneUsed: true,
            plunderAmount: 5,
            stolenCount: 2,
            protected: true,
            permaProtected: true,
            bombPlaced: true,
            dragonPlaced: true,
            ultimateDestroyGodPlaced: true,
            hyperactivePlaced: true,
            doublePlaceActivated: true,
            regenTriggered: 1,
            regenCapture: 2,
            breedingSpawned: 1
        };

        const res = applyProtectionAfterMove(move, effects);
        expect(global.emitLogAdded).toHaveBeenCalled();
        // Check a couple of expected messages
        expect(global.emitLogAdded).toHaveBeenCalledWith(LOG_MESSAGES.silverCharge(3));
        expect(global.emitLogAdded).toHaveBeenCalledWith(LOG_MESSAGES.plunderPoints(5));
        expect(global.emitLogAdded).toHaveBeenCalledWith(LOG_MESSAGES.protectNext('黒'));
        expect(res.pendingType).toBe('FREE_PLACEMENT');
    });
});
