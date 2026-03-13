const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

describe('status-display network seat labels', () => {
  test('normalizes padded uppercase seat key before applying network labels', () => {
    const dom = new JSDOM(
      '<!doctype html><html><body>' +
      '<img id="cpu-character-img" />' +
      '<div id="cpu-level-label"></div>' +
      '<div id="hero-label"></div>' +
      '</body></html>',
      { runScripts: 'outside-only', url: 'http://localhost/' }
    );

    const { window } = dom;
    const jsPath = path.join(__dirname, '..', 'ui', 'status-display.js');
    const code = fs.readFileSync(jsPath, 'utf8');

    window.cpuSmartness = { white: 2 };
    window.CPU_LEVEL_NAMES = { 2: 'CPU Lv2' };
    window.getElement = (key) => {
      const map = {
        cpuCharacterImg: window.document.getElementById('cpu-character-img'),
        cpuLevelLabel: window.document.getElementById('cpu-level-label')
      };
      return map[key] || null;
    };
    window.OwnerHelpers = require('../utils/owner-helpers');
    window.MatchMode = { isNetworkModeActive: () => true };
    window.NetworkMatchClient = {
      getSeatKey: () => ' WHITE ',
      getSeatNames: () => ({ black: '  Alpha  ', white: '  Beta  ' })
    };
    window.Image = class FakeImage {
      set src(value) {
        this._src = value;
        if (typeof this.onload === 'function') this.onload();
      }
      get src() {
        return this._src || '';
      }
    };

    global.window = window;
    global.document = window.document;
    global.cpuSmartness = window.cpuSmartness;
    global.CPU_LEVEL_NAMES = window.CPU_LEVEL_NAMES;
    global.getElement = window.getElement;
    global.Image = window.Image;

    window.eval(code);
    window.updateCpuCharacter();

    expect(window.document.getElementById('hero-label').textContent).toBe('白:Beta');
    expect(window.document.getElementById('cpu-level-label').textContent).toBe('黒:Alpha');

    delete global.window;
    delete global.document;
    delete global.cpuSmartness;
    delete global.CPU_LEVEL_NAMES;
    delete global.getElement;
    delete global.Image;
    dom.window.close();
  });
});
