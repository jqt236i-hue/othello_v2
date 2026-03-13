const { JSDOM } = require('jsdom');

describe('initializeUI side panel toggle', () => {
  beforeEach(() => {
    jest.resetModules();

    const dom = new JSDOM(`<!doctype html><html><body>
      <div id="side-panel">
        <button id="sidePanelToggleBtn" type="button" aria-controls="control-panel" aria-expanded="true">−</button>
        <div id="control-panel"></div>
        <div id="log"></div>
        <div id="discard-display"></div>
      </div>
    </body></html>`);

    global.window = dom.window;
    global.document = dom.window.document;
  });

  afterEach(() => {
    delete global.window;
    delete global.document;
  });

  test('初期表示は展開状態で、ボタン押下で折りたたみ/再展開できる', () => {
    const initModule = require('../ui/handlers/init.js');
    initModule.initializeUI();

    const sidePanel = document.getElementById('side-panel');
    const toggleBtn = document.getElementById('sidePanelToggleBtn');

    expect(sidePanel.classList.contains('side-panel-collapsed')).toBe(false);
    expect(toggleBtn.getAttribute('aria-expanded')).toBe('true');
    expect(toggleBtn.textContent).toBe('−');

    toggleBtn.click();

    expect(sidePanel.classList.contains('side-panel-collapsed')).toBe(true);
    expect(toggleBtn.getAttribute('aria-expanded')).toBe('false');
    expect(toggleBtn.textContent).toBe('＋');

    toggleBtn.click();

    expect(sidePanel.classList.contains('side-panel-collapsed')).toBe(false);
    expect(toggleBtn.getAttribute('aria-expanded')).toBe('true');
    expect(toggleBtn.textContent).toBe('−');
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
    expect(toggleBtn.textContent).toBe('＋');

    toggleBtn.click();

    expect(sidePanel.classList.contains('side-panel-collapsed')).toBe(false);
    expect(toggleBtn.getAttribute('aria-expanded')).toBe('true');
    expect(toggleBtn.textContent).toBe('−');
  });
});
