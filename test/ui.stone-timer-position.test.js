const fs = require('fs');
const path = require('path');

describe('stone timer position', () => {
  test('styles-board.css places inherited counter on center-left and evade counter on center-right', () => {
    const cssPath = path.join(__dirname, '..', 'styles-board.css');
    const css = fs.readFileSync(cssPath, 'utf8');

    expect(css).toMatch(/\.inherited-hyperactive-timer[\s\S]*left:\s*6px/);
    expect(css).toMatch(/\.inherited-hyperactive-timer[\s\S]*top:\s*50%/);
    expect(css).toMatch(/\.inherited-hyperactive-timer[\s\S]*translateY\(-50%\)/);

    expect(css).toMatch(/\.flip-evade-timer[\s\S]*right:\s*6px/);
    expect(css).toMatch(/\.flip-evade-timer[\s\S]*top:\s*50%/);
    expect(css).toMatch(/\.flip-evade-timer[\s\S]*translateY\(-50%\)/);
  });
});
