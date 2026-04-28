"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const mockExecutePendingSelection = jest.fn();
jest.mock('../game/card-effects/selection-flow', () => ({
    executePendingSelection: mockExecutePendingSelection
}));
const tempt_js_1 = require("../game/card-effects/tempt.js");
describe('tempt', () => {
    beforeEach(() => {
        mockExecutePendingSelection.mockClear();
        global.LOG_MESSAGES = {
            temptSelectPrompt: jest.fn(() => '誘惑する石を選んでください'),
            temptApplied: jest.fn((player, pos) => `${player}:${pos}`)
        };
        global.posToNotation = jest.fn((row, col) => `${row},${col}`);
        global.emitLogAdded = jest.fn();
    });
    afterEach(() => {
        delete global.LOG_MESSAGES;
        delete global.posToNotation;
        delete global.emitLogAdded;
    });
    test('module load: exported function presence', () => {
        expect(typeof tempt_js_1.handleTemptSelection).toBe('function');
    });
    test('正常系: TEMPT_WILLでexecutePendingSelectionが正しく呼ばれる', async () => {
        mockExecutePendingSelection.mockImplementation((options) => {
            expect(options.validateResult({ result: { rawEvents: [{ type: 'tempt_selected', applied: true }] } })).toBe(true);
            options.afterStateChange();
            return Promise.resolve({ ok: true });
        });
        await (0, tempt_js_1.handleTemptSelection)(2, 4, 'white');
        const callArg = mockExecutePendingSelection.mock.calls[0][0];
        expect(callArg.pendingType).toBe('TEMPT_WILL');
        expect(callArg.actionPayload).toEqual({ temptTarget: { row: 2, col: 4 } });
        expect(callArg.invalidMessage()).toBe('誘惑する石を選んでください');
        expect(callArg.buildPlaybackMeta()).toEqual({ cause: 'TEMPT_WILL', target: { row: 2, col: 4 } });
        expect(global.emitLogAdded).toHaveBeenCalledWith('白:2,4');
    });
    test('境界条件: 対象イベントがない場合は無効', async () => {
        mockExecutePendingSelection.mockImplementation((options) => {
            expect(options.validateResult({ result: { rawEvents: [] } })).toBe(false);
            expect(options.validateResult({ result: null })).toBe(false);
            return Promise.resolve({ ok: false });
        });
        await (0, tempt_js_1.handleTemptSelection)(2, 4, 'white');
    });
});
//# sourceMappingURL=game.card-effects.tempt.test.js.map