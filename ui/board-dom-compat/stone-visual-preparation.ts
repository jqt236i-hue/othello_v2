declare const __non_webpack_require__: NodeRequire | undefined;
const _require: NodeRequire = typeof __non_webpack_require__ !== 'undefined' ? __non_webpack_require__ : require;
const SharedVisualEffectsMap = _require('../../game/visual-effects-map');

interface DomCompatibilityStoneVisualFailure {
  readonly src: string;
  readonly reason: string;
}

interface DomCompatibilityStoneVisualPreparationResult {
  readonly success: boolean;
  readonly loaded: readonly string[];
  readonly failed: readonly DomCompatibilityStoneVisualFailure[];
}

interface DomCompatibilityStoneVisualPreparationOptions {
  readonly effectKeys?: readonly string[];
  readonly timeoutMs?: number;
  readonly ImageCtor?: new () => HTMLImageElement;
}

interface PathPreparationResult {
  readonly success: boolean;
  readonly src: string;
  readonly reason?: string;
}

const preparationByDocument = new WeakMap<Document, Map<string, Promise<PathPreparationResult>>>();

function resolveRequestedPaths(
  documentRef: Document,
  effectKeys?: readonly string[]
): readonly string[] {
  const keys = effectKeys || (
    typeof SharedVisualEffectsMap.getSupportedEffectKeys === 'function'
      ? SharedVisualEffectsMap.getSupportedEffectKeys()
      : []
  );
  const paths = new Set<string>();
  for (const rawKey of keys) {
    const key = String(rawKey || '').trim();
    if (!key || key === 'normal') continue;
    const effect = SharedVisualEffectsMap.STONE_VISUAL_EFFECTS?.[key];
    const effectPaths = typeof SharedVisualEffectsMap.collectEffectImagePaths === 'function'
      ? SharedVisualEffectsMap.collectEffectImagePaths(effect)
      : [];
    for (const rawPath of effectPaths) {
      const path = String(rawPath || '').trim();
      if (!path) continue;
      try {
        paths.add(new URL(path, documentRef.baseURI).href);
      } catch (_error) {
        paths.add(path);
      }
    }
  }
  return Object.freeze(Array.from(paths).sort());
}

function createPathPreparation(
  src: string,
  ImageCtor: new () => HTMLImageElement,
  timeoutMs: number
): Promise<PathPreparationResult> {
  return new Promise((resolve) => {
    let settled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let image: HTMLImageElement | null = null;
    const finish = (success: boolean, reason?: string) => {
      if (settled) return;
      settled = true;
      if (timer) clearTimeout(timer);
      if (image) {
        image.onload = null;
        image.onerror = null;
      }
      resolve(Object.freeze({
        success,
        src,
        ...(reason ? { reason } : {})
      }));
    };

    try {
      image = new ImageCtor();
      try { image.decoding = 'async'; } catch (_error) { /* optional hint */ }
      image.onload = () => {
        const decode = image && typeof image.decode === 'function'
          ? image.decode.bind(image)
          : null;
        if (!decode) {
          finish(true);
          return;
        }
        Promise.resolve(decode()).then(
          () => finish(true),
          (error) => finish(false, `decode failed: ${String(error && error.message || error || 'unknown error')}`)
        );
      };
      image.onerror = () => finish(false, 'load failed');
      timer = setTimeout(() => finish(false, `timed out after ${timeoutMs}ms`), timeoutMs);
      image.src = src;
    } catch (error) {
      finish(false, `load setup failed: ${String(error && (error as Error).message || error || 'unknown error')}`);
    }
  });
}

async function prepareDomCompatibilityStoneVisuals(
  documentRef: Document,
  options: DomCompatibilityStoneVisualPreparationOptions = {}
): Promise<DomCompatibilityStoneVisualPreparationResult> {
  if (!documentRef) throw new TypeError('DOM compatibility stone preparation requires a Document');
  const ImageCtor = options.ImageCtor || documentRef.defaultView?.Image;
  const requestedPaths = resolveRequestedPaths(documentRef, options.effectKeys);
  if (!requestedPaths.length) {
    return Object.freeze({ success: true, loaded: Object.freeze([]), failed: Object.freeze([]) });
  }
  if (typeof ImageCtor !== 'function') {
    return Object.freeze({
      success: false,
      loaded: Object.freeze([]),
      failed: Object.freeze(requestedPaths.map((src) => Object.freeze({
        src,
        reason: 'Image constructor is unavailable'
      })))
    });
  }

  const timeoutMs = Math.max(250, Math.min(30000, Math.trunc(Number(options.timeoutMs) || 8000)));
  let cache = preparationByDocument.get(documentRef);
  if (!cache) {
    cache = new Map();
    preparationByDocument.set(documentRef, cache);
  }
  const promises = requestedPaths.map((src) => {
    const existing = cache!.get(src);
    if (existing) return existing;
    const preparation = createPathPreparation(src, ImageCtor, timeoutMs);
    cache!.set(src, preparation);
    preparation.then((result) => {
      if (!result.success && cache!.get(src) === preparation) cache!.delete(src);
    });
    return preparation;
  });
  const results = await Promise.all(promises);
  const loaded = Object.freeze(results.filter((result) => result.success).map((result) => result.src));
  const failed = Object.freeze(results.filter((result) => !result.success).map((result) => Object.freeze({
    src: result.src,
    reason: result.reason || 'unknown failure'
  })));
  return Object.freeze({
    success: failed.length === 0,
    loaded,
    failed
  });
}

function resetDomCompatibilityStoneVisualPreparationForTest(documentRef: Document): void {
  preparationByDocument.delete(documentRef);
}

export = {
  prepareDomCompatibilityStoneVisuals,
  resetDomCompatibilityStoneVisualPreparationForTest
};
