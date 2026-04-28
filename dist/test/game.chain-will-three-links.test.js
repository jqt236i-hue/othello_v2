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
describe('QUAD_CHAIN_WILL three-link chaining', () => {
    test('chains up to 3 times and stops even if a 4th chain is available', () => {
        const { cardState, gameState } = (0, chain_test_helpers_js_1.makeState)(CardLogic, Shared);
        cardState.pendingEffectByPlayer.black = { type: 'QUAD_CHAIN_WILL', cardId: 'quad_chain_01', stage: null };
        (0, chain_test_helpers_js_1.placeStones)(gameState, [
            [0, 1, Shared.WHITE],
            [0, 2, Shared.BLACK],
            [1, 1, Shared.WHITE],
            [2, 1, Shared.BLACK],
            [1, 2, Shared.WHITE],
            [1, 3, Shared.BLACK],
            [2, 2, Shared.WHITE],
            [3, 2, Shared.BLACK],
            [2, 3, Shared.WHITE],
            [2, 4, Shared.BLACK]
        ]);
        const prng = { random: () => 0, shuffle: (arr) => arr };
        const res = TurnPipeline.applyTurn(cardState, gameState, 'black', { type: 'place', row: 0, col: 0 }, prng);
        expect(res.gameState.board[0][1]).toBe(Shared.BLACK);
        expect(res.gameState.board[1][1]).toBe(Shared.BLACK);
        expect(res.gameState.board[1][2]).toBe(Shared.BLACK);
        expect(res.gameState.board[2][2]).toBe(Shared.BLACK);
        expect(res.gameState.board[2][3]).toBe(Shared.WHITE);
        const chainEvent = res.events.find((e) => e && e.type === 'chain_flipped');
        expect(chainEvent).toBeTruthy();
        expect(chainEvent.details).toEqual(expect.arrayContaining([
            { row: 1, col: 1 },
            { row: 1, col: 2 },
            { row: 2, col: 2 }
        ]));
        expect(chainEvent.details).toHaveLength(3);
    });
});
//# sourceMappingURL=game.chain-will-three-links.test.js.map