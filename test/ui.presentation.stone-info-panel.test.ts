import { JSDOM } from 'jsdom';

describe('current board stone catalog presentation', () => {
  function setupDom(body = '<div id="board"></div>') {
    jest.resetModules();
    const dom = new JSDOM(`<!doctype html><html><body>${body}</body></html>`, {
      url: 'http://localhost/'
    });
    global.window = dom.window as any;
    global.document = dom.window.document;
    global.Event = dom.window.Event;
    global.BLACK = 1;
    global.WHITE = -1;
    global.EMPTY = 0;
    global.cardState = { markers: [] };
    global.gameState = {
      board: Array.from({ length: 8 }, () => Array(8).fill(0)),
      currentPlayer: 1
    };
    return require('../ui/presentation/stone-info-controller.ts');
  }

  function frame(cells: any[]) {
    return {
      model: { cells },
      appearance: {
        blackStoneImageUrl: 'http://localhost/assets/black.png',
        whiteStoneImageUrl: 'http://localhost/assets/white.png'
      }
    };
  }

  function stone(row: number, col: number, owner: 'black' | 'white', specialType: string | null = null) {
    return {
      row,
      col,
      stone: { owner, value: owner === 'black' ? 1 : -1, specialType, status: {} },
      markers: specialType
        ? [{ kind: 'special', owner, value: specialType, data: { type: specialType } }]
        : []
    };
  }

  afterEach(() => {
    delete global.window;
    delete global.document;
    delete global.Event;
    delete global.BLACK;
    delete global.WHITE;
    delete global.EMPTY;
    delete global.cardState;
    delete global.gameState;
  });

  test('creates the stone catalog below the manifest panel when the left stack exists', () => {
    const mod = setupDom('<div id="board"></div><div id="left-info-stack"><div id="effect-live-panel"></div><div id="manifest-effect-panel"></div></div>');

    expect(mod.renderCurrentStoneInfoPanel(frame([]))).toBe(true);

    const stackChildren = Array.from(document.getElementById('left-info-stack').children).map((el) => el.id);
    expect(stackChildren).toEqual(['effect-live-panel', 'manifest-effect-panel', 'stone-info-panel']);
    expect(document.getElementById('stone-info-list-title').textContent).toBe('盤上の石');
    expect(document.getElementById('stone-info-list-instruction').textContent).toBe('石を選ぶと情報を表示');
    expect(document.querySelector('.stone-info-list-empty').textContent).toBe('盤上に石はありません');
  });

  test('reuses an existing panel and groups normal stones by owner with counts', () => {
    const mod = setupDom('<div id="stone-info-panel" class="stone-info-panel"><div id="stone-info-name"></div><div id="stone-info-desc"></div><div id="stone-info-meta"></div></div>');
    const existing = document.getElementById('stone-info-panel');

    mod.renderCurrentStoneInfoPanel(frame([
      stone(3, 3, 'black'),
      stone(4, 4, 'black'),
      stone(3, 4, 'white'),
      stone(4, 3, 'white')
    ]));

    expect(document.getElementById('stone-info-panel')).toBe(existing);
    const items = Array.from(document.querySelectorAll('.stone-info-list-item')) as HTMLButtonElement[];
    expect(items).toHaveLength(2);
    expect(items.map((item) => item.getAttribute('data-stone-catalog-key'))).toEqual([
      'normal:black',
      'normal:white'
    ]);
    expect(items.map((item) => item.getAttribute('aria-label'))).toEqual([
      '黒石の情報を表示（盤上に2個）',
      '白石の情報を表示（盤上に2個）'
    ]);
    expect(items.map((item) => item.querySelector('img').getAttribute('src'))).toEqual([
      'http://localhost/assets/black.png',
      'http://localhost/assets/white.png'
    ]);
  });

  test('shows a special stone with its board artwork and opens detail only from the catalog', () => {
    const mod = setupDom();
    global.gameState.board[2][2] = 1;
    global.cardState.markers = [{
      kind: 'specialStone',
      row: 2,
      col: 2,
      owner: 'black',
      data: { type: 'GOLD' }
    }];

    mod.renderCurrentStoneInfoPanel(frame([
      stone(2, 2, 'black', 'GOLD')
    ]));

    const button = document.querySelector('.stone-info-list-item') as HTMLButtonElement;
    expect(button.getAttribute('aria-label')).toBe('金石の情報を表示（盤上に1個）');
    expect(button.querySelector('img').getAttribute('src')).toContain('/assets/images/special-stones/gold_stone.png');
    expect(document.getElementById('stone-info-detail-panel')).toBeNull();

    button.click();

    expect(document.getElementById('stone-info-detail-panel').classList.contains('is-open')).toBe(true);
    expect(document.getElementById('stone-info-name').textContent).toBe('金石');
    expect(document.getElementById('stone-info-desc').textContent).toContain('獲得布石を4倍');

    document.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));

    expect(document.getElementById('stone-info-detail-panel').classList.contains('is-open')).toBe(false);
    expect(document.getElementById('stone-info-detail-backdrop').classList.contains('is-open')).toBe(false);
  });

  test('moves the stone catalog sideways with a vertical mouse wheel without trapping edge scroll', () => {
    const mod = setupDom();
    const currentFrame = frame([
      stone(3, 3, 'black'),
      stone(3, 4, 'white'),
      stone(2, 2, 'black', 'GOLD')
    ]);

    mod.renderCurrentStoneInfoPanel(currentFrame);
    mod.renderCurrentStoneInfoPanel(currentFrame);

    const list = document.getElementById('stone-info-list') as HTMLElement;
    Object.defineProperty(list, 'scrollWidth', { configurable: true, value: 400 });
    Object.defineProperty(list, 'clientWidth', { configurable: true, value: 120 });

    const forward = new window.WheelEvent('wheel', {
      deltaY: 40,
      bubbles: true,
      cancelable: true
    });
    list.dispatchEvent(forward);
    expect(list.scrollLeft).toBe(40);
    expect(forward.defaultPrevented).toBe(true);

    const horizontalTrackpad = new window.WheelEvent('wheel', {
      deltaX: 60,
      deltaY: 20,
      bubbles: true,
      cancelable: true
    });
    list.dispatchEvent(horizontalTrackpad);
    expect(list.scrollLeft).toBe(40);
    expect(horizontalTrackpad.defaultPrevented).toBe(false);

    const browserZoom = new window.WheelEvent('wheel', {
      deltaY: 40,
      ctrlKey: true,
      bubbles: true,
      cancelable: true
    });
    list.dispatchEvent(browserZoom);
    expect(list.scrollLeft).toBe(40);
    expect(browserZoom.defaultPrevented).toBe(false);

    list.scrollLeft = 280;
    const atRightEdge = new window.WheelEvent('wheel', {
      deltaY: 40,
      bubbles: true,
      cancelable: true
    });
    list.dispatchEvent(atRightEdge);
    expect(list.scrollLeft).toBe(280);
    expect(atRightEdge.defaultPrevented).toBe(false);

    const backward = new window.WheelEvent('wheel', {
      deltaY: -40,
      bubbles: true,
      cancelable: true
    });
    list.dispatchEvent(backward);
    expect(list.scrollLeft).toBe(240);
    expect(backward.defaultPrevented).toBe(true);

    list.scrollLeft = 0;
    const atLeftEdge = new window.WheelEvent('wheel', {
      deltaY: -40,
      bubbles: true,
      cancelable: true
    });
    list.dispatchEvent(atLeftEdge);
    expect(list.scrollLeft).toBe(0);
    expect(atLeftEdge.defaultPrevented).toBe(false);

    Object.defineProperty(list, 'scrollWidth', { configurable: true, value: 120 });
    const withoutOverflow = new window.WheelEvent('wheel', {
      deltaY: 40,
      bubbles: true,
      cancelable: true
    });
    list.dispatchEvent(withoutOverflow);
    expect(list.scrollLeft).toBe(0);
    expect(withoutOverflow.defaultPrevented).toBe(false);
  });
});
