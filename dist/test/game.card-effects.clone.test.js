"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const mockExecutePendingSelection = jest.fn();
jest.mock('../game/card-effects/selection-flow', () => ({
    executePendingSelection: mockExecutePendingSelection
}));
const clone_js_1 = require("../game/card-effects/clone.js");
describe('clone', () => {
    beforeEach(() => {
        mockExecutePendingSelection.mockClear();
        global.emitLogAdded = jest.fn();
    });
    afterEach(() => {
        delete global.emitLogAdded;
    });
    test('module load: exported function presence', () => {
        expect(typeof clone_js_1.handleCloneSelection).toBe('function');
        expect(typeof clone_js_1.handleSplitSelection).toBe('function');
    });
    test('正常系: CLONE_WILLでexecutePendingSelectionが正しく呼ばれる', async () => {
        mockExecutePendingSelection.mockImplementation((options) => {
            const result = { rawEvents: [{ type: 'clone_selected', applied: true, spawned: [{ row: 1, col: 2 }] }] };
            expect(options.validateResult({ result })).toBe(true);
            options.afterStateChange({ result });
            return Promise.resolve({ ok: true });
        });
        await (0, clone_js_1.handleCloneSelection)(3, 4, 'black');
        const callArg = mockExecutePendingSelection.mock.calls[0][0];
        expect(callArg.pendingType).toBe('CLONE_WILL');
        expect(callArg.actionPayload).toEqual({ cloneTarget: { row: 3, col: 4 } });
        expect(callArg.invalidMessage).toBe('周囲に空きがある自分の石を選んでください');
        expect(callArg.buildPlaybackMeta()).toEqual({ cause: 'CLONE_WILL', target: { row: 3, col: 4 } });
        expect(global.emitLogAdded).toHaveBeenCalledWith('複製の意志: 1個を生成');
    });
    test('正常系: SPLIT_WILLでexecutePendingSelectionが正しく呼ばれる', async () => {
        mockExecutePendingSelection.mockResolvedValue({ ok: true });
        await (0, clone_js_1.handleSplitSelection)(5, 6, 'white');
        const callArg = mockExecutePendingSelection.mock.calls[0][0];
        expect(callArg.pendingType).toBe('SPLIT_WILL');
        expect(callArg.actionPayload).toEqual({ splitTarget: { row: 5, col: 6 } });
        expect(callArg.validateResult({ result: { rawEvents: [{ type: 'split_selected', applied: true }] } })).toBe(true);
    });
    test('境界条件: 対象イベントがない場合は無効', async () => {
        mockExecutePendingSelection.mockImplementation((options) => {
            expect(options.validateResult({ result: { rawEvents: [{ type: 'clone_selected', applied: false }] } })).toBe(false);
            expect(options.validateResult({ result: null })).toBe(false);
            return Promise.resolve({ ok: false });
        });
        await (0, clone_js_1.handleCloneSelection)(3, 4, 'black');
    });
});
//# sourceMappingURL=game.card-effects.clone.test.js.map