import { spawnSync } from 'child_process';
import * as path from 'path';

declare const __non_webpack_require__: NodeRequire | undefined;

const _require: NodeRequire = (typeof __non_webpack_require__ !== 'undefined')
  ? __non_webpack_require__
  : require;

function run(cmd: string, args: string[]): boolean {
  console.log(`\n=== running: ${cmd} ${args.join(' ')} ===`);
  const res = spawnSync(cmd, args, { stdio: 'inherit', cwd: path.resolve(__dirname, '..'), shell: true });
  return res.status === 0;
}

let ok = true;
if (!run('node', ['scripts/check-window-usage.js'])) ok = false;
if (!run('node', ['scripts/test-shim-forwarding.js'])) ok = false;

if (!ok) {
  console.error('\nOne or more checks failed.');
  process.exit(2);
}
console.log('\nAll checks passed.');
process.exit(0);
