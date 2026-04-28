"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const mockExecutePendingSelection = jest.fn();
jest.mock('../game/card-effects/selection-flow', () => ({
    executePendingSelection: mockExecutePendingSelection
}));
const guard_js_1 = require("../game/card-effects/guard.js");
describe('guard', () => {
    beforeEach(() => {
        mockExecutePendingSelection.mockClear();
    });
    test('正常系: GUARD_WILLでexecutePendingSelectionが正しく呼ばれる', async () => {
        mockExecutePendingSelection.mockResolvedValue({
            ok: true,
            rawEvents: [{ type: 'guard_selected', applied: true }]
        });
        const result = await (0, guard_js_1.handleGuardSelection)(3, 4, 'black');
        expect(mockExecutePendingSelection).toHaveBeenCalledTimes(1);
        const callArg = mockExecutePendingSelection.mock.calls[0][0];
        expect(callArg.row).toBe(3);
        expect(callArg.col).toBe(4);
        expect(callArg.playerKey).toBe('black');
        expect(callArg.pendingTypes).toEqual(['GUARD_WILL', 'GUARDIAN_GOD']);
        expect(callArg.actionPayload).toEqual({ guardTarget: { row: 3, col: 4 } });
        expect(callArg.invalidMessage).toBe('守る石にする自分の石を選んでください');
        expect(typeof callArg.validateResult).toBe('function');
        expect(typeof callArg.buildPlaybackMeta).toBe('function');
    });
    test('正常系: GUARDIAN_GODで正しく動作する', async () => {
        mockExecutePendingSelection.mockResolvedValue({
            ok: true,
            rawEvents: [{ type: 'guard_selected', applied: true }]
        });
        await (0, guard_js_1.handleGuardSelection)(1, 1, 'white');
        const callArg = mockExecutePendingSelection.mock.calls[0][0];
        expect(callArg.playerKey).toBe('white');
    });
    test('エラーハンドリング: executePendingSelectionが例外を投げる', async () => {
        mockExecutePendingSelection.mockRejectedValue(new Error('network error'));
        await expect((0, guard_js_1.handleGuardSelection)(3, 4, 'black')).rejects.toThrow('network error');
    });
    test('validateResult: guard_selectedイベントがapplied=trueの場合は有効', async () => {
        mockExecutePendingSelection.mockImplementation((options) => {
            const result = {
                ok: true,
                rawEvents: [{ type: 'guard_selected', applied: true }]
            };
            const isValid = options.validateResult({ result });
            expect(isValid).toBe(true);
            return Promise.resolve(result);
        });
        await (0, guard_js_1.handleGuardSelection)(3, 4, 'black');
    });
    test('validateResult: guard_selectedイベントがapplied=falseの場合は無効', async () => {
        mockExecutePendingSelection.mockImplementation((options) => {
            const result = {
                ok: true,
                rawEvents: [{ type: 'guard_selected', applied: false }]
            };
            const isValid = options.validateResult({ result });
            expect(isValid).toBe(false);
            return Promise.resolve(result);
        });
        await (0, guard_js_1.handleGuardSelection)(3, 4, 'black');
    });
    test('validateResult: 異なるイベントタイプの場合は無効', async () => {
        mockExecutePendingSelection.mockImplementation((options) => {
            const result = {
                ok: true,
                rawEvents: [{ type: 'other_event', applied: true }]
            };
            const isValid = options.validateResult({ result });
            expect(isValid).toBe(false);
            return Promise.resolve(result);
        });
        await (0, guard_js_1.handleGuardSelection)(3, 4, 'black');
    });
    test('validateResult: rawEventsが空の場合は無効', async () => {
        mockExecutePendingSelection.mockImplementation((options) => {
            const result = {
                ok: true,
                rawEvents: []
            };
            const isValid = options.validateResult({ result });
            expect(isValid).toBe(false);
            return Promise.resolve(result);
        });
        await (0, guard_js_1.handleGuardSelection)(3, 4, 'black');
    });
    test('validateResult: resultがnullの場合は無効', async () => {
        mockExecutePendingSelection.mockImplementation((options) => {
            const isValid = options.validateResult({ result: null });
            expect(isValid).toBe(false);
            return Promise.resolve({ ok: false });
        });
        await (0, guard_js_1.handleGuardSelection)(3, 4, 'black');
    });
    test('buildPlaybackMeta: GUARD_WILLの場合のメタデータ', async () => {
        mockExecutePendingSelection.mockImplementation((options) => {
            const meta = options.buildPlaybackMeta({ pendingType: 'GUARD_WILL' });
            expect(meta).toEqual({
                cause: 'GUARD_WILL',
                target: { row: 3, col: 4 }
            });
            return Promise.resolve({ ok: true });
        });
        await (0, guard_js_1.handleGuardSelection)(3, 4, 'black');
    });
    test('buildPlaybackMeta: GUARDIAN_GODの場合のメタデータ', async () => {
        mockExecutePendingSelection.mockImplementation((options) => {
            const meta = options.buildPlaybackMeta({ pendingType: 'GUARDIAN_GOD' });
            expect(meta).toEqual({
                cause: 'GUARDIAN_GOD',
                target: { row: 3, col: 4 }
            });
            return Promise.resolve({ ok: true });
        });
        await (0, guard_js_1.handleGuardSelection)(3, 4, 'black');
    });
    test('境界条件: 無効なプレイヤーキー', async () => {
        mockExecutePendingSelection.mockResolvedValue({ ok: true });
        await (0, guard_js_1.handleGuardSelection)(3, 4, 'invalid');
        const callArg = mockExecutePendingSelection.mock.calls[0][0];
        expect(callArg.playerKey).toBe('invalid');
    });
    test('境界条件: 負の座標', async () => {
        mockExecutePendingSelection.mockResolvedValue({ ok: true });
        await (0, guard_js_1.handleGuardSelection)(-1, -1, 'black');
        const callArg = mockExecutePendingSelection.mock.calls[0][0];
        expect(callArg.row).toBe(-1);
        expect(callArg.col).toBe(-1);
    });
});
//# sourceMappingURL=game.card-effects.guard.test.js.map