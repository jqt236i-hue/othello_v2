import { readLayoutCssSurface } from './helpers/css-test-helpers';
import fs from 'fs';
import path from 'path';

describe('charge HUD position contract', () => {
  test('charge displays stay anchored by stage-scaled layout variables', () => {
    const layoutCss = readLayoutCssSurface();
    const variablesCss = fs.readFileSync(path.resolve(__dirname, '../styles-variables.css'), 'utf8');
    const responsiveCss = fs.readFileSync(path.resolve(__dirname, '../styles-responsive.css'), 'utf8');

    expect(layoutCss).toMatch(/\.charge-display[\s\S]*width:\s*calc\(154px\s*\*\s*var\(--layout-stage-scale\)\)/);
    expect(layoutCss).toMatch(/\.charge-display[\s\S]*background-image:\s*url\("assets\/images\/other\/charge-counter-wafu-v1\.png"\)/);
    expect(layoutCss).toMatch(/\.charge-display[\s\S]*background-size:\s*100%\s*100%/);
    expect(layoutCss).toMatch(/\.charge-display[\s\S]*font-size:\s*var\(--layout-size-charge-font\)/);
    expect(layoutCss).toMatch(/\.charge-display[\s\S]*z-index:\s*var\(--layout-z-charge-display\)/);
    expect(layoutCss).toMatch(/#charge-hud-layer[\s\S]*transform:\s*translateY\(var\(--layout-charge-board-offset-y\)\)/);
    expect(layoutCss).toMatch(/#charge-black[\s\S]*bottom:\s*calc\(var\(--layout-size-charge-offset\)\s*\+\s*var\(--layout-charge-own-offset\)\s*-\s*3px\)/);
    expect(layoutCss).toMatch(/#charge-white[\s\S]*top:\s*calc\(var\(--layout-size-charge-offset\)\s*\+\s*var\(--layout-charge-opponent-offset\)\s*-\s*19px\)/);
    expect(layoutCss).toMatch(/#charge-white \.time-stop-status-badge[\s\S]*bottom:\s*calc\(100%\s*\+\s*\(6px\s*\*\s*var\(--layout-stage-scale\)\)\)/);
    expect(variablesCss).toMatch(/--layout-size-charge-font:\s*calc\(12px\s*\*\s*var\(--layout-stage-scale\)\)/);
    expect(variablesCss).toMatch(/--layout-size-charge-pad-x:\s*calc\(8px\s*\*\s*var\(--layout-stage-scale\)\)/);
    expect(variablesCss).toMatch(/--layout-size-charge-offset:\s*calc\(\(-28px\s*\+\s*clamp\(8px,\s*1\.8vmin,\s*19px\)\)\s*\*\s*var\(--layout-stage-scale\)\)/);
    expect(variablesCss).toMatch(/--layout-charge-board-offset-y:\s*calc\(-18px\s*\*\s*var\(--layout-stage-scale\)\)/);
    expect(variablesCss).toMatch(/--layout-charge-own-offset:\s*calc\(3px\s*\*\s*var\(--layout-stage-scale\)\)/);
    expect(variablesCss).toMatch(/--layout-charge-opponent-offset:\s*calc\(17px\s*\*\s*var\(--layout-stage-scale\)\)/);
    expect(responsiveCss).toMatch(/html\.layout-profile-phone-portrait #charge-hud-layer\s*\{[\s\S]*overflow:\s*hidden[\s\S]*transform:\s*none/);
    expect(responsiveCss).toMatch(/html\.layout-profile-phone-portrait \.charge-display\s*\{[\s\S]*width:\s*clamp\(64px,\s*calc\(102px\s*\*\s*var\(--layout-stage-scale\)\),\s*94px\)[\s\S]*height:\s*clamp\(18px,\s*calc\(21px\s*\*\s*var\(--layout-stage-scale\)\),\s*20px\)/);
    expect(responsiveCss).toMatch(/html\.layout-profile-phone-portrait #charge-white\s*\{[\s\S]*top:\s*calc\(2px\s*\*\s*var\(--layout-stage-scale\)\)/);
    expect(responsiveCss).toMatch(/html\.layout-profile-phone-portrait #charge-black\s*\{[\s\S]*bottom:\s*calc\(2px\s*\*\s*var\(--layout-stage-scale\)\)/);
    expect(responsiveCss).toMatch(/html\.layout-profile-phone-portrait \.pass-streak-status\s*\{[\s\S]*left:\s*calc\(3px\s*\*\s*var\(--layout-stage-scale\)\)[\s\S]*top:\s*calc\(2px\s*\*\s*var\(--layout-stage-scale\)\)[\s\S]*bottom:\s*auto/);
    expect(responsiveCss).toMatch(/html\.layout-profile-phone-portrait \.pass-streak-status \.pass-streak-note\s*\{[\s\S]*display:\s*none/);
    expect(responsiveCss).toMatch(/html\.layout-profile-phone-portrait :is\(#reversi-pass-btn,\s*#othello-pass-btn\)\s*\{[\s\S]*display:\s*none\s*!important/);
    expect(responsiveCss).toMatch(/html\.layout-profile-phone-portrait #board-frame-pass-btn\s*\{[\s\S]*left:\s*calc\(3px\s*\*\s*var\(--layout-stage-scale\)\)[\s\S]*bottom:\s*calc\(2px\s*\*\s*var\(--layout-stage-scale\)\)/);
    expect(responsiveCss).toMatch(/html\.layout-profile-phone-portrait \.turn-arrival-toast\s*\{[\s\S]*width:\s*calc\(132px\s*\*\s*var\(--layout-stage-scale\)\)[\s\S]*height:\s*calc\(30px\s*\*\s*var\(--layout-stage-scale\)\)/);
  });
});
