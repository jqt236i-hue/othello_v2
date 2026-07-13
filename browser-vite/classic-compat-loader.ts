import {
  inspectRuntimeContract,
  readClassicScriptContract,
  type ClassicScriptContract,
  type RuntimeContractInspection
} from './runtime-contract';

declare const __CARD_REVERSI_CLASSIC_ROOT__: string;

type RuntimeRoot = Window & Record<string, any>;

export interface BrowserBootMetrics {
  lane: 'vite';
  startedAt: number;
  readyAt?: number;
  durationMs?: number;
  loadedScripts: string[];
  state: 'booting' | 'ready' | 'error';
  error?: string;
}

export interface StartBrowserAppOptions {
  root?: RuntimeRoot;
  document?: Document;
  contract?: ClassicScriptContract;
  classicRootUrl?: string;
  timeoutMs?: number;
  loadScript?: (url: string, key: keyof ClassicScriptContract) => Promise<void>;
  now?: () => number;
}

function defaultClassicRootUrl(): string {
  return typeof __CARD_REVERSI_CLASSIC_ROOT__ !== 'undefined'
    ? __CARD_REVERSI_CLASSIC_ROOT__
    : './';
}

function waitForDocumentReady(documentRef: Document): Promise<void> {
  if (documentRef.readyState !== 'loading') return Promise.resolve();
  return new Promise((resolve) => {
    documentRef.addEventListener('DOMContentLoaded', () => resolve(), { once: true });
  });
}

function loadClassicScript(documentRef: Document, url: string, key: keyof ClassicScriptContract): Promise<void> {
  return new Promise((resolve, reject) => {
    const absoluteUrl = new URL(url, documentRef.baseURI).href;
    const scripts = Array.from(documentRef.getElementsByTagName('script'));
    const existing = scripts.find((script) => (
      script.getAttribute('data-card-reversi-vite-compat') === key
      || (script.src && new URL(script.src, documentRef.baseURI).href === absoluteUrl)
    ));
    if (existing && existing.getAttribute('data-card-reversi-loaded') === 'true') {
      resolve();
      return;
    }
    const script = existing || documentRef.createElement('script');
    script.async = false;
    script.setAttribute('data-card-reversi-vite-compat', key);
    script.onload = () => {
      script.setAttribute('data-card-reversi-loaded', 'true');
      script.onload = null;
      script.onerror = null;
      resolve();
    };
    script.onerror = () => {
      script.onload = null;
      script.onerror = null;
      reject(new Error(`failed to load required classic script: ${key} (${absoluteUrl})`));
    };
    if (!existing) {
      script.src = absoluteUrl;
      (documentRef.head || documentRef.documentElement).appendChild(script);
    }
  });
}

function renderBootError(documentRef: Document, error: unknown): void {
  const message = error instanceof Error ? error.message : String(error);
  documentRef.documentElement.setAttribute('data-browser-boot-state', 'error');
  let element = documentRef.getElementById('browserViteBootError');
  if (!element) {
    element = documentRef.createElement('div');
    element.id = 'browserViteBootError';
    element.setAttribute('role', 'alert');
    element.style.cssText = 'position:fixed;inset:16px;z-index:2147483647;padding:16px;background:#240b0b;color:#fff;border:1px solid #f66;white-space:pre-wrap;';
    (documentRef.body || documentRef.documentElement).appendChild(element);
  }
  element.textContent = `Vite比較レーンの起動に失敗しました。\n${message}`;
}

async function waitForRuntimeReady(
  rootRef: RuntimeRoot,
  documentRef: Document,
  timeoutMs: number,
  now: () => number
): Promise<RuntimeContractInspection> {
  const startedAt = now();
  let lastInspection = inspectRuntimeContract(rootRef, documentRef);
  while (!lastInspection.ready && now() - startedAt < timeoutMs) {
    await new Promise((resolve) => setTimeout(resolve, 20));
    lastInspection = inspectRuntimeContract(rootRef, documentRef);
  }
  if (!lastInspection.ready) {
    throw new Error(`Vite runtime contract timed out: ${JSON.stringify(lastInspection)}`);
  }
  return lastInspection;
}

export function createStartBrowserApp(options: StartBrowserAppOptions = {}): () => Promise<RuntimeContractInspection> {
  let startPromise: Promise<RuntimeContractInspection> | null = null;
  return function startBrowserApp(): Promise<RuntimeContractInspection> {
    if (startPromise) return startPromise;
    const rootRef = options.root || window as RuntimeRoot;
    const documentRef = options.document || document;
    const now = options.now || (() => performance.now());
    const timeoutMs = Math.max(100, Number(options.timeoutMs) || 30000);
    const contract = options.contract || readClassicScriptContract(documentRef);
    const classicRootUrl = String(options.classicRootUrl || defaultClassicRootUrl()).trim() || './';
    const classicRoot = new URL(classicRootUrl, documentRef.baseURI);
    const loadScript = options.loadScript || ((url, key) => loadClassicScript(documentRef, url, key));
    const metrics: BrowserBootMetrics = {
      lane: 'vite',
      startedAt: now(),
      loadedScripts: [],
      state: 'booting'
    };
    rootRef.__CARD_REVERSI_BROWSER_LANE__ = 'vite';
    rootRef.__CARD_REVERSI_BROWSER_METRICS__ = metrics;
    rootRef.__CARD_REVERSI_BROWSER_CAPABILITIES__ = Object.freeze({
      esmEntry: true,
      dedicatedWorker: typeof rootRef.Worker === 'function'
    });
    documentRef.documentElement.setAttribute('data-browser-lane', 'vite');
    documentRef.documentElement.setAttribute('data-browser-boot-state', 'booting');

    startPromise = (async () => {
      const load = async (key: keyof ClassicScriptContract): Promise<void> => {
        const url = new URL(contract[key], classicRoot).href;
        await loadScript(url, key);
        metrics.loadedScripts.push(key);
      };
      await load('runtime');
      await load('registry');
      await load('layout');
      await waitForDocumentReady(documentRef);
      const stylesReady = rootRef.__CARD_REVERSI_CLASSIC_STYLES_READY__;
      if (stylesReady && typeof stylesReady.then === 'function') {
        await stylesReady;
      }
      await load('entry');
      if (rootRef.__uiInitialized !== true) {
        if (typeof rootRef.initializeUI !== 'function') {
          throw new Error('entry-browser did not expose initializeUI');
        }
        await Promise.resolve(rootRef.initializeUI());
      }
      const inspection = await waitForRuntimeReady(rootRef, documentRef, timeoutMs, now);
      metrics.readyAt = now();
      metrics.durationMs = metrics.readyAt - metrics.startedAt;
      metrics.state = 'ready';
      documentRef.documentElement.setAttribute('data-browser-boot-state', 'ready');
      rootRef.dispatchEvent(new rootRef.CustomEvent('card-reversi:browser-ready', { detail: metrics }));
      return inspection;
    })().catch((error) => {
      metrics.state = 'error';
      metrics.error = error instanceof Error ? error.message : String(error);
      renderBootError(documentRef, error);
      throw error;
    });
    return startPromise;
  };
}

let defaultStarter: (() => Promise<RuntimeContractInspection>) | null = null;

export function startBrowserApp(): Promise<RuntimeContractInspection> {
  if (!defaultStarter) defaultStarter = createStartBrowserApp();
  return defaultStarter();
}

export function resetBrowserAppStarterForTests(): void {
  defaultStarter = null;
}
