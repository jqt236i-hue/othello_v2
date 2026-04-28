#!/usr/bin/env node
declare function makeDefaultOutputPath(runsDir: string): string;
declare function parseArgs(argv: string[]): {
    pythonPath: string;
    checkTorchScriptPath: string;
    runsDir: string;
    modelsDir: string;
    out: string;
    checkWindow: boolean;
    requireCleanData: boolean;
    strict: boolean;
    help: boolean;
};
declare function runCommand(cmd: any, args: any): {
    status: number | null;
    stdout: string;
    stderr: string;
    error: string | null;
};
declare function safeParseJson(text: string): any;
declare const _default: {
    parseArgs: typeof parseArgs;
    runCommand: typeof runCommand;
    safeParseJson: typeof safeParseJson;
    makeDefaultOutputPath: typeof makeDefaultOutputPath;
};
export = _default;
//# sourceMappingURL=preflight-selfplay-training.d.ts.map