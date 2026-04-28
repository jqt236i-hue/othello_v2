"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const jsdom_1 = require("jsdom");
const TutorialControllerModule = __importStar(require("../ui/tutorial/tutorial-controller.js"));
const TutorialStateModule = __importStar(require("../ui/tutorial/tutorial-state.js"));
async function advanceUntilChoiceVisible(dom, overlayRoot, dialogWindow) {
    const deadline = Date.now() + 2500;
    while (Date.now() < deadline) {
        const choiceButton = overlayRoot.querySelector('.tutorial-choice-btn');
        if (choiceButton)
            return choiceButton;
        dialogWindow.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
        await new Promise((resolve) => setTimeout(resolve, 20));
    }
    return overlayRoot.querySelector('.tutorial-choice-btn');
}
describe('tutorial controller close behavior', () => {
    afterEach(() => {
        TutorialStateModule.resetState();
    });
    test('外側クリックと Escape では閉じず、終了ボタンで閉じる', async () => {
        const dom = new jsdom_1.JSDOM('<button id="tutorialBtn">tutorial</button><div id="tutorialOverlay"></div>');
        const button = dom.window.document.getElementById('tutorialBtn');
        const overlayRoot = dom.window.document.getElementById('tutorialOverlay');
        const controller = TutorialControllerModule.createTutorialController({
            root: dom.window,
            overlay: overlayRoot,
            button
        });
        await controller.open();
        overlayRoot.querySelector('.tutorial-backdrop').dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
        expect(overlayRoot.getAttribute('aria-hidden')).toBe('false');
        dom.window.document.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
        expect(overlayRoot.getAttribute('aria-hidden')).toBe('false');
        overlayRoot.querySelector('.tutorial-exit-btn').click();
        expect(overlayRoot.getAttribute('aria-hidden')).toBe('true');
    });
    test('会話送りと選択肢決定で story SE を鳴らす', async () => {
        const dom = new jsdom_1.JSDOM('<button id="tutorialBtn">tutorial</button><div id="tutorialOverlay"></div>');
        const button = dom.window.document.getElementById('tutorialBtn');
        const overlayRoot = dom.window.document.getElementById('tutorialOverlay');
        const playEffectByKey = jest.fn();
        dom.window.SoundEngine = {
            init: jest.fn(),
            playEffectByKey
        };
        const controller = TutorialControllerModule.createTutorialController({
            root: dom.window,
            overlay: overlayRoot,
            button
        });
        await controller.open();
        const dialogWindow = overlayRoot.querySelector('.tutorial-dialog-window');
        const choiceButton = await advanceUntilChoiceVisible(dom, overlayRoot, dialogWindow);
        expect(playEffectByKey).toHaveBeenCalledWith('tutorial_story_effect', expect.objectContaining({
            filePath: 'assets/story/sound-ef/テキストをクリックするとき.mp3'
        }));
        const textClickCall = playEffectByKey.mock.calls.find(([key, options]) => (key === 'tutorial_story_effect'
            && options
            && options.filePath === 'assets/story/sound-ef/テキストをクリックするとき.mp3'));
        expect(textClickCall[1].volumeScale).toBeUndefined();
        expect(choiceButton).toBeTruthy();
        choiceButton.click();
        expect(dom.window.Tutorial.State.getState().mode).toBe('dialogue');
        expect(playEffectByKey).toHaveBeenCalledWith('tutorial_story_effect', expect.objectContaining({
            filePath: 'assets/story/sound-ef/自分視点選択肢を選ぶとき.mp3'
        }));
        const choiceSelectCall = playEffectByKey.mock.calls.find(([key, options]) => (key === 'tutorial_story_effect'
            && options
            && options.filePath === 'assets/story/sound-ef/自分視点選択肢を選ぶとき.mp3'));
        expect(choiceSelectCall[1].volumeScale).toBeUndefined();
    });
    test('進行不能な dialog click ではテキスト SE を鳴らさない', async () => {
        const dom = new jsdom_1.JSDOM('<button id="tutorialBtn">tutorial</button><div id="tutorialOverlay"></div>');
        const button = dom.window.document.getElementById('tutorialBtn');
        const overlayRoot = dom.window.document.getElementById('tutorialOverlay');
        const playEffectByKey = jest.fn();
        dom.window.SoundEngine = {
            init: jest.fn(),
            playEffectByKey
        };
        const controller = TutorialControllerModule.createTutorialController({
            root: dom.window,
            overlay: overlayRoot,
            button
        });
        await controller.open();
        playEffectByKey.mockClear();
        const dialogWindow = overlayRoot.querySelector('.tutorial-dialog-window');
        await advanceUntilChoiceVisible(dom, overlayRoot, dialogWindow);
        playEffectByKey.mockClear();
        dialogWindow.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
        expect(playEffectByKey).not.toHaveBeenCalledWith('tutorial_story_effect', expect.objectContaining({
            filePath: 'assets/story/sound-ef/テキストをクリックするとき.mp3'
        }));
    });
});
//# sourceMappingURL=ui.tutorial-controller.test.js.map