import * as fs from 'fs';
import * as path from 'path';

const TARGET_DIRS = ['game', 'ui', 'shared', 'scripts', 'cards', 'src', 'utils', 'constants', 'workers'];

function walk(dir: string): string[] {
  const results: string[] = [];
  const list = fs.readdirSync(dir);
  for (const file of list) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat.isDirectory()) {
      results.push(...walk(filePath));
    } else if (file.endsWith('.js')) {
      results.push(filePath);
    }
  }
  return results;
}

function classify(relPath: string, content: string): string {
  if (relPath.startsWith('test/') || relPath.startsWith('tests/')) return 'test-or-tooling';
  if (relPath.includes('.generated.')) return 'generated';

  const lines = content.split('\n');
  const nonEmptyLines = lines.filter(l => l.trim().length > 0);

  // Dist wrapper: very short and only exports from dist
  if (nonEmptyLines.length <= 3 && content.includes('module.exports') && content.includes('require(')) {
    return 'dist-wrapper';
  }

  // Legacy implementation: substantial code
  if (nonEmptyLines.length > 10 && /\b(function|class|const\s+\w+\s*=|let\s+\w+\s*=|var\s+\w+\s*=)\b/.test(content)) {
    return 'legacy-implementation';
  }

  return 'unknown';
}

function main() {
  const allJs: string[] = [];
  for (const dir of TARGET_DIRS) {
    if (fs.existsSync(dir)) {
      allJs.push(...walk(dir));
    }
  }

  const results = allJs.map(jsPath => {
    const rel = path.relative(process.cwd(), jsPath).replace(/\\/g, '/');
    const content = fs.readFileSync(jsPath, 'utf8');
    const category = classify(rel, content);
    const tsPath = jsPath.replace(/\.js$/, '.ts');
    const hasTs = fs.existsSync(tsPath);
    const lineCount = content.split('\n').length;
    return { file: rel, category, hasTs, lineCount };
  });

  // Sort by category then by file
  results.sort((a, b) => {
    if (a.category !== b.category) return a.category.localeCompare(b.category);
    return a.file.localeCompare(b.file);
  });

  console.log('=== JS Inventory ===\n');
  for (const r of results) {
    console.log(`${r.category.padEnd(20)} ${r.hasTs ? 'TS' : '  '} ${String(r.lineCount).padStart(5)}  ${r.file}`);
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

  // Gate: fail if new high-risk dual-source files appear (TS exists but JS is not wrapper)
  const allowedLegacy = new Set([
    'game/move-executor.js',
    'game/pass-handler.js',
    'game/move-generator.js',
    'game/special-effects/hyperactive.js',
    'game/special-effects/dragons.js'
  ]);
  const unwrappedHighRisk = results.filter(r => r.file.startsWith('game/') && r.hasTs && r.category !== 'dist-wrapper' && r.category !== 'generated' && !allowedLegacy.has(r.file));
  if (unwrappedHighRisk.length > 0) {
    console.error(`\n[JS-INVENTORY-GATE] FAILED: ${unwrappedHighRisk.length} new high-risk file(s) under game/ are not wrapped to dist:`);
    unwrappedHighRisk.forEach(r => console.error(`  - ${r.file} (${r.category}, ${r.lineCount} lines)`));
    process.exit(2);
  }
  console.log(`\n[JS-INVENTORY-GATE] PASSED: no new unwrapped high-risk files under game/.`);
}

main();
