import * as codec from '../ui/assets/optimized-image-codec';

const sourcePath = 'assets/images/board/frame.png';
const optimizedPath = 'assets/images/board/frame.webp';
const mapping = Object.freeze({ [sourcePath]: optimizedPath });

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

function createResponse(options: {
  ok?: boolean;
  contentType?: string;
  blobType?: string;
} = {}): any {
  return {
    ok: options.ok ?? true,
    headers: {
      get(name: string) {
        return name.toLowerCase() === 'content-type'
          ? options.contentType ?? 'image/webp'
          : null;
      }
    },
    blob: async () => ({ type: options.blobType ?? 'image/webp' })
  };
}

function createStrictRoot(response: any, ImageClass: any = SuccessfulImage): any {
  return {
    Image: ImageClass,
    fetch: jest.fn(async () => response),
    URL: {
      createObjectURL: jest.fn(() => 'blob:optimized-webp'),
      revokeObjectURL: jest.fn()
    }
  };
}

describe('optimized image codec', () => {
  beforeEach(() => codec.resetOptimizedImageCodecForTests());

  test('uses one fetched WebP body after support, MIME, and decode succeed', async () => {
    const root = createStrictRoot(createResponse());
    await expect(codec.resolveOptimizedImagePath(root, sourcePath, mapping))
      .resolves.toBe('blob:optimized-webp');
    await expect(codec.resolveOptimizedImagePath(root, sourcePath, mapping))
      .resolves.toBe('blob:optimized-webp');
    expect(root.fetch).toHaveBeenCalledTimes(1);
    expect(root.fetch).toHaveBeenCalledWith(optimizedPath, {
      credentials: 'same-origin',
      cache: 'default'
    });
    expect(root.URL.createObjectURL).toHaveBeenCalledTimes(1);
  });

  test.each([
    ['HTTP failure', createResponse({ ok: false })],
    ['response MIME mismatch', createResponse({ contentType: 'image/png' })],
    ['blob MIME mismatch', createResponse({ blobType: 'image/png' })]
  ])('falls back to PNG once on %s', async (_label, response) => {
    const root = createStrictRoot(response);
    await expect(codec.resolveOptimizedImagePath(root, sourcePath, mapping))
      .resolves.toBe(sourcePath);
    await expect(codec.resolveOptimizedImagePath(root, sourcePath, mapping))
      .resolves.toBe(sourcePath);
    expect(root.fetch).toHaveBeenCalledTimes(1);
    expect(root.URL.createObjectURL).not.toHaveBeenCalled();
  });

  test('falls back to PNG and revokes the object URL when WebP decode fails', async () => {
    let decodeCount = 0;
    class DecodeFailureImage extends SuccessfulImage {
      decode(): Promise<void> {
        decodeCount += 1;
        return decodeCount === 1
          ? Promise.resolve()
          : Promise.reject(new Error('decode failure'));
      }
    }
    const root = createStrictRoot(createResponse(), DecodeFailureImage);
    await expect(codec.resolveOptimizedImagePath(root, sourcePath, mapping))
      .resolves.toBe(sourcePath);
    expect(root.URL.revokeObjectURL).toHaveBeenCalledWith('blob:optimized-webp');
  });

  test('keeps PNG when WebP support is unavailable without requesting the candidate', async () => {
    class UnsupportedImage extends SuccessfulImage {
      decode(): Promise<void> {
        return Promise.reject(new Error('unsupported'));
      }
    }
    const root = createStrictRoot(createResponse(), UnsupportedImage);
    await expect(codec.resolveOptimizedImagePath(root, sourcePath, mapping))
      .resolves.toBe(sourcePath);
    expect(root.fetch).not.toHaveBeenCalled();
  });

  test('ignores a stale completion after a newer property generation starts', async () => {
    await codec.supportsWebp({ Image: SuccessfulImage } as any);
    const resolvers: Array<() => void> = [];
    class DeferredImage extends SuccessfulImage {
      decode(): Promise<void> {
        return new Promise<void>((resolve) => resolvers.push(resolve));
      }
    }
    const secondSource = 'assets/images/board/second.png';
    const values: Record<string, string> = {};
    const style = {
      setProperty(name: string, value: string) { values[name] = value; },
      getPropertyValue(name: string) { return values[name] || ''; }
    } as CSSStyleDeclaration;
    const root = { Image: DeferredImage } as any;
    codec.applyOptimizedImageWithFallback(root, style, '--frame', sourcePath, {
      [sourcePath]: optimizedPath,
      [secondSource]: 'assets/images/board/second.webp'
    });
    codec.applyOptimizedImageWithFallback(root, style, '--frame', secondSource, {
      [sourcePath]: optimizedPath,
      [secondSource]: 'assets/images/board/second.webp'
    });
    await Promise.resolve();
    await Promise.resolve();
    expect(resolvers).toHaveLength(2);
    resolvers[0]();
    await new Promise((resolve) => setImmediate(resolve));
    expect(values['--frame']).toBeUndefined();
    resolvers[1]();
    await new Promise((resolve) => setImmediate(resolve));
    expect(values['--frame']).toBe('url("assets/images/board/second.webp")');
  });
});
