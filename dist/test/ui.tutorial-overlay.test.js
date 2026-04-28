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
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const jsdom_1 = require("jsdom");
const TutorialOverlayModule = __importStar(require("../ui/tutorial/tutorial-overlay.js"));
function loadTutorialOverlayStyles() {
    return fs.readFileSync(path.resolve(__dirname, '../styles-layout.css'), 'utf8');
}
describe('tutorial overlay', () => {
    test('長文は固定枠に合わせて複数ページへ分割する', () => {
        const dom = new jsdom_1.JSDOM('<div id="tutorialOverlay"></div>');
        const overlayRoot = dom.window.document.getElementById('tutorialOverlay');
        const overlay = TutorialOverlayModule.createTutorialOverlay({ overlay: overlayRoot });
        overlay.open();
        overlay.renderFrame({
            chapterLabel: '0章 導入',
            speaker: '盤理の観測者',
            bodyText: ''
        });
        Object.defineProperty(overlay.refs.body, 'clientHeight', {
            configurable: true,
            value: 84
        });
        Object.defineProperty(overlay.refs.body, 'clientWidth', {
            configurable: true,
            value: 420
        });
        Object.defineProperty(overlay.refs.bodyMeasure, 'scrollHeight', {
            configurable: true,
            get() {
                const length = String(this.textContent || '').length;
                return Math.max(28, Math.ceil(length / 24) * 28);
            }
        });
        const pages = overlay.paginateBodyText('ようこそ。オセロの勇者よ。ここはオセロが不可逆的に何者かに書き換えられてしまった世界だ。'
            + '私はこの星で行われている対局を全て観測している。'
            + '目的は美しいオセロを取り戻すことだ。');
        expect(Array.isArray(pages)).toBe(true);
        expect(pages.length).toBeGreaterThan(1);
        expect(overlay.refs.exitButton).toBeTruthy();
    });
    test('閉じている間は overlay の子要素がクリックを奪わない', () => {
        const styles = loadTutorialOverlayStyles();
        const dom = new jsdom_1.JSDOM(`<!DOCTYPE html><html><head><style>${styles}</style></head><body><div id="tutorialOverlay" aria-hidden="true"></div></body></html>`, { pretendToBeVisual: true });
        const overlayRoot = dom.window.document.getElementById('tutorialOverlay');
        const overlay = TutorialOverlayModule.createTutorialOverlay({ overlay: overlayRoot });
        const getPointerEvents = (element) => dom.window.getComputedStyle(element).pointerEvents;
        expect(overlayRoot.getAttribute('aria-hidden')).toBe('true');
        expect(overlay.refs.exitButton.disabled).toBe(true);
        expect(getPointerEvents(overlay.refs.backdrop)).toBe('none');
        expect(getPointerEvents(overlay.refs.dialogWindow)).toBe('none');
        expect(getPointerEvents(overlay.refs.exitButton)).toBe('none');
        expect(getPointerEvents(overlay.refs.choicePanel)).toBe('none');
        overlay.open();
        expect(overlayRoot.getAttribute('aria-hidden')).toBe('false');
        expect(overlay.refs.exitButton.disabled).toBe(false);
        expect(getPointerEvents(overlay.refs.backdrop)).toBe('auto');
        expect(getPointerEvents(overlay.refs.dialogWindow)).toBe('auto');
        expect(getPointerEvents(overlay.refs.exitButton)).toBe('auto');
        expect(getPointerEvents(overlay.refs.choicePanel)).toBe('auto');
        overlay.setPassthrough(true);
        expect(getPointerEvents(overlayRoot)).toBe('none');
        expect(getPointerEvents(overlay.refs.backdrop)).toBe('none');
        expect(getPointerEvents(overlay.refs.dialogWindow)).toBe('auto');
        expect(getPointerEvents(overlay.refs.exitButton)).toBe('auto');
        overlay.close();
        expect(overlayRoot.getAttribute('aria-hidden')).toBe('true');
        expect(overlay.refs.exitButton.disabled).toBe(true);
        expect(getPointerEvents(overlay.refs.backdrop)).toBe('none');
        expect(getPointerEvents(overlay.refs.dialogWindow)).toBe('none');
        expect(getPointerEvents(overlay.refs.exitButton)).toBe('none');
        expect(getPointerEvents(overlay.refs.choicePanel)).toBe('none');
        dom.window.close();
    });
    test('exit only mode では終了ボタンだけを残して盤面操作を通す', () => {
        const styles = loadTutorialOverlayStyles();
        const dom = new jsdom_1.JSDOM(`<!DOCTYPE html><html><head><style>${styles}</style></head><body><div id="tutorialOverlay"></div></body></html>`, { pretendToBeVisual: true });
        const overlayRoot = dom.window.document.getElementById('tutorialOverlay');
        const overlay = TutorialOverlayModule.createTutorialOverlay({ overlay: overlayRoot });
        overlay.open();
        overlay.setExitOnlyMode(true);
        overlay.setPassthrough(true);
        expect(overlayRoot.classList.contains('tutorial-exit-only')).toBe(true);
        expect(dom.window.getComputedStyle(overlay.refs.dialogWindow).display).toBe('none');
        expect(dom.window.getComputedStyle(overlay.refs.exitButton).pointerEvents).toBe('auto');
        overlay.setExitOnlyMode(false);
        overlay.open();
        expect(overlayRoot.classList.contains('tutorial-exit-only')).toBe(false);
        expect(dom.window.getComputedStyle(overlay.refs.dialogWindow).display).toBe('flex');
        dom.window.close();
    });
    test('会話ウィンドウ内テキストは選択できない', () => {
        const styles = loadTutorialOverlayStyles();
        const dom = new jsdom_1.JSDOM(`<!DOCTYPE html><html><head><style>${styles}</style></head><body><div id="tutorialOverlay"></div></body></html>`, { pretendToBeVisual: true });
        const overlayRoot = dom.window.document.getElementById('tutorialOverlay');
        const overlay = TutorialOverlayModule.createTutorialOverlay({ overlay: overlayRoot });
        expect(dom.window.getComputedStyle(overlay.refs.dialogWindow).userSelect).toBe('none');
        expect(dom.window.getComputedStyle(overlay.refs.speaker).userSelect).toBe('none');
        expect(dom.window.getComputedStyle(overlay.refs.body).userSelect).toBe('none');
    });
    test('シーン背景と立ち絵を step ごとに切り替えられる', () => {
        const styles = loadTutorialOverlayStyles();
        const dom = new jsdom_1.JSDOM(`<!DOCTYPE html><html><head><style>${styles}</style></head><body><div id="tutorialOverlay"></div></body></html>`, { pretendToBeVisual: true });
        const overlayRoot = dom.window.document.getElementById('tutorialOverlay');
        const overlay = TutorialOverlayModule.createTutorialOverlay({ overlay: overlayRoot });
        overlay.open();
        overlay.renderFrame({
            chapterLabel: '0章 導入',
            speaker: 'ただの学生',
            bodyText: 'test',
            sceneBackgroundSrc: 'assets/story/background/ただの学生の部屋.png',
            observerVisible: true,
            observerImageSrc: 'assets/story/hero/現実世界の勇者.png',
            observerImageAlt: '現実世界の勇者'
        });
        expect(overlay.refs.sceneBackground.getAttribute('src')).toBe('assets/story/background/ただの学生の部屋.png');
        expect(overlay.refs.sceneBackground.style.display).toBe('block');
        expect(overlay.refs.observerImage.getAttribute('src')).toBe('assets/story/hero/現実世界の勇者.png');
        expect(overlay.refs.observerImage.getAttribute('alt')).toBe('現実世界の勇者');
        expect(overlayRoot.classList.contains('tutorial-has-scene-background')).toBe(true);
        expect(overlayRoot.classList.contains('tutorial-board-scene')).toBe(false);
        expect(dom.window.getComputedStyle(overlay.refs.sceneBackground).zIndex).toBe('0');
        expect(dom.window.getComputedStyle(overlay.refs.observerStage).zIndex).toBe('20');
        expect(dom.window.getComputedStyle(overlay.refs.dialogWindow).zIndex).toBe('30');
        overlay.renderFrame({
            chapterLabel: 'CHAPTER 1 導入',
            speaker: '盤理の観測者',
            bodyText: 'test',
            sceneBackgroundSrc: '',
            observerVisible: true,
            observerImageSrc: 'assets/images/cpu/level6.png',
            observerImageAlt: '盤理の観測者'
        });
        expect(overlay.refs.sceneBackground.style.display).toBe('none');
        expect(overlayRoot.classList.contains('tutorial-has-scene-background')).toBe(false);
        expect(overlayRoot.classList.contains('tutorial-board-scene')).toBe(true);
    });
    test('support image は指定時に表示される', () => {
        const styles = loadTutorialOverlayStyles();
        const dom = new jsdom_1.JSDOM(`<!DOCTYPE html><html><head><style>${styles}</style></head><body><div id="tutorialOverlay"></div></body></html>`, { pretendToBeVisual: true });
        const overlayRoot = dom.window.document.getElementById('tutorialOverlay');
        const overlay = TutorialOverlayModule.createTutorialOverlay({ overlay: overlayRoot });
        overlay.open();
        overlay.renderFrame({
            chapterLabel: '第一章',
            speaker: '盤界の執行者',
            bodyText: 'いでよ、究極破壊神',
            supportVisible: true,
            supportImageSrc: 'assets/story/stones/ULTIMATE_DESTROY_GOD-white.png',
            supportImageAlt: '究極破壊神'
        });
        expect(overlay.refs.supportStage.style.display).toBe('block');
        expect(overlay.refs.supportImage.getAttribute('src')).toBe('assets/story/stones/ULTIMATE_DESTROY_GOD-white.png');
        expect(overlay.refs.supportImage.getAttribute('alt')).toBe('究極破壊神');
        expect(overlay.refs.supportImage.getAttribute('aria-hidden')).toBe('false');
        overlay.renderFrame({
            chapterLabel: '第一章',
            speaker: '盤界の執行者',
            bodyText: '去れ',
            supportVisible: false,
            supportImageSrc: '',
            supportImageAlt: ''
        });
        expect(overlay.refs.supportStage.style.display).toBe('none');
        expect(overlay.refs.supportImage.getAttribute('src')).toBe('');
        expect(overlay.refs.supportImage.getAttribute('aria-hidden')).toBe('true');
    });
    test('scene fade を再生できて途中で差し替え処理を呼べる', async () => {
        const dom = new jsdom_1.JSDOM('<div id="tutorialOverlay"></div>');
        const overlayRoot = dom.window.document.getElementById('tutorialOverlay');
        const overlay = TutorialOverlayModule.createTutorialOverlay({ overlay: overlayRoot });
        const onMidpoint = jest.fn();
        const pending = overlay.playSceneTransition('fade_black', onMidpoint);
        expect(overlay.refs.sceneFade.classList.contains('is-active')).toBe(true);
        await new Promise((resolve) => setTimeout(resolve, 280));
        expect(onMidpoint).toHaveBeenCalledTimes(1);
        overlay.refs.sceneFade.dispatchEvent(new dom.window.Event('animationend'));
        await expect(pending).resolves.toBe(true);
        expect(overlay.refs.sceneFade.classList.contains('is-active')).toBe(false);
    });
});
//# sourceMappingURL=ui.tutorial-overlay.test.js.map