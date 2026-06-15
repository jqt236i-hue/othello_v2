type RectSnapshot = {
  left: number;
  top: number;
  width: number;
  height: number;
  right: number;
  bottom: number;
};

function toFiniteNumber(value: any, fallback: number): number {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function snapshotRect(rect: any): RectSnapshot {
  const left = toFiniteNumber(rect && rect.left, 0);
  const top = toFiniteNumber(rect && rect.top, 0);
  const width = toFiniteNumber(rect && rect.width, 0);
  const height = toFiniteNumber(rect && rect.height, 0);
  const right = toFiniteNumber(rect && rect.right, left + width);
  const bottom = toFiniteNumber(rect && rect.bottom, top + height);
  return { left, top, width, height, right, bottom };
}

function cloneRect(rect: RectSnapshot): RectSnapshot {
  return {
    left: rect.left,
    top: rect.top,
    width: rect.width,
    height: rect.height,
    right: rect.right,
    bottom: rect.bottom
  };
}

function createLayoutReadBatch() {
  let rectCache = new WeakMap<object, RectSnapshot>();
  return {
    readRect(element: any): RectSnapshot | null {
      if (!element || typeof element.getBoundingClientRect !== 'function') return null;
      if (!rectCache.has(element)) {
        rectCache.set(element, snapshotRect(element.getBoundingClientRect()));
      }
      const cached = rectCache.get(element);
      return cached ? cloneRect(cached) : null;
    },
    clear() {
      rectCache = new WeakMap<object, RectSnapshot>();
      return true;
    }
  };
}

const LayoutReadBatch = {
  createLayoutReadBatch,
  snapshotRect
};

try {
  if (typeof globalThis !== 'undefined' && globalThis) {
    (globalThis as any).LayoutReadBatch = (globalThis as any).LayoutReadBatch || LayoutReadBatch;
  }
} catch (e) { /* ignore */ }

export = LayoutReadBatch;
