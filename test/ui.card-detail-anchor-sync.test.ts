import { JSDOM } from 'jsdom';

describe('card detail landscape anchor sync', () => {
  afterEach(() => {
    delete (global as any).window;
    delete (global as any).document;
  });

  function setupDom(width = 1280, height = 900) {
    const dom = new JSDOM(`<!doctype html><html><body>
      <div id="side-panel"></div>
      <div id="cpu-level-label"></div>
      <div id="card-detail-panel"></div>
    </body></html>`);
    (global as any).window = dom.window;
    (global as any).document = dom.window.document;
    Object.defineProperty(dom.window, 'innerWidth', { value: width, configurable: true });
    Object.defineProperty(dom.window, 'innerHeight', { value: height, configurable: true });
    return dom;
  }

  test('sets bottom reserve when side panel occupies lower landscape space', () => {
    const dom = setupDom();
    const sidePanel = dom.window.document.getElementById('side-panel') as HTMLElement;
    const cpuLabel = dom.window.document.getElementById('cpu-level-label') as HTMLElement;
    const cardDetail = dom.window.document.getElementById('card-detail-panel') as HTMLElement;
    sidePanel.getBoundingClientRect = () => ({ x: 0, y: 0, left: 0, top: 700, right: 240, bottom: 900, width: 240, height: 200, toJSON: () => ({}) });
    cpuLabel.getBoundingClientRect = () => ({ x: 0, y: 0, left: 0, top: 260, right: 240, bottom: 300, width: 240, height: 40, toJSON: () => ({}) });
    cardDetail.getBoundingClientRect = () => ({ x: 0, y: 0, left: 0, top: 0, right: 320, bottom: 220, width: 320, height: 220, toJSON: () => ({}) });

    const detailPanelModule = require('../cards/card-interaction-detail-panel.ts');
    const sync = detailPanelModule.createCardDetailLandscapeAnchorSync();
    sync.sync();

    expect(dom.window.document.documentElement.style.getPropertyValue('--card-detail-landscape-bottom-reserve')).toBe('220px');
  });

  test('clears bottom reserve outside landscape anchor target', () => {
    const dom = setupDom(800, 900);
    dom.window.document.documentElement.style.setProperty('--card-detail-landscape-bottom-reserve', '220px');

    const detailPanelModule = require('../cards/card-interaction-detail-panel.ts');
    const sync = detailPanelModule.createCardDetailLandscapeAnchorSync();
    sync.sync();

    expect(dom.window.document.documentElement.style.getPropertyValue('--card-detail-landscape-bottom-reserve')).toBe('');
  });

  test('keeps bottom reserve cleared on wide desktop landscape even if side panel grows downward', () => {
    const dom = setupDom(1366, 768);
    const sidePanel = dom.window.document.getElementById('side-panel') as HTMLElement;
    sidePanel.getBoundingClientRect = () => ({ x: 0, y: 0, left: 0, top: 420, right: 240, bottom: 740, width: 240, height: 320, toJSON: () => ({}) });

    const detailPanelModule = require('../cards/card-interaction-detail-panel.ts');
    const sync = detailPanelModule.createCardDetailLandscapeAnchorSync();
    sync.sync();

    expect(dom.window.document.documentElement.style.getPropertyValue('--card-detail-landscape-bottom-reserve')).toBe('');
  });
});
