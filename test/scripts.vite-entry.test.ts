import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

const { CLASSIC_SCRIPT_ORDER, generateViteEntry, renderViteEntry } = require('../scripts/build-vite-entry');

const classicTail = `
    <!-- Scripts -->
    <script src="public/vendor/pixi-8.18.1.min.js"></script>
    <script src="public/vendor/pixi-unsafe-eval-8.18.1.min.js"></script>
    <script src="public/runtime.js?v=1"></script>
    <script src="public/module-registry.js?v=2"></script>
    <script src="ui/layout-stage.js"></script>
    <script src="entry-browser.js?v=3"></script>
`;

describe('Vite comparison entry generator', () => {
  test('forwards npm run dev arguments through the Vite alias separator', () => {
    const packageJson = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8'));
    expect(packageJson.scripts.dev).toBe('npm run dev:vite --');
    expect(packageJson.scripts['dev:vite']).toBe(
      'npm run build:vite && node scripts/serve-with-fallback.js --host 0.0.0.0 --port 5174'
    );
  });

  test('preserves the classic document shell while replacing only the final scripts', () => {
    const rendered = renderViteEntry(`<!doctype html><html lang="ja"><head><link rel="stylesheet" href="styles.css"><meta data-card-reversi-feature-style-slot="board-dom-compat" data-card-reversi-feature-style-href="styles-board-dom-compat.css?v=4"></head><body><main id="board"></main><a id="reversiDestinyOpenLink" href="https://reversi-destiny.pages.dev/" target="_blank" rel="noopener noreferrer external" referrerpolicy="no-referrer">2Dアクション</a>${classicTail}</body></html>`);
    expect(rendered.scriptSources.map((value: string) => value.split('?')[0])).toEqual(CLASSIC_SCRIPT_ORDER);
    expect(rendered.content).toContain('<main id="board"></main>');
    expect(rendered.content).toContain('data-browser-lane="vite"');
    expect(rendered.content).toContain('<base href="./">');
    expect(rendered.content).toContain('<script type="module" src="/browser-vite/main.ts"></script>');
    expect(rendered.content).toContain('name="card-reversi-classic-style" content="styles.css"');
    expect(rendered.content).toContain('data-card-reversi-feature-style-slot="board-dom-compat"');
    expect(rendered.content).not.toContain(
      'name="card-reversi-classic-style" content="styles-board-dom-compat.css?v=4"'
    );
    expect(rendered.content).toContain('name="card-reversi-startup-version" content="2"');
    expect(rendered.content).toContain('data-card-reversi-classic-style-bootstrap');
    expect(rendered.content).not.toContain('<link rel="stylesheet" href="styles.css">');
    expect(rendered.styleSources).toEqual(['styles.css']);
    expect(rendered.lazyStyleSources).toEqual(['styles-board-dom-compat.css?v=4']);
    expect(rendered.content).not.toContain('<script src="public/runtime.js');
    expect(rendered.content).not.toContain('public/vendor/pixi-8.18.1.min.js');
    expect(rendered.content).not.toContain('public/vendor/pixi-unsafe-eval-8.18.1.min.js');
    expect(rendered.content).not.toContain('card-reversi-classic-runtime');
    expect(rendered.content).toContain('id="reversiDestinyOpenLink"');
    expect(rendered.content).toContain('href="https://reversi-destiny.pages.dev/"');
    expect(rendered.content).toContain('target="_blank"');
    expect(rendered.content).toContain('rel="noopener noreferrer external"');
    expect(rendered.content).toContain('referrerpolicy="no-referrer"');
  });

  test('writes a deterministic index.vite.html and detects no second change', () => {
    const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vite-entry-'));
    try {
      fs.writeFileSync(path.join(rootDir, 'index.html'), `<!doctype html><html lang="ja"><head><link rel="stylesheet" href="styles.css"></head><body>${classicTail}</body></html>`);
      const first = generateViteEntry({ rootDir });
      const second = generateViteEntry({ rootDir });
      expect(first.wroteFile).toBe(true);
      expect(first.wroteClassicFile).toBe(true);
      expect(second.wroteFile).toBe(false);
      expect(second.wroteClassicFile).toBe(false);
      expect(fs.readFileSync(path.join(rootDir, 'index.classic.html'), 'utf8')).toContain('public/module-registry.js?v=2');
      expect(fs.readFileSync(first.outputPath, 'utf8')).toBe(first.content);
    } finally {
      fs.rmSync(rootDir, { recursive: true, force: true });
    }
  });

  test('rejects a changed classic script order', () => {
    expect(() => renderViteEntry(`<!doctype html><html lang="ja"><head><link rel="stylesheet" href="styles.css"></head><body>${classicTail.replace('public/runtime.js?v=1', 'entry-browser.js?v=1')}</body></html>`))
      .toThrow(/unexpected classic script order/);
  });
});
