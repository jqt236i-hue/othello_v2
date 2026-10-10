import { JSDOM } from 'jsdom';

const DEFAULT_BACKGROUND_SKIN_IDS = ['default-25'];

describe('gacha progress storage', () => {
  let dom;

  beforeEach(() => {
    jest.resetModules();
    dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'https://example.test/' });
    global.window = dom.window;
    global.localStorage = dom.window.localStorage;
  });

  afterEach(() => {
    try {
      if (dom && dom.window && typeof dom.window.close === 'function') {
        dom.window.close();
      }
    } catch (e) { /* Intentionally empty: test cleanup guard */ }
    delete global.window;
    delete global.localStorage;
  });

  test('defaults to base owned skins only', () => {
    const mod = require('../ui/storage/gacha-progress.js');
    const state = mod.readState(window);

    expect(state.observationStones).toBe(0);
    expect(state.version).toBe(3);
    expect(mod.listOwnedHandSkinIds(window).sort()).toEqual(['default']);
    expect(mod.listOwnedBackgroundSkinIds(window).sort()).toEqual(DEFAULT_BACKGROUND_SKIN_IDS);
    expect(mod.listOwnedPlacementSoundIds(window).sort()).toEqual(['default']);
  });

  test('awards, spends, and applies mixed pull results with duplicate tracking', () => {
    const mod = require('../ui/storage/gacha-progress.js');
    mod.awardObservationStones(window, 250);
    const spend = mod.spendObservationStones(window, 100);
    const apply = mod.applyPullResults(window, [
      { item: { id: 'gacha__n__小鬼の手', kind: 'hand_skin' } },
      { item: { id: 'gacha__n__background_skin__観測できなかった夜', kind: 'background_skin' } },
      { item: { id: 'default', kind: 'placement_sound' } },
      { item: { id: 'gacha__n__placement_sound__type-1-standard', kind: 'placement_sound' } }
    ]);

    expect(spend.ok).toBe(true);
    expect(apply.newlyUnlockedIds.sort()).toEqual([
      'gacha__n__background_skin__観測できなかった夜',
      'gacha__n__placement_sound__type-1-standard',
      'gacha__n__小鬼の手'
    ]);
    expect(apply.alreadyOwnedIds).toEqual(['default']);
    expect(mod.getObservationStones(window)).toBe(150);
    expect(mod.listOwnedHandSkinIds(window)).toEqual([
      'default',
      'gacha__n__小鬼の手'
    ]);
    expect(mod.listOwnedBackgroundSkinIds(window).sort()).toEqual([
      ...DEFAULT_BACKGROUND_SKIN_IDS,
      'gacha__n__background_skin__観測できなかった夜'
    ]);
    expect(mod.listOwnedPlacementSoundIds(window).sort()).toEqual([
      'default',
      'gacha__n__placement_sound__type-1-standard'
    ]);
    expect(mod.readState(window).totalPullCount).toBe(4);
  });

  test('migrates renamed hand skin ids to canonical owned ids', () => {
    const mod = require('../ui/storage/gacha-progress.js');
    const state = mod.writeState(window, {
      ownedHandSkinIds: {
        default: true,
        'gacha__n__hand': true,
        'gacha__n__hand-swap': true
      }
    });

    expect(Object.keys(state.ownedHandSkinIds).filter((skinId) => state.ownedHandSkinIds[skinId] === true).sort()).toEqual([
      'default',
      'gacha__n__人の手',
      'gacha__n__陽気な手'
    ]);
    expect(mod.isHandSkinOwned(window, 'gacha__n__hand')).toBe(true);
    expect(mod.isHandSkinOwned(window, 'gacha__n__hand-swap')).toBe(true);
    expect(mod.listOwnedHandSkinIds(window).sort()).toEqual([
      'default',
      'gacha__n__人の手',
      'gacha__n__陽気な手'
    ]);
  });
});
