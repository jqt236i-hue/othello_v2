const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..');

function readCss() {
  return fs.readFileSync(path.join(repoRoot, 'styles-layout-info.css'), 'utf8');
}

describe('observation gacha typography CSS', () => {
  test('uses skin-controlled display typography for the gacha modal', () => {
    const css = readCss();

    expect(css).toMatch(/Observation gacha typography fidelity pass/);
    expect(css).toMatch(/#gachaModal\s*{[\s\S]*--gacha-display-font:\s*var\(--selected-app-font-family\)/);
    expect(css).toMatch(/#gachaModal\s*{[\s\S]*--gacha-body-font:\s*var\(--selected-app-font-readable-family\)/);
    expect(css).toMatch(/#gachaModal\s*{[\s\S]*--gacha-number-font:\s*var\(--selected-app-font-accent-family\)/);
    expect(css).toMatch(/#gachaModal \.gacha-title[\s\S]*font-family:\s*var\(--gacha-display-font\)/);
    expect(css).toMatch(/#gachaTenPullBtn \.gacha-pull-label[\s\S]*-webkit-text-stroke:/);
    expect(css).toMatch(/#gachaTenPullBtn \.gacha-pull-label[\s\S]*background:\s*linear-gradient/);
    expect(css).toMatch(/#gachaModal \.gacha-rate-row\[data-gacha-rarity="exr"\][\s\S]*--gacha-type-glow:/);
  });

  test('uses skin-controlled typography for the network modal', () => {
    const css = readCss();

    expect(css).toMatch(/Network lobby font skin fidelity pass/);
    expect(css).toMatch(/#networkModal\s*{[\s\S]*--network-lobby-display-font:\s*var\(--selected-app-font-family\)/);
    expect(css).toMatch(/#networkModal\s*{[\s\S]*--network-lobby-body-font:\s*var\(--selected-app-font-readable-family\)/);
    expect(css).toMatch(/#networkModal\s*{[\s\S]*--network-lobby-number-font:\s*var\(--selected-app-font-accent-family\)/);
    expect(css).toMatch(/#networkModal\s+:is\([\s\S]*\.network-title[\s\S]*font-family:\s*var\(--network-lobby-display-font\)/);
    expect(css).toMatch(/#networkModal\s+:is\([\s\S]*#networkBoardSizeSummary[\s\S]*font-family:\s*var\(--network-lobby-number-font\)/);
  });
});
