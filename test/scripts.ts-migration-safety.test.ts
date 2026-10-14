import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as ts from 'typescript';

import { TS_SCAN_ROOTS, collectTsMigrationTargets, evaluateTsMigrationSafety } from '../scripts/check-ts-migration-safety';
import { scanNoCheckDirective } from '../scripts/lib/ts-nocheck-directive';

function typeScriptDisablesChecking(source: string): boolean {
  const sourceFile = ts.createSourceFile('fixture.ts', source.replace(/^﻿/, ''), ts.ScriptTarget.Latest, false) as ts.SourceFile & {
    checkJsDirective?: { enabled: boolean };
  };
  return !!sourceFile.checkJsDirective && sourceFile.checkJsDirective.enabled === false;
}

describe('@ts-nocheck directive detection follows TypeScript', () => {
  const longHeader = Array.from({ length: 12 }, (_, index) => `// header line ${index + 1}`).join('\n');

  test.each([
    ['first line', '// @ts-nocheck\nexport const value = 1;\n', true],
    ['after a long header comment', `${longHeader}\n// @ts-nocheck\nexport const value: number = 'x' as any;\n`, true],
    ['after a BOM', '﻿// @ts-nocheck\nexport const value = 1;\n', true],
    ['after a shebang', '#!/usr/bin/env node\n// @ts-nocheck\nconsole.log(1);\n', true],
    ['after a block comment in the header', '/* license */\n// @ts-nocheck\nexport {};\n', true],
    ['inside a block comment only', '/* @ts-nocheck */\nexport {};\n', false],
    ['mentioned in a string', "const text = '// @ts-nocheck';\nexport { text };\n", false],
    ['mentioned in a later comment', 'export const value = 1;\n// @ts-nocheck\n', false],
    ['mentioned in prose inside a header comment', '// Do not add @ts-nocheck to this file.\nexport {};\n', false],
    ['re-enabled by a later @ts-check', '// @ts-nocheck\n// @ts-check\nexport {};\n', false]
  ])('%s', (_label, source, expected) => {
    expect(scanNoCheckDirective(source).active).toBe(expected);
    expect(typeScriptDisablesChecking(source)).toBe(expected);
  });

  test('counts duplicate directives in the header', () => {
    expect(scanNoCheckDirective('// @ts-nocheck\n// @ts-nocheck\nexport {};\n')).toEqual({ active: true, count: 2 });
  });
});

describe('check-ts-migration-safety scope', () => {
  let root: string;

  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'ts-migration-safety-'));
  });

  afterEach(() => {
    fs.rmSync(root, { recursive: true, force: true });
  });

  function write(relativePath: string, content: string): void {
    const target = path.join(root, relativePath);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, content);
  }

  test('covers every canonical TypeScript root, test roots, and root-level sources', () => {
    for (const scanRoot of ['shared', 'constants', 'browser-vite', 'game', 'test', 'training', 'workers']) {
      expect(TS_SCAN_ROOTS).toContain(scanRoot);
    }
    const header = Array.from({ length: 8 }, (_, index) => `// comment ${index}`).join('\n');
    write('shared/a.ts', `${header}\n// @ts-nocheck\nexport {};\n`);
    write('constants/b.ts', '// @ts-nocheck\nexport {};\n');
    write('browser-vite/c.ts', '﻿// @ts-nocheck\nexport {};\n');
    write('top-level.ts', '#!/usr/bin/env node\n// @ts-nocheck\nexport {};\n');
    write('training/scripts/d.ts', "const note = '@ts-nocheck is forbidden';\nexport { note };\n");
    write('dist/shared/a.ts', '// @ts-nocheck\n');
    write('node_modules/pkg/index.ts', '// @ts-nocheck\n');

    const result = evaluateTsMigrationSafety(root, new Set());
    expect(result.unauthorized.sort()).toEqual(['browser-vite/c.ts', 'constants/b.ts', 'shared/a.ts', 'top-level.ts']);
    expect(collectTsMigrationTargets(root)).not.toEqual(expect.arrayContaining(['dist/shared/a.ts']));
  });

  test('reports duplicates and stale allowlist entries', () => {
    write('game/dup.ts', '// @ts-nocheck\n// @ts-nocheck\nexport {};\n');
    const result = evaluateTsMigrationSafety(root, new Set(['game/dup.ts', 'game/removed.ts']));
    expect(result.unauthorized).toEqual([]);
    expect(result.duplicateDirectives).toEqual([{ file: 'game/dup.ts', count: 2 }]);
    expect(result.staleAllowlist).toEqual(['game/removed.ts']);
  });

  test('the current checkout has no unauthorized suppression and the high-risk allowlist stays empty', () => {
    const repoRoot = path.resolve(__dirname, '..');
    const result = evaluateTsMigrationSafety(repoRoot);
    expect(result.unauthorized).toEqual([]);
    expect(result.duplicateDirectives).toEqual([]);
    const refactorSafety = fs.readFileSync(path.join(repoRoot, 'scripts', 'check-refactor-safety.ts'), 'utf8');
    expect(refactorSafety).toMatch(/const existingNoCheckDebt = new Set<string>\(\);/);
  });
});
