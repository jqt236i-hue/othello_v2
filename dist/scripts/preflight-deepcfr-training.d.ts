#!/usr/bin/env node
declare function makeDefaultOutputPath(runsDir: string): string;
declare function parseArgs(argv: string[]): {
    pythonPath: string;
    checkScriptPath: string;
    runsDir: string;
    modelsDir: string;
    deepcfrDir: string;
    configPath: string;
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
declare function isIgnorableArtifactForDeepcfr(filePath: string): boolean;
declare const _default: {
    parseArgs: typeof parseArgs;
    runCommand: typeof runCommand;
    safeParseJson: typeof safeParseJson;
    makeDefaultOutputPath: typeof makeDefaultOutputPath;
    isIgnorableArtifactForDeepcfr: typeof isIgnorableArtifactForDeepcfr;
};
export = _default;
//# sourceMappingURL=preflight-deepcfr-training.d.ts.map