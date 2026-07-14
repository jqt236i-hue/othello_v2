import * as codec from '../ui/assets/background-image-codec';
import * as fs from 'fs';
import * as path from 'path';

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

  test('keeps the current image while WebP decodes and never assigns PNG on success', async () => {
    const resolvers: Array<() => void> = [];
    const requestedSources: string[] = [];
    class DeferredSuccessfulImage extends SuccessfulImage {
      set src(value: string) {
        requestedSources.push(value);
        super.src = value;
      }

      decode(): Promise<void> {
        return new Promise<void>((resolve) => resolvers.push(resolve));
      }
    }
    const values: Record<string, string> = {
      '--background': 'url("assets/images/background/current.png")'
    };
    const style = {
      setProperty(name: string, value: string) { values[name] = value; },
      getPropertyValue(name: string) { return values[name] || ''; }
    } as CSSStyleDeclaration;

    codec.applyBackgroundImageWithFallback(
      { Image: DeferredSuccessfulImage } as any,
      style,
      '--background',
      sourcePath
    );

    expect(values['--background']).toBe('url("assets/images/background/current.png")');
    expect(requestedSources).toEqual([expect.stringContaining('data:image/webp')]);
    resolvers.shift()?.();
    await new Promise((resolve) => setImmediate(resolve));
    expect(requestedSources).toEqual([
      expect.stringContaining('data:image/webp'),
      outputPath
    ]);
    expect(values['--background']).toBe('url("assets/images/background/current.png")');
    resolvers.shift()?.();
    await new Promise((resolve) => setImmediate(resolve));
    expect(values['--background']).toBe(`url("${outputPath}")`);
    expect(requestedSources).not.toContain(sourcePath);
  });

  test('assigns PNG once only after optimized decode fails', async () => {
    let decodeCount = 0;
    class FailingAssetImage extends SuccessfulImage {
      decode(): Promise<void> {
        decodeCount += 1;
        return decodeCount === 1 ? Promise.resolve() : Promise.reject(new Error('decode failed'));
      }
    }
    const values: Record<string, string> = {
      '--background': 'url("assets/images/background/current.png")'
    };
    const assignments: string[] = [];
    const style = {
      setProperty(name: string, value: string) {
        values[name] = value;
        assignments.push(value);
      },
      getPropertyValue(name: string) { return values[name] || ''; }
    } as CSSStyleDeclaration;

    codec.applyBackgroundImageWithFallback(
      { Image: FailingAssetImage } as any,
      style,
      '--background',
      sourcePath
    );
    await new Promise((resolve) => setImmediate(resolve));

    expect(assignments).toEqual([`url("${sourcePath}")`]);
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

  test('ships only materially smaller lossless WebP backgrounds', () => {
    const root = path.resolve(__dirname, '..');
    const manifest = JSON.parse(fs.readFileSync(
      path.join(root, 'assets', 'images', 'background', 'optimized-backgrounds.json'),
      'utf8'
    ));

    expect(manifest.images).toHaveLength(13);
    expect(manifest.selection).toMatchObject({
      minimumSourceBytes: 1310720,
      minimumSavedBytes: 262144,
      minimumSavingsRatio: 0.15,
      opaqueOnly: true
    });
    manifest.images.forEach((image: any) => {
      expect(image.savedBytes).toBeGreaterThanOrEqual(manifest.selection.minimumSavedBytes);
      expect(image.savedBytes / image.sourceBytes).toBeGreaterThanOrEqual(
        manifest.selection.minimumSavingsRatio
      );
      expect(fs.existsSync(path.join(root, image.output))).toBe(true);
      expect(image.output.endsWith('.webp')).toBe(true);
    });
    expect(codec.getOptimizedBackgroundPath('assets/images/background/デフォルト4.png'))
      .toBe('assets/images/background/デフォルト4.webp');
    expect(fs.readdirSync(path.join(root, 'assets', 'images', 'background'))
      .some((name) => name.endsWith('.avif'))).toBe(false);
    const mappedOutputs = new Set(manifest.images.map((image: any) => path.basename(image.output)));
    const pairedWebpOutputs = fs.readdirSync(path.join(root, 'assets', 'images', 'background'))
      .filter((name) => name.endsWith('.webp'))
      .filter((name) => fs.existsSync(path.join(
        root,
        'assets',
        'images',
        'background',
        name.replace(/\.webp$/i, '.png')
      )));
    expect(pairedWebpOutputs.every((name) => mappedOutputs.has(name))).toBe(true);
  });
});
