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
    expectCssBlockNotToContain(cardsCss, '.card-cost-badge', /conic-gradient/);
    expectCssBlockNotToContain(cardsCss, '.card-cost-badge', /radial-gradient\(circle at 50% 48%/);
    expectCssBlockToContain(cardsCss, '.card-cost-badge::before', /content:\s*''/);
    expectCssBlockNotToContain(cardsCss, '.card-cost-badge::before', /background:/);
    expectCssBlockToContain(cardsCss, '.card-cost-badge .cost-label', /display:\s*none/);
    expectCssBlockToContain(cardsCss, '.card-cost-badge .cost-value', /text-shadow:/);
    expectCssBlockToContain(cardsCss, '.card-item.visible:not(.cost-tier-white)', /--card-tier-badge-specular:\s*rgba\(255,\s*255,\s*255,\s*0\.34\)/);
    expectCssBlockToContain(cardsCss, '.card-item.visible:not(.cost-tier-white)', /--card-tier-badge-shade:\s*linear-gradient\(180deg,\s*rgba\(3,\s*4,\s*8,\s*0\.06\)\s*0%,\s*rgba\(3,\s*4,\s*8,\s*0\.28\)\s*100%\)/);
    expectCssBlockToContain(cardsCss, '.card-item.visible.cost-tier-white', /--card-tier-badge-hi:\s*rgba\(255,\s*255,\s*255,\s*0\.56\)/);
    expectCssBlockNotToContain(cardsCss, '.card-cost-badge::before', /--card-tier-cost-glyph/);
  });

  test('visible card face uses hard corner frame layers without inner circular ornaments', () => {
    const cardsCss = readRepoTextFile('styles-cards.css');

    expectCssBlockToContain(cardsCss, '.card-item', /--card-frame-pentagon:\s*polygon\(50% 0,\s*93% 0,\s*100% 7%/);
    expectCssBlockNotToContain(cardsCss, '.card-item.visible', /--card-tier-rune-ring/);
    expectCssBlockToContain(cardsCss, '.card-item.visible::before', /clip-path:\s*polygon\(/);
    expectCssBlockToContain(cardsCss, '.card-item.visible::before', /linear-gradient\(90deg,\s*transparent 0 10%,\s*rgba\(255,\s*255,\s*255,\s*0\.07\) 10% 22%/);
    expectCssBlockToContain(cardsCss, '.card-item.visible::before', /inset 0 0 0 calc\(3px \* var\(--layout-stage-scale\)\) var\(--card-tier-inner-border/);
    expectCssBlockToContain(cardsCss, '.card-item.visible::before', /opacity:\s*0\.76/);
    expectCssBlockNotToContain(cardsCss, '.card-item.visible::after', /radial-gradient\(ellipse/);
    expectCssBlockNotToContain(cardsCss, '.card-item.visible::after', /conic-gradient/);
    expectCssBlockToContain(cardsCss, '.card-item.visible::after', /opacity:\s*0\.58/);
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
    expectCssBlockToContain(cardsCss, '.card-item.visible:is([data-card-id="infinite_chain_01"], [data-card-id="infinite_01"])', /--card-tier-bg-a:\s*#050403/);
    expectCssBlockToContain(cardsCss, '.card-item.visible:is([data-card-id="infinite_chain_01"], [data-card-id="infinite_01"])', /--card-tier-bg-b:\s*#0c0905/);
    expectCssBlockToContain(cardsCss, '.card-item.visible:is([data-card-id="infinite_chain_01"], [data-card-id="infinite_01"])', /--card-tier-bg-c:\s*#1f1608/);
    expectCssBlockToContain(cardsCss, '.card-item.visible:is([data-card-id="infinite_chain_01"], [data-card-id="infinite_01"])', /--card-tier-border:\s*#d7b35a/);
    expectCssBlockToContain(cardsCss, '.card-item.visible:is([data-card-id="infinite_chain_01"], [data-card-id="infinite_01"]) .card-special-art', /--card-special-art-opacity:\s*0\.36/);
    expectCssBlockToContain(cardsCss, '.card-item.visible:is([data-card-id="infinite_chain_01"], [data-card-id="infinite_01"]) .card-special-art', /brightness\(0\.46\)/);
  });

  test('special card face uses a distinct stone slab treatment', () => {
    const cardsCss = readRepoTextFile('styles-cards.css');

    expectCssBlockToContain(cardsCss, '.card-item.visible.special-card-face', /--special-card-stone-shape:\s*polygon\(/);
    expectCssBlockToContain(cardsCss, '.card-item.visible.special-card-face', /clip-path:\s*var\(--special-card-stone-shape\)/);
    expectCssBlockToContain(cardsCss, '.card-item.visible.special-card-face', /--card-tier-border:\s*#b9c4b7/);
    expectCssBlockToContain(cardsCss, '.card-item.visible.special-card-face::before', /opacity:\s*0\.78/);
    expectCssBlockToContain(cardsCss, '.card-item.visible.special-card-face .special-card-sigil', /display:\s*none/);
  });
});
