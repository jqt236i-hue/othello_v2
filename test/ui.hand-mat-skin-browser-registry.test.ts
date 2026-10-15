import * as fs from 'fs';
import * as path from 'path';
import { JSDOM } from 'jsdom';

test('restores the hand mat from startup modules before lazy cosmetic controls load', () => {
  const dom = new JSDOM('<!doctype html><html><body><div id="handMatSkinOptions"></div></body></html>', {
    url: 'https://example.test/', runScripts: 'outside-only'
  });
  try {
    const root = dom.window as any;
    const load = (name: string) => root.eval(fs.readFileSync(path.resolve(__dirname, '..', 'public', name), 'utf8'));
    load('runtime.js');
    load('module-registry.js');
    root.localStorage.setItem('reversi.handMatSkin', 'scholars-oxblood');
    const selection = root.require('ui/hand-mat-skin/selection');
    const runtime = root.require('ui/hand-mat-skin/runtime');
    runtime.syncDisplayedHandMatSkin(root, selection.readStoredHandMatSkinId(root));
    expect(root.document.documentElement.dataset.handMatSkinId).toBe('scholars-oxblood');
    expect(root.document.getElementById('handMatSkinOptions').children).toHaveLength(0);
    load('module-registry.optional.cosmetic.js');
    const controller = root.require('ui/hand-mat-skin/controller');
    const api = controller.setupHandMatSkinControls({ root });
    expect(api.getSelectedSkinId()).toBe('scholars-oxblood');
    expect(root.document.querySelectorAll('.hand-mat-skin-option')).toHaveLength(4);
  } finally { dom.window.close(); }
});
