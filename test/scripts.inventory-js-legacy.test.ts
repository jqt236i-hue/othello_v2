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

  test('requires owner and removal phase for the remaining temporary runtime-authority exception', () => {
    const repoRoot = path.resolve(__dirname, '..');
    const allowlist = JSON.parse(fs.readFileSync(
      path.join(repoRoot, 'docs', 'typescript-migration-js-allowlist.json'),
      'utf8'
    ));

    for (const file of ['game/visual-effects-map.runtime.js']) {
      expect(allowlist.entries[file]).toEqual(expect.objectContaining({
        category: 'runtime-projection',
        owner: 'game-runtime-authority-refactor',
        removalPhase: 'Phase 2.3'
      }));
    }
  });

  test('keeps the migrated handoff projection as a pure generated-output forwarder', () => {
    const repoRoot = path.resolve(__dirname, '..');
    const projection = fs.readFileSync(
      path.join(repoRoot, 'game', 'network-turn-handoff.runtime.js'),
      'utf8'
    );

    expect(projection).toMatch(/^"use strict";[\s\S]*module\.exports = require\('\.\.\/dist\/game\/network-turn-handoff'\);\s*$/);
    expect(projection).not.toContain('finalizeNetworkTurnHandoff');
  });
});
