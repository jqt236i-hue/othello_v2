import * as fs from 'fs';
import * as path from 'path';

const root = path.resolve(__dirname, '..', '..');

const scanRoots = [
  'cards',
  'cpu',
  'game',
  'scripts',
  'sound-engine.ts',
  'src',
  'test',
  'training',
  'ui',
  'ui.ts',
  'utils',
  'workers'
];

const skipDirs = new Set([
  '.git',
  'coverage',
  'dist',
  'node_modules',
  'worker-public'
]);

const allowedNoCheckDebt = new Set([
  'scripts/local-match-server.ts',
  'src/engine/selfplay-runner.ts'
]);

function normalizePath(value: string): string {
  return value.replace(/\\/g, '/');
}

function walk(target: string, out: string[]): void {
  const absolute = path.join(root, target);
  if (!fs.existsSync(absolute)) return;
  const stat = fs.statSync(absolute);
  if (stat.isDirectory()) {
    for (const name of fs.readdirSync(absolute)) {
      if (skipDirs.has(name)) continue;
      walk(path.join(target, name), out);
    }
    return;
  }
  if (target.endsWith('.ts')) out.push(normalizePath(target));
}

function hasTopLevelNoCheck(relativePath: string): boolean {
  const source = fs.readFileSync(path.join(root, relativePath), 'utf8');
  const firstLines = source.split(/\r?\n/, 6).join('\n');
  return /^\/\/\s*@ts-nocheck\b/m.test(firstLines);
}

function countNoCheckDirectives(relativePath: string): number {
  const source = fs.readFileSync(path.join(root, relativePath), 'utf8');
  return source.match(/^\/\/\s*@ts-nocheck\b/gm)?.length ?? 0;
}

const files: string[] = [];
for (const scanRoot of scanRoots) walk(scanRoot, files);

const noCheckFiles = Array.from(new Set(files.filter(hasTopLevelNoCheck))).sort();
const unauthorized = noCheckFiles.filter((file) => !allowedNoCheckDebt.has(file));
const staleAllowlist = Array.from(allowedNoCheckDebt).filter((file) => !noCheckFiles.includes(file)).sort();
const duplicateDirectives = noCheckFiles
  .map((file) => ({ file, count: countNoCheckDirectives(file) }))
  .filter((entry) => entry.count > 1);

if (unauthorized.length > 0) {
  console.error('[ts-migration-safety] FAILED: unauthorized @ts-nocheck files found');
  for (const file of unauthorized) console.error(` - ${file}`);
  process.exit(2);
}

if (duplicateDirectives.length > 0) {
  console.error('[ts-migration-safety] FAILED: duplicate @ts-nocheck directives found');
  for (const entry of duplicateDirectives) console.error(` - ${entry.file}: ${entry.count}`);
  process.exit(2);
}

console.log(`[ts-migration-safety] authorized @ts-nocheck debt: ${noCheckFiles.length}`);
if (staleAllowlist.length > 0) {
  console.log(`[ts-migration-safety] stale allowlist entries ready for removal: ${staleAllowlist.length}`);
  for (const file of staleAllowlist) console.log(` - ${file}`);
}
console.log('[ts-migration-safety] No unauthorized @ts-nocheck directives found.');
