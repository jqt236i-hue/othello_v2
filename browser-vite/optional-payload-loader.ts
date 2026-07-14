import type { OptionalFeatureGroup } from './features/feature-registry';

type RuntimeRoot = Window & Record<string, any>;

export interface OptionalPayloadLoader {
  load: (group: OptionalFeatureGroup) => Promise<boolean>;
  isLoaded: (group: OptionalFeatureGroup) => boolean;
  getAttemptCount: (group: OptionalFeatureGroup) => number;
}

export interface InstallOptionalPayloadLoaderOptions {
  root?: RuntimeRoot;
  document?: Document;
  importModule?: (url: string) => Promise<unknown>;
  payloadUrls?: Partial<Record<OptionalFeatureGroup, string>>;
}

function appendRetryQuery(url: string, attempt: number): string {
  if (attempt <= 1) return url;
  const parsed = new URL(url);
  parsed.searchParams.set('cardReversiRetry', String(attempt));
  return parsed.href;
}

export function installOptionalPayloadLoader(options: InstallOptionalPayloadLoaderOptions = {}): OptionalPayloadLoader {
  const rootRef = options.root || window as RuntimeRoot;
  const documentRef = options.document || document;
  const existing = rootRef.__CARD_REVERSI_VITE_OPTIONAL_PAYLOAD_LOADER__;
  if (existing && typeof existing.load === 'function') return existing;
  const payloadUrls = Object.assign({}, options.payloadUrls || {});
  const importModule = options.importModule || ((url: string) => import(/* @vite-ignore */ url));
  const attempts = new Map<OptionalFeatureGroup, number>();
  const inFlight = new Map<OptionalFeatureGroup, Promise<boolean>>();
  const loaded = new Set<OptionalFeatureGroup>();

  const load = (group: OptionalFeatureGroup): Promise<boolean> => {
    if (loaded.has(group)) return Promise.resolve(true);
    const current = inFlight.get(group);
    if (current) return current;
    const configuredUrl = payloadUrls[group];
    if (!configuredUrl) return Promise.reject(new Error(`missing Vite optional payload URL: ${group}`));
    const attempt = (attempts.get(group) || 0) + 1;
    attempts.set(group, attempt);
    const absoluteUrl = new URL(configuredUrl, documentRef.baseURI).href;
    const requestUrl = appendRetryQuery(absoluteUrl, attempt);
    const next = Promise.resolve(importModule(requestUrl)).then(() => {
      const bridge = rootRef.__CARD_REVERSI_VITE_MODULE_BRIDGE__;
      if (!bridge || typeof bridge.registeredGroups !== 'function') {
        throw new Error(`Vite optional payload ${group} loaded without the module bridge`);
      }
      const groups = bridge.registeredGroups();
      if (!Array.isArray(groups) || !groups.includes(group)) {
        throw new Error(`Vite optional payload ${group} did not register its modules`);
      }
      loaded.add(group);
      return true;
    });
    inFlight.set(group, next);
    next.then(() => inFlight.delete(group), () => inFlight.delete(group));
    return next;
  };

  const loader: OptionalPayloadLoader = Object.freeze({
    load,
    isLoaded: (group: OptionalFeatureGroup) => loaded.has(group),
    getAttemptCount: (group: OptionalFeatureGroup) => attempts.get(group) || 0
  });
  rootRef.__CARD_REVERSI_LOAD_VITE_OPTIONAL_PAYLOAD__ = load;
  rootRef.__CARD_REVERSI_VITE_OPTIONAL_PAYLOAD_LOADER__ = loader;
  return loader;
}
