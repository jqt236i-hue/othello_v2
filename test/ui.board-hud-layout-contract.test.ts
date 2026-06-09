import { readLayoutCssSurface } from './helpers/css-test-helpers';

describe('board HUD layout contract', () => {
  test('charge display stays anchored by layout variables', () => {
    const layoutCss = readLayoutCssSurface();

    expect(layoutCss).toMatch(/\.charge-display[\s\S]*font-size:\s*var\(--layout-size-charge-font\)/);
    expect(layoutCss).toMatch(/\.charge-display[\s\S]*padding:\s*var\(--layout-size-charge-pad-y\)\s*var\(--layout-size-charge-pad-x\)/);
    expect(layoutCss).toMatch(/#charge-black[\s\S]*bottom:\s*var\(--layout-size-charge-offset\)/);
    expect(layoutCss).toMatch(/#charge-white[\s\S]*top:\s*var\(--layout-size-charge-offset\)/);
    expect(layoutCss).toMatch(/#charge-white \.time-stop-status-badge[\s\S]*bottom:\s*calc\(100%\s*\+\s*\(6px\s*\*\s*var\(--layout-stage-scale\)\)\)/);
    expect(layoutCss).toMatch(/\.charge-delta[\s\S]*position:\s*absolute/);
    expect(layoutCss).toMatch(/\.charge-delta[\s\S]*display:\s*flex/);
    expect(layoutCss).toMatch(/\.charge-delta[\s\S]*min-height:\s*var\(--layout-size-charge-delta-height\)/);
    expect(layoutCss).toMatch(/\.charge-delta[\s\S]*padding:\s*var\(--layout-size-charge-delta-pad-y\)\s*var\(--layout-size-charge-delta-pad-x\)/);
    expect(layoutCss).toMatch(/\.charge-delta[\s\S]*overflow:\s*visible/);
    expect(layoutCss).toMatch(/\.charge-delta::before[\s\S]*radial-gradient/);
    expect(layoutCss).toMatch(/\.charge-delta::after[\s\S]*blur/);
    expect(layoutCss).toMatch(/\.charge-delta[\s\S]*transform:\s*translate3d\(var\(--charge-delta-drift-x,\s*0px\),\s*var\(--layout-size-charge-delta-shift-y-start\),\s*0\)/);
    expect(layoutCss).toMatch(/\.charge-delta\.is-visible[\s\S]*scale\(1\)/);
    expect(layoutCss).toMatch(/\.charge-delta\.is-fadeout[\s\S]*filter:\s*blur/);
    expect(layoutCss).toMatch(/\.charge-delta\.is-increase[\s\S]*--charge-delta-core:\s*rgba\(160,\s*222,\s*255,\s*0\.95\)/);
    expect(layoutCss).toMatch(/\.charge-delta\.is-decrease[\s\S]*--charge-delta-core:\s*rgba\(255,\s*155,\s*155,\s*0\.88\)/);
  });

  test('time stop hand overlay spacing remains stage-scaled', () => {
    const layoutCss = readLayoutCssSurface();

    expect(layoutCss).toMatch(/\.hand-container\.time-stop-hand-overlay-active[\s\S]*padding-top:\s*calc\(32px\s*\*\s*var\(--layout-stage-scale\)\)/);
  });
});
