const mockExecutePendingSelection = jest.fn();

jest.mock('../game/card-effects/selection-flow', () => ({
    executePendingSelection: mockExecutePendingSelection
}));

const { handleMeteorSelection } = require('../game/card-effects/meteor.js');
describe('meteor', () => {
    beforeEach(() => {
        mockExecutePendingSelection.mockClear();
    });

    test('module load: exported function presence', () => {
        expect(typeof handleMeteorSelection).toBe('function');
    });

    test('正常系: METEOR_WILLでexecutePendingSelectionが正しく呼ばれる', async () => {
        mockExecutePendingSelection.mockImplementation((options) => {
            expect(options.validateResult({ result: { rawEvents: [{ type: 'meteor_selected', applied: true }] } })).toBe(true);
            return Promise.resolve({ ok: true });
        });

        await handleMeteorSelection(5, 5, 'white');

        const callArg = mockExecutePendingSelection.mock.calls[0][0];
        expect(callArg.pendingType).toBe('METEOR_WILL');
        expect(callArg.actionPayload).toEqual({ meteorTarget: { row: 5, col: 5 } });
        expect(callArg.invalidMessage).toBe('破壊するマスを選んでください');
        expect(callArg.buildPlaybackMeta()).toEqual({ cause: 'METEOR_WILL', target: { row: 5, col: 5 } });
    });

    test('境界条件: 対象イベントがない場合は無効', async () => {
        mockExecutePendingSelection.mockImplementation((options) => {
            expect(options.validateResult({ result: { rawEvents: [{ type: 'meteor_selected', applied: false }] } })).toBe(false);
            expect(options.validateResult({ result: undefined })).toBe(false);
            return Promise.resolve({ ok: false });
        });

        await handleMeteorSelection(5, 5, 'white');
    });
});
