import * as fs from 'fs';
import * as path from 'path';
import { spawnSync } from 'child_process';

const ROOT = path.resolve(__dirname, '..');
const BASELINE_PATH = path.join(ROOT, '.sisyphus', 'evidence', 'wave-0-baseline.txt');

interface TestCounts {
  pass: number;
  fail: number;
  total: number;
}

function stripAnsi(str: string): string {
  return str.replace(/\x1B\[[0-9;]*[a-zA-Z]/g, '').replace(/\x1B\][0-9;]*[a-zA-Z]/g, '');
}

function countPassFail(text: string): TestCounts {
  const clean = stripAnsi(text);
  const passCount = (clean.match(/^PASS /gm) || []).length;
  const failCount = (clean.match(/^FAIL /gm) || []).length;
  return { pass: passCount, fail: failCount, total: passCount + failCount };
}

let baselineContent: string;
try {
  baselineContent = fs.readFileSync(BASELINE_PATH, 'utf8');
} catch (err) {
  console.error(`ERROR: Cannot read baseline file: ${BASELINE_PATH}`);
  process.exit(1);
}

const baseline = countPassFail(baselineContent);
console.log(`Baseline: ${baseline.pass} PASS, ${baseline.fail} FAIL (${baseline.total} total)`);

console.log('\nRunning npx jest --runInBand ...');
console.log('(this may take several minutes)\n');

const result = spawnSync('npx', ['jest', '--runInBand', '--no-cache'], {
  cwd: ROOT,
  encoding: 'utf8',
  timeout: 600_000,
  maxBuffer: 64 * 1024 * 1024,
  stdio: ['pipe', 'pipe', 'pipe'],
  env: { ...process.env, FORCE_COLOR: '0', NO_COLOR: '1', TERM: 'dumb' }
});

const currentOutput = (result.stdout || '') + (result.stderr || '');
const current = countPassFail(currentOutput);
console.log(`Current:  ${current.pass} PASS, ${current.fail} FAIL (${current.total} total)`);

let regression = false;

if (current.pass < baseline.pass) {
  console.error(`\nREGRESSION: PASS count decreased from ${baseline.pass} to ${current.pass}`);
  regression = true;
}

if (current.fail > baseline.fail) {
  console.error(`\nREGRESSION: FAIL count increased from ${baseline.fail} to ${current.fail}`);
  regression = true;
}

console.log('');

if (regression) {
  console.error('Test regression detected. See above for details.');
  process.exit(1);
} else {
  console.log('No regression detected. Test results match baseline expectations.');
  process.exit(0);
}
