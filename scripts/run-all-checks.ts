import { spawnSync } from 'child_process';
import * as path from 'path';

function run(cmd: string, args: string[]): boolean {
  console.log(`\n=== running: ${cmd} ${args.join(' ')} ===`);
  const res = spawnSync(cmd, args, { stdio: 'inherit', cwd: path.resolve(__dirname, '..', '..') });
  if (res.error) {
    console.error('spawn error:', res.error);
    return false;
  }
  return res.status === 0;
}

function runNpmScript(scriptName: string): boolean {
  if (process.platform === 'win32') {
    return run(process.env.ComSpec || 'cmd.exe', ['/d', '/s', '/c', `npm.cmd run --silent ${scriptName}`]);
  }
  return run('npm', ['run', '--silent', scriptName]);
}

// Every check below is read-only against the prepared snapshot (dist/ compiled by
// checkall-bootstrap, browser outputs and worker-public/ prepared by `npm run worker:prepare`).
// Nothing here may compile or regenerate delivery outputs; stale outputs fail instead.
let ok = true;
if (!run('node', ['scripts/check-window-usage.js'])) ok = false;
if (!runNpmScript('check:dependency-boundaries')) ok = false;
if (!run('node', ['scripts/check-refactor-safety.js'])) ok = false;
if (!run('node', ['scripts/check-ts-migration-safety.js'])) ok = false;
if (!run('node', ['dist/scripts/check-board-kernel-boundary.js'])) ok = false;
if (!run('node', ['dist/scripts/check-board-test-selectors.js'])) ok = false;
if (!run('node', ['dist/scripts/check-card-runtime-boundary.js'])) ok = false;
if (!run('node', ['dist/scripts/check-browser-build-up-to-date.js'])) ok = false;
if (!run('node', ['dist/scripts/build-vite-entry.js', '--check'])) ok = false;
if (!run('node', ['scripts/check-asset-file-case.js'])) ok = false;
if (!run('node', ['dist/scripts/check-artifact-retention.js'])) ok = false;
if (!run('node', ['dist/scripts/check-worker-mirror.js'])) ok = false;
if (!run('node', ['scripts/test-shim-forwarding.js'])) ok = false;
if (!run('node', ['dist/scripts/inventory-js-legacy.js'])) ok = false;

if (!ok) {
  console.error('\nOne or more checks failed.');
  process.exit(2);
}
console.log('\nAll checks passed.');
process.exit(0);
