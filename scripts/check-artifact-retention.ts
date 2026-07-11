/**
 * Enforces the repository's empty tracked allowlist for disposable artifacts/.
 * Durable inputs belong in assets/, docs/, test/, or their documented generator.
 */
import { execFileSync } from 'child_process';
import * as path from 'path';

const TRACKED_ARTIFACT_ALLOWLIST: readonly string[] = Object.freeze([]);

function normalizeRelativePath(value: string) {
    return String(value || '').replace(/\\/g, '/').replace(/^\.\//, '');
}

function parseTrackedArtifactPaths(output: string) {
    return String(output || '')
        .split(/\r?\n/)
        .map(normalizeRelativePath)
        .filter(Boolean);
}

function findUnexpectedTrackedArtifacts(paths: readonly string[]) {
    const allowed = new Set(TRACKED_ARTIFACT_ALLOWLIST);
    return paths
        .map(normalizeRelativePath)
        .filter(Boolean)
        .filter((relativePath) => !allowed.has(relativePath));
}

function readTrackedArtifactPaths(rootDir: string) {
    const output = execFileSync('git', ['ls-files', 'artifacts'], {
        cwd: rootDir,
        encoding: 'utf8'
    });
    return parseTrackedArtifactPaths(output);
}

function checkArtifactRetention(rootDir: string = path.resolve(__dirname, '..', '..')) {
    const unexpected = findUnexpectedTrackedArtifacts(readTrackedArtifactPaths(rootDir));
    if (unexpected.length > 0) {
        const preview = unexpected.slice(0, 8).join(', ');
        throw new Error(
            `[artifact-retention] tracked artifacts are forbidden (${unexpected.length}): ${preview}`
        );
    }
    console.log('[artifact-retention] tracked artifact allowlist is satisfied (0 paths).');
    return true;
}

if (require.main === module) {
    checkArtifactRetention();
}

export = {
    TRACKED_ARTIFACT_ALLOWLIST,
    normalizeRelativePath,
    parseTrackedArtifactPaths,
    findUnexpectedTrackedArtifacts,
    readTrackedArtifactPaths,
    checkArtifactRetention
};
