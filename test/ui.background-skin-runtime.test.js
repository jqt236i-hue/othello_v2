const runtime = require('../ui/background-skin/runtime.js');

describe('background skin runtime', () => {
  function createStyle() {
    const values = {};
    return {
      values,
      setProperty(name, value) { values[name] = value; },
      removeProperty(name) { delete values[name]; },
      set backgroundImage(value) { values.backgroundImage = value; },
      get backgroundImage() { return values.backgroundImage; },
      set backgroundPosition(value) { values.backgroundPosition = value; },
      get backgroundPosition() { return values.backgroundPosition; },
      set backgroundRepeat(value) { values.backgroundRepeat = value; },
      get backgroundRepeat() { return values.backgroundRepeat; },
      set backgroundSize(value) { values.backgroundSize = value; },
      get backgroundSize() { return values.backgroundSize; }
    };
  }

  test('applies selected background at its natural size without cropping', () => {
    const bodyStyle = createStyle();
    const attrs = {};
    const rootRef = {
      document: {
        body: {
          style: bodyStyle,
          setAttribute(name, value) { attrs[name] = value; }
        },
        documentElement: {
          setAttribute(name, value) { attrs[`root:${name}`] = value; }
        }
      },
      BackgroundSkinCatalogModule: {
        getBackgroundSkinDefinition() {
          return {
            id: 'observation-desk',
            imagePath: 'assets/images/background-skin/観測の机.png'
          };
        }
      }
    };

    const applied = runtime.applyBackgroundSkin(rootRef, 'observation-desk');

    expect(applied.id).toBe('observation-desk');
    expect(attrs['data-background-skin-id']).toBe('observation-desk');
    expect(bodyStyle.values.backgroundImage).toBe('var(--selected-background-skin)');
    expect(bodyStyle.values.backgroundPosition).toBe('center center');
    expect(bodyStyle.values.backgroundRepeat).toBe('no-repeat');
    expect(bodyStyle.values.backgroundSize).toBe('auto');
  });
});