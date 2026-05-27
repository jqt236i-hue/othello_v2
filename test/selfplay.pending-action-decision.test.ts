const { createSelfplayPendingActionDecision } = require('../src/engine/selfplay-pending-action-decision.js');

describe('selfplay pending action decision module', () => {
    test('returns built pending action when selectTarget pending exists', () => {
        const buildPendingSelectionAction = jest.fn(() => ({ type: 'select_target', row: 1, col: 2 }));
        const decision = createSelfplayPendingActionDecision({ buildPendingSelectionAction });
        const rng = { random: () => 0 };
        const pending = { stage: 'selectTarget', type: 'TRAP_WILL' };

        const result = decision.decidePendingAction({
            activeGameState: { g: 1 },
            activeCardState: { c: 1 },
            playerKey: 'black',
            pending,
            rng,
            legalMoves: [{ row: 0, col: 0 }]
        });

        expect(buildPendingSelectionAction).toHaveBeenCalledWith(
            { g: 1 },
            { c: 1 },
            'black',
            'TRAP_WILL',
            rng,
            pending
        );
        expect(result).toEqual({
            action: { type: 'select_target', row: 1, col: 2 },
            legalMoves: [{ row: 0, col: 0 }]
        });
    });

    test('falls back to cancel_card when pending builder returns null', () => {
        const decision = createSelfplayPendingActionDecision({
            buildPendingSelectionAction: jest.fn(() => null)
        });

        const result = decision.decidePendingAction({
            activeGameState: {},
            activeCardState: {},
            playerKey: 'black',
            pending: { stage: 'selectTarget', type: 'HEAVEN_BLESSING' },
            rng: {},
            legalMoves: []
        });

        expect(result).toEqual({
            action: { type: 'cancel_card', cancelOptions: { refundCost: false, resetUsage: true } },
            legalMoves: []
        });
    });

    test('returns null when there is no selectTarget pending state', () => {
        const buildPendingSelectionAction = jest.fn();
        const decision = createSelfplayPendingActionDecision({ buildPendingSelectionAction });

        expect(decision.decidePendingAction({
            activeGameState: {},
            activeCardState: {},
            playerKey: 'black',
            pending: null,
            rng: {},
            legalMoves: []
        })).toBeNull();

        expect(decision.decidePendingAction({
            activeGameState: {},
            activeCardState: {},
            playerKey: 'black',
            pending: { stage: 'resolve', type: 'TRAP_WILL' },
            rng: {},
            legalMoves: []
        })).toBeNull();

        expect(buildPendingSelectionAction).not.toHaveBeenCalled();
    });
});
