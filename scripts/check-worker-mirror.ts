/**
 * Validates the tracked Worker asset mirror without regenerating it.
 * Run after `worker:prepare` to catch both stale content and stray manual files.
 */
import * as path from 'path';
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

function checkWorkerMirror(options?: CheckWorkerMirrorOptions) {
    const settings = createPrepareConfig({
        ...(options || {}),
        outDir: options && options.outDir
            ? options.outDir
            : path.join((options && options.rootDir) || process.cwd(), 'worker-public')
    });
    const copyableOptionalFiles = resolveCopyableOptionalFiles(settings);
    const generatedOptionalAssets = resolveGeneratedOptionalAssets(settings);
    verifyMirrors(copyableOptionalFiles, generatedOptionalAssets, settings, { rejectExtraFiles: true });
    console.log(`[worker-mirror-check] verified output=${settings.outDir}`);
    return true;
}

if (require.main === module) {
    checkWorkerMirror();
}

export = { checkWorkerMirror };
