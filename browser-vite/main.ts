import { createStartBrowserApp } from './classic-compat-loader';
import { installOptionalFeatureLoader } from './optional-feature-loader';
import { installCpuWorkerBridge } from './cpu-worker/bridge';

const startBrowserApp = createStartBrowserApp({
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
    installOptionalFeatureLoader({ root, document: documentRef });
  }
});
const bootPromise = startBrowserApp();

void bootPromise.catch((error) => {
  console.error('[vite-entry] browser boot failed', error);
});

export { bootPromise };
