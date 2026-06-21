import * as runtime from '../ui/font-skin/runtime.js';

describe('font skin runtime', () => {
  test('falls back to Shippori Mincho when no preferred skin is available', () => {
    const appliedAttrs: Record<string, string> = {};
    const style = {
      values: {} as Record<string, string>,
      setProperty(name: string, value: string) {
        this.values[name] = value;
      },
      removeProperty(name: string) {
        delete this.values[name];
      }
    };
    const rootRef = {
      document: {
        body: {
          style,
          setAttribute(name: string, value: string) {
            appliedAttrs[name] = value;
          }
        },
        documentElement: {
          style,
          setAttribute() {}
        }
      },
      FontSkinCatalogModule: {
        DEFAULT_FONT_SKIN_ID: 'shippori-mincho',
        normalizeFontSkinId(value: string | null | undefined) {
          return value === 'dot-gothic' ? 'dot-gothic' : 'shippori-mincho';
        },
        getFontSkinDefinition(skinId: string) {
          return {
            id: skinId,
            fontFamily: '"CR-Shippori Mincho", serif',
            accentFontFamily: '"CR-Shippori Mincho", serif',
            readableFontFamily: '"CR-Shippori Mincho", serif'
          };
        }
      }
    } as any;

    const applied = runtime.syncDisplayedFontSkin(rootRef, null);

    expect(applied?.id).toBe('shippori-mincho');
    expect(appliedAttrs['data-font-skin-id']).toBe('shippori-mincho');
    expect(style.values['--selected-app-font-family']).toContain('CR-Shippori Mincho');
  });

  test('applies selected font families to document root and body', () => {
    const bodyStyle = {
      values: {} as Record<string, string>,
      setProperty(name: string, value: string) {
        this.values[name] = value;
      },
      removeProperty(name: string) {
        delete this.values[name];
      }
    };
    const rootStyle = {
      values: {} as Record<string, string>,
      setProperty(name: string, value: string) {
        this.values[name] = value;
      },
      removeProperty(name: string) {
        delete this.values[name];
      }
    };
    const bodyAttrs: Record<string, string> = {};
    const rootAttrs: Record<string, string> = {};
    const rootRef = {
      document: {
        body: {
          style: bodyStyle,
          setAttribute(name: string, value: string) {
            bodyAttrs[name] = value;
          }
        },
        documentElement: {
          style: rootStyle,
          setAttribute(name: string, value: string) {
            rootAttrs[name] = value;
          }
        }
      },
      FontSkinCatalogModule: {
        getFontSkinDefinition() {
          return {
            id: 'dot-gothic',
            fontFamily: '"DotGothic16", "MS Gothic", monospace',
            accentFontFamily: '"DotGothic16", "MS Gothic", monospace'
          };
        }
      }
    } as any;

    const applied = runtime.applyFontSkin(rootRef, 'dot-gothic');

    expect(applied?.id).toBe('dot-gothic');
    expect(bodyAttrs['data-font-skin-id']).toBe('dot-gothic');
    expect(rootAttrs['data-font-skin-id']).toBe('dot-gothic');
    expect(bodyStyle.values['--selected-app-font-family']).toContain('DotGothic16');
    expect(bodyStyle.values['--selected-app-font-accent-family']).toContain('DotGothic16');
    expect(rootStyle.values['--selected-app-font-family']).toContain('DotGothic16');
  });
});
