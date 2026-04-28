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
const CardLogic = __importStar(require("../game/logic/cards.js"));
function isBombMarker(marker) {
    return !!(marker &&
        marker.kind === 'specialStone' &&
        marker.data &&
        marker.data.category === 'bomb');
}
function createStates() {
    const prng = { shuffle: (arr) => arr, random: () => 0.5 };
    const cardState = CardLogic.createCardState(prng);
    const gameState = {
        board: Array.from({ length: 8 }, () => Array(8).fill(0)),
        currentPlayer: 1,
        turnNumber: 0,
        consecutivePasses: 0
    };
    return { cardState, gameState };
}
describe('TIME_BOMB selection behavior', () => {
    test('card use requires at least one own stone target', () => {
        const def = SharedConstants.CARD_DEFS.find((d) => d && d.type === 'TIME_BOMB');
        expect(def).toBeTruthy();
        const { cardState, gameState } = createStates();
        cardState.hands.black = [def.id];
        cardState.charge.black = def.cost;
        const okWithoutOwnStone = CardLogic.applyCardUsage(cardState, gameState, 'black', def.id);
        expect(okWithoutOwnStone).toBe(false);
        gameState.board[3][3] = 1;
        const okWithOwnStone = CardLogic.applyCardUsage(cardState, gameState, 'black', def.id);
        expect(okWithOwnStone).toBe(true);
        expect(cardState.pendingEffectByPlayer.black && cardState.pendingEffectByPlayer.black.type).toBe('TIME_BOMB');
        expect(cardState.pendingEffectByPlayer.black && cardState.pendingEffectByPlayer.black.stage).toBe('selectTarget');
    });
    test('applyTimeBombWill converts selected own stone to bomb and clears pending', () => {
        const { cardState, gameState } = createStates();
        gameState.board[2][2] = 1;
        cardState.pendingEffectByPlayer.black = { type: 'TIME_BOMB', stage: 'selectTarget', cardId: 'bomb_01' };
        const applied = CardLogic.applyTimeBombWill(cardState, gameState, 'black', 2, 2);
        expect(applied && applied.applied).toBe(true);
        expect(cardState.pendingEffectByPlayer.black).toBeNull();
        const bomb = (cardState.markers || []).find((m) => isBombMarker(m) && m.row === 2 && m.col === 2 && m.owner === 'black');
        expect(bomb).toBeTruthy();
        expect(bomb.data && typeof bomb.data.remainingTurns).toBe('number');
        expect(bomb.data && bomb.data.type).toBe('TIME_BOMB');
    });
    test('placement effects no longer place bomb from TIME_BOMB pending', () => {
        const { cardState, gameState } = createStates();
        gameState.board[4][4] = 1;
        cardState.pendingEffectByPlayer.black = { type: 'TIME_BOMB', stage: 'selectTarget', cardId: 'bomb_01' };
        const effects = CardLogic.applyPlacementEffects(cardState, gameState, 'black', 4, 4, 1);
        expect(effects.bombPlaced).toBeFalsy();
        const bomb = (cardState.markers || []).find((m) => isBombMarker(m) && m.row === 4 && m.col === 4);
        expect(bomb).toBeFalsy();
    });
});
//# sourceMappingURL=game.time-bomb-selection.test.js.map