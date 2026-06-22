import * as fs from 'fs';
import * as path from 'path';
import * as vm from 'vm';

function loadBootHelpers() {
  const entryPath = path.resolve(__dirname, '..', 'entry-browser.js');
  const text = fs.readFileSync(entryPath, 'utf8');
  const helperStart = 0;
  const helperEnd = text.indexOf('var gameState;');
  const namespaceStart = text.indexOf('function requireBootNamespace');
  const namespaceEnd = text.indexOf('// ===== Namespace globals for module resolution =====');
  const source = [
    text.slice(helperStart, helperEnd),
    text.slice(namespaceStart, namespaceEnd)
  ].join('\n');
  const context: any = {
    window: {
      require: jest.fn()
    },
    console: {
      warn: jest.fn(),
      error: jest.fn()
    },
    require: jest.fn()
  };
  context.window.require = context.require;
  vm.runInNewContext(source, context);
  return context;
}

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

  test('runtime optional prefix metadata matches generated classifier semantics', () => {
    const context = loadBootHelpers();
    context.window.__CARD_REVERSI_BOOT_MODULES__ = {
      required: [],
      optional: [],
      optionalPrefixes: ['ui/debug', 'ui/leaderboard', 'ui/background-skin/']
    };

    expect(context.getBootModuleClass('dist/ui/debug-card-search')).toBe('optional');
    expect(context.getBootModuleClass('./dist/ui/leaderboard-client.js')).toBe('optional');
    expect(context.getBootModuleClass('dist/ui/background-skin/controller')).toBe('optional');
    expect(context.getBootModuleClass('dist/ui/bootstrap')).toBe('required');
  });

  test('optional namespace restore warns and continues while required namespace still throws', () => {
    const context = loadBootHelpers();
    context.window.__CARD_REVERSI_BOOT_MODULES__ = {
      required: ['ui/bootstrap'],
      optional: [],
      optionalPrefixes: ['ui/background-skin/']
    };
    context.require.mockImplementation(() => {
      throw new Error('missing module');
    });

    expect(context.requireBootNamespace('BackgroundSkinControllerModule', './dist/ui/background-skin/controller')).toBeNull();
    expect(context.console.warn).toHaveBeenCalledWith(expect.stringContaining('[boot] skip optional namespace BackgroundSkinControllerModule'));
    expect(() => context.requireBootNamespace('UiBootstrapModule', './dist/ui/bootstrap')).toThrow('missing module');
    expect(context.console.error).toHaveBeenCalledWith(expect.stringContaining('[boot] required namespace UiBootstrapModule'));
  });
});
