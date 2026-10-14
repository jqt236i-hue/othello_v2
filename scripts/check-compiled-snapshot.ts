/**
 * Read-only freshness check for the compiled dist/ snapshot used by `npm run checkall:prepared`.
 * Lists every source compiled by tsconfig.build.json whose dist/*.js output is missing or older,
 * and exits non-zero instead of compiling, so stale checks are never run.
 */
import * as fs from 'fs';
import * as path from 'path';
import * as ts from 'typescript';

export function findStaleCompiledSources(rootDir: string, fileSystem: Pick<typeof fs, 'statSync'> = fs): string[] {
  const configPath = path.join(rootDir, 'tsconfig.build.json');
  const parsed = ts.getParsedCommandLineOfConfigFile(configPath, {}, {
    ...ts.sys,
    onUnRecoverableConfigFileDiagnostic: (diagnostic) => {
      throw new Error(ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n'));
    }
  });
  if (!parsed) throw new Error(`[compiled-snapshot] cannot read ${configPath}`);
  const outDir = parsed.options.outDir || path.join(rootDir, 'dist');
  const sourceRoot = parsed.options.rootDir || rootDir;
  const stale: string[] = [];
  for (const fileName of parsed.fileNames) {
    if (!/\.(?:ts|js)$/.test(fileName) || fileName.endsWith('.d.ts')) continue;
    const relativePath = path.relative(sourceRoot, fileName);
    const outputPath = path.join(outDir, relativePath.replace(/\.ts$/, '.js'));
    let sourceStat: fs.Stats;
    let outputStat: fs.Stats;
    try { sourceStat = fileSystem.statSync(fileName); } catch { continue; }
    try { outputStat = fileSystem.statSync(outputPath); } catch { stale.push(relativePath); continue; }
    if (outputStat.mtimeMs < sourceStat.mtimeMs) stale.push(relativePath);
  }
  return stale.map((file) => file.replace(/\\/g, '/')).sort();
}

function main(): void {
  const rootDir = path.resolve(__dirname, '..', '..');
  const stale = findStaleCompiledSources(rootDir);
  if (stale.length > 0) {
    console.error(`[compiled-snapshot] dist/ is stale for ${stale.length} source(s); run \`npm run build:ts\` (or use \`npm run checkall\`):`);
    for (const file of stale.slice(0, 20)) console.error(`  - ${file}`);
    if (stale.some((file) => file.startsWith('browser-vite/generated/'))) {
      console.error('[compiled-snapshot] browser-vite/generated/* was regenerated after compilation: commit the regenerated file (the build rewrites it only when the module set changed) or use `npm run checkall`.');
    }
    process.exit(2);
  }
  console.log('[compiled-snapshot] dist/ is up to date with tsconfig.build.json sources');
}

const isDirectRun = typeof require !== 'undefined'
  && !!require.main
  && /[\\/]check-compiled-snapshot\.js$/.test(String(require.main.filename || ''));

if (isDirectRun) {
  main();
}
