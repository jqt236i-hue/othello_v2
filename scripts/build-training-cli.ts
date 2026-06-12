import * as fs from 'fs';
import * as path from 'path';
import * as ts from 'typescript';

const currentDir = path.resolve(__dirname);
const repoRoot = path.basename(path.dirname(currentDir)) === 'dist'
  ? path.resolve(currentDir, '..', '..')
  : path.resolve(currentDir, '..');
const sourceRoot = path.join(repoRoot, 'training', 'scripts');
const outRoot = path.join(repoRoot, 'dist', 'scripts');

function walkTsFiles(dir: string, out: string[] = []): string[] {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkTsFiles(fullPath, out);
      continue;
    }
    if (entry.isFile() && entry.name.endsWith('.ts')) {
      out.push(fullPath);
    }
  }
  return out;
}

function ensureParent(filePath: string): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

function emitFile(sourcePath: string): string {
  const rel = path.relative(sourceRoot, sourcePath);
  const outPath = path.join(outRoot, rel).replace(/\.ts$/i, '.js');
  const sourceText = fs.readFileSync(sourcePath, 'utf8');
  const result = ts.transpileModule(sourceText, {
    fileName: sourcePath,
    compilerOptions: {
      target: ts.ScriptTarget.ES2020,
      module: ts.ModuleKind.CommonJS,
      esModuleInterop: true,
      sourceMap: true
    }
  });
  ensureParent(outPath);
  fs.writeFileSync(outPath, result.outputText, 'utf8');
  if (result.sourceMapText) {
    fs.writeFileSync(`${outPath}.map`, result.sourceMapText, 'utf8');
  }
  return outPath;
}

function main(): void {
  const files = walkTsFiles(sourceRoot);
  for (const file of files) {
    emitFile(file);
  }
  console.log(`[build-training-cli] emitted ${files.length} files to ${path.relative(repoRoot, outRoot)}`);
}

if (require.main === module) {
  main();
}

export = {
  emitFile,
  walkTsFiles,
  main
};
