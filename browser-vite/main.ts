import { createStartViteBrowserApp, installVitePreloadErrorHandler } from './native-app-loader';
import { OPTIONAL_PAYLOAD_URLS } from './generated/optional-payload-urls';
import { FEATURE_IMPORTS } from './optional-feature-adapters';
import { installOptionalFeatureLoader } from './optional-feature-loader';
import { installOptionalPayloadLoader } from './optional-payload-loader';
import { installCpuWorkerBridge } from './cpu-worker/bridge';

installVitePreloadErrorHandler();
installOptionalPayloadLoader({ payloadUrls: OPTIONAL_PAYLOAD_URLS });

const startBrowserApp = createStartViteBrowserApp({
  beforeInitialize: (root, documentRef) => {
    const cpuWorkerBridge = installCpuWorkerBridge(root, documentRef);
    let candidateScoringInjected = false;
    if (
      cpuWorkerBridge &&
      root.UIBootstrap &&
      typeof root.UIBootstrap.configureCpuCandidateScoring === 'function'
    ) {
      candidateScoringInjected = root.UIBootstrap.configureCpuCandidateScoring({
        scoreCandidatesInWorker: cpuWorkerBridge.scoreCandidatesInWorker
      }) === true;
    }
    root.__CARD_REVERSI_BROWSER_CAPABILITIES__ = Object.freeze(Object.assign(
      {},
      root.__CARD_REVERSI_BROWSER_CAPABILITIES__ || {},
      { cpuCandidateScoringInjected: candidateScoringInjected }
    ));
    installOptionalFeatureLoader({ root, document: documentRef, featureImports: FEATURE_IMPORTS });
  }
});
const bootPromise = startBrowserApp();

void bootPromise.catch((error) => {
  console.error('[vite-entry] browser boot failed', error);
});

export { bootPromise };
