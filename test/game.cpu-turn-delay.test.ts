import {
  DEFAULT_CPU_TURN_DELAY_MS,
  resolveCpuTurnDelayMs
} from '../game/cpu-turn-delay';

describe('resolveCpuTurnDelayMs', () => {
  test.each(['black', 'white'] as const)('Lv1 %s uses a zero handoff delay', (playerKey) => {
    expect(resolveCpuTurnDelayMs({
      playerKey,
      decisionLevel: 1
    })).toBe(0);
  });

  test.each([2, 3, 4, 5, 6, null])('Lv%s uses the compatibility default', (decisionLevel) => {
    expect(resolveCpuTurnDelayMs({
      playerKey: 'white',
      decisionLevel
    })).toBe(DEFAULT_CPU_TURN_DELAY_MS);
  });

  test('finite explicit override wins and is normalized', () => {
    expect(resolveCpuTurnDelayMs({
      playerKey: 'black',
      decisionLevel: 1,
      explicitDelayMs: 37.9
    })).toBe(37);
    expect(resolveCpuTurnDelayMs({
      playerKey: 'white',
      decisionLevel: 6,
      explicitDelayMs: -9
    })).toBe(0);
  });

  test('null and non-finite overrides are ignored', () => {
    expect(resolveCpuTurnDelayMs({
      playerKey: 'white',
      decisionLevel: 1,
      explicitDelayMs: null
    })).toBe(0);
    expect(resolveCpuTurnDelayMs({
      playerKey: 'white',
      decisionLevel: 4,
      explicitDelayMs: Number.NaN
    })).toBe(200);
  });

  test('custom default is normalized without changing the Lv1 rule', () => {
    expect(resolveCpuTurnDelayMs({
      playerKey: 'black',
      decisionLevel: null,
      defaultDelayMs: 145.8
    })).toBe(145);
    expect(resolveCpuTurnDelayMs({
      playerKey: 'black',
      decisionLevel: 1,
      defaultDelayMs: 145.8
    })).toBe(0);
  });
});
