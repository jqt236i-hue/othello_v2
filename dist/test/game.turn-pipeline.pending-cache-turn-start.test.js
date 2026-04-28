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
const Core = __importStar(require("../game/logic/core.js"));
const CardLogic = __importStar(require("../game/logic/cards.js"));
const TurnPipelinePhases = __importStar(require("../game/turn/turn_pipeline_phases.js"));
const PendingCoordinator = __importStar(require("../game/turn/pending-coordinator.js"));
function createPrng() {
    return {
        shuffle: (arr) => arr,
        random: () => 0
    };
}
describe('TurnPipelinePhases turn start pending cache sync', () => {
    afterEach(() => {
        PendingCoordinator.clearPendingSelectionActionCache();
    });
    test('applyTurnStartPhase prunes stale pending selection cache by turnIndex before turn logic runs', () => {
        const prng = createPrng();
        const cardState = CardLogic.createCardState(prng);
        const gameState = Core.createGameState();
        const events = [];
        cardState.debugNoDraw = true;
        cardState.turnIndex = 7;
        cardState.pendingEffectByPlayer.black = {
            type: 'GUARD_WILL',
            stage: 'selectTarget'
        };
        PendingCoordinator.storePendingSelectionAction('black', { type: 'pending_selection', cardId: 'guard_01', turnIndex: 6 }, 'GUARD_WILL');
        TurnPipelinePhases.applyTurnStartPhase(CardLogic, Core, cardState, gameState, 'black', events, prng);
        expect(PendingCoordinator.readPendingSelectionAction('black')).toBeNull();
    });
    test('applyActionPhase pass clears pending selection cache even when coordinator clearPendingEffect is unavailable', () => {
        jest.resetModules();
        const pendingCoordinatorMock = {
            readPendingEffect: PendingCoordinator.readPendingEffect,
            getPendingEffectType: PendingCoordinator.getPendingEffectType,
            clearPendingSelectionAction: jest.fn((playerKey) => PendingCoordinator.clearPendingSelectionAction(playerKey)),
            syncPendingSelectionActionCache: PendingCoordinator.syncPendingSelectionActionCache
        };
        jest.doMock('../game/turn/pending-coordinator', () => pendingCoordinatorMock, { virtual: false });
        import * as isolatedTurnPipelinePhases from '../game/turn/turn_pipeline_phases.js';
        const prng = createPrng();
        const cardState = CardLogic.createCardState(prng);
        const gameState = Core.createGameState();
        const events = [];
        const getLegalMovesSpy = jest.spyOn(Core, 'getLegalMoves').mockReturnValueOnce([]);
        try {
            cardState.pendingEffectByPlayer.black = {
                type: 'GUARD_WILL',
                stage: 'selectTarget'
            };
            PendingCoordinator.storePendingSelectionAction('black', { type: 'pending_selection', cardId: 'guard_01', turnIndex: cardState.turnIndex }, 'GUARD_WILL');
            isolatedTurnPipelinePhases.applyActionPhase(CardLogic, Core, cardState, gameState, 'black', { type: 'pass' }, events, prng);
            expect(pendingCoordinatorMock.clearPendingSelectionAction).toHaveBeenCalledWith('black');
            expect(PendingCoordinator.readPendingSelectionAction('black')).toBeNull();
        }
        finally {
            getLegalMovesSpy.mockRestore();
            jest.dontMock('../game/turn/pending-coordinator');
        }
    });
});
//# sourceMappingURL=game.turn-pipeline.pending-cache-turn-start.test.js.map