export type FeatureStylesheetGroup = 'deck-builder' | 'gacha' | 'network' | 'leaderboard';

export interface FeatureStylesheetLoadResult {
  ok: boolean;
  group: FeatureStylesheetGroup;
  href: string;
  warning?: string;
}

const FEATURE_STYLESHEET_PATHS: Readonly<Record<FeatureStylesheetGroup, string>> = Object.freeze({
  'deck-builder': 'styles-feature-deck-builder.css',
  gacha: 'styles-feature-gacha.css',
  network: 'styles-feature-network.css',
  leaderboard: 'styles-leaderboard.css'
});

const documentLoads = new WeakMap<Document, Map<FeatureStylesheetGroup, Promise<FeatureStylesheetLoadResult>>>();

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
  if (cached) return cached;

  const href = getFeatureStylesheetHref(group, documentRef);
  const existing = documentRef.querySelector(
    `link[data-card-reversi-feature-style="${group}"]`
  ) as HTMLLinkElement | null;
  if (existing && existing.dataset.cardReversiFeatureStyleLoaded === 'true') {
    const loaded = Promise.resolve({ ok: true, group, href } as FeatureStylesheetLoadResult);
    loads.set(group, loaded);
    return loaded;
  }

  const link = existing || documentRef.createElement('link');
  link.rel = 'stylesheet';
  link.setAttribute('data-card-reversi-feature-style', group);
  link.setAttribute('data-card-reversi-feature-style-href', relativePath);

  const pending = new Promise<FeatureStylesheetLoadResult>((resolve) => {
    const cleanup = () => {
      link.onload = null;
      link.onerror = null;
    };
    link.onload = () => {
      link.dataset.cardReversiFeatureStyleLoaded = 'true';
      cleanup();
      resolve({ ok: true, group, href });
    };
    link.onerror = () => {
      cleanup();
      if (link.parentNode) link.parentNode.removeChild(link);
      loads!.delete(group);
      resolve(warnAndResolve(group, href, `failed to load ${relativePath}`));
    };
    if (!existing) {
      link.href = href;
      documentRef.head.appendChild(link);
    }
  });
  loads.set(group, pending);
  return pending;
}

const FeatureStylesheetLoader = {
  FEATURE_STYLESHEET_PATHS,
  ensureFeatureStylesheet,
  getFeatureStylesheetHref
};

export default FeatureStylesheetLoader;
