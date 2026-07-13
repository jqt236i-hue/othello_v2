import * as fs from 'fs';
import * as path from 'path';

function extractRuleBody(css: string, selector: string): string {
    const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const match = css.match(new RegExp(`${escapedSelector}\\s*\\{([\\s\\S]*?)\\n\\}`));
    expect(match).not.toBeNull();
    return match ? match[1] : '';
}

describe('stone shadow styles', () => {
    test('styles-variables.css contains shadow variables', () => {
        const css = fs.readFileSync(path.join(__dirname, '..', 'styles-variables.css'), 'utf8');
        expect(css).toMatch(/--stone-shadow-color/);
        expect(css).toMatch(/--stone-shadow-blur/);
        expect(css).toMatch(/--stone-shadow-offset-x/);
        expect(css).toMatch(/--stone-shadow-offset-y/);
        expect(css).toMatch(/--stone-keyline-width/);
        expect(css).toMatch(/--stone-keyline-color/);
        expect(css).toMatch(/--board-shadow-outer/);
        expect(css).toMatch(/--cell-contact-shadow-color/);
        expect(css).toMatch(/--cell-contact-shadow-offset-x/);
    });

    test('styles-stone-shadows.css enables only the canonical cell/disc shadow selectors', () => {
        const css = fs.readFileSync(path.join(__dirname, '..', 'styles-stone-shadows.css'), 'utf8');
        const cellEnabledShadowBlock = extractRuleBody(css, 'html.stone-shadow-enabled .cell.has-disc::before');
        const discEnabledShadowBlock = extractRuleBody(css, 'html.stone-shadow-enabled .disc::before');
        expect(css).toMatch(/html\.stone-shadow-enabled\s+\.cell\.has-disc::before/);
        expect(css).toMatch(/html\.stone-shadow-enabled\s+\.disc::before/);
        expect(cellEnabledShadowBlock).toMatch(/opacity:\s*0\.68/);
        expect(discEnabledShadowBlock).toMatch(/opacity:\s*0\.76/);
        expect(css).not.toMatch(/:has\(/);
        expect(css).not.toMatch(/\.disc::after/);
        expect(css).not.toMatch(/special-stone-img/);
        expect(css).not.toMatch(/drop-shadow/);
    });

    test('styles-board.css contains board depth shadow, contact shadow, and disc skeleton', () => {
        const css = fs.readFileSync(path.join(__dirname, '..', 'styles-board.css'), 'utf8');
        const discRootBlock = css.match(/\.disc\s*\{[^}]*\}/);
        const blackDiscBlock = extractRuleBody(css, '.disc.black');
        const whiteDiscBlock = extractRuleBody(css, '.disc.white');
        const cellContactShadowBlock = extractRuleBody(css, '.cell.has-disc::before');
        const discShadowBlock = extractRuleBody(css, '.disc::before');
        expect(css).toMatch(/#board[\s\S]*box-shadow:[\s\S]*var\(--board-shadow-outer\)/);
        expect(css).toMatch(/\.cell\.has-disc::before/);
        expect(css).toMatch(/var\(--cell-contact-shadow-color\)/);
        expect(css).toMatch(/var\(--cell-contact-shadow-offset-x\)/);
        expect(css).toMatch(/\.disc__face/);
        expect(css).toMatch(/\.disc__face::after/);
        expect(css).toMatch(/\.disc__base-image/);
        expect(css).toMatch(/\.disc__overlay-image/);
        expect(css).toMatch(/\.disc__hud/);
        expect(css).toMatch(/html\.stone-shadow-enabled\s+\.disc::before/);
        expect(css).toMatch(/--disc-base-fallback-color/);
        expect(css).toMatch(/\.disc\[data-image-state=\"loaded\"\]\s+\.disc__face/);
        expect(css).toMatch(/\.disc\[data-image-state=\"fallback\"\]\.black/);
        expect(discRootBlock).not.toBeNull();
        expect(discRootBlock[0]).not.toMatch(/transition:/);
        expect(css).not.toMatch(/html\.stone-shadow-enabled\s+\.disc__face/);
        expect(css).toMatch(/radial-gradient/);
        expect(css).toMatch(/var\(--stone-shadow-offset-x\)/);
        expect(css).toMatch(/var\(--stone-shadow-offset-y\)/);
        expect(cellContactShadowBlock).toMatch(/radial-gradient/);
        expect(cellContactShadowBlock).toMatch(/filter:\s*blur\(var\(--cell-contact-shadow-blur\)\)/);
        expect(cellContactShadowBlock).toMatch(/left:\s*6%/);
        expect(cellContactShadowBlock).toMatch(/right:\s*2%/);
        expect(cellContactShadowBlock).toMatch(/bottom:\s*7%/);
        expect(cellContactShadowBlock).toMatch(/height:\s*31%/);
        expect(cellContactShadowBlock).toMatch(/ellipse at 44% 44%/);
        expect(cellContactShadowBlock).toMatch(/translate\(var\(--cell-contact-shadow-offset-x\),\s*var\(--cell-contact-shadow-offset-y\)\)\s*scale\(1\.14,\s*0\.96\)/);
        expect(cellContactShadowBlock).toMatch(/z-index:\s*2/);
        expect(discShadowBlock).toMatch(/radial-gradient/);
        expect(discShadowBlock).toMatch(/filter:\s*blur\(var\(--stone-shadow-blur\)\)/);
        expect(discShadowBlock).toMatch(/inset:\s*30%\s+-14%\s+-26%\s+20%/);
        expect(discShadowBlock).toMatch(/ellipse at 40% 34%/);
        expect(discShadowBlock).toMatch(/translate\(var\(--stone-shadow-offset-x\),\s*var\(--stone-shadow-offset-y\)\)\s*scale\(1\.30,\s*0\.78\)/);
        expect(blackDiscBlock).toMatch(/--stone-keyline-width:\s*max\(1px,\s*calc\(1px \* var\(--layout-stage-scale\)\)\)/);
        expect(blackDiscBlock).toMatch(/--stone-keyline-color:\s*rgba\(255,\s*255,\s*244,\s*0\.16\)/);
        expect(blackDiscBlock).toMatch(/--stone-keyline-inner-shade:\s*rgba\(0,\s*0,\s*0,\s*0\.46\)/);
        expect(blackDiscBlock).not.toMatch(/rgba\(174,\s*224,\s*176/);
        expect(whiteDiscBlock).toMatch(/--stone-keyline-width:\s*max\(1px,\s*calc\(1px \* var\(--layout-stage-scale\)\)\)/);
        expect(whiteDiscBlock).toMatch(/--stone-keyline-color:\s*rgba\(255,\s*255,\s*244,\s*0\.16\)/);
        expect(whiteDiscBlock).toMatch(/--stone-keyline-inner-shade:\s*rgba\(0,\s*0,\s*0,\s*0\.46\)/);
    });
});
