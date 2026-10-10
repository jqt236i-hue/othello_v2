import { JSDOM } from 'jsdom';
import * as fs from 'fs';
import * as path from 'path';
import { PNG } from 'pngjs';

const REMOVED_BOARD_SKIN_IDS = [
  'emerald-stone', 'moss-stone', 'soft-felt', 'woven-felt', 'stone-inlay',
  'brushed-lacquer', 'mica-washi', 'aged-board', 'teal-jade', 'black-green-lacquer',
  'cyan-obsidian', 'verdigris-jade', 'celestial-green-stone', 'celadon-stone',
  'teal-lacquer', 'quiet-cosmos'
];
const REMOVED_FRAME_SKIN_IDS = [
  'black-gold-lacquer', 'compact-brass-clean-corners', 'compact-iron-clean-corners',
  'compact-gold-clean-corners', 'marsh-forged-iron', 'swamp-ruin-stone',
  'shadow-vine-lacquer', 'thin-ebony-gold', 'thin-walnut-brass',
  'thin-charred-cedar-copper', 'thin-birch-gunmetal', 'thin-mahogany-bronze'
];

describe('board skin controller', () => {
  let dom: JSDOM;

  beforeEach(() => {
    jest.resetModules();
    dom = new JSDOM(`<!doctype html><html><body>
      <div id="board-frame"></div>
      <div id="board"></div>
      <div id="boardSkinOptions"></div>
      <div id="boardFrameSkinOptions"></div>
    </body></html>`, { url: 'https://example.test/' });
    global.window = dom.window as any;
    global.document = dom.window.document as any;
  });

  afterEach(() => {
    dom.window.close();
    delete (global as any).window;
    delete (global as any).document;
  });

  test('keeps one standard board and frame and renders only those choices', () => {
    const catalog = require('../ui/board-skin/catalog.ts');
    const controller = require('../ui/board-skin/controller.ts');
    controller.setupBoardSkinControls({ root: window });

    expect(catalog.DEFAULT_BOARD_SKIN_ID).toBe('bluegreen-felt');
    expect(catalog.BASE_BOARD_SKINS).toHaveLength(1);
    expect(catalog.BOARD_SKINS).toHaveLength(1);
    expect(catalog.getAllBoardSkins(window)).toEqual([
      expect.objectContaining({ id: 'bluegreen-felt', label: '既定' })
    ]);
    expect(catalog.DEFAULT_BOARD_FRAME_SKIN_ID).toBe('submerged-wood');
    expect(catalog.BASE_BOARD_FRAME_SKINS).toHaveLength(1);
    expect(catalog.BOARD_FRAME_SKINS).toHaveLength(1);
    expect(catalog.getAllBoardFrameSkins(window)).toEqual([
      expect.objectContaining({ id: 'submerged-wood', label: '沈木枠' })
    ]);
    expect(Array.from(document.querySelectorAll('.board-skin-option'))
      .map((button) => button.getAttribute('data-board-skin-id'))).toEqual(['bluegreen-felt']);
    expect(Array.from(document.querySelectorAll('.board-frame-skin-option'))
      .map((button) => button.getAttribute('data-board-frame-skin-id'))).toEqual(['submerged-wood']);
  });

  test('persists and applies the retained default board and frame', () => {
    const controller = require('../ui/board-skin/controller.ts');
    const api = controller.setupBoardSkinControls({ root: window });

    api.selectSkin('bluegreen-felt');
    api.selectFrameSkin('submerged-wood');

    expect(window.localStorage.getItem('othello.boardSkin')).toBe('bluegreen-felt');
    expect(window.localStorage.getItem('reversi.boardSkin')).toBe('bluegreen-felt');
    expect(document.documentElement.getAttribute('data-board-skin-id')).toBe('bluegreen-felt');
    expect(document.getElementById('board')!.style.getPropertyValue('--board-surface-texture-image'))
      .toBe('url("assets/images/board/board-surface-bluegreen-felt-v1.webp")');
    expect(window.localStorage.getItem('othello.boardFrameSkin')).toBe('submerged-wood');
    expect(window.localStorage.getItem('reversi.boardFrameSkin')).toBe('submerged-wood');
    expect(document.documentElement.getAttribute('data-board-frame-skin-id')).toBe('submerged-wood');
    expect(document.getElementById('board-frame')!.style.getPropertyValue('--board-frame-image'))
      .toBe('url("assets/images/board/board-frame-submerged-wood-v1.webp")');
  });

  test('uses the retained defaults at startup without writing a saved selection', () => {
    const controller = require('../ui/board-skin/controller.ts');
    const api = controller.setupBoardSkinControls({ root: window });

    expect(api.getSelectedSkinId()).toBe('bluegreen-felt');
    expect(api.getSelectedFrameSkinId()).toBe('submerged-wood');
    ['othello.boardSkin', 'reversi.boardSkin', 'othello.boardFrameSkin', 'reversi.boardFrameSkin']
      .forEach((key) => expect(window.localStorage.getItem(key)).toBeNull());
    expect(document.documentElement.getAttribute('data-board-skin-id')).toBe('bluegreen-felt');
    expect(document.documentElement.getAttribute('data-board-frame-skin-id')).toBe('submerged-wood');
  });

  test.each(REMOVED_BOARD_SKIN_IDS)('falls back from removed saved board %s for either storage key', (skinId) => {
    const controller = require('../ui/board-skin/controller.ts');
    ['reversi.boardSkin', 'othello.boardSkin'].forEach((key) => {
      window.localStorage.clear();
      window.localStorage.setItem(key, skinId);
      const api = controller.setupBoardSkinControls({ root: window });

      expect(api.getSelectedSkinId()).toBe('bluegreen-felt');
      expect(document.documentElement.getAttribute('data-board-skin-id')).toBe('bluegreen-felt');
      expect(document.getElementById('board')!.style.getPropertyValue('--board-surface-texture-image'))
        .toBe('url("assets/images/board/board-surface-bluegreen-felt-v1.webp")');
      api.selectSkin(skinId);
      expect(window.localStorage.getItem('reversi.boardSkin')).toBe('bluegreen-felt');
      expect(window.localStorage.getItem('othello.boardSkin')).toBe('bluegreen-felt');
    });
  });

  test.each(REMOVED_FRAME_SKIN_IDS)('falls back from removed saved frame %s for either storage key', (skinId) => {
    const controller = require('../ui/board-skin/controller.ts');
    ['reversi.boardFrameSkin', 'othello.boardFrameSkin'].forEach((key) => {
      window.localStorage.clear();
      window.localStorage.setItem(key, skinId);
      const api = controller.setupBoardSkinControls({ root: window });

      expect(api.getSelectedFrameSkinId()).toBe('submerged-wood');
      expect(document.documentElement.getAttribute('data-board-frame-skin-id')).toBe('submerged-wood');
      expect(document.getElementById('board-frame')!.style.getPropertyValue('--board-frame-image'))
        .toBe('url("assets/images/board/board-frame-submerged-wood-v1.webp")');
      api.selectFrameSkin(skinId);
      expect(window.localStorage.getItem('reversi.boardFrameSkin')).toBe('submerged-wood');
      expect(window.localStorage.getItem('othello.boardFrameSkin')).toBe('submerged-wood');
    });
  });

  test('applies the retained frame layout and clears previous custom overhang values', () => {
    const frameEl = document.getElementById('board-frame')!;
    const rootEl = document.documentElement;
    [frameEl, rootEl].forEach((element) => {
      element.style.setProperty('--board-frame-art-overhang-top', '29px');
      element.style.setProperty('--board-frame-art-overhang-bottom', '29px');
    });
    const controller = require('../ui/board-skin/controller.ts');
    const api = controller.setupBoardSkinControls({ root: window });
    api.selectFrameSkin('submerged-wood');

    [frameEl, rootEl].forEach((element) => {
      expect(element.style.getPropertyValue('--board-frame-padding-top')).toBe('calc(15px * var(--layout-stage-scale))');
      expect(element.style.getPropertyValue('--board-frame-padding-right')).toBe('calc(20px * var(--layout-stage-scale))');
      expect(element.style.getPropertyValue('--board-frame-padding-bottom')).toBe('calc(20px * var(--layout-stage-scale))');
      expect(element.style.getPropertyValue('--board-frame-padding-left')).toBe('calc(20px * var(--layout-stage-scale))');
      expect(element.style.getPropertyValue('--board-frame-art-offset-y')).toBe('calc(2px * var(--layout-stage-scale))');
      expect(element.style.getPropertyValue('--board-frame-art-overhang-top')).toBe('');
      expect(element.style.getPropertyValue('--board-frame-art-overhang-bottom')).toBe('');
    });
  });

  test('retained board frame source image outer background is transparent', () => {
    const png = PNG.sync.read(fs.readFileSync(path.join(__dirname, '..',
      'assets/images/board/board-frame-submerged-wood-v1.png')));
    const samplePoints = [
      [0, 0],
      [Math.floor(png.width / 2), 0],
      [0, Math.floor(png.height / 2)],
      [png.width - 1, png.height - 1]
    ];

    samplePoints.forEach(([x, y]) => {
      expect(png.data[((y * png.width + x) * 4) + 3]).toBe(0);
    });
  });
});
