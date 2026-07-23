export const UX_OPTIMIZATION_BROWSER_PROBE_GLOBAL =
  '__CARD_REVERSI_UX_OPTIMIZATION_PROBE__';

export interface UxOptimizationBrowserProbeSnapshot {
  readonly timeOrigin: number;
  readonly capturedAtMs: number;
  readonly phases: readonly Readonly<{ name: string; atMs: number }>[];
  readonly resources: readonly Readonly<{
    path: string;
    initiatorType: string;
    startMs: number;
    endMs: number;
    transferSize: number;
    encodedBodySize: number;
    decodedBodySize: number;
  }>[];
  readonly longTasks: readonly Readonly<{ startMs: number; durationMs: number }>[];
  readonly rafIntervalsMs: readonly number[];
  readonly imageConstructorCount: number;
  readonly imageConstructorAssignments: readonly string[];
  readonly logicalImageSrcMutations: readonly Readonly<{
    logicalPath: string;
    sourcePath: string;
  }>[];
  readonly cls: number;
  readonly visibility: string;
  readonly focused: boolean;
  readonly capabilities: Readonly<{
    longTask: boolean;
    layoutShift: boolean;
    resourceTiming: boolean;
  }>;
}

/**
 * This function is serialized by Playwright and installed before application
 * code. Keep it closure-free and do not read gameplay state.
 */
export function installUxOptimizationBrowserProbe(): void {
  const root = window as any;
  const key = '__CARD_REVERSI_UX_OPTIMIZATION_PROBE__';
  if (root[key]) return;

  const phases: Array<{ name: string; atMs: number }> = [{
    name: 'navigation',
    atMs: 0
  }];
  const longTasks: Array<{ startMs: number; durationMs: number }> = [];
  const rafIntervalsMs: number[] = [];
  let cls = 0;
  let lastRafMs: number | null = null;
  let rafId = 0;
  let disposed = false;
  const observers: PerformanceObserver[] = [];
  let imageConstructorCount = 0;
  const imageConstructorAssignments: string[] = [];
  const logicalImageSrcMutations: Array<{ logicalPath: string; sourcePath: string }> = [];

  const markPhase = (name: unknown): void => {
    const normalized = String(name || '').trim();
    if (!normalized) return;
    const atMs = performance.now();
    const previous = phases[phases.length - 1];
    if (previous && previous.name === normalized) return;
    phases.push({ name: normalized, atMs });
  };

  const tick = (atMs: number): void => {
    if (disposed) return;
    if (lastRafMs !== null && rafIntervalsMs.length < 4096) {
      rafIntervalsMs.push(Math.max(0, atMs - lastRafMs));
    }
    lastRafMs = atMs;
    rafId = requestAnimationFrame(tick);
  };
  rafId = requestAnimationFrame(tick);

  if (typeof PerformanceObserver === 'function') {
    try {
      const observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          longTasks.push({
            startMs: Number(entry.startTime),
            durationMs: Number(entry.duration)
          });
        }
      });
      observer.observe({ type: 'longtask', buffered: true } as PerformanceObserverInit);
      observers.push(observer);
    } catch (_error) {
      // Capability is reported by snapshot(); absence is never converted to pass.
    }
    try {
      const observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries() as any[]) {
          if (entry.hadRecentInput !== true) cls += Number(entry.value) || 0;
        }
      });
      observer.observe({ type: 'layout-shift', buffered: true } as PerformanceObserverInit);
      observers.push(observer);
    } catch (_error) {
      // Capability is reported by snapshot(); absence is never converted to pass.
    }
  }

  const resourcePath = (name: string): string => {
    try {
      const url = new URL(name, location.href);
      if (url.protocol !== location.protocol || url.origin !== location.origin) return '';
      return url.pathname.replace(/^\/+/, '');
    } catch (_error) {
      return '';
    }
  };

  const nativeImageConstructor = root.Image;
  const nativeImageSourceDescriptor = typeof root.HTMLImageElement === 'function'
    ? Object.getOwnPropertyDescriptor(root.HTMLImageElement.prototype, 'src')
    : null;
  const nativeSetAttribute = root.Element?.prototype?.setAttribute;
  let installedImageConstructor: any = null;
  let installedImageSourceSetter: ((this: HTMLImageElement, value: string) => void) | null = null;
  let installedSetAttribute: ((this: Element, qualifiedName: string, value: string) => void) | null = null;
  const generatedImages = new WeakSet<object>();
  const recordSourceAssignment = (element: any, source: unknown): void => {
    const sourcePath = resourcePath(String(source || ''));
    if (!sourcePath) return;
    if (generatedImages.has(element)) {
      if (imageConstructorAssignments.length < 512) {
        imageConstructorAssignments.push(sourcePath);
      }
      return;
    }
    const logicalPath = String(
      element?.getAttribute?.('data-card-reversi-logical-src') || ''
    ).trim();
    if (logicalPath && logicalImageSrcMutations.length < 512) {
      logicalImageSrcMutations.push({ logicalPath, sourcePath });
    }
  };
  if (typeof nativeImageConstructor === 'function') {
    const ProbeImage = function Image(width?: number, height?: number): HTMLImageElement {
      const image = width === undefined
        ? new nativeImageConstructor()
        : new nativeImageConstructor(width, height);
      imageConstructorCount += 1;
      generatedImages.add(image);
      return image;
    };
    ProbeImage.prototype = nativeImageConstructor.prototype;
    Object.setPrototypeOf(ProbeImage, nativeImageConstructor);
    installedImageConstructor = ProbeImage;
    root.Image = ProbeImage;
  }
  if (nativeImageSourceDescriptor?.get && nativeImageSourceDescriptor?.set) {
    installedImageSourceSetter = function setImageSource(
      this: HTMLImageElement,
      value: string
    ): void {
      recordSourceAssignment(this, value);
      nativeImageSourceDescriptor.set!.call(this, value);
    };
    Object.defineProperty(root.HTMLImageElement.prototype, 'src', {
      configurable: nativeImageSourceDescriptor.configurable,
      enumerable: nativeImageSourceDescriptor.enumerable,
      get: nativeImageSourceDescriptor.get,
      set: installedImageSourceSetter
    });
  }
  if (typeof nativeSetAttribute === 'function') {
    installedSetAttribute = function setAttribute(
      this: Element,
      qualifiedName: string,
      value: string
    ): void {
      if (
        String(qualifiedName || '').toLowerCase() === 'src'
        && typeof root.HTMLImageElement === 'function'
        && this instanceof root.HTMLImageElement
      ) {
        recordSourceAssignment(this, value);
      }
      nativeSetAttribute.call(this, qualifiedName, value);
    };
    root.Element.prototype.setAttribute = installedSetAttribute;
  }

  const snapshot = (): UxOptimizationBrowserProbeSnapshot => {
    const supportedEntryTypes = typeof PerformanceObserver === 'function'
      ? (PerformanceObserver.supportedEntryTypes || [])
      : [];
    const resources = typeof performance.getEntriesByType === 'function'
      ? (performance.getEntriesByType('resource') as PerformanceResourceTiming[])
        .map((entry) => ({
          path: resourcePath(entry.name),
          initiatorType: String(entry.initiatorType || ''),
          startMs: Number(entry.startTime),
          endMs: Number(entry.responseEnd),
          transferSize: Number(entry.transferSize) || 0,
          encodedBodySize: Number(entry.encodedBodySize) || 0,
          decodedBodySize: Number(entry.decodedBodySize) || 0
        }))
        .filter((entry) => !!entry.path)
      : [];
    return Object.freeze({
      timeOrigin: Number(performance.timeOrigin),
      capturedAtMs: Number(performance.now()),
      phases: Object.freeze(phases.map((entry) => Object.freeze({ ...entry }))),
      resources: Object.freeze(resources.map((entry) => Object.freeze(entry))),
      longTasks: Object.freeze(longTasks.map((entry) => Object.freeze({ ...entry }))),
      rafIntervalsMs: Object.freeze(rafIntervalsMs.slice()),
      imageConstructorCount,
      imageConstructorAssignments: Object.freeze(imageConstructorAssignments.slice()),
      logicalImageSrcMutations: Object.freeze(logicalImageSrcMutations.map(
        (entry) => Object.freeze({ ...entry })
      )),
      cls,
      visibility: String(document.visibilityState || ''),
      focused: typeof document.hasFocus === 'function' ? document.hasFocus() : false,
      capabilities: Object.freeze({
        longTask: supportedEntryTypes.includes('longtask'),
        layoutShift: supportedEntryTypes.includes('layout-shift'),
        resourceTiming: typeof performance.getEntriesByType === 'function'
      })
    });
  };

  const dispose = (): void => {
    disposed = true;
    if (rafId) cancelAnimationFrame(rafId);
    observers.forEach((observer) => observer.disconnect());
    if (installedImageConstructor && root.Image === installedImageConstructor) {
      root.Image = nativeImageConstructor;
    }
    const activeImageSourceDescriptor = typeof root.HTMLImageElement === 'function'
      ? Object.getOwnPropertyDescriptor(root.HTMLImageElement.prototype, 'src')
      : null;
    if (
      nativeImageSourceDescriptor
      && installedImageSourceSetter
      && activeImageSourceDescriptor?.set === installedImageSourceSetter
    ) {
      Object.defineProperty(
        root.HTMLImageElement.prototype,
        'src',
        nativeImageSourceDescriptor
      );
    }
    if (
      typeof nativeSetAttribute === 'function'
      && installedSetAttribute
      && root.Element?.prototype?.setAttribute === installedSetAttribute
    ) {
      root.Element.prototype.setAttribute = nativeSetAttribute;
    }
  };

  Object.defineProperty(root, key, {
    configurable: true,
    enumerable: false,
    writable: false,
    value: Object.freeze({ markPhase, snapshot, dispose })
  });
}

export function normalizeBrowserProbeSnapshot(
  value: unknown
): UxOptimizationBrowserProbeSnapshot {
  const raw = value && typeof value === 'object'
    ? value as Record<string, any>
    : {};
  const phases = Array.isArray(raw.phases)
    ? raw.phases
      .map((entry: any) => ({
        name: String(entry?.name || ''),
        atMs: Number(entry?.atMs)
      }))
      .filter((entry: any) => entry.name && Number.isFinite(entry.atMs))
    : [];
  const resources = Array.isArray(raw.resources)
    ? raw.resources
      .map((entry: any) => ({
        path: String(entry?.path || ''),
        initiatorType: String(entry?.initiatorType || ''),
        startMs: Number(entry?.startMs),
        endMs: Number(entry?.endMs),
        transferSize: Number(entry?.transferSize) || 0,
        encodedBodySize: Number(entry?.encodedBodySize) || 0,
        decodedBodySize: Number(entry?.decodedBodySize) || 0
      }))
      .filter((entry: any) => entry.path
        && Number.isFinite(entry.startMs)
        && Number.isFinite(entry.endMs))
    : [];
  return Object.freeze({
    timeOrigin: Number(raw.timeOrigin) || 0,
    capturedAtMs: Number(raw.capturedAtMs) || 0,
    phases: Object.freeze(phases.map((entry: any) => Object.freeze(entry))),
    resources: Object.freeze(resources.map((entry: any) => Object.freeze(entry))),
    longTasks: Object.freeze((Array.isArray(raw.longTasks) ? raw.longTasks : [])
      .map((entry: any) => Object.freeze({
        startMs: Number(entry?.startMs) || 0,
        durationMs: Number(entry?.durationMs) || 0
      }))),
    rafIntervalsMs: Object.freeze((Array.isArray(raw.rafIntervalsMs) ? raw.rafIntervalsMs : [])
      .map(Number)
      .filter(Number.isFinite)),
    imageConstructorCount: Math.max(0, Number(raw.imageConstructorCount) || 0),
    imageConstructorAssignments: Object.freeze((
      Array.isArray(raw.imageConstructorAssignments) ? raw.imageConstructorAssignments : []
    ).filter((entry: unknown) => entry != null && String(entry)).map(String)),
    logicalImageSrcMutations: Object.freeze((
      Array.isArray(raw.logicalImageSrcMutations) ? raw.logicalImageSrcMutations : []
    ).map((entry: any) => Object.freeze({
      logicalPath: String(entry?.logicalPath || ''),
      sourcePath: String(entry?.sourcePath || '')
    })).filter((entry: any) => entry.logicalPath && entry.sourcePath)),
    cls: Number(raw.cls) || 0,
    visibility: String(raw.visibility || ''),
    focused: raw.focused === true,
    capabilities: Object.freeze({
      longTask: raw.capabilities?.longTask === true,
      layoutShift: raw.capabilities?.layoutShift === true,
      resourceTiming: raw.capabilities?.resourceTiming === true
    })
  });
}
