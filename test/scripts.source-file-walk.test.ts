import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import { collectSourceFiles } from '../scripts/lib/source-file-walk';
import { checkJsSyntax, collectJsSyntaxTargets } from '../scripts/check-js-syntax';

const inventory = require('../scripts/inventory-js-legacy');

function write(root: string, relativePath: string, content = 'const preserved = true;\n'): void {
  const target = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, content);
}

function link(target: string, linkPath: string): void {
  fs.mkdirSync(path.dirname(linkPath), { recursive: true });
  fs.symlinkSync(target, linkPath, 'junction');
}

function relativeSorted(root: string, files: string[]): string[] {
  return files.map((file) => path.relative(root, file).replace(/\\/g, '/')).sort();
}

describe('repository check file enumeration (links are never followed)', () => {
  let sandbox: string;
  let root: string;
  let external: string;

  beforeEach(() => {
    sandbox = fs.mkdtempSync(path.join(os.tmpdir(), 'source-walk-'));
    root = path.join(sandbox, 'repo');
    external = path.join(sandbox, 'external-data');
    fs.mkdirSync(root, { recursive: true });
    write(external, 'runs/huge-bundle.js', 'this is not javascript (((');
    write(external, 'nested/deep/model.js', 'external();\n');

    write(root, 'entry.js');
    write(root, 'game/current.js');
    write(root, 'game/data/runs/current.js');
    write(root, 'src/output/normal-source.js');
    write(root, 'scripts/tool.mjs', 'export const value = 1;\n');
    write(root, 'scripts/legacy.cjs', 'module.exports = 1;\nreturn;\n');
    // Same names as external data roots, but stored as regular directories in this checkout.
    write(root, 'data/cpu-lv13/frozen/driver.js', 'this frozen opponent is not parsed (((');
    write(root, 'data/runs/experiment/previous-bundle.js', 'old bundle (((');
    write(root, 'dist/compiled.js', 'compiled (((');
    // Large-looking fixture under a generated root.
    write(root, 'worker-public/vite-dist/assets/index.js', 'x'.repeat(256 * 1024));

    // Junction to an external data root and a cycle back to the checkout root.
    link(path.join(external, 'runs'), path.join(root, 'output'));
    link(path.join(external, 'nested'), path.join(root, 'game', 'linked-data'));
    link(root, path.join(root, 'game', 'cycle'));
  });

  afterEach(() => {
    fs.rmSync(sandbox, { recursive: true, force: true });
  });

  test('collects each regular file once without entering links, even with overlapping starts', () => {
    const visitedDirs: string[] = [];
    const files = collectSourceFiles(['.', 'game', 'game/data', 'scripts'], {
      root,
      includeFile: (_relativePath, name) => name.endsWith('.js'),
      onDirectory: (dir) => visitedDirs.push(path.resolve(dir))
    });
    const found = relativeSorted(root, files);
    expect(found).toEqual(Array.from(new Set(found)));
    expect(found).toEqual(expect.arrayContaining(['entry.js', 'game/current.js', 'game/data/runs/current.js', 'src/output/normal-source.js']));
    expect(found.some((file) => file.startsWith('output/') || file.includes('linked-data') || file.includes('cycle'))).toBe(false);
    expect(visitedDirs.some((dir) => dir.startsWith(external))).toBe(false);
    expect(visitedDirs.some((dir) => dir.includes('linked-data') || dir.includes('cycle') || dir === path.join(root, 'output'))).toBe(false);
    expect(visitedDirs.filter((dir) => dir === path.join(root, 'game'))).toHaveLength(1);
    expect(new Set(visitedDirs).size).toBe(visitedDirs.length);
  });

  test('JS inventory keeps its classification scope, excludes evidence roots, and does not read link targets', () => {
    const found = relativeSorted(root, inventory.collectSourceJsFiles(root));
    expect(found).toEqual([
      'entry.js',
      'game/current.js',
      'game/data/runs/current.js',
      'src/output/normal-source.js'
    ]);
    expect(fs.readFileSync(path.join(root, 'data/cpu-lv13/frozen/driver.js'), 'utf8')).toBe('this frozen opponent is not parsed (((');
  });

  test('JS syntax check targets source JS/CJS/MJS only and parses each with its module system', () => {
    const targets = relativeSorted(root, collectJsSyntaxTargets(root));
    expect(targets).toEqual([
      'entry.js',
      'game/current.js',
      'game/data/runs/current.js',
      'scripts/legacy.cjs',
      'scripts/tool.mjs',
      'src/output/normal-source.js'
    ]);
    const result = checkJsSyntax(root);
    // CommonJS top-level return and ESM export both parse; nothing from data/dist/links is read.
    expect(result.errors).toEqual([]);

    write(root, 'game/broken.js', 'function (\n');
    write(root, 'scripts/broken.mjs', 'export const = 1;\n');
    write(root, 'scripts/esm-in-cjs.js', 'export const value = 1;\n');
    const broken = checkJsSyntax(root);
    expect(broken.errors.map((error) => error.file).sort()).toEqual(['game/broken.js', 'scripts/broken.mjs', 'scripts/esm-in-cjs.js']);
  });
});
