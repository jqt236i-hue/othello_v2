import { readLayoutCssSurface } from './helpers/css-test-helpers';
import fs from 'fs';
import path from 'path';

function extractRuleBody(css: string, selectorPattern: string): string {
  const match = css.match(new RegExp(`${selectorPattern}\\s*\\{([\\s\\S]*?)\\n\\}`));
  return match ? match[1] : '';
}

describe('charge delta style contract', () => {
  test('charge delta popup keeps compact non-blurred badge styling', () => {
    const layoutCss = readLayoutCssSurface();
    const variablesCss = fs.readFileSync(path.resolve(__dirname, '../styles-variables.css'), 'utf8');
    const chargeDisplayBody = extractRuleBody(layoutCss, '\\.charge-display');
    const chargeDeltaBody = extractRuleBody(layoutCss, '\\.charge-delta');
    const chargeDeltaBeforeBody = extractRuleBody(layoutCss, '\\.charge-delta::before');
    const chargeDeltaAfterBody = extractRuleBody(layoutCss, '\\.charge-delta::after');
    const chargeDeltaFadeoutBody = extractRuleBody(layoutCss, '\\.charge-delta\\.is-fadeout');

    expect(chargeDisplayBody).toMatch(/box-shadow:\s*none/);
    expect(chargeDisplayBody).toMatch(/text-shadow:\s*none/);
    expect(variablesCss).toMatch(/--layout-size-charge-delta-font:\s*calc\(13px\s*\*\s*var\(--layout-stage-scale\)\)/);
    expect(variablesCss).toMatch(/--layout-size-charge-delta-height:\s*calc\(22px\s*\*\s*var\(--layout-stage-scale\)\)/);
    expect(variablesCss).toMatch(/--layout-size-charge-delta-min-width:\s*calc\(48px\s*\*\s*var\(--layout-stage-scale\)\)/);
    expect(variablesCss).toMatch(/--layout-size-charge-delta-side-gap:\s*calc\(1px\s*\*\s*var\(--layout-stage-scale\)\)/);
    expect(variablesCss).toMatch(/--layout-size-charge-delta-increase-offset-x:\s*calc\(5px\s*\*\s*var\(--layout-stage-scale\)\)/);
    expect(variablesCss).toMatch(/--layout-size-charge-delta-side-offset-y:\s*calc\(3px\s*\*\s*var\(--layout-stage-scale\)\)/);
    expect(layoutCss).toMatch(/\.charge-delta[\s\S]*position:\s*absolute/);
    expect(layoutCss).toMatch(/\.charge-delta[\s\S]*display:\s*flex/);
    expect(layoutCss).toMatch(/\.charge-delta[\s\S]*height:\s*var\(--layout-size-charge-delta-height\)/);
    expect(layoutCss).toMatch(/\.charge-delta[\s\S]*padding:\s*var\(--layout-size-charge-delta-pad-y\)\s*var\(--layout-size-charge-delta-pad-x\)/);
    expect(layoutCss).toMatch(/\.charge-delta[\s\S]*overflow:\s*visible/);
    expect(layoutCss).toMatch(/\.charge-delta[\s\S]*z-index:\s*var\(--layout-z-charge-delta\)/);
    expect(chargeDeltaBody).not.toMatch(/^\s*filter:/m);
    expect(chargeDeltaBeforeBody).toMatch(/linear-gradient/);
    expect(chargeDeltaBeforeBody).not.toMatch(/filter:\s*blur/);
    expect(chargeDeltaAfterBody).toMatch(/radial-gradient/);
    expect(chargeDeltaAfterBody).not.toMatch(/filter:\s*blur/);
    expect(layoutCss).toMatch(/\.charge-delta[\s\S]*transform:\s*translate3d\(var\(--charge-delta-drift-x,\s*0px\),\s*var\(--layout-size-charge-delta-shift-y-start\),\s*0\)\s*scale\(0\.88\)/);
    expect(layoutCss).toMatch(/\.charge-delta\.is-visible[\s\S]*scale\(1\)/);
    expect(chargeDeltaFadeoutBody).not.toMatch(/^\s*filter:/m);
    expect(layoutCss).toMatch(/\.charge-delta\.is-increase[\s\S]*--charge-delta-core:\s*rgba\(154,\s*226,\s*255,\s*0\.98\)/);
    expect(layoutCss).toMatch(/\.charge-delta\.is-decrease[\s\S]*--charge-delta-core:\s*rgba\(255,\s*177,\s*182,\s*0\.94\)/);
  });
});
