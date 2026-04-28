"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const mockExecutePendingSelection = jest.fn();
jest.mock('../game/card-effects/selection-flow', () => ({
    executePendingSelection: mockExecutePendingSelection
}));
const position_swap_js_1 = require("../game/card-effects/position-swap.js");
describe('position-swap', () => {
    beforeEach(() => {
        mockExecutePendingSelection.mockClear();
        global.posToNotation = jest.fn((row, col) => `${row},${col}`);
        global.emitLogAdded = jest.fn();
    });
    afterEach(() => {
        delete global.posToNotation;
        delete global.emitLogAdded;
    });
    test('module load: exported function presence', () => {
        expect(typeof position_swap_js_1.handlePositionSwapSelection).toBe('function');
    });
    test('正常系: POSITION_SWAP_WILLでexecutePendingSelectionが正しく呼ばれる', async () => {
        mockExecutePendingSelection.mockImplementation((options) => {
            const result = { rawEvents: [{ type: 'position_swap_selected', applied: true, completed: true, from: { row: 1, col: 1 }, to: { row: 2, col: 2 } }] };
            expect(options.validateResult({ result })).toBe(true);
            options.afterStateChange({ result });
            return Promise.resolve({ ok: true });
        });
        await (0, position_swap_js_1.handlePositionSwapSelection)(2, 2, 'black');
        const callArg = mockExecutePendingSelection.mock.calls[0][0];
        expect(callArg.pendingType).toBe('POSITION_SWAP_WILL');
        expect(callArg.actionPayload).toEqual({ positionSwapTarget: { row: 2, col: 2 } });
        expect(callArg.invalidMessage).toBe('入替対象の石を選んでください');
        expect(callArg.buildPlaybackMeta()).toEqual({ cause: 'POSITION_SWAP_WILL', target: { row: 2, col: 2 } });
        expect(global.emitLogAdded).toHaveBeenCalledWith('黒が入替の意志で1,1と2,2を入替');
    });
    test('境界条件: 対象イベントがない場合は無効', async () => {
        mockExecutePendingSelection.mockImplementation((options) => {
            expect(options.validateResult({ result: { rawEvents: [{ type: 'position_swap_selected', applied: true, completed: false }] } })).toBe(false);
            expect(options.validateResult({ result: null })).toBe(false);
            return Promise.resolve({ ok: false });
        });
        await (0, position_swap_js_1.handlePositionSwapSelection)(2, 2, 'black');
    });
});
//# sourceMappingURL=game.card-effects.position-swap.test.js.map