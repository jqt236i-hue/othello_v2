/* eslint-env jest */
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

describe('cards catalog consistency', () => {
  function normalizeCard(card) {
    return {
      id: card.id,
      name: card.name || card.name_ja || '',
      type: card.type,
      cost: Number(card.cost),
      desc: card.desc || card.desc_ja || '',
      display_type_ja: card.display_type_ja,
      enabled: card.enabled !== false
    };
  }

  function normalizeCards(cards) {
    return cards.map(normalizeCard);
  }

  function expectSameCardCore(actualCards, expectedCards) {
    expect(normalizeCards(actualCards)).toEqual(normalizeCards(expectedCards));
  }

  test('cards/catalog.js mirrors cards/catalog.json', () => {
    const jsonCatalog = require(path.resolve(__dirname, '..', 'cards', 'catalog.json'));
    // load catalog.js which assigns to window.CardCatalog in browser env
    // Jest uses jsdom by default so window should exist; ensure it.
    if (typeof window === 'undefined') global.window = {};
    // require the browser catalog file to populate window.CardCatalog
    require(path.resolve(__dirname, '..', 'cards', 'catalog.js'));

    const jsCatalog = window.CardCatalog;
    expect(jsCatalog).toBeDefined();
    expect(Array.isArray(jsCatalog.cards)).toBe(true);

    // Compare lengths
    expect(jsCatalog.cards.length).toBe(jsonCatalog.cards.length);

    // Compare by id -> object (shallow compare of key properties)
    const mapJson = new Map(jsonCatalog.cards.map(c => [c.id, c]));
    const mapJs = new Map(jsCatalog.cards.map(c => [c.id, c]));

    for (const [id, jsonCard] of mapJson.entries()) {
      expect(mapJs.has(id)).toBe(true);
      const jsCard = mapJs.get(id);
      // key fields should match (JSON uses localized keys like name_ja / desc_ja)
      expect(jsCard.id).toBe(jsonCard.id);
      expect(jsCard.name).toBe(jsonCard.name_ja || jsonCard.name);
      expect(jsCard.type).toBe(jsonCard.type);
      // description and cost
      expect(jsCard.desc).toBe(jsonCard.desc_ja || jsonCard.desc || '');
      expect(Number(jsCard.cost)).toBe(Number(jsonCard.cost));
    }
  });

  test('catalog json / catalog.js / catalog.ts / shared constants expose the same card definitions and types', () => {
    jest.resetModules();

    const jsonCatalog = require(path.resolve(__dirname, '..', 'cards', 'catalog.json'));
    const tsCatalog = require(path.resolve(__dirname, '..', 'cards', 'catalog.ts'));

    global.window = {};
    require(path.resolve(__dirname, '..', 'cards', 'catalog.js'));
    const jsCatalog = window.CardCatalog;

    jest.resetModules();
    delete global.window;
    const sharedConstants = require(path.resolve(__dirname, '..', 'shared-constants.ts'));

    expectSameCardCore(jsCatalog.cards, jsonCatalog.cards);
    expectSameCardCore(tsCatalog.cards, jsonCatalog.cards);
    expectSameCardCore(sharedConstants.CARD_DEFS, jsonCatalog.cards);

    const expectedTypeById = Object.fromEntries(jsonCatalog.cards.map((card) => [card.id, card.type]));
    expect(sharedConstants.CARD_TYPE_BY_ID).toEqual(expectedTypeById);

    const expectedTypes = Array.from(new Set(jsonCatalog.cards.map((card) => card.type)));
    expect(sharedConstants.CARD_TYPES).toEqual(expectedTypes);
  });

  test('shared constants fallback derives from generated catalog when catalog.json is not available from cwd', () => {
    jest.resetModules();

    const jsonCatalog = require(path.resolve(__dirname, '..', 'cards', 'catalog.json'));
    const originalCwd = process.cwd();
    const tempCwd = fs.mkdtempSync(path.join(os.tmpdir(), 'card-catalog-fallback-'));

    try {
      process.chdir(tempCwd);
      delete global.window;

      const sharedConstants = require(path.resolve(__dirname, '..', 'shared-constants.ts'));

      expectSameCardCore(sharedConstants.CARD_DEFS, jsonCatalog.cards);
      expect(sharedConstants.CARD_TYPE_BY_ID).toEqual(Object.fromEntries(jsonCatalog.cards.map((card) => [card.id, card.type])));
      expect(sharedConstants.CARD_TYPES).toEqual(Array.from(new Set(jsonCatalog.cards.map((card) => card.type))));
    } finally {
      process.chdir(originalCwd);
      fs.rmSync(tempCwd, { recursive: true, force: true });
    }
  });

  test('shared constants fails fast when no card catalog source can be loaded', () => {
    jest.resetModules();

    const originalCwd = process.cwd();
    const tempCwd = fs.mkdtempSync(path.join(os.tmpdir(), 'card-catalog-missing-'));
    const catalogModulePath = path.resolve(__dirname, '..', 'cards', 'catalog.ts');

    try {
      process.chdir(tempCwd);
      delete global.window;
      jest.doMock(catalogModulePath, () => {
        throw new Error('generated catalog unavailable');
      });

      expect(() => require(path.resolve(__dirname, '..', 'shared-constants.ts'))).toThrow(
        /Card catalog could not be loaded/
      );
    } finally {
      jest.dontMock(catalogModulePath);
      process.chdir(originalCwd);
      fs.rmSync(tempCwd, { recursive: true, force: true });
    }
  });

  test('swap/position-swap costs are configured as specified', () => {
    const jsonCatalog = require(path.resolve(__dirname, '..', 'cards', 'catalog.json'));
    const byId = new Map(jsonCatalog.cards.map(c => [c.id, c]));
    expect(Number(byId.get('swap_01').cost)).toBe(15);
    expect(Number(byId.get('position_swap_01').cost)).toBe(13);
  });

  test('x bomb card is present with expected cost/type', () => {
    const jsonCatalog = require(path.resolve(__dirname, '..', 'cards', 'catalog.json'));
    const byId = new Map(jsonCatalog.cards.map(c => [c.id, c]));
    expect(byId.has('x_bomb_01')).toBe(true);
    expect(byId.get('x_bomb_01').type).toBe('X_BOMB');
    expect(Number(byId.get('x_bomb_01').cost)).toBe(18);
  });

  test('reinforcement will card is present with expected cost/type/display', () => {
    const jsonCatalog = require(path.resolve(__dirname, '..', 'cards', 'catalog.json'));
    const byId = new Map(jsonCatalog.cards.map(c => [c.id, c]));
    expect(byId.has('reinforcement_01')).toBe(true);
    expect(byId.get('reinforcement_01').type).toBe('REINFORCEMENT_WILL');
    expect(Number(byId.get('reinforcement_01').cost)).toBe(4);
    expect(byId.get('reinforcement_01').display_type_ja).toBe('繁栄');
  });

  test('support troops will card is present with expected cost/type/display', () => {
    const jsonCatalog = require(path.resolve(__dirname, '..', 'cards', 'catalog.json'));
    const byId = new Map(jsonCatalog.cards.map(c => [c.id, c]));
    expect(byId.has('support_troops_01')).toBe(true);
    expect(byId.get('support_troops_01').type).toBe('SUPPORT_TROOPS_WILL');
    expect(Number(byId.get('support_troops_01').cost)).toBe(16);
    expect(byId.get('support_troops_01').display_type_ja).toBe('繁栄');
  });

  test('theory incarnation special card description omits its usage condition', () => {
    const jsonCatalog = require(path.resolve(__dirname, '..', 'cards', 'catalog.json'));
    const byId = new Map(jsonCatalog.cards.map(c => [c.id, c]));
    const card = byId.get('theory_incarnation_01');
    expect(card).toEqual(expect.objectContaining({
      id: 'theory_incarnation_01',
      name_ja: '理論の化身',
      type: 'THEORY_INCARNATION',
      cost: 0,
      display_type_ja: '特殊'
    }));
    expect(card.desc_ja).not.toContain('使用可能');
    expect(card.desc_ja).toBe('空きマスを理論数字マス化し、理論の化身を顕現。石を置いた後、理論ルーレットを発動し、ランダムな特殊石が1体現れる。');
  });

  test('observer will special card is present with expected cost and type', () => {
    const jsonCatalog = require(path.resolve(__dirname, '..', 'cards', 'catalog.json'));
    const byId = new Map(jsonCatalog.cards.map(c => [c.id, c]));
    const card = byId.get('observer_will_01');
    expect(card).toEqual(expect.objectContaining({
      id: 'observer_will_01',
      name_ja: '盤理の観測者',
      type: 'OBSERVER_WILL',
      cost: 0,
      display_type_ja: '観測'
    }));
    expect(card.desc_ja).not.toContain('18手以上');
    expect(card.desc_ja).toBe('相手手札を1つ奪って0コスト化し、観測者を顕現させる。ターン持続中は常時相手の手札を観測でき、観測した手札のコスト＋5。終了後観測の代償を支払う。');
  });

  test('board executor special card is present with expected cost and type', () => {
    const jsonCatalog = require(path.resolve(__dirname, '..', 'cards', 'catalog.json'));
    const byId = new Map(jsonCatalog.cards.map(c => [c.id, c]));
    const card = byId.get('board_executor_01');
    expect(card).toEqual(expect.objectContaining({
      id: 'board_executor_01',
      name_ja: '盤界の執行者',
      type: 'BOARD_EXECUTOR',
      cost: 0,
      display_type_ja: '特殊'
    }));
    expect(card.desc_ja).not.toContain('場合のみ使用可能');
    expect(card.desc_ja).toContain('カード使用を封じ');
    expect(card.desc_ja).not.toContain('反転で得る布石');
  });

  test('chaos summon card is present with expected cost and type', () => {
    const jsonCatalog = require(path.resolve(__dirname, '..', 'cards', 'catalog.json'));
    const byId = new Map(jsonCatalog.cards.map(c => [c.id, c]));
    const card = byId.get('chaos_summon_01');
    expect(card).toEqual(expect.objectContaining({
      id: 'chaos_summon_01',
      name_ja: '混沌召喚',
      type: 'CHAOS_SUMMON',
      cost: 15,
      display_type_ja: '特殊'
    }));
    expect(card.desc_ja).toContain('罠石と時限爆弾を除いたランダムな特殊石');
    expect(card.desc_ja).toContain('反転せず');
  });

  test('clone will card is present with expected cost, type, and no-flip spawn description', () => {
    const jsonCatalog = require(path.resolve(__dirname, '..', 'cards', 'catalog.json'));
    const byId = new Map(jsonCatalog.cards.map((c) => [c.id, c]));
    const card = byId.get('clone_01');
    expect(card).toEqual(expect.objectContaining({
      id: 'clone_01',
      name_ja: '複製の意志',
      type: 'CLONE_WILL',
      cost: 16,
      display_type_ja: '繁栄'
    }));
    expect(card.desc_ja).toContain('反転しない');
  });

  test('regen/perma costs reflect latest balance', () => {
    const jsonCatalog = require(path.resolve(__dirname, '..', 'cards', 'catalog.json'));
    const byId = new Map(jsonCatalog.cards.map(c => [c.id, c]));
    expect(Number(byId.get('regen_01').cost)).toBe(12);
    expect(Number(byId.get('perma_01').cost)).toBe(16);
  });

  test('free placement and buoyancy/gravity costs reflect latest balance', () => {
    const jsonCatalog = require(path.resolve(__dirname, '..', 'cards', 'catalog.json'));
    const byId = new Map(jsonCatalog.cards.map(c => [c.id, c]));
    expect(Number(byId.get('free_01').cost)).toBe(14);
    expect(Number(byId.get('buoyancy_01').cost)).toBe(9);
    expect(Number(byId.get('super_buoyancy_01').cost)).toBe(31);
    expect(Number(byId.get('gravity_01').cost)).toBe(9);
    expect(Number(byId.get('super_gravity_01').cost)).toBe(31);
  });

  test('ultimate destroy god cost reflects latest balance', () => {
    const jsonCatalog = require(path.resolve(__dirname, '..', 'cards', 'catalog.json'));
    const byId = new Map(jsonCatalog.cards.map(c => [c.id, c]));
    expect(byId.get('udg_01')).toEqual(expect.objectContaining({
      name_ja: '究極破壊神',
      type: 'ULTIMATE_DESTROY_GOD'
    }));
    expect(Number(byId.get('udg_01').cost)).toBe(30);
  });

  test('究極労働神はコスト25の採掘カードとして公開される', () => {
    const jsonCatalog = require(path.resolve(__dirname, '..', 'cards', 'catalog.json'));
    const byId = new Map(jsonCatalog.cards.map(c => [c.id, c]));
    expect(byId.get('ultimate_work_god_01')).toEqual(expect.objectContaining({
      name_ja: '究極労働神',
      type: 'ULTIMATE_WORK_GOD',
      cost: 25,
      display_type_ja: '採掘',
      desc_ja: '次に置く石を究極労働神化、自ターン開始時、布石を5獲得するか低確率で自壊する。'
    }));
  });

  test('perma_01 (強い意志) describes non-promoting strong stone behavior', () => {
    const jsonCatalog = require(path.resolve(__dirname, '..', 'cards', 'catalog.json'));
    const byId = new Map(jsonCatalog.cards.map(c => [c.id, c]));
    const card = byId.get('perma_01');
    expect(card).toBeTruthy();
    expect(card.type).toBe('PERMA_PROTECT_NEXT_STONE');
    expect(Number(card.cost)).toBe(16);
    expect(card.name_ja).toBe('強い意志');
    expect(card.desc_ja).toBe('次に置く石はずっと反転されない強い石になる。強い石は特殊石として扱い、進化しない。');
  });
});
