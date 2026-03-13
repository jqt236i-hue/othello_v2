const fs = require('fs');
const path = require('path');

describe('stone timer position', () => {
  test('styles-board.css places inherited counter on center-left, flip evade on center-right, and destroy evade on bottom-left', () => {
    const cssPath = path.join(__dirname, '..', 'styles-board.css');
    const css = fs.readFileSync(cssPath, 'utf8');

    expect(css).toMatch(/\.inherited-hyperactive-timer[\s\S]*left:\s*calc\(6px/);
    expect(css).toMatch(/\.inherited-hyperactive-timer[\s\S]*top:\s*50%/);
    expect(css).toMatch(/\.inherited-hyperactive-timer[\s\S]*translateY\(-50%\)/);

    expect(css).toMatch(/\.flip-evade-timer[\s\S]*right:\s*calc\(6px/);
    expect(css).toMatch(/\.flip-evade-timer[\s\S]*top:\s*50%/);
    expect(css).toMatch(/\.flip-evade-timer[\s\S]*translateY\(-50%\)/);

    expect(css).toMatch(/\.destroy-evade-timer[\s\S]*left:\s*calc\(6px/);
    expect(css).toMatch(/\.destroy-evade-timer[\s\S]*bottom:\s*calc\(4px/);
    expect(css).toMatch(/\.destroy-evade-timer[\s\S]*top:\s*auto/);
  });
});
