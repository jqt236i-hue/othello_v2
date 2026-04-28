declare function formatBytes(value: any): string;
declare function buildWarehouseCompanionArtifactPaths(filePath: string): string[];
declare function listTrainingWarehouseManifestPaths(runsDir: string): string[];
declare function readTrainingWarehouseManifest(manifestPath: string): any;
declare function collectWarehouseSelfplayArtifactPaths(manifest: any): string[];
declare function collectStaleOrphanSelfplayArtifactPaths(runsDir: any, options: any): string[];
declare function resolveRunsCleanupRoot(runsDir: any, options: any): string | null;
declare function cleanupWarehouseSelfplayArtifacts(runsDir: any, options: any): {
    cleanupRoot: string | null;
    manifestsScanned: number;
    orphanedArtifactsRemoved: number;
    removed: never[];
    failed: never[];
    totalBytesRemoved: number;
    totalBytesRemovedHuman: string;
} | {
    cleanupRoot: string;
    manifestsScanned: number;
    orphanedArtifactsRemoved: number;
    removed: string[];
    failed: {
        path: string;
        error: any;
    }[];
    totalBytesRemoved: number;
    totalBytesRemovedHuman: string;
};
declare function buildIterationWarehouseManifest(args: any, iterationResult: any): {
    schemaVersion: string;
    generatedAt: string;
    runTag: any;
    iteration: number | null;
    iterationTag: any;
    lineage: {
        trainingCycleSummaryPath: string | null;
        bootstrapPolicyModelPath: string | null;
        usedGuideModelPath: string | null;
        usedGuideModelPoolPaths: any;
        usedAnchorModelPath: string | null;
        seedBankPath: string | null;
        seedBankId: any;
        baselineMode: any;
        baselineModelPath: string | null;
        usedResumeCheckpointPaths: {};
        seeds: {
            iterationSeed: number | null;
            quickAdoptionSeed: number | null;
            qualityGateSeed: number | null;
            finalAdoptionSeed: number | null;
            onnxGateSeed: number | null;
            evalSeed: number | null;
        };
        gateConfig: {
            quick: any;
            quality: any;
            final: any;
            onnx: any;
        };
    };
    training: {
        allowCardUsage: boolean;
        usedSelfplayCardUsageRate: number | null;
        onnxValSplit: number | null;
        onnxValSplitMode: string | null;
        onnxValueLr: number | null;
        onnxValueHiddenSize: number | null;
        hasTargetTrainingData: boolean;
        gateIterationAllowed: boolean;
        promoted: boolean;
        promotionMode: any;
    };
    promotion: any;
    datasets: {
        train: {
            selfplay: any;
            hardcase: any;
        };
        eval: {
            selfplay: any;
            hardcase: any;
        };
    };
    models: {
        candidatePolicyTable: any;
        policyOnnx: any;
        policyOnnxMeta: any;
        policyCheckpoint: any;
        cardOnnx: any;
        cardOnnxMeta: any;
        cardCheckpoint: any;
        targetOnnx: any;
        targetOnnxMeta: any;
        targetCheckpoint: any;
        valueOnnx: any;
        valueOnnxMeta: any;
        valueCheckpoint: any;
    };
    gates: {
        quick: any;
        quality: any;
        final: any;
        onnx: any;
    };
    steps: any;
};
declare function writeTrainingWarehouseManifest(manifestPath: any, manifest: any): string;
declare const _default: {
    TRAINING_WAREHOUSE_MANIFEST_SCHEMA_VERSION: string;
    buildIterationWarehouseManifest: typeof buildIterationWarehouseManifest;
    writeTrainingWarehouseManifest: typeof writeTrainingWarehouseManifest;
    formatBytes: typeof formatBytes;
    resolveRunsCleanupRoot: typeof resolveRunsCleanupRoot;
    buildWarehouseCompanionArtifactPaths: typeof buildWarehouseCompanionArtifactPaths;
    listTrainingWarehouseManifestPaths: typeof listTrainingWarehouseManifestPaths;
    readTrainingWarehouseManifest: typeof readTrainingWarehouseManifest;
    collectWarehouseSelfplayArtifactPaths: typeof collectWarehouseSelfplayArtifactPaths;
    collectStaleOrphanSelfplayArtifactPaths: typeof collectStaleOrphanSelfplayArtifactPaths;
    cleanupWarehouseSelfplayArtifacts: typeof cleanupWarehouseSelfplayArtifacts;
};
export = _default;
//# sourceMappingURL=training-warehouse-manifest-utils.d.ts.map