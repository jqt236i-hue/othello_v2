import * as fs from 'fs';
import * as path from 'path';
import { readDomCompatBoardCssSurface, readRepoTextFile } from './helpers/css-test-helpers';

function extractRuleBody(css: string, selector: string): string {
    const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const match = css.match(new RegExp(`${escapedSelector}\\s*\\{([\\s\\S]*?)\\n\\}`));
    expect(match).not.toBeNull();
    return match ? match[1] : '';
}

function extractRuleBodyContaining(css: string, selector: string, marker: string): string {
    const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const matches = Array.from(css.matchAll(new RegExp(`${escapedSelector}\\s*\\{([\\s\\S]*?)\\n\\}`, 'g')));
    const match = matches.find((candidate) => candidate[1].includes(marker));
    expect(match).toBeDefined();
    return match ? match[1] : '';
}

describe('stone shadow styles', () => {
    test('styles-variables.css contains shadow variables', () => {
        const css = fs.readFileSync(path.join(__dirname, '..', 'styles-variables.css'), 'utf8');
        expect(css).toMatch(/--stone-shadow-color/);
        expect(css).toMatch(/--stone-shadow-offset-x/);
        expect(css).toMatch(/--stone-shadow-offset-y/);
        expect(css).toMatch(/--stone-keyline-width/);
        expect(css).toMatch(/--stone-keyline-color/);
        expect(css).toMatch(/--board-shadow-outer/);
        expect(css).toMatch(/--cell-contact-shadow-color/);
        expect(css).toMatch(/--cell-contact-shadow-offset-x/);
        expect(css).not.toMatch(/--stone-shadow-blur/);
        expect(css).not.toMatch(/--cell-contact-shadow-blur/);
    });

    test('styles-stone-shadows.css enables only the canonical cell/disc shadow selectors', () => {
        const compatCss = readRepoTextFile('styles-board-dom-compat.css');
        const css = compatCss.slice(compatCss.indexOf('/* from styles-stone-shadows.css */'));
        const cellEnabledShadowBlock = extractRuleBody(css, 'html.stone-shadow-enabled [data-board-renderer="dom"] .cell.has-disc::before');
        const discEnabledShadowBlock = extractRuleBody(css, 'html.stone-shadow-enabled [data-board-renderer="dom"] .disc::before');
        expect(css).toMatch(/html\.stone-shadow-enabled\s+\[data-board-renderer="dom"\]\s+\.cell\.has-disc::before/);
        expect(css).toMatch(/html\.stone-shadow-enabled\s+\[data-board-renderer="dom"\]\s+\.disc::before/);
        expect(cellEnabledShadowBlock).toMatch(/opacity:\s*0\.48/);
        expect(discEnabledShadowBlock).toMatch(/opacity:\s*0\.53/);
        expect(css).not.toMatch(/:has\(/);
        expect(css).not.toMatch(/\.disc::after/);
        expect(css).not.toMatch(/special-stone-img/);
        expect(cellEnabledShadowBlock).not.toMatch(/drop-shadow/);
        expect(discEnabledShadowBlock).not.toMatch(/drop-shadow/);
    });

    test('styles-board.css contains board depth shadow, contact shadow, and disc skeleton', () => {
        const css = readDomCompatBoardCssSurface();
        const discRootBlock = css.match(/\.disc\s*\{[^}]*\}/);
        const blackDiscBlock = extractRuleBody(css, '.disc.black');
        const whiteDiscBlock = extractRuleBody(css, '.disc.white');
        const cellContactShadowBlock = extractRuleBody(css, '.cell.has-disc::before');
        const discShadowBlock = extractRuleBodyContaining(css, '.disc::before', '--shadow-layer-color:');
        const sharedShadowBlock = css.match(/\.cell\.has-disc::before,\s*\.disc::before\s*\{([\s\S]*?)\n\}/);
        expect(css).toMatch(/#board[\s\S]*filter:[\s\S]*var\(--board-contour-shadow\)/);
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
        expect(sharedShadowBlock).not.toBeNull();
        expect(sharedShadowBlock && sharedShadowBlock[1]).toMatch(/radial-gradient/);
        expect(sharedShadowBlock && sharedShadowBlock[1]).toMatch(/var\(--shadow-layer-color\)/);
        expect(sharedShadowBlock && sharedShadowBlock[1]).toMatch(/var\(--shadow-layer-color\)\s+60%/);
        expect(sharedShadowBlock && sharedShadowBlock[1]).toMatch(/transparent\s+100%/);
        expect(css).toMatch(/var\(--stone-shadow-offset-x\)/);
        expect(css).toMatch(/var\(--stone-shadow-offset-y\)/);
        expect(cellContactShadowBlock).toMatch(/--shadow-layer-color:\s*var\(--cell-contact-shadow-color\)/);
        expect(cellContactShadowBlock).not.toMatch(/filter:\s*blur/);
        expect(cellContactShadowBlock).toMatch(/left:\s*6%/);
        expect(cellContactShadowBlock).toMatch(/right:\s*2%/);
        expect(cellContactShadowBlock).toMatch(/bottom:\s*7%/);
        expect(cellContactShadowBlock).toMatch(/height:\s*31%/);
        expect(cellContactShadowBlock).toMatch(/--shadow-gradient-origin-x:\s*44%/);
        expect(cellContactShadowBlock).toMatch(/--shadow-gradient-origin-y:\s*44%/);
        expect(cellContactShadowBlock).toMatch(/translate\(var\(--cell-contact-shadow-offset-x\),\s*var\(--cell-contact-shadow-offset-y\)\)\s*scale\(1\.14,\s*0\.96\)/);
        expect(cellContactShadowBlock).toMatch(/z-index:\s*2/);
        expect(discShadowBlock).toMatch(/--shadow-layer-color:\s*var\(--stone-shadow-color\)/);
        expect(discShadowBlock).not.toMatch(/filter:\s*blur/);
        expect(discShadowBlock).toMatch(/inset:\s*30%\s+-14%\s+-26%\s+20%/);
        expect(discShadowBlock).toMatch(/--shadow-gradient-origin-x:\s*40%/);
        expect(discShadowBlock).toMatch(/--shadow-gradient-origin-y:\s*34%/);
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
