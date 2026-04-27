const mockExecutePendingSelection = jest.fn();

jest.mock('../game/card-effects/selection-flow', () => ({
    executePendingSelection: mockExecutePendingSelection
}));

const { handleLivingWillSelection } = require('../game/card-effects/living-will');

describe('living-will', () => {
    beforeEach(() => {
        mockExecutePendingSelection.mockClear();
    });

    test('module load: exported function presence', () => {
        expect(typeof handleLivingWillSelection).toBe('function');
    });

    test('正常系: LIVING_WILLでexecutePendingSelectionが正しく呼ばれる', async () => {
        mockExecutePendingSelection.mockImplementation((options) => {
            expect(options.validateResult({ result: { rawEvents: [{ type: 'living_will_selected', applied: true }] } })).toBe(true);
            return Promise.resolve({ ok: true });
        });

        await handleLivingWillSelection(4, 4, 'black');

        const callArg = mockExecutePendingSelection.mock.calls[0][0];
        expect(callArg.pendingType).toBe('LIVING_WILL');
        expect(callArg.actionPayload).toEqual({ livingWillTarget: { row: 4, col: 4 } });
        expect(callArg.invalidMessage).toBe('生きる意志を付与する自分の石を選んでください');
        expect(callArg.buildPlaybackMeta()).toEqual({ cause: 'LIVING_WILL', target: { row: 4, col: 4 } });
    });

    test('境界条件: 対象イベントがない場合は無効', async () => {
        mockExecutePendingSelection.mockImplementation((options) => {
            expect(options.validateResult({ result: { rawEvents: [{ type: 'living_will_selected', applied: false }] } })).toBe(false);
            expect(options.validateResult({ result: null })).toBe(false);
            return Promise.resolve({ ok: false });
        });

        await handleLivingWillSelection(4, 4, 'black');
    });
});
