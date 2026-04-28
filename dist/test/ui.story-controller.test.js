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
const StoryControllerModule = __importStar(require("../ui/story/story-controller.js"));
const StoryStateModule = __importStar(require("../ui/story/story-state.js"));
const TutorialStorageModule = __importStar(require("../ui/tutorial/tutorial-storage.js"));
describe('story controller chapter unlock + open', () => {
    afterEach(() => {
        StoryStateModule.resetState();
        delete global.localStorage;
    });
    test('chapter1 stays locked until chapter0 clear, then opens from the story overlay', async () => {
        const dom = new jsdom_1.JSDOM('<button id="storyBtn">story</button><div id="tutorialOverlay"></div>', {
            url: 'http://localhost/'
        });
        global.localStorage = dom.window.localStorage;
        const button = dom.window.document.getElementById('storyBtn');
        const overlayRoot = dom.window.document.getElementById('tutorialOverlay');
        const controller = StoryControllerModule.createStoryController({
            root: dom.window,
            overlay: overlayRoot,
            button
        });
        expect(controller.getChapterAvailability('chapter1').unlocked).toBe(false);
        TutorialStorageModule.saveTutorialScenarioCleared('chapter0', true);
        const availability = controller.getChapterAvailability('chapter1');
        expect(availability.unlocked).toBe(true);
        expect(TutorialStorageModule.isStoryChapterUnlocked('chapter1')).toBe(true);
        await controller.open({ chapterId: 'chapter1' });
        expect(dom.window.Story.State.getState().chapterId).toBe('chapter1');
        expect(overlayRoot.getAttribute('aria-hidden')).toBe('false');
        expect(overlayRoot.querySelector('.tutorial-speaker').textContent).toBe('オセロの勇者');
    });
    test('chapter2 opens after it is unlocked and starts from the recap scene', async () => {
        const dom = new jsdom_1.JSDOM('<button id="storyBtn">story</button><div id="tutorialOverlay"></div>', {
            url: 'http://localhost/'
        });
        global.localStorage = dom.window.localStorage;
        const button = dom.window.document.getElementById('storyBtn');
        const overlayRoot = dom.window.document.getElementById('tutorialOverlay');
        const controller = StoryControllerModule.createStoryController({
            root: dom.window,
            overlay: overlayRoot,
            button
        });
        TutorialStorageModule.saveStoryChapterUnlocked('chapter2', true);
        const availability = controller.getChapterAvailability('chapter2');
        expect(availability.unlocked).toBe(true);
        await controller.open({ chapterId: 'chapter2' });
        expect(dom.window.Story.State.getState().chapterId).toBe('chapter2');
        expect(dom.window.Story.State.getState().stepId).toBe('CHAPTER2_STEP_001');
        expect(overlayRoot.getAttribute('aria-hidden')).toBe('false');
        expect(overlayRoot.querySelector('.tutorial-speaker').textContent).toBe('盤理の観測者');
        expect(overlayRoot.querySelector('.tutorial-support-image').getAttribute('src')).toBe('assets/story/stones/ULTIMATE_DESTROY_GOD-white.png');
    });
});
//# sourceMappingURL=ui.story-controller.test.js.map