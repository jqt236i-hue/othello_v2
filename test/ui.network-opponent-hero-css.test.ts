import { readRepoTextFile } from './helpers/css-test-helpers';

function readCssRuleBlock(css: string, selector: string): string {
  const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = css.match(new RegExp(`${escapedSelector}\\s*\\{([\\s\\S]*?)\\n\\}`, 'm'));
  return match ? match[1] : '';
}

describe('opponent portrait authored orientation', () => {
  test('uses the authored orientation for all right-side portraits, including hover', () => {
    const css = readRepoTextFile('styles-layout-characters.css');
    expect(readCssRuleBlock(css, '#cpu-character-img')).not.toMatch(/scaleX/);
    expect(readCssRuleBlock(css, '#cpu-character-img:hover')).not.toMatch(/scaleX/);
    expect(css).not.toContain('--cpu-character-face-direction');
  });

  test('has no image-specific orientation exceptions for the white hero or Lv10', () => {
    const css = readRepoTextFile('styles-layout-characters.css');
    expect(css).not.toContain('hero-white.png');
    expect(css).not.toContain('observed-dark-dragon-transparent.png');
  });

  test('uses the authored Lv10 orientation in the result portrait as well', () => {
    const css = readRepoTextFile('styles-layout-result.css');
    expect(readCssRuleBlock(css, '.result-dialogues .character-name::before')).not.toMatch(/scaleX/);
    expect(css).not.toContain('observed-dark-dragon-transparent.png');
  });
});
