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
const PendingCoordinator = __importStar(require("../game/turn/pending-coordinator.js"));
function makeNoMoveState() {
    const cardState = CardLogic.createCardState({ shuffle: (arr) => arr });
    const gameState = {
        board: Array.from({ length: 8 }, () => Array(8).fill(Shared.BLACK)),
        currentPlayer: Shared.BLACK,
        turnNumber: 1,
        consecutivePasses: 0
    };
    gameState.board[0][0] = Shared.EMPTY;
    return { cardState, gameState };
}
describe('pass clears pending card effect', () => {
    afterEach(() => {
        PendingCoordinator.clearPendingSelectionAction('black');
        PendingCoordinator.clearPendingSelectionAction('white');
    });
    test('clears placement-wait pending on pass', () => {
        const { cardState, gameState } = makeNoMoveState();
        cardState.pendingEffectByPlayer.black = { type: 'DOUBLE_CHAIN_WILL', cardId: 'double_chain_01', stage: null };
        const res = TurnPipeline.applyTurn(cardState, gameState, 'black', { type: 'pass' });
        expect(res.cardState.pendingEffectByPlayer.black).toBeNull();
    });
    test('clears target-selection pending on pass', () => {
        const { cardState, gameState } = makeNoMoveState();
        cardState.pendingEffectByPlayer.black = { type: 'DESTROY_ONE_STONE', cardId: 'destroy_01', stage: 'selectTarget' };
        const res = TurnPipeline.applyTurn(cardState, gameState, 'black', { type: 'pass' });
        expect(res.cardState.pendingEffectByPlayer.black).toBeNull();
    });
    test('clears cached pending selection action on pass', () => {
        global.ActionManager = {
            ActionManager: {
                createAction: (type, player, extra) => ({ type, player, ...(extra || {}) })
            }
        };
        const { cardState, gameState } = makeNoMoveState();
        cardState.pendingEffectByPlayer.black = { type: 'DESTROY_ONE_STONE', cardId: 'destroy_01', stage: 'selectTarget' };
        PendingCoordinator.createPendingSelectionAction('black', 'DESTROY_ONE_STONE', { destroyTarget: { row: 2, col: 3 } }, { cardState });
        TurnPipeline.applyTurn(cardState, gameState, 'black', { type: 'pass' });
        expect(cardState.pendingEffectByPlayer.black).toBeNull();
        expect(PendingCoordinator.readPendingSelectionAction('black')).toBeNull();
        delete global.ActionManager;
    });
});
//# sourceMappingURL=game.pass-clears-pending.test.js.map