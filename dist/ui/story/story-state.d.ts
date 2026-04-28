interface StoryState {
    active: boolean;
    chapterId: string | null;
    stepId: string | null;
    mode: string;
    allowAbort: boolean;
    sceneContext: any;
    encounter: {
        active: boolean;
        encounterId: string | null;
        enemyName: string | null;
        enemyImageSrc: string | null;
        cpuLevel: number | null;
    };
}
declare function subscribe(listener: any): () => void;
declare function resetState(): StoryState;
declare function beginChapter(meta?: any): StoryState;
declare function setActive(active: boolean): boolean;
declare function setChapterId(chapterId: string | null): string | null;
declare function setStep(stepId: string | null, mode?: string): string | null;
declare function setMode(mode: string): string;
declare function setAllowAbort(allowAbort: boolean): boolean;
declare function setSceneContext(context: any): any;
declare function mergeSceneContext(patch: any): any;
declare function setEncounterState(patch: any): StoryState['encounter'];
declare function isActive(): boolean;
declare function isEncounterActive(): boolean;
declare function getStorySceneContext(): any;
declare const StoryStateModule: {
    storyState: StoryState;
    resetState: typeof resetState;
    beginChapter: typeof beginChapter;
    setActive: typeof setActive;
    setChapterId: typeof setChapterId;
    setStep: typeof setStep;
    setMode: typeof setMode;
    setAllowAbort: typeof setAllowAbort;
    setSceneContext: typeof setSceneContext;
    mergeSceneContext: typeof mergeSceneContext;
    setEncounterState: typeof setEncounterState;
    publicApi: {
        getState: () => StoryState;
        isActive: typeof isActive;
        isEncounterActive: typeof isEncounterActive;
        getStorySceneContext: typeof getStorySceneContext;
        subscribe: typeof subscribe;
    };
};
export = StoryStateModule;
//# sourceMappingURL=story-state.d.ts.map