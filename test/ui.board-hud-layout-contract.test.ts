import { readLayoutCssSurface } from './helpers/css-test-helpers';

describe('board HUD layout contract', () => {
  test('charge display stays anchored by layout variables', () => {
    const layoutCss = readLayoutCssSurface();

    expect(layoutCss).toMatch(/\.charge-display[\s\S]*font-size:\s*var\(--layout-size-charge-font\)/);
    expect(layoutCss).toMatch(/#charge-black[\s\S]*bottom:\s*var\(--layout-size-charge-offset\)/);
    expect(layoutCss).toMatch(/#charge-white \.time-stop-status-badge[\s\S]*bottom:\s*calc\(100%\s*\+\s*\(6px\s*\*\s*var\(--layout-stage-scale\)\)\)/);
    expect(layoutCss).toMatch(/\.charge-delta[\s\S]*transform:\s*translateY\(var\(--layout-size-charge-delta-shift-y-start\)\)/);
    expect(layoutCss).toMatch(/\.charge-delta[\s\S]*-webkit-text-stroke/);
  });

  test('time stop hand overlay spacing remains stage-scaled', () => {
    const layoutCss = readLayoutCssSurface();

    expect(layoutCss).toMatch(/\.hand-container\.time-stop-hand-overlay-active[\s\S]*padding-top:\s*calc\(32px\s*\*\s*var\(--layout-stage-scale\)\)/);
  });
});
