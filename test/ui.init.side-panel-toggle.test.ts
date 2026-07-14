import * as path from 'path';
import { JSDOM } from 'jsdom';

describe('initializeUI side panel toggle', () => {
  let consoleErrorSpy;

  beforeEach(() => {
    jest.resetModules();

    const dom = new JSDOM(`<!doctype html><html><body>
      <div id="side-panel">
        <button id="sidePanelToggleBtn" type="button" aria-controls="control-panel" aria-expanded="true">
          <span class="left-action-icon left-action-icon-settings" aria-hidden="true"></span>
          <span class="left-action-label">設定</span>
        </button>
        <div id="control-panel"></div>
        <div id="log"></div>
        <div id="discard-display"></div>
      </div>
    </body></html>`);

    global.window = dom.window;
    global.document = dom.window.document;
    global.resetGame = jest.fn();
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    Object.defineProperty(dom.window, 'innerWidth', { value: 1280, configurable: true });
    Object.defineProperty(dom.window, 'innerHeight', { value: 900, configurable: true });

    const sidePanel = dom.window.document.getElementById('side-panel');
    const toggleBtn = dom.window.document.getElementById('sidePanelToggleBtn');
    if (sidePanel) {
      sidePanel.getBoundingClientRect = () => ({
        x: 0, y: 0, left: 0, top: 0, right: 240, bottom: 280, width: 240, height: 280,
        toJSON() { return {}; }
      });
    }
    if (toggleBtn) {
      toggleBtn.getBoundingClientRect = () => ({
        x: 20, y: 300, left: 20, top: 300, right: 120, bottom: 360, width: 100, height: 60,
        toJSON() { return {}; }
      });
    }

    const bootstrapPath = path.resolve(__dirname, '..', 'ui', 'bootstrap.js');
    jest.doMock(bootstrapPath, () => ({
      installGameDI: jest.fn(),
      getBoardVisualController: jest.fn(() => ({
        waitUntilReady: jest.fn(async () => undefined),
        isReady: jest.fn(() => true),
        getVisualFrameDigest: jest.fn(() => 'initial-frame')
      }))
    }), { virtual: false });
  });

  afterEach(() => {
    if (consoleErrorSpy) {
      consoleErrorSpy.mockRestore();
      consoleErrorSpy = null;
    }
    delete global.window;
    delete global.document;
    delete global.resetGame;
  });

  function sawResetGameThrowLog() {
    return consoleErrorSpy.mock.calls.some((args) =>
      args.some((value) => String(value || '').includes('[init] resetGame threw'))
    );
  }

  test('初期表示は展開状態で、ボタン押下で折りたたみ/再展開できる', async () => {
    const initModule = require('../ui/handlers/init.js');
    await initModule.initializeUI();

    const sidePanel = document.getElementById('side-panel');
    const toggleBtn = document.getElementById('sidePanelToggleBtn');

    expect(sidePanel.classList.contains('side-panel-collapsed')).toBe(true);
    expect(toggleBtn.getAttribute('aria-expanded')).toBe('false');
    expect(toggleBtn.getAttribute('aria-label')).toBe('設定を開く');
    expect(toggleBtn.textContent?.trim()).toBe('設定');
    expect(toggleBtn.querySelector('.left-action-icon')).not.toBeNull();
    expect(toggleBtn.querySelector('.left-action-label')?.textContent).toBe('設定');
    expect(sidePanel.style.left).toBe('132px');
    expect(sidePanel.style.top).toBe('190px');

    toggleBtn.click();

    expect(sidePanel.classList.contains('side-panel-collapsed')).toBe(false);
    expect(toggleBtn.getAttribute('aria-expanded')).toBe('true');
    expect(toggleBtn.getAttribute('aria-label')).toBe('設定を閉じる');
    expect(toggleBtn.textContent?.trim()).toBe('設定');
    expect(toggleBtn.querySelector('.left-action-icon')).not.toBeNull();
    expect(toggleBtn.querySelector('.left-action-label')?.textContent).toBe('設定');
    expect(sidePanel.style.left).toBe('');
    expect(sidePanel.style.top).toBe('');
    expect(sidePanel.style.right).toBe('');
    expect(sidePanel.style.bottom).toBe('');

    toggleBtn.click();
    await new Promise((resolve) => setTimeout(resolve, 200));

    expect(sidePanel.classList.contains('side-panel-collapsed')).toBe(true);
    expect(toggleBtn.getAttribute('aria-expanded')).toBe('false');
    expect(toggleBtn.getAttribute('aria-label')).toBe('設定を開く');
    expect(toggleBtn.textContent?.trim()).toBe('設定');
    expect(toggleBtn.querySelector('.left-action-icon')).not.toBeNull();
    expect(toggleBtn.querySelector('.left-action-label')?.textContent).toBe('設定');
    expect(sawResetGameThrowLog()).toBe(false);
  });

  test('iPhone縦プロファイルでは初期表示を折りたたみ状態にする', async () => {
    document.documentElement.classList.add('layout-profile-phone-portrait');
    document.documentElement.setAttribute('data-layout-profile', 'layout-profile-phone-portrait');
    Object.defineProperty(window, 'innerWidth', { value: 390, configurable: true });
    Object.defineProperty(window, 'innerHeight', { value: 844, configurable: true });
    const sidePanelBeforeInit = document.getElementById('side-panel');
    const toggleBtnBeforeInit = document.getElementById('sidePanelToggleBtn');
    if (sidePanelBeforeInit) {
      sidePanelBeforeInit.getBoundingClientRect = () => ({
        x: 0, y: 0, left: 0, top: 0, right: 240, bottom: 280, width: 240, height: 280,
        toJSON() { return {}; }
      });
    }
    if (toggleBtnBeforeInit) {
      toggleBtnBeforeInit.getBoundingClientRect = () => ({
        x: 64, y: 790, left: 64, top: 790, right: 118, bottom: 824, width: 54, height: 34,
        toJSON() { return {}; }
      });
    }

    const initModule = require('../ui/handlers/init.js');
    await initModule.initializeUI();

    const sidePanel = document.getElementById('side-panel');
    const toggleBtn = document.getElementById('sidePanelToggleBtn');

    expect(sidePanel.classList.contains('side-panel-collapsed')).toBe(true);
    expect(toggleBtn.getAttribute('aria-expanded')).toBe('false');
    expect(toggleBtn.getAttribute('aria-label')).toBe('設定を開く');
    expect(toggleBtn.textContent?.trim()).toBe('設定');
    expect(toggleBtn.querySelector('.left-action-icon')).not.toBeNull();
    expect(toggleBtn.querySelector('.left-action-label')?.textContent).toBe('設定');
    expect(sidePanel.style.left).toBe('75px');
    expect(sidePanel.style.top).toBe('282px');

    toggleBtn.click();

    expect(sidePanel.classList.contains('side-panel-collapsed')).toBe(false);
    expect(toggleBtn.getAttribute('aria-expanded')).toBe('true');
    expect(toggleBtn.getAttribute('aria-label')).toBe('設定を閉じる');
    expect(toggleBtn.textContent?.trim()).toBe('設定');
    expect(toggleBtn.querySelector('.left-action-icon')).not.toBeNull();
    expect(toggleBtn.querySelector('.left-action-label')?.textContent).toBe('設定');
    expect(sidePanel.style.left).toBe('');
    expect(sidePanel.style.top).toBe('');
    expect(sidePanel.style.right).toBe('');
    expect(sidePanel.style.bottom).toBe('');
    expect(sawResetGameThrowLog()).toBe(false);
  });
});
