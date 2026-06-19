const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..');

function readCss() {
  return fs.readFileSync(path.join(repoRoot, 'styles-layout-info.css'), 'utf8');
}

describe('observation gacha typography CSS', () => {
  test('uses reference-style display typography for the gacha modal', () => {
    const css = readCss();

    expect(css).toMatch(/Observation gacha typography fidelity pass/);
    expect(css).toMatch(/#gachaModal\s*{[\s\S]*--gacha-display-font:[\s\S]*CR-Kaisei Tokumin/);
    expect(css).toMatch(/#gachaModal \.gacha-title[\s\S]*font-family:\s*var\(--gacha-display-font\)/);
    expect(css).toMatch(/#gachaTenPullBtn \.gacha-pull-label[\s\S]*-webkit-text-stroke:/);
    expect(css).toMatch(/#gachaTenPullBtn \.gacha-pull-label[\s\S]*background:\s*linear-gradient/);
    expect(css).toMatch(/#gachaModal \.gacha-rate-row\[data-gacha-rarity="exr"\][\s\S]*--gacha-type-glow:/);
  });
});
