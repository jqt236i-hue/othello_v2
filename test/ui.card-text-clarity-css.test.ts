import * as fs from 'fs';
import * as path from 'path';

function readCardNameBlock(css, selector) {
  const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = css.match(new RegExp(`${escapedSelector}\\s*\\{([\\s\\S]*?)\\n\\}`, 'm'));
  return match ? match[1] : '';
}

const SPECIAL_NAME_SELECTOR =
  '.card-item.visible:is([data-card-id="rainbow_stone"], [data-card-id="infinite_chain_01"], [data-card-id="infinite_01"]) .card-name';
const INFINITE_NAME_SELECTOR =
  '.card-item.visible:is([data-card-id="infinite_chain_01"], [data-card-id="infinite_01"]) .card-name';
const NORMAL_HAND_NAME_SELECTOR =
  ':is(#hand-black, #hand-white) .card-item:not(.visible.cost-tier-special):not(.visible[data-card-id="rainbow_stone"]):not(.visible[data-card-id="infinite_chain_01"]):not(.visible[data-card-id="infinite_01"]):not(.visible.special-card-face) .card-name';
const NORMAL_HAND_BLACK_NAME_SELECTOR =
  '#hand-black .card-item:not(.visible.cost-tier-special):not(.visible[data-card-id="rainbow_stone"]):not(.visible[data-card-id="infinite_chain_01"]):not(.visible[data-card-id="infinite_01"]):not(.visible.special-card-face) .card-name';
const NORMAL_HAND_WHITE_NAME_SELECTOR =
  '#hand-white .card-item:not(.visible.cost-tier-special):not(.visible[data-card-id="rainbow_stone"]):not(.visible[data-card-id="infinite_chain_01"]):not(.visible[data-card-id="infinite_01"]):not(.visible.special-card-face) .card-name';

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
    expect(readCardNameBlock(css, SPECIAL_NAME_SELECTOR)).not.toMatch(/-webkit-text-stroke\s*:/);
    expect(readCardNameBlock(css, INFINITE_NAME_SELECTOR)).not.toMatch(/-webkit-text-stroke\s*:/);
  });

  test('special and bespoke name plates keep the same horizontal anchor as normal cards', () => {
    const cssPath = path.join(__dirname, '..', 'styles-cards.css');
    const css = fs.readFileSync(cssPath, 'utf8');

    expect(css).toMatch(/\.card-item\.visible\.cost-tier-special \.card-name,[\s\S]*?\.card-item\.visible:is\(\[data-card-id="rainbow_stone"\],\s*\[data-card-id="infinite_chain_01"\],\s*\[data-card-id="infinite_01"\]\) \.card-name\s*\{[\s\S]*?left:\s*50%/);
    expect(css).not.toMatch(/\.card-item\.visible\.cost-tier-special \.card-name,[\s\S]*?\.card-item\.visible:is\(\[data-card-id="rainbow_stone"\],\s*\[data-card-id="infinite_chain_01"\],\s*\[data-card-id="infinite_01"\]\) \.card-name\s*\{[\s\S]*?left:\s*49%/);
  });

  test('special card title plate uses the premium readable treatment', () => {
    const cssPath = path.join(__dirname, '..', 'styles-cards.css');
    const css = fs.readFileSync(cssPath, 'utf8');
    const block = readCardNameBlock(css, '.card-item.visible.special-card-face .card-name');

    expect(block).toContain('backdrop-filter: blur(');
    expect(block).toContain('letter-spacing: 0;');
    expect(block).toContain('font-weight: 800;');
  });

  test('hand normal cards use more of the title plate without changing special title rules', () => {
    const cssPath = path.join(__dirname, '..', 'styles-cards.css');
    const css = fs.readFileSync(cssPath, 'utf8');
    const normalHandBlock = readCardNameBlock(css, NORMAL_HAND_NAME_SELECTOR);

    expect(normalHandBlock).toMatch(/width:\s*calc\(100%\s*-\s*\(2px\s*\*\s*var\(--layout-stage-scale\)\)\)/);
    expect(normalHandBlock).toContain('display: flex;');
    expect(normalHandBlock).toContain('align-items: center;');
    expect(normalHandBlock).toContain('justify-content: center;');
    expect(normalHandBlock).toMatch(/min-height:\s*calc\(34px\s*\*\s*var\(--layout-stage-scale\)\)/);
    expect(normalHandBlock).toMatch(/bottom:\s*calc\(1px\s*\*\s*var\(--layout-stage-scale\)\)/);
    expect(normalHandBlock).toContain('white-space: normal;');
    expect(readCardNameBlock(css, NORMAL_HAND_BLACK_NAME_SELECTOR)).toContain('font-size: 0.98em;');
    expect(readCardNameBlock(css, NORMAL_HAND_WHITE_NAME_SELECTOR)).toContain('font-size: 1.14em;');
    expect(readCardNameBlock(css, '.card-item.visible.special-card-face .card-name')).toContain('font-size: 0.82em;');
  });
});
