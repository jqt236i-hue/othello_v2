#!/usr/bin/env node
declare function parseArgs(argv: string[]): {
    profile: string;
    passThrough: never[];
    help: boolean;
};
declare function buildPresetArgs(profile: string): string[];
declare const _default: {
    parseArgs: typeof parseArgs;
    buildPresetArgs: typeof buildPresetArgs;
};
export = _default;
//# sourceMappingURL=run-selfplay-training-preset.d.ts.map