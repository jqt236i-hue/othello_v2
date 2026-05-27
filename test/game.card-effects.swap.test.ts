const mockExecutePendingSelection = jest.fn();

jest.mock('../game/card-effects/selection-flow', () => ({
    executePendingSelection: mockExecutePendingSelection
}));

const { handleSwapSelection } = require('../game/card-effects/swap.js');
const ControllerEvents = require('../game/controller-events.js');

describe('swap', () => {
    beforeEach(() => {
        mockExecutePendingSelection.mockClear();
        global.emitLogAdded = jest.fn();
        ControllerEvents.setControllerEventsRuntime({
            GameEvents: {
                EVENT_TYPES: { LOG_ADDED: 'LOG_ADDED' },
                gameEvents: {
                    emit: (_type, payload) => global.emitLogAdded(payload.text)
                }
            }
        });
    });

    afterEach(() => {
        delete global.emitLogAdded;
        ControllerEvents.setControllerEventsRuntime(null);
    });

    test('正常系: SWAP_WITH_ENEMYでexecutePendingSelectionが正しく呼ばれる', async () => {
        mockExecutePendingSelection.mockResolvedValue({
            ok: true,
            rawEvents: [{ type: 'swap_selected', swapped: true, row: 3, col: 4, withCard: 'trap' }]
        });

        const result = await handleSwapSelection(3, 4, 'black');

        expect(mockExecutePendingSelection).toHaveBeenCalledTimes(1);
        const callArg = mockExecutePendingSelection.mock.calls[0][0];
        expect(callArg.row).toBe(3);
        expect(callArg.col).toBe(4);
        expect(callArg.playerKey).toBe('black');
        expect(callArg.pendingType).toBe('SWAP_WITH_ENEMY');
        expect(callArg.actionPayload).toEqual({ swapTarget: { row: 3, col: 4 } });
        expect(typeof callArg.validateResult).toBe('function');
        expect(typeof callArg.buildPlaybackMeta).toBe('function');
    });

    test('正常系: afterStateChangeでログが出力される', async () => {
        const selectedEvent = { type: 'swap_selected', swapped: true, row: 3, col: 4, withCard: 'trap' };
        mockExecutePendingSelection.mockImplementation((options) => {
            if (typeof options.afterStateChange === 'function') {
                options.afterStateChange({
                    result: { rawEvents: [selectedEvent] }
                });
            }
            return Promise.resolve({ ok: true });
        });

        await handleSwapSelection(3, 4, 'black');

        expect(global.emitLogAdded).toHaveBeenCalled();
    });

    test('エラーハンドリング: executePendingSelectionが例外を投げる', async () => {
        mockExecutePendingSelection.mockRejectedValue(new Error('network error'));

        await expect(handleSwapSelection(3, 4, 'black')).rejects.toThrow('network error');
    });

    test('validateResult: swap_selectedイベントがswapped=trueの場合は有効', async () => {
        mockExecutePendingSelection.mockImplementation((options) => {
            const result = {
                ok: true,
                rawEvents: [{ type: 'swap_selected', swapped: true }]
            };
            const isValid = options.validateResult({ result });
            expect(isValid).toBe(true);
            return Promise.resolve(result);
        });

        await handleSwapSelection(3, 4, 'black');
    });

    test('validateResult: swap_selectedイベントがswapped=falseの場合は無効', async () => {
        mockExecutePendingSelection.mockImplementation((options) => {
            const result = {
                ok: true,
                rawEvents: [{ type: 'swap_selected', swapped: false }]
            };
            const isValid = options.validateResult({ result });
            expect(isValid).toBe(false);
            return Promise.resolve(result);
        });

        await handleSwapSelection(3, 4, 'black');
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

        await handleSwapSelection(3, 4, 'black');
    });

    test('buildPlaybackMeta: 正しいメタデータを構築する', async () => {
        mockExecutePendingSelection.mockImplementation((options) => {
            const meta = options.buildPlaybackMeta();
            expect(meta).toEqual({
                cause: 'SWAP_WITH_ENEMY',
                target: { row: 3, col: 4 }
            });
            return Promise.resolve({ ok: true });
        });

        await handleSwapSelection(3, 4, 'black');
    });

    test('invalidMessage: 正本メッセージを取得', async () => {
        mockExecutePendingSelection.mockImplementation((options) => {
            const message = options.invalidMessage();
            expect(message).toBe('交換対象（相手の石）を選んでください');
            return Promise.resolve({ ok: true });
        });

        await handleSwapSelection(3, 4, 'black');
    });

    test('invalidMessage: 正本メッセージが使える', async () => {
        mockExecutePendingSelection.mockImplementation((options) => {
            const message = options.invalidMessage();
            expect(message).toBe('交換対象（相手の石）を選んでください');
            return Promise.resolve({ ok: true });
        });

        await handleSwapSelection(3, 4, 'black');
    });

    test('emitSwapAppliedLog: 黒プレイヤーのログ', async () => {
        const selectedEvent = { type: 'swap_selected', swapped: true, row: 3, col: 4, withCard: 'trap' };
        mockExecutePendingSelection.mockImplementation((options) => {
            if (typeof options.afterStateChange === 'function') {
                options.afterStateChange({
                    result: { rawEvents: [selectedEvent] }
                });
            }
            return Promise.resolve({ ok: true });
        });

        await handleSwapSelection(3, 4, 'black');

        expect(global.emitLogAdded).toHaveBeenCalledWith('黒が交換の意志で e4 を自分の石に変換');
    });

    test('emitSwapAppliedLog: 白プレイヤーのログ', async () => {
        const selectedEvent = { type: 'swap_selected', swapped: true, row: 3, col: 4, withCard: 'guard' };
        mockExecutePendingSelection.mockImplementation((options) => {
            if (typeof options.afterStateChange === 'function') {
                options.afterStateChange({
                    result: { rawEvents: [selectedEvent] }
                });
            }
            return Promise.resolve({ ok: true });
        });

        await handleSwapSelection(3, 4, 'white');

        expect(global.emitLogAdded).toHaveBeenCalledWith('白が交換の意志で e4 を自分の石に変換');
    });

    test('emitSwapAppliedLog: 正本ログメッセージを使用', async () => {
        const selectedEvent = { type: 'swap_selected', swapped: true, row: 3, col: 4, withCard: 'trap' };
        mockExecutePendingSelection.mockImplementation((options) => {
            if (typeof options.afterStateChange === 'function') {
                options.afterStateChange({
                    result: { rawEvents: [selectedEvent] }
                });
            }
            return Promise.resolve({ ok: true });
        });

        await handleSwapSelection(3, 4, 'black');

        expect(global.emitLogAdded).toHaveBeenCalledWith('黒が交換の意志で e4 を自分の石に変換');
    });

    test('validateResult: resultがnullの場合は無効', async () => {
        mockExecutePendingSelection.mockImplementation((options) => {
            const isValid = options.validateResult({ result: null });
            expect(isValid).toBe(false);
            return Promise.resolve({ ok: false });
        });

        await handleSwapSelection(3, 4, 'black');
    });
});
