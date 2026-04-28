"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const mockExecutePendingSelection = jest.fn();
jest.mock('../game/card-effects/selection-flow', () => ({
    executePendingSelection: mockExecutePendingSelection
}));
const teleport_js_1 = require("../game/card-effects/teleport.js");
describe('teleport', () => {
    beforeEach(() => {
        mockExecutePendingSelection.mockClear();
    });
    test('正常系: TELEPORT_WILLでexecutePendingSelectionが正しく呼ばれる', async () => {
        mockExecutePendingSelection.mockResolvedValue({
            ok: true,
            rawEvents: [{ type: 'teleport_selected', applied: true }]
        });
        const result = await (0, teleport_js_1.handleTeleportSelection)(3, 4, 'black');
        expect(mockExecutePendingSelection).toHaveBeenCalledTimes(1);
        const callArg = mockExecutePendingSelection.mock.calls[0][0];
        expect(callArg.row).toBe(3);
        expect(callArg.col).toBe(4);
        expect(callArg.playerKey).toBe('black');
        expect(callArg.pendingTypes).toEqual(['TELEPORT_WILL', 'CELL_TELEPORT_WILL']);
        expect(callArg.actionPayload).toEqual({ teleportTarget: { row: 3, col: 4 } });
        expect(typeof callArg.validateResult).toBe('function');
        expect(typeof callArg.buildPlaybackMeta).toBe('function');
    });
    test('正常系: CELL_TELEPORT_WILLで正しく動作する', async () => {
        mockExecutePendingSelection.mockResolvedValue({
            ok: true,
            rawEvents: [{ type: 'teleport_selected', applied: true }]
        });
        await (0, teleport_js_1.handleTeleportSelection)(1, 1, 'white');
        const callArg = mockExecutePendingSelection.mock.calls[0][0];
        expect(callArg.playerKey).toBe('white');
    });
    test('エラーハンドリング: executePendingSelectionが例外を投げる', async () => {
        mockExecutePendingSelection.mockRejectedValue(new Error('network error'));
        await expect((0, teleport_js_1.handleTeleportSelection)(3, 4, 'black')).rejects.toThrow('network error');
    });
    test('validateResult: teleport_selectedイベントがapplied=trueの場合は有効', async () => {
        mockExecutePendingSelection.mockImplementation((options) => {
            const result = {
                ok: true,
                rawEvents: [{ type: 'teleport_selected', applied: true }]
            };
            const isValid = options.validateResult({ result });
            expect(isValid).toBe(true);
            return Promise.resolve(result);
        });
        await (0, teleport_js_1.handleTeleportSelection)(3, 4, 'black');
    });
    test('validateResult: teleport_selectedイベントがapplied=falseの場合は無効', async () => {
        mockExecutePendingSelection.mockImplementation((options) => {
            const result = {
                ok: true,
                rawEvents: [{ type: 'teleport_selected', applied: false }]
            };
            const isValid = options.validateResult({ result });
            expect(isValid).toBe(false);
            return Promise.resolve(result);
        });
        await (0, teleport_js_1.handleTeleportSelection)(3, 4, 'black');
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
        await (0, teleport_js_1.handleTeleportSelection)(3, 4, 'black');
    });
    test('buildPlaybackMeta: 正しいメタデータを構築する', async () => {
        mockExecutePendingSelection.mockImplementation((options) => {
            const meta = options.buildPlaybackMeta({ pendingType: 'TELEPORT_WILL' });
            expect(meta).toEqual({
                cause: 'TELEPORT_WILL',
                target: { row: 3, col: 4 }
            });
            return Promise.resolve({ ok: true });
        });
        await (0, teleport_js_1.handleTeleportSelection)(3, 4, 'black');
    });
    test('invalidMessage: TELEPORT_WILLの場合のメッセージ', async () => {
        mockExecutePendingSelection.mockImplementation((options) => {
            const message = options.invalidMessage({ pendingType: 'TELEPORT_WILL' });
            expect(message).toBe('テレポートさせる石を選んでください');
            return Promise.resolve({ ok: true });
        });
        await (0, teleport_js_1.handleTeleportSelection)(3, 4, 'black');
    });
    test('invalidMessage: CELL_TELEPORT_WILLの場合のメッセージ', async () => {
        mockExecutePendingSelection.mockImplementation((options) => {
            const message = options.invalidMessage({ pendingType: 'CELL_TELEPORT_WILL' });
            expect(message).toBe('マステレポートさせるマスを選んでください');
            return Promise.resolve({ ok: true });
        });
        await (0, teleport_js_1.handleTeleportSelection)(3, 4, 'black');
    });
    test('境界条件: resultがnullの場合のvalidateResult', async () => {
        mockExecutePendingSelection.mockImplementation((options) => {
            const isValid = options.validateResult({ result: null });
            expect(isValid).toBe(false);
            return Promise.resolve({ ok: false });
        });
        await (0, teleport_js_1.handleTeleportSelection)(3, 4, 'black');
    });
    test('buildPlaybackMeta: CELL_TELEPORT_WILLの場合', async () => {
        mockExecutePendingSelection.mockImplementation((options) => {
            const meta = options.buildPlaybackMeta({ pendingType: 'CELL_TELEPORT_WILL' });
            expect(meta).toEqual({
                cause: 'CELL_TELEPORT_WILL',
                target: { row: 3, col: 4 }
            });
            return Promise.resolve({ ok: true });
        });
        await (0, teleport_js_1.handleTeleportSelection)(3, 4, 'black');
    });
});
//# sourceMappingURL=game.card-effects.teleport.test.js.map