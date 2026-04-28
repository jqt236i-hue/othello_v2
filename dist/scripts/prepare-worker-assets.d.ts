declare function createPrepareConfig(options: any): {
    rootDir: string;
    outDir: string;
    rootFiles: any[];
    dirs: any[];
    verifyDirs: any[];
    verifyRootFiles: any[];
    optionalFiles: any[];
    generatedOptionalAssets: any[];
};
declare function listFilesRecursive(baseDir: any, relativePrefix: any): any;
declare function verifyMirroredFile(relativePath: any, issues: any, config: any): void;
declare function verifyMirrors(optionalFiles: any, generatedAssets: any, config: any): void;
declare function prepareWorkerAssets(options: any): {
    rootDir: string;
    outDir: string;
    rootFiles: any[];
    dirs: any[];
    verifyDirs: any[];
    verifyRootFiles: any[];
    optionalFiles: any[];
    generatedOptionalAssets: any[];
};
declare function refreshGeneratedCatalogArtifacts(settings: any): void;
declare const _default: {
    ROOT_FILES: readonly string[];
    DIRS: readonly string[];
    VERIFY_DIRS: readonly string[];
    VERIFY_ROOT_FILES: readonly string[];
    OPTIONAL_FILES: readonly string[];
    GENERATED_OPTIONAL_ASSETS: readonly {
        sourceRelativePath: string;
        manifestRelativePath: string;
        compressedRelativePath: string;
        compression: string;
    }[];
    createPrepareConfig: typeof createPrepareConfig;
    refreshGeneratedCatalogArtifacts: typeof refreshGeneratedCatalogArtifacts;
    prepareWorkerAssets: typeof prepareWorkerAssets;
    verifyMirrors: typeof verifyMirrors;
    verifyMirroredFile: typeof verifyMirroredFile;
    listFilesRecursive: typeof listFilesRecursive;
};
export = _default;
//# sourceMappingURL=prepare-worker-assets.d.ts.map