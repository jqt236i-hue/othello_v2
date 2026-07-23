export type OptimizedImageMapping = Readonly<Record<string, string>>;

type ImageConstructor = new () => HTMLImageElement;

export interface OptimizedImageBrowserRoot {
  readonly Image?: ImageConstructor;
  readonly fetch?: typeof fetch;
  readonly URL?: typeof URL;
}

export interface OptimizedImageResolveOptions {
  readonly strictMime?: boolean;
}

const WEBP_PROBE = 'data:image/webp;base64,UklGRhoAAABXRUJQVlA4TA4AAAAvAAAAAAcQEf0PRET/Aw==';
let webpSupportPromise: Promise<boolean> | null = null;
let pendingStyleRequests = new WeakMap<object, Map<string, symbol>>();
let documentAssetLoads = new WeakMap<object, Map<string, Promise<string | null>>>();

function getImageConstructor(
  rootRef: OptimizedImageBrowserRoot | null | undefined
): ImageConstructor | null {
  if (rootRef && typeof rootRef.Image === 'function') return rootRef.Image;
  if (typeof Image === 'function') return Image;
  return null;
}

function waitForImage(image: HTMLImageElement, source: string): Promise<boolean> {
  return new Promise<boolean>((resolve) => {
    let settled = false;
    const finish = (value: boolean): void => {
      if (settled) return;
      settled = true;
      image.onload = null;
      image.onerror = null;
      resolve(value);
    };
    image.onload = () => finish((image.naturalWidth || image.width || 0) > 0);
    image.onerror = () => finish(false);
    image.src = source;
    if (typeof image.decode === 'function') {
      void image.decode().then(() => finish(true), () => finish(false));
    }
  });
}

function getRootCacheKey(
  rootRef: OptimizedImageBrowserRoot | null | undefined
): object | null {
  return rootRef && typeof rootRef === 'object' ? rootRef : null;
}

async function loadOptimizedImage(
  rootRef: OptimizedImageBrowserRoot | null | undefined,
  optimizedPath: string,
  options: OptimizedImageResolveOptions
): Promise<string | null> {
  const ImageClass = getImageConstructor(rootRef);
  if (!ImageClass) return null;
  if (options.strictMime === false) {
    return (await waitForImage(new ImageClass(), optimizedPath)) ? optimizedPath : null;
  }
  const fetcher = rootRef && typeof rootRef.fetch === 'function'
    ? rootRef.fetch.bind(rootRef)
    : null;
  const UrlClass = rootRef?.URL;
  if (
    !fetcher
    || !UrlClass
    || typeof UrlClass.createObjectURL !== 'function'
    || typeof UrlClass.revokeObjectURL !== 'function'
  ) {
    return (await waitForImage(new ImageClass(), optimizedPath)) ? optimizedPath : null;
  }
  try {
    const response = await fetcher(optimizedPath, {
      credentials: 'same-origin',
      cache: 'default'
    });
    const contentType = String(response.headers.get('content-type') || '')
      .split(';', 1)[0]
      .trim()
      .toLowerCase();
    if (!response.ok || contentType !== 'image/webp') return null;
    const blob = await response.blob();
    if (blob.type && blob.type.toLowerCase() !== 'image/webp') return null;
    const objectUrl = UrlClass.createObjectURL(blob);
    if (await waitForImage(new ImageClass(), objectUrl)) return objectUrl;
    UrlClass.revokeObjectURL(objectUrl);
    return null;
  } catch (_error) {
    return null;
  }
}

function loadOptimizedImageOnce(
  rootRef: OptimizedImageBrowserRoot | null | undefined,
  optimizedPath: string,
  options: OptimizedImageResolveOptions
): Promise<string | null> {
  const rootKey = getRootCacheKey(rootRef);
  if (!rootKey) return loadOptimizedImage(rootRef, optimizedPath, options);
  let loads = documentAssetLoads.get(rootKey);
  if (!loads) {
    loads = new Map<string, Promise<string | null>>();
    documentAssetLoads.set(rootKey, loads);
  }
  const cacheKey = `${options.strictMime === false ? 'direct' : 'strict'}:${optimizedPath}`;
  let pending = loads.get(cacheKey);
  if (!pending) {
    pending = loadOptimizedImage(rootRef, optimizedPath, options);
    loads.set(cacheKey, pending);
  }
  return pending;
}

export function supportsWebp(
  rootRef?: OptimizedImageBrowserRoot | null
): Promise<boolean> {
  if (webpSupportPromise) return webpSupportPromise;
  const ImageClass = getImageConstructor(rootRef);
  if (!ImageClass) return Promise.resolve(false);
  webpSupportPromise = waitForImage(new ImageClass(), WEBP_PROBE);
  return webpSupportPromise;
}

export function getOptimizedImagePath(
  sourcePath: string,
  mapping: OptimizedImageMapping
): string | null {
  const normalized = String(sourcePath || '').trim();
  if (!normalized) return null;
  return mapping[normalized] || null;
}

export async function resolveOptimizedImagePath(
  rootRef: OptimizedImageBrowserRoot | null | undefined,
  sourcePath: string,
  mapping: OptimizedImageMapping,
  options: OptimizedImageResolveOptions = {}
): Promise<string> {
  const fallbackPath = String(sourcePath || '').trim();
  const optimizedPath = getOptimizedImagePath(fallbackPath, mapping);
  if (!optimizedPath || !(await supportsWebp(rootRef))) return fallbackPath;
  return (await loadOptimizedImageOnce(rootRef, optimizedPath, options)) || fallbackPath;
}

export function toCssUrl(sourcePath: string): string {
  return `url("${String(sourcePath || '').replace(/"/g, '\\"')}")`;
}

export function applyOptimizedImageWithFallback(
  rootRef: OptimizedImageBrowserRoot | null | undefined,
  style: CSSStyleDeclaration,
  propertyName: string,
  sourcePath: string,
  mapping: OptimizedImageMapping,
  options: OptimizedImageResolveOptions = {}
): void {
  const fallbackCss = toCssUrl(sourcePath);
  const initialValue = typeof style.getPropertyValue === 'function'
    ? style.getPropertyValue(propertyName)
    : '';
  if (!getOptimizedImagePath(sourcePath, mapping)) {
    style.setProperty(propertyName, fallbackCss);
    return;
  }
  let propertyRequests = pendingStyleRequests.get(style as unknown as object);
  if (!propertyRequests) {
    propertyRequests = new Map<string, symbol>();
    pendingStyleRequests.set(style as unknown as object, propertyRequests);
  }
  const requestToken = Symbol(propertyName);
  propertyRequests.set(propertyName, requestToken);
  void resolveOptimizedImagePath(rootRef, sourcePath, mapping, options).then((resolvedPath) => {
    if (propertyRequests?.get(propertyName) !== requestToken) return;
    const currentValue = typeof style.getPropertyValue === 'function'
      ? style.getPropertyValue(propertyName)
      : initialValue;
    if (currentValue !== initialValue) return;
    style.setProperty(propertyName, toCssUrl(resolvedPath));
    propertyRequests?.delete(propertyName);
  });
}

export function resetOptimizedImageCodecForTests(): void {
  webpSupportPromise = null;
  pendingStyleRequests = new WeakMap<object, Map<string, symbol>>();
  documentAssetLoads = new WeakMap<object, Map<string, Promise<string | null>>>();
}
