const fs = require('fs');
const path = require('path');

describe('responsive layout rules for narrow aspect ratio', () => {
  test('styles-responsive.css defines 16:10 to 5:4 safeguards', () => {
    const cssPath = path.join(__dirname, '..', 'styles-responsive.css');
    const css = fs.readFileSync(cssPath, 'utf8');

    expect(css).toMatch(/@media\s*\(max-aspect-ratio:\s*16\/10\)/);
    expect(css).toMatch(/@media\s*\(max-aspect-ratio:\s*3\/2\)/);
    expect(css).toMatch(/@media\s*\(max-aspect-ratio:\s*4\/3\)/);
    expect(css).toMatch(/@media\s*\(max-aspect-ratio:\s*5\/4\)/);
    expect(css).toMatch(/html\.sim-aspect-16-10\s+#board/);
    expect(css).toMatch(/html\.sim-aspect-3-2\s+#board/);
    expect(css).toMatch(/html\.sim-aspect-4-3\s+#effect-live-panel/);
    expect(css).toMatch(/html\.sim-aspect-5-4\s+#effect-live-panel/);
    expect(css).toMatch(/#effect-live-panel[\s\S]*left:\s*12px/);
    expect(css).toMatch(/#cpu-character-img[\s\S]*clamp\(/);
  });

  test('index.html accepts aspect simulation query and sets root class', () => {
    const htmlPath = path.join(__dirname, '..', 'index.html');
    const html = fs.readFileSync(htmlPath, 'utf8');

    expect(html).toMatch(/simAspect/);
    expect(html).toMatch(/sim-aspect/);
    expect(html).toMatch(/sim-aspect-16-10/);
    expect(html).toMatch(/sim-aspect-3-2/);
    expect(html).toMatch(/sim-aspect-4-3/);
    expect(html).toMatch(/sim-aspect-5-4/);
  });
});
