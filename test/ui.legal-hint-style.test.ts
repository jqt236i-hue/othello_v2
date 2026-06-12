import * as fs from 'fs';
import * as path from 'path';

describe('legal hint styles', () => {
  test('styles-board.css removes circle pseudo elements from legal hint states', () => {
    const css = fs.readFileSync(path.join(__dirname, '..', 'styles-board.css'), 'utf8');
    const timeStopGlowBlock = css.match(/@keyframes timeStopLegalGlow\s*\{[\s\S]*?\n\}/);

    expect(css).not.toMatch(/\.cell\.legal::after/);
    expect(css).not.toMatch(/\.cell\.legal-free::after/);
    expect(css).not.toMatch(/\.cell\.selectable-friendly::after/);
    expect(css).not.toMatch(/\.cell\.random-spawn-preview::after/);
    expect(css).not.toMatch(/time-stop-legal-emphasis::after/);
    expect(css).toContain('@keyframes timeStopLegalGlow');
    expect(css).toContain('body.time-stop-active #board .cell.time-stop-legal-emphasis {');
    expect(css).toContain('.cell.random-spawn-preview {');
    expect(timeStopGlowBlock?.[0]).not.toMatch(/background-color:/);
  });

  test('styles-board.css gives expanded legal hint cells enough specificity to override their base background', () => {
    const css = fs.readFileSync(path.join(__dirname, '..', 'styles-board.css'), 'utf8');

    expect(css).toMatch(/#board\s+\.cell-expanded\.legal,\s*#board\s+\.cell-expanded\.legal-free,\s*#board\s+\.cell-expanded\.selectable-friendly\s*\{[\s\S]*?background:\s*[\s\S]*?linear-gradient\([\s\S]*?box-shadow:\s*[\s\S]*?inset 0 0 calc\(14px \* var\(--layout-stage-scale\)\) rgba\(116,\s*255,\s*228,\s*0\.08\)[\s\S]*?\}/);
  });

  test('styles-responsive.css does not restore legal hint circle hover styles', () => {
    const css = fs.readFileSync(path.join(__dirname, '..', 'styles-responsive.css'), 'utf8');

    expect(css).not.toMatch(/\.cell\.legal:hover::after/);
    expect(css).toMatch(/\.cell\.legal:hover,\s*\.cell\.legal-free:hover,\s*\.cell\.selectable-friendly:hover/);
  });
});
