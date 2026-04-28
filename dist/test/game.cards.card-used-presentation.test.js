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
const PendingCoordinator = __importStar(require("../game/turn/pending-coordinator.js"));
describe('CardLogic applyCardUsage presentation event', () => {
    afterEach(() => {
        PendingCoordinator.clearPendingSelectionActionCache();
    });
    test('emits CARD_USED presentation event', () => {
        const defs = Array.isArray(SharedConstants.CARD_DEFS) ? SharedConstants.CARD_DEFS : [];
        const def = defs.find(d => d && d.id && d.type !== 'TEMPT_WILL');
        expect(def).toBeTruthy();
        const prng = { shuffle: () => { }, random: () => 0.5 };
        const cardState = CardLogic.createCardState(prng);
        cardState.hands.black = [def.id];
        cardState.charge.black = Number.isFinite(def.cost) ? def.cost : 0;
        cardState.presentationEvents = [];
        const ok = CardLogic.applyCardUsage(cardState, 'black', def.id);
        expect(ok).toBe(true);
        expect(cardState.presentationEvents.some(ev => ev && ev.type === 'CARD_USED' && ev.cardId === def.id)).toBe(true);
        expect(cardState.cardUseCountByPlayer.black).toBe(1);
    });
    test('cancelPendingSelection reverts card use counter for cancellable cards', () => {
        const defs = Array.isArray(SharedConstants.CARD_DEFS) ? SharedConstants.CARD_DEFS : [];
        const def = defs.find(d => d && d.id && d.type === 'DESTROY_ONE_STONE');
        expect(def).toBeTruthy();
        const prng = { shuffle: () => { }, random: () => 0.5 };
        const cardState = CardLogic.createCardState(prng);
        const gameState = { board: Array.from({ length: 8 }, () => Array(8).fill(0)), currentPlayer: 1 };
        cardState.hands.black = [def.id];
        cardState.charge.black = Number.isFinite(def.cost) ? def.cost : 0;
        const ok = CardLogic.applyCardUsage(cardState, gameState, 'black', def.id);
        expect(ok).toBe(true);
        expect(cardState.cardUseCountByPlayer.black).toBe(1);
        PendingCoordinator.storePendingSelectionAction('black', { type: 'pending_selection', cardId: def.id, turnIndex: cardState.turnIndex || 0 }, 'DESTROY_ONE_STONE');
        const canceled = CardLogic.cancelPendingSelection(cardState, 'black');
        expect(canceled && canceled.canceled).toBe(true);
        expect(cardState.cardUseCountByPlayer.black).toBe(0);
        expect(PendingCoordinator.readPendingSelectionAction('black')).toBeNull();
    });
});
//# sourceMappingURL=game.cards.card-used-presentation.test.js.map