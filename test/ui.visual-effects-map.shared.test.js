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
    delete global.window;
    delete global.document;
    delete global.requestAnimationFrame;
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
    const imageVar = disc.style.getPropertyValue('--special-stone-image');
    expect(imageVar).toContain('perma_protect_next_stone-black.png');
  });
});
