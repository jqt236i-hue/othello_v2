import * as fs from 'fs';
import * as path from 'path';
import { readCssBlock, readLayoutCssSurface } from './helpers/css-test-helpers';

describe('status-display cpu image scaling', () => {
  test('CPU settings fade in with a centered entrance and respect reduced motion', () => {
    const css = readLayoutCssSurface();
    const menu = readCssBlock(css, '#cpu-level-menu');
    const backdrop = readCssBlock(css, '#cpu-level-menu-backdrop');
    expect(menu).toMatch(/transform:\s*translate\(-50%,\s*-50%\)/);
    expect(menu).toMatch(/animation:\s*cpuConfigMenuEnter\s+260ms/);
    expect(backdrop).toMatch(/animation:\s*cpuConfigBackdropEnter\s+220ms/);
    expect(css).toMatch(/@keyframes cpuConfigMenuEnter\s*\{\s*from\s*\{\s*opacity:\s*0;\s*transform:\s*translate\(-50%,\s*-50%\)[^}]+scale\(0\.985\)/);
    expect(css).toMatch(/@media\s*\(prefers-reduced-motion:\s*reduce\)\s*\{\s*#cpu-level-menu,\s*#cpu-level-menu-backdrop\s*\{\s*animation:\s*none/);
    expect(readCssBlock(css, '#cpu-level-menu[hidden]')).toMatch(/display:\s*none/);
  });

  test('preserves the human hero orientation and mirrors left-side CPUs by slot, not by image', () => {
    const css = readLayoutCssSurface();
    const heroArtworkRule = readCssBlock(css, '#hero-character-img[data-card-reversi-logical-src="assets/images/hero/hero.png"]');
    expect(heroArtworkRule).toMatch(/--hero-character-face-direction:\s*1\s*;/);
    expect(readCssBlock(css, '#hero-character-img')).toMatch(/--hero-character-face-direction:\s*-1\s*;/);
    expect(css).not.toContain('observed-dark-dragon-transparent.png');
  });

  test('hides the default hero name without removing the space below its portrait', () => {
    const rule = readCssBlock(readLayoutCssSurface(), '#hero-label.is-default-hero-label');
    expect(rule).toMatch(/visibility:\s*hidden\s*;/);
    expect(rule).not.toMatch(/display:\s*none/);
  });

  test('uses CSS variable based level scaling without JS pixel width override', () => {
    const jsPath = path.join(__dirname, '..', 'ui', 'status-display.ts');
    const js = fs.readFileSync(jsPath, 'utf8');
    const css = readLayoutCssSurface();
    const varsPath = path.join(__dirname, '..', 'styles-variables.css');
    const varsCss = fs.readFileSync(varsPath, 'utf8');
    const responsiveCssPath = path.join(__dirname, '..', 'styles-responsive.css');
    const responsiveCss = fs.readFileSync(responsiveCssPath, 'utf8');

    expect(js).toMatch(/function\s+applyCpuCharacterLevelScale[\s\S]*setProperty\('--cpu-level-scale'/);
    expect(js).toMatch(/CPU_BASE_VISUAL_SCALE\s*=\s*0\.88/);
    expect(js).toMatch(/CPU_LEVEL_VISUAL_SCALE_STEP\s*=\s*0\.07/);
    expect(js).not.toMatch(/function\s+applyCpuCharacterLevelScale[\s\S]*safeBaseWidth/);
    expect(varsCss).toMatch(/--layout-character-image-scale:\s*0\.8/);
    expect(css).toMatch(/#cpu-character-img[\s\S]*width:\s*calc\(var\(--layout-anchor-hero-size\)\s*\*\s*var\(--layout-stage-scale\)\s*\*\s*var\(--layout-character-image-scale\)\)/);
    expect(css).toMatch(/#cpu-character-img[\s\S]*transform:\s*translateY\(calc\(var\(--layout-anchor-character-offset-y\)\s*\*\s*var\(--layout-stage-scale\)\)\)\s*scale\(var\(--cpu-level-scale,\s*1\)\)/);
    expect(readCssBlock(css, '#cpu-character-img')).not.toMatch(/scaleX/);
    expect(readCssBlock(css, '#cpu-character-img:hover')).not.toMatch(/scaleX/);
    expect(css).not.toContain('--cpu-character-face-direction');
    expect(css).toMatch(/#cpu-character-img:hover[\s\S]*translateY\(calc\(var\(--layout-anchor-character-offset-y\)\s*\*\s*var\(--layout-stage-scale\)\)\)\s*scale\(calc\(var\(--cpu-level-scale,\s*1\)\s*\*\s*1\.04\)\)/);
    expect(css).toMatch(/#hero-character-img[\s\S]*width:\s*calc\(var\(--layout-anchor-hero-size\)\s*\*\s*var\(--layout-stage-scale\)\s*\*\s*var\(--layout-character-image-scale\)\)/);
    expect(css).toMatch(/#hero-character-img[\s\S]*transform:\s*translateY\(calc\(var\(--layout-anchor-character-offset-y\)\s*\*\s*var\(--layout-stage-scale\)\)\)/);
    expect(css).toMatch(/#hero-character-img[\s\S]*scaleX\(var\(--hero-character-face-direction,\s*-1\)\)/);
    expect(css).toMatch(/#hero-character-img:hover[\s\S]*scale\(1\.04\)[\s\S]*scaleX\(var\(--hero-character-face-direction,\s*-1\)\)/);
    expect(css).toMatch(/#cpu-character-panel[\s\S]*gap:\s*calc\(1px\s*\*\s*var\(--layout-stage-scale\)\)/);
    expect(css).toMatch(/#cpu-character-panel[\s\S]*transform:\s*translateY\(calc\(55px\s*\*\s*var\(--layout-stage-scale\)\)\)/);
    expect(css).toMatch(/#hero-character-panel[\s\S]*gap:\s*calc\(1px\s*\*\s*var\(--layout-stage-scale\)\)/);
    expect(css).toMatch(/#cpu-level-label[\s\S]*margin-top:\s*0/);
    expect(css).toMatch(/#cpu-level-label[\s\S]*background:[\s\S]*linear-gradient\(180deg,\s*rgba\(255,\s*248,\s*225,\s*0\.14\),\s*rgba\(255,\s*248,\s*225,\s*0\)\s*38%\)/);
    expect(css).toMatch(/#cpu-level-label[\s\S]*font-weight:\s*600/);
    expect(css).toMatch(/#cpu-level-label[\s\S]*backdrop-filter:\s*blur/);
    expect(css).toMatch(/#cpu-level-label[\s\S]*letter-spacing:\s*calc\(1\.4px\s*\*\s*var\(--layout-stage-scale\)\)/);
    expect(readCssBlock(css, '#cpu-level-label')).toEqual(expect.stringMatching(/display:\s*inline-grid/));
    expect(readCssBlock(css, '#cpu-level-label')).toEqual(expect.stringMatching(/grid-template-columns:\s*minmax\(0,\s*1fr\)\s*auto/));
    expect(readCssBlock(css, '#cpu-level-label')).toEqual(expect.stringMatching(/linear-gradient\(180deg,\s*rgba\(42,\s*52,\s*45,\s*0\.95\),\s*rgba\(12,\s*22,\s*22,\s*0\.92\)\)/));
    expect(readCssBlock(css, '#cpu-level-label::after')).toEqual(expect.stringMatching(/content:\s*"▽"/));
    expect(readCssBlock(css, '#cpu-level-label::after')).toEqual(expect.stringMatching(/color:\s*rgba\(224,\s*198,\s*122,\s*0\.88\)/));
    expect(css).toMatch(/#cpu-level-menu[\s\S]*backdrop-filter:\s*blur/);
    expect(css).toMatch(/\.cpu-level-menu-item\.cpu-level-tier-1[\s\S]*--cpu-tier-accent:\s*72,\s*78,\s*82/);
    expect(css).toMatch(/\.cpu-level-menu-item\.cpu-level-tier-5[\s\S]*--cpu-tier-accent:\s*96,\s*102,\s*106/);
    expect(css).toMatch(/\.cpu-level-menu-item\.cpu-level-tier-1,[\s\S]*\.cpu-level-menu-item\.cpu-level-tier-5[\s\S]*--cpu-tier-accent-start-alpha:\s*0\.045/);
    expect(css).toMatch(/\.cpu-level-menu-item\.cpu-level-tier-1,[\s\S]*\.cpu-level-menu-item\.cpu-level-tier-5[\s\S]*--cpu-tier-glow-selected-alpha:\s*0\.045/);
    expect(css).toMatch(/\.cpu-level-menu-item\.cpu-level-profile-board-executor[\s\S]*--cpu-tier-accent:\s*212,\s*78,\s*255/);
    expect(css).toMatch(/\.cpu-level-menu-item\.cpu-level-tier-8,[\s\S]*\.cpu-level-menu-item\.cpu-level-profile-theory[\s\S]*--cpu-tier-accent:\s*224,\s*52,\s*64/);
    expect(css).toMatch(/\.cpu-level-menu-item\.cpu-level-tier-9,[\s\S]*\.cpu-level-menu-item\.cpu-level-profile-ending-ash[\s\S]*--cpu-tier-accent:\s*154,\s*168,\s*174/);
    expect(css).toMatch(/#hero-label[\s\S]*margin-top:\s*0/);
    expect(css).toMatch(/#cpu-level-label[\s\S]*margin-top:\s*calc\(1px\s*\*\s*var\(--layout-stage-scale\)\)\s*!important/);
    expect(css).toMatch(/#cpu-level-label[\s\S]*transform:\s*translateY\(calc\(12px\s*\*\s*var\(--layout-stage-scale\)\)\)\s*!important/);
    expect(css).toMatch(/#hero-label[\s\S]*margin-top:\s*calc\(1px\s*\*\s*var\(--layout-stage-scale\)\)\s*!important/);
    expect(css).toMatch(/#hero-label[\s\S]*transform:\s*translateY\(calc\(48px\s*\*\s*var\(--layout-stage-scale\)\)\)\s*!important/);
    expect(responsiveCss).toMatch(/html\.layout-stage-enabled(?::not\(\.layout-profile-phone-portrait\))?\s+#cpu-character-img[\s\S]*width:\s*calc\(var\(--layout-anchor-hero-size\)\s*\*\s*var\(--layout-stage-scale\)\s*\*\s*var\(--layout-character-image-scale\)\)/);
    expect(responsiveCss).toMatch(/html\.layout-stage-enabled(?::not\(\.layout-profile-phone-portrait\))?\s+#hero-character-img[\s\S]*width:\s*calc\(var\(--layout-anchor-hero-size\)\s*\*\s*var\(--layout-stage-scale\)\s*\*\s*var\(--layout-character-image-scale\)\)/);
    expect(responsiveCss).toMatch(/html\.layout-stage-enabled(?::not\(\.layout-profile-phone-portrait\))?\s+#hero-character-img[\s\S]*transform:\s*translateY\(calc\(var\(--layout-anchor-character-offset-y\)\s*\*\s*var\(--layout-stage-scale\)\)\)/);
    expect(responsiveCss).toMatch(/html\.layout-stage-enabled(?::not\(\.layout-profile-phone-portrait\))?\s+#hero-character-img[\s\S]*scaleX\(var\(--hero-character-face-direction,\s*-1\)\)/);
  });
});
