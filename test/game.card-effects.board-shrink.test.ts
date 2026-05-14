const mockExecutePendingSelection = jest.fn();

jest.mock('../game/card-effects/selection-flow', () => ({
    executePendingSelection: mockExecutePendingSelection
}));

const { handleBoardShrinkSelection } = require('../game/card-effects/board-shrink.js');
describe('board-shrink', () => {
    beforeEach(() => {
        mockExecutePendingSelection.mockClear();
    });

    test('module load: exported function presence', () => {
        expect(typeof handleBoardShrinkSelection).toBe('function');
    });

    test('正常系: BOARD_SHRINK_WILL/GODでexecutePendingSelectionが正しく呼ばれる', async () => {
        mockExecutePendingSelection.mockImplementation((options) => {
            expect(options.validateResult({ result: { rawEvents: [{ type: 'board_shrink_selected', applied: true }] } })).toBe(true);
            return Promise.resolve({ ok: true });
        });

        await handleBoardShrinkSelection(7, 0, 'black');

        const callArg = mockExecutePendingSelection.mock.calls[0][0];
        expect(callArg.pendingTypes).toEqual(['BOARD_SHRINK_WILL', 'BOARD_SHRINK_GOD']);
        expect(callArg.actionPayload).toEqual({ shrinkTarget: { row: 7, col: 0 } });
        expect(callArg.invalidMessage({ pendingType: 'BOARD_SHRINK_WILL' })).toBe('外周のマスを3つ選んで盤面を縮小してください');
        expect(callArg.invalidMessage({ pendingType: 'BOARD_SHRINK_GOD', pending: {} })).toBe('縮小する辺の角マスを選んでください');
        expect(callArg.invalidMessage({ pendingType: 'BOARD_SHRINK_GOD', pending: { firstTarget: { row: 7, col: 0 } } })).toBe('角から伸ばす辺方向を選んでください');
        expect(callArg.buildPlaybackMeta({ pendingType: 'BOARD_SHRINK_GOD', pending: { firstTarget: { row: 7, col: 0 } } })).toEqual({
            cause: 'BOARD_SHRINK_GOD',
            target: { row: 7, col: 0 },
            firstTarget: { row: 7, col: 0 }
        });
    });

    test('境界条件: 対象イベントがない場合は無効', async () => {
        mockExecutePendingSelection.mockImplementation((options) => {
            expect(options.validateResult({ result: { rawEvents: [{ type: 'board_shrink_selected', applied: false }] } })).toBe(false);
            expect(options.validateResult({ result: undefined })).toBe(false);
            return Promise.resolve({ ok: false });
        });

        await handleBoardShrinkSelection(7, 0, 'black');
    });
});
