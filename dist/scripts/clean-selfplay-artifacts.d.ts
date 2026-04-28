#!/usr/bin/env node
declare function parseArgs(argv: string[]): {
    runsDir: string;
    modelsDir: string;
    apply: boolean;
    keepDeployed: boolean;
    help: boolean;
};
declare function shouldDeleteModelFile(fileName: any, keepDeployed: any): boolean;
declare function collectTargets(args: any): string[];
declare function formatBytes(n: number): string;
declare function summarizeTargets(targets: any[]): {
    files: number;
    totalBytes: any;
    totalBytesHuman: string;
};
declare const _default: {
    parseArgs: typeof parseArgs;
    collectTargets: typeof collectTargets;
    shouldDeleteModelFile: typeof shouldDeleteModelFile;
    summarizeTargets: typeof summarizeTargets;
    formatBytes: typeof formatBytes;
};
export = _default;
//# sourceMappingURL=clean-selfplay-artifacts.d.ts.map