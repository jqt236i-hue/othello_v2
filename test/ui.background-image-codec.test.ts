import * as codec from '../ui/assets/background-image-codec';
import * as fs from 'fs';
import * as path from 'path';

// Exercise codec admission with a synthetic mapping, independent of standard skin assets.
jest.mock('../ui/assets/optimized-backgrounds.generated', () => ({
  OPTIMIZED_BACKGROUND_IMAGES: { 'test-assets/background.png': 'test-assets/background.webp' }
}));
const sourcePath = 'test-assets/background.png';
const outputPath = 'test-assets/background.webp';

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

  test('uses mapped lossless WebP only after capability and asset decode succeed', async () => {
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

  test('ships no legacy background codec candidates after standard skin removal', () => {
    const root = path.resolve(__dirname, '..');
    const manifest = JSON.parse(fs.readFileSync(
      path.join(root, 'assets', 'images', 'background', 'optimized-backgrounds.json'),
      'utf8'
    ));

    const actualMapping = jest.requireActual('../ui/assets/optimized-backgrounds.generated');
    expect(manifest.images).toEqual([]);
    expect(actualMapping.OPTIMIZED_BACKGROUND_IMAGES).toEqual({});
    expect(manifest.selection).toMatchObject({
      minimumSourceBytes: 1310720,
      minimumSavedBytes: 262144,
      minimumSavingsRatio: 0.15,
      opaqueOnly: true
    });
    expect(Object.keys(actualMapping.OPTIMIZED_BACKGROUND_IMAGES))
      .not.toContain('assets/images/background/デフォルト4.png');
    expect(fs.readdirSync(path.join(root, 'assets', 'images', 'background'))
      .some((name) => name.endsWith('.avif'))).toBe(false);
    const mappedOutputs = new Set(manifest.images.map((image: any) => path.basename(image.output)));
    // Start-up backgrounds admitted through the UI image policy (lossy WebP) own
    // their own paired output and are referenced directly, not through this mapping.
    const uiImagePolicy = JSON.parse(fs.readFileSync(
      path.join(root, 'scripts', 'assets', 'optimized-ui-images.policy.json'),
      'utf8'
    ));
    const policyOwnedOutputs = new Set(uiImagePolicy.images
      .map((image: any) => String(image.source))
      .filter((source: string) => source.startsWith('assets/images/background/'))
      .map((source: string) => path.basename(source).replace(/\.png$/i, '.webp')));
    expect(policyOwnedOutputs.has('デフォルト25.webp')).toBe(true);
    const pairedWebpOutputs = fs.readdirSync(path.join(root, 'assets', 'images', 'background'))
      .filter((name) => name.endsWith('.webp'))
      .filter((name) => !policyOwnedOutputs.has(name))
      .filter((name) => fs.existsSync(path.join(
        root,
        'assets',
        'images',
        'background',
        name.replace(/\.webp$/i, '.png')
      )));
    expect(pairedWebpOutputs).toEqual([]);
    expect(mappedOutputs.size).toBe(0);
    expect(fs.readdirSync(path.join(root, 'assets', 'images', 'background'))
      .filter((name) => /\.(png|webp)$/i.test(name)).sort())
      .toEqual(['デフォルト25.png', 'デフォルト25.webp']);
  });
});
