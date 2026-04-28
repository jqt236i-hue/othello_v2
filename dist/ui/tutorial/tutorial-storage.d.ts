interface ProgressData {
    tutorial: {
        clearedScenarioIds: Record<string, boolean>;
    };
    story: {
        unlockedChapterIds: Record<string, boolean>;
        clearedChapterIds: Record<string, boolean>;
    };
}
declare function createEmptyProgress(): ProgressData;
declare function readProgress(): ProgressData;
declare function writeProgress(progress: any): boolean;
declare function isTutorialScenarioCleared(scenarioId: string): boolean;
declare function saveTutorialScenarioCleared(scenarioId: string, cleared?: boolean): boolean;
declare function isStoryChapterUnlocked(chapterId: string): boolean;
declare function saveStoryChapterUnlocked(chapterId: string, unlocked?: boolean): boolean;
declare function isStoryChapterCleared(chapterId: string): boolean;
declare function saveStoryChapterCleared(chapterId: string, cleared?: boolean): boolean;
declare function isScenarioCleared(scenarioId: string): boolean;
declare function saveScenarioCleared(scenarioId: string, cleared?: boolean): boolean;
declare const TutorialStorage: {
    STORAGE_KEY: string;
    createEmptyProgress: typeof createEmptyProgress;
    readProgress: typeof readProgress;
    writeProgress: typeof writeProgress;
    isTutorialScenarioCleared: typeof isTutorialScenarioCleared;
    saveTutorialScenarioCleared: typeof saveTutorialScenarioCleared;
    isStoryChapterUnlocked: typeof isStoryChapterUnlocked;
    saveStoryChapterUnlocked: typeof saveStoryChapterUnlocked;
    isStoryChapterCleared: typeof isStoryChapterCleared;
    saveStoryChapterCleared: typeof saveStoryChapterCleared;
    isScenarioCleared: typeof isScenarioCleared;
    saveScenarioCleared: typeof saveScenarioCleared;
};
export = TutorialStorage;
//# sourceMappingURL=tutorial-storage.d.ts.map