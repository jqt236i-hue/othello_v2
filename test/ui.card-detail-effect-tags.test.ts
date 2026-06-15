import { JSDOM } from 'jsdom';

describe('card detail effect tags', () => {
  function getTagLabels() {
    return Array.from(document.querySelectorAll('#card-detail-effect-tags .card-detail-effect-tag')).map((el) => el.textContent);
  }

  beforeEach(() => {
    jest.resetModules();
    const dom = new JSDOM(`
      <!doctype html><html><body>
        <div id="card-detail-panel">
          <div id="card-detail-header"></div>
          <div id="card-detail-name"></div>
          <div id="card-detail-desc"></div>
          <div id="card-detail-effect-tags" aria-label="カード効果タグ"></div>
          <div id="card-detail-more" style="display:none;"></div>
          <div id="card-detail-actions"></div>
          <button id="destroy-card-btn">破壊</button>
          <button id="use-card-btn">使用</button>
          <button id="toggle-card-detail-btn">詳細</button>
          <button id="pass-btn">パス</button>
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
        desc: '反転0でも空きマスに配置可能。次に置く石を龍化。置いた時に周囲1マス（8方向）を反転。自ターン開始時はランダムな空きマスへ移動してから周囲1マス（8方向）を反転。移動先が無いときはその場で反転。8ターン持続。反転保護を持つ特殊石。'
      }),
      getSalvationWillTargetCount: () => 0,
      getEqualityWillBoardCounts: () => ({ black: 0, white: 0 })
    };

    global.renderCardUI = jest.fn();
    global.emitBoardUpdate = jest.fn();
  });

  afterEach(() => {
    delete global.CardInteractionEffects;
    delete global.window;
    delete global.document;
  });

  test('card detail panel renders special stone and flip protection tags separately from summary text', () => {
    require('../cards/card-interaction.js');

    window.updateCardDetailPanel();

    const tagsEl = document.getElementById('card-detail-effect-tags');
    expect(tagsEl).not.toBeNull();
    expect(getTagLabels()).toEqual(['特殊石', '反転保護']);
    expect(tagsEl.style.display).toBe('flex');

    const desc = document.getElementById('card-detail-desc').textContent;
    expect(desc).toContain('空きマス自由配置可');
    expect(desc).toContain('置いた石が龍化');
  });

  test('ROBOT_VACUUM_WILL shows the special stone tag without duration tags', () => {
    require('../cards/card-interaction.js');

    const cardDef = {
      id: 'robot_vacuum_01',
      name: 'ロボット掃除機',
      type: 'ROBOT_VACUUM_WILL',
      cost: 17,
      desc: '次に置く石は毎ターン1マス移動し、周囲の敵石を1個吸い込む。'
    };

    global.cardState.selectedCardId = cardDef.id;
    global.cardState.hands.black = [cardDef.id];
    global.CardLogic.getCardDef = () => cardDef;

    window.updateCardDetailPanel();

    const tagsEl = document.getElementById('card-detail-effect-tags');
    expect(tagsEl).not.toBeNull();
    expect(getTagLabels()).toEqual(['特殊石']);
    expect(document.getElementById('card-detail-desc').textContent).toBe('次に置く石は毎ターン1マス移動し、周囲の敵石を1個吸い込む。吸い込むと持続ターンが1増える。');
  });

  test('DESTROY_DRAGON_WILL shows special stone together with flip protection', () => {
    require('../cards/card-interaction.js');

    const cardDef = {
      id: 'destroy_dragon_01',
      name: '破壊龍',
      type: 'DESTROY_DRAGON_WILL',
      cost: 7,
      desc: '次に置く石を破壊龍化。配置時と自ターン開始時に周囲1マス（8方向）の敵石をランダム1個だけ破壊する。3ターン持続。反転保護を持つ特殊石。'
    };

    global.cardState.selectedCardId = cardDef.id;
    global.cardState.hands.black = [cardDef.id];
    global.CardLogic.getCardDef = () => cardDef;

    window.updateCardDetailPanel();

    expect(getTagLabels()).toEqual(['特殊石', '反転保護']);
  });

  test('GUARD_WILL shows full protection without duration tags', () => {
    require('../cards/card-interaction.js');

    const cardDef = {
      id: 'guard_01',
      name: '守る意志',
      type: 'GUARD_WILL',
      cost: 1,
      desc: '自分の石1つに完全保護を付与する。3ターン持続。'
    };

    global.cardState.selectedCardId = cardDef.id;
    global.cardState.hands.black = [cardDef.id];
    global.CardLogic.getCardDef = () => cardDef;

    window.updateCardDetailPanel();

    expect(getTagLabels()).toEqual(['完全保護']);
  });

  test('OBSERVER_WILL shows inviolable without special-stone or duration tags', () => {
    require('../cards/card-interaction.js');

    const cardDef = {
      id: 'observer_will_01',
      name: '盤理の観測者',
      type: 'OBSERVER_WILL',
      cost: 0,
      desc: '相手手札を1枚奪い、観測済みの相手手札のコストを5増やす。観測者を顕現させる。盤上にいる間相手の手札を観測できる。'
    };

    global.cardState.selectedCardId = cardDef.id;
    global.cardState.hands.black = [cardDef.id];
    global.CardLogic.getCardDef = () => cardDef;

    window.updateCardDetailPanel();

    expect(getTagLabels()).toEqual(['不可侵']);
    expect(getTagLabels()).not.toContain('絶対保護');
    expect(document.getElementById('card-detail-desc').textContent).toContain('観測者を顕現させる');
    expect(document.getElementById('card-detail-desc').textContent).not.toContain('次の石を顕現石にする');
  });

  test('THEORY_INCARNATION shows inviolable without special-stone or duration tags', () => {
    require('../cards/card-interaction.js');

    const cardDef = {
      id: 'theory_incarnation_01',
      name: '理論の化身',
      type: 'THEORY_INCARNATION',
      cost: 0,
      desc: '数字マスから実際に得た布石合計42以上で使用可能。空きマスを理論数字マスへ書き換え、理論の化身を顕現させる。'
    };

    global.cardState.selectedCardId = cardDef.id;
    global.cardState.hands.black = [cardDef.id];
    global.CardLogic.getCardDef = () => cardDef;

    window.updateCardDetailPanel();

    expect(getTagLabels()).toEqual(['不可侵']);
    expect(getTagLabels()).not.toContain('絶対保護');
    expect(document.getElementById('card-detail-more').textContent).toContain('5T不可侵の顕現石');
    expect(document.getElementById('card-detail-more').textContent).toContain('最大6回特殊石を出現できる');
  });

  test('BOARD_EXECUTOR shows hole-cell and inviolable without special-stone or duration tags', () => {
    require('../cards/card-interaction.js');

    const cardDef = {
      id: 'board_executor_01',
      name: '盤界の執行者',
      type: 'BOARD_EXECUTOR',
      cost: 0,
      desc: '盤面に自分の特殊石がある場合のみ使用可能。盤面上のすべての特殊石を穴にし、盤界の執行者を顕現させる。'
    };

    global.cardState.selectedCardId = cardDef.id;
    global.cardState.hands.black = [cardDef.id];
    global.CardLogic.getCardDef = () => cardDef;

    window.updateCardDetailPanel();

    expect(getTagLabels()).toEqual(['穴マス化', '不可侵']);
    expect(getTagLabels()).not.toContain('絶対保護');
    expect(document.getElementById('card-detail-desc').textContent).toContain('盤界の執行者を顕現させる');
    expect(document.getElementById('card-detail-more').textContent).toContain('盤界の執行者を4T不可侵の顕現石として出す');
    expect(document.getElementById('card-detail-more').textContent).toContain('絶対保護も貫通');
  });

  test('AFTERIMAGE_WILL shows flip and destroy evasion tags without count-specific labels', () => {
    require('../cards/card-interaction.js');

    const cardDef = {
      id: 'afterimage_will_01',
      name: '避ける意志',
      type: 'AFTERIMAGE_WILL',
      cost: 8,
      desc: '次に置く石を残像石化する。'
    };

    global.cardState.selectedCardId = cardDef.id;
    global.cardState.hands.black = [cardDef.id];
    global.CardLogic.getCardDef = () => cardDef;

    window.updateCardDetailPanel();

    expect(getTagLabels()).toEqual(['特殊石', '反転回避', '破壊回避']);
  });

  test('TIME_STOP_GOD detail follows rulebook timing text without delayed activation tag', () => {
    require('../cards/card-interaction.js');

    const cardDef = {
      id: 'time_stop_01',
      name: '時間停石',
      type: 'TIME_STOP_GOD',
      cost: 0,
      desc: '手札に残り、使用時に自分石3つを破壊して次に置く石を時間停石化。5ターン後時間停止を発動し2連続行動できる。'
    };

    global.cardState.selectedCardId = cardDef.id;
    global.cardState.hands.black = [cardDef.id];
    global.CardLogic.getCardDef = () => cardDef;

    window.updateCardDetailPanel();

    const desc = document.getElementById('card-detail-desc').textContent;
    expect(desc).toContain('手札に残り');
    const detailText = document.getElementById('card-detail-more').textContent;
    expect(detailText).toContain('自分石3つを破壊');
    expect(detailText).toContain('5回目の所有者ターン開始時');
    expect(detailText).toContain('反転保護は持たない');

    expect(getTagLabels()).toEqual(['特殊石']);
  });

  test('METEOR_WILL and BOARD_EXECUTOR show hole-cell tags', () => {
    require('../cards/card-interaction.js');

    const meteorDef = {
      id: 'meteor_01',
      name: '因果抹消',
      type: 'METEOR_WILL',
      cost: 10,
      desc: 'マス1つを選び石ごと完全消滅させて永続の穴にする。'
    };
    global.cardState.selectedCardId = meteorDef.id;
    global.cardState.hands.black = [meteorDef.id];
    global.CardLogic.getCardDef = () => meteorDef;

    window.updateCardDetailPanel();
    expect(getTagLabels()).toEqual(['穴マス化']);

    const boardExecutorDef = {
      id: 'board_executor_01',
      name: '盤界の執行者',
      type: 'BOARD_EXECUTOR',
      cost: 0,
      desc: '盤面上のすべての特殊石を穴にし、盤界の執行者を顕現させる。'
    };
    global.cardState.selectedCardId = boardExecutorDef.id;
    global.cardState.hands.black = [boardExecutorDef.id];
    global.CardLogic.getCardDef = () => boardExecutorDef;

    window.updateCardDetailPanel();
    expect(getTagLabels()).toEqual(['穴マス化', '不可侵']);
  });

  test('TRAP_WILL keeps opponent-turn wording in text and shows the special stone tag', () => {
    require('../cards/card-interaction.js');

    const cardDef = {
      id: 'trap_01',
      name: '罠の意志',
      type: 'TRAP_WILL',
      cost: 4,
      desc: '自分石1つを罠化してターン終了。次の相手ターン中に反転されると、相手の布石を最大10奪う＋手札全破壊。'
    };

    global.cardState.selectedCardId = cardDef.id;
    global.cardState.hands.black = [cardDef.id];
    global.CardLogic.getCardDef = () => cardDef;

    window.updateCardDetailPanel();

    expect(getTagLabels()).toEqual(['特殊石']);
    expect(document.getElementById('card-detail-effect-tags').style.display).toBe('flex');
  });

  test('SALVATION_WILL detail panel shows positive salvageable count as live state', () => {
    require('../cards/card-interaction.js');

    const cardDef = {
      id: 'salvation_01',
      name: '救済の意志',
      type: 'SALVATION_WILL',
      cost: 10,
      desc: '直前の相手ターンで破壊された全ての石を自分の通常石としてランダムな空きマスへ配置する。対象0枚の時は使用不可。対象は自分・相手、通常石・特殊石を問わない。各復活石は、そのマスを起点に通常の挟み反転を行う。'
    };

    global.cardState.selectedCardId = cardDef.id;
    global.cardState.hands.black = [cardDef.id];
    global.CardLogic.getCardDef = () => cardDef;
    global.CardLogic.getSalvationWillTargetCount = () => 3;

    window.updateCardDetailPanel();

    const stateEl = document.getElementById('card-detail-live-state');
    expect(stateEl).not.toBeNull();
    expect(stateEl.textContent).toBe('3個救済可能');
    expect(stateEl.style.display).toBe('block');
    expect(document.getElementById('card-detail-desc').textContent).toContain('直前の相手ターンで破壊された全ての石');
  });

  test('SALVATION_WILL detail panel shows impossible state when nothing can be salvaged', () => {
    require('../cards/card-interaction.js');

    const cardDef = {
      id: 'salvation_01',
      name: '救済の意志',
      type: 'SALVATION_WILL',
      cost: 10,
      desc: '直前の相手ターンで破壊された全ての石を自分の通常石としてランダムな空きマスへ配置する。対象0枚の時は使用不可。対象は自分・相手、通常石・特殊石を問わない。各復活石は、そのマスを起点に通常の挟み反転を行う。'
    };

    global.cardState.selectedCardId = cardDef.id;
    global.cardState.hands.black = [cardDef.id];
    global.CardLogic.getCardDef = () => cardDef;
    global.CardLogic.getSalvationWillTargetCount = () => 0;

    window.updateCardDetailPanel();

    const stateEl = document.getElementById('card-detail-live-state');
    expect(stateEl).not.toBeNull();
    expect(stateEl.textContent).toBe('救済不可能');
    expect(stateEl.style.display).toBe('block');
  });

  test('RIBO_WILL detail panel shows effect summary and unlock note separately', () => {
    require('../cards/card-interaction.js');

    const riboSummary = '布石を30得る。その後9ターンの間4返済。足りない場合は自石4個を消滅させる。';
    const cardDef = {
      id: 'ribo_01',
      name: 'リボ払いの意志',
      type: 'RIBO_WILL',
      cost: 0,
      desc: riboSummary
    };

    global.cardState.selectedCardId = cardDef.id;
    global.cardState.hands.black = [cardDef.id];
    global.cardState.turnIndex = 18;
    global.CardLogic.getCardDef = () => cardDef;

    window.updateCardDetailPanel();

    expect(document.getElementById('card-detail-desc').textContent).toBe(riboSummary);

    const stateEl = document.getElementById('card-detail-live-state');
    expect(stateEl).not.toBeNull();
    expect(stateEl.textContent).toBe('18手後使用可能');
    expect(stateEl.style.display).toBe('block');

    const detailMoreEl = document.getElementById('card-detail-more');
    expect(detailMoreEl.textContent).toContain('自ターン開始ごとに4布石を返済する');
    expect(detailMoreEl.textContent).toContain('ランダム4個消滅');

    global.cardState.turnIndex = 19;
    window.updateCardDetailPanel();

    expect(document.getElementById('card-detail-live-state').style.display).toBe('none');
    expect(document.getElementById('card-detail-more').textContent).toContain('自ターン開始ごとに4布石を返済する');
  });

  test('EQUALITY_WILL detail panel shows current board counts as live state', () => {
    require('../cards/card-interaction.js');

    const cardDef = {
      id: 'equality_will_01',
      name: '平等の意志',
      type: 'EQUALITY_WILL',
      cost: 8,
      desc: '相手の石数が自分より10個以上多い時のみ使用可。盤面の空きマスへランダムに最大3個、自分色の通常石を生成する。各生成石は、そのマスを起点に通常の挟み反転を行う。'
    };

    global.cardState.selectedCardId = cardDef.id;
    global.cardState.hands.black = [cardDef.id];
    global.CardLogic.getCardDef = () => cardDef;
    global.CardLogic.getEqualityWillBoardCounts = () => ({ black: 36, white: 21 });

    window.updateCardDetailPanel();

    const stateEl = document.getElementById('card-detail-live-state');
    expect(stateEl).not.toBeNull();
    expect(stateEl.textContent).toBe('（黒36／白21）');
    expect(stateEl.style.display).toBe('block');
  });

  test('REINFORCEMENT_WILL detail panel shows current candidate count as live state', () => {
    require('../cards/card-interaction.js');

    const cardDef = {
      id: 'reinforcement_01',
      name: '増援の意志',
      type: 'REINFORCEMENT_WILL',
      cost: 6,
      desc: '盤面の角辺以外で石に隣接する空きマスからランダム1マスへ、自分色の通常石を1個配置する。'
    };

    global.cardState.selectedCardId = cardDef.id;
    global.cardState.hands.black = [cardDef.id];
    global.CardLogic.getCardDef = () => cardDef;
    global.CardLogic.getReinforcementWillTargetCount = () => 4;

    window.updateCardDetailPanel();

    const stateEl = document.getElementById('card-detail-live-state');
    expect(stateEl).not.toBeNull();
    expect(stateEl.textContent).toBe('4マス候補');
    expect(stateEl.style.display).toBe('block');
  });

  test('SUPPORT_TROOPS_WILL detail panel shows current candidate count as live state', () => {
    require('../cards/card-interaction.js');

    const cardDef = {
      id: 'support_troops_01',
      name: '援軍の意志',
      type: 'SUPPORT_TROOPS_WILL',
      cost: 14,
      desc: '既存石の近くの空きマスに、自分の通常石を3個ランダム配置(反転可)'
    };

    global.cardState.selectedCardId = cardDef.id;
    global.cardState.hands.black = [cardDef.id];
    global.CardLogic.getCardDef = () => cardDef;
    global.CardLogic.getSupportTroopsWillTargetCount = () => 6;

    window.updateCardDetailPanel();

    const stateEl = document.getElementById('card-detail-live-state');
    expect(stateEl).not.toBeNull();
    expect(stateEl.textContent).toBe('6マス候補');
    expect(stateEl.style.display).toBe('block');
  });

  test('non-salvation detail panel hides live salvage state', () => {
    require('../cards/card-interaction.js');

    window.updateCardDetailPanel();

    const stateEl = document.getElementById('card-detail-live-state');
    expect(stateEl).not.toBeNull();
    expect(stateEl.textContent).toBe('');
    expect(stateEl.style.display).toBe('none');
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

  test('effect tag buttons toggle tag explanation panel for status tags', () => {
    require('../cards/card-interaction.js');

    window.updateCardDetailPanel();

    const tagButtons = Array.from(document.querySelectorAll('#card-detail-effect-tags .card-detail-effect-tag-button'));
    expect(tagButtons.map((el) => el.textContent)).toEqual(['特殊石', '反転保護']);

    const specialStoneButton = tagButtons[0];
    specialStoneButton.dispatchEvent(new window.MouseEvent('click', { bubbles: true, cancelable: true }));

    const panelEl = document.getElementById('card-detail-tab-panel');
    const titleEl = document.getElementById('card-detail-tab-title');
    const bodyEl = document.getElementById('card-detail-tab-body');
    expect(panelEl).not.toBeNull();
    expect(panelEl.classList.contains('is-open')).toBe(true);
    expect(titleEl.textContent).toBe('特殊石');
    expect(bodyEl.textContent).toContain('盤面に残って次ターン以降も能力主体として生きる石');

    specialStoneButton.dispatchEvent(new window.MouseEvent('click', { bubbles: true, cancelable: true }));
    expect(panelEl.classList.contains('is-open')).toBe(false);

    const flipProtectionButton = tagButtons[1];
    flipProtectionButton.dispatchEvent(new window.MouseEvent('click', { bubbles: true, cancelable: true }));

    expect(panelEl).not.toBeNull();
    expect(panelEl.classList.contains('is-open')).toBe(true);
    expect(titleEl.textContent).toBe('反転保護');
    expect(bodyEl.textContent).toContain('反転されない');

    flipProtectionButton.dispatchEvent(new window.MouseEvent('click', { bubbles: true, cancelable: true }));
    expect(panelEl.classList.contains('is-open')).toBe(false);
  });

  test('detail button panel removes duplicated quick lines when shared resolver returns extra detail', () => {
    global.CardInteractionEffects = {
      resolveCardDescriptionTexts: () => ({
        quickText: '反転0でも空きマスに置ける。',
        detailText: '反転0でも空きマスに置ける。\n次の1手だけ有効。',
        distinctDetailText: '次の1手だけ有効。'
      }),
      getQuickCardEffect: () => '反転0でも空きマスに置ける。',
      getDetailCardEffect: () => '反転0でも空きマスに置ける。\n次の1手だけ有効。'
    };

    const cardDef = {
      id: 'free_01',
      name: '自由の意志',
      type: 'FREE_PLACEMENT',
      cost: 14,
      desc: '反転0でも空きマスに置ける。'
    };

    global.cardState.selectedCardId = cardDef.id;
    global.cardState.hands.black = [cardDef.id];
    global.CardLogic.getCardDef = () => cardDef;

    require('../cards/card-interaction.js');

    window.updateCardDetailPanel();
    window.toggleCardDetailExpanded();

    const bodyEl = document.getElementById('card-detail-tab-body');
    expect(bodyEl).not.toBeNull();
    expect(bodyEl.textContent).toBe('次の1手だけ有効。');
  });
});
