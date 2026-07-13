import { createStartBrowserApp } from './classic-compat-loader';
import { installOptionalFeatureLoader } from './optional-feature-loader';

const startBrowserApp = createStartBrowserApp({
  beforeInitialize: (root, documentRef) => {
    installOptionalFeatureLoader({ root, document: documentRef });
  }
});
const bootPromise = startBrowserApp();

void bootPromise.catch((error) => {
  console.error('[vite-entry] browser boot failed', error);
});

export { bootPromise };
