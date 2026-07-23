import {
  buildUxOptimizationStandardCaptureOrder,
  parseStandardSuiteArgs,
  validateUxOptimizationStandardSuite,
  UX_OPTIMIZATION_STANDARD_SUITE_SCHEMA_VERSION
} from '../scripts/perf/capture-ux-optimization-standard-suite';
import {
  UX_OPTIMIZATION_PROFILE_SAMPLE_COUNTS
} from '../scripts/perf/ux-optimization-monitor-contract';

describe('UX optimization standard suite', () => {
  test('derives a deterministic alternating order from the candidate commit', () => {
    const even = buildUxOptimizationStandardCaptureOrder('a'.repeat(40), 3);
    expect(even).toEqual([
      'baseline',
      'candidate',
      'candidate',
      'baseline',
      'baseline',
      'candidate'
    ]);
    const odd = buildUxOptimizationStandardCaptureOrder(
      `${'a'.repeat(39)}b`,
      2
    );
    expect(odd).toEqual([
      'candidate',
      'baseline',
      'baseline',
      'candidate'
    ]);
  });

  test('fails closed when sample count or capture order is incomplete', () => {
    const candidateCommit = 'a'.repeat(40);
    const validation = validateUxOptimizationStandardSuite({
      schemaVersion: UX_OPTIMIZATION_STANDARD_SUITE_SCHEMA_VERSION,
      candidateCommit,
      baselineCommit: 'b'.repeat(40),
      sampleCount: 1,
      captureOrder: ['candidate', 'baseline'],
      baselineReports: [],
      candidateReports: []
    });
    expect(validation.overallVerdict).toBe('fail');
    expect(validation.checks.find(
      (check) => check.id === 'suite.sample-count'
    )?.reasons).toEqual(expect.arrayContaining([
      `sample count must be ${UX_OPTIMIZATION_PROFILE_SAMPLE_COUNTS.standard}`,
      'baseline report count was 0',
      'candidate report count was 0'
    ]));
    expect(validation.checks.find(
      (check) => check.id === 'suite.capture-order'
    )?.verdict).toBe('fail');
    expect(validation.checks.find(
      (check) => check.id === 'suite.observed-capture-order'
    )?.verdict).toBe('fail');
  });

  test('parses standard suite paths and positive sample counts', () => {
    expect(parseStandardSuiteArgs([
      '--baseline-report',
      'baseline.json',
      '--output',
      'suite.json',
      '--samples',
      '5'
    ])).toEqual({
      baselineReportPath: 'baseline.json',
      outputPath: 'suite.json',
      sampleCount: 5
    });
    expect(() => parseStandardSuiteArgs(['--samples', '0'])).toThrow(
      '--samples requires a positive integer'
    );
    expect(() => parseStandardSuiteArgs(['--unknown'])).toThrow(
      'Unknown argument'
    );
  });
});
