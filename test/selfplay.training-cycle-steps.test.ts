const {
  createSelfplayTrainingCycleStepRecorder,
  toSelfplayTrainingCycleStepResult
} = require('../training/scripts/selfplay-training-cycle-steps');

describe('selfplay training cycle step recorder', () => {
  test('records executed, reused, and skipped steps in order', () => {
    const steps = [];
    const logs = [];
    const recorder = createSelfplayTrainingCycleStepRecorder({
      steps,
      args: {
        runTag: 'abc123',
        summaryOut: 'summary.json',
        reuseExistingArtifacts: true
      },
      deadlineMs: null,
      iterationIndex: 1,
      iterationTag: 'abc123.it01',
      getRemainingMs: () => null,
      shouldReuseStepArtifacts: (_args, name) => name === 'generate-eval',
      fileExists: (filePath) => filePath.endsWith('.ready'),
      runCommand: (cmd, stepArgs) => ({
        status: 0,
        elapsedMs: 12,
        command: [cmd].concat(stepArgs).join(' ')
      }),
      annotateError: (error, detail) => Object.assign(error, { detail }),
      logger: {
        log: (message) => logs.push(message)
      }
    });

    recorder.runManagedStep('generate-train', 'node', ['train.js']);
    recorder.runManagedStep('generate-eval', 'node', ['eval.js'], {
      reuseOutputs: ['eval.ready']
    });
    recorder.recordSkippedStep('train-target-policy', 'disabled', {
      trainTargetHeadEnabled: false
    });

    expect(steps.map((step) => step.name)).toEqual([
      'generate-train',
      'generate-eval',
      'train-target-policy'
    ]);
    expect(steps[1].reused).toBe(true);
    expect(steps[2].skipped).toBe(true);
    expect(logs[0]).toContain('reuse generate-eval');
    expect(recorder.getStepResults()).toEqual([
      { name: 'generate-train', status: 'passed', command: 'node train.js' },
      { name: 'generate-eval', status: 'passed' },
      { name: 'train-target-policy', status: 'skipped' }
    ]);
  });

  test('normalizes failed step results with artifact paths', () => {
    expect(toSelfplayTrainingCycleStepResult({
      name: 'adoption-quick',
      status: 2,
      stepOutputs: ['quick.json']
    })).toEqual({
      name: 'adoption-quick',
      status: 'failed',
      artifactPaths: ['quick.json']
    });
  });
});
