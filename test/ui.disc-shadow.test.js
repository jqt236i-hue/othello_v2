const fs = require('fs');
const path = require('path');

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
        expect(css).toMatch(/html\.stone-shadow-enabled\s+\.cell\.has-disc::before/);
        expect(css).toMatch(/html\.stone-shadow-enabled\s+\.disc::before/);
        expect(css).not.toMatch(/:has\(/);
        expect(css).not.toMatch(/\.disc::after/);
        expect(css).not.toMatch(/special-stone-img/);
        expect(css).not.toMatch(/drop-shadow/);
    });

    test('styles-board.css contains board depth shadow, contact shadow, and disc skeleton', () => {
        const css = fs.readFileSync(path.join(__dirname, '..', 'styles-board.css'), 'utf8');
        const discRootBlock = css.match(/\.disc\s*\{[^}]*\}/);
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
        expect(css).toMatch(/translate\(var\(--stone-shadow-offset-x\), var\(--stone-shadow-offset-y\)\)/);
    });
});
