const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

describe('classic script OwnerHelpers loading', () => {
  test('page script order loads without declaration collisions and exposes card helpers', () => {
    const dom = new JSDOM('<!doctype html><html><body></body></html>', {
      runScripts: 'outside-only',
      url: 'http://localhost/'
    });
    const { window } = dom;
    const scripts = [
      ['ui', 'diff-renderer.js'],
      ['ui', 'board-renderer.js'],
      ['ui', 'status-display.js'],
      ['ui', 'result-overlay.js'],
      ['game', 'card-effects', 'helpers.js'],
      ['game', 'turn-manager.js']
    ];

    window.OwnerHelpers = require('../utils/owner-helpers');
    window.BLACK = 1;
    window.WHITE = -1;
    window.EMPTY = 0;

    for (const segments of scripts) {
      const code = fs.readFileSync(path.join(__dirname, '..', ...segments), 'utf8');
      const browserLikeCode = `var require = undefined; var module = undefined; var exports = undefined;\n${code}`;
      expect(() => window.eval(browserLikeCode)).not.toThrow();
    }

    expect(typeof window.getActiveProtectionForPlayer).toBe('function');
    expect(typeof window.showResultOverlay).toBe('function');
    expect(window.getPlayerKey(' WHITE ')).toBe('white');

    dom.window.close();
  });
});
