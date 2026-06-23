const mockExecutePendingSelection = jest.fn();

jest.mock('../game/card-effects/selection-flow', () => ({
    executePendingSelection: mockExecutePendingSelection
}));

const { handleCloneSelection } = require('../game/card-effects/clone.js');
const ControllerEvents = require('../game/controller-events.js');

describe('clone', () => {
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
        expect(typeof handleCloneSelection).toBe('function');
    });

    test('正常系: CLONE_WILLでexecutePendingSelectionが正しく呼ばれる', async () => {
        mockExecutePendingSelection.mockImplementation((options) => {
            const result = { rawEvents: [{ type: 'clone_selected', applied: true, spawned: [{ row: 1, col: 2 }] }] };
            expect(options.validateResult({ result })).toBe(true);
            options.afterStateChange({ result });
            return Promise.resolve({ ok: true });
        });

        await handleCloneSelection(3, 4, 'black');

        const callArg = mockExecutePendingSelection.mock.calls[0][0];
        expect(callArg.pendingType).toBe('CLONE_WILL');
        expect(callArg.actionPayload).toEqual({ cloneTarget: { row: 3, col: 4 } });
        expect(callArg.invalidMessage).toBe('複製する自分の石を選んでください');
        expect(callArg.buildPlaybackMeta()).toEqual({ cause: 'CLONE_WILL', target: { row: 3, col: 4 } });
        expect(global.emitLogAdded).toHaveBeenCalledWith('複製の意志: 1個を生成');
    });

    test('境界条件: 対象イベントがない場合は無効', async () => {
        mockExecutePendingSelection.mockImplementation((options) => {
            expect(options.validateResult({ result: { rawEvents: [{ type: 'clone_selected', applied: false }] } })).toBe(false);
            expect(options.validateResult({ result: null })).toBe(false);
            return Promise.resolve({ ok: false });
        });

        await handleCloneSelection(3, 4, 'black');
    });
});
