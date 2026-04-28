interface LayoutProfileResult {
    profile: string;
    blockPhoneLandscape: boolean;
}
declare function resolveLayoutProfile(viewport: {
    width: number;
    height: number;
}, simAspect: number | null): LayoutProfileResult;
declare function getBaseSizeForProfile(profile: string): {
    width: number;
    height: number;
};
declare function getViewportSize(): {
    width: number;
    height: number;
};
declare function applyLayoutStageVars(): void;
declare function scheduleApplyLayoutStageVars(): void;
declare const LayoutStage: {
    applyLayoutStageVars: typeof applyLayoutStageVars;
    scheduleApplyLayoutStageVars: typeof scheduleApplyLayoutStageVars;
    getBaseSizeForProfile: typeof getBaseSizeForProfile;
    resolveLayoutProfile: typeof resolveLayoutProfile;
    getViewportSize: typeof getViewportSize;
};
export = LayoutStage;
//# sourceMappingURL=layout-stage.d.ts.map