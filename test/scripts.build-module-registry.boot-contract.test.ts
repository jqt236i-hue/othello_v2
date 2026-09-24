const {
  buildRegistry,
  classifyBrowserBootModule,
  classifyBrowserOptionalGroup
} = require('../scripts/build-module-registry');
const fs = require('fs');
const os = require('os');
const path = require('path');
const vm = require('vm');

function writeFile(filePath, content) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content, 'utf8');
}

describe('browser module registry boot contract', () => {
  test('classifies core gameplay and bootstrap modules as required', () => {
    expect(classifyBrowserBootModule('dist/shared-constants')).toBe('required');
    expect(classifyBrowserBootModule('./dist/cards/catalog.js')).toBe('required');
    expect(classifyBrowserBootModule('game/logic/core')).toBe('required');
    expect(classifyBrowserBootModule('dist/game/logic/cards')).toBe('required');
    expect(classifyBrowserBootModule('dist/game/turn/turn_pipeline')).toBe('required');
    expect(classifyBrowserBootModule('dist/ui/bootstrap')).toBe('required');
    expect(classifyBrowserBootModule('dist/ui/network-client')).toBe('required');
    expect(classifyBrowserBootModule('dist/ui/board-renderer')).toBe('required');
    expect(classifyBrowserBootModule('dist/ui/presentation-handler')).toBe('required');
    expect(classifyBrowserBootModule('dist/ui/debug-card-search')).toBe('required');
    expect(classifyBrowserBootModule('dist/ui/handlers/debug')).toBe('required');
    expect(classifyBrowserBootModule('dist/ui/handlers/hand-skin')).toBe('required');
    expect(classifyBrowserBootModule('dist/ui/cosmetics/catalog-shared')).toBe('required');
    expect(classifyBrowserBootModule('dist/ui/hand-skin/catalog')).toBe('required');
    expect(classifyBrowserBootModule('dist/ui/hand-skin/selection')).toBe('required');
    expect(classifyBrowserBootModule('dist/ui/hand-skin/runtime')).toBe('required');
  });

  test('classifies diagnostics, cosmetics, and heavyweight optional modules as optional', () => {
    expect(classifyBrowserBootModule('dist/ui/debug-test-scenarios')).toBe('required');
    expect(classifyBrowserBootModule('dist/ui/background-skin/controller')).toBe('optional');
    expect(classifyBrowserBootModule('dist/ui/font-skin/controller')).toBe('optional');
    expect(classifyBrowserBootModule('dist/ui/hand-skin/controller')).toBe('optional');
    expect(classifyBrowserBootModule('dist/game/ai/policy-onnx-runtime')).toBe('optional');
    expect(classifyBrowserBootModule('dist/ui/gacha/gacha-overlay-controller')).toBe('optional');
    expect(classifyBrowserBootModule('node_modules/onnxruntime-web/dist/ort.min')).toBe('optional');
  });

  test('assigns optional modules to one canonical feature owner with required overrides', () => {
    expect(classifyBrowserOptionalGroup('ui/gacha/gacha-overlay-controller')).toBe('gacha');
    expect(classifyBrowserOptionalGroup('ui/background-skin/controller')).toBe('cosmetic');
    expect(classifyBrowserOptionalGroup('ui/leaderboard-client')).toBe('leaderboard');
    expect(classifyBrowserOptionalGroup('othello-ai/runtime/browser-cpu')).toBe('cpu');
    expect(classifyBrowserOptionalGroup('game/ai/policy-onnx-runtime')).toBe('onnx');
    expect(classifyBrowserOptionalGroup('ui/hand-skin/catalog')).toBeNull();
    expect(classifyBrowserOptionalGroup('shared/gacha-helpers')).toBeNull();
  });

  test('emits sorted boot metadata in generated registry content', () => {
    const result = buildRegistry({ write: false, log: false, syncScriptVersions: false });

    expect(result && result.content).toContain('window.__CARD_REVERSI_BOOT_MODULES__');
    expect(result && result.content).toContain('"ui/bootstrap"');
    expect(result && result.content).toContain('"game/logic/core"');
    expect(result && result.content).toContain('"ui/debug-card-search"');
  });

  test('group metadata merges without replacing startup required classification', () => {
    const result = buildRegistry({ write: false, log: false, syncScriptVersions: false });
    const context: any = {
      window: {
        __cjsRegister: jest.fn(),
        __cjsAlias: jest.fn()
      }
    };

    vm.runInNewContext(result.startupContent, context);
    const requiredBefore = context.window.__CARD_REVERSI_BOOT_MODULES__.required.slice();
    vm.runInNewContext(result.groupContents.gacha, context);

    expect(requiredBefore).toContain('ui/bootstrap');
    expect(context.window.__CARD_REVERSI_BOOT_MODULES__.required).toEqual(requiredBefore);
    expect(context.window.__CARD_REVERSI_BOOT_MODULES__.optionalGroups.gacha)
      .toContain('ui/gacha/gacha-overlay-controller');
    expect(context.window.__CARD_REVERSI_BOOT_MODULES__.optional)
      .toContain('ui/gacha/gacha-overlay-controller');
  });

  test('separates startup registry from lazy optional registry content', () => {
    const result = buildRegistry({ write: false, log: false, syncScriptVersions: false });

    expect(result && result.startupContent).toContain('_r("ui/network-client"');
    expect(result && result.startupContent).toContain('_r("ui/network/publish-flow"');
    expect(result && result.startupContent).not.toContain('_r("game/ai/policy-onnx-runtime"');
    expect(result && result.startupContent).not.toContain('_r("ui/gacha/gacha-overlay-controller"');
    expect(result && result.optionalContent).toContain('_r("game/ai/policy-onnx-runtime"');
    expect(result && result.optionalContent).toContain('_r("ui/gacha/gacha-overlay-controller"');
    expect(result && result.groupContents.gacha).toContain('_r("ui/gacha/gacha-overlay-controller"');
    expect(result && result.groupContents.gacha).not.toContain('_r("ui/background-skin/controller"');
    expect(result && result.groupContents.cosmetic).toContain('_r("ui/background-skin/controller"');
    expect(result && result.startupContent).toContain('_r("ui/gacha/gacha-events"');
    expect(result && result.groupContents.cosmetic).not.toContain('_r("ui/gacha/gacha-events"');
    expect(result && result.groupContents.leaderboard).toContain('_r("ui/leaderboard-client"');
    expect(result && result.groupContents.cpu).toContain('_r("othello-ai/runtime/browser-cpu"');
    expect(result && result.groupContents.onnx).toContain('_r("game/ai/policy-onnx-runtime"');
    expect(result && result.groupContents.onnx).not.toContain('policy-onnx-runtime-v2');
    // Lv10+ search is bundled only into its dedicated Worker entries.
    const allContent = [result && result.startupContent, result && result.optionalContent].join('\n');
    for (const name of ['cpu-lv10-search', 'cpu-lv11-search', 'cpu-lv11-evaluation', 'cpu-lv12-search', 'cpu-lv12-evaluation', 'cpu-lv12-model', 'cpu-lv12-scenarios']) {
      expect(allContent).not.toContain(`_r("game/ai/${name}"`);
    }
    expect(result && result.startupContent).toContain('_r("game/ai/cpu-lv10-position"');
  });

  test('writes startup and optional registry files when split output is enabled', () => {
    const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'browser-registry-split-'));
    try {
      writeFile(path.join(rootDir, 'dist', 'ui', 'network-client.js'), 'module.exports = { network: true };\n');
      writeFile(path.join(rootDir, 'dist', 'ui', 'network', 'publish-flow.js'), 'module.exports = { publish: true };\n');
      writeFile(path.join(rootDir, 'dist', 'game', 'ai', 'policy-onnx-runtime.js'), 'module.exports = { onnx: true };\n');
      writeFile(path.join(rootDir, 'dist', 'ui', 'gacha', 'gacha-overlay-controller.js'), 'module.exports = { gacha: true };\n');
      writeFile(path.join(rootDir, 'ui', 'network-client.ts'), 'export = {};\n');
      writeFile(path.join(rootDir, 'ui', 'network', 'publish-flow.ts'), 'export = {};\n');
      writeFile(path.join(rootDir, 'game', 'ai', 'policy-onnx-runtime.ts'), 'export = {};\n');
      writeFile(path.join(rootDir, 'ui', 'gacha', 'gacha-overlay-controller.ts'), 'export = {};\n');

      const result = buildRegistry({
        rootDir,
        log: false,
        syncScriptVersions: false,
        splitRegistries: true
      });

      const startupPath = path.join(rootDir, 'public', 'module-registry.js');
      const optionalPath = path.join(rootDir, 'public', 'module-registry.optional.js');
      const gachaPath = path.join(rootDir, 'public', 'module-registry.optional.gacha.js');
      const onnxPath = path.join(rootDir, 'public', 'module-registry.optional.onnx.js');
      const startup = fs.readFileSync(startupPath, 'utf8');
      const optional = fs.readFileSync(optionalPath, 'utf8');
      const gacha = fs.readFileSync(gachaPath, 'utf8');
      const onnx = fs.readFileSync(onnxPath, 'utf8');

      expect(result && result.outFile).toBe(startupPath);
      expect(result && result.optionalOutFile).toBe(optionalPath);
      expect(startup).toContain('_r("ui/network-client"');
      expect(startup).toContain('_r("ui/network/publish-flow"');
      expect(startup).not.toContain('_r("game/ai/policy-onnx-runtime"');
      expect(startup).not.toContain('_r("ui/gacha/gacha-overlay-controller"');
      expect(optional).toContain('_r("game/ai/policy-onnx-runtime"');
      expect(optional).toContain('_r("ui/gacha/gacha-overlay-controller"');
      expect(gacha).toContain('_r("ui/gacha/gacha-overlay-controller"');
      expect(gacha).not.toContain('_r("game/ai/policy-onnx-runtime"');
      expect(onnx).toContain('_r("game/ai/policy-onnx-runtime"');
    } finally {
      fs.rmSync(rootDir, { recursive: true, force: true });
    }
  });

  test('fails generation when an optional group has an unresolved local dependency', () => {
    const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'browser-registry-unresolved-'));
    try {
      writeFile(path.join(rootDir, 'dist', 'ui', 'gacha', 'gacha-overlay-controller.js'), "module.exports = require('./missing-local');\n");
      writeFile(path.join(rootDir, 'ui', 'gacha', 'gacha-overlay-controller.ts'), 'export = {};\n');

      expect(() => buildRegistry({
        rootDir,
        write: false,
        log: false,
        syncScriptVersions: false
      })).toThrow(/gacha-overlay-controller -> \.\/missing-local/);
    } finally {
      fs.rmSync(rootDir, { recursive: true, force: true });
    }
  });

  test('excludes stale dist output whose root source was removed', () => {
    const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'browser-registry-stale-dist-'));
    try {
      writeFile(path.join(rootDir, 'dist', 'game', 'retired-browser-module.js'), 'module.exports = { retired: true };\n');

      const result = buildRegistry({ rootDir, write: false, log: false, syncScriptVersions: false });

      expect(result && result.content).not.toContain('_r("game/retired-browser-module"');
    } finally {
      fs.rmSync(rootDir, { recursive: true, force: true });
    }
  });
});
