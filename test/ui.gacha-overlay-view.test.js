const { JSDOM } = require('jsdom');
const OverlayViewModule = require('../ui/gacha/gacha-overlay-view.js');

describe('gacha overlay view', () => {
  test('renders both hand-image rewards and placement-sound fallback tiles', () => {
    const dom = new JSDOM(`<!DOCTYPE html><body>
      <button id="gachaOpenBtn"></button>
      <div id="gachaOverlay"></div>
      <div id="gachaModal"></div>
      <button id="gachaCloseBtn"></button>
      <div id="gachaBalanceValue"></div>
      <button id="gachaDetailToggleBtn"></button>
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
          id: 'gacha__n__placement_sound__type-1-standard',
          kind: 'placement_sound',
          label: 'type-1-standard',
          assetPath: 'assets/images/Gacha/N/type-1-standard.mp3',
          soundPath: 'assets/images/Gacha/N/type-1-standard.mp3'
        }
      }
    ], ['gacha__n__placement_sound__type-1-standard']);

    const cards = Array.from(dom.window.document.querySelectorAll('.gacha-result-card'));
    expect(cards).toHaveLength(2);
    expect(cards[0].querySelector('.gacha-result-image')).toBeTruthy();
    expect(cards[0].querySelector('.gacha-result-fallback').hidden).toBe(true);
    expect(cards[0].querySelector('.gacha-result-kind').textContent).toBe('手の見た目');

    expect(cards[1].querySelector('.gacha-result-image').hidden).toBe(true);
    expect(cards[1].querySelector('.gacha-result-fallback').hidden).toBe(false);
    expect(cards[1].querySelector('.gacha-item-fallback-icon').textContent).toBe('SOUND');
    expect(cards[1].querySelector('.gacha-result-kind').textContent).toBe('配置音');
    expect(cards[1].querySelector('.gacha-result-status').textContent).toBe('NEW');

    dom.window.close();
  });
});
