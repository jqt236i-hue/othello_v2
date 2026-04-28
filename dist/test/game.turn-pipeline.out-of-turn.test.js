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
const TurnPipeline = __importStar(require("../game/turn/turn_pipeline.js"));
describe('turn_pipeline applyTurnSafe out-of-turn guard', () => {
    test('rejects action when playerKey is not currentPlayer', () => {
        const cardState = {
            turnIndex: 0,
            pendingEffectByPlayer: { black: null, white: null },
            hasUsedCardThisTurnByPlayer: { black: false, white: false },
            charge: { black: 0, white: 0 }
        };
        const gameState = {
            currentPlayer: 'white',
            board: Array.from({ length: 8 }, () => Array(8).fill(0))
        };
        const res = TurnPipeline.applyTurnSafe(cardState, gameState, 'black', { type: 'pass' });
        expect(res.ok).toBe(false);
        expect(res.rejectedReason).toBe('OUT_OF_TURN');
        expect(Array.isArray(res.events)).toBe(true);
        expect(res.events[0].reason).toBe('OUT_OF_TURN');
    });
    test('applyTurn normalizes whitespace and case variants before delegating to phases', () => {
        jest.resetModules();
        const phaseMocks = {
            applyTurnStartPhase: jest.fn(),
            applyCardUsagePhase: jest.fn(),
            applyActionPhase: jest.fn()
        };
        jest.isolateModules(() => {
            jest.doMock('../game/logic/cards', () => ({
                flushPresentationEvents: jest.fn(() => [])
            }));
            jest.doMock('../game/logic/core', () => ({
                BLACK: 1,
                WHITE: -1
            }));
            jest.doMock('../game/turn/turn_pipeline_phases', () => phaseMocks);
            jest.doMock('../game/logic/board_ops', () => ({}));
            import * as isolatedTurnPipeline from '../game/turn/turn_pipeline.js';
            isolatedTurnPipeline.applyTurn({ turnIndex: 0, presentationEvents: [], pendingEffectByPlayer: { black: null, white: null } }, { currentPlayer: -1, board: Array.from({ length: 8 }, () => Array(8).fill(0)) }, ' WHITE ', { type: 'pass' });
        });
        expect(phaseMocks.applyTurnStartPhase).toHaveBeenCalledWith(expect.any(Object), expect.any(Object), expect.any(Object), expect.any(Object), 'white', expect.any(Array), undefined);
        expect(phaseMocks.applyCardUsagePhase).toHaveBeenCalledWith(expect.any(Object), expect.any(Object), expect.any(Object), 'white', expect.any(Object), expect.any(Array), undefined);
        expect(phaseMocks.applyActionPhase).toHaveBeenCalledWith(expect.any(Object), expect.any(Object), expect.any(Object), expect.any(Object), 'white', expect.any(Object), expect.any(Array), undefined, expect.any(Object));
    });
});
//# sourceMappingURL=game.turn-pipeline.out-of-turn.test.js.map