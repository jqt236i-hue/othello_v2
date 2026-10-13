#!/usr/bin/env node
"use strict";

// Hermetic Node CLI adapter: compile dist/scripts/ (or, with --prepared, verify it with
// dist/scripts/check-compiled-snapshot.js instead of compiling), validate it, then run the read-only checks.
const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const REQUIRED_DIST_SCRIPTS = Object.freeze([
  "run-all-checks.js", "check-compiled-snapshot.js", "check-window-usage.js", "check-refactor-safety.js",
  "check-ts-migration-safety.js", "check-board-kernel-boundary.js", "check-board-test-selectors.js",
  "check-browser-build-up-to-date.js", "check-card-runtime-boundary.js", "build-vite-entry.js",
  "check-asset-file-case.js", "check-artifact-retention.js", "check-worker-mirror.js",
  "test-shim-forwarding.js", "inventory-js-legacy.js"
]);

function outcome(stage, result) {
  if (result.error) return { stage, status: 1, signal: null, error: result.error };
  return { stage, status: Number.isInteger(result.status) ? result.status : null, signal: result.signal || null };
}

function runCheckallBootstrap(options = {}) {
  const rootDir = options.rootDir || path.resolve(__dirname, "..");
  const exists = options.existsSync || fs.existsSync;
  const run = (stage, args) => outcome(stage, (options.spawnSync || spawnSync)(process.execPath, args, { cwd: rootDir, env: process.env, stdio: "inherit" }));
  const distScript = (name) => path.join(rootDir, "dist", "scripts", name);
  const failed = (result) => result.status !== 0 || result.signal || result.error;
  const compiled = options.prepared ? null : run("compile", [require.resolve("typescript/bin/tsc"), "-p", path.join(rootDir, "tsconfig.build.json")]);
  if (compiled && failed(compiled)) return compiled;
  const missing = REQUIRED_DIST_SCRIPTS.filter((name) => !exists(distScript(name)));
  if (missing.length > 0) return { stage: "snapshot", status: 2, signal: null, missing };
  const fresh = options.prepared ? run("snapshot", [distScript("check-compiled-snapshot.js")]) : null;
  if (fresh && failed(fresh)) return fresh;
  return run("runner", [distScript("run-all-checks.js")].concat(options.runnerArgs || []));
}

function exitWithOutcome(result) {
  if (result.error) console.error(result.error.message || result.error);
  if (result.missing) console.error(`[checkall-bootstrap] missing compiled checks: ${result.missing.join(", ")}`);
  if (result.signal) process.kill(process.pid, result.signal);
  process.exit(Number.isInteger(result.status) ? result.status : 1);
}

if (require.main === module) exitWithOutcome(runCheckallBootstrap({ prepared: process.argv.includes("--prepared") }));
module.exports = { REQUIRED_DIST_SCRIPTS, runCheckallBootstrap };
