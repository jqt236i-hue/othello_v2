"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const jsdom_1 = require("jsdom");
describe('story encounter result overlay', () => {
    let dom;
    beforeEach(() => {
        jest.resetModules();
        dom = new jsdom_1.JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost/' });
        global.window = dom.window;
        global.document = dom.window.document;
        global.localStorage = dom.window.localStorage;
        global.gameState = { currentPlayer: 1, board: [], turnNumber: 0 };
        global.cardState = {
            chargeGainedTotal: { black: 0, white: 0 },
            cardUseCountByPlayer: { black: 0, white: 0 },
            totalFlipCountByPlayer: { black: 0, white: 0 },
            cornerCaptureCountByPlayer: { black: 0, white: 0 },
            turnCountByPlayer: { black: 0, white: 0 },
            turnIndex: 0
        };
        global.cpuSmartness = { black: 1, white: 1 };
        global.countDiscs = jest.fn(() => ({ black: 40, white: 24 }));
        global.resetGame = jest.fn();
        window.MATCH_MODE = 'cpu';
    });
    afterEach(() => {
        try {
            if (dom && dom.window && typeof dom.window.close === 'function') {
                dom.window.close();
            }
        }
        catch (e) { /* Intentionally empty: test cleanup guard */ }
        delete global.window;
        delete global.document;
        delete global.localStorage;
        delete global.gameState;
        delete global.cardState;
        delete global.cpuSmartness;
        delete global.countDiscs;
        delete global.resetGame;
    });
    test('story encounter uses dedicated layout and exit does not reset the board', async () => {
        const onSecondary = jest.fn(() => Promise.resolve(true));
        window.Story = {
            Encounter: {
                isActive: () => true,
                resolveStoryEncounterResult: () => ({
                    layout: 'story',
                    title: '勝利',
                    statusClass: 'win',
                    localOutcomeKey: 'win',
                    metaText: 'ストーリー対局: ランキング対象外',
                    speakerName: '盤喰いの小鬼',
                    enemyImageSrc: 'assets/story/cpu/level1.png',
                    dialogueLines: ['ぐっ……！ こんなやつに負けるなんて聞いてねえぞ！'],
                    primaryLabel: '続ける',
                    secondaryLabel: '終了',
                    onPrimary: jest.fn(() => Promise.resolve(true)),
                    onSecondary
                })
            }
        };
        import * as mod from '../ui/result-overlay.js';
        mod.showResultOverlay();
        const overlay = document.getElementById('result-overlay');
        const panel = document.querySelector('.story-result-panel');
        const portrait = document.querySelector('.story-result-portrait');
        const totalScore = document.querySelector('.result-total-score');
        const closeBtn = Array.from(document.querySelectorAll('.result-btn-row button'))
            .find((el) => el.textContent === '終了');
        expect(overlay).toBeTruthy();
        expect(overlay.className).toContain('story-result-overlay');
        expect(panel).toBeTruthy();
        expect(document.querySelector('.story-result-name').textContent).toBe('盤喰いの小鬼');
        expect(portrait.getAttribute('src')).toBe('assets/story/cpu/level1.png');
        expect(totalScore).toBeNull();
        closeBtn.click();
        await Promise.resolve();
        expect(onSecondary).toHaveBeenCalled();
        expect(global.resetGame).not.toHaveBeenCalled();
    });
});
//# sourceMappingURL=ui.result-overlay.story-result.test.js.map