const fs = require('fs');
const path = require('path');

describe('hand skin panel css', () => {
  test('centers the hand skin panel on screen', () => {
    const layoutCss = fs.readFileSync(path.join(__dirname, '..', 'styles-layout.css'), 'utf8');
    const responsiveCss = fs.readFileSync(path.join(__dirname, '..', 'styles-responsive.css'), 'utf8');

    expect(layoutCss).toMatch(/#handSkinPanel\s*\{[\s\S]*left:\s*50%;[\s\S]*top:\s*50%;[\s\S]*bottom:\s*auto;/);
    expect(layoutCss).toContain('transform: translate(-50%, calc(-50% + calc(8px * var(--layout-stage-scale)))) scale(0.98);');
    expect(layoutCss).toContain('transform: translate(-50%, -50%) scale(1);');
    expect(responsiveCss).toMatch(/#handSkinPanel\s*\{[\s\S]*left:\s*50%;[\s\S]*top:\s*50%;[\s\S]*bottom:\s*auto;/);
    expect(responsiveCss).toMatch(/html\.layout-stage-enabled #handSkinPanel\s*\{[\s\S]*left:\s*50%;[\s\S]*top:\s*50%;[\s\S]*bottom:\s*auto;/);
  });
});
