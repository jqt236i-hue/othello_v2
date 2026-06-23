const {
  buildRegistry,
  classifyBrowserBootModule
} = require('../scripts/build-module-registry');
const fs = require('fs');
const os = require('os');
const path = require('path');

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
  });

  test('classifies diagnostics, cosmetics, and heavyweight optional modules as optional', () => {
    expect(classifyBrowserBootModule('dist/ui/debug-test-scenarios')).toBe('optional');
    expect(classifyBrowserBootModule('dist/ui/background-skin/controller')).toBe('optional');
    expect(classifyBrowserBootModule('dist/ui/font-skin/controller')).toBe('optional');
    expect(classifyBrowserBootModule('dist/game/ai/policy-onnx-runtime')).toBe('optional');
    expect(classifyBrowserBootModule('dist/ui/gacha/gacha-overlay-controller')).toBe('optional');
    expect(classifyBrowserBootModule('node_modules/onnxruntime-web/dist/ort.min')).toBe('optional');
  });

  test('emits sorted boot metadata in generated registry content', () => {
    const result = buildRegistry({ write: false, log: false, syncScriptVersions: false });

    expect(result && result.content).toContain('window.__CARD_REVERSI_BOOT_MODULES__');
    expect(result && result.content).toContain('"ui/bootstrap"');
    expect(result && result.content).toContain('"game/logic/core"');
    expect(result && result.content).toContain('"ui/debug-card-search"');
  });

  test('separates startup registry from lazy optional registry content', () => {
    const result = buildRegistry({ write: false, log: false, syncScriptVersions: false });

    expect(result && result.startupContent).toContain('_r("ui/network-client"');
    expect(result && result.startupContent).toContain('_r("ui/network/publish-flow"');
    expect(result && result.startupContent).not.toContain('_r("game/ai/policy-onnx-runtime"');
    expect(result && result.startupContent).not.toContain('_r("ui/gacha/gacha-overlay-controller"');
    expect(result && result.optionalContent).toContain('_r("game/ai/policy-onnx-runtime"');
    expect(result && result.optionalContent).toContain('_r("ui/gacha/gacha-overlay-controller"');
  });

  test('writes startup and optional registry files when split output is enabled', () => {
    const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'browser-registry-split-'));
    try {
      writeFile(path.join(rootDir, 'dist', 'ui', 'network-client.js'), 'module.exports = { network: true };\n');
      writeFile(path.join(rootDir, 'dist', 'ui', 'network', 'publish-flow.js'), 'module.exports = { publish: true };\n');
      writeFile(path.join(rootDir, 'dist', 'game', 'ai', 'policy-onnx-runtime.js'), 'module.exports = { onnx: true };\n');
      writeFile(path.join(rootDir, 'dist', 'ui', 'gacha', 'gacha-overlay-controller.js'), 'module.exports = { gacha: true };\n');

      const result = buildRegistry({
        rootDir,
        log: false,
        syncScriptVersions: false,
        splitRegistries: true
      });

      const startupPath = path.join(rootDir, 'public', 'module-registry.js');
      const optionalPath = path.join(rootDir, 'public', 'module-registry.optional.js');
      const startup = fs.readFileSync(startupPath, 'utf8');
      const optional = fs.readFileSync(optionalPath, 'utf8');

      expect(result && result.outFile).toBe(startupPath);
      expect(result && result.optionalOutFile).toBe(optionalPath);
      expect(startup).toContain('_r("ui/network-client"');
      expect(startup).toContain('_r("ui/network/publish-flow"');
      expect(startup).not.toContain('_r("game/ai/policy-onnx-runtime"');
      expect(startup).not.toContain('_r("ui/gacha/gacha-overlay-controller"');
      expect(optional).toContain('_r("game/ai/policy-onnx-runtime"');
      expect(optional).toContain('_r("ui/gacha/gacha-overlay-controller"');
    } finally {
      fs.rmSync(rootDir, { recursive: true, force: true });
    }
  });
});
