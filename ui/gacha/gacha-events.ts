/**
 * @file gacha-events.ts
 * @description Gacha event dispatching utilities
 */

declare const __non_webpack_require__: NodeRequire | undefined;

const _require: NodeRequire = (typeof __non_webpack_require__ !== 'undefined')
  ? __non_webpack_require__
  : require;

const GACHA_INVENTORY_UPDATED_EVENT = 'gacha:inventory-updated';

interface GachaInventoryDetail {
  pulls: unknown[];
  newlyUnlockedIds: string[];
  alreadyOwnedIds: string[];
  state: Record<string, unknown> | null;
}

function resolveDocument(rootRef: Window): Document | null {
  if (rootRef && rootRef.document) return rootRef.document;
  if (typeof document !== 'undefined') return document;
  return null;
}

function normalizeIdList(value: unknown[]): string[] {
  return Array.isArray(value)
    ? value.map((entry) => String(entry || '').trim()).filter(Boolean)
    : [];
}

function buildGachaInventoryUpdatedDetail(detail: unknown): GachaInventoryDetail {
  const source = (detail && typeof detail === 'object') ? detail as Record<string, unknown> : {};
  return {
    pulls: Array.isArray(source.pulls) ? source.pulls.filter(Boolean) : [],
    newlyUnlockedIds: normalizeIdList(source.newlyUnlockedIds as unknown[]),
    alreadyOwnedIds: normalizeIdList(source.alreadyOwnedIds as unknown[]),
    state: source.state && typeof source.state === 'object' ? source.state as Record<string, unknown> : null
  };
}

function dispatchGachaInventoryUpdated(rootRef: Window & { dispatchEvent?: (event: Event) => boolean; CustomEvent?: typeof CustomEvent }, detail: unknown): boolean {
  const safeDetail = buildGachaInventoryUpdatedDetail(detail);
  try {
    if (!rootRef || typeof rootRef.dispatchEvent !== 'function') return false;
    if (typeof rootRef.CustomEvent === 'function') {
      rootRef.dispatchEvent(new rootRef.CustomEvent(GACHA_INVENTORY_UPDATED_EVENT, {
        detail: safeDetail
      }));
      return true;
    }
    const docRef = resolveDocument(rootRef);
    if (!docRef || typeof (docRef as Document & { createEvent?: (type: string) => Event }).createEvent !== 'function') return false;
    const event = (docRef as Document & { createEvent: (type: string) => Event }).createEvent('Event');
    (event as Event & { initEvent: (type: string, bubbles: boolean, cancelable: boolean) => void }).initEvent(GACHA_INVENTORY_UPDATED_EVENT, false, false);
    (event as Event & { detail: GachaInventoryDetail }).detail = safeDetail;
    rootRef.dispatchEvent(event);
    return true;
  } catch (e) {
    return false;
  }
}

function addGachaInventoryUpdatedListener(rootRef: Window & { addEventListener?: (type: string, handler: EventListener) => void; removeEventListener?: (type: string, handler: EventListener) => void }, listener: (detail: GachaInventoryDetail) => void): () => void {
  if (!rootRef || typeof rootRef.addEventListener !== 'function' || typeof listener !== 'function') {
    return function () {};
  }
  const handler = function (event: Event) {
    listener(buildGachaInventoryUpdatedDetail((event as Event & { detail?: unknown }).detail));
  };
  rootRef.addEventListener(GACHA_INVENTORY_UPDATED_EVENT, handler as EventListener);
  return function () {
    try {
      if (rootRef.removeEventListener) {
        rootRef.removeEventListener(GACHA_INVENTORY_UPDATED_EVENT, handler as EventListener);
      }
    } catch (e) { /* ignore */ }
  };
}

export = {
  GACHA_INVENTORY_UPDATED_EVENT,
  buildGachaInventoryUpdatedDetail,
  dispatchGachaInventoryUpdated,
  addGachaInventoryUpdatedListener
};
