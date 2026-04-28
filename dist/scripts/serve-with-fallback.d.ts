#!/usr/bin/env node
declare function parseArgs(argv: string[]): {
    root: string;
    host: string;
    preferredPort: number;
    cacheSeconds: number;
    maxAttempts: number;
    passThrough: never[];
    help: boolean;
};
declare function resolveHttpServerEntrypoint(): string;
declare function chooseServePort(options: any): Promise<unknown>;
declare function buildHttpServerArgs(entrypoint: any, options: any, selectedPort: any): any[];
declare function computeAssetSourceFingerprint(rootPath: string): string;
declare function refreshGeneratedCatalogArtifactsIfNeeded(rootPath: any, state: any): {
    changed: boolean;
    fingerprint: string;
};
declare function startArtifactRefreshLoop(rootPath: any, options?: {}): {
    tick: () => {
        changed: boolean;
        fingerprint: string;
    } | {
        changed: boolean;
        fingerprint: string;
        error: unknown;
    };
    dispose(): void;
};
declare const _default: {
    parseArgs: typeof parseArgs;
    chooseServePort: typeof chooseServePort;
    buildHttpServerArgs: typeof buildHttpServerArgs;
    resolveHttpServerEntrypoint: typeof resolveHttpServerEntrypoint;
    computeAssetSourceFingerprint: typeof computeAssetSourceFingerprint;
    refreshGeneratedCatalogArtifactsIfNeeded: typeof refreshGeneratedCatalogArtifactsIfNeeded;
    startArtifactRefreshLoop: typeof startArtifactRefreshLoop;
};
export = _default;
//# sourceMappingURL=serve-with-fallback.d.ts.map