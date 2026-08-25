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

  function boardCell(row: number, col: number, markers: any[], stoneValue: any = null) {
    return {
      row,
      col,
      kind: stoneValue ? 'playable' : 'playable',
      stone: stoneValue,
      markers
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
    expect(document.getElementById('stone-info-list-title').textContent).toBe('盤上の石・マス');
    expect(document.getElementById('stone-info-list-instruction').textContent).toBe('石・マスを選ぶと情報を表示');
    expect(document.getElementById('stone-info-list').getAttribute('aria-label')).toBe('盤上の石・マス');
    expect(document.querySelector('.stone-info-list-empty').textContent).toBe('盤上に石・マスはありません');
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

  test('lists every canonical board marker from settled frame kinds and excludes stone statuses and decorations', () => {
    const mod = setupDom();
    const markerCells = [
      boardCell(0, 0, [{ kind: 'blockade', owner: 'black', data: { remainingOwnerTurns: 3 } }]),
      { ...boardCell(0, 1, [{ kind: 'blockade', owner: null, data: { type: 'METEOR_HOLE' } }]), kind: 'hole' },
      boardCell(0, 2, [{ kind: 'frozen', owner: 'white', data: { remainingOwnerTurns: 4 } }]),
      boardCell(0, 3, [{ kind: 'seed', owner: 'black', data: { remainingOwnerTurns: 5 } }]),
      boardCell(0, 4, [{ kind: 'poison-cell', owner: null, data: { remainingTurns: 9, sourcePlayer: 'black' } }]),
      boardCell(0, 5, [{ kind: 'poison-cell', owner: null, data: { remainingTurns: 9, sourcePlayer: 'black' } }]),
      boardCell(0, 6, [{ kind: 'scorched-cell', owner: null, data: { remainingTurns: 8, sourcePlayer: 'white' } }]),
      boardCell(0, 7, [{ kind: 'healing-cell', owner: null, data: { remainingTurns: 7, sourcePlayer: 'black' } }]),
      boardCell(1, 0, [
        { kind: 'poisoned', data: { remainingTurns: 4 } },
        { kind: 'scorched', data: { remainingTurns: 2 } },
        { kind: 'guard', data: { remainingOwnerTurns: 3 } },
        { kind: 'living-will-aura', data: {} },
        { kind: 'board-bonus', data: { amount: 2 } },
        { kind: 'theory-number-cell', data: { number: 7 } }
      ])
    ];

    mod.renderCurrentStoneInfoPanel(frame(markerCells));

    const items = Array.from(document.querySelectorAll('.stone-info-list-item')) as HTMLButtonElement[];
    expect(items.map((item) => item.dataset.stoneCatalogKey)).toEqual([
      'board-marker:BLOCKADE',
      'board-marker:METEOR_HOLE',
      'board-marker:FREEZE',
      'board-marker:SEED',
      'board-marker:POISON_CELL',
      'board-marker:SCORCHED_CELL',
      'board-marker:HEALING_CELL'
    ]);
    expect(items.every((item) => item.dataset.stoneCatalogSubject === 'board-marker')).toBe(true);
    expect(document.querySelector('[data-stone-catalog-key="board-marker:POISON_CELL"] .stone-info-list-count')?.textContent)
      .toBe('×2');
    expect(document.querySelector('[data-stone-catalog-key="board-marker:BLOCKADE"] img')?.getAttribute('src'))
      .toContain('assets/images/other/X.png');
    expect(document.querySelector('[data-stone-catalog-key="board-marker:FREEZE"] img')?.getAttribute('src'))
      .toContain('assets/images/other/ICE.png');
    expect(document.querySelector('[data-stone-catalog-key="board-marker:SEED"] img')?.getAttribute('src'))
      .toContain('assets/images/other/seed.png');
    expect(document.querySelector('[data-stone-catalog-key="board-marker:POISON_CELL"] .stone-info-marker-tile--poison-cell'))
      .not.toBeNull();
    expect(document.querySelector('[data-stone-catalog-key="board-marker:METEOR_HOLE"] .stone-info-list-marker-timer'))
      .toBeNull();
  });

  test('keeps stones and board markers on the same cell as separate detail targets', () => {
    const mod = setupDom();
    const blackStone = stone(2, 2, 'black');
    blackStone.markers.push({ kind: 'special', owner: 'black', value: 'TRAP', data: { type: 'TRAP' } });
    blackStone.markers.push({ kind: 'poisoned', owner: null, data: { remainingTurns: 4 } });
    blackStone.markers.push({ kind: 'scorched', owner: null, data: { remainingTurns: 2 } });
    blackStone.markers.push({ kind: 'frozen', owner: 'white', data: { remainingOwnerTurns: 4 } });
    const goldStone = stone(3, 3, 'black', 'GOLD');
    goldStone.markers.push({ kind: 'poisoned', owner: null, data: { remainingTurns: 3 } });
    goldStone.markers.push({ kind: 'scorched', owner: null, data: { remainingTurns: 1 } });
    goldStone.markers.push({ kind: 'poison-cell', owner: null, data: { remainingTurns: 9, sourcePlayer: 'white' } });

    mod.renderCurrentStoneInfoPanel(frame([blackStone, goldStone]));

    const normalButton = document.querySelector('[data-stone-catalog-key="normal:black"]') as HTMLButtonElement;
    const goldButton = document.querySelector('[data-stone-catalog-key="special:GOLD:black"]') as HTMLButtonElement;
    const freezeButton = document.querySelector('[data-stone-catalog-key="board-marker:FREEZE"]') as HTMLButtonElement;
    const poisonButton = document.querySelector('[data-stone-catalog-key="board-marker:POISON_CELL"]') as HTMLButtonElement;
    expect(document.querySelector('[data-stone-catalog-key*="TRAP"]')).toBeNull();

    normalButton.click();
    expect(document.getElementById('stone-info-name').textContent).toBe('黒石');
    expect(document.getElementById('stone-info-meta').textContent).toContain('通常石');
    expect(document.getElementById('stone-info-meta').textContent).toContain('毒状態 残り4T');
    expect(document.getElementById('stone-info-meta').textContent).toContain('灼熱カウント 残り2T');
    expect(document.getElementById('stone-info-meta').getAttribute('aria-label')).toBe('効果タグ');
    expect(document.getElementById('stone-info-detail-close-btn').getAttribute('aria-label')).toBe('詳細情報を閉じる');
    (document.querySelector('[data-badge="毒状態 残り4T"]') as HTMLButtonElement).click();
    expect(document.getElementById('stone-info-tag-title').textContent).toBe('毒状態 残り4T');
    expect(document.getElementById('stone-info-tag-body').textContent).toContain('完全保護で解除');

    freezeButton.click();
    expect(document.getElementById('stone-info-name').textContent).toBe('凍結マス');
    expect(document.getElementById('stone-info-meta').textContent).toContain('特殊マス');
    expect(document.getElementById('stone-info-meta').textContent).toContain('残り4T');
    expect(document.getElementById('stone-info-meta').textContent).not.toContain('特殊石');

    goldButton.click();
    expect(document.getElementById('stone-info-name').textContent).toBe('金石');
    expect(document.getElementById('stone-info-meta').textContent).toContain('毒状態 残り3T');
    expect(document.getElementById('stone-info-meta').textContent).toContain('灼熱カウント 残り1T');

    poisonButton.click();
    expect(document.getElementById('stone-info-name').textContent).toBe('毒マス');
    expect(document.getElementById('stone-info-desc').textContent).toContain('10ターン持続');
    expect(document.getElementById('stone-info-meta').textContent).toContain('残り9T');
    expect(document.getElementById('stone-info-detail-marker').classList.contains('stone-info-marker-tile--poison-cell'))
      .toBe(true);
  });

  test('groups healing cells with different timers by type and refreshes all settled timers in detail', () => {
    const mod = setupDom();
    const healingCell = (row: number, remainingTurns: number) => boardCell(row, 0, [{
      kind: 'healing-cell',
      owner: null,
      data: { remainingTurns, sourcePlayer: 'black' }
    }]);

    mod.renderCurrentStoneInfoPanel(frame([healingCell(0, 8), healingCell(1, 6)]));
    const healingEntries = Array.from(document.querySelectorAll('[data-stone-catalog-key="board-marker:HEALING_CELL"]'));
    expect(healingEntries).toHaveLength(1);
    expect(healingEntries[0].querySelector('.stone-info-list-count')?.textContent).toBe('×2');
    expect(healingEntries[0].querySelector('.stone-info-list-marker-timer')).toBeNull();

    (healingEntries[0] as HTMLButtonElement).click();
    expect(document.getElementById('stone-info-meta').textContent).toContain('残り8T');
    expect(document.getElementById('stone-info-meta').textContent).toContain('残り6T');

    mod.renderCurrentStoneInfoPanel(frame([healingCell(0, 7), healingCell(1, 5)]));
    (document.querySelector('[data-stone-catalog-key="board-marker:HEALING_CELL"]') as HTMLButtonElement).click();
    expect(document.getElementById('stone-info-meta').textContent).toContain('残り7T');
    expect(document.getElementById('stone-info-meta').textContent).toContain('残り5T');
    expect(document.getElementById('stone-info-meta').textContent).not.toContain('残り8T');
    expect(document.getElementById('stone-info-meta').textContent).not.toContain('残り6T');
  });

  test('refreshes a stone overlay status when only its settled timer changes', () => {
    const mod = setupDom();
    const poisonedStone = (remainingTurns: number) => {
      const current = stone(2, 2, 'black');
      current.markers.push({ kind: 'poisoned', owner: null, data: { remainingTurns } });
      return current;
    };

    mod.renderCurrentStoneInfoPanel(frame([poisonedStone(4)]));
    (document.querySelector('[data-stone-catalog-key="normal:black"]') as HTMLButtonElement).click();
    expect(document.getElementById('stone-info-meta').textContent).toContain('毒状態 残り4T');

    mod.renderCurrentStoneInfoPanel(frame([poisonedStone(3)]));
    (document.querySelector('[data-stone-catalog-key="normal:black"]') as HTMLButtonElement).click();
    expect(document.getElementById('stone-info-meta').textContent).toContain('毒状態 残り3T');
    expect(document.getElementById('stone-info-meta').textContent).not.toContain('毒状態 残り4T');
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
