"use strict";

const fs = require("fs");
const path = require("path");
const ts = require("typescript");

const repoRoot = path.resolve(__dirname, "..");
const sourceRoot = path.join(repoRoot, "training", "scripts");
const outRoot = path.join(repoRoot, "dist", "scripts");

function walkTsFiles(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkTsFiles(fullPath, out);
      continue;
    }
    if (entry.isFile() && entry.name.endsWith(".ts")) {
      out.push(fullPath);
    }
  }
  return out;
}

function ensureParent(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

function emitFile(sourcePath) {
  const rel = path.relative(sourceRoot, sourcePath);
  const outPath = path.join(outRoot, rel).replace(/\.ts$/i, ".js");
  const sourceText = fs.readFileSync(sourcePath, "utf8");
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
  fs.writeFileSync(outPath, result.outputText, "utf8");
  if (result.sourceMapText) {
    fs.writeFileSync(`${outPath}.map`, result.sourceMapText, "utf8");
  }
  return outPath;
}

function main() {
  const files = walkTsFiles(sourceRoot);
  for (const file of files) {
    emitFile(file);
  }
  console.log(`[build-training-cli] emitted ${files.length} files to ${path.relative(repoRoot, outRoot)}`);
}

if (require.main === module) {
  main();
}

module.exports = {
  emitFile,
  walkTsFiles
};
