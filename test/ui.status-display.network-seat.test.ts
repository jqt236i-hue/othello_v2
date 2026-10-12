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

  test.each([' BLACK ', ' WHITE '])('uses a white opponent and black self portrait for either network seat (%s)', (seatKey) => {
    const dom = new JSDOM(
      '<!doctype html><html><body>' +
      '<img id="cpu-character-img" />' +
      '<img id="hero-character-img" src="assets/images/special-cards/characters/board_executor.png" />' +
      '<select id="smartBlack"><option value="7-board-executor" selected>盤界の執行者</option></select>' +
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
      getSeatKey: () => seatKey,
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
    window.document.getElementById('hero-label').classList.add('is-default-hero-label');
    window.updateCpuCharacter();

    const ownSeatIsWhite = seatKey.trim() === 'WHITE';
    expect(window.document.getElementById('hero-label').classList.contains('is-default-hero-label')).toBe(false);
    expect(window.document.getElementById('hero-label').textContent).toBe(ownSeatIsWhite ? '白:Beta' : '黒:Alpha');
    expect(window.document.getElementById('cpu-level-label').textContent).toBe(ownSeatIsWhite ? '黒:Alpha' : '白:Beta');
    expect(window.document.getElementById('hero-character-img').src).toContain('/assets/images/hero/hero.png');
    expect(window.document.getElementById('cpu-level-label').getAttribute('aria-disabled')).toBe('true');
    expect(window.document.getElementById('cpu-character-img').src).toContain('/assets/images/hero/hero-white.png');
    expect(window.document.getElementById('cpu-character-img').alt).toBe('対戦相手の勇者');
    expect(window.document.getElementById('cpu-character-img').classList.contains('is-network-opponent-hero')).toBe(true);

    window.MatchMode.isNetworkModeActive = () => false;
    window.updateCpuCharacter();
    expect(window.document.getElementById('cpu-character-img').src).toContain('/assets/images/cpu/level2.png');
    expect(window.document.getElementById('cpu-character-img').classList.contains('is-network-opponent-hero')).toBe(false);
    expect(window.document.getElementById('hero-character-img').src).toContain('/assets/images/special-cards/characters/board_executor.png');
    expect(window.document.getElementById('hero-label').textContent).toBe('盤界の執行者');
    expect(window.document.getElementById('hero-label').classList.contains('is-default-hero-label')).toBe(false);

    window.MatchMode.isNetworkModeActive = () => true;
    window.updateCpuCharacter();
    expect(window.document.getElementById('cpu-character-img').src).toContain('/assets/images/hero/hero-white.png');
    expect(window.document.getElementById('hero-label').textContent).toBe(ownSeatIsWhite ? '白:Beta' : '黒:Alpha');

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
    let imageConstructionCount = 0;
    window.Image = class FakeImage {
      constructor() {
        imageConstructionCount += 1;
      }
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
    const cpuImage = window.document.getElementById('cpu-character-img') as HTMLImageElement;
    cpuImage.style.removeProperty('--cpu-level-scale');
    window.updateCpuCharacter();

    expect(window.document.getElementById('cpu-level-label').textContent).toBe('Lv2 CPU Lv2');
    expect(window.document.getElementById('cpu-level-label').getAttribute('aria-disabled')).toBe('false');
    expect(cpuImage.classList.contains('is-network-opponent-hero')).toBe(false);
    expect(cpuImage.style.getPropertyValue('--cpu-level-scale')).not.toBe('');
    expect(imageConstructionCount).toBe(1);

    dom.window.close();
  });

  test('keeps the cpu portrait faded when every image candidate fails', () => {
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
    window.getElement = (key) => ({
      cpuCharacterImg: window.document.getElementById('cpu-character-img'),
      cpuLevelLabel: window.document.getElementById('cpu-level-label')
    })[key] || null;
    window.OwnerHelpers = require('../utils/owner-helpers');
    window.MatchMode = { isNetworkModeActive: () => false };
    window.Image = class FailedImage {
      set src(value) {
        this._src = value;
        if (typeof this.onerror === 'function') this.onerror(new Error('missing image'));
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
    const warning = jest.spyOn(console, 'warn').mockImplementation(() => undefined);

    loadStatusDisplayIntoWindow(window);
    window.updateCpuCharacter();

    expect(window.document.getElementById('cpu-character-img').style.opacity).toBe('0.3');
    expect(warning).toHaveBeenCalledWith(expect.stringContaining('敵キャラクター画像が見つかりません'));
    warning.mockRestore();
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
      board: [
        [1, -1, 0, 0],
        [0, 0, 0, 0],
        [0, 0, 0, 0],
        [0, 0, 0, 0]
      ]
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
