"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const mockExecutePendingSelection = jest.fn();
jest.mock('../game/card-effects/selection-flow', () => ({
    executePendingSelection: mockExecutePendingSelection
}));
const extend_life_js_1 = require("../game/card-effects/extend-life.js");
describe('extend-life', () => {
    beforeEach(() => {
        mockExecutePendingSelection.mockClear();
    });
    test('module load: exported function presence', () => {
        expect(typeof extend_life_js_1.handleExtendLifeSelection).toBe('function');
        expect(typeof extend_life_js_1.handleCorrosionSelection).toBe('function');
    });
    test('正常系: EXTEND_LIFE_WILL/GODでexecutePendingSelectionが正しく呼ばれる', async () => {
        mockExecutePendingSelection.mockImplementation((options) => {
            expect(options.validateResult({ result: { rawEvents: [{ type: 'extend_life_selected', applied: true }] } })).toBe(true);
            return Promise.resolve({ ok: true });
        });
        await (0, extend_life_js_1.handleExtendLifeSelection)(1, 1, 'black');
        const callArg = mockExecutePendingSelection.mock.calls[0][0];
        expect(callArg.pendingTypes).toEqual(['EXTEND_LIFE_WILL', 'EXTEND_LIFE_GOD']);
        expect(callArg.actionPayload).toEqual({ extendTarget: { row: 1, col: 1 } });
        expect(callArg.invalidMessage({ pendingType: 'EXTEND_LIFE_WILL' })).toBe('延命の対象となる自分の特殊石を選んでください');
        expect(callArg.invalidMessage({ pendingType: 'EXTEND_LIFE_GOD' })).toBe('延命神の対象となる自分の特殊石を選んでください');
        expect(callArg.buildPlaybackMeta({ pendingType: 'EXTEND_LIFE_GOD' })).toEqual({ cause: 'EXTEND_LIFE_GOD', target: { row: 1, col: 1 } });
    });
    test('正常系: CORROSION_WILLでexecutePendingSelectionが正しく呼ばれる', async () => {
        mockExecutePendingSelection.mockResolvedValue({ ok: true });
        await (0, extend_life_js_1.handleCorrosionSelection)(2, 2, 'white');
        const callArg = mockExecutePendingSelection.mock.calls[0][0];
        expect(callArg.pendingType).toBe('CORROSION_WILL');
        expect(callArg.actionPayload).toEqual({ corrosionTarget: { row: 2, col: 2 } });
        expect(callArg.validateResult({ result: { rawEvents: [{ type: 'corrosion_will_resolved', affectedCount: 1 }] } })).toBe(true);
    });
    test('境界条件: 対象イベントがない場合は無効', async () => {
        mockExecutePendingSelection.mockImplementation((options) => {
            expect(options.validateResult({ result: { rawEvents: [{ type: 'extend_life_selected', applied: false }] } })).toBe(false);
            expect(options.validateResult({ result: null })).toBe(false);
            return Promise.resolve({ ok: false });
        });
        await (0, extend_life_js_1.handleExtendLifeSelection)(1, 1, 'black');
    });
});
//# sourceMappingURL=game.card-effects.extend-life.test.js.map