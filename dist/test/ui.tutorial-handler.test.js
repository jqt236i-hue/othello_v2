"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const jsdom_1 = require("jsdom");
const tutorial_js_1 = require("../ui/handlers/tutorial.js");
describe('tutorial handler fallback', () => {
    test('controller が無いとき tutorial ボタンを無効化する', () => {
        const dom = new jsdom_1.JSDOM('<button id="tutorialBtn">tutorial</button><div id="tutorialOverlay"></div>');
        const button = dom.window.document.getElementById('tutorialBtn');
        const overlay = dom.window.document.getElementById('tutorialOverlay');
        const result = (0, tutorial_js_1.setupTutorialControls)(button, overlay, { root: dom.window });
        expect(result).toBeNull();
        expect(button.disabled).toBe(true);
        expect(button.getAttribute('aria-disabled')).toBe('true');
        expect(button.dataset.tutorialState).toBe('unavailable');
        expect(button.title).toBe('tutorial は準備中です');
        expect(overlay.getAttribute('aria-hidden')).toBe('true');
    });
    test('controller があるとき tutorial ボタンを有効化して open を呼ぶ', () => {
        const dom = new jsdom_1.JSDOM('<button id="tutorialBtn">tutorial</button><div id="tutorialOverlay"></div>');
        const button = dom.window.document.getElementById('tutorialBtn');
        const overlay = dom.window.document.getElementById('tutorialOverlay');
        const open = jest.fn();
        dom.window.TutorialControllerModule = {
            createTutorialController: jest.fn(() => ({ open }))
        };
        const result = (0, tutorial_js_1.setupTutorialControls)(button, overlay, { root: dom.window });
        expect(result).toBeTruthy();
        expect(button.disabled).toBe(false);
        expect(button.dataset.tutorialState).toBe('ready');
        button.click();
        expect(open).toHaveBeenCalledTimes(1);
    });
});
//# sourceMappingURL=ui.tutorial-handler.test.js.map