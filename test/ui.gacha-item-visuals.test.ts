import * as ItemVisualsModule from '../ui/gacha/gacha-item-visuals.js';

describe('gacha item visuals', () => {
  test('hands without previews show hand fallback tiles', () => {
    const doc = {
      createElement(tagName) {
        return {
          tagName,
          className: '',
          textContent: '',
          hidden: false,
          src: '',
          children: [],
          appendChild(child) {
            this.children.push(child);
          },
          removeAttribute(name) {
            if (name === 'src') this.src = '';
          }
        };
      }
    };

    const image = doc.createElement('img');
    const fallback = ItemVisualsModule.createHandFallbackTile(doc, 'gacha-result-fallback');
    ItemVisualsModule.applyItemPreviewState({
      id: 'gacha__n__人の手',
      kind: 'hand_skin',
      label: '人の手'
    }, image, fallback);

    expect(ItemVisualsModule.getItemKindLabel({ kind: 'hand_skin' })).toBe('手の見た目');
    expect(image.hidden).toBe(true);
    expect(fallback.hidden).toBe(false);
  });

  test('hands keep image previews and use the hand label', () => {
    const doc = {
      createElement(tagName) {
        return {
          tagName,
          className: '',
          textContent: '',
          hidden: false,
          src: '',
          children: [],
          appendChild(child) {
            this.children.push(child);
          },
          removeAttribute(name) {
            if (name === 'src') this.src = '';
          }
        };
      }
    };

    const image = doc.createElement('img');
    const fallback = ItemVisualsModule.createHandFallbackTile(doc, 'gacha-result-fallback');
    ItemVisualsModule.applyItemPreviewState({
      id: 'gacha__n__小鬼の手',
      kind: 'hand_skin',
      label: '小鬼の手',
      imagePath: 'assets/images/Gacha/N/小鬼の手.png'
    }, image, fallback);

    expect(ItemVisualsModule.getItemKindLabel({ kind: 'hand_skin' })).toBe('手の見た目');
    expect(image.hidden).toBe(false);
    expect(image.src).toBe('assets/images/Gacha/N/小鬼の手.png');
    expect(fallback.hidden).toBe(true);
  });
});
