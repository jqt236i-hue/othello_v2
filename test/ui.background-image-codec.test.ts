import * as codec from '../ui/assets/background-image-codec';

const sourcePath = 'assets/images/background/default.png';
const outputPath = 'assets/images/background/default.webp';

class SuccessfulImage {
  onload: null | (() => void) = null;
  onerror: null | (() => void) = null;
  naturalWidth = 1;
  width = 1;
  private currentSource = '';

  set src(value: string) {
    this.currentSource = value;
  }

  get src(): string {
    return this.currentSource;
  }

  decode(): Promise<void> {
    return Promise.resolve();
  }
}

describe('background image codec fallback', () => {
  beforeEach(() => codec.resetBackgroundImageCodecForTests());

  test('uses committed lossless WebP only after capability and asset decode succeed', async () => {
    const resolved = await codec.resolveBackgroundImagePath(
      { Image: SuccessfulImage } as any,
      sourcePath
    );
    expect(codec.getOptimizedBackgroundPath(sourcePath)).toBe(outputPath);
    expect(resolved).toBe(outputPath);
  });

  test('keeps the original PNG when the optimized asset cannot decode', async () => {
    let decodeCount = 0;
    class FailingAssetImage extends SuccessfulImage {
      decode(): Promise<void> {
        decodeCount += 1;
        return decodeCount === 1 ? Promise.resolve() : Promise.reject(new Error('decode failed'));
      }
    }
    const resolved = await codec.resolveBackgroundImagePath(
      { Image: FailingAssetImage } as any,
      sourcePath
    );
    expect(resolved).toBe(sourcePath);
  });

  test('does not overwrite a newer background while an older decode is pending', async () => {
    const resolvers: Array<() => void> = [];
    class DeferredImage extends SuccessfulImage {
      decode(): Promise<void> {
        return new Promise<void>((resolve) => resolvers.push(resolve));
      }
    }
    const values: Record<string, string> = {};
    const style = {
      setProperty(name: string, value: string) { values[name] = value; },
      getPropertyValue(name: string) { return values[name] || ''; }
    } as CSSStyleDeclaration;
    codec.applyBackgroundImageWithFallback(
      { Image: DeferredImage } as any,
      style,
      '--background',
      sourcePath
    );
    values['--background'] = 'url("assets/images/background/newer.png")';
    resolvers.splice(0).forEach((resolve) => resolve());
    await Promise.resolve();
    await Promise.resolve();
    expect(values['--background']).toBe('url("assets/images/background/newer.png")');
  });
});
