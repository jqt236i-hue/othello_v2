#!/usr/bin/env node
"use strict";

// Hermetic Node CLI adapter: prepare (compile) the dist/scripts/ snapshot, validate it, then launch
// the read-only checks. `--prepared` skips compilation for a tree that was already built (for
// example right after `npm run worker:prepare`) and instead fails fast when any canonical TypeScript
// source is newer than its compiled output, so stale dist is never checked.
const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const REQUIRED_DIST_SCRIPTS = Object.freeze([
  "run-all-checks.js", "check-window-usage.js", "check-refactor-safety.js",
  "check-ts-migration-safety.js", "check-board-kernel-boundary.js",
  "check-board-test-selectors.js", "check-browser-build-up-to-date.js",
  "check-card-runtime-boundary.js", "build-vite-entry.js",
  "check-asset-file-case.js", "check-artifact-retention.js", "check-worker-mirror.js",
  "test-shim-forwarding.js", "inventory-js-legacy.js"
]);

function outcome(stage, result) {
  if (result.error) return { stage, status: 1, signal: null, error: result.error };
  return { stage, status: Number.isInteger(result.status) ? result.status : null, signal: result.signal || null };
}

// Lists the sources compiled by tsconfig.build.json whose dist/*.js output is missing or older.
function findStaleCompiledSources(rootDir, fileSystem = fs) {
  const ts = require("typescript");
  const configPath = path.join(rootDir, "tsconfig.build.json");
  const parsed = ts.getParsedCommandLineOfConfigFile(configPath, {}, {
    ...ts.sys,
    onUnRecoverableConfigFileDiagnostic: (diagnostic) => {
      throw new Error(ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n"));
    }
  });
  if (!parsed) throw new Error(`[checkall-bootstrap] cannot read ${configPath}`);
  const outDir = parsed.options.outDir || path.join(rootDir, "dist");
  const sourceRoot = parsed.options.rootDir || rootDir;
  const stale = [];
  for (const fileName of parsed.fileNames) {
    if (!/\.(?:ts|js)$/.test(fileName) || fileName.endsWith(".d.ts")) continue;
    const relativePath = path.relative(sourceRoot, fileName);
    const outputPath = path.join(outDir, relativePath.replace(/\.ts$/, ".js"));
    let sourceStat;
    let outputStat;
    try { sourceStat = fileSystem.statSync(fileName); } catch { continue; }
    try { outputStat = fileSystem.statSync(outputPath); } catch { stale.push(relativePath); continue; }
    if (outputStat.mtimeMs < sourceStat.mtimeMs) stale.push(relativePath);
  }
  return stale.map((file) => file.replace(/\\/g, "/")).sort();
}

function runCheckallBootstrap(options = {}) {
  const rootDir = options.rootDir || path.resolve(__dirname, "..");
  const spawn = options.spawnSync || spawnSync;
  const exists = options.existsSync || fs.existsSync;
  const run = (args) => spawn(process.execPath, args, { cwd: rootDir, env: process.env, stdio: "inherit" });
  if (options.prepared) {
    const findStale = options.findStaleCompiledSources || findStaleCompiledSources;
    const stale = findStale(rootDir);
    if (stale.length > 0) return { stage: "snapshot", status: 2, signal: null, stale };
  } else {
    const compiled = outcome("compile", run([require.resolve("typescript/bin/tsc"), "-p", path.join(rootDir, "tsconfig.build.json")]));
    if (compiled.status !== 0 || compiled.signal || compiled.error) return compiled;
  }
  const missing = REQUIRED_DIST_SCRIPTS.filter((name) => !exists(path.join(rootDir, "dist", "scripts", name)));
  if (missing.length > 0) return { stage: "snapshot", status: 2, signal: null, missing };
  return outcome("runner", run([path.join(rootDir, "dist", "scripts", "run-all-checks.js")].concat(options.runnerArgs || [])));
}

function exitWithOutcome(result) {
  if (result.error) console.error(result.error.message || result.error);
  if (result.missing) console.error(`[checkall-bootstrap] missing compiled checks: ${result.missing.join(", ")}`);
  if (result.stale) {
    console.error(`[checkall-bootstrap] compiled snapshot is stale for ${result.stale.length} source(s); run \`npm run build:ts\` (or use \`npm run checkall\`):`);
    for (const file of result.stale.slice(0, 20)) console.error(`  - ${file}`);
  }
  if (result.signal) process.kill(process.pid, result.signal);
  process.exit(Number.isInteger(result.status) ? result.status : 1);
}

if (require.main === module) {
  exitWithOutcome(runCheckallBootstrap({ prepared: process.argv.includes("--prepared") }));
}
module.exports = { REQUIRED_DIST_SCRIPTS, findStaleCompiledSources, runCheckallBootstrap };
