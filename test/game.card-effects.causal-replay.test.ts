const mockExecutePendingSelection = jest.fn();

jest.mock('../game/card-effects/selection-flow', () => ({
    executePendingSelection: mockExecutePendingSelection
}));

const { handleCausalReplaySelection } = require('../game/card-effects/causal-replay.js');

describe('causal replay card effect bridge', () => {
    beforeEach(() => {
        mockExecutePendingSelection.mockClear();
    });

    test('CAUSAL_REPLAY_WILL selection delegates to pending selection flow', async () => {
        mockExecutePendingSelection.mockImplementation((options) => {
            expect(options.validateResult({ result: { rawEvents: [{ type: 'causal_replay_selected', applied: true }] } })).toBe(true);
            return Promise.resolve({ ok: true });
        });

        await handleCausalReplaySelection(2, 3, 'black');

        const callArg = mockExecutePendingSelection.mock.calls[0][0];
        expect(callArg.pendingType).toBe('CAUSAL_REPLAY_WILL');
        expect(callArg.actionPayload).toEqual({ causalReplayTarget: { row: 2, col: 3 } });
        expect(callArg.invalidMessage).toBe('再生する穴マスを選んでください');
        expect(callArg.buildPlaybackMeta()).toEqual({ cause: 'CAUSAL_REPLAY_WILL', target: { row: 2, col: 3 } });
    });

    test('failed causal replay selection is treated as invalid', async () => {
        mockExecutePendingSelection.mockImplementation((options) => {
            expect(options.validateResult({ result: { rawEvents: [{ type: 'causal_replay_selected', applied: false }] } })).toBe(false);
            expect(options.validateResult({ result: undefined })).toBe(false);
            return Promise.resolve({ ok: false });
        });

        await handleCausalReplaySelection(2, 3, 'black');
    });
});
