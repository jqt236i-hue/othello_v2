type PerfCounter = {
  count: number;
  lastMeta?: any;
};

type PerfSpanRecord = {
  id: number;
  name: string;
  startMs: number;
  endMs: number;
  durationMs: number;
  meta?: any;
  endMeta?: any;
};

type ActiveSpanRecord = {
  id: number;
  name: string;
  startMs: number;
  meta?: any;
};

type PerfToken = {
  id: number;
};

type MonitorConfig = {
  enabled?: boolean;
  now?: () => number;
  maxSpans?: number;
};

const DOM_PROBE_INSTALLED_KEY = '__cardReversiPerformanceDomProbeInstalled';
const ELEMENT_PROBE_INSTALLED_KEY = '__cardReversiPerformanceElementProbeInstalled';
const DEFAULT_MAX_SPANS = 1000;

let enabledOverride: boolean | null = null;
let nowProvider: (() => number) | null = null;
let maxSpanRecords = DEFAULT_MAX_SPANS;
let nextSpanId = 1;
let counters: Record<string, PerfCounter> = Object.create(null);
let spans: PerfSpanRecord[] = [];
let activeSpans = new Map<number, ActiveSpanRecord>();

function getRoot(): any {
  const base: any = (typeof globalThis !== 'undefined' ? globalThis : {});
  if (base && base.window && typeof base.window === 'object') return base.window;
  try {
    if (typeof window !== 'undefined' && window) return window;
  } catch (e) { /* ignore */ }
  return base;
}

function getNow(): number {
  if (typeof nowProvider === 'function') {
    const explicitNow = Number(nowProvider());
    if (Number.isFinite(explicitNow)) return explicitNow;
  }
  try {
    const root = getRoot();
    if (root && root.performance && typeof root.performance.now === 'function') {
      const value = Number(root.performance.now());
      if (Number.isFinite(value)) return value;
    }
  } catch (e) { /* ignore */ }
  return Date.now();
}

function cloneMeta(meta: any): any {
  if (meta === null || typeof meta === 'undefined') return undefined;
  if (typeof meta !== 'object') return meta;
  if (Array.isArray(meta)) return meta.slice();
  return Object.assign({}, meta);
}

function hasEnabledQueryFlag(root: any): boolean {
  try {
    const search = String(root && root.location && root.location.search ? root.location.search : '');
    if (!search) return false;
    const params = new URLSearchParams(search);
    const perfValue = String(params.get('perf') || '').toLowerCase();
    const debugValue = String(params.get('debug') || '').toLowerCase();
    const perfEnabled = perfValue === '1' || perfValue === 'true';
    const debugEnabled = debugValue === '1' || debugValue === 'true';
    return perfEnabled && debugEnabled;
  } catch (e) { /* ignore */ }
  return false;
}

function isPerformanceMonitorEnabled(): boolean {
  if (enabledOverride !== null) return enabledOverride === true;
  const root = getRoot();
  try {
    if (root && root.CARD_REVERSI_PERF_MONITOR === true) return true;
    if (root && root.__CARD_REVERSI_PERF_MONITOR__ === true) return true;
  } catch (e) { /* ignore */ }
  return hasEnabledQueryFlag(root);
}

function exposeGlobalsIfEnabled(): void {
  if (!isPerformanceMonitorEnabled()) return;
  const root = getRoot();
  if (!root || typeof root !== 'object') return;
  try {
    root.CardReversiPerformanceMonitor = PerformanceMonitor;
    root.getCardReversiPerformanceSnapshot = getPerformanceSnapshot;
    root.resetCardReversiPerformanceMetrics = resetPerformanceMetrics;
    root.installCardReversiDomPerformanceProbe = installDomPerformanceProbe;
  } catch (e) { /* ignore */ }
}

function configurePerformanceMonitor(options?: MonitorConfig): any {
  const opts = (options && typeof options === 'object') ? options : {};
  if (Object.prototype.hasOwnProperty.call(opts, 'enabled')) {
    enabledOverride = opts.enabled === true;
  }
  if (typeof opts.now === 'function') {
    nowProvider = opts.now;
  }
  const configuredMax = Number(opts.maxSpans);
  if (Number.isFinite(configuredMax) && configuredMax > 0) {
    maxSpanRecords = Math.max(1, Math.trunc(configuredMax));
  }
  exposeGlobalsIfEnabled();
  return getPerformanceSnapshot();
}

function resetPerformanceMetrics(): void {
  counters = Object.create(null);
  spans = [];
  activeSpans = new Map<number, ActiveSpanRecord>();
  nextSpanId = 1;
}

function count(name: string, amount?: number, meta?: any): void {
  if (!isPerformanceMonitorEnabled()) return;
  const key = String(name || '').trim();
  if (!key) return;
  const increment = Number.isFinite(Number(amount)) ? Number(amount) : 1;
  const counter = counters[key] || { count: 0 };
  counter.count += increment;
  if (typeof meta !== 'undefined') {
    counter.lastMeta = cloneMeta(meta);
  }
  counters[key] = counter;
}

function beginSpan(name: string, meta?: any): PerfToken | null {
  if (!isPerformanceMonitorEnabled()) return null;
  const key = String(name || '').trim();
  if (!key) return null;
  const id = nextSpanId++;
  activeSpans.set(id, {
    id,
    name: key,
    startMs: getNow(),
    meta: cloneMeta(meta)
  });
  return { id };
}

function endSpan(token: PerfToken | null | undefined, endMeta?: any): PerfSpanRecord | null {
  if (!token || !Number.isFinite(Number(token.id))) return null;
  const id = Math.trunc(Number(token.id));
  const active = activeSpans.get(id);
  if (!active) return null;
  activeSpans.delete(id);
  const endMs = getNow();
  const record: PerfSpanRecord = {
    id,
    name: active.name,
    startMs: active.startMs,
    endMs,
    durationMs: Math.max(0, endMs - active.startMs)
  };
  if (typeof active.meta !== 'undefined') record.meta = cloneMeta(active.meta);
  if (typeof endMeta !== 'undefined') record.endMeta = cloneMeta(endMeta);
  spans.push(record);
  if (spans.length > maxSpanRecords) {
    spans.splice(0, spans.length - maxSpanRecords);
  }
  return record;
}

function measure<T>(name: string, meta: any, fn: () => T): T {
  const token = beginSpan(name, meta);
  try {
    const result: any = fn();
    if (result && typeof result.then === 'function') {
      return result.then((value: any) => {
        endSpan(token, { completed: true });
        return value;
      }, (error: any) => {
        endSpan(token, { completed: false, error: error && error.message ? String(error.message) : 'error' });
        throw error;
      });
    }
    endSpan(token, { completed: true });
    return result;
  } catch (error: any) {
    endSpan(token, { completed: false, error: error && error.message ? String(error.message) : 'error' });
    throw error;
  }
}

function getPerformanceSnapshot(): any {
  const enabled = isPerformanceMonitorEnabled();
  if (!enabled) {
    return {
      enabled: false,
      counters: {},
      spans: [],
      activeSpans: 0
    };
  }
  const counterSnapshot: Record<string, PerfCounter> = Object.create(null);
  for (const key of Object.keys(counters)) {
    const counter = counters[key];
    counterSnapshot[key] = {
      count: counter.count
    };
    if (typeof counter.lastMeta !== 'undefined') {
      counterSnapshot[key].lastMeta = cloneMeta(counter.lastMeta);
    }
  }
  return {
    enabled: true,
    counters: counterSnapshot,
    spans: spans.map((span) => {
      const copy: PerfSpanRecord = {
        id: span.id,
        name: span.name,
        startMs: span.startMs,
        endMs: span.endMs,
        durationMs: span.durationMs
      };
      if (typeof span.meta !== 'undefined') copy.meta = cloneMeta(span.meta);
      if (typeof span.endMeta !== 'undefined') copy.endMeta = cloneMeta(span.endMeta);
      return copy;
    }),
    activeSpans: activeSpans.size
  };
}

function safeElementLabel(node: any): string {
  try {
    if (!node) return '';
    return String(node.tagName || node.nodeName || '').toLowerCase();
  } catch (e) { /* ignore */ }
  return '';
}

function installDomPerformanceProbe(documentRef?: any): boolean {
  if (!isPerformanceMonitorEnabled()) return false;
  const doc = documentRef || (function () {
    try {
      const root = getRoot();
      return root && root.document ? root.document : null;
    } catch (e) { /* ignore */ }
    return null;
  }());
  if (!doc || typeof doc !== 'object') return false;

  try {
    if (doc[DOM_PROBE_INSTALLED_KEY] !== true) {
      const originalCreateElement = typeof doc.createElement === 'function'
        ? doc.createElement.bind(doc)
        : null;
      const originalCreateElementNS = typeof doc.createElementNS === 'function'
        ? doc.createElementNS.bind(doc)
        : null;
      if (originalCreateElement) {
        doc.createElement = function patchedCreateElement(tagName: any, options?: any) {
          count('dom.createElement', 1, { tagName: String(tagName || '') });
          return originalCreateElement(tagName, options);
        };
      }
      if (originalCreateElementNS) {
        doc.createElementNS = function patchedCreateElementNS(namespaceURI: any, qualifiedName: any, options?: any) {
          count('dom.createElementNS', 1, {
            namespaceURI: String(namespaceURI || ''),
            qualifiedName: String(qualifiedName || '')
          });
          return originalCreateElementNS(namespaceURI, qualifiedName, options);
        };
      }
      doc[DOM_PROBE_INSTALLED_KEY] = true;
    }
  } catch (e) { /* ignore */ }

  try {
    const view = doc.defaultView || getRoot();
    const elementProto = view && view.Element && view.Element.prototype ? view.Element.prototype : null;
    if (elementProto && elementProto[ELEMENT_PROBE_INSTALLED_KEY] !== true) {
      const originalAppendChild = elementProto.appendChild;
      const originalGetBoundingClientRect = elementProto.getBoundingClientRect;
      if (typeof originalAppendChild === 'function') {
        elementProto.appendChild = function patchedAppendChild(child: any) {
          count('dom.appendChild', 1, {
            parent: safeElementLabel(this),
            child: safeElementLabel(child)
          });
          return originalAppendChild.call(this, child);
        };
      }
      if (typeof originalGetBoundingClientRect === 'function') {
        elementProto.getBoundingClientRect = function patchedGetBoundingClientRect() {
          count('layout.getBoundingClientRect', 1, {
            element: safeElementLabel(this)
          });
          return originalGetBoundingClientRect.call(this);
        };
      }
      elementProto[ELEMENT_PROBE_INSTALLED_KEY] = true;
    }
  } catch (e) { /* ignore */ }

  exposeGlobalsIfEnabled();
  return true;
}

function tryAutoInstallDomProbe(): void {
  if (!isPerformanceMonitorEnabled()) return;
  try {
    const root = getRoot();
    if (root && root.document) {
      installDomPerformanceProbe(root.document);
    }
  } catch (e) { /* ignore */ }
}

const PerformanceMonitor = {
  configurePerformanceMonitor,
  isPerformanceMonitorEnabled,
  count,
  beginSpan,
  endSpan,
  measure,
  getPerformanceSnapshot,
  resetPerformanceMetrics,
  installDomPerformanceProbe
};

tryAutoInstallDomProbe();
exposeGlobalsIfEnabled();

export = PerformanceMonitor;
