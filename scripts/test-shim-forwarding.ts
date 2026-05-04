import * as path from 'path';

declare const __non_webpack_require__: NodeRequire | undefined;

const _require: NodeRequire = (typeof __non_webpack_require__ !== 'undefined')
  ? __non_webpack_require__
  : require;

const uiBootPath = path.resolve(__dirname, '..', '..', 'ui', 'bootstrap.js');
const sharedPath = path.resolve(__dirname, '..', '..', 'shared', 'ui-bootstrap-shared.js');

const calls: any[] = [];
// Ensure any existing module is cleared
try { delete require.cache[require.resolve(uiBootPath)]; } catch(e){ /* Intentionally empty: module may not be cached */ }

// Insert mock
require.cache[require.resolve(uiBootPath)] = {
  id: uiBootPath,
  filename: uiBootPath,
  loaded: true,
  exports: {
    registerUIGlobals: (obj: any) => { calls.push(obj); return obj; }
  }
} as any;

// Clear shared module cache and require
try { delete require.cache[require.resolve(sharedPath)]; } catch(e){ /* Intentionally empty: module may not be cached */ }
const s = require(sharedPath);
s.registerUIGlobals({ testKey: 'value' });

console.log('calls.length=', calls.length, 'last=', calls[calls.length-1]);
process.exit(calls.length >= 1 && calls[calls.length-1].testKey === 'value' ? 0 : 2);
