const fs = require('fs');
const path = require('path');

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
    expect(readCardNameBlock(css, '.card-item.visible[data-card-id="crystal_stone"] .card-name')).not.toMatch(/-webkit-text-stroke\s*:/);
  });

  test('special and rainbow name plates keep the same horizontal anchor as normal cards', () => {
    const cssPath = path.join(__dirname, '..', 'styles-cards.css');
    const css = fs.readFileSync(cssPath, 'utf8');

    expect(css).toMatch(/\.card-item\.visible\.cost-tier-special \.card-name,[\s\S]*?\.card-item\.visible\[data-card-id="rainbow_stone"\] \.card-name\s*\{[\s\S]*?left:\s*50%/);
    expect(css).not.toMatch(/\.card-item\.visible\.cost-tier-special \.card-name,[\s\S]*?\.card-item\.visible\[data-card-id="rainbow_stone"\] \.card-name\s*\{[\s\S]*?left:\s*49%/);
  });
});