import { spawnSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

export type AssetFileCaseIssueType = 'case-mismatch' | 'missing';

export interface AssetFileCaseIssue {
  type: AssetFileCaseIssueType;
  expectedPath: string;
  actualPath?: string;
  message: string;
}

export interface CheckAssetFileCaseOptions {
  rootDir?: string;
  trackedPaths?: string[];
  assetRoots?: string[];
}

export interface CheckAssetFileCaseResult {
  ok: boolean;
  checkedFiles: number;
  issues: AssetFileCaseIssue[];
}

const DEFAULT_ASSET_ROOTS = [
  'assets',
  'worker-public/assets'
];

function normalizeRelativePath(value: string): string {
  return value.replace(/\\/g, '/').replace(/^\.\/+/, '');
}

function resolveDefaultRootDir(): string {
  const sourceRoot = path.resolve(__dirname, '..');
  if (fs.existsSync(path.join(sourceRoot, 'package.json'))) return sourceRoot;
  return path.resolve(__dirname, '..', '..');
}

function isCheckedAssetPath(relativePath: string, assetRoots: string[]): boolean {
  return assetRoots.some((assetRoot) => {
    const normalizedRoot = normalizeRelativePath(assetRoot).replace(/\/+$/, '');
    return relativePath === normalizedRoot || relativePath.startsWith(`${normalizedRoot}/`);
  });
}

function listTrackedAssetPaths(rootDir: string, assetRoots: string[]): string[] {
  const args = ['-C', rootDir, 'ls-files', '--', ...assetRoots];
  const result = spawnSync('git', args, { encoding: 'utf8' });
  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    const details = String(result.stderr || result.stdout || '').trim();
    throw new Error(details || 'git ls-files failed');
  }
  return result.stdout
    .split(/\r?\n/)
    .map((line) => normalizeRelativePath(line.trim()))
    .filter(Boolean);
}

function completeActualPath(rootDir: string, actualSegments: string[], remainingExpectedSegments: string[]): string {
  const completed = [...actualSegments];
  let currentDir = path.join(rootDir, ...actualSegments);

  for (const expectedSegment of remainingExpectedSegments) {
    try {
      const entries = fs.readdirSync(currentDir);
      const match = entries.find((entry) => entry === expectedSegment)
        || entries.find((entry) => entry.toLowerCase() === expectedSegment.toLowerCase());
      if (!match) {
        completed.push(expectedSegment);
        break;
      }
      completed.push(match);
      currentDir = path.join(currentDir, match);
    } catch {
      completed.push(expectedSegment);
      break;
    }
  }

  return completed.join('/');
}

function inspectPathCase(rootDir: string, expectedPath: string): AssetFileCaseIssue | null {
  const expectedSegments = normalizeRelativePath(expectedPath).split('/').filter(Boolean);
  const actualSegments: string[] = [];
  let currentDir = rootDir;

  for (let index = 0; index < expectedSegments.length; index += 1) {
    const expectedSegment = expectedSegments[index];
    let entries: string[];
    try {
      entries = fs.readdirSync(currentDir);
    } catch {
      const actualPath = actualSegments.length > 0 ? actualSegments.join('/') : undefined;
      return {
        type: 'missing',
        expectedPath,
        actualPath,
        message: `missing path segment ${expectedSegment} in ${expectedPath}`
      };
    }

    const exactMatch = entries.find((entry) => entry === expectedSegment);
    if (exactMatch) {
      actualSegments.push(exactMatch);
      currentDir = path.join(currentDir, exactMatch);
      continue;
    }

    const caseInsensitiveMatch = entries.find((entry) => entry.toLowerCase() === expectedSegment.toLowerCase());
    if (caseInsensitiveMatch) {
      actualSegments.push(caseInsensitiveMatch);
      const actualPath = completeActualPath(rootDir, actualSegments, expectedSegments.slice(index + 1));
      return {
        type: 'case-mismatch',
        expectedPath,
        actualPath,
        message: `asset file case mismatch: expected ${expectedPath}, filesystem has ${actualPath}`
      };
    }

    return {
      type: 'missing',
      expectedPath,
      actualPath: actualSegments.length > 0 ? actualSegments.join('/') : undefined,
      message: `tracked asset file is missing from filesystem: ${expectedPath}`
    };
  }

  return null;
}

export function checkAssetFileCase(options: CheckAssetFileCaseOptions = {}): CheckAssetFileCaseResult {
  const rootDir = path.resolve(options.rootDir || resolveDefaultRootDir());
  const assetRoots = (options.assetRoots || DEFAULT_ASSET_ROOTS).map(normalizeRelativePath);
  const trackedPaths = (options.trackedPaths || listTrackedAssetPaths(rootDir, assetRoots))
    .map(normalizeRelativePath)
    .filter((relativePath) => isCheckedAssetPath(relativePath, assetRoots));
  const uniqueTrackedPaths = Array.from(new Set(trackedPaths)).sort();
  const issues = uniqueTrackedPaths
    .map((relativePath) => inspectPathCase(rootDir, relativePath))
    .filter((issue): issue is AssetFileCaseIssue => issue !== null);

  return {
    ok: issues.length === 0,
    checkedFiles: uniqueTrackedPaths.length,
    issues
  };
}

export function main(): number {
  try {
    const result = checkAssetFileCase();
    if (result.ok) {
      console.log(`[asset-file-case] tracked asset file casing matches deploy paths (${result.checkedFiles} files checked).`);
      return 0;
    }

    console.error('[asset-file-case] FAILED: tracked asset file casing does not match deploy paths');
    for (const issue of result.issues) {
      console.error(` - ${issue.message}`);
    }
    return 1;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[asset-file-case] failed to inspect tracked assets: ${message}`);
    return 2;
  }
}

if (require.main === module) {
  process.exit(main());
}
