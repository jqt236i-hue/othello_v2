#!/usr/bin/env node
declare function parseArgs(argv: string[]): {
    profile: null;
    runTag: null;
    runsDir: null;
    runDir: null;
    watch: boolean;
    intervalMs: number;
    tailLines: number;
    json: boolean;
    help: boolean;
};
declare function inferPhaseFromCommand(commandLine: any): {
    key: string;
    label: "自己対局(eval)";
} | {
    key: string;
    label: "自己対局(train)";
} | {
    key: string;
    label: "方策学習";
} | {
    key: string;
    label: "候補評価";
} | {
    key: string;
    label: "カード学習";
} | {
    key: string;
    label: "対象学習";
} | {
    key: string;
    label: "価値学習";
} | {
    key: string;
    label: "品質 gate";
} | {
    key: string;
    label: "ONNX gate";
} | {
    key: string;
    label: "最終判定(final)";
} | {
    key: string;
    label: "事前判定(quick)";
} | {
    key: string;
    label: "昇格反映";
} | null;
declare function analyzeLauncherLogLines(lines: string[]): {
    currentIteration: null;
    totalIterations: null;
    lastCompletedIteration: number;
    currentPhaseKey: null;
    currentPhaseLabel: null;
    currentCommand: null;
    phaseProgress: null;
    statusHint: null;
    stopReason: null;
    failureMessage: null;
};
declare function deriveConfigFromResolvedPayload(payload: any): {} | null;
declare function buildLatestGateOutcomes(iteration: any, config: any): {
    quick: {
        state: string;
        passed: null;
        primaryFailureReason: null;
        failureReasons: never[];
    } | {
        state: string;
        passed: boolean;
        primaryFailureReason: any;
        failureReasons: any;
    };
    quality: {
        state: string;
        passed: null;
        primaryFailureReason: null;
        failureReasons: never[];
    } | {
        state: string;
        passed: boolean;
        primaryFailureReason: any;
        failureReasons: any;
    };
    final: {
        state: string;
        passed: null;
        primaryFailureReason: null;
        failureReasons: never[];
    } | {
        state: string;
        passed: boolean;
        primaryFailureReason: any;
        failureReasons: any;
    };
    onnx: {
        state: string;
        passed: null;
        primaryFailureReason: null;
        failureReasons: never[];
    } | {
        state: string;
        passed: boolean;
        primaryFailureReason: any;
        failureReasons: any;
    };
} | null;
declare function formatLatestGateOutcomes(gates: any): string;
declare function buildMonitorSnapshot(runDir: any, options: any): {
    runDir: any;
    runTag: string;
    status: string;
    updatedAt: string | null;
    summaryUpdatedAt: string | null;
    launcherUpdatedAt: string | null;
    totalIterations: number | null;
    completedIterations: any;
    currentIteration: any;
    currentPhaseKey: null;
    currentPhaseLabel: null;
    phaseProgress: null;
    gateMode: string;
    baselineMode: string;
    latestGuideModel: string | null;
    latestResumeCheckpoint: string | null;
    latestAnchorModel: string | null;
    seedBankPath: string | null;
    seedBank: string | null;
    latestWarehouseManifest: string | null;
    latestWarehouseManifestPath: string | null;
    latestWarehouseManifestSchemaVersion: string | null;
    latestGateOutcomes: {
        quick: {
            state: string;
            passed: null;
            primaryFailureReason: null;
            failureReasons: never[];
        } | {
            state: string;
            passed: boolean;
            primaryFailureReason: any;
            failureReasons: any;
        };
        quality: {
            state: string;
            passed: null;
            primaryFailureReason: null;
            failureReasons: never[];
        } | {
            state: string;
            passed: boolean;
            primaryFailureReason: any;
            failureReasons: any;
        };
        final: {
            state: string;
            passed: null;
            primaryFailureReason: null;
            failureReasons: never[];
        } | {
            state: string;
            passed: boolean;
            primaryFailureReason: any;
            failureReasons: any;
        };
        onnx: {
            state: string;
            passed: null;
            primaryFailureReason: null;
            failureReasons: never[];
        } | {
            state: string;
            passed: boolean;
            primaryFailureReason: any;
            failureReasons: any;
        };
    } | null;
    stopReason: any;
    failure: any;
    failureMessage: any;
    tailLines: string[];
};
declare function formatMonitorSnapshotText(snapshot: any): string;
declare function getRunDirectoryFreshness(runDir: string): any;
declare function findLatestRunDirectory(runsDir: string): string;
declare function resolveRunDirectory(args: any, cwd: any): string;
declare const _default: {
    parseArgs: typeof parseArgs;
    inferPhaseFromCommand: typeof inferPhaseFromCommand;
    analyzeLauncherLogLines: typeof analyzeLauncherLogLines;
    buildMonitorSnapshot: typeof buildMonitorSnapshot;
    formatMonitorSnapshotText: typeof formatMonitorSnapshotText;
    formatLatestGateOutcomes: typeof formatLatestGateOutcomes;
    buildLatestGateOutcomes: typeof buildLatestGateOutcomes;
    deriveConfigFromResolvedPayload: typeof deriveConfigFromResolvedPayload;
    findLatestRunDirectory: typeof findLatestRunDirectory;
    resolveRunDirectory: typeof resolveRunDirectory;
    getRunDirectoryFreshness: typeof getRunDirectoryFreshness;
};
export = _default;
//# sourceMappingURL=monitor-selfplay-training-run.d.ts.map