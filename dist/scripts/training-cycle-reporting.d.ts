declare function extractTrainingCycleFailureDetail(error: any, context: any): any;
declare function annotateTrainingCycleError(error: any, context: any): Error;
declare function buildTrainingCycleSummaryConfig(args: any): {};
declare function buildTrainingCycleSummaryPayload(args: any, options: any): {
    generatedAt: string;
    elapsedMs: number;
    config: {};
    latestGuideModelPath: any;
    latestGuideModelPoolPaths: any;
    latestResumeCheckpointPath: any;
    latestResumeCheckpointPaths: any;
    latestAnchorModelPath: any;
    warehouseManifestSchemaVersion: string;
    latestWarehouseManifestPath: any;
    stoppedByTimeBudget: any;
    stopReason: any;
    failure: any;
    iterations: any;
};
declare function writeSummarySnapshot(args: any, startedAt: any, iterations: any, guideModelPath: any, guideModelPoolPaths: any, resumeCheckpointPaths: any, anchorModelPath: any, stoppedByTimeBudget: any, stopReason: any, failureDetail: any): {
    generatedAt: string;
    elapsedMs: number;
    config: {};
    latestGuideModelPath: any;
    latestGuideModelPoolPaths: any;
    latestResumeCheckpointPath: any;
    latestResumeCheckpointPaths: any;
    latestAnchorModelPath: any;
    warehouseManifestSchemaVersion: string;
    latestWarehouseManifestPath: any;
    stoppedByTimeBudget: any;
    stopReason: any;
    failure: any;
    iterations: any;
};
declare const _default: {
    TRAINING_CYCLE_SUMMARY_CONFIG_KEYS: readonly string[];
    extractTrainingCycleFailureDetail: typeof extractTrainingCycleFailureDetail;
    annotateTrainingCycleError: typeof annotateTrainingCycleError;
    buildTrainingCycleSummaryConfig: typeof buildTrainingCycleSummaryConfig;
    buildTrainingCycleSummaryPayload: typeof buildTrainingCycleSummaryPayload;
    writeSummarySnapshot: typeof writeSummarySnapshot;
};
export = _default;
//# sourceMappingURL=training-cycle-reporting.d.ts.map