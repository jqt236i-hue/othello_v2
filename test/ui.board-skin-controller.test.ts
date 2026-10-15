import { JSDOM } from 'jsdom';
import * as fs from 'fs';
import * as path from 'path';
import { PNG } from 'pngjs';

const ADDED_FRAMES = [
  ['midnight-teal', '青緑ミニマル枠'],
  ['classic-walnut', 'クラシック木枠'],
  ['quiet-slate', '静かな石枠']
].map(([name, label]) => ({
  id: `default-${name}`, label,
  imagePath: `assets/images/board/board-frame-default-${name}-v1.webp`
}));
const STUDY_FRAMES = [
  ['walnut-brass', 'F1 胡桃真鍮枠', 28],
  ['ebony-jade', 'F2 黒檀翡翠枠', 28],
  ['grimoire-leather', 'F3 古書レザー枠', 25]
].map(([name, label, padding]) => ({
  id: `study-${name}`, label, padding,
  imagePath: `assets/images/board/board-frame-study-${name}-${name === 'ebony-jade' ? 'v2' : 'v1'}.webp`
}));
const SURFACES = [
  { id: 'bluegreen-felt', label: '既定', imagePath: 'assets/images/board/board-surface-bluegreen-felt-v1.webp' },
  ...[
    ['forest-baize', 'S1 深緑フェルト'],
    ['jade-slate', 'S2 翡翠スレート'],
    ['olive-leather', 'S3 オリーブレザー']
  ].map(([name, label]) => ({
    id: `study-${name}`, label,
    imagePath: `assets/images/board/board-surface-study-${name}-v1.webp`
  }))
];
const FRAMES = [
  { id: 'submerged-wood', label: '沈木枠', imagePath: 'assets/images/board/board-frame-submerged-wood-v1.webp' },
  ...ADDED_FRAMES,
  ...STUDY_FRAMES.map(({ id, label, imagePath }) => ({ id, label, imagePath }))
];

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

  test('keeps defaults and renders all initially owned surfaces and frames', () => {
    const catalog = require('../ui/board-skin/catalog.ts');
    const controller = require('../ui/board-skin/controller.ts');
    controller.setupBoardSkinControls({ root: window });

    expect(catalog.DEFAULT_BOARD_SKIN_ID).toBe('bluegreen-felt');
    expect(catalog.BASE_BOARD_SKINS).toHaveLength(SURFACES.length);
    expect(catalog.BOARD_SKINS).toHaveLength(SURFACES.length);
    expect(catalog.getAllBoardSkins(window)).toEqual(SURFACES.map((skin) => expect.objectContaining(skin)));
    expect(catalog.getOwnedBoardSkins(window)).toEqual(SURFACES.map((skin) => expect.objectContaining(skin)));
    SURFACES.forEach((skin) => expect(catalog.isBoardSkinOwned(window, skin.id)).toBe(true));
    expect(catalog.DEFAULT_BOARD_FRAME_SKIN_ID).toBe('submerged-wood');
    expect(catalog.BASE_BOARD_FRAME_SKINS).toHaveLength(FRAMES.length);
    expect(catalog.BOARD_FRAME_SKINS).toHaveLength(FRAMES.length);
    expect(catalog.getAllBoardFrameSkins(window)).toEqual(FRAMES.map((skin) => expect.objectContaining(skin)));
    expect(catalog.getOwnedBoardFrameSkins(window)).toEqual(FRAMES.map((skin) => expect.objectContaining(skin)));
    FRAMES.forEach((skin) => expect(catalog.isBoardFrameSkinOwned(window, skin.id)).toBe(true));
    expect(Array.from(document.querySelectorAll('.board-skin-option'))
      .map((button) => button.getAttribute('data-board-skin-id'))).toEqual(SURFACES.map((skin) => skin.id));
    expect(Array.from(document.querySelectorAll('.board-frame-skin-option'))
      .map((button) => button.getAttribute('data-board-frame-skin-id'))).toEqual(FRAMES.map((skin) => skin.id));
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

  test.each(FRAMES)('saves and restores frame $id after reinitialization', (skin) => {
    const api = require('../ui/board-skin/controller.ts').setupBoardSkinControls({ root: window });
    (document.querySelector(`[data-board-frame-skin-id="${skin.id}"].board-frame-skin-option`) as HTMLButtonElement).click();
    expect(api.getSelectedFrameSkinId()).toBe(skin.id);
    ['reversi.boardFrameSkin', 'othello.boardFrameSkin'].forEach((key) => {
      expect(window.localStorage.getItem(key)).toBe(skin.id);
    });
    document.documentElement.removeAttribute('data-board-frame-skin-id');
    document.getElementById('board-frame')!.style.removeProperty('--board-frame-image');
    document.getElementById('boardFrameSkinOptions')!.innerHTML = '';
    jest.resetModules();

    const restored = require('../ui/board-skin/controller.ts').setupBoardSkinControls({ root: window });
    expect(restored.getSelectedFrameSkinId()).toBe(skin.id);
    expect(document.documentElement.getAttribute('data-board-frame-skin-id')).toBe(skin.id);
    expect(document.getElementById('board-frame')!.style.getPropertyValue('--board-frame-image'))
      .toBe(`url("${skin.imagePath}")`);
    expect(document.querySelector(`[data-board-frame-skin-id="${skin.id}"].board-frame-skin-option`)
      ?.getAttribute('aria-checked')).toBe('true');
  });

  test.each(SURFACES)('saves and restores surface $id after reinitialization', (skin) => {
    const api = require('../ui/board-skin/controller.ts').setupBoardSkinControls({ root: window });
    (document.querySelector(`[data-board-skin-id="${skin.id}"].board-skin-option`) as HTMLButtonElement).click();
    expect(api.getSelectedSkinId()).toBe(skin.id);
    ['reversi.boardSkin', 'othello.boardSkin'].forEach((key) => {
      expect(window.localStorage.getItem(key)).toBe(skin.id);
    });
    document.documentElement.removeAttribute('data-board-skin-id');
    document.getElementById('board')!.style.removeProperty('--board-surface-texture-image');
    document.getElementById('boardSkinOptions')!.innerHTML = '';
    jest.resetModules();

    const restored = require('../ui/board-skin/controller.ts').setupBoardSkinControls({ root: window });
    expect(restored.getSelectedSkinId()).toBe(skin.id);
    expect(document.documentElement.getAttribute('data-board-skin-id')).toBe(skin.id);
    expect(document.getElementById('board')!.style.getPropertyValue('--board-surface-texture-image'))
      .toBe(`url("${skin.imagePath}")`);
    expect(document.querySelector(`[data-board-skin-id="${skin.id}"].board-skin-option`)
      ?.getAttribute('aria-checked')).toBe('true');
    expect(fs.existsSync(path.join(__dirname, '..', skin.imagePath))).toBe(true);
  });

  test.each(STUDY_FRAMES)('applies measured layout for study frame $id', (skin) => {
    const api = require('../ui/board-skin/controller.ts').setupBoardSkinControls({ root: window });
    api.selectFrameSkin(skin.id);
    const frameEl = document.getElementById('board-frame')!;
    ['top', 'right', 'bottom', 'left'].forEach((side) => {
      expect(frameEl.style.getPropertyValue(`--board-frame-padding-${side}`))
        .toBe(`calc(${skin.padding}px * var(--layout-stage-scale))`);
    });
    expect(frameEl.style.getPropertyValue('--board-frame-art-offset-y')).toBe('calc(0px * var(--layout-stage-scale))');
  });

  test('keeps the straight ebony frame moderate-width with no enlarged artwork or baked-in board', () => {
    const api = require('../ui/board-skin/controller.ts').setupBoardSkinControls({ root: window });
    api.selectFrameSkin('study-ebony-jade');
    const frameEl = document.getElementById('board-frame')!;
    ['top', 'bottom'].forEach((side) => {
      expect(frameEl.style.getPropertyValue(`--board-frame-art-overhang-${side}`))
        .toBe('calc(0px * var(--layout-stage-scale))');
    });
    const css = fs.readFileSync(path.join(__dirname, '..', 'styles-layout.css'), 'utf8');
    expect(css).toMatch(/#board-frame\[data-board-frame-skin-id="study-ebony-jade"\]\s*\{\s*--board-frame-art-overhang: 0px;/);

    const png = PNG.sync.read(fs.readFileSync(path.join(__dirname, '..',
      'assets/images/board/board-frame-study-ebony-jade-v2.png')));
    const alphaAt = (x: number, y: number) => png.data[((y * png.width + x) * 4) + 3];
    const middle = Math.floor(png.height / 2);
    const opaqueXs = Array.from({ length: png.width }, (_, x) => x).filter((x) => alphaAt(x, middle) > 0);
    const leftRail = opaqueXs.filter((x) => x < png.width / 2);
    const outerWidth = opaqueXs[opaqueXs.length - 1] - opaqueXs[0] + 1;
    expect(leftRail.length / outerWidth).toBeGreaterThan(0.04);
    expect(leftRail.length / outerWidth).toBeLessThan(0.065);
    // The entire playable opening is transparent, not just the center sample.
    for (let y = 61; y < 1060; y += 1) {
      for (let x = 59; x < 1060; x += 1) {
        if (alphaAt(x, y) !== 0) throw new Error(`Baked-in board pixel at ${x},${y}`);
      }
    }
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

  test.each(FRAMES)('frame $id source image center and outer background are transparent', (skin) => {
    expect(fs.existsSync(path.join(__dirname, '..', skin.imagePath))).toBe(true);
    const png = PNG.sync.read(fs.readFileSync(path.join(__dirname, '..', skin.imagePath.replace(/\.webp$/, '.png'))));
    const samplePoints = [
      [0, 0],
      [Math.floor(png.width / 2), 0],
      [0, Math.floor(png.height / 2)],
      [png.width - 1, 0],
      [0, png.height - 1],
      [png.width - 1, png.height - 1],
      [Math.floor(png.width / 2), png.height - 1],
      [png.width - 1, Math.floor(png.height / 2)],
      [Math.floor(png.width / 2), Math.floor(png.height / 2)]
    ];

    samplePoints.forEach(([x, y]) => {
      expect(png.data[((y * png.width + x) * 4) + 3]).toBe(0);
    });
    expect(png.data.some((value, index) => index % 4 === 3 && value > 0)).toBe(true);
  });
});
