import { readLayoutCssSurface } from './helpers/css-test-helpers';
import fs from 'fs';
import path from 'path';

function extractRuleBody(css: string, selectorPattern: string): string {
  const match = css.match(new RegExp(`${selectorPattern}\\s*\\{([\\s\\S]*?)\\n\\}`));
  return match ? match[1] : '';
}

describe('charge delta style contract', () => {
  test('charge delta popup keeps compact image-backed badge styling', () => {
    const layoutCss = readLayoutCssSurface();
    const variablesCss = fs.readFileSync(path.resolve(__dirname, '../styles-variables.css'), 'utf8');
    const chargeDisplayBody = extractRuleBody(layoutCss, '\\.charge-display');
    const chargeDeltaBody = extractRuleBody(layoutCss, '\\.charge-delta');
    const chargeDeltaFadeoutBody = extractRuleBody(layoutCss, '\\.charge-delta\\.is-fadeout');
    const chargeDeltaIncreaseBody = extractRuleBody(layoutCss, '\\.charge-delta\\.is-increase');
    const chargeDeltaDecreaseBody = extractRuleBody(layoutCss, '\\.charge-delta\\.is-decrease');

    expect(chargeDisplayBody).toMatch(/background-image:\s*url\("assets\/images\/other\/charge-counter-wafu-v1\.webp"\)/);
    expect(chargeDisplayBody).toMatch(/background-size:\s*100%\s*100%/);
    expect(variablesCss).toMatch(/--layout-size-charge-delta-font:\s*calc\(13px\s*\*\s*var\(--layout-stage-scale\)\)/);
    expect(variablesCss).toMatch(/--layout-size-charge-delta-height:\s*calc\(28px\s*\*\s*var\(--layout-stage-scale\)\)/);
    expect(variablesCss).toMatch(/--layout-size-charge-delta-min-width:\s*calc\(58px\s*\*\s*var\(--layout-stage-scale\)\)/);
    expect(variablesCss).toMatch(/--layout-size-charge-delta-side-gap:\s*calc\(1px\s*\*\s*var\(--layout-stage-scale\)\)/);
    expect(variablesCss).toMatch(/--layout-size-charge-delta-increase-offset-x:\s*calc\(5px\s*\*\s*var\(--layout-stage-scale\)\)/);
    expect(variablesCss).toMatch(/--layout-size-charge-delta-side-offset-y:\s*calc\(3px\s*\*\s*var\(--layout-stage-scale\)\)/);
    expect(layoutCss).toMatch(/\.charge-delta[\s\S]*position:\s*absolute/);
    expect(layoutCss).toMatch(/\.charge-delta[\s\S]*display:\s*flex/);
    expect(layoutCss).toMatch(/\.charge-delta[\s\S]*height:\s*var\(--layout-size-charge-delta-height\)/);
    expect(layoutCss).toMatch(/\.charge-delta[\s\S]*overflow:\s*visible/);
    expect(layoutCss).toMatch(/\.charge-delta[\s\S]*z-index:\s*var\(--layout-z-charge-delta\)/);
    expect(chargeDeltaBody).toMatch(/filter:\s*drop-shadow/);
    expect(chargeDeltaIncreaseBody).toMatch(/background-image:\s*url\("assets\/images\/other\/charge-delta-increase-wafu-v1\.webp"\)/);
    expect(chargeDeltaDecreaseBody).toMatch(/background-image:\s*url\("assets\/images\/other\/charge-delta-decrease-wafu-v1\.webp"\)/);
    expect(layoutCss).toMatch(/\.charge-delta[\s\S]*transform:\s*translate3d\(var\(--charge-delta-drift-x,\s*0px\),\s*var\(--layout-size-charge-delta-shift-y-start\),\s*0\)\s*scale\(0\.88\)/);
    expect(layoutCss).toMatch(/\.charge-delta\.is-visible[\s\S]*scale\(1\)/);
    expect(chargeDeltaFadeoutBody).not.toMatch(/^\s*filter:/m);
  });
});
