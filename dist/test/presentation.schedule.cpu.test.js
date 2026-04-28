"use strict";
jest.useFakeTimers();
function mockPresentationRuntime(overrides) {
    jest.doMock('../game/cpu-turn-handler', () => {
        const actual = jest.requireActual('../game/cpu-turn-handler');
        return {
            ...actual,
            PresentationRuntime: {
                ...actual.PresentationRuntime,
                ...(overrides || {})
            }
        };
    });
}
describe('presentation handler CPU scheduling', () => {
    afterEach(() => {
        jest.clearAllTimers();
        jest.resetModules();
        jest.unmock('../game/cpu-turn-handler');
        delete global.BLACK;
        delete global.WHITE;
        delete global.CpuCommentaryRuntime;
        delete global.LOCAL_PLAYER_KEY;
        delete global.addLog;
        delete global.getCurrentMatchMode;
        delete global.gameState;
        delete global.GamePresentationRuntime;
    });
    test('SCHEDULE_CPU_TURN delegates to game presentation runtime', () => {
        const scheduleCpuTurn = jest.fn();
        mockPresentationRuntime({ scheduleCpuTurn });
        import * as ph from '../ui/presentation-handler.js';
        const payload = { type: 'SCHEDULE_CPU_TURN', delayMs: 0 };
        ph.handlePresentationEvent(payload);
        expect(scheduleCpuTurn).toHaveBeenCalledWith(payload);
    });
    test('SCHEDULE_CPU_TURN host preserves stale-check payload for the runtime', () => {
        const scheduleCpuTurn = jest.fn();
        mockPresentationRuntime({ scheduleCpuTurn });
        import * as ph from '../ui/presentation-handler.js';
        const payload = {
            type: 'SCHEDULE_CPU_TURN',
            delayMs: 0,
            expectedPlayerKey: 'white',
            expectedTurnNumber: 9
        };
        ph.handlePresentationEvent(payload);
        expect(scheduleCpuTurn).toHaveBeenCalledWith(payload);
    });
    test('SCHEDULE_CPU_TURN does not touch global CPU handlers when presentation runtime is unavailable', () => {
        jest.doMock('../game/cpu-turn-handler', () => ({}));
        const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => { });
        global.processCpuTurn = jest.fn();
        global.GamePresentationRuntime = null;
        try {
            import * as ph from '../ui/presentation-handler.js';
            ph.handlePresentationEvent({ type: 'SCHEDULE_CPU_TURN', delayMs: 0 });
            expect(global.processCpuTurn).not.toHaveBeenCalled();
            expect(warnSpy).toHaveBeenCalledWith('[PresentationHandler] GamePresentationRuntime.scheduleCpuTurn not available');
        }
        finally {
            warnSpy.mockRestore();
        }
    });
    test('PLAYBACK_EVENTS card_use_animation triggers enemy-card commentary', async () => {
        jest.resetModules();
        const requestCommentaryMock = jest.fn(async () => 'うるさいぞ！');
        jest.doMock('../game/ai/cpu-commentary-runtime', () => ({
            requestCommentary: requestCommentaryMock
        }));
        global.gameState = {
            turnNumber: 7,
            board: Array.from({ length: 8 }, () => Array(8).fill(0))
        };
        global.gameState.board[3][3] = 1;
        global.gameState.board[3][4] = -1;
        global.CpuCommentaryRuntime = { requestCommentary: requestCommentaryMock };
        global.LOCAL_PLAYER_KEY = 'black';
        global.getCurrentMatchMode = jest.fn(() => 'cpu');
        global.addLog = jest.fn();
        import * as ph from '../ui/presentation-handler.js';
        await ph.handlePresentationEvent({
            type: 'PLAYBACK_EVENTS',
            events: [{
                    type: 'card_use_animation',
                    phase: 1,
                    targets: [{ owner: 'black', cardId: 'swap_01', cost: 17, name: '交換の意志' }]
                }]
        });
        await Promise.resolve();
        await Promise.resolve();
        expect(requestCommentaryMock).toHaveBeenCalledWith(expect.objectContaining({
            eventType: 'card_used_by_enemy',
            playerKey: 'white',
            cardId: 'swap_01'
        }));
        expect(global.addLog).not.toHaveBeenCalled();
    });
    test('CARD_USED local card event also emits hero card commentary', async () => {
        jest.resetModules();
        const requestCommentaryMock = jest.fn(async (context) => (context && context.speakerRole === 'hero'
            ? '交換の意志で流れを作る。'
            : 'うるさいぞ！'));
        jest.doMock('../game/ai/cpu-commentary-runtime', () => ({
            requestCommentary: requestCommentaryMock
        }));
        global.gameState = {
            turnNumber: 7,
            board: Array.from({ length: 8 }, () => Array(8).fill(0))
        };
        global.gameState.board[3][3] = 1;
        global.gameState.board[3][4] = -1;
        global.addLog = jest.fn();
        import * as ph from '../ui/presentation-handler.js';
        await ph.handlePresentationEvent({
            type: 'CARD_USED',
            player: 'black',
            cardId: 'swap_01',
            cardType: 'SWAP_WITH_ENEMY',
            meta: {
                owner: 'black',
                cardType: 'SWAP_WITH_ENEMY',
                cost: 17,
                name: '交換の意志'
            }
        });
        await Promise.resolve();
        await Promise.resolve();
        expect(requestCommentaryMock).toHaveBeenCalledWith(expect.objectContaining({
            eventType: 'card_used',
            playerKey: 'black',
            cardId: 'swap_01',
            cardType: 'SWAP_WITH_ENEMY',
            speakerRole: 'hero'
        }));
        expect(global.addLog).not.toHaveBeenCalled();
    });
    test('PLAYBACK_EVENTS enemy ownerの大文字と空白を正規化してcommentaryを発火する', async () => {
        jest.resetModules();
        const requestCommentaryMock = jest.fn(async () => 'まだだ！');
        jest.doMock('../game/ai/cpu-commentary-runtime', () => ({
            requestCommentary: requestCommentaryMock
        }));
        global.gameState = {
            turnNumber: 8,
            board: Array.from({ length: 8 }, () => Array(8).fill(0))
        };
        global.addLog = jest.fn();
        import * as ph from '../ui/presentation-handler.js';
        await ph.handlePresentationEvent({
            type: 'PLAYBACK_EVENTS',
            events: [{
                    type: 'card_use_animation',
                    phase: 1,
                    targets: [{ owner: ' BLACK ', cardId: 'swap_02', cost: 17, name: '交換の意志' }]
                }]
        });
        await Promise.resolve();
        await Promise.resolve();
        expect(requestCommentaryMock).toHaveBeenCalledWith(expect.objectContaining({
            eventType: 'card_used_by_enemy',
            playerKey: 'white',
            cardId: 'swap_02'
        }));
        expect(global.addLog).not.toHaveBeenCalled();
    });
});
//# sourceMappingURL=presentation.schedule.cpu.test.js.map