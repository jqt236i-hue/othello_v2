const fs = require('fs');
const path = require('path');

describe('stone shadow styles', () => {
    test('styles-variables.css contains shadow variables', () => {
        const css = fs.readFileSync(path.join(__dirname, '..', 'styles-variables.css'), 'utf8');
        expect(css).toMatch(/--stone-shadow-color/);
        expect(css).toMatch(/--stone-shadow-blur/);
        expect(css).toMatch(/--stone-shadow-offset-y/);
    });

    test('styles-stone-shadows.css exists and contains .disc::after selector', () => {
        const css = fs.readFileSync(path.join(__dirname, '..', 'styles-stone-shadows.css'), 'utf8');
        expect(css).toMatch(/html\.stone-shadow-enabled\s+\.disc::after/);
        expect(css).toMatch(/filter:\s*drop-shadow/);
        // Ensure special classes are covered so all stone types receive shadows
        expect(css).toMatch(/html\.stone-shadow-enabled\s+\.disc\.special-stone::before/);
        expect(css).toMatch(/html\.stone-shadow-enabled\s+\.disc\.perma-protected/);
        expect(css).toMatch(/html\.stone-shadow-enabled\s+\.disc\.bomb/);
        expect(css).toMatch(/html\.stone-shadow-enabled\s+\.disc\.gold/);
        // Ensure we override any explicit disabling rules
        expect(css).toMatch(/html\.stone-shadow-enabled\s+\.disc\.protected[\s\S]*!important/);
        expect(css).toMatch(/html\.stone-shadow-enabled\s+\.disc\.perma-protected[\s\S]*!important/);
    });
});