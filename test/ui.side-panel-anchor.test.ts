import { JSDOM } from 'jsdom';
import { syncSidePanelAnchorPosition } from '../ui/bootstrap/side-panel-anchor';

function setViewport(win: Window, width: number, height: number): void {
  Object.defineProperty(win, 'innerWidth', { value: width, configurable: true });
  Object.defineProperty(win, 'innerHeight', { value: height, configurable: true });
}

function mockRect(el: HTMLElement, rect: Partial<DOMRect>): void {
  const fullRect = {
    x: rect.x ?? rect.left ?? 0,
    y: rect.y ?? rect.top ?? 0,
    left: rect.left ?? rect.x ?? 0,
    top: rect.top ?? rect.y ?? 0,
    right: rect.right ?? ((rect.left ?? rect.x ?? 0) + (rect.width ?? 0)),
    bottom: rect.bottom ?? ((rect.top ?? rect.y ?? 0) + (rect.height ?? 0)),
    width: rect.width ?? 0,
    height: rect.height ?? 0,
    toJSON() { return {}; },
  } as DOMRect;
  el.getBoundingClientRect = () => fullRect;
}

describe('side panel anchor positioning', () => {
  test('phone portrait centers the settings panel in the viewport', () => {
    const dom = new JSDOM(`<!doctype html><html><body>
      <button id="sidePanelToggleBtn" type="button">設定</button>
      <div id="side-panel"></div>
    </body></html>`);
    const { window } = dom;
    setViewport(window, 390, 844);
    window.document.documentElement.classList.add('layout-profile-phone-portrait');

    const panel = window.document.getElementById('side-panel') as HTMLElement;
    const toggle = window.document.getElementById('sidePanelToggleBtn') as HTMLElement;
    mockRect(panel, { left: 0, top: 0, width: 240, height: 280 });
    mockRect(toggle, { left: 64, top: 790, right: 118, bottom: 824, width: 54, height: 34 });

    syncSidePanelAnchorPosition(panel, toggle, window);

    expect(panel.style.left).toBe('75px');
    expect(panel.style.top).toBe('282px');
    expect(panel.style.right).toBe('');
    expect(panel.style.bottom).toBe('');
  });

  test('phone portrait centers the visible control panel when it differs from the side-panel box', () => {
    const dom = new JSDOM(`<!doctype html><html><body>
      <button id="sidePanelToggleBtn" type="button">設定</button>
      <div id="side-panel"><div id="control-panel"></div></div>
    </body></html>`);
    const { window } = dom;
    setViewport(window, 390, 844);
    window.document.documentElement.classList.add('layout-profile-phone-portrait');

    const panel = window.document.getElementById('side-panel') as HTMLElement;
    const controlPanel = window.document.getElementById('control-panel') as HTMLElement;
    const toggle = window.document.getElementById('sidePanelToggleBtn') as HTMLElement;
    mockRect(panel, { left: 52, top: 697, width: 326, height: 135 });
    mockRect(controlPanel, { left: 52, top: 697, width: 326, height: 188 });
    mockRect(toggle, { left: 223, top: 784, right: 272, bottom: 832, width: 49, height: 48 });

    syncSidePanelAnchorPosition(panel, toggle, window);

    expect(panel.style.left).toBe('32px');
    expect(panel.style.top).toBe('328px');
  });
});
