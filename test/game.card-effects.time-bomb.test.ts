const mockExecutePendingSelection = jest.fn();

jest.mock('../game/card-effects/selection-flow', () => ({
    executePendingSelection: mockExecutePendingSelection
}));

const { handleTimeBombSelection } = require('../game/card-effects/time-bomb.js');
describe('time-bomb', () => {
    beforeEach(() => {
        mockExecutePendingSelection.mockClear();
    });

    test('module load: exported function presence', () => {
        expect(typeof handleTimeBombSelection).toBe('function');
    });

    test('正常系: TIME_BOMBでexecutePendingSelectionが正しく呼ばれる', async () => {
        mockExecutePendingSelection.mockImplementation((options) => {
            expect(options.validateResult({ result: { rawEvents: [{ type: 'time_bomb_selected', applied: true }] } })).toBe(true);
            return Promise.resolve({ ok: true });
        });

        await handleTimeBombSelection(7, 7, 'black');

        const callArg = mockExecutePendingSelection.mock.calls[0][0];
        expect(callArg.pendingType).toBe('TIME_BOMB');
        expect(callArg.actionPayload).toEqual({ bombTarget: { row: 7, col: 7 } });
        expect(callArg.invalidMessage).toBe('時限爆弾にする自分の石を選んでください');
        expect(callArg.buildPlaybackMeta()).toEqual({ cause: 'TIME_BOMB', target: { row: 7, col: 7 } });
    });

    test('境界条件: 対象イベントがない場合は無効', async () => {
        mockExecutePendingSelection.mockImplementation((options) => {
            expect(options.validateResult({ result: { rawEvents: [{ type: 'time_bomb_selected', applied: false }] } })).toBe(false);
            expect(options.validateResult({ result: undefined })).toBe(false);
            return Promise.resolve({ ok: false });
        });

        await handleTimeBombSelection(7, 7, 'black');
    });
});
