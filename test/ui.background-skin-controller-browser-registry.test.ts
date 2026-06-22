import * as fs from 'fs';
import * as path from 'path';
import { JSDOM } from 'jsdom';

describe('background skin controller browser registry wiring', () => {
  test('resolves selection/runtime modules through extensionless browser registry keys', () => {
    const dom = new JSDOM(`<!doctype html><html><body>
      <div id="backgroundSkinOptions"></div>
    </body></html>`, {
      url: 'https://example.test/',
      runScripts: 'outside-only'
    });

    const runtimePath = path.resolve(__dirname, '..', 'public', 'runtime.js');
    const registryPath = path.resolve(__dirname, '..', 'public', 'module-registry.js');
    const optionalRegistryPath = path.resolve(__dirname, '..', 'public', 'module-registry.optional.js');
    dom.window.eval(fs.readFileSync(runtimePath, 'utf8'));
    dom.window.eval(fs.readFileSync(registryPath, 'utf8'));
    dom.window.eval(fs.readFileSync(optionalRegistryPath, 'utf8'));

    const controller = (dom.window as any).require('ui/background-skin/controller');
    const api = controller.setupBackgroundSkinControls({
      root: dom.window,
      document: dom.window.document
    });

    expect(api).not.toBeNull();
    expect(dom.window.document.querySelectorAll('.background-skin-option').length).toBeGreaterThan(0);
    expect(dom.window.document.body.getAttribute('data-background-skin-id')).toBe('default-25');
  });
});
