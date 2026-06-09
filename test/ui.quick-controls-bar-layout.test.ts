import * as fs from 'fs';
import * as path from 'path';

describe('quick controls bar layout', () => {
  test('desktop layout anchors quick controls near the bottom edge', () => {
    const cssPath = path.join(__dirname, '..', 'styles-layout-controls.css');
    const css = fs.readFileSync(cssPath, 'utf8');

    expect(css).toMatch(/#quick-controls-bar[\s\S]*bottom:\s*calc\(var\(--layout-stage-offset-y\)/);
    expect(css).toMatch(/#quick-controls-bar[\s\S]*position:\s*fixed/);
    expect(css).toMatch(/#quick-controls-bar[\s\S]*display:\s*flex/);
  });

  test('quick controls use console styling with stateful buttons and readable volume slider', () => {
    const cssPath = path.join(__dirname, '..', 'styles-layout-controls.css');
    const css = fs.readFileSync(cssPath, 'utf8');

    expect(css).toMatch(/#quick-controls-bar[\s\S]*clip-path:\s*polygon\(/);
    expect(css).toMatch(/#quick-controls-bar[\s\S]*backdrop-filter:\s*blur/);
    expect(css).toMatch(/#quick-controls-bar::before[\s\S]*linear-gradient\(90deg,\s*transparent,\s*rgba\(255,\s*224,\s*132/);
    expect(css).toMatch(/#resetBtn\.quick-control-btn[\s\S]*--quick-control-accent:\s*#ff8a7a/);
    expect(css).toMatch(/#autoToggleBtn\.quick-control-btn[\s\S]*--quick-control-accent:\s*#f2c95f/);
    expect(css).toMatch(/#muteBtn\.quick-control-btn[\s\S]*--quick-control-accent:\s*#7ed7ff/);
    expect(css).toMatch(/input\[type=range\]\.compact-slider\.quick-volume-slider[\s\S]*background:[\s\S]*linear-gradient\(90deg,\s*rgba\(242,\s*201,\s*95/);
    expect(css).toMatch(/input\[type=range\]\.compact-slider\.quick-volume-slider::-webkit-slider-thumb[\s\S]*box-shadow:/);
  });
});
