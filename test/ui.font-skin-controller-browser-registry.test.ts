import * as fs from 'fs';
import * as path from 'path';
import { JSDOM } from 'jsdom';

describe('font skin controller browser registry wiring', () => {
  test('resolves selection/runtime modules through extensionless browser registry keys', () => {
    const dom = new JSDOM(`<!doctype html><html><body>
      <div id="fontSkinOptions"></div>
    </body></html>`, {
      url: 'https://example.test/',
      runScripts: 'outside-only'
    });

    const runtimePath = path.resolve(__dirname, '..', 'public', 'runtime.js');
    const registryPath = path.resolve(__dirname, '..', 'public', 'module-registry.js');
    dom.window.eval(fs.readFileSync(runtimePath, 'utf8'));
    dom.window.eval(fs.readFileSync(registryPath, 'utf8'));

    const controller = (dom.window as any).require('ui/font-skin/controller');
    const api = controller.setupFontSkinControls({
      root: dom.window,
      document: dom.window.document
    });

    expect(api).not.toBeNull();
    expect(dom.window.document.querySelectorAll('.font-skin-option').length).toBeGreaterThan(1);
    expect(dom.window.document.body.getAttribute('data-font-skin-id')).toBe('shippori-mincho');
  });
});
