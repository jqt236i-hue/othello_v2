import { JSDOM } from 'jsdom';

describe('game keyboard shortcuts', () => {
  afterEach(() => {
    jest.resetModules();
  });

  function key(dom: JSDOM, init: KeyboardEventInit): KeyboardEvent {
    const event = new dom.window.KeyboardEvent('keydown', {
      bubbles: true,
      cancelable: true,
      ...init
    });
    dom.window.document.dispatchEvent(event);
    return event;
  }

  function buildDom(extra = ''): JSDOM {
    return new JSDOM(`
      <!doctype html><html><body>
        <div id="board"><canvas aria-hidden="true"></canvas></div>
        <div id="hand-black" class="hand-container" data-owner-key="black">
          <div class="hand-track">
            <div class="card-item visible clickable" data-card-id="alpha" data-owner-key="black"></div>
            <div class="card-item visible clickable" data-card-id="beta" data-owner-key="black"></div>
            <div class="card-item visible clickable" data-card-id="gamma" data-owner-key="black"></div>
          </div>
        </div>
        ${extra}
      </body></html>
    `);
  }

  function createController(dom: JSDOM, overrides: Record<string, unknown> = {}) {
    const mod = require('../ui/game-keyboard-shortcuts');
    const BoardInput = require('../ui/board-input-controller');
    const placed: Array<{ row: number; col: number }> = [];
    const used: string[] = [];
    const destroyed: string[] = [];
    const clicks: string[] = [];
    const cursorKeys: Array<string | null> = [];

    dom.window.document.querySelectorAll<HTMLElement>('.card-item').forEach((el) => {
      el.addEventListener('click', () => {
        clicks.push(String(el.dataset.cardId || ''));
        dom.window.document.querySelectorAll('.card-item.selected').forEach((selected) => {
          selected.classList.remove('selected');
        });
        el.classList.add('selected');
      });
    });

    const boardInputController = BoardInput.createBoardInputController({
      getLegalCells: () => [
        { row: 2, col: 3 },
        { row: 2, col: 5 },
        { row: 4, col: 5 }
      ],
      handleCellClick: (row: number, col: number) => placed.push({ row, col }),
      setKeyboardCursorKey: (key: string | null) => cursorKeys.push(key)
    });
    boardInputController.activate();

    const controller = mod.createGameKeyboardShortcutController({
      getDocumentRef: () => dom.window.document,
      getWindowRef: () => dom.window as any,
      getCardStateValue: () => ({ selectedCardId: dom.window.document.querySelector('.card-item.selected')?.getAttribute('data-card-id') || null }),
      boardInputController,
      useSelectedCard: () => used.push('use'),
      destroySelectedHandCard: () => destroyed.push('destroy'),
      ...overrides
    });
    controller.init();
    return { controller, boardInputController, placed, used, destroyed, clicks, cursorKeys };
  }

  test('WASD moves the legal cursor and Space places through handleCellClick', () => {
    const dom = buildDom();
    const { controller, placed, cursorKeys } = createController(dom);

    const first = key(dom, { code: 'KeyD', key: 'd' });
    expect(first.defaultPrevented).toBe(true);
    expect(controller.getState().legalCursorKey).toBe('2,3');

    key(dom, { code: 'KeyD', key: 'd' });
    expect(controller.getState().legalCursorKey).toBe('2,5');

    key(dom, { code: 'KeyS', key: 's' });
    expect(controller.getState().legalCursorKey).toBe('4,5');

    const place = key(dom, { code: 'Space', key: ' ' });
    expect(place.defaultPrevented).toBe(true);
    expect(placed).toEqual([{ row: 4, col: 5 }]);
    expect(cursorKeys).toEqual(['2,3', '2,5', '4,5']);
    expect(dom.window.document.querySelector('.cell')).toBeNull();
  });

  test('Space ignores repeats to avoid repeated placement', () => {
    const dom = buildDom();
    const { placed } = createController(dom);

    key(dom, { code: 'KeyD', key: 'd' });
    key(dom, { code: 'Space', key: ' ', repeat: true });

    expect(placed).toEqual([]);
  });

  test('Shift+A and Shift+D move clickable hand card selection by DOM click', () => {
    const dom = buildDom();
    const { clicks } = createController(dom);

    key(dom, { code: 'KeyD', key: 'D', shiftKey: true });
    key(dom, { code: 'KeyD', key: 'D', shiftKey: true });
    key(dom, { code: 'KeyA', key: 'A', shiftKey: true });

    expect(clicks).toEqual(['alpha', 'beta', 'alpha']);
    expect(dom.window.document.querySelector('[data-card-id="alpha"]')?.classList.contains('selected')).toBe(true);
  });

  test('Enter uses selected card and Shift+Enter destroys selected card', () => {
    const dom = buildDom();
    const { used, destroyed } = createController(dom);

    (dom.window.document.querySelector('[data-card-id="beta"]') as HTMLElement).classList.add('selected');

    const enter = key(dom, { key: 'Enter' });
    const shiftEnter = key(dom, { key: 'Enter', shiftKey: true });

    expect(enter.defaultPrevented).toBe(true);
    expect(shiftEnter.defaultPrevented).toBe(true);
    expect(used).toEqual(['use']);
    expect(destroyed).toEqual(['destroy']);
  });

  test('spectator keyboard actions are read-only for board placement and card commands', () => {
    const dom = buildDom();
    (dom.window as any).NetworkMatchClient = {
      isSpectator: jest.fn(() => true)
    };
    (dom.window as any).writeNetworkStatus = jest.fn();
    const { placed, used, destroyed, clicks } = createController(dom);

    key(dom, { code: 'KeyD', key: 'd' });
    const place = key(dom, { code: 'Space', key: ' ' });
    (dom.window.document.querySelector('[data-card-id="beta"]') as HTMLElement).classList.add('selected');
    const enter = key(dom, { key: 'Enter' });
    const shiftEnter = key(dom, { key: 'Enter', shiftKey: true });
    const selectCard = key(dom, { code: 'KeyD', key: 'D', shiftKey: true });

    expect(place.defaultPrevented).toBe(true);
    expect(enter.defaultPrevented).toBe(true);
    expect(shiftEnter.defaultPrevented).toBe(true);
    expect(selectCard.defaultPrevented).toBe(true);
    expect(placed).toEqual([]);
    expect(used).toEqual([]);
    expect(destroyed).toEqual([]);
    expect(clicks).toEqual([]);
    expect((dom.window as any).writeNetworkStatus).toHaveBeenCalledWith('観測中は操作できません', true);
  });

  test('shortcuts are ignored while typing or composing', () => {
    const dom = buildDom('<input id="typing" />');
    const { placed, used } = createController(dom);
    const input = dom.window.document.getElementById('typing') as HTMLInputElement;
    input.focus();

    input.dispatchEvent(new dom.window.KeyboardEvent('keydown', {
      code: 'KeyD',
      key: 'd',
      bubbles: true,
      cancelable: true
    }));
    dom.window.document.dispatchEvent(new dom.window.KeyboardEvent('keydown', {
      key: 'Enter',
      bubbles: true,
      cancelable: true,
      isComposing: true
    } as KeyboardEventInit));

    expect(placed).toEqual([]);
    expect(used).toEqual([]);
  });

  test('button focus still allows WASD movement but protects Space and Enter', () => {
    const dom = buildDom('<button id="menu-button" type="button">menu</button>');
    const { controller, placed, used } = createController(dom);
    const button = dom.window.document.getElementById('menu-button') as HTMLButtonElement;
    button.focus();

    button.dispatchEvent(new dom.window.KeyboardEvent('keydown', {
      code: 'KeyD',
      key: 'd',
      bubbles: true,
      cancelable: true
    }));
    button.dispatchEvent(new dom.window.KeyboardEvent('keydown', {
      code: 'Space',
      key: ' ',
      bubbles: true,
      cancelable: true
    }));

    (dom.window.document.querySelector('[data-card-id="beta"]') as HTMLElement).classList.add('selected');
    button.dispatchEvent(new dom.window.KeyboardEvent('keydown', {
      key: 'Enter',
      bubbles: true,
      cancelable: true
    }));

    expect(controller.getState().legalCursorKey).toBe('2,3');
    expect(placed).toEqual([]);
    expect(used).toEqual([]);
  });

  test('shortcuts are ignored while blocking panels are open', () => {
    const dom = buildDom('<div class="debug-card-search-control is-open"></div>');
    const { controller, placed, clicks } = createController(dom);

    key(dom, { code: 'KeyD', key: 'd' });
    key(dom, { code: 'Space', key: ' ' });
    key(dom, { code: 'KeyD', key: 'D', shiftKey: true });

    expect(placed).toEqual([]);
    expect(clicks).toEqual([]);
    expect(controller.getState().legalCursorKey).toBeNull();
  });

  test('shortcuts are ignored while profile overlay is open even with button focus', () => {
    const dom = buildDom('<div id="profileOverlay" class="is-open"><button id="profileTabProfile" type="button"></button></div>');
    const { controller, placed, used, destroyed, clicks } = createController(dom);
    const profileButton = dom.window.document.getElementById('profileTabProfile') as HTMLButtonElement;
    profileButton.focus();

    profileButton.dispatchEvent(new dom.window.KeyboardEvent('keydown', {
      code: 'KeyD',
      key: 'd',
      bubbles: true,
      cancelable: true
    }));
    profileButton.dispatchEvent(new dom.window.KeyboardEvent('keydown', {
      code: 'Space',
      key: ' ',
      bubbles: true,
      cancelable: true
    }));
    profileButton.dispatchEvent(new dom.window.KeyboardEvent('keydown', {
      key: 'Enter',
      bubbles: true,
      cancelable: true
    }));
    profileButton.dispatchEvent(new dom.window.KeyboardEvent('keydown', {
      code: 'KeyD',
      key: 'D',
      shiftKey: true,
      bubbles: true,
      cancelable: true
    }));

    expect(placed).toEqual([]);
    expect(used).toEqual([]);
    expect(destroyed).toEqual([]);
    expect(clicks).toEqual([]);
    expect(controller.getState().legalCursorKey).toBeNull();
  });

  test('destroy clears the shared model cursor without writing a DOM class', () => {
    const dom = buildDom();
    const { controller, boardInputController, cursorKeys } = createController(dom);

    key(dom, { code: 'KeyD', key: 'd' });
    controller.destroy();

    expect(boardInputController.getState().keyboardCursorKey).toBeNull();
    expect(cursorKeys).toEqual(['2,3', null]);
    expect(dom.window.document.querySelector('.keyboard-legal-cursor')).toBeNull();
  });
});
