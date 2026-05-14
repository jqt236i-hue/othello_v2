const mockExecutePendingSelection = jest.fn();

jest.mock('../game/card-effects/selection-flow', () => ({
    executePendingSelection: mockExecutePendingSelection
}));

const { handleFreezeSelection } = require('../game/card-effects/freeze.js');
describe('freeze', () => {
    beforeEach(() => {
        mockExecutePendingSelection.mockClear();
    });

    test('module load: exported function presence', () => {
        expect(typeof handleFreezeSelection).toBe('function');
    });

    test('正常系: FREEZE_WILLでexecutePendingSelectionが正しく呼ばれる', async () => {
        mockExecutePendingSelection.mockImplementation((options) => {
            expect(options.validateResult({ result: { rawEvents: [{ type: 'freeze_selected', applied: true }] } })).toBe(true);
            return Promise.resolve({ ok: true });
        });

        await handleFreezeSelection(6, 1, 'black');

        const callArg = mockExecutePendingSelection.mock.calls[0][0];
        expect(callArg.pendingType).toBe('FREEZE_WILL');
        expect(callArg.actionPayload).toEqual({ freezeTarget: { row: 6, col: 1 } });
        expect(callArg.invalidMessage).toBe('凍結するマスを選んでください');
        expect(callArg.buildPlaybackMeta()).toEqual({ cause: 'FREEZE_WILL', target: { row: 6, col: 1 } });
    });

    test('境界条件: 対象イベントがない場合は無効', async () => {
        mockExecutePendingSelection.mockImplementation((options) => {
            expect(options.validateResult({ result: { rawEvents: [{ type: 'freeze_selected', applied: false }] } })).toBe(false);
            expect(options.validateResult({ result: undefined })).toBe(false);
            return Promise.resolve({ ok: false });
        });

        await handleFreezeSelection(6, 1, 'black');
    });
});
