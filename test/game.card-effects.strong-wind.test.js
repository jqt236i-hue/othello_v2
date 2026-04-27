const mockExecutePendingSelection = jest.fn();

jest.mock('../game/card-effects/selection-flow', () => ({
    executePendingSelection: mockExecutePendingSelection
}));

const {
    handleStrongWindSelection,
    handleSuperBuoyancySelection,
    handleSuperGravitySelection
} = require('../game/card-effects/strong-wind');

describe('strong-wind', () => {
    beforeEach(() => {
        mockExecutePendingSelection.mockClear();
        global.emitLogAdded = jest.fn();
    });

    afterEach(() => {
        delete global.emitLogAdded;
    });

    test('module load: exported function presence', () => {
        expect(typeof handleStrongWindSelection).toBe('function');
        expect(typeof handleSuperBuoyancySelection).toBe('function');
        expect(typeof handleSuperGravitySelection).toBe('function');
    });

    test('正常系: STRONG_WIND_WILLでexecutePendingSelectionが正しく呼ばれる', async () => {
        mockExecutePendingSelection.mockImplementation((options) => {
            expect(options.validateResult({ result: { rawEvents: [{ type: 'strong_wind_selected', applied: true }] } })).toBe(true);
            options.afterStateChange();
            return Promise.resolve({ ok: true });
        });

        await handleStrongWindSelection(6, 6, 'black');

        const callArg = mockExecutePendingSelection.mock.calls[0][0];
        expect(callArg.pendingType).toBe('STRONG_WIND_WILL');
        expect(callArg.actionPayload).toEqual({ strongWindTarget: { row: 6, col: 6 } });
        expect(callArg.invalidMessage).toBe('移動可能な石を選んでください');
        expect(callArg.buildPlaybackMeta()).toEqual({ cause: 'STRONG_WIND_WILL', target: { row: 6, col: 6 } });
        expect(global.emitLogAdded).toHaveBeenCalledWith('黒が強風の意志を発動');
    });

    test('正常系: SUPER_BUOYANCY_WILL/SUPER_GRAVITY_WILLで設定を渡す', async () => {
        mockExecutePendingSelection.mockResolvedValue({ ok: true });

        await handleSuperBuoyancySelection(1, 1, 'white');
        await handleSuperGravitySelection(2, 2, 'white');

        expect(mockExecutePendingSelection.mock.calls[0][0].pendingType).toBe('SUPER_BUOYANCY_WILL');
        expect(mockExecutePendingSelection.mock.calls[0][0].actionPayload).toEqual({ superBuoyancyTarget: { row: 1, col: 1 } });
        expect(mockExecutePendingSelection.mock.calls[1][0].pendingType).toBe('SUPER_GRAVITY_WILL');
        expect(mockExecutePendingSelection.mock.calls[1][0].actionPayload).toEqual({ superGravityTarget: { row: 2, col: 2 } });
    });

    test('境界条件: 対象イベントがない場合は無効', async () => {
        mockExecutePendingSelection.mockImplementation((options) => {
            expect(options.validateResult({ result: { rawEvents: [{ type: 'strong_wind_selected', applied: false }] } })).toBe(false);
            expect(options.validateResult({ result: null })).toBe(false);
            return Promise.resolve({ ok: false });
        });

        await handleStrongWindSelection(6, 6, 'black');
    });
});
