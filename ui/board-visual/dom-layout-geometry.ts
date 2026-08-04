import type { BoardAppearanceDescriptor } from './types';

export type BoardFrameLayoutGeometry = Readonly<{
  clientOrigin: Readonly<{ x: number; y: number }>;
  frameInset: Readonly<{ top: number; right: number; bottom: number; left: number }>;
}>;

type CachedFrameInset = Readonly<{
  signature: string;
  value: BoardFrameLayoutGeometry['frameInset'];
}>;

const frameInsetCache = new WeakMap<object, CachedFrameInset>();

function styleValue(element: any, property: string): string {
  try {
    return String(element && element.style && element.style.getPropertyValue(property) || '');
  } catch (_error) {
    return '';
  }
}

function stageScaleForDocument(doc: any): number {
  const parsed = Number.parseFloat(styleValue(doc && doc.documentElement, '--layout-stage-scale'));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
}

function paddingDescriptor(appearance: BoardAppearanceDescriptor | null | undefined): readonly number[] {
  const descriptor = appearance && appearance.boardFrameLayout || {};
  return ['paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft'].map((field) => {
    const value = Number(descriptor[field]);
    return Number.isFinite(value) ? value : Number.NaN;
  });
}

function createFrameInsetSignature(
  frame: any,
  appearance: BoardAppearanceDescriptor | null | undefined,
  invalidationRevision: number
): string {
  const doc = frame && frame.ownerDocument;
  const root = doc && doc.documentElement;
  const view = doc && doc.defaultView;
  const visualViewport = view && view.visualViewport;
  const properties = [
    '--board-frame-padding-top',
    '--board-frame-padding-right',
    '--board-frame-padding-bottom',
    '--board-frame-padding-left'
  ];
  return JSON.stringify([
    Number(invalidationRevision) || 0,
    String(frame && frame.className || ''),
    String(root && root.className || ''),
    String(frame && frame.getAttribute && frame.getAttribute('data-board-frame-skin-id') || ''),
    String(root && root.getAttribute && root.getAttribute('data-board-frame-skin-id') || ''),
    stageScaleForDocument(doc),
    ...paddingDescriptor(appearance),
    ...properties.map((property) => styleValue(frame, property)),
    ...properties.map((property) => styleValue(root, property)),
    Number(view && view.innerWidth) || 0,
    Number(view && view.innerHeight) || 0,
    Number(view && view.devicePixelRatio) || 1,
    Number(visualViewport && visualViewport.width) || 0,
    Number(visualViewport && visualViewport.height) || 0,
    Number(visualViewport && visualViewport.scale) || 1
  ]);
}

function readFrameInset(
  frame: any,
  appearance: BoardAppearanceDescriptor | null | undefined,
  signature: string
): BoardFrameLayoutGeometry['frameInset'] {
  const cached = frameInsetCache.get(frame);
  if (cached && cached.signature === signature) return cached.value;

  const doc = frame && frame.ownerDocument;
  const view = doc && doc.defaultView;
  let computed: any = null;
  try {
    computed = view && typeof view.getComputedStyle === 'function'
      ? view.getComputedStyle(frame)
      : null;
  } catch (_error) {
    computed = null;
  }
  const descriptor = appearance && appearance.boardFrameLayout || {};
  const stageScale = stageScaleForDocument(doc);
  const inset = (cssField: string, descriptorField: string) => {
    const cssValue = Number.parseFloat(String(computed && computed[cssField] || ''));
    if (Number.isFinite(cssValue)) return cssValue;
    const descriptorValue = Number(descriptor[descriptorField]);
    return Number.isFinite(descriptorValue) ? descriptorValue * stageScale : 0;
  };
  const value = Object.freeze({
    top: inset('paddingTop', 'paddingTop'),
    right: inset('paddingRight', 'paddingRight'),
    bottom: inset('paddingBottom', 'paddingBottom'),
    left: inset('paddingLeft', 'paddingLeft')
  });
  frameInsetCache.set(frame, Object.freeze({ signature, value }));
  return value;
}

/**
 * Reads the live frame origin on every call while retaining padding metrics
 * until an observable CSS, skin, viewport, or sizing boundary changes.
 */
export function readBoardFrameGeometryForLayout(
  host: any,
  appearance: BoardAppearanceDescriptor | null | undefined,
  invalidationRevision = 0
): BoardFrameLayoutGeometry {
  const frame = host && typeof host.closest === 'function' ? host.closest('#board-frame') : null;
  if (!frame || typeof frame.getBoundingClientRect !== 'function') {
    const fallbackRect = host && typeof host.getBoundingClientRect === 'function'
      ? host.getBoundingClientRect()
      : { left: 0, top: 0 };
    return Object.freeze({
      clientOrigin: Object.freeze({
        x: Number(fallbackRect.left) || 0,
        y: Number(fallbackRect.top) || 0
      }),
      frameInset: Object.freeze({ top: 0, right: 0, bottom: 0, left: 0 })
    });
  }

  const frameRect = frame.getBoundingClientRect();
  const signature = createFrameInsetSignature(frame, appearance, invalidationRevision);
  return Object.freeze({
    clientOrigin: Object.freeze({
      x: Number(frameRect.left) || 0,
      y: Number(frameRect.top) || 0
    }),
    frameInset: readFrameInset(frame, appearance, signature)
  });
}
