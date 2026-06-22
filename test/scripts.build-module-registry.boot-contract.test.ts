const {
  buildRegistry,
  classifyBrowserBootModule
} = require('../scripts/build-module-registry');

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
  });

  test('classifies diagnostics, cosmetics, and heavyweight optional modules as optional', () => {
    expect(classifyBrowserBootModule('dist/ui/debug-card-search')).toBe('optional');
    expect(classifyBrowserBootModule('dist/ui/handlers/debug')).toBe('optional');
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
});
