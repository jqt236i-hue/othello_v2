interface TutorialPersonality {
    straight: number;
    bold: number;
    snark: number;
}
interface TutorialState {
    active: boolean;
    scenarioId: string | null;
    stepId: string | null;
    mode: string;
    allowAbort: boolean;
    personality: TutorialPersonality;
    flags: Record<string, any>;
    scenarioContext: any;
    observerDuel: {
        active: boolean;
        postResultPhase: string | null;
        previousCpuSmartness: any;
    };
}
declare function resetState(): TutorialState;
declare function beginScenario(meta?: any): TutorialState;
declare function setActive(active: boolean): boolean;
declare function setScenarioId(scenarioId: string | null): string | null;
declare function setStep(stepId: string | null, mode?: string): string | null;
declare function setMode(mode: string): string;
declare function setAllowAbort(allowAbort: boolean): boolean;
declare function replaceFlags(flags: any): Record<string, any>;
declare function mergeFlags(flags: any): Record<string, any>;
declare function setFlag(key: string, value: any): any;
declare function getFlag(key: string, fallback?: any): any;
declare function addPersonality(delta: any): TutorialPersonality;
declare function setScenarioContext(context: any): any;
declare function mergeScenarioContext(patch: any): any;
declare function setObserverDuelState(patch: any): TutorialState['observerDuel'];
declare function isActive(): boolean;
declare function isObserverDuelActive(): boolean;
declare function getTutorialScenarioContext(): any;
declare const TutorialStateModule: {
    tutorialState: TutorialState;
    resetState: typeof resetState;
    beginScenario: typeof beginScenario;
    setActive: typeof setActive;
    setScenarioId: typeof setScenarioId;
    setStep: typeof setStep;
    setMode: typeof setMode;
    setAllowAbort: typeof setAllowAbort;
    replaceFlags: typeof replaceFlags;
    mergeFlags: typeof mergeFlags;
    setFlag: typeof setFlag;
    getFlag: typeof getFlag;
    addPersonality: typeof addPersonality;
    setScenarioContext: typeof setScenarioContext;
    mergeScenarioContext: typeof mergeScenarioContext;
    setObserverDuelState: typeof setObserverDuelState;
    publicApi: {
        getState: () => TutorialState;
        isActive: typeof isActive;
        isObserverDuelActive: typeof isObserverDuelActive;
        getTutorialScenarioContext: typeof getTutorialScenarioContext;
    };
};
export = TutorialStateModule;
//# sourceMappingURL=tutorial-state.d.ts.map