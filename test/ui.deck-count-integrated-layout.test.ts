import * as fs from 'fs';
import * as path from 'path';

describe('deck count integrated layout', () => {
  test('deck count is anchored inside the deck body with an integrated counter plate', () => {
    const cardsCss = fs.readFileSync(path.join(__dirname, '..', 'styles-cards.css'), 'utf8');
    const varsCss = fs.readFileSync(path.join(__dirname, '..', 'styles-variables.css'), 'utf8');

    expect(varsCss).toMatch(/--layout-size-deck-count-offset:\s*calc\(5px\s*\*\s*var\(--layout-stage-scale\)\)/);
    expect(cardsCss).toMatch(/\.deck-stack[\s\S]*overflow:\s*hidden/);
    expect(cardsCss).toMatch(/\.deck-stack\s+\.deck-count[\s\S]*bottom:\s*var\(--layout-size-deck-count-offset\)/);
    expect(cardsCss).toMatch(/\.deck-stack\s+\.deck-count[\s\S]*padding:\s*calc\(3px\s*\*\s*var\(--layout-stage-scale\)\)\s+calc\(7px\s*\*\s*var\(--layout-stage-scale\)\)/);
    expect(cardsCss).toMatch(/\.deck-stack\s+\.deck-count[\s\S]*background:\s*linear-gradient\(180deg,\s*rgba\(12,\s*10,\s*8,\s*0\.82\)\s*0%,\s*rgba\(30,\s*22,\s*16,\s*0\.74\)\s*100%\)/);
    expect(cardsCss).toMatch(/\.deck-stack\s+\.deck-count[\s\S]*border:\s*var\(--layout-size-border-thin\)\s+solid\s+rgba\(212,\s*175,\s*55,\s*0\.35\)/);
  });
});
