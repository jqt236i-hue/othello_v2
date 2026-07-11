"use strict";
/** @type {any} */
const api = process.env.JEST_WORKER_ID
  ? require('./network-client.ts')
  : require('../dist/ui/network-client');
try {
  if (api && typeof api.initializeNetworkMatchClientRuntime === 'function') {
    api.initializeNetworkMatchClientRuntime(typeof window !== 'undefined' ? window : globalThis);
  } else if (typeof globalThis !== 'undefined') {
    globalThis.NetworkMatchClient = api;
    if (typeof window !== 'undefined') window.NetworkMatchClient = api;
  }
} catch (e) { /* ignore */ }
module.exports = api;
