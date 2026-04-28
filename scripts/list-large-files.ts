import * as fs from 'fs';
import * as path from 'path';

declare const __non_webpack_require__: NodeRequire | undefined;

const _require: NodeRequire = (typeof __non_webpack_require__ !== 'undefined')
  ? __non_webpack_require__
  : require;

const argv = process.argv.slice(2);
const arg = (name: string, fallback: any) => {
  const i = argv.indexOf(name);
  if (i === -1) return fallback;
  return argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : fallback;
};

const LIMIT = Number(arg('--limit', 20));
const MIN_MB = Number(arg('--minMB', 0));
const excludeArg = arg('--exclude', null);

const cwd = process.cwd();
const defaultExcludes = new Set(['.git', 'node_modules', '.venv', 'dist', 'build', 'out', 'data']);
if (excludeArg) excludeArg.split(',').forEach((s: string) => defaultExcludes.add(s.trim()));

interface FileEntry {
  path: string;
  size: number;
}

function walk(dir: string, list: FileEntry[]) {
  let entries: fs.Dirent[];
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); }
  catch (e) { return; }
  for (const ent of entries) {
    if (defaultExcludes.has(ent.name)) continue;
    const full = path.join(dir, ent.name);
    try {
      if (ent.isDirectory()) {
        walk(full, list);
      } else if (ent.isFile()) {
        let st: fs.Stats;
        try { st = fs.statSync(full); } catch (e) { continue; }
        list.push({ path: path.relative(cwd, full).replace(/\\/g, '/'), size: st.size });
      }
    } catch (e) { /* ignore permission errors etc */ }
  }
}

const list: FileEntry[] = [];
walk(cwd, list);
list.sort((a, b) => b.size - a.size);

const rows = list.filter(r => r.size >= MIN_MB * 1024 * 1024).slice(0, LIMIT);
console.log(`Top ${rows.length} files (excluding ${Array.from(defaultExcludes).join(', ')})`);
for (let i = 0; i < rows.length; i++) {
  const r = rows[i];
  const mb = (r.size / (1024 * 1024)).toFixed(2);
  console.log(`${String(i + 1).padStart(2)}. ${mb} MB — ${r.path}`);
}

if (rows.length === 0) console.log('(no files matched the criteria)');
