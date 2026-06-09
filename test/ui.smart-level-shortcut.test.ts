import * as path from 'path';
import { JSDOM } from 'jsdom';

describe('smart cpu level shortcut', () => {
  beforeEach(() => {
    jest.resetModules();
  });

  test('enemy label button opens level list and applies selected smartWhite level', () => {
    const dom = new JSDOM(
      '<!doctype html><html><body>' +
      '<button id="cpu-level-label" type="button" aria-expanded="false"></button>' +
      '<select id="smartBlack"></select>' +
      '<select id="smartWhite"></select>' +
      '</body></html>',
      { url: 'http://localhost/' }
    );

    global.window = dom.window;
    global.document = dom.window.document;
    global.Event = dom.window.Event;
    global.MouseEvent = dom.window.MouseEvent;
    global.KeyboardEvent = dom.window.KeyboardEvent;
    global.updateCpuCharacter = jest.fn();
    global.CpuPolicy = { loadPolicyForLevel: jest.fn().mockResolvedValue({}) };
    global.addLog = jest.fn();
    global.mccfrPolicy = null;

    const shortcutEl = document.getElementById('cpu-level-label') as HTMLButtonElement;
    shortcutEl.getBoundingClientRect = () => ({
      x: 900, y: 300, left: 900, top: 300, right: 1080, bottom: 340, width: 180, height: 40,
      toJSON() { return {}; }
    });

    const smartModule = require(path.join(__dirname, '..', 'ui', 'handlers', 'smart.js'));
    smartModule.setupSmartSelects(
      document.getElementById('smartBlack'),
      document.getElementById('smartWhite')
    );

    const smartWhite = document.getElementById('smartWhite') as HTMLSelectElement;
    const shortcut = document.getElementById('cpu-level-label') as HTMLButtonElement;

    expect(smartWhite.value).toBe('1');
    expect(shortcut.getAttribute('aria-expanded')).toBe('false');

    shortcut.click();

    const menu = document.getElementById('cpu-level-menu');
    expect(menu).not.toBeNull();
    expect(menu?.hidden).toBe(false);
    expect(shortcut.getAttribute('aria-expanded')).toBe('true');
    expect(menu?.querySelectorAll('.cpu-level-menu-item')).toHaveLength(6);
    expect(menu?.querySelector('.cpu-level-menu-item.is-selected')?.getAttribute('data-cpu-level')).toBe('1');

    (menu?.querySelector('[data-cpu-level="4"]') as HTMLButtonElement).click();

    expect(smartWhite.value).toBe('4');
    expect(global.updateCpuCharacter).toHaveBeenCalled();
    expect(menu?.hidden).toBe(true);
    expect(shortcut.getAttribute('aria-expanded')).toBe('false');

    delete global.window;
    delete global.document;
    delete global.Event;
    delete global.MouseEvent;
    delete global.KeyboardEvent;
    delete global.updateCpuCharacter;
    delete global.CpuPolicy;
    delete global.addLog;
    delete global.mccfrPolicy;
    dom.window.close();
  });
});
