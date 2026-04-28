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
const StoryStepsModule = __importStar(require("../ui/story/story-steps.js"));
describe('story steps data', () => {
    test('chapter1 keeps fixed opening, goblin encounter, and clear flags', () => {
        const chapter = StoryStepsModule.getChapter('chapter1');
        expect(chapter).toBeTruthy();
        expect(chapter.kind).toBe('story');
        expect(chapter.progressionGroup).toBe('story');
        expect(chapter.progressionId).toBe('chapter1');
        expect(chapter.entryStepId).toBe('CHAPTER1_STEP_001');
        expect(chapter.unlockRequirementTutorialId).toBe('chapter0');
        expect(chapter.unlocksChapterIds).toEqual(['chapter2']);
        const opening = StoryStepsModule.getChapterStep('chapter1', 'CHAPTER1_STEP_001');
        const goblinChoice = StoryStepsModule.getChapterStep('chapter1', 'CHAPTER1_STEP_011');
        const executioner = StoryStepsModule.getChapterStep('chapter1', 'CHAPTER1_STEP_025');
        const completed = StoryStepsModule.getChapterStep('chapter1', 'CHAPTER1_STEP_030');
        expect(opening.sceneBackgroundSrc).toBe('assets/story/background/森背景.png');
        expect(opening.characterImageSrc).toBe('assets/story/hero/hero.png');
        expect(goblinChoice.choices.map((choice) => choice.label)).toEqual(['戦う', '逃げる']);
        expect(goblinChoice.actionByChoice.fight_goblin).toBe('start_goblin_encounter');
        expect(goblinChoice.nextByChoice.run_away).toBe('CHAPTER1_ESCAPE_001');
        expect(executioner.supportImageSrc).toBe('assets/story/stones/ULTIMATE_DESTROY_GOD-white.png');
        expect(completed.result).toEqual({
            saveStoryChapterCleared: true,
            unlockStoryChapterIds: ['chapter2']
        });
    });
    test('chapter2 keeps recap, village support scenes, and no chapter3 unlock flags', () => {
        const chapter = StoryStepsModule.getChapter('chapter2');
        expect(chapter).toBeTruthy();
        expect(chapter.kind).toBe('story');
        expect(chapter.progressionGroup).toBe('story');
        expect(chapter.progressionId).toBe('chapter2');
        expect(chapter.entryStepId).toBe('CHAPTER2_STEP_001');
        expect(chapter.unlocksChapterIds).toEqual([]);
        expect(chapter.lockMessage).toBe('第一章をクリアすると解放されます。');
        const recap = StoryStepsModule.getChapterStep('chapter2', 'CHAPTER2_STEP_001');
        const rideChoice = StoryStepsModule.getChapterStep('chapter2', 'CHAPTER2_STEP_006');
        const villageIntro = StoryStepsModule.getChapterStep('chapter2', 'CHAPTER2_STEP_008');
        const villageSupportIntro = StoryStepsModule.getChapterStep('chapter2', 'CHAPTER2_STEP_027');
        const villageSupportGrant = StoryStepsModule.getChapterStep('chapter2', 'CHAPTER2_STEP_035');
        const theoryScene = StoryStepsModule.getChapterStep('chapter2', 'CHAPTER2_STEP_045');
        const completed = StoryStepsModule.getChapterStep('chapter2', 'CHAPTER2_STEP_054');
        expect(recap.sceneBackgroundSrc).toBe('assets/story/background/森背景.png');
        expect(recap.supportImageSrc).toBe('assets/story/stones/ULTIMATE_DESTROY_GOD-white.png');
        expect(rideChoice.choices.map((choice) => choice.label)).toEqual(['わかった', '誰がお前なんかに乗るか！']);
        expect(rideChoice.nextByChoice.reject_nigel).toBe('CHAPTER2_GAMEOVER_001');
        expect(villageIntro.sceneBackgroundSrc).toBe('assets/story/background/多動の村.png');
        expect(villageSupportIntro.sceneBackgroundSrc).toBe('assets/story/background/多動の村.png');
        expect(villageSupportIntro.supportImageSrc).toBe('assets/story/stones/ULTIMATE_HYPERACTIVE_GOD-black.png');
        expect(villageSupportGrant.sceneBackgroundSrc).toBe('assets/story/background/多動の村.png');
        expect(theoryScene.sceneBackgroundSrc).toBe('assets/story/background/理論の部屋.png');
        expect(theoryScene.characterImageSrc).toBe('assets/story/cpu/level7.png');
        expect(completed.result).toEqual({
            saveStoryChapterCleared: true
        });
    });
});
//# sourceMappingURL=ui.story-steps.test.js.map