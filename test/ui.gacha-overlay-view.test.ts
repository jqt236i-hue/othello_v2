import { JSDOM } from 'jsdom';
import * as OverlayViewModule from '../ui/gacha/gacha-overlay-view.js';

describe('gacha overlay view', () => {
  test('renders the reference-style rate table structure for the details panel', () => {
    const dom = new JSDOM(`<!DOCTYPE html><body>
      <button id="gachaOpenBtn"></button>
      <div id="gachaOverlay"></div>
      <div id="gachaModal"></div>
      <button id="gachaCloseBtn"></button>
      <div id="gachaBalanceValue"></div>
      <div id="gachaDetailsPanel"></div>
      <button id="gachaSinglePullBtn"></button>
      <button id="gachaTenPullBtn"></button>
      <div id="gachaStatusText"></div>
      <div id="gachaResults"></div>
    </body>`);

    const view = OverlayViewModule.createGachaOverlayView({
      document: dom.window.document,
      root: dom.window
    });

    view.renderDetails([
      { id: 'gacha__exr__意志', rarity: 'EXR', kind: 'hand_skin' },
      { id: 'gacha__ur__ラグドールの手', rarity: 'UR', kind: 'hand_skin' },
      { id: 'gacha__ssr__邪悪な手', rarity: 'SSR', kind: 'hand_skin' },
      { id: 'gacha__sr__虹の手', rarity: 'SR', kind: 'hand_skin' },
      { id: 'gacha__r__猫の手', rarity: 'R', kind: 'hand_skin' },
      { id: 'gacha__n__人の手', rarity: 'N', kind: 'hand_skin' }
    ]);

    const panel = dom.window.document.getElementById('gachaDetailsPanel');
    expect(panel.querySelector('.gacha-rate-heading').textContent).toContain('排出率');
    expect(panel.querySelector('.gacha-rate-summary').textContent).toContain('手の見た目');
    expect(Array.from(panel.querySelectorAll('.gacha-rate-row')).map((row) => row.getAttribute('data-gacha-rarity'))).toEqual([
      'exr',
      'ur',
      'ssr',
      'sr',
      'r',
      'n'
    ]);

    dom.window.close();
  });

  test('renders hand, background, and placement-sound rewards with the correct visuals', () => {
    const dom = new JSDOM(`<!DOCTYPE html><body>
      <button id="gachaOpenBtn"></button>
      <div id="gachaOverlay"></div>
      <div id="gachaModal"></div>
      <button id="gachaCloseBtn"></button>
      <div id="gachaBalanceValue"></div>
      <div id="gachaDetailsPanel"></div>
      <button id="gachaSinglePullBtn"></button>
      <button id="gachaTenPullBtn"></button>
      <div id="gachaStatusText"></div>
      <div id="gachaResults"></div>
    </body>`);

    const view = OverlayViewModule.createGachaOverlayView({
      document: dom.window.document,
      root: dom.window
    });

    view.renderPullResults([
      {
        rarity: 'N',
        item: {
          id: 'gacha__n__小鬼の手',
          kind: 'hand_skin',
          label: '小鬼の手',
          imagePath: 'assets/images/Gacha/N/小鬼の手.png',
          previewImagePath: 'assets/images/Gacha/N/小鬼の手.png'
        }
      },
      {
        rarity: 'N',
        item: {
          id: 'gacha__n__background_skin__観測できなかった夜',
          kind: 'background_skin',
          label: '観測できなかった夜',
          imagePath: 'assets/images/Gacha/N/background/観測できなかった夜.png',
          previewImagePath: 'assets/images/Gacha/N/background/観測できなかった夜.png'
        }
      },
      {
        rarity: 'N',
        item: {
          id: 'gacha__n__placement_sound__type-1-standard',
          kind: 'placement_sound',
          label: 'type-1-standard',
          assetPath: 'assets/images/Gacha/N/type-1-standard.mp3',
          soundPath: 'assets/images/Gacha/N/type-1-standard.mp3'
        }
      }
    ], ['gacha__n__placement_sound__type-1-standard']);

    const cards = Array.from(dom.window.document.querySelectorAll('.gacha-result-card'));
    expect(cards).toHaveLength(3);
    expect(cards[0].querySelector('.gacha-result-image')).toBeTruthy();
    expect(cards[0].querySelector('.gacha-result-fallback').hidden).toBe(true);
    expect(cards[0].querySelector('.gacha-result-kind').textContent).toBe('手の見た目');

    expect(cards[1].querySelector('.gacha-result-image').hidden).toBe(false);
    expect(cards[1].querySelector('.gacha-result-fallback').hidden).toBe(true);
    expect(cards[1].querySelector('.gacha-result-kind').textContent).toBe('背景');

    expect(cards[2].querySelector('.gacha-result-image').hidden).toBe(true);
    expect(cards[2].querySelector('.gacha-result-fallback').hidden).toBe(false);
    expect(cards[2].querySelector('.gacha-item-fallback-icon').textContent).toBe('SOUND');
    expect(cards[2].querySelector('.gacha-result-kind').textContent).toBe('配置音');
    expect(cards[2].querySelector('.gacha-result-status').textContent).toBe('NEW');

    dom.window.close();
  });
});
