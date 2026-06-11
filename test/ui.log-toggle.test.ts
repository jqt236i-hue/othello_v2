import { JSDOM } from 'jsdom';

describe('battle log toggle', () => {
  afterEach(() => {
    jest.resetModules();
    try { delete global.window; } catch (e) { /* cleanup guard */ }
    try { delete global.document; } catch (e) { /* cleanup guard */ }
  });

  test('log button opens and closes the hidden battle log', () => {
    const dom = new JSDOM(`<!doctype html><html><body>
      <button id="logToggleBtn" aria-controls="log" aria-expanded="false">ログ</button>
      <div id="log" aria-hidden="true"></div>
    </body></html>`);
    global.window = dom.window;
    global.document = dom.window.document;

    const { attachInitEventListeners } = require('../ui/bootstrap/init-events');
    const button = document.getElementById('logToggleBtn') as HTMLButtonElement;
    const log = document.getElementById('log') as HTMLElement;

    attachInitEventListeners({ logToggleBtn: button, logPanel: log }, false);

    expect(log.classList.contains('is-log-open')).toBe(false);
    expect(button.getAttribute('aria-expanded')).toBe('false');
    expect(log.getAttribute('aria-hidden')).toBe('true');

    button.click();

    expect(log.classList.contains('is-log-open')).toBe(true);
    expect(button.classList.contains('btn-active')).toBe(true);
    expect(button.getAttribute('aria-expanded')).toBe('true');
    expect(log.getAttribute('aria-hidden')).toBe('false');

    button.click();

    expect(log.classList.contains('is-log-open')).toBe(false);
    expect(button.classList.contains('btn-active')).toBe(false);
    expect(button.getAttribute('aria-expanded')).toBe('false');
    expect(log.getAttribute('aria-hidden')).toBe('true');

    dom.window.close();
  });
});
