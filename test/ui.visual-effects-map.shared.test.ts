describe('visual-effects map shared between game/ui', () => {
  beforeEach(() => {
    jest.resetModules();
    const { JSDOM } = require('jsdom');
    const dom = new JSDOM('<!doctype html><html><body></body></html>');
    global.window = dom.window;
    global.document = dom.window.document;
    // Minimal requestAnimationFrame for ui/visual-effects-map.js helpers
    global.requestAnimationFrame = (cb) => setTimeout(cb, 0);
  });

  afterEach(() => {
    delete global.Image;
    delete global.window;
    delete global.document;
    delete global.requestAnimationFrame;
  });

  test('ui visual-effects-map bootstrap stays quiet without debug flags', () => {
    const consoleLog = jest.spyOn(console, 'log').mockImplementation(() => {});
    try {
      require('../ui/visual-effects-map');
      expect(consoleLog).not.toHaveBeenCalled();
    } finally {
      consoleLog.mockRestore();
    }
  });

  test('ui.applyStoneVisualEffect can resolve keys from game/visual-effects-map via window.GameVisualEffectsMap', async () => {
    // Match browser load order: UI loads first, then game publishes the map and calls __visualEffectsMapReady.
    require('../ui/visual-effects-map');
    require('../game/visual-effects-map');

    const disc = document.createElement('div');
    disc.className = 'disc black';
    document.body.appendChild(disc);

    expect(typeof window.applyStoneVisualEffect).toBe('function');
    const ok = await window.applyStoneVisualEffect(disc, 'protectedStoneTemporary', { owner: 1 });
    expect(ok).toBe(true);
    expect(disc.classList.contains('protected-gray')).toBe(true);
    expect(disc.dataset.renderMode).toBe('replace');
    expect(disc.dataset.imageState).toBe('loaded');
    expect(disc.style.getPropertyValue('--disc-base-fallback-color')).toBe('transparent');
    expect(disc.querySelector('.disc__overlay-image')).toBeTruthy();
  });

  test('protectedStone accepts owner as black/white string', async () => {
    require('../ui/visual-effects-map');
    require('../game/visual-effects-map');

    const disc = document.createElement('div');
    disc.className = 'disc black';
    document.body.appendChild(disc);

    const ok = await window.applyStoneVisualEffect(disc, 'protectedStone', { owner: 'black' });
    expect(ok).toBe(true);
    expect(disc.classList.contains('protected-stone')).toBe(true);
    expect(disc.dataset.imageState).toBe('loaded');
    const imageVar = disc.style.getPropertyValue('--disc-overlay-image') || disc.style.getPropertyValue('--special-stone-image');
    expect(imageVar).toContain('perma_protect_next_stone-black.png');
    expect(disc.querySelector('.special-stone-img')).toBeNull();
  });

  test('preloadStoneVisualEffectKeys preloads gold/silver/rainbow images once', () => {
    const created = [];
    const FakeImage = function () {
      this.onload = null;
      this.onerror = null;
      Object.defineProperty(this, 'src', {
        set(value) {
          created.push(value);
          if (typeof this.onload === 'function') this.onload();
        }
      });
    };
    global.Image = FakeImage;

    require('../ui/visual-effects-map');
    require('../game/visual-effects-map');
    window.Image = FakeImage;

    const first = window.preloadStoneVisualEffectKeys([
      'goldStone',
      'silverStone',
      'rainbowStone',
      'rainbowStone'
    ]);
    expect(first.started).toEqual(expect.arrayContaining([
      'assets/images/special-stones/gold_stone.png',
      'assets/images/special-stones/silver.stone.png',
      'assets/images/special-stones/rainbow_stone.png'
    ]));
    expect(created.filter((src) => src === 'assets/images/special-stones/rainbow_stone.png')).toHaveLength(1);

    const second = window.preloadStoneVisualEffectKeys(['rainbowStone']);
    expect(second.started).toHaveLength(0);
    expect(second.skipped).toContain('assets/images/special-stones/rainbow_stone.png');
  });

  test('CRYSTAL_STONE no longer resolves to a special stone visual', async () => {
    require('../ui/visual-effects-map');
    require('../game/visual-effects-map');

    const shared = window.GameVisualEffectsMap;
    expect(shared.PENDING_TYPE_TO_EFFECT_KEY.CRYSTAL_STONE).toBeUndefined();
    expect(shared.SPECIAL_TYPE_TO_EFFECT_KEY.CRYSTAL).toBeUndefined();
  });

  test('X_BOMB と CROSS_BOMB が別の石画像へ解決される', async () => {
    require('../ui/visual-effects-map');
    require('../game/visual-effects-map');

    const shared = window.GameVisualEffectsMap;
    expect(shared).toBeTruthy();
    expect(shared.PENDING_TYPE_TO_EFFECT_KEY.CROSS_BOMB).toBe('crossBombStone');
    expect(shared.PENDING_TYPE_TO_EFFECT_KEY.X_BOMB).toBe('xBombStone');

    const crossMap = shared.STONE_VISUAL_EFFECTS.crossBombStone;
    const xMap = shared.STONE_VISUAL_EFFECTS.xBombStone;
    expect(crossMap).toBeTruthy();
    expect(xMap).toBeTruthy();
    expect(crossMap.imagePathByOwner['1']).toContain('X_BOMB-black.png');
    expect(crossMap.imagePathByOwner['-1']).toContain('X_BOMB-white.png');
    expect(xMap.imagePathByOwner['1']).toContain('CROSS_BOMB-black.png');
    expect(xMap.imagePathByOwner['-1']).toContain('CROSS_BOMB-white.png');
  });

  test('DESTROY_DRAGON_WILL と DESTROY_DRAGON が正式画像へ解決される', async () => {
    require('../ui/visual-effects-map');
    require('../game/visual-effects-map');

    const shared = window.GameVisualEffectsMap;
    expect(shared).toBeTruthy();
    expect(shared.PENDING_TYPE_TO_EFFECT_KEY.DESTROY_DRAGON_WILL).toBe('destroyDragonStone');
    expect(shared.SPECIAL_TYPE_TO_EFFECT_KEY.DESTROY_DRAGON).toBe('destroyDragonStone');

    const destroyDragonMap = shared.STONE_VISUAL_EFFECTS.destroyDragonStone;
    expect(destroyDragonMap).toBeTruthy();
    expect(destroyDragonMap.renderMode).toBe('replace');
    expect(destroyDragonMap.imagePathByOwner['1']).toContain('DESTROY_DRAGON-black.png');
    expect(destroyDragonMap.imagePathByOwner['-1']).toContain('DESTROY_DRAGON-white.png');
  });

  test('LIGHTNING_WILL と LIGHTNING が正式画像へ解決される', async () => {
    require('../ui/visual-effects-map');
    require('../game/visual-effects-map');

    const shared = window.GameVisualEffectsMap;
    expect(shared).toBeTruthy();
    expect(shared.PENDING_TYPE_TO_EFFECT_KEY.LIGHTNING_WILL).toBe('lightningStone');
    expect(shared.SPECIAL_TYPE_TO_EFFECT_KEY.LIGHTNING).toBe('lightningStone');

    const lightningMap = shared.STONE_VISUAL_EFFECTS.lightningStone;
    expect(lightningMap).toBeTruthy();
    expect(lightningMap.imagePathByOwner['1']).toContain('rakurai-black.png');
    expect(lightningMap.imagePathByOwner['-1']).toContain('rakurai-white.png');
  });

  test('METEOR_GOD が因果抹消神石画像へ解決される', async () => {
    require('../ui/visual-effects-map');
    require('../game/visual-effects-map');

    const shared = window.GameVisualEffectsMap;
    expect(shared).toBeTruthy();
    expect(shared.PENDING_TYPE_TO_EFFECT_KEY.METEOR_GOD).toBe('meteorGodStone');
    expect(shared.SPECIAL_TYPE_TO_EFFECT_KEY.METEOR_GOD).toBe('meteorGodStone');

    const meteorGodMap = shared.STONE_VISUAL_EFFECTS.meteorGodStone;
    expect(meteorGodMap).toBeTruthy();
    expect(meteorGodMap.imagePathByOwner['1']).toContain('METEOR_GOD-black.png');
    expect(meteorGodMap.imagePathByOwner['-1']).toContain('METEOR_GOD-white.png');
  });

  test('special foundation marker visuals are exposed', async () => {
    require('../ui/visual-effects-map');
    require('../game/visual-effects-map');

    const shared = window.GameVisualEffectsMap;
    const theoryType = ['THEORY', 'INCARNATION'].join('_');
    const executorType = ['BOARD', 'EXECUTOR'].join('_');
    const observerWillType = ['OBS' + 'ERVER', 'WILL'].join('_');
    expect(shared).toBeTruthy();
    expect(shared.PENDING_TYPE_TO_EFFECT_KEY[theoryType]).toBeUndefined();
    expect(shared.PENDING_TYPE_TO_EFFECT_KEY[observerWillType]).toBeUndefined();
    expect(shared.SPECIAL_TYPE_TO_EFFECT_KEY[theoryType]).toBe('theoryIncarnationStone');
    expect(shared.SPECIAL_TYPE_TO_EFFECT_KEY[executorType]).toBe('boardExecutorStone');
    expect(shared.SPECIAL_TYPE_TO_EFFECT_KEY[observerWillType]).toBe('observerWillStone');
    expect(shared.STONE_VISUAL_EFFECTS[['theory', 'IncarnationStone'].join('')]).toBeTruthy();
    expect(shared.STONE_VISUAL_EFFECTS.boardExecutorStone.imagePathByOwner['1']).toContain('board_executor-black.png');
    expect(shared.STONE_VISUAL_EFFECTS.observerWillStone).toBeTruthy();
  });

  test('CommonJS wrapper resolves special foundation marker visuals', () => {
    jest.resetModules();
    const shared = require('../game/visual-effects-map.js');
    const theoryType = ['THEORY', 'INCARNATION'].join('_');
    const executorType = ['BOARD', 'EXECUTOR'].join('_');
    const observerWillType = ['OBS' + 'ERVER', 'WILL'].join('_');

    expect(shared.PENDING_TYPE_TO_EFFECT_KEY[theoryType]).toBeUndefined();
    expect(shared.SPECIAL_TYPE_TO_EFFECT_KEY[theoryType]).toBe('theoryIncarnationStone');
    expect(shared.SPECIAL_TYPE_TO_EFFECT_KEY[executorType]).toBe('boardExecutorStone');
    expect(shared.SPECIAL_TYPE_TO_EFFECT_KEY[observerWillType]).toBe('observerWillStone');
    expect(shared.resolveEffectImagePath(shared.STONE_VISUAL_EFFECTS.theoryIncarnationStone, { owner: '1' })).toContain('theory_incarnation-black.png');
    expect(shared.resolveEffectImagePath(shared.STONE_VISUAL_EFFECTS.boardExecutorStone, { owner: '1' })).toContain('board_executor-black.png');
    expect(shared.resolveEffectImagePath(shared.STONE_VISUAL_EFFECTS.observerWillStone, { owner: '1' })).toContain('OBSERVER_WILL-black.png');
  });

  test('GLUTTONOUS_WILL と GLUTTONOUS が悪食石画像へ解決される', async () => {
    require('../ui/visual-effects-map');
    require('../game/visual-effects-map');

    const shared = window.GameVisualEffectsMap;
    expect(shared).toBeTruthy();
    expect(shared.PENDING_TYPE_TO_EFFECT_KEY.GLUTTONOUS_WILL).toBe('gluttonousStone');
    expect(shared.SPECIAL_TYPE_TO_EFFECT_KEY.GLUTTONOUS).toBe('gluttonousStone');

    const gluttonousMap = shared.STONE_VISUAL_EFFECTS.gluttonousStone;
    expect(gluttonousMap).toBeTruthy();
    expect(gluttonousMap.imagePathByOwner['1']).toContain('GLUTTONOUS_WILL-black.png');
    expect(gluttonousMap.imagePathByOwner['-1']).toContain('GLUTTONOUS_WILL-white.png');
  });

  test('TIME_STOP_GOD と TIME_STOP が専用 PNG 画像へ解決される', async () => {
    require('../ui/visual-effects-map');
    require('../game/visual-effects-map');

    const shared = window.GameVisualEffectsMap;
    expect(shared).toBeTruthy();
    expect(shared.PENDING_TYPE_TO_EFFECT_KEY.TIME_STOP_GOD).toBe('timeStopStone');
    expect(shared.SPECIAL_TYPE_TO_EFFECT_KEY.TIME_STOP).toBe('timeStopStone');

    const timeStopMap = shared.STONE_VISUAL_EFFECTS.timeStopStone;
    expect(timeStopMap).toBeTruthy();
    expect(timeStopMap.imagePathByOwner['1']).toContain('TIME_STOP-black.png');
    expect(timeStopMap.imagePathByOwner['-1']).toContain('TIME_STOP-white.png');
    expect(timeStopMap.imagePathByOwner['1']).not.toContain('data:image/svg+xml');
    expect(timeStopMap.imagePathByOwner['-1']).not.toContain('data:image/svg+xml');
  });

  test('WILL_HUNTER_KING が正式画像へ解決される', async () => {
    require('../ui/visual-effects-map');
    require('../game/visual-effects-map');

    const shared = window.GameVisualEffectsMap;
    expect(shared).toBeTruthy();
    expect(shared.PENDING_TYPE_TO_EFFECT_KEY.WILL_HUNTER_KING).toBe('willHunterKingStone');
    expect(shared.SPECIAL_TYPE_TO_EFFECT_KEY.WILL_HUNTER_KING).toBe('willHunterKingStone');

    const willHunterKingMap = shared.STONE_VISUAL_EFFECTS.willHunterKingStone;
    expect(willHunterKingMap).toBeTruthy();
    expect(willHunterKingMap.imagePathByOwner['1']).toContain('WILL_HUNTER_KING-black.png');
    expect(willHunterKingMap.imagePathByOwner['-1']).toContain('WILL_HUNTER_KING-white.png');
  });

  test('GHOST_WILL と GHOST が正式画像へ解決される', async () => {
    require('../ui/visual-effects-map');
    require('../game/visual-effects-map');

    const shared = window.GameVisualEffectsMap;
    expect(shared).toBeTruthy();
    expect(shared.PENDING_TYPE_TO_EFFECT_KEY.GHOST_WILL).toBe('ghostStone');
    expect(shared.SPECIAL_TYPE_TO_EFFECT_KEY.GHOST).toBe('ghostStone');

    const ghostMap = shared.STONE_VISUAL_EFFECTS.ghostStone;
    expect(ghostMap).toBeTruthy();
    expect(ghostMap.imagePathByOwner['1']).toContain('GHOST_WILL-black.png');
    expect(ghostMap.imagePathByOwner['-1']).toContain('GHOST_WILL-white.png');
  });

  test('AFTERIMAGE_WILL が残像石画像へ解決される', async () => {
    require('../ui/visual-effects-map');
    require('../game/visual-effects-map');

    const shared = window.GameVisualEffectsMap;
    expect(shared).toBeTruthy();
    expect(shared.PENDING_TYPE_TO_EFFECT_KEY.AFTERIMAGE_WILL).toBe('afterimageStone');
    expect(shared.SPECIAL_TYPE_TO_EFFECT_KEY.AFTERIMAGE_WILL).toBe('afterimageStone');

    const afterimageMap = shared.STONE_VISUAL_EFFECTS.afterimageStone;
    expect(afterimageMap).toBeTruthy();
    expect(afterimageMap.imagePathByOwner['1']).toContain('ZAN-BLACK.png');
    expect(afterimageMap.imagePathByOwner['-1']).toContain('ZAN-WHITE.png');
  });

  test('SACRIFICE_WILL と SACRIFICE が犠牲石画像へ解決される', async () => {
    require('../ui/visual-effects-map');
    require('../game/visual-effects-map');

    const shared = window.GameVisualEffectsMap;
    expect(shared).toBeTruthy();
    expect(shared.PENDING_TYPE_TO_EFFECT_KEY.SACRIFICE_WILL).toBe('sacrificeStone');
    expect(shared.SPECIAL_TYPE_TO_EFFECT_KEY.SACRIFICE).toBe('sacrificeStone');

    const sacrificeMap = shared.STONE_VISUAL_EFFECTS.sacrificeStone;
    expect(sacrificeMap).toBeTruthy();
    expect(sacrificeMap.imagePathByOwner['1']).toContain('SACRIFICE_WILL-black.png');
    expect(sacrificeMap.imagePathByOwner['-1']).toContain('SACRIFICE_WILL-white.png');
  });

  test('ABSOLUTE_PROTECTED が昇格後の絶対保護石画像へ解決される', () => {
    require('../ui/visual-effects-map');
    require('../game/visual-effects-map');

    const shared = window.GameVisualEffectsMap;
    expect(shared).toBeTruthy();

    expect(shared.PENDING_TYPE_TO_EFFECT_KEY.ABSOLUTE_PROTECT_NEXT_STONE).toBeUndefined();
    expect(shared.SPECIAL_TYPE_TO_EFFECT_KEY.ABSOLUTE_PROTECTED).toBe('absoluteProtectedStone');

    const map = shared.STONE_VISUAL_EFFECTS.absoluteProtectedStone;
    expect(map).toBeTruthy();
    expect(map.imagePathByOwner['1']).toContain('absolute_protect_next_stone-black.png');
    expect(map.imagePathByOwner['-1']).toContain('absolute_protect_next_stone-white.png');
  });

  test('shared card art helpers resolve owner-specific and fallback card images', () => {
    require('../game/visual-effects-map');

    const shared = window.GameVisualEffectsMap;
    expect(shared).toBeTruthy();
    expect(shared.resolveCardVisualImagePath('ULTIMATE_REVERSE_DRAGON', { owner: 'white' })).toContain('ultimate_reverse_dragon-white.png');
    expect(shared.resolveCardVisualImagePath('ULTIMATE_REVERSE_DRAGON')).toContain('ultimate_reverse_dragon-black.png');
    expect(shared.getCardVisualImagePaths('ULTIMATE_REVERSE_DRAGON')).toEqual(
      expect.arrayContaining([
        'assets/images/special-stones/ultimate_reverse_dragon-black.png',
        'assets/images/special-stones/ultimate_reverse_dragon-white.png'
      ])
    );
    expect(shared.cardTypeUsesNonNormalStoneImage('ULTIMATE_REVERSE_DRAGON')).toBe(true);
    expect(shared.cardTypeUsesNonNormalStoneImage('FREE_PLACEMENT')).toBe(false);
  });
});
