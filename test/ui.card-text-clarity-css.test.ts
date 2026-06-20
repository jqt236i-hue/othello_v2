import * as fs from 'fs';
import * as path from 'path';

function readCardNameBlock(css, selector) {
  const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = css.match(new RegExp(`${escapedSelector}\\s*\\{([\\s\\S]*?)\\n\\}`, 'm'));
  return match ? match[1] : '';
}

describe('card text clarity css', () => {
  test('base card name plate avoids opacity and text stroke blur', () => {
    const cssPath = path.join(__dirname, '..', 'styles-cards.css');
    const css = fs.readFileSync(cssPath, 'utf8');
    const block = readCardNameBlock(css, '.card-name');

    expect(block).toContain('text-rendering: optimizeLegibility;');
    expect(block).toContain('left: 50%;');
    expect(block).toContain('transform: translateX(-50%);');
    expect(block).not.toMatch(/opacity\s*:/);
    expect(block).not.toMatch(/-webkit-text-stroke\s*:/);
  });

  test('high-tier card name overrides do not reintroduce text stroke', () => {
    const cssPath = path.join(__dirname, '..', 'styles-cards.css');
    const css = fs.readFileSync(cssPath, 'utf8');

    expect(readCardNameBlock(css, '.card-item.visible.cost-tier-gold .card-name')).not.toMatch(/-webkit-text-stroke\s*:/);
    expect(readCardNameBlock(css, '.card-item.visible[data-card-id="rainbow_stone"] .card-name')).not.toMatch(/-webkit-text-stroke\s*:/);
  });

  test('special and rainbow name plates keep the same horizontal anchor as normal cards', () => {
    const cssPath = path.join(__dirname, '..', 'styles-cards.css');
    const css = fs.readFileSync(cssPath, 'utf8');

    expect(css).toMatch(/\.card-item\.visible\.cost-tier-special \.card-name,[\s\S]*?\.card-item\.visible\[data-card-id="rainbow_stone"\] \.card-name\s*\{[\s\S]*?left:\s*50%/);
    expect(css).not.toMatch(/\.card-item\.visible\.cost-tier-special \.card-name,[\s\S]*?\.card-item\.visible\[data-card-id="rainbow_stone"\] \.card-name\s*\{[\s\S]*?left:\s*49%/);
  });

  test('special card title plate uses the premium readable treatment', () => {
    const cssPath = path.join(__dirname, '..', 'styles-cards.css');
    const css = fs.readFileSync(cssPath, 'utf8');
    const block = readCardNameBlock(css, '.card-item.visible.special-card-face .card-name');

    expect(block).toContain('backdrop-filter: blur(');
    expect(block).toContain('letter-spacing: 0;');
    expect(block).toContain('font-weight: 800;');
  });

  test('hand normal cards raise title size without changing special title rules', () => {
    const cssPath = path.join(__dirname, '..', 'styles-cards.css');
    const css = fs.readFileSync(cssPath, 'utf8');

    expect(css).toMatch(/#hand-black \.card-item:not\(\.visible\.cost-tier-special\):not\(\.visible\[data-card-id="rainbow_stone"\]\):not\(\.visible\.special-card-face\) \.card-name\s*\{[\s\S]*font-size:\s*0\.72em/);
    expect(css).toMatch(/#hand-white \.card-item:not\(\.visible\.cost-tier-special\):not\(\.visible\[data-card-id="rainbow_stone"\]\):not\(\.visible\.special-card-face\) \.card-name\s*\{[\s\S]*font-size:\s*0\.9em/);
    expect(readCardNameBlock(css, '.card-item.visible.special-card-face .card-name')).toContain('font-size: 0.82em;');
  });
});
