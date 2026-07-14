import './generated/startup-modules';
import { inspectRuntimeContract, type RuntimeContractInspection } from './runtime-contract';
import { installModuleBridge } from './module-bridge';

type RuntimeRoot = Window & Record<string, any>;

export interface ViteBrowserBootMetrics {
  lane: 'vite';
  moduleDelivery: 'vite-bundled';
  startedAt: number;
  readyAt?: number;
  durationMs?: number;
  loadedModules: string[];
  state: 'booting' | 'ready' | 'error';
  error?: string;
}

export interface StartViteBrowserAppOptions {
  root?: RuntimeRoot;
  document?: Document;
  timeoutMs?: number;
  now?: () => number;
  loadLayout?: () => Promise<unknown>;
  loadEntry?: () => Promise<unknown>;
  beforeInitialize?: (root: RuntimeRoot, document: Document) => void | Promise<void>;
}

function waitForDocumentReady(documentRef: Document): Promise<void> {
  if (documentRef.readyState !== 'loading') return Promise.resolve();
  return new Promise((resolve) => {
    documentRef.addEventListener('DOMContentLoaded', () => resolve(), { once: true });
  });
}

export function renderBootError(documentRef: Document, error: unknown): void {
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
  element.textContent = `ゲームの起動に失敗しました。再読み込みしてください。\n${message}`;
}

export function installVitePreloadErrorHandler(
  rootRef: RuntimeRoot = window as RuntimeRoot,
  documentRef: Document = document
): void {
  if (rootRef.__CARD_REVERSI_VITE_PRELOAD_ERROR_HANDLER__) return;
  const handler = (event: Event): void => {
    if (typeof event.preventDefault === 'function') event.preventDefault();
    renderBootError(
      documentRef,
      new Error('更新されたゲームファイルを取得できませんでした。ページを再読み込みしてください。')
    );
  };
  rootRef.addEventListener('vite:preloadError', handler);
  rootRef.__CARD_REVERSI_VITE_PRELOAD_ERROR_HANDLER__ = handler;
}

async function waitForRuntimeReady(
  rootRef: RuntimeRoot,
  documentRef: Document,
  timeoutMs: number,
  now: () => number
): Promise<RuntimeContractInspection> {
  const startedAt = now();
  let inspection = inspectRuntimeContract(rootRef, documentRef);
  while (!inspection.ready && now() - startedAt < timeoutMs) {
    await new Promise((resolve) => setTimeout(resolve, 20));
    inspection = inspectRuntimeContract(rootRef, documentRef);
  }
  if (!inspection.ready) {
    throw new Error(`Vite runtime contract timed out: ${JSON.stringify(inspection)}`);
  }
  return inspection;
}

export function createStartViteBrowserApp(
  options: StartViteBrowserAppOptions = {}
): () => Promise<RuntimeContractInspection> {
  let startPromise: Promise<RuntimeContractInspection> | null = null;
  return (): Promise<RuntimeContractInspection> => {
    if (startPromise) return startPromise;
    const rootRef = options.root || window as RuntimeRoot;
    const documentRef = options.document || document;
    const now = options.now || (() => performance.now());
    const timeoutMs = Math.max(100, Number(options.timeoutMs) || 30000);
    const loadLayout = options.loadLayout || (() => import('../ui/layout-stage'));
    const loadEntry = options.loadEntry || (() => import('../entry-browser.js'));
    const metrics: ViteBrowserBootMetrics = {
      lane: 'vite',
      moduleDelivery: 'vite-bundled',
      startedAt: now(),
      loadedModules: ['startup'],
      state: 'booting'
    };

    rootRef.__CARD_REVERSI_BROWSER_LANE__ = 'vite';
    rootRef.__CARD_REVERSI_BROWSER_METRICS__ = metrics;
    rootRef.__CARD_REVERSI_BROWSER_CAPABILITIES__ = Object.freeze({
      esmEntry: true,
      viteBundledModules: true,
      customModuleRegistry: false,
      dedicatedWorker: typeof rootRef.Worker === 'function'
    });
    documentRef.documentElement.setAttribute('data-browser-lane', 'vite');
    documentRef.documentElement.setAttribute('data-browser-boot-state', 'booting');
    installModuleBridge(rootRef);

    startPromise = (async () => {
      await waitForDocumentReady(documentRef);
      const stylesReady = rootRef.__CARD_REVERSI_CLASSIC_STYLES_READY__;
      if (stylesReady && typeof stylesReady.then === 'function') await stylesReady;
      await loadLayout();
      metrics.loadedModules.push('layout');
      await loadEntry();
      metrics.loadedModules.push('entry');
      if (typeof options.beforeInitialize === 'function') {
        await options.beforeInitialize(rootRef, documentRef);
      }
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
      if (typeof rootRef.dispatchEvent === 'function' && typeof rootRef.CustomEvent === 'function') {
        rootRef.dispatchEvent(new rootRef.CustomEvent('card-reversi:browser-ready', { detail: metrics }));
      }
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
