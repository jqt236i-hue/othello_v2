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
const TutorialStepsModule = __importStar(require("../ui/tutorial/tutorial-steps.js"));
describe('tutorial steps data', () => {
    test('chapter0 keeps fixed intro + 38-step main flow', () => {
        const scenario = TutorialStepsModule.getScenario('chapter0');
        expect(scenario).toBeTruthy();
        expect(scenario.kind).toBe(TutorialStepsModule.SCENARIO_KINDS.TUTORIAL);
        expect(scenario.progressionGroup).toBe(TutorialStepsModule.SCENARIO_KINDS.TUTORIAL);
        expect(scenario.progressionId).toBe('chapter0');
        expect(scenario.menuLabel).toBe('第零章 チュートリアル');
        expect(scenario.menuDescription).toBe('盤理の観測者と基本ルールを学ぶ導入章。');
        expect(scenario.entryStepId).toBe('INTRO_SCENE_001');
        expect(scenario.mainEntryStepId).toBe('STEP_001');
        expect(scenario.mainStepIds).toHaveLength(38);
        expect(scenario.mainStepIds[0]).toBe('STEP_001');
        expect(scenario.mainStepIds[37]).toBe('STEP_038');
    });
    test('intro branch and completion flags stay fixed', () => {
        const introScene = TutorialStepsModule.getScenarioStep('chapter0', 'INTRO_SCENE_005');
        const modernScene = TutorialStepsModule.getScenarioStep('chapter0', 'INTRO_SCENE_001');
        const chapterOne = TutorialStepsModule.getScenarioStep('chapter0', 'STEP_001');
        const introBranch = TutorialStepsModule.getScenarioStep('chapter0', 'INTRO_BRANCH');
        const completed = TutorialStepsModule.getScenarioStep('chapter0', 'STEP_038');
        expect(modernScene.sceneBackgroundSrc).toBe('assets/story/background/ただの学生の部屋.png');
        expect(modernScene.sceneTransition).toBe('fade_black');
        expect(modernScene.characterImageSrc).toBe('assets/story/hero/現実世界の勇者.png');
        expect(introScene.sceneBackgroundSrc).toBe('assets/story/background/森背景.png');
        expect(introScene.sceneTransition).toBe('fade_black');
        expect(introScene.headBubbleText).toBeUndefined();
        expect(chapterOne.sceneBackgroundSrc).toBeUndefined();
        expect(chapterOne.observerVisible).toBe(true);
        expect(chapterOne.observerStage).toBe('top');
        expect(introBranch.choices.map((choice) => choice.label)).toEqual(['はい', 'いいえ']);
        expect(introBranch.responseMap.intro_yes.text).toBe('感謝しよう。それではルール説明に入るぞ！');
        expect(introBranch.responseMap.intro_no.text).toBe('お前には失望したよ。ここで消えてもらおうか。');
        expect(completed.result).toEqual({
            unlockNormalGame: true,
            openMatchStartModal: true,
            saveTutorialCleared: true
        });
        expect(TutorialStepsModule.getTutorialScenarioIds()).toEqual(['chapter0']);
        expect(TutorialStepsModule.getStoryScenarioIds()).toEqual([]);
    });
});
//# sourceMappingURL=ui.tutorial-steps.test.js.map