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
});
