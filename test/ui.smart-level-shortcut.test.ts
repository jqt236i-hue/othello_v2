import * as path from 'path';
import { JSDOM } from 'jsdom';

describe('smart cpu level shortcut', () => {
  beforeEach(() => {
    jest.resetModules();
  });

  test('enemy label button cycles smartWhite level and dispatches change', () => {
    const dom = new JSDOM(
      '<!doctype html><html><body>' +
      '<button id="cpu-level-label" type="button"></button>' +
      '<select id="smartBlack"></select>' +
      '<select id="smartWhite"></select>' +
      '</body></html>',
      { url: 'http://localhost/' }
    );

    global.window = dom.window;
    global.document = dom.window.document;
    global.Event = dom.window.Event;
    global.updateCpuCharacter = jest.fn();
    global.CpuPolicy = { loadPolicyForLevel: jest.fn().mockResolvedValue({}) };
    global.addLog = jest.fn();
    global.mccfrPolicy = null;

    const smartModule = require(path.join(__dirname, '..', 'ui', 'handlers', 'smart.js'));
    smartModule.setupSmartSelects(
      document.getElementById('smartBlack'),
      document.getElementById('smartWhite')
    );

    const smartWhite = document.getElementById('smartWhite') as HTMLSelectElement;
    const shortcut = document.getElementById('cpu-level-label') as HTMLButtonElement;

    expect(smartWhite.value).toBe('1');

    shortcut.click();

    expect(smartWhite.value).toBe('2');
    expect(global.updateCpuCharacter).toHaveBeenCalled();

    shortcut.click();

    expect(smartWhite.value).toBe('3');

    delete global.window;
    delete global.document;
    delete global.Event;
    delete global.updateCpuCharacter;
    delete global.CpuPolicy;
    delete global.addLog;
    delete global.mccfrPolicy;
    dom.window.close();
  });
});
