import { JSDOM } from 'jsdom';
import { createCardInteractionDetailTab } from '../cards/card-interaction-detail-tab';
import * as TextTermHighlighter from '../ui/text-term-highlighter';

describe('card interaction detail tab module', () => {
  let dom: JSDOM;
  let tabRefs: Record<string, any> | null;
  let tabState: { open: boolean; mode: any; key: any; cardId: any };
  let expanded = false;
  let expandedForCardId: any = null;
  let autoDismissBound = false;
  let updateCardDetailPanel: jest.Mock;
  let detailTab: ReturnType<typeof createCardInteractionDetailTab>;

  beforeEach(() => {
    dom = new JSDOM(`
      <!doctype html><html><body>
        <div id="card-detail-effect-tags"></div>
      </body></html>
    `);

    tabRefs = null;
    tabState = { open: false, mode: null, key: null, cardId: null };
    expanded = false;
    expandedForCardId = null;
    autoDismissBound = false;
    updateCardDetailPanel = jest.fn();

    detailTab = createCardInteractionDetailTab({
      getDocumentRef: () => dom.window.document,
      getWindowRef: () => dom.window as any,
      getTabRefs: () => tabRefs,
      setTabRefs: (refs) => { tabRefs = refs; },
      getTabState: () => tabState,
      setTabState: (nextState) => { tabState = nextState; },
      setExpandedState: (open, cardId) => {
        expanded = !!open;
        expandedForCardId = cardId;
      },
      getAutoDismissBound: () => autoDismissBound,
      setAutoDismissBound: (bound) => { autoDismissBound = !!bound; },
      updateCardDetailPanel,
      textTermHighlighterModule: TextTermHighlighter
    });
  });

  test('toggle opens and closes detail panel while syncing expanded state', () => {
    const refs = detailTab.ensureCardDetailTabPanel();
    expect(refs).not.toBeNull();
    expect(dom.window.document.getElementById('card-detail-tab-panel')).not.toBeNull();

    expect(detailTab.toggleCardDetailTabPanel({
      mode: 'detail',
      key: 'ultimate_reverse_dragon_01',
      cardId: 'ultimate_reverse_dragon_01',
      title: '究極反転龍 の詳細効果',
      body: '詳細本文'
    })).toBe(true);

    expect(tabState).toEqual({
      open: true,
      mode: 'detail',
      key: 'ultimate_reverse_dragon_01',
      cardId: 'ultimate_reverse_dragon_01'
    });
    expect(expanded).toBe(true);
    expect(expandedForCardId).toBe('ultimate_reverse_dragon_01');
    expect(refs.root.classList.contains('is-open')).toBe(true);

    expect(detailTab.toggleCardDetailTabPanel({
      mode: 'detail',
      key: 'ultimate_reverse_dragon_01',
      cardId: 'ultimate_reverse_dragon_01',
      title: '究極反転龍 の詳細効果',
      body: '詳細本文'
    })).toBe(false);

    expect(tabState).toEqual({
      open: false,
      mode: null,
      key: null,
      cardId: null
    });
    expect(expanded).toBe(false);
    expect(expandedForCardId).toBeNull();
    expect(refs.root.classList.contains('is-open')).toBe(false);
  });

  test('close button refreshes card detail panel, and outside click dismisses only tag tab', () => {
    detailTab.openCardDetailTabPanel({
      mode: 'detail',
      key: 'free_01',
      cardId: 'free_01',
      title: '自由の意志 の詳細効果',
      body: '次の1手だけ有効。'
    });

    const closeBtn = dom.window.document.getElementById('card-detail-tab-close-btn') as HTMLButtonElement;
    closeBtn.click();

    expect(updateCardDetailPanel).toHaveBeenCalledTimes(1);
    expect(tabState.open).toBe(false);

    detailTab.openCardDetailTabPanel({
      mode: 'tag',
      key: 'flip_protection',
      cardId: 'free_01',
      title: 'タグ説明',
      body: '反転無効'
    });
    detailTab.bindCardDetailTagAutoDismiss();

    dom.window.document.body.dispatchEvent(new dom.window.MouseEvent('mousedown', { bubbles: true }));
    expect(tabState.open).toBe(false);

    detailTab.openCardDetailTabPanel({
      mode: 'detail',
      key: 'free_01',
      cardId: 'free_01',
      title: '自由の意志 の詳細効果',
      body: '次の1手だけ有効。'
    });
    dom.window.document.body.dispatchEvent(new dom.window.MouseEvent('mousedown', { bubbles: true }));
    expect(tabState.open).toBe(true);
  });

  test('renders detail tab body with shared term highlights', () => {
    detailTab.openCardDetailTabPanel({
      mode: 'detail',
      key: 'sample_01',
      cardId: 'sample_01',
      title: '確認カード の詳細効果',
      body: '破壊と反転無効\n特殊石'
    });

    const bodyEl = dom.window.document.getElementById('card-detail-tab-body') as HTMLElement;
    expect(bodyEl.textContent).toBe('破壊と反転無効特殊石');
    expect(bodyEl.innerHTML).toContain('<br>');
    expect(Array.from(bodyEl.querySelectorAll('.game-term-highlight')).map((el) => el.textContent)).toEqual([
      '破壊',
      '反転無効',
      '特殊石'
    ]);
  });
});
