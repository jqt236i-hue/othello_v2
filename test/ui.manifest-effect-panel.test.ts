import { JSDOM } from 'jsdom';
import fs from 'fs';
import path from 'path';

describe('manifest effect panel', () => {
  let dom: JSDOM | null = null;
  let diffRenderer: any;

  beforeEach(() => {
    jest.resetModules();
    dom = new JSDOM('<!doctype html><html><body><div id="board"></div></body></html>');
    (global as any).window = dom.window;
    (global as any).document = dom.window.document;
    (global as any).BLACK = 1;
    (global as any).WHITE = -1;
    (global as any).EMPTY = 0;
    (global as any).getLegalMoves = () => [];
    (global as any).getPlayerKey = (player: any) => (player === -1 ? 'white' : 'black');
    (global as any).applyStoneVisualEffect = jest.fn();
    (global as any).CardLogic = {
      getCardContext: () => ({ protectedStones: [], permaProtectedStones: [], bombs: [] }),
      getSelectableTargets: () => []
    };
    (global as any).gameState = { board: [[0]], currentPlayer: 1 };
    (global as any).cardState = { markers: [], hands: { black: [], white: [] } };
    diffRenderer = require('../ui/diff-renderer.ts');
    diffRenderer.resetRenderStats();
  });

  afterEach(() => {
    if (dom) {
      dom.window.close();
      dom = null;
    }
    delete (global as any).window;
    delete (global as any).document;
    delete (global as any).BLACK;
    delete (global as any).WHITE;
    delete (global as any).EMPTY;
    delete (global as any).getLegalMoves;
    delete (global as any).getPlayerKey;
    delete (global as any).applyStoneVisualEffect;
    delete (global as any).CardLogic;
    delete (global as any).gameState;
    delete (global as any).cardState;
  });

  function renderOnce() {
    diffRenderer.renderBoardDiff(document.getElementById('board'));
    return document.getElementById('manifest-effect-panel') as HTMLElement | null;
  }

  test('last used card tags opt back into pointer events inside the passive left HUD panel', () => {
    const css = fs.readFileSync(path.join(__dirname, '..', 'styles-layout-info.css'), 'utf8');
    const blocksFor = (selector: string) => {
      const blocks: string[] = [];
      const rulePattern = /([^{}]+)\{([^{}]*)\}/g;
      let match: RegExpExecArray | null;
      while ((match = rulePattern.exec(css)) !== null) {
        const selectors = match[1].split(',').map((item) => item.trim());
        if (selectors.includes(selector)) blocks.push(match[2]);
      }
      return blocks;
    };
    const hasDeclaration = (selector: string, declaration: RegExp) => (
      blocksFor(selector).some((block) => declaration.test(block))
    );

    expect(hasDeclaration('#manifest-effect-panel', /pointer-events:\s*none;/)).toBe(true);
    expect(hasDeclaration('#manifest-effect-tags', /pointer-events:\s*auto;/)).toBe(true);
    expect(hasDeclaration('#manifest-effect-tags .card-detail-effect-tag-button', /pointer-events:\s*auto;/)).toBe(true);
  });

  test('shows placeholder copy when no manifestation stone or used card exists', () => {
    const panel = renderOnce();

    expect(panel).not.toBeNull();
    expect(panel?.classList.contains('is-visible')).toBe(true);
    expect(panel?.getAttribute('aria-hidden')).toBe('false');
    expect(panel?.getAttribute('data-manifest-effect-type')).toBeNull();
    expect(panel?.getAttribute('data-manifest-effect-source')).toBeNull();
    expect(document.getElementById('manifest-effect-title')?.textContent).toBe('');
    expect(document.getElementById('manifest-effect-lines')?.textContent).toBe('最後に使ったカードがここに表示されます');
  });

  test('renders last used card when no manifestation stone is active', () => {
    (global as any).cardState = {
      hands: { black: [], white: [] },
      markers: [],
      discard: ['chest_01'],
      lastUsedCardByPlayer: {
        black: { id: 'chest_01', name: '宝箱', desc: '使用時に布石を1〜6ランダムで獲得する。' },
        white: null
      }
    };

    const panel = renderOnce();

    expect(panel?.classList.contains('is-visible')).toBe(true);
    expect(panel?.getAttribute('aria-hidden')).toBe('false');
    expect(panel?.getAttribute('data-manifest-effect-type')).toBe('LAST_USED_CARD');
    expect(panel?.getAttribute('data-manifest-effect-source')).toBe('last-used-card');
    expect(document.getElementById('manifest-effect-title')?.textContent).toBe('最後に使ったカード');
    const ownerStone = document.getElementById('manifest-effect-title')?.querySelector('.manifest-effect-owner-stone') as HTMLElement | null;
    expect(ownerStone).not.toBeNull();
    expect(ownerStone?.classList.contains('is-black')).toBe(true);
    expect(ownerStone?.textContent).toBe('');
    expect(panel?.textContent).toContain('カード: 宝箱');
    expect(panel?.textContent).toContain('効果: 布石を1〜6獲得する。序盤のカード使用を早められる。');
  });

  test('renders a white stone marker when the last used card belongs to white', () => {
    (global as any).cardState = {
      hands: { black: [], white: [] },
      markers: [],
      discard: ['guard_01'],
      lastUsedCardByPlayer: {
        black: null,
        white: { id: 'guard_01', name: '守る意志' }
      }
    };

    renderOnce();

    const title = document.getElementById('manifest-effect-title');
    const ownerStone = title?.querySelector('.manifest-effect-owner-stone') as HTMLElement | null;
    expect(title?.textContent).toBe('最後に使ったカード');
    expect(ownerStone).not.toBeNull();
    expect(ownerStone?.classList.contains('is-white')).toBe(true);
    expect(ownerStone?.textContent).toBe('');
  });

  test('renders clickable effect tags for the last used card', () => {
    (global as any).cardState = {
      hands: { black: [], white: [] },
      markers: [],
      discard: ['meteor_god_01'],
      lastUsedCardByPlayer: {
        black: { id: 'meteor_god_01', name: '因果抹消神' },
        white: null
      }
    };

    const panel = renderOnce();

    const tagButtons = Array.from(panel?.querySelectorAll('#manifest-effect-tags .card-detail-effect-tag-button') || []) as HTMLElement[];
    expect(tagButtons.map((el) => el.textContent)).toEqual(['特殊石', '6ターン持続', '反転保護', '穴マス', '抹消']);

    const holeTag = tagButtons.find((el) => el.textContent === '穴マス');
    expect(holeTag).toBeTruthy();
    holeTag?.dispatchEvent(new window.MouseEvent('click', { bubbles: true, cancelable: true }));

    const popup = document.getElementById('manifest-effect-tag-popover');
    expect(popup).not.toBeNull();
    expect(popup?.classList.contains('is-open')).toBe(true);
    expect(popup?.getAttribute('aria-hidden')).toBe('false');
    expect(document.getElementById('manifest-effect-tag-popover-title')?.textContent).toBe('穴マス');
    expect(document.getElementById('manifest-effect-tag-popover-body')?.textContent).toContain('穴マスには誰も置けず');
  });

  test('keeps manifestation territory above last used card', () => {
    (global as any).cardState = {
      hands: { black: [], white: [] },
      discard: ['chest_01'],
      lastUsedCardByPlayer: {
        black: { id: 'chest_01', name: '宝箱', desc: '使用時に布石を1〜6ランダムで獲得する。' },
        white: null
      },
      markers: [{
        kind: 'manifestStone',
        owner: 'white',
        data: { type: 'OBSERVER_WILL', remainingOwnerTurns: 3 }
      }]
    };

    const panel = renderOnce();

    expect(panel?.classList.contains('is-visible')).toBe(true);
    expect(panel?.getAttribute('data-manifest-effect-type')).toBe('OBSERVER_WILL');
    expect(panel?.getAttribute('data-manifest-effect-source')).toBe('marker');
    expect(panel?.textContent).toContain('観測領域');
    expect(panel?.textContent).not.toContain('最後に使ったカード');
    expect(panel?.textContent).not.toContain('カード: 宝箱');
  });

  test('renders board executor territory and updates hand tax from current hand counts', () => {
    (global as any).cardState = {
      hands: {
        black: ['b1', 'b2', 'b3'],
        white: ['w1', 'w2', 'w3', 'w4', 'w5']
      },
      markers: [{
        kind: 'manifestStone',
        owner: 'black',
        data: { type: 'BOARD_EXECUTOR', remainingOwnerTurns: 4 }
      }]
    };

    const panel = renderOnce();

    expect(panel?.classList.contains('is-visible')).toBe(true);
    expect(panel?.textContent).toContain('執行領域');
    expect(document.getElementById('manifest-effect-title')?.textContent).toBe('執行領域　残り4ターン');
    expect(panel?.textContent).not.toContain('反転布石');
    expect(panel?.textContent).toContain('両者: カード使用不可');
    expect(panel?.textContent).toContain('両者: 手札が多いほど布石を失う');
    expect(panel?.textContent).toContain('黒: 手札3枚 → 次開始 -4');
    expect(panel?.textContent).toContain('白: 手札5枚 → 次開始 -16');
    expect(panel?.querySelector('.manifest-effect-label')?.textContent).toBe('両者:');
    expect(panel?.querySelector('.manifest-effect-value')?.textContent).toContain('カード使用不可');
    expect(panel?.querySelectorAll('.manifest-effect-line--dynamic .manifest-effect-value-strong')).toHaveLength(4);

    (global as any).cardState.hands.white = ['w1', 'w2'];
    renderOnce();

    expect(panel?.textContent).toContain('白: 手札2枚 → 次開始 -1');
    expect(panel?.textContent).not.toContain('白: 手札5枚 → 次開始 -16');
  });

  test('renders board executor territory immediately while next manifestation placement is reserved', () => {
    (global as any).cardState = {
      hands: {
        black: ['b1', 'b2', 'b3'],
        white: ['w1', 'w2', 'w3', 'w4']
      },
      markers: [],
      nextBoardExecutorStoneByPlayer: {
        black: { sourceType: 'BOARD_EXECUTOR' },
        white: null
      }
    };

    const panel = renderOnce();

    expect(panel?.classList.contains('is-visible')).toBe(true);
    expect(panel?.getAttribute('data-manifest-effect-type')).toBe('BOARD_EXECUTOR');
    expect(panel?.getAttribute('data-manifest-effect-source')).toBe('pending-placement');
    expect(panel?.textContent).toContain('執行領域');
    expect(document.getElementById('manifest-effect-title')?.textContent).toBe('執行領域');
    expect(document.getElementById('manifest-effect-title')?.textContent).not.toContain('残り');
    expect(panel?.textContent).toContain('黒: 手札3枚 → 次開始 -4');
    expect(panel?.textContent).toContain('白: 手札4枚 → 次開始 -9');
  });

  test('prefers an active manifestation marker over a pending placement reservation', () => {
    (global as any).cardState = {
      hands: { black: [], white: [] },
      markers: [{
        kind: 'manifestStone',
        owner: 'white',
        data: { type: 'OBSERVER_WILL', remainingOwnerTurns: 3 }
      }],
      nextBoardExecutorStoneByPlayer: {
        black: { sourceType: 'BOARD_EXECUTOR' },
        white: null
      }
    };

    const panel = renderOnce();

    expect(panel?.classList.contains('is-visible')).toBe(true);
    expect(panel?.getAttribute('data-manifest-effect-type')).toBe('OBSERVER_WILL');
    expect(panel?.getAttribute('data-manifest-effect-source')).toBe('marker');
    expect(panel?.textContent).toContain('観測領域');
    expect(document.getElementById('manifest-effect-title')?.textContent).toBe('観測領域　残り3ターン');
    expect(panel?.textContent).not.toContain('執行領域');
  });

  test('renders observer territory text while observer manifestation is active', () => {
    (global as any).cardState = {
      hands: { black: [], white: [] },
      markers: [{
        kind: 'manifestStone',
        owner: 'white',
        data: { type: 'OBSERVER_WILL', remainingOwnerTurns: 3 }
      }]
    };

    const panel = renderOnce();

    expect(panel?.classList.contains('is-visible')).toBe(true);
    expect(panel?.textContent).toContain('観測領域');
    expect(document.getElementById('manifest-effect-title')?.textContent).toBe('観測領域　残り3ターン');
    expect(panel?.textContent).toContain('所有者: 相手手札を常時観測');
    expect(panel?.textContent).toContain('観測済みカード: コスト +5');
    const tagLabels = () => Array.from(panel?.querySelectorAll('#manifest-effect-tags .card-detail-effect-tag-button') || [])
      .map((el) => el.textContent);
    expect(tagLabels()).toEqual(['18手後使用可能', '不可侵', '5ターン持続']);

    (global as any).cardState.markers[0].data.remainingOwnerTurns = 2;
    renderOnce();

    expect(document.getElementById('manifest-effect-title')?.textContent).toBe('観測領域　残り2ターン');
    expect(tagLabels()).toEqual(['18手後使用可能', '不可侵', '5ターン持続']);
  });

  test('renders theory territory text while theory incarnation is active', () => {
    (global as any).cardState = {
      hands: { black: [], white: [] },
      markers: [{
        kind: 'manifestStone',
        owner: 'black',
        data: { type: 'THEORY_INCARNATION', remainingOwnerTurns: 2 }
      }]
    };

    const panel = renderOnce();

    expect(panel?.classList.contains('is-visible')).toBe(true);
    expect(panel?.textContent).toContain('理論領域');
    expect(document.getElementById('manifest-effect-title')?.textContent).toBe('理論領域　残り2ターン');
    expect(panel?.textContent).toContain('所有者: カード使用不可');
    expect(panel?.textContent).toContain('空きマスを理論数字マス化');
    expect(panel?.textContent).toContain('所有者の通常配置後に特殊石が出現');
  });
});
