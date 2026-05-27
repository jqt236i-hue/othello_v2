const mockExecutePendingSelection = jest.fn();

jest.mock('../game/card-effects/selection-flow', () => ({
    executePendingSelection: mockExecutePendingSelection
}));

const { handleTemptSelection } = require('../game/card-effects/tempt.js');
const ControllerEvents = require('../game/controller-events.js');

describe('tempt', () => {
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

    test('module load: exported function presence', () => {
        expect(typeof handleTemptSelection).toBe('function');
    });

    test('正常系: TEMPT_WILLでexecutePendingSelectionが正しく呼ばれる', async () => {
        mockExecutePendingSelection.mockImplementation((options) => {
            expect(options.validateResult({ result: { rawEvents: [{ type: 'tempt_selected', applied: true }] } })).toBe(true);
            options.afterStateChange();
            return Promise.resolve({ ok: true });
        });

        await handleTemptSelection(2, 4, 'white');

        const callArg = mockExecutePendingSelection.mock.calls[0][0];
        expect(callArg.pendingType).toBe('TEMPT_WILL');
        expect(callArg.actionPayload).toEqual({ temptTarget: { row: 2, col: 4 } });
        expect(callArg.invalidMessage()).toBe('対象の相手特殊石を選んでください');
        expect(callArg.buildPlaybackMeta()).toEqual({ cause: 'TEMPT_WILL', target: { row: 2, col: 4 } });
        expect(global.emitLogAdded).toHaveBeenCalledWith('白が誘惑の意志で e3 の支配権を奪った');
    });

    test('境界条件: 対象イベントがない場合は無効', async () => {
        mockExecutePendingSelection.mockImplementation((options) => {
            expect(options.validateResult({ result: { rawEvents: [] } })).toBe(false);
            expect(options.validateResult({ result: null })).toBe(false);
            return Promise.resolve({ ok: false });
        });

        await handleTemptSelection(2, 4, 'white');
    });
});
