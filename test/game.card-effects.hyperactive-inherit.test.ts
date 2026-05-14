const mockExecutePendingSelection = jest.fn();

jest.mock('../game/card-effects/selection-flow', () => ({
    executePendingSelection: mockExecutePendingSelection
}));

const { handleHyperactiveInheritSelection } = require('../game/card-effects/hyperactive-inherit.js');
describe('hyperactive-inherit', () => {
    beforeEach(() => {
        mockExecutePendingSelection.mockClear();
    });

    test('module load: exported function presence', () => {
        expect(typeof handleHyperactiveInheritSelection).toBe('function');
    });

    test('正常系: HYPERACTIVE_INHERIT_WILLでexecutePendingSelectionが正しく呼ばれる', async () => {
        mockExecutePendingSelection.mockImplementation((options) => {
            expect(options.validateResult({ result: { rawEvents: [{ type: 'hyperactive_inherit_selected', applied: true }] } })).toBe(true);
            return Promise.resolve({ ok: true });
        });

        await handleHyperactiveInheritSelection(3, 0, 'white');

        const callArg = mockExecutePendingSelection.mock.calls[0][0];
        expect(callArg.pendingType).toBe('HYPERACTIVE_INHERIT_WILL');
        expect(callArg.actionPayload).toEqual({ hyperactiveInheritTarget: { row: 3, col: 0 } });
        expect(callArg.invalidMessage).toBe('多動を継承する自分の石を選んでください');
        expect(callArg.buildPlaybackMeta()).toEqual({ cause: 'HYPERACTIVE_INHERIT_WILL', target: { row: 3, col: 0 } });
    });

    test('境界条件: 対象イベントがない場合は無効', async () => {
        mockExecutePendingSelection.mockImplementation((options) => {
            expect(options.validateResult({ result: { rawEvents: [] } })).toBe(false);
            expect(options.validateResult({ result: null })).toBe(false);
            return Promise.resolve({ ok: false });
        });

        await handleHyperactiveInheritSelection(3, 0, 'white');
    });
});
