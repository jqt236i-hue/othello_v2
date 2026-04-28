import * as ItemVisualsModule from '../ui/gacha/gacha-item-visuals.js';

describe('gacha item visuals', () => {
  test('placement sound items hide img previews and show fallback tiles', () => {
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
    const fallback = ItemVisualsModule.createSoundFallbackTile(doc, 'gacha-result-fallback');
    ItemVisualsModule.applyItemPreviewState({
      id: 'gacha__n__placement_sound__type-1-standard',
      kind: 'placement_sound',
      label: 'type-1-standard'
    }, image, fallback);

    expect(ItemVisualsModule.getItemKindLabel({ kind: 'placement_sound' })).toBe('配置音');
    expect(image.hidden).toBe(true);
    expect(fallback.hidden).toBe(false);
  });

  test('background items keep image previews and use the background label', () => {
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
    const fallback = ItemVisualsModule.createSoundFallbackTile(doc, 'gacha-result-fallback');
    ItemVisualsModule.applyItemPreviewState({
      id: 'gacha__n__background_skin__観測できなかった夜',
      kind: 'background_skin',
      label: '観測できなかった夜',
      imagePath: 'assets/images/Gacha/N/background/観測できなかった夜.png'
    }, image, fallback);

    expect(ItemVisualsModule.getItemKindLabel({ kind: 'background_skin' })).toBe('背景');
    expect(image.hidden).toBe(false);
    expect(image.src).toBe('assets/images/Gacha/N/background/観測できなかった夜.png');
    expect(fallback.hidden).toBe(true);
  });
});
