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
const Shared = __importStar(require("../shared-constants.js"));
const CardLogic = __importStar(require("../game/logic/cards.js"));
const TurnPipeline = __importStar(require("../game/turn/turn_pipeline.js"));
const chain_test_helpers_js_1 = require("./helpers/chain-test-helpers.js");
describe('DOUBLE_CHAIN_WILL single-direction selection per link', () => {
    test('when multiple chain directions are available, only one direction is applied for the link', () => {
        const { cardState, gameState } = (0, chain_test_helpers_js_1.makeState)(CardLogic, Shared);
        cardState.pendingEffectByPlayer.black = { type: 'DOUBLE_CHAIN_WILL', cardId: 'double_chain_01', stage: null };
        (0, chain_test_helpers_js_1.placeStones)(gameState, [
            // Place at (2,2) to create one primary flip at (3,3).
            [3, 3, Shared.WHITE],
            [4, 4, Shared.BLACK],
            // From (3,3), two chain directions are available:
            // right -> (3,4) (with terminator at (3,5))
            // down  -> (4,3) (with terminator at (5,3))
            [3, 4, Shared.WHITE],
            [3, 5, Shared.BLACK],
            [4, 3, Shared.WHITE],
            [5, 3, Shared.BLACK]
        ]);
        // Deterministic tie-break
        const prng = { random: () => 0, shuffle: (arr) => arr };
        const res = TurnPipeline.applyTurn(cardState, gameState, 'black', { type: 'place', row: 2, col: 2 }, prng);
        // Primary flip applied
        expect(res.gameState.board[3][3]).toBe(Shared.BLACK);
        // Exactly one of the two directional candidates must be flipped by chain.
        const c1 = res.gameState.board[3][4] === Shared.BLACK;
        const c2 = res.gameState.board[4][3] === Shared.BLACK;
        expect((c1 ? 1 : 0) + (c2 ? 1 : 0)).toBe(1);
        const chainEvent = res.events.find((e) => e && e.type === 'chain_flipped');
        expect(chainEvent).toBeTruthy();
        expect(Array.isArray(chainEvent.details)).toBe(true);
        expect(chainEvent.details.length).toBe(1);
    });
});
//# sourceMappingURL=game.chain-will-single-direction-choice.test.js.map