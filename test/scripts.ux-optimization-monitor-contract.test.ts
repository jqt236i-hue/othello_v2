import {
  UX_OPTIMIZATION_CAPTURE_POLICY_DIGEST,
  UX_OPTIMIZATION_IDS,
  UX_OPTIMIZATION_REPORT_SCHEMA_VERSION,
  UX_OPTIMIZATION_SCENARIO_CAPTURES,
  UX_OPTIMIZATION_SCENARIO_DIGEST,
  UX_OPTIMIZATION_SCENARIOS,
  isAllowedStaticResourcePath,
  nearestRankPercentile,
  normalizePhaseName,
  stableJson
} from '../scripts/perf/ux-optimization-monitor-contract';

describe('UX optimization monitor contract', () => {
  test('defines unique scenarios and covers every optimization', () => {
    const scenarioIds = UX_OPTIMIZATION_SCENARIOS.map((scenario) => scenario.id);
    expect(new Set(scenarioIds).size).toBe(scenarioIds.length);
    const captureKeys = UX_OPTIMIZATION_SCENARIO_CAPTURES.map((capture) => capture.key);
    expect(new Set(captureKeys).size).toBe(captureKeys.length);
    for (const optimizationId of UX_OPTIMIZATION_IDS) {
      expect(
        UX_OPTIMIZATION_SCENARIOS.some(
          (scenario) => scenario.optimizationIds.includes(optimizationId)
        )
      ).toBe(true);
    }
    expect(UX_OPTIMIZATION_REPORT_SCHEMA_VERSION).toBe(
      'ux_preserving_runtime_optimization_report.v1'
    );
    expect(UX_OPTIMIZATION_SCENARIO_DIGEST).toMatch(/^[0-9a-f]{64}$/);
    expect(UX_OPTIMIZATION_CAPTURE_POLICY_DIGEST).toMatch(/^[0-9a-f]{64}$/);
    for (const scenario of UX_OPTIMIZATION_SCENARIOS) {
      expect(scenario.requiredCaptures.length).toBeGreaterThan(0);
    }
    for (const scenarioId of [
      'board.first-special',
      'fallback.explicit-dom',
      'fallback.pixi-init-failure',
      'fallback.context-loss',
      'help.before-idle',
      'help.after-idle',
      'feature.result',
      'feature.profile',
      'feature.rules-help',
      'feature.deck-builder',
      'feature.network',
      'feature.network-restore',
      'asset.webp-fallback'
    ]) {
      const lanes = UX_OPTIMIZATION_SCENARIO_CAPTURES
        .filter((capture) => capture.id === scenarioId)
        .map((capture) => capture.lane)
        .sort();
      expect(lanes).toEqual(['classic', 'vite']);
    }
  });

  test('uses deterministic stable JSON and nearest-rank percentiles', () => {
    expect(stableJson({ b: 2, a: [3, { z: true, y: false }] })).toBe(
      '{"a":[3,{"y":false,"z":true}],"b":2}'
    );
    expect(nearestRankPercentile([9, 1, 5, 3, 7], 0.5)).toBe(5);
    expect(nearestRankPercentile([1, 2, 3, 4, 5], 0.95)).toBe(5);
    expect(nearestRankPercentile([], 0.95)).toBeNull();
  });

  test('normalizes dynamic phases and fails closed for resource paths', () => {
    expect(normalizePhaseName('feature-opening:profile')).toBe('feature-opening');
    expect(normalizePhaseName('playback:opponent-actions')).toBe('playback');
    expect(normalizePhaseName('unknown')).toBeNull();
    expect(isAllowedStaticResourcePath('/assets/images/ui/help.png?v=1')).toBe(true);
    expect(isAllowedStaticResourcePath('styles-layout-info.css?v=1')).toBe(true);
    expect(isAllowedStaticResourcePath('/api/match/list')).toBe(false);
    expect(isAllowedStaticResourcePath('../../.env')).toBe(false);
    expect(isAllowedStaticResourcePath('https://example.com/assets/image.png')).toBe(false);
  });
});
