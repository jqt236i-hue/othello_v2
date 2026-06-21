import { JSDOM } from 'jsdom';
import * as fs from 'fs';
import * as path from 'path';
import { PNG } from 'pngjs';

describe('board skin controller', () => {
  beforeEach(() => {
    jest.resetModules();
    const dom = new JSDOM(`<!doctype html><html><body>
      <div id="board-frame"></div>
      <div id="board"></div>
      <div id="boardSkinOptions"></div>
      <div id="boardFrameSkinOptions"></div>
    </body></html>`, { url: 'https://example.test/' });
    global.window = dom.window as any;
    global.document = dom.window.document as any;
  });

  afterEach(() => {
    try { delete (global as any).window; } catch (e) { /* Intentionally empty: test cleanup guard */ }
    try { delete (global as any).document; } catch (e) { /* Intentionally empty: test cleanup guard */ }
  });

  test('persists and applies the emerald board surface skin', () => {
    const controller = require('../ui/board-skin/controller.js');
    const api = controller.setupBoardSkinControls({ root: window });

    api.selectSkin('emerald-stone');

    expect(window.localStorage.getItem('othello.boardSkin')).toBe('emerald-stone');
    expect(window.localStorage.getItem('reversi.boardSkin')).toBe('emerald-stone');
    expect(document.documentElement.getAttribute('data-board-skin-id')).toBe('emerald-stone');
    expect(document.getElementById('board')!.style.getPropertyValue('--board-surface-texture-image')).toBe('url("assets/images/board/board-surface-emerald-v1.png")');
  });

  test('persists and applies the generated board surface skins', () => {
    const controller = require('../ui/board-skin/controller.js');
    const api = controller.setupBoardSkinControls({ root: window });
    const catalog = require('../ui/board-skin/catalog.js');

    expect(catalog.DEFAULT_BOARD_SKIN_ID).toBe('woven-felt');
    expect(catalog.getAllBoardSkins().map((skin: { id: string }) => skin.id)).toEqual([
      'emerald-stone',
      'moss-stone',
      'soft-felt',
      'woven-felt',
      'stone-inlay',
      'brushed-lacquer',
      'mica-washi',
      'aged-board',
      'teal-jade',
      'black-green-lacquer',
      'cyan-obsidian',
      'verdigris-jade',
      'celestial-green-stone'
    ]);

    api.selectSkin('celestial-green-stone');

    expect(window.localStorage.getItem('othello.boardSkin')).toBe('celestial-green-stone');
    expect(window.localStorage.getItem('reversi.boardSkin')).toBe('celestial-green-stone');
    expect(document.documentElement.getAttribute('data-board-skin-id')).toBe('celestial-green-stone');
    expect(document.getElementById('board')!.style.getPropertyValue('--board-surface-texture-image')).toBe('url("assets/images/board/board-surface-celestial-green-v1.png")');
  });

  test('persists and applies the soft felt board surface skin', () => {
    const controller = require('../ui/board-skin/controller.js');
    const api = controller.setupBoardSkinControls({ root: window });

    api.selectSkin('soft-felt');

    expect(window.localStorage.getItem('othello.boardSkin')).toBe('soft-felt');
    expect(window.localStorage.getItem('reversi.boardSkin')).toBe('soft-felt');
    expect(document.documentElement.getAttribute('data-board-skin-id')).toBe('soft-felt');
    expect(document.getElementById('board')!.style.getPropertyValue('--board-surface-texture-image')).toBe('url("assets/images/board/board-surface-soft-felt-v1.png")');
  });

  test('persists and applies the additional designed green board surface skins', () => {
    const controller = require('../ui/board-skin/controller.js');
    const api = controller.setupBoardSkinControls({ root: window });
    const expected: Array<[string, string]> = [
      ['woven-felt', 'assets/images/board/board-surface-woven-felt-v1.png'],
      ['stone-inlay', 'assets/images/board/board-surface-stone-inlay-v1.png'],
      ['brushed-lacquer', 'assets/images/board/board-surface-brushed-lacquer-v1.png'],
      ['mica-washi', 'assets/images/board/board-surface-mica-washi-v1.png'],
      ['aged-board', 'assets/images/board/board-surface-aged-board-v1.png']
    ];

    expected.forEach(([skinId, imagePath]) => {
      api.selectSkin(skinId);

      expect(window.localStorage.getItem('othello.boardSkin')).toBe(skinId);
      expect(window.localStorage.getItem('reversi.boardSkin')).toBe(skinId);
      expect(document.documentElement.getAttribute('data-board-skin-id')).toBe(skinId);
      expect(document.getElementById('board')!.style.getPropertyValue('--board-surface-texture-image')).toBe(`url("${imagePath}")`);
    });
  });

  test('uses woven felt as the startup default when no board skin is stored', () => {
    const controller = require('../ui/board-skin/controller.js');
    const api = controller.setupBoardSkinControls({ root: window });

    expect(api.getSelectedSkinId()).toBe('woven-felt');
    expect(window.localStorage.getItem('othello.boardSkin')).toBeNull();
    expect(window.localStorage.getItem('reversi.boardSkin')).toBeNull();
    expect(document.documentElement.getAttribute('data-board-skin-id')).toBe('woven-felt');
    expect(document.getElementById('board')!.style.getPropertyValue('--board-surface-texture-image')).toBe('url("assets/images/board/board-surface-woven-felt-v1.png")');
  });

  test('persists and applies the generated board frame skin', () => {
    const controller = require('../ui/board-skin/controller.js');
    const api = controller.setupBoardSkinControls({ root: window });
    const catalog = require('../ui/board-skin/catalog.js');

    expect(catalog.DEFAULT_BOARD_FRAME_SKIN_ID).toBe('black-gold-lacquer');
    expect(catalog.getAllBoardFrameSkins().map((skin: { id: string }) => skin.id)).toEqual([
      'black-gold-lacquer',
      'compact-brass-clean-corners',
      'compact-iron-clean-corners',
      'compact-gold-clean-corners'
    ]);

    api.selectFrameSkin('compact-brass-clean-corners');

    expect(window.localStorage.getItem('othello.boardFrameSkin')).toBe('compact-brass-clean-corners');
    expect(window.localStorage.getItem('reversi.boardFrameSkin')).toBe('compact-brass-clean-corners');
    expect(document.documentElement.getAttribute('data-board-frame-skin-id')).toBe('compact-brass-clean-corners');
    expect(document.getElementById('board-frame')!.style.getPropertyValue('--board-frame-image')).toBe('url("assets/images/board/board-frame-compact-brass-clean-corners-v3.png")');
  });

  test('persists and applies the selected compact board frame skins', () => {
    const controller = require('../ui/board-skin/controller.js');
    const api = controller.setupBoardSkinControls({ root: window });
    const expected: Array<[string, string]> = [
      ['compact-iron-clean-corners', 'assets/images/board/board-frame-compact-iron-clean-corners-v3.png'],
      ['compact-gold-clean-corners', 'assets/images/board/board-frame-compact-gold-clean-corners-v3.png']
    ];

    expected.forEach(([skinId, imagePath]) => {
      api.selectFrameSkin(skinId);

      expect(window.localStorage.getItem('othello.boardFrameSkin')).toBe(skinId);
      expect(window.localStorage.getItem('reversi.boardFrameSkin')).toBe(skinId);
      expect(document.documentElement.getAttribute('data-board-frame-skin-id')).toBe(skinId);
      expect(document.getElementById('board-frame')!.style.getPropertyValue('--board-frame-image')).toBe(`url("${imagePath}")`);
    });
  });

  test('compact board frame image outer background is transparent', () => {
    const imagePaths = [
      'assets/images/board/board-frame-compact-brass-clean-corners-v3.png',
      'assets/images/board/board-frame-compact-iron-clean-corners-v3.png',
      'assets/images/board/board-frame-compact-gold-clean-corners-v3.png'
    ];

    imagePaths.forEach((imagePath) => {
      const png = PNG.sync.read(fs.readFileSync(path.join(__dirname, '..', imagePath)));
      const samplePoints = [
        [0, 0],
        [Math.floor(png.width / 2), 0],
        [0, Math.floor(png.height / 2)],
        [png.width - 1, png.height - 1]
      ];

      samplePoints.forEach(([x, y]) => {
        const alpha = png.data[((y * png.width + x) * 4) + 3];
        expect(alpha).toBe(0);
      });
    });
  });
});
