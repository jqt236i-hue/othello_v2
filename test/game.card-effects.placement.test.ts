import { applyProtectionAfterMove, logPlacementEffects, setUIImpl } from '../game/card-effects/placement.js';
import * as LOG_MESSAGES from '../game/log-messages.js';

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
        setUIImpl({
            emitLogAdded: global.emitLogAdded,
            getCardState: () => global.cardState
        });
    });

    afterEach(() => {
        setUIImpl({});
        delete global.emitLogAdded;
        delete global.isDebugLogAvailable;
        delete global.debugLog;
        delete global.cardState;
    });

    test('logs placement messages and returns pendingType', () => {
        const move = { row: 0, col: 0, player: 1 };
        const effects = {
            rainbowStoneUsed: true,
            silverStoneUsed: true,
            chargeGained: 3,
            goldStoneUsed: true,
            crystalStoneUsed: true,
            crystalStoneGain: 12,
            protected: true,
            permaProtected: true,
            bombPlaced: true,
            dragonPlaced: true,
            ultimateDestroyGodPlaced: true,
            ultimateHyperactivePlaced: true,
            hyperactivePlaced: true,
            doublePlaceActivated: true,
            regenTriggered: 1,
            regenCapture: 2,
            breedingSpawned: 1
        };

        const res = applyProtectionAfterMove(move, effects);
        expect(global.emitLogAdded).toHaveBeenCalled();
        // Check a couple of expected messages
        expect(global.emitLogAdded).toHaveBeenCalledWith(LOG_MESSAGES.rainbowCharge(3));
        expect(global.emitLogAdded).toHaveBeenCalledWith(LOG_MESSAGES.silverCharge(3));
        expect(global.emitLogAdded).toHaveBeenCalledWith(LOG_MESSAGES.crystalCharge(12));
        expect(global.emitLogAdded).toHaveBeenCalledWith(LOG_MESSAGES.protectNext('黒'));
        expect(global.emitLogAdded).toHaveBeenCalledWith(LOG_MESSAGES.ultimateHyperactivePlaced('黒'));
        expect(res.pendingType).toBe('FREE_PLACEMENT');
    });

    test('does not log crystal wording when the next placement is not on a number cell', () => {
        const move = { row: 2, col: 3, player: 1 };
        const effects = {};

        applyProtectionAfterMove(move, effects);

        expect(global.emitLogAdded).not.toHaveBeenCalled();
    });
});
