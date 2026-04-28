const mockExecutePendingSelection = jest.fn();

jest.mock('../game/card-effects/selection-flow', () => ({
    executePendingSelection: mockExecutePendingSelection
}));

import { handleTrapSelection, setUIImpl } from '../game/card-effects/trap.js';

describe('trap', () => {
    beforeEach(() => {
        mockExecutePendingSelection.mockClear();
    });

    test('正常系: TRAP_WILLでexecutePendingSelectionが正しく呼ばれる', async () => {
        mockExecutePendingSelection.mockResolvedValue({
            ok: true,
            rawEvents: [{ type: 'trap_selected', applied: true }]
        });

        const result = await handleTrapSelection(3, 4, 'black');

        expect(mockExecutePendingSelection).toHaveBeenCalledTimes(1);
        const callArg = mockExecutePendingSelection.mock.calls[0][0];
        expect(callArg.row).toBe(3);
        expect(callArg.col).toBe(4);
        expect(callArg.playerKey).toBe('black');
        expect(callArg.pendingType).toBe('TRAP_WILL');
        expect(callArg.actionPayload).toEqual({ trapTarget: { row: 3, col: 4 } });
        expect(callArg.invalidMessage).toBe('罠石にする自分の石を選んでください');
        expect(typeof callArg.validateResult).toBe('function');
        expect(typeof callArg.buildPlaybackMeta).toBe('function');
    });

    test('正常系: 白プレイヤーで正しく動作する', async () => {
        mockExecutePendingSelection.mockResolvedValue({
            ok: true,
            rawEvents: [{ type: 'trap_selected', applied: true }]
        });

        await handleTrapSelection(1, 1, 'white');

        const callArg = mockExecutePendingSelection.mock.calls[0][0];
        expect(callArg.playerKey).toBe('white');
    });

    test('エラーハンドリング: executePendingSelectionが例外を投げる', async () => {
        mockExecutePendingSelection.mockRejectedValue(new Error('network error'));

        await expect(handleTrapSelection(3, 4, 'black')).rejects.toThrow('network error');
    });

    test('validateResult: trap_selectedイベントがapplied=trueの場合は有効', async () => {
        mockExecutePendingSelection.mockImplementation((options) => {
            const result = {
                ok: true,
                rawEvents: [{ type: 'trap_selected', applied: true }]
            };
            const isValid = options.validateResult({ result });
            expect(isValid).toBe(true);
            return Promise.resolve(result);
        });

        await handleTrapSelection(3, 4, 'black');
    });

    test('validateResult: trap_selectedイベントがapplied=falseの場合は無効', async () => {
        mockExecutePendingSelection.mockImplementation((options) => {
            const result = {
                ok: true,
                rawEvents: [{ type: 'trap_selected', applied: false }]
            };
            const isValid = options.validateResult({ result });
            expect(isValid).toBe(false);
            return Promise.resolve(result);
        });

        await handleTrapSelection(3, 4, 'black');
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

        await handleTrapSelection(3, 4, 'black');
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

        await handleTrapSelection(3, 4, 'black');
    });

    test('validateResult: resultがnullの場合は無効', async () => {
        mockExecutePendingSelection.mockImplementation((options) => {
            const isValid = options.validateResult({ result: null });
            expect(isValid).toBe(false);
            return Promise.resolve({ ok: false });
        });

        await handleTrapSelection(3, 4, 'black');
    });

    test('buildPlaybackMeta: 正しいメタデータを構築する', async () => {
        mockExecutePendingSelection.mockImplementation((options) => {
            const meta = options.buildPlaybackMeta();
            expect(meta).toEqual({
                cause: 'TRAP_WILL',
                target: { row: 3, col: 4 }
            });
            return Promise.resolve({ ok: true });
        });

        await handleTrapSelection(3, 4, 'black');
    });

    test('setUIImpl: UI実装を設定できる', () => {
        const uiImpl = { showTrapAnimation: jest.fn() };
        setUIImpl(uiImpl);
        expect(() => setUIImpl(uiImpl)).not.toThrow();
    });

    test('setUIImpl: nullやundefinedを渡してもエラーにならない', () => {
        expect(() => setUIImpl(null)).not.toThrow();
        expect(() => setUIImpl(undefined)).not.toThrow();
    });

    test('境界条件: 無効なプレイヤーキー', async () => {
        mockExecutePendingSelection.mockResolvedValue({ ok: true });

        await handleTrapSelection(3, 4, 'invalid');

        const callArg = mockExecutePendingSelection.mock.calls[0][0];
        expect(callArg.playerKey).toBe('invalid');
    });

    test('境界条件: 負の座標', async () => {
        mockExecutePendingSelection.mockResolvedValue({ ok: true });

        await handleTrapSelection(-1, -1, 'black');

        const callArg = mockExecutePendingSelection.mock.calls[0][0];
        expect(callArg.row).toBe(-1);
        expect(callArg.col).toBe(-1);
    });
});
