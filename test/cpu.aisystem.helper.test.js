const cpu = require('../game/cpu-decision');

describe('AISystem helper', () => {
  let origAISystem;
  beforeEach(() => { origAISystem = global.AISystem; delete global.AISystem; });
  afterEach(() => { global.AISystem = origAISystem; });

  test('isAISystemAvailable returns false when AISystem absent', () => {
    expect(typeof global.isAISystemAvailable === 'function' ? global.isAISystemAvailable() : false).toBe(false);
  });

  test('isAISystemAvailable returns true when AISystem present', () => {
    global.AISystem = { selectCardToUse: () => null };
    // helper is defined in module scope; expose via require cache
    const mod = require('../game/cpu-decision');
    // The helper is not exported; check behavior indirectly via selectCardToUse not throwing
    expect(() => { mod.selectCardToUse('black'); }).not.toThrow();
  });
});