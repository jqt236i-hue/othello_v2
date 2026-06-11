describe('policy-feature-vector js wrapper', () => {
  afterEach(() => {
    jest.resetModules();
    jest.dontMock('../dist/game/ai/policy-feature-vector');
  });

  test('loads TypeScript source in Jest instead of dist output', () => {
    jest.isolateModules(() => {
      jest.doMock('../dist/game/ai/policy-feature-vector', () => {
        throw new Error('dist policy-feature-vector should not be required in Jest');
      });

      const wrapper = require('../game/ai/policy-feature-vector.js');

      expect(typeof wrapper.buildPolicyFeatureVector).toBe('function');
      expect(wrapper.POLICY_FEATURE_VECTOR_OFFSETS).toEqual(expect.objectContaining({
        legalMoves: 0,
        maxLegalMoveBonus: 15
      }));
    });
  });
});
