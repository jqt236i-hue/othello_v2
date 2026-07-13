const {
  optionalRegistryGroupFromUrl,
  evaluateFeatureProbe
} = require('../scripts/browser-optional-feature-smoke');

describe('browser optional feature smoke evaluation', () => {
  test('extracts aggregate and feature registry groups from request URLs', () => {
    expect(optionalRegistryGroupFromUrl('https://example.test/public/module-registry.optional.js?v=1')).toBe('aggregate');
    expect(optionalRegistryGroupFromUrl('https://example.test/public/module-registry.optional.gacha.js?v=1')).toBe('gacha');
    expect(optionalRegistryGroupFromUrl('https://example.test/public/module-registry.js?v=1')).toBe('');
  });

  test('rejects unrelated registries and duplicated requests', () => {
    const errors = evaluateFeatureProbe({
      group: 'gacha',
      requestedOptionalRegistries: ['gacha', 'gacha', 'cosmetic'],
      expectedRegistryRequests: 1,
      opened: true,
      reopened: true,
      pageErrors: [],
      consoleErrors: [],
      resourceErrors: []
    });

    expect(errors).toContain('gacha loaded unrelated optional registries: cosmetic');
    expect(errors).toContain('gacha registry request count 2 != 1');
  });
});
