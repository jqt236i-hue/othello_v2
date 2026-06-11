import { readLayoutCssSurface } from './helpers/css-test-helpers';
import fs from 'fs';
import path from 'path';

describe('charge HUD position contract', () => {
  test('charge displays stay anchored by stage-scaled layout variables', () => {
    const layoutCss = readLayoutCssSurface();
    const variablesCss = fs.readFileSync(path.resolve(__dirname, '../styles-variables.css'), 'utf8');

    expect(layoutCss).toMatch(/\.charge-display[\s\S]*min-width:\s*calc\(116px\s*\*\s*var\(--layout-stage-scale\)\)/);
    expect(layoutCss).toMatch(/\.charge-display[\s\S]*font-size:\s*var\(--layout-size-charge-font\)/);
    expect(layoutCss).toMatch(/\.charge-display[\s\S]*padding:\s*var\(--layout-size-charge-pad-y\)\s*var\(--layout-size-charge-pad-x\)/);
    expect(layoutCss).toMatch(/\.charge-display[\s\S]*z-index:\s*var\(--layout-z-charge-display\)/);
    expect(layoutCss).toMatch(/#charge-hud-layer[\s\S]*transform:\s*translateY\(var\(--layout-charge-board-offset-y\)\)/);
    expect(layoutCss).toMatch(/#charge-black[\s\S]*bottom:\s*calc\(var\(--layout-size-charge-offset\)\s*\+\s*var\(--layout-charge-own-offset\)\)/);
    expect(layoutCss).toMatch(/#charge-white[\s\S]*top:\s*calc\(var\(--layout-size-charge-offset\)\s*\+\s*var\(--layout-charge-opponent-offset\)\)/);
    expect(layoutCss).toMatch(/#charge-white \.time-stop-status-badge[\s\S]*bottom:\s*calc\(100%\s*\+\s*\(6px\s*\*\s*var\(--layout-stage-scale\)\)\)/);
    expect(variablesCss).toMatch(/--layout-size-charge-font:\s*calc\(12px\s*\*\s*var\(--layout-stage-scale\)\)/);
    expect(variablesCss).toMatch(/--layout-size-charge-pad-x:\s*calc\(8px\s*\*\s*var\(--layout-stage-scale\)\)/);
    expect(variablesCss).toMatch(/--layout-size-charge-offset:\s*calc\(\(-28px\s*\+\s*clamp\(8px,\s*1\.8vmin,\s*19px\)\)\s*\*\s*var\(--layout-stage-scale\)\)/);
    expect(variablesCss).toMatch(/--layout-charge-board-offset-y:\s*calc\(-18px\s*\*\s*var\(--layout-stage-scale\)\)/);
    expect(variablesCss).toMatch(/--layout-charge-own-offset:\s*calc\(11px\s*\*\s*var\(--layout-stage-scale\)\)/);
    expect(variablesCss).toMatch(/--layout-charge-opponent-offset:\s*calc\(11px\s*\*\s*var\(--layout-stage-scale\)\)/);
  });
});
