import {
  expectCssBlockNotToContain,
  expectCssBlockToContain,
  readRepoTextFile
} from './helpers/css-test-helpers';

describe('card CSS medallion frame treatment', () => {
  test('cost badge renders as a number-only circular medallion', () => {
    const cardsCss = readRepoTextFile('styles-cards.css');

    expectCssBlockToContain(cardsCss, '.card-cost-badge', /aspect-ratio:\s*1\s*\/\s*1/);
    expectCssBlockToContain(cardsCss, '.card-cost-badge', /border-radius:\s*50%/);
    expectCssBlockToContain(cardsCss, '.card-cost-badge', /align-items:\s*center/);
    expectCssBlockToContain(cardsCss, '.card-cost-badge::before', /content:\s*''/);
    expectCssBlockToContain(cardsCss, '.card-cost-badge .cost-label', /display:\s*none/);
    expectCssBlockNotToContain(cardsCss, '.card-cost-badge::before', /--card-tier-cost-glyph/);
  });

  test('visible card face uses arcane ring and hard corner frame layers', () => {
    const cardsCss = readRepoTextFile('styles-cards.css');

    expectCssBlockToContain(cardsCss, '.card-item.visible', /--card-tier-rune-ring:/);
    expectCssBlockToContain(cardsCss, '.card-item.visible::before', /clip-path:\s*polygon\(/);
    expectCssBlockToContain(cardsCss, '.card-item.visible::after', /--card-tier-rune-ring/);
    expectCssBlockToContain(cardsCss, '.card-name', /clip-path:\s*polygon\(8% 0/);
    expectCssBlockToContain(cardsCss, ':is(#hand-black, #hand-white) .card-item.selected', /box-shadow:[\s\S]*var\(--card-selected-aura/);
  });
});
