import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

const { CLASSIC_SCRIPT_ORDER, generateViteEntry, renderViteEntry } = require('../scripts/build-vite-entry');

const classicTail = `
    <!-- Scripts -->
    <script src="public/runtime.js?v=1"></script>
    <script src="public/module-registry.js?v=2"></script>
    <script src="ui/layout-stage.js"></script>
    <script src="entry-browser.js?v=3"></script>
`;

describe('Vite comparison entry generator', () => {
  test('preserves the classic document shell while replacing only the final scripts', () => {
    const rendered = renderViteEntry(`<!doctype html><html lang="ja"><head><link rel="stylesheet" href="styles.css"></head><body><main id="board"></main>${classicTail}</body></html>`);
    expect(rendered.scriptSources.map((value: string) => value.split('?')[0])).toEqual(CLASSIC_SCRIPT_ORDER);
    expect(rendered.content).toContain('<main id="board"></main>');
    expect(rendered.content).toContain('data-browser-lane="vite"');
    expect(rendered.content).toContain('<base href="./">');
    expect(rendered.content).toContain('<script type="module" src="/browser-vite/main.ts"></script>');
    expect(rendered.content).toContain('name="card-reversi-classic-style" content="styles.css"');
    expect(rendered.content).toContain('data-card-reversi-classic-style-bootstrap');
    expect(rendered.content).not.toContain('<link rel="stylesheet" href="styles.css">');
    expect(rendered.styleSources).toEqual(['styles.css']);
    expect(rendered.content).not.toContain('<script src="public/runtime.js');
    expect(rendered.content).toContain('content="public/runtime.js?v=1"');
  });

  test('writes a deterministic index.vite.html and detects no second change', () => {
    const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vite-entry-'));
    try {
      fs.writeFileSync(path.join(rootDir, 'index.html'), `<!doctype html><html lang="ja"><head><link rel="stylesheet" href="styles.css"></head><body>${classicTail}</body></html>`);
      const first = generateViteEntry({ rootDir });
      const second = generateViteEntry({ rootDir });
      expect(first.wroteFile).toBe(true);
      expect(second.wroteFile).toBe(false);
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
