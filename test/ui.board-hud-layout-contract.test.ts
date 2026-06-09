import { readLayoutCssSurface } from './helpers/css-test-helpers';

describe('board HUD layout contract', () => {
  test('charge display stays anchored by layout variables', () => {
    const layoutCss = readLayoutCssSurface();

    expect(layoutCss).toMatch(/\.charge-display[\s\S]*font-size:\s*var\(--layout-size-charge-font\)/);
    expect(layoutCss).toMatch(/#charge-black[\s\S]*bottom:\s*var\(--layout-size-charge-offset\)/);
    expect(layoutCss).toMatch(/#charge-white \.time-stop-status-badge[\s\S]*bottom:\s*calc\(100%\s*\+\s*\(6px\s*\*\s*var\(--layout-stage-scale\)\)\)/);
    expect(layoutCss).toMatch(/\.charge-delta[\s\S]*position:\s*absolute/);
    expect(layoutCss).toMatch(/\.charge-delta[\s\S]*display:\s*flex/);
    expect(layoutCss).toMatch(/\.charge-delta::before[\s\S]*content:\s*""/);
    expect(layoutCss).toMatch(/\.charge-delta\.is-side-left::before[\s\S]*right:/);
    expect(layoutCss).toMatch(/\.charge-delta\.is-side-right::before[\s\S]*left:/);
    expect(layoutCss).toMatch(/\.charge-delta[\s\S]*transform:\s*translate3d\(var\(--charge-delta-drift-x,\s*0px\),\s*var\(--layout-size-charge-delta-shift-y-start\),\s*0\)/);
    expect(layoutCss).toMatch(/\.charge-delta[\s\S]*-webkit-text-stroke/);
  });

  test('time stop hand overlay spacing remains stage-scaled', () => {
    const layoutCss = readLayoutCssSurface();

    expect(layoutCss).toMatch(/\.hand-container\.time-stop-hand-overlay-active[\s\S]*padding-top:\s*calc\(32px\s*\*\s*var\(--layout-stage-scale\)\)/);
  });
});
