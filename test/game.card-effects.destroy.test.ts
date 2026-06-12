const mockExecutePendingSelection = jest.fn();

jest.mock('../game/card-effects/selection-flow', () => ({
    executePendingSelection: mockExecutePendingSelection
}));

const { executeDestroy, handleDestroySelection, setUIImpl } = require('../game/card-effects/destroy.js');
describe('destroy', () => {
    beforeEach(() => {
        mockExecutePendingSelection.mockClear();
        global.LOG_MESSAGES = {
            destroySelectPrompt: jest.fn(() => '破壊する石を選んでください'),
            destroyFailed: jest.fn(() => '破壊できません'),
            destroyApplied: jest.fn((player, pos) => `${player}:${pos}`)
        };
        global.posToNotation = jest.fn((row, col) => `${row},${col}`);
        global.emitLogAdded = jest.fn();
        global.cardState = {};
        global.gameState = {};
        setUIImpl({
            emitLogAdded: global.emitLogAdded,
            getLogMessages: () => global.LOG_MESSAGES,
            posToNotation: global.posToNotation,
            getCardLogic: () => global.CardLogic || null,
            getGameState: () => global.gameState || null
        });
    });

    afterEach(() => {
        setUIImpl({});
        delete global.LOG_MESSAGES;
        delete global.posToNotation;
        delete global.emitLogAdded;
        delete global.CardLogic;
        delete global.cardState;
        delete global.gameState;
    });

    test('module load: exported function presence', () => {
        expect(typeof handleDestroySelection).toBe('function');
        expect(typeof executeDestroy).toBe('function');
        expect(typeof setUIImpl).toBe('function');
    });

    test('正常系: DESTROY_ONE_STONEでexecutePendingSelectionが正しく呼ばれる', async () => {
        mockExecutePendingSelection.mockImplementation((options) => {
            const result = { rawEvents: [{ type: 'destroy_selected', applied: true, destroyed: true }] };
            expect(options.validateResult({ result })).toBe(true);
            options.afterStateChange({ result });
            return Promise.resolve({ ok: true });
        });

        await executeDestroy(4, 5, 'black');

        const callArg = mockExecutePendingSelection.mock.calls[0][0];
        expect(callArg.pendingType).toBe('DESTROY_ONE_STONE');
        expect(callArg.actionPayload).toEqual({ destroyTarget: { row: 4, col: 5 } });
        expect(callArg.invalidMessage({ result: { ok: false } })).toBe('破壊できません');
        expect(callArg.buildPlaybackMeta()).toEqual({ row: 4, col: 5, cause: 'DESTROY' });
        expect(global.emitLogAdded).toHaveBeenCalledWith('黒:4,5');
    });

    test('ネット権威ログに任せる場合はローカル破壊成功ログを出さない', async () => {
        mockExecutePendingSelection.mockImplementation((options) => {
            const result = { rawEvents: [{ type: 'destroy_selected', applied: true, destroyed: true }] };
            options.afterStateChange({ result, suppressLocalEffectLog: true });
            return Promise.resolve({ ok: true });
        });

        await executeDestroy(4, 5, 'black');

        expect(global.emitLogAdded).not.toHaveBeenCalled();
    });

    test('境界条件: selectable targetsにない場合は実行せず案内ログを出す', async () => {
        global.CardLogic = {
            getSelectableTargets: jest.fn(() => [{ row: 0, col: 0 }])
        };

        await handleDestroySelection(4, 5, 'black');

        expect(mockExecutePendingSelection).not.toHaveBeenCalled();
        expect(global.emitLogAdded).toHaveBeenCalledWith('破壊する石を選んでください');
    });
});
