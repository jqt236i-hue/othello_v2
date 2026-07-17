import * as fs from 'fs';
import * as path from 'path';

type SelectorFinding = Readonly<{
  file: string;
  line: number;
  token: 'board-dom-selector' | 'force-full-render';
  source: string;
  allowlisted: boolean;
  reason: string | null;
}>;

const SOURCE_EXTENSIONS = new Set(['.ts', '.js', '.mjs', '.cjs']);
const SCAN_ROOTS = Object.freeze([
  'scripts',
  'test/e2e',
  'tests/visual-regression'
]);
const SELF_PATH = 'scripts/check-board-test-selectors.ts';

/**
 * Phase 8 compatibility inventory. Every entry is an explicit DOM-only lane;
 * Phase 10 moves/removes these while isolating `ui/board-dom-compat/`.
 */
const DOM_COMPATIBILITY_ALLOWLIST: Readonly<Record<string, string>> = Object.freeze({
  'scripts/capture-pixijs-playfield-baseline.ts': 'pre-cutover DOM/Pixi A/B evidence and legacy DOM microbenchmark',
  'scripts/pixijs-runtime-fallback-browser-check.ts': 'forced DOM compatibility fallback browser scenario',
  'scripts/perf/measure-pr2-v2.ts': 'archived DOM renderer PR2 performance probe',
  'test/e2e/reset_click.e2e.test.ts': 'legacy DOM-default compatibility E2E pending Phase 10 isolation',
  'test/e2e/destroy_hand_click.e2e.test.ts': 'legacy DOM-default compatibility E2E pending Phase 10 isolation',
  'test/e2e/cpu_level_diff.e2e.test.ts': 'legacy DOM-default compatibility E2E pending Phase 10 isolation',
  'test/e2e/cpu_auto_response.e2e.test.ts': 'legacy DOM-default compatibility E2E pending Phase 10 isolation',
  'test/e2e/multi_turn_progression.e2e.test.ts': 'legacy DOM-default compatibility E2E pending Phase 10 isolation'
});

function normalizeRelative(value: string): string {
  return value.replace(/\\/g, '/').replace(/^\.\//, '');
}

function walkFiles(rootDir: string, relativeRoot: string): string[] {
  const absoluteRoot = path.resolve(rootDir, relativeRoot);
  if (!fs.existsSync(absoluteRoot)) return [];
  const output: string[] = [];
  const visit = (directory: string) => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const absolute = path.join(directory, entry.name);
      if (entry.isDirectory()) visit(absolute);
      else if (entry.isFile() && SOURCE_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) {
        output.push(normalizeRelative(path.relative(rootDir, absolute)));
      }
    }
  };
  visit(absoluteRoot);
  return output;
}

function lineHasBoardDomSelector(line: string): boolean {
  // Restrict matching to selector-like string/template literals. Property
  // access such as `record.cell` is not a DOM dependency.
  const literals = line.match(/(["'`])(?:\\.|(?!\1).)*\1/g) || [];
  return literals.some((literal) => /\.(?:cell|disc)(?![A-Za-z0-9_-])/.test(literal));
}

export function inventoryBoardTestSelectors(
  rootDir: string,
  options?: { files?: readonly string[]; allowlist?: Readonly<Record<string, string>> }
): readonly SelectorFinding[] {
  const allowlist = options?.allowlist || DOM_COMPATIBILITY_ALLOWLIST;
  const files = options?.files
    ? Array.from(options.files, normalizeRelative)
    : SCAN_ROOTS.flatMap((relativeRoot) => walkFiles(rootDir, relativeRoot));
  const findings: SelectorFinding[] = [];
  for (const file of Array.from(new Set(files)).sort()) {
    if (file === SELF_PATH) continue;
    const absolute = path.resolve(rootDir, file);
    if (!fs.existsSync(absolute)) continue;
    const reason = allowlist[file] || null;
    const lines = fs.readFileSync(absolute, 'utf8').split(/\r?\n/);
    lines.forEach((source, index) => {
      const tokens: SelectorFinding['token'][] = [];
      if (/\bforceFullRender\b/.test(source)) tokens.push('force-full-render');
      if (lineHasBoardDomSelector(source)) tokens.push('board-dom-selector');
      for (const token of tokens) {
        findings.push(Object.freeze({
          file,
          line: index + 1,
          token,
          source: source.trim(),
          allowlisted: !!reason,
          reason
        }));
      }
    });
  }
  return Object.freeze(findings);
}

export function runBoardTestSelectorCheck(rootDir = path.resolve(__dirname, '..', '..')): Readonly<{
  findings: readonly SelectorFinding[];
  violations: readonly SelectorFinding[];
}> {
  const findings = inventoryBoardTestSelectors(rootDir);
  const violations = Object.freeze(findings.filter((finding) => !finding.allowlisted));
  const allowlisted = findings.filter((finding) => finding.allowlisted);
  console.log(`[board-test-selectors] default/pixi violations=${violations.length} compatibility entries=${allowlisted.length}`);
  for (const finding of allowlisted) {
    console.log(`[board-test-selectors] allow ${finding.file}:${finding.line} ${finding.token} — ${finding.reason}`);
  }
  if (violations.length) {
    for (const finding of violations) {
      console.error(`[board-test-selectors] violation ${finding.file}:${finding.line} ${finding.token}: ${finding.source}`);
    }
    throw new Error(`Board DOM selector inventory found ${violations.length} default/Pixi test dependencies`);
  }
  return Object.freeze({ findings, violations });
}

if (require.main === module) {
  try {
    runBoardTestSelectorCheck();
  } catch (error) {
    console.error(`[board-test-selectors] failed: ${error instanceof Error ? error.message : error}`);
    process.exit(1);
  }
}
