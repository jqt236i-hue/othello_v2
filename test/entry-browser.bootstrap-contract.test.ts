import * as fs from 'fs';
import * as path from 'path';

describe('entry-browser bootstrap contract', () => {
  test('top-level boot modules use a required/optional failure handler', () => {
    const entryPath = path.resolve(__dirname, '..', 'entry-browser.js');
    const text = fs.readFileSync(entryPath, 'utf8');
    const topLevelSection = text.slice(0, text.indexOf('// ===== Namespace globals for module resolution ====='));

    expect(text).toContain('function getBootModuleClass');
    expect(text).toContain('function requireBootModule');
    expect(text).toContain('function handleBootModuleError');
    expect(topLevelSection).toContain('handleBootModuleError("dist/shared-constants", e)');
    expect(topLevelSection).toContain('handleBootModuleError("dist/game/logic/core", e)');
    expect(topLevelSection).toContain('handleBootModuleError("dist/ui/bootstrap", e)');
    expect(topLevelSection).toContain('handleBootModuleError("dist/ui/debug-card-search", e)');
    expect(topLevelSection).toMatch(/throw\s+err/);
  });

  test('namespace globals use required diagnostic loader instead of silent catches', () => {
    const entryPath = path.resolve(__dirname, '..', 'entry-browser.js');
    const text = fs.readFileSync(entryPath, 'utf8');
    const start = text.indexOf('// ===== Namespace globals for module resolution =====');
    const end = text.indexOf('// ===== Direct namespace assignments from module variables =====');

    expect(start).toBeGreaterThanOrEqual(0);
    expect(end).toBeGreaterThan(start);

    const namespaceSection = text.slice(start, end);
    expect(text).toContain('function requireBootNamespace');
    expect(namespaceSection).toContain('requireBootNamespace("CardCatalog", "./dist/cards/catalog")');
    expect(namespaceSection).not.toMatch(/catch\s*\([^)]*\)\s*\{\s*\}/);
    expect(namespaceSection).not.toMatch(/catch\s*\([^)]*\)\s*\{\s*\/\*\s*ignore\s*\*\/\s*\}/);
  });
});
