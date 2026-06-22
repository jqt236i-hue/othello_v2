import * as fs from 'fs';
import * as path from 'path';

describe('background skin first paint CSS default', () => {
  test('uses the current default background before JS skin controls initialize', () => {
    const css = fs.readFileSync(path.join(__dirname, '..', 'styles-base.css'), 'utf8');
    const bodyRule = css.match(/body\s*\{[\s\S]*?\n\}/)?.[0] || '';

    expect(bodyRule).toContain('--app-background-image: url("assets/images/background/デフォルト25.png");');
    expect(bodyRule).not.toContain('--app-background-image: url("assets/images/background/default.png");');
  });
});
