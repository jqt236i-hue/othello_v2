import { OPTIMIZED_BACKGROUND_IMAGES } from './optimized-backgrounds.generated';

type ImageConstructor = new () => HTMLImageElement;
type BrowserRoot = Window & { Image?: ImageConstructor };

const WEBP_PROBE = 'data:image/webp;base64,UklGRhoAAABXRUJQVlA4TA4AAAAvAAAAAAcQEf0PRET/Aw==';
let webpSupportPromise: Promise<boolean> | null = null;
let pendingStyleRequests = new WeakMap<object, Map<string, symbol>>();

function getImageConstructor(rootRef: BrowserRoot | null | undefined): ImageConstructor | null {
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

export function supportsWebp(rootRef?: BrowserRoot | null): Promise<boolean> {
  if (webpSupportPromise) return webpSupportPromise;
  const ImageClass = getImageConstructor(rootRef);
  if (!ImageClass) return Promise.resolve(false);
  webpSupportPromise = waitForImage(new ImageClass(), WEBP_PROBE);
  return webpSupportPromise;
}

export function getOptimizedBackgroundPath(sourcePath: string): string | null {
  const normalized = String(sourcePath || '').trim();
  if (!normalized) return null;
  return (OPTIMIZED_BACKGROUND_IMAGES as Readonly<Record<string, string>>)[normalized] || null;
}

export async function resolveBackgroundImagePath(
  rootRef: BrowserRoot | null | undefined,
  sourcePath: string
): Promise<string> {
  const fallbackPath = String(sourcePath || '').trim();
  const optimizedPath = getOptimizedBackgroundPath(fallbackPath);
  if (!optimizedPath || !(await supportsWebp(rootRef))) return fallbackPath;
  const ImageClass = getImageConstructor(rootRef);
  if (!ImageClass) return fallbackPath;
  return (await waitForImage(new ImageClass(), optimizedPath)) ? optimizedPath : fallbackPath;
}

export function toCssUrl(sourcePath: string): string {
  return `url("${String(sourcePath || '').replace(/"/g, '\\"')}")`;
}

export function applyBackgroundImageWithFallback(
  rootRef: BrowserRoot | null | undefined,
  style: CSSStyleDeclaration,
  propertyName: string,
  sourcePath: string
): void {
  const fallbackCss = toCssUrl(sourcePath);
  const initialValue = typeof style.getPropertyValue === 'function'
    ? style.getPropertyValue(propertyName)
    : '';
  const optimizedPath = getOptimizedBackgroundPath(sourcePath);
  if (!optimizedPath) {
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
  void resolveBackgroundImagePath(rootRef, sourcePath).then((resolvedPath) => {
    if (propertyRequests?.get(propertyName) !== requestToken) return;
    const currentValue = typeof style.getPropertyValue === 'function'
      ? style.getPropertyValue(propertyName)
      : initialValue;
    if (currentValue !== initialValue) return;
    style.setProperty(propertyName, toCssUrl(resolvedPath));
    propertyRequests?.delete(propertyName);
  });
}

export function resetBackgroundImageCodecForTests(): void {
  webpSupportPromise = null;
  pendingStyleRequests = new WeakMap<object, Map<string, symbol>>();
}
