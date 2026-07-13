import { startBrowserApp } from './classic-compat-loader';

const bootPromise = startBrowserApp();

void bootPromise.catch((error) => {
  console.error('[vite-entry] browser boot failed', error);
});

export { bootPromise };
