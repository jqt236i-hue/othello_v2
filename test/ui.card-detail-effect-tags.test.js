const { JSDOM } = require('jsdom');

describe('card detail effect tags', () => {
  beforeEach(() => {
    jest.resetModules();
    const dom = new JSDOM(`
      <!doctype html><html><body>
        <div id="card-detail-panel">
          <div id="card-detail-header"></div>
          <div id="card-detail-name"></div>
          <div id="card-detail-desc"></div>
          <div id="card-detail-more" style="display:none;"></div>
          <div id="card-detail-actions"></div>
          <button id="destroy-card-btn">破壊</button>
          <button id="use-card-btn">使用</button>
          <button id="toggle-card-detail-btn">詳細</button>
          <button id="pass-btn">パス</button>
          <button id="sell-card-btn" style="display:none;">売却</button>
          <button id="cancel-card-btn" style="display:none;">キャンセル</button>
          <div id="use-card-reason"></div>
        </div>
      </body></html>
    `);

    global.window = dom.window;
    global.document = dom.window.document;

    global.BLACK = 1;
    global.WHITE = -1;

    global.gameState = {
      currentPlayer: 1,
      board: Array.from({ length: 8 }, () => Array(8).fill(0))
    };

    global.cardState = {
      selectedCardId: 'udr_01',
      selectedCardOwnerKey: 'black',
      turnIndex: 0,
      charge: { black: 99, white: 99 },
      hands: { black: ['udr_01'], white: [] },
      hasUsedCardThisTurnByPlayer: { black: false, white: false },
      hasDestroyedCardThisTurnByPlayer: { black: false, white: false },
      pendingEffectByPlayer: { black: null, white: null },
      markers: [],
      discard: []
    };

    global.Core = { getLegalMoves: () => [] };
    global.CardLogic = {
      getCardDef: () => ({
        id: 'udr_01',
        name: '究極反転龍',
        type: 'ULTIMATE_REVERSE_DRAGON',
        cost: 30,
        desc: '反転0でも空きマスに配置可能。次に置く石を龍化。置いた時に周囲1マス（8方向）を反転。自ターン開始時はランダムな空きマスへ移動してから周囲1マス（8方向）を反転。移動先が無いときはその場で反転。5ターン持続。反転保護を持つ特殊石。'
      })
    };

    global.renderCardUI = jest.fn();
    global.emitBoardUpdate = jest.fn();
  });

  afterEach(() => {
    delete global.window;
    delete global.document;
  });

  test('shows effect tags separately from quick description text', () => {
    require('../cards/card-interaction.js');

    window.updateCardDetailPanel();

    const tagsEl = document.getElementById('card-detail-effect-tags');
    expect(tagsEl).not.toBeNull();
    expect(tagsEl.textContent).toContain('反転保護');
    expect(tagsEl.textContent).toContain('特殊石');

    const desc = document.getElementById('card-detail-desc').textContent;
    expect(desc).toContain('置いた石が龍化');
    expect(desc).not.toContain('反転保護を持つ特殊石');
  });

  test('bomb visual cards are tagged as special stone by image rule', () => {
    require('../cards/card-interaction.js');

    const bombCards = [
      {
        id: 'bomb_01',
        name: '時限爆弾',
        type: 'TIME_BOMB',
        cost: 13,
        desc: '盤面上の自分の石1つを時限爆弾化。3ターン後にそのマスと周囲1マス（3x3）を爆破。反転されると解除。'
      },
      {
        id: 'cross_bomb_01',
        name: '十字爆弾',
        type: 'CROSS_BOMB',
        cost: 18,
        desc: '次に置く石を十字爆弾化。通常反転後に即起爆し、その石を起点に縦横2マス（中心含む十字）の石を爆破する。'
      },
      {
        id: 'x_bomb_01',
        name: 'クロス爆弾',
        type: 'X_BOMB',
        cost: 18,
        desc: '次に置く石をクロス爆弾化。通常反転後に即起爆し、その石を起点に斜め2マス（中心含むX字）の石を爆破する。'
      }
    ];

    for (const cardDef of bombCards) {
      expect(cardDef.desc.includes('特殊石')).toBe(false);
      global.cardState.selectedCardId = cardDef.id;
      global.cardState.hands.black = [cardDef.id];
      global.CardLogic.getCardDef = () => cardDef;

      window.updateCardDetailPanel();

      const tagsEl = document.getElementById('card-detail-effect-tags');
      expect(tagsEl).not.toBeNull();
      expect(tagsEl.textContent).toContain('特殊石');
    }
  });

  test('flip-evasion cards are tagged even when text does not contain the exact term', () => {
    require('../cards/card-interaction.js');

    const flipEvadeCards = [
      {
        id: 'escape_01',
        name: '逃亡の意志',
        type: 'ESCAPE_WILL',
        cost: 16,
        desc: '次に置く石を逃亡石化。毎ターン1マス逃げるように移動し、反転対象時は1回回避。移動できるマスがなくなると爆発。'
      },
      {
        id: 'hyperactive_inherit_01',
        name: '多動の継承',
        type: 'HYPERACTIVE_INHERIT_WILL',
        cost: 11,
        desc: '盤面上の自分の石1つに多動状態を付与する。通常石・特殊石を問わず選択でき、他の状態とも併用可能。両者ターン開始時に1マス移動し、移動後に挟めば反転。反転対象時は1回だけマス移動で回避する。持続は10ターン（所有者ターン開始時のみ減算）。'
      }
    ];

    for (const cardDef of flipEvadeCards) {
      expect(cardDef.desc.includes('反転回避')).toBe(false);
      global.cardState.selectedCardId = cardDef.id;
      global.cardState.hands.black = [cardDef.id];
      global.CardLogic.getCardDef = () => cardDef;

      window.updateCardDetailPanel();

      const tagsEl = document.getElementById('card-detail-effect-tags');
      expect(tagsEl).not.toBeNull();
      expect(tagsEl.textContent).toContain('反転回避');
    }
  });

  test('cards that only mention special stones as targets do not get the special-stone tag', () => {
    require('../cards/card-interaction.js');

    const cardDef = {
      id: 'cell_teleport_01',
      name: 'マステレポート',
      type: 'CELL_TELEPORT_WILL',
      cost: 23,
      desc: '盤面上の石があるマス1つを選び、盤面拡張・盤面拡張神で追加できる外側マスのどこかへランダムにテレポートさせる。移動元のマスは穴になる。対象は敵味方・通常石・特殊石を問わない。'
    };

    global.cardState.selectedCardId = cardDef.id;
    global.cardState.hands.black = [cardDef.id];
    global.CardLogic.getCardDef = () => cardDef;

    window.updateCardDetailPanel();

    const tagsEl = document.getElementById('card-detail-effect-tags');
    expect(tagsEl).not.toBeNull();
    expect(tagsEl.textContent).toBe('');
    expect(tagsEl.style.display).toBe('none');
  });

  test('GHOST_WILL uses 幽体 tag and avoids 反転保護 mislabeling', () => {
    require('../cards/card-interaction.js');

    const cardDef = {
      id: 'ghost_01',
      name: '幽霊の意志',
      type: 'GHOST_WILL',
      cost: 5,
      desc: '次に置く石を幽体化する。5ターンの間、反転・破壊の対象にはなるがその石自身は受けない。交換の意志の対象外で、入替や他の効果は通常どおり受ける。'
    };

    global.cardState.selectedCardId = cardDef.id;
    global.cardState.hands.black = [cardDef.id];
    global.CardLogic.getCardDef = () => cardDef;

    window.updateCardDetailPanel();

    const tagsEl = document.getElementById('card-detail-effect-tags');
    expect(tagsEl).not.toBeNull();
    expect(tagsEl.textContent).toContain('幽体');
    expect(tagsEl.textContent).toContain('特殊石');
    expect(tagsEl.textContent).not.toContain('反転保護');
  });

  test('AFTERIMAGE_WILL shows 特殊石/反転回避/破壊回避 tags together', () => {
    require('../cards/card-interaction.js');

    const cardDef = {
      id: 'afterimage_will_01',
      name: '残像の意志',
      type: 'AFTERIMAGE_WILL',
      cost: 8,
      desc: '次に置く石を残像石化。反転回避3回と破壊回避3回を持つ特殊石になり、両方使い切るまで持続する。'
    };

    global.cardState.selectedCardId = cardDef.id;
    global.cardState.hands.black = [cardDef.id];
    global.CardLogic.getCardDef = () => cardDef;

    window.updateCardDetailPanel();

    const tagsEl = document.getElementById('card-detail-effect-tags');
    expect(tagsEl).not.toBeNull();
    expect(tagsEl.textContent).toContain('特殊石');
    expect(tagsEl.textContent).toContain('反転回避');
    expect(tagsEl.textContent).toContain('破壊回避');
  });

  test('TIME_STOP_GOD detail follows rulebook timing text without adding a protection tag', () => {
    require('../cards/card-interaction.js');

    const cardDef = {
      id: 'time_stop_01',
      name: '時間停石',
      type: 'TIME_STOP_GOD',
      cost: 0,
      desc: '使用時にランダムで自分の石3つを破壊し、次に置く石を時間停石化する。5回目の自ターン開始時に時間停止し、そのターンと次のターンを連続で行動する。発動時に効果は終了し、その石は同色の通常石に戻る。先に消えた場合は不発。'
    };

    global.cardState.selectedCardId = cardDef.id;
    global.cardState.hands.black = [cardDef.id];
    global.CardLogic.getCardDef = () => cardDef;

    window.updateCardDetailPanel();

    const desc = document.getElementById('card-detail-desc').textContent;
    expect(desc).toContain('時間停石化');
    const detailText = document.getElementById('card-detail-more').textContent;
    expect(detailText).toContain('5回目の所有者ターン開始時');
    expect(detailText).toContain('モノクロ表示');

    const tagsEl = document.getElementById('card-detail-effect-tags');
    expect(tagsEl).not.toBeNull();
    expect(tagsEl.textContent).toContain('特殊石');
    expect(tagsEl.textContent).not.toContain('反転保護');
  });

  test('throw-chain cards show formal quick descriptions instead of generated-only fallback text', () => {
    require('../cards/card-interaction.js');

    const throwChainCards = [
      {
        id: 'triple_01',
        name: '三連投石',
        type: 'TRIPLE_PLACE',
        cost: 24,
        desc: '使用ターンだけ石を3連続で置ける。使用後、四連投石が手札に加わる。'
      },
      {
        id: 'quad_01',
        name: '四連投石',
        type: 'QUAD_PLACE',
        cost: 24,
        desc: '使用ターンだけ石を4連続で置ける。使用後、無限投石が手札に加わる。'
      },
      {
        id: 'infinite_01',
        name: '無限投石',
        type: 'INFINITE_PLACE',
        cost: 50,
        desc: '使用ターンだけ合法手がなくなるまで石を連続で置ける。置けなくなった時点で終了する。'
      }
    ];

    for (const cardDef of throwChainCards) {
      global.cardState.selectedCardId = cardDef.id;
      global.cardState.hands.black = [cardDef.id];
      global.CardLogic.getCardDef = () => cardDef;

      window.updateCardDetailPanel();

      const desc = document.getElementById('card-detail-desc').textContent;
      expect(desc).toBe(cardDef.desc);
      expect(desc).not.toContain('生成専用');
    }
  });

  test('clicking a tag opens a closable separate tab panel with meaning', () => {
    require('../cards/card-interaction.js');

    window.updateCardDetailPanel();

    const tagButtons = Array.from(document.querySelectorAll('.card-detail-effect-tag-button'));
    const specialTagButton = tagButtons.find((el) => el.textContent === '特殊石');
    expect(specialTagButton).toBeTruthy();

    specialTagButton.click();

    const panelEl = document.getElementById('card-detail-tab-panel');
    expect(panelEl).not.toBeNull();
    expect(panelEl.classList.contains('is-open')).toBe(true);
    expect(panelEl.getAttribute('aria-hidden')).toBe('false');

    const titleEl = document.getElementById('card-detail-tab-title');
    const bodyEl = document.getElementById('card-detail-tab-body');
    expect(titleEl.textContent).toBe('特殊石');
    expect(bodyEl.textContent).toContain('通常石画像を使わない石');
    expect(bodyEl.textContent).toContain('normal_stone-black.png');

    const closeBtn = document.getElementById('card-detail-tab-close-btn');
    expect(closeBtn).not.toBeNull();
    closeBtn.click();

    expect(panelEl.classList.contains('is-open')).toBe(false);
    expect(panelEl.getAttribute('aria-hidden')).toBe('true');
  });

  test('tag tab closes when clicking outside of tags/panel', () => {
    require('../cards/card-interaction.js');

    window.updateCardDetailPanel();

    const tagButtons = Array.from(document.querySelectorAll('.card-detail-effect-tag-button'));
    const specialTagButton = tagButtons.find((el) => el.textContent === '特殊石');
    expect(specialTagButton).toBeTruthy();
    specialTagButton.click();

    const panelEl = document.getElementById('card-detail-tab-panel');
    expect(panelEl).not.toBeNull();
    expect(panelEl.classList.contains('is-open')).toBe(true);

    const outsideEventType = (typeof window.PointerEvent === 'function') ? 'pointerdown' : 'mousedown';
    document.body.dispatchEvent(new window.Event(outsideEventType, { bubbles: true }));

    expect(panelEl.classList.contains('is-open')).toBe(false);
    expect(panelEl.getAttribute('aria-hidden')).toBe('true');
  });

  test('tag tab closes when selecting another card', () => {
    const firstCard = {
      id: 'udr_01',
      name: '究極反転龍',
      type: 'ULTIMATE_REVERSE_DRAGON',
      cost: 30,
      desc: '反転0でも空きマスに配置可能。次に置く石を龍化。置いた時に周囲1マス（8方向）を反転。自ターン開始時はランダムな空きマスへ移動してから周囲1マス（8方向）を反転。移動先が無いときはその場で反転。5ターン持続。反転保護を持つ特殊石。'
    };
    const secondCard = {
      id: 'meteor_01',
      name: '隕石の意志',
      type: 'METEOR_WILL',
      cost: 24,
      desc: '盤面上の任意マス1つを指定し、そのマスの石を破壊する。'
    };

    global.cardState.selectedCardId = firstCard.id;
    global.cardState.hands.black = [firstCard.id, secondCard.id];
    global.CardLogic.getCardDef = (cardId) => {
      if (cardId === secondCard.id) return secondCard;
      return firstCard;
    };

    require('../cards/card-interaction.js');

    window.updateCardDetailPanel();

    const tagButtons = Array.from(document.querySelectorAll('.card-detail-effect-tag-button'));
    const specialTagButton = tagButtons.find((el) => el.textContent === '特殊石');
    expect(specialTagButton).toBeTruthy();
    specialTagButton.click();

    const panelEl = document.getElementById('card-detail-tab-panel');
    expect(panelEl).not.toBeNull();
    expect(panelEl.classList.contains('is-open')).toBe(true);

    window.onCardClick(secondCard.id, 'black');

    expect(panelEl.classList.contains('is-open')).toBe(false);
    expect(panelEl.getAttribute('aria-hidden')).toBe('true');
    expect(global.cardState.selectedCardId).toBe(secondCard.id);
  });

  test('detail button toggles separate tab panel and keeps inline detail hidden', () => {
    require('../cards/card-interaction.js');

    window.updateCardDetailPanel();

    const detailMoreEl = document.getElementById('card-detail-more');
    const detailBtn = document.getElementById('toggle-card-detail-btn');
    expect(detailMoreEl.style.display).toBe('none');
    expect(detailBtn.textContent).toBe('詳細');
    expect(detailBtn.getAttribute('aria-expanded')).toBe('false');

    window.toggleCardDetailExpanded();

    const panelEl = document.getElementById('card-detail-tab-panel');
    const titleEl = document.getElementById('card-detail-tab-title');
    expect(panelEl).not.toBeNull();
    expect(panelEl.classList.contains('is-open')).toBe(true);
    expect(titleEl.textContent).toContain('究極反転龍');
    expect(detailMoreEl.style.display).toBe('none');
    expect(detailBtn.textContent).toBe('閉じる');
    expect(detailBtn.getAttribute('aria-expanded')).toBe('true');

    window.toggleCardDetailExpanded();

    expect(panelEl.classList.contains('is-open')).toBe(false);
    expect(detailBtn.textContent).toBe('詳細');
    expect(detailBtn.getAttribute('aria-expanded')).toBe('false');
    expect(detailMoreEl.style.display).toBe('none');
  });
});
