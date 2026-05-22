import * as fs from 'fs';
import * as path from 'path';

const root = path.resolve(__dirname, '..', '..');

const scanRoots = [
  'cards',
  'cpu',
  'game',
  'scripts',
  'sound-engine.ts',
  'src',
  'test',
  'training',
  'ui',
  'ui.ts',
  'utils',
  'workers'
];

const skipDirs = new Set([
  '.git',
  'coverage',
  'dist',
  'node_modules',
  'worker-public'
]);

const allowedNoCheckDebt = new Set([
  'cards/card-interaction.ts',
  'cards/card-renderer.ts',
  'scripts/local-match-runtime.ts',
  'scripts/local-match-server.ts',
  'scripts/run-ui-level-match.ts',
  'src/engine/selfplay-runner.ts',
  'training/engine/selfplay-runner.ts',
  'training/scripts/analyze-crystal-stone-quiet.ts',
  'training/scripts/analyze-crystal-stone.ts',
  'training/scripts/analyze-destroy-cycle.ts',
  'training/scripts/analyze-selfplay-moves.ts',
  'training/scripts/analyze-trap-will.ts',
  'training/scripts/audit-card-context-parity.ts',
  'training/scripts/audit-card-use-future-delta.ts',
  'training/scripts/audit-corner-use-drift.ts',
  'training/scripts/benchmark-policy-adoption.ts',
  'training/scripts/benchmark-policy-onnx-gate.ts',
  'training/scripts/benchmark-policy-quality-gate.ts',
  'training/scripts/benchmark-selfplay-policy.ts',
  'training/scripts/clean-selfplay-artifacts.ts',
  'training/scripts/export-teacher-solutions.ts',
  'training/scripts/generate-selfplay-data-parallel.ts',
  'training/scripts/generate-selfplay-data.ts',
  'training/scripts/load-training-profile.ts',
  'training/scripts/monitor-selfplay-training-run.ts',
  'training/scripts/preflight-deepcfr-training.ts',
  'training/scripts/preflight-selfplay-training.ts',
  'training/scripts/promote-policy-model.ts',
  'training/scripts/replay-adoption-gate.ts',
  'training/scripts/replay-selfplay-illegal-move-hardcase.ts',
  'training/scripts/run-foundation-bootstrap.ts',
  'training/scripts/run-hardcase-mining.ts',
  'training/scripts/run-hardcase-retrain.ts',
  'training/scripts/run-selfplay-training-cycle.ts',
  'training/scripts/run-selfplay-training-preset.ts',
  'training/scripts/run-selfplay-training-profile.ts',
  'training/scripts/seed-bank-manager.ts',
  'training/scripts/training-cycle-command-builders.ts',
  'training/scripts/training-cycle-reporting.ts',
  'training/scripts/training-cycle-steps.ts',
  'training/scripts/training-resolved-config-utils.ts',
  'training/scripts/training-warehouse-manifest-utils.ts',
  'ui.ts'
]);

function normalizePath(value: string): string {
  return value.replace(/\\/g, '/');
}

function walk(target: string, out: string[]): void {
  const absolute = path.join(root, target);
  if (!fs.existsSync(absolute)) return;
  const stat = fs.statSync(absolute);
  if (stat.isDirectory()) {
    for (const name of fs.readdirSync(absolute)) {
      if (skipDirs.has(name)) continue;
      walk(path.join(target, name), out);
    }
    return;
  }
  if (target.endsWith('.ts')) out.push(normalizePath(target));
}

function hasTopLevelNoCheck(relativePath: string): boolean {
  const source = fs.readFileSync(path.join(root, relativePath), 'utf8');
  const firstLines = source.split(/\r?\n/, 6).join('\n');
  return /^\/\/\s*@ts-nocheck\b/m.test(firstLines);
}

const files: string[] = [];
for (const scanRoot of scanRoots) walk(scanRoot, files);

const noCheckFiles = Array.from(new Set(files.filter(hasTopLevelNoCheck))).sort();
const unauthorized = noCheckFiles.filter((file) => !allowedNoCheckDebt.has(file));
const staleAllowlist = Array.from(allowedNoCheckDebt).filter((file) => !noCheckFiles.includes(file)).sort();

if (unauthorized.length > 0) {
  console.error('[ts-migration-safety] FAILED: unauthorized @ts-nocheck files found');
  for (const file of unauthorized) console.error(` - ${file}`);
  process.exit(2);
}

console.log(`[ts-migration-safety] authorized @ts-nocheck debt: ${noCheckFiles.length}`);
if (staleAllowlist.length > 0) {
  console.log(`[ts-migration-safety] stale allowlist entries ready for removal: ${staleAllowlist.length}`);
  for (const file of staleAllowlist) console.log(` - ${file}`);
}
console.log('[ts-migration-safety] No unauthorized @ts-nocheck directives found.');
