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

    expect(catalog.DEFAULT_BOARD_SKIN_ID).toBe('bluegreen-felt');
    expect(catalog.getAllBoardSkins().find((skin: { id: string }) => skin.id === 'bluegreen-felt')?.label).toBe('既定');
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
      'celestial-green-stone',
      'bluegreen-felt',
      'celadon-stone',
      'teal-lacquer',
      'quiet-cosmos'
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
      ['aged-board', 'assets/images/board/board-surface-aged-board-v1.png'],
      ['bluegreen-felt', 'assets/images/board/board-surface-bluegreen-felt-v1.png'],
      ['celadon-stone', 'assets/images/board/board-surface-celadon-stone-v1.png'],
      ['teal-lacquer', 'assets/images/board/board-surface-teal-lacquer-v1.png'],
      ['quiet-cosmos', 'assets/images/board/board-surface-quiet-cosmos-v1.png']
    ];

    expected.forEach(([skinId, imagePath]) => {
      api.selectSkin(skinId);

      expect(window.localStorage.getItem('othello.boardSkin')).toBe(skinId);
      expect(window.localStorage.getItem('reversi.boardSkin')).toBe(skinId);
      expect(document.documentElement.getAttribute('data-board-skin-id')).toBe(skinId);
      expect(document.getElementById('board')!.style.getPropertyValue('--board-surface-texture-image')).toBe(`url("${imagePath}")`);
    });
  });

  test('uses bluegreen felt as the startup default when no board skin is stored', () => {
    const controller = require('../ui/board-skin/controller.js');
    const api = controller.setupBoardSkinControls({ root: window });

    expect(api.getSelectedSkinId()).toBe('bluegreen-felt');
    expect(window.localStorage.getItem('othello.boardSkin')).toBeNull();
    expect(window.localStorage.getItem('reversi.boardSkin')).toBeNull();
    expect(document.documentElement.getAttribute('data-board-skin-id')).toBe('bluegreen-felt');
    expect(document.getElementById('board')!.style.getPropertyValue('--board-surface-texture-image')).toBe('url("assets/images/board/board-surface-bluegreen-felt-v1.png")');
  });

  test('persists and applies the generated board frame skin', () => {
    const controller = require('../ui/board-skin/controller.js');
    const api = controller.setupBoardSkinControls({ root: window });
    const catalog = require('../ui/board-skin/catalog.js');

    expect(catalog.DEFAULT_BOARD_FRAME_SKIN_ID).toBe('marsh-forged-iron');
    expect(catalog.getAllBoardFrameSkins().find((skin: { id: string }) => skin.id === 'marsh-forged-iron')?.label).toBe('既定');
    expect(catalog.getAllBoardFrameSkins().map((skin: { id: string }) => skin.id)).toEqual([
      'black-gold-lacquer',
      'compact-brass-clean-corners',
      'compact-iron-clean-corners',
      'compact-gold-clean-corners',
      'marsh-forged-iron',
      'submerged-wood',
      'swamp-ruin-stone',
      'shadow-vine-lacquer'
    ]);

    api.selectFrameSkin('compact-brass-clean-corners');

    expect(window.localStorage.getItem('othello.boardFrameSkin')).toBe('compact-brass-clean-corners');
    expect(window.localStorage.getItem('reversi.boardFrameSkin')).toBe('compact-brass-clean-corners');
    expect(document.documentElement.getAttribute('data-board-frame-skin-id')).toBe('compact-brass-clean-corners');
    expect(document.getElementById('board-frame')!.style.getPropertyValue('--board-frame-image')).toBe('url("assets/images/board/board-frame-compact-brass-clean-corners-v3.png")');
  });

  test('applies per-frame layout variables from the board frame catalog', () => {
    const controller = require('../ui/board-skin/controller.js');
    const api = controller.setupBoardSkinControls({ root: window });
    const frameEl = document.getElementById('board-frame')!;

    api.selectFrameSkin('compact-brass-clean-corners');

    expect(frameEl.style.getPropertyValue('--board-frame-padding-top')).toBe('calc(18px * var(--layout-stage-scale))');
    expect(frameEl.style.getPropertyValue('--board-frame-padding-right')).toBe('calc(25px * var(--layout-stage-scale))');
    expect(frameEl.style.getPropertyValue('--board-frame-padding-bottom')).toBe('calc(25px * var(--layout-stage-scale))');
    expect(frameEl.style.getPropertyValue('--board-frame-padding-left')).toBe('calc(25px * var(--layout-stage-scale))');
    expect(frameEl.style.getPropertyValue('--board-frame-art-overhang-top')).toBe('calc(29px * var(--layout-stage-scale))');
    expect(frameEl.style.getPropertyValue('--board-frame-art-overhang-bottom')).toBe('calc(29px * var(--layout-stage-scale))');
    expect(frameEl.style.getPropertyValue('--board-frame-art-offset-y')).toBe('calc(0px * var(--layout-stage-scale))');

    api.selectFrameSkin('compact-iron-clean-corners');

    expect(frameEl.style.getPropertyValue('--board-frame-padding-top')).toBe('calc(20px * var(--layout-stage-scale))');
    expect(frameEl.style.getPropertyValue('--board-frame-padding-right')).toBe('calc(28px * var(--layout-stage-scale))');
    expect(frameEl.style.getPropertyValue('--board-frame-padding-bottom')).toBe('calc(28px * var(--layout-stage-scale))');
    expect(frameEl.style.getPropertyValue('--board-frame-padding-left')).toBe('calc(28px * var(--layout-stage-scale))');
    expect(frameEl.style.getPropertyValue('--board-frame-art-offset-y')).toBe('calc(3px * var(--layout-stage-scale))');

    api.selectFrameSkin('submerged-wood');

    expect(frameEl.style.getPropertyValue('--board-frame-padding-top')).toBe('calc(15px * var(--layout-stage-scale))');
    expect(frameEl.style.getPropertyValue('--board-frame-padding-right')).toBe('calc(20px * var(--layout-stage-scale))');
    expect(frameEl.style.getPropertyValue('--board-frame-padding-bottom')).toBe('calc(20px * var(--layout-stage-scale))');
    expect(frameEl.style.getPropertyValue('--board-frame-padding-left')).toBe('calc(20px * var(--layout-stage-scale))');
    expect(frameEl.style.getPropertyValue('--board-frame-art-offset-y')).toBe('calc(2px * var(--layout-stage-scale))');
  });

  test('persists and applies the selected compact board frame skins', () => {
    const controller = require('../ui/board-skin/controller.js');
    const api = controller.setupBoardSkinControls({ root: window });
    const expected: Array<[string, string]> = [
      ['compact-iron-clean-corners', 'assets/images/board/board-frame-compact-iron-clean-corners-v3.png'],
      ['compact-gold-clean-corners', 'assets/images/board/board-frame-compact-gold-clean-corners-v3.png'],
      ['marsh-forged-iron', 'assets/images/board/board-frame-marsh-forged-iron-v1.png'],
      ['submerged-wood', 'assets/images/board/board-frame-submerged-wood-v1.png'],
      ['swamp-ruin-stone', 'assets/images/board/board-frame-swamp-ruin-stone-v1.png'],
      ['shadow-vine-lacquer', 'assets/images/board/board-frame-shadow-vine-lacquer-v1.png']
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
      'assets/images/board/board-frame-compact-gold-clean-corners-v3.png',
      'assets/images/board/board-frame-marsh-forged-iron-v1.png',
      'assets/images/board/board-frame-submerged-wood-v1.png',
      'assets/images/board/board-frame-swamp-ruin-stone-v1.png',
      'assets/images/board/board-frame-shadow-vine-lacquer-v1.png'
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
