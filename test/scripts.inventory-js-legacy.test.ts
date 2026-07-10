import * as fs from 'fs';
import * as path from 'path';

const inventory = require('../scripts/inventory-js-legacy');

describe('JS inventory runtime-authority guard', () => {
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
});
