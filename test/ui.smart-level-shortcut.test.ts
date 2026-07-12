import * as path from 'path';
import { JSDOM } from 'jsdom';

describe('smart cpu level shortcut', () => {
  beforeEach(() => {
    jest.resetModules();
  });

  test('enemy label popup selects CPU and local board settings', () => {
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

    let boardConfig: any = { rows: 8, cols: 8, shape: 'rectangle' };
    const setLocalBoardConfig = jest.fn((nextBoardConfig) => {
      boardConfig = nextBoardConfig;
    });
    (window as any).DeckBuilderController = {
      getLocalBoardConfig: () => boardConfig,
      setLocalBoardConfig
    };

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
    expect(menu?.querySelectorAll('.cpu-level-menu-item')).toHaveLength(9);
    expect(menu?.querySelectorAll('.cpu-config-tab')).toHaveLength(2);
    expect(menu?.querySelector('[data-cpu-config-tab="cpu"]')?.getAttribute('aria-selected')).toBe('true');
    expect(menu?.querySelector('.cpu-config-summary-value')?.textContent).toBe('Lv1 / 通常 8×8');
    expect(menu?.querySelector('.cpu-level-menu-item.is-selected')?.getAttribute('data-cpu-level')).toBe('1');
    expect(menu?.querySelector('[data-cpu-level="1"]')?.classList.contains('cpu-level-tier-1')).toBe(true);
    expect(menu?.querySelector('[data-cpu-level="5"]')?.classList.contains('cpu-level-tier-5')).toBe(true);
    expect(menu?.querySelector('[data-cpu-level="7-board-executor"]')?.classList.contains('cpu-level-profile-board-executor')).toBe(true);
    expect(menu?.querySelector('[data-cpu-level="8-theory-incarnation"]')?.classList.contains('cpu-level-tier-8')).toBe(true);
    expect(menu?.querySelector('[data-cpu-level="9-ending-ash"]')?.classList.contains('cpu-level-tier-9')).toBe(true);
    expect(menu?.querySelector('[data-cpu-level="9-ending-ash"]')?.classList.contains('cpu-level-profile-ending-ash')).toBe(true);

    (menu?.querySelector('[data-cpu-level="4"]') as HTMLButtonElement).click();

    expect(smartWhite.value).toBe('4');
    expect(global.updateCpuCharacter).toHaveBeenCalled();
    expect(menu?.hidden).toBe(false);
    expect(shortcut.getAttribute('aria-expanded')).toBe('true');
    expect(menu?.querySelector('.cpu-config-summary-value')?.textContent).toBe('Lv4 / 通常 8×8');

    const reopenedMenu = document.getElementById('cpu-level-menu');
    (reopenedMenu?.querySelector('[data-cpu-level="7-board-executor"]') as HTMLButtonElement).click();

    expect(smartWhite.value).toBe('7-board-executor');
    expect((global as any).cpuSmartness.white).toBe(7);

    const lv7Menu = document.getElementById('cpu-level-menu');
    (lv7Menu?.querySelector('[data-cpu-level="8-theory-incarnation"]') as HTMLButtonElement).click();

    expect(smartWhite.value).toBe('8-theory-incarnation');
    expect((global as any).cpuSmartness.white).toBe(8);

    const lv8Menu = document.getElementById('cpu-level-menu');
    (lv8Menu?.querySelector('[data-cpu-level="9-ending-ash"]') as HTMLButtonElement).click();

    expect(smartWhite.value).toBe('9-ending-ash');
    expect((global as any).cpuSmartness.white).toBe(9);

    (menu?.querySelector('[data-cpu-config-tab="board"]') as HTMLButtonElement).click();
    expect(menu?.querySelector('[data-cpu-config-tab="board"]')?.getAttribute('aria-selected')).toBe('true');
    expect((menu?.querySelector('[data-cpu-config-panel="cpu"]') as HTMLElement).hidden).toBe(true);
    expect((menu?.querySelector('[data-cpu-config-panel="board"]') as HTMLElement).hidden).toBe(false);

    (menu?.querySelector('[data-cpu-board-shape="circle"]') as HTMLButtonElement).click();
    (menu?.querySelector('[data-cpu-circle-size="12"]') as HTMLButtonElement).click();
    expect(setLocalBoardConfig).toHaveBeenLastCalledWith(expect.objectContaining({
      rows: 12,
      cols: 12,
      shape: 'circle'
    }));
    expect(menu?.querySelector('.cpu-config-summary-value')?.textContent).toBe('Lv9 / 円形 12×12');

    (menu?.querySelector('[data-cpu-board-shape="rectangle"]') as HTMLButtonElement).click();
    const rowsSelect = menu?.querySelector('[data-cpu-board-rows]') as HTMLSelectElement;
    const colsSelect = menu?.querySelector('[data-cpu-board-cols]') as HTMLSelectElement;
    rowsSelect.value = '10';
    rowsSelect.dispatchEvent(new dom.window.Event('change', { bubbles: true }));
    colsSelect.value = '16';
    colsSelect.dispatchEvent(new dom.window.Event('change', { bubbles: true }));
    expect(setLocalBoardConfig).toHaveBeenLastCalledWith(expect.objectContaining({
      rows: 10,
      cols: 16,
      shape: 'rectangle'
    }));
    expect(menu?.querySelector('.cpu-config-summary-value')?.textContent).toBe('Lv9 / 通常 10×16');

    document.body.click();
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

  test('constrains the CPU level menu inside short viewports', () => {
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
    Object.defineProperty(dom.window, 'innerWidth', { configurable: true, value: 375 });
    Object.defineProperty(dom.window, 'innerHeight', { configurable: true, value: 325 });

    const shortcutEl = document.getElementById('cpu-level-label') as HTMLButtonElement;
    shortcutEl.getBoundingClientRect = () => ({
      x: 184, y: 96, left: 184, top: 96, right: 362, bottom: 130, width: 178, height: 34,
      toJSON() { return {}; }
    });

    const smartModule = require(path.join(__dirname, '..', 'ui', 'handlers', 'smart.js'));
    smartModule.setupSmartSelects(
      document.getElementById('smartBlack'),
      document.getElementById('smartWhite')
    );

    shortcutEl.click();

    const menu = document.getElementById('cpu-level-menu') as HTMLDivElement | null;
    expect(menu).not.toBeNull();
    expect(menu?.hidden).toBe(false);

    const top = Number.parseFloat(menu?.style.top || '');
    const maxHeight = Number.parseFloat(menu?.style.maxHeight || '');
    expect(Number.isFinite(top)).toBe(true);
    expect(Number.isFinite(maxHeight)).toBe(true);
    expect(top + maxHeight).toBeLessThanOrEqual(317);
    expect(menu?.style.overflowY).toBe('auto');

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

  test('opening CPU opponent changes reset the local game so profile initial options apply', () => {
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
    global.updateCpuCharacter = jest.fn();
    global.CpuPolicy = { loadPolicyForLevel: jest.fn().mockResolvedValue({}) };
    global.addLog = jest.fn();
    global.mccfrPolicy = null;
    global.gameState = { turnNumber: 0 };
    global.resetGame = jest.fn();
    global.getCurrentMatchMode = jest.fn(() => 'cpu');
    window.gameState = global.gameState;
    window.resetGame = global.resetGame;
    window.getCurrentMatchMode = global.getCurrentMatchMode;

    const smartModule = require(path.join(__dirname, '..', 'ui', 'handlers', 'smart.js'));
    smartModule.setupSmartSelects(
      document.getElementById('smartBlack'),
      document.getElementById('smartWhite')
    );

    const smartWhite = document.getElementById('smartWhite') as HTMLSelectElement;
    smartWhite.value = '8-theory-incarnation';
    smartWhite.dispatchEvent(new dom.window.Event('change', { bubbles: true }));

    expect(global.resetGame).toHaveBeenCalledTimes(1);
    expect(global.resetGame).toHaveBeenCalledWith(expect.objectContaining({
      source: 'cpu_profile_change'
    }));

    delete global.window;
    delete global.document;
    delete global.Event;
    delete global.MouseEvent;
    delete global.updateCpuCharacter;
    delete global.CpuPolicy;
    delete global.addLog;
    delete global.mccfrPolicy;
    delete global.gameState;
    delete global.resetGame;
    delete global.getCurrentMatchMode;
    dom.window.close();
  });

  test('opening CPU profile changes reset when leaving a startup-profile CPU', () => {
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
    global.updateCpuCharacter = jest.fn();
    global.CpuPolicy = { loadPolicyForLevel: jest.fn().mockResolvedValue({}) };
    global.addLog = jest.fn();
    global.mccfrPolicy = null;
    global.gameState = { turnNumber: 0 };
    global.resetGame = jest.fn();
    global.getCurrentMatchMode = jest.fn(() => 'cpu');
    window.gameState = global.gameState;
    window.resetGame = global.resetGame;
    window.getCurrentMatchMode = global.getCurrentMatchMode;

    const smartModule = require(path.join(__dirname, '..', 'ui', 'handlers', 'smart.js'));
    smartModule.setupSmartSelects(
      document.getElementById('smartBlack'),
      document.getElementById('smartWhite')
    );

    const smartBlack = document.getElementById('smartBlack') as HTMLSelectElement;
    smartBlack.value = '8-theory-incarnation';
    smartBlack.dispatchEvent(new dom.window.Event('change', { bubbles: true }));
    expect(global.resetGame).toHaveBeenCalledTimes(1);

    window.gameState.turnNumber = 1;
    smartBlack.value = '1';
    smartBlack.dispatchEvent(new dom.window.Event('change', { bubbles: true }));

    expect(global.resetGame).toHaveBeenCalledTimes(2);

    delete global.window;
    delete global.document;
    delete global.Event;
    delete global.MouseEvent;
    delete global.updateCpuCharacter;
    delete global.CpuPolicy;
    delete global.addLog;
    delete global.mccfrPolicy;
    delete global.gameState;
    delete global.resetGame;
    delete global.getCurrentMatchMode;
    dom.window.close();
  });

  test('opening normal CPU level changes do not reset the local game', () => {
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
    global.updateCpuCharacter = jest.fn();
    global.CpuPolicy = { loadPolicyForLevel: jest.fn().mockResolvedValue({}) };
    global.addLog = jest.fn();
    global.mccfrPolicy = null;
    global.gameState = { turnNumber: 1 };
    global.resetGame = jest.fn();
    global.getCurrentMatchMode = jest.fn(() => 'cpu');
    window.gameState = global.gameState;
    window.resetGame = global.resetGame;
    window.getCurrentMatchMode = global.getCurrentMatchMode;

    const smartModule = require(path.join(__dirname, '..', 'ui', 'handlers', 'smart.js'));
    smartModule.setupSmartSelects(
      document.getElementById('smartBlack'),
      document.getElementById('smartWhite')
    );

    const smartBlack = document.getElementById('smartBlack') as HTMLSelectElement;
    smartBlack.value = '2';
    smartBlack.dispatchEvent(new dom.window.Event('change', { bubbles: true }));

    expect(global.resetGame).not.toHaveBeenCalled();

    delete global.window;
    delete global.document;
    delete global.Event;
    delete global.MouseEvent;
    delete global.updateCpuCharacter;
    delete global.CpuPolicy;
    delete global.addLog;
    delete global.mccfrPolicy;
    delete global.gameState;
    delete global.resetGame;
    delete global.getCurrentMatchMode;
    dom.window.close();
  });

  test('midgame CPU opponent changes do not reset the current game', () => {
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
    global.updateCpuCharacter = jest.fn();
    global.CpuPolicy = { loadPolicyForLevel: jest.fn().mockResolvedValue({}) };
    global.addLog = jest.fn();
    global.mccfrPolicy = null;
    global.gameState = { turnNumber: 3 };
    global.resetGame = jest.fn();
    global.getCurrentMatchMode = jest.fn(() => 'cpu');
    window.gameState = global.gameState;
    window.resetGame = global.resetGame;
    window.getCurrentMatchMode = global.getCurrentMatchMode;

    const smartModule = require(path.join(__dirname, '..', 'ui', 'handlers', 'smart.js'));
    smartModule.setupSmartSelects(
      document.getElementById('smartBlack'),
      document.getElementById('smartWhite')
    );

    const smartWhite = document.getElementById('smartWhite') as HTMLSelectElement;
    smartWhite.value = '8-theory-incarnation';
    smartWhite.dispatchEvent(new dom.window.Event('change', { bubbles: true }));

    expect(global.resetGame).not.toHaveBeenCalled();

    delete global.window;
    delete global.document;
    delete global.Event;
    delete global.MouseEvent;
    delete global.updateCpuCharacter;
    delete global.CpuPolicy;
    delete global.addLog;
    delete global.mccfrPolicy;
    delete global.gameState;
    delete global.resetGame;
    delete global.getCurrentMatchMode;
    dom.window.close();
  });
});
