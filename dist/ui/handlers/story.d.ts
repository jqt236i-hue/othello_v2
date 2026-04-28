declare function resolveStoryController(rootRef: any, tutorialOverlay: any, storyBtn: any): any;
declare function resolveTutorialController(rootRef: any, tutorialOverlay: any): any;
declare function markUnavailable(storyBtn: any, storyMenuOverlay: any): void;
declare function setupStoryControls(storyBtn: any, storyMenuOverlay: HTMLElement | null, tutorialOverlay: any, options?: any): any;
declare const StoryHandler: {
    resolveController: typeof resolveStoryController;
    resolveStoryController: typeof resolveStoryController;
    resolveTutorialController: typeof resolveTutorialController;
    markUnavailable: typeof markUnavailable;
    setupStoryControls: typeof setupStoryControls;
};
export = StoryHandler;
//# sourceMappingURL=story.d.ts.map