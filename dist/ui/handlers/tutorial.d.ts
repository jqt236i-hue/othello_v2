/**
 * @file tutorial.ts
 * @description Tutorial UI handler
 */
interface TutorialController {
    open: () => void;
}
interface TutorialControllerModule {
    createTutorialController: (config: {
        root: Window;
        overlay: HTMLElement | null;
        button: HTMLElement | null;
    }) => TutorialController | null;
}
interface TutorialOptions {
    root?: Window;
}
declare function resolveController(rootRef: Window & {
    TutorialControllerModule?: TutorialControllerModule;
}, tutorialOverlay: HTMLElement | null, tutorialBtn: HTMLElement | null): TutorialController | null;
declare function markUnavailable(tutorialBtn: HTMLElement | null, tutorialOverlay: HTMLElement | null): void;
declare function setupTutorialControls(tutorialBtn: HTMLElement | null, tutorialOverlay: HTMLElement | null, options: TutorialOptions): TutorialController | null;
declare const _default: {
    resolveController: typeof resolveController;
    markUnavailable: typeof markUnavailable;
    setupTutorialControls: typeof setupTutorialControls;
};
export = _default;
//# sourceMappingURL=tutorial.d.ts.map