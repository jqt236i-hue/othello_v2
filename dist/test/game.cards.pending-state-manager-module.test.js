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
const PendingStateManager = __importStar(require("../game/logic/cards-internal/pending-state-manager.js"));
describe('CardPendingStateManager', () => {
    test('requiresTargetSelection distinguishes pending selector cards', () => {
        expect(PendingStateManager.requiresTargetSelection('DESTROY_ONE_STONE')).toBe(true);
        expect(PendingStateManager.requiresTargetSelection('BOARD_EXPANSION_GOD')).toBe(true);
        expect(PendingStateManager.requiresTargetSelection('BOARD_SHRINK_WILL')).toBe(true);
        expect(PendingStateManager.requiresTargetSelection('BOARD_SHRINK_GOD')).toBe(true);
        expect(PendingStateManager.requiresTargetSelection('LIVING_WILL')).toBe(true);
        expect(PendingStateManager.requiresTargetSelection('DOUBLE_CHAIN_WILL')).toBe(false);
        expect(PendingStateManager.requiresTargetSelection('')).toBe(false);
    });
    test('createPendingEffectState seeds selection metadata by card type', () => {
        expect(PendingStateManager.createPendingEffectState({
            cardType: 'BOARD_EXPANSION_GOD',
            cardId: 'expansion_god_01'
        })).toEqual(expect.objectContaining({
            type: 'BOARD_EXPANSION_GOD',
            stage: 'selectTarget',
            selectedCount: 0,
            maxSelections: 2,
            selectedTargets: []
        }));
        expect(PendingStateManager.createPendingEffectState({
            cardType: 'BOARD_SHRINK_WILL',
            cardId: 'board_shrink_01'
        })).toEqual(expect.objectContaining({
            type: 'BOARD_SHRINK_WILL',
            stage: 'selectTarget',
            selectedCount: 0,
            maxSelections: 3,
            selectedTargets: []
        }));
        expect(PendingStateManager.createPendingEffectState({
            cardType: 'LAST_RESORT',
            cardId: 'last_resort_01',
            needsSelection: false
        })).toEqual(expect.objectContaining({
            type: 'LAST_RESORT',
            stage: null,
            placementsRemaining: 3
        }));
    });
    test('cancelPendingSelection refunds and restores the card for cancellable pending cards', () => {
        const cardState = {
            pendingEffectByPlayer: {
                black: { type: 'DESTROY_ONE_STONE', cardId: 'destroy_01', stage: 'selectTarget' },
                white: null
            },
            hands: { black: [], white: [] },
            discard: ['destroy_01'],
            charge: { black: 0, white: 0 },
            hasUsedCardThisTurnByPlayer: { black: true, white: false },
            cardUseCountByPlayer: { black: 1, white: 0 }
        };
        const res = PendingStateManager.cancelPendingSelection(cardState, 'black', null, {
            helpers: {
                getCardDef: () => ({ id: 'destroy_01', cost: 4 }),
                addChargeValue: (state, playerKey, amount) => {
                    state.charge[playerKey] += amount;
                }
            }
        });
        expect(res).toEqual({ canceled: true, cardId: 'destroy_01' });
        expect(cardState.pendingEffectByPlayer.black).toBeNull();
        expect(cardState.hands.black).toContain('destroy_01');
        expect(cardState.discard).not.toContain('destroy_01');
        expect(cardState.charge.black).toBe(4);
        expect(cardState.hasUsedCardThisTurnByPlayer.black).toBe(false);
        expect(cardState.cardUseCountByPlayer.black).toBe(0);
    });
    test('exports shared pending selection contract helpers', () => {
        expect(PendingStateManager.resolvePendingSelectionContract('HEAVEN_BLESSING')).toEqual(expect.objectContaining({
            kind: 'hand_overlay',
            turnOutcome: 'continue_turn',
            deferNetworkPublish: true
        }));
        expect(PendingStateManager.resolvePendingSelectionContract('CAPTURE_WILL')).toEqual(expect.objectContaining({
            kind: 'continue_turn',
            turnOutcome: 'continue_turn',
            deferNetworkPublish: true
        }));
        expect(PendingStateManager.resolvePendingSelectionContract('LIVING_WILL')).toEqual(expect.objectContaining({
            kind: 'continue_turn',
            turnOutcome: 'continue_turn',
            deferNetworkPublish: true
        }));
        expect(PendingStateManager.resolvePendingSelectionContract('BOARD_SHRINK_GOD')).toEqual(expect.objectContaining({
            kind: 'multi_stage',
            turnOutcome: 'continue_turn',
            deferNetworkPublish: true
        }));
        expect(PendingStateManager.shouldDeferNetworkPublishForPendingType('CAPTURE_WILL')).toBe(true);
        expect(PendingStateManager.shouldDeferNetworkPublishForPendingType('GUARD_WILL')).toBe(true);
        expect(PendingStateManager.shouldWaitForPlaybackIdleForPendingType('TEMPT_WILL')).toBe(true);
        expect(PendingStateManager.isSelectionOnlyEndTurnPendingType('TRAP_WILL')).toBe(true);
        expect(PendingStateManager.isSelectionOnlyEndTurnPendingType('GUARD_WILL')).toBe(false);
    });
    test('resolves shared pending selection dispatch keys for aliases and overlays', () => {
        expect(PendingStateManager.resolvePendingSelectionDispatchKey('GUARD_WILL')).toBe('guard');
        expect(PendingStateManager.resolvePendingSelectionDispatchKey('GUARDIAN_GOD')).toBe('guard');
        expect(PendingStateManager.resolvePendingSelectionDispatchKey('TELEPORT_WILL')).toBe('teleport');
        expect(PendingStateManager.resolvePendingSelectionDispatchKey('CELL_TELEPORT_WILL')).toBe('cell_teleport');
        expect(PendingStateManager.resolvePendingSelectionDispatchKey('BOARD_EXPANSION_GOD')).toBe('board_expansion');
        expect(PendingStateManager.resolvePendingSelectionDispatchKey('BOARD_SHRINK_WILL')).toBe('board_shrink');
        expect(PendingStateManager.resolvePendingSelectionDispatchKey('BOARD_SHRINK_GOD')).toBe('board_shrink');
        expect(PendingStateManager.resolvePendingSelectionDispatchKey('LIVING_WILL')).toBe('living_will');
        expect(PendingStateManager.resolvePendingSelectionDispatchKey('HEAVEN_BLESSING')).toBe('heaven_blessing');
        expect(PendingStateManager.resolvePendingSelectionDispatchKey('')).toBeNull();
    });
    test('keeps target selection, cancellation, and dispatch helpers aligned for shared pending contracts', () => {
        const cases = [
            ['DESTROY_ONE_STONE', { requiresTarget: true, cancellable: true, dispatchKey: 'destroy' }],
            ['CAPTURE_WILL', { requiresTarget: true, cancellable: false, dispatchKey: 'capture' }],
            ['BOARD_SHRINK_GOD', { requiresTarget: true, cancellable: true, dispatchKey: 'board_shrink' }],
            ['CONDEMN_WILL', { requiresTarget: true, cancellable: false, dispatchKey: 'condemn' }],
            ['DOUBLE_CHAIN_WILL', { requiresTarget: false, cancellable: false, dispatchKey: null }]
        ];
        for (const [cardType, expected] of cases) {
            expect(PendingStateManager.requiresTargetSelection(cardType)).toBe(expected.requiresTarget);
            expect(PendingStateManager.isCancellablePendingType(cardType)).toBe(expected.cancellable);
            expect(PendingStateManager.resolvePendingSelectionDispatchKey(cardType)).toBe(expected.dispatchKey);
        }
    });
    test('freezes contract coverage for every pending-selection card type', () => {
        const contractEntries = Object.entries(PendingStateManager.PENDING_SELECTION_CONTRACTS);
        expect(contractEntries.length).toBeGreaterThan(0);
        for (const [cardType, contract] of contractEntries) {
            expect(PendingStateManager.requiresTargetSelection(cardType)).toBe(true);
            expect(PendingStateManager.resolvePendingSelectionContract(cardType)).toBe(contract);
            expect(PendingStateManager.shouldDeferNetworkPublishForPendingType(cardType)).toBe(true);
            expect(PendingStateManager.shouldWaitForPlaybackIdleForPendingType(cardType)).toBe(true);
            expect(PendingStateManager.resolvePendingSelectionDispatchKey(cardType)).toEqual(expect.any(String));
            expect(contract).toEqual(expect.objectContaining({
                kind: expect.any(String),
                turnOutcome: expect.any(String),
                deferNetworkPublish: true,
                waitForPlaybackIdle: true
            }));
        }
    });
});
//# sourceMappingURL=game.cards.pending-state-manager-module.test.js.map