const {
  optionalPayloadGroupFromUrl,
  evaluateFeatureProbe
} = require('../scripts/browser-optional-feature-smoke');

describe('browser optional feature smoke evaluation', () => {
  test('extracts feature groups from hashed optional payload URLs', () => {
    expect(optionalPayloadGroupFromUrl('https://example.test/vite-dist/assets/optional-gacha-AbC123.mjs')).toBe('gacha');
    expect(optionalPayloadGroupFromUrl('https://example.test/vite-dist/assets/optional-onnx-Xyz.mjs?cardReversiRetry=2')).toBe('onnx');
    expect(optionalPayloadGroupFromUrl('https://example.test/public/module-registry.optional.gacha.js?v=1')).toBe('');
  });

  test('rejects unrelated registries and duplicated requests', () => {
    const errors = evaluateFeatureProbe({
      group: 'gacha',
      requestedOptionalPayloads: ['gacha', 'gacha', 'cosmetic'],
      expectedPayloadRequests: 1,
      opened: true,
      reopened: true,
      pageErrors: [],
      consoleErrors: [],
      resourceErrors: []
    });

    expect(errors).toContain('gacha loaded unrelated optional payloads: cosmetic');
    expect(errors).toContain('gacha payload request count 2 != 1');
  });
});
