export type OptionalFeatureGroup = 'gacha' | 'cosmetic' | 'leaderboard' | 'commentary' | 'cpu' | 'onnx';

export interface OptionalFeatureContext {
  root: Window & Record<string, any>;
  document: Document;
  loadScript?: (src: string, group: OptionalFeatureGroup) => Promise<unknown>;
}

function appendStartupVersion(src: string, documentRef: Document): string {
  try {
    const startup = documentRef.querySelector('script[src*="public/module-registry.js"]') as HTMLScriptElement | null;
    if (!startup || !startup.src) return src;
    const version = new URL(startup.src, documentRef.baseURI).searchParams.get('v');
    return version ? `${src}?v=${encodeURIComponent(version)}` : src;
  } catch (e) {
    return src;
  }
}

function loadScriptElement(src: string, group: OptionalFeatureGroup, documentRef: Document): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const absoluteUrl = new URL(src, documentRef.baseURI).href;
    const scripts = Array.from(documentRef.getElementsByTagName('script'));
    const existing = scripts.find((script) => (
      script.getAttribute('data-card-reversi-optional-group') === group
      || (script.src && new URL(script.src, documentRef.baseURI).href === absoluteUrl)
    ));
    if (existing && existing.getAttribute('data-lazy-runtime-loaded') === 'true') {
      resolve(true);
      return;
    }
    const script = existing || documentRef.createElement('script');
    script.async = false;
    script.setAttribute('data-card-reversi-optional-group', group);
    script.setAttribute('data-lazy-runtime-src', src);
    const cleanup = () => {
      script.onload = null;
      script.onerror = null;
    };
    script.onload = () => {
      script.setAttribute('data-lazy-runtime-loaded', 'true');
      cleanup();
      resolve(true);
    };
    script.onerror = () => {
      cleanup();
      if (script.parentNode) script.parentNode.removeChild(script);
      reject(new Error(`failed to load optional ${group} registry: ${absoluteUrl}`));
    };
    if (!existing) {
      script.src = absoluteUrl;
      (documentRef.head || documentRef.documentElement).appendChild(script);
    }
  });
}

function assertRegisteredModules(rootRef: Window & Record<string, any>, group: OptionalFeatureGroup, moduleKeys: string[]): void {
  if (typeof rootRef.require !== 'function') {
    throw new Error(`optional ${group} registry loaded without the CommonJS compatibility runtime`);
  }
  for (const moduleKey of moduleKeys) {
    const moduleRef = rootRef.require(moduleKey);
    if (!moduleRef) throw new Error(`optional ${group} module is unavailable: ${moduleKey}`);
  }
}

export async function loadOptionalFeatureRegistry(
  group: OptionalFeatureGroup,
  context: OptionalFeatureContext,
  requiredModuleKeys: string[] = []
): Promise<boolean> {
  const src = appendStartupVersion(`public/module-registry.optional.${group}.js`, context.document);
  const loadScript = context.loadScript
    || ((url: string, featureGroup: OptionalFeatureGroup) => loadScriptElement(url, featureGroup, context.document));
  await loadScript(src, group);
  const restore = context.root.__restoreCardReversiOptionalBootEntries;
  if (typeof restore === 'function') restore(group);
  assertRegisteredModules(context.root, group, requiredModuleKeys);
  return true;
}
