import * as fs from 'fs';
import * as path from 'path';

// Shared file enumeration for repository checks.
// - Start paths are resolved normally (the checkout root may itself be reached through a junction).
// - Child symbolic links and Windows junctions are never followed, so external data roots
//   (data/runs, output/, artifacts/, .venv/ ...) and link cycles are not traversed.
// - Each real directory is visited at most once even when start paths overlap.

export type SourceFileWalkOptions = {
  /** Absolute directory used to compute the relative (POSIX) paths passed to the predicates. */
  root: string;
  /** Directory names skipped at any depth. */
  skipDirNames?: ReadonlySet<string>;
  /** Return true to skip a directory by its root-relative POSIX path. */
  skipDir?: (relativeDir: string, name: string) => boolean;
  /** Return true to include a regular file. Defaults to every file. */
  includeFile?: (relativePath: string, name: string) => boolean;
  /** Called once for every directory that is actually read (diagnostics and tests). */
  onDirectory?: (absoluteDir: string) => void;
};

export function toPosixRelative(root: string, absolutePath: string): string {
  return path.relative(root, absolutePath).replace(/\\/g, '/');
}

/**
 * Collects regular files below the given start paths (relative to `options.root` or absolute).
 * Returns absolute paths in deterministic (sorted) order without duplicates.
 */
export function collectSourceFiles(starts: readonly string[], options: SourceFileWalkOptions): string[] {
  const root = path.resolve(options.root);
  const skipDirNames = options.skipDirNames || new Set<string>();
  const visitedDirs = new Set<string>();
  const files = new Set<string>();

  const shouldSkipDir = (absoluteDir: string, name: string): boolean => {
    if (skipDirNames.has(name)) return true;
    const relativeDir = toPosixRelative(root, absoluteDir);
    return !!options.skipDir && options.skipDir(relativeDir, name);
  };

  const addFile = (absoluteFile: string, name: string): void => {
    const relativePath = toPosixRelative(root, absoluteFile);
    if (!options.includeFile || options.includeFile(relativePath, name)) files.add(absoluteFile);
  };

  const visitDir = (absoluteDir: string): void => {
    let realDir: string;
    try {
      realDir = fs.realpathSync.native(absoluteDir);
    } catch {
      return;
    }
    const key = process.platform === 'win32' ? realDir.toLowerCase() : realDir;
    if (visitedDirs.has(key)) return;
    visitedDirs.add(key);
    if (options.onDirectory) options.onDirectory(absoluteDir);

    const names = fs.readdirSync(absoluteDir).sort();
    for (const name of names) {
      const child = path.join(absoluteDir, name);
      let stat: fs.Stats;
      try {
        stat = fs.lstatSync(child);
      } catch {
        continue;
      }
      // Never follow child links/junctions (Node reports Windows junctions as symbolic links).
      if (stat.isSymbolicLink()) continue;
      if (stat.isDirectory()) {
        if (!shouldSkipDir(child, name)) visitDir(child);
      } else if (stat.isFile()) {
        addFile(child, name);
      }
    }
  };

  for (const start of starts) {
    const absoluteStart = path.resolve(root, start);
    let stat: fs.Stats;
    try {
      stat = fs.statSync(absoluteStart);
    } catch {
      continue;
    }
    if (stat.isDirectory()) {
      const name = path.basename(absoluteStart);
      if (absoluteStart !== root && shouldSkipDir(absoluteStart, name)) continue;
      visitDir(absoluteStart);
    } else if (stat.isFile()) {
      addFile(absoluteStart, path.basename(absoluteStart));
    }
  }

  return Array.from(files).sort();
}

// Repository roots that hold build output, mirrors, or externally stored bulk data.
// They are links in a normal checkout, but a copy without links must still not be scanned.
export const GENERATED_OR_EXTERNAL_DIR_NAMES: ReadonlySet<string> = new Set([
  '.git',
  '.sisyphus',
  '.wrangler',
  '.venv',
  'coverage',
  'dist',
  'node_modules',
  'vite-dist',
  'worker-public'
]);

export const EXTERNAL_DATA_RELATIVE_DIRS: readonly string[] = [
  'artifacts',
  'data/cpu-lv10',
  'data/cpu-lv11',
  'data/cpu-lv12',
  'data/cpu-lv13',
  'data/runs',
  'othello-ai/data',
  'output'
];

export function isExternalDataDir(relativeDir: string): boolean {
  return EXTERNAL_DATA_RELATIVE_DIRS.some((dir) => relativeDir === dir || relativeDir.startsWith(dir + '/'));
}
