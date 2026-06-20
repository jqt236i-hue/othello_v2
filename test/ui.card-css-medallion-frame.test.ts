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

  test('visible card face uses hard corner frame layers without inner circular ornaments', () => {
    const cardsCss = readRepoTextFile('styles-cards.css');

    expectCssBlockToContain(cardsCss, '.card-item', /--card-frame-pentagon:\s*polygon\(50% 0,\s*93% 0,\s*100% 7%/);
    expectCssBlockNotToContain(cardsCss, '.card-item.visible', /--card-tier-rune-ring/);
    expectCssBlockToContain(cardsCss, '.card-item.visible::before', /clip-path:\s*polygon\(/);
    expectCssBlockNotToContain(cardsCss, '.card-item.visible::after', /radial-gradient\(ellipse/);
    expectCssBlockNotToContain(cardsCss, '.card-item.visible::after', /conic-gradient/);
    expectCssBlockToContain(cardsCss, '.card-name', /clip-path:\s*polygon\(8% 0/);
    expectCssBlockToContain(cardsCss, ':is(#hand-black, #hand-white) .card-item.selected', /box-shadow:[\s\S]*var\(--card-selected-aura/);
  });

  test('cost tiers expose saturated shared frame palettes', () => {
    const cardsCss = readRepoTextFile('styles-cards.css');

    expectCssBlockToContain(cardsCss, '.card-item.visible.cost-tier-blue', /--card-tier-bg-a:\s*#073b7a/);
    expectCssBlockToContain(cardsCss, '.card-item.visible.cost-tier-red', /--card-tier-bg-a:\s*#0b5e30/);
    expectCssBlockToContain(cardsCss, '.card-item.visible.cost-tier-special', /--card-tier-bg-a:\s*#7a1f12/);
    expectCssBlockToContain(cardsCss, '.card-item.visible.cost-tier-purple', /--card-tier-bg-a:\s*#43156f/);
    expectCssBlockToContain(cardsCss, '.card-item.visible.cost-tier-gold', /--card-tier-bg-a:\s*#6d4708/);
  });

  test('special card face uses a distinct stone slab treatment', () => {
    const cardsCss = readRepoTextFile('styles-cards.css');

    expectCssBlockToContain(cardsCss, '.card-item.visible.special-card-face', /--special-card-stone-shape:\s*polygon\(/);
    expectCssBlockToContain(cardsCss, '.card-item.visible.special-card-face', /clip-path:\s*var\(--special-card-stone-shape\)/);
    expectCssBlockToContain(cardsCss, '.card-item.visible.special-card-face', /--card-tier-border:\s*#b9c4b7/);
    expectCssBlockToContain(cardsCss, '.card-item.visible.special-card-face .special-card-sigil', /display:\s*none/);
  });
});
