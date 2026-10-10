import { readRepoTextFile } from './helpers/css-test-helpers';

function readCssRuleBlock(css: string, selector: string): string {
  const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = css.match(new RegExp(`${escapedSelector}\\s*\\{([\\s\\S]*?)\\n\\}`, 'm'));
  return match ? match[1] : '';
}

describe('network opponent hero portrait CSS', () => {
  test('turns only the white network opponent toward the board', () => {
    const css = readRepoTextFile('styles-layout-characters.css');
    const block = readCssRuleBlock(css, '#cpu-character-img.is-network-opponent-hero[data-card-reversi-logical-src="assets/images/hero/hero-white.png"]');
    expect(block).toMatch(/--cpu-character-face-direction\s*:\s*-1\s*;/);
  });

  test('does not mirror the opponent hero image on the CPU portrait slot', () => {
    const css = readRepoTextFile('styles-layout-characters.css');
    const block = readCssRuleBlock(css, '#cpu-character-img.is-network-opponent-hero');

    expect(block).not.toMatch(/--cpu-character-face-direction\s*:\s*-1\s*;/);
  });
});
