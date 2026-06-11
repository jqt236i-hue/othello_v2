import { readLayoutCssSurface } from './helpers/css-test-helpers';

describe('board HUD layout contract', () => {
  test('time stop hand overlay spacing remains stage-scaled', () => {
    const layoutCss = readLayoutCssSurface();

    expect(layoutCss).toMatch(/\.hand-container\.time-stop-hand-overlay-active[\s\S]*padding-top:\s*calc\(32px\s*\*\s*var\(--layout-stage-scale\)\)/);
  });
});
