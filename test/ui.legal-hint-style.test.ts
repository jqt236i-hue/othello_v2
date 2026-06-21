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

    expect(css).toMatch(/#board-expansion-layer\s+\.cell-expanded\.legal,\s*#board-expansion-layer\s+\.cell-expanded\.legal-free,\s*#board-expansion-layer\s+\.cell-expanded\.selectable-friendly\s*\{[\s\S]*?linear-gradient\(180deg,\s*rgba\(114,\s*230,\s*212,\s*0\.06\),\s*rgba\(0,\s*0,\s*0,\s*0\.04\)\)[\s\S]*?linear-gradient\(135deg,\s*rgba\(11,\s*102,\s*91,\s*0\.70\),\s*rgba\(6,\s*72,\s*64,\s*0\.66\)\)[\s\S]*?box-shadow:\s*[\s\S]*?inset 0 0 calc\(12px \* var\(--layout-stage-scale\)\) rgba\(116,\s*255,\s*228,\s*0\.05\)[\s\S]*?\}/);
  });

  test('styles-board.css keeps normal legal hint cells slightly more transparent than the bright jade draft', () => {
    const css = fs.readFileSync(path.join(__dirname, '..', 'styles-board.css'), 'utf8');

    expect(css).toMatch(/\.cell\.legal,\s*\.cell\.legal-free\s*\{[\s\S]*?linear-gradient\(180deg,\s*rgba\(120,\s*232,\s*214,\s*0\.07\),\s*rgba\(0,\s*0,\s*0,\s*0\.04\)\)[\s\S]*?linear-gradient\(135deg,\s*rgba\(13,\s*108,\s*96,\s*0\.72\),\s*rgba\(7,\s*76,\s*68,\s*0\.68\)\)[\s\S]*?box-shadow:\s*[\s\S]*?inset 0 0 calc\(13px \* var\(--layout-stage-scale\)\) rgba\(116,\s*255,\s*228,\s*0\.06\)[\s\S]*?inset 0 0 0 calc\(1px \* var\(--layout-stage-scale\)\) rgba\(160,\s*255,\s*226,\s*0\.05\)[\s\S]*?inset 0 calc\(1px \* var\(--layout-stage-scale\)\) 0 rgba\(224,\s*255,\s*249,\s*0\.05\)[\s\S]*?\}/);
  });

  test('styles-responsive.css does not restore legal hint circle hover styles', () => {
    const css = fs.readFileSync(path.join(__dirname, '..', 'styles-responsive.css'), 'utf8');

    expect(css).not.toMatch(/\.cell\.legal:hover::after/);
    expect(css).toMatch(/\.cell\.legal:hover,\s*\.cell\.legal-free:hover,\s*\.cell\.selectable-friendly:hover/);
  });
});
