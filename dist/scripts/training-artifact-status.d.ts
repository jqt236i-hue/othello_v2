declare function classifyTrainingArtifactPath(filePath: any, options: any): {
    lifecycle: "incompatible";
    reason: string;
    compatibility: "incompatible";
    expectedBoardSize: number;
    detectedBoardSize: string;
    expectedCheckpointHead?: undefined;
    detectedCheckpointHead?: undefined;
} | {
    lifecycle: "incompatible";
    reason: string;
    compatibility: "incompatible";
    expectedCheckpointHead: any;
    detectedCheckpointHead: any;
    expectedBoardSize?: undefined;
    detectedBoardSize?: undefined;
} | {
    lifecycle: "active" | "archived" | "experimental" | "incompatible" | null;
    reason: string;
    compatibility: "unknown" | "compatible";
    expectedCheckpointHead: any;
    detectedCheckpointHead: any;
    expectedBoardSize?: undefined;
    detectedBoardSize?: undefined;
};
declare const _default: {
    TRAINING_ARTIFACT_LIFECYCLES: Readonly<{
        ACTIVE: "active";
        ARCHIVED: "archived";
        EXPERIMENTAL: "experimental";
        INCOMPATIBLE: "incompatible";
    }>;
    TRAINING_ARTIFACT_COMPATIBILITY: Readonly<{
        COMPATIBLE: "compatible";
        INCOMPATIBLE: "incompatible";
        UNKNOWN: "unknown";
    }>;
    classifyTrainingArtifactPath: typeof classifyTrainingArtifactPath;
};
export = _default;
//# sourceMappingURL=training-artifact-status.d.ts.map