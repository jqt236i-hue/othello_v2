const mockExecutePendingSelection = jest.fn();

jest.mock('../game/card-effects/selection-flow', () => ({
    executePendingSelection: mockExecutePendingSelection
}));

const { handleBoardExpansionSelection } = require('../game/card-effects/board-expansion.js');
describe('board-expansion', () => {
    beforeEach(() => {
        mockExecutePendingSelection.mockClear();
    });

    test('module load: exported function presence', () => {
        expect(typeof handleBoardExpansionSelection).toBe('function');
    });

    test('正常系: BOARD_EXPANSION_WILL/GODでexecutePendingSelectionが正しく呼ばれる', async () => {
        mockExecutePendingSelection.mockImplementation((options) => {
            expect(options.validateResult({ result: { rawEvents: [{ type: 'board_expansion_selected', applied: true, completed: true }] } })).toBe(true);
            expect(options.validateResult({ result: { rawEvents: [{ type: 'board_expansion_first_selected', applied: true }] } })).toBe(true);
            return Promise.resolve({ ok: true });
        });

        await handleBoardExpansionSelection(0, 7, 'white', 'up-right');

        const callArg = mockExecutePendingSelection.mock.calls[0][0];
        expect(callArg.pendingTypes).toEqual(['BOARD_EXPANSION_WILL', 'BOARD_EXPANSION_GOD']);
        expect(callArg.actionPayload).toEqual({ expansionTarget: { row: 0, col: 7, directionKey: 'up-right' } });
        expect(callArg.invalidMessage({ pendingType: 'BOARD_EXPANSION_WILL' })).toBe('外周マスの外向き矢印を選んで盤面を拡張してください');
        expect(callArg.invalidMessage({ pendingType: 'BOARD_EXPANSION_GOD' })).toBe('角マスの外向き矢印を選んで盤面を拡張してください');
        expect(callArg.buildPlaybackMeta({ pendingType: 'BOARD_EXPANSION_GOD' })).toEqual({ cause: 'BOARD_EXPANSION_GOD', target: { row: 0, col: 7, directionKey: 'up-right' } });
    });

    test('境界条件: 未完了または対象イベントなしの場合は無効', async () => {
        mockExecutePendingSelection.mockImplementation((options) => {
            expect(options.validateResult({ result: { rawEvents: [{ type: 'board_expansion_selected', applied: true, completed: false }] } })).toBe(false);
            expect(options.validateResult({ result: { rawEvents: [] } })).toBe(false);
            return Promise.resolve({ ok: false });
        });

        await handleBoardExpansionSelection(0, 7, 'white');
    });
});
