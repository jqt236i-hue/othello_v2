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
