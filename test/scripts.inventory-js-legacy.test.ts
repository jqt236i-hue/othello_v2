import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

const inventory = require('../scripts/inventory-js-legacy');

const MUTATOR_MAINTENANCE_ALLOWLIST: Record<string, string> = {
  'scripts/perf/measure-pr2-v2.ts': 'Reproduces the checked-in PR2 v2 performance report.'
};

const SCRIPT_MUTATOR_PATTERN = /\b(?:writeFileSync|appendFileSync|rmSync|renameSync|unlinkSync|copyFileSync|mkdirSync)\s*\(/;

function collectFiles(root: string, relativeDir: string, extension: string): Array<{ relativePath: string; content: string }> {
  const absoluteDir = path.join(root, relativeDir);
  if (!fs.existsSync(absoluteDir)) return [];
  const files: Array<{ relativePath: string; content: string }> = [];
  for (const entry of fs.readdirSync(absoluteDir, { withFileTypes: true })) {
    const relativePath = path.join(relativeDir, entry.name).replace(/\\/g, '/');
    if (entry.isDirectory()) {
      files.push(...collectFiles(root, relativePath, extension));
    } else if (entry.name.endsWith(extension)) {
      files.push({ relativePath, content: fs.readFileSync(path.join(root, relativePath), 'utf8') });
    }
  }
  return files;
}

describe('JS inventory runtime-authority guard', () => {
  test('retains source checks while leaving frozen CPU runs and built packages untouched', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'source-inventory-'));
    const files = ['game/current.js', 'game/data/runs/current.js', 'data/cpu-lv13/frozen/driver.js',
      'data/runs/experiment/previous-bundle.js', 'output/battle-package/host.js'];
    try {
      for (const file of files) {
        fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
        fs.writeFileSync(path.join(root, file), 'const preserved = true;');
      }
      const found = inventory.collectSourceJsFiles(root).map((file: string) => path.relative(root, file).replace(/\\/g, '/')).sort();
      expect(found).toEqual(['game/current.js', 'game/data/runs/current.js']);
      for (const file of files) expect(fs.readFileSync(path.join(root, file), 'utf8')).toBe('const preserved = true;');
    } finally { fs.rmSync(root, { recursive: true, force: true }); }
  });
  test('classifies the verified pinned Pixi classic artifact as generated output', () => {
    const banner = '/*!\n * PixiJS - v8.18.1\n * Compiled build\n */';

    expect(inventory.classify('public/vendor/pixi-8.18.1.min.js', banner)).toBe('generated');
    expect(inventory.classify('public/vendor/pixi-unsafe-eval-8.18.1.min.js', banner)).toBe('generated');
    expect(inventory.classify('public/vendor/pixi-8.18.2.min.js', banner)).not.toBe('generated');
    expect(inventory.classify('public/vendor/pixi-unsafe-eval-8.18.2.min.js', banner)).not.toBe('generated');
    expect(inventory.classify('public/vendor/pixi-8.18.1.min.js', 'var handWritten = true;')).not.toBe('generated');
    expect(inventory.classify('public/vendor/pixi-unsafe-eval-8.18.1.min.js', 'var handWritten = true;')).not.toBe('generated');
  });

  test('rejects a TypeScript sibling that hides a substantial runtime implementation', () => {
    const content = [
      'function resolveDecision(value) { return value + 1; }',
      'function applyDecision(value) { return resolveDecision(value); }',
      'const value = applyDecision(1);',
      'module.exports = { resolveDecision, applyDecision, value };'
    ].join('\n');

    expect(inventory.isSubstantialRuntimeImplementation(content)).toBe(true);
    expect(inventory.findHiddenRuntimeAuthorities([
      {
        file: 'game/feature.runtime.js',
        category: 'runtime-projection',
        hasTs: true,
        lineCount: 4,
        allowlisted: false,
        allowlistCategory: null,
        content
      }
    ], { entries: {} })).toEqual([
      expect.objectContaining({ file: 'game/feature.runtime.js', reason: 'missing-expiring-authority-allowlist' })
    ]);
  });

  test('permits a thin JavaScript forwarding projection', () => {
    const content = 'module.exports = require("./feature.generated");\n';

    expect(inventory.isSubstantialRuntimeImplementation(content)).toBe(false);
  });

  test('removes all temporary runtime-authority exceptions after the TS migrations', () => {
    const repoRoot = path.resolve(__dirname, '..');
    const allowlist = JSON.parse(fs.readFileSync(
      path.join(repoRoot, 'docs', 'typescript-migration-js-allowlist.json'),
      'utf8'
    ));

    expect(allowlist.entries['game/visual-effects-map.runtime.js']).toBeUndefined();
    expect(allowlist.entries['game/network-turn-handoff.runtime.js']).toBeUndefined();
  });

  test('keeps migrated runtime projections as pure generated-output forwarders', () => {
    const repoRoot = path.resolve(__dirname, '..');
    const expectedDistPaths: Record<string, string> = {
      'network-turn-handoff.runtime.js': '../dist/game/network-turn-handoff',
      'visual-effects-map.runtime.js': '../dist/ui/game-visual-effects-map-compat'
    };

    for (const [file, modulePath] of Object.entries(expectedDistPaths)) {
      const projection = fs.readFileSync(path.join(repoRoot, 'game', file), 'utf8');
      const escapedModulePath = modulePath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      expect(projection).toMatch(new RegExp(`^"use strict";[\\s\\S]*module\\.exports = require\\('${escapedModulePath}'\\);\\s*$`));
      expect(projection).not.toContain('finalizeNetworkTurnHandoff');
      expect(projection).not.toContain('GAME_STONE_VISUAL_EFFECTS');
    }
  });

  test('rejects reintroducing copied nested type trees', () => {
    const repoRoot = path.resolve(__dirname, '..');
    const copiedTypeRoots = [
      'game/src/types',
      'game/cards/src/types',
      'game/logic/src/types'
    ];

    const copiedSourceFiles = copiedTypeRoots.flatMap((relativePath) => {
      const absolutePath = path.join(repoRoot, relativePath);
      if (!fs.existsSync(absolutePath)) return [];
      return fs.readdirSync(absolutePath)
        .filter((name) => /\.(?:ts|js)$/.test(name))
        .map((name) => path.join(relativePath, name));
    });

    expect(copiedSourceFiles).toEqual([]);
  });

  test('rejects reintroducing retired one-off discovery scripts', () => {
    const repoRoot = path.resolve(__dirname, '..');
    const retiredScripts = [
      'find-initdom',
      'find-missing',
      'find-pc',
      'find-reset'
    ];

    for (const name of retiredScripts) {
      expect(fs.existsSync(path.join(repoRoot, 'scripts', `${name}.ts`))).toBe(false);
      expect(fs.existsSync(path.join(repoRoot, 'scripts', `${name}.js`))).toBe(false);
    }
  });

  test('rejects reintroducing retired bootstrap print diagnostics', () => {
    const repoRoot = path.resolve(__dirname, '..');
    const retiredScripts = ['check-bootstrap', 'check-init-factory'];

    for (const name of retiredScripts) {
      expect(fs.existsSync(path.join(repoRoot, 'scripts', `${name}.ts`))).toBe(false);
      expect(fs.existsSync(path.join(repoRoot, 'scripts', `${name}.js`))).toBe(false);
    }
  });

  test('rejects reintroducing retired registry diagnostics', () => {
    const repoRoot = path.resolve(__dirname, '..');
    const retiredScripts = [
      'check-registry-content',
      'check-registry-content2',
      'check-registry-dups',
      'check-registry-dups2',
      'list-registry',
      'validate-new',
      'validate-registry',
      'validate-single'
    ];

    for (const name of retiredScripts) {
      expect(fs.existsSync(path.join(repoRoot, 'scripts', `${name}.ts`))).toBe(false);
      expect(fs.existsSync(path.join(repoRoot, 'scripts', `${name}.js`))).toBe(false);
    }
  });

  test('rejects reintroducing retired direct-output migration mutators', () => {
    const repoRoot = path.resolve(__dirname, '..');
    const retiredScripts = [
      'add-module-tracking',
      'clean-dist-require',
      'convert-ui-to-ts',
      'dedup-require',
      'remove-fn-require',
      'remove-local-require'
    ];

    for (const name of retiredScripts) {
      expect(fs.existsSync(path.join(repoRoot, 'scripts', `${name}.ts`))).toBe(false);
      expect(fs.existsSync(path.join(repoRoot, 'scripts', `${name}.js`))).toBe(false);
    }
  });

  test('rejects reintroducing retired one-off registry debug scripts', () => {
    const repoRoot = path.resolve(__dirname, '..');
    const retiredScripts = [
      'cross-ref-scripts',
      'debug-single',
      'debug-single2',
      'test-json'
    ];

    for (const name of retiredScripts) {
      expect(fs.existsSync(path.join(repoRoot, 'scripts', `${name}.ts`))).toBe(false);
      expect(fs.existsSync(path.join(repoRoot, 'scripts', `${name}.js`))).toBe(false);
    }
  });

  test('rejects copied compiled CommonJS boilerplate in TypeScript source', () => {
    const repoRoot = path.resolve(__dirname, '..');
    const sourceRoots = ['cards', 'constants', 'cpu', 'game', 'scripts', 'shared', 'src', 'training', 'ui', 'utils', 'workers'];
    const compiledBoilerplate = /Object\.defineProperty\(exports,\s*["']__esModule["']/;
    const offenders = sourceRoots.flatMap((sourceRoot) => collectFiles(repoRoot, sourceRoot, '.ts'))
      .filter(({ relativePath, content }) => relativePath !== 'scripts/inventory-js-legacy.ts' && compiledBoilerplate.test(content))
      .map(({ relativePath }) => relativePath);

    expect(offenders).toEqual([]);
  });

  test('requires every direct-output mutator to have an active reference or an explicit maintenance reason', () => {
    const repoRoot = path.resolve(__dirname, '..');
    const mutators = collectFiles(repoRoot, 'scripts', '.ts')
      .filter(({ content }) => SCRIPT_MUTATOR_PATTERN.test(content));
    const activeSources = [
      { relativePath: 'package.json', content: fs.readFileSync(path.join(repoRoot, 'package.json'), 'utf8') },
      ...collectFiles(repoRoot, 'scripts', '.ts'),
      ...collectFiles(repoRoot, 'test', '.ts'),
      ...collectFiles(repoRoot, 'training', '.ts'),
      ...collectFiles(repoRoot, '.github', '.yml'),
      ...collectFiles(repoRoot, '.github', '.yaml')
    ];

    const unreferencedMutators = mutators.filter(({ relativePath }) => {
      const basename = path.basename(relativePath, '.ts');
      const adjacentWrapper = relativePath.replace(/\.ts$/, '.js');
      const hasActiveReference = activeSources.some((source) => (
        source.relativePath !== relativePath
        && source.relativePath !== adjacentWrapper
        && source.content.includes(basename)
      ));
      return !hasActiveReference && !(relativePath in MUTATOR_MAINTENANCE_ALLOWLIST);
    }).map(({ relativePath }) => relativePath);

    const allowlistedMutators = Object.keys(MUTATOR_MAINTENANCE_ALLOWLIST).sort();
    const knownMutators = mutators.map(({ relativePath }) => relativePath).sort();
    expect(allowlistedMutators.every((relativePath) => knownMutators.includes(relativePath))).toBe(true);
    expect(unreferencedMutators).toEqual([]);
  });
});
