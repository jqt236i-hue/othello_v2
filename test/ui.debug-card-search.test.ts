import { JSDOM } from 'jsdom';

describe('debug card search UI', () => {
  afterEach(() => {
    jest.resetModules();
  });

  function createController() {
    const dom = new JSDOM(`
      <!doctype html><html><body>
        <div id="board-stack"><div id="board-frame"><div id="board"></div></div></div>
      </body></html>
    `);
    const selected: any[] = [];
    const used: any[] = [];
    const mod = require('../ui/debug-card-search');
    const controller = mod.createDebugCardSearchController({
      getDocumentRef: () => dom.window.document,
      getCardStateValue: () => ({
        hands: {
          black: ['super_gravity_01', 'super_attraction_01', 'gravity_01', 'sacrifice_will_01', 'chaos_summon_01'],
          white: ['guard_01']
        }
      }),
      getCardDef: (cardId: string) => ({
        super_gravity_01: { id: 'super_gravity_01', name: '超重力', cost: 14 },
        super_attraction_01: { id: 'super_attraction_01', name: '超引力', cost: 9 },
        gravity_01: { id: 'gravity_01', name: '重力', cost: 7 },
        sacrifice_will_01: { id: 'sacrifice_will_01', name: '犠牲の意志', cost: 6 },
        chaos_summon_01: { id: 'chaos_summon_01', name: '混沌召喚', cost: 15 },
        guard_01: { id: 'guard_01', name: '守る意志', cost: 3 }
      } as any)[cardId] || null,
      isDebugEnabled: () => true,
      selectCard: (cardId: string, ownerKey: string, handIndex: number) => selected.push({ cardId, ownerKey, handIndex }),
      useSelectedCard: () => used.push({ ok: true })
    });
    controller.init();
    return { dom, controller, selected, used };
  }

  test('matches display names by hiragana reading prefix', () => {
    const { controller } = createController();

    const results = controller.search('black', 'ち');

    expect(results.map((result: any) => result.name)).toEqual(['超重力', '超引力']);
  });

  test('matches sacrifice will by hiragana reading', () => {
    const { controller } = createController();

    const results = controller.search('black', 'ぎせい');

    expect(results.map((result: any) => result.cardId)).toEqual(['sacrifice_will_01']);
  });

  test('matches chaos summon by hiragana reading', () => {
    const { controller } = createController();

    const results = controller.search('black', 'こんとん');

    expect(results.map((result: any) => result.cardId)).toEqual(['chaos_summon_01']);
  });

  test('does not fall back to card ids when display names are unavailable', () => {
    const dom = new JSDOM(`
      <!doctype html><html><body>
        <div id="board-stack"><div id="board-frame"><div id="board"></div></div></div>
      </body></html>
    `);
    const mod = require('../ui/debug-card-search');
    const controller = mod.createDebugCardSearchController({
      getDocumentRef: () => dom.window.document,
      getCardStateValue: () => ({
        hands: { black: ['super_gravity_01'], white: [] }
      }),
      getCardDef: () => null,
      isDebugEnabled: () => true
    });

    expect(controller.search('black', 'super')).toEqual([]);
  });

  test('opens below/above frame controls and focuses the search input', () => {
    const { dom } = createController();
    const button = dom.window.document.querySelector('.debug-card-search-control--black .debug-card-search-button') as HTMLButtonElement;
    const input = dom.window.document.querySelector('.debug-card-search-control--black .debug-card-search-input') as HTMLInputElement;
    const focusSpy = jest.spyOn(input, 'focus');

    button.click();

    expect(button.getAttribute('aria-expanded')).toBe('true');
    expect(input.hidden).toBe(false);
    expect(focusSpy).toHaveBeenCalled();
  });

  test('shows shortcut keys on the frame search buttons', () => {
    const { dom } = createController();

    expect(dom.window.document.querySelector('.debug-card-search-control--black .debug-card-search-button')?.textContent).toBe('カード検索 /キー');
    expect(dom.window.document.querySelector('.debug-card-search-control--white .debug-card-search-button')?.textContent).toBe('カード検索 ?キー');
  });

  test('slash opens the own-side search and focuses its input', () => {
    const { dom } = createController();
    const input = dom.window.document.querySelector('.debug-card-search-control--black .debug-card-search-input') as HTMLInputElement;
    const focusSpy = jest.spyOn(input, 'focus');

    dom.window.document.dispatchEvent(new dom.window.KeyboardEvent('keydown', {
      key: '/',
      bubbles: true,
      cancelable: true
    }));

    expect(input.hidden).toBe(false);
    expect(focusSpy).toHaveBeenCalled();
  });

  test('question mark opens the opponent-side search and focuses its input', () => {
    const { dom } = createController();
    const input = dom.window.document.querySelector('.debug-card-search-control--white .debug-card-search-input') as HTMLInputElement;
    const focusSpy = jest.spyOn(input, 'focus');

    dom.window.document.dispatchEvent(new dom.window.KeyboardEvent('keydown', {
      key: '?',
      shiftKey: true,
      bubbles: true,
      cancelable: true
    }));

    expect(input.hidden).toBe(false);
    expect(focusSpy).toHaveBeenCalled();
  });

  test('does not handle search shortcuts while typing in an input', () => {
    const { dom } = createController();
    const typingInput = dom.window.document.createElement('input');
    const searchInput = dom.window.document.querySelector('.debug-card-search-control--black .debug-card-search-input') as HTMLInputElement;
    dom.window.document.body.appendChild(typingInput);
    typingInput.focus();

    typingInput.dispatchEvent(new dom.window.KeyboardEvent('keydown', {
      key: '/',
      bubbles: true,
      cancelable: true
    }));

    expect(searchInput.hidden).toBe(true);
  });

  test('uses a candidate through the existing card selection and use entrypoints', () => {
    const { dom, selected, used } = createController();
    const button = dom.window.document.querySelector('.debug-card-search-control--black .debug-card-search-button') as HTMLButtonElement;
    const input = dom.window.document.querySelector('.debug-card-search-control--black .debug-card-search-input') as HTMLInputElement;
    const panel = dom.window.document.querySelector('.debug-card-search-control--black .debug-card-search-panel') as HTMLElement;

    button.click();
    input.value = 'ち';
    input.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
    const useButton = dom.window.document.querySelector('.debug-card-search-control--black .debug-card-search-use') as HTMLButtonElement;
    useButton.click();

    expect(selected).toEqual([{ cardId: 'super_gravity_01', ownerKey: 'black', handIndex: 0 }]);
    expect(used).toEqual([{ ok: true }]);
    expect(panel.hidden).toBe(true);
  });

  test('arrow keys move the active candidate and enter uses it', () => {
    const { dom, selected, used } = createController();
    const button = dom.window.document.querySelector('.debug-card-search-control--black .debug-card-search-button') as HTMLButtonElement;
    const input = dom.window.document.querySelector('.debug-card-search-control--black .debug-card-search-input') as HTMLInputElement;
    const panel = dom.window.document.querySelector('.debug-card-search-control--black .debug-card-search-panel') as HTMLElement;

    button.click();
    input.value = 'ち';
    input.dispatchEvent(new dom.window.Event('input', { bubbles: true }));

    let rows = Array.from(dom.window.document.querySelectorAll('.debug-card-search-control--black .debug-card-search-result'));
    expect(rows.map((row) => row.getAttribute('aria-selected'))).toEqual(['true', 'false']);

    input.dispatchEvent(new dom.window.KeyboardEvent('keydown', {
      key: 'ArrowDown',
      bubbles: true,
      cancelable: true
    }));
    rows = Array.from(dom.window.document.querySelectorAll('.debug-card-search-control--black .debug-card-search-result'));
    expect(rows.map((row) => row.getAttribute('aria-selected'))).toEqual(['false', 'true']);

    input.dispatchEvent(new dom.window.KeyboardEvent('keydown', {
      key: 'ArrowUp',
      bubbles: true,
      cancelable: true
    }));
    rows = Array.from(dom.window.document.querySelectorAll('.debug-card-search-control--black .debug-card-search-result'));
    expect(rows.map((row) => row.getAttribute('aria-selected'))).toEqual(['true', 'false']);

    input.dispatchEvent(new dom.window.KeyboardEvent('keydown', {
      key: 'ArrowDown',
      bubbles: true,
      cancelable: true
    }));
    input.dispatchEvent(new dom.window.KeyboardEvent('keydown', {
      key: 'Enter',
      bubbles: true,
      cancelable: true
    }));

    expect(selected).toEqual([{ cardId: 'super_attraction_01', ownerKey: 'black', handIndex: 1 }]);
    expect(used).toEqual([{ ok: true }]);
    expect(panel.hidden).toBe(true);
  });

  test('uses debug layout state when the global debug flag is not directly available', () => {
    const dom = new JSDOM(`
      <!doctype html><html><body class="debug-layout">
        <div id="board-stack"><div id="board-frame"><div id="board"></div></div></div>
        <button id="debugModeBtn" data-active="true">DEBUG: ON</button>
      </body></html>
    `);
    const mod = require('../ui/debug-card-search');
    const controller = mod.createDebugCardSearchController({
      getDocumentRef: () => dom.window.document,
      getWindowRef: () => dom.window as any,
      getCardStateValue: () => ({
        hands: { black: ['super_gravity_01'], white: [] }
      }),
      getCardDef: () => ({ id: 'super_gravity_01', name: '超重力', cost: 14 })
    });
    controller.init();
    const button = dom.window.document.querySelector('.debug-card-search-control--black .debug-card-search-button') as HTMLButtonElement;
    const input = dom.window.document.querySelector('.debug-card-search-control--black .debug-card-search-input') as HTMLInputElement;

    button.click();
    input.value = 'ち';
    input.dispatchEvent(new dom.window.Event('input', { bubbles: true }));

    expect(dom.window.document.querySelector('.debug-card-search-name')?.textContent).toBe('超重力');
  });
});
