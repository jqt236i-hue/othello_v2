#!/usr/bin/env node
declare function defaultPythonPath(cwd: string): string;
declare function makeTimestampTag(date: Date): string;
declare function makeRunTag(prefix: any, date: any): string;
declare function resolveNamedConfigPath(kind: any, ref: any, cwd: any): string;
declare function loadStructuredFile(filePath: any, pythonPath: any): any;
declare function resolveProfileDocument(profileRef: any, options: any): {
    profilePath: string;
    gatePath: string | null;
    profile: any;
    gate: any;
    pythonPath: any;
};
declare function findLatestCheckpointPaths(modelsDir: string): any;
declare function findLatestCheckpoint(modelsDir: string): any;
declare function shellQuote(arg: string): string;
declare function resolveTrainingProfile(profileRef: any, options: any): {
    schemaVersion: string;
    generatedAt: string;
    cwd: any;
    pythonPath: any;
    profile: {
        name: string;
        path: string;
        description: string;
        schemaVersion: any;
    };
    gate: {
        name: string;
        path: string | null;
        description: string;
        schemaVersion: any;
    } | null;
    paths: {
        runsDir: any;
        modelsDir: any;
        runDir: any;
        runTag: string;
        summaryOut: any;
        resolvedConfigOut: any;
        preflightOut: any;
        launcherLogPath: any;
    };
    bootstrap: {
        actions: {
            label: any;
            source: any;
            target: any;
            status: string;
        }[];
        bootstrapPolicyModelPath: any;
        resumeCheckpointPath: any;
        resumeCheckpointPaths: any;
        autoResumeLatestCheckpoint: boolean;
    };
    sharedTeacherSync: {
        enabled: boolean;
        mode: string;
        sourcePath: string;
        sourceFound: boolean;
        flagActions: never[];
        guideMode: {
            desired: null;
            active: string | null;
            status: string;
        };
    };
    effectiveSharedTeacher: any;
    seedBankPlan: {
        path: any;
        bankId: string;
        description: string;
        gates: {
            quick: {
                baseSeed: any;
                seedCount: any;
                seedStride: any;
                purpose: string;
            };
            final: {
                baseSeed: any;
                seedCount: any;
                seedStride: any;
                purpose: string;
            };
            onnx: {
                baseSeed: any;
                seedCount: any;
                seedStride: any;
                purpose: string;
            };
        };
    } | null;
    provenance: {
        rawProfileTrainCycleArgs: string[];
        effectiveProfileTrainCycleArgs: string[];
        gateTrainCycleArgs: string[];
        generatedArgs: any[];
        passThrough: any;
    };
    preflight: any;
    command: {
        executable: string;
        args: any[];
        display: string;
    };
    launcher: {
        scriptPath: any;
    };
    preflightCommand: null;
    passThrough: any;
};
declare function writeResolvedConfig(resolved: any, outPath: any): any;
declare function runCommand(executable: any, args: any, options: any): import("node:child_process").SpawnSyncReturns<string>;
declare const _default: {
    PROFILE_SCHEMA_VERSION: string;
    GATE_SCHEMA_VERSION: string;
    RESOLVED_SCHEMA_VERSION: string;
    RESERVED_TRAIN_CYCLE_FLAGS: Set<string>;
    defaultPythonPath: typeof defaultPythonPath;
    makeTimestampTag: typeof makeTimestampTag;
    makeRunTag: typeof makeRunTag;
    resolveNamedConfigPath: typeof resolveNamedConfigPath;
    loadStructuredFile: typeof loadStructuredFile;
    resolveProfileDocument: typeof resolveProfileDocument;
    findLatestCheckpointPaths: typeof findLatestCheckpointPaths;
    findLatestCheckpoint: typeof findLatestCheckpoint;
    resolveTrainingProfile: typeof resolveTrainingProfile;
    writeResolvedConfig: typeof writeResolvedConfig;
    runCommand: typeof runCommand;
    shellQuote: typeof shellQuote;
};
export = _default;
//# sourceMappingURL=load-training-profile.d.ts.map