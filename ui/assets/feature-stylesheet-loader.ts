export type FeatureStylesheetGroup =
  | 'board-dom-compat'
  | 'deck-builder'
  | 'gacha'
  | 'network'
  | 'leaderboard'
  | 'result'
  | 'profile';

export interface FeatureStylesheetLoadResult {
  ok: boolean;
  group: FeatureStylesheetGroup;
  href: string;
  warning?: string;
}

const FEATURE_STYLESHEET_PATHS: Readonly<Record<FeatureStylesheetGroup, string>> = Object.freeze({
  'board-dom-compat': 'styles-board-dom-compat.css',
  'deck-builder': 'styles-feature-deck-builder.css',
  gacha: 'styles-feature-gacha.css',
  network: 'styles-feature-network.css',
  leaderboard: 'styles-leaderboard.css',
  result: 'styles-layout-result.css',
  profile: 'styles-profile.css'
});

interface FeatureStylesheetLoadState {
  promise: Promise<FeatureStylesheetLoadResult>;
  link: HTMLLinkElement;
  settle: (result: FeatureStylesheetLoadResult) => void;
  settled: boolean;
}

const documentLoads =
  new WeakMap<Document, Map<FeatureStylesheetGroup, FeatureStylesheetLoadState>>();

function resolveDocument(docRef?: Document | null): Document | null {
  if (docRef && docRef.head && typeof docRef.createElement === 'function') return docRef;
  try {
    if (typeof document !== 'undefined') return document;
  } catch (e) { /* document is optional in headless runtimes */ }
  return null;
}

function readStartupVersion(documentRef: Document): string {
  try {
    const startupScript = documentRef.querySelector('script[src*="public/module-registry.js"]') as HTMLScriptElement | null;
    if (startupScript) {
      const source = startupScript.getAttribute('src') || startupScript.src;
      const version = new URL(source, documentRef.baseURI).searchParams.get('v');
      if (version) return version;
    }
    const startupMeta = documentRef.querySelector('meta[name="card-reversi-startup-version"]') as HTMLMetaElement | null;
    return startupMeta && startupMeta.content ? startupMeta.content : '';
  } catch (e) {
    return '';
  }
}

export function getFeatureStylesheetHref(group: FeatureStylesheetGroup, docRef?: Document | null): string {
  const relativePath = FEATURE_STYLESHEET_PATHS[group];
  const documentRef = resolveDocument(docRef);
  if (!relativePath || !documentRef) return relativePath || '';
  const slot = documentRef.querySelector(
    `[data-card-reversi-feature-style-slot="${group}"]`
  ) as HTMLElement | null;
  const slotHref = slot?.getAttribute('data-card-reversi-feature-style-href') || '';
  if (slotHref) return new URL(slotHref, documentRef.baseURI).href;
  const url = new URL(relativePath, documentRef.baseURI);
  const version = readStartupVersion(documentRef);
  if (version) url.searchParams.set('v', version);
  return url.href;
}

function warnAndResolve(
  group: FeatureStylesheetGroup,
  href: string,
  warning: string
): FeatureStylesheetLoadResult {
  try {
    if (typeof console !== 'undefined' && typeof console.warn === 'function') {
      console.warn(`[feature-stylesheet] ${warning}`);
    }
  } catch (e) { /* warnings must not block panel fallback */ }
  return { ok: false, group, href, warning };
}

function findFeatureStylesheetInsertionAnchor(
  group: FeatureStylesheetGroup,
  documentRef: Document
): Element | null {
  const slot = documentRef.querySelector(
    `[data-card-reversi-feature-style-slot="${group}"]`
  );
  const beforePath = slot?.getAttribute('data-card-reversi-feature-style-before') || '';
  const afterPath = slot?.getAttribute('data-card-reversi-feature-style-after') || '';
  if (!beforePath && !afterPath) return slot;
  let expectedPathname = '';
  try {
    expectedPathname = new URL(beforePath || afterPath, documentRef.baseURI).pathname;
  } catch (_error) {
    return slot;
  }
  const links = Array.from(documentRef.querySelectorAll('link[rel="stylesheet"][href]'));
  const anchorLink = links.find((candidate) => {
    try {
      return new URL((candidate as HTMLLinkElement).href, documentRef.baseURI).pathname === expectedPathname;
    } catch (_error) {
      return false;
    }
  });
  if (!anchorLink) return slot;
  if (beforePath) return anchorLink;

  // Classic keeps the feature slot after its eager predecessor. Vite keeps
  // slots near the head start and creates eager links afterwards. Preserve the
  // original cascade in both shapes.
  const slotFollowsAnchor = !!(
    slot
    && (anchorLink.compareDocumentPosition(slot) & 4)
  );
  return slotFollowsAnchor ? slot : anchorLink.nextElementSibling;
}

export function ensureFeatureStylesheet(
  group: FeatureStylesheetGroup,
  docRef?: Document | null
): Promise<FeatureStylesheetLoadResult> {
  const relativePath = FEATURE_STYLESHEET_PATHS[group];
  const documentRef = resolveDocument(docRef);
  if (!relativePath || !documentRef || !documentRef.head) {
    return Promise.resolve(warnAndResolve(group, relativePath || '', `cannot load stylesheet for ${String(group)}`));
  }

  let loads = documentLoads.get(documentRef);
  if (!loads) {
    loads = new Map();
    documentLoads.set(documentRef, loads);
  }
  const cached = loads.get(group);
  if (cached) return cached.promise;

  const href = getFeatureStylesheetHref(group, documentRef);
  const existing = documentRef.querySelector(
    `link[data-card-reversi-feature-style="${group}"]`
  ) as HTMLLinkElement | null;
  if (existing && existing.dataset.cardReversiFeatureStyleLoaded === 'true') {
    const result = { ok: true, group, href } as FeatureStylesheetLoadResult;
    const loadedState: FeatureStylesheetLoadState = {
      promise: Promise.resolve(result),
      link: existing,
      settle: () => undefined,
      settled: true
    };
    loads.set(group, loadedState);
    return loadedState.promise;
  }

  const link = existing || documentRef.createElement('link');
  link.rel = 'stylesheet';
  link.setAttribute('data-card-reversi-feature-style', group);
  link.setAttribute('data-card-reversi-feature-style-href', relativePath);

  let settlePending: (result: FeatureStylesheetLoadResult) => void = () => undefined;
  const state: FeatureStylesheetLoadState = {
    promise: Promise.resolve({ ok: false, group, href }),
    link,
    settle: (result) => settlePending(result),
    settled: false
  };
  const pending = new Promise<FeatureStylesheetLoadResult>((resolve) => {
    settlePending = (result) => {
      if (state.settled) return;
      state.settled = true;
      resolve(result);
    };
    const cleanup = () => {
      link.onload = null;
      link.onerror = null;
    };
    link.onload = () => {
      link.dataset.cardReversiFeatureStyleLoaded = 'true';
      const now = documentRef.defaultView?.performance?.now;
      if (typeof now === 'function') {
        link.dataset.cardReversiFeatureStyleReadyAt = String(
          now.call(documentRef.defaultView?.performance)
        );
      }
      cleanup();
      state.settle({ ok: true, group, href });
    };
    link.onerror = () => {
      cleanup();
      if (link.parentNode) link.parentNode.removeChild(link);
      loads!.delete(group);
      state.settle(warnAndResolve(group, href, `failed to load ${relativePath}`));
    };
    if (!existing) {
      link.href = href;
      const anchor = findFeatureStylesheetInsertionAnchor(group, documentRef);
      if (anchor?.parentNode) {
        anchor.parentNode.insertBefore(link, anchor);
      } else {
        documentRef.head.appendChild(link);
      }
    }
  });
  state.promise = pending;
  loads.set(group, state);
  return pending;
}

export function discardFeatureStylesheet(
  group: FeatureStylesheetGroup,
  docRef?: Document | null
): boolean {
  const documentRef = resolveDocument(docRef);
  if (!documentRef) return false;
  const loads = documentLoads.get(documentRef);
  const state = loads?.get(group);
  const link = state?.link || documentRef.querySelector(
    `link[data-card-reversi-feature-style="${group}"]`
  ) as HTMLLinkElement | null;
  if (!state && !link) return false;

  if (link) {
    link.onload = null;
    link.onerror = null;
    if (link.parentNode) link.parentNode.removeChild(link);
  }
  loads?.delete(group);
  if (state && !state.settled) {
    state.settle({
      ok: false,
      group,
      href: getFeatureStylesheetHref(group, documentRef),
      warning: `discarded stylesheet for ${group}`
    });
  }
  return true;
}

const FeatureStylesheetLoader = {
  FEATURE_STYLESHEET_PATHS,
  discardFeatureStylesheet,
  ensureFeatureStylesheet,
  getFeatureStylesheetHref
};

export default FeatureStylesheetLoader;
