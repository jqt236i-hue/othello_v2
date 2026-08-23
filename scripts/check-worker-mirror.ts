/**
 * Validates the tracked Worker asset mirror without regenerating it.
 * Run after `worker:prepare` to catch both stale content and stray manual files.
 */
import * as path from 'path';
import * as fs from 'fs';
import _prepare_worker_assets from './prepare-worker-assets';

const {
    createPrepareConfig,
    resolveCopyableOptionalFiles,
    resolveGeneratedOptionalAssets,
    verifyMirrors
} = _prepare_worker_assets;

interface CheckWorkerMirrorOptions {
    rootDir?: string;
    outDir?: string;
    rootFiles?: string[];
    dirs?: string[];
    verifyDirs?: string[];
    verifyRootFiles?: string[];
    optionalFiles?: string[];
    generatedOptionalAssets?: any[];
    cleanOutDir?: boolean;
}

const DEPLOY_ONLY_OPTIONAL_PREFIXES: readonly string[] = Object.freeze([
    'node_modules/'
]);

function normalizeRelativePath(relativePath: string): string {
    return String(relativePath || '').replace(/\\/g, '/');
}

function isDeployOnlyOptionalFile(relativePath: string): boolean {
    const normalized = normalizeRelativePath(relativePath);
    return DEPLOY_ONLY_OPTIONAL_PREFIXES.some((prefix) => normalized.startsWith(prefix));
}

function resolveTrackedMirrorOptionalFiles(optionalFiles: string[], settings: any): string[] {
    return optionalFiles.filter((relativePath) => (
        !isDeployOnlyOptionalFile(relativePath)
        || fs.existsSync(path.join(settings.outDir, relativePath))
    ));
}

function checkWorkerMirror(options?: CheckWorkerMirrorOptions) {
    const settings = createPrepareConfig({
        ...(options || {}),
        outDir: options && options.outDir
            ? options.outDir
            : path.join((options && options.rootDir) || process.cwd(), 'worker-public')
    });
    const copyableOptionalFiles = resolveTrackedMirrorOptionalFiles(
        resolveCopyableOptionalFiles(settings),
        settings
    );
    const generatedOptionalAssets = resolveGeneratedOptionalAssets(settings);
    verifyMirrors(copyableOptionalFiles, generatedOptionalAssets, settings, { rejectExtraFiles: true });
    console.log(`[worker-mirror-check] verified output=${settings.outDir}`);
    return true;
}

if (require.main === module) {
    checkWorkerMirror();
}

export = {
    DEPLOY_ONLY_OPTIONAL_PREFIXES,
    checkWorkerMirror,
    isDeployOnlyOptionalFile,
    resolveTrackedMirrorOptionalFiles
};
