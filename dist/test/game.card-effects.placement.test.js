"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const placement_js_1 = require("../game/card-effects/placement.js");
const LOG_MESSAGES = __importStar(require("../game/log-messages.js"));
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
            rainbowStoneUsed: true,
            silverStoneUsed: true,
            chargeGained: 3,
            goldStoneUsed: true,
            crystalStoneUsed: true,
            crystalStoneGain: 12,
            plunderAmount: 5,
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
        const res = (0, placement_js_1.applyProtectionAfterMove)(move, effects);
        expect(global.emitLogAdded).toHaveBeenCalled();
        // Check a couple of expected messages
        expect(global.emitLogAdded).toHaveBeenCalledWith(LOG_MESSAGES.rainbowCharge(3));
        expect(global.emitLogAdded).toHaveBeenCalledWith(LOG_MESSAGES.silverCharge(3));
        expect(global.emitLogAdded).toHaveBeenCalledWith(LOG_MESSAGES.crystalCharge(12));
        expect(global.emitLogAdded).toHaveBeenCalledWith(LOG_MESSAGES.plunderPoints(5));
        expect(global.emitLogAdded).toHaveBeenCalledWith(LOG_MESSAGES.protectNext('黒'));
        expect(global.emitLogAdded).toHaveBeenCalledWith(LOG_MESSAGES.ultimateHyperactivePlaced('黒'));
        expect(res.pendingType).toBe('FREE_PLACEMENT');
    });
    test('logs crystal zero-gain wording without implying a bonus was gained', () => {
        const move = { row: 2, col: 3, player: 1 };
        const effects = {
            crystalStoneUsed: true,
            crystalStoneGain: 0
        };
        (0, placement_js_1.applyProtectionAfterMove)(move, effects);
        expect(global.emitLogAdded).toHaveBeenCalledWith('水晶の意志：数字マスなしで増加なし');
    });
});
//# sourceMappingURL=game.card-effects.placement.test.js.map