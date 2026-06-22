const {
  computeRegistryMetricsFromTexts,
  evaluateBootPerformanceSample,
  extractBootModuleMetadataFromRegistryText
} = require('../scripts/browser-boot-performance-check');

function registryText(metadata: any): string {
  return [
    '// Auto-generated module registry. Do not edit.',
    '(function() {',
    `  window.__CARD_REVERSI_BOOT_MODULES__ = ${JSON.stringify(metadata, null, 2)};`,
    '})();',
    ''
  ].join('\n');
}

describe('browser boot performance check', () => {
  test('extracts boot module metadata and registry sizes from split registry text', () => {
    const startup = registryText({
      required: ['shared-constants', 'ui/bootstrap', 'ui/network-client'],
      optional: [],
      optionalPrefixes: ['ui/debug']
    });
    const optional = registryText({
      required: [],
      optional: ['game/ai/policy-onnx-runtime', 'ui/gacha/gacha-overlay-controller'],
      optionalPrefixes: ['game/ai']
    });

    expect(extractBootModuleMetadataFromRegistryText(startup)).toEqual({
      required: ['shared-constants', 'ui/bootstrap', 'ui/network-client'],
      optional: [],
      optionalPrefixes: ['ui/debug']
    });
    expect(computeRegistryMetricsFromTexts(startup, optional)).toMatchObject({
      moduleRegistryBytes: Buffer.byteLength(startup, 'utf8'),
      optionalRegistryBytes: Buffer.byteLength(optional, 'utf8'),
      combinedRegistryBytes: Buffer.byteLength(startup, 'utf8') + Buffer.byteLength(optional, 'utf8'),
      requiredBootModuleCount: 3,
      optionalBootModuleCount: 2,
      combinedBootModuleCount: 5
    });
  });

  test('rejects startup samples that eagerly load optional runtime scripts', () => {
    const result = evaluateBootPerformanceSample({
      moduleRegistryBytes: 1000,
      optionalRegistryBytes: 400,
      requiredBootModuleCount: 10,
      optionalBootModuleCount: 3,
      optionalRegistryLoadedAtStartup: true,
      onnxScriptLoadedAtStartup: true,
      networkModeReadyMs: 250
    }, { networkModeReadyBudgetMs: 1000 });

    expect(result.ok).toBe(false);
    expect(result.errors).toContain('optional registry was loaded during startup');
    expect(result.errors).toContain('ONNX runtime was loaded during startup');
  });

  test('accepts samples that keep optional runtime scripts lazy', () => {
    const result = evaluateBootPerformanceSample({
      moduleRegistryBytes: 1000,
      optionalRegistryBytes: 400,
      requiredBootModuleCount: 10,
      optionalBootModuleCount: 3,
      optionalRegistryLoadedAtStartup: false,
      onnxScriptLoadedAtStartup: false,
      networkModeReadyMs: 250
    }, { networkModeReadyBudgetMs: 1000 });

    expect(result).toEqual({ ok: true, errors: [] });
  });
});
