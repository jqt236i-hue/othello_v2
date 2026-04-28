#!/usr/bin/env node
declare function parseArgs(argv: string[]): any;
declare function buildSeedBankFromResolvedCommand(resolved: any): {
    seedBankPath: string;
    bank: {
        schemaVersion: string;
        generatedAt: string;
        bankId: string;
        description: string | null;
        gates: {};
        usage: any;
    };
} | null;
declare function ensureSeedBankInitialized(resolved: any, logger: any): string | null;
declare function createLauncherLogger(logPath: any): {
    log(message: any): void;
    error(message: any): void;
    writeStdout(chunk: any): void;
    writeStderr(chunk: any): void;
    close(): Promise<unknown>;
    archivedPath: string | null;
};
declare function runCommandLogged(executable: any, args: any, options: any): Promise<unknown>;
declare function readTrainingCycleFailureDetail(summaryPath: string): any;
declare function annotateTrainingProfileError(error: any, context: any): Error;
declare function buildTrainingProfileFailureReport(error: any): string[];
declare function cleanupResolvedWarehouseArtifacts(resolved: any, logger: any): {
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
} | null;
declare const _default: {
    parseArgs: typeof parseArgs;
    createLauncherLogger: typeof createLauncherLogger;
    runCommandLogged: typeof runCommandLogged;
    readTrainingCycleFailureDetail: typeof readTrainingCycleFailureDetail;
    annotateTrainingProfileError: typeof annotateTrainingProfileError;
    buildTrainingProfileFailureReport: typeof buildTrainingProfileFailureReport;
    buildSeedBankFromResolvedCommand: typeof buildSeedBankFromResolvedCommand;
    ensureSeedBankInitialized: typeof ensureSeedBankInitialized;
    cleanupResolvedWarehouseArtifacts: typeof cleanupResolvedWarehouseArtifacts;
};
export = _default;
//# sourceMappingURL=run-selfplay-training-profile.d.ts.map