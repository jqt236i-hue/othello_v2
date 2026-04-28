"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const mockExecutePendingSelection = jest.fn();
jest.mock('../game/card-effects/selection-flow', () => ({
    executePendingSelection: mockExecutePendingSelection
}));
const seed_js_1 = require("../game/card-effects/seed.js");
describe('seed', () => {
    beforeEach(() => {
        mockExecutePendingSelection.mockClear();
    });
    test('module load: exported function presence', () => {
        expect(typeof seed_js_1.handleSeedSelection).toBe('function');
    });
    test('正常系: SEED_WILLでexecutePendingSelectionが正しく呼ばれる', async () => {
        mockExecutePendingSelection.mockImplementation((options) => {
            expect(options.validateResult({ result: { rawEvents: [{ type: 'seed_selected', applied: true }] } })).toBe(true);
            return Promise.resolve({ ok: true });
        });
        await (0, seed_js_1.handleSeedSelection)(0, 3, 'black');
        const callArg = mockExecutePendingSelection.mock.calls[0][0];
        expect(callArg.pendingType).toBe('SEED_WILL');
        expect(callArg.actionPayload).toEqual({ seedTarget: { row: 0, col: 3 } });
        expect(callArg.invalidMessage).toBe('種をまくマスを選んでください');
        expect(callArg.buildPlaybackMeta()).toEqual({ cause: 'SEED_WILL', target: { row: 0, col: 3 } });
    });
    test('境界条件: 対象イベントがない場合は無効', async () => {
        mockExecutePendingSelection.mockImplementation((options) => {
            expect(options.validateResult({ result: { rawEvents: [{ type: 'seed_selected', applied: false }] } })).toBe(false);
            expect(options.validateResult({ result: null })).toBe(false);
            return Promise.resolve({ ok: false });
        });
        await (0, seed_js_1.handleSeedSelection)(0, 3, 'black');
    });
});
//# sourceMappingURL=game.card-effects.seed.test.js.map