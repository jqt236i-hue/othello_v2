const { createSelfplayPendingSelectionBridge } = require('../src/engine/selfplay-pending-selection-bridge.js');

describe('selfplay pending selection bridge module', () => {
    test('forwards selector bridge config and normalizes missing pending to null', () => {
        const buildPendingSelectionAction = jest.fn(() => ({ type: 'select_target' }));
        const bridge = createSelfplayPendingSelectionBridge({
            PendingTargetSelector: { buildPendingSelectionAction },
            selectors: { chooseTrapTarget: jest.fn() },
            getLegalMovesForAction: jest.fn(() => [{ row: 1, col: 1 }]),
            buildCardDecisionContext: jest.fn(() => ({ ctx: true })),
            CpuPolicyCore: { scoreCardUseDecision: jest.fn() },
            CardLogic: { getCardCost: jest.fn() }
        });

        const out = bridge.buildPendingSelectionAction({ g: 1 }, { c: 1 }, 'black', 'TRAP_WILL', { random: () => 0 }, undefined);

        expect(buildPendingSelectionAction).toHaveBeenCalledWith(expect.objectContaining({
            gameState: { g: 1 },
            cardState: { c: 1 },
            playerKey: 'black',
            pendingType: 'TRAP_WILL',
            pending: null,
            selectors: { chooseTrapTarget: expect.any(Function) },
            getLegalMovesForAction: expect.any(Function),
            buildCardDecisionContext: expect.any(Function),
            cpuPolicyCore: { scoreCardUseDecision: expect.any(Function) },
            cardLogic: { getCardCost: expect.any(Function) }
        }));
        expect(out).toEqual({ type: 'select_target' });
    });
});
