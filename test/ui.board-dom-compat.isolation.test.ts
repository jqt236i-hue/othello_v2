import * as fs from 'fs';
import * as path from 'path';

const root = path.resolve(__dirname, '..');
const read = (relative: string) => fs.readFileSync(path.join(root, relative), 'utf8');

describe('DOM board compatibility isolation', () => {
  test('default browser entry and frame builder do not import the compatibility package', () => {
    const entry = read('entry-browser.js');
    const renderer = read('ui/board-renderer.ts');
    const fallbackStart = renderer.indexOf('function _createDomBoardVisualBackendForBoardRenderer()');
    const fallbackEnd = renderer.indexOf('function _playPixiBoardExpansionRevealSoundForBoardRenderer', fallbackStart);
    const fallbackFactory = renderer.slice(fallbackStart, fallbackEnd);
    const defaultGraph = renderer.slice(0, fallbackStart) + renderer.slice(fallbackEnd);

    expect(entry).not.toContain('board-dom-compat');
    expect(defaultGraph).not.toContain('board-dom-compat');
    expect(fallbackFactory).toContain("_require('./board-dom-compat/renderer')");
    expect(fallbackFactory).toContain("_require('./board-dom-compat/backend')");
  });

  test('static HTML has no compatibility expansion layer and loads the scoped stylesheet', () => {
    const html = read('index.classic.html');
    expect(html).not.toMatch(/<[^>]+id=["']board-expansion-layer["']/);
    expect(html).toContain('styles-board-dom-compat.css');
  });

  test('default styles contain only explicit Pixi suppression selectors for DOM cells', () => {
    const defaultCss = [
      read('styles-board.css'),
      read('styles-animations.css'),
      read('styles-responsive.css'),
      read('styles-stone-shadows.css')
    ].join('\n').replace(/\/\*[\s\S]*?\*\//g, '');
    const selectorLines = defaultCss.split(/\r?\n/).filter((line) => /\.cell|\.disc|#board-expansion-layer/.test(line));
    expect(selectorLines).toEqual([
      '#board[data-board-renderer="pixi"] > .cell {',
      '#board-stack:has(#board[data-board-renderer="pixi"]) > #board-expansion-layer {'
    ]);
  });

  test('compatibility stylesheet scopes DOM cell and disc selectors to the DOM backend', () => {
    const css = read('styles-board-dom-compat.css').replace(/\/\*[\s\S]*?\*\//g, '');
    const selectorLines = css.split(/\r?\n/).filter((line) => /\.cell|\.disc|#board-expansion-layer/.test(line));
    expect(selectorLines.length).toBeGreaterThan(100);
    for (const line of selectorLines) {
      expect(line).toMatch(/data-board-renderer="dom"/);
    }
  });

  test('NOANIM selectors keep the root class outside the DOM compatibility scope', () => {
    const css = read('styles-board-dom-compat.css').replace(/\/\*[\s\S]*?\*\//g, '');

    expect(css).toContain('.no-anim [data-board-renderer="dom"] .stone-fade-overlay');
    expect(css).toContain(
      '.no-anim #board-stack:has(#board[data-board-renderer="dom"]) > #board-expansion-layer .cell-expanded-reveal'
    );
    expect(css).not.toContain('[data-board-renderer="dom"] .no-anim');
    expect(css).not.toContain('> .no-anim #board-expansion-layer');
  });

  test('registry documents compatibility modules as registered but entry-lazy', () => {
    const registryBuilder = read('scripts/build-module-registry.ts');
    expect(registryBuilder).toContain("'ui/board-dom-compat/'");
    expect(registryBuilder).toContain('remains unevaluated on the default Pixi path');
  });
});
