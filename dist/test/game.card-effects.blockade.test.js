"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const mockExecutePendingSelection = jest.fn();
jest.mock('../game/card-effects/selection-flow', () => ({
    executePendingSelection: mockExecutePendingSelection
}));
const blockade_js_1 = require("../game/card-effects/blockade.js");
describe('blockade', () => {
    beforeEach(() => {
        mockExecutePendingSelection.mockClear();
    });
    test('module load: exported function presence', () => {
        expect(typeof blockade_js_1.handleBlockadeSelection).toBe('function');
    });
    test('正常系: BLOCKADE_WILLでexecutePendingSelectionが正しく呼ばれる', async () => {
        mockExecutePendingSelection.mockImplementation((options) => {
            expect(options.validateResult({ result: { rawEvents: [{ type: 'blockade_selected', applied: true }] } })).toBe(true);
            return Promise.resolve({ ok: true });
        });
        await (0, blockade_js_1.handleBlockadeSelection)(2, 3, 'black');
        expect(mockExecutePendingSelection).toHaveBeenCalledTimes(1);
        const callArg = mockExecutePendingSelection.mock.calls[0][0];
        expect(callArg.row).toBe(2);
        expect(callArg.col).toBe(3);
        expect(callArg.playerKey).toBe('black');
        expect(callArg.pendingType).toBe('BLOCKADE_WILL');
        expect(callArg.actionPayload).toEqual({ blockadeTarget: { row: 2, col: 3 } });
        expect(callArg.invalidMessage).toBe('封鎖する空きマスを選んでください');
        expect(callArg.buildPlaybackMeta()).toEqual({ cause: 'BLOCKADE_WILL', target: { row: 2, col: 3 } });
    });
    test('境界条件: 対象イベントがない場合は無効', async () => {
        mockExecutePendingSelection.mockImplementation((options) => {
            expect(options.validateResult({ result: { rawEvents: [{ type: 'other_event', applied: true }] } })).toBe(false);
            expect(options.validateResult({ result: null })).toBe(false);
            return Promise.resolve({ ok: false });
        });
        await (0, blockade_js_1.handleBlockadeSelection)(2, 3, 'black');
    });
});
//# sourceMappingURL=game.card-effects.blockade.test.js.map