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
    diffRenderer = require('../ui/board-dom-compat/renderer.ts');
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
    const denseBoard = Array.from({ length: 4 }, () => Array(4).fill(0));
    denseBoard[0][0] = board[0][0];
    (global as any).gameState = {
      board: denseBoard,
      boardConfig: { rows: 4, cols: 4, shape: 'rectangle' },
      currentPlayer: 1
    };
    diffRenderer.renderBoardDiff(document.getElementById('board'));
    diffRenderer.presentCommittedWorldState((global as any).cardState);
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

  test('clears manifestation background without directly starting the ending overlay', () => {
    jest.useFakeTimers();
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

    expect(document.body.classList.contains('manifest-world-background-active')).toBe(false);
    expect(document.body.classList.contains('manifest-world-background-ending')).toBe(false);
    expect(document.body.getAttribute('data-manifest-world-background-key')).toBeNull();
    expect(document.body.getAttribute('data-manifest-world-background-source')).toBeNull();
    expect(document.body.style.getPropertyValue('--manifest-world-background')).toBe('');

    expect(document.querySelector('.manifest-ending-overlay')).toBeNull();
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

  test('clears resolved card-use manifestation background without directly starting the ending overlay', () => {
    jest.useFakeTimers();
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
    expect(document.body.classList.contains('manifest-world-background-active')).toBe(false);
    expect(document.body.classList.contains('manifest-world-background-ending')).toBe(false);
    expect(document.body.getAttribute('data-manifest-world-background-source')).toBeNull();
    expect(document.body.style.getPropertyValue('--manifest-world-background')).toBe('');

    expect(document.querySelector('.manifest-ending-overlay')).toBeNull();
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

  test('does not add a per-stone afterglow when a manifestation stone renders back as a normal stone', () => {
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
    expect(disc.classList.contains('manifest-stone-ending-afterglow')).toBe(false);
    expect(disc.classList.contains('manifest-stone-aura')).toBe(false);
  });

  test('does not start the manifestation BGM crossfade directly when the manifestation stone ends', () => {
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

    expect(syncManifestBgmOverride).not.toHaveBeenCalled();
  });
});
