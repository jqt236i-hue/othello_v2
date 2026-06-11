jest.mock('../training/scripts/selfplay-deck-options', () => ({
  DEFAULT_SELFPLAY_WHITE_DECK_CODE: 'mock-white-deck'
}));

const {
  createSelfplayTrainingCycleDefaults,
  parseSelfplayTrainingCycleArgs,
  normalizeRestartFromStep,
  resolveSelfplayCardUsageRateForIteration
} = require('../training/scripts/selfplay-training-cycle-args');

describe('selfplay training cycle args', () => {
  test('creates defaults without filesystem side effects', () => {
    const defaults = createSelfplayTrainingCycleDefaults({
      cwd: 'C:/repo',
      defaultJobs: 3
    });

    expect(defaults.iterations).toBe(1);
    expect(defaults.selfplayJobs).toBe(3);
    expect(defaults.adoptionJobs).toBe(3);
    expect(defaults.onnxGateJobs).toBe(3);
    expect(defaults.selfplayWhiteDeckCode).toBe('mock-white-deck');
    expect(defaults.pythonPath).toBe('C:\\repo\\.venv\\Scripts\\python.exe');
    expect(defaults.runsDir).toBe('C:\\repo\\data\\runs');
    expect(defaults.modelsDir).toBe('C:\\repo\\data\\models');
  });

  test('parses existing CLI flags and preserves schedule behavior', () => {
    const args = parseSelfplayTrainingCycleArgs([
      '--iterations', '2',
      '--run-tag', 'abc123',
      '--selfplay-card-usage-rate-schedule', '0.3@2,0.5@4',
      '--reuse-existing-artifacts',
      '--restart-from-step', 'adoption-quality-gate'
    ]);

    expect(args.iterations).toBe(2);
    expect(args.allowCardUsage).toBe(true);
    expect(args.runTag).toBe('abc123');
    expect(args.restartFromStep).toBe('adoption-quality-gate');
    expect(args.selfplayCardUsageRateSchedule).toEqual([
      { iteration: 2, rate: 0.3 },
      { iteration: 4, rate: 0.5 }
    ]);
    expect(resolveSelfplayCardUsageRateForIteration(args, 3)).toBe(0.3);
  });

  test('normalizes restart steps through the shared step order', () => {
    expect(normalizeRestartFromStep('ADOPTION-QUALITY-GATE')).toBe('adoption-quality-gate');
    expect(() => parseSelfplayTrainingCycleArgs(['--restart-from-step', 'missing-step'])).toThrow(
      '--restart-from-step must be one of:'
    );
  });
});
