const mockExecutePendingSelection = jest.fn();

jest.mock('../game/card-effects/selection-flow', () => ({
    executePendingSelection: mockExecutePendingSelection
}));

import { handleCaptureSelection } from '../game/card-effects/capture.js';

describe('capture', () => {
    beforeEach(() => {
        mockExecutePendingSelection.mockClear();
        global.LOG_MESSAGES = {
            captureSelectPrompt: jest.fn(() => '奪う石を選んでください'),
            captureApplied: jest.fn((player, pos, cardName) => `${player}:${pos}:${cardName}`)
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
        expect(typeof handleCaptureSelection).toBe('function');
    });

    test('正常系: CAPTURE_WILLでexecutePendingSelectionが正しく呼ばれる', async () => {
        mockExecutePendingSelection.mockImplementation((options) => {
            const result = { rawEvents: [{ type: 'capture_selected', applied: true, capturedCardName: 'カードA' }] };
            expect(options.validateResult({ result })).toBe(true);
            options.afterStateChange({ result });
            return Promise.resolve({ ok: true });
        });

        await handleCaptureSelection(1, 2, 'white');

        const callArg = mockExecutePendingSelection.mock.calls[0][0];
        expect(callArg.pendingType).toBe('CAPTURE_WILL');
        expect(callArg.actionPayload).toEqual({ captureTarget: { row: 1, col: 2 } });
        expect(callArg.invalidMessage()).toBe('奪う石を選んでください');
        expect(callArg.buildPlaybackMeta()).toEqual({ cause: 'CAPTURE_WILL', target: { row: 1, col: 2 } });
        expect(global.emitLogAdded).toHaveBeenCalledWith('白:1,2:カードA');
    });

    test('境界条件: 対象イベントがない場合は無効', async () => {
        mockExecutePendingSelection.mockImplementation((options) => {
            expect(options.validateResult({ result: { rawEvents: [] } })).toBe(false);
            expect(options.validateResult({ result: null })).toBe(false);
            return Promise.resolve({ ok: false });
        });

        await handleCaptureSelection(1, 2, 'white');
    });
});
