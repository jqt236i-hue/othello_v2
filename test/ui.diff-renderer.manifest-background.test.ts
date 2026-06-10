import { JSDOM } from 'jsdom';

describe('diff renderer manifestation world background sync', () => {
  let dom: JSDOM | null = null;
  let diffRenderer: any;

  beforeEach(() => {
    jest.resetModules();
    dom = new JSDOM('<!doctype html><html><body><div id="board"></div></body></html>');
    (global as any).window = dom.window;
    (global as any).document = dom.window.document;
    (global as any).cardState = null;
    (global as any).gameState = null;
    (global as any).BLACK = 1;
    (global as any).WHITE = -1;
    (global as any).EMPTY = 0;
    (global as any).getLegalMoves = () => [];
    (global as any).getPlayerKey = () => 'black';
    (global as any).getEffectKeyForSpecialType = (type: any) => String(type || '').toUpperCase() === 'OBSERVER_WILL' ? 'observerWillStone' : null;
    (global as any).applyStoneVisualEffect = jest.fn((disc: HTMLElement, effectKey: string) => {
      disc.dataset.effect = effectKey;
    });
    (global as any).CardLogic = {
      getCardContext: () => ({ protectedStones: [], permaProtectedStones: [], bombs: [] })
    };
    diffRenderer = require('../ui/diff-renderer.ts');
  });

  afterEach(() => {
    if (dom) {
      dom.window.close();
      dom = null;
    }
    delete (global as any).window;
    delete (global as any).document;
    delete (global as any).cardState;
    delete (global as any).gameState;
    delete (global as any).BLACK;
    delete (global as any).WHITE;
    delete (global as any).EMPTY;
    delete (global as any).getLegalMoves;
    delete (global as any).getPlayerKey;
    delete (global as any).getEffectKeyForSpecialType;
    delete (global as any).applyStoneVisualEffect;
    delete (global as any).CardLogic;
    delete (global as any).SoundEngine;
    jest.useRealTimers();
  });

  function renderOnce(board = [[0]]) {
    (global as any).gameState = { board, currentPlayer: 1 };
    diffRenderer.renderBoardDiff(document.getElementById('board'));
  }

  test('applies observer world background while observer manifestation stone is active', () => {
    (global as any).cardState = {
      markers: [{
        kind: 'manifestStone',
        owner: 'black',
        data: { type: 'OBSERVER_WILL', remainingOwnerTurns: 4 }
      }]
    };

    renderOnce();

    expect(document.body.classList.contains('manifest-world-background-active')).toBe(true);
    expect(document.body.getAttribute('data-manifest-world-background-key')).toBe('observer_will_world');
    expect(document.body.style.getPropertyValue('--manifest-world-background')).toContain('assets/images/background/manifest-worlds/観測の世界.png');
  });

  test('keeps manifestation world background briefly when an active manifestation stone ends', () => {
    (global as any).cardState = {
      markers: [{
        kind: 'manifestStone',
        owner: 'black',
        data: { type: 'OBSERVER_WILL', remainingOwnerTurns: 4 }
      }]
    };

    renderOnce();

    (global as any).cardState = { markers: [] };
    renderOnce();

    expect(document.body.classList.contains('manifest-world-background-active')).toBe(true);
    expect(document.body.classList.contains('manifest-world-background-ending')).toBe(true);
    expect(document.body.getAttribute('data-manifest-world-background-key')).toBe('observer_will_world');
    expect(document.body.getAttribute('data-manifest-world-background-source')).toBe('manifest_end');
    expect(document.body.style.getPropertyValue('--manifest-world-background')).toContain('assets/images/background/manifest-worlds/観測の世界.png');
  });

  test('keeps card-use manifestation background before the manifestation stone is placed', () => {
    (global as any).window.__manifestPresentationOverride = {
      source: 'special_card_use',
      manifestBackgroundKey: 'observer_will_world',
      manifestBackgroundImage: 'assets/images/background/manifest-worlds/観測の世界.png',
      resolvedByMarker: false
    };
    (global as any).cardState = { markers: [] };

    renderOnce();

    expect(document.body.classList.contains('manifest-world-background-active')).toBe(true);
    expect(document.body.getAttribute('data-manifest-world-background-key')).toBe('observer_will_world');
    expect(document.body.getAttribute('data-manifest-world-background-source')).toBe('special_card_use');
    expect(document.body.style.getPropertyValue('--manifest-world-background')).toContain('assets/images/background/manifest-worlds/観測の世界.png');
  });

  test('keeps resolved card-use manifestation background briefly after the stone disappears', () => {
    (global as any).window.__manifestPresentationOverride = {
      source: 'special_card_use',
      manifestBackgroundKey: 'observer_will_world',
      manifestBackgroundImage: 'assets/images/background/manifest-worlds/観測の世界.png',
      resolvedByMarker: false
    };
    (global as any).cardState = {
      markers: [{
        kind: 'manifestStone',
        owner: 'black',
        data: { type: 'OBSERVER_WILL', remainingOwnerTurns: 4 }
      }]
    };

    renderOnce();
    expect((global as any).window.__manifestPresentationOverride.resolvedByMarker).toBe(true);
    expect(document.body.getAttribute('data-manifest-world-background-source')).toBe('marker');

    (global as any).cardState = { markers: [] };
    renderOnce();

    expect((global as any).window.__manifestPresentationOverride).toBeNull();
    expect(document.body.classList.contains('manifest-world-background-active')).toBe(true);
    expect(document.body.classList.contains('manifest-world-background-ending')).toBe(true);
    expect(document.body.getAttribute('data-manifest-world-background-source')).toBe('manifest_end');
    expect(document.body.style.getPropertyValue('--manifest-world-background')).toContain('assets/images/background/manifest-worlds/観測の世界.png');
  });

  test('applies observer manifestation stone visual to a manifestStone marker on the board', () => {
    (global as any).cardState = {
      markers: [{
        kind: 'manifestStone',
        row: 0,
        col: 0,
        owner: 'black',
        data: { type: 'OBSERVER_WILL', remainingOwnerTurns: 4 }
      }]
    };

    renderOnce([[1]]);

    const disc = document.querySelector('.disc') as HTMLElement;
    expect(disc).toBeTruthy();
    expect((global as any).applyStoneVisualEffect).toHaveBeenCalledWith(
      disc,
      'observerWillStone',
      expect.objectContaining({ owner: 1 })
    );
    expect(disc.dataset.effect).toBe('observerWillStone');
  });

  test('adds an afterglow class when a manifestation stone renders back as a normal stone', () => {
    (global as any).cardState = {
      markers: [{
        kind: 'manifestStone',
        row: 0,
        col: 0,
        owner: 'black',
        data: { type: 'OBSERVER_WILL', remainingOwnerTurns: 4 }
      }]
    };

    renderOnce([[1]]);

    (global as any).cardState = { markers: [] };
    renderOnce([[1]]);

    const disc = document.querySelector('.disc') as HTMLElement;
    expect(disc).toBeTruthy();
    expect(disc.classList.contains('manifest-stone-ending-afterglow')).toBe(true);
    expect(disc.classList.contains('manifest-stone-aura')).toBe(false);
  });

  test('keeps manifestation BGM briefly before returning to normal BGM', () => {
    jest.useFakeTimers();
    const syncManifestBgmOverride = jest.fn();
    (global as any).SoundEngine = { syncManifestBgmOverride };
    (global as any).cardState = {
      markers: [{
        kind: 'manifestStone',
        row: 0,
        col: 0,
        owner: 'black',
        data: { type: 'OBSERVER_WILL', remainingOwnerTurns: 4 }
      }]
    };

    renderOnce([[1]]);
    expect(syncManifestBgmOverride).toHaveBeenLastCalledWith(
      'observer_will_path',
      expect.objectContaining({ file: 'assets/audio/bgm/manifest-stones/観測の道-bpm150.mp3' })
    );
    syncManifestBgmOverride.mockClear();

    (global as any).cardState = { markers: [] };
    renderOnce([[1]]);

    expect(syncManifestBgmOverride).not.toHaveBeenCalledWith(null, null);

    jest.advanceTimersByTime(850);

    expect(syncManifestBgmOverride).toHaveBeenCalledWith(null, null);
  });
});
