import { OPTIMIZED_BACKGROUND_IMAGES } from './optimized-backgrounds.generated';
import {
  applyOptimizedImageWithFallback,
  getOptimizedImagePath,
  OptimizedImageBrowserRoot,
  resetOptimizedImageCodecForTests,
  resolveOptimizedImagePath,
  supportsWebp,
  toCssUrl
} from './optimized-image-codec';

type BrowserRoot = Window & OptimizedImageBrowserRoot;

export { supportsWebp, toCssUrl };

export function getOptimizedBackgroundPath(sourcePath: string): string | null {
  return getOptimizedImagePath(sourcePath, OPTIMIZED_BACKGROUND_IMAGES);
}

export async function resolveBackgroundImagePath(
  rootRef: BrowserRoot | null | undefined,
  sourcePath: string
): Promise<string> {
  return resolveOptimizedImagePath(
    rootRef,
    sourcePath,
    OPTIMIZED_BACKGROUND_IMAGES,
    { strictMime: false }
  );
}

export function applyBackgroundImageWithFallback(
  rootRef: BrowserRoot | null | undefined,
  style: CSSStyleDeclaration,
  propertyName: string,
  sourcePath: string
): void {
  applyOptimizedImageWithFallback(
    rootRef,
    style,
    propertyName,
    sourcePath,
    OPTIMIZED_BACKGROUND_IMAGES,
    { strictMime: false }
  );
}

export function resetBackgroundImageCodecForTests(): void {
  resetOptimizedImageCodecForTests();
}
