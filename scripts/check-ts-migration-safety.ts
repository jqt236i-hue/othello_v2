import * as fs from 'fs';
import * as path from 'path';

import { GENERATED_OR_EXTERNAL_DIR_NAMES, collectSourceFiles, isExternalDataDir, toPosixRelative } from './lib/source-file-walk';
import { scanNoCheckDirective } from './lib/ts-nocheck-directive';

// Canonical TypeScript roots (tsconfig.build.json / tsconfig.training.json) plus the test roots.
// Root-level `*.ts` files are added separately so new top-level sources are covered automatically.
export const TS_SCAN_ROOTS: readonly string[] = [
  'browser-vite',
  'cards',
  'constants',
  'cpu',
  'game',
  'othello-ai',
  'scripts',
  'shared',
  'src',
  'test',
  'tests',
  'training',
  'ui',
  'utils',
  'workers'
];

// Authorized top-level @ts-nocheck debt. Keep empty: new suppressions must be removed before merge.
const allowedNoCheckDebt = new Set<string>();

const TS_FILE_PATTERN = /\.(?:ts|tsx|mts|cts)$/;

export function collectTsMigrationTargets(root: string): string[] {
  const rootLevel = fs.readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isFile() && TS_FILE_PATTERN.test(entry.name))
    .map((entry) => entry.name);
  return collectSourceFiles([...TS_SCAN_ROOTS, ...rootLevel], {
    root,
    skipDirNames: GENERATED_OR_EXTERNAL_DIR_NAMES,
    skipDir: (relativeDir) => isExternalDataDir(relativeDir),
    includeFile: (_relativePath, name) => TS_FILE_PATTERN.test(name)
  }).map((file) => toPosixRelative(root, file));
}

export type TsMigrationSafetyResult = {
  scanned: number;
  noCheckFiles: string[];
  unauthorized: string[];
  duplicateDirectives: Array<{ file: string; count: number }>;
  staleAllowlist: string[];
};

export function evaluateTsMigrationSafety(root: string, allowlist: ReadonlySet<string> = allowedNoCheckDebt): TsMigrationSafetyResult {
  const files = collectTsMigrationTargets(root);
  const noCheckFiles: string[] = [];
  const duplicateDirectives: Array<{ file: string; count: number }> = [];
  for (const file of files) {
    const scan = scanNoCheckDirective(fs.readFileSync(path.join(root, file), 'utf8'), file);
    if (scan.active) noCheckFiles.push(file);
    if (scan.count > 1) duplicateDirectives.push({ file, count: scan.count });
  }
  return {
    scanned: files.length,
    noCheckFiles,
    unauthorized: noCheckFiles.filter((file) => !allowlist.has(file)),
    duplicateDirectives,
    staleAllowlist: Array.from(allowlist).filter((file) => !noCheckFiles.includes(file)).sort()
  };
}

function main(): void {
  const root = path.resolve(__dirname, '..', '..');
  const result = evaluateTsMigrationSafety(root);

  if (result.unauthorized.length > 0) {
    console.error('[ts-migration-safety] FAILED: unauthorized @ts-nocheck files found');
    for (const file of result.unauthorized) console.error(` - ${file}`);
    process.exit(2);
  }

  if (result.duplicateDirectives.length > 0) {
    console.error('[ts-migration-safety] FAILED: duplicate @ts-nocheck directives found');
    for (const entry of result.duplicateDirectives) console.error(` - ${entry.file}: ${entry.count}`);
    process.exit(2);
  }

  console.log(`[ts-migration-safety] scanned ${result.scanned} TypeScript files; authorized @ts-nocheck debt: ${result.noCheckFiles.length}`);
  if (result.staleAllowlist.length > 0) {
    console.log(`[ts-migration-safety] stale allowlist entries ready for removal: ${result.staleAllowlist.length}`);
    for (const file of result.staleAllowlist) console.log(` - ${file}`);
  }
  console.log('[ts-migration-safety] No unauthorized @ts-nocheck directives found.');
}

const isDirectRun = typeof require !== 'undefined'
  && !!require.main
  && /[\\/]check-ts-migration-safety\.js$/.test(String(require.main.filename || ''));

if (isDirectRun) {
  main();
}
