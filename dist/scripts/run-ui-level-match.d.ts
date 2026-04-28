#!/usr/bin/env node
declare function parseArgs(argv: string[]): {
    black: number;
    white: number;
    seed: null;
    out: string;
    timeoutMs: number;
    requireOnnxLoaded: boolean;
    requireCardModelLoaded: boolean;
    requireTargetModelLoaded: boolean;
    requireValueModelLoaded: boolean;
    onnxWaitMs: number;
    headless: boolean;
    help: boolean;
};
declare function applyBenchmarkModeBeforeInit(root: any): void;
declare function applyBenchmarkModeAfterInit(root: any): void;
declare function buildFailureSnapshot(snapshot: any, diagnostics: any): any;
declare function runMatch(args: any): Promise<{
    levels: {
        black: any;
        white: any;
    };
    seed: any;
    startedAt: string;
    finishedAt: string;
    matchDurationMs: number;
    result: {
        black: number;
        white: number;
        empty: number;
        winner: string;
        turnNumber: any;
    };
    runtimeStatus: {
        onnx: any;
        table: any;
    };
    consoleMessages: any[];
    pageErrors: any[];
    networkErrors: any[];
}>;
declare const _default: {
    parseArgs: typeof parseArgs;
    applyBenchmarkModeBeforeInit: typeof applyBenchmarkModeBeforeInit;
    applyBenchmarkModeAfterInit: typeof applyBenchmarkModeAfterInit;
    buildFailureSnapshot: typeof buildFailureSnapshot;
    runMatch: typeof runMatch;
};
export = _default;
//# sourceMappingURL=run-ui-level-match.d.ts.map