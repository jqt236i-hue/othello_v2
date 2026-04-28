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
const StoryHandlerModule = __importStar(require("../ui/handlers/story.js"));
const StoryControllerModule = __importStar(require("../ui/story/story-controller.js"));
const StoryStepsModule = __importStar(require("../ui/story/story-steps.js"));
const TutorialStorageModule = __importStar(require("../ui/tutorial/tutorial-storage.js"));
describe('story handler menu rendering', () => {
    afterEach(() => {
        delete global.localStorage;
    });
    test('chapter list keeps chapter2 locked until chapter1 is cleared', () => {
        const dom = new jsdom_1.JSDOM('<button id="storyBtn">story</button><div id="storyMenuOverlay"></div><div id="tutorialOverlay"></div>', { url: 'http://localhost/' });
        global.localStorage = dom.window.localStorage;
        dom.window.StoryControllerModule = StoryControllerModule;
        dom.window.StoryStepsModule = StoryStepsModule;
        const storyBtn = dom.window.document.getElementById('storyBtn');
        const storyMenuOverlay = dom.window.document.getElementById('storyMenuOverlay');
        const tutorialOverlay = dom.window.document.getElementById('tutorialOverlay');
        StoryHandlerModule.setupStoryControls(storyBtn, storyMenuOverlay, tutorialOverlay, {
            root: dom.window
        });
        storyBtn.click();
        let chapterButtons = Array.from(storyMenuOverlay.querySelectorAll('.story-chapter-btn'));
        expect(chapterButtons).toHaveLength(3);
        expect(chapterButtons[0].disabled).toBe(false);
        expect(chapterButtons[0].dataset.storyEntryKind).toBe('tutorial');
        expect(chapterButtons[0].textContent).toContain('第零章 チュートリアル');
        expect(chapterButtons[0].textContent).toContain('playable');
        expect(chapterButtons[1].disabled).toBe(true);
        expect(chapterButtons[1].dataset.storyEntryKind).toBe('story');
        expect(chapterButtons[1].textContent).toContain('第一章');
        expect(chapterButtons[1].textContent).toContain('プレイするにはチュートリアルをクリアしてください。');
        expect(chapterButtons[2].disabled).toBe(true);
        expect(chapterButtons[2].textContent).toContain('第二章');
        expect(chapterButtons[2].textContent).toContain('第一章をクリアすると解放されます。');
        expect(storyMenuOverlay.querySelector('.story-menu-note').textContent).toContain('第零章クリア後に第一章');
        storyBtn.click();
        TutorialStorageModule.saveTutorialScenarioCleared('chapter0', true);
        storyBtn.click();
        chapterButtons = Array.from(storyMenuOverlay.querySelectorAll('.story-chapter-btn'));
        expect(chapterButtons[0].disabled).toBe(false);
        expect(chapterButtons[0].textContent).toContain('clear');
        expect(chapterButtons[1].disabled).toBe(false);
        expect(chapterButtons[1].textContent).toContain('playable');
        expect(chapterButtons[2].disabled).toBe(true);
        storyBtn.click();
        TutorialStorageModule.saveStoryChapterUnlocked('chapter2', true);
        storyBtn.click();
        chapterButtons = Array.from(storyMenuOverlay.querySelectorAll('.story-chapter-btn'));
        expect(chapterButtons[2].disabled).toBe(false);
        expect(chapterButtons[2].textContent).toContain('playable');
    });
});
//# sourceMappingURL=ui.story-handler.test.js.map