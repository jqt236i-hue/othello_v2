import { createStartViteBrowserApp, installVitePreloadErrorHandler } from './native-app-loader';
import { OPTIONAL_PAYLOAD_URLS } from './generated/optional-payload-urls';
import { FEATURE_IMPORTS } from './optional-feature-adapters';
import { installOptionalFeatureLoader } from './optional-feature-loader';
import { installOptionalPayloadLoader } from './optional-payload-loader';
import { installCpuWorkerBridge } from './cpu-worker/bridge';
import { applyPixiRuntimeOutcome, loadPixiRuntime } from './pixi-runtime-loader';

installVitePreloadErrorHandler();
installOptionalPayloadLoader({ payloadUrls: OPTIONAL_PAYLOAD_URLS });

const startBrowserApp = createStartViteBrowserApp({
  loadPixiRuntime: (root) => loadPixiRuntime({
    root,
    importer: async () => {
      // Install Pixi's official CSP-safe shader/uniform generators before any
      // renderer can be created. This keeps production script-src free of
      // unsafe-eval while preserving a catchable, lazy Pixi runtime boundary.
      await import('pixi.js/unsafe-eval');
      return import('pixi.js');
    }
  }),
  beforeInitialize: (root, documentRef, pixiRuntime) => {
    const pixiRuntimeInjected = applyPixiRuntimeOutcome(root, pixiRuntime);
    const cpuWorkerBridge = installCpuWorkerBridge(root, documentRef);
    let candidateScoringInjected = false;
    if (
      cpuWorkerBridge &&
      root.UIBootstrap &&
      typeof root.UIBootstrap.configureCpuCandidateScoring === 'function'
    ) {
      candidateScoringInjected = root.UIBootstrap.configureCpuCandidateScoring({
        scoreCandidatesInWorker: cpuWorkerBridge.scoreCandidatesInWorker,
        searchCardQuiescenceInWorker: cpuWorkerBridge.searchCardQuiescenceInWorker
      }) === true;
    }
    root.__CARD_REVERSI_BROWSER_CAPABILITIES__ = Object.freeze(Object.assign(
      {},
      root.__CARD_REVERSI_BROWSER_CAPABILITIES__ || {},
      {
        cpuCandidateScoringInjected: candidateScoringInjected,
        pixiRuntimeInjected,
        boardPerformanceHarnessEligible: (() => {
          const params = new URLSearchParams(String(root.location?.search || ''));
          return params.get('debug') === '1' && params.get('boardPerf') === '1';
        })()
      }
    ));
    installOptionalFeatureLoader({ root, document: documentRef, featureImports: FEATURE_IMPORTS });
  }
});
const bootPromise = startBrowserApp();

void bootPromise.catch((error) => {
  console.error('[vite-entry] browser boot failed', error);
});

export { bootPromise };
