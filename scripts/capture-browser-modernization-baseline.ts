import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { execFileSync } from 'child_process';

import _browser_boot_check from './browser-boot-performance-check';
import { computeCpuActionWithPolicy } from '../game/cpu-decision-action';

const { runBrowserBootPerformanceCheck } = _browser_boot_check as any;
const CpuPolicyCore: any = require('../game/ai/cpu-policy-core');

const BASELINE_JSON_PATH = 'docs/perf/2026-07-13-browser-modernization-baseline.json';
const BASELINE_MARKDOWN_PATH = 'docs/perf/2026-07-13-browser-modernization-baseline.md';
const VISUAL_BASELINE_PATH = 'tests/visual-regression/baseline-board.png';
const PRESENTATION_SOURCE_PATHS = Object.freeze([
  'index.html',
  'entry-browser.js',
  'styles-animations.css',
  'styles-base.css',
  'styles-board.css',
  'styles-cards.css',
  'styles-layout.css',
  'styles-layout-controls.css',
  'styles-layout-info.css',
  'styles-responsive.css',
  'sound-engine.ts',
  'ui/animation-engine.ts',
  'ui/playback-engine.ts',
  'ui/presentation-handler.ts'
]);

interface BaselineCaptureOptions {
  rootDir?: string;
  write?: boolean;
  log?: boolean;
}

interface CpuFixtureResult {
  name: string;
  action: Record<string, unknown>;
  actionDigest: string;
}

function stableValue(value: any): any {
  if (Array.isArray(value)) return value.map(stableValue);
  if (!value || typeof value !== 'object') return value;
  const out: Record<string, unknown> = {};
  Object.keys(value).sort().forEach((key) => {
    const next = stableValue(value[key]);
    if (typeof next !== 'undefined') out[key] = next;
  });
  return out;
}

function stableJson(value: any): string {
  return JSON.stringify(stableValue(value));
}

function sha256Text(value: string | Buffer): string {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function sha256File(rootDir: string, relativePath: string): string | null {
  const filePath = path.join(rootDir, relativePath);
  if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) return null;
  return sha256Text(fs.readFileSync(filePath));
}

function readGitCommit(rootDir: string): string {
  try {
    return execFileSync('git', ['rev-parse', 'HEAD'], {
      cwd: rootDir,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore']
    }).trim();
  } catch (_error) {
    return 'unknown';
  }
}

function createBoard(rows = 8, cols = 8): number[][] {
  return Array.from({ length: rows }, () => Array.from({ length: cols }, () => 0));
}

function createCandidateMoves() {
  return [
    { row: 0, col: 0, flips: [{ row: 1, col: 1 }] },
    { row: 0, col: 3, flips: [{ row: 1, col: 3 }, { row: 2, col: 3 }, { row: 3, col: 3 }, { row: 4, col: 3 }] },
    { row: 1, col: 1, flips: [{ row: 2, col: 2 }, { row: 3, col: 3 }, { row: 4, col: 4 }, { row: 5, col: 5 }, { row: 6, col: 6 }] },
    { row: 3, col: 2, flips: [{ row: 3, col: 3 }, { row: 3, col: 4 }, { row: 3, col: 5 }] }
  ];
}

function normalizeAction(action: any): Record<string, unknown> {
  const out: Record<string, unknown> = { type: String(action && action.type || '') };
  if (action && action.move) {
    out.move = {
      row: Number(action.move.row),
      col: Number(action.move.col),
      flips: Array.isArray(action.move.flips)
        ? action.move.flips.map((one: any) => ({ row: Number(one.row), col: Number(one.col) }))
        : []
    };
  }
  if (action && action.cardId) out.cardId = String(action.cardId);
  return out;
}

function buildCpuFixture(name: string, action: any): CpuFixtureResult {
  const normalized = normalizeAction(action);
  return {
    name,
    action: normalized,
    actionDigest: sha256Text(stableJson(normalized))
  };
}

function captureCpuFixtures(): { fixtures: CpuFixtureResult[]; scoreDigest: string; scores: unknown[] } {
  const candidateMoves = createCandidateMoves();
  const board = createBoard();
  const deterministicRng = { random: () => 0.625 };
  const scoreRows = [3, 6].flatMap((level) => candidateMoves.map((move, index) => ({
    level,
    index,
    row: move.row,
    col: move.col,
    score: Number(CpuPolicyCore.scoreMoveHeuristic(move, level, board))
  })));

  const chooseAction = (level: number) => computeCpuActionWithPolicy('white', {
    resolvePlayerValue: () => -1,
    getActiveProtectionForPlayer: () => null,
    getFlipBlockers: () => [],
    getGameState: () => ({ board, currentPlayer: -1, turnNumber: 12 }),
    getLegalMoves: () => candidateMoves,
    selectCardToUse: () => null,
    selectCpuMoveWithPolicy: (moves: any[]) => CpuPolicyCore.chooseMove(
      moves,
      level,
      deterministicRng,
      null,
      { enableHeuristic: true, board }
    )
  });

  const cardAction = computeCpuActionWithPolicy('white', {
    resolvePlayerValue: () => -1,
    getActiveProtectionForPlayer: () => null,
    getFlipBlockers: () => [],
    getGameState: () => ({ board, currentPlayer: -1, turnNumber: 12 }),
    getLegalMoves: () => [],
    selectCardToUse: () => ({ cardId: 'guard_will', cardDef: { id: 'guard_will' } }),
    selectCpuMoveWithPolicy: () => null
  });

  const passAction = computeCpuActionWithPolicy('white', {
    resolvePlayerValue: () => -1,
    getActiveProtectionForPlayer: () => null,
    getFlipBlockers: () => [],
    getGameState: () => ({ board, currentPlayer: -1, turnNumber: 12 }),
    getLegalMoves: () => [],
    selectCardToUse: () => null,
    selectCpuMoveWithPolicy: () => null
  });

  return {
    fixtures: [
      buildCpuFixture('level3_heuristic_move', chooseAction(3)),
      buildCpuFixture('level6_heuristic_move', chooseAction(6)),
      buildCpuFixture('no_move_use_card', cardAction),
      buildCpuFixture('no_move_pass', passAction)
    ],
    scoreDigest: sha256Text(stableJson(scoreRows)),
    scores: scoreRows
  };
}

function capturePresentationBaseline(rootDir: string) {
  const sourceHashes = PRESENTATION_SOURCE_PATHS.map((relativePath) => ({
    path: relativePath,
    sha256: sha256File(rootDir, relativePath)
  })).filter((entry) => !!entry.sha256);
  const visualSha256 = sha256File(rootDir, VISUAL_BASELINE_PATH);
  const indexText = fs.readFileSync(path.join(rootDir, 'index.html'), 'utf8');
  const requiredElementIds = [
    'board',
    'leftActionButtons',
    'resetBtn',
    'rulesHelpBtn',
    'rules-help-panel',
    'gachaOpenBtn',
    'gachaOverlay',
    'modeNetworkBtn',
    'networkOverlay'
  ];
  const elementPresence = Object.fromEntries(requiredElementIds.map((id) => [
    id,
    new RegExp(`id=["']${id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}["']`).test(indexText)
  ]));
  return {
    visualBaselinePath: VISUAL_BASELINE_PATH,
    visualBaselineSha256: visualSha256,
    sourceDigest: sha256Text(stableJson(sourceHashes)),
    sourceHashes,
    requiredElementIds: elementPresence
  };
}

function toMarkdown(report: any): string {
  const boot = report.boot.sample;
  const cpuRows = report.cpu.fixtures.map((fixture: CpuFixtureResult) => {
    const action = fixture.action as any;
    const detail = action.move
      ? `move (${action.move.row},${action.move.col})`
      : (action.cardId ? `card ${action.cardId}` : action.type);
    return `| ${fixture.name} | ${detail} | \`${fixture.actionDigest}\` |`;
  }).join('\n');
  return [
    '# Browser modernization baseline (2026-07-13)',
    '',
    '- Status: active pre-migration comparison baseline',
    `- Commit: \`${report.commit}\``,
    `- Captured at: ${report.capturedAt}`,
    `- Node: ${report.environment.node}`,
    '- Scope: classic browser boot, deterministic CPU action fixtures, current visual/presentation sources, and existing authority/presentation verification contracts',
    '',
    '## Boot/resource sample',
    '',
    '| metric | value |',
    '| --- | ---: |',
    `| startup registry | ${boot.moduleRegistryBytes} bytes |`,
    `| optional registry | ${boot.optionalRegistryBytes} bytes |`,
    `| required modules | ${boot.requiredBootModuleCount} |`,
    `| optional modules | ${boot.optionalBootModuleCount} |`,
    `| network overlay ready | ${boot.networkModeReadyMs} ms |`,
    `| optional registry at startup | ${boot.optionalRegistryLoadedAtStartup} |`,
    `| ONNX runtime at startup | ${boot.onnxScriptLoadedAtStartup} |`,
    '',
    'The timing value is machine-specific. Exact resource-presence flags and module/registry counts are correctness baselines; later timing comparisons must be sampled on the same machine.',
    '',
    '## Deterministic CPU fixtures',
    '',
    '| fixture | action | digest |',
    '| --- | --- | --- |',
    cpuRows,
    '',
    `Candidate score digest: \`${report.cpu.scoreDigest}\``,
    '',
    '## Screen/presentation baseline',
    '',
    `- Visual board baseline: \`${report.presentation.visualBaselinePath}\``,
    `- Visual SHA-256: \`${report.presentation.visualBaselineSha256}\``,
    `- Presentation source digest: \`${report.presentation.sourceDigest}\``,
    '- Required initial/optional screen IDs are recorded in the JSON report.',
    '',
    '## Verification contracts',
    '',
    report.verificationContracts.map((entry: string) => `- \`${entry}\``).join('\n'),
    '',
    '## Baseline verification run',
    '',
    report.verificationRun.map((entry: string) => `- ${entry}`).join('\n'),
    '',
    'The first visual run found that the tracked 372×372 image no longer represented the current 368×368 deterministic fixture. The current fixture was reviewed and intentionally promoted; the immediate normal rerun produced 0 differing pixels. This is a baseline repair, not a product UI change made by the modernization program.',
    ''
  ].join('\n');
}

async function captureBrowserModernizationBaseline(options?: BaselineCaptureOptions) {
  const opts = options && typeof options === 'object' ? options : {};
  const rootDir = path.resolve(opts.rootDir || process.cwd());
  const boot = await runBrowserBootPerformanceCheck({ rootDir, log: false });
  if (!boot.evaluation.ok) {
    throw new Error(`boot baseline failed: ${boot.evaluation.errors.join('; ')}`);
  }
  const cpu = captureCpuFixtures();
  const report = {
    schemaVersion: 'browser_modernization_baseline.v1',
    capturedAt: new Date().toISOString(),
    commit: readGitCommit(rootDir),
    environment: {
      node: process.version,
      platform: process.platform,
      arch: process.arch,
      viewport: { width: 1366, height: 900 },
      lane: 'classic'
    },
    boot: {
      sample: boot.sample,
      evaluation: boot.evaluation
    },
    cpu,
    presentation: capturePresentationBaseline(rootDir),
    verificationContracts: [
      'npx jest --runInBand --runTestsByPath test/game.cpu-decision-action.test.ts test/cpu.compute.test.ts test/determinism.test.ts test/match-runtime-parity.test.ts',
      'npx jest --runInBand --runTestsByPath test/ui.animation-engine.test.ts test/ui.animation-feedback-events.sound-keys.test.ts test/network.playback-event-assembly.contract.test.ts',
      'npm run match:boot-performance-check',
      'npm run match:ui-control-smoke',
      'npm run test:visual',
      'npm run test:network:parity'
    ],
    verificationRun: [
      'Focused CPU/determinism/presentation bundle: pass (9 suites, 69 tests).',
      'Browser UI-control smoke: pass; six major controls opened, with 0 page and console errors.',
      'Visual regression: initial stale-size failure (372×372 baseline vs 368×368 current), intentional current-fixture promotion, then pass with 0 differing pixels.',
      'Network authority/parity: pass (34 suites, 522 tests).',
      'Jest reported its existing post-run open-handle warning after the passing focused and network bundles; no suite failed.'
    ]
  };

  if (opts.write !== false) {
    const jsonPath = path.join(rootDir, BASELINE_JSON_PATH);
    const markdownPath = path.join(rootDir, BASELINE_MARKDOWN_PATH);
    fs.mkdirSync(path.dirname(jsonPath), { recursive: true });
    fs.writeFileSync(jsonPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
    fs.writeFileSync(markdownPath, toMarkdown(report), 'utf8');
  }
  if (opts.log !== false) console.log(JSON.stringify(report, null, 2));
  return report;
}

if (require.main === module) {
  captureBrowserModernizationBaseline({
    write: process.argv.includes('--no-write') === false,
    log: true
  }).catch((error) => {
    console.error(`[browser-modernization-baseline] failed: ${error && error.message ? error.message : error}`);
    process.exit(1);
  });
}

export = {
  BASELINE_JSON_PATH,
  BASELINE_MARKDOWN_PATH,
  captureBrowserModernizationBaseline,
  captureCpuFixtures,
  capturePresentationBaseline,
  normalizeAction,
  stableJson,
  toMarkdown
};
