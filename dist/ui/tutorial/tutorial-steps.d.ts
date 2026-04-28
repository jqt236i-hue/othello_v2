declare function getDefaultScenarioId(): string;
declare function getScenario(scenarioId: string): any;
declare function getScenarioStep(scenarioId: string, stepId: string): any;
declare function getScenarioIds(): string[];
declare function getScenarioKind(scenarioId: string): string | null;
declare function isTutorialScenario(scenarioId: string): boolean;
declare function getScenarioIdsByKind(kind: string): string[];
declare function getTutorialScenarioIds(): string[];
declare function getStoryScenarioIds(): string[];
declare const TutorialStepsModule: {
    DEFAULT_SCENARIO_ID: string;
    SCENARIO_KINDS: any;
    OBSERVER_NAME: string;
    OBSERVER_IMAGE_SRC: string;
    tutorialScenarios: any;
    storyScenarios: any;
    scenarios: any;
    getDefaultScenarioId: typeof getDefaultScenarioId;
    getScenario: typeof getScenario;
    getScenarioStep: typeof getScenarioStep;
    getScenarioIds: typeof getScenarioIds;
    getScenarioKind: typeof getScenarioKind;
    isTutorialScenario: typeof isTutorialScenario;
    getScenarioIdsByKind: typeof getScenarioIdsByKind;
    getTutorialScenarioIds: typeof getTutorialScenarioIds;
    getStoryScenarioIds: typeof getStoryScenarioIds;
};
export = TutorialStepsModule;
//# sourceMappingURL=tutorial-steps.d.ts.map