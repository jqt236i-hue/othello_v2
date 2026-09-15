import * as fs from 'fs';
import * as path from 'path';

const TARGET_DIRS = ['.', 'game', 'ui', 'shared', 'scripts', 'cards', 'src', 'utils', 'constants', 'workers', 'cpu', 'public', 'tests', 'test'];

const SKIP_DIRS = new Set([
  '.git',
  '.sisyphus',
  '.wrangler',
  '.venv',
  'artifacts',
  'assets',
  'coverage',
  'dist',
  'node_modules',
  'tmp',
  'worker-public'
]);

type JsCategory =
  | 'dist-wrapper'
  | 'generated'
  | 'test-fixture'
  | 'node-cli-adapter'
  | 'runtime-projection'
  | 'legacy-implementation'
  | 'unknown';

interface AllowlistEntry {
  category: JsCategory;
  reason: string;
  owner?: string;
  removalPhase?: string;
}

type AllowlistFile = {
  version: number;
  updatedAt: string;
  entries: Record<string, AllowlistEntry>;
};

interface InventoryRow {
  file: string;
  category: JsCategory;
  hasTs: boolean;
  lineCount: number;
  allowlisted: boolean;
  allowlistCategory: JsCategory | null;
  content?: string;
}

interface RuntimeAuthorityIssue {
  file: string;
  reason: 'missing-expiring-authority-allowlist' | 'incomplete-expiring-authority-allowlist';
}

const ALLOWLIST_PATHS = [
  path.join('docs', 'typescript-migration-js-allowlist.json'),
  path.join('scripts', 'typescript-migration-js-allowlist.json')
];

function loadAllowlist(): AllowlistFile {
  for (const p of ALLOWLIST_PATHS) {
    if (!fs.existsSync(p)) continue;
    const raw = fs.readFileSync(p, 'utf8');
    const parsed = JSON.parse(raw) as AllowlistFile;
    if (!parsed || typeof parsed !== 'object' || !parsed.entries || typeof parsed.entries !== 'object') {
      throw new Error(`[JS-INVENTORY-GATE] invalid allowlist shape: ${p}`);
    }
    return parsed;
  }
  return { version: 1, updatedAt: 'n/a', entries: {} };
}

function walk(dir: string, root = dir): string[] {
  const results: string[] = [];
  const list = fs.readdirSync(dir);
  for (const file of list) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat.isDirectory()) {
      // CPU comparison archives retain the exact old JS and diagnostic models
      // needed to replay each recorded policy. Production sources live outside
      // these evidence roots; never migrate or rewrite a frozen opponent here.
      const relativeDir = path.relative('.', filePath).replace(/\\/g, '/');
      if (['data/cpu-lv10/baseline-v1', 'data/cpu-lv11', 'data/cpu-lv12'].includes(relativeDir)) continue;
      const relDir = path.relative(root, filePath).replace(/\\/g, '/');
      const firstSegment = relDir.split('/')[0];
      if (SKIP_DIRS.has(file) || SKIP_DIRS.has(firstSegment)) continue;
      results.push(...walk(filePath, root));
    } else if (file.endsWith('.js')) {
      if (file.startsWith('tmp-')) continue;
      results.push(filePath);
    }
  }
  return results;
}

function classify(relPath: string, content: string): JsCategory {
  if (relPath.startsWith('test/') || relPath.startsWith('tests/') || relPath.includes('/__tests__/') || relPath.endsWith('.test.js')) {
    return 'test-fixture';
  }

  if ((relPath === 'public/module-registry.js' || /^public\/module-registry\.optional(?:\.[a-z-]+)?\.js$/.test(relPath)) && content.includes('Auto-generated module registry')) return 'generated';

  if (
    (
      relPath === 'public/vendor/pixi-8.18.1.min.js'
      || relPath === 'public/vendor/pixi-unsafe-eval-8.18.1.min.js'
    )
    && content.includes('PixiJS - v8.18.1')
  ) {
    return 'generated';
  }

  if (
    relPath === 'entry-browser.js'
    || relPath === 'public/runtime.js'
    || relPath === 'esbuild-banner.js'
    || relPath === 'esbuild-footer.js'
    || relPath.endsWith('.runtime.js')
    || content.trim() === 'module.exports = null;'
    || content.trim() === '"use strict";\nmodule.exports = null;'
  ) {
    return 'runtime-projection';
  }

  if (relPath.includes('.generated.')) return 'generated';

  if (relPath === 'scripts/dist-cli-wrapper.js') {
    return 'node-cli-adapter';
  }

  if (relPath === 'cards/catalog.js' && content.includes('Auto-generated from cards/catalog.json')) {
    return 'generated';
  }

  const lines = content.split('\n');
  const nonEmptyLines = lines.filter(l => l.trim().length > 0);

  const hasModuleExports = content.includes('module.exports');
  const hasRequire = content.includes('require(');
  const requiresDist = /require\(['"]\.?\.?(?:\/\.\.)*\/dist\//.test(content)
    || /require\(['"]\.\.\/dist\//.test(content)
    || /require\(['"]\.\/dist\//.test(content)
    || /require\(['"]\.\.\/\.\.\/dist\//.test(content);

  if (
    relPath.startsWith('scripts/')
    && hasRequire
    && (requiresDist || content.includes('dist/scripts/'))
    && nonEmptyLines.length <= 40
  ) {
    return 'node-cli-adapter';
  }

  if (hasModuleExports && hasRequire && requiresDist && nonEmptyLines.length <= 20) {
    return 'dist-wrapper';
  }

  if (
    nonEmptyLines.length <= 12
    && content.includes('Object.defineProperty(exports, "__esModule", { value: true })')
    && !hasRequire
    && !hasModuleExports
  ) {
    return 'runtime-projection';
  }

  if (relPath === 'game/card-effects-applier.js' || relPath === 'ui/event-handlers.js') {
    return 'runtime-projection';
  }

  if (relPath === 'game/card-effects/selection-flow.js' || relPath === 'ui/bootstrap.js') {
    return 'runtime-projection';
  }

  if (hasModuleExports && hasRequire && nonEmptyLines.length <= 12) {
    return 'dist-wrapper';
  }

  // Legacy implementation: substantial code
  if (nonEmptyLines.length > 10 && /\b(function|class|const\s+\w+\s*=|let\s+\w+\s*=|var\s+\w+\s*=)\b/.test(content)) {
    return 'legacy-implementation';
  }

  if (relPath.startsWith('scripts/')) {
    return 'legacy-implementation';
  }

  return 'unknown';
}

function isSubstantialRuntimeImplementation(content: string): boolean {
  const nonEmptyLines = content.split('\n').filter((line) => line.trim().length > 0);
  const declarationCount = (content.match(/\b(function|class)\s+\w+\b/g) || []).length;
  return declarationCount >= 2 || (
    nonEmptyLines.length > 12
    && /\b(function|class|const\s+\w+\s*=|let\s+\w+\s*=|var\s+\w+\s*=)\b/.test(content)
  );
}

function findHiddenRuntimeAuthorities(
  results: InventoryRow[],
  allowlist: Pick<AllowlistFile, 'entries'>
): RuntimeAuthorityIssue[] {
  const issues: RuntimeAuthorityIssue[] = [];
  for (const row of results) {
    if (!row.hasTs || !row.file.endsWith('.runtime.js')) continue;
    const fullPath = path.resolve(row.file.replace(/\//g, path.sep));
    const content = row.content ?? fs.readFileSync(fullPath, 'utf8');
    if (!isSubstantialRuntimeImplementation(content)) continue;

    const entry = allowlist.entries[row.file];
    if (!entry) {
      issues.push({ file: row.file, reason: 'missing-expiring-authority-allowlist' });
      continue;
    }
    if (
      entry.category !== 'runtime-projection'
      || typeof entry.owner !== 'string'
      || entry.owner.trim().length === 0
      || typeof entry.removalPhase !== 'string'
      || !/^Phase \d+\.\d+$/.test(entry.removalPhase)
    ) {
      issues.push({ file: row.file, reason: 'incomplete-expiring-authority-allowlist' });
    }
  }
  return issues;
}

function main() {
  const allowlist = loadAllowlist();
  const allJsSet = new Set<string>();
  for (const dir of TARGET_DIRS) {
    if (fs.existsSync(dir)) {
      for (const jsPath of walk(dir)) allJsSet.add(path.resolve(jsPath));
    }
  }
  const allJs = Array.from(allJsSet);

  const results: InventoryRow[] = allJs.map(jsPath => {
    const rel = path.relative(process.cwd(), jsPath).replace(/\\/g, '/');
    const content = fs.readFileSync(jsPath, 'utf8');
    const category = classify(rel, content);
    const tsPath = jsPath.replace(/\.js$/, '.ts');
    const hasTs = fs.existsSync(tsPath);
    const lineCount = content.split('\n').length;
    const allow = allowlist.entries[rel];
    return {
      file: rel,
      category,
      hasTs,
      lineCount,
      allowlisted: !!allow,
      allowlistCategory: allow ? allow.category : null
    };
  });

  // Sort by category then by file
  results.sort((a, b) => {
    if (a.category !== b.category) return a.category.localeCompare(b.category);
    return a.file.localeCompare(b.file);
  });

  console.log('=== JS Inventory ===\n');
  for (const r of results) {
    const allowMark = r.allowlisted ? '*' : ' ';
    console.log(`${r.category.padEnd(20)} ${r.hasTs ? 'TS' : '  '} ${String(r.lineCount).padStart(5)} ${allowMark} ${r.file}`);
  }

  // Summary
  const summary: Record<string, number> = {};
  for (const r of results) {
    summary[r.category] = (summary[r.category] || 0) + 1;
  }
  console.log('\n=== Summary ===');
  for (const [cat, count] of Object.entries(summary).sort((a, b) => a[0].localeCompare(b[0]))) {
    console.log(`${cat}: ${count}`);
  }

  const unknown = results.filter(r => r.category === 'unknown');
  const legacyNotAllowlisted = results.filter(r => r.category === 'legacy-implementation' && !(r.allowlisted && r.allowlistCategory === 'legacy-implementation'));

  const badAllowlistCategory = results.filter((r) => {
    if (!r.allowlisted) return false;
    return r.allowlistCategory !== r.category;
  });

  const unwrappedWithTs = results.filter((r) => {
    if (!r.hasTs) return false;
    if (r.category === 'dist-wrapper' || r.category === 'generated' || r.category === 'test-fixture' || r.category === 'node-cli-adapter' || r.category === 'runtime-projection') return false;
    if (r.allowlisted) return false;
    return true;
  });

  const staleWrappers = results.filter((r) => {
    if (r.category !== 'dist-wrapper') return false;
    const filePath = r.file.replace(/\//g, path.sep);
    const fullPath = path.resolve(filePath);
    const content = fs.readFileSync(fullPath, 'utf8');
    const requireMatch = content.match(/require\(['"]([^'"]+)['"]\)/);
    if (!requireMatch) return false;
    const target = requireMatch[1];
    if (!target.startsWith('.')) return false;
    const resolved = path.resolve(path.dirname(fullPath), target);
    return !fs.existsSync(resolved + '.js') && !fs.existsSync(resolved + '.cjs') && !fs.existsSync(resolved + '.mjs') && !fs.existsSync(resolved);
  });

  const missingRuntimeProjectionSources = results.filter((r) => {
    if (r.category !== 'runtime-projection') return false;
    if (r.file === 'entry-browser.js' || r.file === 'public/runtime.js' || r.file === 'esbuild-banner.js' || r.file === 'esbuild-footer.js') return false;
    if (r.hasTs) return false;
    if (r.file.endsWith('.runtime.js')) {
      const sourcePath = r.file.replace(/\.runtime\.js$/, '.ts').replace(/\//g, path.sep);
      return !fs.existsSync(path.resolve(sourcePath));
    }
    return false;
  });

  const legacyCount = results.filter(r => r.category === 'legacy-implementation').length;
  const unknownCount = unknown.length;
  const hiddenRuntimeAuthorities = findHiddenRuntimeAuthorities(results, allowlist);

  if (unknown.length > 0 || legacyNotAllowlisted.length > 0 || badAllowlistCategory.length > 0 || unwrappedWithTs.length > 0 || staleWrappers.length > 0 || missingRuntimeProjectionSources.length > 0 || hiddenRuntimeAuthorities.length > 0) {
    console.error('\n[JS-INVENTORY-GATE] FAILED');
    if (unknown.length > 0) {
      console.error(`- unknown files: ${unknown.length}`);
      unknown.forEach(r => console.error(`  - ${r.file}`));
    }
    if (legacyNotAllowlisted.length > 0) {
      console.error(`- legacy files without allowlist: ${legacyNotAllowlisted.length}`);
      legacyNotAllowlisted.forEach(r => console.error(`  - ${r.file} (${r.lineCount} lines)`));
    }
    if (badAllowlistCategory.length > 0) {
      console.error(`- allowlist category mismatch: ${badAllowlistCategory.length}`);
      badAllowlistCategory.forEach(r => console.error(`  - ${r.file} (actual=${r.category}, allowlist=${r.allowlistCategory})`));
    }
    if (unwrappedWithTs.length > 0) {
      console.error(`- non-wrapper JS with TS sibling and no allowlist: ${unwrappedWithTs.length}`);
      unwrappedWithTs.forEach(r => console.error(`  - ${r.file} (${r.category})`));
    }
    if (staleWrappers.length > 0) {
      console.error(`- stale dist wrappers: ${staleWrappers.length}`);
      staleWrappers.forEach(r => console.error(`  - ${r.file}`));
    }
    if (missingRuntimeProjectionSources.length > 0) {
      console.error(`- runtime projections without TS source contract: ${missingRuntimeProjectionSources.length}`);
      missingRuntimeProjectionSources.forEach(r => console.error(`  - ${r.file}`));
    }
    if (hiddenRuntimeAuthorities.length > 0) {
      console.error(`- substantial runtime authorities without an expiring owner: ${hiddenRuntimeAuthorities.length}`);
      hiddenRuntimeAuthorities.forEach((issue) => console.error(`  - ${issue.file} (${issue.reason})`));
    }
    process.exit(2);
  }

  console.log(`\n[JS-INVENTORY-GATE] PASSED: unknown=${unknownCount}, legacy-implementation=${legacyCount}, wrappers and runtime projections are valid.`);
}

if (require.main === module) {
  main();
}

export = {
  classify,
  findHiddenRuntimeAuthorities,
  isSubstantialRuntimeImplementation,
  main
};
