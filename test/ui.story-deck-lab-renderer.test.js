const { JSDOM } = require('jsdom');

describe('story deck lab renderer', () => {
  let dom;

  beforeEach(() => {
    jest.resetModules();
    dom = new JSDOM(`<!doctype html><html><body>
      <select id="rule"></select>
      <input id="search">
      <div id="notice"></div>
      <div id="summary"></div>
      <textarea id="code"></textarea>
      <button id="copy"></button>
      <button id="clear"></button>
      <button id="import"></button>
      <div id="selectedCount"></div>
      <div id="candidateCount"></div>
      <div id="header"></div>
      <div id="selected"></div>
      <div id="candidate"></div>
    </body></html>`, { url: 'http://localhost/' });

    global.window = dom.window;
    global.document = dom.window.document;
    global.navigator = dom.window.navigator;
  });

  afterEach(() => {
    try {
      dom.window.close();
    } catch (e) {
      // ignore
    }
    delete global.window;
    delete global.document;
    delete global.navigator;
  });

  test('fills blank card title from cardDef when createCardFaceElement omits it', () => {
    window.createCardFaceElement = jest.fn(() => {
      const cardEl = document.createElement('div');
      cardEl.className = 'card-item visible';

      const blankName = document.createElement('span');
      blankName.className = 'card-name';
      cardEl.appendChild(blankName);

      const costBadge = document.createElement('div');
      costBadge.className = 'card-cost-badge';
      costBadge.textContent = 'コスト44';
      cardEl.appendChild(costBadge);

      return cardEl;
    });

    const StoryDeckLabRendererModule = require('../ui/story-deck-lab/story-deck-lab-renderer');
    StoryDeckLabRendererModule.renderStoryDeckLab(
      {
        ruleSetSelect: document.getElementById('rule'),
        searchInput: document.getElementById('search'),
        notice: document.getElementById('notice'),
        summary: document.getElementById('summary'),
        codeTextarea: document.getElementById('code'),
        copyBtn: document.getElementById('copy'),
        clearBtn: document.getElementById('clear'),
        importBtn: document.getElementById('import'),
        selectedCountLabel: document.getElementById('selectedCount'),
        candidateCountLabel: document.getElementById('candidateCount'),
        headerSummary: document.getElementById('header'),
        selectedCards: document.getElementById('selected'),
        candidateCards: document.getElementById('candidate')
      },
      {
        ruleSetId: 'free30',
        ruleSetDescription: '30枚固定 / 同一カード上限なし',
        searchText: '',
        summary: { totalCount: 0, deckSize: 30, remainingCount: 30, distinctCount: 0 },
        noticeText: '',
        noticeIsError: false,
        codeValue: '',
        codePlaceholder: '',
        canCopyCode: false,
        canImportCode: false,
        headerSummaryText: 'ローカル設定: 自由30 / 30枚',
        selectedCards: [],
        candidateCards: [
          {
            cardId: 'taboo_reverse_01',
            selectedCount: 0,
            addDisabled: false,
            cardDef: {
              id: 'taboo_reverse_01',
              name_ja: '禁忌の反転',
              cost: 44,
              display_type_ja: '禁忌'
            }
          }
        ]
      },
      {
        onAddCard: jest.fn(),
        onRemoveCard: jest.fn()
      }
    );

    const cardEl = document.querySelector('#candidate .deck-builder-card');
    const cardName = document.querySelector('#candidate .card-name');
    expect(cardName).not.toBeNull();
    expect(cardName.textContent).toBe('禁忌の反転');
    const typeBadge = document.querySelector('#candidate .card-type-badge');
    expect(typeBadge).not.toBeNull();
    expect(typeBadge.textContent).toBe('禁忌');
    const costBadge = cardEl.querySelector('.card-cost-badge');
    expect(costBadge).not.toBeNull();
    expect(costBadge.parentElement).toBe(cardEl);
    expect(cardEl.querySelector('.card-badge-row .card-cost-badge')).toBeNull();
  });
});
