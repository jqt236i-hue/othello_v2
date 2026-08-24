#!/usr/bin/env node
"use strict";

// Hermetic Node CLI adapter: compile, validate, then launch the dist/scripts/ checks.
const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const REQUIRED_DIST_SCRIPTS = Object.freeze([
  "run-all-checks.js", "check-window-usage.js", "check-refactor-safety.js",
  "check-ts-migration-safety.js", "check-board-kernel-boundary.js",
  "check-board-test-selectors.js", "check-browser-build-up-to-date.js",
  "check-card-runtime-boundary.js",
  "check-asset-file-case.js", "check-artifact-retention.js", "check-worker-mirror.js",
  "test-shim-forwarding.js", "inventory-js-legacy.js"
]);

function outcome(stage, result) {
  if (result.error) return { stage, status: 1, signal: null, error: result.error };
  return { stage, status: Number.isInteger(result.status) ? result.status : null, signal: result.signal || null };
}

function runCheckallBootstrap(options = {}) {
  const rootDir = options.rootDir || path.resolve(__dirname, "..");
  const spawn = options.spawnSync || spawnSync;
  const exists = options.existsSync || fs.existsSync;
  const run = (args) => spawn(process.execPath, args, { cwd: rootDir, env: process.env, stdio: "inherit" });
  const compiled = outcome("compile", run([require.resolve("typescript/bin/tsc"), "-p", path.join(rootDir, "tsconfig.build.json")]));
  if (compiled.status !== 0 || compiled.signal || compiled.error) return compiled;
  const missing = REQUIRED_DIST_SCRIPTS.filter((name) => !exists(path.join(rootDir, "dist", "scripts", name)));
  if (missing.length > 0) return { stage: "snapshot", status: 2, signal: null, missing };
  return outcome("runner", run([path.join(rootDir, "dist", "scripts", "run-all-checks.js")].concat(options.runnerArgs || [])));
}

function exitWithOutcome(result) {
  if (result.error) console.error(result.error.message || result.error);
  if (result.missing) console.error(`[checkall-bootstrap] missing compiled checks: ${result.missing.join(", ")}`);
  if (result.signal) process.kill(process.pid, result.signal);
  process.exit(Number.isInteger(result.status) ? result.status : 1);
}

if (require.main === module) exitWithOutcome(runCheckallBootstrap());
module.exports = { REQUIRED_DIST_SCRIPTS, runCheckallBootstrap };
