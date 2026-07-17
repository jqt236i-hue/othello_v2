import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { inventoryBoardTestSelectors } from '../scripts/check-board-test-selectors';

describe('board browser-test DOM selector inventory', () => {
  let rootDir: string;

  beforeEach(() => {
    rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'board-selector-inventory-'));
  });

  afterEach(() => {
    fs.rmSync(rootDir, { recursive: true, force: true });
  });

  test('reports selector strings and forceFullRender outside the explicit compatibility allowlist', () => {
    fs.mkdirSync(path.join(rootDir, 'scripts'), { recursive: true });
    fs.writeFileSync(
      path.join(rootDir, 'scripts', 'pixi-check.ts'),
      "document.querySelector('#board .cell');\nroot.forceFullRender(board);\nconst value = record.cell;\n"
    );

    const findings = inventoryBoardTestSelectors(rootDir, {
      files: ['scripts/pixi-check.ts'],
      allowlist: {}
    });

    expect(findings.map((finding) => finding.token)).toEqual([
      'board-dom-selector',
      'force-full-render'
    ]);
    expect(findings.every((finding) => finding.allowlisted === false)).toBe(true);
  });

  test('retains the same evidence as an explicitly named DOM compatibility lane', () => {
    fs.mkdirSync(path.join(rootDir, 'test/e2e'), { recursive: true });
    fs.writeFileSync(
      path.join(rootDir, 'test/e2e', 'compat.test.ts'),
      "page.locator('#board .disc');\n"
    );

    const findings = inventoryBoardTestSelectors(rootDir, {
      files: ['test/e2e/compat.test.ts'],
      allowlist: { 'test/e2e/compat.test.ts': 'forced DOM compatibility test' }
    });

    expect(findings).toEqual([
      expect.objectContaining({
        token: 'board-dom-selector',
        allowlisted: true,
        reason: 'forced DOM compatibility test'
      })
    ]);
  });
});
