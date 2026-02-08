// scripts/test-shim-forwarding.js
const path = require('path');

const uiBootPath = path.resolve(__dirname, '..', 'ui', 'bootstrap.js');
const sharedPath = path.resolve(__dirname, '..', 'shared', 'ui-bootstrap-shared.js');

const calls = [];
// Ensure any existing module is cleared
try { delete require.cache[require.resolve(uiBootPath)]; } catch(e){}

// Insert mock
require.cache[require.resolve(uiBootPath)] = {
  id: uiBootPath,
  filename: uiBootPath,
  loaded: true,
  exports: {
    registerUIGlobals: (obj) => { calls.push(obj); return obj; }
  }
};

// Clear shared module cache and require
try { delete require.cache[require.resolve(sharedPath)]; } catch(e){}
const s = require(sharedPath);
s.registerUIGlobals({ testKey: 'value' });

console.log('calls.length=', calls.length, 'last=', calls[calls.length-1]);
process.exit(calls.length >= 1 && calls[calls.length-1].testKey === 'value' ? 0 : 2);
