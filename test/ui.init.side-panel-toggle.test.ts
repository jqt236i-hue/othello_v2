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

    const bootstrapPath = path.resolve(__dirname, '..', 'ui', 'bootstrap.js');
    jest.doMock(bootstrapPath, () => ({
      installGameDI: jest.fn()
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

  test('初期表示は展開状態で、ボタン押下で折りたたみ/再展開できる', () => {
    const initModule = require('../ui/handlers/init.js');
    initModule.initializeUI();

    const sidePanel = document.getElementById('side-panel');
    const toggleBtn = document.getElementById('sidePanelToggleBtn');

    expect(sidePanel.classList.contains('side-panel-collapsed')).toBe(true);
    expect(toggleBtn.getAttribute('aria-expanded')).toBe('false');
    expect(toggleBtn.getAttribute('aria-label')).toBe('設定を開く');
    expect(toggleBtn.textContent?.trim()).toBe('設定');
    expect(toggleBtn.querySelector('.left-action-icon')).not.toBeNull();
    expect(toggleBtn.querySelector('.left-action-label')?.textContent).toBe('設定');

    toggleBtn.click();

    expect(sidePanel.classList.contains('side-panel-collapsed')).toBe(false);
    expect(toggleBtn.getAttribute('aria-expanded')).toBe('true');
    expect(toggleBtn.getAttribute('aria-label')).toBe('設定を閉じる');
    expect(toggleBtn.textContent?.trim()).toBe('設定');
    expect(toggleBtn.querySelector('.left-action-icon')).not.toBeNull();
    expect(toggleBtn.querySelector('.left-action-label')?.textContent).toBe('設定');

    toggleBtn.click();

    expect(sidePanel.classList.contains('side-panel-collapsed')).toBe(true);
    expect(toggleBtn.getAttribute('aria-expanded')).toBe('false');
    expect(toggleBtn.getAttribute('aria-label')).toBe('設定を開く');
    expect(toggleBtn.textContent?.trim()).toBe('設定');
    expect(toggleBtn.querySelector('.left-action-icon')).not.toBeNull();
    expect(toggleBtn.querySelector('.left-action-label')?.textContent).toBe('設定');
    expect(sawResetGameThrowLog()).toBe(false);
  });

  test('iPhone縦プロファイルでは初期表示を折りたたみ状態にする', () => {
    document.documentElement.classList.add('layout-profile-phone-portrait');
    document.documentElement.setAttribute('data-layout-profile', 'layout-profile-phone-portrait');

    const initModule = require('../ui/handlers/init.js');
    initModule.initializeUI();

    const sidePanel = document.getElementById('side-panel');
    const toggleBtn = document.getElementById('sidePanelToggleBtn');

    expect(sidePanel.classList.contains('side-panel-collapsed')).toBe(true);
    expect(toggleBtn.getAttribute('aria-expanded')).toBe('false');
    expect(toggleBtn.getAttribute('aria-label')).toBe('設定を開く');
    expect(toggleBtn.textContent?.trim()).toBe('設定');
    expect(toggleBtn.querySelector('.left-action-icon')).not.toBeNull();
    expect(toggleBtn.querySelector('.left-action-label')?.textContent).toBe('設定');

    toggleBtn.click();

    expect(sidePanel.classList.contains('side-panel-collapsed')).toBe(false);
    expect(toggleBtn.getAttribute('aria-expanded')).toBe('true');
    expect(toggleBtn.getAttribute('aria-label')).toBe('設定を閉じる');
    expect(toggleBtn.textContent?.trim()).toBe('設定');
    expect(toggleBtn.querySelector('.left-action-icon')).not.toBeNull();
    expect(toggleBtn.querySelector('.left-action-label')?.textContent).toBe('設定');
    expect(sawResetGameThrowLog()).toBe(false);
  });
});
