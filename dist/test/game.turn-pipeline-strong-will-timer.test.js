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
const SharedConstants = __importStar(require("../shared-constants.js"));
const Core = __importStar(require("../game/logic/core.js"));
const CardLogic = __importStar(require("../game/logic/cards.js"));
const TurnPipelinePhases = __importStar(require("../game/turn/turn_pipeline_phases.js"));
function createPrng() {
    return {
        shuffle: (arr) => arr,
        random: () => 0
    };
}
describe('TurnPipelinePhases Strong Will timer metadata', () => {
    test('turn start emits STATUS_TICK with Strong Will countdown after owner progress advances', () => {
        const prng = createPrng();
        const cardState = CardLogic.createCardState(prng);
        const gameState = Core.createGameState();
        gameState.board = Array.from({ length: 8 }, () => Array(8).fill(Core.EMPTY));
        gameState.currentPlayer = Core.BLACK;
        cardState.debugNoDraw = true;
        cardState.presentationEvents = [];
        gameState.board[2][3] = Core.BLACK;
        cardState.markers.push({
            id: 1,
            kind: 'specialStone',
            row: 2,
            col: 3,
            owner: 'black',
            data: {
                type: 'PERMA_PROTECTED',
                strongWillPromotionOwnerTurnStarts: 0,
                strongWillPromotionThreshold: SharedConstants.STRONG_WILL_PROMOTION_OWNER_TURNS
            }
        });
        const events = [];
        TurnPipelinePhases.applyTurnStartPhase(CardLogic, Core, cardState, gameState, 'black', events, prng);
        const marker = cardState.markers.find((entry) => (entry &&
            entry.kind === 'specialStone' &&
            entry.row === 2 &&
            entry.col === 3));
        expect(marker).toBeTruthy();
        expect(marker.data.type).toBe('PERMA_PROTECTED');
        expect(marker.data.strongWillPromotionOwnerTurnStarts).toBe(1);
        const timerTick = (cardState.presentationEvents || []).find((event) => (event &&
            event.type === 'STATUS_TICK' &&
            event.row === 2 &&
            event.col === 3));
        expect(timerTick).toEqual(expect.objectContaining({
            type: 'STATUS_TICK',
            row: 2,
            col: 3,
            meta: expect.objectContaining({
                special: 'PERMA_PROTECTED',
                timer: SharedConstants.STRONG_WILL_PROMOTION_OWNER_TURNS - 1,
                owner: 'black'
            })
        }));
    });
});
//# sourceMappingURL=game.turn-pipeline-strong-will-timer.test.js.map