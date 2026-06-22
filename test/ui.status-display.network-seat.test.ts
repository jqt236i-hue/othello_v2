import * as path from 'path';
import { JSDOM } from 'jsdom';

function loadStatusDisplayIntoWindow(window) {
  jest.resetModules();
  const statusDisplay = require(path.join(__dirname, '..', 'ui', 'status-display.js'));
  window.showCpuSpeechBubble = statusDisplay.showCpuSpeechBubble;
  window.hideCpuSpeechBubble = statusDisplay.hideCpuSpeechBubble;
  window.positionCpuSpeechBubble = statusDisplay.positionCpuSpeechBubble;
  window.showRoundBonusDisplay = statusDisplay.showRoundBonusDisplay;
  window.clearRoundDisplayBonus = statusDisplay.clearRoundDisplayBonus;
  window.updateCpuCharacter = statusDisplay.updateCpuCharacter;
  window.updateStatus = statusDisplay.updateStatus;
  window.updateFateWillBanner = statusDisplay.updateFateWillBanner;
  window.updateRoundDisplay = statusDisplay.updateRoundDisplay;
}

describe('status-display network seat labels', () => {
  afterEach(() => {
    delete global.window;
    delete global.document;
    delete global.cpuSmartness;
    delete global.CPU_LEVEL_NAMES;
    delete global.getElement;
    delete global.Image;
    delete global.gameState;
    delete global.BLACK;
    delete global.WHITE;
  });

  test('normalizes padded uppercase seat key before applying network labels', () => {
    const dom = new JSDOM(
      '<!doctype html><html><body>' +
      '<img id="cpu-character-img" />' +
      '<button id="cpu-level-label" type="button"></button>' +
      '<div id="hero-label"></div>' +
      '</body></html>',
      { runScripts: 'outside-only', url: 'http://localhost/' }
    );

    const { window } = dom;
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

    loadStatusDisplayIntoWindow(window);
    window.updateCpuCharacter();

    expect(window.document.getElementById('hero-label').textContent).toBe('白:Beta');
    expect(window.document.getElementById('cpu-level-label').textContent).toBe('黒:Alpha');
    expect(window.document.getElementById('cpu-level-label').getAttribute('aria-disabled')).toBe('true');
    expect(window.document.getElementById('cpu-character-img').src).toContain('/assets/images/hero/hero.png');
    expect(window.document.getElementById('cpu-character-img').alt).toBe('対戦相手の勇者');
    expect(window.document.getElementById('cpu-character-img').classList.contains('is-network-opponent-hero')).toBe(true);

    dom.window.close();
  });

  test('keeps cpu portrait unmirrored outside network mode', () => {
    const dom = new JSDOM(
      '<!doctype html><html><body>' +
      '<img id="cpu-character-img" />' +
      '<button id="cpu-level-label" type="button"></button>' +
      '<div id="hero-label"></div>' +
      '</body></html>',
      { runScripts: 'outside-only', url: 'http://localhost/' }
    );

    const { window } = dom;
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
    window.MatchMode = { isNetworkModeActive: () => false };
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

    loadStatusDisplayIntoWindow(window);
    window.updateCpuCharacter();

    expect(window.document.getElementById('cpu-level-label').textContent).toBe('Lv2 CPU Lv2');
    expect(window.document.getElementById('cpu-level-label').getAttribute('aria-disabled')).toBe('false');
    expect(window.document.getElementById('cpu-character-img').classList.contains('is-network-opponent-hero')).toBe(false);

    dom.window.close();
  });

  test('network spectator battle status uses observer label and suppresses turn toast', () => {
    const dom = new JSDOM(
      '<!doctype html><html><body>' +
      '<div id="effect-live-panel"></div>' +
      '<div id="board"></div>' +
      '</body></html>',
      { runScripts: 'outside-only', url: 'http://localhost/' }
    );

    const { window } = dom;
    window.OwnerHelpers = require('../utils/owner-helpers');
    window.MatchMode = { isNetworkModeActive: () => true };
    window.NetworkMatchClient = {
      getSeatKey: () => 'black',
      isSpectator: () => true,
      getSeatNames: () => ({ black: 'Alpha', white: 'Beta' })
    };
    window.gameState = {
      currentPlayer: 1,
      turnNumber: 3,
      roundNumber: 1,
      board: [[1, -1]]
    };
    window.BLACK = 1;
    window.WHITE = -1;

    global.window = window;
    global.document = window.document;
    global.gameState = window.gameState;
    global.BLACK = 1;
    global.WHITE = -1;

    const statusDisplay = require(path.join(__dirname, '..', 'ui', 'status-display.js'));
    statusDisplay.updateBattleStatusPanel();

    expect(window.document.querySelector('.battle-status-turn')?.textContent).toBe('観測中');
    expect(window.document.getElementById('turn-arrival-toast')).toBeNull();
    dom.window.close();
  });
});
